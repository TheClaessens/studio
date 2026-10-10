// Markdown rendering shared by the Docs and Playtests Surfaces. Every heading gets an `id` anchor
// (GitHub-style slug, `-1`, `-2` for repeats), which heading Pins store.
import { useEffect, useMemo, useRef } from 'react';
import { Marked } from 'marked';

/** GitHub-style heading slug: lowercase, punctuation dropped, spaces to dashes. */
export const slug = (text: string) =>
  text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

/** Renders `text`; `href(anchor)` makes each heading a link to itself, and `anchor` is scrolled into view. */
export function Markdown({ text, anchor, href }: { text: string; anchor?: string; href: (anchor: string) => string }) {
  const html = useMemo(() => {
    const seen = new Map<string, number>();
    const marked = new Marked({
      renderer: {
        heading({ tokens, depth }) {
          const inner = this.parser.parseInline(tokens);
          const base = slug(this.parser.parseInline(tokens, this.parser.textRenderer));
          const n = seen.get(base) ?? 0;
          seen.set(base, n + 1);
          const id = n ? `${base}-${n}` : base;
          return `<h${depth} id="${id}"><a class="anchor" href="${href(id)}">${inner}</a></h${depth}>\n`;
        },
      },
    });
    // ponytail: the doc's raw HTML is rendered as-is; it is the Game Project's own file, already served same-origin.
    return marked.parse(text, { async: false });
  }, [text, href]);

  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (anchor) ref.current?.querySelector(`#${CSS.escape(anchor)}`)?.scrollIntoView();
  }, [html, anchor]);

  return <article ref={ref} className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
