import { CATALOG } from "./catalog.js";
import { createPanelCanvas } from "./panel.js";
import { stopStream } from "./camera.js";

const AFRAME_URL = "https://cdn.jsdelivr.net/npm/aframe@1.6.0/dist/aframe-master.min.js";
const ARJS_URL = "https://cdn.jsdelivr.net/npm/@ar-js-org/ar.js@3.4.8/aframe/build/aframe-ar.js";
let libraryPromise;

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error("Biblioteca AR nu s-a putut încărca. Verifică internetul."));
    };
    document.head.append(script);
  });
}

export function prepareAr() {
  if (!libraryPromise) {
    libraryPromise = (async () => {
      if (!window.AFRAME) await loadScript(AFRAME_URL);
      if (!window.AFRAME) throw new Error("A-Frame nu s-a încărcat.");
      if (!window.AFRAME.systems.arjs) await loadScript(ARJS_URL);
      if (!window.AFRAME.systems.arjs) throw new Error("AR.js nu s-a inițializat.");

      if (!window.AFRAME.components["face-camera"]) {
        window.AFRAME.registerComponent("face-camera", {
          init() { this.target = new window.AFRAME.THREE.Vector3(); },
          tick() {
            if (!this.el.parentElement?.object3D.visible || !this.el.sceneEl.camera) return;
            this.el.sceneEl.camera.getWorldPosition(this.target);
            this.el.object3D.lookAt(this.target);
          },
        });
      }
    })().catch((error) => {
      libraryPromise = null;
      throw error;
    });
  }
  return libraryPromise;
}

function createMarker(product, cube, onChange) {
  const marker = document.createElement("a-marker");
  marker.setAttribute("type", "barcode");
  marker.setAttribute("value", String(product.cod));
  marker.setAttribute("emitevents", "true");
  marker.setAttribute("smooth", "true");
  marker.setAttribute("smooth-count", "10");
  marker.setAttribute("smooth-tolerance", "0.01");
  marker.setAttribute("smooth-threshold", "5");

  if (cube) {
    const box = document.createElement("a-box");
    box.setAttribute("position", "0 0.5 0");
    box.setAttribute("width", "0.7");
    box.setAttribute("height", "0.7");
    box.setAttribute("depth", "0.7");
    box.setAttribute("color", "#0EA5E9");
    marker.append(box);
  } else {
    const plane = document.createElement("a-plane");
    plane.setAttribute("position", "0 0.95 0");
    plane.setAttribute("width", "1.75");
    plane.setAttribute("height", "0.984");
    plane.setAttribute("face-camera", "");
    plane.setAttribute("material", `shader: flat; transparent: true; src: #canvas-${product.cod}; side: double`);
    marker.append(plane);
  }

  marker.addEventListener("markerFound", () => onChange(product.cod, true));
  marker.addEventListener("markerLost", () => onChange(product.cod, false));
  return marker;
}

export async function startScanner(mount, { testCube = false, onDetectionChange = () => {}, onCameraError = () => {} } = {}) {
  await prepareAr();
  const seen = new Set();
  const products = testCube ? [CATALOG[0]] : CATALOG;
  const scene = document.createElement("a-scene");
  scene.className = "ar-scene";
  scene.setAttribute("embedded", "");
  scene.setAttribute("vr-mode-ui", "enabled: false");
  scene.setAttribute("renderer", "logarithmicDepthBuffer: true; precision: medium");
  const portrait = window.innerHeight >= window.innerWidth;
  scene.setAttribute(
    "arjs",
    `sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3; sourceWidth: ${portrait ? 480 : 640}; sourceHeight: ${portrait ? 640 : 480}`,
  );

  if (!testCube) {
    const assets = document.createElement("a-assets");
    products.forEach((product) => assets.append(createPanelCanvas(product)));
    scene.append(assets);
  }

  products.forEach((product) => {
    scene.append(createMarker(product, testCube, (code, found) => {
      if (found) seen.add(code);
      else seen.delete(code);
      onDetectionChange([...seen]);
    }));
  });
  const camera = document.createElement("a-entity");
  camera.setAttribute("camera", "");
  scene.append(camera);
  scene.addEventListener("camera-error", onCameraError);
  mount.replaceChildren(scene);

  let resizeTimeout;
  function onOrientationChange() {
    window.dispatchEvent(new Event("resize"));
    resizeTimeout = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 350);
  }
  window.addEventListener("orientationchange", onOrientationChange);

  return {
    scene,
    stop() {
      window.removeEventListener("orientationchange", onOrientationChange);
      window.clearTimeout(resizeTimeout);
      scene.removeEventListener("camera-error", onCameraError);
      const cameraVideo = scene.systems.arjs?.arToolkitSource?.domElement;
      stopStream(cameraVideo?.srcObject);
      const arVideo = document.querySelector("#arjs-video");
      stopStream(arVideo?.srcObject);
      scene.pause();
      mount.replaceChildren();
      arVideo?.remove();
    },
  };
}
