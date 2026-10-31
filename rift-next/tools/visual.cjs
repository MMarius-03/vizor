const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const output = process.argv[2] || path.join(os.tmpdir(), 'rift-visual-audit');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const laptop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    let creates = 0;
    await laptop.route('https://rift-sync-api.grassyyew19.chatgpt.site/**', async (route) => {
      if (route.request().url().endsWith('/api/room')) creates += 1;
      if (route.request().method() === 'GET') assert.equal(route.request().headers()['content-type'], undefined);
      const state = { experience: 'core', open: false, armed: false, nodes: [false, false, false], revision: 0, lastAction: 'init' };
      await route.fulfill({ status: route.request().url().endsWith('/api/room') ? 201 : 200, contentType: 'application/json', body: JSON.stringify({ code: 'ABCDEF', state, presence: { console: true, phone: false } }) });
    });
    await laptop.goto('http://127.0.0.1:4173/rift-next/?mode=laptop');
    await laptop.getByText('ABCDEF').waitFor();
    await laptop.screenshot({ path: path.join(output, 'laptop.png') });
    await laptop.reload();
    await laptop.getByText('ABCDEF').waitFor();
    assert.equal(creates, 1, 'reloading the laptop must reuse its room');
    await laptop.getByRole('button', { name: /MĂREȘTE ȚINTA/ }).click();
    await laptop.screenshot({ path: path.join(output, 'laptop-focus.png') });

    const phone = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
    await phone.route('https://rift-sync-api.grassyyew19.chatgpt.site/**', async (route) => {
      if (route.request().method() === 'GET') assert.equal(route.request().headers()['content-type'], undefined);
      const state = { experience: 'core', open: true, armed: true, nodes: [true, false, false], revision: 3, lastAction: 'node:0' };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 'ABCDEF', state, presence: { console: true, phone: true } }) });
    });
    await phone.addInitScript(() => {
      let sceneModule;
      window.XR8 = {
        GlTextureRenderer: { pipelineModule: () => ({}) },
        Threejs: { pipelineModule: () => ({}), xrScene: () => ({ scene: new window.THREE.Scene(), camera: new window.THREE.PerspectiveCamera(60, 430 / 932, .01, 100) }) },
        XrController: { configure() {}, pipelineModule: () => ({}) },
        XrConfig: { camera: () => ({ BACK: 'back' }) },
        addCameraPipelineModules(modules) { sceneModule = modules.find((module) => module.name === 'rift-next-probe'); window.__sceneModule = sceneModule; },
        run() { sceneModule.onStart(); }, stop() {},
      };
      window.XRExtras = { FullWindowCanvas: { pipelineModule: () => ({}) } };
    });
    await phone.goto('http://127.0.0.1:4173/rift-next/?mode=phone&room=ABCDEF');
    await phone.getByText('SINCRONIZAT · ABCDEF').first().waitFor();
    await phone.screenshot({ path: path.join(output, 'phone-intro.png') });
    await phone.setViewportSize({ width: 932, height: 430 });
    await phone.screenshot({ path: path.join(output, 'phone-intro-landscape.png') });
    await phone.setViewportSize({ width: 430, height: 932 });
    await phone.getByRole('button', { name: /PORNEȘTE CAMERA/ }).click();
    await phone.getByText('CAUTĂ IMAGINEA', { exact: true }).waitFor();
    await phone.evaluate(() => window.__sceneModule.listeners.find((entry) => entry.event === 'reality.imagefound').process({ detail: {
      name: 'rift-screen', position: { x: 0, y: 0, z: -1 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1, scaledWidth: .75, scaledHeight: 1,
    } }));
    assert.equal(await phone.locator('#node-controls button[data-node="0"]').isDisabled(), true);
    assert.equal(await phone.locator('#node-controls button[data-node="1"]').isEnabled(), true);
    await phone.waitForTimeout(300);
    assert.equal(await phone.locator('#scan-guide').evaluate((element) => getComputedStyle(element).opacity), '0');
    await phone.screenshot({ path: path.join(output, 'phone-live.png') });
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.screenshot({ path: path.join(output, 'phone-live-small.png') });
    await phone.setViewportSize({ width: 932, height: 430 });
    await phone.screenshot({ path: path.join(output, 'phone-live-landscape.png') });
    const model = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
    await model.goto('http://127.0.0.1:4173/rift-next/model-preview.html');
    await model.locator('canvas').waitFor();
    await model.screenshot({ path: path.join(output, 'model-preview.png') });
    await model.locator('canvas').click({ position: { x: 450, y: 350 } });
    await model.waitForTimeout(500);
    await model.screenshot({ path: path.join(output, 'model-open.png') });
    console.log(output);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
