const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { chromium, webkit, devices } = require(process.argv[2] || "playwright");

async function checkDemo(browserType, contextOptions, name) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:4173/");
    await page.locator("#scene canvas").waitFor({ timeout: 20000 });
    await page.getByRole("button", { name: "Explorează fără cameră" }).click();
    await page.locator("#interface").waitFor({ state: "visible" });
    assert.equal(await page.locator("#tracking-status").getAttribute("data-state"), "demo");
    assert(await page.locator("#switch-camera").isHidden(), `${name}: camera switch is only available with a live camera`);

    for (const key of ["dna", "orbital", "atom"]) {
      await page.locator(`[data-model="${key}"]`).click();
      assert.equal(await page.evaluate(() => window.__HOLOLAB__.state.modelKey), key, `${name}: ${key} model should load`);
      assert(await page.evaluate(() => Boolean(window.__HOLOLAB__.state.transition)), `${name}: specimen change should animate`);
      await page.waitForFunction(() => window.__HOLOLAB__.state.transition === null, null, { timeout: 4000 });
      assert(await page.evaluate(() => window.__HOLOLAB__.state.lastMorphMinimum < .15), `${name}: particles should disperse before reassembling`);
      assert(await page.evaluate(() => window.__HOLOLAB__.state.morph > .95), `${name}: particles should finish assembling`);
      if (name === "iphone-16-pro-max") {
        const brightness = await page.evaluate(() => {
          const { renderer, scene, camera } = window.__HOLOLAB__;
          renderer.setRenderTarget(null);
          renderer.render(scene, camera);
          const gl = renderer.getContext();
          const pixels = new Uint8Array(70 * 70 * 4);
          gl.readPixels(Math.floor(renderer.domElement.width / 2) - 35, Math.floor(renderer.domElement.height * .48) - 35, 70, 70, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let maximum = 0;
          for (let index = 0; index < pixels.length; index += 4) maximum = Math.max(maximum, (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 765);
          return maximum;
        });
        assert(brightness > .35, `${name}: ${key} WebGL model should be visible (brightness ${brightness.toFixed(2)})`);
        await page.screenshot({ path: path.join(os.tmpdir(), `hololab-${key}-iphone.png`) });
      }
    }
    assert.equal(await page.locator("#gesture-title").textContent(), "Control tactil", `${name}: transition status should clear`);
    await page.evaluate(() => document.querySelector("#lab").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7, clientX: innerWidth / 2, clientY: innerHeight / 2 })));
    await page.waitForTimeout(540);
    const chargeState = await page.evaluate(() => ({ charge: window.__HOLOLAB__.state.charge, pointer: window.__HOLOLAB__.state.pointer, active: window.__HOLOLAB__.state.active }));
    assert(chargeState.charge > .15, `${name}: holding should charge energy: ${JSON.stringify(chargeState)}`);
    await page.evaluate(() => document.querySelector("#lab").dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 7, clientX: innerWidth * .65, clientY: innerHeight * .45 })));
    assert(await page.evaluate(() => window.__HOLOLAB__.state.modelTarget.x > .05), `${name}: drag should move the specimen`);
    await page.evaluate(() => document.querySelector("#lab").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, clientX: innerWidth / 2, clientY: innerHeight / 2 })));
    assert(await page.evaluate(() => performance.now() - window.__HOLOLAB__.state.pulseStart < 300), `${name}: release should trigger pulse`);
    await page.waitForTimeout(950);

    const metrics = await page.evaluate(() => {
      const deck = document.querySelector(".control-deck").getBoundingClientRect();
      const top = document.querySelector(".topbar").getBoundingClientRect();
      const switcher = document.querySelector(".specimen-switcher").getBoundingClientRect();
      return {
        deck: { top: deck.top, bottom: deck.bottom },
        top: { top: top.top, bottom: top.bottom },
        switcher: { left: switcher.left, right: switcher.right, top: switcher.top, bottom: switcher.bottom },
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        renderCalls: window.__HOLOLAB__.renderer.info.render.calls,
        triangles: window.__HOLOLAB__.renderer.info.render.triangles,
        contextLost: window.__HOLOLAB__.renderer.getContext().isContextLost(),
      };
    });
    await page.screenshot({ path: path.join(os.tmpdir(), `hololab-${name}.png`) });
    assert(metrics.renderCalls > 0 && metrics.triangles > 0 && !metrics.contextLost, `${name}: WebGL scene should render`);
    assert(metrics.top.top >= 0 && metrics.top.bottom < metrics.deck.top, `${name}: header should not overlap controls`);
    assert(metrics.deck.bottom <= metrics.height && metrics.switcher.left >= 0 && metrics.switcher.right <= metrics.width, `${name}: controls should fit viewport`);
    assert(metrics.scrollWidth <= metrics.width, `${name}: no horizontal overflow`);
    if (name === "iphone-16-pro-max") {
      const hand = Array.from({ length: 21 }, () => ({ x: .5, y: .58, z: 0 }));
      hand[0] = { x: .5, y: .82, z: 0 };
      hand[5] = { x: .38, y: .53, z: 0 };
      hand[9] = { x: .48, y: .48, z: 0 };
      hand[13] = { x: .57, y: .51, z: 0 };
      hand[17] = { x: .64, y: .57, z: 0 };
      hand[4] = { x: .23, y: .55, z: 0 };
      for (const index of [6, 10, 14, 18]) hand[index] = { x: .5, y: .42, z: 0 };
      for (const index of [8, 12, 16, 20]) hand[index] = { x: .5, y: .22, z: 0 };
      for (let index = 0; index < 3; index += 1) {
        await page.evaluate((points) => window.__HOLOLAB__.injectHands([points]), hand);
        await page.waitForTimeout(35);
      }
      assert.equal(await page.evaluate(() => window.__HOLOLAB__.state.anchor), "palm", "open palm should anchor the hologram");
      assert.equal(await page.evaluate(() => window.__HOLOLAB__.state.gesture), "open", "open palm should activate after stable frames");
      await page.evaluate((points) => window.__HOLOLAB__.injectHands([points, points]), hand);
      assert.equal(await page.evaluate(() => window.__HOLOLAB__.state.gesture), "open", "one different gesture frame should not replace the current gesture");
      await page.evaluate(() => window.__HOLOLAB__.injectHands([]));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.evaluate(() => {
        const lab = document.querySelector("#lab");
        lab.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 8, clientX: 200, clientY: 300 }));
        lab.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 8, clientX: 200, clientY: 300 }));
      });
      await page.waitForTimeout(70);
      assert(await page.evaluate(() => window.__HOLOLAB__.state.reducedMotion && window.__HOLOLAB__.state.shake === 0), "reduced motion should disable shake");
      await page.evaluate(() => { window.__HOLOLAB__.state.lastInteraction = performance.now() - 8100; });
      await page.waitForFunction(() => window.__HOLOLAB__.state.attractStarted > 0, null, { timeout: 3000 });
      await page.waitForTimeout(10000);
      assert.deepEqual(errors, [], `attract mode browser errors: ${errors.join(" | ")}`);
    }
    await page.getByRole("button", { name: "Închide laboratorul" }).click();
    assert(await page.getByRole("button", { name: "Pornește HoloLab" }).isVisible(), `${name}: launch view should return`);
    assert.deepEqual(errors, [], `${name}: browser errors: ${errors.join(" | ")}`);
    console.log(`${name}: OK`, JSON.stringify(metrics));
  } finally {
    await browser.close();
  }
}

