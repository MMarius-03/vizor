import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = (selector) => document.querySelector(selector);
const ui = {
  viewport: $("#viewport"), stage: $(".stage"), loading: $("#loading"),
  error: $("#error-panel"), errorDetail: $("#error-detail"),
  manualMode: $("#manual-mode"), clipMode: $("#clip-mode"),
  list: $("#parts-list"), count: $("#parts-count"),
  stageStatus: $("#stage-status"), instruction: $("#instruction"),
  marker: $("#part-marker"), handCursor: $("#hand-cursor"),
  index: $("#inspector-index"), symbol: $("#part-symbol"),
  kicker: $("#part-kicker"), title: $("#part-title"),
  description: $("#part-description"), slider: $("#part-slider"),
  progressLabel: $("#part-progress-label"), action: $("#part-action"),
  timeline: $("#timeline"), play: $("#play-toggle"),
  timeSlider: $("#time-slider"), timeReadout: $("#time-readout"),
  camera: $("#camera-feed"), cameraToggle: $("#camera-toggle"),
  gestureStatus: $("#gesture-status"), toast: $("#toast"),
};

// Numele sunt identități stabile ale exportului curent, nu indicii de mesh.
// Maparea fizică este provizorie până la inventarul complet al modelului.
const PART_DEFS = [
  {
    id: "piston",
    name: "Cap de piston",
    subtitle: "CILINDRUL 01",
    symbol: "◉",
    description: "Piesa superioară a primului piston. O poți extrage separat și o poți pune înapoi pe același traseu.",
    meshName: "Cylinder_028_76_0",
    distance: 1.55,
    axis: [0.25, 0.9, 0.35],
  },
  {
    id: "rod",
    name: "Bielă",
    subtitle: "CILINDRUL 01",
    symbol: "⌁",
    description: "Brațul asociat pistonului. Se mișcă independent de capul de piston în modul atelier.",
    meshName: "Cylinder_001_72_0",
    distance: 1.75,
    axis: [-0.35, -0.7, 0.5],
  },
  {
    id: "shell",
    name: "Carcasă transparentă",
    subtitle: "STRUCTURĂ FIXĂ",
    symbol: "⬡",
    description: "Elementul transparent de protecție. Acesta nu primește canale de animație în clipul original.",
    meshName: "Cube_116_0",
    distance: 2.05,
    axis: [0.2, 0.9, -0.35],
  },
];

const state = {
  ready: false,
  mode: "manual",
  playing: false,
  clipTime: 0,
  duration: 10.42,
  selectedId: null,
  drag: null,
  tweens: new Map(),
  gesture: null,
  cameraToken: 0,
  lastFrame: 0,
  toastTimer: null,
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
camera.position.set(6, 3.7, 8.8);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
ui.viewport.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 4;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * 0.9;
controls.enablePan = false;
controls.target.set(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xcfe9e6, 0x182125, 3.15));
const keyLight = new THREE.DirectionalLight(0xffdfbc, 4.5);
keyLight.position.set(4, 7, 7);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x7de0de, 3.2);
rimLight.position.set(-6, 1, -5);
scene.add(rimLight);
const modelRoot = new THREE.Group();
scene.add(modelRoot);

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const scratchVector = new THREE.Vector3();
const scratchMatrix = new THREE.Matrix3();
const scratchMatrix4 = new THREE.Matrix4();
const parts = new Map();
let engine = null;
let mixer = null;
let selectionHelper = null;
let originalMaxDimension = 1;

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 3700);
}

function setStatus(text) {
  ui.stageStatus.textContent = text;
}

function formatTime(time) {
  const seconds = Math.floor(time);
  return `00:${String(seconds).padStart(2, "0")}`;
}

function renderPartRows() {
  ui.list.replaceChildren();
  PART_DEFS.forEach((definition, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "part-row";
    button.dataset.part = definition.id;
    button.innerHTML = `<span class="part-number">${String(index + 1).padStart(2, "0")}</span><span><span class="part-name"></span><span class="part-subtitle"></span></span><i class="part-state" aria-hidden="true"></i>`;
    button.querySelector(".part-name").textContent = definition.name;
    button.querySelector(".part-subtitle").textContent = definition.subtitle;
    button.addEventListener("click", () => selectPart(definition.id));
    ui.list.append(button);
  });
}

