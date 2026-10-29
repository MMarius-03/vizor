import { applyEvent, FREQUENCIES, initialState } from './protocol.js';

const $ = (id) => document.getElementById(id);
const query = new URLSearchParams(location.search);
const mode = query.get('mode') || (/iPhone|Android|Mobile/i.test(navigator.userAgent) ? 'phone' : 'console');
const apiBase = location.hostname === 'mmarius-03.github.io' ? 'https://rift-sync-api.grassyyew19.chatgpt.site' : '';
document.body.dataset.mode = mode === 'phone' ? 'phone' : 'console';

let state = initialState();
let room = null;
let syncTimer = null;
let polling = false;
let portal = null;
let arStarted = false;
let trackingGood = false;
let preview = false;
let audioContext = null;
let arFailed = false;
let messageUntil = 0;
let holdFrame = 0;
let holdStart = 0;
let holdPointer = null;
const canvas = $('ar-canvas');

const phaseNames = { idle: 'NEINIȚIATĂ', armed: 'AȘTEAPTĂ PLASAREA', placed: 'RUPTURĂ ACTIVĂ', stable: 'STABILIZATĂ', sealed: 'ÎNCHISĂ' };
const messages = {
  idle: 'Sistemul așteaptă activarea.',
  armed: 'Pe iPhone, atinge un loc liber pe podea.',
  placed: 'Reglează frecvența și atinge nodurile în AR.',
  stable: 'Pe iPhone, ține apăsat pe nucleu pentru a închide ruptura.',
  sealed: 'Ruptura a fost închisă. Experiment complet.',
};

function setMessage(message, error = false) {
  if (mode === 'phone') {
    $('phone-message').textContent = message;
    $('phone-message').classList.toggle('error', error);
    messageUntil = performance.now() + (error ? 3500 : 2200);
  } else $('console-message').textContent = message;
}

function unlockAudio() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  } catch { /* Sound is optional. */ }
}

function tone(frequency = 280, duration = 0.15, type = 'sine') {
  if (!audioContext || audioContext.state !== 'running') return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.6), audioContext.currentTime + duration);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration + 0.01);
}

function applyState(next) {
  if (!next || next.revision < state.revision) return;
  const previous = state;
  state = next;
  if (next.revision > previous.revision && next.lastAction !== 'frequency') {
    if (next.lastAction.startsWith('node:')) tone(450 + Number(next.lastAction.at(-1)) * 90, 0.24);
    else if (next.lastAction === 'seal') tone(700, 0.6);
  }
  if (mode === 'console') renderConsole(); else renderPhone();
  portal?.setState(state);
}

async function sendEvent(event) {
  if (!room) {
    const result = applyEvent(state, event);
    if (result.accepted) applyState(result.state);
    else setMessage(result.reason, true);
    return result;
  }
  try {
    const response = await fetch(`${apiBase}/api/room/${room}/event`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event),
    });
    const result = await response.json();
    if (result.state) applyState(result.state);
    if (!response.ok) setMessage(result.error || 'Acțiunea nu a fost acceptată.', true);
    return { accepted: response.ok, reason: result.error };
  } catch {
    setMessage('Conexiunea s-a pierdut. Verifică serverul de pe laptop.', true);
    return { accepted: false };
  }
}

