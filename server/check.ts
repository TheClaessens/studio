// `studio check <game-dir>`: in a real headless browser, loads the asset catalogue and captures its first asset's view
// (`assets`, with `assets.capture` if declared), and runs the Kit self-test (PT.init → start → play → choose → shot →
// batch) against the Game Project's adapter (`play.adapter`) on its page (`play.entry`), then captures that page.
// Drives the browser through cdp.ts.
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { findBrowser, launchBrowser, type Browser } from './cdp.ts';
import { createStudioServer } from './app.ts';
import { loadManifest, type Manifest } from './manifest.ts';
import { loadCatalogue, type Asset } from './catalogue.ts';
import { viewTemplate, viewUrl } from './view.ts';

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

/** Runs in the page: `module`'s `capture(window)` export if given, else the largest canvas as a png (as ui/capture.ts
 *  does), retried for 10 s while the view loads. Fails unless it yields a non-empty image Blob. */
const captureStep = (module?: string) => `const mod = ${JSON.stringify(module ? '/' + module.replace(/^\//, '') : null)};
  const override = mod && (await import(mod)).capture;
  if (mod && typeof override !== 'function') return { error: mod + ' has no capture(win) export' };
  const shot = () => override ? override(window) : new Promise((resolve, reject) => requestAnimationFrame(() => {
    const [canvas] = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height);
    if (!canvas) return reject(new Error('nothing to screenshot: the view has no canvas'));
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('the canvas could not be read'))), 'image/png');
  }));
  const shoot = () => Promise.race([shot(), new Promise((_, reject) => setTimeout(() => reject(new Error('capture did not finish in 10 s')), 10000))]);
  for (const until = Date.now() + 10000; ; await new Promise((r) => setTimeout(r, 200))) {
    try {
      const blob = await shoot();
      if (!(blob instanceof Blob) || !blob.size || !blob.type.startsWith('image/')) return { error: 'capture did not return a non-empty image Blob' };
      return { type: blob.type, size: blob.size };
    } catch (e) { if (Date.now() > until) throw e; }
  }`;

/** Runs the self-test; prints one line per step; returns the process exit code. With `assets`, it loads the catalogue
 *  and captures the first asset's view; with `play.adapter`, it runs the Kit self-test and captures the play page.
 *  A project with neither has nothing to check and fails. */
export async function runCheck(root: string): Promise<number> {
  const fail = (msg: string) => (console.error(`\nstudio check: ${msg}\n`), 1);
  let manifest: Manifest;
  try {
    manifest = loadManifest(root);
  } catch (err) {
    return fail((err as Error).message);
  }
  const { play, assets } = manifest;
  if (!play?.adapter && !assets)
    return fail('studio.json has no play.adapter (and no assets). Declare the Game Adapter module, e.g. "play": { "entry": "index.html", "adapter": "playtest/adapter.js" }.');
  if (play?.adapter && /^[a-z]+:/i.test(play.entry)) return fail('play.entry is an absolute URL; studio check needs a same-origin page to load the adapter on.');

  let first: Asset | undefined;
  if (assets) {
    try {
      first = (await loadCatalogue(root, assets.catalogue, assets.view))[0];
    } catch (err) {
      return fail(`failed at step "catalogue": ${(err as Error).message}`);
    }
    if (!first) return fail(`failed at step "catalogue": assets.catalogue "${assets.catalogue}" is empty`);
    console.log(`✓ catalogue (first asset: ${first.id})`);
  }

  const browserPath = findBrowser();
  if (!browserPath) return fail('no browser found. Install Chrome, Chromium or Edge, or set STUDIO_BROWSER to its executable.');

  const server = createStudioServer({ root, manifest });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let browser: Browser | undefined;
  let step = 'browser';
  try {
    const page = (browser = await launchBrowser(browserPath));
    const open = async (path: string) => {
      step = 'open';
      await page.open(`${base}/${path.replace(/^\//, '')}`);
      console.log(`✓ open ${path}`);
    };
    /** Evaluates `body` (an async function body, `PT` in scope) as step `name`; `{ error }` or a throw fails it. */
    const run = async (name: string, body: string) => {
      step = name;
      const expression = `(async () => { const PT = window.__studioCheck; ${body} })().then((v) => JSON.parse(JSON.stringify(v ?? null)))`;
      let value, error;
      try {
        value = await page.evaluate(expression);
        error = value?.error;
      } catch (err) {
        error = (err as Error).message;
      }
      if (error) throw new Error(`${error}${page.pageErrors.length ? `\npage errors:\n  ${page.pageErrors.join('\n  ')}` : ''}`);
      return value;
    };

    if (assets && first) {
      const anchor = first.anchors[0];
      await open(viewUrl(viewTemplate(assets.view, first), { asset: first, anchor, t: anchor?.range?.[0] ?? 0, playing: false }));
      const shot = await run('capture', captureStep(assets.capture));
      console.log(`✓ capture (${shot.type}, ${shot.size} bytes${assets.capture ? `, via ${assets.capture}` : ''})`);
    }
    if (play?.adapter) {
      await open(play.entry);
      for (const [name, body] of steps('/' + play.adapter.replace(/^\//, ''))) {
        const value = await run(name, body);
        if (name === 'shot') {
          const folder = manifest.out?.playtest;
          const file = folder && join(resolve(root, folder), basename(value.file));
          if (!file || !existsSync(file)) throw new Error(`the shot is not on disk in out.playtest (${folder ?? 'not declared in studio.json'})`);
          console.log(`✓ shot ${join(folder, basename(value.file))}`);
        } else console.log(`✓ ${name}`);
      }
      await open(play.entry); // fresh, as the Play Surface sees it: the adapter has taken over the page's clock
      const shot = await run('play capture', captureStep(play.hooks));
      console.log(`✓ play capture (${shot.type}, ${shot.size} bytes${play.hooks ? `, via ${play.hooks}` : ''})`);
    } else console.log('- no play.adapter: skipped the Kit self-test');
    console.log(`\nstudio check passed${play?.adapter ? `: the Kit self-test ran against ${play.adapter}` : ''}.`);
    return 0;
  } catch (err) {
    return fail(`failed at step "${step}": ${(err as Error).message}`);
  } finally {
    await browser?.close();
    server.close();
    server.closeAllConnections();
  }
}
