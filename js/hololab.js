import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const $ = (selector) => document.querySelector(selector);
const lab = $("#lab");
const launch = $("#launch");
const loading = $("#loading");
const loadingDetail = $("#loading-detail");
const interfaceLayer = $("#interface");
const video = $("#camera");
const handCanvas = $("#hands");
const handContext = handCanvas.getContext("2d");
const trackingStatus = $("#tracking-status");
const gestureCode = $("#gesture-code");
const gestureTitle = $("#gesture-title");
const modeNote = $("#mode-note");
const toast = $("#toast");

const MODEL_INFO = {
  atom: { index: "SPECIMEN 01", name: "ATOM // CARBON", detail: "6 protoni · 6 neutroni · 6 electroni" },
  dna: { index: "SPECIMEN 02", name: "ADN // HELIX", detail: "24 perechi de baze · structură dublu helix" },
  orbital: { index: "SPECIMEN 03", name: "ORBITAL // KEPLER", detail: "nucleu energetic · 4 corpuri orbitale" },
};

const state = {
  active: false,
  demo: false,
  stream: null,
  landmarker: null,
  hands: [],
  gesture: "auto",
  explode: 0,
  explodeTarget: 0,
  scale: 1,
  scaleTarget: 1,
  rotX: 0.12,
  rotY: 0,
  rotXTarget: 0.12,
  rotYTarget: 0,
  modelKey: "atom",
  reveal: 0,
  lastVideoTime: -1,
  lastDetection: 0,
  pointer: null,
  attractorA: new THREE.Vector3(-1.35, 0.2, 0),
  attractorB: new THREE.Vector3(1.35, -0.2, 0),
  attractorATarget: new THREE.Vector3(-1.35, 0.2, 0),
  attractorBTarget: new THREE.Vector3(1.35, -0.2, 0),
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050708, 0.055);
const renderCamera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
renderCamera.position.set(0, 0, 8.4);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
$("#scene").append(renderer.domElement);

const labRoot = new THREE.Group();
scene.add(labRoot);
scene.add(new THREE.HemisphereLight(0xb9fff0, 0x32140f, 2.3));
const keyLight = new THREE.PointLight(0x5ff1d2, 22, 18);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);
const warmLight = new THREE.PointLight(0xff765f, 14, 15);
warmLight.position.set(-4, -2, 3);
scene.add(warmLight);

