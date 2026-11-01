const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/rift-next/NOTICE.md');
    const result = await page.evaluate(async () => {
      const api = 'https://rift-sync-api.grassyyew19.chatgpt.site';
      const actualFetch = window.fetch.bind(window);
      const actualInterval = window.setInterval;
      window.setInterval = () => 0;
      let server = {
        experience: 'core', open: false, armed: false, nodes: [false, false, false],
        pulseCount: 0, revision: 0, lastAction: 'init',
      };
      let holdGet = false;
      let releaseGet;
      let getStarted;
      const getStartedPromise = new Promise((resolve) => { getStarted = resolve; });
      const waitFor = async (predicate) => {
        const deadline = performance.now() + 2000;
        while (!predicate()) {
          if (performance.now() > deadline) throw new Error('Sync audit timed out');
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      };
      window.fetch = async (url, options = {}) => {
        if (!String(url).startsWith(api)) return actualFetch(url, options);
        if (options.method === 'POST') {
          const event = JSON.parse(options.body);
          server = { ...server, open: event.open, armed: event.armed, nodes: [...event.nodes],
            pulseCount: event.pulseCount, revision: server.revision + 1, lastAction: event.action };
          return Response.json({ state: server });
        }
        const snapshot = { ...server, nodes: [...server.nodes] };
        if (holdGet) {
          holdGet = false;
          getStarted();
          await new Promise((resolve) => { releaseGet = resolve; });
        }
        return Response.json({ code: 'ABCDEF', state: snapshot, presence: { console: true, phone: true } });
      };
      try {
        const { createCoreSession } = await import('./sync.js?v=4');
        const restores = [];
        const session = createCoreSession({
          role: 'phone', initialCode: 'ABCDEF',
          onRestore: (state) => restores.push(state.revision),
          onUpdate() {},
        });
        session.start();
        await waitFor(() => restores.length === 1);
        server = { ...server, open: true, revision: 1, lastAction: 'open' };
        document.dispatchEvent(new Event('visibilitychange'));
        await waitFor(() => restores.length === 2);

        holdGet = true;
        document.dispatchEvent(new Event('visibilitychange'));
        await getStartedPromise;
        session.publish({ open: true, armed: true, nodes: [false, false, false], pulseCount: 0 }, 'arm');
        await waitFor(() => session.state?.revision === 2);
        releaseGet();
        await new Promise((resolve) => setTimeout(resolve, 30));
        const afterStaleGet = session.state.revision;

        server = { ...server, nodes: [true, false, false], revision: 3, lastAction: 'node:0' };
        document.dispatchEvent(new Event('visibilitychange'));
        await waitFor(() => restores.at(-1) === 3);
        return { afterStaleGet, finalRevision: session.state.revision, restores };
      } finally {
        window.fetch = actualFetch;
        window.setInterval = actualInterval;
      }
    });
    assert.equal(result.afterStaleGet, 2, 'an older GET must not roll back a newer POST');
    assert.equal(result.finalRevision, 3);
    assert.deepEqual(result.restores, [0, 1, 3], 'remote changes must restore on the phone');
    console.log('RIFT NEXT sync order and remote restore: OK');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
