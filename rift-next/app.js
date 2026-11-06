import { createRiftCore } from './artifact.js?v=10';
import { createCoreSession } from './sync.js?v=4';
import { createAtlas, createOrbit } from './studies/models.js?v=17';
import { atlasPlaces, atlasPlaceByBuilding, atlasSourceUrl } from './studies/atlas-places.js?v=2';
import { smoothAtlasPose, createAtlasPoseTracker } from './atlas-pose.js?v=2';
import { createFrameBudget, createAtlasCanvasModule } from './atlas-quality.js?v=1';

const $ = (id) => document.getElementById(id);
const phoneMode = document.documentElement.dataset.mode === 'phone';
const query = new URLSearchParams(location.search);
const requestedExperience = query.get('experience');
const experience = requestedExperience === 'campus' ? 'atlas'
  : ['atlas', 'orbit'].includes(requestedExperience) ? requestedExperience : 'core';
const roomParam = query.get('room');
const invalidRoom = experience === 'core' && phoneMode && roomParam !== null && !/^[A-HJ-NP-Z2-9]{6}$/.test(roomParam);
const savedRoom = (() => { try { return sessionStorage.getItem('rift-core-room'); } catch { return ''; } })();
const canvas = $('ar-canvas');
const viewport = document.querySelector('meta[name="viewport"]');
const normalViewport = viewport.content;
const debug = query.has('debug');
const trackingMode = query.get('tracking') === 'image' ? 'image' : 'hybrid';
// With world tracking active, keep the campus in place while the phone looks
// down at the keyboard and the laptop poster leaves the camera view.
const lossGraceMs = trackingMode === 'hybrid' ? (experience === 'atlas' ? 18000 : 1100) : 350;

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
let anchorWidth = .75;
let atlasPoseTracker = null;
let atlasFrameBudget = null;
let activePointer = null;
let atlasPointer = null;
let selectedAtlasPlace = null;
let atlasRecentering = false;
let atlasRouteLabel = '';
let atlasRouteEndpoints = null;
const atlasPinButtons = [];
let atlasPoint = null;
let restoredCoreState = null;
let lastLaptopPulseCount = null;
let lastLaptopComplete = null;
let laptopPulseTimer = 0;
let roomUnavailable = invalidRoom;

const session = experience === 'core' ? createCoreSession({
  role: phoneMode ? 'phone' : 'console',
  initialCode: phoneMode ? roomParam : savedRoom,
  onRestore(state) {
    restoredCoreState = state;
    artifact?.restoreState(state);
    if (artifact && found) renderCoreState();
  },
  onUpdate({ code, state, presence, online, error, errorStatus }) {
    if (phoneMode) {
      const label = $('phone-sync');
      const selectionUrl = code ? `./choose.html?room=${encodeURIComponent(code)}` : './choose.html';
      document.querySelectorAll('#phone a[href^="./choose.html"]').forEach((link) => { link.href = selectionUrl; });
      roomUnavailable = invalidRoom || errorStatus === 404;
      label.textContent = invalidRoom ? 'COD INVALID · CERE UN LINK NOU' : !code ? 'SOLO · FĂRĂ LAPTOP' : errorStatus === 404 ? 'SESIUNE EXPIRATĂ · CERE UN LINK NOU' : !online ? `RECONECTARE · ${code}` : presence.console ? `SINCRONIZAT · ${code}` : `LAPTOP ÎN AȘTEPTARE · ${code}`;
      label.dataset.online = String(online && presence.console);
      label.dataset.error = String(roomUnavailable);
      $('phone-sync-live').textContent = label.textContent;
      $('phone-sync-live').dataset.online = label.dataset.online;
      $('phone-sync-live').dataset.error = label.dataset.error;
      $('start-ar').disabled = roomUnavailable;
      if (error && debug) label.title = error;
    } else {
      const nextPulseCount = state?.pulseCount ?? 0;
      const complete = !!state?.nodes?.every(Boolean);
      if ((lastLaptopPulseCount !== null && nextPulseCount > lastLaptopPulseCount) ||
          (lastLaptopComplete !== null && complete && !lastLaptopComplete)) {
        const stage = $('sync-stage');
        stage.classList.remove('sync-pulse');
        void stage.offsetWidth;
        stage.classList.add('sync-pulse');
        clearTimeout(laptopPulseTimer);
        laptopPulseTimer = setTimeout(() => stage.classList.remove('sync-pulse'), 1100);
      }
      lastLaptopPulseCount = nextPulseCount;
      lastLaptopComplete = complete;
      try { if (code) sessionStorage.setItem('rift-core-room', code); else sessionStorage.removeItem('rift-core-room'); } catch {}
      $('room-code').textContent = code || '······';
      $('sync-status').textContent = !code ? (error || 'Se pregătește conexiunea…') : !online ? 'Reconectare la server…' : presence.phone ? 'iPhone conectat · gesturile apar aici' : 'Așteptăm iPhone-ul · trimite linkul';
      $('sync-stage').dataset.online = String(online && presence.phone);
      $('sync-stage').dataset.open = String(!!state?.open);
      $('sync-stage').dataset.armed = String(!!state?.armed);
      $('sync-stage').dataset.section = String(!!state?.section);
      $('sync-progress').textContent = `${state?.nodes?.filter(Boolean).length || 0} / 3`;
      for (let i = 0; i < 3; i += 1) $('sync-node-' + i).dataset.active = String(!!state?.nodes?.[i]);
      $('sync-action').textContent = !state ? 'AȘTEPTARE' : !state.open ? 'CORE ÎNCHIS' : !state.armed ? 'CORE DESCHIS' : state.section ? 'REACTOR SECȚIONAT' : state.nodes.every(Boolean) ? 'CORE STABIL' : 'MECANISM ARMAT';
    }
  },
}) : {
  start() {},
  publish() {},
  get code() { return ''; },
  get state() { return null; },
};

