// Markdown rendering shared by the Docs, Playtests and Feedback Surfaces, on TanStack Markdown.
// Anchors come from the server's own `headingAnchors` (server/slug.ts), so every anchor the page offers is one a Pin
// resolves to: top-level headings take the server's heading anchors in order, and with `items`, top-level numbered
// list items and numbered table rows take its `<heading>/<n>` finding anchors.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { parseMarkdown, type BlockNode, type InlineNode, type ListNode, type MarkdownExtension, type ParseOptions, type TableNode } from '@tanstack/markdown';
import { renderBlockReact, renderInlineReact, type MarkdownReactOptions } from '@tanstack/markdown/react';
import { calloutsExtension } from '@tanstack/markdown/extensions/callouts';
import { headingAnchors } from '../server/slug.ts';
import { PinGlyph, Portrait } from './design/atoms.tsx';
import { blockComponents, readFrontmatter, studioBlocks, type Meta } from './blocks.tsx';
import { lookOf, personaName } from './design/personas.ts';

/** Setext headings (`Title` over `===` or `---`), which TanStack Markdown leaves out. Same rule as the server's:
 *  one text line, not a list item or quote, directly above the underline. */
const setext: MarkdownExtension = {
  name: 'studio-setext',
  parseBlock({ lines, index, parseInline, consume }) {
    const line = lines[index];
    const under = lines[index + 1]?.match(/^ {0,3}(=+|-+)\s*$/);
    if (!under || !line.trim() || /^ {0,3}([-*+>#]|\d+[.)]\s|`{3,}|~{3,}|\|)/.test(line)) return undefined;
    consume(2);
    return { type: 'heading', depth: under[1][0] === '=' ? 1 : 2, children: parseInline(line.trim()) };
  },
};

/** Indented code blocks (four spaces after a blank line), which TanStack Markdown leaves out. */
const indentedCode: MarkdownExtension = {
  name: 'studio-indented-code',
  parseBlock({ lines, index, consume }) {
    const indented = (l: string) => /^( {4}|\t)/.test(l);
    if (!indented(lines[index]) || (index > 0 && lines[index - 1].trim())) return undefined;
    let end = index;
    while (end < lines.length && (indented(lines[end]) || !lines[end].trim())) end++;
    while (end > index && !lines[end - 1].trim()) end--;
    consume(end - index);
    return { type: 'code', value: lines.slice(index, end).map((l) => l.replace(/^( {4}|\t)/, '')).join('\n') };
  },
};

// ponytail: the Game Project's own files may hold raw HTML; it is rendered as-is, as the Studio did with marked.
const base: ParseOptions = { allowHtml: true, headingIds: false };
const callouts = calloutsExtension();

/** Parse and render options for one file: its frontmatter `kind` adds the Studio blocks. */
function optionsFor(meta: Meta, persona?: string): MarkdownReactOptions {
  const blocks = studioBlocks(meta, persona);
  return { ...base, extensions: [setext, indentedCode, callouts, ...(blocks ? [blocks] : [])], components: blockComponents };
}

type Href = (anchor: string) => string;
/** A top-level heading with an anchor, for the file's outline. */
export type OutlineEntry = { id: string; text: string; depth: number };

/** Renders `text`; `href(anchor)` makes each heading a link to itself, and `anchor` is scrolled into view.
 *  `counts[anchor]` marks headings and findings that already carry live Feedback; `onOutline` receives the headings. */
export function Markdown({ text, anchor, href, items, counts, onOutline, persona }: { text: string; anchor?: string; href: Href; items?: boolean; counts?: Record<string, number>; onOutline?: (o: OutlineEntry[]) => void; persona?: string }) {
  const parsed = useMemo(() => parse(text, !!items, persona), [text, items, persona]);
  const body = render(parsed, href, !!items, counts ?? {});
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
const Count = ({ n }: { n?: number }) => (n ? <span className="pin-count" title={`${n} open Feedback`}><PinGlyph size={11} />{n}</span> : null);

function parse(text: string, items: boolean, persona?: string) {
  const meta = readFrontmatter(text);
  const options = optionsFor(meta, persona);
  const doc = parseMarkdown(text, options);
  const anchors = headingAnchors(text, items);
  const headings = anchors.filter((a) => !a.includes('/')); // a slug never holds `/`
  const findings = new Set(anchors.filter((a) => a.includes('/')));
  const outline: OutlineEntry[] = [];
  let h = 0;
  for (const block of doc.children)
    if (block.type === 'heading' && headings[h]) outline.push({ id: headings[h++], text: plainText(block.children), depth: block.depth });
  return { doc, headings, findings, outline, options, meta, persona: meta.persona ?? persona };
}

function render({ doc, headings, findings, options, meta, persona }: ReturnType<typeof parse>, href: Href, items: boolean, counts: Record<string, number>): ReactNode[] {
  let h = 0;
  let titled = false;
  let section = '';
  let n = 0;
  const finding = () => {
    const id = section ? `${section}/${++n}` : undefined;
    return id && findings.has(id) ? id : undefined;
  };
  const link = (id: string) => <><a className="anchor" href={href(id)}>#</a><Count n={counts[id]} /></>;

  return doc.children.map((block, i) => {
    const key = `b${i}`;
    if (block.type === 'heading') {
      const id = headings[h++];
      section = id ?? '';
      n = 0;
      const Tag = `h${block.depth}` as const;
      const inner = block.children.map((c, j) => renderInlineReact(c, options, `${j}`));
      const heading = id ? <Tag key={key} id={id}><a className="anchor" href={href(id)}>{inner}</a><Count n={counts[id]} /></Tag> : <Tag key={key}>{inner}</Tag>;
      // A persona report opens with its author: portrait (or sigil) beside the title.
      if (!titled && block.depth === 1 && persona && (meta.kind === 'persona-report' || meta.kind === 'human-session')) {
        titled = true;
        return (
          <header key={key} className="persona-head">
            <Portrait look={lookOf(persona)} size={128} label={personaName(persona)} />
            <div>
              <span className="kicker" style={{ color: lookOf(persona).ink ?? lookOf(persona).color }}>{meta.kind === 'human-session' ? 'Human session' : 'Persona report'}{meta.round && ` · Round ${meta.round}`}</span>
              {heading}
            </div>
          </header>
        );
      }
      return heading;
    }
    // Anchors are taken here, in document order: the components render later, after `section` has moved on.
    if (items && block.type === 'list' && block.ordered) return <FindingList key={key} list={block} ids={block.items.map(finding)} link={link} options={options} />;
    if (items && block.type === 'table')
      return <FindingTable key={key} table={block} ids={block.rows.map((row) => (/^\d+$/.test(cellText(row[0])) ? finding() : undefined))} link={link} options={options} />;
    return renderBlockReact(block, options, key);
  });
}

type Finding = { ids: (string | undefined)[]; link: (id: string) => ReactNode; options: MarkdownReactOptions };

const cellText = (cell: TableNode['header'][number] | undefined) => cell?.children.map((c) => (c.type === 'text' ? c.value : '')).join('').trim() ?? '';

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
    <table>
      <thead><tr>{cells(table.header, 'th')}</tr></thead>
      {table.rows.length > 0 && (
        <tbody>
          {table.rows.map((row, r) => <tr key={r} id={ids[r]}>{cells(row, 'td', ids[r])}</tr>)}
        </tbody>
      )}
    </table>
  );
}
