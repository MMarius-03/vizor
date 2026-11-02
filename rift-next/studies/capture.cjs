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
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-green')));
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-building-A')));
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.posterAtlas.visible), true);
    await page.locator('#progress').fill('0');
    await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-building-A').visible), false);
    await page.screenshot({ path: path.join(output, 'atlas-terrain.png') });
    await page.locator('#progress').fill('24');
    await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-green').visible), true);
    await page.screenshot({ path: path.join(output, 'atlas-paths.png') });
    await page.locator('#progress').fill('90');
    await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-building-A').visible), true);
    await page.locator('#technical').click();
    assert.equal(await page.evaluate(() => window.__RIFT_STUDY__.atlas.root
      .getObjectByName('atlas-green').visible), false);
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
