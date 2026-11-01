const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const laptop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    laptop.on('pageerror', (error) => errors.push(error.message));
    await laptop.goto('http://127.0.0.1:4173/rift-next/?mode=laptop');
    await laptop.waitForFunction(() => /^[A-HJ-NP-Z2-9]{6}$/.test(document.querySelector('#room-code')?.textContent || ''), null, { timeout: 15000 });
    const room = (await laptop.locator('#room-code').textContent()).trim();

    const phone = await browser.newPage({ viewport: { width: 430, height: 932 } });
    phone.on('pageerror', (error) => errors.push(error.message));
    await phone.addInitScript(() => {
      let sceneModule;
      window.__fakeAR = {
        emit(name, detail) {
          sceneModule.listeners.find((entry) => entry.event === name)?.process({ detail });
        },
        tick() { sceneModule?.onUpdate(); },
      };
      window.XR8 = {
        GlTextureRenderer: { pipelineModule: () => ({}) },
        Threejs: { pipelineModule: () => ({}), xrScene: () => ({
          scene: new window.THREE.Scene(),
          camera: new window.THREE.PerspectiveCamera(60, 430 / 932, .01, 100),
        }) },
        XrController: { configure() {}, pipelineModule: () => ({}) },
        XrConfig: { camera: () => ({ BACK: 'back' }) },
        addCameraPipelineModules(modules) { sceneModule = modules.find((module) => module.name === 'rift-next-probe'); },
        run() { sceneModule.onStart(); }, stop() {},
      };
      window.XRExtras = { FullWindowCanvas: { pipelineModule: () => ({}) } };
    });
    await phone.goto(`http://127.0.0.1:4173/rift-next/?mode=phone&room=${room}`);
    await phone.getByText(`SINCRONIZAT · ${room}`).first().waitFor({ timeout: 15000 });
    const start = async () => {
      await phone.getByRole('button', { name: /PORNEȘTE CAMERA/ }).click();
      await phone.getByText('CAUTĂ IMAGINEA', { exact: true }).waitFor();
      await phone.evaluate(() => window.__fakeAR.emit('reality.imagefound', {
        name: 'rift-screen', position: { x: 0, y: 0, z: -1 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
        scaledWidth: .75, scaledHeight: 1,
      }));
    };
    await start();
    await phone.locator('#ar-canvas').click({ position: { x: 215, y: 466 } });
    await laptop.getByText('CORE DESCHIS', { exact: true }).waitFor({ timeout: 15000 });
    await phone.mouse.move(215, 466);
    await phone.mouse.down();
    await phone.mouse.move(310, 466, { steps: 6 });
    await phone.mouse.up();
    await laptop.getByText('MECANISM ARMAT', { exact: true }).waitFor({ timeout: 15000 });
    for (let index = 0; index < 3; index += 1) {
      await phone.locator(`#node-controls button[data-node="${index}"]`).click();
    }
    await laptop.getByText('CORE STABIL', { exact: true }).waitFor({ timeout: 15000 });
    await phone.locator('#ar-canvas').click({ position: { x: 215, y: 466 } });
    await laptop.locator('#sync-stage.sync-pulse').waitFor({ timeout: 15000 });
    await phone.reload();
    await start();
    await phone.getByRole('button', { name: 'REIA CICLUL' }).waitFor();
    await phone.getByRole('button', { name: 'REIA CICLUL' }).click();
    await laptop.getByText('CORE ÎNCHIS', { exact: true }).waitFor({ timeout: 15000 });
    assert.equal((await laptop.locator('#room-code').textContent()).trim(), room);
    assert.deepEqual(errors, []);
    console.log('RIFT NEXT live laptop–phone cycle: OK');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
