import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startStudio, tempProject, fixture } from './harness.ts';

async function get(dir: string, path: string) {
  const studio = await startStudio(dir);
  try {
    const res = await fetch(`${studio.url}${path}`);
    const type = res.headers.get('content-type') ?? '';
    return { status: res.status, type, body: type.startsWith('application/json') ? await res.json() : await res.text() };
  } finally {
    studio.stop();
  }
}

test('with view "gltf", each entry\'s animation clips become its anchors, ranged over the clip duration', async () => {
  const { status, body } = await get(fixture('gltf'), '/__studio/catalogue');
  assert.equal(status, 200);
  assert.deepEqual(body, [
    {
      id: 'cube',
      name: 'Cube',
      group: 'props',
      file: 'models/cube.glb',
      anchors: [
        { name: 'spin', range: [0, 2] },
        { name: 'bob', range: [0, 1] },
      ],
    },
  ]);
});

test('the Studio serves its glTF viewer page and the asset file it loads, same-origin', async () => {
  const studio = await startStudio(fixture('gltf'));
  try {
    const page = await fetch(`${studio.url}/__studio/gltf.html`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type')!, /text\/html/);
    const script = (await page.text()).match(/src="(\/__studio\/[^"]+\.js)"/)?.[1];
    assert.ok(script, 'viewer page loads a built script');
    assert.equal((await fetch(`${studio.url}${script}`)).status, 200);
    const glb = await fetch(`${studio.url}/models/cube.glb`);
    assert.equal(glb.headers.get('content-type'), 'model/gltf-binary');
  } finally {
    studio.stop();
  }
});

const gltfProject =(files: Record<string, unknown>) =>
  tempProject({ 'studio.json': { studio: '1.x', name: 'G', assets: { catalogue: 'catalogue.json', view: 'gltf' } }, ...files });

test('a .gltf (JSON) file works too, a clip spans its longest sampler, and an unnamed clip gets a name', async () => {
  const { status, body } = await get(
    gltfProject({
      'catalogue.json': [{ id: 'a', name: 'A', group: 'g', file: 'a.gltf' }],
      'a.gltf': {
        asset: { version: '2.0' },
        accessors: [
          { count: 2, type: 'SCALAR', componentType: 5126, min: [0], max: [0.75] },
          { count: 2, type: 'SCALAR', componentType: 5126, min: [0], max: [3] },
        ],
        animations: [{ samplers: [{ input: 0, output: 0 }, { input: 1, output: 1 }], channels: [] }],
      },
    }),
    '/__studio/catalogue',
  );
  assert.equal(status, 200);
  assert.deepEqual(body[0].anchors, [{ name: 'animation_0', range: [0, 3] }]);
});

test('with view "gltf", an entry without a file fails loudly, naming the entry and the field', async () => {
  const { status, body } = await get(gltfProject({ 'catalogue.json': [{ id: 'nofile', name: 'N', group: 'g', anchors: [] }] }), '/__studio/catalogue');
  assert.equal(status, 500);
  assert.match(body, /entry 0/);
  assert.match(body, /"nofile"/);
  assert.match(body, /"file"/);
});

test('an asset file outside the Game Project is refused', async () => {
  const { status, body } = await get(gltfProject({ 'catalogue.json': [{ id: 'x', name: 'X', group: 'g', file: '../x.glb' }] }), '/__studio/catalogue');
  assert.equal(status, 500);
  assert.match(body, /outside the Game Project/);
});
