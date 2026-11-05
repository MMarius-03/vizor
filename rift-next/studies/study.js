import * as THREE from 'three';
import { createAtlas, createOrbit } from './models.js?v=11';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const room = new URLSearchParams(location.search).get('room');
if (room) $('back').href = `../choose.html?room=${encodeURIComponent(room)}`;
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.55;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111311);
const camera = new THREE.PerspectiveCamera(40,1,.01,30);
const atlas = createAtlas(THREE);
const orbit = createOrbit(THREE);
scene.add(atlas.root,orbit.root);
const posterGeometry = new THREE.PlaneGeometry(4.3,5.75);
const loader = new THREE.TextureLoader();
const makePoster = file => {
  const map = loader.load(file);
  map.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(posterGeometry,
    new THREE.MeshBasicMaterial({map,transparent:true,opacity:.88,depthWrite:false}));
  mesh.position.z = -.52;
  scene.add(mesh);
  return mesh;
};
const posterAtlas = makePoster('../target-data/atlas-screen_original.png?v=4');
const posterOrbit = makePoster('./poster-orbit.svg');
const ambient = new THREE.HemisphereLight(0xfff4e0,0x343c45,2.3);
scene.add(ambient);
const key = new THREE.DirectionalLight(0xfff0dc,4.2);
key.position.set(-2.6,3.8,5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x7ca4d4,2.5);
rim.position.set(3,-2,2);
scene.add(rim);

let active='atlas';
let azimuth=0;
let elevation=.06;
let pointer=null;
let previous=0;
const renderPhase=value=>{
  $('phase').textContent=active==='atlas'
    ? value<.18?'01 / TEREN':value<.43?'02 / ALEI':value<.8?'03 / CLĂDIRI':'04 / CAMPUS COMPLET'
    : value<.25?'01 / REPAUS':value<.55?'02 / BRAȚELE SE DESCHID':value<.94?'03 / CALIBRARE':'04 / CONVERGENȚĂ';
};
const updateCamera=()=>{
  const radius=Math.max(8.6,4.15/(2*Math.tan(THREE.MathUtils.degToRad(20))*camera.aspect));
  camera.position.set(Math.sin(azimuth)*radius*Math.cos(elevation),
    Math.sin(elevation)*radius,Math.cos(azimuth)*radius*Math.cos(elevation));
  camera.lookAt(0,0,.25);
};
const setActive=name=>{
  active=name;
  const isAtlas=name==='atlas';
  azimuth=isAtlas?0:.38;
  elevation=isAtlas?.06:.22;
  updateCamera();
  document.body.dataset.object=name;
  scene.background.setHex(isAtlas?0x191612:0x101721);
  $('brand').innerHTML=`${isAtlas?'ATLAS':'ORBIT'}<span> / RIFT</span>`;
  atlas.root.visible=isAtlas;
  orbit.root.visible=!isAtlas;
  posterAtlas.visible=isAtlas;
  posterOrbit.visible=!isAtlas;
  $('atlas').setAttribute('aria-pressed',String(isAtlas));
  $('orbit').setAttribute('aria-pressed',String(!isAtlas));
  $('technical').setAttribute('aria-pressed',String(isAtlas?atlas.technical:orbit.technical));
  $('name').textContent=isAtlas?'ATLAS — campus în miniatură':'ORBIT — instrument cinetic';
  $('description').textContent=isAtlas
    ? 'Corpurile campusului se ridică între alei și curți verzi.'
    : 'Brațe și inele pe axe diferite, cu aliniere controlată.';
  $('range-name').textContent=isAtlas?'CONSTRUIEȘTE':'CALIBREAZĂ AXELE';
  $('progress').value=isAtlas?90:84;
  $('value').textContent=isAtlas?'90%':'302°';
  $('effect-name').textContent=isAtlas?'ACCENTUL PINULUI':'ENERGIA PLASMEI';
  $('effect').value=Math.round((isAtlas?atlas.effect:orbit.effect)*100);
  $('effect-value').textContent=`${$('effect').value}%`;
  document.documentElement.style.setProperty('--accent',isAtlas?'#4f9ed1':'#638bc6');
  const query = new URLSearchParams({object:name});
  if (room) query.set('room',room);
  history.replaceState(null,'',`?${query}`);
  renderPhase(isAtlas ? .9 : .84);
  if(isAtlas) atlas.setProgress(.9); else orbit.setProgress(.84);
};
$('atlas').addEventListener('click',()=>setActive('atlas'));
$('orbit').addEventListener('click',()=>setActive('orbit'));
$('technical').addEventListener('click',()=>{
  const model=active==='atlas'?atlas:orbit;
  model.setTechnical(!model.technical);
  $('technical').setAttribute('aria-pressed',String(model.technical));
});
$('progress').addEventListener('input',event=>{
  const value=Number(event.target.value)/100;
  if(active==='atlas') atlas.setProgress(value); else orbit.setProgress(value);
  $('value').textContent=active==='atlas'?`${Math.round(value*100)}%`:`${Math.round(value*360)}°`;
  renderPhase(value);
});
$('effect').addEventListener('input',event=>{
  const value=Number(event.target.value)/100;
  (active==='atlas'?atlas:orbit).setEffect(value);
  $('effect-value').textContent=`${event.target.value}%`;
});
canvas.addEventListener('pointerdown',event=>{
  pointer={id:event.pointerId,x:event.clientX,y:event.clientY,azimuth,elevation};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!pointer||event.pointerId!==pointer.id)return;
  azimuth=pointer.azimuth+(event.clientX-pointer.x)*.006;
  elevation=THREE.MathUtils.clamp(pointer.elevation-(event.clientY-pointer.y)*.004,-.5,.65);
  updateCamera();
});
const end=event=>{if(pointer?.id===event.pointerId)pointer=null;};
canvas.addEventListener('pointerup',end);
canvas.addEventListener('pointercancel',end);
const resize=()=>{
  renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  updateCamera();
};
addEventListener('resize',resize);
resize();
updateCamera();
setActive(new URLSearchParams(location.search).get('object')==='orbit'?'orbit':'atlas');
const draw=now=>{
  const dt=Math.min((now-(previous||now))/1000,.05);
  previous=now;
  atlas.update(dt);
  orbit.update(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(draw);
};
requestAnimationFrame(draw);
window.__RIFT_STUDY__={atlas,orbit,posterAtlas,posterOrbit,setActive,renderer};