function refreshPartUi() {
  let extracted = 0;
  parts.forEach((part) => {
    if (part.progress > 0.95) extracted += 1;
    const row = ui.list.querySelector(`[data-part="${part.id}"]`);
    row?.classList.toggle("is-selected", part.id === state.selectedId);
    row?.classList.toggle("is-extracted", part.progress > 0.95);
    row?.setAttribute("aria-pressed", String(part.id === state.selectedId));
  });
  ui.count.textContent = `${String(extracted).padStart(2, "0")} / 03 EXTRASE`;
  const selected = parts.get(state.selectedId);
  if (!selected) return;
  ui.slider.value = Math.round(selected.progress * 100);
  ui.progressLabel.textContent = `${Math.round(selected.progress * 100)}%`;
  ui.action.firstChild.textContent = selected.progress > 0.5 ? "MONTEAZĂ PIESA " : "EXTRAGE PIESA ";
}

function setMode(mode) {
  if (!state.ready) return;
  if (mode === state.mode) return;
  state.mode = mode;
  state.playing = false;
  ui.manualMode.classList.toggle("is-active", mode === "manual");
  ui.clipMode.classList.toggle("is-active", mode === "clip");
  ui.manualMode.setAttribute("aria-pressed", String(mode === "manual"));
  ui.clipMode.setAttribute("aria-pressed", String(mode === "clip"));
  ui.timeline.hidden = mode !== "clip";
  ui.play.textContent = "▶";
  ui.play.setAttribute("aria-label", "Pornește animația");
  ui.instruction.textContent = mode === "manual"
    ? "Atinge o piesă și trage pe direcția de extragere"
    : "Trage cursorul pentru a inspecta animația originală";
  if (mode === "clip") {
    state.tweens.clear();
    parts.forEach((part) => setProgress(part, 0, false));
    state.clipTime = 0;
    mixer?.setTime(0);
    setStatus("ANIMAȚIA ORIGINALĂ / PAUZĂ");
  } else {
    state.clipTime = 0;
    mixer?.setTime(0);
    setStatus("ATELIER / 3 PIESE ACTIVE");
  }
  refreshPartUi();
  updateTimeline();
}

function updateTimeline() {
  ui.timeSlider.value = String(Math.round(state.clipTime / state.duration * 1000));
  ui.timeReadout.textContent = `${formatTime(state.clipTime)} / ${formatTime(state.duration)}`;
}

function setProgress(part, value, updateUi = true) {
  part.progress = THREE.MathUtils.clamp(value, 0, 1);
  part.mesh.parent.updateWorldMatrix(true, false);
  scratchMatrix4.copy(part.mesh.parent.matrixWorld).invert();
  scratchMatrix.setFromMatrix4(scratchMatrix4);
  const localOffset = part.axisWorld.clone().multiplyScalar(part.distance * part.progress).applyMatrix3(scratchMatrix);
  part.mesh.position.copy(part.basePosition).add(localOffset);
  part.mesh.updateWorldMatrix(false, false);
  if (updateUi) refreshPartUi();
}

