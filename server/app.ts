// The Studio's HTTP surface: the Studio's own routes under `/__studio/`, Game Project files at `/`.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { serveFile, send } from './static.ts';
import { schema } from './schema.ts';
import { out } from './out.ts';
import { loadCatalogue } from './catalogue.ts';
import { globFiles } from './globs.ts';
import { feedbackRoute } from './feedback.ts';
import { playtestsRoute } from './playtests.ts';
import type { Manifest } from './manifest.ts';

export type Studio = { root: string; manifest: Manifest };
/** `rest` is the decoded path after the route's prefix. */
type Handler = (req: IncomingMessage, res: ServerResponse, rest: string, studio: Studio) => void | Promise<void>;

const ui = fileURLToPath(new URL('../dist/ui', import.meta.url));
const kits = fileURLToPath(new URL('../kits', import.meta.url));
const examples = fileURLToPath(new URL('../examples', import.meta.url));
const json = (res: ServerResponse, body: unknown) => send(res, 200, JSON.stringify(body, null, 2), 'application/json; charset=utf-8');

const surfaceSections = { Assets: 'assets', Feedback: 'feedback', Play: 'play', Playtests: 'playtests', Media: 'media', Docs: 'docs' } as const;

/** A section's presence is its capability; an absent one is "not set up" and carries the schema's example. */
function surfaces(manifest: Manifest) {
  return Object.entries(surfaceSections).map(([name, section]) =>
    manifest[section] === undefined
      ? { name, section, setUp: false, example: schema.properties[section].examples[0] }
      : { name, section, setUp: true, config: manifest[section] },
  );
}

// First matching prefix wins. Later Surfaces add their routes here.
const routes: [prefix: string, handler: Handler][] = [
  ['/__studio/schema/studio.json', (_req, res) => json(res, schema)],
  ['/__studio/surfaces', (_req, res, _rest, { manifest }) => json(res, surfaces(manifest))],
  ['/__studio/kits/', (_req, res, rest) => serveFile(res, kits, rest)],
  ['/__studio/examples/', (_req, res, rest) => serveFile(res, examples, rest)],
  ['/__studio/out/', out],
  ['/__studio/catalogue', async (_req, res, _rest, { root, manifest }) =>
    manifest.assets ? json(res, await loadCatalogue(root, manifest.assets.catalogue, manifest.assets.view)) : send(res, 404, 'No assets section in studio.json')],
  ['/__studio/docs', (_req, res, rest, { root, manifest }) => {
    const docs = globFiles(root, manifest.docs);
    if (!rest) return json(res, docs);
    if (!docs.includes(rest.slice(1))) return send(res, 404, 'Not found');
    serveFile(res, root, rest);
  }],
  ['/__studio/feedback', feedbackRoute],
  ['/__studio/playtests', playtestsRoute],
  ['/__studio/', (_req, res, rest) => serveFile(res, ui, rest)],
  ['/', (_req, res, rest, { root }) => serveFile(res, root, rest)],
];

export function createStudioServer(studio: Studio) {
  return createServer(async (req, res) => {
    let path: string;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      return send(res, 400, 'Bad request');
    }
    if (path === '/__studio') path = '/__studio/';
    const [prefix, handler] = routes.find(([p]) => path === p || path.startsWith(p.endsWith('/') ? p : p + '/'))!;
    try {
      await handler(req, res, path.slice(prefix.length), studio);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, String(err));
    }
  });
}
