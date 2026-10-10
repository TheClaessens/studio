import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startStudio, tempProject } from './harness.ts';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const image = `data:image/png;base64,${png.toString('base64')}`;
const json = (v: unknown) => `data:application/json;base64,${Buffer.from(JSON.stringify(v)).toString('base64')}`;
const create = (url: string, remark: string, pin: object, attachments?: object) =>
  fetch(`${url}/__studio/feedback`, { method: 'POST', body: JSON.stringify({ remark, pin, attachments }) });
const list = async (url: string) => (await fetch(`${url}/__studio/feedback`)).json();
const game = (play: object) =>
  tempProject({
    'studio.json': { studio: '1.x', name: 'G', play },
    'index.html': '<canvas></canvas>',
    'dev/hooks.js': 'export const snapshot = (win) => ({ wave: 3 });',
  });

test('a same-origin play.entry and its hooks module are served by the Studio', async (t) => {
  const play = { entry: 'index.html', hooks: 'dev/hooks.js' };
  const studio = await startStudio(game(play));
  t.after(studio.stop);
  const surfaces = await (await fetch(`${studio.url}/__studio/surfaces`)).json();
  assert.deepEqual(surfaces.find((s: any) => s.name === 'Play').config, play);
  assert.equal(await (await fetch(`${studio.url}/index.html`)).text(), '<canvas></canvas>');
  assert.match((await fetch(`${studio.url}/dev/hooks.js`)).headers.get('content-type') ?? '', /javascript/);
});

test('a play-moment Pin stores its screenshot and snapshot JSON beside the item', async (t) => {
  const dir = game({ entry: 'index.html', hooks: 'dev/hooks.js' });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const pin = { kind: 'play', path: 'index.html', label: 'Wave 3' };
  const res = await create(studio.url, 'Too many goblins', pin, { screenshot: image, snapshot: json({ wave: 3 }) });
  assert.equal(res.status, 201, await res.clone().text());
  const { name } = await res.json();
  assert.deepEqual(readdirSync(join(dir, 'feedback')).sort(), [`${name}.json`, `${name}.md`, `${name}.png`]);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'feedback', `${name}.json`), 'utf8')), { wave: 3 });
  assert.deepEqual(readFileSync(join(dir, 'feedback', `${name}.png`)), png);
  const [item] = await list(studio.url);
  assert.deepEqual(item.pin, { ...pin, screenshot: `${name}.png`, snapshot: `${name}.json` });
  assert.equal(item.resolved, true);

  // Pointing play.entry elsewhere unresolves the Pin.
  writeFileSync(join(dir, 'studio.json'), JSON.stringify({ studio: '1.x', name: 'G', play: { entry: 'game.html' } }));
  const restarted = await startStudio(dir);
  t.after(restarted.stop);
  assert.equal((await list(restarted.url))[0].resolved, false);
});

test('with an absolute play.entry, a Pin takes a label plus an optional pasted image', async (t) => {
  const entry = 'https://stream.example.com/play';
  const dir = game({ entry });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  assert.equal((await create(studio.url, 'Laggy', { kind: 'play', path: entry, label: 'Boss room' })).status, 201);
  assert.equal((await create(studio.url, 'Ugly', { kind: 'play', path: entry, label: 'Lobby' }, { screenshot: image })).status, 201);
  const items = await list(studio.url);
  assert.deepEqual(items.map((i: any) => [i.pin.label, i.resolved, !!i.pin.screenshot]).sort(), [['Boss room', true, false], ['Lobby', true, true]]);
});

test('a play Pin without a label, or with a non-JSON snapshot, is refused and writes nothing', async (t) => {
  const dir = game({ entry: 'index.html', hooks: 'dev/hooks.js' });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const bad: [object, object?][] = [
    [{ kind: 'play', path: 'index.html', label: ' ' }],
    [{ kind: 'play', path: 'index.html', label: 'x' }, { snapshot: image }],
    [{ kind: 'play', path: 'index.html', label: 'x' }, { screenshot: json({}) }],
  ];
  for (const [pin, attachments] of bad) assert.equal((await create(studio.url, 'x', pin, attachments)).status, 400, JSON.stringify([pin, attachments]));
  assert.ok(!existsSync(join(dir, 'feedback')));
});
