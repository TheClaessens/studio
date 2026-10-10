import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { startStudio, runStudio, tempProject, fixture, rawRequest } from './harness.ts';

test('a code-free static-only Game Project boots and its files are served at /', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/docs/design.md`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '# Design\n\nNo code here.\n');
});

test('files outside the Game Project are not served', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/%2e%2e/malformed/studio.json`);
  assert.equal(res.status, 404);
});

test('a malformed manifest section fails loudly, naming the section', async () => {
  const { code, output } = await runStudio(fixture('malformed'));
  assert.notEqual(code, 0);
  assert.match(output, /studio\.json/);
  assert.match(output, /"assets"/);
});

test('an unknown manifest section fails loudly, naming it', async () => {
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'Typo', doc: ['README.md'] } });
  const { code, output } = await runStudio(dir);
  assert.notEqual(code, 0);
  assert.match(output, /"doc"/);
});

test('the manifest JSON Schema is served and covers every v1 section', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/schema/studio.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /json/);
  const schema = await res.json();
  for (const key of ['studio', 'name', 'assets', 'play', 'playtests', 'media', 'docs', 'feedback', 'out']) {
    assert.ok(schema.properties[key], `schema covers "${key}"`);
  }
  assert.ok(schema.properties.play.properties.hooks, 'play.hooks is in the schema');
  assert.match(schema.properties.play.properties.hooks.description, /actions.*reserved/);
});

test('the six Surfaces are listed; an absent section is "not set up" with an example section', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/surfaces`);
  assert.equal(res.status, 200);
  const surfaces: { name: string; section: string; setUp: boolean; value?: unknown; example?: unknown }[] = await res.json();
  assert.deepEqual(
    surfaces.map((s) => [s.name, s.setUp]),
    [['Assets', false], ['Feedback', false], ['Play', false], ['Playtests', true], ['Media', true], ['Docs', true]],
  );
  const byName = Object.fromEntries(surfaces.map((s) => [s.name, s]));
  assert.deepEqual(byName.Docs.value, ['README.md', 'docs/**/*.md']);
  assert.equal(byName.Docs.example, undefined);
  assert.equal(byName.Assets.section, 'assets');
  assert.ok((byName.Assets.example as { catalogue: string }).catalogue, 'Assets example has a catalogue');
  assert.ok((byName.Play.example as { entry: string }).entry, 'Play example has an entry');
  assert.equal(typeof byName.Feedback.example, 'string');
});

test('the Studio UI is served at /__studio/', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<div id="root">/);
});

test('a Studio version outside the pin warns loudly but still starts', async (t) => {
  const dir = tempProject({ 'studio.json': { studio: '99.x', name: 'Future' } });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  assert.match(studio.stderr(), /99\.x/);
  assert.match(studio.stderr(), /warning/i);
  assert.equal((await fetch(`${studio.url}/studio.json`)).status, 200);
});

test('a Studio version inside the pin does not warn', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);
  assert.doesNotMatch(studio.stderr(), /warning/i);
});

test('a feedback folder outside the Game Project fails loudly, naming the section', async () => {
  const { code, output } = await runStudio(tempProject({ 'studio.json': { studio: '1.x', name: 'Escape', feedback: '../x' } }));
  assert.notEqual(code, 0);
  assert.match(output, /"feedback"/);
  assert.match(output, /outside the Game Project/);
});

test('a request whose Host is not localhost is refused (DNS rebinding)', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  assert.equal(await rawRequest(`${studio.url}/docs/design.md`, { headers: { host: 'evil.example' } }), 403);
  assert.equal(await rawRequest(`${studio.url}/__studio/surfaces`, { headers: { host: 'evil.example:80' } }), 403);
  const port = new URL(studio.url).port;
  for (const host of [`localhost:${port}`, `127.0.0.1:${port}`]) {
    assert.equal(await rawRequest(`${studio.url}/docs/design.md`, { headers: { host } }), 200, host);
  }
});

test('a Studio write from another origin, or a POST that is not JSON, is refused (CSRF)', async (t) => {
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'Csrf', docs: ['A.md'], out: { promo: 'promo/out' } }, 'A.md': '# A' });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const body = JSON.stringify({ remark: 'x', pin: { kind: 'doc', path: 'A.md', label: 'A' } });
  const feedback = `${studio.url}/__studio/feedback`;
  const put = `${studio.url}/__studio/out/promo/a.mp4`;

  assert.equal(await rawRequest(feedback, { method: 'POST', headers: { 'content-type': 'text/plain' }, body }), 415);
  assert.equal(await rawRequest(feedback, { method: 'POST', body }), 415);
  assert.equal(await rawRequest(feedback, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://evil.example' }, body }), 403);
  assert.equal(await rawRequest(put, { method: 'PUT', headers: { origin: 'http://evil.example' }, body: 'x' }), 403);
  assert.ok(!existsSync(join(dir, 'feedback')));
  assert.ok(!existsSync(join(dir, 'promo/out')));

  assert.equal(await rawRequest(feedback, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', origin: studio.url }, body }), 201);
  assert.equal(await rawRequest(put, { method: 'PUT', headers: { origin: studio.url }, body: 'x' }), 201);
});

test('a Game Project without studio.json fails loudly', async () => {
  const { code, output } = await runStudio(tempProject({ 'README.md': '# no manifest' }));
  assert.notEqual(code, 0);
  assert.match(output, /studio\.json/);
});
