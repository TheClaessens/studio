import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, tempProject } from './harness.ts';

const personas = [
  '---', 'kind: personas', '---', '# Arena — playtester personas', '',
  '| # | Persona | Archetype |', '|---|---|---|', '| 1 | **Mila** | Cozy casual |', '',
  '## 1. Mila — cozy casual', '```persona', 'id: Mila', 'archetype: Cozy casual', 'quote: "I play to unwind."', 'color: #b0446a',
  'tint: #f6e1e8', 'sigil: moon', 'voice: soft', 'hands: casual', 'look: knitted beanie', 'portrait: personas/mila.png', 'unknown: dropped', '```',
  '**Play plan**', '- Three runs on a fresh save.', '- Screenshots generously.', '', '**Questions**', '- Would I come back tomorrow?', '',
  '## 2. Rhea — challenge seeker', '```persona', 'id: rhea', 'color: red', 'portrait: personas/rhea.png', '```', 'Some prose.', '- not a plan item', '',
  '```persona', 'archetype: no id, no persona', '```',
].join('\n');

test('PERSONAS.md at the playtests root is served as the panel: identity, play plan and questions per persona', async (t) => {
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'P', playtests: 'playtest' }, 'playtest/PERSONAS.md': personas, 'playtest/personas/mila.png': 'png' });
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const res = await fetch(`${studio.url}/__studio/personas`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [
    {
      id: 'mila', archetype: 'Cozy casual', quote: 'I play to unwind.', color: '#b0446a', tint: '#f6e1e8', sigil: 'moon', voice: 'soft', hands: 'casual',
      look: 'knitted beanie', portrait: 'playtest/personas/mila.png', plan: ['Three runs on a fresh save.', 'Screenshots generously.'], questions: ['Would I come back tomorrow?'],
    },
    // A colour that isn't hex and a portrait file that doesn't exist are left out.
    { id: 'rhea', plan: [], questions: [] },
  ]);
  // The portrait is served where the panel says it is.
  assert.equal((await fetch(`${studio.url}/__studio/playtests/playtest/personas/mila.png`)).status, 200);
});

test('without a PERSONAS.md, or a playtests section, the panel is empty', async (t) => {
  for (const files of [{ 'studio.json': { studio: '1.x', name: 'P', playtests: 'playtest' }, 'playtest/round-1/REPORT.md': '# R' }, { 'studio.json': { studio: '1.x', name: 'P' }, 'PERSONAS.md': personas }]) {
    const studio = await startStudio(tempProject(files));
    t.after(studio.stop);
    assert.deepEqual(await (await fetch(`${studio.url}/__studio/personas`)).json(), []);
  }
});
