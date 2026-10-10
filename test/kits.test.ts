import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, cpSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startStudio, fixture, tempProject } from './harness.ts';

test('the playtest and promo Kits are served under /__studio/kits/ as ES modules', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  for (const file of [
    'playtest/playtest-core.js',
    'playtest/hands-topdown.js',
    'promo/renderer.js',
    'promo/motion.js',
    'promo/shims.js',
    'promo/soundtrack.js',
    'promo/verify.js',
  ]) {
    const res = await fetch(`${studio.url}/__studio/kits/${file}`);
    assert.equal(res.status, 200, file);
    assert.match(res.headers.get('content-type') ?? '', /text\/javascript/, file);
  }
  assert.match(await (await fetch(`${studio.url}/__studio/kits/playtest/playtest-core.js`)).text(), /export function createPlaytest/);
});

test('the served Kits save to /__studio/out/<kind>/ and no kit-server route is left', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);
  const src = (f: string) => fetch(`${studio.url}/__studio/kits/${f}`).then((r) => r.text());

  assert.match(await src('playtest/playtest-core.js'), /'\/__studio\/out\/playtest\/'/);
  assert.match(await src('promo/renderer.js'), /`\/__studio\/out\/promo\/\$\{name\}`/);
  assert.match(await src('promo/verify.js'), /'\/__studio\/out\/promo\/'/);
  for (const f of ['playtest/playtest-core.js', 'playtest/hands-topdown.js', 'promo/renderer.js', 'promo/verify.js']) {
    assert.doesNotMatch(await src(f), /__playtest\/|__promo\/|'\/promo\/out/, f);
  }
});

const example = (name: string) => fileURLToPath(new URL(`../examples/${name}`, import.meta.url));
/** A throwaway copy, so writes never land in the repo's examples. */
const cpTemp = (src: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-example-'));
  cpSync(src, dir, { recursive: true });
  return dir;
};
const examplePages ={ 'mini-arena': ['index.html', 'adapter.js', 'game.js'], promo: ['index.html', 'promo.js'] };

test('the mini-arena and promo examples are served under /__studio/examples/ and every import they make resolves', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  for (const [name, files] of Object.entries(examplePages)) {
    for (const file of files) {
      const url = `${studio.url}/__studio/examples/${name}/${file}`;
      const res = await fetch(url);
      assert.equal(res.status, 200, url);
      const src = await res.text();
      const specs = [...src.matchAll(/(?:from\s+|import\(\s*|src=)["']([^"'<]+)["']/g)].map((m) => m[1]);
      for (const spec of specs.filter((s) => !/^https?:/.test(s))) {
        const dep = new URL(spec, url);
        assert.equal((await fetch(dep)).status, 200, `${name}/${file} imports ${spec}`);
      }
    }
  }
});

test('the examples are Game Projects: each boots and saves its Kit output into its out folder', async (t) => {
  for (const [name, kind, file] of [['mini-arena', 'playtest', 'selftest-start.png'], ['promo', 'promo', 'still.jpg']]) {
    const dir = cpTemp(example(name));
    const studio = await startStudio(dir);
    t.after(studio.stop);
    assert.equal((await fetch(`${studio.url}/index.html`)).status, 200, name);
    const put = await fetch(`${studio.url}/__studio/out/${kind}/${file}`, { method: 'PUT', body: 'x' });
    assert.equal(put.status, 201, name);
    const manifest = JSON.parse(readFileSync(join(dir, 'studio.json'), 'utf8'));
    assert.equal(readFileSync(join(dir, manifest.out[kind], file), 'utf8'), 'x');
  }
});

test("PUT /__studio/out/<kind>/<file> writes into the manifest's out[kind] folder and GET reads it back", async (t) => {
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'Out', out: { playtest: 'playtest/out', promo: 'promo/out' } } });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const put = await fetch(`${studio.url}/__studio/out/playtest/selftest-start.png`, { method: 'PUT', body: 'png bytes' });
  assert.equal(put.status, 201);
  assert.equal(readFileSync(join(dir, 'playtest/out/selftest-start.png'), 'utf8'), 'png bytes');

  await fetch(`${studio.url}/__studio/out/promo/a.mp4`, { method: 'PUT', body: 'mp4' });
  assert.equal(readFileSync(join(dir, 'promo/out/a.mp4'), 'utf8'), 'mp4');

  const get = await fetch(`${studio.url}/__studio/out/playtest/selftest-start.png`);
  assert.equal(get.status, 200);
  assert.equal(await get.text(), 'png bytes');
});

test('the out write map refuses unknown kinds, `..` and folders outside the Game Project', async (t) => {
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'Out', out: { playtest: 'playtest/out', evil: '../escape' } },
  });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const put = (path: string) => fetch(`${studio.url}/__studio/out/${path}`, { method: 'PUT', body: 'x' }).then((r) => r.status);

  assert.equal(await put('promo/a.mp4'), 403, 'kind not in the out map');
  assert.equal(await put('toString/a.png'), 403, 'inherited object keys are not kinds');
  assert.equal(await put('playtest/%2e%2e'), 403);
  assert.equal(await put('playtest/%2e%2e%2fstudio.json'), 403);
  assert.equal(await put('playtest/..%2f..%2fstudio.json'), 403);
  assert.equal(await put('playtest/sub/a.png'), 403, 'flat files only');
  assert.equal(await put('evil/a.png'), 403, 'out folder outside the Game Project');
  assert.equal(JSON.parse(readFileSync(join(dir, 'studio.json'), 'utf8')).name, 'Out');
  assert.equal(existsSync(join(dir, '..', 'escape')), false);
});
