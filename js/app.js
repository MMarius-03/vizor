import { CATALOG } from "./catalog.js";
import { createPanelCanvas } from "./panel.js";
import { formatPercent, marja, statusForMargin } from "./model.js";
import { cameraErrorMessage, keepScreenAwake, requestCamera, stopStream } from "./camera.js";
import { startScanner } from "./ar.js";
import { startBarcodeReading } from "./barcode.js";
import { classifyScan, lookupProduct, SAMPLE_CODE } from "./product-data.js";

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
const productButton = document.querySelector("#start-product-scan");
const exampleButton = document.querySelector("#show-example");
const resultSheet = document.querySelector("#product-result");
const manualSheet = document.querySelector("#manual-sheet");
const manualInput = document.querySelector("#manual-code");
const priceInput = document.querySelector("#shelf-price");
const priceOutput = document.querySelector("#price-per-litre");
const lensLayer = document.querySelector("#lens-layer");
const lensData = document.querySelector("#lens-data");

let productIndex = 0;
let stream = null;
let arSession = null;
let releaseWakeLock = null;
let generation = 0;
let barcodeSession = null;
let lookupController = null;
let scanGeneration = 0;
let lookupGeneration = 0;
let currentLitres = null;
let activeBarcode = null;
let lensLostTimer = null;

function setBusy(busy) {
  demoButton.disabled = busy;
  markerButton.disabled = busy;
  productButton.disabled = busy;
  exampleButton.disabled = busy;
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
  scanner.classList.toggle("is-product-mode", mode === "product");
  scanner.classList.toggle("is-offline-demo", offline);
  startScreen.classList.remove("is-active");
  scanner.classList.add("is-active");
  releaseWakeLock = keepScreenAwake();
}

function stopSession() {
  generation += 1;
  scanGeneration += 1;
  lookupGeneration += 1;
  barcodeSession?.stop();
  barcodeSession = null;
  lookupController?.abort();
  lookupController = null;
  window.clearTimeout(lensLostTimer);
  lensLostTimer = null;
  activeBarcode = null;
  stopStream(stream);
  stream = null;
  video.pause();
  video.srcObject = null;
  arSession?.stop();
  arSession = null;
  releaseWakeLock?.();
  releaseWakeLock = null;
  scanner.classList.remove("is-active", "is-demo-mode", "is-marker-mode", "is-product-mode", "is-offline-demo", "has-result", "has-manual", "has-lens");
  resultSheet.hidden = true;
  manualSheet.hidden = true;
  lensLayer.hidden = true;
  startScreen.classList.add("is-active");
  setBusy(false);
}

