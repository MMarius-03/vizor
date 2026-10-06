const LIBRARY_URL = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js";
let libraryPromise;

export function prepareBarcodeReader() {
  if (window.ZXingBrowser?.BrowserMultiFormatReader) return Promise.resolve();
  if (!libraryPromise) {
    libraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = LIBRARY_URL;
      script.onload = () => window.ZXingBrowser?.BrowserMultiFormatReader ? resolve() : reject(new Error("Cititorul de coduri nu s-a încărcat."));
      script.onerror = () => reject(new Error("Cititorul de coduri nu este disponibil. Verifică conexiunea."));
      document.head.append(script);
    }).catch((error) => {
      libraryPromise = null;
      throw error;
    });
  }
  return libraryPromise;
}

function readPoint(point) {
  const x = typeof point?.getX === "function" ? point.getX() : point?.x;
  const y = typeof point?.getY === "function" ? point.getY() : point?.y;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export async function startBarcodeReading(video, onRead, { once = false } = {}) {
  await prepareBarcodeReader();
  const reader = new window.ZXingBrowser.BrowserMultiFormatReader();
  let controls;
  let stopped = false;
  const stop = () => {
    stopped = true;
    controls?.stop();
  };
  controls = await reader.decodeFromVideoElement(video, (result) => {
    if (!result || stopped) return;
    const points = (result.getResultPoints?.() || []).map(readPoint).filter(Boolean);
    onRead({
      text: result.getText(),
      format: String(result.getBarcodeFormat?.() || ""),
      points,
      sourceWidth: video.videoWidth,
      sourceHeight: video.videoHeight,
    });
    if (once) stop();
  });
  if (stopped) controls.stop();
  return { stop };
}
