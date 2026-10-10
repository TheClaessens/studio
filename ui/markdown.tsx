// Markdown rendering shared by the Docs and Playtests Surfaces. Every heading gets an `id` anchor
// (GitHub-style slug, `-1`, `-2` for repeats), which heading Pins store. With `items`, numbered list items and
// numbered table rows get `<heading>/<n>` anchors too (playtest findings; server/slug.ts counts them the same way).
import { useEffect, useMemo, useRef } from 'react';
import { Marked, Renderer, type Tokens } from 'marked';
import { anchorer } from '../server/slug.ts';

type Finding = { finding?: boolean };

/** Renders `text`; `href(anchor)` makes each heading a link to itself, and `anchor` is scrolled into view. */
export function Markdown({ text, anchor, href, items }: { text: string; anchor?: string; href: (anchor: string) => string; items?: boolean }) {
  const html = useMemo(() => {
    const anchor = anchorer();
    let section = '';
    let n = 0;
    let rowIds: (string | undefined)[] = [];
    const next = () => (section ? `${section}/${++n}` : undefined);
    const link = (id: string) => `<a class="anchor" href="${href(id)}">#</a> `;
    const marked = new Marked({
      renderer: {
        heading({ tokens, depth }) {
          const inner = this.parser.parseInline(tokens);
          const id = (section = anchor(this.parser.parseInline(tokens, this.parser.textRenderer)));
          n = 0;
          return `<h${depth} id="${id}"><a class="anchor" href="${href(id)}">${inner}</a></h${depth}>\n`;
        },
        listitem(item) {
          const html = Renderer.prototype.listitem.call(this, item);
          const id = (item as Finding).finding && next();
          return id ? html.replace('<li>', `<li id="${id}">${link(id)}`) : html;
        },
        table(token) {
          rowIds = [undefined, ...token.rows.map((row) => ((token as Finding).finding && /^\d+$/.test(row[0]?.text.trim()) ? next() : undefined))];
          return Renderer.prototype.table.call(this, token);
        },
        tablerow(row) {
          const id = rowIds.shift();
          return id ? `<tr id="${id}">${row.text.replace(/^(<td[^>]*>)/, `$1${link(id)}`)}</tr>\n` : Renderer.prototype.tablerow.call(this, row);
        },
      },
    });
    // Only top-level ordered lists and tables hold findings, matching the server's unindented-line count.
    const tokens = marked.lexer(text);
    if (items)
      for (const t of tokens) {
        if (t.type === 'list' && t.ordered) for (const item of (t as Tokens.List).items) (item as Finding).finding = true;
        if (t.type === 'table') (t as Finding).finding = true;
      }
    // ponytail: the doc's raw HTML is rendered as-is; it is the Game Project's own file, already served same-origin.
    return marked.parser(tokens);
  }, [text, href, items]);

  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (anchor) ref.current?.querySelector(`#${CSS.escape(anchor)}`)?.scrollIntoView();
  }, [html, anchor]);

  return <article ref={ref} className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
