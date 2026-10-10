// The playtest panel: `PERSONAS.md` at the playtests root, as the game-playtest skill writes it. Each persona's
// section opens with a `persona` fence of flat `key: value` lines (id, colour, sigil, portrait, look, archetype,
// quote, hands, save, model), followed by its **Play plan** and **Questions** lists.
//
//   GET /__studio/personas   [{ id, color?, mid?, tint?, ink?, sigil?, voice?, portrait?, …, plan, questions }]
//                            `portrait` is a Game Project path, served under /__studio/playtests/ when it exists.
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseMarkdown, type BlockNode, type InlineNode } from '@tanstack/markdown';
import { parseBase } from './slug.ts';
import { playtestFiles } from './playtests.ts';
import { json } from './static.ts';
import type { Studio } from './app.ts';

export type Persona = { id: string; plan: string[]; questions: string[]; [field: string]: string | string[] };

const fields = ['id', 'color', 'mid', 'tint', 'ink', 'sigil', 'voice', 'portrait', 'look', 'archetype', 'quote', 'hands', 'save', 'model'];
const colour = /^#[0-9a-f]{3,8}$/i;

const text = (nodes: InlineNode[]): string => nodes.map((n) => ('value' in n && n.type !== 'inlineHtml' ? n.value : 'children' in n ? text(n.children) : '')).join('');
const blockText = (b: BlockNode): string => (b.type === 'paragraph' || b.type === 'heading' ? text(b.children) : b.type === 'list' ? b.items.map((i) => i.children.map(blockText).join(' ')).join('; ') : '');

/** Personas in file order. A fence without an `id`, and colours that aren't hex, are left out. */
export function parsePersonas(markdown: string, dir: string, files: string[]): Persona[] {
  const out: Persona[] = [];
  let list: 'plan' | 'questions' | undefined;
  for (const b of parseMarkdown(markdown, parseBase).children) {
    if (b.type === 'code' && b.lang === 'persona') {
      const p: Record<string, string> = {};
      for (const line of b.value.split(/\r?\n/)) {
        const kv = line.match(/^([\w-]+):\s*(.*?)\s*$/);
        if (kv && fields.includes(kv[1]) && kv[2]) p[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
      }
      for (const c of ['color', 'mid', 'tint', 'ink']) if (p[c] && !colour.test(p[c])) delete p[c];
      if (p.portrait) {
        const path = posix.join(dir, p.portrait);
        if (files.includes(path)) p.portrait = path;
        else delete p.portrait;
      }
      if (p.id) out.push({ ...p, id: p.id.toLowerCase(), plan: [], questions: [] });
      list = undefined;
    } else if (b.type === 'heading') list = undefined;
    else if (b.type === 'paragraph') {
      const lead = text(b.children).trim().toLowerCase();
      list = /^play plan\b/.test(lead) ? 'plan' : /^questions\b/.test(lead) ? 'questions' : undefined;
    } else if (b.type === 'list' && list && out.length) out.at(-1)![list].push(...b.items.map((i) => i.children.map(blockText).join(' ').trim()));
  }
  return out;
}

export function personasRoute(_req: IncomingMessage, res: ServerResponse, _rest: string, studio: Studio) {
  const files = playtestFiles(studio);
  const dir = posix.normalize(studio.manifest.playtests ?? '.');
  const path = posix.join(dir, 'PERSONAS.md');
  if (!files.includes(path)) return json(res, []);
  json(res, parsePersonas(readFileSync(join(studio.root, path), 'utf8'), dir, files)); // guardrail: contained (path is one of playtestFiles)
}
