// Cross-references the skills write into docs and playtest reports: explicit links between files (K2) and shot
// references, `(shot: `x.png` · caption: "…" · at: 0.42,0.55)` (K4). One walk over every markdown file the Docs and
// Playtests Surfaces list, each place keyed by the anchor a Pin would use (the heading, or the finding).
//
//   GET /__studio/refs   { places, links: [{ from, to, href, text }], shots: { <media path>: { takenBy?, usedIn: [Use] } } }
//                        `places`: every file (its title), heading and finding, for the ⌘K palette.
//                        `from` / `to` are { surface, path, anchor?, label }; a link counts only when it lands on a
//                        doc or playtest file, a shot only when it resolves to a Media file.
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseMarkdown, type BlockNode, type InlineNode } from '@tanstack/markdown';
import { blockAnchors, parseBase } from './slug.ts';
import { globFiles } from './globs.ts';
import { playtestFiles } from './playtests.ts';
import { json } from './static.ts';
import type { Studio } from './app.ts';

type Surface = 'Docs' | 'Playtests';
export type Place = { surface: Surface; path: string; anchor?: string; label: string };
export type Use = Place & { ref: string; caption?: string; at?: [number, number] };

const text = (nodes: InlineNode[]): string => nodes.map((n) => ('value' in n && n.type !== 'inlineHtml' ? n.value : 'children' in n ? text(n.children) : '')).join('');
/** Inline text with code spans kept in backticks, so a shot reference reads as it was written. */
const source = (nodes: InlineNode[]): string => nodes.map((n) => (n.type === 'inlineCode' ? `\`${n.value}\`` : 'value' in n && n.type !== 'inlineHtml' ? n.value : 'children' in n ? source(n.children) : '')).join('');
const inlines = (b: BlockNode): InlineNode[] =>
  b.type === 'paragraph' || b.type === 'heading' ? b.children :
  b.type === 'list' ? b.items.flatMap((i) => i.children.flatMap(inlines)) :
  b.type === 'blockquote' || b.type === 'callout' ? b.children.flatMap(inlines) :
  b.type === 'table' ? [...b.header, ...b.rows.flat()].flatMap((c) => [...c.children, { type: 'text', value: ' ' }]) : [];
const links = (nodes: InlineNode[]): { href: string; text: string }[] =>
  nodes.flatMap((n) => (n.type === 'link' ? [{ href: n.href, text: text(n.children) }] : 'children' in n ? links(n.children) : []));
/** A finding's title: its bold lead, else its first words. */
const title = (nodes: InlineNode[]) => (nodes.find((n) => n.type === 'strong') ? text([nodes.find((n) => n.type === 'strong')!]) : text(nodes)).trim().slice(0, 120);

/** Every place in a file with the inline content under it: a finding (numbered item or row) or a heading's section. */
function places(markdown: string, items: boolean) {
  const { heading, items: found } = blockAnchors(markdown, items);
  const out: { anchor?: string; label: string; nodes: InlineNode[] }[] = [];
  let section: { anchor?: string; label: string } = { label: '' };
  parseMarkdown(markdown, parseBase).children.forEach((b, i) => {
    if (b.type === 'heading') section = { anchor: heading.get(i), label: text(b.children).trim() };
    const ids = found.get(i);
    if (ids && b.type === 'list') b.items.forEach((item, j) => {
      const nodes = item.children.flatMap(inlines);
      out.push(ids[j] ? { anchor: ids[j], label: title(nodes), nodes } : { ...section, nodes });
    });
    else if (ids && b.type === 'table') b.rows.forEach((row, j) => {
      const nodes = row.flatMap((c) => [...c.children, { type: 'text', value: ' ' } as InlineNode]);
      out.push(ids[j] ? { anchor: ids[j], label: title(row[1]?.children ?? nodes), nodes } : { ...section, nodes });
    });
    else out.push({ ...section, nodes: inlines(b) });
  });
  return out;
}

