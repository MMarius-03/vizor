import { createRiftCore } from './artifact.js?v=2';

const $ = (id) => document.getElementById(id);
const phoneMode = document.documentElement.dataset.mode === 'phone';
const canvas = $('ar-canvas');
const viewport = document.querySelector('meta[name="viewport"]');
const normalViewport = viewport.content;
const debug = new URLSearchParams(location.search).has('debug');
const trackingMode = new URLSearchParams(location.search).get('tracking') === 'image' ? 'image' : 'hybrid';
const lossGraceMs = trackingMode === 'hybrid' ? 1100 : 350;

let xr = null;
let targetRoot = null;
let artifact = null;
let camera = null;
let three = null;
let targetName = '';
let found = false;
let foundCount = 0;
let updates = 0;
let lastEvent = '—';
let lastFrame = 0;
let lastDebug = 0;
let fps = 0;
let starting = false;
let hasPose = false;
let lossStartedAt = 0;
let lastSeenAt = 0;
let lostCount = 0;
let recoveredCount = 0;
let desiredPosition = null;
let desiredRotation = null;
let desiredScale = 1;
let anchorSized = false;
let activePointer = null;

function setStatus(label, state, instruction) {
  if ($('tracking-state').textContent !== label) $('tracking-state').textContent = label;
  if ($('tracking-state').dataset.state !== state) $('tracking-state').dataset.state = state;
  if (instruction && $('instruction').textContent !== instruction) $('instruction').textContent = instruction;
  $('live').dataset.found = String(state === 'found' || state === 'grace');
}

function renderCoreState() {
  if (!artifact) return;
  if (artifact.isComplete) {
    setStatus('CORE STABIL', 'found', 'Toate cele trei puncte sunt active. Mișcă telefonul lateral ca să explorezi obiectul.');
    $('target-count').textContent = 'NODURI 3 / 3';
  } else if (!artifact.isOpen) {
    setStatus('CORE ANCORAT', 'found', 'Atinge nucleul ca să deschizi carcasa.');
    $('target-count').textContent = 'CARCASĂ ÎNCHISĂ';
  } else if (!artifact.isArmed) {
    setStatus('CORE DESCHIS', 'found', 'Glisează orizontal peste nucleu ca să rotești mecanismul.');
    $('target-count').textContent = 'ROTEȘTE NUCLEUL';
  } else {
    setStatus('MECANISM ARMAT', 'found', 'Atinge cele trei puncte luminoase din jurul nucleului.');
    $('target-count').textContent = `NODURI ${artifact.progress} / 3`;
  }
}

function showError(message) {
  xr?.stop?.();
  viewport.content = normalViewport;
  $('error-message').textContent = message;
  $('error').hidden = false;
  $('live').hidden = true;
  starting = false;
}

function loadScript(src, globalName, eventName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const done = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener(eventName, ready);
      if (error) reject(error);
      else resolve(window[globalName]);
    };
    const ready = () => done();
    const timeout = setTimeout(() => done(new Error(`Motorul ${globalName} nu a răspuns.`)), 25000);
    window.addEventListener(eventName, ready);
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    if (globalName === 'XR8') script.dataset.preloadChunks = 'slam';
    script.onerror = () => done(new Error(`Nu am putut încărca ${globalName}. Verifică conexiunea.`));
    script.onload = () => { if (window[globalName]) done(); };
    document.head.append(script);
  });
}

