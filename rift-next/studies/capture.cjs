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
    await page.screenshot({ path: path.join(output, 'atlas.png') });
    await page.locator('#technical').click();
    await page.screenshot({ path: path.join(output, 'atlas-technical.png') });
    await page.locator('#orbit').click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, 'orbit.png') });
    await page.locator('#technical').click();
    await page.screenshot({ path: path.join(output, 'orbit-technical.png') });
    await page.setViewportSize({ width: 430, height: 932 });
    await page.locator('#technical').click();
    await page.screenshot({ path: path.join(output, 'orbit-phone.png') });
    await page.locator('#atlas').click();
    await page.screenshot({ path: path.join(output, 'atlas-phone.png') });
    await page.locator('#progress').fill('100');
    await page.waitForTimeout(450);
    assert.ok(await page.evaluate(() => window.__RIFT_STUDY__.atlas.progress > .9));
    assert.deepEqual(errors, []);
    console.log('ATLAS and ORBIT 3D studies: OK');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
