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
    assert.equal(await page.locator("#tracking-status span").textContent(), "MOD DEMO");
    assert(await page.locator("#switch-camera").isHidden(), `${name}: camera switch is only available with a live camera`);

    for (const key of ["dna", "orbital", "atom"]) {
      await page.locator(`[data-model="${key}"]`).click();
      assert.equal(await page.evaluate(() => window.__HOLOLAB__.state.modelKey), key, `${name}: ${key} model should load`);
      assert(await page.evaluate(() => Boolean(window.__HOLOLAB__.state.transition)), `${name}: specimen change should animate`);
      await page.waitForFunction(() => window.__HOLOLAB__.state.transition === null, null, { timeout: 4000 });
      if (name === "iphone-16-pro-max") await page.screenshot({ path: path.join(os.tmpdir(), `hololab-${key}-iphone.png`) });
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