async function checkCamera() {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  try {
    const context = await browser.newContext({ viewport: { width: 440, height: 956 }, permissions: ["camera"] });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      window.__cameraRequests = [];
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const requestedFacing = constraints.video?.facingMode?.exact || constraints.video?.facingMode?.ideal;
        window.__cameraRequests.push(requestedFacing);
        if (window.__rejectRear && requestedFacing === "environment") throw Object.assign(new Error("No rear camera"), { name: "NotFoundError" });
        return nativeGetUserMedia({ audio: false, video: { width: 1280, height: 720 } });
      };
    });
    await page.goto("http://localhost:4173/");
    await page.getByRole("button", { name: "Pornește HoloLab" }).click();
    await page.locator("#interface").waitFor({ state: "visible", timeout: 45000 });
    const state = await page.evaluate(() => ({ hasCamera: document.querySelector("#lab").classList.contains("has-camera"), demo: window.__HOLOLAB__.state.demo, videoReady: document.querySelector("#camera").readyState }));
    assert(state.hasCamera && !state.demo && state.videoReady >= 2, `camera should initialize: ${JSON.stringify(state)}`);
    assert(await page.locator("#tutorial").isVisible(), "first camera session should offer the interactive tutorial");
    await page.locator("#tutorial-skip").click();
    assert.equal(await page.locator("#camera-facing-label").textContent(), "FAȚĂ");
    await page.evaluate(() => { window.__oldCameraTrack = window.__HOLOLAB__.state.stream.getVideoTracks()[0]; });
    await page.getByRole("button", { name: "Comută la camera din spate" }).click();
    await page.waitForFunction(() => window.__HOLOLAB__.state.cameraFacing === "environment" && !window.__HOLOLAB__.state.switchingCamera);
    assert.equal(await page.locator("#camera-facing-label").textContent(), "SPATE");
    assert(await page.evaluate(() => window.__oldCameraTrack.readyState === "ended"), "previous track should stop before switching");
    assert.equal(await page.locator("#camera").evaluate((element) => getComputedStyle(element).transform), "none", "rear view should not be mirrored");
    await page.screenshot({ path: path.join(os.tmpdir(), "hololab-camera-rear.png") });
    await page.getByRole("button", { name: "Comută la camera din față" }).click();
    await page.waitForFunction(() => window.__HOLOLAB__.state.cameraFacing === "user" && !window.__HOLOLAB__.state.switchingCamera);
    assert.equal(await page.locator("#camera-facing-label").textContent(), "FAȚĂ");
    assert.deepEqual(await page.evaluate(() => window.__cameraRequests), ["user", "environment", "user"]);
    await page.evaluate(() => { window.__rejectRear = true; });
    await page.getByRole("button", { name: "Comută la camera din spate" }).click();
    await page.waitForFunction(() => !window.__HOLOLAB__.state.switchingCamera);
    assert.equal(await page.locator("#camera-facing-label").textContent(), "FAȚĂ", "unavailable camera should restore previous view");
    assert(await page.evaluate(() => window.__HOLOLAB__.state.stream?.getVideoTracks()[0]?.readyState === "live"), "restored camera should remain live");
    await page.getByRole("button", { name: "Închide laboratorul" }).click();
    assert.equal(await page.evaluate(() => document.querySelector("#camera").srcObject), null, "camera stream should be released");
    assert.deepEqual(errors, [], `camera browser errors: ${errors.join(" | ")}`);
    console.log("camera + hand tracker bootstrap: OK");
  } finally {
    await browser.close();
  }
}

(async () => {
  await checkDemo(webkit, devices["iPhone 16 Pro Max"], "iphone-16-pro-max");
  await checkDemo(chromium, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, "mobile-small");
  await checkDemo(chromium, { viewport: { width: 1280, height: 800 } }, "desktop");
  await checkCamera();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
