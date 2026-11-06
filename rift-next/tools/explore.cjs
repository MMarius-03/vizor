const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/rift-next/explore.html');
    await page.waitForFunction(()=>!!window.__CAMPUS_EXPLORE__);
    const quality=await page.evaluate(async()=>{
      const {createFrameBudget}=await import('./atlas-quality.js?v=2');
      const slow=createFrameBudget(),spike=createFrameBudget(),background=createFrameBudget(),severe=createFrameBudget();
      for(let i=0;i<300;i++){slow.sample(120);spike.sample(i===100?500:16.67);background.sample(120,false);severe.sample(1500);}
      return [slow.scale,spike.scale,background.scale,severe.scale];
    });
    assert.deepEqual(quality,[.7,1,1,.7]);
    await page.locator('#place').selectOption('observator');
    assert.equal(await page.locator('#place-title').textContent(),'Observatorul Astronomic');
    await page.locator('#place').selectOption('');await page.locator('#top').click();
    const touch=await page.evaluate(async()=>{
      const T=await import('three'),s=window.__CAMPUS_EXPLORE__;
      s.atlas.root.updateWorldMatrix(true,true);s.camera.updateMatrixWorld();
      const point=s.atlas.root.getObjectByName('atlas-observatory-main-dome').getWorldPosition(new T.Vector3()).project(s.camera);
      const r=document.querySelector('canvas').getBoundingClientRect();
      return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2};
    });
    await page.mouse.click(touch.x,touch.y);
    assert.equal(await page.locator('#place').inputValue(),'observator','clicking geometry must open its own place');
    await page.locator('#route-panel summary').click();
    await page.locator('#show-route').click();
    assert.match(await page.locator('#status').textContent(),/Restaurantul.*Biblioteca/);
    assert.ok(await page.evaluate(()=>{
      const route=window.__CAMPUS_EXPLORE__.atlas.root.getObjectByName('atlas-campus-route');
      return route.children.every(child=>child.material.depthTest);
    }));
    await page.reload();await page.waitForFunction(()=>!!window.__CAMPUS_EXPLORE__);
    assert.match(await page.locator('#status').textContent(),/Restaurantul.*Biblioteca/);
    await page.locator('#route-panel summary').click();
    await page.locator('#to').selectOption('restaurant');await page.locator('#show-route').click();
    assert.equal(await page.locator('#status').textContent(),'Alege două locuri diferite.');
    assert.ok(await page.evaluate(()=>window.__CAMPUS_EXPLORE__.atlas.root.getObjectByName('atlas-campus-route')));
    await page.locator('#to').selectOption('biblioteca');
    await page.locator('#place').selectOption('observator');
    const distance=()=>page.evaluate(()=>window.__CAMPUS_EXPLORE__.camera.position.distanceTo(window.__CAMPUS_EXPLORE__.controls.target));
    const before=await distance();await page.locator('#zoom-in').click();assert.ok(await distance()<before);
    fs.mkdirSync('rift-next/studies/captures',{recursive:true});
    for(const [name,width,height] of [['desktop',1280,800],['phone',390,844],['small',375,667],['landscape',932,430]]){
      await page.setViewportSize({width,height});await page.locator('#home').click();await page.waitForTimeout(150);
      const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,canvas:document.querySelector('canvas').getBoundingClientRect().height}));
      assert.ok(layout.width<=layout.viewport&&layout.canvas>=180,JSON.stringify(layout));
      await page.screenshot({path:`rift-next/studies/captures/explore-${name}.png`});
    }
    await page.locator('#top').click();await page.waitForTimeout(150);
    await page.screenshot({path:'rift-next/studies/captures/explore-route-top.png'});
    await page.locator('#clear-route').click();await page.reload();await page.waitForFunction(()=>!!window.__CAMPUS_EXPLORE__);
    assert.equal(await page.evaluate(()=>!!window.__CAMPUS_EXPLORE__.atlas.root.getObjectByName('atlas-campus-route')),false);
    await page.evaluate(()=>sessionStorage.setItem('rift-campus-route-v1','{invalid'));
    await page.reload();await page.waitForFunction(()=>!!window.__CAMPUS_EXPLORE__);
    assert.deepEqual(errors,[]);
    console.log('CAMPUS exploration, quality recovery, route persistence and responsive layout: OK');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
