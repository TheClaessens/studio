import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startStudio, tempProject, postJson } from './harness.ts';

const doc = '# Design\n\n## Combat\n\nHit things.\n\n## Notes\n\none\n\n## Notes\n\ntwo\n\n```\n# not a heading\n```\n';

/** A Game Project in its own git repo, so the author comes from a known git config. */
function project(manifest: Record<string, unknown> = { docs: ['DESIGN.md'] }) {
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'F', ...manifest }, 'DESIGN.md': doc });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Ada Tester'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'ada@example.com'], { cwd: dir });
  return dir;
}

const docPin = (anchor = 'combat', label = 'Combat') => ({ kind: 'doc', path: 'DESIGN.md', anchor, label });

async function create(url: string, body: unknown) {
  return postJson(`${url}/__studio/feedback`, body);
}
const list = async (url: string) => (await fetch(`${url}/__studio/feedback`)).json();
const act = (url: string, name: string, action: string, body: unknown = {}) =>
  postJson(`${url}/__studio/feedback/${name}/${action}`, body);

test('creating Feedback writes one markdown file named by timestamp and slug into feedback/', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const before = new Date();
  const res = await create(studio.url, { remark: 'Combat reads too slow, cut a step!', pin: docPin() });
  assert.equal(res.status, 201);
  const { name } = await res.json();

  const stamp = before.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  assert.match(name, /^\d{8}-\d{4}-combat-reads-too-slow-cut$/);
  assert.ok(name.startsWith(stamp.slice(0, 9)), name);
  assert.deepEqual(readdirSync(join(dir, 'feedback')), [`${name}.md`]);

  const text = readFileSync(join(dir, 'feedback', `${name}.md`), 'utf8');
  assert.match(text, /^---\nstatus: open\npin:\n  kind: "doc"\n  path: "DESIGN.md"\n  anchor: "combat"\n  label: "Combat"\nauthor: "Ada Tester <ada@example.com>"\ncreated: "\d{4}-\d\d-\d\dT[\d:.]+Z"\n---\n\nCombat reads too slow, cut a step!\n$/);
});

test('a label with quotes, colons and newlines is escaped and reads back intact', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const label = 'He said: "no"\n# --- \\ ok';
  const { name } = await (await create(studio.url, { remark: 'x', pin: docPin('combat', label) })).json();
  const text = readFileSync(join(dir, 'feedback', `${name}.md`), 'utf8');
  assert.ok(text.includes('  label: "He said: \\"no\\"\\n# --- \\\\ ok"\n'), text);
  const [item] = await list(studio.url);
  assert.equal(item.pin.label, label);
});

test('two items with the same slug in the same minute never collide', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const names = [];
  for (let i = 0; i < 3; i++) names.push((await (await create(studio.url, { remark: 'Same remark', pin: docPin() })).json()).name);
  assert.equal(new Set(names).size, 3);
  assert.equal(readdirSync(join(dir, 'feedback')).length, 3);
});

test('the manifest feedback section names the folder', async (t) => {
  const dir = project({ docs: ['DESIGN.md'], feedback: 'notes/fb' });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const { name } = await (await create(studio.url, { remark: 'Here', pin: docPin() })).json();
  assert.ok(existsSync(join(dir, 'notes/fb', `${name}.md`)));
  assert.ok(!existsSync(join(dir, 'feedback')));
});

test('a malformed create is refused and writes nothing', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const bad = [
    'not json',
    { pin: docPin() },
    { remark: '  ', pin: docPin() },
    { remark: 'x' },
    { remark: 'x', pin: { kind: 'doc', path: 'DESIGN.md' } },
    { remark: 'x', pin: { path: 'DESIGN.md', label: 'l' } },
    { remark: 'x', pin: { kind: 'doc', path: '../escape.md', label: 'l' } },
    { remark: 'x', pin: { kind: 'doc', path: '/etc/passwd', label: 'l' } },
    { remark: 'x', pin: docPin(), attachments: { screenshot: 'data:text/html;base64,PGI+' } },
    // an attachment may not overwrite a Pin field
    ...['path', 'kind', 'label', 'anchor', 'id'].map((field) => ({ remark: 'x', pin: docPin(), attachments: { [field]: 'data:image/png;base64,iVBO' } })),
    { remark: 'x', pin: { ...docPin(), region: { x: 0 } }, attachments: { region: 'data:image/png;base64,iVBO' } },
  ];
  for (const body of bad) {
    const res = await postJson(`${studio.url}/__studio/feedback`, body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.ok(!existsSync(join(dir, 'feedback')));
});

test('an attachment sits beside the item under the same name and the Pin references it', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const snapshot = { hp: 3 };
  const res = await create(studio.url, {
    remark: 'Look',
    pin: docPin(),
    attachments: {
      screenshot: `data:image/png;base64,${png.toString('base64')}`,
      snapshot: `data:application/json;base64,${Buffer.from(JSON.stringify(snapshot)).toString('base64')}`,
    },
  });
  assert.equal(res.status, 201);
  const { name } = await res.json();
  assert.deepEqual(readdirSync(join(dir, 'feedback')).sort(), [`${name}.json`, `${name}.md`, `${name}.png`]);
  assert.deepEqual(readFileSync(join(dir, 'feedback', `${name}.png`)), png);
  const [item] = await list(studio.url);
  assert.equal(item.pin.screenshot, `${name}.png`);
  assert.equal(item.pin.snapshot, `${name}.json`);
  const served = await fetch(`${studio.url}/__studio/feedback/${name}.png`);
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), png);
});

