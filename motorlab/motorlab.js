import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createRunningClip } from "./engine-motion.js?v=2";
import { createHandControl } from "./hand-control.js?v=2";

const $ = (selector) => document.querySelector(selector);
const ui = {
  viewport: $("#viewport"), stage: $(".stage"), loading: $("#loading"),
  loadingDetail: $("#loading-detail"), error: $("#error-panel"),
  status: $("#stage-status"), count: $("#parts-count"), label: $("#part-label"),
  card: $("#selected-card"), partName: $("#part-name"), partState: $("#part-state"),
  mount: $("#mount-part"), assemble: $("#assemble-all"),
  power: $("#engine-toggle"), powerLabel: $("#engine-button-label"),
  throttle: $("#throttle"), rpm: $("#rpm-value"),
  interior: $("#interior-toggle"), orbit: $("#orbit-toggle"),
  gestureStatus: $("#gesture-status"), toast: $("#toast"),
};
const state = {
  ready: false, interior: true, orbit: false, running: false,
  rpm: 0, targetRpm: 800, motionTime: 0, lastFrame: 0, lastUi: 0,
  selected: null, hovered: null, grab: null, pointerAction: null,
  pointers: new Map(), pinchDistance: null, tweens: new Map(),
  toastTimer: null, loading: false,
};
const scene = new THREE.Scene();
// Detached parts render on a separate workbench layer. They stay visible when
// placed over the engine, with depth sorting between the detached parts.
const bench = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 150);
const viewTarget = new THREE.Vector3();
camera.position.set(6, 3.6, 8);
camera.lookAt(viewTarget);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderer.setClearColor(0x000000, 0);
renderer.autoClear = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;
ui.viewport.append(renderer.domElement);

const environmentRoom = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(environmentRoom, 0.04);
scene.environment = bench.environment = environment.texture;
environmentRoom.dispose();
pmrem.dispose();
for (const destination of [scene, bench]) {
  destination.add(new THREE.HemisphereLight(0xd3f0e9, 0x29424b, 2.25));
  const warm = new THREE.DirectionalLight(0xffe0bf, 3);
  warm.position.set(3, 6, 7);
  destination.add(warm);
  const cool = new THREE.DirectionalLight(0x96ecf2, 2);
  cool.position.set(-5, 2, -4);
  destination.add(cool);
}
const root = new THREE.Group();
scene.add(root);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const parts = [];
const partForMesh = new Map();
const selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffc595);
selectionBox.material.depthTest = false;
selectionBox.material.transparent = true;
selectionBox.material.opacity = 0.72;
selectionBox.renderOrder = 100;
selectionBox.visible = false;
bench.add(selectionBox);
let engine = null;
let mixer = null;
let runningClip = null;
let loadToken = 0;

const pistonNames = new Set(["Cylinder_028", "Cylinder_013", "Cylinder_003", "Cylinder_007", "Cylinder_010", "Cylinder_018", "Cylinder_021", "Cylinder_024"]);
const rodNames = new Set(["Cylinder_001", "Cylinder_014", "Cylinder_008", "Cylinder_011", "Cylinder_005", "Cylinder_015", "Cylinder_019", "Cylinder_022"]);
function family(name) {
  if (pistonNames.has(name)) return { label: "Piston", kind: "piston", color: 0xe8b17c };
  if (rodNames.has(name)) return { label: "Bielă", kind: "rod", color: 0xd9e1e0 };
  if (name === "Cylinder_004") return { label: "Arbore cotit", kind: "crank", color: 0x68bfc2 };
  if (name.startsWith("Gear")) return { label: "Roată dințată", kind: "gear", color: 0xd7bd86 };
  if (name.startsWith("NurbsPath")) return { label: "Cablu", kind: "cable", color: 0x526b71 };
  if (["Plane_008", "Plane_012", "Plane_013", "Plane_006"].includes(name)) return { label: "Capac", kind: "cover", color: 0x92a7ad };
  if (name === "Cube_026" || name === "Plane_011") return { label: "Carcasă", kind: "cover", color: 0x83979c };
  return { label: "Componentă", kind: "component", color: 0xa9bec0 };
}

