import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startStudio, tempProject } from './harness.ts';

const skill = readFileSync(new URL('../skills/feedback/SKILL.md', import.meta.url), 'utf8');

test('the feedback skill has name and description frontmatter', () => {
  const meta = skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
  assert.match(meta, /^name: feedback$/m);
  assert.match(meta, /^description: \S.{20,}$/m);
});

test("the skill's worked example, addressed as the skill says, reads back as an addressed item", async (t) => {
  // The first ```markdown block in the skill is a complete item an agent has just addressed.
  const example = skill.match(/```markdown\n([\s\S]*?)```/)?.[1];
  assert.ok(example, 'SKILL.md has a ```markdown example item');
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'F', docs: ['DESIGN.md'] }, 'DESIGN.md': '# Design\n\n## Combat\n' });
  mkdirSync(join(dir, 'feedback'));
  writeFileSync(join(dir, 'feedback', '20261010-0912-combat-reads-too-slow.md'), example);
  const studio = await startStudio(dir);
  t.after(studio.stop);

  const [item] = await (await fetch(`${studio.url}/__studio/feedback`)).json();
  assert.equal(item.status, 'addressed');
  assert.deepEqual(item.pin, { kind: 'doc', path: 'DESIGN.md', anchor: 'combat', label: 'Combat' });
  assert.equal(item.resolved, true);
  assert.match(item.body, /\n## Resolution\n[\s\S]*\b[0-9a-f]{7}\b/);
});
