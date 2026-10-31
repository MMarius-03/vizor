import { createRiftCore } from './artifact.js';

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

function setStatus(label, state, instruction) {
  $('tracking-state').textContent = label;
  $('tracking-state').dataset.state = state;
  if (instruction) $('instruction').textContent = instruction;
  $('live').dataset.found = String(state === 'found' || state === 'grace');
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
  if (hasPose && recovering && now - lossStartedAt < lossGraceMs) {
    targetRoot.position.lerp(nextPosition, 0.65);
    targetRoot.quaternion.slerp(nextRotation, 0.65);
  } else {
    targetRoot.position.copy(nextPosition);
    targetRoot.quaternion.copy(nextRotation);
  }
  const scale = Number.isFinite(detail.scale) && detail.scale > 0 ? detail.scale : 1;
  targetRoot.scale.setScalar(scale);

  // Event dimensions are in scene units after applying the target's scale.
  const width = detail.scaledWidth && detail.scaledWidth > 0 ? detail.scaledWidth / scale : 1;
  const height = detail.scaledHeight && detail.scaledHeight > 0 ? detail.scaledHeight / scale : width * 4 / 3;
  const size = Math.min(1.5, Math.max(0.06, width * 0.38));
  artifact.root.scale.setScalar(size);
  artifact.root.position.y = -height * .075;
  targetRoot.visible = true;
  artifact.setOpacity(1);
  hasPose = true;
  lossStartedAt = 0;
  lastSeenAt = now;
  found = true;
  updates += 1;
  setStatus(artifact.isOpen ? 'CORE DESCHIS' : 'CORE ANCORAT', 'found',
    artifact.isOpen
      ? 'Mișcă telefonul lateral ca să vezi interiorul. Atinge nucleul ca să îl închizi.'
      : 'Mișcă telefonul lateral ca să vezi adâncimea. Atinge nucleul ca să îl deschizi.');
  $('target-count').textContent = artifact.isOpen ? 'CARCASĂ DESCHISĂ' : 'CARCASĂ ÎNCHISĂ';
}

function markLost() {
  if (!found) return;
  found = false;
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
    `core: ${artifact?.isOpen ? 'open' : 'closed'}`,
    `last pose: ${lastSeenAt ? ((performance.now() - lastSeenAt) / 1000).toFixed(1) + 's' : '—'}`,
    `pose: ${pose ? [pose.x, pose.y, pose.z].map((v) => v.toFixed(2)).join(', ') : '—'}`,
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
        updateTrackingHold(now);
        artifact?.update(lastFrame ? (now - lastFrame) / 1000 : 0);
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

function onCanvasTap(event) {
  if (!found || !artifact || !camera) return;
  const rect = canvas.getBoundingClientRect();
  const pointer = new three.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  targetRoot.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
  const ray = new three.Raycaster();
  ray.setFromCamera(pointer, camera);
  if (!ray.intersectObject(artifact.hitTarget, false).length) return;
  const open = artifact.toggle();
  lastEvent = open ? 'core deschis' : 'core închis';
  setStatus(open ? 'CORE DESCHIS' : 'CORE ANCORAT', 'found',
    open
      ? 'Mișcă telefonul lateral ca să vezi interiorul. Atinge nucleul ca să îl închizi.'
      : 'Atinge nucleul ca să îl deschizi din nou.');
  $('target-count').textContent = open ? 'CARCASĂ DESCHISĂ' : 'CARCASĂ ÎNCHISĂ';
  updateDebug();
}

if (phoneMode) {
  $('start-ar').addEventListener('click', startAR);
  $('restart').addEventListener('click', () => location.reload());
  $('retry').addEventListener('click', () => location.reload());
  canvas.addEventListener('pointerdown', onCanvasTap);
} else {
  $('focus-target').addEventListener('click', () => document.body.classList.add('target-focus'));
  $('exit-focus').addEventListener('click', () => document.body.classList.remove('target-focus'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.body.classList.remove('target-focus');
  });
  $('copy-link').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.search = '?mode=phone';
    try {
      await navigator.clipboard.writeText(url.href);
      $('copy-status').textContent = 'Link copiat. Trimite-l pe iPhone și deschide-l în Safari.';
    } catch {
      $('copy-status').textContent = `Copiază manual: ${url.href}`;
    }
  });
}

window.__RIFT_NEXT__ = { startAR, getState: () => ({ found, foundCount, updates, lastEvent, targetName, lostCount, recoveredCount, trackingMode, visible: !!targetRoot?.visible, coreOpen: !!artifact?.isOpen }) };
