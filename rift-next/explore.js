import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAtlas } from './studies/models.js?v=20';
import { campusLayout } from './studies/campus-layout.js?v=4';
import { atlasPlaces, atlasPlaceByBuilding } from './studies/atlas-places.js?v=2';
import { readRoute, saveRoute, forgetRoute } from './route-session.js?v=1';
import { createFrameBudget } from './atlas-quality.js?v=2';

const $=id=>document.getElementById(id), canvas=$('scene'), view=$('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x233640);
const camera=new THREE.PerspectiveCamera(40,1,.01,40);
const atlas=createAtlas(THREE);atlas.root.rotation.set(-Math.PI/2,0,0);scene.add(atlas.root);
atlas.setProgress(1);atlas.setEffect(0);for(let i=0;i<120;i++)atlas.update(.05);atlas.freezeStatic();
scene.add(new THREE.HemisphereLight(0xeaf3ee,0x243744,2.1));
const key=new THREE.DirectionalLight(0xfff5e4,3.4);key.position.set(-3,5,3);scene.add(key);
const rim=new THREE.DirectionalLight(0x9bcfe8,1.4);rim.position.set(3,2,-2);scene.add(rim);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=1.2;controls.maxDistance=12;
controls.maxPolarAngle=Math.PI/2-.08;controls.enablePan=false;
let width=1,height=1;
const budget=createFrameBudget();
function resize(){width=view.clientWidth;height=view.clientHeight;
  camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,2,1440/Math.max(width,height))*budget.scale);
  renderer.setSize(width,height,false);
}
function fitDistance(){const half=Math.min(Math.PI/9,Math.atan(Math.tan(Math.PI/9)*camera.aspect));return 2.2/Math.sin(half);}
function home(){controls.target.set(0,0,0);const distance=fitDistance();
  camera.position.copy(new THREE.Vector3(1.8,3.6,3.8).normalize().multiplyScalar(distance));controls.update();}
new ResizeObserver(resize).observe(view);resize();home();
$('home').onclick=home;
$('top').onclick=()=>{controls.target.set(0,0,0);camera.position.set(0,fitDistance(),.001);controls.update();};
function zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();}
$('zoom-in').onclick=()=>zoom(.8);$('zoom-out').onclick=()=>zoom(1.25);
const places=[...atlasPlaces,...campusLayout.buildings.filter(b=>!b.neutral&&!atlasPlaceByBuilding.has(b.id)).map(b=>({
  id:`building-${b.id}`,building:b.id,title:/^[A-Z]$/.test(b.id)?`Corpul ${b.id}`:b.id,
  description:'Loc marcat pe planul schematic al campusului USV.'}))];
for(const place of places){const option=new Option(place.title,place.id);$('place').add(option);}
for(const p of atlasPlaces){$('from').add(new Option(p.title,p.id));$('to').add(new Option(p.title,p.id));}
$('from').value='restaurant';$('to').value='biblioteca';
function select(place){atlas.selectPlace(place);$('info').hidden=!place;$('place').value=place?.id||'';
  if(place){$('place-title').textContent=place.title;$('description').textContent=place.description;}}
$('place').onchange=()=>select(places.find(p=>p.id===$('place').value));
const pointers=new Map();let tap=null;
canvas.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,true);tap=pointers.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;});
canvas.addEventListener('pointermove',e=>{if(tap?.id===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)tap=null;});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);tap=null;});
canvas.addEventListener('pointerup',e=>{
  pointers.delete(e.pointerId);if(tap?.id!==e.pointerId)return;tap=null;
  const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();
  ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  const hit=ray.intersectObjects(atlas.buildingTargets,false).find(h=>h.object.parent.visible);
  if(hit)select(places.find(p=>p.building===hit.object.userData.atlasBuildingId));
});
function showRoute(from,to){
  if(!from||!to||from===to){$('status').textContent='Alege două locuri diferite.';return false;}
  if(!atlas.showRoute(from,to)){$('status').textContent='Nu am găsit un traseu pentru aceste locuri.';return false;}
  saveRoute(from,to);$('status').textContent=`${from.title} → ${to.title}. Intrări orientative. Rotește macheta pentru segmentele ascunse de clădiri.`;return true;
}
$('show-route').onclick=()=>showRoute(atlasPlaces.find(p=>p.id===$('from').value),atlasPlaces.find(p=>p.id===$('to').value));
$('clear-route').onclick=()=>{atlas.clearRoute();forgetRoute();$('status').textContent='Traseu șters.';};
const saved=readRoute();if(saved){$('from').value=saved.from.id;$('to').value=saved.to.id;showRoute(saved.from,saved.to);}
let last=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
renderer.setAnimationLoop(now=>{
  if(document.hidden){last=0;return;}
  const ms=last?now-last:0;last=now;
  if(budget.sample(ms,true))resize();
  controls.enableDamping=!reduced.matches;controls.update();
  atlas.updateSelection(Math.min(ms/1000,.05));atlas.updateRoute(Math.min(ms/1000,.05));renderer.render(scene,camera);
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);$('error').hidden=false;});
window.__CAMPUS_EXPLORE__={atlas,renderer,camera,controls};