function addText(parent, tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function addSource(parent, label, description, href) {
  const row = addText(parent, "div", "", "source-row");
  addText(row, "strong", label);
  addText(row, "p", description);
  if (href) {
    const link = addText(row, "a", "Deschide sursa ↗");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
}

function showResult({ eyebrow, title, subtitle, quick = [], facts = [], sources = [], image = null, litres = null, minerals = [] }, open = true) {
  document.querySelector("#result-eyebrow").textContent = eyebrow;
  document.querySelector("#result-title").textContent = title;
  document.querySelector("#result-subtitle").textContent = subtitle;
  const imageBox = document.querySelector("#result-image");
  imageBox.replaceChildren();
  if (image?.startsWith("https://")) {
    const photo = document.createElement("img");
    photo.src = image;
    photo.alt = `Ambalaj ${title}`;
    photo.loading = "eager";
    imageBox.append(photo);
  } else addText(imageBox, "span", "▥");
  const quickBox = document.querySelector("#result-quick");
  quickBox.replaceChildren();
  for (const [label, value] of quick) {
    const item = addText(quickBox, "div", "", "quick-item");
    addText(item, "span", label);
    addText(item, "strong", value);
  }
  const factsBox = document.querySelector("#result-facts");
  factsBox.replaceChildren();
  if (minerals.length) {
    addText(factsBox, "p", "PROFIL MINERAL · APROX. MG/L", "profile-label");
    const grid = addText(factsBox, "div", "", "mineral-grid");
    for (const { label, value } of minerals) {
      const tile = addText(grid, "div", "", "mineral-item");
      addText(tile, "strong", new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(value));
      addText(tile, "span", label);
    }
  }
  for (const [label, value] of facts) {
    const row = addText(factsBox, "div", "", "fact-row");
    addText(row, "span", label);
    addText(row, "strong", value);
  }
  const sourceBox = document.querySelector("#result-sources");
  sourceBox.replaceChildren();
  for (const entry of sources) addSource(sourceBox, ...entry);
  currentLitres = litres;
  document.querySelector("#price-tool").hidden = !litres;
  priceInput.value = "";
  priceOutput.textContent = "— / L";
  selectTab("overview");
  resultSheet.hidden = !open;
  scanner.classList.toggle("has-result", open);
  status.textContent = eyebrow === "PRODUS IDENTIFICAT" ? "Produs identificat" : "Rezultat scanare";
}

function selectTab(tab) {
  for (const name of ["overview", "sources"]) {
    const selected = name === tab;
    document.querySelector(`#tab-${name}`).setAttribute("aria-selected", String(selected));
    document.querySelector(`#panel-${name}`).hidden = !selected;
  }
}

function renderProductResult(product, open = true) {
  const facts = [];
  if (!product.minerals.length) facts.push(["Date disponibile", "Nicio compoziție verificată în baza consultată"]);
  if (product.isSample) facts.push(["Ambalaj", "SGR · garanție 0,50 lei"]);
  showResult({
    eyebrow: "PRODUS IDENTIFICAT",
    title: product.name,
    subtitle: `${product.brand} · ${product.quantity}`,
    image: product.image,
    litres: product.litres,
    minerals: product.minerals,
    quick: [["COD", product.code], ["CANTITATE", product.quantity], ["DATE", "Open Food Facts"]],
    facts,
    sources: [
      ["Open Food Facts", "Numele, cantitatea, fotografia și compoziția vin dintr-o bază colaborativă. Verifică eticheta pentru valorile oficiale ale lotului.", product.source],
      ...(product.minerals.length ? [["Calcul Vizor", "Valorile în mg/L sunt convertite din datele nutriționale per 100 ml. Pot fi incomplete sau inexacte."]] : []),
      ...(product.isSample ? [["Garanție SGR", "Simbolul SGR este vizibil pe sticla de test. Garanția standard este 0,50 lei și nu este inclusă în prețul introdus.", "https://returosgr.ro/"]] : []),
    ],
  }, open);
}

function formatLensValue(value) {
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 }).format(value);
}

function setLensMode(mode) {
  lensLayer.dataset.mode = mode;
  document.querySelectorAll("[data-lens-mode]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.lensMode === mode));
  });
}

function lensFacts(product) {
  const items = product.minerals.slice(0, 3).map(({ label, value }) => ({ label, value: `${formatLensValue(value)} mg/L` }));
  if (product.isSample) items.push({ label: "Ambalaj", value: "SGR 0,50 lei" });
  if (items.length < 4) items.push({ label: "Cantitate", value: product.quantity });
  if (items.length < 4) items.push({ label: "Identificare", value: product.code });
  if (items.length < 4) items.push({ label: "Sursă", value: "Open Food Facts" });
  return items.slice(0, 4);
}

function showLens(product) {
  document.querySelector("#lens-code").textContent = product.code;
  document.querySelector("#lens-title").textContent = product.name;
  document.querySelector("#lens-subtitle").textContent = `${product.brand} · ${product.quantity}`;
  const primary = product.minerals[0];
  document.querySelector("#lens-card-label").textContent = primary ? primary.label : "Cantitate";
  document.querySelector("#lens-card-value").textContent = primary ? `${formatLensValue(primary.value)} mg/L` : product.quantity;
  lensData.replaceChildren();
  lensFacts(product).forEach(({ label, value }, index) => {
    const item = addText(lensData, "div", "", `lens-fact lens-fact-${index + 1}`);
    addText(item, "span", label);
    addText(item, "strong", value);
  });
  resultSheet.hidden = true;
  scanner.classList.remove("has-result");
  scanner.classList.add("has-lens");
  lensLayer.hidden = false;
  lensLayer.classList.remove("is-stale", "is-revealing");
  void lensLayer.offsetWidth;
  lensLayer.classList.add("is-revealing");
  status.textContent = "Produs identificat";
  status.dataset.status = "ok";
}

