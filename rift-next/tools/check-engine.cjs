// Local desktop check that the real AR bundle starts with Chrome's fake camera.
// It cannot prove image recognition or tracking on an iPhone.
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-webgl-software-rendering', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, permissions: ['camera'] });
    const page = await context.newPage();
    const errors = [];
    const logs = [];
    const badResponses = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));
    page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
    await page.goto('http://127.0.0.1:4173/rift-next/?mode=phone&debug=1');
    await page.getByRole('button', { name: /PORNEȘTE CAMERA/ }).click();
    await page.waitForTimeout(25000);
    console.log(JSON.stringify({
      status: await page.locator('#tracking-state').textContent(),
      error: await page.locator('#error-message').textContent(),
      debug: await page.locator('#debug-panel').textContent(),
      engine: await page.evaluate(() => ({
        threejs: !!window.XR8?.Threejs,
        controller: !!window.XR8?.XrController,
        canvas: !!window.XRExtras?.FullWindowCanvas,
        initialized: window.XR8?.isInitialized?.(),
      })),
      pageErrors: errors,
      logs: logs.slice(-8),
      badResponses,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