const experienceCopy = {
  atlas: {
    label: 'CAMPUS',
    laptopEyebrow: 'CAMPUS / AR LIVE · BETA',
    laptopTitle: 'Campusul<br><em>prinde formă.</em>',
    target: './target-data/atlas-screen_original.png?v=5',
    targetData: './target-data/atlas-screen.json?v=5',
    targetLabel: 'CAMPUS / IMAGE TARGET',
    targetAlt: 'Planul CAMPUS USV cu clădiri, alei și spații verzi.',
    targetPrompt: 'posterul CAMPUS',
    laptopDescription: 'Lasă harta campusului deschisă pe laptop. Pe iPhone pornește camera: clădirile apar deasupra tastaturii, iar pinurile deschid detalii despre locuri.',
    laptopStep: 'Ține harta CAMPUS întreagă în cadru. Mișcă telefonul lateral, apoi atinge pinurile albastre sau clădirile pentru detalii.',
    phoneEyebrow: 'CAMPUS · AR PRIN IMAGINE',
    phoneTitle: 'Explorează<br><em>campusul.</em>',
    phoneDescription: 'Încadrează harta CAMPUS de pe laptop. Privește campusul deasupra tastaturii, apoi atinge un pin sau o clădire.',
    found: 'Campus ancorat. Atinge un pin albastru sau o clădire pentru detalii; mișcă telefonul ca să explorezi.',
  },
  orbit: {
    label: 'ORBIT',
    laptopEyebrow: 'ORBIT / AR LIVE · BETA',
    laptopTitle: 'Mecanism în<br><em>orbită.</em>',
    target: './target-data/orbit-screen_original.png',
    targetData: './target-data/orbit-screen.json',
    targetLabel: 'ORBIT / IMAGE TARGET',
    targetAlt: 'Imagine-țintă ORBIT în bleumarin și cobalt, cu axe și inele concentrice argintii.',
    targetPrompt: 'posterul ORBIT',
    laptopDescription: 'Lasă posterul ORBIT deschis pe laptop. Pe iPhone alege ORBIT și pornește camera pentru a vedea instrumentul cinetic ancorat de ecran.',
    laptopStep: 'Pe iPhone alege ORBIT și ține posterul ORBIT întreg în cadru. Mecanismul va apărea în fața ecranului.',
    phoneEyebrow: 'ORBIT · AR PRIN IMAGINE',
    phoneTitle: 'Privește<br><em>mecanismul.</em>',
    phoneDescription: 'Încadrează posterul ORBIT de pe laptop. Instrumentul ORBIT va apărea în fața ecranului, ancorat de imagine.',
    found: 'ORBIT este ancorat de imaginea laptopului. Mișcă telefonul lateral ca să privești inelele din unghiuri diferite.',
  },
};

function configureExperience() {
  document.documentElement.dataset.experience = experience;
  document.body.dataset.experience = experience;
  if (experience === 'core') return;
  const copy = experienceCopy[experience];
  if (roomParam) {
    const selectionUrl = `./choose.html?room=${encodeURIComponent(roomParam)}`;
    document.querySelectorAll('#laptop a[href="./choose.html"], #phone a[href="./choose.html"]').forEach((link) => {
      link.href = selectionUrl;
    });
  }
  document.title = `RIFT / ${copy.label} AR`;
  $('laptop-brand').innerHTML = `RIFT<span> / ${copy.label}</span>`;
  $('laptop-eyebrow').innerHTML = `<span class="led"></span> ${copy.laptopEyebrow}`;
  $('laptop-title').innerHTML = copy.laptopTitle;
  $('laptop-description').textContent = copy.laptopDescription;
  $('laptop-step-3').textContent = copy.laptopStep;
  $('copy-link').innerHTML = 'COPIAZĂ LINKUL AR <span>↗</span>';
  $('copy-status').textContent = `Trimite linkul ${copy.label} pe iPhone și deschide-l în Safari.`;
  $('room-line').hidden = true;
  $('sync-visual').hidden = true;
  $('sync-stage').dataset.experience = experience;
  $('phone-brand').innerHTML = `RIFT<span> / ${copy.label}</span>`;
  $('live-brand').innerHTML = `← RIFT<span> / ${copy.label}</span>`;
  $('error').querySelector('.phone-brand').innerHTML = `RIFT<span> / ${copy.label}</span>`;
  $('phone-eyebrow').innerHTML = `<span class="led"></span> ${copy.phoneEyebrow}`;
  $('phone-title').innerHTML = copy.phoneTitle;
  $('phone-description').textContent = copy.phoneDescription;
  $('target-image').src = copy.target;
  $('target-image').alt = copy.targetAlt;
  $('target-label').textContent = copy.targetLabel;
  $('target-dimensions').textContent = 'ȚINTĂ STATICĂ / 960 × 1280';
  $('phone-sync').textContent = `${copy.label} · AR SOLO`;
  $('phone-sync-live').hidden = true;
  $('target-count').textContent = `${copy.label} / ÎN AȘTEPTARE`;
  $('node-controls').hidden = true;
  $('section-toggle').hidden = true;
}
configureExperience();

function closeAtlasInfo() {
  selectedAtlasPlace = null;
  artifact?.selectPlace?.(null);
  $('atlas-info').hidden = true;
  $('live').dataset.atlasInfo = 'false';
  $('atlas-pins').querySelectorAll('.atlas-pin').forEach(button => button.classList.remove('is-selected'));
}

