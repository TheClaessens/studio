// Kit outputs: `PUT /__studio/out/<kind>/<file>` saves into the manifest's `out[kind]` folder, GET reads it back.
// Replaces the kit servers' `/__playtest/out/` and `/__promo/out/`. Flat files only, as before.
import { createWriteStream, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { inside, serveFile, send } from './static.ts';
import type { Studio } from './app.ts';

export async function out(req: IncomingMessage, res: ServerResponse, rest: string, { root, manifest }: Studio) {
  const [kind, file, ...more] = rest.split('/');
  const folder = manifest.out && Object.hasOwn(manifest.out, kind) ? resolve(root, manifest.out[kind]) : undefined;
  if (!folder) return send(res, 403, `Unknown output kind "${kind}". Declare it in studio.json "out".`);
  if (!inside(root, folder)) return send(res, 403, `out.${kind} is outside the Game Project`);
  if (more.length || !/^[\w.-]+$/.test(file ?? '') || file === '.' || file === '..') return send(res, 403, 'Bad output file name');

  if (req.method === 'GET' || req.method === 'HEAD') return serveFile(res, folder, file);
  if (req.method !== 'PUT') return send(res, 405, 'Use PUT or GET');
  mkdirSync(folder, { recursive: true });
  await pipeline(req, createWriteStream(join(folder, file)));
  send(res, 201, 'Created');
}
