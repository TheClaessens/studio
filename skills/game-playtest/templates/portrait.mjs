// Writes a persona's 32 × 32 pixel-art portrait as a PNG, with nothing but Node.
//   node portrait.mjs <portrait.json> <playtests root>/personas/<id>.png
// portrait.json: { "palette": { ".": "#f6e1e8", "a": "#b0446a", … }, "rows": [32 strings of 32 palette keys] }
// The first palette entry is the flat tint ground. Draw it once when the persona joins the panel; never redraw it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('usage: node portrait.mjs <portrait.json> <out.png>');
const { palette, rows } = JSON.parse(readFileSync(input, 'utf8'));
const size = 32;
if (rows.length !== size || rows.some((r) => [...r].length !== size)) throw new Error(`rows must be ${size} strings of ${size} keys`);

const rgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const colours = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, rgb(v)]));

// One filter byte (0) per scanline, then RGB.
const raw = Buffer.alloc(size * (1 + size * 3));
rows.forEach((row, y) =>
  [...row].forEach((key, x) => {
    const c = colours[key];
    if (!c) throw new Error(`row ${y}: "${key}" is not in the palette`);
    Buffer.from(c).copy(raw, y * (1 + size * 3) + 1 + x * 3);
  }),
);

// PNG's CRC-32, inline: zlib.crc32 needs Node 22, and this runs wherever the game's tooling does.
const crc32 = (buf) => {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(size, 0);
header.writeUInt32BE(size, 4);
header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
