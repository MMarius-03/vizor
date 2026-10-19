const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const freshHand = () => ({ point: null, wrist: null, palm: null, openPalm: false, seen: 0, pinching: false, armed: false, openSince: 0, changeSince: 0, ratio: 1, target: null, targetSince: 0, targetAt: 0, targetPoint: null });

// Kept separate from the camera lifecycle so gesture transitions can be checked
// with landmark sequences, without asking for a camera or rendering the engine.
export function createGestureSession({ project, resolve, grab, move, release, navigate, feedback, navigationLock = () => {} }) {
  let hands = [freshHand(), freshHand()];
  let action = null;
  let navigation = null;
  let openNav = null;
  let twoHandLock = false;
  let blockedUntilOpen = false;
  let lastTick = 0;

  function reset() {
    if (action) release();
    action = navigation = openNav = null;
    twoHandLock = false;
    navigationLock(false);
    blockedUntilOpen = false;
    hands = [freshHand(), freshHand()];
    resolve(null);
    feedback({ mode: "searching", hands: [] });
  }

  function sample(track, landmarks, now, dt) {
    if (now - track.seen > 380) Object.assign(track, freshHand());
    const raw = project(landmarks[8]);
    track.wrist = project(landmarks[0]);
    track.palm = project(landmarks[9]);
    track.openPalm = [8, 12, 16, 20].every((tip, index) =>
      distance(project(landmarks[tip]), track.wrist) > distance(project(landmarks[[6, 10, 14, 18][index]]), track.wrist) * 1.12);
    const palm = Math.max(16, distance(track.wrist, project(landmarks[9])));
    const ratio = distance(project(landmarks[4]), raw) / palm;
    track.ratio += (ratio - track.ratio) * .68;
    if (!track.point) track.point = { ...raw };
    else {
      // Adaptive smoothing: steady at rest, responsive during intentional motion.
      const delta = distance(raw, track.point);
      const alpha = 1 - Math.exp(-dt * (6 + Math.min(40, delta * .7)));
      if (delta > 1.2) { track.point.x += (raw.x - track.point.x) * alpha; track.point.y += (raw.y - track.point.y) * alpha; }
    }
    if (track.ratio > .64) {
      track.openSince ||= now;
      if (now - track.openSince > 90) track.armed = true;
    } else track.openSince = 0;
    const closed = track.ratio < (track.pinching ? .58 : .36);
    let edge = null;
    if (closed !== track.pinching) {
      track.changeSince ||= now;
      if (now - track.changeSince >= (closed ? 70 : 55)) {
        track.pinching = closed;
        track.changeSince = 0;
        edge = closed ? "close" : "open";
      }
    } else track.changeSince = 0;
    track.seen = now;
    return edge;
  }

  function update(landmarks, now) {
    const dt = Math.min(.1, Math.max(.016, (now - lastTick) / 1000 || .05));
    lastTick = now;
    // Match by wrist proximity, not the detector's changing result-array order.
    const detected = landmarks.slice(0, 2);
    const assignments = [null, null];
    if (detected.length === 2) {
      const wrists = detected.map((hand) => project(hand[0]));
      const cost = (slot, index) => hands[slot].wrist ? distance(hands[slot].wrist, wrists[index]) : 0;
      if (cost(0, 1) + cost(1, 0) < cost(0, 0) + cost(1, 1)) detected.reverse();
      assignments[0] = detected[0]; assignments[1] = detected[1];
    } else if (detected.length) {
      const wrist = project(detected[0][0]);
      const secondaryCloser = hands[1].wrist && now - hands[1].seen < 380 && (!hands[0].wrist || distance(wrist, hands[1].wrist) + 35 < distance(wrist, hands[0].wrist));
      assignments[secondaryCloser ? 1 : 0] = detected[0];
    }
    // Promote the remaining hand only after releasing the previous interaction.
    if (!assignments[0] && assignments[1] && now - hands[0].seen > 380) {
      if (action) release();
      action = navigation = openNav = null;
      hands = [freshHand(), freshHand()];
      assignments[0] = assignments[1]; assignments[1] = null;
      resolve(null);
    }
    const edges = assignments.map((hand, i) => hand ? sample(hands[i], hand, now, dt) : null);
    const primary = hands[0], secondary = hands[1];
    const visible = hands.filter((hand) => hand.point && now - hand.seen < 380);
    // Two hands reserve the scene for navigation, even before the second pinch.
    // Hold that lock through brief tracking loss; returning to parts requires
    // one remaining hand to be visibly open, never a timeout while still closed.
    if (visible.length > 1 && !twoHandLock) {
      twoHandLock = true;
      if (action && action.kind !== "ui" && action.kind !== "range") { release(); action = null; }
      primary.target = null;
      resolve(null);
      navigationLock(true);
    } else if (twoHandLock && !assignments[1] && now - secondary.seen >= 380 && assignments[0]
      && !primary.pinching && primary.openSince && now - primary.openSince >= 90) {
      twoHandLock = false;
      navigationLock(false);
      primary.target = null;
    }
    if (!assignments[0]) {
      if (now - primary.seen > 380) {
        if (action) release();
        action = navigation = null;
        primary.armed = false; primary.target = null;
        resolve(null);
      }
      openNav = null;
      feedback({ mode: visible.length ? "lost" : "searching", hands: visible, now });
      return;
    }
    if (blockedUntilOpen) {
      if (!primary.pinching && (!assignments[1] || !secondary.pinching)) blockedUntilOpen = false;
      else { feedback({ mode: "open", hands: visible, now }); return; }
    }
    const both = assignments[1] && primary.armed && secondary.armed && primary.pinching && secondary.pinching;
    if (both && action?.kind !== "ui" && action?.kind !== "range") {
      const center = { x: (primary.point.x + secondary.point.x) / 2, y: (primary.point.y + secondary.point.y) / 2 };
      const span = Math.max(50, distance(primary.point, secondary.point));
      if (!navigation) {
        if (action) release();
        action = null;
        resolve(null);
      } else navigate(center.x - navigation.x, center.y - navigation.y, navigation.span / span);
      navigation = { ...center, span };
      feedback({ mode: "navigate", hands: visible, now });
      return;
    }
    if (navigation) {
      navigation = null;
      blockedUntilOpen = true;
      feedback({ mode: "open", hands: visible, now });
      return;
    }
    // Open palm is navigation, pointing then pinching is manipulation. Keeping
    // these poses distinct avoids accidentally extracting a part while orbiting.
    if (primary.openPalm && !primary.pinching && !assignments[1] && !action) {
      if (openNav && now - openNav.since >= 120) navigate(primary.palm.x - openNav.x, primary.palm.y - openNav.y, 1);
      openNav = { x: primary.palm.x, y: primary.palm.y, since: openNav?.since || now };
      primary.target = null;
      resolve(null);
      feedback({ mode: "palm", hands: visible, now });
      return;
    }
    openNav = null;
    if (edges[0] === "open" && action) {
      release(); action = null;
      primary.target = null;
    }
    if (!primary.pinching && !action && primary.ratio > .55) {
      let target = resolve(primary.point);
      if (twoHandLock && target?.kind !== "ui" && target?.kind !== "range") {
        target = null;
        resolve(null);
      }
      if (target?.id !== primary.target?.id) primary.targetSince = now;
      primary.target = target;
      primary.targetAt = now;
      primary.targetPoint = { ...primary.point };
    }
    if (edges[0] === "close" && primary.armed && !action) {
      // Keep only the immediately hovered target during finger closure. Never
      // fall back to a previously selected part elsewhere in the scene.
      const aimed = primary.target && now - primary.targetAt < 900 && now - primary.targetSince >= 90 && distance(primary.point, primary.targetPoint) < 65;
      if (aimed && (!twoHandLock || primary.target.kind === "ui" || primary.target.kind === "range")) {
        action = grab(primary.point.x, primary.point.y, primary.target) || null;
      }
    }
    if (action) move(primary.point.x, primary.point.y);
    const ready = primary.target && now - primary.targetSince >= 90 && now - primary.targetAt < 900;
    feedback({ mode: action ? "holding" : twoHandLock && !ready ? "rotation-ready" : !primary.armed || primary.pinching ? "open" : ready ? "ready" : "aim", hands: visible, now, target: primary.target, action });
  }
  return { update, reset };
}

