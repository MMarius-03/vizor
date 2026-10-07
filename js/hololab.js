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
const cameraButton = $("#switch-camera");
const energyMeter = $("#energy-meter");
const energyValue = $("#energy-value");
const energyWave = $("#energy-wave");

const MODEL_INFO = {
  atom: { index: "SPECIMEN 01", name: "ATOM // CARBON", detail: "6 protoni · 6 neutroni · 6 electroni", visualScale: 1 },
  dna: { index: "SPECIMEN 02", name: "ADN // HELIX", detail: "16 perechi · dublu helix", visualScale: .9 },
  orbital: { index: "SPECIMEN 03", name: "ORBITAL // KEPLER", detail: "nucleu energetic · 3 orbite", visualScale: .72 },
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
  cameraFacing: "user",
  sessionId: 0,
  switchingCamera: false,
  pinching: false,
  pinchStarted: 0,
  charge: 0,
  pulseStart: -Infinity,
  pulsePower: 0,
  transition: null,
  modelTarget: new THREE.Vector3(),
  modelPosition: new THREE.Vector3(),
  lastFrame: 0,
  attractorA: new THREE.Vector3(-1.35, 0.2, 0),
  attractorB: new THREE.Vector3(1.35, -0.2, 0),
  attractorATarget: new THREE.Vector3(-1.35, 0.2, 0),
  attractorBTarget: new THREE.Vector3(1.35, -0.2, 0),
  fingertip: new THREE.Vector3(),
  fingertipTarget: new THREE.Vector3(),
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
const fingertipMarker = new THREE.Mesh(
  new THREE.TorusGeometry(0.13, 0.012, 6, 36),
  new THREE.MeshBasicMaterial({ color: 0x8dffeb, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
);
fingertipMarker.visible = false;
labRoot.add(fingertipMarker);
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
aura.material.opacity = .18;
aura.scale.set(4.4, 4.4, 1);
labRoot.add(aura);

const particleGeometry = new THREE.BufferGeometry();
const particleCount = innerWidth < 700 ? 3600 : 7200;
const particlePositions = new Float32Array(particleCount * 3);
const particleSeeds = new Float32Array(particleCount);
for (let index = 0; index < particleCount; index += 1) {
  const radius = 1.25 + Math.random() * 2.7;
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
    uCharge: { value: 0 },
    uPulse: { value: 0 },
    uTransition: { value: 0 },
    uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uActive;
    uniform float uExplode;
    uniform float uCharge;
    uniform float uPulse;
    uniform float uTransition;
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
      float angle = uTime * speed + phase + uTransition * (2.0 + aSeed * 5.0);
      float radius = (0.12 + pow(fract(aSeed * 43.7), 1.7) * 1.65) * (1.0 - uCharge * 0.42);
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
      transformed += normalize(position + vec3(0.001)) * (
        uExplode * (0.75 + aSeed * 2.4) +
        uPulse * (0.9 + aSeed * 2.6) +
        uTransition * (0.35 + aSeed * 1.8)
      );
      transformed.y += sin(uTime * 0.4 + phase) * 0.035;

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = (1.35 + fract(aSeed * 51.0) * 1.6 + (uExplode + uCharge + uPulse) * 1.1) * uPixelRatio * (5.0 / max(2.0, -mvPosition.z));
      vEnergy = clamp(speed * 0.55 + bridgeMix * 0.35 + uExplode * 0.25 + uCharge * 0.25 + uPulse * 0.45 + uTransition * 0.4, 0.0, 1.0);
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
    const mesh = sphere(0.17, index % 2 ? materials.coral : materials.ivory, 2);
    mesh.position.fromArray(values);
    mesh.userData.base = mesh.position.clone();
    mesh.userData.burst = mesh.position.clone().normalize().multiplyScalar(0.85 + Math.random() * 0.45);
    nucleons.push(mesh);
    group.add(mesh);
  });
  const rotations = [new THREE.Euler(0.2,0.1,0.15), new THREE.Euler(1.05,.2,.7)];
  rotations.forEach((rotation) => {
    const orbit = orbitLine(1.82, 0.68, rotation);
    orbit.material.opacity = .3;
    group.add(orbit);
  });
  for (let index = 0; index < 6; index += 1) {
    const mesh = sphere(0.075, materials.cyan, 2);
    electrons.push({ mesh, phase: index / 6 * Math.PI * 2, speed: .72 + (index % 3) * .13, rotation: rotations[index % 3] });
    group.add(mesh);
  }
  group.userData.update = (time, explode) => {
    nucleons.forEach((mesh) => mesh.position.copy(mesh.userData.base).addScaledVector(mesh.userData.burst, explode));
    electrons.forEach((electron) => {
      const angle = time * electron.speed + electron.phase;
      electron.mesh.position.set(Math.cos(angle) * (1.82 + explode * .55), Math.sin(angle) * (.68 + explode * .2), 0).applyEuler(electron.rotation);
    });
  };
  return group;
}

function createDNA() {
  const group = new THREE.Group();
  const steps = [];
  const count = 16;
  for (let index = 0; index < count; index += 1) {
    const y = (index - (count - 1) / 2) * 0.25;
    const angle = index * 0.58;
    const leftPosition = new THREE.Vector3(Math.cos(angle) * 0.76, y, Math.sin(angle) * 0.76);
    const rightPosition = new THREE.Vector3(-leftPosition.x, y, -leftPosition.z);
    const step = new THREE.Group();
    const left = sphere(0.085, index % 2 ? materials.cyan : materials.ivory, 1);
    const right = sphere(0.085, index % 3 ? materials.coral : materials.amber, 1);
    left.position.copy(leftPosition);
    right.position.copy(rightPosition);
    const rung = connector(leftPosition, rightPosition, 0.021, index % 2 ? materials.amber : materials.coral);
    rung.material.transparent = true;
    rung.material.opacity = .72;
    step.add(left, right, rung);
    steps.push({ group: step, left, right, leftBase: leftPosition, rightBase: rightPosition });
    group.add(step);
  }
  const backbonePoints = (side) => steps.map((step) => (side ? step.rightBase : step.leftBase).clone());
  [false, true].forEach((side) => {
    const curve = new THREE.CatmullRomCurve3(backbonePoints(side));
    const backbone = new THREE.Mesh(
      new THREE.TubeGeometry(curve, count * 8, 0.025, 6, false),
      side ? materials.coral : materials.cyan,
    );
    group.add(backbone);
  });
  group.rotation.z = -0.1;
  group.userData.update = (time, explode) => {
    steps.forEach((step, index) => {
      const direction = index % 2 ? 1 : -1;
      step.group.position.x = direction * explode * (0.32 + Math.abs(index - 7.5) * 0.025);
      step.group.rotation.y = Math.sin(time * .8 + index * .34) * .025;
      const beat = 1 + Math.sin(time * 2.2 - index * .48) * .045;
      step.left.scale.setScalar(beat);
      step.right.scale.setScalar(beat);
    });
  };
  return group;
}

function createOrbital() {
  const group = new THREE.Group();
  const core = sphere(0.72, materials.amber, 3);
  const coreWire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.84, 1), new THREE.MeshBasicMaterial({ color: 0xff765f, wireframe: true, transparent: true, opacity: .2 }));
  group.add(core, coreWire);
  const rings = [
    { radius: 1.5, speed: .72, tilt: new THREE.Euler(.9,.1,.2), color: materials.cyan },
    { radius: 2.1, speed: -.46, tilt: new THREE.Euler(.35,.65,-.2), color: materials.coral },
    { radius: 2.65, speed: .31, tilt: new THREE.Euler(1.22,.2,.62), color: materials.ivory },
  ];
  rings.forEach((ring, index) => {
    const line = orbitLine(ring.radius, ring.radius, ring.tilt);
    const body = sphere(.09 + index * .025, ring.color, 2);
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
let activeModelKey = "atom";
labRoot.add(activeModel);

function releaseModel(model) {
  const sharedMaterials = new Set(Object.values(materials));
  model.traverse((object) => {
    object.geometry?.dispose();
    if (object.material && !sharedMaterials.has(object.material)) object.material.dispose();
  });
}

function triggerPulse(power = 1) {
  state.pulseStart = performance.now();
  state.pulsePower = power;
  energyWave.classList.remove("is-active");
  void energyWave.offsetWidth;
  energyWave.classList.add("is-active");
}

function switchModel(key) {
  if (!modelFactories[key] || key === state.modelKey) return;
  state.modelKey = key;
  state.transition = { key, started: performance.now(), swapped: false };
  state.explodeTarget = 0;
  state.charge = 0;
  triggerPulse(.8);
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
    tracking: ["HAND", "Mână detectată", "Arată cu degetul ca să ghidezi particulele"],
    point: ["POINT", "Flux direcționat", "Ghidează particulele cu vârful degetului"],
    pinch: ["PINCH", "Energie în creștere", "Mișcă mâna, apoi eliberează pentru impuls"],
    open: ["OPEN", "Vedere descompusă", "Ține palma deschisă"],
    scale: ["DUAL", "Scalare bimanuală", "Apropie sau depărtează mâinile"],
    materialize: ["LOAD", "Materializare", "Specimen nou sincronizat"],
    demo: ["TOUCH", "Control tactil", "Trage · ține apăsat pentru impuls · dublu tap pentru straturi"],
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

function viewX(x) {
  return state.cameraFacing === "user" ? 1 - x : x;
}

function handToWorld(center) {
  return new THREE.Vector3((viewX(center.x) - .5) * 5.2, -(center.y - .5) * 5.8, 0);
}

function releasePinch() {
  if (state.pinching && state.charge > .2) triggerPulse(.5 + state.charge * .85);
  state.pinching = false;
  state.charge = 0;
}

function readGestures(hands) {
  state.explodeTarget = 0;
  if (!hands.length) {
    releasePinch();
    fingertipMarker.visible = false;
    state.modelTarget.set(0, 0, 0);
    state.attractorATarget.set(-1.35, .2, 0);
    state.attractorBTarget.set(1.35, -.2, 0);
    setGesture("auto");
    return;
  }
  if (hands.length > 1) {
    releasePinch();
    fingertipMarker.visible = false;
    state.modelTarget.set(0, 0, 0);
    const first = palmCenter(hands[0]);
    const second = palmCenter(hands[1]);
    state.attractorATarget.copy(handToWorld(first));
    state.attractorBTarget.copy(handToWorld(second));
    state.scaleTarget = THREE.MathUtils.clamp(distance(first, second) * 2.9, .68, 1.62);
    state.rotYTarget = (viewX((first.x + second.x) / 2) - .5) * 1.8;
    setGesture("scale");
    return;
  }
  const hand = hands[0];
  const center = palmCenter(hand);
  state.attractorATarget.copy(handToWorld(center));
  state.attractorBTarget.set(0, 0, 0);
  const palmSize = Math.max(distance(hand[0], hand[9]), .04);
  const pinching = distance(hand[4], hand[8]) / palmSize < .42;
  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  const fingerExtended = fingerTips.map((tip, index) => hand[tip].y < hand[fingerPips[index]].y - .018);
  const extended = fingerExtended.filter(Boolean).length;
  if (pinching) {
    fingertipMarker.visible = false;
    if (!state.pinching) state.pinchStarted = performance.now();
    state.pinching = true;
    const world = handToWorld(center);
    const pinchPoint = { x: (hand[4].x + hand[8].x) * .5, y: (hand[4].y + hand[8].y) * .5 };
    state.attractorATarget.copy(handToWorld(pinchPoint));
    state.modelTarget.set(THREE.MathUtils.clamp(world.x * .16, -.42, .42), THREE.MathUtils.clamp(world.y * .13, -.34, .34), 0);
    state.rotYTarget = (viewX(center.x) - .5) * 3.4;
    state.rotXTarget = (center.y - .5) * 2.4;
    setGesture("pinch");
  } else if (fingerExtended[0] && !fingerExtended[1] && !fingerExtended[2] && !fingerExtended[3]) {
    releasePinch();
    const point = handToWorld(hand[8]);
    state.fingertipTarget.copy(point);
    state.attractorATarget.copy(point);
    state.attractorBTarget.copy(point).multiplyScalar(.42);
    state.modelTarget.set(THREE.MathUtils.clamp(point.x * .055, -.24, .24), THREE.MathUtils.clamp(point.y * .055, -.2, .2), 0);
    state.rotYTarget = (viewX(hand[8].x) - .5) * 1.5;
    state.rotXTarget = (hand[8].y - .5) * .8;
    fingertipMarker.visible = true;
    setGesture("point");
  } else if (extended >= 3) {
    releasePinch();
    fingertipMarker.visible = false;
    state.modelTarget.set(0, 0, 0);
    state.explodeTarget = 1;
    state.rotYTarget = (viewX(center.x) - .5) * 1.3;
    setGesture("open");
  } else {
    releasePinch();
    fingertipMarker.visible = false;
    state.modelTarget.set(0, 0, 0);
    setGesture("tracking");
  }
}

const HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

function mapLandmark(point) {
  const width = handCanvas.width / devicePixelRatio;
  const height = handCanvas.height / devicePixelRatio;
  if (!video.videoWidth) return { x: viewX(point.x) * width, y: point.y * height };
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const renderedWidth = video.videoWidth * scale;
  const renderedHeight = video.videoHeight * scale;
  return { x: (viewX(point.x) * renderedWidth) + (width - renderedWidth) / 2, y: point.y * renderedHeight + (height - renderedHeight) / 2 };
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
    if (state.gesture === "point" && handIndex === 0) {
      const tip = points[8];
      const radius = 8 + Math.sin(performance.now() * .008) * 2;
      handContext.strokeStyle = "rgba(141,255,235,.9)";
      handContext.lineWidth = 1.5;
      handContext.beginPath();
      handContext.arc(tip.x, tip.y, radius, 0, Math.PI * 2);
      handContext.stroke();
      handContext.beginPath();
      handContext.arc(tip.x, tip.y, 2.2, 0, Math.PI * 2);
      handContext.fillStyle = "#e8fff9";
      handContext.fill();
    }
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

function cameraConstraints(facing, exact = false) {
  return {
    audio: false,
    video: {
      facingMode: exact ? { exact: facing } : { ideal: facing },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
}

function setFacing(facing) {
  state.cameraFacing = facing;
  lab.dataset.facing = facing;
  $("#camera-facing-label").textContent = facing === "user" ? "FAȚĂ" : "SPATE";
  const destination = facing === "user" ? "spate" : "față";
  cameraButton.setAttribute("aria-label", `Comută la camera din ${destination}`);
  cameraButton.title = `Comută la camera din ${destination}`;
}

async function switchCamera() {
  if (!state.active || state.demo || state.switchingCamera) return;
  const session = state.sessionId;
  const previous = state.cameraFacing;
  const next = previous === "user" ? "environment" : "user";
  state.switchingCamera = true;
  cameraButton.disabled = true;
  trackingStatus.dataset.state = "searching";
  trackingStatus.querySelector("span").textContent = "COMUT CAMERA";
  state.hands = [];
  releasePinch();
  drawHands([]);
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(next, true));
    if (session !== state.sessionId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    state.stream = stream;
    video.srcObject = stream;
    await video.play();
    if (session !== state.sessionId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    setFacing(next);
    state.lastVideoTime = -1;
    updateTrackingUi(0);
  } catch {
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    video.srcObject = null;
    if (session !== state.sessionId) return;
    try {
      const restored = await navigator.mediaDevices.getUserMedia(cameraConstraints(previous, true));
      if (session !== state.sessionId) {
        restored.getTracks().forEach((track) => track.stop());
        return;
      }
      state.stream = restored;
      video.srcObject = restored;
      await video.play();
      if (session !== state.sessionId) {
        restored.getTracks().forEach((track) => track.stop());
        return;
      }
      setFacing(previous);
      state.lastVideoTime = -1;
      updateTrackingUi(0);
      showToast("Camera selectată nu este disponibilă pe acest dispozitiv.");
    } catch {
      if (session !== state.sessionId) return;
      state.stream?.getTracks().forEach((track) => track.stop());
      state.stream = null;
      video.srcObject = null;
      lab.classList.remove("has-camera");
      state.demo = true;
      cameraButton.hidden = true;
      updateTrackingUi(0);
      setGesture("demo");
      showToast("Camera nu a mai pornit. Laboratorul rămâne disponibil prin touch.");
    }
  } finally {
    state.switchingCamera = false;
    cameraButton.disabled = false;
  }
}

async function startLab(withCamera) {
  const session = ++state.sessionId;
  loading.hidden = false;
  launch.hidden = true;
  state.demo = !withCamera;
  try {
    if (withCamera) {
      loadingDetail.textContent = "Cer accesul la cameră...";
      const stream = await navigator.mediaDevices.getUserMedia(cameraConstraints("user"));
      if (session !== state.sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      state.stream = stream;
      video.srcObject = state.stream;
      await video.play();
      if (session !== state.sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const actualFacing = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      setFacing(actualFacing === "environment" ? "environment" : "user");
      lab.classList.add("has-camera");
      loadingDetail.textContent = "Calibrez cele 21 de puncte pentru fiecare mână...";
      const landmarker = await createLandmarker();
      if (session !== state.sessionId) {
        landmarker.close();
        return;
      }
      state.landmarker = landmarker;
    }
    state.active = true;
    state.reveal = 0;
    state.transition = null;
    cameraButton.hidden = state.demo;
    interfaceLayer.hidden = false;
    loading.hidden = true;
    updateTrackingUi(0);
    setGesture(state.demo ? "demo" : "auto");
  } catch (error) {
    if (session !== state.sessionId) return;
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    video.srcObject = null;
    lab.classList.remove("has-camera");
    state.demo = true;
    state.active = true;
    cameraButton.hidden = true;
    interfaceLayer.hidden = false;
    loading.hidden = true;
    updateTrackingUi(0);
    setGesture("demo");
    showToast(error?.name === "NotAllowedError" ? "Camera este blocată. Am pornit automat modul tactil." : "Detecția mâinilor nu a pornit. Poți testa scena prin touch.");
  }
}

function stopLab() {
  state.sessionId += 1;
  state.active = false;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
  state.landmarker?.close?.();
  state.landmarker = null;
  state.hands = [];
  state.demo = false;
  state.pinching = false;
  state.charge = 0;
  state.pointer = null;
  state.transition = null;
  fingertipMarker.visible = false;
  state.modelKey = activeModelKey;
  document.querySelectorAll("[data-model]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.model === activeModelKey)));
  const info = MODEL_INFO[activeModelKey];
  $("#specimen-index").textContent = info.index;
  $("#specimen-name").textContent = info.name;
  $("#specimen-detail").textContent = info.detail;
  state.modelTarget.set(0, 0, 0);
  cameraButton.hidden = true;
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
  const delta = Math.min((now - (state.lastFrame || now)) * .001, .05);
  state.lastFrame = now;
  const follow = 1 - Math.exp(-8 * delta);
  detectHands(now);
  if (!state.active || (!state.hands.length && !state.demo)) {
    state.rotYTarget += delta * .18;
  }
  const touchCharge = state.pointer ? Math.max(0, (now - state.pointer.time - 190) * .0009) : 0;
  const handCharge = state.pinching ? Math.max(0, (now - state.pinchStarted) * .0009) : 0;
  if (state.pinching || state.pointer) state.charge = Math.min(1, Math.max(touchCharge, handCharge));
  else state.charge = Math.max(0, state.charge - delta * 2.6);
  energyMeter.hidden = state.charge < .02;
  energyMeter.style.setProperty("--energy", `${Math.round(state.charge * 100)}%`);
  energyValue.textContent = `${Math.round(state.charge * 100)}%`;

  state.explode += (state.explodeTarget - state.explode) * follow;
  state.scale += (state.scaleTarget - state.scale) * follow;
  state.rotX += (state.rotXTarget - state.rotX) * follow;
  state.rotY += (state.rotYTarget - state.rotY) * follow;
  state.modelPosition.lerp(state.modelTarget, follow);
  state.fingertip.lerp(state.fingertipTarget, follow * 1.7);
  if (fingertipMarker.visible) {
    fingertipMarker.position.copy(state.fingertip);
    fingertipMarker.rotation.z = time * 1.1;
    fingertipMarker.scale.setScalar(1 + Math.sin(time * 5.2) * .12);
  }
  state.attractorA.lerp(state.attractorATarget, follow * 1.45);
  state.attractorB.lerp(state.attractorBTarget, follow * 1.45);

  let appearance;
  let transitionEnergy = 0;
  if (state.transition) {
    const progress = Math.min((now - state.transition.started) / 1050, 1);
    transitionEnergy = Math.sin(Math.PI * progress);
    if (progress >= .33 && !state.transition.swapped) {
      labRoot.remove(activeModel);
      releaseModel(activeModel);
      activeModel = modelFactories[state.transition.key]();
      activeModelKey = state.transition.key;
      labRoot.add(activeModel);
      state.transition.swapped = true;
    }
    if (state.transition.swapped) {
      const phase = THREE.MathUtils.clamp((progress - .33) / .67, 0, 1);
      appearance = 1 + 2.7 * Math.pow(phase - 1, 3) + 1.7 * Math.pow(phase - 1, 2);
    } else {
      appearance = Math.pow(1 - progress / .33, 2);
    }
    if (progress >= 1) {
      state.transition = null;
      state.reveal = 1;
      if (state.demo) setGesture("demo");
    }
  } else {
    state.reveal = Math.min(1, state.reveal + delta * 1.05);
    appearance = 1 - Math.pow(1 - state.reveal, 3);
  }
  const mobileFit = THREE.MathUtils.clamp((innerWidth / innerHeight) / .75, .52, 1);
  activeModel.scale.setScalar(Math.max(.01, appearance) * state.scale * mobileFit * MODEL_INFO[activeModelKey].visualScale);
  activeModel.position.copy(state.modelPosition);
  activeModel.rotation.x = state.rotX + Math.sin(time * .38) * .04;
  activeModel.rotation.y = state.rotY + time * (state.gesture === "pinch" ? .025 : .09);
  activeModel.userData.update?.(time, state.explode);
  const pulseAge = (now - state.pulseStart) * .001;
  const pulse = pulseAge > 0 && pulseAge < 2 ? state.pulsePower * Math.exp(-pulseAge * 3.3) : 0;
  aura.material.opacity = .12 + state.explode * .1 + state.charge * .13 + pulse * .2 + Math.sin(time * 1.8) * .018;
  aura.scale.setScalar(3.9 + state.explode * 1.1 + state.charge * .35 + pulse * 1.2 + Math.sin(time * 1.2) * .08);
  keyLight.intensity = 22 + state.charge * 11 + pulse * 17;
  warmLight.intensity = 14 + transitionEnergy * 13 + pulse * 8;
  particles.rotation.y = time * .025;
  particleMaterial.uniforms.uTime.value = time;
  particleMaterial.uniforms.uExplode.value = state.explode;
  particleMaterial.uniforms.uCharge.value = state.charge;
  particleMaterial.uniforms.uPulse.value = pulse;
  particleMaterial.uniforms.uTransition.value = transitionEnergy;
  particleMaterial.uniforms.uActive.value += (((state.hands.length || state.demo) ? .94 : .55) - particleMaterial.uniforms.uActive.value) * follow;
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
  if (state.demo) {
    state.attractorATarget.set((event.clientX / innerWidth - .5) * 5.2, -(event.clientY / innerHeight - .5) * 5.8, 0);
    state.attractorBTarget.set(0, 0, 0);
  }
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
  state.modelTarget.set(THREE.MathUtils.clamp((event.clientX / innerWidth - .5) * .7, -.35, .35), THREE.MathUtils.clamp((.5 - event.clientY / innerHeight) * .7, -.3, .3), 0);
});
lab.addEventListener("pointerup", (event) => {
  if (!state.pointer || event.pointerId !== state.pointer.id) return;
  const heldCharge = Math.min(1, Math.max(0, (performance.now() - state.pointer.time - 190) * .0009));
  if (heldCharge > .2) triggerPulse(.5 + heldCharge * .85);
  state.charge = 0;
  state.modelTarget.set(0, 0, 0);
  if (performance.now() - state.pointer.time < 240 && Math.hypot(event.clientX - state.pointer.x, event.clientY - state.pointer.y) < 12) {
    const previousTap = lab.dataset.lastTap || 0;
    if (performance.now() - previousTap < 340) state.explodeTarget = state.explodeTarget > .5 ? 0 : 1;
    lab.dataset.lastTap = performance.now();
  }
  state.pointer = null;
});
lab.addEventListener("pointercancel", () => {
  state.pointer = null;
  state.charge = 0;
  state.modelTarget.set(0, 0, 0);
});
lab.addEventListener("wheel", (event) => {
  if (!state.active) return;
  state.scaleTarget = THREE.MathUtils.clamp(state.scaleTarget - event.deltaY * .001, .65, 1.65);
}, { passive: true });

$("#start-camera").addEventListener("click", () => startLab(true));
$("#start-demo").addEventListener("click", () => startLab(false));
$("#close-lab").addEventListener("click", stopLab);
cameraButton.addEventListener("click", switchCamera);
document.querySelectorAll("[data-model]").forEach((button) => button.addEventListener("click", () => switchModel(button.dataset.model)));
window.addEventListener("resize", resize);
window.addEventListener("pagehide", stopLab);

resize();
requestAnimationFrame(animate);
window.__HOLOLAB__ = { state, switchModel, renderer };
