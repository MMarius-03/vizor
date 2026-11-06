const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    // Never request the machine's actual position, even if browser permission was granted.
    await page.addInitScript(()=>{
      const callbacks=new Map();let counter=0;
      window.fakeGeo={calls:0,cleared:[],callbacks,
        emit(coords,timestamp=Date.now()){for(const cb of callbacks.values())cb.ok({coords,timestamp});},
        fail(code){for(const cb of [...callbacks.values()])cb.error({code});}};
      Object.defineProperty(navigator,'geolocation',{value:{
        watchPosition(ok,error,options){window.fakeGeo.calls++;window.fakeGeo.options=options;callbacks.set(++counter,{ok,error});return counter;},
        clearWatch(id){window.fakeGeo.cleared.push(id);callbacks.delete(id);}
      }});
    });
    await page.goto('http://127.0.0.1:4173/rift-next/explore.html#location');
    await page.waitForFunction(()=>!!window.__CAMPUS_EXPLORE__);
    assert.equal(await page.evaluate(()=>fakeGeo.calls),0,'location must remain opt-in');
    const checks=await page.evaluate(async()=>{
      const {assessPosition,createLocationController,projectCampusPosition}=await import('./campus-location.js?v=1');
      const {campusGeoData:data}=await import('./studies/campus-geo-data.js?v=1');
      const now=Date.now(),position=(lon=26.244,lat=47.641,accuracy=5)=>({coords:{longitude:lon,latitude:lat,accuracy},timestamp:now});
      const states={
        inside:assessPosition(position(),now).state,
        outside:assessPosition(position(26.25,47.65),now).state,
        boundary:assessPosition(position(...data.boundary[5]),now).state,
        inaccurate:assessPosition(position(26.244,47.641,200),now).state,
        stale:assessPosition({...position(),timestamp:now-16000},now).state,
        future:assessPosition({...position(),timestamp:now+6000},now).state,
        invalid:assessPosition(position(NaN),now).state,
      };
      let time=now,callback,sequence=0;const cleared=[],events=[];
      const controller=createLocationController({now:()=>time,onChange:e=>events.push(e),geolocation:{
        watchPosition(ok){callback=ok;return sequence++;},clearWatch(id){cleared.push(id);}}});
      controller.start();callback(position());time+=16000;controller.checkAge();
      const stale=events.at(-1).state;controller.suspend();callback(position());
      const paused=events.at(-1).state;controller.resume();time=now;callback(position());
      const resumed=events.at(-1).state;controller.stop();callback(position());
      const stopped=events.at(-1).state;
      let unsupported;createLocationController({geolocation:null,onChange:e=>unsupported=e.state}).start();
      let syncCleared=false;createLocationController({onChange:()=>{},geolocation:{watchPosition(ok,error){error({code:1});return 4;},clearWatch(){syncCleared=true;}}}).start();
      return {states,stale,paused,resumed,stopped,cleared,unsupported,syncCleared,
        anchors:data.anchors.map(a=>({building:a.building,state:assessPosition(position(a.lon,a.lat)).state,
          delta:Math.hypot(...projectCampusPosition(a.lon,a.lat).map((v,i)=>v-a.map[i]))}))};
    });
    assert.deepEqual(checks.states,{inside:'located',outside:'outside',boundary:'boundary',inaccurate:'inaccurate',stale:'stale',future:'stale',invalid:'invalid'});
    assert.equal(checks.stale,'stale');assert.equal(checks.paused,'paused');assert.equal(checks.resumed,'located');assert.equal(checks.stopped,'off');
    assert.deepEqual(checks.cleared,[0,1]);assert.equal(checks.unsupported,'unsupported');assert.ok(checks.syncCleared);
    for(const a of checks.anchors){assert.equal(a.state,'located',JSON.stringify(a));assert.ok(a.delta<70,JSON.stringify(a));}
    const state=()=>page.locator('#location').getAttribute('data-state');
    const visible=()=>page.evaluate(()=>window.__CAMPUS_EXPLORE__.atlas.root.getObjectByName('campus-user-location').visible);
    await page.locator('.geo-toggle').click();assert.equal(await state(),'waiting');
    assert.deepEqual(await page.evaluate(()=>fakeGeo.options),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    await page.evaluate(()=>fakeGeo.emit({longitude:26.244,latitude:47.641,accuracy:8}));
    assert.equal(await state(),'located');assert.ok(await visible());
    await page.locator('#top').click();
    await page.evaluate(()=>{const s=window.__CAMPUS_EXPLORE__;s.camera.position.sub(s.controls.target).multiplyScalar(.7).add(s.controls.target);s.controls.update();});
    fs.mkdirSync('rift-next/studies/captures',{recursive:true});
    await page.screenshot({path:'rift-next/studies/captures/geolocation-phone.png'});
    const pinPoint=await page.evaluate(async()=>{
      const T=await import('three'),s=window.__CAMPUS_EXPLORE__,root=s.atlas.root.getObjectByName('campus-user-location');
      s.atlas.root.updateWorldMatrix(true,true);s.camera.updateMatrixWorld();
      const p=root.children[0].getWorldPosition(new T.Vector3()).project(s.camera),r=document.querySelector('canvas').getBoundingClientRect();
      return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
    });
    await page.mouse.click(pinPoint.x,pinPoint.y);assert.equal(await page.locator('#place').inputValue(),'');
    await page.evaluate(()=>fakeGeo.emit({longitude:26.244,latitude:47.641,accuracy:100}));
    assert.equal(await state(),'inaccurate');assert.equal(await visible(),false);
    await page.evaluate(()=>fakeGeo.emit({longitude:26.25,latitude:47.65,accuracy:8}));
    assert.equal(await state(),'outside');assert.equal(await visible(),false);
    await page.screenshot({path:'rift-next/studies/captures/geolocation-outside.png'});
    await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));});assert.equal(await state(),'paused');
    assert.equal(await page.evaluate(()=>fakeGeo.callbacks.size),0);
    await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));assert.equal(await state(),'waiting');
    assert.equal(await page.evaluate(()=>fakeGeo.callbacks.size),1);
    await page.evaluate(()=>fakeGeo.fail(1));assert.equal(await state(),'error');
    assert.equal(await page.evaluate(()=>fakeGeo.callbacks.size),0);
    await page.locator('.geo-toggle').click();await page.evaluate(()=>fakeGeo.fail(3));assert.equal(await state(),'error');
    await page.evaluate(()=>fakeGeo.emit({longitude:26.244,latitude:47.641,accuracy:8}));assert.ok(await visible());
    await page.locator('.geo-toggle').click();assert.equal(await state(),'off');assert.equal(await visible(),false);
    assert.equal(await page.evaluate(()=>fakeGeo.callbacks.size),0);
    await page.reload();await page.waitForFunction(()=>!!window.__CAMPUS_EXPLORE__);
    assert.equal(await page.evaluate(()=>fakeGeo.calls),0);
    assert.equal(await page.evaluate(()=>sessionStorage.length+localStorage.length),0);
    assert.deepEqual(errors,[]);
    console.log('Geolocation: opt-in, campus boundary, calibration, stale/invalid positions, lifecycle, errors, stop, pin picking: OK');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