async function waitForARModules(engine, extras) {
  const until = performance.now() + 10000;
  while (performance.now() < until) {
    if (engine?.Threejs && engine?.XrController && extras?.FullWindowCanvas) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

function makeProbe(scene) {
  targetRoot = new three.Group();
  targetRoot.visible = false;
  scene.add(targetRoot);
  desiredPosition = new three.Vector3();
  desiredRotation = new three.Quaternion();

  artifact = createRiftCore(three);
  targetRoot.add(artifact.root);
  scene.add(new three.HemisphereLight(0xe5efd4, 0x161d18, 2.2));
  const key = new three.DirectionalLight(0xffffff, 2.4);
  key.position.set(1, 2, 3);
  scene.add(key);
  const rim = new three.DirectionalLight(0xd5ef44, 1.1);
  rim.position.set(-2, -1, 1);
  scene.add(rim);
}

function applyTarget(detail) {
  if (!targetRoot || detail?.name !== targetName || !detail.position || !detail.rotation) return;
  const now = performance.now();
  const recovering = lossStartedAt > 0;
  if (recovering && now - lossStartedAt < lossGraceMs) recoveredCount += 1;
  const nextPosition = new three.Vector3(detail.position.x, detail.position.y, detail.position.z);
  const nextRotation = new three.Quaternion(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w);
  const scale = Number.isFinite(detail.scale) && detail.scale > 0 ? detail.scale : 1;
  desiredPosition.copy(nextPosition);
  desiredRotation.copy(nextRotation);
  desiredScale = scale;
  // First detection and reacquisition after a long loss need an exact pose.
  // Subsequent measurements are blended in the render loop.
  if (!hasPose || !targetRoot.visible) {
    targetRoot.position.copy(nextPosition);
    targetRoot.quaternion.copy(nextRotation);
    targetRoot.scale.setScalar(scale);
  }

  // The printed target has fixed dimensions. Lock its local size once so
  // detector width noise cannot resize the artifact on every image update.
  if (!anchorSized) {
    const width = detail.scaledWidth && detail.scaledWidth > 0 ? detail.scaledWidth / scale : 1;
    const height = detail.scaledHeight && detail.scaledHeight > 0 ? detail.scaledHeight / scale : width * 4 / 3;
    artifact.root.scale.setScalar(Math.min(1.5, Math.max(0.06, width * 0.38)));
    artifact.root.position.y = -height * .075;
    anchorSized = true;
  }
  targetRoot.visible = true;
  artifact.setOpacity(1);
  hasPose = true;
  lossStartedAt = 0;
  lastSeenAt = now;
  found = true;
  updates += 1;
  renderCoreState();
}

function updateTargetPose(dt) {
  if (!found || !desiredPosition || !dt) return;
  // Fast lateral response, softer depth/scale response for hand-held zoom.
  targetRoot.position.x = three.MathUtils.damp(targetRoot.position.x, desiredPosition.x, 14, dt);
  targetRoot.position.y = three.MathUtils.damp(targetRoot.position.y, desiredPosition.y, 14, dt);
  targetRoot.position.z = three.MathUtils.damp(targetRoot.position.z, desiredPosition.z, 8, dt);
  targetRoot.quaternion.slerp(desiredRotation, 1 - Math.exp(-12 * dt));
  targetRoot.scale.setScalar(three.MathUtils.damp(targetRoot.scale.x, desiredScale, 7, dt));
}

function markLost() {
  if (!found) return;
  found = false;
  activePointer = null;
  lossStartedAt = performance.now();
  lostCount += 1;
  lastEvent = 'imagine pierdută';
  setStatus('RECONECTARE', 'grace', 'Ține imaginea în cadru. Refixăm obiectul.');
}

function updateTrackingHold(now) {
  if (!lossStartedAt || !targetRoot) return;
  const elapsed = now - lossStartedAt;
  if (elapsed >= lossGraceMs) {
    targetRoot.visible = false;
    lossStartedAt = 0;
    setStatus('IMAGINE PIERDUTĂ', 'lost', 'Încadrează din nou imaginea întreagă de pe laptop.');
    return;
  }
  const opacity = Math.max(0.25, 1 - (elapsed / lossGraceMs) * 0.65);
  artifact.setOpacity(opacity);
}

function updateDebug() {
  if (!debug) return;
  const pose = targetRoot?.position;
  $('debug-panel').textContent = [
    `event: ${lastEvent}`,
    `target: ${targetName || '—'} | found: ${found} | updates: ${updates}`,
    `tracking: ${trackingMode} | losses: ${lostCount} | recovered: ${recoveredCount}`,
    `core: ${artifact?.isOpen ? 'open' : 'closed'} | armed: ${artifact?.isArmed} | nodes: ${artifact?.progress ?? 0}/3`,
    `last pose: ${lastSeenAt ? ((performance.now() - lastSeenAt) / 1000).toFixed(1) + 's' : '—'}`,
    `pose: ${pose ? [pose.x, pose.y, pose.z].map((v) => v.toFixed(2)).join(', ') : '—'}`,
    `depth: ${pose?.z.toFixed(2) ?? '—'} → ${desiredPosition?.z.toFixed(2) ?? '—'} | scale: ${targetRoot?.scale.x.toFixed(2) ?? '—'} → ${desiredScale.toFixed(2)}`,
    `canvas: ${canvas.width} × ${canvas.height} | fps: ${fps.toFixed(0)}`,
    `viewport: ${innerWidth} × ${innerHeight}`,
  ].join('\n');
}

async function startAR() {
  if (starting) return;
  starting = true;
  $('intro').hidden = true;
  $('live').hidden = false;
  if (debug) $('debug-panel').hidden = false;
  setStatus('SE ÎNCARCĂ', 'loading', 'Pregătim camera și imaginea țintă.');
  if (!window.isSecureContext) return showError('Camera necesită HTTPS. Deschide linkul GitHub Pages în Safari.');

  try {
    const response = await fetch('./target-data/rift-screen.json');
    if (!response.ok) throw new Error('Datele imaginii țintă nu s-au încărcat.');
    const target = await response.json();
    target.imagePath = new URL(target.imagePath, location.href).href;
    targetName = target.name;
    setStatus('ȚINTĂ PREGĂTITĂ', 'loading', 'Se încarcă motorul AR.');
    three = await import('three');
    window.THREE = three;

    const [engine, extras] = await Promise.all([
      loadScript('https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js', 'XR8', 'xrloaded'),
      loadScript('https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1/dist/xrextras.js', 'XRExtras', 'xrextrasloaded'),
    ]);
    if (!await waitForARModules(engine, extras)) {
      throw new Error('Motorul AR nu este disponibil pe acest dispozitiv.');
    }
    setStatus('MOTOR PREGĂTIT', 'loading', 'Se pornește camera din spate.');
    xr = engine;
    xr.XrController.configure({ disableWorldTracking: trackingMode === 'image', imageTargetData: [target] });

    const sceneModule = {
      name: 'rift-next-probe',
      onCameraStatusChange: ({ status }) => {
        if (status === 'failed') showError('Camera nu a pornit. Verifică permisiunea în Safari și reîncarcă pagina.');
        else if (status === 'requesting') setStatus('PERMITE CAMERA', 'loading', 'Acceptă accesul la camera din spate.');
        else if (status === 'hasStream' || status === 'hasVideo') setStatus('CAMERA PORNEȘTE', 'loading', 'Îndreaptă telefonul spre imaginea de pe laptop.');
      },
      onException: () => showError('Motorul AR s-a oprit. Reîncarcă pagina și încearcă din nou.'),
      onStart: () => {
        const scene = xr.Threejs.xrScene();
        camera = scene.camera;
        makeProbe(scene.scene);
        setStatus('CAUTĂ IMAGINEA', 'searching', 'Încadrează imaginea RIFT întreagă de pe laptop.');
      },
      onUpdate: () => {
        const now = performance.now();
        const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0;
        updateTrackingHold(now);
        updateTargetPose(dt);
        artifact?.update(dt);
        if (lastFrame) fps = fps * 0.9 + (1000 / Math.max(1, now - lastFrame)) * 0.1;
        lastFrame = now;
        if (debug && now - lastDebug > 500) { updateDebug(); lastDebug = now; }
      },
      listeners: [
        { event: 'reality.imageloading', process: () => {
          lastEvent = 'încărcare țintă';
          setStatus('SE ÎNCARCĂ', 'loading', 'Se pregătește recunoașterea imaginii.');
        } },
        { event: 'reality.imagescanning', process: () => {
          lastEvent = 'scanare';
          setStatus('CAUTĂ IMAGINEA', 'searching', 'Încadrează imaginea RIFT întreagă de pe laptop.');
        } },
        { event: 'reality.imagefound', process: ({ detail }) => {
          if (detail?.name !== targetName) return;
          foundCount += 1;
          lastEvent = 'imagine găsită';
          applyTarget(detail);
        } },
        { event: 'reality.imageupdated', process: ({ detail }) => applyTarget(detail) },
        { event: 'reality.imagelost', process: ({ detail }) => {
          if (detail?.name === targetName) markLost();
        } },
      ],
    };
    xr.addCameraPipelineModules([
      xr.GlTextureRenderer.pipelineModule(),
      xr.Threejs.pipelineModule(),
      xr.XrController.pipelineModule(),
      extras.FullWindowCanvas.pipelineModule(),
      sceneModule,
    ]);
    viewport.content = `${normalViewport}, maximum-scale=1, user-scalable=no`;
    setStatus('PORNIRE CAMERĂ', 'loading', 'Îndreaptă telefonul spre imaginea de pe laptop.');
    xr.run({ canvas, cameraConfig: { direction: xr.XrConfig.camera().BACK } });
    updateDebug();
  } catch (error) {
    showError(error?.message || 'Camera AR nu a pornit.');
  }
}

function preparePicking() {
  targetRoot.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
}

function coreHit(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const pointer = new three.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  preparePicking();
  const ray = new three.Raycaster();
  ray.setFromCamera(pointer, camera);
  return ray.intersectObject(artifact.hitTarget, false).length > 0;
}

function pickNode(clientX, clientY) {
  if (!artifact?.isOpen) return -1;
  preparePicking();
  const rect = canvas.getBoundingClientRect();
  const center = artifact.root.getWorldPosition(new three.Vector3()).project(camera);
  const centerX = rect.left + (center.x + 1) * rect.width / 2;
  const centerY = rect.top + (1 - center.y) * rect.height / 2;
  const centerDistance = Math.hypot(clientX - centerX, clientY - centerY);
  let selected = -1;
  let nearest = 52;
  const nodeStates = artifact.nodeStates;
  for (let i = 0; i < 3; i += 1) {
    if (nodeStates[i]) continue;
    const point = artifact.getNodeWorldPosition(i, new three.Vector3()).project(camera);
    if (point.z < -1 || point.z > 1) continue;
    const x = rect.left + (point.x + 1) * rect.width / 2;
    const y = rect.top + (1 - point.y) * rect.height / 2;
    const distance = Math.hypot(clientX - x, clientY - y);
    if (distance < nearest) { nearest = distance; selected = i; }
  }
  return nearest + 8 < centerDistance ? selected : -1;
}

function onCanvasPointerDown(event) {
  if (!found || !artifact || !camera || activePointer) return;
  const node = pickNode(event.clientX, event.clientY);
  const onCore = coreHit(event.clientX, event.clientY);
  if (node < 0 && !onCore) return;
  activePointer = {
    id: event.pointerId, startX: event.clientX, startY: event.clientY,
    lastX: event.clientX, onCore, node, dragging: false,
  };
  canvas.setPointerCapture(event.pointerId);
}

function onCanvasPointerMove(event) {
  if (!activePointer || event.pointerId !== activePointer.id) return;
  if (!found) { activePointer = null; return; }
  const distance = Math.hypot(event.clientX - activePointer.startX, event.clientY - activePointer.startY);
  if (activePointer.onCore && artifact.isOpen && distance > 10) {
    activePointer.dragging = true;
    const result = artifact.dragRotor(event.clientX - activePointer.lastX);
    if (result.justArmed) {
      lastEvent = 'mecanism armat';
      renderCoreState();
      updateDebug();
    }
  }
  activePointer.lastX = event.clientX;
}

function onCanvasPointerUp(event) {
  if (!activePointer || event.pointerId !== activePointer.id) return;
  const gesture = activePointer;
  activePointer = null;
  if (!found || gesture.dragging || Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 14) return;
  if (gesture.node >= 0) {
    if (artifact.activateNode(gesture.node)) {
      lastEvent = `nod ${gesture.node + 1} activat`;
      renderCoreState();
    } else if (!artifact.isArmed) {
      $('instruction').textContent = 'Glisează întâi orizontal peste nucleu ca să armezi mecanismul.';
    }
  } else if (gesture.onCore) {
    const open = artifact.toggle();
    lastEvent = open ? 'core deschis' : 'core închis';
    renderCoreState();
  }
  updateDebug();
}

if (phoneMode) {
  $('start-ar').addEventListener('click', startAR);
  $('restart').addEventListener('click', () => location.reload());
  $('retry').addEventListener('click', () => location.reload());
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('pointercancel', () => { activePointer = null; });
} else {
  $('focus-target').addEventListener('click', () => document.body.classList.add('target-focus'));
  $('exit-focus').addEventListener('click', () => document.body.classList.remove('target-focus'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.body.classList.remove('target-focus');
  });
  $('copy-link').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.search = '?mode=phone&v=5';
    try {
      await navigator.clipboard.writeText(url.href);
      $('copy-status').textContent = 'Link copiat. Trimite-l pe iPhone și deschide-l în Safari.';
    } catch {
      $('copy-status').textContent = `Copiază manual: ${url.href}`;
    }
  });
}

window.__RIFT_NEXT__ = { startAR, getState: () => ({ found, foundCount, updates, lastEvent, targetName, lostCount, recoveredCount, trackingMode, visible: !!targetRoot?.visible, coreOpen: !!artifact?.isOpen, armed: !!artifact?.isArmed, progress: artifact?.progress ?? 0, poseZ: targetRoot?.position.z, poseScale: targetRoot?.scale.x }) };
