const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { chromium, webkit, devices } = require(process.argv[2] || "playwright");

async function check(browserType, device, name) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => Promise.reject(Object.assign(new Error("Denied"), { name: "NotAllowedError" })),
        },
      });
    });
    await page.goto("http://localhost:4173/");
    await page.getByRole("button", { name: "Testează fără card" }).click();
    await page.getByRole("button", { name: "Continuă fără cameră" }).click();
    await assertVisible(page, "Simulare fără cameră");
    await page.getByRole("button", { name: "Produsul următor" }).click();
    await assertVisible(page, "Cremwurst clasic");
    const panelPixel = await page.evaluate(() => [...document.querySelector("#demo-panel canvas").getContext("2d").getImageData(20, 20, 1, 1).data]);
    assert(panelPixel[0] > panelPixel[1] && panelPixel[0] > panelPixel[2], `${name}: critical panel should be red`);
    const bounds = await page.evaluate(() => {
      const panel = document.querySelector("#demo-panel").getBoundingClientRect();
      const nav = document.querySelector(".product-nav").getBoundingClientRect();
      const top = document.querySelector(".scanner-top").getBoundingClientRect();
      return {
        panel: { top: panel.top, bottom: panel.bottom, left: panel.left, right: panel.right },
        nav: { top: nav.top, bottom: nav.bottom },
        top: { bottom: top.bottom },
        width: innerWidth,
        height: innerHeight,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    assert(bounds.panel.left >= 0 && bounds.panel.right <= bounds.width, `${name}: panel horizontal overflow`);
    assert(bounds.panel.top >= bounds.top.bottom, `${name}: panel overlaps header`);
    assert(bounds.panel.bottom <= bounds.nav.top, `${name}: panel overlaps controls`);
    assert(bounds.nav.bottom <= bounds.height, `${name}: controls below viewport`);
    assert(bounds.pageWidth <= bounds.width, `${name}: page horizontal overflow`);
    await page.screenshot({ path: path.join(os.tmpdir(), `vizor-${name}.png`) });
    await page.getByRole("button", { name: "Închide camera" }).click();
    await assertVisible(page, "Testează fără card");
    assert.deepEqual(errors, [], `${name}: page errors`);
    console.log(`${name}: OK`, JSON.stringify(bounds));
    await context.close();
  } finally {
    await browser.close();
  }
}

async function checkLiveCamera() {
  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 440, height: 956 },
      permissions: ["camera"],
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:4173/");
    await page.getByRole("button", { name: "Testează fără card" }).click();
    await page.waitForFunction(() => document.querySelector("#demo-video")?.readyState >= 2);
    await assertVisible(page, "Simulare");
    await page.getByRole("button", { name: "Închide camera" }).click();
    const stopped = await page.evaluate(() => document.querySelector("#demo-video").srcObject === null);
    assert(stopped, "camera stream should be released");

    await page.getByRole("button", { name: "Scanează carduri" }).click();
    try {
      await page.waitForFunction(() => window.AFRAME?.systems?.arjs && document.querySelector("a-scene"), null, { timeout: 30000 });
    } catch (error) {
      console.log("AR diagnostic:", await page.evaluate(() => ({
        aframe: Boolean(window.AFRAME),
        arjs: Boolean(window.AFRAME?.systems?.arjs),
        scene: Boolean(document.querySelector("a-scene")),
        status: document.querySelector("#scanner-status")?.textContent,
        error: document.querySelector("#start-error")?.textContent,
      })), errors);
      throw error;
    }
    assert(await page.locator("a-scene").isVisible(), "AR scene should mount");
    await page.waitForFunction(() => document.querySelector("a-scene")?.hasLoaded);
    await page.waitForFunction(() => document.querySelector("#arjs-video")?.readyState >= 2);
    const arVideo = await page.evaluate(() => {
      const video = document.querySelector("#arjs-video");
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      canvas.getContext("2d").drawImage(video, video.videoWidth / 2, video.videoHeight / 2, 1, 1, 0, 0, 1, 1);
      return {
        pixel: [...canvas.getContext("2d").getImageData(0, 0, 1, 1).data],
        zIndex: Number(getComputedStyle(video).zIndex),
        background: getComputedStyle(document.querySelector("#scanner-screen")).backgroundColor,
      };
    });
    assert(arVideo.pixel.slice(0, 3).some((value) => value > 20), "AR camera frame should not be black");
    assert(arVideo.zIndex > 0 && arVideo.background === "rgba(0, 0, 0, 0)", "AR camera should be visible behind UI");
    await page.screenshot({ path: path.join(os.tmpdir(), "vizor-ar-bootstrap.png") });
    await page.getByRole("button", { name: "Închide camera" }).click();
    assert.equal(await page.locator("a-scene").count(), 0, "AR scene should unmount");
    assert.equal(await page.locator("#arjs-video").count(), 0, "AR video should be removed");
    await page.goto("http://localhost:4173/ar-test.html");
    await page.getByRole("button", { name: "Pornește camera" }).click();
    await page.waitForFunction(() => document.querySelector("a-box") && document.querySelector("a-scene")?.hasLoaded);
    await page.getByRole("button", { name: "Închide testul" }).click();
    assert.equal(await page.locator("a-scene").count(), 0, "technical AR scene should unmount");
    assert.deepEqual(errors, [], "live camera or AR errors");
    console.log("camera and AR bootstrap: OK");
    await context.close();
  } finally {
    await browser.close();
  }
}

async function assertVisible(page, text) {
  assert(await page.getByText(text, { exact: false }).first().isVisible(), `${text} should be visible`);
}

(async () => {
  await check(webkit, devices["iPhone 16 Pro Max"], "iphone-16-pro-max");
  await check(chromium, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, "mobile-small");
  await check(chromium, { viewport: { width: 1280, height: 800 } }, "desktop");
  await checkLiveCamera();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
