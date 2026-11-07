import { campusGeoData as data } from './studies/campus-geo-data.js?v=1';

export const geoLimits = { maxAccuracy:35, maxAge:15000 };
const metres=(lon,lat)=>[(lon-data.origin.lon)*data.metresPerLongitudeDegree,(lat-data.origin.lat)*data.metresPerLatitudeDegree];
const boundary=data.boundary.map(([lon,lat])=>metres(lon,lat));
const inside=(p,poly)=>poly.reduce((hit,a,i)=>{
  const b=poly[(i+1)%poly.length];
  return hit!==((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]);
},false);
const edgeDistance=p=>Math.min(...boundary.map((a,i)=>{
  const b=boundary[(i+1)%boundary.length],dx=b[0]-a[0],dy=b[1]-a[1];
  const t=dx||dy?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}));
export function projectCampusPosition(longitude,latitude) {
  const [east,north]=metres(longitude,latitude),m=data.transform;
  return [east*m[0][0]+north*m[1][0]+m[2][0],east*m[0][1]+north*m[1][1]+m[2][1]];
}
export function assessPosition(position,now=Date.now()) {
  const {latitude,longitude,accuracy}=position?.coords||{};
  if (![latitude,longitude,accuracy,position?.timestamp].every(Number.isFinite)||Math.abs(latitude)>90||Math.abs(longitude)>180||accuracy<=0)
    return {state:'invalid',text:'Poziția primită nu este validă. Așteptăm o nouă măsurare.'};
  if(now-position.timestamp>geoLimits.maxAge||position.timestamp>now+5000)
    return {state:'stale',text:'Poziția nu mai este actuală. Așteptăm semnal GPS nou.'};
  const p=metres(longitude,latitude),inCampus=inside(p,boundary),distance=edgeDistance(p);
  if(!inCampus&&distance>accuracy)return {state:'outside',text:'Ești în afara campusului USV. Poți explora harta manual.'};
  if(accuracy>geoLimits.maxAccuracy)return {state:'inaccurate',text:`Precizie GPS slabă (±${Math.ceil(accuracy)} m). Ieși într-un loc deschis și așteaptă.`};
  if(!inCampus||distance<accuracy)return {state:'boundary',text:'Ești aproape de limita campusului. Așteptăm o poziție mai sigură înainte să afișăm pinul.'};
  const point=projectCampusPosition(longitude,latitude);
  if(point.some(v=>v<0||v>1000))return {state:'unmapped',text:'Ești în campus, într-o zonă care nu este cuprinsă în această machetă.'};
  const nearest=data.anchors.map(a=>({...a,distance:Math.hypot(...metres(a.lon,a.lat).map((v,i)=>v-p[i]))})).sort((a,b)=>a.distance-b.distance)[0];
  const landmark=nearest.distance<65 ? (nearest.building==='OBSERVATOR'?'Observatorului':`corpului ${nearest.building}`) : null;
  return {state:'located',point,accuracy,radius:accuracy+data.calibrationErrorMetres,
    text:`Poziție aproximativă în campus${landmark?`, în apropierea ${landmark}`:''}. Precizie GPS ±${Math.ceil(accuracy)} m. Zona estimată pe machetă: ~${Math.ceil(accuracy+data.calibrationErrorMetres)} m.`};
}

