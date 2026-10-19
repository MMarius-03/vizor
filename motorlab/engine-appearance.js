import * as THREE from "three";

// Reuse the model's UV-matched maps rather than flattening all surfaces to a
// solid color. Values distinguish machined aluminum, steel, paint and rubber.
const finishes = {
  piston: { color: 0xffffff, metalness: .78, roughness: .28, gain: 1.45 },
  rod: { color: 0xe0e6e8, metalness: .82, roughness: .3, gain: 1.35 },
  crank: { color: 0x98aab6, metalness: .86, roughness: .33, gain: 1.3 },
  gear: { color: 0xd1b995, metalness: .82, roughness: .3, gain: 1.3 },
  cover: { color: 0x859d99, metalness: .52, roughness: .4, gain: 1.25 },
  component: { color: 0xc9d0d1, metalness: .62, roughness: .36, gain: 1.3 },
  cable: { color: 0x293234, metalness: .02, roughness: .82, gain: 1 },
};

export function createSurfaceMaterial(source, kind, renderer) {
  const finish = finishes[kind] || finishes.component;
  const material = new THREE.MeshPhysicalMaterial({
    color: finish.color, map: source.map || null,
    aoMap: source.aoMap || null, aoMapIntensity: .35,
    normalMap: source.normalMap || null,
    metalness: finish.metalness, roughness: finish.roughness,
    clearcoat: kind === "cover" ? .2 : 0,
    clearcoatRoughness: .4, envMapIntensity: 1,
    side: THREE.DoubleSide,
  });
  if (source.map) material.color.multiplyScalar(finish.gain);
  for (const texture of [material.map, material.aoMap, material.normalMap]) {
    if (texture) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }
  return material;
}

export function createGhostMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0x9b9e99, transparent: true, opacity: .025, depthWrite: false, side: THREE.FrontSide });
}
