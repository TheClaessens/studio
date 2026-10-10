// `studio check <game-dir>`: runs the Kit self-test (PT.init → start → play → choose → shot → batch) in a real
// headless browser against the Game Project's adapter (`play.adapter`) on its page (`play.entry`).
// Drives Chrome/Chromium/Edge over the DevTools protocol with Node's built-in WebSocket: no browser dependency.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, join, resolve } from 'node:path';
import { createStudioServer } from './app.ts';
import { loadManifest, type Manifest } from './manifest.ts';

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

type Step = [name: string, body: string];
// Each body runs in the page as an async function with `PT` in scope; returning `{ error }` or throwing fails the step.
const steps = (adapter: string): Step[] => [
  ['load', `window.__studioCheck = (await import(${JSON.stringify(adapter)} + '?v=' + Date.now())).default;
    if (!window.__studioCheck?.init) return { error: 'the adapter module has no default export with init()' };
    return 'adapter loaded'`],
  ['init', `for (const until = Date.now() + 10000; ; await new Promise((r) => setTimeout(r, 200))) {
      try { return PT.init({ persona: 'selftest', skill: 'average', fresh: true }); } catch (e) { if (Date.now() > until) throw e; }
    }`],
  ['start', `return PT.start()`],
  ['play', `let p = PT.play({ seconds: 30 });
    for (let i = 0; i < 20 && !p.error && !PT.decision() && !['won', 'lost'].includes(p.stopped); i++) p = PT.play({ seconds: 30 });
    return p`],
  ['choose', `if (!PT.decision()) return { error: 'play() never stopped at a decision to choose' };
    return PT.choose(0)`],
  ['shot', `const r = await PT.shot('check');
    return r.status === 201 ? r : { ...r, error: 'the shot upload returned HTTP ' + r.status }`],
  ['batch', `const b = PT.batch({ runs: 2, seconds: 20 });
    if (b.error) return b;
    const r = await PT.batchWait(90000);
    const bad = r.error ?? r.rows?.find((row) => row.error)?.error ?? (r.done ? null : 'batch did not finish in 90 s');
    return bad ? { ...r, error: bad } : r`],
];

/** Runs the self-test; prints one line per step; returns the process exit code. */
export async function runCheck(root: string): Promise<number> {
  const fail = (msg: string) => (console.error(`\nstudio check: ${msg}\n`), 1);
  let manifest: Manifest;
  try {
    manifest = loadManifest(root);
  } catch (err) {
    return fail((err as Error).message);
  }
  const play = manifest.play;
  if (!play?.adapter) return fail('studio.json has no play.adapter. Declare the Game Adapter module, e.g. "play": { "entry": "index.html", "adapter": "playtest/adapter.js" }.');
  if (/^[a-z]+:/i.test(play.entry)) return fail('play.entry is an absolute URL; studio check needs a same-origin page to load the adapter on.');
  const browserPath = findBrowser();
  if (!browserPath) return fail('no browser found. Install Chrome, Chromium or Edge, or set STUDIO_BROWSER to its executable.');

  const server = createStudioServer({ root, manifest });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const profile = mkdtempSync(join(tmpdir(), 'studio-check-'));
  const browser = spawn(browserPath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', 'about:blank']);
  let ws: WebSocket | undefined;
  let step = 'browser';
  try {
    const endpoint = await new Promise<string>((res, rej) => {
      let err = '';
      browser.stderr.on('data', (d) => { err += d; const m = err.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
      browser.on('error', rej);
      browser.on('exit', (code) => rej(new Error(`the browser exited (${code}):\n${err}`)));
      setTimeout(() => rej(new Error(`the browser did not start in 20 s:\n${err}`)), 20000);
    });
    const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
    ws = new WebSocket(targets.find((t: { type: string }) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r, j) => { ws!.onopen = r; ws!.onerror = j; });

    let id = 0;
    const pending = new Map<number, (m: any) => void>();
    const events = new Map<string, () => void>();
    const pageErrors: string[] = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
      if (m.method) events.get(m.method)?.();
      pending.get(m.id)?.(m);
    };
    const cdp = (method: string, params = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws!.send(JSON.stringify({ id: i, method, params })); });
    await cdp('Runtime.enable');
    await cdp('Page.enable');

    step = 'open';
    const page = `${base}/${play.entry.replace(/^\//, '')}`;
    const loaded = new Promise<void>((r) => events.set('Page.loadEventFired', r));
    await cdp('Page.navigate', { url: page });
    await loaded;
    console.log(`✓ open ${play.entry}`);

    for (const [name, body] of steps('/' + play.adapter.replace(/^\//, ''))) {
      step = name;
      const expression = `(async () => { const PT = window.__studioCheck; ${body} })().then((v) => JSON.parse(JSON.stringify(v ?? null)))`;
      const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 120000 });
      const thrown = r.result?.exceptionDetails;
      const value = r.result?.result?.value;
      const error = thrown ? (thrown.exception?.description ?? thrown.text) : r.error ? r.error.message : value?.error;
      if (error) throw new Error(`${error}${pageErrors.length ? `\npage errors:\n  ${pageErrors.join('\n  ')}` : ''}`);
      if (name === 'shot') {
        const folder = manifest.out?.playtest;
        const file = folder && join(resolve(root, folder), basename(value.file));
        if (!file || !existsSync(file)) throw new Error(`the shot is not on disk in out.playtest (${folder ?? 'not declared in studio.json'})`);
        console.log(`✓ shot ${join(folder, basename(value.file))}`);
      } else console.log(`✓ ${name}`);
    }
    console.log(`\nstudio check passed: the Kit self-test ran against ${play.adapter}.`);
    return 0;
  } catch (err) {
    return fail(`failed at step "${step}": ${(err as Error).message}`);
  } finally {
    ws?.close();
    browser.kill();
    server.close();
    server.closeAllConnections();
    if (browser.exitCode === null && browser.pid) await new Promise((r) => browser.once('exit', r));
    rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }
}
