const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      let sceneModule;
      const events = {};
      window.__fakeAR = {
        emit(name, detail) {
          for (const listener of events[name] || []) listener({ name, detail });
        },
        tick() { sceneModule?.onUpdate(); },
        get configuration() { return this._configuration; },
      };
      window.XR8 = {
        GlTextureRenderer: { pipelineModule: () => ({ name: 'camera' }) },
        Threejs: {
          pipelineModule: () => ({ name: 'three' }),
          xrScene: () => ({ scene: new window.THREE.Scene(), camera: new window.THREE.PerspectiveCamera(60, 430 / 932, .01, 100) }),
        },
        XrController: {
          configure: (options) => { window.__fakeAR._configuration = options; },
          pipelineModule: () => ({ name: 'controller' }),
        },
        XrConfig: { camera: () => ({ BACK: 'back' }) },
        addCameraPipelineModules(modules) {
          sceneModule = modules.find((module) => module.name === 'rift-next-probe');
          for (const listener of sceneModule.listeners) (events[listener.event] ||= []).push(listener.process);
        },
        run() { sceneModule.onStart(); },
        stop() {},
      };
      window.XRExtras = { FullWindowCanvas: { pipelineModule: () => ({ name: 'full-window' }) } };
    });
    await page.goto('http://127.0.0.1:4173/rift-next/?mode=phone&debug=1');
    await page.getByRole('button', { name: /PORNEȘTE CAMERA/ }).click();
    await page.getByText('CAUTĂ IMAGINEA', { exact: true }).waitFor();
    const configuration = await page.evaluate(() => window.__fakeAR.configuration);
    assert.equal(configuration.disableWorldTracking, false);
    assert.equal(configuration.imageTargetData[0].name, 'rift-screen');
    assert.match(configuration.imageTargetData[0].imagePath, /rift-next\/target-data\/rift-screen_luminance\.png$/);

    await page.evaluate(() => window.__fakeAR.emit('reality.imagefound', {
      name: 'rift-screen', position: { x: 0, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
      scaledWidth: 0.75, scaledHeight: 1,
    }));
    assert.equal(await page.locator('#tracking-state').textContent(), 'CORE ANCORAT');
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).found, true);
    await page.locator('#ar-canvas').click({ position: { x: 215, y: 466 } });
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).coreOpen, true);
    assert.equal(await page.locator('#tracking-state').textContent(), 'CORE DESCHIS');
    await page.evaluate(() => window.__fakeAR.emit('reality.imagelost', { name: 'rift-screen' }));
    assert.equal(await page.locator('#tracking-state').textContent(), 'RECONECTARE');
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).visible, true);
    await page.evaluate(() => window.__fakeAR.emit('reality.imageupdated', {
      name: 'rift-screen', position: { x: .1, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1, scaledWidth: .75,
    }));
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).recoveredCount, 1);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).coreOpen, true);
    await page.evaluate(() => window.__fakeAR.emit('reality.imagelost', { name: 'rift-screen' }));
    await page.waitForTimeout(1150);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal(await page.locator('#tracking-state').textContent(), 'IMAGINE PIERDUTĂ');
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).found, false);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).visible, false);
    assert.deepEqual(errors, []);
    console.log('RIFT NEXT mock camera flow: OK');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
