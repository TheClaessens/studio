// Writes models/cube.glb: a unit cube with two clips, "spin" (2s, rotation) and "bob" (1s, translation).
// Run: node test/fixtures/gltf/make-glb.ts
import { writeFileSync } from 'node:fs';

const f32 = (a: number[]) => Buffer.from(new Float32Array(a).buffer);
const u16 = (a: number[]) => Buffer.from(new Uint16Array(a).buffer);

// 24 vertices (4 per face, so each face gets its own normal), 36 indices.
const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
for (const [ax, s] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]]) {
  const [u, v] = [(ax + 1) % 3, (ax + 2) % 3];
  const base = pos.length / 3;
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = [0, 0, 0];
    p[ax] = 0.5 * s; p[u] = 0.5 * a * s; p[v] = 0.5 * b;
    const n = [0, 0, 0];
    n[ax] = s;
    pos.push(...p); nrm.push(...n);
  }
  idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
const q = (deg: number) => [0, Math.sin((deg * Math.PI) / 360), 0, Math.cos((deg * Math.PI) / 360)];
const spinT = [0, 0.5, 1, 1.5, 2], spinR = [0, 90, 180, 270, 360].flatMap(q);
const bobT = [0, 0.5, 1], bobP = [0, 0, 0, 0, 0.5, 0, 0, 0, 0];

const chunks = [f32(pos), f32(nrm), u16(idx), f32(spinT), f32(spinR), f32(bobT), f32(bobP)];
const views: { buffer: 0; byteOffset: number; byteLength: number }[] = [];
let offset = 0;
for (const c of chunks) {
  views.push({ buffer: 0, byteOffset: offset, byteLength: c.length });
  offset += Math.ceil(c.length / 4) * 4;
}
const bin = Buffer.concat(chunks.map((c) => Buffer.concat([c, Buffer.alloc(Math.ceil(c.length / 4) * 4 - c.length)])));

const FLOAT = 5126, USHORT = 5123;
const gltf = {
  asset: { version: '2.0', generator: 'studio make-glb.ts' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Cube', mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.85, 0.4, 0.2, 1], roughnessFactor: 0.6 } }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: views,
  accessors: [
    { bufferView: 0, componentType: FLOAT, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: FLOAT, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: USHORT, count: 36, type: 'SCALAR' },
    { bufferView: 3, componentType: FLOAT, count: 5, type: 'SCALAR', min: [0], max: [2] },
    { bufferView: 4, componentType: FLOAT, count: 5, type: 'VEC4' },
    { bufferView: 5, componentType: FLOAT, count: 3, type: 'SCALAR', min: [0], max: [1] },
    { bufferView: 6, componentType: FLOAT, count: 3, type: 'VEC3' },
  ],
  animations: [
    { name: 'spin', samplers: [{ input: 3, output: 4 }], channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }] },
    { name: 'bob', samplers: [{ input: 5, output: 6 }], channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] },
  ],
};

let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // "glTF"
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const chunk = (type: number, data: Buffer) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(data.length, 0);
  h.writeUInt32LE(type, 4);
  return Buffer.concat([h, data]);
};
writeFileSync(new URL('./models/cube.glb', import.meta.url), Buffer.concat([header, chunk(0x4e4f534a, json), chunk(0x004e4942, bin)]));
