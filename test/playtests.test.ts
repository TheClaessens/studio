import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture, startStudio, tempProject, postJson } from './harness.ts';

const p = 'playtest/';

test('rounds are listed latest first, with layout files marked as markdown and the rest raw', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/playtests`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    rounds: [
      { name: 'round-10', files: [{ path: `${p}round-10/01-rhea.md`, markdown: true }] },
      {
        name: 'round-2',
        files: [
          { path: `${p}round-2/REPORT.md`, markdown: true },
          { path: `${p}round-2/ROUND.md`, markdown: true },
        ],
      },
      {
        name: 'round-1',
        files: [
          { path: `${p}round-1/01-mila.md`, markdown: true },
          { path: `${p}round-1/06-dex-data.json`, markdown: false },
          { path: `${p}round-1/NEXT.md`, markdown: false },
          { path: `${p}round-1/REPORT.md`, markdown: true },
        ],
      },
    ],
    files: [{ path: `${p}BRIEF.md`, markdown: false }],
  });
});

const finding = (path: string, anchor: string | undefined, label: string) => ({ kind: 'playtest', path: `${p}${path}`, anchor, label });

test('Feedback pinned to a finding is written to disk and resolves by heading or numbered item', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-'));
  cpSync(fixture('static-only'), dir, { recursive: true });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const pin = finding('round-1/REPORT.md', 'top-issues/2', 'Chain runaway');
  const res = await postJson(`${studio.url}/__studio/feedback`, { remark: 'Cap the chain', pin });
  assert.equal(res.status, 201);
  const [file] = readdirSync(join(dir, 'feedback'));
  assert.match(readFileSync(join(dir, 'feedback', file), 'utf8'),
    /\npin:\n  kind: "playtest"\n  path: "playtest\/round-1\/REPORT.md"\n  anchor: "top-issues\/2"\n  label: "Chain runaway"\n/);

  const pins = [
    [finding('round-1/REPORT.md', 'top-issues/2', 'table row'), true],
    [finding('round-1/REPORT.md', 'executive-summary/1', 'list item'), true],
    [finding('round-1/REPORT.md', 'top-issues', 'heading'), true],
    [finding('round-1/01-mila.md', 'pain-points-ranked-worst-first/2', 'persona item'), true],
    [finding('round-1/06-dex-data.json', undefined, 'whole raw file'), true],
    [finding('round-1/REPORT.md', 'top-issues/3', 'no third issue'), false],
    [finding('round-1/REPORT.md', 'not-a-heading/1', 'fenced code'), false],
    [finding('round-1/REPORT.md', 'executive-summary/3', 'no third item'), false],
    [finding('round-9/REPORT.md', undefined, 'no such round'), false],
    [{ kind: 'playtest', path: 'README.md', label: 'outside the playtests root' }, false],
  ] as const;
  for (const [pin] of pins) await postJson(`${studio.url}/__studio/feedback`, { remark: 'x', pin });
  const items: { pin: { label: string }; resolved: boolean }[] = await (await fetch(`${studio.url}/__studio/feedback`)).json();
  for (const [pin, resolved] of pins) assert.equal(items.find((i) => i.pin.label === pin.label)?.resolved, resolved, pin.label);
});

test('a listed playtest file is read by its Game Project path; anything else is refused', async (t) => {
  const studio = await startStudio(fixture('static-only'));
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/playtests/${p}round-1/NEXT.md`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '# Next round\n\n1. Re-run the batches.\n');
  for (const path of ['README.md', 'studio.json', 'round-1/REPORT.md', `${p}%2e%2e/README.md`]) {
    assert.equal((await fetch(`${studio.url}/__studio/playtests/${path}`)).status, 404, path);
  }
});

test("the skill's default rounds/round-N layout is found too; no section lists nothing", async (t) => {
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'S', playtests: 'playtest' },
    'playtest/rounds/round-1/REPORT.md': '# R',
    'playtest/rounds/round-1/shots/a.md': '# not layout',
  });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  assert.deepEqual(await (await fetch(`${studio.url}/__studio/playtests`)).json(), {
    rounds: [{ name: 'round-1', files: [
      { path: 'playtest/rounds/round-1/REPORT.md', markdown: true },
      { path: 'playtest/rounds/round-1/shots/a.md', markdown: false },
    ] }],
    files: [],
  });

  const none = await startStudio(tempProject({ 'studio.json': { studio: '1.x', name: 'N' }, 'round-1/REPORT.md': '# R' }));
  t.after(none.stop);
  assert.deepEqual(await (await fetch(`${none.url}/__studio/playtests`)).json(), { rounds: [], files: [] });
  assert.equal((await fetch(`${none.url}/__studio/playtests/round-1/REPORT.md`)).status, 404);
});