function ease(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function animatePart(part, target, delay = 0) {
  state.tweens.set(part.id, {
    from: part.progress,
    to: target,
    start: performance.now() + delay,
    duration: 550,
  });
}

function snapPart(part) {
  animatePart(part, part.progress >= 0.5 ? 1 : 0);
}

function animateAll(target) {
  if (!state.ready) return;
  setMode("manual");
  const order = target === 1 ? ["shell", "piston", "rod"] : ["rod", "piston", "shell"];
  order.forEach((id, index) => animatePart(parts.get(id), target, index * 245));
  setStatus(target === 1 ? "DESFAC CELE 3 PIESE" : "REASAMBLEZ CELE 3 PIESE");
}

function selectPart(id) {
  if (!state.ready || !parts.has(id)) return;
  setMode("manual");
  state.selectedId = id;
  const part = parts.get(id);
  const index = PART_DEFS.findIndex((item) => item.id === id);
  ui.index.textContent = `${String(index + 1).padStart(2, "0")} / 03`;
  ui.symbol.textContent = part.symbol;
  ui.kicker.textContent = part.subtitle;
  ui.title.textContent = part.name;
  ui.description.textContent = part.description;
  ui.slider.disabled = false;
  ui.action.disabled = false;
  if (selectionHelper) {
    scene.remove(selectionHelper);
    selectionHelper.geometry.dispose();
    selectionHelper.material.dispose();
  }
  selectionHelper = new THREE.BoxHelper(part.mesh, 0xffae85);
  selectionHelper.material.transparent = true;
  selectionHelper.material.opacity = 0.7;
  selectionHelper.material.depthTest = false;
  selectionHelper.renderOrder = 9;
  scene.add(selectionHelper);
  parts.forEach((candidate) => {
    if (candidate.mesh.material.emissive) {
      candidate.mesh.material.emissive.setHex(candidate.id === id ? 0xff9167 : 0x000000);
      candidate.mesh.material.emissiveIntensity = candidate.id === id ? 0.42 : 0;
    }
  });
  refreshPartUi();
  setStatus(`ATELIER / ${part.name.toUpperCase()}`);
}

function installParts(gltf) {
  parts.clear();
  for (const definition of PART_DEFS) {
    const mesh = gltf.scene.getObjectByName(definition.meshName);
    if (!mesh?.isMesh) throw new Error(`Piesa ${definition.meshName} lipsește din model.`);
    // Materialele originale sunt partajate; clonăm doar materialele celor trei piese.
    mesh.material = mesh.material.clone();
    const part = {
      ...definition,
      mesh,
      basePosition: mesh.position.clone(),
      axisWorld: new THREE.Vector3(...definition.axis).normalize(),
      progress: 0,
    };
    parts.set(part.id, part);
  }
  refreshPartUi();
}

function disposeEngine() {
  if (selectionHelper) {
    scene.remove(selectionHelper);
    selectionHelper.geometry.dispose();
    selectionHelper.material.dispose();
    selectionHelper = null;
  }
  if (engine) {
    modelRoot.remove(engine);
    engine.traverse((object) => {
      object.geometry?.dispose?.();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    engine = null;
  }
  parts.clear();
  mixer?.stopAllAction();
  mixer = null;
}

function fitCamera() {
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const aspect = ui.viewport.clientWidth / Math.max(1, ui.viewport.clientHeight);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const vertical = size.y / (2 * Math.tan(fov / 2));
  const horizontalSpan = aspect < 1 ? Math.hypot(size.x, size.z) : Math.max(size.x, size.z);
  const horizontal = horizontalSpan / (2 * Math.tan(fov / 2) * aspect);
  const distance = Math.max(6.7, vertical, horizontal) * 1.25;
  camera.position.set(distance * 0.5, distance * 0.28, distance * 0.86);
  controls.target.set(0, 0, 0);
  controls.update();
}

function loadEngine() {
  state.ready = false;
  ui.loading.hidden = false;
  ui.error.hidden = true;
  setStatus("ÎNCARC MODELUL V8");
  disposeEngine();
  new GLTFLoader().load(
    "./assets/engine.glb",
    (gltf) => {
      try {
        engine = gltf.scene;
        modelRoot.add(engine);
        const box = new THREE.Box3();
        engine.traverse((object) => {
          if (!object.isMesh) return;
          const material = object.material;
          if (material.transparent && material.opacity < 0.3) return;
          box.expandByObject(object);
        });
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        originalMaxDimension = Math.max(size.x, size.y, size.z);
        engine.position.sub(center);
        modelRoot.scale.setScalar(4.75 / originalMaxDimension);
        engine.updateMatrixWorld(true);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(engine);
          mixer.clipAction(gltf.animations[0]).play();
          state.duration = gltf.animations[0].duration;
          mixer.setTime(0);
        }
        installParts(gltf);
        fitCamera();
        state.ready = true;
        ui.loading.hidden = true;
        state.mode = "clip";
        setMode("manual");
        selectPart("piston");
        updateTimeline();
      } catch (error) {
        showLoadError(error);
      }
    },
    (event) => {
      if (event.total) ui.loading.querySelector("span").textContent = `Încarc geometria și animația · ${Math.round(event.loaded / event.total * 100)}%`;
    },
    showLoadError,
  );
}

function showLoadError(error) {
  ui.loading.hidden = true;
  ui.error.hidden = false;
  ui.errorDetail.textContent = error?.message || "Verifică fișierul GLB și conexiunea la internet.";
  setStatus("MODEL INDISPONIBIL");
  state.ready = false;
}

function setPointerFromClient(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.x = (clientX - rect.left) / rect.width * 2 - 1;
  pointerNdc.y = -(clientY - rect.top) / rect.height * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
}

function pickPart(clientX, clientY) {
  if (!state.ready) return null;
  setPointerFromClient(clientX, clientY);
  const hits = raycaster.intersectObjects([...parts.values()].map((part) => part.mesh), false);
  return hits.length ? [...parts.values()].find((part) => part.mesh === hits[0].object) : null;
}

function screenDirection(part) {
  const box = new THREE.Box3().setFromObject(part.mesh);
  const center = box.getCenter(new THREE.Vector3());
  const end = center.clone().addScaledVector(part.axisWorld, part.distance);
  center.project(camera);
  end.project(camera);
  const rect = renderer.domElement.getBoundingClientRect();
  const dx = (end.x - center.x) * rect.width / 2;
  const dy = -(end.y - center.y) * rect.height / 2;
  const length = Math.hypot(dx, dy);
  if (length < 24) return { x: 0, y: -1, pixels: Math.min(rect.width, rect.height) * 0.35 };
  return { x: dx / length, y: dy / length, pixels: length };
}

function updateDrag(part, startX, startY, startProgress, axis, clientX, clientY) {
  const movement = (clientX - startX) * axis.x + (clientY - startY) * axis.y;
  state.tweens.delete(part.id);
  setProgress(part, startProgress + movement / Math.max(75, axis.pixels));
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (state.mode !== "manual" || event.button > 0) return;
  const part = pickPart(event.clientX, event.clientY);
  if (!part) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  selectPart(part.id);
  state.tweens.delete(part.id);
  state.drag = {
    pointerId: event.pointerId,
    part,
    x: event.clientX,
    y: event.clientY,
    progress: part.progress,
    axis: screenDirection(part),
    moved: false,
  };
  renderer.domElement.setPointerCapture(event.pointerId);
}, true);

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const drag = state.drag;
  drag.moved ||= Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5;
  updateDrag(drag.part, drag.x, drag.y, drag.progress, drag.axis, event.clientX, event.clientY);
}, true);