function openAtlasInfo(place) {
  $('atlas-route-panel').hidden = true;
  $('live').dataset.atlasRoutePanel = 'false';
  selectedAtlasPlace = place.id;
  artifact?.selectPlace?.(place);
  $('atlas-info').dataset.expanded = 'false';
  $('atlas-info-expand').setAttribute('aria-expanded', 'false');
  $('atlas-info-expand').textContent = 'VEZI DETALII ↓';
  $('atlas-info-more').hidden = true;
  $('atlas-info-type').textContent = place.type;
  $('atlas-info-title').textContent = place.title;
  $('atlas-info-description').textContent = place.description;
  $('atlas-info-source').href = atlasSourceUrl;
  $('atlas-info').hidden = false;
  $('live').dataset.atlasInfo = 'true';
  $('atlas-pins').querySelectorAll('.atlas-pin').forEach(button => {
    button.classList.toggle('is-selected', button.dataset.place === place.id);
  });
}

function setupAtlasPins() {
  const container = $('atlas-pins');
  for (const place of atlasPlaces) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'atlas-pin';
    button.dataset.place = place.id;
    button.setAttribute('aria-label', `Detalii: ${place.title}`);
    button.innerHTML = '<span aria-hidden="true"></span>';
    button.addEventListener('click', () => openAtlasInfo(place));
    container.append(button);
    atlasPinButtons.push({ place, button });
  }
  $('atlas-info-close').addEventListener('click', closeAtlasInfo);
  $('atlas-info-expand').addEventListener('click', () => {
    const expanded = $('atlas-info').dataset.expanded !== 'true';
    $('atlas-info').dataset.expanded = String(expanded);
    $('atlas-info-expand').setAttribute('aria-expanded', String(expanded));
    $('atlas-info-expand').textContent = expanded ? 'ASCUNDE DETALII ↑' : 'VEZI DETALII ↓';
    $('atlas-info-more').hidden = !expanded;
  });
}

function setupAtlasRoutes() {
  const start=$('atlas-route-start'), end=$('atlas-route-end');
  for(const place of atlasPlaces)for(const select of [start,end]){
    const option=document.createElement('option');
    option.value=place.id;option.textContent=place.title;select.append(option);
  }
  start.value='restaurant';end.value='biblioteca';
  $('atlas-route-toggle').addEventListener('click',()=>{
    const panel=$('atlas-route-panel');
    panel.hidden=!panel.hidden;
    $('live').dataset.atlasRoutePanel=String(!panel.hidden);
    if(!panel.hidden)closeAtlasInfo();
  });
  $('atlas-route-close').addEventListener('click',()=>{$('atlas-route-panel').hidden=true;$('live').dataset.atlasRoutePanel='false';});
  $('atlas-route-show').addEventListener('click',()=>{
    const from=atlasPlaces.find(place=>place.id===start.value);
    const to=atlasPlaces.find(place=>place.id===end.value);
    const message=$('atlas-route-message');
    if(!from||!to||from.id===to.id){
      message.textContent='Alege două locuri diferite.';return;
    }
    if(!targetRoot?.visible||!artifact?.showRoute(from,to)){
      message.textContent='Încadrează posterul CAMPUS și încearcă din nou.';return;
    }
    atlasRouteLabel=`${from.title} → ${to.title}`;
    atlasRouteEndpoints=new Set([from.id,to.id]);
    message.textContent=`Traseu orientativ: ${atlasRouteLabel}. Verifică intrările și accesul în campus.`;
    $('target-count').textContent='CAMPUS / TRASEU ACTIV';
    $('atlas-route-panel').hidden=true;
    $('live').dataset.atlasRoutePanel='false';
    $('instruction').textContent='Urmărește linia albastră de la punctul cyan la destinația portocalie. Traseul este schematic.';
  });
  $('atlas-route-clear').addEventListener('click',()=>{
    artifact?.clearRoute();atlasRouteLabel='';atlasRouteEndpoints=null;
    $('target-count').textContent='CAMPUS / AR LIVE';
    $('atlas-route-message').textContent='Traseu șters. Alege două locuri.';
    $('instruction').textContent=experienceCopy.atlas.found;
  });
}

function updateAtlasPins(now) {
  if (experience !== 'atlas' || !phoneMode || !artifact || !camera) return;
  const container = $('atlas-pins');
  if (!targetRoot?.visible) {
    if (!container.hidden) container.hidden = true;
    if (!$('atlas-info').hidden) closeAtlasInfo();
    return;
  }
  if (container.hidden) container.hidden = false;
  targetRoot.updateWorldMatrix(true, false);
  artifact.root.updateWorldMatrix(false, false);
  camera.updateMatrixWorld();
  const rect = canvas.getBoundingClientRect();
  const topEdge = document.querySelector('.live-top').getBoundingClientRect().bottom + 6;
  const bottomEdge = document.querySelector('.live-bottom').getBoundingClientRect().top - 6;
  const infoRect = $('atlas-info').hidden ? null : $('atlas-info').getBoundingClientRect();
  const occupied = [];
  const routePins=atlasRouteEndpoints ? atlasPinButtons.filter(({place})=>atlasRouteEndpoints.has(place.id)) : atlasPinButtons;
  const pins = selectedAtlasPlace
    ? [...routePins].sort((a, b) => (b.place.id === selectedAtlasPlace) - (a.place.id === selectedAtlasPlace))
    : routePins;
  if(atlasRouteEndpoints)atlasPinButtons.forEach(({place,button})=>{
    if(!atlasRouteEndpoints.has(place.id))button.hidden=true;
  });
  const point = atlasPoint;
  for (const { place, button } of pins) {
    artifact.getPlaceWorldPosition(place, point).project(camera);
    const x = rect.left + (point.x + 1) * rect.width / 2;
    const y = rect.top + (1 - point.y) * rect.height / 2;
    const underInfo = infoRect && x + 18 > infoRect.left && x - 18 < infoRect.right &&
      y + 18 > infoRect.top && y - 18 < infoRect.bottom;
    const visible = point.z >= -1 && point.z <= 1 && x >= rect.left + 22 && x <= rect.right - 22 &&
      y >= Math.max(rect.top + 22, topEdge + 22) && y <= Math.min(rect.bottom - 22, bottomEdge - 22) && !underInfo &&
      occupied.every(([px, py]) => Math.hypot(px - x, py - y) > (button.hidden ? 52 : 46));
    if (button.hidden !== !visible) button.hidden = !visible;
    if (visible) {
      button.style.transform = `translate3d(${(x - 22).toFixed(2)}px, ${(y - 22).toFixed(2)}px, 0)`;
      occupied.push([x, y]);
    }
  }
}

