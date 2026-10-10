import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startStudio, tempProject, postJson } from './harness.ts';

const video = Buffer.from('0123456789abcdefghij').toString(); // 20 bytes standing in for an mp4
const project = () =>
  tempProject({
    'studio.json': { studio: '1.x', name: 'Media', media: ['out', 'dev/shots/*.png'] },
    'out/clips/run.mp4': video,
    'out/hero.png': 'png',
    'dev/shots/a.png': 'a',
    'dev/shots/notes.txt': 'not media',
    'secret.png': 'nope',
  });

test('the Media Surface lists every file matching the media globs', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/media`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), ['dev/shots/a.png', 'out/clips/run.mp4', 'out/hero.png']);
});

test('a declared media file is read through the Media Surface; others are refused', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/media/out/hero.png`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(await res.text(), 'png');
  for (const path of ['secret.png', 'dev/shots/notes.txt', 'studio.json', '%2e%2e/etc/passwd']) {
    assert.equal((await fetch(`${studio.url}/__studio/media/${path}`)).status, 404, path);
  }
});

test('an absent media section lists nothing and keeps "not set up"', async (t) => {
  const studio = await startStudio(tempProject({ 'studio.json': { studio: '1.x', name: 'None' }, 'a.png': 'a' }));
  t.after(studio.stop);

  assert.deepEqual(await (await fetch(`${studio.url}/__studio/media`)).json(), []);
  assert.equal((await fetch(`${studio.url}/__studio/media/a.png`)).status, 404);
  const surfaces: { name: string; setUp: boolean }[] = await (await fetch(`${studio.url}/__studio/surfaces`)).json();
  assert.equal(surfaces.find((s) => s.name === 'Media')?.setUp, false);
});

test('files are served with byte ranges so videos can seek', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);

  for (const url of [`${studio.url}/__studio/media/out/clips/run.mp4`, `${studio.url}/out/clips/run.mp4`]) {
    const full = await fetch(url);
    assert.equal(full.headers.get('accept-ranges'), 'bytes');
    assert.equal(await full.text(), video);

    const part = await fetch(url, { headers: { range: 'bytes=10-14' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 10-14/20');
    assert.equal(part.headers.get('content-length'), '5');
    assert.equal(await part.text(), 'abcde');

    const open = await fetch(url, { headers: { range: 'bytes=15-' } });
    assert.equal(open.headers.get('content-range'), 'bytes 15-19/20');
    assert.equal(await open.text(), 'fghij');

    const suffix = await fetch(url, { headers: { range: 'bytes=-3' } });
    assert.equal(await suffix.text(), 'hij');

    const bad = await fetch(url, { headers: { range: 'bytes=20-' } });
    assert.equal(bad.status, 416);
    assert.equal(bad.headers.get('content-range'), 'bytes */20');
  }
});

const png = `data:image/png;base64,${Buffer.from('frame').toString('base64')}`;

async function pin(url: string, pin: Record<string, unknown>) {
  const res = await postJson(`${url}/__studio/feedback`, { remark: 'Look here', pin, attachments: { screenshot: png } });
  assert.equal(res.status, 201);
  return res.json();
}

test('a video Pin stores the path, timestamp, label and frame screenshot', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const item = await pin(studio.url, { kind: 'media', path: 'out/clips/run.mp4', t: 2.5, label: 'run.mp4 @ 0:02.5' });
  const text = readFileSync(join(dir, 'feedback', `${item.name}.md`), 'utf8');
  assert.ok(text.includes(`pin:\n  kind: "media"\n  path: "out/clips/run.mp4"\n  t: 2.5\n  label: "run.mp4 @ 0:02.5"\n  screenshot: "${item.name}.png"\n`), text);
  assert.equal(readFileSync(join(dir, 'feedback', `${item.name}.png`), 'utf8'), 'frame');
  assert.equal(item.resolved, true);
});

test('an image Pin stores the path and a normalised region', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const region = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
  const item = await pin(studio.url, { kind: 'media', path: 'out/hero.png', region, label: 'hero.png region' });
  const text = readFileSync(join(dir, 'feedback', `${item.name}.md`), 'utf8');
  assert.ok(text.includes(`  region: {"x":0.1,"y":0.2,"w":0.3,"h":0.4}\n`), text);
  const [listed] = await (await fetch(`${studio.url}/__studio/feedback`)).json();
  assert.deepEqual(listed.pin.region, region);
  assert.equal(listed.resolved, true);
});

test('a media Pin outside the media globs does not resolve', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);

  const item = await pin(studio.url, { kind: 'media', path: 'secret.png', label: 'x' });
  assert.equal(item.resolved, false);
});
