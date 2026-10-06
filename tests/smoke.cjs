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
    await page.getByRole("button", { name: "Demo panouri AR" }).click();
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
    await assertVisible(page, "Demo panouri AR");
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
    await page.getByRole("button", { name: "Demo panouri AR" }).click();
    await page.waitForFunction(() => document.querySelector("#demo-video")?.readyState >= 2);
    await assertVisible(page, "Simulare");
    await page.getByRole("button", { name: "Închide camera" }).click();
    const stopped = await page.evaluate(() => document.querySelector("#demo-video").srcObject === null);
    assert(stopped, "camera stream should be released");

    await page.getByRole("button", { name: "Scanează un produs" }).click();
    await page.waitForFunction(() => Boolean(window.ZXingBrowser?.BrowserMultiFormatReader), null, { timeout: 30000 });
    await page.waitForTimeout(500);
    assert.equal(await page.locator("#scanner-status").textContent(), "Caut un cod...", "barcode reader should be active");
    await page.getByRole("button", { name: "Introdu codul manual" }).click();
    await page.locator("#manual-code").fill("https://example.com/water");
    await page.getByRole("button", { name: "Caută" }).click();
    await assertVisible(page, "LINK QR DETECTAT");
    await page.getByRole("tab", { name: "Date și surse" }).click();
    await assertVisible(page, "example.com");
    await page.getByRole("button", { name: "Scanează alt produs" }).click();
    await page.getByRole("button", { name: "Închide camera" }).click();
    assert(await page.evaluate(() => document.querySelector("#demo-video").srcObject === null), "product camera stream should be released");

    await page.getByRole("button", { name: "Scanează carduri AR" }).click();
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

async function checkProduct(browserType, device, name) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext(device);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://localhost:4173/");
    const classification = await page.evaluate(async () => {
      const { classifyScan } = await import("/js/product-data.js");
      return [classifyScan("5942326402258"), classifyScan("5942326402259"), classifyScan("https://id.example/01/05942326402258")];
    });
    assert.equal(classification[0].kind, "product");
    assert.equal(classification[1].kind, "invalid");
    assert.equal(classification[2].code, "5942326402258");
    await page.getByRole("button", { name: "Vezi sticla Aqua Carpatica" }).click();
    await page.locator("#lens-title").getByText("Apă minerală plată", { exact: true }).waitFor({ timeout: 20000 });
    assert(await page.locator("#lens-layer").isVisible(), `${name}: lens should be visible`);
    const lensBounds = await page.evaluate(() => {
      const card = document.querySelector("#lens-card").getBoundingClientRect();
      const controls = document.querySelector(".lens-controls").getBoundingClientRect();
      const header = document.querySelector(".scanner-top").getBoundingClientRect();
      return { card: { top: card.top, bottom: card.bottom, left: card.left, right: card.right }, controls: { top: controls.top, bottom: controls.bottom }, headerBottom: header.bottom, width: innerWidth, height: innerHeight };
    });
    assert(lensBounds.card.top >= lensBounds.headerBottom && lensBounds.card.bottom <= lensBounds.controls.top, `${name}: lens card overlaps chrome`);
    assert(lensBounds.card.left >= 0 && lensBounds.card.right <= lensBounds.width, `${name}: lens card horizontal overflow`);
    await page.locator("[data-lens-mode='data']").click();
    assert(await page.locator(".lens-fact").getByText("40,5 mg/L").isVisible(), `${name}: floating facts should be visible`);
    await page.waitForTimeout(350);
    const factBounds = await page.locator(".lens-fact").evaluateAll((facts) => facts.map((fact) => {
      const box = fact.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    }));
    for (const box of factBounds) {
      assert(box.top >= lensBounds.headerBottom && box.bottom <= lensBounds.controls.top, `${name}: floating fact overlaps chrome`);
      assert(box.left >= 0 && box.right <= lensBounds.width, `${name}: floating fact horizontal overflow`);
    }
    await page.screenshot({ path: path.join(os.tmpdir(), `vizor-lens-${name}.png`) });
    await page.getByRole("button", { name: "Detalii", exact: true }).click();
    await page.getByRole("heading", { name: "Apă minerală plată" }).waitFor({ timeout: 20000 });
    assert(await page.locator("#result-subtitle").getByText("Aqua Carpatica", { exact: false }).isVisible(), `${name}: brand should be visible`);
    assert(await page.locator(".mineral-item").getByText("40,5").isVisible(), `${name}: mineral profile should be visible`);
    await page.locator("#shelf-price").fill("4,50");
    await assertVisible(page, "4,50 lei/L");
    await page.getByRole("tab", { name: "Date și surse" }).click();
    await assertVisible(page, "Open Food Facts");
    const bounds = await page.evaluate(() => {
      const sheet = document.querySelector("#product-result").getBoundingClientRect();
      const action = document.querySelector(".result-actions").getBoundingClientRect();
      const header = document.querySelector(".scanner-top").getBoundingClientRect();
      return { sheetTop: sheet.top, sheetBottom: sheet.bottom, actionBottom: action.bottom, headerBottom: header.bottom, width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
    });
    assert(bounds.sheetTop >= bounds.headerBottom, `${name}: result overlaps header`);
    assert(bounds.sheetBottom <= bounds.height && bounds.actionBottom <= bounds.height, `${name}: result below viewport`);
    assert(bounds.scrollWidth <= bounds.width, `${name}: horizontal overflow`);
    await page.screenshot({ path: path.join(os.tmpdir(), `vizor-product-${name}.png`) });
    await page.getByRole("button", { name: "Închide camera" }).click();
    assert.deepEqual(errors, [], `${name}: product page errors`);
    console.log(`product ${name}: OK`, JSON.stringify(bounds));
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
  await checkProduct(webkit, devices["iPhone 16 Pro Max"], "iphone-16-pro-max");
  await checkProduct(chromium, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, "mobile-small");
  await checkProduct(chromium, { viewport: { width: 1280, height: 800 } }, "desktop");
  await checkLiveCamera();
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