test('the lifecycle runs open → addressed → closed, and reopen appends a remark to the same file', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const { name } = await (await create(studio.url, { remark: 'First remark', pin: docPin() })).json();
  const file = join(dir, 'feedback', `${name}.md`);
  let [item] = await list(studio.url);
  assert.equal(item.status, 'open');
  assert.equal(item.name, name);
  assert.equal(item.author, 'Ada Tester <ada@example.com>');

  // Only an addressed item can be closed, and an open one can't be reopened.
  assert.equal((await act(studio.url, name, 'close')).status, 409);
  assert.equal((await act(studio.url, name, 'reopen', { remark: 'again' })).status, 409);

  // An agent addresses it by editing the file.
  writeFileSync(file, readFileSync(file, 'utf8').replace('status: open', 'status: addressed') + '\n## Resolution\n\nCut a step in abc123.\n');
  [item] = await list(studio.url);
  assert.equal(item.status, 'addressed');

  assert.equal((await act(studio.url, name, 'close')).status, 200);
  assert.match(readFileSync(file, 'utf8'), /^---\nstatus: closed\n/);

  assert.equal((await act(studio.url, name, 'reopen', {})).status, 400);
  assert.equal((await act(studio.url, name, 'reopen', { remark: 'Still slow on mobile.' })).status, 200);
  const text = readFileSync(file, 'utf8');
  assert.match(text, /^---\nstatus: open\n/);
  assert.ok(text.endsWith('First remark\n\n## Resolution\n\nCut a step in abc123.\n\n---\n\nStill slow on mobile.\n'), text);
  [item] = await list(studio.url);
  assert.equal(item.status, 'open');
  assert.ok(item.body.includes('Still slow on mobile.'));

  // An addressed item can be reopened too.
  writeFileSync(file, readFileSync(file, 'utf8').replace('status: open', 'status: addressed'));
  assert.equal((await act(studio.url, name, 'reopen', { remark: 'No.' })).status, 200);
  assert.match(readFileSync(file, 'utf8'), /^---\nstatus: open\n/);
});

test('transitions on unknown items or outside the folder are refused', async (t) => {
  const dir = project();
  writeFileSync(join(dir, 'outside.md'), '---\nstatus: addressed\n---\n');
  const studio = await startStudio(dir);
  t.after(studio.stop);

  for (const name of ['nope', '..%2Foutside', '%2E%2E']) {
    assert.equal((await act(studio.url, name, 'close')).status, 404, name);
  }
  assert.equal(readFileSync(join(dir, 'outside.md'), 'utf8'), '---\nstatus: addressed\n---\n');
});

test('the inbox lists every item and flags Pins that no longer resolve', async (t) => {
  const dir = project();
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const pins = {
    section: docPin('combat'),
    repeat: docPin('notes-1', 'Notes'),
    wholeDoc: { kind: 'doc', path: 'DESIGN.md', label: 'Design' },
    goneHeading: docPin('magic', 'Magic'),
    codeHeading: docPin('not-a-heading', 'nope'),
    goneDoc: { kind: 'doc', path: 'OLD.md', anchor: 'combat', label: 'Combat' },
    unknownKind: { kind: 'hologram', id: 'x', label: 'X' },
  };
  for (const [remark, pin] of Object.entries(pins)) assert.equal((await create(studio.url, { remark, pin })).status, 201);

  const items: { body: string; resolved: boolean }[] = await list(studio.url);
  const resolved = Object.fromEntries(items.map((i) => [i.body.trim(), i.resolved]));
  assert.deepEqual(resolved, {
    section: true, repeat: true, wholeDoc: true,
    goneHeading: false, codeHeading: false, goneDoc: false, unknownKind: false,
  });

  // Renaming the heading unresolves its Pin.
  writeFileSync(join(dir, 'DESIGN.md'), doc.replace('## Combat', '## Fighting'));
  const after: { body: string; resolved: boolean }[] = await list(studio.url);
  assert.equal(after.find((i) => i.body.trim() === 'section')?.resolved, false);
});

test('with no feedback folder yet the inbox is empty', async (t) => {
  const studio = await startStudio(project());
  t.after(studio.stop);
  assert.deepEqual(await list(studio.url), []);
});