async function pollRoom() {
  if (!room || polling) return;
  polling = true;
  try {
    const response = await fetch(`${apiBase}/api/room/${room}?role=${mode}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('offline');
    const data = await response.json();
    applyState(data.state);
    if (mode === 'console') {
      $('connection-led').textContent = data.presence.phone ? '● IPHONE CONECTAT' : '● AȘTEPTARE IPHONE';
      $('connection-led').classList.toggle('online', data.presence.phone);
    } else $('room-chip').textContent = room;
  } catch {
    if (mode === 'console') { $('connection-led').textContent = '● FĂRĂ CONEXIUNE'; $('connection-led').classList.remove('online'); }
    else $('room-chip').textContent = 'OFFLINE';
  } finally { polling = false; }
}

function subscribe(code) {
  room = code;
  clearInterval(syncTimer);
  pollRoom();
  syncTimer = setInterval(pollRoom, 1000);
}

function renderConsole() {
  $('console-screen').dataset.phase = state.phase;
  $('frequency-value').textContent = `${Math.round(state.frequency * 100)}%`;
  if (document.activeElement !== $('frequency')) $('frequency').value = Math.round(state.frequency * 100);
  const count = state.nodes.filter(Boolean).length;
  $('stage-percent').textContent = `0${count} / 03 STABILIZATE`;
  $('stage-status').textContent = state.phase === 'idle' ? 'SISTEM ÎN STANDBY' : phaseNames[state.phase];
  $('arm-button').disabled = !['idle', 'sealed'].includes(state.phase);
  $('arm-label').textContent = state.phase === 'sealed' ? 'DESCHIDE DIN NOU' : 'DESCHIDE RUPTURA';
  $('frequency').disabled = !['armed', 'placed', 'stable'].includes(state.phase);
  $('reset-button').disabled = state.phase === 'idle';
  $('console-message').textContent = messages[state.phase];
}

function renderPhone() {
  $('phone-screen').dataset.phase = state.phase;
  $('phone-phase').textContent = phaseNames[state.phase];
  const count = state.nodes.filter(Boolean).length;
  $('phone-count').textContent = `${count} / 3`;
  $('phone-frequency-value').textContent = `${Math.round(state.frequency * 100)}%`;
  if (document.activeElement !== $('phone-frequency')) $('phone-frequency').value = Math.round(state.frequency * 100);
  for (const [index, active] of state.nodes.entries()) document.querySelector(`.phone-node-list [data-node="${index}"]`).classList.toggle('active', active);
  $('solo-frequency').hidden = Boolean(room) || state.phase === 'idle' || state.phase === 'sealed';
  const tips = {
    idle: room ? 'Așteaptă activarea de pe laptop.' : 'Apasă pentru a deschide portalul.',
    armed: 'Atinge podeaua pentru a plasa portalul.',
    placed: room ? 'Ajustează frecvența pe laptop, apoi atinge nodurile.' : 'Ajustează frecvența, apoi atinge nodurile.',
    stable: 'Ține apăsat pe nucleul portalului.',
    sealed: 'Experiment complet. Atinge ↻ pentru un nou început.',
  };
  $('interaction-tip').textContent = tips[state.phase];
  if (performance.now() > messageUntil) {
    $('phone-message').textContent = '';
    $('phone-message').classList.remove('error');
  }
}

async function initConsole() {
  renderConsole();
  try {
    const response = await fetch(`${apiBase}/api/room`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error('offline');
    const data = await response.json();
    room = data.code;
    state = data.state;
    $('room-code').textContent = room;
    $('copy-link').disabled = false;
    $('room-help').textContent = 'Pe iPhone deschizi aceeași adresă HTTPS, alegi modul iPhone și introduci acest cod.';
    subscribe(room);
    renderConsole();
  } catch {
    $('room-code').textContent = 'SOLO';
    $('room-help').textContent = 'Serviciul de sincronizare nu răspunde. Poți explora solo și încerca din nou mai târziu.';
    $('connection-led').textContent = '● OFFLINE';
  }
  $('arm-button').addEventListener('click', () => { unlockAudio(); sendEvent({ type: 'arm' }); });
  $('reset-button').addEventListener('click', () => sendEvent({ type: 'reset' }));
  $('frequency').addEventListener('input', (event) => { $('frequency-value').textContent = `${event.target.value}%`; });
  $('frequency').addEventListener('change', (event) => sendEvent({ type: 'frequency', value: Number(event.target.value) / 100 }));
  $('copy-link').addEventListener('click', async () => {
    const url = new URL(location.href);
    url.search = `?mode=phone&room=${room}`;
    try {
      await navigator.clipboard.writeText(url.href);
      $('copy-link').textContent = 'COPIAT ✓';
      if (/localhost|127\.0\.0\.1/.test(url.hostname)) $('room-help').textContent = 'Linkul localhost funcționează doar pe laptop. Deschide consola prin adresa HTTPS temporară înainte de a-l copia pentru iPhone.';
      setTimeout(() => { $('copy-link').textContent = 'Copiază linkul ↗'; }, 2000);
    } catch { $('room-help').textContent = 'Copierea automată nu a mers; trimite manual linkul HTTPS și codul.'; }
  });
}

async function joinRoom() {
  const code = $('phone-room').value.trim().toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
  if (code.length !== 6) { $('join-message').textContent = 'Introdu codul de 6 caractere de pe laptop.'; $('join-message').classList.add('error'); return; }
  try {
    const response = await fetch(`${apiBase}/api/room/${code}?role=phone`);
    if (!response.ok && response.headers.get('content-type')?.includes('text/html')) throw new Error('Sincronizarea nu este disponibilă pe acest link. Poți porni experiența solo.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Codul nu este valid.');
    room = code;
    state = initialState();
    applyState(data.state);
    subscribe(code);
    $('join-message').textContent = `Conectat la consola ${code}. Frecvența se controlează pe laptop.`;
    $('join-message').classList.remove('error');
    $('room-chip').textContent = code;
  } catch (error) { $('join-message').textContent = error instanceof SyntaxError ? 'Sincronizarea nu este disponibilă pe acest link. Poți porni experiența solo.' : error.message; $('join-message').classList.add('error'); }
}

function setTracking(good, label) {
  trackingGood = good;
  $('tracking-dot').classList.toggle('good', good);
  $('tracking-label').textContent = label;
}

function reportArFailure(message) {
  if (arFailed) return;
  arFailed = true;
  trackingGood = false;
  window.XR8?.stop?.();
  $('phone-hud').hidden = true;
  $('phone-error-message').textContent = message;
  $('phone-error').hidden = false;
}

async function loadArEngine() {
  if (window.XR8) return window.XR8;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js';
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.preloadChunks = 'slam';
  document.head.append(script);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Motorul AR nu a răspuns.')), 20000);
    const finish = () => { clearTimeout(timeout); resolve(window.XR8); };
    window.addEventListener('xrloaded', finish, { once: true });
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Nu se poate încărca motorul AR.')); };
    script.onload = () => { if (window.XR8) finish(); };
  });
}

async function startAR(THREE, createPortal) {
  if (!window.isSecureContext) throw new Error('Camera AR are nevoie de HTTPS.');
  setTracking(false, 'PORNIRE CAMERĂ...');
  const XR8 = await loadArEngine();
  if (!XR8?.Threejs || !XR8?.XrController) throw new Error('Motorul AR nu este disponibil pe acest dispozitiv.');
  XR8.XrController.configure({ scale: 'absolute' });
  let last = performance.now();
  const sceneModule = {
    name: 'rift-scene',
    onCameraStatusChange: ({ status }) => {
      if (status === 'failed') reportArFailure('Camera nu a pornit. Verifică permisiunea în Safari și reîncarcă pagina.');
    },
    onException: () => reportArFailure('Motorul AR s-a oprit. Reîncarcă pagina și încearcă din nou.'),
    onStart: () => {
      const { scene, camera, renderer } = XR8.Threejs.xrScene();
      scene.add(new THREE.AmbientLight(0xc3eaff, 1.2));
      const fill = new THREE.DirectionalLight(0xa9dfff, 1.25);
      fill.position.set(2, 3, 2);
      scene.add(fill);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      camera.position.set(0, 1.5, 2.5);
      XR8.XrController.updateCameraProjectionMatrix({ origin: camera.position, facing: camera.quaternion });
      portal = createPortal(scene, camera);
      portal.setState(state);
      setTracking(false, 'MIȘCĂ UȘOR TELEFONUL');
    },
    onUpdate: ({ processCpuResult }) => {
      const now = performance.now();
      portal?.update((now - last) / 1000);
      last = now;
      const status = processCpuResult?.reality?.trackingStatus;
      if (status === 'NORMAL' && !trackingGood) setTracking(true, 'SPAȚIU IDENTIFICAT');
      else if (status === 'LIMITED' && trackingGood) setTracking(false, 'MIȘCĂ UȘOR TELEFONUL');
    },
  };
  XR8.addCameraPipelineModules([
    XR8.GlTextureRenderer.pipelineModule(),
    XR8.Threejs.pipelineModule(),
    XR8.XrController.pipelineModule(),
    sceneModule,
  ]);
  XR8.run({ canvas, cameraConfig: { direction: XR8.XrConfig.camera().BACK } });
}

function startDemo(THREE, createPortal) {
  preview = true;
  $('phone-screen').classList.add('preview');
  $('phone-mode-tag').textContent = 'DEMO / FĂRĂ AR';
  setTracking(true, 'PREVIEW 3D');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xc5ebff, 1.4));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(2, 4, 3);
  scene.add(light);
  const floor = new THREE.GridHelper(12, 24, 0x4eabbc, 0x254859);
  floor.material.transparent = true;
  floor.material.opacity = 0.24;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.01, 100);
  camera.position.set(0, 1.55, 4.2);
  camera.lookAt(0, 1.05, 0);
  portal = createPortal(scene, camera);
  portal.setState(state);
  const resize = () => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  let previous = performance.now();
  const tick = (now) => {
    if (!preview) return;
    portal.update((now - previous) / 1000);
    previous = now;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function startExperience(demo) {
  if (arStarted) return;
  arStarted = true;
  unlockAudio();
  $('phone-screen').classList.add('started');
  $('phone-intro').hidden = true;
  $('phone-hud').hidden = false;
  if (!room && state.phase === 'idle') await sendEvent({ type: 'arm' });
  try {
    const THREE = await import('three');
    window.THREE = THREE;
    const { createPortal } = await import('./portal.js?v=2');
    if (demo) startDemo(THREE, createPortal);
    else await startAR(THREE, createPortal);
    canvas.addEventListener('pointerdown', onCanvasDown);
    canvas.addEventListener('pointerup', cancelHold);
    canvas.addEventListener('pointercancel', cancelHold);
    canvas.addEventListener('pointermove', (event) => {
      if (holdPointer && Math.hypot(event.clientX - holdPointer.x, event.clientY - holdPointer.y) > 35) cancelHold();
    });
  } catch (error) {
    arStarted = false;
    $('phone-screen').classList.remove('started');
    $('phone-intro').hidden = false;
    $('phone-hud').hidden = true;
    $('join-message').textContent = `${error.message} Poți încerca demo-ul 3D.`;
    $('join-message').classList.add('error');
  }
}

function cancelHold() {
  if (holdFrame) cancelAnimationFrame(holdFrame);
  holdFrame = 0;
  holdPointer = null;
  $('hold-track').classList.remove('visible');
  $('hold-track').firstElementChild.style.width = '0%';
}

function beginHold(event) {
  holdPointer = { x: event.clientX, y: event.clientY };
  holdStart = performance.now();
  $('hold-track').classList.add('visible');
  const step = (now) => {
    const progress = Math.min(1, (now - holdStart) / 1450);
    $('hold-track').firstElementChild.style.width = `${Math.round(progress * 100)}%`;
    if (progress >= 1) {
      cancelHold();
      sendEvent({ type: 'seal' });
      return;
    }
    holdFrame = requestAnimationFrame(step);
  };
  holdFrame = requestAnimationFrame(step);
}

async function onCanvasDown(event) {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  unlockAudio();
  if (!portal) return;
  if (!preview && !trackingGood) { setMessage('Mișcă lent telefonul până când spațiul este identificat.', true); return; }
  if (!portal.placed && ['armed', 'placed', 'stable'].includes(state.phase)) {
    const point = preview ? new window.THREE.Vector3(0, 0, 0) : portal.groundPoint(event.clientX, event.clientY, canvas);
    if (!point) { setMessage('Atinge podeaua la 2–4 metri în fața ta.', true); return; }
    const result = state.phase === 'armed' ? await sendEvent({ type: 'place' }) : { accepted: true };
    if (result.accepted) { portal.place(point); portal.setState(state); tone(240, 0.35); }
    return;
  }
  if (state.phase !== 'placed' && state.phase !== 'stable') return;
  const picked = portal.pick(event.clientX, event.clientY, canvas);
  if (picked?.kind === 'node') {
    const result = await sendEvent({ type: 'node', index: picked.index });
    if (!result.accepted) tone(105, 0.18, 'triangle');
  } else if (picked?.kind === 'core' && state.phase === 'stable') beginHold(event);
  else if (state.phase === 'stable') setMessage('Ține apăsat chiar pe centrul portalului.');
  else setMessage('Atinge unul dintre cele trei cristale de pe margine.');
}

function initPhone() {
  renderPhone();
  $('phone-room').value = (query.get('room') || '').toUpperCase();
  if (query.get('room')) joinRoom();
  $('join-button').addEventListener('click', joinRoom);
  $('phone-room').addEventListener('keydown', (event) => { if (event.key === 'Enter') joinRoom(); });
  $('start-ar').addEventListener('click', () => startExperience(false));
  $('start-demo').addEventListener('click', () => startExperience(true));
  $('phone-frequency').addEventListener('input', (event) => { $('phone-frequency-value').textContent = `${event.target.value}%`; });
  $('phone-frequency').addEventListener('change', (event) => sendEvent({ type: 'frequency', value: Number(event.target.value) / 100 }));
  $('phone-reset').addEventListener('click', async () => {
    cancelHold();
    await sendEvent({ type: 'reset' });
    if (!preview) window.XR8?.XrController?.recenter?.();
    if (!room) await sendEvent({ type: 'arm' });
    if (preview && portal) {
      portal.place(new window.THREE.Vector3(0, 0, 0));
      await sendEvent({ type: 'place' });
    }
  });
}

if (mode === 'phone') initPhone(); else initConsole();
window.riftDebug = { getState: () => state, getRoom: () => room, sendEvent };