function publishCore(action) {
  if (artifact) session.publish(artifact.getSyncState(), action);
}

function setStatus(label, state, instruction) {
  if ($('tracking-state').textContent !== label) $('tracking-state').textContent = label;
  if ($('tracking-state').dataset.state !== state) $('tracking-state').dataset.state = state;
  if (instruction && $('instruction').textContent !== instruction) $('instruction').textContent = instruction;
  $('live').dataset.found = String(state === 'found' || state === 'grace');
}

function renderCoreState() {
  if (!artifact) return;
  let status;
  let instruction;
  if (artifact.isSectionOpen) {
    status = 'SECȚIUNE DESCHISĂ';
    instruction = 'Privește în interior din lateral. Glisează în jos sau atinge o piesă.';
    $('target-count').textContent = 'REACTOR SECȚIONAT';
  } else if (artifact.isComplete) {
    status = 'CORE STABIL';
    instruction = 'Glisează în sus pe nucleu pentru secțiune. Poți atinge și piesele.';
    $('target-count').textContent = 'NODURI 3 / 3';
  } else if (!artifact.isOpen) {
    status = 'CORE ANCORAT';
    instruction = 'Atinge nucleul ca să deschizi carcasa.';
    $('target-count').textContent = 'CARCASĂ ÎNCHISĂ';
  } else if (!artifact.isArmed) {
    status = 'CORE DESCHIS';
    instruction = 'Glisează orizontal ca să rotești. Atinge o piesă ca să o identifici.';
    $('target-count').textContent = 'ROTEȘTE NUCLEUL';
  } else {
    status = 'MECANISM ARMAT';
    instruction = 'Atinge punctele de pe obiect sau folosește 01–03 de jos.';
    $('target-count').textContent = `NODURI ${artifact.progress} / 3`;
  }
  if (found) setStatus(status, 'found', instruction);
  $('restart').textContent = artifact.isComplete ? 'REIA CICLUL' : 'REPORNEȘTE CAMERA';
  $('node-controls').hidden = !artifact.isOpen || !artifact.isArmed || artifact.isComplete;
  $('section-toggle').hidden = !artifact.isComplete;
  $('section-toggle').textContent = artifact.isSectionOpen ? 'ÎNCHIDE SECȚIUNEA' : 'SECȚIONEAZĂ NUCLEUL';
  for (const button of $('node-controls').querySelectorAll('button')) {
    const active = artifact.nodeStates[Number(button.dataset.node)];
    button.disabled = active;
    button.dataset.active = String(active);
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

  if (experience === 'core') {
    artifact = createRiftCore(three);
    if (restoredCoreState) artifact.restoreState(restoredCoreState);
    // A conservative size until the tracker reports the target width.
    artifact.root.scale.setScalar(.285);
    artifact.root.position.y = -.075;
  } else {
    artifact = experience === 'atlas' ? createAtlas(three) : createOrbit(three);
    if (experience === 'atlas') {
      atlasPoint = new three.Vector3();
      atlasPoseTracker = createAtlasPoseTracker(three);
    }
    artifact.root.scale.setScalar(experience === 'atlas' ? .29 : .12);
    artifact.setProgress(1);
    artifact.setEffect(0);
    // Settle the model once, then leave it still for this live beta.
    for (let frame = 0; frame < 120; frame += 1) artifact.update(.05);
    if (experience === 'atlas') { orientAtlasFromNorth(); artifact.freezeStatic(); }
    artifact.root.position.z = experience === 'atlas' ? .18 : .12;
  }
  targetRoot.add(artifact.root);
  scene.add(new three.HemisphereLight(0xeaf3ee, 0x101b1a, 2.05));
  const key = new three.DirectionalLight(0xf8fff8, 2.3);
  key.position.set(1, 2, 3);
  scene.add(key);
  const rim = new three.DirectionalLight(0x81d8d3, 1.25);
  rim.position.set(-2, -1, 1);
  scene.add(rim);
}

function orientAtlasFromNorth() {
  // The N block is on the right edge of the printed map. Turn that edge
  // toward the viewer while keeping the campus plane horizontal.
  artifact.setViewFromNorth();
}

function applyTarget(detail) {
  if (!targetRoot || detail?.name !== targetName || !detail.position || !detail.rotation) return false;
  const position = detail.position;
  const rotation = detail.rotation;
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z) ||
      !Number.isFinite(rotation.x) || !Number.isFinite(rotation.y) ||
      !Number.isFinite(rotation.z) || !Number.isFinite(rotation.w) ||
      rotation.x ** 2 + rotation.y ** 2 + rotation.z ** 2 + rotation.w ** 2 < .001) return false;
  const now = performance.now();
  const wasFound = found;
  const recovering = lossStartedAt > 0;
  const scale = Number.isFinite(detail.scale) && detail.scale > 0 ? detail.scale : desiredScale;
  if (experience === 'atlas') {
    if (!atlasPoseTracker.measure(position,rotation,scale,now,anchorWidth,atlasRecentering || !hasPose || !targetRoot.visible)) return false;
    desiredPosition.copy(atlasPoseTracker.position);
    desiredRotation.copy(atlasPoseTracker.rotation);
    desiredScale = atlasPoseTracker.scale;
  } else {
    desiredPosition.set(position.x, position.y, position.z);
    desiredRotation.set(rotation.x, rotation.y, rotation.z, rotation.w).normalize();
    desiredScale = scale;
  }
  if (recovering && now - lossStartedAt < lossGraceMs) recoveredCount += 1;
  // First detection and reacquisition after a long loss need an exact pose.
  // Subsequent measurements are blended in the render loop.
  if (atlasRecentering || !hasPose || !targetRoot.visible) {
    targetRoot.position.copy(desiredPosition);
    targetRoot.quaternion.copy(desiredRotation);
    targetRoot.scale.setScalar(scale);
  }

  // The printed target has fixed dimensions. Lock its local size once so
  // detector width noise cannot resize the artifact on every image update.
  if (!anchorSized && Number.isFinite(detail.scaledWidth) && detail.scaledWidth > 0) {
    const width = detail.scaledWidth / scale;
    anchorWidth = width;
    const height = Number.isFinite(detail.scaledHeight) && detail.scaledHeight > 0
      ? detail.scaledHeight / scale : width * 4 / 3;
    if (experience === 'core') {
      artifact.root.scale.setScalar(Math.min(1.5, Math.max(0.06, width * 0.38)));
      artifact.root.position.y = -height * .075;
    } else if (experience === 'atlas') {
      artifact.root.scale.setScalar(Math.min(.55, Math.max(.08, width * .39)));
      orientAtlasFromNorth();
      // Keep the campus slightly higher so close-up viewing needs less downward tilt.
      artifact.root.position.set(0, -height * .29, width * .43);
    } else {
      artifact.root.scale.setScalar(Math.min(.42, Math.max(.09, width * .28)));
      artifact.root.rotation.set(0, 0, 0);
      artifact.root.position.set(0, -height * .035, width * .18);
    }
    anchorSized = true;
  }
  targetRoot.visible = true;
  if (experience === 'core') artifact.setOpacity(1);
  hasPose = true;
  lossStartedAt = 0;
  lastSeenAt = now;
  found = true;
  if (atlasRecentering) {
    atlasRecentering = false;
    $('live').dataset.recentering = 'false';
    renderPassiveState();
  }
  updates += 1;
  if (!wasFound) {
    if (experience === 'core') renderCoreState();
    else renderPassiveState();
  }
  return true;
}