const materials = {
  cyan: new THREE.MeshStandardMaterial({ color: 0x5ff1d2, emissive: 0x0c6758, emissiveIntensity: 1.5, roughness: 0.28, metalness: 0.35 }),
  coral: new THREE.MeshStandardMaterial({ color: 0xff765f, emissive: 0x6b170e, emissiveIntensity: 1.25, roughness: 0.34, metalness: 0.2 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xf3c969, emissive: 0x60470c, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.28 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xeef5f3, emissive: 0x314a46, emissiveIntensity: 0.6, roughness: 0.38, metalness: 0.15 }),
};

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(145,255,229,1)");
  gradient.addColorStop(0.17, "rgba(95,241,210,.72)");
  gradient.addColorStop(1, "rgba(95,241,210,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x5ff1d2, transparent: true, opacity: 0.27, blending: THREE.AdditiveBlending, depthWrite: false }));
aura.scale.set(5.4, 5.4, 1);
labRoot.add(aura);

const particleGeometry = new THREE.BufferGeometry();
const particleCount = innerWidth < 700 ? 7000 : 14000;
const particlePositions = new Float32Array(particleCount * 3);
const particleSeeds = new Float32Array(particleCount);
for (let index = 0; index < particleCount; index += 1) {
  const radius = 1.1 + Math.random() * 3.8;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  particlePositions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
  particlePositions[index * 3 + 1] = Math.cos(phi) * radius;
  particlePositions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  particleSeeds[index] = Math.random();
}
particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(particleSeeds, 1));
const particleMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uAttractorA: { value: state.attractorA },
    uAttractorB: { value: state.attractorB },
    uActive: { value: 0.36 },
    uExplode: { value: 0 },
    uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uActive;
    uniform float uExplode;
    uniform float uPixelRatio;
    uniform vec3 uAttractorA;
    uniform vec3 uAttractorB;
    attribute float aSeed;
    varying float vEnergy;

    void main() {
      float selector = step(0.5, fract(aSeed * 17.31));
      vec3 attractor = mix(uAttractorA, uAttractorB, selector);
      float phase = aSeed * 83.7;
      float speed = 0.34 + fract(aSeed * 29.1) * 1.18;
      float angle = uTime * speed + phase;
      float radius = 0.12 + pow(fract(aSeed * 43.7), 1.7) * 1.65;
      vec3 orbit = vec3(
        cos(angle) * radius,
        sin(angle * 1.37 + phase) * radius * 0.58,
        sin(angle) * radius
      );
      float bridgePhase = fract(aSeed * 7.13 + uTime * (0.025 + aSeed * 0.045));
      vec3 bridge = mix(uAttractorA, uAttractorB, bridgePhase);
      bridge += vec3(0.0, sin(bridgePhase * 6.283 + phase) * 0.22, cos(angle) * 0.16);
      float bridgeMix = smoothstep(0.62, 0.98, fract(aSeed * 19.7));
      vec3 attracted = mix(attractor + orbit, bridge, bridgeMix);
      vec3 transformed = mix(position, attracted, uActive);
      transformed += normalize(position + vec3(0.001)) * uExplode * (0.75 + aSeed * 2.4);
      transformed.y += sin(uTime * 0.4 + phase) * 0.035;

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = (2.1 + fract(aSeed * 51.0) * 2.8 + uExplode * 1.4) * uPixelRatio * (5.0 / max(2.0, -mvPosition.z));
      vEnergy = clamp(speed * 0.55 + bridgeMix * 0.35 + uExplode * 0.35, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    varying float vEnergy;
    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float distanceToCenter = length(center);
      if (distanceToCenter > 0.5) discard;
      float alpha = smoothstep(0.5, 0.04, distanceToCenter) * 0.72;
      vec3 cyan = vec3(0.373, 0.945, 0.824);
      vec3 coral = vec3(1.0, 0.463, 0.373);
      gl_FragColor = vec4(mix(cyan, coral, vEnergy), alpha);
    }
  `,
});
const particles = new THREE.Points(particleGeometry, particleMaterial);
labRoot.add(particles);

function sphere(radius, material, detail = 1) {
  return new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), material);
}

function connector(start, end, radius, material) {
  const delta = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return mesh;
}

function orbitLine(radiusX, radiusY, rotation) {
  const points = [];
  for (let step = 0; step < 96; step += 1) {
    const angle = (step / 96) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY, 0));
  }
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x78ffe2, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending }),
  );
  line.rotation.copy(rotation);
  return line;
}

function createAtom() {
  const group = new THREE.Group();
  const nucleons = [];
  const electrons = [];
  const nucleusVectors = [
    [-.3,.18,.08],[.28,.18,-.04],[-.04,-.28,.16],[.05,.03,.31],[-.16,.02,-.3],[.32,-.2,.12],
    [-.29,-.18,-.1],[.14,.3,.18],[.18,-.04,-.29],[-.06,.32,-.18],[-.36,.04,.22],[.02,-.36,-.2],
  ];
  nucleusVectors.forEach((values, index) => {
    const mesh = sphere(0.25, index % 2 ? materials.coral : materials.ivory, 2);
    mesh.position.fromArray(values);
    mesh.userData.base = mesh.position.clone();
    mesh.userData.burst = mesh.position.clone().normalize().multiplyScalar(0.85 + Math.random() * 0.45);
    nucleons.push(mesh);
    group.add(mesh);
  });
  const rotations = [new THREE.Euler(0.2,0.1,0.15), new THREE.Euler(1.05,.2,.7), new THREE.Euler(.4,1.15,-.45)];
  rotations.forEach((rotation) => group.add(orbitLine(2.1, 0.72, rotation)));
  for (let index = 0; index < 6; index += 1) {
    const mesh = sphere(0.11, materials.cyan, 2);
    electrons.push({ mesh, phase: index / 6 * Math.PI * 2, speed: .72 + (index % 3) * .13, rotation: rotations[index % 3] });
    group.add(mesh);
  }
  group.userData.update = (time, explode) => {
    nucleons.forEach((mesh) => mesh.position.copy(mesh.userData.base).addScaledVector(mesh.userData.burst, explode));
    electrons.forEach((electron) => {
      const angle = time * electron.speed + electron.phase;
      electron.mesh.position.set(Math.cos(angle) * (2.1 + explode * .75), Math.sin(angle) * (.72 + explode * .26), 0).applyEuler(electron.rotation);
    });
  };
  return group;
}

function createDNA() {
  const group = new THREE.Group();
  const steps = [];
  const count = 24;
  for (let index = 0; index < count; index += 1) {
    const y = (index - (count - 1) / 2) * 0.19;
    const angle = index * 0.47;
    const leftPosition = new THREE.Vector3(Math.cos(angle) * 1.06, y, Math.sin(angle) * 1.06);
    const rightPosition = new THREE.Vector3(-leftPosition.x, y, -leftPosition.z);
    const step = new THREE.Group();
    const left = sphere(0.115, index % 2 ? materials.cyan : materials.ivory, 1);
    const right = sphere(0.115, index % 3 ? materials.coral : materials.amber, 1);
    left.position.copy(leftPosition);
    right.position.copy(rightPosition);
    step.add(left, right, connector(leftPosition, rightPosition, 0.035, index % 2 ? materials.amber : materials.coral));
    if (index > 0) {
      const previous = steps[index - 1];
      step.add(connector(previous.leftBase, leftPosition, 0.028, materials.cyan));
      step.add(connector(previous.rightBase, rightPosition, 0.028, materials.coral));
    }
    steps.push({ group: step, left, right, leftBase: leftPosition, rightBase: rightPosition });
    group.add(step);
  }
  group.rotation.z = -0.1;
  group.userData.update = (time, explode) => {
    steps.forEach((step, index) => {
      const direction = index % 2 ? 1 : -1;
      step.group.position.x = direction * explode * (0.4 + Math.abs(index - 12) * 0.025);
      step.group.rotation.y = Math.sin(time * .7 + index * .2) * .018;
      step.left.position.x = step.leftBase.x - explode * .55;
      step.right.position.x = step.rightBase.x + explode * .55;
    });
  };
  return group;
}

function createOrbital() {
  const group = new THREE.Group();
  const core = sphere(0.72, materials.amber, 3);
  const coreWire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.94, 2), new THREE.MeshBasicMaterial({ color: 0xff765f, wireframe: true, transparent: true, opacity: .28 }));
  group.add(core, coreWire);
  const rings = [
    { radius: 1.45, speed: .72, tilt: new THREE.Euler(.9,.1,.2), color: materials.cyan },
    { radius: 2.05, speed: -.46, tilt: new THREE.Euler(.35,.65,-.2), color: materials.coral },
    { radius: 2.55, speed: .31, tilt: new THREE.Euler(1.22,.2,.62), color: materials.ivory },
    { radius: 3.0, speed: -.24, tilt: new THREE.Euler(.7,1.05,.2), color: materials.amber },
  ];
  rings.forEach((ring, index) => {
    const line = orbitLine(ring.radius, ring.radius, ring.tilt);
    const body = sphere(.12 + index * .035, ring.color, 2);
    ring.line = line;
    ring.body = body;
    group.add(line, body);
  });
  group.userData.update = (time, explode) => {
    core.scale.setScalar(1 + Math.sin(time * 2.4) * .035 + explode * .28);
    coreWire.rotation.x = time * .16;
    coreWire.rotation.y = time * .23;
    rings.forEach((ring, index) => {
      const radius = ring.radius + explode * (.55 + index * .23);
      const position = new THREE.Vector3(Math.cos(time * ring.speed + index) * radius, Math.sin(time * ring.speed + index) * radius, 0).applyEuler(ring.tilt);
      ring.body.position.copy(position);
      ring.line.scale.setScalar(1 + explode * (.28 + index * .05));
    });
  };
  return group;
}

const modelFactories = { atom: createAtom, dna: createDNA, orbital: createOrbital };
let activeModel = createAtom();
labRoot.add(activeModel);

function switchModel(key) {
  if (!modelFactories[key] || key === state.modelKey) return;
  labRoot.remove(activeModel);
  activeModel = modelFactories[key]();
  activeModel.scale.setScalar(0.01);
  labRoot.add(activeModel);
  state.modelKey = key;
  state.reveal = 0;
  state.explode = 0;
  state.explodeTarget = 0;
  document.querySelectorAll("[data-model]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.model === key)));
  const info = MODEL_INFO[key];
  $("#specimen-index").textContent = info.index;
  $("#specimen-name").textContent = info.name;
  $("#specimen-detail").textContent = info.detail;
  setGesture("materialize");
}

function setGesture(gesture) {
  if (gesture === state.gesture) return;
  state.gesture = gesture;
  const labels = {
    auto: ["AUTO", "Orbită autonomă", "Ridică o mână în cadru"],
    tracking: ["HAND", "Mână detectată", "Apropie degetul mare de arătător"],
    pinch: ["PINCH", "Control de rotație", "Mișcă mâna pentru a roti modelul"],
    open: ["OPEN", "Vedere descompusă", "Ține palma deschisă"],
    scale: ["DUAL", "Scalare bimanuală", "Apropie sau depărtează mâinile"],
    materialize: ["LOAD", "Materializare", "Specimen nou sincronizat"],
    demo: ["TOUCH", "Control tactil", "Trage pentru rotire · dublu tap pentru straturi"],
  };
  const [code, title, note] = labels[gesture] || labels.auto;
  gestureCode.textContent = code;
  gestureTitle.textContent = title;
  modeNote.textContent = note;
  document.querySelectorAll("[data-guide]").forEach((guide) => guide.classList.toggle("is-active", guide.dataset.guide === gesture));
}

function updateTrackingUi(handCount) {
  interfaceLayer.classList.toggle("is-tracking", handCount > 0);
  if (state.demo) {
    trackingStatus.dataset.state = "demo";
    trackingStatus.querySelector("span").textContent = "MOD DEMO";
  } else if (handCount > 0) {
    trackingStatus.dataset.state = "live";
    trackingStatus.querySelector("span").textContent = handCount > 1 ? "2 MÂINI ACTIVE" : "MÂNĂ ACTIVĂ";
  } else {
    trackingStatus.dataset.state = "searching";
    trackingStatus.querySelector("span").textContent = "CAUT MÂINILE";
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function palmCenter(hand) {
  const indices = [0, 5, 9, 13, 17];
  return indices.reduce((center, index) => ({ x: center.x + hand[index].x / indices.length, y: center.y + hand[index].y / indices.length }), { x: 0, y: 0 });
}

function handToWorld(center) {
  return new THREE.Vector3(((1 - center.x) - .5) * 5.2, -(center.y - .5) * 5.8, 0);
}

function readGestures(hands) {
  state.explodeTarget = 0;
  if (!hands.length) {
    state.attractorATarget.set(-1.35, .2, 0);
    state.attractorBTarget.set(1.35, -.2, 0);
    setGesture("auto");
    return;
  }
  if (hands.length > 1) {
    const first = palmCenter(hands[0]);
    const second = palmCenter(hands[1]);
    state.attractorATarget.copy(handToWorld(first));
    state.attractorBTarget.copy(handToWorld(second));
    state.scaleTarget = THREE.MathUtils.clamp(distance(first, second) * 2.9, .68, 1.62);
    state.rotYTarget = ((1 - (first.x + second.x) / 2) - .5) * 1.8;
    setGesture("scale");
    return;
  }
  const hand = hands[0];
  const center = palmCenter(hand);
  state.attractorATarget.copy(handToWorld(center));
  state.attractorBTarget.set(0, 0, 0);
  const palmSize = Math.max(distance(hand[0], hand[9]), .04);
  const pinching = distance(hand[4], hand[8]) / palmSize < .42;
  const extended = [8, 12, 16, 20].filter((tip, index) => hand[tip].y < hand[[6, 10, 14, 18][index]].y - .018).length;
  if (pinching) {
    state.rotYTarget = ((1 - center.x) - .5) * 3.4;
    state.rotXTarget = (center.y - .5) * 2.4;
    setGesture("pinch");
  } else if (extended >= 3) {
    state.explodeTarget = 1;
    state.rotYTarget = ((1 - center.x) - .5) * 1.3;
    setGesture("open");
  } else {
    setGesture("tracking");
  }
}

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

function mapLandmark(point) {
  const width = handCanvas.width / devicePixelRatio;
  const height = handCanvas.height / devicePixelRatio;
  if (!video.videoWidth) return { x: (1 - point.x) * width, y: point.y * height };
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  return { x: ((1 - point.x) * renderedWidth) + (width - renderedWidth) / 2, y: point.y * renderedHeight + (height - renderedHeight) / 2 };
}

function drawHands(hands) {
  const width = handCanvas.width / devicePixelRatio;
  const height = handCanvas.height / devicePixelRatio;
  handContext.clearRect(0, 0, width, height);
  hands.forEach((hand, handIndex) => {
    const points = hand.map(mapLandmark);
    handContext.strokeStyle = handIndex ? "rgba(255,118,95,.68)" : "rgba(95,241,210,.72)";
    handContext.fillStyle = handIndex ? "#ff765f" : "#5ff1d2";
    handContext.lineWidth = 1.2;
    handContext.shadowColor = handIndex ? "#ff765f" : "#5ff1d2";
    handContext.shadowBlur = 8;
    HAND_CONNECTIONS.forEach(([from, to]) => {
      handContext.beginPath(); handContext.moveTo(points[from].x, points[from].y); handContext.lineTo(points[to].x, points[to].y); handContext.stroke();
    });
    points.forEach((point, index) => {
      handContext.beginPath(); handContext.arc(point.x, point.y, [4,8,12,16,20].includes(index) ? 3.1 : 1.7, 0, Math.PI * 2); handContext.fill();
    });
    handContext.shadowBlur = 0;
  });
}

async function createLandmarker() {
  const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm");
  const vision = await visionModule.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
  const options = {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: .55,
    minHandPresenceConfidence: .5,
    minTrackingConfidence: .5,
  };
  try {
    return await visionModule.HandLandmarker.createFromOptions(vision, options);
  } catch {
    delete options.baseOptions.delegate;
    return visionModule.HandLandmarker.createFromOptions(vision, options);
  }
}

async function startLab(withCamera) {
  loading.hidden = false;
  launch.hidden = true;
  state.demo = !withCamera;
  try {
    if (withCamera) {
      loadingDetail.textContent = "Cer accesul la cameră...";
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } });
      video.srcObject = state.stream;
      await video.play();
      lab.classList.add("has-camera");
      loadingDetail.textContent = "Calibrez cele 21 de puncte pentru fiecare mână...";
      state.landmarker = await createLandmarker();
    }
    state.active = true;
    state.reveal = 0;
    interfaceLayer.hidden = false;
    loading.hidden = true;
    updateTrackingUi(0);
    setGesture(state.demo ? "demo" : "auto");
  } catch (error) {
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    video.srcObject = null;
    lab.classList.remove("has-camera");
    state.demo = true;
    state.active = true;
    interfaceLayer.hidden = false;
    loading.hidden = true;
    updateTrackingUi(0);
    setGesture("demo");
    showToast(error?.name === "NotAllowedError" ? "Camera este blocată. Am pornit automat modul tactil." : "Detecția mâinilor nu a pornit. Poți testa scena prin touch.");
  }
}

function stopLab() {
  state.active = false;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
  state.landmarker?.close?.();
  state.landmarker = null;
  state.hands = [];
  state.demo = false;
  drawHands([]);
  lab.classList.remove("has-camera");
  interfaceLayer.hidden = true;
  loading.hidden = true;
  launch.hidden = false;
  state.explodeTarget = 0;
  state.scaleTarget = 1;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function detectHands(now) {
  if (!state.active || state.demo || !state.landmarker || video.readyState < 2) return;
  if (video.currentTime === state.lastVideoTime || now - state.lastDetection < 65) return;
  state.lastVideoTime = video.currentTime;
  state.lastDetection = now;
  try {
    const result = state.landmarker.detectForVideo(video, now);
    state.hands = result.landmarks || [];
    readGestures(state.hands);
    drawHands(state.hands);
    updateTrackingUi(state.hands.length);
  } catch {
    // Keep rendering if one video frame is not ready for MediaPipe.
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const time = now * .001;
  detectHands(now);
  if (!state.active || (!state.hands.length && !state.demo)) {
    state.rotYTarget += .003;
  }
  state.reveal += (1 - state.reveal) * .055;
  state.explode += (state.explodeTarget - state.explode) * .075;
  state.scale += (state.scaleTarget - state.scale) * .08;
  state.rotX += (state.rotXTarget - state.rotX) * .075;
  state.rotY += (state.rotYTarget - state.rotY) * .075;
  state.attractorA.lerp(state.attractorATarget, .14);
  state.attractorB.lerp(state.attractorBTarget, .14);
  const revealEase = 1 - Math.pow(1 - Math.min(1, state.reveal), 3);
  activeModel.scale.setScalar(Math.max(.01, revealEase) * state.scale);
  activeModel.rotation.x = state.rotX + Math.sin(time * .38) * .04;
  activeModel.rotation.y = state.rotY + time * (state.gesture === "pinch" ? .025 : .09);
  activeModel.userData.update?.(time, state.explode);
  aura.material.opacity = .16 + state.explode * .16 + Math.sin(time * 1.8) * .025;
  aura.scale.setScalar(4.7 + state.explode * 1.5 + Math.sin(time * 1.2) * .12);
  particles.rotation.y = time * .025;
  particleMaterial.uniforms.uTime.value = time;
  particleMaterial.uniforms.uExplode.value = state.explode;
  particleMaterial.uniforms.uActive.value += (((state.hands.length || state.demo) ? .94 : .4) - particleMaterial.uniforms.uActive.value) * .06;
  renderer.render(scene, renderCamera);
}

function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderCamera.aspect = innerWidth / innerHeight;
  renderCamera.updateProjectionMatrix();
  handCanvas.width = innerWidth * devicePixelRatio;
  handCanvas.height = innerHeight * devicePixelRatio;
  handCanvas.style.width = `${innerWidth}px`;
  handCanvas.style.height = `${innerHeight}px`;
  handContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  particleMaterial.uniforms.uPixelRatio.value = Math.min(devicePixelRatio, 2);
}

lab.addEventListener("pointerdown", (event) => {
  if (!state.active || event.target.closest("button")) return;
  state.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, rotX: state.rotXTarget, rotY: state.rotYTarget, time: performance.now() };
});
lab.addEventListener("pointermove", (event) => {
  if (!state.pointer || event.pointerId !== state.pointer.id) return;
  state.rotYTarget = state.pointer.rotY + (event.clientX - state.pointer.x) * .009;
  state.rotXTarget = THREE.MathUtils.clamp(state.pointer.rotX + (event.clientY - state.pointer.y) * .007, -1.2, 1.2);
  if (state.demo) setGesture("demo");
  if (state.demo) {
    state.attractorATarget.set((event.clientX / innerWidth - .5) * 5.2, -(event.clientY / innerHeight - .5) * 5.8, 0);
    state.attractorBTarget.set(0, 0, 0);
  }
});
lab.addEventListener("pointerup", (event) => {
  if (!state.pointer || event.pointerId !== state.pointer.id) return;
  if (performance.now() - state.pointer.time < 240 && Math.hypot(event.clientX - state.pointer.x, event.clientY - state.pointer.y) < 12) {
    const previousTap = lab.dataset.lastTap || 0;
    if (performance.now() - previousTap < 340) state.explodeTarget = state.explodeTarget > .5 ? 0 : 1;
    lab.dataset.lastTap = performance.now();
  }
  state.pointer = null;
});
lab.addEventListener("wheel", (event) => {
  if (!state.active) return;
  state.scaleTarget = THREE.MathUtils.clamp(state.scaleTarget - event.deltaY * .001, .65, 1.65);
}, { passive: true });

$("#start-camera").addEventListener("click", () => startLab(true));
$("#start-demo").addEventListener("click", () => startLab(false));
$("#close-lab").addEventListener("click", stopLab);
document.querySelectorAll("[data-model]").forEach((button) => button.addEventListener("click", () => switchModel(button.dataset.model)));
window.addEventListener("resize", resize);
window.addEventListener("pagehide", () => state.stream?.getTracks().forEach((track) => track.stop()));

resize();
requestAnimationFrame(animate);
window.__HOLOLAB__ = { state, switchModel, renderer };
