const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const freshHand = () => ({ point: null, wrist: null, seen: 0, pinching: false, armed: false, openSince: 0, changeSince: 0, ratio: 1, target: null, targetSince: 0, targetAt: 0, targetPoint: null });

// Kept separate from the camera lifecycle so gesture transitions can be checked
// with landmark sequences, without asking for a camera or rendering the engine.
export function createGestureSession({ project, resolve, grab, move, release, navigate, feedback }) {
  let hands = [freshHand(), freshHand()];
  let action = null;
  let navigation = null;
  let pendingGrab = null;
  let blockedUntilOpen = false;
  let lastTick = 0;

  function reset() {
    if (action) release();
    action = navigation = pendingGrab = null;
    blockedUntilOpen = false;
    hands = [freshHand(), freshHand()];
    resolve(null);
    feedback({ mode: "searching", hands: [] });
  }

  function sample(track, landmarks, now, dt) {
    if (now - track.seen > 380) Object.assign(track, freshHand());
    const raw = project(landmarks[8]);
    track.wrist = project(landmarks[0]);
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
      action = navigation = pendingGrab = null;
      hands = [freshHand(), freshHand()];
      assignments[0] = assignments[1]; assignments[1] = null;
      resolve(null);
    }
    const edges = assignments.map((hand, i) => hand ? sample(hands[i], hand, now, dt) : null);
    const primary = hands[0], secondary = hands[1];
    const visible = hands.filter((hand) => hand.point && now - hand.seen < 380);
    if (!assignments[0]) {
      if (now - primary.seen > 380) {
        if (action) release();
        action = navigation = pendingGrab = null;
        primary.armed = false; primary.target = null;
        resolve(null);
      }
      feedback({ mode: visible.length ? "lost" : "searching", hands: visible, now });
      return;
    }
    if (blockedUntilOpen) {
      if (!primary.pinching && (!assignments[1] || !secondary.pinching)) blockedUntilOpen = false;
      else { feedback({ mode: "open", hands: visible, now }); return; }
    }
    const both = assignments[1] && primary.armed && secondary.armed && primary.pinching && secondary.pinching;
    if (both && action?.kind !== "ui" && action?.kind !== "range") {
      pendingGrab = null;
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
    if (edges[0] === "open" && action) {
      release(); action = null;
      primary.target = null;
    }
    if (!primary.pinching) pendingGrab = null;
    if (!primary.pinching && !action && primary.ratio > .55) {
      const target = resolve(primary.point);
      if (target?.id !== primary.target?.id) primary.targetSince = now;
      primary.target = target;
      primary.targetAt = now;
      primary.targetPoint = { ...primary.point };
    }
    if (edges[0] === "close" && primary.armed && !action) {
      // Keep only the immediately hovered target during finger closure. Never
      // fall back to a previously selected part elsewhere in the scene.
      const aimed = primary.target && now - primary.targetAt < 900 && now - primary.targetSince >= 90 && distance(primary.point, primary.targetPoint) < 65;
      if (aimed) {
        // Give the second hand a short chance to join navigation before a
        // slightly earlier first pinch can pull a component out of the engine.
        if (assignments[1] && primary.target.kind !== "ui" && primary.target.kind !== "range") pendingGrab = { target: primary.target, at: now + 180 };
        else action = grab(primary.point.x, primary.point.y, primary.target) || null;
      }
    }
    if (pendingGrab && primary.pinching && now >= pendingGrab.at) {
      action = grab(primary.point.x, primary.point.y, pendingGrab.target) || null;
      pendingGrab = null;
    }
    if (action) move(primary.point.x, primary.point.y);
    const ready = primary.target && now - primary.targetSince >= 90 && now - primary.targetAt < 900;
    feedback({ mode: action ? "holding" : !primary.armed || primary.pinching ? "open" : ready ? "ready" : "aim", hands: visible, now, target: primary.target, action });
  }
  return { update, reset };
}

