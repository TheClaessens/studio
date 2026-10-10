// Markdown rendering shared by the Docs, Playtests and Feedback Surfaces, on TanStack Markdown.
// Anchors come from the server's own `blockAnchors` (server/slug.ts), which parses with the same options, so every
// anchor the page offers is one a Pin resolves to: they are keyed by top-level block index, for headings and, with
// `items`, for numbered list items and numbered table rows (`<heading>/<n>`).
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { parseMarkdown, type BlockNode, type InlineNode, type ListNode, type TableNode } from '@tanstack/markdown';
import { renderBlockReact, renderInlineReact, type MarkdownReactOptions } from '@tanstack/markdown/react';
import { blockAnchors, parseBase } from '../server/slug.ts';
import { PinGlyph, Portrait } from './design/atoms.tsx';
import { blockComponents, readFrontmatter, studioBlocks, type Meta } from './blocks.tsx';
import { lookOf, personaName, personaOf } from './design/personas.ts';

/** Parse and render options for one file: its frontmatter `kind` adds the Studio blocks. */
function optionsFor(meta: Meta, persona?: string): MarkdownReactOptions {
  const blocks = studioBlocks(meta, persona);
  return { ...parseBase, extensions: [...parseBase.extensions!, ...(blocks ? [blocks] : [])], components: blockComponents };
}

type Href = (anchor: string) => string;
/** A top-level heading with an anchor, for the file's outline. */
export type OutlineEntry = { id: string; text: string; depth: number };

/** Renders `text`; `href(anchor)` makes each heading a link to itself, and `anchor` is scrolled into view.
 *  `counts[anchor]` marks headings and findings that already carry live Feedback; `onOutline` receives the headings. */
export function Markdown({ text, anchor, href, items, counts, onOutline, persona }: { text: string; anchor?: string; href: Href; items?: boolean; counts?: Record<string, number>; onOutline?: (o: OutlineEntry[]) => void; persona?: string }) {
  const parsed = useMemo(() => parse(text, !!items, persona), [text, items, persona]);
  const body = render(parsed, href, counts ?? {});
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (anchor) ref.current?.querySelector(`#${CSS.escape(anchor)}`)?.scrollIntoView();
  }, [text, anchor]);
  useEffect(() => onOutline?.(parsed.outline), [parsed]);
  return <article ref={ref} className="markdown">{body}</article>;
}

const plainText = (nodes: InlineNode[]): string =>
  nodes.map((n) => ('value' in n && n.type !== 'inlineHtml' ? n.value : 'children' in n ? plainText(n.children) : n.type === 'image' ? n.alt : '')).join('');

/** How many live Feedback items an anchor carries. */
const Count = ({ n }: { n?: number }) => (n ? <span className="pin-count" title={`${n} live Feedback`}><PinGlyph size={11} />{n}</span> : null);

function parse(text: string, items: boolean, persona?: string) {
  const meta = readFrontmatter(text);
  const options = optionsFor(meta, persona);
  // `studioBlocks` maps `doc.children` 1:1, so a block's index here is its index in the server's parse.
  const doc = parseMarkdown(text, options);
  const { heading, items: found } = blockAnchors(text, items);
  const outline: OutlineEntry[] = [];
  doc.children.forEach((block, i) => {
    const id = heading.get(i);
    if (block.type === 'heading' && id) outline.push({ id, text: plainText(block.children), depth: block.depth });
  });
  return { doc, heading, found, outline, options, meta, persona: meta.persona ?? persona };
}

