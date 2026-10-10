// Heading anchors, shared by the UI's markdown rendering and the server's doc Pin resolution. One parser serves both
// sides (TanStack Markdown plus the Studio extensions below), so the anchors the page offers are the ones a Pin resolves to.
import { parseMarkdown, type InlineNode, type MarkdownExtension, type ParseOptions } from '@tanstack/markdown';
import { calloutsExtension } from '@tanstack/markdown/extensions/callouts';

/** GitHub-style heading slug: lowercase, punctuation dropped, spaces to dashes. */
export const slug = (text: string) =>
  text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

/** Dedupes slugs the way the renderer does: `notes`, `notes-1`, `notes-2`. */
export function anchorer() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = slug(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

/** Setext headings (`Title` over `===` or `---`), which TanStack Markdown leaves out: one text line, not a list
 *  item or quote, directly above the underline, where a block starts. */
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

/** The parse options both sides use. The UI adds its own extensions after these. */
// ponytail: the Game Project's own files may hold raw HTML; it is rendered as-is, as the Studio did with marked.
export const parseBase: ParseOptions = { allowHtml: true, headingIds: false, extensions: [setext, indentedCode, calloutsExtension()] };

const plain = (nodes: InlineNode[]): string =>
  nodes.map((n) => (n.type === 'inlineHtml' ? '' : n.type === 'image' ? n.alt : 'value' in n ? n.value : 'children' in n ? plain(n.children) : '')).join('');

/** Anchors by top-level block index: `heading` for each heading, `items` for the findings of a numbered list or
 *  table (`undefined` for a table row that is no finding). `anchors` is all of them in document order. */
export function blockAnchors(markdown: string, items = false) {
  const anchor = anchorer();
  const anchors: string[] = [];
  const heading = new Map<number, string>();
  const found = new Map<number, (string | undefined)[]>();
  let section = '';
  let n = 0;
  const finding = (isFinding = true) => (isFinding && section ? `${section}/${++n}` : undefined);
  parseMarkdown(markdown, parseBase).children.forEach((block, i) => {
    let ids: (string | undefined)[] | undefined;
    if (block.type === 'heading') {
      section = anchor(plain(block.children));
      if (section) heading.set(i, section); // a heading with no letters (`## 🎮`) has no anchor
      n = 0;
    } else if (items && block.type === 'list' && block.ordered) ids = block.items.map(() => finding());
    else if (items && block.type === 'table') ids = block.rows.map((row) => finding(/^\d+$/.test(plain(row[0]?.children ?? []).trim())));
    if (ids) found.set(i, ids);
    anchors.push(...(block.type === 'heading' ? [section] : (ids ?? [])).filter((id): id is string => !!id));
  });
  return { anchors, heading, items: found };
}

/** Every heading anchor in a markdown text, in order. With `items`, also `<heading>/<n>` for the n-th top-level
 *  numbered list item or numbered table row (`| 2 | … |`) under each heading: the playtest finding anchors. */
export const headingAnchors = (markdown: string, items = false) => blockAnchors(markdown, items).anchors;