function toast(message) {
  clearTimeout(state.toastTimer);
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  state.toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 3900);
}
function boundsOf(collection) {
  const box = new THREE.Box3();
  for (const part of collection) {
    part.mesh.updateWorldMatrix(true, false);
    part.mesh.geometry.computeBoundingBox();
    box.union(part.mesh.geometry.boundingBox.clone().applyMatrix4(part.mesh.matrixWorld));
  }
  return box;
}
function isGhost(part) {
  return state.interior && !part.mechanical && !part.detached;
}
function stylePart(part) {
  const ghost = isGhost(part);
  const highlighted = part === state.selected || part === state.hovered;
  const material = part.mesh.material;
  material.transparent = ghost;
  material.opacity = ghost ? 0.055 : 1;
  material.depthWrite = !ghost;
  material.emissive.setHex(highlighted && !ghost ? 0xe89256 : 0x000000);
  material.emissiveIntensity = highlighted ? 0.28 : 0;
  part.mesh.renderOrder = ghost ? 0 : 1;
  material.needsUpdate = material.userData.ghost !== ghost;
  material.userData.ghost = ghost;
}
function refreshUi() {
  const detached = parts.filter((part) => part.detached);
  ui.count.textContent = detached.length === 1 ? "1 piesă așezată" : detached.length ? `${detached.length} piese așezate` : `${parts.length} elemente detașabile`;
  ui.assemble.disabled = !detached.length || !state.ready;
  ui.power.disabled = !state.ready || !runningClip;
  ui.power.setAttribute("aria-pressed", String(state.running));
  ui.powerLabel.textContent = state.running ? "Oprește motorul" : "Pornește motorul";
  ui.status.textContent = state.grab ? "PIESĂ ÎN MÂNĂ" : `${state.running ? "MOTOR PORNIT" : "MOTOR OPRIT"} · ${state.interior ? "INTERIOR" : "EXTERIOR"}`;
  ui.card.hidden = !state.selected;
  if (state.selected) {
    ui.partName.textContent = state.selected.label;
    ui.partState.textContent = state.selected.detached ? "PE BANC · POȚI MUTA DIN NOU" : "PRINDE ȘI TRAGE";
    ui.mount.disabled = !state.selected.detached || state.tweens.has(state.selected.id);
  }
}
function selectPart(part) {
  const previous = state.selected;
  state.selected = part;
  if (previous) stylePart(previous);
  if (part) stylePart(part);
  refreshUi();
}
function hoverPart(part) {
  if (state.hovered === part) return;
  const previous = state.hovered;
  state.hovered = part;
  if (previous) stylePart(previous);
  if (part) stylePart(part);
}

function stopMotor(immediate = false) {
  state.running = false;
  if (immediate) state.rpm = 0;
  refreshUi();
}
function toggleMotor() {
  if (!state.ready) return;
  if (state.running) { stopMotor(); return; }
  if (state.tweens.size || state.grab) { toast("Așază sau montează piesa înainte să pornești motorul."); return; }
  if (parts.some((part) => part.detached && part.mechanical)) {
    toast("Montează piesele mecanismului înainte de pornire. Capacele pot rămâne pe banc.");
    return;
  }
  state.running = true;
  refreshUi();
}

function setRay(x, y) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(ndc, camera);
}
function pick(x, y, radius = 0) {
  if (!state.ready) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const offsets = [[0, 0]];
  if (radius) offsets.push([radius, 0], [-radius, 0], [0, radius], [0, -radius]);
  const detached = parts.filter((part) => part.detached && !state.tweens.has(part.id));
  const mounted = parts.filter((part) => !part.detached && !isGhost(part));
  // Picking follows the workbench's draw order, including the enlarged touch target.
  for (const group of [detached, mounted]) {
    const meshes = group.map((part) => part.mesh);
    for (const [dx, dy] of offsets) {
      setRay(x + dx, y + dy);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (hit) return { part: partForMesh.get(hit.object), point: hit.point.clone() };
    }
  }
  return null;
}

