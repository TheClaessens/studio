import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startStudio, tempProject } from './harness.ts';

const goblin = { id: 'goblinGrunt', name: 'Goblin Grunt', group: 'greenskins', anchors: [{ name: 'idle' }, { name: 'walk', range: [0, 1.6] }] };
const view = 'dev/viewer.html?set={group}&id={id}&pose={anchor}:{t}&play={play}';
const project = () =>
  tempProject({ 'studio.json': { studio: '1.x', name: 'G', assets: { catalogue: 'catalogue.json', view } }, 'catalogue.json': [goblin] });

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const screenshot = { screenshot: `data:image/png;base64,${png.toString('base64')}` };
const create = (url: string, remark: string, pin: object, attachments: object = screenshot) =>
  fetch(`${url}/__studio/feedback`, { method: 'POST', body: JSON.stringify({ remark, pin, attachments }) });
const list = async (url: string) => (await fetch(`${url}/__studio/feedback`)).json();

test('asset Pins resolve while their id is in the catalogue', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const pins = {
    asset: { kind: 'asset', id: 'goblinGrunt', label: 'Goblin Grunt' },
    animation: { kind: 'asset', id: 'goblinGrunt', anchor: 'walk', label: 'Goblin Grunt · walk' },
    frame: { kind: 'asset', id: 'goblinGrunt', anchor: 'walk', t: 0.4, label: 'Goblin Grunt · walk @ 0.40' },
    gone: { kind: 'asset', id: 'emberLobber', label: 'Ember Lobber' },
  };
  for (const [remark, pin] of Object.entries(pins)) assert.equal((await create(studio.url, remark, pin)).status, 201, remark);

  const resolved = async () => Object.fromEntries((await list(studio.url)).map((i: any) => [i.body.trim(), i.resolved]));
  assert.deepEqual(await resolved(), { asset: true, animation: true, frame: true, gone: false });

  // Renaming the asset in the catalogue unresolves its Pins.
  writeFileSync(join(dir, 'catalogue.json'), JSON.stringify([{ ...goblin, id: 'grunt' }]));
  assert.deepEqual(await resolved(), { asset: false, animation: false, frame: false, gone: false });
});

test('a frame Pin is written with its id, anchor, t, quoted label and a screenshot beside it', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const pin = { kind: 'asset', id: 'goblinGrunt', anchor: 'walk', t: 0.4, label: 'Goblin Grunt · walk @ 0.40' };
  const res = await create(studio.url, 'Foot slides here', pin);
  assert.equal(res.status, 201);
  const { name } = await res.json();
  assert.deepEqual(readdirSync(join(dir, 'feedback')).sort(), [`${name}.md`, `${name}.png`]);
  assert.deepEqual(readFileSync(join(dir, 'feedback', `${name}.png`)), png);
  assert.ok(
    readFileSync(join(dir, 'feedback', `${name}.md`), 'utf8').startsWith(
      `---\nstatus: open\npin:\n  kind: "asset"\n  id: "goblinGrunt"\n  anchor: "walk"\n  t: 0.4\n  label: "Goblin Grunt · walk @ 0.40"\n  screenshot: "${name}.png"\n`,
    ),
  );
  const [item] = await list(studio.url);
  assert.deepEqual(item.pin, { ...pin, screenshot: `${name}.png` });
});

test('an asset Pin without a screenshot, or with a frame but no anchor, is refused and writes nothing', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const bad: [object, object][] = [
    [{ kind: 'asset', id: 'goblinGrunt', label: 'Goblin Grunt' }, {}],
    [{ kind: 'asset', id: 'goblinGrunt', t: 0.4, label: 'l' }, screenshot],
    [{ kind: 'asset', id: 'goblinGrunt', anchor: 'walk', t: '0.4', label: 'l' }, screenshot],
    [{ kind: 'asset', id: 'goblinGrunt', anchor: 3, label: 'l' }, screenshot],
    [{ kind: 'asset', path: 'catalogue.json', label: 'l' }, screenshot],
  ];
  for (const [pin, attachments] of bad) assert.equal((await create(studio.url, 'x', pin, attachments)).status, 400, JSON.stringify(pin));
  assert.ok(!existsSync(join(dir, 'feedback')));
});

test('assets.capture names the view\'s capture override module, handed to the Workbench', async (t) => {
  const assets = { catalogue: 'catalogue.json', view, capture: 'dev/studio/hooks.js' };
  const studio = await startStudio(tempProject({ 'studio.json': { studio: '1.x', name: 'G', assets }, 'catalogue.json': [goblin] }));
  t.after(studio.stop);
  const surfaces = await (await fetch(`${studio.url}/__studio/surfaces`)).json();
  assert.deepEqual(surfaces.find((s: any) => s.name === 'Assets').config, assets);
});
