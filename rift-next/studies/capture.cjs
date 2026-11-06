const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const output = process.argv[2] || path.join(__dirname, 'captures');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/rift-next/studies/');
    await page.waitForFunction(() => !!window.__RIFT_STUDY__);
    await page.waitForTimeout(700);
    const posterImage = await page.evaluate(() => ({
      complete: window.__RIFT_STUDY__.posterAtlas.material.map.image?.complete,
      width: window.__RIFT_STUDY__.posterAtlas.material.map.image?.naturalWidth,
      height: window.__RIFT_STUDY__.posterAtlas.material.map.image?.naturalHeight,
    }));
    assert.ok(posterImage.complete && posterImage.width >= 900 && posterImage.height >= 1200,
      `ATLAS poster failed to decode at full resolution: ${JSON.stringify(posterImage)}`);
    await page.screenshot({ path: path.join(output, 'atlas.png') });
    const atlasStats = await page.evaluate(() => ({
      calls: window.__RIFT_STUDY__.renderer.info.render.calls,
      triangles: window.__RIFT_STUDY__.renderer.info.render.triangles,
    }));
    assert.ok(atlasStats.calls < 200 && atlasStats.triangles < 50000,
      `ATLAS exceeded the mobile rendering budget: ${JSON.stringify(atlasStats)}`);
    console.log('ATLAS render budget:', JSON.stringify(atlasStats));
    const geometryAudit=await page.evaluate(()=>{
      const atlas=window.__RIFT_STUDY__.atlas;
      atlas.setProgress(1);
      for(let i=0;i<120;i++)atlas.update(.05);
      const observatory=atlas.root.getObjectByName('atlas-building-OBSERVATOR');
      const building=atlas.root.getObjectByName('atlas-building-A');
      const body=building.getObjectByName('atlas-building-A-volume');
      body.geometry.computeBoundingBox();
      const roof=building.children.find(child=>child.geometry?.type==='ShapeGeometry');
      const from={entrance:[375,568]},to={entrance:[582,730]};
      const routeOk=atlas.showRoute(from,to);
      const route=atlas.root.getObjectByName('atlas-campus-route');
      const invalid=atlas.showRoute(from,from);
      const preserved=route===atlas.root.getObjectByName('atlas-campus-route');
      atlas.clearRoute();atlas.setProgress(.9);
      return {scale:observatory.scale.toArray(),roofVisible:roof.position.z>body.position.z+body.geometry.boundingBox.max.z,routeOk,invalid,preserved};
    });
    assert.deepEqual(geometryAudit.scale,[1,1,.9]);
    assert.ok(geometryAudit.roofVisible,'roof must sit above the bevelled wall cap');
    assert.ok(geometryAudit.routeOk&&!geometryAudit.invalid&&geometryAudit.preserved,'failed route must preserve the active route');
    const landscape = await page.evaluate(() => {
      const root=window.__RIFT_STUDY__.atlas.root;
      return { trees:root.getObjectByName('atlas-trees').count,
        trunks:root.getObjectByName('atlas-tree-trunks').count,
        benches:root.getObjectByName('atlas-bench-seats').count };
    });
    assert.ok(landscape.trees >= 10 && landscape.trunks === landscape.trees && landscape.benches >= 2,
      `landscape details should have valid placements: ${JSON.stringify(landscape)}`);
    await page.evaluate(() => {
      const study=window.__RIFT_STUDY__;
      study.atlas.selectPlace({ id:'biblioteca',building:'E' });
    });
    await page.waitForTimeout(80);
    await page.screenshot({ path:path.join(output,'atlas-selected.png') });
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-place-selection').parent.name),'atlas-building-E');
    await page.evaluate(() => {
      const atlas=window.__RIFT_STUDY__.atlas;
      atlas.selectPlace({ id:'teren-sport' });
      atlas.setTechnical(true);
    });
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-place-selection').visible),false);
    await page.evaluate(() => { window.__RIFT_STUDY__.atlas.selectPlace(null); window.__RIFT_STUDY__.atlas.setTechnical(false); });
    assert.equal(await page.evaluate(() => !!window.__RIFT_STUDY__.atlas.root.getObjectByName('atlas-place-selection')),false);
    const atlasCanvas = await page.locator('#scene').boundingBox();
    await page.mouse.move(atlasCanvas.x + atlasCanvas.width * .52, atlasCanvas.y + atlasCanvas.height * .48);
    await page.mouse.down();
    await page.mouse.move(atlasCanvas.x + atlasCanvas.width * .68, atlasCanvas.y + atlasCanvas.height * .38,
      { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, 'atlas-angle.png') });
    await page.mouse.move(atlasCanvas.x + atlasCanvas.width * .68, atlasCanvas.y + atlasCanvas.height * .38);
    await page.mouse.down();
    await page.mouse.move(atlasCanvas.x + atlasCanvas.width * .52, atlasCanvas.y + atlasCanvas.height * .48,
      { steps: 8 });
    await page.mouse.up();
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-plan')));
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-building-A')));
    for (const name of ['atlas-contact-shadows','atlas-A-canopy','atlas-E-rotunda',
      'atlas-observatory-main-dome','atlas-pool-arched-roof']) {
      assert.ok(await page.evaluate(objectName => window.__RIFT_STUDY__.atlas.root.getObjectByName(objectName),name),
        `${name} should be present in the ATLAS model`);
    }
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.posterAtlas.visible), true);
    await page.locator('#progress').fill('0');
    await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-building-A').visible), false);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-contact-shadows').visible), false);
    await page.screenshot({ path: path.join(output, 'atlas-terrain.png') });
    await page.locator('#progress').fill('24');
    await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-plan').visible), true);
    await page.screenshot({ path: path.join(output, 'atlas-paths.png') });
    await page.locator('#progress').fill('90');
    await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-building-A').visible), true);
    await page.locator('#technical').click();
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-plan').visible), false);
    await page.screenshot({ path: path.join(output, 'atlas-technical.png') });
    await page.locator('#orbit').click();
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.posterOrbit.visible), true);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.posterAtlas.visible), false);
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.posterOrbit.material.map.image?.naturalWidth >= 900));
    await page.screenshot({ path: path.join(output, 'orbit.png') });
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.orbit.root
      .getObjectByName('orbit-plasma')));
    const plasmaBefore = await page.evaluate(() => window.__RIFT_STUDY__.orbit.plasmaTime);
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(before => window.__RIFT_STUDY__.orbit.plasmaTime > before,
      plasmaBefore), 'ORBIT plasma should move continuously');
    await page.locator('#effect').fill('0');
    const frozenPlasma = await page.evaluate(() => window.__RIFT_STUDY__.orbit.plasmaTime);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.orbit.plasmaTime), frozenPlasma);
    await page.locator('#effect').fill('65');
    await page.locator('#progress').fill('100');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.orbit.aligned), true);
    await page.screenshot({ path: path.join(output, 'orbit-convergence.png') });
    await page.locator('#progress').fill('84');
    await page.waitForTimeout(550);
    await page.locator('#technical').click();
    await page.screenshot({ path: path.join(output, 'orbit-technical.png') });
    await page.setViewportSize({ width: 932, height: 430 });
    await page.locator('#technical').click();
    await page.screenshot({ path: path.join(output, 'orbit-landscape.png') });
    await page.setViewportSize({ width: 430, height: 932 });
    await page.screenshot({ path: path.join(output, 'orbit-phone.png') });
    await page.locator('#atlas').click();
    await page.locator('#technical').click();
    await page.screenshot({ path: path.join(output, 'atlas-phone.png') });
    await page.locator('#technical').click();
    await page.screenshot({ path: path.join(output, 'atlas-phone-technical.png') });
    await page.locator('#progress').fill('100');
    await page.waitForTimeout(450);
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.atlas.progress > .9));
    assert.deepEqual(errors, []);
    console.log('ATLAS and ORBIT 3D studies: OK');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