export function createHandControl({ video, stage, toggle, switchButton, facingLabel, cursor, secondCursor, status, trackingLabel, trackingStatus, toast, onHover, onGrab, onMove, onRelease, onNavigate }) {
  const state = { tracker: null, stream: null, facing: "environment", token: 0, busy: false, lastFrame: -1, lastDetection: 0, status: "", stalled: false };
  const session = createGestureSession({
    project: screenPoint, resolve: onHover, grab: onGrab, move: onMove, release: onRelease, navigate: onNavigate,
    feedback: ({ mode, hands, now = performance.now(), target, action }) => {
      const hints = { searching: "Arată mâna deschisă în cadru.", lost: "Mâna a ieșit din cadru. Piesa rămâne pe loc.", open: "Deschide degetele pentru o nouă prindere.", aim: "Indică o piesă sau un buton.", ready: "Unește degetele ca să prinzi.", holding: action?.kind === "ui" ? "Deschide degetele înainte de următoarea comandă." : action?.kind === "orbit" ? "Mișcă mâna pentru a roti motorul." : "Deschide degetele ca să lași.", navigate: "Mută ambele mâini · depărtează pentru zoom" };
      if (state.stream) {
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
        element.classList.toggle("is-lost", now - hand.seen > 110);
      });
      cursor.querySelector("span").textContent = mode === "ready" ? target?.label || "Prinde" : mode === "navigate" ? "Rotire / zoom" : "";
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
    switchButton.disabled = state.busy || !active;
    toggle.setAttribute("aria-pressed", String(active));
    toggle.querySelector("span").textContent = state.busy ? "Pregătesc..." : active ? "Mâini active" : "Activează mâinile";
    toggle.setAttribute("aria-label", active ? "Oprește camera și controlul cu mâinile" : "Activează camera și controlul cu mâinile");
    stage.classList.toggle("has-camera", active);
    stage.dataset.facing = state.facing;
    facingLabel.textContent = state.facing === "user" ? "Față" : "Spate";
  }
  function screenPoint(point) {
    const rect = stage.getBoundingClientRect();
    const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const w = video.videoWidth * scale, h = video.videoHeight * scale;
    let x = (rect.width - w) / 2 + point.x * w;
    if (state.facing === "user") x = rect.width - x;
    return { x: rect.left + x, y: rect.top + (rect.height - h) / 2 + point.y * h };
  }
  async function openStream(facing, exact, token) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: exact ? { exact: facing } : { ideal: facing }, width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
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
    setStatus("Pregătesc camera și gesturile...", "searching", "Pregătesc");
    let stream, tracker;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera necesită HTTPS sau localhost.");
      stream = await openStream(state.facing, false, token);
      if (!stream) return;
      tracker = await makeTracker();
      if (token !== state.token) { tracker.close(); stream.getTracks().forEach(track => track.stop()); return; }
      state.stream = stream; state.tracker = tracker;
      session.reset();
      toast("Indică piesa, unește degetele și mută. Și butoanele răspund la pinch.");
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop()); tracker?.close();
      if (token === state.token) {
        video.srcObject = null;
        setStatus("Camera nu a pornit. Poți continua prin touch.", "off", "Touch activ");
        toast(error.name === "NotAllowedError" ? "Permite accesul la cameră în Safari pentru controlul cu mâinile." : error.message || "Camera nu a pornit.");
      }
    } finally { if (token === state.token) { state.busy = false; refreshButtons(); } }
  }
  function stop() {
    state.token += 1;
    state.stream?.getTracks().forEach(track => track.stop());
    video.srcObject?.getTracks().forEach(track => track.stop());
    video.srcObject = null; state.stream = null;
    session.reset();
    state.tracker?.close(); state.tracker = null; state.busy = false;
    refreshButtons();
    setStatus("Motorul e al tău. Începe cu mâinile.", "off", "Atelier 3D");
  }
  async function switchCamera() {
    if (!state.stream || state.busy) return;
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
    } finally { if (token === state.token) { state.busy = false; refreshButtons(); session.reset(); } }
  }
  function update(now) {
    if (state.busy || !state.tracker) return;
    if (video.readyState < 2 || state.lastFrame === video.currentTime) {
      if (!state.stalled && now - state.lastDetection > 500) { session.reset(); state.stalled = true; }
      return;
    }
    if (now - state.lastDetection < 50) return;
    state.stalled = false;
    state.lastDetection = now; state.lastFrame = video.currentTime;
    try { session.update(state.tracker.detectForVideo(video, now).landmarks || [], now); }
    catch { stop(); toast("Detecția mâinii s-a oprit. Poți continua prin touch."); }
  }
  toggle.addEventListener("click", () => state.stream ? stop() : start());
  switchButton.addEventListener("click", switchCamera);
  window.addEventListener("pagehide", stop);
  return { update, stop, release: session.reset, get active() { return Boolean(state.stream); } };
}