function renderPassiveState() {
  const copy = experienceCopy[experience];
  setStatus(`${copy.label} ANCORAT`, 'found', atlasRouteLabel && experience==='atlas'
    ? 'Urmărește linia albastră de la punctul cyan la destinația portocalie. Traseul este schematic.' : copy.found);
  $('target-count').textContent = atlasRouteLabel && experience==='atlas' ? 'CAMPUS / TRASEU ACTIV' : `${copy.label} / AR LIVE`;
  $('restart').textContent = 'REIA CAMERA';
  $('atlas-recenter').hidden = experience !== 'atlas';
  $('atlas-route-toggle').hidden = experience !== 'atlas';
  $('node-controls').hidden = true;
  $('section-toggle').hidden = true;
}

function updateTargetPose(dt) {
  if (!found || !desiredPosition || !dt) return;
  if (experience === 'atlas') {
    smoothAtlasPose(targetRoot, desiredPosition, desiredRotation, desiredScale, dt, anchorWidth,
      atlasPoseTracker.motionAt(performance.now()));
    return;
  }
  // Fast lateral response, softer depth/scale response for hand-held zoom.
  targetRoot.position.x = three.MathUtils.damp(targetRoot.position.x, desiredPosition.x, 14, dt);
  targetRoot.position.y = three.MathUtils.damp(targetRoot.position.y, desiredPosition.y, 14, dt);
  targetRoot.position.z = three.MathUtils.damp(targetRoot.position.z, desiredPosition.z, 8, dt);
  targetRoot.quaternion.slerp(desiredRotation, 1 - Math.exp(-12 * dt));
  targetRoot.scale.setScalar(three.MathUtils.damp(targetRoot.scale.x, desiredScale, 7, dt));
}

function markLost() {
  if (!found) return;
  if (experience === 'core' && activePointer?.axis === 'section') artifact?.setSection(artifact.isSectionOpen);
  found = false;
  activePointer = null;
  atlasPointer = null;
  $('node-controls').hidden = true;
  $('section-toggle').hidden = true;
  lossStartedAt = performance.now();
  lostCount += 1;
  lastEvent = 'imagine pierdută';
  if (experience === 'atlas' && trackingMode === 'hybrid') {
    setStatus('CAMPUS FIXAT', 'grace', 'Privește macheta de aproape. Reîncadrează posterul CAMPUS pentru a reîmprospăta poziția.');
  } else {
    setStatus('RECONECTARE', 'grace', 'Ține imaginea în cadru. Refixăm obiectul.');
  }
}

function updateTrackingHold(now) {
  if (!lossStartedAt || !targetRoot) return;
  const elapsed = now - lossStartedAt;
  if (elapsed >= lossGraceMs) {
    targetRoot.visible = false;
    if (experience === 'atlas') updateAtlasPins(now);
    lossStartedAt = 0;
    setStatus('IMAGINE PIERDUTĂ', 'lost', experience === 'atlas'
      ? 'Încadrează din nou posterul CAMPUS de pe laptop pentru a fixa campusul.'
      : 'Încadrează din nou imaginea întreagă de pe laptop.');
    return;
  }
  const opacity = Math.max(0.25, 1 - (elapsed / lossGraceMs) * 0.65);
  if (experience === 'core') artifact.setOpacity(opacity);
}

