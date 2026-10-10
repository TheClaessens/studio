import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, tempProject } from './harness.ts';

const view = 'dev/viewer.html?set={group}&id={id}&pose={anchor}:{t}&play={play}';
const goblin = { id: 'goblinGrunt', name: 'Goblin Grunt', group: 'greenskins', anchors: [{ name: 'idle' }, { name: 'walk', range: [0, 1.6] }] };
const hero = { id: 'pyromancerHero', name: 'Pyromancer', group: 'heroes', set: '../heroes/pyromancer', anchors: [{ name: 'shot', range: [0, 1] }] };
const manifest = (catalogue: string) => ({ studio: '1.x', name: 'G', assets: { catalogue, view } });

async function getCatalogue(files: Record<string, unknown>) {
  const studio = await startStudio(tempProject(files));
  try {
    const res = await fetch(`${studio.url}/__studio/catalogue`);
    return { status: res.status, body: res.status === 200 ? await res.json() : await res.text() };
  } finally {
    studio.stop();
  }
}

test('a .json catalogue is served as the asset list', async () => {
  const { status, body } = await getCatalogue({
    'studio.json': manifest('dev/catalogue.json'),
    'dev/catalogue.json': [goblin, hero],
  });
  assert.equal(status, 200);
  assert.deepEqual(body, [goblin, hero]);
});

test('a .js catalogue module is imported at runtime and its async default export is the asset list', async () => {
  const { status, body } = await getCatalogue({
    'studio.json': manifest('dev/studio/catalogue.js'),
    'dev/studio/heroes.js': `export const heroes = [${JSON.stringify(hero)}];`,
    'dev/studio/catalogue.js': `
      import { heroes } from './heroes.js';
      export default async () => [${JSON.stringify(goblin)}, ...heroes];`,
  });
  assert.equal(status, 200);
  assert.deepEqual(body, [goblin, hero]);
});

test('a .js catalogue whose default export returns the list synchronously works too', async () => {
  const { status, body } = await getCatalogue({
    'studio.json': manifest('catalogue.js'),
    'catalogue.js': `export default () => [${JSON.stringify(goblin)}];`,
  });
  assert.equal(status, 200);
  assert.deepEqual(body, [goblin]);
});

test('a malformed catalogue entry fails loudly, naming the entry and the field', async () => {
  const { status, body } = await getCatalogue({
    'studio.json': manifest('catalogue.json'),
    'catalogue.json': [goblin, { id: 'broken', name: 'Broken', anchors: [] }],
  });
  assert.equal(status, 500);
  assert.match(body, /entry 1/);
  assert.match(body, /"broken"/);
  assert.match(body, /"group"/);
});

test('without an assets section there is no catalogue', async () => {
  const { status } = await getCatalogue({ 'studio.json': { studio: '1.x', name: 'G' } });
  assert.equal(status, 404);
});