// The controller never stores coordinates or sends them to the project backend.
export function createLocationController({onChange,geolocation=navigator.geolocation,now=Date.now}) {
  let watch=null,active=false,generation=0,last=null;
  const clear=()=>{generation++;if(watch!==null)geolocation?.clearWatch(watch);watch=null;last=null;};
  const notify=result=>onChange({...result,active});
  function watchLocation(){
    clear();notify({state:'waiting',text:'Căutăm poziția. Permite locația precisă în browser.'});
    const token=generation;
    try {
      const id=geolocation.watchPosition(position=>{
        if(token!==generation||!active)return;
        last=position;notify(assessPosition(position,now()));
      },error=>{
        if(token!==generation||!active)return;
        last=null;
        if(error.code===1){active=false;clear();}
        notify({state:error.code===1?'denied':'error',text:error.code===1?'Safari a refuzat accesul la locație. Schimbă permisiunea pentru acest site, apoi încearcă din nou.':error.code===3?'Localizarea durează. Rămâi într-un loc deschis; continuăm să căutăm.':'Poziția nu este disponibilă momentan. Continuăm să căutăm.'});
      },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
      if(token===generation&&active)watch=id;else geolocation.clearWatch(id);
    } catch {active=false;clear();notify({state:'error',text:'Localizarea nu a putut porni. Verifică permisiunea browserului.'});}
  }
  return {
    start(){if(active)return;if(!geolocation){notify({state:'unsupported',text:'Browserul nu oferă geolocație. Poți explora manual.'});return;}active=true;watchLocation();},
    stop(){active=false;clear();notify({state:'off',text:'Localizarea este oprită.'});},
    suspend(){if(active){clear();notify({state:'paused',text:'Localizarea este în pauză.'});}},
    resume(){if(active&&watch===null)watchLocation();},
    checkAge(){if(last&&now()-last.timestamp>geoLimits.maxAge){last=null;notify({state:'stale',text:'Poziția nu mai este actuală. Așteptăm semnal GPS nou.'});}},
    get active(){return active;},
  };
}

export function mountCampusLocation(THREE,atlas,container) {
  container.innerHTML='<button type="button" class="geo-toggle">Arată unde sunt</button><p class="geo-status" role="status">Locație beta · disponibilă în campus. Poziția rămâne în browser.</p><div class="geo-help" hidden><p>Pe iPhone: apasă meniul din stânga adresei Safari → Setări pentru site → Localizare → Permite sau Întreabă. Verifică și Configurări → Confidențialitate și securitate → Servicii de localizare → Safari Websites, cu Localizare precisă activată. Revino aici și apasă „Arată unde sunt”.</p><a href="https://support.apple.com/guide/iphone/browse-the-web-privately-iphb01fc3c85/ios" target="_blank" rel="noopener noreferrer">Pașii Apple pentru Safari ↗</a></div><p class="geo-note">Machetă schematică; verifică poziția pe teren. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Date © OpenStreetMap contributors</a></p>';
  const button=container.querySelector('button'),status=container.querySelector('.geo-status'),help=container.querySelector('.geo-help');
  const root=new THREE.Group();root.name='campus-user-location';root.visible=false;atlas.root.add(root);
  const pin=new THREE.Mesh(new THREE.SphereGeometry(.035,16,10),new THREE.MeshBasicMaterial({color:0xef4545}));
  pin.position.z=.48;root.add(pin);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,.13,8),new THREE.MeshBasicMaterial({color:0xef4545}));
  stem.rotation.x=Math.PI/2;stem.position.z=.415;root.add(stem);
  pin.userData.campusLocation=stem.userData.campusLocation=true;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.97,1,64),new THREE.MeshBasicMaterial({color:0xef6565,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));
  ring.position.z=.041;root.add(ring);
  // Transform a geographic accuracy circle into the schematic map's local axes.
  const m=data.transform;
  ring.matrixAutoUpdate=false;
  let result={state:'off',text:'Localizarea este oprită.'},demoPoint=null,demoLabel='';
  const placePin=point=>root.position.set((point[0]/1000-.5)*3.28,(.5-point[1]/1000)*2.44,0);
  const controller=createLocationController({onChange:next=>{
    result=next;status.textContent=next.text;container.dataset.state=next.state;help.hidden=next.state!=='denied';
    button.textContent=next.active?'Oprește locația':'Arată unde sunt';button.setAttribute('aria-pressed',String(next.active));
    root.visible=next.state==='located';
    if(root.visible){placePin(next.point);ring.visible=true;
      const radius=next.radius;
      ring.matrix.set(m[0][0]*.00328*radius,m[1][0]*.00328*radius,0,0,
        -m[0][1]*.00244*radius,-m[1][1]*.00244*radius,0,0,0,0,1,.041,0,0,0,1);
      ring.matrixWorldNeedsUpdate=true;
    }
    container.dispatchEvent(new CustomEvent('campuslocationchange',{detail:{source:next.state==='located'?'gps':null,state:next.state}}));
  }});
  button.setAttribute('aria-pressed','false');
  button.onclick=()=>{demoPoint=null;controller.active?controller.stop():controller.start();};
  const visibility=()=>document.hidden?controller.suspend():controller.resume();
  const hide=()=>controller.suspend(),show=()=>{if(!document.hidden)controller.resume();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
  const timer=setInterval(()=>controller.checkAge(),3000);
  return {targets:[pin,stem],get visible(){return root.visible;},get description(){return result.text;},
    get point(){return demoPoint||result.state==='located'&&result.point||null;},get source(){return demoPoint?'demo':result.state==='located'?'gps':null;},
    setDemo(point,label){
      if(controller.active)controller.stop();
      demoPoint=point;demoLabel=label;placePin(point);root.visible=true;ring.visible=false;
      container.dataset.state='demo';status.textContent=`SIMULARE · ${label}. Poziție aleasă pe machetă, fără GPS.`;
      button.textContent='Arată unde sunt';button.setAttribute('aria-pressed','false');help.hidden=true;
      container.dispatchEvent(new CustomEvent('campuslocationchange',{detail:{source:'demo',state:'demo'}}));
    },
    moveDemo(point){if(!demoPoint)return;demoPoint=point;placePin(point);root.visible=true;status.textContent=`SIMULARE · ${demoLabel}. Pinul urmează traseul ales, fără GPS.`;},
    clearDemo(){if(!demoPoint)return;demoPoint=null;root.visible=false;container.dataset.state='off';status.textContent='Localizarea este oprită.';
      container.dispatchEvent(new CustomEvent('campuslocationchange',{detail:{source:null,state:'off'}}));},
    dispose(){controller.stop();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);
      root.removeFromParent();root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}};
}