function updateLensPosition(detection = {}, persistent = false) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const sourceWidth = detection.sourceWidth || video.videoWidth || viewportWidth;
  const sourceHeight = detection.sourceHeight || video.videoHeight || viewportHeight;
  const points = detection.points || [];
  let x = viewportWidth / 2;
  let y = viewportHeight * 0.55;
  let width = 116;
  let angle = 0;
  if (points.length) {
    const scale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
    const offsetX = (viewportWidth - sourceWidth * scale) / 2;
    const offsetY = (viewportHeight - sourceHeight * scale) / 2;
    const mapped = points.map((point) => ({ x: point.x * scale + offsetX, y: point.y * scale + offsetY }));
    x = mapped.reduce((sum, point) => sum + point.x, 0) / mapped.length;
    y = mapped.reduce((sum, point) => sum + point.y, 0) / mapped.length;
    if (mapped.length > 1) {
      const first = mapped[0];
      const last = mapped.at(-1);
      width = Math.hypot(last.x - first.x, last.y - first.y);
      angle = Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI;
    }
  }
  lensLayer.style.setProperty("--lens-x", `${Math.max(28, Math.min(viewportWidth - 28, x))}px`);
  lensLayer.style.setProperty("--lens-y", `${Math.max(130, Math.min(viewportHeight - 150, y))}px`);
  lensLayer.style.setProperty("--lens-width", `${Math.max(72, Math.min(220, width * 1.18))}px`);
  lensLayer.style.setProperty("--lens-angle", `${angle}deg`);
  lensLayer.dataset.placement = y < 310 ? "below" : "above";
  lensLayer.classList.remove("is-stale");
  window.clearTimeout(lensLostTimer);
  if (persistent) return;
  lensLostTimer = window.setTimeout(() => {
    lensLayer.classList.add("is-stale");
    if (!lensLayer.hidden) status.textContent = "Ține codul în cadru";
  }, 850);
}

function handleBarcodeDetection(detection) {
  updateLensPosition(detection);
  if (detection.text === activeBarcode) return;
  activeBarcode = detection.text;
  resolveScan(detection.text, { lens: true });
}

async function resolveScan(raw, { lens = false } = {}) {
  const turn = ++lookupGeneration;
  if (!lens) {
    barcodeSession?.stop();
    barcodeSession = null;
  }
  lookupController?.abort();
  manualSheet.hidden = true;
  scanner.classList.remove("has-manual");
  const scan = classifyScan(raw);
  if (scan.kind !== "product") {
    if (lens) {
      barcodeSession?.stop();
      barcodeSession = null;
    }
    const link = scan.kind === "link";
    showResult({
      eyebrow: link ? "LINK QR DETECTAT" : "COD NECUNOSCUT",
      title: link ? scan.host : "Nu pot identifica produsul",
      subtitle: link ? "Acest QR conține un link, nu date despre produs." : "Codul nu este un EAN/GTIN valid sau un link de produs GS1.",
      quick: [["TIP", link ? "Link web" : "Text / cod"], ["DATE", "Fără produs confirmat"]],
      facts: [["Ce știm", link ? "Destinația linkului, nu conținutul paginii" : raw.slice(0, 120)]],
      sources: link ? [["Destinație QR", "Linkul nu este deschis automat. Verifică domeniul înainte de accesare.", scan.url]] : [["Identificare", "Un cod de bare valid are o cifră de control. Nu putem deduce produsul dintr-un text arbitrar."]],
    });
    return;
  }
  status.textContent = "Caut produsul...";
  lookupController = new AbortController();
  try {
    const product = await lookupProduct(scan.code, lookupController.signal);
    if (turn !== lookupGeneration || !scanner.classList.contains("is-active")) return;
    if (product) {
      renderProductResult(product, !lens);
      if (lens) showLens(product);
    } else {
      if (lens) {
        barcodeSession?.stop();
        barcodeSession = null;
      }
      showResult({
        eyebrow: "FĂRĂ REZULTAT",
        title: "Produs negăsit",
        subtitle: `Cod ${scan.code}`,
        quick: [["COD", scan.code], ["DATE", "Nedisponibile"]],
        facts: [["Ce înseamnă", "Codul este valid, dar produsul lipsește din baza consultată."]],
        sources: [["Open Food Facts", "Căutarea nu a returnat o fișă. Nu deducem numele sau proprietățile din cifrele codului."]],
      });
    }
  } catch (error) {
    if (error.name === "AbortError" || turn !== lookupGeneration) return;
    if (lens) {
      barcodeSession?.stop();
      barcodeSession = null;
    }
    showResult({
      eyebrow: "CĂUTARE INDISPONIBILĂ", title: "Nu am putut verifica produsul", subtitle: `Cod ${scan.code}`,
      quick: [["COD", scan.code]], facts: [["Conexiune", error.message]],
      sources: [["Open Food Facts", "Nu am primit un răspuns. Poți scana din nou când conexiunea revine."]],
    });
  } finally {
    if (turn === lookupGeneration) lookupController = null;
  }
}

