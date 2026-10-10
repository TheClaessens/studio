// Heading anchors, shared by the UI's markdown rendering and the server's doc Pin resolution.

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

/** Every heading anchor in a markdown text, in order. With `items`, also `<heading>/<n>` for the n-th numbered
 *  list item or numbered table row (`| 2 | … |`) under each heading: the playtest finding anchors. */
// ponytail: ATX and setext headings with inline markup stripped by regex, not a full markdown parse;
// exotic headings (HTML, nested emphasis edge cases) may slug differently from the rendered page.
// Items count only unindented `1.`/`1)` lines and table rows, so lists in blockquotes or nested lists are not findings.
export function headingAnchors(markdown: string, items = false) {
  const anchor = anchorer();
  const anchors: string[] = [];
  let fence = '';
  let prev = '';
  let section = '';
  let n = 0;
  for (const line of markdown.split(/\r?\n/)) {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    const atx = line.match(/^ {0,3}#{1,6}(?:\s+(.*?))?(?:\s+#+)?\s*$/);
    let heading: string | undefined;
    if (f && (!fence || f[0] === fence[0])) fence = fence ? '' : f;
    else if (fence) continue;
    else if (atx) heading = atx[1] ?? '';
    else if (/^ {0,3}(=+|-+)\s*$/.test(line) && prev.trim() && !/^ {0,3}([-*+>]|\d+[.)])\s/.test(prev)) heading = prev;
    if (heading !== undefined) {
      anchors.push((section = anchor(plain(heading))));
      n = 0;
    } else if (items && section && numbered.test(line)) anchors.push(`${section}/${++n}`);
    prev = f || heading !== undefined ? '' : line;
  }
  return anchors;
}

const numbered = /^(\d+[.)](\s|$)|\|\s*\d+\s*\|)/;

const plain = (inline: string) =>
  inline
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/(^|\W)_+|_+(?=\W|$)/g, '$1');
