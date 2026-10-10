import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, tempProject } from './harness.ts';

const project = () =>
  tempProject({
    'studio.json': { studio: '1.x', name: 'Docs', docs: ['DESIGN.md', 'design/**/*.md'] },
    'DESIGN.md': '# Design\n',
    'design/passes/one.md': '# Pass one\n',
    'design/notes.txt': 'not a doc',
    'SECRET.md': '# not declared',
  });

test('the Docs Surface lists every file matching the docs globs', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/docs`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), ['DESIGN.md', 'design/passes/one.md']);
});

test('a declared doc is read through the Docs Surface', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/docs/design/passes/one.md`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '# Pass one\n');
});

test('the Docs Surface refuses files outside the docs globs', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);

  for (const path of ['SECRET.md', 'design/notes.txt', 'studio.json', '%2e%2e/etc/passwd']) {
    const res = await fetch(`${studio.url}/__studio/docs/${path}`);
    assert.equal(res.status, 404, path);
  }
});

test('a docs entry naming a folder lists the files in it', async (t) => {
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'F', docs: 'design' }, 'design/a/b.md': '# B' });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  assert.deepEqual(await (await fetch(`${studio.url}/__studio/docs`)).json(), ['design/a/b.md']);
});

test('an absent docs section lists no docs and keeps "not set up"', async (t) => {
  const studio = await startStudio(tempProject({ 'studio.json': { studio: '1.x', name: 'None' }, 'README.md': '# R' }));
  t.after(studio.stop);

  assert.deepEqual(await (await fetch(`${studio.url}/__studio/docs`)).json(), []);
  assert.equal((await fetch(`${studio.url}/__studio/docs/README.md`)).status, 404);
  const surfaces: { name: string; setUp: boolean }[] = await (await fetch(`${studio.url}/__studio/surfaces`)).json();
  assert.equal(surfaces.find((s) => s.name === 'Docs')?.setUp, false);
});