function finishDrag(event, snap) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (snap && state.drag.moved) snapPart(state.drag.part);
  state.drag = null;
}
renderer.domElement.addEventListener("pointerup", (event) => finishDrag(event, true), true);
renderer.domElement.addEventListener("pointercancel", (event) => finishDrag(event, false), true);

function updatePartMarker() {
  const part = parts.get(state.selectedId);
  if (!part || state.mode !== "manual") {
    ui.marker.hidden = true;
    return;
  }
  const center = new THREE.Box3().setFromObject(part.mesh).getCenter(scratchVector);
  center.project(camera);
  if (center.z < -1 || center.z > 1) {
    ui.marker.hidden = true;
    return;
  }
  const width = ui.viewport.clientWidth;
  const height = ui.viewport.clientHeight;
  const x = (center.x * 0.5 + 0.5) * width;
  const y = (-center.y * 0.5 + 0.5) * height;
  ui.marker.hidden = x < 0 || x > width || y < 0 || y > height;
  ui.marker.style.left = `${Math.min(width - 95, x + 17)}px`;
  ui.marker.style.top = `${Math.max(50, y - 16)}px`;
  ui.marker.querySelector("span").textContent = part.name.toUpperCase();
}

function landmarkDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function landmarkToScreen(point) {
  const rect = ui.viewport.getBoundingClientRect();
  const videoWidth = ui.camera.videoWidth || rect.width;
  const videoHeight = ui.camera.videoHeight || rect.height;
  const scale = Math.max(rect.width / videoWidth, rect.height / videoHeight);
  const drawnWidth = videoWidth * scale;
  const drawnHeight = videoHeight * scale;
  const offsetX = (rect.width - drawnWidth) / 2;
  const offsetY = (rect.height - drawnHeight) / 2;
  return { x: rect.left + rect.width - (offsetX + point.x * drawnWidth), y: rect.top + offsetY + point.y * drawnHeight };
}

