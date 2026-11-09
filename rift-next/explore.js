import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAtlas } from './studies/models.js?v=23';
import { campusLayout } from './studies/campus-layout.js?v=4';
import { atlasPlaces, atlasPlaceByBuilding } from './studies/atlas-places.js?v=2';
import { readRoute, saveRoute, forgetRoute } from './route-session.js?v=1';
import { createFrameBudget } from './atlas-quality.js?v=2';
import { mountCampusLocation } from './campus-location.js?v=3';

const $=id=>document.getElementById(id), canvas=$('scene'), view=$('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x233640);
const camera=new THREE.PerspectiveCamera(40,1,.01,40);
const atlas=createAtlas(THREE);atlas.root.rotation.set(-Math.PI/2,0,0);scene.add(atlas.root);
atlas.setProgress(1);atlas.setEffect(0);for(let i=0;i<120;i++)atlas.update(.05);atlas.freezeStatic();
const locationUI=mountCampusLocation(THREE,atlas,$('location'));
if(location.hash==='#location')$('location-panel').open=true;
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
const transparentButton=$('transparent-view');
transparentButton.onclick=()=>{
  const active=!atlas.transparent;
  atlas.setTransparent(active);
  transparentButton.setAttribute('aria-pressed',String(active));
  transparentButton.textContent=active?'Vedere normală':'Mod transparent';
};
const places=[...atlasPlaces,...campusLayout.buildings.filter(b=>!b.neutral&&!atlasPlaceByBuilding.has(b.id)).map(b=>({
  id:`building-${b.id}`,building:b.id,title:/^[A-Z]$/.test(b.id)?`Corpul ${b.id}`:b.id,
  description:'Loc marcat pe planul schematic al campusului USV.'}))];
for(const place of places){const option=new Option(place.title,place.id);$('place').add(option);}
for(const p of atlasPlaces){$('from').add(new Option(p.title,p.id));$('to').add(new Option(p.title,p.id));}
const demoStarts={parc:{point:[770,859],title:'Parcul Universității'},...Object.fromEntries(atlasPlaces.map(p=>[p.id,{point:p.entrance||p.point,title:p.title}]))};
const insideFootprint=(point,poly)=>poly.reduce((hit,a,i)=>{
  const b=poly[(i+1)%poly.length];return hit!==((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]);
},false);
$('from').add(new Option('Poziția simulată','demo'));
$('from').add(new Option('Poziția GPS actuală','gps'));
$('from').value='restaurant';$('to').value='biblioteca';
const guide=$('demo-guide'),progress=$('demo-progress');
function walkDemo(){
  const points=atlas.routeMapPoints;if(!points?.length||locationUI.source!=='demo')return;
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0),fraction=Number(progress.value)/100;
  let remaining=total*fraction,point=points.at(-1);
  for(let i=0;i<lengths.length;i++)if(remaining<=lengths[i]){
    const t=lengths[i]?remaining/lengths[i]:0;
    point=points[i].map((v,j)=>v+(points[i+1][j]-v)*t);break;
  }else remaining-=lengths[i];
  locationUI.moveDemo(point);$('demo-percent').textContent=`${progress.value}%`;
  $('demo-direction').textContent=fraction===1?'Ai ajuns la destinația simulată.':`SIMULARE · urmărește linia albastră spre ${$('to').selectedOptions[0].text}. Parcurs ${progress.value}% din traseul schematic.`;
}
progress.oninput=walkDemo;
$('demo-activate').onclick=()=>{
  const start=demoStarts[$('demo-start').value];locationUI.setDemo(start.point,start.title);
  $('demo-message').textContent=`SIMULARE activă: ${start.title}. Alege destinația și apasă „Arată traseul”.`;
  $('from').value='demo';$('route-panel').open=true;
  atlas.clearRoute();guide.hidden=true;forgetRoute();
};
$('location').addEventListener('click',event=>{if(event.target.closest('.geo-toggle')&&locationUI.source!=='demo'&&$('from').value==='demo'){
  atlas.clearRoute();guide.hidden=true;$('from').value='restaurant';$('demo-message').textContent='Simularea s-a încheiat. GPS-ul real are prioritate.';
}});
$('location').addEventListener('campuslocationchange',event=>{
  if($('from').value==='gps'&&event.detail.source!=='gps'&&atlas.routeMapPoints){
    atlas.clearRoute();guide.hidden=true;$('status').textContent='Poziția GPS nu mai este sigură. Traseul a fost ascuns; așteaptă o poziție nouă.';
  }
});
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
  const hit=ray.intersectObjects([...locationUI.targets,...atlas.buildingTargets],false).find(h=>h.object.parent.visible);
  if(hit?.object.userData.campusLocation){$('location-panel').open=true;$('location').scrollIntoView({block:'nearest'});return;}
  if(hit)select(places.find(p=>p.building===hit.object.userData.atlasBuildingId));
});
function showRoute(from,to){
  if(!from||!to||from===to){$('status').textContent='Alege două locuri diferite.';return false;}
  if(!atlas.showRoute(from,to)){$('status').textContent='Nu am găsit un traseu pentru aceste locuri.';return false;}
  if(from.id==='demo'){
    forgetRoute();guide.hidden=false;progress.value='0';walkDemo();
  }else{if(from.id==='gps')forgetRoute();else saveRoute(from,to);guide.hidden=true;}
  $('status').textContent=`${from.title} → ${to.title}. Intrări orientative. Rotește macheta pentru segmentele ascunse de clădiri.`;return true;
}
$('show-route').onclick=()=>{
  if($('from').value==='gps'&&locationUI.source!=='gps'){$('status').textContent='Activează locația și așteaptă pinul GPS înainte să pornești de aici.';return;}
  if($('from').value==='demo'&&locationUI.source!=='demo'){$('status').textContent='Pornește simularea înainte să alegi poziția simulată ca plecare.';return;}
  let gpsOrigin=locationUI.point;
  if($('from').value==='gps'){
    const building=campusLayout.buildings.find(b=>insideFootprint(gpsOrigin,b.points)&&!b.holes?.some(h=>insideFootprint(gpsOrigin,h)));
    const entrance=atlasPlaces.find(p=>p.building===building?.id)?.entrance;
    if(building&&!entrance){$('status').textContent='Poziția pare în interiorul unei clădiri fără intrare marcată. Ieși pe o alee sau alege plecarea manual.';return;}
    if(entrance)gpsOrigin=entrance;
  }
  const from=$('from').value==='demo'&&locationUI.source==='demo'
    ?{id:'demo',title:'Poziția simulată',point:locationUI.point}
    :$('from').value==='gps'?{id:'gps',title:gpsOrigin===locationUI.point?'Ultima poziție GPS':'Intrarea apropiată de GPS',point:gpsOrigin}:atlasPlaces.find(p=>p.id===$('from').value);
  if(!showRoute(from,atlasPlaces.find(p=>p.id===$('to').value))&&from.id==='gps')$('status').textContent='Nu putem lega sigur poziția de aleile marcate. Ieși pe o alee sau alege o plecare manuală.';
};
$('clear-route').onclick=()=>{atlas.clearRoute();forgetRoute();guide.hidden=true;$('status').textContent='Traseu șters.';};
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
