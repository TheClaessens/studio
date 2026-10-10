// Seam 2: `studio check <game-dir>` runs the Kit self-test in a real browser against the Game Project's adapter,
// and exercises its asset catalogue and capture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, noBrowser, runStudio, tempProject } from './harness.ts';

const check = (dir: string) => runStudio(dir, { check: true });

function miniArena() {
  const dir = mkdtempSync(join(tmpdir(), 'studio-check-'));
  cpSync(fileURLToPath(new URL('../examples/mini-arena', import.meta.url)), dir, { recursive: true });
  return dir;
}

test('studio check passes against mini-arena and the shot lands in out.playtest', { skip: noBrowser, timeout: 120_000 }, async () => {
  const dir = miniArena();
  const { code, output } = await check(dir);
  assert.equal(code, 0, output);
  assert.match(output, /pass/i);
  assert.match(output, /✓ play capture/);
  assert.ok(readdirSync(join(dir, 'playtest/out')).some((f) => f.endsWith('.png')), 'a shot PNG is on disk');
});

test('studio check fails non-zero and names the failed step', { skip: noBrowser, timeout: 120_000 }, async () => {
  const dir = miniArena();
  writeFileSync(join(dir, 'adapter.js'), `export default { init: () => ({ ok: true }), start: () => ({ error: 'boom' }) };`);
  const { code, output } = await check(dir);
  assert.notEqual(code, 0);
  assert.match(output, /start/);
  assert.match(output, /boom/);
});

test('studio check without play.adapter or assets fails, saying what to declare', async () => {
  const { code, output } = await check(tempProject({ 'studio.json': { studio: '1.x', name: 'No adapter', play: { entry: 'index.html' } } }));
  assert.notEqual(code, 0);
  assert.match(output, /play\.adapter/);
});

test('studio check fails at "catalogue" when the asset catalogue does not load', async () => {
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'Bad catalogue', assets: { catalogue: 'catalogue.js', view: 'view.html?id={id}' } },
    'catalogue.js': `export default () => { throw new Error('kaput'); };`,
  });
  const { code, output } = await check(dir);
  assert.notEqual(code, 0);
  assert.match(output, /"catalogue"/);
  assert.match(output, /kaput/);
});

test('studio check loads the gltf catalogue and captures its first asset from the default canvas', { skip: noBrowser, timeout: 120_000 }, async () => {
  const { code, output } = await check(fixture('gltf'));
  assert.equal(code, 0, output);
  assert.match(output, /✓ catalogue/);
  assert.match(output, /✓ capture/);
});

test('studio check uses the assets.capture override, and fails at "capture" without one when the view has no canvas', { skip: noBrowser, timeout: 120_000 }, async () => {
  const files = {
    'catalogue.json': [{ id: 'a', name: 'A', group: 'g', anchors: [] }],
    'view.html': '<!doctype html><p>no canvas here</p>',
    'capture.js': `export const capture = () => new Blob(['png'], { type: 'image/png' });`,
  };
  const assets = { catalogue: 'catalogue.json', view: 'view.html?id={id}' };
  const without = await check(tempProject({ 'studio.json': { studio: '1.x', name: 'No canvas', assets }, ...files }));
  assert.notEqual(without.code, 0);
  assert.match(without.output, /"capture"/);
  assert.match(without.output, /canvas/);

  const withOverride = await check(tempProject({ 'studio.json': { studio: '1.x', name: 'Override', assets: { ...assets, capture: 'capture.js' } }, ...files }));
  assert.equal(withOverride.code, 0, withOverride.output);
  assert.match(withOverride.output, /✓ capture/);
});
