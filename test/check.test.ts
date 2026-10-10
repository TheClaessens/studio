// Seam 2: `studio check <game-dir>` runs the Kit self-test in a real browser against the Game Project's adapter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../server/check.ts';
import { tempProject } from './harness.ts';

const bin = fileURLToPath(new URL('../bin/studio.js', import.meta.url));
const noBrowser = findBrowser() ? false : 'no Chrome/Chromium/Edge found (set STUDIO_BROWSER)';

function check(dir: string) {
  const child = spawn(process.execPath, [bin, 'check', dir]);
  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  return new Promise<{ code: number | null; output: string }>((resolve) => child.on('exit', (code) => resolve({ code, output })));
}

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

test('studio check without play.adapter fails, saying what to declare', async () => {
  const { code, output } = await check(tempProject({ 'studio.json': { studio: '1.x', name: 'No adapter', play: { entry: 'index.html' } } }));
  assert.notEqual(code, 0);
  assert.match(output, /play\.adapter/);
});
