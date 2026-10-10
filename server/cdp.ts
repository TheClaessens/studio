// A headless Chrome/Chromium/Edge driven over the DevTools protocol with Node's built-in WebSocket: no browser
// dependency. Used by `studio check` (check.ts) and, through test/harness.ts, by the UI smoke tests.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const browserPaths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const browserNames = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

/** `STUDIO_BROWSER`, else the first Chrome/Chromium/Edge found in the usual places or on PATH. */
export function findBrowser(): string | undefined {
  if (process.env.STUDIO_BROWSER) return process.env.STUDIO_BROWSER;
  const onPath = (process.env.PATH ?? '').split(delimiter).flatMap((dir) => browserNames.map((n) => join(dir, n)));
  return [...browserPaths, ...onPath].find((p) => existsSync(p));
}

export type Browser = Awaited<ReturnType<typeof launchBrowser>>;

/** Starts a headless browser on a fresh profile with one page. Always `close()` it. */
export async function launchBrowser(browserPath: string) {
  const profile = mkdtempSync(join(tmpdir(), 'studio-browser-'));
  const browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank']);
  let ws: WebSocket | undefined;
  const close = async () => {
    ws?.close();
    browser.kill();
    if (browser.exitCode === null && browser.pid) await new Promise((r) => browser.once('exit', r));
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  };
  try {
    const endpoint = await new Promise<string>((res, rej) => {
      let err = '';
      browser.stderr.on('data', (d) => { err += d; const m = err.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
      browser.on('error', rej);
      browser.on('exit', (code) => rej(new Error(`the browser exited (${code}):\n${err}`)));
      setTimeout(() => rej(new Error(`the browser did not start in 20 s:\n${err}`)), 20000).unref();
    });
    const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
    const page = new WebSocket(targets.find((t: { type: string }) => t.type === 'page').webSocketDebuggerUrl);
    ws = page;
    await new Promise((r, j) => { page.onopen = r; page.onerror = j; });

    let id = 0;
    const pending = new Map<number, (m: any) => void>();
    const events = new Map<string, () => void>();
    /** Uncaught exceptions in the page, in order. */
    const pageErrors: string[] = [];
    page.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method) events.get(m.method)?.();
      pending.get(m.id)?.(m);
    };
    const cdp = (method: string, params = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); page.send(JSON.stringify({ id: i, method, params })); });
    await cdp('Runtime.enable');
    await cdp('Page.enable');

    return {
      pageErrors,
      close,
      /** Navigates and resolves on the load event. */
      async open(url: string) {
        const loaded = new Promise<void>((r) => events.set('Page.loadEventFired', r));
        await cdp('Page.navigate', { url });
        await loaded;
      },
      /** The JSON value of `expression` (promises awaited); throws with the page's error if it throws. */
      async evaluate(expression: string, timeout = 120000): Promise<any> {
        const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout });
        const thrown = r.result?.exceptionDetails;
        if (thrown || r.error) throw new Error(thrown ? (thrown.exception?.description ?? thrown.text) : r.error.message);
        return r.result?.result?.value;
      },
      /** A png of the viewport. */
      async screenshot() {
        return Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
      },
    };
  } catch (err) {
    await close();
    throw err;
  }
}
