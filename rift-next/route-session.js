import { atlasPlaces } from './studies/atlas-places.js?v=2';

const key = 'rift-campus-route-v1';
export function readRoute() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key));
    const from = atlasPlaces.find(p => p.id === saved?.from);
    const to = atlasPlaces.find(p => p.id === saved?.to);
    return from && to && from !== to ? { from, to } : null;
  } catch { return null; }
}
export function saveRoute(from, to) {
  try { sessionStorage.setItem(key, JSON.stringify({ from:from.id, to:to.id })); } catch {}
}
export function forgetRoute() {
  try { sessionStorage.removeItem(key); } catch {}
}
