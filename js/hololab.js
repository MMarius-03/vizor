import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

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
const trackingMeterFill = $("#tracking-meter-fill");
const partLabel = $("#part-label");
const skeletonButton = $("#skeleton-mode");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const MODEL_INFO = {
  atom: { index: "SPECIMEN 01", name: "ATOM // CARBON", detail: "6 protoni · 6 neutroni · 6 electroni", visualScale: 1 },
  dna: { index: "SPECIMEN 02", name: "ADN // HELIX", detail: "16 perechi · dublu helix", visualScale: .9 },
  orbital: { index: "SPECIMEN 03", name: "ORBITAL // KEPLER", detail: "nucleu energetic · 3 orbite", visualScale: .56 },
};

const state = {
  active: false,
  demo: false,
  stream: null,
  landmarker: null,
  hands: [],
  filteredHands: [],
  handFilters: [],
  handTrails: [],
  handEnteredAt: [],
  lastHandSeen: 0,
  videoFrameReady: false,
  videoFrameCallbackId: null,
  pendingGesture: null,
  pendingGestureFrames: 0,
  pendingGestureSince: 0,
  springVelocity: {},
  gesture: "auto",
  explode: 0,
  explodeTarget: 0,
  scale: 1,
  scaleTarget: 1,
  rotX: 0.12,
  rotY: 0,
  rotXTarget: 0.12,
  rotYTarget: 0,
  rotZ: 0,
  rotZTarget: 0,
  modelKey: "atom",
  reveal: 0,
  morph: 0,
  lastMorphMinimum: 1,
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
  thumbTarget: new THREE.Vector3(),
  pinchTarget: new THREE.Vector3(),
  palmTarget: new THREE.Vector3(),
  pulseOrigin: new THREE.Vector3(),
  anchor: "center",
  trackingConfidence: 0,
  skeletonMode: "discret",
  reducedMotion: reducedMotion.matches,
  lastInteraction: performance.now(),
  uiHidden: false,
  soundOn: true,
  animationFrameId: null,
  previousPalm: null,
  clapHistory: [],
  lastClapAt: 0,
  lastSwipeAt: 0,
  fistSince: 0,
  fistActive: false,
  hoveredPart: null,
  hoverStarted: 0,
  hoverLostAt: 0,
  focusPart: null,
  attractStarted: 0,
  attractPhase: -1,
  gestureCounts: {},
  lastSuggestionAt: 0,
  suggestionIndex: 0,
  tutorialStep: -1,
  quality: { level: "high", bloom: true, averageFrameMs: 0, frames: [], slowWindows: 0, fastSince: 0 },
};

const audio = { context: null, hum: null, gain: null };

function initAudio() {
  if (!state.soundOn) return;
  try {
    audio.context ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.context.resume();
    if (audio.hum) return;
    audio.hum = audio.context.createOscillator();
    audio.gain = audio.context.createGain();
    const filter = audio.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 160;
    audio.hum.type = "sine";
    audio.hum.frequency.value = 55;
    audio.gain.gain.value = 0;
    audio.hum.connect(filter).connect(audio.gain).connect(audio.context.destination);
    audio.hum.start();
  } catch {
    state.soundOn = false;
  }
}

