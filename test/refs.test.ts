import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, tempProject } from './harness.ts';

const synthesis = [
  '---', 'kind: playtest-report', 'round: 1', '---', '# Arena · Synthesis', '',
  '## 1. Executive summary', '1. **Hero lost in effects** — [mila 1](01-mila.md#pain-points/1), see [Combat](../../../DESIGN.md#combat).', '',
  '## 4. Top issues', '| # | Issue | Evidence |', '|---|---|---|', '| 1 | **Boss unkillable** | [rhea](./01-rhea.md) · [web](https://example.com) · [gone](02-gone.md) |', '',
].join('\n');
const mila = [
  '---', 'kind: persona-report', 'round: 1', 'persona: mila', '---', '# Mila', '',
  '## Pain points', '1. **Where am I?** (shot: `playtest/out/mila-boss.png` · caption: "Can you see me?" · at: 0.42,0.55)', '',
  '## Highlights', '- Pretty crowds (shots: `mila-crowd.png`, `missing.png`)', '',
].join('\n');

test('links between docs and reports, and shot references, are indexed by the Pin anchor they sit under', async (t) => {
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'R', docs: ['DESIGN.md'], playtests: 'playtest', media: ['playtest/out'], out: { playtest: 'playtest/out' } },
    'DESIGN.md': '# Design\n\n## Combat\n\nSwing, dodge.\n',
    'playtest/rounds/round-1/REPORT.md': synthesis,
    'playtest/rounds/round-1/01-mila.md': mila,
    'playtest/rounds/round-1/01-rhea.md': '# Rhea\n',
    'playtest/out/mila-boss.png': 'png',
    'playtest/out/mila-crowd.png': 'png',
  });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const { places, links, shots } = await (await fetch(`${studio.url}/__studio/refs`)).json();
  const r = 'playtest/rounds/round-1/';
  const from = { surface: 'Playtests', path: `${r}REPORT.md`, anchor: '1-executive-summary/1', label: 'Hero lost in effects' };
  // Every file (by its title), heading and finding is a place the palette can jump to.
  const has = (path: string, anchor: string | undefined, label: string) => places.some((p: { path: string; anchor?: string; label: string }) => p.path === path && p.anchor === anchor && p.label === label);
  assert.ok(has(`${r}01-mila.md`, 'pain-points/1', 'Where am I?'));
  assert.ok(has('DESIGN.md', undefined, 'Design'));
  assert.ok(has('DESIGN.md', 'combat', 'Combat'));
  assert.deepEqual(links, [
    { from, to: { surface: 'Playtests', path: `${r}01-mila.md`, anchor: 'pain-points/1', label: 'Where am I?' }, href: '01-mila.md#pain-points/1', text: 'mila 1' },
    { from, to: { surface: 'Docs', path: 'DESIGN.md', anchor: 'combat', label: 'Combat' }, href: '../../../DESIGN.md#combat', text: 'Combat' },
    // An external link and one to a file no Surface lists are left out.
    { from: { ...from, anchor: '4-top-issues/1', label: 'Boss unkillable' }, to: { surface: 'Playtests', path: `${r}01-rhea.md`, label: '01-rhea.md' }, href: './01-rhea.md', text: 'rhea' },
  ]);
  assert.deepEqual(shots, {
    'playtest/out/mila-boss.png': { takenBy: 'mila', usedIn: [{ surface: 'Playtests', path: `${r}01-mila.md`, anchor: 'pain-points/1', label: 'Where am I?', ref: 'playtest/out/mila-boss.png', caption: 'Can you see me?', at: [0.42, 0.55] }] },
    // A bare file name finds the one Media file of that name; a shot that isn't Media is left out.
    'playtest/out/mila-crowd.png': { takenBy: 'mila', usedIn: [{ surface: 'Playtests', path: `${r}01-mila.md`, anchor: 'highlights', label: 'Highlights', ref: 'mila-crowd.png' }] },
  });
});