function updateDebug() {
  if (!debug) return;
  const pose = targetRoot?.position;
  $('debug-panel').textContent = [
    `event: ${lastEvent}`,
    `target: ${targetName || '—'} | found: ${found} | updates: ${updates}`,
    `tracking: ${trackingMode} | losses: ${lostCount} | recovered: ${recoveredCount}`,
    `core: ${artifact?.isOpen ? 'open' : 'closed'} | armed: ${artifact?.isArmed} | nodes: ${artifact?.progress ?? 0}/3 | section: ${artifact?.isSectionOpen}`,
    `last pose: ${lastSeenAt ? ((performance.now() - lastSeenAt) / 1000).toFixed(1) + 's' : '—'}`,
    `pose: ${pose ? [pose.x, pose.y, pose.z].map((v) => v.toFixed(2)).join(', ') : '—'}`,
    `depth: ${pose?.z.toFixed(2) ?? '—'} → ${desiredPosition?.z.toFixed(2) ?? '—'} | scale: ${targetRoot?.scale.x.toFixed(2) ?? '—'} → ${desiredScale.toFixed(2)}`,
    `canvas: ${canvas.width} × ${canvas.height} | fps: ${fps.toFixed(0)}`,
    ...(atlasFrameBudget ? [`render quality: ${Math.round(atlasFrameBudget.scale*100)}%`] : []),
    `viewport: ${innerWidth} × ${innerHeight}`,
  ].join('\n');
}