async function resumeReading() {
  const turn = ++scanGeneration;
  lookupGeneration += 1;
  barcodeSession?.stop();
  barcodeSession = null;
  lookupController?.abort();
  lookupController = null;
  activeBarcode = null;
  window.clearTimeout(lensLostTimer);
  lensLayer.hidden = true;
  resultSheet.hidden = true;
  manualSheet.hidden = true;
  scanner.classList.remove("has-result", "has-manual", "has-lens");
  if (!stream) {
    status.textContent = "Pregătesc camera...";
    try {
      const newStream = await requestCamera();
      if (turn !== scanGeneration) { stopStream(newStream); return; }
      stream = newStream;
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      if (turn !== scanGeneration) return;
      status.textContent = cameraErrorMessage(error);
      document.querySelector("#open-manual").focus();
      return;
    }
  }
  if (turn !== scanGeneration) return;
  status.textContent = "Caut un cod...";
  status.dataset.status = "";
  try {
    const session = await startBarcodeReading(video, handleBarcodeDetection);
    if (turn !== scanGeneration) session.stop();
    else barcodeSession = session;
  } catch (error) {
    if (turn === scanGeneration) status.textContent = error.message;
  }
}

function startProductScan(example = false) {
  errorBox.hidden = true;
  offlineButton.hidden = true;
  showScanner("product", example);
  if (example) {
    updateLensPosition({}, true);
    resolveScan(SAMPLE_CODE, { lens: true });
  }
  else resumeReading();
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
setLensMode("card");
productButton.addEventListener("click", () => startProductScan());
exampleButton.addEventListener("click", () => startProductScan(true));
offlineButton.addEventListener("click", () => startDemo(false));
document.querySelector("#close-scanner").addEventListener("click", stopSession);
document.querySelector("#open-manual").addEventListener("click", () => {
  barcodeSession?.stop();
  barcodeSession = null;
  scanGeneration += 1;
  lookupGeneration += 1;
  lookupController?.abort();
  lookupController = null;
  lensLayer.hidden = true;
  manualSheet.hidden = false;
  scanner.classList.remove("has-lens");
  scanner.classList.add("has-manual");
  manualInput.focus();
});
document.querySelector("#close-manual").addEventListener("click", resumeReading);
manualSheet.addEventListener("submit", (event) => {
  event.preventDefault();
  resolveScan(manualInput.value);
});
document.querySelector("#scan-again").addEventListener("click", resumeReading);
document.querySelector("#lens-details").addEventListener("click", () => {
  barcodeSession?.stop();
  barcodeSession = null;
  lensLayer.hidden = true;
  scanner.classList.remove("has-lens");
  scanner.classList.add("has-result");
  resultSheet.hidden = false;
});
document.querySelector("#lens-rescan").addEventListener("click", resumeReading);
document.querySelectorAll("[data-lens-mode]").forEach((button) => {
  button.addEventListener("click", () => setLensMode(button.dataset.lensMode));
});
for (const tab of ["overview", "sources"]) document.querySelector(`#tab-${tab}`).addEventListener("click", () => selectTab(tab));
priceInput.addEventListener("input", () => {
  const value = Number(priceInput.value.trim().replace(",", "."));
  priceOutput.textContent = currentLitres && priceInput.value.trim() && Number.isFinite(value) && value > 0
    ? `${new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / currentLitres)} lei/L`
    : "— / L";
});
document.querySelector("#previous-product").addEventListener("click", () => {
  productIndex = (productIndex - 1 + CATALOG.length) % CATALOG.length;
  renderProduct();
});
document.querySelector("#next-product").addEventListener("click", () => {
  productIndex = (productIndex + 1) % CATALOG.length;
  renderProduct();
});
window.addEventListener("pagehide", stopSession);
