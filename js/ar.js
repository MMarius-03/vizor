import { CATALOG } from "./catalog.js";
import { createPanelCanvas } from "./panel.js";

const AR_JS_VERSION = "3.4.8";
const AR_JS_URL = `https://cdn.jsdelivr.net/npm/@ar-js-org/ar.js@${AR_JS_VERSION}/aframe/build/aframe-ar.js`;

function loadArLibrary() {
  if (window.AFRAME) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = AR_JS_URL;
    script.onload = resolve;
    script.onerror = () => reject(new Error("Biblioteca AR nu s-a putut încărca."));
    document.head.append(script);
  });
}

function createMarker(product) {
  const marker = document.createElement("a-marker");
  marker.setAttribute("type", "barcode");
  marker.setAttribute("value", product.cod);
  marker.setAttribute("emitevents", "true");
  marker.setAttribute("smooth", "true");
  marker.setAttribute("smooth-count", "10");
  marker.setAttribute("smooth-tolerance", "0.01");
  marker.setAttribute("smooth-threshold", "5");

  const plane = document.createElement("a-plane");
  plane.setAttribute("position", "0 0.65 0");
  plane.setAttribute("rotation", "-90 0 0");
  plane.setAttribute("width", "1.8");
  plane.setAttribute("height", "1.0125");
  plane.setAttribute("material", `shader: flat; transparent: true; src: #canvas-${product.cod}; side: double`);
  marker.append(plane);
  return marker;
}

export async function startScanner(mount) {
  if (!window.isSecureContext && location.hostname !== "localhost") {
    throw new Error("Camera necesită o adresă HTTPS.");
  }
  await loadArLibrary();
  const assets = document.createElement("a-assets");
  CATALOG.forEach((product) => assets.append(createPanelCanvas(product)));

  const scene = document.createElement("a-scene");
  scene.className = "ar-scene";
  scene.setAttribute("embedded", "");
  scene.setAttribute("vr-mode-ui", "enabled: false");
  scene.setAttribute("renderer", "logarithmicDepthBuffer: true; precision: medium");
  scene.setAttribute("arjs", "sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3");
  scene.append(assets);
  CATALOG.forEach((product) => scene.append(createMarker(product)));
  const camera = document.createElement("a-entity");
  camera.setAttribute("camera", "");
  scene.append(camera);
  mount.replaceChildren(scene);
  return scene;
}

