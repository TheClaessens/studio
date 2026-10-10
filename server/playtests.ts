// The Playtests Surface: rounds under the manifest's `playtests` root. The playtest Kit and skill own the round
// layout (`round-N/` with `NN-<persona>.md` reports, `REPORT.md`, `ROUND.md`); files outside a round (`BRIEF.md`,
// `PERSONAS.md`, portraits) are listed loose. Markdown files render; everything else is shown raw.
//
//   GET /__studio/playtests          { rounds: [{ name, files }] latest first, files: [...] outside any round }
//   GET /__studio/playtests/<path>   one listed file; `path` is relative to the Game Project, like a Pin's
import type { IncomingMessage, ServerResponse } from 'node:http';
import { posix } from 'node:path';
import { globFiles } from './globs.ts';
import { json, send, serveFile } from './static.ts';
import type { Studio } from './app.ts';

export type PlaytestFile = { path: string; markdown: boolean };

const roundDir = /^round-(\d+)$/;
const markdown = (path: string) => /\.md$/i.test(path);

/** Every file under the playtests root, Game Project–relative. An `out` folder inside it (the Kit's screenshots) is
 *  Media, not playtest files. */
export function playtestFiles({ root, manifest }: Studio) {
  if (!manifest.playtests) return [];
  const outs = Object.values(manifest.out ?? {}).map((o) => posix.normalize(o).replace(/\/?$/, '/'));
  return globFiles(root, manifest.playtests).filter((p) => !outs.some((o) => p.startsWith(o)));
}

function rounds(studio: Studio) {
  const base = posix.normalize(studio.manifest.playtests ?? '.');
  const byRound = new Map<string, PlaytestFile[]>();
  const loose: PlaytestFile[] = [];
  for (const path of playtestFiles(studio)) {
    const parts = posix.relative(base, path).split('/');
    // A round is a `round-N` folder anywhere under the root (`round-3/` or the skill's default `rounds/round-3/`).
    const i = parts.findIndex((part, j) => j < parts.length - 1 && roundDir.test(part));
    if (i < 0) {
      loose.push({ path, markdown: markdown(path) });
      continue;
    }
    byRound.set(parts[i], [...(byRound.get(parts[i]) ?? []), { path, markdown: markdown(path) }]);
  }
  const n = (name: string) => Number(name.match(roundDir)![1]);
  return {
    rounds: [...byRound].sort(([a], [b]) => n(b) - n(a)).map(([name, files]) => ({ name, files })),
    files: loose,
  };
}

export function playtestsRoute(_req: IncomingMessage, res: ServerResponse, rest: string, studio: Studio) {
  if (!rest || rest === '/') return json(res, rounds(studio));
  if (!playtestFiles(studio).includes(rest.slice(1))) return send(res, 404, 'Not found');
  serveFile(res, studio.root, rest);
}