function detach(part) {
  if (part.detached) return;
  part.mesh.updateWorldMatrix(true, false);
  const exactWorldMatrix = part.mesh.matrixWorld.clone();
  // Keep the entire matrix: the GLB has negative and nonuniform parent scales.
  // Decomposing through Object3D.attach would distort some of the rods/covers.
  bench.add(part.mesh);
  part.mesh.matrixAutoUpdate = false;
  part.mesh.matrix.copy(exactWorldMatrix);
  part.mesh.matrixWorldNeedsUpdate = true;
  part.detached = true;
  stylePart(part);
}
function beginGrab(x, y, radius = 10, hand = false) {
  if (state.grab || state.pointers.size > 1) return false;
  const hit = pick(x, y, radius);
  if (!hit) return false;
  stopMotor(true);
  selectPart(hit.part);
  hoverPart(null);
  state.tweens.delete(hit.part.id);
  setRay(x, y);
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), hit.point);
  const anchor = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (!anchor) return false;
  hit.part.mesh.updateWorldMatrix(true, false);
  state.grab = {
    part: hit.part, plane, anchor, start: hit.part.mesh.getWorldPosition(new THREE.Vector3()),
    x, y, hand, moved: false,
  };
  refreshUi();
  return true;
}
function moveGrab(x, y) {
  const grab = state.grab;
  if (!grab) return;
  if (!grab.moved && Math.hypot(x - grab.x, y - grab.y) < (grab.hand ? 7 : 4)) return;
  setRay(x, y);
  const intersection = raycaster.ray.intersectPlane(grab.plane, new THREE.Vector3());
  if (!intersection) return;
  if (!grab.moved) {
    detach(grab.part);
    grab.moved = true;
    refreshUi();
  }
  const position = intersection.sub(grab.anchor).add(grab.start);
  grab.part.mesh.matrix.setPosition(position);
  grab.part.mesh.matrixWorldNeedsUpdate = true;
}
function endGrab() {
  if (!state.grab) return;
  // No snapping or return tween on release: the matrix stays where it was dropped.
  state.grab = null;
  refreshUi();
}
function mountPart(part, delay = 0) {
  if (!part?.detached) return;
  stopMotor(true);
  if (state.grab?.part === part) endGrab();
  part.mesh.updateWorldMatrix(true, false);
  state.tweens.set(part.id, {
    from: part.mesh.getWorldPosition(new THREE.Vector3()),
    start: performance.now() + delay, duration: 460,
  });
  refreshUi();
}
function finishMount(part) {
  part.parent.add(part.mesh);
  part.mesh.position.copy(part.homePosition);
  part.mesh.quaternion.copy(part.homeQuaternion);
  part.mesh.scale.copy(part.homeScale);
  part.mesh.matrixAutoUpdate = part.homeAutoUpdate;
  part.mesh.matrix.copy(part.homeMatrix);
  part.mesh.matrixWorldNeedsUpdate = true;
  part.detached = false;
  stylePart(part);
}
function updateMounts(now) {
  for (const [id, tween] of state.tweens) {
    if (now < tween.start) continue;
    const part = parts[id];
    const t = Math.min(1, (now - tween.start) / tween.duration);
    const eased = t * t * (3 - 2 * t);
    part.parent.updateWorldMatrix(true, false);
    const target = new THREE.Vector3().setFromMatrixPosition(
      new THREE.Matrix4().multiplyMatrices(part.parent.matrixWorld, part.homeMatrix),
    );
    part.mesh.matrix.setPosition(tween.from.clone().lerp(target, eased));
    part.mesh.matrixWorldNeedsUpdate = true;
    if (t >= 1) {
      finishMount(part);
      state.tweens.delete(id);
      refreshUi();
    }
  }
}

