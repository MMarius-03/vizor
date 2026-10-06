import { CATALOG } from "./catalog.js";
import { createPanelCanvas } from "./panel.js";
import { formatPercent, marja, statusForMargin } from "./model.js";
import { cameraErrorMessage, keepScreenAwake, requestCamera, stopStream } from "./camera.js";
import { startScanner } from "./ar.js";

const startScreen = document.querySelector("#start-screen");
const scanner = document.querySelector("#scanner-screen");
const demoButton = document.querySelector("#start-demo");
const markerButton = document.querySelector("#start-camera");
const offlineButton = document.querySelector("#continue-no-camera");
const errorBox = document.querySelector("#start-error");
const video = document.querySelector("#demo-video");
const status = document.querySelector("#scanner-status");
const panel = document.querySelector("#demo-panel");
const counter = document.querySelector("#product-counter");
const name = document.querySelector("#product-name");
const arMount = document.querySelector("#ar-mount");

let productIndex = 0;
let stream = null;
let arSession = null;
let releaseWakeLock = null;
let generation = 0;

function setBusy(busy) {
  demoButton.disabled = busy;
  markerButton.disabled = busy;
}

function showError(error, allowOffline) {
  errorBox.textContent = cameraErrorMessage(error);
  errorBox.hidden = false;
  offlineButton.hidden = !allowOffline;
}

function renderProduct() {
  const product = CATALOG[productIndex];
  const canvas = createPanelCanvas(product);
  canvas.setAttribute("aria-hidden", "true");
  panel.replaceChildren(canvas);
  panel.setAttribute("aria-label", `${product.produs}, ${product.pret.toFixed(2)} lei, marjă ${formatPercent(marja(product))}`);
  counter.textContent = `${String(productIndex + 1).padStart(2, "0")} / ${String(CATALOG.length).padStart(2, "0")}`;
  name.textContent = product.produs;
  status.textContent = `Simulare · marjă ${formatPercent(marja(product))}`;
  status.dataset.status = statusForMargin(marja(product));
}

function showScanner(mode, offline = false) {
  scanner.classList.toggle("is-demo-mode", mode === "demo");
  scanner.classList.toggle("is-marker-mode", mode === "marker");
  scanner.classList.toggle("is-offline-demo", offline);
  startScreen.classList.remove("is-active");
  scanner.classList.add("is-active");
  releaseWakeLock = keepScreenAwake();
}

function stopSession() {
  generation += 1;
  stopStream(stream);
  stream = null;
  video.pause();
  video.srcObject = null;
  arSession?.stop();
  arSession = null;
  releaseWakeLock?.();
  releaseWakeLock = null;
  scanner.classList.remove("is-active", "is-demo-mode", "is-marker-mode", "is-offline-demo");
  startScreen.classList.add("is-active");
  setBusy(false);
}

async function startDemo(withCamera = true) {
  const turn = ++generation;
  errorBox.hidden = true;
  offlineButton.hidden = true;
  setBusy(true);
  const cameraPromise = withCamera ? requestCamera() : Promise.resolve(null);
  showScanner("demo", !withCamera);
  renderProduct();
  try {
    const newStream = await cameraPromise;
    if (turn !== generation) {
      stopStream(newStream);
      return;
    }
    stream = newStream;
    if (newStream) {
      video.srcObject = newStream;
      await video.play();
      if (turn !== generation) return;
    } else {
      status.textContent = "Simulare fără cameră";
    }
  } catch (error) {
    if (turn !== generation) return;
    stopSession();
    showError(error, true);
  } finally {
    if (turn === generation) setBusy(false);
  }
}

async function startMarkers() {
  const turn = ++generation;
  errorBox.hidden = true;
  offlineButton.hidden = true;
  setBusy(true);
  const cameraPromise = requestCamera();
  showScanner("marker");
  status.textContent = "Pregătesc camera...";
  status.dataset.status = "";
  try {
    const permissionStream = await cameraPromise;
    stopStream(permissionStream);
    if (turn !== generation) return;
    arSession = await startScanner(arMount, {
      onDetectionChange(codes) {
        status.textContent = codes.length === 0 ? "Caut un card..." : codes.length === 1 ? "1 produs detectat" : `${codes.length} produse detectate`;
      },
      onCameraError() {
        status.textContent = "Camera AR nu a pornit. Închide și încearcă din nou.";
      },
    });
    if (turn !== generation) {
      arSession.stop();
      arSession = null;
      return;
    }
    status.textContent = "Caut un card...";
  } catch (error) {
    if (turn !== generation) return;
    stopSession();
    showError(error, false);
  } finally {
    if (turn === generation) setBusy(false);
  }
}

demoButton.addEventListener("click", () => startDemo());
markerButton.addEventListener("click", startMarkers);
offlineButton.addEventListener("click", () => startDemo(false));
document.querySelector("#close-scanner").addEventListener("click", stopSession);
document.querySelector("#previous-product").addEventListener("click", () => {
  productIndex = (productIndex - 1 + CATALOG.length) % CATALOG.length;
  renderProduct();
});
document.querySelector("#next-product").addEventListener("click", () => {
  productIndex = (productIndex + 1) % CATALOG.length;
  renderProduct();
});
window.addEventListener("pagehide", stopSession);
