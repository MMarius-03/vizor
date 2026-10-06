export function requestCamera() {
  if (!window.isSecureContext) {
    return Promise.reject(new Error("Camera necesită HTTPS. Deschide pagina publicată pe GitHub Pages."));
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("Browserul nu oferă acces la cameră."));
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}

export function stopStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function cameraErrorMessage(error) {
  if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
    return "Accesul la cameră este blocat. În Safari, permite camera pentru acest site și încearcă din nou.";
  }
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") {
    return "Nu am găsit o cameră disponibilă.";
  }
  if (error?.name === "NotReadableError") {
    return "Camera este folosită de altă aplicație. Închide acea aplicație și încearcă din nou.";
  }
  return error?.message || "Camera nu a putut fi pornită. Încearcă din nou.";
}

export function keepScreenAwake() {
  let wakeLock = null;
  let active = true;

  async function acquire() {
    if (!active || document.visibilityState !== "visible" || !navigator.wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      // Safari may not expose wake lock, and the camera should still work.
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") acquire();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  acquire();
  return () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisibilityChange);
    wakeLock?.release().catch(() => {});
  };
}