function rotateView(dx, dy) {
  const orbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(viewTarget));
  orbit.theta -= dx * 0.006;
  orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.006, 0.15, Math.PI - 0.15);
  camera.position.copy(viewTarget).add(new THREE.Vector3().setFromSpherical(orbit));
  camera.lookAt(viewTarget);
}
function zoomView(factor) {
  const offset = camera.position.clone().sub(viewTarget);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 2.5, 45));
  camera.position.copy(viewTarget).add(offset);
}
function fitView(includeBench = false) {
  if (!parts.length) return;
  const visible = parts.filter((part) => includeBench || !part.detached);
  if (!visible.length) return;
  const box = boundsOf(visible);
  viewTarget.copy(box.getCenter(new THREE.Vector3()));
  const direction = new THREE.Vector3(0.63, 0.32, 1).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  let distance = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const corner = new THREE.Vector3(x, y, z).sub(viewTarget);
    distance = Math.max(distance,
      Math.abs(corner.dot(right)) / tanH + corner.dot(direction),
      Math.abs(corner.dot(up)) / tanV + corner.dot(direction));
  }
  camera.position.copy(viewTarget).addScaledVector(direction, Math.max(4, distance * 1.32));
  camera.lookAt(viewTarget);
}

function pointerPairDistance() {
  const pair = [...state.pointers.values()];
  return pair.length < 2 ? null : Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
}
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!state.ready) return;
  event.preventDefault();
  hands.release();
  renderer.domElement.setPointerCapture(event.pointerId);
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.pointers.size > 1) {
    endGrab();
    state.pointerAction = null;
    state.pinchDistance = pointerPairDistance();
    return;
  }
  const grabbing = event.button === 0 && !state.orbit && beginGrab(event.clientX, event.clientY, event.pointerType === "touch" ? 13 : 3);
  state.pointerAction = { id: event.pointerId, kind: grabbing ? "grab" : "orbit", x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (!state.pointers.has(event.pointerId)) {
    if (event.pointerType === "mouse" && !state.orbit && !state.grab) hoverPart(pick(event.clientX, event.clientY)?.part || null);
    return;
  }
  event.preventDefault();
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.pointers.size > 1) {
    const distance = pointerPairDistance();
    if (state.pinchDistance > 0 && distance > 0) zoomView(state.pinchDistance / distance);
    state.pinchDistance = distance;
    return;
  }
  const action = state.pointerAction;
  if (!action || action.id !== event.pointerId) return;
  if (action.kind === "grab") moveGrab(event.clientX, event.clientY);
  else rotateView(event.clientX - action.x, event.clientY - action.y);
  action.x = event.clientX;
  action.y = event.clientY;
});
function releasePointer(event) {
  state.pointers.delete(event.pointerId);
  if (state.pointerAction?.id === event.pointerId) { endGrab(); state.pointerAction = null; }
  if (!state.pointers.size) state.pinchDistance = null;
}
renderer.domElement.addEventListener("pointerup", releasePointer);
renderer.domElement.addEventListener("pointercancel", releasePointer);
renderer.domElement.addEventListener("lostpointercapture", releasePointer);
renderer.domElement.addEventListener("pointerleave", () => { if (!state.grab) hoverPart(null); });
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
renderer.domElement.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (!state.grab) zoomView(Math.exp(event.deltaY * 0.001));
}, { passive: false });

