const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const output = process.argv[2] || path.join(__dirname, 'selection-captures');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const errors = [];
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    desktop.on('pageerror', error => errors.push(error.message));
    await desktop.goto('http://127.0.0.1:4173/rift-next/');
    await desktop.getByRole('heading', { name: 'Alege un obiect.' }).waitFor();
    assert.match(desktop.url(), /choose\.html$/);
    assert.match(await desktop.locator('#choose-core').getAttribute('href'), /mode=laptop/);
    await desktop.screenshot({ path: path.join(output, 'choose-desktop.png') });
    await desktop.locator('#choose-atlas').click();
    await desktop.waitForFunction(() => window.__RIFT_STUDY__?.atlas?.root.visible);
    assert.equal(await desktop.locator('body').getAttribute('data-object'), 'atlas');
    await desktop.screenshot({ path: path.join(output, 'atlas-desktop.png') });
    await desktop.locator('#back').click();
    await desktop.getByRole('heading', { name: 'Alege un obiect.' }).waitFor();

    const phone = await browser.newPage({ viewport: { width: 430, height: 932 }, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto('http://127.0.0.1:4173/rift-next/choose.html?room=ABCDEF');
    assert.match(await phone.locator('#choose-core').getAttribute('href'), /mode=phone&room=ABCDEF/);
    assert.match(await phone.locator('#choose-orbit').getAttribute('href'), /room=ABCDEF/);
    await phone.screenshot({ path: path.join(output, 'choose-phone.png') });
    await phone.locator('#choose-orbit').click();
    await phone.waitForFunction(() => window.__RIFT_STUDY__?.orbit?.root.visible);
    assert.equal(await phone.locator('body').getAttribute('data-object'), 'orbit');
    assert.match(await phone.locator('#back').getAttribute('href'), /room=ABCDEF/);
    await phone.screenshot({ path: path.join(output, 'orbit-phone.png') });
    await phone.setViewportSize({ width: 667, height: 375 });
    await phone.screenshot({ path: path.join(output, 'orbit-landscape.png') });
    await phone.locator('#back').click();
    await phone.getByRole('heading', { name: 'Alege un obiect.' }).waitFor();
    await phone.screenshot({ path: path.join(output, 'choose-landscape.png') });
    await phone.route('https://rift-sync-api.grassyyew19.chatgpt.site/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        code: 'ABCDEF', state: { experience: 'core', open: false, armed: false,
          nodes: [false, false, false], section: false, pulseCount: 0, revision: 0 },
        presence: { console: true, phone: true },
      }) }));
    await phone.locator('#choose-core').click();
    await phone.getByRole('button', { name: /PORNEȘTE CAMERA/ }).waitFor();
    await phone.waitForFunction(() => document.querySelector('#phone .back-link')?.href.includes('room=ABCDEF'));
    const overflows = await Promise.all([desktop, phone].map(page =>
      page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
    assert.deepEqual(overflows, [false, false]);
    assert.deepEqual(errors, []);
    console.log('RIFT experience selection and responsive themes: OK');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