const shotRef = /\(shots?:\s*([^)]*)\)/gi;
const media = /\.(png|jpe?g|gif|webp|avif|mp4|webm|mov|m4v)$/i;
const base = (p: string) => p.slice(p.lastIndexOf('/') + 1);
/** A report's persona: frontmatter `persona`, else `NN-<id>.md`; a human session is `human`. */
const author = (path: string, markdown: string) => {
  const meta = markdown.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  if (/^kind:\s*human-session\s*$/m.test(meta)) return 'human';
  return meta.match(/^persona:\s*(\S+)\s*$/m)?.[1].toLowerCase() ?? base(path).match(/^\d+-([\w.-]+)\.md$/)?.[1].toLowerCase();
};

export function refs(studio: Studio) {
  const { root, manifest } = studio;
  const surfaceOf = new Map<string, Surface>([
    ...globFiles(root, manifest.docs).filter((p) => p.endsWith('.md')).map((p) => [p, 'Docs'] as const),
    ...playtestFiles(studio).filter((p) => p.endsWith('.md')).map((p) => [p, 'Playtests'] as const),
  ]);
  const mediaFiles = globFiles(root, manifest.media);
  // A shot named by its Game Project path, by its path from the report, or by its file name alone when that is unique.
  const resolveShot = (ref: string, from: string) => {
    const relative = posix.join(posix.dirname(from), ref);
    if (mediaFiles.includes(ref)) return ref;
    if (mediaFiles.includes(relative)) return relative;
    const named = mediaFiles.filter((m) => base(m) === base(ref));
    return named.length === 1 ? named[0] : named.find((m) => m.endsWith(`/${ref}`));
  };

  const out = { places: [] as Place[], links: [] as { from: Place; to: Place; href: string; text: string }[], shots: {} as Record<string, { takenBy?: string; usedIn: Use[] }> };
  const anchorLabels = new Map<string, Map<string, string>>(); // path → anchor → label, for link targets
  const walked = [...surfaceOf].map(([path, surface]) => {
    const markdown = readFileSync(join(root, path), 'utf8'); // guardrail: contained (path is one of globFiles / playtestFiles)
    const list = places(markdown, surface === 'Playtests');
    const labels = new Map(list.filter((p) => p.anchor).map((p) => [p.anchor!, p.label]));
    anchorLabels.set(path, labels);
    const h1 = markdown.match(/^# +(.+?)\s*#*\s*$/m)?.[1];
    out.places.push({ surface, path, label: h1 ?? base(path) }, ...[...labels].map(([anchor, label]) => ({ surface, path, anchor, label })));
    return { path, surface, markdown, list };
  });
  for (const { path, surface, markdown, list } of walked) {
    const who = surface === 'Playtests' ? author(path, markdown) : undefined;
    for (const place of list) {
      const from: Place = { surface, path, anchor: place.anchor, label: place.label };
      for (const link of links(place.nodes)) {
        if (/^([a-z][\w+.-]*:|\/|#)/i.test(link.href)) continue; // only relative links between the Game Project's files
        const url = new URL(link.href, `http://x/${path}`);
        const target = decodeURIComponent(url.pathname.slice(1));
        const to = surfaceOf.get(target);
        if (!to) continue;
        const anchor = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined;
        out.links.push({ from, to: { surface: to, path: target, anchor, label: (anchor && anchorLabels.get(target)?.get(anchor)) || base(target) }, href: link.href, text: link.text });
      }
      for (const [, inside] of source(place.nodes).matchAll(shotRef)) {
        const caption = inside.match(/caption:\s*"([^"]*)"/)?.[1];
        const at = inside.match(/at:\s*([\d.]+)\s*,\s*([\d.]+)/);
        for (const [, ref] of inside.matchAll(/`([^`]+)`/g)) {
          // A name without an extension (`ilse-r4-p1-d1`) is a screenshot, as `PT.shot` names them.
          const file = media.test(ref) ? resolveShot(ref, path) : /^[\w./-]+$/.test(ref) ? resolveShot(`${ref}.png`, path) : undefined;
          if (!file) continue;
          const shot = (out.shots[file] ??= { usedIn: [] });
          if (who) shot.takenBy ??= who;
          shot.usedIn.push({ ...from, ref, ...(caption && { caption }), ...(at && { at: [Number(at[1]), Number(at[2])] as [number, number] }) });
        }
      }
    }
  }
  return out;
}

// ponytail: every request re-reads and re-parses every doc and report; fine for a local Studio's few hundred files.
export const refsRoute = (_req: IncomingMessage, res: ServerResponse, _rest: string, studio: Studio) => json(res, refs(studio));