function disposeModel() {
  endGrab();
  mixer?.stopAllAction();
  state.selected = state.hovered = null;
  selectionBox.visible = false;
  ui.label.hidden = true;
  state.tweens.clear();
  for (const part of parts) {
    if (part.detached) part.mesh.removeFromParent();
    part.mesh.geometry.dispose();
    part.mesh.material.dispose();
  }
  parts.length = 0;
  partForMesh.clear();
  engine?.removeFromParent();
  engine = mixer = runningClip = null;
  root.scale.setScalar(1);
}
function loadModel() {
  const token = ++loadToken;
  state.loading = true;
  state.ready = false;
  state.running = false;
  state.rpm = 0;
  ui.loading.hidden = false;
  ui.error.hidden = true;
  disposeModel();
  refreshUi();
  new GLTFLoader().load("./assets/engine.glb", (gltf) => {
    if (token !== loadToken) return;
    try {
      engine = gltf.scene;
      root.add(engine);
      if (gltf.animations[0]) {
        runningClip = createRunningClip(gltf.animations[0]);
        mixer = new THREE.AnimationMixer(engine);
        mixer.clipAction(runningClip).play();
        mixer.setTime(0);
      }
      engine.updateWorldMatrix(true, true);
      const originalMaterials = new Set();
      const counts = new Map();
      engine.traverse((mesh) => {
        if (!mesh.isMesh) return;
        const source = mesh.material;
        originalMaterials.add(source);
        // Nine nearly transparent meshes are visualization sleeves, not useful
        // physical pieces. They must not intercept touches or hide real parts.
        if (source.transparent && source.opacity < 0.3) { mesh.visible = false; return; }
        const definition = family(source.name || mesh.name);
        const number = (counts.get(definition.label) || 0) + 1;
        counts.set(definition.label, number);
        const label = definition.kind === "crank" ? definition.label : `${definition.label} ${String(number).padStart(2, "0")}`;
        mesh.material = new THREE.MeshStandardMaterial({
          color: definition.color, metalness: definition.kind === "cable" ? 0.05 : 0.52,
          roughness: definition.kind === "cable" ? 0.78 : 0.32, side: THREE.DoubleSide,
        });
        mesh.updateMatrix();
        const part = {
          id: parts.length, mesh, label, kind: definition.kind, detached: false,
          mechanical: ["piston", "rod", "crank", "gear"].includes(definition.kind),
          parent: mesh.parent, homeMatrix: mesh.matrix.clone(),
          homePosition: mesh.position.clone(), homeQuaternion: mesh.quaternion.clone(),
          homeScale: mesh.scale.clone(), homeAutoUpdate: mesh.matrixAutoUpdate,
        };
        parts.push(part);
        partForMesh.set(mesh, part);
      });
      const box = boundsOf(parts);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      engine.position.sub(center);
      root.scale.setScalar(4.8 / Math.max(size.x, size.y, size.z));
      root.updateWorldMatrix(true, true);
      const initialMatrices = parts.map((part) => part.mesh.matrixWorld.clone());
      mixer?.setTime(0.19);
      root.updateWorldMatrix(true, true);
      parts.forEach((part, index) => {
        const a = initialMatrices[index].elements;
        const b = part.mesh.matrixWorld.elements;
        const difference = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
        part.mechanical ||= difference > 0.005;
      });
      mixer?.setTime(0);
      state.motionTime = 0;
      root.updateWorldMatrix(true, true);
      // Clean metal materials make the mechanism legible and release baked maps.
      const oldTextures = new Set();
      originalMaterials.forEach((material) => {
        for (const value of Object.values(material)) if (value?.isTexture) oldTextures.add(value);
        material.dispose();
      });
      oldTextures.forEach((texture) => texture.dispose());
      parts.forEach(stylePart);
      state.ready = true;
      state.loading = false;
      ui.loading.hidden = true;
      fitView();
      refreshUi();
    } catch (error) { loadError(error); }
  }, (event) => {
    if (event.total && token === loadToken) ui.loadingDetail.textContent = `Încarc motorul · ${Math.round(event.loaded / event.total * 100)}%`;
  }, (error) => { if (token === loadToken) loadError(error); });
}
function loadError(error) {
  state.loading = false;
  state.ready = false;
  ui.loading.hidden = true;
  ui.error.hidden = false;
  $("#error-detail").textContent = error.message || "Verifică conexiunea și încearcă din nou.";
  refreshUi();
}

const hands = createHandControl({
  video: $("#camera-feed"), stage: ui.stage, toggle: $("#camera-toggle"),
  switchButton: $("#camera-switch"), facingLabel: $("#camera-facing"),
  cursor: $("#hand-cursor"), status: ui.gestureStatus, toast,
  onHover: (point) => {
    if (!state.pointers.size) hoverPart(point && !state.orbit ? pick(point.x, point.y, 15)?.part || null : null);
  },
  onGrab: (x, y) => !state.pointers.size && !state.orbit && beginGrab(x, y, 20, true),
  onMove: (x, y) => { if (state.grab?.hand) moveGrab(x, y); },
  onRelease: () => { if (state.grab?.hand) endGrab(); },
});

