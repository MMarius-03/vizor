const $ = (id) => document.getElementById(id);
const phoneMode = document.documentElement.dataset.mode === 'phone';
const canvas = $('ar-canvas');
const viewport = document.querySelector('meta[name="viewport"]');
const normalViewport = viewport.content;
const debug = new URLSearchParams(location.search).has('debug');

let xr = null;
let targetRoot = null;
let cube = null;
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

function setStatus(label, state, instruction) {
  $('tracking-state').textContent = label;
  $('tracking-state').dataset.state = state;
  if (instruction) $('instruction').textContent = instruction;
  $('live').dataset.found = String(state === 'found');
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

  const material = new three.MeshStandardMaterial({
    color: 0xd5ef44, metalness: 0.17, roughness: 0.36,
    emissive: 0x526600, emissiveIntensity: 0.22,
  });
  cube = new three.Mesh(new three.BoxGeometry(1, 1, 1), material);
  cube.position.z = 0.5;
  targetRoot.add(cube);

  const edges = new three.LineSegments(
    new three.EdgesGeometry(cube.geometry),
    new three.LineBasicMaterial({ color: 0x0a1007 }),
  );
  cube.add(edges);
  scene.add(new three.AmbientLight(0xffffff, 1.8));
  const key = new three.DirectionalLight(0xffffff, 2);
  key.position.set(1, 2, 3);
  scene.add(key);
}

function applyTarget(detail) {
  if (!targetRoot || detail?.name !== targetName || !detail.position || !detail.rotation) return;
  targetRoot.position.set(detail.position.x, detail.position.y, detail.position.z);
  targetRoot.quaternion.set(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w);
  const scale = Number.isFinite(detail.scale) && detail.scale > 0 ? detail.scale : 1;
  targetRoot.scale.setScalar(scale);

  // Event dimensions are in scene units after applying the target's scale.
  const width = detail.scaledWidth && detail.scaledWidth > 0 ? detail.scaledWidth / scale : 1;
  const size = Math.min(1.5, Math.max(0.06, width * 0.28));
  cube.scale.setScalar(size);
  cube.position.z = size * 0.55;
  targetRoot.visible = true;
  found = true;
  updates += 1;
  setStatus('IMAGINE GĂSITĂ', 'found', 'Mișcă-te lateral. Cubul trebuie să rămână prins de imagine. Atinge cubul pentru a-i schimba culoarea.');
  $('target-count').textContent = `RECUNOAȘTERI ${String(foundCount).padStart(2, '0')}`;
}

function markLost() {
  if (targetRoot) targetRoot.visible = false;
  found = false;
  lastEvent = 'imagine pierdută';
  setStatus('IMAGINE PIERDUTĂ', 'lost', 'Încadrează din nou toată imaginea de pe laptop.');
}

function updateDebug() {
  if (!debug) return;
  const pose = targetRoot?.position;
  $('debug-panel').textContent = [
    `event: ${lastEvent}`,
    `target: ${targetName || '—'} | found: ${found} | updates: ${updates}`,
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
    xr.XrController.configure({ disableWorldTracking: true, imageTargetData: [target] });

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
  if (!found || !cube || !camera) return;
  const rect = canvas.getBoundingClientRect();
  const pointer = new three.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
  targetRoot.updateWorldMatrix(true, true);
  camera.updateMatrixWorld();
  const ray = new three.Raycaster();
  ray.setFromCamera(pointer, camera);
  if (!ray.intersectObject(cube, false).length) return;
  const alternate = cube.material.color.getHex() === 0xd5ef44;
  cube.material.color.setHex(alternate ? 0xffffff : 0xd5ef44);
  cube.material.emissive.setHex(alternate ? 0x44554a : 0x526600);
  lastEvent = 'cub atins';
  $('instruction').textContent = 'Atingerea a funcționat. Acum mișcă telefonul în jurul laptopului.';
  updateDebug();
}

if (phoneMode) {
  $('start-ar').addEventListener('click', startAR);
  $('restart').addEventListener('click', () => location.reload());
  $('retry').addEventListener('click', () => location.reload());
  canvas.addEventListener('pointerdown', onCanvasTap);
} else {
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

window.__RIFT_NEXT__ = { startAR, getState: () => ({ found, foundCount, updates, lastEvent, targetName }) };
