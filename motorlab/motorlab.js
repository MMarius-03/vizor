import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createRunningClip } from "./engine-motion.js?v=5";
import { createHandControl } from "./hand-control.js?v=5";
import { createSurfaceMaterial, createGhostMaterial } from "./engine-appearance.js?v=5";

const $ = (selector) => document.querySelector(selector);
const debugHud = $("#debug-hud");
const debugEnabled = new URLSearchParams(location.search).has("debug");
debugHud.hidden = !debugEnabled;
const ui = {
  viewport: $("#viewport"), stage: $(".stage"), loading: $("#loading"),
  loadingDetail: $("#loading-detail"), error: $("#error-panel"),
  count: $("#parts-count"), label: $("#part-label"),
  card: $("#selected-card"), partName: $("#part-name"), partState: $("#part-state"),
  mount: $("#mount-part"), assemble: $("#assemble-all"),
  power: $("#engine-toggle"), powerLabel: $("#engine-button-label"),
  throttle: $("#throttle"), rpm: $("#rpm-value"),
  interior: $("#interior-toggle"), orbit: $("#orbit-toggle"),
  gestureStatus: $("#gesture-status"), toast: $("#toast"),
  throttlePanel: $("#throttle-panel"), menu: $("#options-panel"), guide: $("#gesture-guide"),
};
const state = {
  ready: false, interior: true, orbit: false, running: false,
  rpm: 0, targetRpm: 800, motionTime: 0, lastFrame: 0, lastUi: 0,
  selected: null, hovered: null, grab: null, pointerAction: null,
  pointers: new Map(), tweens: new Map(),
  toastTimer: null, loading: false,
  handAction: null, handTarget: null, handNavigationLock: false,
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
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Camera rotation does not change world-space shadows. Reuse them until a
// component moves or changes visibility; animated engine frames still refresh.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
ui.viewport.append(renderer.domElement);
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.target.copy(viewTarget);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = .12;
orbitControls.rotateSpeed = .55;
orbitControls.zoomSpeed = .8;
orbitControls.enablePan = false;
orbitControls.minDistance = 3.5;
orbitControls.maxDistance = 45;
orbitControls.minPolarAngle = .15;
orbitControls.maxPolarAngle = Math.PI - .15;
orbitControls.touches.ONE = THREE.TOUCH.ROTATE;
orbitControls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
orbitControls.update();

const environmentRoom = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(environmentRoom, 0.04);
scene.environment = bench.environment = environment.texture;
scene.environmentIntensity = bench.environmentIntensity = .85;
environmentRoom.dispose();
pmrem.dispose();
for (const destination of [scene, bench]) {
  destination.add(new THREE.HemisphereLight(0xdbe5eb, 0x202b30, .8));
  const warm = new THREE.DirectionalLight(0xffedda, 3);
  warm.position.set(-3, 6, 5);
  if (destination === scene) {
    warm.castShadow = true;
    warm.shadow.mapSize.set(1024, 1024);
    Object.assign(warm.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .1, far: 20 });
    warm.shadow.bias = -.0003;
    warm.shadow.normalBias = .012;
  }
  destination.add(warm);
  const cool = new THREE.DirectionalLight(0xb9d8ec, 1.5);
  cool.position.set(-5, 2, -4);
  destination.add(cool);
}
const root = new THREE.Group();
scene.add(root);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const parts = [];
const partForMesh = new Map();
const selectionOutline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xf3ce53, depthTest: false, transparent: true, opacity: .85 }));
selectionOutline.matrixAutoUpdate = false;
selectionOutline.renderOrder = 100;
selectionOutline.visible = false;
bench.add(selectionOutline);
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
  const highlighted = part === state.hovered || part === state.grab?.part;
  part.mesh.material = ghost ? part.ghostMaterial : part.solidMaterial;
  part.solidMaterial.emissive.setHex(highlighted ? 0x8f721a : 0x000000);
  part.solidMaterial.emissiveIntensity = highlighted ? .13 : 0;
  if (part.mesh.castShadow !== !ghost) renderer.shadowMap.needsUpdate = true;
  part.mesh.castShadow = !ghost;
  part.mesh.renderOrder = ghost ? 0 : 1;
}
function refreshUi() {
  const detached = parts.filter((part) => part.detached);
  ui.count.textContent = detached.length === 1 ? "1 piesă scoasă" : `${detached.length} piese scoase`;
  ui.assemble.disabled = !detached.length || !state.ready;
  ui.power.disabled = !state.ready || !runningClip;
  ui.power.setAttribute("aria-pressed", String(state.running));
  ui.powerLabel.textContent = state.running ? "Oprește" : "Pornește";
  ui.power.setAttribute("aria-label", state.running ? "Oprește motorul" : "Pornește motorul");
  ui.throttlePanel.hidden = !state.running;
  ui.stage.classList.toggle("is-interacting", Boolean(state.grab || detached.length || state.running));
  ui.card.hidden = !state.selected?.detached || Boolean(state.grab);
  if (state.selected) {
    ui.partName.textContent = state.selected.label;
    ui.partState.textContent = "Pe banc · rămâne aici";
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
  if (radius) offsets.push([radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius * .7, radius * .7], [-radius * .7, radius * .7], [radius * .7, -radius * .7], [-radius * .7, -radius * .7]);
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
  if (part.detached || state.orbit || state.handNavigationLock) return;
  part.mesh.updateWorldMatrix(true, false);
  const exactWorldMatrix = part.mesh.matrixWorld.clone();
  // Keep the entire matrix: the GLB has negative and nonuniform parent scales.
  // Decomposing through Object3D.attach would distort some of the rods/covers.
  bench.add(part.mesh);
  part.mesh.matrixAutoUpdate = false;
  part.mesh.matrix.copy(exactWorldMatrix);
  part.mesh.matrixWorldNeedsUpdate = true;
  part.detached = true;
  renderer.shadowMap.needsUpdate = true;
  stylePart(part);
}
function beginGrab(x, y, radius = 10, hand = false, aimed = null) {
  if (state.orbit || state.handNavigationLock || state.grab || state.pointers.size > 1) return false;
  const hit = aimed || pick(x, y, radius);
  if (!hit || !state.ready || isGhost(hit.part) || state.tweens.has(hit.part.id)) return false;
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
  stylePart(hit.part);
  refreshUi();
  return true;
}
function moveGrab(x, y) {
  if (state.orbit || state.handNavigationLock) { endGrab(); return; }
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
  const part = state.grab.part;
  state.grab = null;
  stylePart(part);
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
  renderer.shadowMap.needsUpdate = true;
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
  orbit.theta -= dx * 0.004;
  orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.004, 0.15, Math.PI - 0.15);
  camera.position.copy(viewTarget).add(new THREE.Vector3().setFromSpherical(orbit));
  camera.lookAt(viewTarget);
  orbitControls.update();
}
function zoomView(factor) {
  const offset = camera.position.clone().sub(viewTarget);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, 2.5, 45));
  camera.position.copy(viewTarget).add(offset);
  orbitControls.update();
}
function fitView(includeBench = false, preserveDirection = false) {
  if (!parts.length) return;
  const visible = parts.filter((part) => (includeBench || !part.detached) && !isGhost(part));
  if (!visible.length) return;
  const box = boundsOf(visible);
  const direction = preserveDirection ? camera.position.clone().sub(viewTarget).normalize() : new THREE.Vector3(0.63, 0.32, 1).normalize();
  viewTarget.copy(box.getCenter(new THREE.Vector3()));
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const landscape = ui.viewport.clientHeight <= 540 && camera.aspect > 1;
  const desktop = ui.viewport.clientWidth > 700 && !landscape;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect * (landscape ? .54 : desktop ? .7 : 1);
  let distance = 0;
  // Fit each component's transformed bounds, not the large empty corners of a
  // single world-aligned engine box. This gives fingers a larger target.
  for (const part of visible) {
    const local = part.mesh.geometry.boundingBox;
    for (const x of [local.min.x, local.max.x]) for (const y of [local.min.y, local.max.y]) for (const z of [local.min.z, local.max.z]) {
      const corner = new THREE.Vector3(x, y, z).applyMatrix4(part.mesh.matrixWorld).sub(viewTarget);
      distance = Math.max(distance,
        Math.abs(corner.dot(right)) / tanH + corner.dot(direction),
        Math.abs(corner.dot(up)) / (tanV * (landscape ? .72 : desktop ? .57 : .8)) + corner.dot(direction));
    }
  }
  const portraitPhone = ui.viewport.clientWidth <= 700 && !landscape;
  camera.position.copy(viewTarget).addScaledVector(direction, Math.max(4, distance * (portraitPhone ? 1.25 : landscape ? 1.22 : 1.14)));
  camera.lookAt(viewTarget);
  orbitControls.target.copy(viewTarget);
  orbitControls.update();
}
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!state.ready) return;
  hands.setTouchActive(true);
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.pointers.size > 1) {
    endGrab();
    state.pointerAction = null;
    // A second finger during a part drag cancels the drag. Start the next
    // two-finger gesture on clear background so OrbitControls owns both touches.
    if (!orbitControls.enabled) {
      orbitControls.enabled = false;
      ui.gestureStatus.textContent = "Piesa lăsată · ridică degetele pentru zoom.";
    }
    return;
  }
  const grabbing = event.button === 0 && !state.orbit && beginGrab(event.clientX, event.clientY, event.pointerType === "touch" ? 13 : 3);
  orbitControls.enabled = !grabbing;
  state.pointerAction = grabbing ? { id: event.pointerId, kind: "grab" } : null;
  if (grabbing) {
    event.preventDefault();
    renderer.domElement.setPointerCapture(event.pointerId);
    ui.gestureStatus.textContent = `Ții ${state.grab.part.label} · glisează și apoi ridică degetul.`;
  } else if (state.orbit) ui.gestureStatus.textContent = "Rotire · piesele sunt blocate.";
}, true);
renderer.domElement.addEventListener("pointermove", (event) => {
  if (!state.pointers.has(event.pointerId)) {
    if (event.pointerType === "mouse" && !state.orbit && !state.grab) hoverPart(pick(event.clientX, event.clientY)?.part || null);
    return;
  }
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const action = state.pointerAction;
  if (!action || action.id !== event.pointerId) return;
  event.preventDefault();
  moveGrab(event.clientX, event.clientY);
});
function releasePointer(event) {
  state.pointers.delete(event.pointerId);
  if (state.pointerAction?.id === event.pointerId) {
    const moved = state.grab?.moved;
    endGrab(); state.pointerAction = null;
    ui.gestureStatus.textContent = moved ? "Piesa rămâne aici. Apasă Montează ca s-o pui la loc." : "Atinge și trage o piesă pentru a o scoate.";
  }
  if (!state.pointers.size) { orbitControls.enabled = true; hands.setTouchActive(false); }
}
renderer.domElement.addEventListener("pointerup", releasePointer);
renderer.domElement.addEventListener("pointercancel", releasePointer);
renderer.domElement.addEventListener("lostpointercapture", releasePointer);
renderer.domElement.addEventListener("pointerleave", () => { if (!state.grab) hoverPart(null); });
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