function processHand(landmarks, now) {
  const gesture = state.gesture;
  const point = landmarkToScreen(landmarks[8]);
  gesture.lastHand = now;
  ui.handCursor.hidden = false;
  ui.handCursor.style.left = `${point.x - ui.viewport.getBoundingClientRect().left}px`;
  ui.handCursor.style.top = `${point.y - ui.viewport.getBoundingClientRect().top}px`;
  const palmSize = Math.max(landmarkDistance(landmarks[0], landmarks[9]), 0.04);
  const ratio = landmarkDistance(landmarks[4], landmarks[8]) / palmSize;
  const pinching = ratio < (gesture.pinching ? 0.56 : 0.39);
  const hovered = pickPart(point.x, point.y);
  if (hovered?.id !== gesture.hoveredId) {
    gesture.hoveredId = hovered?.id || null;
    gesture.hoverStarted = now;
  } else if (hovered && now - gesture.hoverStarted > 620 && state.selectedId !== hovered.id) {
    selectPart(hovered.id);
    gesture.hoverStarted = now + 2000;
  }
  if (pinching && !gesture.pinching) {
    if (hovered) selectPart(hovered.id);
    const selected = parts.get(state.selectedId);
    if (selected) {
      gesture.drag = { part: selected, x: point.x, y: point.y, progress: selected.progress, axis: screenDirection(selected) };
      state.tweens.delete(selected.id);
    }
  } else if (pinching && gesture.drag) {
    const drag = gesture.drag;
    updateDrag(drag.part, drag.x, drag.y, drag.progress, drag.axis, point.x, point.y);
  } else if (!pinching && gesture.pinching && gesture.drag) {
    snapPart(gesture.drag.part);
    gesture.drag = null;
  }
  gesture.pinching = pinching;
  ui.handCursor.classList.toggle("is-pinching", pinching);
  ui.gestureStatus.textContent = pinching
    ? "Pinch activ: trage piesa de-a lungul traseului."
    : "Arată spre piesă pentru selecție; unește degetele pentru a o trage.";
}

function updateGesture(now) {
  const gesture = state.gesture;
  if (!gesture?.landmarker || ui.camera.readyState < 2 || now - gesture.lastDetection < 46) return;
  if (ui.camera.currentTime === gesture.lastVideoTime) return;
  gesture.lastDetection = now;
  gesture.lastVideoTime = ui.camera.currentTime;
  try {
    const result = gesture.landmarker.detectForVideo(ui.camera, now);
    if (result.landmarks?.length) {
      processHand(result.landmarks[0], now);
    } else if (now - gesture.lastHand > 450) {
      // Pierderea tracking-ului păstrează piesa în ultima poziție stabilă.
      gesture.drag = null;
      gesture.pinching = false;
      gesture.hoveredId = null;
      ui.handCursor.hidden = true;
      ui.gestureStatus.textContent = "Caut mâna în cadru. Poți folosi în continuare touch.";
    }
  } catch (error) {
    ui.gestureStatus.textContent = "Detecția mâinii s-a oprit. Touch rămâne disponibil.";
    stopGesture();
    showToast(error?.message || "Camera nu mai poate detecta mâna.");
  }
}

async function startGesture() {
  if (state.gesture) return;
  const token = ++state.cameraToken;
  ui.cameraToggle.disabled = true;
  ui.gestureStatus.textContent = "Pornesc camera și modelul pentru mână...";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "user" }, width: { ideal: 960 }, height: { ideal: 720 } },
    });
    if (token !== state.cameraToken) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    ui.camera.srcObject = stream;
    await ui.camera.play();
    const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm");
    const vision = await visionModule.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
    const options = {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.55,
      minTrackingConfidence: 0.5,
    };
    let landmarker;
    try {
      landmarker = await visionModule.HandLandmarker.createFromOptions(vision, options);
    } catch {
      delete options.baseOptions.delegate;
      landmarker = await visionModule.HandLandmarker.createFromOptions(vision, options);
    }
    if (token !== state.cameraToken) {
      landmarker.close();
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    state.gesture = {
      stream, landmarker, lastDetection: 0, lastVideoTime: -1,
      lastHand: 0, hoveredId: null, hoverStarted: 0, pinching: false, drag: null,
    };
    ui.stage.classList.add("has-camera");
    ui.cameraToggle.setAttribute("aria-pressed", "true");
    ui.cameraToggle.setAttribute("aria-label", "Oprește controlul cu mâna");
    ui.cameraToggle.querySelector("span").textContent = "OPREȘTE CAMERA";
    ui.gestureStatus.textContent = "Arată spre piesă pentru selecție; unește degetele pentru a o trage.";
    setMode("manual");
  } catch (error) {
    ui.camera.srcObject?.getTracks().forEach((track) => track.stop());
    ui.camera.srcObject = null;
    ui.gestureStatus.textContent = "Camera nu a pornit. Touch / mouse rămâne disponibil.";
    showToast(error?.name === "NotAllowedError" ? "Accesul la cameră a fost refuzat." : "Camera sau detecția mâinii nu este disponibilă.");
  } finally {
    ui.cameraToggle.disabled = false;
  }
}