function playTone(frequency, duration = .18, volume = .045) {
  if (!state.soundOn || !audio.context) return;
  const oscillator = audio.context.createOscillator();
  const gain = audio.context.createGain();
  const start = audio.context.currentTime;
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * .56, start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain).connect(audio.context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playWhoosh() {
  if (!state.soundOn || !audio.context) return;
  const context = audio.context;
  const length = Math.floor(context.sampleRate * .24);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) samples[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const start = context.currentTime;
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(190, start);
  filter.frequency.exponentialRampToValueAtTime(1200, start + .2);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(.045, start + .035);
  gain.gain.exponentialRampToValueAtTime(.0001, start + .24);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
  source.stop(start + .24);
}

class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1) {
    Object.assign(this, { minCutoff, beta, dCutoff, x: null, dx: 0, t: 0 });
  }
  alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(value, t) {
    if (this.x === null) { this.x = value; this.t = t; return value; }
    const dt = Math.max((t - this.t) / 1000, .001);
    this.t = t;
    const velocity = (value - this.x) / dt;
    this.dx += this.alpha(this.dCutoff, dt) * (velocity - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

function spring(value, target, key, dt, stiffness, damping) {
  const velocity = state.springVelocity[key] || 0;
  const nextVelocity = velocity + ((target - value) * stiffness - velocity * damping) * dt;
  state.springVelocity[key] = nextVelocity;
  return value + nextVelocity * dt;
}

function resetHandFilters() {
  state.handFilters = [];
  state.filteredHands = [];
  state.hands = [];
  state.handTrails = [];
  state.handEnteredAt = [];
  state.trackingConfidence = 0;
  state.pendingGesture = null;
  state.pendingGestureFrames = 0;
}

function filterHands(hands, now) {
  state.handFilters.length = hands.length;
  return hands.map((hand, handIndex) => {
    const filters = state.handFilters[handIndex] ||= hand.map(() => ({ x: new OneEuro(), y: new OneEuro(), z: new OneEuro() }));
    return hand.map((point, index) => ({
      x: filters[index].x.filter(point.x, now),
      y: filters[index].y.filter(point.y, now),
      z: filters[index].z.filter(point.z || 0, now),
    }));
  });
}

function predictHands(now) {
  const age = Math.min(Math.max((now - state.lastDetection) / 1000, 0), .05);
  return state.filteredHands.map((hand, handIndex) => hand.map((point, index) => {
    const axes = state.handFilters[handIndex][index];
    return {
      x: THREE.MathUtils.clamp(point.x + axes.x.dx * age, 0, 1),
      y: THREE.MathUtils.clamp(point.y + axes.y.dx * age, 0, 1),
      z: point.z + axes.z.dx * age,
    };
  }));
}

const scene = new THREE.Scene();
scene.fog = null;
const renderCamera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
renderCamera.position.set(0, 0, innerWidth < 700 ? 7 : 8.4);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.setClearColor(0x000000, 0);
$("#scene").append(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, renderCamera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .7, .45, .32);
composer.addPass(bloomPass);
const finalPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uPulse: { value: 0 }, uPulseAge: { value: 0 }, uPulseCenter: { value: new THREE.Vector2(.5, .5) }, uReduced: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uPulse;
    uniform float uPulseAge;
    uniform vec2 uPulseCenter;
    uniform float uReduced;
    varying vec2 vUv;
    void main() {
      float aberration = mix(0.0015, 0.008, uPulse) * (1.0 - uReduced);
      vec2 offset = (vUv - 0.5) * aberration;
      vec2 fromPulse = vUv - uPulseCenter;
      float distanceFromPulse = length(fromPulse);
      float ring = exp(-pow((distanceFromPulse - .05 - uPulseAge * .72) * 32.0, 2.0));
      vec2 ripple = normalize(fromPulse + vec2(.00001)) * ring * uPulse * .012 * (1.0 - uReduced);
      vec2 sampleUv = clamp(vUv + ripple, 0.0, 1.0);
      vec4 base = texture2D(tDiffuse, sampleUv);
      vec3 color = vec3(texture2D(tDiffuse, sampleUv + offset).r, base.g, texture2D(tDiffuse, sampleUv - offset).b);
      float vignette = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 0.18;
      float grain = (fract(sin(dot(vUv * 1137.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.014 * (1.0 - uReduced);
      color = max(vec3(0.0), color * vignette + grain);
      float alpha = clamp(max(max(color.r, color.g), color.b) * 1.35, 0.0, 1.0);
      gl_FragColor = vec4(color, alpha);
    }
  `,
});
composer.addPass(finalPass);

const labRoot = new THREE.Group();
scene.add(labRoot);
const fingertipMarker = new THREE.Mesh(
  new THREE.TorusGeometry(0.13, 0.012, 6, 36),
  new THREE.MeshBasicMaterial({ color: 0x8dffeb, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
);
fingertipMarker.visible = false;
labRoot.add(fingertipMarker);
const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(.95, 1.02, 64),
  new THREE.MeshBasicMaterial({ color: 0x9effe7, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
);
pulseRing.visible = false;
labRoot.add(pulseRing);
const palmCone = new THREE.Mesh(
  new THREE.ConeGeometry(.65, 1.6, 32, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x58f5d4, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
);
palmCone.visible = false;
labRoot.add(palmCone);
const chargeOrb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9dffe9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
chargeOrb.visible = false;
labRoot.add(chargeOrb);
const chargeArcGeometry = new THREE.BufferGeometry();
chargeArcGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(36), 3));
const chargeArc = new THREE.Line(chargeArcGeometry, new THREE.LineBasicMaterial({ color: 0xe3fff9, transparent: true, opacity: .65, blending: THREE.AdditiveBlending, depthWrite: false }));
chargeArc.visible = false;
labRoot.add(chargeArc);
scene.add(new THREE.HemisphereLight(0xb9fff0, 0x32140f, 2.3));
const keyLight = new THREE.PointLight(0x5ff1d2, 22, 18);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);
const warmLight = new THREE.PointLight(0xff765f, 14, 15);
warmLight.position.set(-4, -2, 3);
scene.add(warmLight);

const holoUniforms = {
  uTime: { value: 0 },
  uReveal: { value: 1 },
  uTransition: { value: 0 },
  uOpacity: { value: 1 },
  uModelCenterY: { value: 0 },
};

function holoMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { ...holoUniforms, uColor: { value: new THREE.Color(color) } },
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform float uTransition;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      void main() {
        vec3 displaced = position;
        float band = step(.94, sin(position.y * 45.0 + uTime * 24.0));
        displaced.x += band * uTransition * .055;
        vec4 world = modelMatrix * vec4(displaced, 1.0);
        vWorldPos = world.xyz;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uReveal;
      uniform float uOpacity;
      uniform float uModelCenterY;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPos;
      void main() {
        float height = clamp((vWorldPos.y - uModelCenterY + 2.7) / 5.4, 0.0, 1.0);
        float reveal = smoothstep(height - .045, height + .045, uReveal);
        if (reveal < .01) discard;
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float rim = pow(1.0 - abs(dot(normalize(vNormalWorld), viewDir)), 2.2);
        float scan = pow(max(0.0, sin(vWorldPos.y * 80.0 - uTime * 4.0)), 12.0);
        float flicker = 1.0 - step(.992, sin(uTime * 1.18)) * .025;
        float edge = 1.0 - smoothstep(0.0, .05, abs(height - uReveal));
        vec3 color = (uColor * (.38 + rim * .72) + vec3(.12,.35,.3) * (scan * .1 + edge * .25)) * flicker;
        gl_FragColor = vec4(color, (.43 + rim * .19 + scan * .04) * reveal * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

const materials = {
  cyan: holoMaterial(0x5ff1d2),
  coral: holoMaterial(0xff765f),
  amber: holoMaterial(0xf3c969),
  ivory: holoMaterial(0x9fcac4),
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
const particleTargets = new Float32Array(particleCount * 3);
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
particleGeometry.setAttribute("aTarget", new THREE.BufferAttribute(particleTargets, 3));
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
    uPulseOrigin: { value: new THREE.Vector3() },
    uTransition: { value: 0 },
    uMorph: { value: 1 },
    uModelMatrix: { value: new THREE.Matrix4() },
    uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
  },
  vertexShader: `
    uniform float uTime;
    uniform float uActive;
    uniform float uExplode;
    uniform float uCharge;
    uniform float uPulse;
    uniform float uMorph;
    uniform float uTransition;
    uniform float uPixelRatio;
    uniform vec3 uAttractorA;
    uniform vec3 uAttractorB;
    uniform vec3 uPulseOrigin;
    uniform mat4 uModelMatrix;
    attribute float aSeed;
    attribute vec3 aTarget;
    varying float vEnergy;
    varying float vAlpha;

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
      vec3 surface = (uModelMatrix * vec4(aTarget, 1.0)).xyz;
      float delay = fract(aSeed * 13.7) * 0.22;
      float morph = smoothstep(delay, 1.0, uMorph);
      vec3 transformed = mix(mix(position, attracted, uActive), surface, morph);
      transformed += normalize(surface + vec3(0.001)) * uExplode * (0.15 + aSeed * 0.5) * morph;
      transformed += normalize(transformed - uPulseOrigin + vec3(0.001)) * uPulse * (0.65 + aSeed * 1.8);
      transformed += normalize(position + vec3(0.001)) * uTransition * (0.18 + aSeed * 1.0);
      transformed.y += sin(uTime * 0.4 + phase) * 0.035;

      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = (2.0 + fract(aSeed * 51.0) * 1.7 + (uExplode + uCharge + uPulse) * 1.2) * uPixelRatio * (5.0 / max(2.0, -mvPosition.z));
      vEnergy = clamp(speed * 0.55 + bridgeMix * 0.35 + uExplode * 0.25 + uCharge * 0.25 + uPulse * 0.45 + uTransition * 0.4, 0.0, 1.0);
      vAlpha = mix(0.5, 0.16, morph);
    }
  `,
  fragmentShader: `
    varying float vEnergy;
    varying float vAlpha;
    void main() {
      vec2 center = gl_PointCoord - 0.5;
      float distanceToCenter = length(center);
      if (distanceToCenter > 0.5) discard;
      float alpha = smoothstep(0.5, 0.04, distanceToCenter) * vAlpha;
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
    const mesh = sphere(0.18, index % 2 ? materials.coral : materials.ivory, 2);
    mesh.userData.partLabel = index % 2 ? "Proton · +1 · 1,67×10⁻²⁷ kg" : "Neutron · fără sarcină · nucleu";
    mesh.position.fromArray(values);
    mesh.userData.base = mesh.position.clone();
    mesh.userData.burst = mesh.position.clone().normalize().multiplyScalar(0.85 + Math.random() * 0.45);
    nucleons.push(mesh);
    group.add(mesh);
  });
  const rotations = [new THREE.Euler(0.2,0.1,0.15), new THREE.Euler(1.05,.2,.7), new THREE.Euler(.4,1.15,-.45)];
  rotations.forEach((rotation) => {
    const orbit = orbitLine(1.45, 0.66, rotation);
    orbit.material.opacity = .24;
    group.add(orbit);
  });
  for (let index = 0; index < 6; index += 1) {
    const mesh = sphere(0.075, materials.cyan, 2);
    mesh.userData.partLabel = "Electron · −1 · nor electronic";
    electrons.push({ mesh, phase: index / 6 * Math.PI * 2, speed: .72 + (index % 3) * .13, rotation: rotations[index % rotations.length] });
    group.add(mesh);
  }
  group.userData.update = (time, explode, charge = 0) => {
    nucleons.forEach((mesh) => mesh.position.copy(mesh.userData.base).addScaledVector(mesh.userData.burst, explode));
    const nucleusBeat = 1 + Math.sin(time * 2.4) * .025 + charge * .12;
    nucleons.forEach((mesh) => mesh.scale.setScalar(nucleusBeat));
    electrons.forEach((electron) => {
      const angle = time * electron.speed + electron.phase;
      electron.mesh.position.set(Math.cos(angle) * (1.45 + explode * .4 + charge * .25), Math.sin(angle) * (.66 + explode * .2 + charge * .12), 0).applyEuler(electron.rotation);
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
    const pairLabel = index % 2 ? "Pereche A–T · 2 legături H" : "Pereche G–C · 3 legături H";
    left.userData.partLabel = pairLabel;
    right.userData.partLabel = pairLabel;
    rung.userData.partLabel = pairLabel;
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
  group.userData.update = (time, explode, charge = 0) => {
    steps.forEach((step, index) => {
      const direction = index % 2 ? 1 : -1;
      step.group.position.x = direction * explode * (0.32 + Math.abs(index - 7.5) * 0.025);
      step.group.rotation.y = Math.sin(time * .8 + index * .34) * .025;
      const beat = 1 + Math.sin(time * 2.2 - index * .48) * (.045 + charge * .07);
      step.left.scale.setScalar(beat);
      step.right.scale.setScalar(beat);
    });
  };
  return group;
}

function createOrbital() {
  const group = new THREE.Group();
  const core = sphere(0.72, materials.amber, 3);
  core.userData.partLabel = "Nucleu energetic · centrul sistemului";
  const coreWire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.84, 1), new THREE.MeshBasicMaterial({ color: 0xff765f, wireframe: true, transparent: true, opacity: .2 }));
  group.add(core, coreWire);
  const rings = [
    { radius: 1.5, speed: .72, tilt: new THREE.Euler(.9,.1,.2), color: materials.cyan },
    { radius: 2.1, speed: -.46, tilt: new THREE.Euler(.35,.65,-.2), color: materials.coral },
    { radius: 2.65, speed: .31, tilt: new THREE.Euler(1.22,.2,.62), color: materials.ivory },
  ];
  rings.forEach((ring, index) => {
    const line = orbitLine(ring.radius, ring.radius * .7, ring.tilt);
    const body = sphere(.09 + index * .025, ring.color, 2);
    body.userData.partLabel = `Orbita ${index + 1} · perioadă ${(2 * Math.PI / Math.abs(ring.speed)).toFixed(1).replace(".", ",")} s`;
    ring.line = line;
    ring.body = body;
    group.add(line, body);
  });
  group.userData.update = (time, explode, charge = 0) => {
    core.scale.setScalar(1 + Math.sin(time * 2.4) * .035 + explode * .28 + charge * .12);
    coreWire.rotation.x = time * .16;
    coreWire.rotation.y = time * .23;
    rings.forEach((ring, index) => {
      const radius = ring.radius + explode * (.55 + index * .23) + charge * (.18 + index * .08);
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
let partMeshes = [];
const raycaster = new THREE.Raycaster();
function collectParts(model) {
  partMeshes = [];
  model.traverse((object) => { if (object.isMesh && object.userData.partLabel) partMeshes.push(object); });
}
collectParts(activeModel);

function sampleModelTargets(model) {
  model.updateMatrixWorld(true);
  const inverseModel = model.matrixWorld.clone().invert();
  const entries = [];
  model.traverse((mesh) => {
    if (!(mesh.isMesh || mesh.isLine) || mesh.material?.wireframe || !mesh.geometry?.attributes?.position) return;
    const sampler = mesh.isMesh ? new MeshSurfaceSampler(mesh).build() : null;
    mesh.geometry.computeBoundingSphere();
    const weight = mesh.isLine ? 1.4 : Math.max(.015, mesh.geometry.boundingSphere.radius ** 2);
    entries.push({ mesh, sampler, weight });
  });
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total) return;
  const point = new THREE.Vector3();
  for (let index = 0; index < particleCount; index += 1) {
    let choice = Math.random() * total;
    let entry = entries.at(-1);
    for (const candidate of entries) {
      choice -= candidate.weight;
      if (choice <= 0) { entry = candidate; break; }
    }
    if (entry.sampler) entry.sampler.sample(point);
    else {
      const attribute = entry.mesh.geometry.attributes.position;
      const start = Math.floor(Math.random() * attribute.count);
      const end = (start + 1) % attribute.count;
      point.fromBufferAttribute(attribute, start);
      const next = new THREE.Vector3().fromBufferAttribute(attribute, end);
      point.lerp(next, Math.random());
    }
    point.applyMatrix4(entry.mesh.matrixWorld).applyMatrix4(inverseModel);
    particleTargets[index * 3] = point.x;
    particleTargets[index * 3 + 1] = point.y;
    particleTargets[index * 3 + 2] = point.z;
  }
  particleGeometry.attributes.aTarget.needsUpdate = true;
}

sampleModelTargets(activeModel);

function releaseModel(model) {
  const sharedMaterials = new Set(Object.values(materials));
  model.traverse((object) => {
    object.geometry?.dispose();
    if (object.material && !sharedMaterials.has(object.material)) object.material.dispose();
  });
}

function renderThumbnails() {
  const size = 56;
  const target = new THREE.WebGLRenderTarget(size, size);
  const pixels = new Uint8Array(size * size * 4);
  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.PerspectiveCamera(44, 1, .1, 30);
  previewCamera.position.z = 7.5;
  const oldOpacity = holoUniforms.uOpacity.value;
  const oldReveal = holoUniforms.uReveal.value;
  holoUniforms.uOpacity.value = 1;
  holoUniforms.uReveal.value = 1;
  document.querySelectorAll("[data-model]").forEach((button) => {
    const model = modelFactories[button.dataset.model]();
    model.scale.setScalar(MODEL_INFO[button.dataset.model].visualScale);
    model.userData.update?.(1.8, 0, 0);
    previewScene.add(model);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(previewScene, previewCamera);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    const canvas = button.querySelector("canvas");
    const context = canvas.getContext("2d");
    const imageData = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      const source = (size - y - 1) * size * 4;
      imageData.data.set(pixels.subarray(source, source + size * 4), y * size * 4);
    }
    context.putImageData(imageData, 0, 0);
    previewScene.remove(model);
    releaseModel(model);
  });
  renderer.setRenderTarget(null);
  target.dispose();
  holoUniforms.uOpacity.value = oldOpacity;
  holoUniforms.uReveal.value = oldReveal;
}

function triggerPulse(power = 1, origin = state.attractorA) {
  state.pulseStart = performance.now();
  state.pulsePower = power;
  state.pulseOrigin.copy(origin);
  particleMaterial.uniforms.uPulseOrigin.value.copy(origin);
  playTone(180 + power * 90, .27, .04);
  playWhoosh();
}

function switchModel(key, userInitiated = true) {
  if (!modelFactories[key] || key === state.modelKey) return;
  if (userInitiated) endAttract();
  state.hoveredPart = null;
  state.focusPart = null;
  partLabel.hidden = true;
  if (userInitiated) state.lastInteraction = performance.now();
  state.modelKey = key;
  state.transition = { key, started: performance.now(), swapped: false };
  state.lastMorphMinimum = 1;
  state.explodeTarget = 0;
  state.charge = 0;
  triggerPulse(.8);
  document.querySelectorAll("[data-model]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.model === key)));
  $(".specimen-switcher").style.setProperty("--selected-index", String(Object.keys(MODEL_INFO).indexOf(key)));
  const info = MODEL_INFO[key];
  $(".specimen-info").classList.remove("is-changing");
  void $(".specimen-info").offsetWidth;
  $(".specimen-info").classList.add("is-changing");
  setTimeout(() => $(".specimen-info").classList.remove("is-changing"), 200);
  $("#specimen-index").textContent = info.index;
  $("#specimen-name").textContent = info.name;
  $("#specimen-detail").textContent = info.detail;
  setGesture("materialize");
  playTone(440, .23, .025);
}

function setGesture(gesture) {
  if (gesture === state.gesture) return;
  state.gesture = gesture;
  if (["point", "pinch", "open"].includes(gesture)) state.gestureCounts[gesture] = (state.gestureCounts[gesture] || 0) + 1;
  const labels = {
    auto: ["AUTO", "Orbită autonomă", "Ridică o mână în cadru"],
    tracking: ["HAND", "Mână detectată", "Arată cu degetul ca să ghidezi particulele"],
    point: ["POINT", "Flux direcționat", "Ghidează particulele cu vârful degetului"],
    pinch: ["PINCH", "Energie în creștere", "Mișcă mâna, apoi eliberează pentru impuls"],
    open: ["OPEN", "Vedere descompusă", "Ține palma deschisă"],
    scale: ["DUAL", "Scalare bimanuală", "Apropie sau depărtează mâinile"],
    fist: ["FIST", "Colaps energetic", "Deschide palma pentru Big Bang"],
    clap: ["CLAP", "Super-impuls", "Undă de șoc declanșată"],
    materialize: ["LOAD", "Materializare", "Specimen nou sincronizat"],
    demo: ["TOUCH", "Control tactil", "Trage · ține apăsat pentru impuls · dublu tap pentru straturi"],
  };
  const [code, title, note] = labels[gesture] || labels.auto;
  gestureCode.textContent = code;
  gestureTitle.textContent = title;
  modeNote.textContent = note;
  advanceTutorial(gesture);
  document.querySelectorAll("[data-guide]").forEach((guide) => guide.classList.toggle("is-active", guide.dataset.guide === gesture));
}

function offerGesture(gesture, now = performance.now()) {
  if (gesture === state.gesture) {
    state.pendingGesture = null;
    state.pendingGestureFrames = 0;
    return;
  }
  if (state.pendingGesture !== gesture) {
    state.pendingGesture = gesture;
    state.pendingGestureFrames = 1;
    state.pendingGestureSince = now;
  } else {
    state.pendingGestureFrames += 1;
  }
  if (state.pendingGestureFrames >= 3 && now - state.pendingGestureSince >= 50) {
    setGesture(gesture);
    state.pendingGesture = null;
    state.pendingGestureFrames = 0;
  }
}

function updateTrackingUi(handCount) {
  interfaceLayer.classList.toggle("is-tracking", handCount > 0);
  if (state.demo) {
    trackingStatus.dataset.state = "demo";
  } else if (handCount > 0) {
    trackingStatus.dataset.state = "live";
  } else {
    trackingStatus.dataset.state = "searching";
  }
  trackingMeterFill.style.width = `${Math.round(state.trackingConfidence * 100)}%`;
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
  const pixel = mapLandmark(center);
  const height = 2 * renderCamera.position.z * Math.tan(THREE.MathUtils.degToRad(renderCamera.fov / 2));
  const width = height * renderCamera.aspect;
  return new THREE.Vector3((pixel.x / innerWidth - .5) * width, (.5 - pixel.y / innerHeight) * height, 0);
}

function releasePinch() {
  if (state.pinching && state.charge > .2) triggerPulse(.5 + state.charge * .85, state.pinchTarget);
  state.pinching = false;
  state.charge = 0;
}

function readGestures(hands) {
  if (!hands.length && state.attractStarted) return;
  state.explodeTarget = 0;
  if (!hands.length) {
    releasePinch();
    state.anchor = "center";
    state.previousPalm = null;
    state.clapHistory = [];
    state.rotZTarget = 0;
    state.fistSince = 0;
    state.fistActive = false;
    fingertipMarker.visible = false;
    state.modelTarget.set(0, 0, 0);
    state.attractorATarget.set(-1.35, .2, 0);
    state.attractorBTarget.set(1.35, -.2, 0);
    setGesture("auto");
    return;
  }
  if (hands.length > 1) {
    releasePinch();
    state.anchor = "center";
    state.previousPalm = null;
    state.fistSince = 0;
    fingertipMarker.visible = false;
    state.modelTarget.set(0, 0, 0);
    const first = palmCenter(hands[0]);
    const second = palmCenter(hands[1]);
    const now = performance.now();
    const separation = distance(first, second);
    state.clapHistory.push({ separation, time: now });
    state.clapHistory = state.clapHistory.filter((entry) => now - entry.time <= 220);
    const earliest = state.clapHistory[0];
    if (earliest && now - earliest.time >= 100 && separation < earliest.separation * .4 && now - state.lastClapAt > 1200) {
      state.lastClapAt = now;
      state.clapHistory = [];
      state.pulseOrigin.copy(handToWorld({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }));
      triggerPulse(2.2, state.pulseOrigin);
      setGesture("clap");
      if (!state.reducedMotion) {
        lab.classList.remove("is-clapping");
        void lab.offsetWidth;
        lab.classList.add("is-clapping");
        setTimeout(() => lab.classList.remove("is-clapping"), 180);
      }
    }
    state.attractorATarget.copy(handToWorld(first));
    state.attractorBTarget.copy(handToWorld(second));
    state.scaleTarget = THREE.MathUtils.clamp(separation * 2.9, .68, 1.62);
    state.rotYTarget = (viewX((first.x + second.x) / 2) - .5) * 1.8;
    offerGesture("scale");
    return;
  }
  const hand = hands[0];
  const center = palmCenter(hand);
  const now = performance.now();
  const prior = state.previousPalm;
  state.previousPalm = { x: center.x, time: now };
  state.clapHistory = [];
  state.attractorATarget.copy(handToWorld(center));
  state.attractorBTarget.set(0, 0, 0);
  const palmSize = Math.max(distance(hand[0], hand[9]), .04);
  const pinching = distance(hand[4], hand[8]) / palmSize < (state.pinching ? .55 : .38);
  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  const fingerExtended = fingerTips.map((tip, index) => hand[tip].y < hand[fingerPips[index]].y - .018);
  const extended = fingerExtended.filter(Boolean).length;
  const depth = THREE.MathUtils.clamp((palmSize - .16) * 3, -.25, .5);
  const wristAngle = Math.atan2(hand[9].y - hand[0].y, viewX(hand[9].x) - viewX(hand[0].x));
  state.rotZTarget = THREE.MathUtils.clamp(wristAngle + Math.PI / 2, -.9, .9) * .45;
  state.scaleTarget = 1;
  const fistCandidate = extended === 0 && distance(hand[4], hand[8]) / palmSize > .6;
  state.fistSince = fistCandidate ? (state.fistSince || now) : 0;
  if (state.fistActive && extended >= 3) {
    state.fistActive = false;
    triggerPulse(1.8, handToWorld(center));
  }
  if (fistCandidate && now - state.fistSince >= 400) {
    releasePinch();
    state.fistActive = true;
    state.anchor = "center";
    state.scaleTarget = .12;
    state.explodeTarget = -.45;
    state.modelTarget.copy(handToWorld(center)).multiplyScalar(.2);
    fingertipMarker.visible = false;
    offerGesture("fist");
    return;
  }
  if (extended >= 3 && prior) {
    const speed = (viewX(center.x) - viewX(prior.x)) / Math.max((now - prior.time) / 1000, .001);
    if (Math.abs(speed) > 1.6 && now - state.lastSwipeAt > 900 && !state.transition) {
      state.lastSwipeAt = now;
      const keys = Object.keys(MODEL_INFO);
      const index = keys.indexOf(state.modelKey);
      switchModel(keys[(index + (speed > 0 ? 1 : keys.length - 1)) % keys.length]);
    }
  }
  if (pinching) {
    fingertipMarker.visible = false;
    if (!state.pinching) state.pinchStarted = performance.now();
    state.pinching = true;
    const world = handToWorld(center);
    const pinchPoint = { x: (hand[4].x + hand[8].x) * .5, y: (hand[4].y + hand[8].y) * .5 };
    state.thumbTarget.copy(handToWorld(hand[4]));
    state.fingertipTarget.copy(handToWorld(hand[8]));
    state.pinchTarget.copy(handToWorld(pinchPoint));
    state.attractorATarget.copy(state.pinchTarget);
    state.anchor = "center";
    state.modelTarget.set(THREE.MathUtils.clamp(world.x * .16, -.42, .42), THREE.MathUtils.clamp(world.y * .13, -.34, .34), depth);
    state.rotYTarget = (viewX(center.x) - .5) * 3.4;
    state.rotXTarget = (center.y - .5) * 2.4;
    offerGesture("pinch");
  } else if (fingerExtended[0] && !fingerExtended[1] && !fingerExtended[2] && !fingerExtended[3]) {
    releasePinch();
    state.anchor = "center";
    const point = handToWorld(hand[8]);
    state.fingertipTarget.copy(point);
    state.attractorATarget.copy(point);
    state.attractorBTarget.copy(point).multiplyScalar(.42);
    state.modelTarget.set(THREE.MathUtils.clamp(point.x * .055, -.24, .24), THREE.MathUtils.clamp(point.y * .055, -.2, .2), depth);
    state.rotYTarget = (viewX(hand[8].x) - .5) * 1.5;
    state.rotXTarget = (hand[8].y - .5) * .8;
    fingertipMarker.visible = state.gesture === "point";
    offerGesture("point");
  } else if (extended >= 3) {
    releasePinch();
    fingertipMarker.visible = false;
    const wrist = new THREE.Vector3(hand[0].x, hand[0].y, hand[0].z);
    const indexBase = new THREE.Vector3(hand[5].x, hand[5].y, hand[5].z);
    const pinkyBase = new THREE.Vector3(hand[17].x, hand[17].y, hand[17].z);
    const normal = indexBase.sub(wrist).cross(pinkyBase.sub(wrist)).normalize();
    state.anchor = Math.abs(normal.z) > .45 ? "palm" : "center";
    state.palmTarget.copy(handToWorld(center));
    if (state.anchor === "palm") {
      state.modelTarget.set(
        THREE.MathUtils.clamp(state.palmTarget.x, -1.05, 1.05),
        THREE.MathUtils.clamp(state.palmTarget.y + .85, -1.25, 1.5),
        depth,
      );
      state.scaleTarget = THREE.MathUtils.clamp(palmSize * 5.2, .7, 1.15);
    } else state.modelTarget.set(0, 0, depth);
    state.explodeTarget = 1;
    state.rotYTarget = (viewX(center.x) - .5) * 1.3;
    offerGesture("open");
  } else {
    releasePinch();
    state.anchor = "center";
    fingertipMarker.visible = false;
    state.modelTarget.set(0, 0, depth);
    offerGesture("tracking");
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
  if (state.skeletonMode === "ascuns") return;
  const now = performance.now();
  const baseOpacity = state.skeletonMode === "plin" ? .56 : .28;
  hands.forEach((hand, handIndex) => {
    const points = hand.map(mapLandmark);
    const color = handIndex ? [255,134,110] : [108,247,215];
    const progress = Math.min(1, (now - (state.handEnteredAt[handIndex] ||= now)) / 350);
    const activeJoints = state.gesture === "pinch" ? new Set([0,1,2,3,4,5,6,7,8]) :
      state.gesture === "point" ? new Set([0,5,6,7,8]) : new Set();
    handContext.lineCap = "round";
    HAND_CONNECTIONS.forEach(([from, to]) => {
      const depth = Math.ceil(to / 4);
      if (progress < depth / 6) return;
      const start = points[from];
      const end = points[to];
      const hot = activeJoints.has(from) && activeJoints.has(to);
      const alpha = (hot ? .8 : baseOpacity) * progress;
      const gradient = handContext.createLinearGradient(start.x,start.y,end.x,end.y);
      gradient.addColorStop(0, `rgba(${color.join(",")},${alpha * .64})`);
      gradient.addColorStop(1, `rgba(235,255,250,${alpha})`);
      handContext.strokeStyle = gradient;
      handContext.lineWidth = hot ? (to % 4 === 0 ? 1.2 : 2.1) : (to % 4 === 0 ? .8 : 1.3);
      handContext.beginPath(); handContext.moveTo(start.x,start.y); handContext.lineTo(end.x,end.y); handContext.stroke();
    });
    const trails = state.handTrails[handIndex] ||= [4,8,12,16,20].map(() => []);
    [4,8,12,16,20].forEach((index, tipIndex) => {
      const trail = trails[tipIndex];
      const point = points[index];
      if (!trail.length || Math.hypot(trail.at(-1).x - point.x, trail.at(-1).y - point.y) > 2) trail.push({ x: point.x, y: point.y });
      if (trail.length > 12) trail.shift();
      for (let segment = 1; segment < trail.length; segment += 1) {
        const alpha = (segment / trail.length) * (state.skeletonMode === "plin" ? .3 : .18);
        handContext.strokeStyle = `rgba(${color.join(",")},${alpha})`;
        handContext.lineWidth = segment / trail.length * 2.2;
        handContext.beginPath(); handContext.moveTo(trail[segment-1].x,trail[segment-1].y); handContext.lineTo(trail[segment].x,trail[segment].y); handContext.stroke();
      }
      handContext.strokeStyle = `rgba(${color.join(",")},${index === 8 && state.gesture === "point" ? .9 : .5})`;
      handContext.lineWidth = 1.2;
      handContext.beginPath(); handContext.arc(point.x,point.y,6 + Math.sin(now * .007 + tipIndex) * .7,0,Math.PI*2); handContext.stroke();
    });
    points.forEach((point, index) => {
      if ([4,8,12,16,20].includes(index)) return;
      handContext.fillStyle = `rgba(${color.join(",")},${baseOpacity * .8})`;
      handContext.beginPath(); handContext.arc(point.x, point.y, 1.5, 0, Math.PI * 2); handContext.fill();
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
  });
}

function stopVideoFrames() {
  if (state.videoFrameCallbackId !== null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(state.videoFrameCallbackId);
  state.videoFrameCallbackId = null;
  state.videoFrameReady = false;
}

function startVideoFrames() {
  stopVideoFrames();
  if (!video.requestVideoFrameCallback) return;
  const onFrame = () => {
    state.videoFrameReady = true;
    state.videoFrameCallbackId = video.requestVideoFrameCallback(onFrame);
  };
  state.videoFrameCallbackId = video.requestVideoFrameCallback(onFrame);
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

let prefetchedLandmarker = createLandmarker().catch(() => null);

function bootStep(message) {
  const line = document.createElement("span");
  line.textContent = message;
  $("#boot-steps").append(line);
}

function finishTutorial() {
  state.tutorialStep = -1;
  $("#tutorial").hidden = true;
  try { localStorage.setItem("hololab-tutorial-done", "1"); } catch { /* Private browsing can deny storage. */ }
}

const tutorialSteps = [
  ["point", "Arată cu degetul", "Ghidează fluxul de particule."],
  ["open", "Deschide palma", "Ține holograma deasupra palmei."],
  ["pinch", "Unește două degete", "Eliberează pentru un impuls."],
];

function showTutorialStep() {
  const [, title, detail] = tutorialSteps[state.tutorialStep];
  $("#tutorial-step").textContent = `${state.tutorialStep + 1} / 3`;
  $("#tutorial-title").textContent = title;
  $("#tutorial-detail").textContent = detail;
  $("#tutorial").hidden = false;
}

function advanceTutorial(gesture) {
  if (state.tutorialStep < 0) return;
  if (tutorialSteps[state.tutorialStep]?.[0] !== gesture) return;
  state.tutorialStep += 1;
  if (state.tutorialStep >= tutorialSteps.length) { finishTutorial(); return; }
  showTutorialStep();
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
  setGesture("materialize");
  state.hands = [];
  resetHandFilters();
  releasePinch();
  drawHands([]);
  stopVideoFrames();
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
    startVideoFrames();
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
      startVideoFrames();
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
  initAudio();
  state.lastInteraction = performance.now();
  loading.hidden = false;
  launch.hidden = true;
  $("#boot-steps").replaceChildren();
  lab.classList.add("is-booting");
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
      startVideoFrames();
      const actualFacing = stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      setFacing(actualFacing === "environment" ? "environment" : "user");
      lab.classList.add("has-camera");
      bootStep("CAMERA ··· OK");
      loadingDetail.textContent = "Calibrez cele 21 de puncte pentru fiecare mână...";
      const landmarker = await prefetchedLandmarker || await createLandmarker();
      prefetchedLandmarker = null;
      if (session !== state.sessionId) {
        landmarker.close();
        return;
      }
      state.landmarker = landmarker;
      bootStep("HAND MODEL 21PT ··· OK");
    }
    bootStep("SPECIMEN 01 ··· SYNC");
    await new Promise((resolve) => setTimeout(resolve, state.reducedMotion ? 0 : 180));
    if (session !== state.sessionId) return;
    state.active = true;
    state.lastInteraction = performance.now();
    state.reveal = 0;
    state.modelTarget.set(0, 0, 0);
    state.springVelocity.modelX = 0;
    state.springVelocity.modelY = 0;
    state.transition = null;
    cameraButton.hidden = state.demo;
    interfaceLayer.hidden = false;
    loading.hidden = true;
    lab.classList.remove("is-booting");
    updateTrackingUi(0);
    setGesture(state.demo ? "demo" : "auto");
    if (withCamera) {
      let seen = false;
      try { seen = localStorage.getItem("hololab-tutorial-done") === "1"; } catch { /* Storage is optional. */ }
      if (!seen) { state.tutorialStep = 0; showTutorialStep(); }
    }
  } catch (error) {
    if (session !== state.sessionId) return;
    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = null;
    video.srcObject = null;
    lab.classList.remove("has-camera");
    state.demo = true;
    state.active = true;
    state.lastInteraction = performance.now();
    state.modelTarget.set(0, 0, 0);
    cameraButton.hidden = true;
    interfaceLayer.hidden = false;
    loading.hidden = true;
    lab.classList.remove("is-booting");
    updateTrackingUi(0);
    setGesture("demo");
    showToast(error?.name === "NotAllowedError" ? "Camera este blocată. Am pornit automat modul tactil." : "Detecția mâinilor nu a pornit. Poți testa scena prin touch.");
  }
}

function stopLab() {
  state.sessionId += 1;
  state.active = false;
  endAttract();
  $("#tutorial").hidden = true;
  state.tutorialStep = -1;
  lab.classList.remove("is-booting");
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
  state.landmarker?.close?.();
  state.landmarker = null;
  resetHandFilters();
  stopVideoFrames();
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
  audio.gain?.gain.setTargetAtTime(0, audio.context.currentTime, .06);
  lab.classList.remove("ui-hidden");
  $("#show-ui").hidden = true;
  $("#tools-panel").hidden = true;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 4200);
}

function detectHands(now) {
  if (!state.active || state.demo || !state.landmarker || video.readyState < 2) return;
  if (now - state.lastDetection < 30) return;
  if (video.requestVideoFrameCallback ? !state.videoFrameReady : video.currentTime === state.lastVideoTime) return;
  state.videoFrameReady = false;
  state.lastVideoTime = video.currentTime;
  state.lastDetection = now;
  try {
    const result = state.landmarker.detectForVideo(video, now);
    const landmarks = result.landmarks || [];
    if (landmarks.length) {
      state.lastHandSeen = now;
      state.filteredHands = filterHands(landmarks, now);
      state.hands = state.filteredHands;
      state.trackingConfidence = result.handedness?.[0]?.[0]?.score || .8;
      state.lastInteraction = now;
      if (state.attractStarted) endAttract();
      readGestures(state.hands);
      updateTrackingUi(state.hands.length);
    } else if (now - state.lastHandSeen > 250) {
      resetHandFilters();
      readGestures([]);
      updateTrackingUi(0);
    }
  } catch {
    // Keep rendering if one video frame is not ready for MediaPipe.
  }
}

function updatePointer(now) {
  if (!state.active || state.gesture !== "point" || !state.filteredHands.length || state.transition) {
    if (state.hoveredPart) {
      state.hoveredPart.scale.setScalar(1);
      state.hoveredPart = null;
      state.hoverLostAt = now;
    }
    if (now - state.hoverLostAt > 1200) { partLabel.hidden = true; state.focusPart = null; }
    return;
  }
  const pixel = mapLandmark(state.filteredHands[0][8]);
  const pointer = new THREE.Vector2(pixel.x / innerWidth * 2 - 1, 1 - pixel.y / innerHeight * 2);
  renderCamera.updateMatrixWorld();
  activeModel.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, renderCamera);
  let object = raycaster.intersectObjects(partMeshes, false)[0]?.object;
  if (!object) {
    let nearest = 34;
    const projected = new THREE.Vector3();
    for (const candidate of partMeshes) {
      candidate.getWorldPosition(projected).project(renderCamera);
      const distancePixels = Math.hypot((projected.x - pointer.x) * innerWidth * .5, (projected.y - pointer.y) * innerHeight * .5);
      if (distancePixels < nearest) { nearest = distancePixels; object = candidate; }
    }
  }
  if (object !== state.hoveredPart) {
    state.hoveredPart?.scale.setScalar(1);
    state.hoveredPart = object || null;
    state.hoverStarted = now;
    if (object) playTone(780, .07, .012);
    else state.hoverLostAt = now;
  }
  if (!object) {
    if (now - state.hoverLostAt > 1200) { partLabel.hidden = true; state.focusPart = null; }
    return;
  }
  object.scale.setScalar(1.25);
  if (now - state.hoverStarted >= 800) state.focusPart = object;
  const label = object.userData.partLabel;
  partLabel.querySelector("span").textContent = label.slice(0, Math.ceil((now - state.hoverStarted) / 20));
  partLabel.style.setProperty("--label-x", `${Math.min(pixel.x, innerWidth - 235)}px`);
  partLabel.style.setProperty("--label-y", `${THREE.MathUtils.clamp(pixel.y, 110, innerHeight - 110)}px`);
  partLabel.hidden = false;
}

function animate(now) {
  state.animationFrameId = null;
  if (document.hidden) return;
  state.animationFrameId = requestAnimationFrame(animate);
  const time = now * .001;
  const frameMs = now - (state.lastFrame || now);
  const delta = Math.min(frameMs * .001, .05);
  const springDt = Math.min(delta, .033);
  state.lastFrame = now;
  const follow = 1 - Math.exp(-8 * delta);
  detectHands(now);
  updateQuality(now, frameMs);
  updateAttract(now);
  updateSuggestion(now);
  drawHands(state.filteredHands.length ? predictHands(now) : []);
  if (!state.active || (!state.hands.length && !state.demo)) {
    state.rotYTarget += delta * .18;
  }
  if (!state.active) state.modelTarget.set(innerWidth < 700 ? .4 : 1.5, innerWidth < 700 ? 1.4 : .35, 0);
  const touchCharge = state.pointer ? Math.max(0, (now - state.pointer.time - 190) * .0009) : 0;
  const handCharge = state.pinching ? Math.max(0, (now - state.pinchStarted) * .0009) : 0;
  if (state.pinching || state.pointer) state.charge = Math.min(1, Math.max(touchCharge, handCharge));
  else state.charge = Math.max(0, state.charge - delta * 2.6);
  energyMeter.hidden = state.charge < .02;
  energyMeter.style.setProperty("--energy", `${Math.round(state.charge * 100)}%`);
  energyValue.textContent = `${Math.round(state.charge * 100)}%`;
  if (audio.context && audio.gain) {
    audio.hum.frequency.setTargetAtTime(55 + state.charge * 45, audio.context.currentTime, .08);
    audio.gain.gain.setTargetAtTime(state.soundOn && state.active ? .005 + state.charge * .012 : 0, audio.context.currentTime, .1);
  }

  state.explode = spring(state.explode, state.explodeTarget, "explode", springDt, 260, 14);
  state.scale = spring(state.scale, state.scaleTarget, "scale", springDt, 220, 16);
  state.rotX = spring(state.rotX, state.rotXTarget, "rotX", springDt, 170, 22);
  state.rotY = spring(state.rotY, state.rotYTarget, "rotY", springDt, 170, 22);
  state.rotZ = spring(state.rotZ, state.rotZTarget, "rotZ", springDt, 170, 22);
  state.modelPosition.x = spring(state.modelPosition.x, state.modelTarget.x, "modelX", springDt, 120, 18);
  state.modelPosition.y = spring(state.modelPosition.y, state.modelTarget.y, "modelY", springDt, 120, 18);
  state.modelPosition.z = spring(state.modelPosition.z, state.modelTarget.z, "modelZ", springDt, 120, 18);
  state.fingertip.lerp(state.fingertipTarget, follow * 1.7);
  if (fingertipMarker.visible) {
    fingertipMarker.position.copy(state.fingertip);
    fingertipMarker.rotation.z = time * 1.1;
    fingertipMarker.scale.setScalar(1 + Math.sin(time * 5.2) * .12);
  }
  state.attractorA.lerp(state.attractorATarget, follow * 1.45);
  state.attractorB.lerp(state.attractorBTarget, follow * 1.45);

  let modelOpacity = 1;
  let modelReveal = 1;
  let transitionEnergy = 0;
  if (state.transition) {
    const progress = Math.min((now - state.transition.started) / (state.reducedMotion ? 200 : 1250), 1);
    transitionEnergy = Math.sin(Math.PI * progress);
    if (progress >= .32 && !state.transition.swapped) {
      labRoot.remove(activeModel);
      releaseModel(activeModel);
      activeModel = modelFactories[state.transition.key]();
      activeModelKey = state.transition.key;
      labRoot.add(activeModel);
      collectParts(activeModel);
      sampleModelTargets(activeModel);
      state.transition.swapped = true;
    }
    if (state.transition.swapped) {
      const phase = THREE.MathUtils.clamp((progress - .32) / .56, 0, 1);
      state.morph = 1 - 2 ** (-10 * phase);
      modelOpacity = THREE.MathUtils.smoothstep(phase, .72, 1);
      modelReveal = THREE.MathUtils.smoothstep(phase, .55, 1);
    } else {
      state.morph = 1 - THREE.MathUtils.smoothstep(progress, 0, .32);
      modelOpacity = 1 - THREE.MathUtils.smoothstep(progress, .08, .32);
    }
    state.lastMorphMinimum = Math.min(state.lastMorphMinimum, state.morph);
    if (progress >= 1) {
      state.transition = null;
      state.reveal = 1;
      state.morph = 1;
      if (state.demo) setGesture("demo");
    }
  } else {
    state.reveal = Math.min(1, state.reveal + delta * 1.05);
    state.morph = 1 - 2 ** (-10 * state.reveal);
    if (state.gesture === "open") state.morph = Math.min(state.morph, .7);
    if (state.fistActive) state.morph = 0;
    modelOpacity = THREE.MathUtils.smoothstep(state.reveal, .5, 1);
    modelReveal = state.reveal;
  }
  const mobileFit = THREE.MathUtils.clamp((innerWidth / innerHeight) / .75, .82, 1);
  activeModel.scale.setScalar(state.scale * mobileFit * MODEL_INFO[activeModelKey].visualScale);
  activeModel.position.copy(state.modelPosition);
  activeModel.rotation.x = state.rotX + Math.sin(time * .38) * .04;
  activeModel.rotation.y = state.rotY + time * (state.gesture === "pinch" ? .025 : .09);
  activeModel.rotation.z = state.rotZ;
  activeModel.userData.update?.(time, state.explode, state.charge);
  updatePointer(now);
  activeModel.updateMatrix();
  holoUniforms.uTime.value = time;
  holoUniforms.uOpacity.value = modelOpacity;
  holoUniforms.uReveal.value = modelReveal;
  holoUniforms.uTransition.value = transitionEnergy;
  holoUniforms.uModelCenterY.value = activeModel.position.y;
  activeModel.traverse((object) => {
    if (!(object.isLine || object.material?.wireframe)) return;
    if (object.userData.baseOpacity === undefined) object.userData.baseOpacity = object.material.opacity;
    object.material.opacity = object.userData.baseOpacity * modelOpacity;
  });
  const pulseAge = (now - state.pulseStart) * .001;
  const pulse = pulseAge > 0 && pulseAge < 2 ? state.pulsePower * Math.exp(-pulseAge * 3.3) : 0;
  pulseRing.visible = pulseAge >= 0 && pulseAge < .85;
  if (pulseRing.visible) {
    pulseRing.position.copy(state.pulseOrigin);
    pulseRing.scale.setScalar(.14 + pulseAge * 3.6);
    pulseRing.material.opacity = (1 - pulseAge / .85) * .72;
  }
  palmCone.visible = state.active && state.anchor === "palm";
  if (palmCone.visible) {
    const height = Math.max(.3, state.modelPosition.y - state.palmTarget.y);
    palmCone.position.set(state.modelPosition.x, state.palmTarget.y + height * .5, state.modelPosition.z - .18);
    palmCone.scale.set(1, height / 1.6, 1);
    palmCone.material.opacity = .08 + state.explode * .07;
  }
  chargeOrb.visible = state.charge > .03 && state.pinching;
  chargeArc.visible = chargeOrb.visible;
  if (chargeOrb.visible) {
    chargeOrb.position.copy(state.pinchTarget);
    chargeOrb.scale.setScalar(.28 + state.charge * .54);
    chargeOrb.material.opacity = .3 + state.charge * .34;
    const positions = chargeArcGeometry.attributes.position;
    for (let index = 0; index < 12; index += 1) {
      const portion = index / 11;
      const point = state.thumbTarget.clone().lerp(state.fingertipTarget, portion);
      const jitter = Math.sin(time * 27 + index * 8.1) * (.015 + state.charge * .055);
      positions.setXYZ(index, point.x + jitter, point.y - jitter * .7, point.z);
    }
    positions.needsUpdate = true;
  }
  const shake = state.reducedMotion || pulseAge > .12 ? 0 : pulse * .04;
  state.shake = shake;
  renderCamera.position.x = Math.sin(time * 127) * shake;
  renderCamera.position.y = Math.cos(time * 109) * shake;
  const baseDistance = innerWidth < 700 ? 7 : 8.4;
  renderCamera.position.z = spring(renderCamera.position.z, state.focusPart ? baseDistance - .8 : baseDistance, "cameraZ", springDt, 90, 18);
  aura.material.opacity = .12 + state.explode * .1 + state.charge * .13 + pulse * .2 + Math.sin(time * 1.8) * .018;
  aura.scale.setScalar(3.9 + state.explode * 1.1 + state.charge * .35 + pulse * 1.2 + Math.sin(time * 1.2) * .08);
  keyLight.intensity = 22 + state.charge * 11 + pulse * 17;
  warmLight.intensity = 14 + transitionEnergy * 13 + pulse * 8;
  particles.rotation.y = 0;
  particleMaterial.uniforms.uTime.value = time;
  particleMaterial.uniforms.uExplode.value = state.explode;
  particleMaterial.uniforms.uCharge.value = state.charge;
  particleMaterial.uniforms.uPulse.value = pulse;
  particleMaterial.uniforms.uTransition.value = transitionEnergy;
  particleMaterial.uniforms.uMorph.value = state.morph;
  particleMaterial.uniforms.uModelMatrix.value.copy(activeModel.matrix);
  particleMaterial.uniforms.uActive.value += (((state.hands.length || state.demo) ? .94 : .55) - particleMaterial.uniforms.uActive.value) * follow;
  finalPass.uniforms.uTime.value = time;
  finalPass.uniforms.uPulse.value = state.reducedMotion ? 0 : pulse;
  finalPass.uniforms.uPulseAge.value = Math.max(0, pulseAge);
  const pulseScreen = state.pulseOrigin.clone().project(renderCamera);
  finalPass.uniforms.uPulseCenter.value.set((pulseScreen.x + 1) * .5, (pulseScreen.y + 1) * .5);
  finalPass.uniforms.uReduced.value = state.reducedMotion ? 1 : 0;
  renderScene();
}

function renderScene() {
  if (state.quality.bloom) composer.render();
  else {
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(scene, renderCamera);
  }
}

function endAttract() {
  state.attractStarted = 0;
  state.attractPhase = -1;
  state.explodeTarget = 0;
  state.modelTarget.set(0, 0, 0);
  $("#attract-hint").hidden = true;
}

function updateAttract(now) {
  if (!state.active || state.transition || state.hands.length || state.pointer || state.tutorialStep >= 0) return;
  if (!state.attractStarted && now - state.lastInteraction >= 8000) {
    state.attractStarted = now;
    state.attractPhase = -1;
    $("#attract-hint").hidden = false;
  }
  if (!state.attractStarted) return;
  const phase = Math.floor(((now - state.attractStarted) % 20000) / 5000);
  state.rotYTarget += .006;
  if (phase === state.attractPhase) return;
  state.attractPhase = phase;
  if (phase === 0) state.explodeTarget = 0;
  if (phase === 1) state.explodeTarget = 1;
  if (phase === 2) { triggerPulse(1.25); state.explodeTarget = 0; }
  if (phase === 3) {
    const keys = Object.keys(MODEL_INFO);
    switchModel(keys[(keys.indexOf(state.modelKey) + 1) % keys.length], false);
  }
}

function updateSuggestion(now) {
  if (!state.active || now - state.lastSuggestionAt < 5000) return;
  state.lastSuggestionAt = now;
  const suggestions = [
    ["point", "Încearcă: arată cu degetul spre model"],
    ["open", "Încearcă: deschide palma sub hologramă"],
    ["pinch", "Încearcă: unește degetele, apoi eliberează"],
  ].filter(([gesture]) => (state.gestureCounts[gesture] || 0) < 2);
  const chip = $("#gesture-suggestion");
  chip.hidden = !suggestions.length || state.demo;
  if (suggestions.length) chip.textContent = suggestions[state.suggestionIndex++ % suggestions.length][1];
}

function resize() {
  const ratio = Math.min(devicePixelRatio, state.quality.level === "low" ? 1.5 : 2);
  renderer.setPixelRatio(ratio);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(ratio);
  composer.setSize(innerWidth, innerHeight);
  bloomPass.setSize(Math.max(1, innerWidth / (state.quality.level === "low" ? 3 : 2)), Math.max(1, innerHeight / (state.quality.level === "low" ? 3 : 2)));
  renderCamera.aspect = innerWidth / innerHeight;
  renderCamera.position.z = innerWidth < 700 ? 7 : 8.4;
  renderCamera.updateProjectionMatrix();
  handCanvas.width = innerWidth * devicePixelRatio;
  handCanvas.height = innerHeight * devicePixelRatio;
  handCanvas.style.width = `${innerWidth}px`;
  handCanvas.style.height = `${innerHeight}px`;
  handContext.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  particleMaterial.uniforms.uPixelRatio.value = ratio;
}

function updateQuality(now, frameMs) {
  if (!state.active || frameMs <= 0) return;
  const quality = state.quality;
  quality.frames.push(frameMs);
  if (quality.frames.length < 60) return;
  quality.averageFrameMs = quality.frames.reduce((sum, value) => sum + value, 0) / quality.frames.length;
  quality.frames.length = 0;
  if (quality.averageFrameMs > 20 && quality.level === "high") {
    quality.level = "low";
    particleGeometry.setDrawRange(0, Math.floor(particleCount / 2));
    resize();
  }
  if (quality.averageFrameMs > 33.3) quality.slowWindows += 1;
  else quality.slowWindows = 0;
  if (quality.slowWindows >= 3 && quality.bloom) {
    quality.bloom = false;
    showToast("Efectele au fost reduse pentru o imagine mai fluidă.");
  }
  if (quality.averageFrameMs < 13 && quality.level === "low") {
    quality.fastSince ||= now;
    if (now - quality.fastSince >= 3000) {
      quality.level = "high";
      particleGeometry.setDrawRange(0, particleCount);
      resize();
      quality.fastSince = 0;
    }
  } else quality.fastSince = 0;
  if (quality.averageFrameMs < 13 && !quality.bloom && quality.level === "high") {
    quality.fastSince ||= now;
    if (now - quality.fastSince >= 3000) {
      quality.bloom = true;
      quality.slowWindows = 0;
      quality.fastSince = 0;
    }
  }
}

lab.addEventListener("pointerdown", (event) => {
  if (!state.active || event.target.closest("button")) return;
  state.lastInteraction = performance.now();
  endAttract();
  state.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, rotX: state.rotXTarget, rotY: state.rotYTarget, time: performance.now() };
  if (state.demo) {
    state.attractorATarget.set((event.clientX / innerWidth - .5) * 5.2, -(event.clientY / innerHeight - .5) * 5.8, 0);
    state.attractorBTarget.set(0, 0, 0);
  }
});
lab.addEventListener("pointermove", (event) => {
  if (!state.pointer || event.pointerId !== state.pointer.id) return;
  state.lastInteraction = performance.now();
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
  state.lastInteraction = performance.now();
  endAttract();
  state.scaleTarget = THREE.MathUtils.clamp(state.scaleTarget - event.deltaY * .001, .65, 1.65);
}, { passive: true });

async function captureScene() {
  const width = renderer.domElement.width;
  const height = renderer.domElement.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#050708";
  context.fillRect(0, 0, width, height);
  if (video.readyState >= 2 && !state.demo) {
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    const drawnWidth = video.videoWidth * scale;
    const drawnHeight = video.videoHeight * scale;
    context.save();
    if (state.cameraFacing === "user") { context.translate(width, 0); context.scale(-1, 1); }
    context.filter = "saturate(.55) brightness(.62) contrast(1.12)";
    context.drawImage(video, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
    context.restore();
  }
  renderScene();
  const pixels = new Uint8Array(width * height * 4);
  renderer.getContext().readPixels(0, 0, width, height, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, pixels);
  const frame = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) frame.data.set(pixels.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4);
  const hologram = document.createElement("canvas");
  hologram.width = width;
  hologram.height = height;
  hologram.getContext("2d").putImageData(frame, 0, 0);
  context.drawImage(hologram, 0, 0);
  context.drawImage(handCanvas, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Captura nu a putut fi creată.");
  const file = new File([blob], "hololab.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "HoloLab" });
  else {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
}

$("#start-camera").addEventListener("click", () => startLab(true));
$("#start-demo").addEventListener("click", () => startLab(false));
$("#close-lab").addEventListener("click", stopLab);
cameraButton.addEventListener("click", switchCamera);
$("#sound-toggle").addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  if (state.soundOn) initAudio();
  const button = $("#sound-toggle");
  button.setAttribute("aria-label", state.soundOn ? "Oprește sunetul" : "Pornește sunetul");
  button.title = button.getAttribute("aria-label");
  const oldIcon = button.querySelector("svg, [data-lucide]");
  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", state.soundOn ? "volume-2" : "volume-x");
  oldIcon?.replaceWith(icon);
  window.lucide?.createIcons();
});
$("#tools-toggle").addEventListener("click", () => {
  const panel = $("#tools-panel");
  panel.hidden = !panel.hidden;
  $("#tools-toggle").setAttribute("aria-expanded", String(!panel.hidden));
});
skeletonButton.addEventListener("click", () => {
  const modes = ["discret", "plin", "ascuns"];
  state.skeletonMode = modes[(modes.indexOf(state.skeletonMode) + 1) % modes.length];
  skeletonButton.querySelector("strong").textContent = state.skeletonMode[0].toUpperCase() + state.skeletonMode.slice(1);
});
$("#ui-toggle").addEventListener("click", () => {
  state.uiHidden = true;
  lab.classList.add("ui-hidden");
  $("#show-ui").hidden = false;
});
$("#show-ui").addEventListener("click", () => {
  state.uiHidden = false;
  lab.classList.remove("ui-hidden");
  $("#show-ui").hidden = true;
  $("#tools-panel").hidden = true;
});
$("#capture-scene").addEventListener("click", () => captureScene().catch((error) => {
  if (error.name !== "AbortError") showToast(error.message || "Captura nu a reușit.");
}));
$("#tutorial-skip").addEventListener("click", finishTutorial);
document.querySelectorAll("[data-model]").forEach((button) => button.addEventListener("click", () => switchModel(button.dataset.model)));
window.addEventListener("resize", resize);
window.addEventListener("pagehide", stopLab);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (state.animationFrameId !== null) cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
    stopVideoFrames();
  } else {
    state.lastFrame = 0;
    if (state.stream) startVideoFrames();
    if (state.animationFrameId === null) state.animationFrameId = requestAnimationFrame(animate);
  }
});
reducedMotion.addEventListener("change", (event) => { state.reducedMotion = event.matches; });

resize();
renderThumbnails();
state.animationFrameId = requestAnimationFrame(animate);
window.addEventListener("load", () => {
  if (window.lucide) {
    window.lucide.createIcons();
    document.documentElement.classList.add("icons-ready");
  }
});
window.__HOLOLAB__ = { state, switchModel, renderer, quality: state.quality, get model() { return activeModel; }, get scene() { return scene; }, get camera() { return renderCamera; }, injectHands: (hands) => {
  const now = performance.now();
  state.lastDetection = now;
  state.lastHandSeen = now;
  state.filteredHands = filterHands(hands, now);
  state.hands = state.filteredHands;
  if (hands.length) { state.lastInteraction = now; endAttract(); }
  readGestures(state.hands);
  updateTrackingUi(state.hands.length);
} };