function updateSelection() {
  const part = state.grab?.part || state.hovered || state.selected;
  if (!part || isGhost(part)) {
    selectionBox.visible = false;
    ui.label.hidden = true;
    return;
  }
  part.mesh.updateWorldMatrix(true, false);
  selectionBox.setFromObject(part.mesh);
  selectionBox.visible = true;
  const center = part.mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(part.mesh.matrixWorld).project(camera);
  const width = ui.viewport.clientWidth, height = ui.viewport.clientHeight;
  const x = (center.x + 1) / 2 * width;
  const y = (1 - center.y) / 2 * height;
  ui.label.hidden = center.z < -1 || center.z > 1 || x < 0 || x > width || y < 0 || y > height;
  ui.label.textContent = part.label;
  ui.label.style.left = `${Math.max(8, Math.min(width - 150, x + 18))}px`;
  ui.label.style.top = `${Math.max(112, Math.min(height - 125, y - 24))}px`;
}
let previousWidth = 0;
function resize() {
  const width = Math.max(1, ui.viewport.clientWidth), height = Math.max(1, ui.viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (state.ready && previousWidth && Math.abs(width - previousWidth) > 80 && !state.grab) fitView(true);
  previousWidth = width;
}
new ResizeObserver(resize).observe(ui.viewport);

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { state.lastFrame = now; return; }
  const dt = Math.min(0.05, (now - (state.lastFrame || now)) / 1000);
  state.lastFrame = now;
  if (state.ready) {
    const requested = state.running ? state.targetRpm : 0;
    state.rpm += (requested - state.rpm) * (1 - Math.exp(-dt * 5));
    if (!state.running && state.rpm < 3) state.rpm = 0;
    if (state.rpm > 0 && mixer) {
      // Slowed down for inspection, proportional to the throttle setting.
      state.motionTime = (state.motionTime + dt * state.rpm / 1600) % runningClip.duration;
      mixer.setTime(state.motionTime);
    }
    root.updateWorldMatrix(true, true);
    updateMounts(now);
    hands.update(now);
    updateSelection();
    if (now - state.lastUi > 100) {
      ui.rpm.textContent = String(Math.round(state.rpm / 10) * 10);
      state.lastUi = now;
    }
  }
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(bench, camera);
}

ui.power.addEventListener("click", toggleMotor);
ui.throttle.addEventListener("input", () => { state.targetRpm = Number(ui.throttle.value); });
ui.interior.addEventListener("click", () => {
  endGrab();
  state.interior = !state.interior;
  ui.interior.setAttribute("aria-pressed", String(state.interior));
  hoverPart(null);
  parts.forEach(stylePart);
  refreshUi();
});
ui.orbit.addEventListener("click", () => {
  endGrab();
  state.orbit = !state.orbit;
  ui.orbit.setAttribute("aria-pressed", String(state.orbit));
  $("#instruction").textContent = state.orbit ? "Trage motorul pentru a-l roti. Două degete pentru zoom." : "Prinde direct o piesă și las-o unde vrei.";
  hoverPart(null);
});
ui.mount.addEventListener("click", () => mountPart(state.selected));
ui.assemble.addEventListener("click", () => {
  endGrab();
  parts.filter((part) => part.detached).forEach((part, index) => mountPart(part, Math.min(index * 65, 600)));
});
$("#clear-selection").addEventListener("click", () => selectPart(null));
$("#fit-view").addEventListener("click", () => { endGrab(); fitView(true); });
$("#retry-load").addEventListener("click", loadModel);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { endGrab(); hands.release(); state.pointers.clear(); state.pointerAction = null; state.pinchDistance = null; stopMotor(true); }
});
resize();
loadModel();
requestAnimationFrame(frame);
