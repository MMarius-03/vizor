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

    for (const key of ["dna", "orbital", "atom"]) {
      await page.locator(`[data-model="${key}"]`).click();
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.__HOLOLAB__.state.modelKey), key, `${name}: ${key} model should load`);
    }

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
    await page.goto("http://localhost:4173/");
    await page.getByRole("button", { name: "Pornește HoloLab" }).click();
    await page.locator("#interface").waitFor({ state: "visible", timeout: 45000 });
    const state = await page.evaluate(() => ({ hasCamera: document.querySelector("#lab").classList.contains("has-camera"), demo: window.__HOLOLAB__.state.demo, videoReady: document.querySelector("#camera").readyState }));
    assert(state.hasCamera && !state.demo && state.videoReady >= 2, `camera should initialize: ${JSON.stringify(state)}`);
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
