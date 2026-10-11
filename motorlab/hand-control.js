export function createHandControl({ video, stage, toggle, switchButton, facingLabel, cursor, status, toast, onHover, onGrab, onMove, onRelease }) {
  const state = {
    tracker: null, stream: null, facing: "environment", token: 0, busy: false,
    lastFrame: -1, lastDetection: 0, lastHand: 0, pinching: false,
    votes: 0, dragging: false, point: null,
  };

  function release() {
    if (state.dragging) onRelease();
    state.dragging = false;
    state.pinching = false;
    state.votes = 0;
    state.point = null;
    cursor.hidden = true;
    cursor.classList.remove("is-pinching");
    onHover(null);
  }

  function refreshButtons() {
    const active = Boolean(state.stream);
    toggle.disabled = state.busy;
    switchButton.disabled = state.busy;
    switchButton.hidden = !active;
    toggle.setAttribute("aria-pressed", String(active));
    toggle.querySelector("span").textContent = active ? "Oprește" : "Camera";
    toggle.setAttribute("aria-label", active ? "Oprește camera" : "Pornește camera și controlul cu mâna");
    stage.classList.toggle("has-camera", active);
    stage.dataset.facing = state.facing;
    facingLabel.textContent = state.facing === "user" ? "Față" : "Spate";
    switchButton.setAttribute("aria-label", `Comută la camera din ${state.facing === "user" ? "spate" : "față"}`);
  }

  async function openStream(facing, exact, token) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: exact ? { exact: facing } : { ideal: facing }, width: { ideal: 960 }, height: { ideal: 720 } },
    });
    if (token !== state.token) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    try {
      video.srcObject = stream;
      await video.play();
      if (token !== state.token) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }
      state.facing = stream.getVideoTracks()[0]?.getSettings?.().facingMode || facing;
      state.lastFrame = -1;
      return stream;
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }

  async function makeTracker() {
    const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm");
    const files = await vision.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm");
    const options = {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
      runningMode: "VIDEO", numHands: 1, minHandDetectionConfidence: 0.55, minTrackingConfidence: 0.55,
    };
    try { return await vision.HandLandmarker.createFromOptions(files, options); }
    catch { delete options.baseOptions.delegate; return vision.HandLandmarker.createFromOptions(files, options); }
  }

  async function start() {
    if (state.busy || state.stream) return;
    const token = ++state.token;
    state.busy = true;
    refreshButtons();
    status.textContent = "Pregătesc camera și detecția mâinii...";
    let stream;
    let tracker;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera necesită HTTPS sau localhost.");
      stream = await openStream(state.facing, false, token);
      if (!stream) return;
      tracker = await makeTracker();
      if (token !== state.token) {
        tracker.close();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      state.stream = stream;
      state.tracker = tracker;
      status.textContent = "Pinch direct pe piesă · eliberează pentru a o așeza";
      toast("Unește degetele pe o piesă, mut-o și deschide mâna ca să o lași.");
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      tracker?.close();
      if (token === state.token) {
        video.srcObject = null;
        status.textContent = "Touch activ · camera nu a pornit";
        toast(error.name === "NotAllowedError" ? "Permite accesul la cameră în Safari pentru controlul cu mâna." : error.message || "Camera nu a pornit.");
      }
    } finally {
      if (token === state.token) { state.busy = false; refreshButtons(); }
    }
  }

  function stop() {
    state.token += 1;
    release();
    state.tracker?.close();
    state.tracker = null;
    state.stream?.getTracks().forEach((track) => track.stop());
    video.srcObject?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    state.stream = null;
    state.busy = false;
    refreshButtons();
    status.textContent = "Trage piesele · două degete pentru zoom";
  }

  async function switchCamera() {
    if (!state.stream || state.busy) return;
    const token = ++state.token;
    const previous = state.facing;
    const next = previous === "user" ? "environment" : "user";
    state.busy = true;
    release();
    refreshButtons();
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    video.srcObject = null;
    try {
      const stream = await openStream(next, true, token);
      if (token === state.token) state.stream = stream;
    } catch {
      if (token !== state.token) return;
      try {
        state.stream = await openStream(previous, true, token);
        if (token === state.token) toast("Camera cerută nu este disponibilă. Am revenit la camera precedentă.");
      } catch {
        if (token === state.token) { stop(); toast("Camera nu a putut fi reluată. Poți continua prin touch."); }
      }
    } finally {
      if (token === state.token) { state.busy = false; refreshButtons(); }
    }
  }

  function screenPoint(point) {
    const rect = stage.getBoundingClientRect();
    const scale = Math.max(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    let x = (rect.width - w) / 2 + point.x * w;
    if (state.facing === "user") x = rect.width - x;
    return { x: rect.left + x, y: rect.top + (rect.height - h) / 2 + point.y * h };
  }

  function update(now) {
    if (state.busy || !state.tracker || video.readyState < 2 || now - state.lastDetection < 45 || state.lastFrame === video.currentTime) return;
    state.lastDetection = now;
    state.lastFrame = video.currentTime;
    try {
      const hand = state.tracker.detectForVideo(video, now).landmarks?.[0];
      if (!hand) {
        if (now - state.lastHand > 350) release();
        return;
      }
      state.lastHand = now;
      const raw = screenPoint(hand[8]);
      if (!state.point) state.point = raw;
      else { state.point.x += (raw.x - state.point.x) * 0.5; state.point.y += (raw.y - state.point.y) * 0.5; }
      const point = state.point;
      const rect = stage.getBoundingClientRect();
      cursor.hidden = false;
      cursor.style.left = `${point.x - rect.left}px`;
      cursor.style.top = `${point.y - rect.top}px`;
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance(hand[4], hand[8]) / Math.max(0.04, distance(hand[0], hand[9]));
      const requested = ratio < (state.pinching ? 0.57 : 0.39);
      state.votes = requested !== state.pinching ? state.votes + 1 : 0;
      if (state.votes >= 2) {
        state.pinching = requested;
        state.votes = 0;
        if (requested) state.dragging = Boolean(onGrab(point.x, point.y));
        else { if (state.dragging) onRelease(); state.dragging = false; }
      }
      if (state.dragging) onMove(point.x, point.y);
      else if (!state.pinching) onHover(point);
      cursor.classList.toggle("is-pinching", state.pinching);
    } catch {
      stop();
      toast("Detecția mâinii s-a oprit. Poți continua prin touch.");
    }
  }

  toggle.addEventListener("click", () => state.stream ? stop() : start());
  switchButton.addEventListener("click", switchCamera);
  window.addEventListener("pagehide", stop);
  return { update, stop, release, get active() { return Boolean(state.stream); } };
}