function render({ doc, heading, found, options, meta, persona }: ReturnType<typeof parse>, href: Href, counts: Record<string, number>): ReactNode[] {
  let titled = false;
  const link = (id: string) => <><a className="anchor" href={href(id)} aria-label={`Finding ${id.slice(id.lastIndexOf('/') + 1)}`}>#</a><Count n={counts[id]} /></>;

  return doc.children.map((block, i) => {
    const key = `b${i}`;
    if (block.type === 'heading') {
      const id = heading.get(i);
      const Tag = `h${block.depth}` as const;
      const inner = block.children.map((c, j) => renderInlineReact(c, options, `${j}`));
      const head = id ? <Tag key={key} id={id}><a className="anchor" href={href(id)}>{inner}</a><Count n={counts[id]} /></Tag> : <Tag key={key}>{inner}</Tag>;
      // A persona report opens with its author: portrait (or sigil) beside the title.
      // A human session is always the human mark, whatever its file is called (D5).
      const human = meta.kind === 'human-session';
      if (!titled && block.depth === 1 && (human || (persona && meta.kind === 'persona-report'))) {
        titled = true;
        return <PersonaHead key={key} id={human ? 'human' : persona!} human={human} tester={meta.tester} round={meta.round}>{head}</PersonaHead>;
      }
      return head;
    }
    const ids = found.get(i);
    if (ids && block.type === 'list') return <FindingList key={key} list={block} ids={ids} link={link} options={options} />;
    if (ids && block.type === 'table') return <FindingTable key={key} table={block} ids={ids} link={link} options={options} />;
    return block.type === 'table' ? <div key={key} className="table-scroll">{renderBlockReact(block, options)}</div> : renderBlockReact(block, options, key);
  });
}

/** A persona report's author from PERSONAS.md: portrait, archetype, quote in their voice, and how they set out to play. */
function PersonaHead({ id, human, tester, round, children }: { id: string; human: boolean; tester?: string; round?: string; children: ReactNode }) {
  const look = lookOf(id);
  const p = human ? undefined : personaOf(id);
  const name = human ? tester || 'Human tester' : personaName(id);
  return (
    <header className="persona-head">
      <Portrait look={look} size={128} label={name} />
      <div>
        <span className="kicker" style={{ color: look.ink ?? look.color }}>
          {human ? `Human session${tester ? ` · ${tester}` : ''}` : ['Persona report', p?.archetype].filter(Boolean).join(' · ')}{round && ` · Round ${round}`}
        </span>
        {children}
        {p?.quote && <p className={`voice voice--${look.voice ?? 'soft'} persona-head__quote`} style={{ color: look.ink }}>“{p.quote.replace(/^[“"]|[”"]$/g, '')}”</p>}
        {p && p.plan.length > 0 && (
          <details className="persona-head__plan">
            <summary>Play plan{p.hands && ` · ${p.hands} hands`}{p.save && ` · ${p.save} save`}</summary>
            <ul>{p.plan.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </details>
        )}
      </div>
    </header>
  );
}

type Finding = { ids: (string | undefined)[]; link: (id: string) => ReactNode; options: MarkdownReactOptions };

/** A top-level numbered list: each item is a finding (`<heading>/<n>`). */
function FindingList({ list, ids, link, options }: { list: ListNode } & Finding) {
  return (
    <ol start={list.start !== undefined && list.start !== 1 ? list.start : undefined}>
      {list.items.map((item, i) => {
        const anchor = ids[i];
        return (
          <li key={i} id={anchor}>
            {anchor && link(anchor)}
            {anchor && ' '}
            {item.children.map((child, j) => listChild(child, j, !!list.loose, options))}
          </li>
        );
      })}
    </ol>
  );
}

const listChild = (child: BlockNode, j: number, loose: boolean, options: MarkdownReactOptions) =>
  child.type === 'paragraph' && !loose ? child.children.map((c, k) => renderInlineReact(c, options, `${j}:${k}`)) : renderBlockReact(child, options, `${j}`);

/** A table: rows whose first cell is a number are findings. */
function FindingTable({ table, ids, link, options }: { table: TableNode } & Finding) {
  const cells = (row: TableNode['header'], Cell: 'th' | 'td', anchor?: string) =>
    row.map((cell, i) => (
      <Cell key={i} style={table.align[i] ? { textAlign: table.align[i] } : undefined}>
        {i === 0 && anchor && <>{link(anchor)} </>}
        {cell.children.map((c, j) => renderInlineReact(c, options, `${j}`))}
      </Cell>
    ));
  return (
    <div className="table-scroll"><table>
      <thead><tr>{cells(table.header, 'th')}</tr></thead>
      {table.rows.length > 0 && (
        <tbody>
          {table.rows.map((row, r) => <tr key={r} id={ids[r]}>{cells(row, 'td', ids[r])}</tr>)}
        </tbody>
      )}
    </table></div>
  );
}
