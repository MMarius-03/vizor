import { cameraErrorMessage, keepScreenAwake, requestCamera, stopStream } from "./camera.js";
import { prepareAr, startScanner } from "./ar.js";

const button = document.querySelector("#start-ar-test");
const intro = document.querySelector("#test-intro");
const scanner = document.querySelector("#test-scanner");
const mount = document.querySelector("#ar-test-mount");
const status = document.querySelector("#ar-test-status");
const markerStatus = document.querySelector("#marker-status");
let session = null;
let releaseWakeLock = null;
let generation = 0;

prepareAr().catch(() => {});

function closeTest() {
  generation += 1;
  session?.stop();
  session = null;
  releaseWakeLock?.();
  releaseWakeLock = null;
  scanner.hidden = true;
  intro.hidden = false;
  button.disabled = false;
  button.textContent = "Pornește camera";
}

button.addEventListener("click", async () => {
  const turn = ++generation;
  button.disabled = true;
  button.textContent = "Pornesc camera...";
  status.textContent = "Cer acces la cameră...";
  const cameraPromise = requestCamera();
  try {
    const permissionStream = await cameraPromise;
    stopStream(permissionStream);
    if (turn !== generation) return;
    scanner.hidden = false;
    intro.hidden = true;
    releaseWakeLock = keepScreenAwake();
    session = await startScanner(mount, {
      testCube: true,
      onDetectionChange(codes) {
        markerStatus.textContent = codes.length ? "Markerul 0 a fost detectat" : "Caut markerul 0...";
      },
      onCameraError() {
        markerStatus.textContent = "Camera AR nu a pornit. Închide și încearcă din nou.";
      },
    });
    if (turn !== generation) {
      session.stop();
      session = null;
    }
  } catch (error) {
    if (turn !== generation) return;
    closeTest();
    status.textContent = cameraErrorMessage(error);
  }
});

document.querySelector("#close-ar-test").addEventListener("click", closeTest);
window.addEventListener("pagehide", closeTest);
