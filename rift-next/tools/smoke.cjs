const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
    const cdp = await page.context().newCDPSession(page);
    const touchDrag = async (startX, startY, endX, endY) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY, id: 1 }] });
      for (let step = 1; step <= 6; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
          x: startX + (endX - startX) * step / 6,
          y: startY + (endY - startY) * step / 6, id: 1,
        }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
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
          xrScene: () => {
            const result = { scene: new window.THREE.Scene(), camera: new window.THREE.PerspectiveCamera(60, 430 / 932, .01, 100), renderer: { localClippingEnabled: false } };
            window.__fakeAR.scene = result;
            return result;
          },
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
      name: 'rift-screen', position: { x: NaN, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
    }));
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).foundCount, 0);
    await page.evaluate(() => window.__fakeAR.emit('reality.imagefound', {
      name: 'rift-screen', position: { x: 0, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
    }));
    assert.equal(await page.locator('#tracking-state').textContent(), 'CORE ANCORAT');
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).found, true);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).anchorSized, false);
    await page.evaluate(() => window.__fakeAR.emit('reality.imageupdated', {
      name: 'rift-screen', position: { x: 0, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
      scaledWidth: .75, scaledHeight: 1,
    }));
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).anchorSized, true);
    const uiMutations = await page.evaluate(async () => {
      let count = 0;
      const observer = new MutationObserver((records) => { count += records.length; });
      for (const id of ['tracking-state', 'instruction', 'restart']) {
        observer.observe(document.getElementById(id), { childList: true, subtree: true, characterData: true });
      }
      for (let i = 0; i < 30; i += 1) window.__fakeAR.emit('reality.imageupdated', {
        name: 'rift-screen', position: { x: i * .001, y: 0, z: -1 },
        rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
        scaledWidth: .75, scaledHeight: 1,
      });
      await Promise.resolve();
      observer.disconnect();
      return count;
    });
    assert.equal(uiMutations, 0, 'tracking updates should not rewrite the HUD');
    await page.touchscreen.tap(215, 466);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).coreOpen, true);
    assert.equal(await page.locator('#tracking-state').textContent(), 'CORE DESCHIS');
    await page.evaluate(() => window.__fakeAR.emit('reality.imagescanning', {}));
    assert.equal(await page.locator('#tracking-state').textContent(), 'CORE DESCHIS');
    await page.evaluate(() => window.__fakeAR.tick());
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal(await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-node-1').visible), true);
    const framePoint = await page.evaluate(() => {
      const { scene, camera } = window.__fakeAR.scene;
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      const point = scene.getObjectByName('rift-hit-frame').getWorldPosition(new window.THREE.Vector3()).project(camera);
      return { x: (point.x + 1) * 430 / 2, y: (1 - point.y) * 932 / 2 };
    });
    await page.mouse.click(framePoint.x, framePoint.y);
    assert.match((await page.evaluate(() => window.__RIFT_NEXT__.getState())).lastEvent, /^piesă:/);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal(await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-selection').visible), true);
    const nodePoints = await page.evaluate(() => {
      const { scene, camera } = window.__fakeAR.scene;
      scene.updateMatrixWorld(true);
      camera.updateMatrixWorld();
      const rect = document.getElementById('ar-canvas').getBoundingClientRect();
      return [1, 2, 3].map((index) => {
        const position = scene.getObjectByName(`rift-node-${index}`).getWorldPosition(new window.THREE.Vector3()).project(camera);
        return { x: rect.left + (position.x + 1) * rect.width / 2, y: rect.top + (1 - position.y) * rect.height / 2 };
      });
    });
    await page.mouse.click(nodePoints[0].x, nodePoints[0].y);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).progress, 0);
    await touchDrag(215, 466, 215, 566);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).armed, false);
    await touchDrag(215, 466, 310, 466);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).armed, true);
    await page.locator('#ar-canvas').click({ position: { x: 215, y: 466 } });
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).coreOpen, true,
      'a missed node tap must not close the armed core');
    await page.evaluate(() => window.__fakeAR.tick());
    await page.locator('#node-controls button[data-node="0"]').click();
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).progress, 1);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal(await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-energy-1').visible), true);
    for (let i = 1; i < 3; i += 1) {
      await page.mouse.click(nodePoints[i].x, nodePoints[i].y);
      assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).progress, i + 1);
    }
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__fakeAR.tick());
    const spatialFinish = await page.evaluate(() => ({
      crown: window.__fakeAR.scene.scene.getObjectByName('rift-crown').visible,
      pulse: window.__fakeAR.scene.scene.getObjectByName('rift-pulse').visible,
      nodeDepth: window.__fakeAR.scene.scene.getObjectByName('rift-node-3').position.z,
    }));
    assert.equal(spatialFinish.crown, true);
    assert.equal(spatialFinish.pulse, true);
    assert.ok(spatialFinish.nodeDepth > .56);
    assert.equal(await page.locator('#tracking-state').textContent(), 'CORE STABIL');
    assert.equal(await page.locator('#restart').textContent(), 'REIA CICLUL');
    await page.locator('#ar-canvas').click({ position: { x: 215, y: 466 } });
    await page.evaluate(() => window.__fakeAR.tick());
    const pulseState = await page.evaluate(() => ({
      state: window.__RIFT_NEXT__.getState(),
      scale: window.__fakeAR.scene.scene.getObjectByName('rift-nucleus').scale.x,
    }));
    assert.equal(pulseState.state.lastEvent, 'impuls core');
    assert.equal(pulseState.state.complete, true);
    assert.ok(pulseState.scale > 1);
    const rotorBefore = await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-rotor').rotation.z);
    await page.mouse.move(215, 466);
    await page.mouse.down();
    await page.mouse.move(310, 466, { steps: 6 });
    await page.mouse.up();
    await page.evaluate(() => window.__fakeAR.tick());
    const rotorAfter = await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-rotor').rotation.z);
    assert.notEqual(rotorAfter, rotorBefore);
    const nucleusBeforeSection = await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-nucleus').position.z);
    await touchDrag(215, 466, 215, 356);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).sectionOpen, true);
    assert.equal(await page.locator('#tracking-state').textContent(), 'SECȚIUNE DESCHISĂ');
    await page.waitForTimeout(100);
    await page.evaluate(() => window.__fakeAR.tick());
    const nucleusAfterSection = await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-nucleus').position.z);
    assert.ok(nucleusAfterSection > nucleusBeforeSection);
    await page.getByRole('button', { name: 'ÎNCHIDE SECȚIUNEA' }).click();
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).sectionOpen, false);
    await page.getByRole('button', { name: 'SECȚIONEAZĂ NUCLEUL' }).click();
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).sectionOpen, true);
    await touchDrag(215, 466, 215, 566);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).sectionOpen, false);
    await page.getByRole('button', { name: 'SECȚIONEAZĂ NUCLEUL' }).click();
    await page.evaluate(() => window.__fakeAR.emit('reality.imagelost', { name: 'rift-screen' }));
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).visible, true);
    assert.equal(await page.locator('#section-toggle').isHidden(), true);
    await page.evaluate(() => window.__fakeAR.emit('reality.imageupdated', {
      name: 'rift-screen', position: { x: 0, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
    }));
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).sectionOpen, true);
    assert.equal(await page.locator('#section-toggle').isVisible(), true);
    await page.locator('#restart').click();
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal(await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('rift-crown').visible), false);
    const resetState = await page.evaluate(() => window.__RIFT_NEXT__.getState());
    assert.equal(resetState.progress, 0);
    assert.equal(resetState.armed, false);
    assert.equal(resetState.coreOpen, false);
    assert.equal(resetState.sectionOpen, false);
    assert.equal(await page.locator('#section-toggle').isHidden(), true);
    assert.equal(await page.locator('#tracking-state').textContent(), 'CORE ANCORAT');
    assert.equal(await page.locator('#restart').textContent(), 'REPORNEȘTE CAMERA');
    await page.locator('#ar-canvas').click({ position: { x: 215, y: 466 } });
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).coreOpen, true);
    await page.evaluate(() => window.__fakeAR.tick());
    await page.evaluate(() => window.__fakeAR.emit('reality.imageupdated', {
      name: 'rift-screen', position: { x: 0, y: 0, z: -.65 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1.3,
      scaledWidth: .975, scaledHeight: 1.3,
    }));
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).poseZ, -1);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).poseScale, 1);
    await page.waitForTimeout(80);
    await page.evaluate(() => window.__fakeAR.tick());
    const smoothed = await page.evaluate(() => window.__RIFT_NEXT__.getState());
    assert.ok(smoothed.poseZ > -1 && smoothed.poseZ < -.65);
    assert.ok(smoothed.poseScale > 1 && smoothed.poseScale < 1.3);
    await page.evaluate(() => window.__fakeAR.emit('reality.imagelost', { name: 'rift-screen' }));
    assert.equal(await page.locator('#tracking-state').textContent(), 'RECONECTARE');
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).visible, true);
    await page.evaluate(() => window.__fakeAR.emit('reality.imageupdated', {
      name: 'rift-screen', position: { x: .1, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1, scaledWidth: .75,
    }));
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).recoveredCount, 2);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).coreOpen, true);
    await page.evaluate(() => window.__fakeAR.emit('reality.imagelost', { name: 'rift-screen' }));
    await page.waitForTimeout(1150);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal(await page.locator('#tracking-state').textContent(), 'IMAGINE PIERDUTĂ');
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).found, false);
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).visible, false);
    assert.deepEqual(errors, []);
    const invalid = await browser.newPage({ viewport: { width: 430, height: 932 } });
    await invalid.goto('http://127.0.0.1:4173/rift-next/?mode=phone&room=BAD');
    await invalid.getByText('COD INVALID · CERE UN LINK NOU').first().waitFor();
    assert.equal(await invalid.locator('#start-ar').isDisabled(), true);
    const expired = await browser.newPage({ viewport: { width: 430, height: 932 } });
    await expired.route('https://rift-sync-api.grassyyew19.chatgpt.site/**', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Camera nu mai există.' }) }));
    await expired.goto('http://127.0.0.1:4173/rift-next/?mode=phone&room=ABCDEF');
    await expired.getByText('SESIUNE EXPIRATĂ · CERE UN LINK NOU').first().waitFor();
    assert.equal(await expired.locator('#start-ar').isDisabled(), true);
    await page.locator('.live-brand').click();
    await page.getByRole('heading', { name: 'Alege un obiect.' }).waitFor();
    assert.match(await page.locator('#choose-atlas').getAttribute('href'), /mode=phone&experience=atlas/);
    await page.goto('http://127.0.0.1:4173/rift-next/?mode=phone&experience=atlas&debug=1');
    assert.equal(await page.locator('body').getAttribute('data-experience'), 'atlas');
    assert.equal(await page.locator('#phone-sync').textContent(), 'ATLAS · AR SOLO');
    assert.equal(await page.locator('#node-controls').isHidden(), true);
    assert.equal(await page.locator('#section-toggle').isHidden(), true);
    await page.locator('#start-ar').click();
    await page.getByText('CAUTĂ IMAGINEA', { exact: true }).waitFor();
    assert.equal((await page.evaluate(() => window.__fakeAR.configuration)).imageTargetData[0].name, 'atlas-screen');
    await page.evaluate(() => window.__fakeAR.emit('reality.imagefound', {
      name: 'atlas-screen', position: { x: 0, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
      scaledWidth: .75, scaledHeight: 1,
    }));
    assert.equal(await page.locator('#tracking-state').textContent(), 'ATLAS ANCORAT');
    const atlasLive = await page.evaluate(() => ({
      state: window.__RIFT_NEXT__.getState(),
      campusVisible: window.__fakeAR.scene.scene.getObjectByName('atlas-plan')?.visible,
      noCoreControls: document.querySelector('#section-toggle').hidden && document.querySelector('#node-controls').hidden,
      vertical: new window.THREE.Vector3(0, 0, 1).applyQuaternion(
        window.__fakeAR.scene.scene.getObjectByName('atlas-plan').parent.quaternion).y,
    }));
    assert.ok(Math.abs(atlasLive.state.modelRotationX + Math.PI / 2) < .001,
      'ATLAS base should lie horizontally above the keyboard');
    assert.ok(atlasLive.vertical > .99, 'ATLAS building height should point upward');
    assert.ok(atlasLive.state.modelPositionZ > .25, 'ATLAS should float in front of the display plane');
    assert.equal(atlasLive.campusVisible, true);
    assert.equal(atlasLive.noCoreControls, true);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.ok(await page.evaluate(() => window.__fakeAR.scene.scene.getObjectByName('atlas-building-A')));
    await page.evaluate(() => window.__fakeAR.emit('reality.imagelost', { name: 'atlas-screen' }));
    assert.equal(await page.locator('#tracking-state').textContent(), 'CAMPUS FIXAT');
    await page.waitForTimeout(1300);
    await page.evaluate(() => window.__fakeAR.tick());
    assert.equal((await page.evaluate(() => window.__RIFT_NEXT__.getState())).visible, true,
      'ATLAS should remain anchored while the phone looks down at the keyboard');

    await page.goto('http://127.0.0.1:4173/rift-next/?mode=phone&experience=orbit&debug=1');
    assert.equal(await page.locator('body').getAttribute('data-experience'), 'orbit');
    await page.locator('#start-ar').click();
    await page.getByText('CAUTĂ IMAGINEA', { exact: true }).waitFor();
    assert.equal((await page.evaluate(() => window.__fakeAR.configuration)).imageTargetData[0].name, 'orbit-screen');
    await page.evaluate(() => window.__fakeAR.emit('reality.imagefound', {
      name: 'orbit-screen', position: { x: 0, y: 0, z: -1 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: 1,
      scaledWidth: .75, scaledHeight: 1,
    }));
    assert.equal(await page.locator('#tracking-state').textContent(), 'ORBIT ANCORAT');
    const orbitLive = await page.evaluate(() => ({
      state: window.__RIFT_NEXT__.getState(),
      plasma: window.__fakeAR.scene.scene.getObjectByName('orbit-plasma'),
      noCoreControls: document.querySelector('#section-toggle').hidden && document.querySelector('#node-controls').hidden,
    }));
    assert.ok(orbitLive.plasma, 'ORBIT plasma should be present in the live scene');
    assert.ok(orbitLive.state.progress > .99, 'ORBIT should appear fully assembled');
    assert.equal(orbitLive.state.plasmaTime, 0, 'live beta ORBIT should remain static until its animation phase');
    assert.equal(orbitLive.noCoreControls, true);
    console.log('RIFT NEXT mock camera flow: OK');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