async function startAR() {
  if (starting) return;
  if (roomUnavailable) {
    $('intro').hidden = true;
    return showError('Linkul sesiunii nu este valid. Copiază un link nou de pe laptop.');
  }
  starting = true;
  $('intro').hidden = true;
  $('live').hidden = false;
  if (debug) $('debug-panel').hidden = false;
  setStatus('SE ÎNCARCĂ', 'loading', 'Pregătim camera și imaginea țintă.');
  if (!window.isSecureContext) return showError('Camera necesită HTTPS. Deschide linkul GitHub Pages în Safari.');

  try {
    const targetData = experience === 'core' ? './target-data/rift-screen.json' : experienceCopy[experience].targetData;
    const response = await fetch(targetData);
    if (!response.ok) throw new Error('Datele imaginii țintă nu s-au încărcat.');
    const target = await response.json();
    target.imagePath = new URL(target.imagePath, location.href).href;
    if (experience === 'atlas') target.imagePath += '?v=5';
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
        else if (!found && status === 'requesting') setStatus('PERMITE CAMERA', 'loading', 'Acceptă accesul la camera din spate.');
        else if (!found && (status === 'hasStream' || status === 'hasVideo')) setStatus('CAMERA PORNEȘTE', 'loading', 'Îndreaptă telefonul spre imaginea de pe laptop.');
      },
      onException: () => showError('Motorul AR s-a oprit. Reîncarcă pagina și încearcă din nou.'),
      onStart: () => {
        const scene = xr.Threejs.xrScene();
        camera = scene.camera;
        scene.renderer.localClippingEnabled = true;
        makeProbe(scene.scene);
        setStatus('CAUTĂ IMAGINEA', 'searching', experience === 'core'
          ? 'Încadrează imaginea RIFT întreagă de pe laptop.'
          : `Încadrează ${experienceCopy[experience].targetPrompt} întreg în cadru pentru a ancora ${experienceCopy[experience].label}.`);
      },
      onUpdate: () => {
        const now = performance.now();
        const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0;
        updateTrackingHold(now);
        updateTargetPose(dt);
        if (experience === 'core') artifact?.update(dt);
        if (experience === 'atlas') artifact?.updateSelection(dt);
        if (experience === 'atlas') artifact?.updateRoute(dt);
        if (experience === 'atlas') updateAtlasPins(now);
        if (lastFrame) fps = fps * 0.9 + (1000 / Math.max(1, now - lastFrame)) * 0.1;
        lastFrame = now;
        if (debug && now - lastDebug > 500) { updateDebug(); lastDebug = now; }
      },
      listeners: [
        { event: 'reality.imageloading', process: () => {
          lastEvent = 'încărcare țintă';
          if (!found && !lossStartedAt) setStatus('SE ÎNCARCĂ', 'loading', 'Se pregătește recunoașterea imaginii.');
        } },
        { event: 'reality.imagescanning', process: () => {
          lastEvent = 'scanare';
          if (!found && !lossStartedAt) setStatus(experience === 'atlas' ? 'REÎNCADREAZĂ' : 'CAUTĂ IMAGINEA', 'searching', experience === 'core'
            ? 'Încadrează imaginea RIFT întreagă de pe laptop.'
            : `Reîncadrează posterul ${experienceCopy[experience].label} întreg pe laptop.`);
        } },
        { event: 'reality.imagefound', process: ({ detail }) => {
          if (detail?.name !== targetName) return;
          if (applyTarget(detail)) {
            foundCount += 1;
            lastEvent = 'imagine găsită';
          }
        } },
        { event: 'reality.imageupdated', process: ({ detail }) => applyTarget(detail) },
        { event: 'reality.imagelost', process: ({ detail }) => {
          if (detail?.name === targetName) markLost();
        } },
      ],
    };
    const fullWindowModule = extras.FullWindowCanvas.pipelineModule();
    if (experience === 'atlas') atlasFrameBudget = createFrameBudget();
    xr.addCameraPipelineModules([
      xr.GlTextureRenderer.pipelineModule(),
      xr.Threejs.pipelineModule(),
      xr.XrController.pipelineModule(),
      experience === 'atlas' ? createAtlasCanvasModule(fullWindowModule, atlasFrameBudget) : fullWindowModule,
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

function atlasBuildingSummary(building) {
  const dorm = /^CĂMIN (\d+)$/.exec(building);
  const academic = /^[A-Z]$/.test(building);
  return {
    id: `building-${building}`,
    building,
    type: dorm ? 'CAZARE' : academic ? 'CORP UNIVERSITAR' : 'REPER',
    title: dorm ? `Căminul studențesc nr. ${dorm[1]}` : academic ? `Corpul ${building}` : building,
    description: 'Loc marcat pe planul schematic al campusului USV.',
  };
}

function pickAtlasBuilding(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const pointer = new three.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  preparePicking();
  const ray = new three.Raycaster();
  const hitAt = (x,y) => {
    pointer.set(((x-rect.left)/rect.width)*2-1,-((y-rect.top)/rect.height)*2+1);
    ray.setFromCamera(pointer,camera);
    return ray.intersectObjects(artifact.buildingTargets,false)
      .find(({object}) => object.parent.visible);
  };
  let hit = hitAt(clientX,clientY);
  if (!hit) {
    for (const radius of [10,20]) {
      const nearby=[];
      for (let i=0;i<8;i++) {
        const angle=i*Math.PI/4;
        const found=hitAt(clientX+Math.cos(angle)*radius,clientY+Math.sin(angle)*radius);
        if(found) nearby.push(found);
      }
      if(nearby.length) {hit=nearby.sort((a,b)=>a.distance-b.distance)[0];break;}
    }
  }
  const building = hit?.object.userData.atlasBuildingId;
  if (!building) {
    const projected = new three.Vector3();
    let nearest = null;
    let distance = 42;
    for (const place of atlasPlaces) {
      artifact.getPlaceWorldPosition(place, projected).project(camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const x = rect.left + (projected.x + 1) * rect.width / 2;
      const y = rect.top + (1 - projected.y) * rect.height / 2;
      const candidate = Math.hypot(clientX - x, clientY - y);
      if (candidate < distance) {
        const front=hitAt(x,y)?.object.userData.atlasBuildingId;
        if (front && front !== place.building) continue;
        nearest = place; distance = candidate;
      }
    }
    if (nearest) openAtlasInfo(nearest);
    else closeAtlasInfo();
    return;
  }
  openAtlasInfo(atlasPlaceByBuilding.get(building) || atlasBuildingSummary(building));
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

function pickPart(clientX, clientY) {
  if (!artifact?.isOpen) return null;
  const rect = canvas.getBoundingClientRect();
  const pointer = new three.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  preparePicking();
  const ray = new three.Raycaster();
  ray.setFromCamera(pointer, camera);
  return ray.intersectObjects(artifact.partTargets, false)
    .find(({ object }) => object.parent.visible && object.userData.kind === 'part')?.object || null;
}

function pickNode(clientX, clientY) {
  if (!artifact?.isOpen) return -1;
  preparePicking();
  const rect = canvas.getBoundingClientRect();
  const center = artifact.getCoreWorldPosition(new three.Vector3()).project(camera);
  const centerX = rect.left + (center.x + 1) * rect.width / 2;
  const centerY = rect.top + (1 - center.y) * rect.height / 2;
  const centerDistance = Math.hypot(clientX - centerX, clientY - centerY);
  let selected = -1;
  let nearest = 58;
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
  return nearest + 4 < centerDistance ? selected : -1;
}

function activateNode(index) {
  if (!found || !artifact) return;
  if (!artifact.activateNode(index)) {
    if (!artifact.isArmed) $('instruction').textContent = 'Glisează întâi orizontal peste nucleu ca să armezi mecanismul.';
    return;
  }
  lastEvent = `nod ${index + 1} activat`;
  publishCore(`node:${index}`);
  renderCoreState();
  updateDebug();
}

function changeSection(open) {
  if (!found || !artifact?.setSection(open)) return;
  lastEvent = open ? 'straturi desfăcute' : 'straturi strânse';
  publishCore('section');
  renderCoreState();
  updateDebug();
}

function onCanvasPointerDown(event) {
  if (experience === 'atlas') {
    if (!targetRoot?.visible || !artifact || !camera || atlasPointer) return;
    atlasPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    return;
  }
  if (experience !== 'core' || !found || !artifact || !camera || activePointer) return;
  const node = pickNode(event.clientX, event.clientY);
  const part = node < 0 ? pickPart(event.clientX, event.clientY) : null;
  const onCore = coreHit(event.clientX, event.clientY);
  if (node < 0 && !onCore && !part) return;
  activePointer = {
    id: event.pointerId, startX: event.clientX, startY: event.clientY,
    lastX: event.clientX, onCore: onCore || !!part, node, part,
    sectionStart: artifact.sectionAmount, dragging: false, axis: null,
  };
  try { canvas.setPointerCapture(event.pointerId); } catch {}
}

function onCanvasPointerMove(event) {
  if (!activePointer || event.pointerId !== activePointer.id) return;
  if (!found) { activePointer = null; return; }
  const dx = event.clientX - activePointer.startX;
  const dy = event.clientY - activePointer.startY;
  if (activePointer.onCore && artifact.isComplete && !activePointer.axis &&
      Math.abs(dy) > 25 && Math.abs(dy) > Math.abs(dx) * 1.2) {
    activePointer.axis = 'section';
    activePointer.dragging = true;
  }
  if (activePointer.axis === 'section') {
    artifact.scrubSection(activePointer.sectionStart - dy / 170);
    activePointer.lastX = event.clientX;
    return;
  }
  if (activePointer.onCore && artifact.isOpen &&
      (activePointer.axis === 'rotate' || (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.2))) {
    activePointer.axis = 'rotate';
    activePointer.dragging = true;
    const result = artifact.dragRotor(event.clientX - activePointer.lastX);
    if (result.justArmed) {
      lastEvent = 'mecanism armat';
      publishCore('arm');
      renderCoreState();
      updateDebug();
    }
  }
  activePointer.lastX = event.clientX;
}

function onCanvasPointerUp(event) {
  if (experience === 'atlas') {
    if (!atlasPointer || event.pointerId !== atlasPointer.id) return;
    const gesture = atlasPointer;
    atlasPointer = null;
    if (targetRoot?.visible && performance.now() - gesture.time < 550 &&
        Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 14) {
      pickAtlasBuilding(event.clientX, event.clientY);
    }
    return;
  }
  if (!activePointer || event.pointerId !== activePointer.id) return;
  const gesture = activePointer;
  activePointer = null;
  if (gesture.axis === 'section' && found) {
    artifact.scrubSection(gesture.sectionStart - (event.clientY - gesture.startY) / 170);
    changeSection(artifact.sectionAmount >= .45);
    return;
  }
  if (!found || gesture.dragging || Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 14) return;
  if (gesture.node >= 0) {
    activateNode(gesture.node);
  } else if (gesture.onCore) {
    if (artifact.isComplete && (!gesture.part || gesture.part.userData.partId === 'crystal')) {
      artifact.pulse();
      lastEvent = 'impuls core';
      publishCore('pulse');
    } else if (gesture.part) {
      const label = artifact.selectPart(gesture.part);
      if (label) {
        lastEvent = `piesă: ${label}`;
        $('instruction').textContent = `${label} · mișcă telefonul lateral ca să vezi forma.`;
      }
    } else if (artifact.isArmed) {
      $('instruction').textContent = 'Atinge punctele de pe obiect sau folosește 01–03 de jos.';
    } else {
      const open = artifact.toggle();
      lastEvent = open ? 'core deschis' : 'core închis';
      publishCore(open ? 'open' : 'close');
      renderCoreState();
    }
  }
  updateDebug();
}

if (phoneMode) {
  let cameraWasInterrupted = false;
  const restoreCameraView = () => {
    if (!cameraWasInterrupted || !targetRoot) return;
    cameraWasInterrupted = false;
    found = false;
    hasPose = false;
    lossStartedAt = 0;
    targetRoot.visible = false;
    if (experience === 'atlas') {
      atlasRecentering = true;
      $('live').dataset.recentering = 'true';
      updateAtlasPins(performance.now());
    }
    closeAtlasInfo();
    lastEvent = 'camera reluată';
    setStatus('REÎNCADREAZĂ', 'searching', `Reîncadrează posterul ${experienceCopy[experience].label} întreg pe laptop.`);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cameraWasInterrupted = !!targetRoot;
    else restoreCameraView();
  });
  window.addEventListener('pagehide', () => { cameraWasInterrupted = !!targetRoot; });
  window.addEventListener('pageshow', event => { if (event.persisted) restoreCameraView(); });
  if (experience === 'core') session.start();
  if (experience === 'atlas') { setupAtlasPins(); setupAtlasRoutes(); }
  $('atlas-recenter').addEventListener('click', () => {
    if (experience !== 'atlas') return;
    atlasRecentering = true;
    $('live').dataset.recentering = 'true';
    closeAtlasInfo();
    setStatus('REÎNCADREAZĂ', 'grace', 'Ține posterul CAMPUS întreg în cameră până când macheta se fixează din nou.');
  });
  $('start-ar').addEventListener('click', startAR);
  $('restart').addEventListener('click', () => {
    if (experience !== 'core') return location.reload();
    if (!artifact?.isComplete) return location.reload();
    artifact.reset();
    lastEvent = 'ciclu reluat';
    publishCore('reset');
    renderCoreState();
    updateDebug();
  });
  $('retry').addEventListener('click', () => location.reload());
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  canvas.addEventListener('pointermove', onCanvasPointerMove);
  canvas.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('pointercancel', () => {
    if (activePointer?.axis === 'section') changeSection(artifact.sectionAmount >= .5);
    activePointer = null;
    atlasPointer = null;
  });
  $('node-controls').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-node]');
    if (button) activateNode(Number(button.dataset.node));
  });
  $('section-toggle').addEventListener('click', () => changeSection(!artifact?.isSectionOpen));
} else {
  if (experience === 'core') session.start();
  $('focus-target').addEventListener('click', () => document.body.classList.add('target-focus'));
  $('exit-focus').addEventListener('click', () => document.body.classList.remove('target-focus'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.body.classList.remove('target-focus');
  });
  $('copy-link').addEventListener('click', async () => {
    if (experience === 'core' && !session.code) {
      $('copy-status').textContent = 'Conexiunea se pregătește. Încearcă din nou în câteva secunde.';
      return;
    }
    const url = experience === 'core' ? new URL('./choose.html', location.href) : new URL('./', location.href);
    url.search = experience === 'core'
      ? `?room=${session.code}&v=34`
      : `?mode=phone&experience=${experience === 'atlas' ? 'campus' : experience}&v=34`;
    try {
      await navigator.clipboard.writeText(url.href);
      $('copy-status').textContent = 'Link copiat. Trimite-l pe iPhone și deschide-l în Safari.';
    } catch {
      $('copy-status').textContent = `Copiază manual: ${url.href}`;
    }
  });
}

window.__RIFT_NEXT__ = { startAR, getState: () => ({ experience, found, foundCount, updates, lastEvent, targetName, lostCount, recoveredCount, trackingMode, room: session.code, syncState: session.state, visible: !!targetRoot?.visible, anchorSized, atlasRouteLabel, coreOpen: !!artifact?.isOpen, armed: !!artifact?.isArmed, progress: artifact?.progress ?? 0, complete: !!artifact?.isComplete, sectionOpen: !!artifact?.isSectionOpen, modelName: artifact?.root?.name || experience, modelRotationX: artifact?.root?.rotation.x, modelPositionY: artifact?.root?.position.y, modelPositionZ: artifact?.root?.position.z, riverOffset: artifact?.riverOffset, plasmaTime: artifact?.plasmaTime, poseZ: targetRoot?.position.z, poseScale: targetRoot?.scale.x }) };