function stopGesture() {
  state.cameraToken += 1;
  state.gesture?.landmarker.close();
  state.gesture?.stream.getTracks().forEach((track) => track.stop());
  ui.camera.srcObject?.getTracks().forEach((track) => track.stop());
  ui.camera.srcObject = null;
  state.gesture = null;
  ui.stage.classList.remove("has-camera");
  ui.handCursor.hidden = true;
  ui.handCursor.classList.remove("is-pinching");
  ui.cameraToggle.setAttribute("aria-pressed", "false");
  ui.cameraToggle.setAttribute("aria-label", "Pornește controlul cu mâna");
  ui.cameraToggle.querySelector("span").textContent = "CONTROL CU MÂNA";
  ui.gestureStatus.textContent = "Touch / mouse activ. Poți porni camera pentru indicare și pinch.";
}

function resize() {
  const width = Math.max(1, ui.viewport.clientWidth);
  const height = Math.max(1, ui.viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - (state.lastFrame || now)) / 1000);
  state.lastFrame = now;
  if (state.ready) {
    if (state.mode === "clip" && state.playing && mixer) {
      state.clipTime = (state.clipTime + dt) % state.duration;
      mixer.setTime(state.clipTime);
      updateTimeline();
    }
    for (const [id, tween] of state.tweens) {
      if (now < tween.start) continue;
      const t = Math.min(1, (now - tween.start) / tween.duration);
      setProgress(parts.get(id), THREE.MathUtils.lerp(tween.from, tween.to, ease(t)));
      if (t >= 1) state.tweens.delete(id);
    }
    updateGesture(now);
    selectionHelper?.update();
    updatePartMarker();
  }
  controls.update();
  renderer.render(scene, camera);
}

ui.manualMode.addEventListener("click", () => setMode("manual"));
ui.clipMode.addEventListener("click", () => setMode("clip"));
$("#explode-all").addEventListener("click", () => animateAll(1));
$("#assemble-all").addEventListener("click", () => animateAll(0));
ui.action.addEventListener("click", () => {
  const part = parts.get(state.selectedId);
  if (part) animatePart(part, part.progress > 0.5 ? 0 : 1);
});
ui.slider.addEventListener("input", () => {
  const part = parts.get(state.selectedId);
  if (!part) return;
  state.tweens.delete(part.id);
  setProgress(part, Number(ui.slider.value) / 100);
});
ui.play.addEventListener("click", () => {
  if (!state.ready) return;
  setMode("clip");
  state.playing = !state.playing;
  ui.play.textContent = state.playing ? "Ⅱ" : "▶";
  ui.play.setAttribute("aria-label", state.playing ? "Pauză animație" : "Pornește animația");
  setStatus(state.playing ? "ANIMAȚIA ORIGINALĂ / REDARE" : "ANIMAȚIA ORIGINALĂ / PAUZĂ");
});
ui.timeSlider.addEventListener("input", () => {
  if (!state.ready) return;
  setMode("clip");
  state.clipTime = Number(ui.timeSlider.value) / 1000 * state.duration;
  mixer?.setTime(state.clipTime);
  updateTimeline();
});
ui.cameraToggle.addEventListener("click", () => state.gesture ? stopGesture() : startGesture());
$("#retry-load").addEventListener("click", loadEngine);
window.addEventListener("resize", resize);
window.addEventListener("pagehide", stopGesture);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    state.playing = false;
    ui.play.textContent = "▶";
  }
});

renderPartRows();
resize();
loadEngine();
requestAnimationFrame(animate);