function disposeModel() {
  endGrab();
  mixer?.stopAllAction();
  state.selected = state.hovered = null;
  selectionOutline.visible = false;
  ui.label.hidden = true;
  state.tweens.clear();
  const textures = new Set();
  for (const part of parts) {
    if (part.detached) part.mesh.removeFromParent();
    part.mesh.geometry.dispose();
    for (const value of Object.values(part.solidMaterial)) if (value?.isTexture) textures.add(value);
    part.solidMaterial.dispose();
    part.ghostMaterial.dispose();
    part.edgeGeometry?.dispose();
  }
  textures.forEach(texture => texture.dispose());
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
        mesh.material = createSurfaceMaterial(source, definition.kind, renderer);
        mesh.receiveShadow = true;
        mesh.updateMatrix();
        const part = {
          id: parts.length, mesh, label, kind: definition.kind, detached: false,
          solidMaterial: mesh.material, ghostMaterial: createGhostMaterial(), edgeGeometry: null,
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
      // Keep the UV-matched maps now used by the metal/paint finishes.
      const oldTextures = new Set();
      const usedTextures = new Set();
      parts.forEach(part => Object.values(part.solidMaterial).forEach(value => { if (value?.isTexture) usedTextures.add(value); }));
      originalMaterials.forEach((material) => {
        for (const value of Object.values(material)) if (value?.isTexture) oldTextures.add(value);
        material.dispose();
      });
      oldTextures.forEach((texture) => { if (!usedTextures.has(texture)) texture.dispose(); });
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

function clearHandTarget() {
  state.handTarget?.element?.classList.remove("hand-targeted");
  state.handTarget = null;
}
function resolveHandTarget(point) {
  clearHandTarget();
  if (!point || state.pointers.size || !state.ready) { hoverPart(null); return null; }
  const { x, y } = point;
  const candidates = [...document.querySelectorAll("[data-hand]")].filter(element => !element.disabled && element.getClientRects().length);
  let target = null, best = Infinity;
  for (const element of candidates) {
    const rect = element.getBoundingClientRect();
    const dx = Math.max(rect.left - x, 0, x - rect.right), dy = Math.max(rect.top - y, 0, y - rect.bottom);
    if (dx > 16 || dy > 16) continue;
    const score = dx + dy + Math.hypot(x - (rect.left + rect.right) / 2, y - (rect.top + rect.bottom) / 2) * .01;
    if (score < best) { best = score; target = { id: element.id, kind: element.matches('input[type="range"]') ? "range" : "ui", element, label: element.dataset.hand }; }
  }
  if (target) {
    hoverPart(null);
    target.element.classList.add("hand-targeted");
    state.handTarget = target;
    return target;
  }
  // Panels capture the hand, so pointing at their text cannot grab the engine.
  if (!ui.menu.hidden || !ui.guide.hidden) { hoverPart(null); return null; }
  if (state.handNavigationLock) { hoverPart(null); return null; }
  if (state.orbit) { hoverPart(null); return { id: "view-orbit", kind: "orbit", label: "Rotire · piesele blocate" }; }
  const hit = pick(x, y, 22);
  hoverPart(hit?.part || null);
  target = hit ? { ...hit, id: `part-${hit.part.id}`, kind: "part", label: hit.part.label }
    : { id: "view-orbit", kind: "orbit", label: "Rotește motorul" };
  state.handTarget = target;
  return target;
}
function setHandRange(element, x) {
  const rect = element.getBoundingClientRect();
  const ratio = THREE.MathUtils.clamp((x - rect.left - 12) / Math.max(1, rect.width - 24), 0, 1);
  const min = Number(element.min), max = Number(element.max), step = Number(element.step) || 1;
  element.value = String(min + Math.round(ratio * (max - min) / step) * step);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
function releaseHandAction() {
  if (state.grab?.hand) endGrab();
  state.handAction = null;
  clearHandTarget();
  hoverPart(null);
}
const hands = createHandControl({
  video: $("#camera-feed"), stage: ui.stage, toggle: $("#camera-toggle"),
  switchButton: $("#camera-switch"), facingLabel: $("#camera-facing"),
  gestureToggle: $("#gesture-toggle"), fitButton: $("#camera-fit"), cameraDetails: $("#camera-details"),
  cursor: $("#hand-cursor"), secondCursor: $("#second-cursor"), status: ui.gestureStatus,
  trackingLabel: $("#tracking-label"), trackingStatus: $("#tracking-status"), toast,
  onHover: resolveHandTarget,
  onGrab: (x, y, target) => {
    if (state.pointers.size) return null;
    if (target.kind === "ui" || target.kind === "range") {
      if (target.element.disabled || !target.element.getClientRects().length) return null;
      state.handAction = target;
      if (target.kind === "range") setHandRange(target.element, x);
      // Avoid resetting the gesture session from inside its own close transition.
      else queueMicrotask(() => target.element.click());
    } else if (target.kind === "orbit" && !state.handNavigationLock) state.handAction = { kind: "orbit", x, y };
    else if (target.kind !== "part") return null;
    else if (beginGrab(x, y, 0, true, target)) state.handAction = { kind: "part" };
    else return null;
    return state.handAction;
  },
  onMove: (x, y) => {
    const action = state.handAction;
    if (action?.kind === "range") setHandRange(action.element, x);
    else if (action?.kind === "orbit") { rotateView((x - action.x) * .8, (y - action.y) * .8); action.x = x; action.y = y; }
    else if (state.grab?.hand) moveGrab(x, y);
  },
  onRelease: releaseHandAction,
  onNavigationLock: (locked) => {
    state.handNavigationLock = locked;
    if (locked) { endGrab(); hoverPart(null); }
  },
  onNavigate: (dx, dy, scale) => { releaseHandAction(); rotateView(dx * .8, dy * .8); zoomView(THREE.MathUtils.clamp(scale, .88, 1.12)); },
});

function updateSelection() {
  const part = state.grab?.part || state.hovered;
  if (!part || isGhost(part)) {
    selectionOutline.visible = false;
    ui.label.hidden = true;
    return;
  }
  part.mesh.updateWorldMatrix(true, false);
  part.edgeGeometry ||= new THREE.EdgesGeometry(part.mesh.geometry, 38);
  selectionOutline.geometry = part.edgeGeometry;
  selectionOutline.matrix.copy(part.mesh.matrixWorld);
  selectionOutline.matrixWorldNeedsUpdate = true;
  selectionOutline.visible = true;
  const center = part.mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(part.mesh.matrixWorld).project(camera);
  const width = ui.viewport.clientWidth, height = ui.viewport.clientHeight;
  const x = (center.x + 1) / 2 * width;
  const y = (1 - center.y) / 2 * height;
  ui.label.hidden = (hands.active && !state.pointers.size) || center.z < -1 || center.z > 1 || x < 0 || x > width || y < 0 || y > height;
  ui.label.textContent = part.label;
  ui.label.style.left = `${Math.max(8, Math.min(width - 150, x + 18))}px`;
  ui.label.style.top = `${Math.max(112, Math.min(height - 125, y - 24))}px`;
}
let previousWidth = 0;
let handQuality = false;
const quality = { frames: 0, elapsed: 0, changedAt: 0 };
const debugSample = { frames: 0, elapsed: 0 };
function updateRenderQuality(now, elapsed) {
  const ceiling = Math.min(devicePixelRatio || 1, hands.cameraActive ? 1.5 : 1.75);
  const current = renderer.getPixelRatio();
  if (hands.cameraActive !== handQuality || current > ceiling) {
    handQuality = hands.cameraActive;
    if (current > ceiling) renderer.setPixelRatio(ceiling);
    quality.frames = quality.elapsed = 0;
    quality.changedAt = now;
  }
  if (!state.ready || !quality.changedAt || elapsed > 250) {
    quality.frames = quality.elapsed = 0;
    quality.changedAt = now;
    return;
  }
  // Ignore loading/resize spikes, then adapt only once per observation window.
  // Texture assets stay intact; only the render buffer scales on slower phones.
  if (now - quality.changedAt < 2000 || elapsed <= 0) return;
  quality.frames += 1;
  quality.elapsed += elapsed;
  if (quality.elapsed < 1000) return;
  const average = quality.elapsed / quality.frames;
  let next = current;
  if (average > 20.5) next = Math.max(Math.min(1, ceiling), current - .15);
  else if (average < 17.8 && now - quality.changedAt > 8000) next = Math.min(ceiling, current + .1);
  if (Math.abs(next - current) > .01) { renderer.setPixelRatio(next); quality.changedAt = now; }
  quality.frames = quality.elapsed = 0;
}
function resize() {
  const width = Math.max(1, ui.viewport.clientWidth), height = Math.max(1, ui.viewport.clientHeight);
  camera.aspect = width / height;
  orbitControls.rotateSpeed = height <= 540 && width > height ? .38 : .55;
  camera.clearViewOffset();
  // On a landscape phone, leave the right side for the hand-operated dock.
  if (height <= 540 && width > height) camera.setViewOffset(width, height, width * .22, 0, width, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (state.ready && previousWidth && Math.abs(width - previousWidth) > 80) {
    hands.release(); endGrab(); fitView(true, true);
  }
  previousWidth = width;
}
new ResizeObserver(resize).observe(ui.viewport);

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { state.lastFrame = now; return; }
  const elapsed = now - (state.lastFrame || now);
  const dt = Math.min(0.05, elapsed / 1000);
  state.lastFrame = now;
  if (debugEnabled && elapsed > 0 && elapsed < 250) {
    debugSample.frames += 1; debugSample.elapsed += elapsed;
    if (debugSample.elapsed >= 1000) {
      debugHud.textContent = `${Math.round(debugSample.frames * 1000 / debugSample.elapsed)} FPS · DPR ${renderer.getPixelRatio().toFixed(2)} · ${ui.viewport.clientWidth}×${ui.viewport.clientHeight}\n${hands.debug}\nmod ${state.orbit ? "rotire" : "piese"} · ${state.grab ? state.grab.part.label : "liber"}`;
      debugSample.frames = debugSample.elapsed = 0;
    }
  }
  updateRenderQuality(now, elapsed);
  if (state.ready) {
    const requested = state.running ? state.targetRpm : 0;
    state.rpm += (requested - state.rpm) * (1 - Math.exp(-dt * 5));
    if (!state.running && state.rpm < 3) state.rpm = 0;
    if (state.rpm > 0 && mixer) {
      // Slowed down for inspection, proportional to the throttle setting.
      state.motionTime = (state.motionTime + dt * state.rpm / 1600) % runningClip.duration;
      mixer.setTime(state.motionTime);
      renderer.shadowMap.needsUpdate = true;
    }
    root.updateWorldMatrix(true, true);
    updateMounts(now);
    orbitControls.update();
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
  ui.interior.querySelector("small").textContent = state.interior ? "Activ" : "Inactiv";
  hoverPart(null);
  parts.forEach(stylePart);
  fitView(true, true);
  refreshUi();
});
ui.orbit.addEventListener("click", () => {
  hands.release();
  endGrab();
  state.pointerAction = null;
  state.orbit = !state.orbit;
  ui.orbit.setAttribute("aria-pressed", String(state.orbit));
  ui.orbit.setAttribute("aria-label", state.orbit ? "Revino la piese" : "Activează rotirea fără demontare");
  ui.orbit.dataset.hand = state.orbit ? "Revino la piese" : "Mod rotire";
  ui.orbit.querySelector("span").textContent = state.orbit ? "Piese" : "Rotire";
  $("#instruction").textContent = state.orbit ? "Rotire · piesele sunt blocate. Pinch sau trage pe ecran." : "Sau trage o piesă direct pe ecran.";
  ui.gestureStatus.textContent = state.orbit ? "Rotire activă · trage oriunde, piesele sunt blocate." : "Piese active · atinge și trage o componentă.";
  toast(state.orbit ? "Mod rotire: piesele sunt blocate. Apasă Piese ca să le poți muta." : "Mod piese: poți prinde și muta componentele.");
  hoverPart(null);
  setPanel(null);
});
ui.mount.addEventListener("click", () => mountPart(state.selected));
ui.assemble.addEventListener("click", () => {
  endGrab();
  parts.filter((part) => part.detached).forEach((part, index) => mountPart(part, Math.min(index * 65, 600)));
});
$("#clear-selection").addEventListener("click", () => selectPart(null));
$("#fit-view").addEventListener("click", () => { endGrab(); fitView(true); });
$("#retry-load").addEventListener("click", loadModel);
function setPanel(panel) {
  ui.menu.hidden = panel !== "menu";
  ui.guide.hidden = panel !== "guide";
  $("#menu-toggle").setAttribute("aria-expanded", String(panel === "menu"));
  $("#help-toggle").setAttribute("aria-expanded", String(panel === "guide"));
  clearHandTarget();
  hoverPart(null);
}
$("#menu-toggle").addEventListener("click", () => setPanel(ui.menu.hidden ? "menu" : null));
$("#menu-close").addEventListener("click", () => setPanel(null));
$("#help-toggle").addEventListener("click", () => setPanel("guide"));
$("#help-close").addEventListener("click", () => setPanel(null));
document.addEventListener("keydown", event => { if (event.key === "Escape") setPanel(null); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { endGrab(); hands.release(); state.pointers.clear(); state.pointerAction = null; orbitControls.enabled = true; hands.setTouchActive(false); stopMotor(true); }
});
resize();
loadModel();
requestAnimationFrame(frame);