export function createHandControl({ video, stage, toggle, switchButton, facingLabel, gestureToggle, fitButton, cameraDetails, cursor, secondCursor, status, trackingLabel, trackingStatus, toast, onHover, onGrab, onMove, onRelease, onNavigate, onNavigationLock }) {
  const state = { tracker: null, stream: null, facing: "environment", cover: false, token: 0, trackingToken: 0, busy: false, trackingBusy: false, touchActive: false, lastFrame: -1, lastDetection: 0, status: "", stalled: false, debug: "camera oprită" };
  const session = createGestureSession({
    project: screenPoint, resolve: onHover, grab: onGrab, move: onMove, release: onRelease, navigate: onNavigate, navigationLock: onNavigationLock,
    feedback: ({ mode, hands, now = performance.now(), target, action }) => {
      state.debug = state.touchActive ? "touch activ" : `mâini ${hands.length} · ${mode} · pinch ${hands[0]?.ratio.toFixed(2) || "—"} · ${target?.label || "fără țintă"}`;
      const hints = { searching: "Arată mâna în cadru sau folosește ecranul.", lost: "Mâna a ieșit din cadru. Piesa rămâne pe loc.", open: "Arată o piesă cu arătătorul, apoi fă pinch.", aim: "Indică o piesă până apare conturul.", ready: target?.kind === "orbit" ? "Fă pinch pentru rotire sau deschide palma." : `Țintă: ${target?.label || "piesă"} · fă pinch pentru prindere.`, holding: action?.kind === "ui" ? "Deschide degetele înainte de următoarea comandă." : action?.kind === "orbit" ? "Rotești motorul · piesele rămân blocate." : "Piesă prinsă · deschide degetele ca s-o lași.", palm: "Palmă deschisă · rotești motorul, piesele sunt blocate.", "rotation-ready": "Două mâini · piesele sunt blocate.", navigate: "Două mâini · rotire / zoom, piesele blocate." };
      if (state.stream && state.tracker && !state.touchActive) {
        setStatus(hints[mode], hands.length ? "tracking" : "searching", hands.length > 1 ? "2 mâini" : hands.length ? "Mână detectată" : "Caut mâna");
      }
      [cursor, secondCursor].forEach((element, index) => {
        const hand = hands[index];
        element.hidden = !hand;
        if (!hand) return;
        const rect = stage.getBoundingClientRect();
        element.style.left = `${hand.point.x - rect.left}px`;
        element.style.top = `${hand.point.y - rect.top}px`;
        element.style.setProperty("--pinch", `${Math.max(0, Math.min(1, (.85 - hand.ratio) / .55)) * 360}deg`);
        element.classList.toggle("is-pinching", hand.pinching);
        element.classList.toggle("is-ready", mode === "ready" || mode === "holding" || mode === "navigate");
        element.classList.toggle("is-navigating", mode === "palm" || mode === "navigate");
        element.classList.toggle("is-lost", now - hand.seen > 110);
      });
      cursor.querySelector("span").textContent = mode === "ready" ? target?.label || "Prinde" : mode === "palm" ? "Rotire" : mode === "navigate" ? "Rotire / zoom" : "";
    },
  });
  function setStatus(message, kind, label) {
    if (state.status !== message) { status.textContent = message; state.status = message; }
    trackingStatus.dataset.state = kind;
    trackingLabel.textContent = label;
  }
  function refreshButtons() {
    const active = Boolean(state.stream);
    toggle.disabled = state.busy;
    switchButton.disabled = state.busy || state.trackingBusy || !active;
    gestureToggle.disabled = state.busy || state.trackingBusy || !active;
    gestureToggle.setAttribute("aria-pressed", String(Boolean(state.tracker)));
    gestureToggle.setAttribute("aria-label", state.tracker ? "Oprește gesturile în cameră" : "Activează gesturile în cameră");
    gestureToggle.dataset.hand = state.tracker ? "Oprește gesturile în cameră" : "Activează gesturile în cameră";
    gestureToggle.querySelector("small").textContent = state.trackingBusy ? "Pregătesc" : state.tracker ? "Active" : "Oprite";
    fitButton.disabled = state.busy || !active;
    fitButton.setAttribute("aria-pressed", String(state.cover));
    fitButton.querySelector("small").textContent = state.cover ? "Umple ecranul" : "Cadru complet";
    toggle.setAttribute("aria-pressed", String(active));
    toggle.querySelector("span").textContent = state.busy ? "Pregătesc..." : active ? "Camera activă" : "Pornește camera";
    toggle.setAttribute("aria-label", active ? "Oprește camera" : "Pornește camera");
    toggle.dataset.hand = active ? "Oprește camera" : "Pornește camera";
    stage.classList.toggle("has-camera", active);
    stage.dataset.facing = state.facing;
    stage.dataset.cameraFit = state.cover ? "cover" : "contain";
    facingLabel.textContent = state.facing === "user" ? "Față" : "Spate";
    cameraDetails.hidden = !active;
    if (active) {
      const settings = state.stream.getVideoTracks()[0]?.getSettings?.() || {};
      cameraDetails.textContent = `Flux: ${settings.width || video.videoWidth} × ${settings.height || video.videoHeight} · ${settings.frameRate || "?"} FPS · ${state.facing === "user" ? "față" : "spate"}`;
    }
  }
  function screenPoint(point) {
    const rect = stage.getBoundingClientRect();
    const scale = (state.cover ? Math.max : Math.min)(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const w = video.videoWidth * scale, h = video.videoHeight * scale;
    let x = (rect.width - w) / 2 + point.x * w;
    if (state.facing === "user") x = rect.width - x;
    return { x: rect.left + x, y: rect.top + (rect.height - h) / 2 + point.y * h };
  }
  async function openStream(facing, exact, token) {
    const portraitPhone = matchMedia("(pointer: coarse)").matches && stage.clientHeight > stage.clientWidth;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
      facingMode: exact ? { exact: facing } : { ideal: facing },
      width: { ideal: portraitPhone ? 540 : 960 }, height: { ideal: portraitPhone ? 960 : 720 },
      frameRate: { ideal: portraitPhone ? 24 : 30, max: 30 },
    } });
    if (token !== state.token) { stream.getTracks().forEach(track => track.stop()); return null; }
    try {
      video.srcObject = stream;
      await video.play();
      if (token !== state.token) { stream.getTracks().forEach(track => track.stop()); return null; }
      state.facing = stream.getVideoTracks()[0]?.getSettings?.().facingMode || facing;
      state.lastFrame = -1;
      return stream;
    } catch (error) { stream.getTracks().forEach(track => track.stop()); throw error; }
  }
  async function makeTracker() {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm");
    const files = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
    const options = { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" }, runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: .6, minTrackingConfidence: .6, minHandPresenceConfidence: .6 };
    try { return await vision.HandLandmarker.createFromOptions(files, options); }
    catch { delete options.baseOptions.delegate; return vision.HandLandmarker.createFromOptions(files, options); }
  }
  async function start() {
    if (state.busy || state.stream) return;
    const token = ++state.token;
    state.busy = true; refreshButtons();
    setStatus("Pregătesc camera...", "searching", "Pregătesc");
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera necesită HTTPS sau localhost.");
      stream = await openStream(state.facing, false, token);
      if (!stream) return;
      state.stream = stream;
      session.reset();
      state.debug = "camera + touch";
      setStatus("Camera activă · controlează motorul prin touch.", "tracking", "Touch + cameră");
      toast("Camera este activă. Gesturile cu mâna se pornesc separat din meniu.");
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (token === state.token) {
        video.srcObject = null;
        setStatus("Camera nu a pornit. Poți continua prin touch.", "off", "Touch activ");
        toast(error.name === "NotAllowedError" ? "Permite accesul la cameră în Safari pentru controlul cu mâinile." : error.message || "Camera nu a pornit.");
      }
    } finally { if (token === state.token) { state.busy = false; refreshButtons(); } }
  }
  async function startTracking() {
    if (!state.stream || state.busy || state.trackingBusy || state.tracker) return;
    const token = ++state.trackingToken, cameraToken = state.token;
    state.trackingBusy = true; refreshButtons();
    setStatus("Pregătesc detectorul de mâini...", "searching", "Pregătesc gesturi");
    let tracker;
    try {
      tracker = await makeTracker();
      if (token !== state.trackingToken || cameraToken !== state.token || !state.stream) { tracker.close(); return; }
      state.tracker = tracker;
      state.lastFrame = -1;
      session.reset();
      toast("Arată piesa cu arătătorul, apoi fă pinch. Palma deschisă rotește.");
    } catch (error) {
      tracker?.close();
      if (token === state.trackingToken) {
        setStatus("Gesturile nu au pornit. Touch-ul rămâne disponibil.", "tracking", "Touch + cameră");
        toast(error.message || "Nu am putut porni gesturile.");
      }
    } finally { if (token === state.trackingToken) { state.trackingBusy = false; refreshButtons(); } }
  }
  function stopTracking() {
    state.trackingToken += 1;
    state.tracker?.close(); state.tracker = null;
    state.trackingBusy = false;
    session.reset();
    refreshButtons();
    if (state.stream) setStatus("Camera activă · controlează motorul prin touch.", "tracking", "Touch + cameră");
  }
  function stop() {
    state.token += 1;
    stopTracking();
    state.stream?.getTracks().forEach(track => track.stop());
    video.srcObject?.getTracks().forEach(track => track.stop());
    video.srcObject = null; state.stream = null;
    state.busy = false;
    state.debug = "camera oprită";
    refreshButtons();
    setStatus("Trage o piesă sau apasă Rotire pentru a schimba vederea.", "off", "Atelier 3D");
  }
  async function switchCamera() {
    if (!state.stream || state.busy || state.trackingBusy) return;
    const token = ++state.token, previous = state.facing;
    state.busy = true; session.reset(); refreshButtons();
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null; video.srcObject = null;
    setStatus("Schimb camera...", "searching", "Schimb camera");
    try {
      const stream = await openStream(previous === "user" ? "environment" : "user", true, token);
      if (token === state.token) state.stream = stream;
    } catch {
      if (token !== state.token) return;
      try {
        const stream = await openStream(previous, true, token);
        if (token === state.token) { state.stream = stream; toast("Camera cerută nu este disponibilă. Am revenit la cea precedentă."); }
      } catch { if (token === state.token) { stop(); toast("Camera nu a putut fi reluată. Poți continua prin touch."); } }
    } finally {
      if (token === state.token) {
        state.busy = false; refreshButtons(); session.reset();
        if (state.stream && !state.tracker) setStatus("Camera activă · controlează motorul prin touch.", "tracking", "Touch + cameră");
      }
    }
  }
  function update(now) {
    if (state.busy || state.touchActive || !state.tracker) return;
    if (video.readyState < 2 || state.lastFrame === video.currentTime) {
      if (!state.stalled && now - state.lastDetection > 500) { session.reset(); state.stalled = true; }
      return;
    }
    if (now - state.lastDetection < 50) return;
    state.stalled = false;
    state.lastDetection = now; state.lastFrame = video.currentTime;
    try { session.update(state.tracker.detectForVideo(video, now).landmarks || [], now); }
    catch { stopTracking(); toast("Detecția mâinii s-a oprit. Poți continua prin touch."); }
  }
  function setTouchActive(active) {
    if (state.touchActive === active) return;
    state.touchActive = active;
    if (active) {
      session.reset(); state.debug = "touch activ";
      if (state.tracker) setStatus("Controlezi prin touch · gesturile sunt suspendate.", "tracking", "Touch activ");
    }
    else if (state.tracker) setStatus("Arată mâna în cadru sau folosește ecranul.", "searching", "Caut mâna");
    else state.debug = state.stream ? "camera + touch" : "camera oprită";
  }
  toggle.addEventListener("click", () => state.stream ? stop() : start());
  switchButton.addEventListener("click", switchCamera);
  gestureToggle.addEventListener("click", () => state.tracker ? stopTracking() : startTracking());
  fitButton.addEventListener("click", () => { state.cover = !state.cover; refreshButtons(); });
  window.addEventListener("pagehide", stop);
  return { update, stop, release: session.reset, setTouchActive, get active() { return Boolean(state.tracker); }, get cameraActive() { return Boolean(state.stream); }, get debug() { return state.debug; } };
}
