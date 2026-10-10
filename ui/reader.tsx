// The reading layout shared by Docs and Playtests: file rail, the file (rendered or as source), and a right rail with
// the file's outline and the Feedback already pinned in it.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Markdown, type OutlineEntry } from './markdown.tsx';
import { PinForm, Row, useFileFeedback } from './feedback.tsx';
import { Segmented, Sigil } from './design/atoms.tsx';
import { fileRefs, placeHref, useRefs } from './refs.ts';
import { isHuman, lookOf, personaName } from './design/personas.ts';

type Props = {
  /** The Surface's own file list. */
  rail: ReactNode;
  kind: 'doc' | 'playtest';
  path: string;
  text?: string;
  /** Raw files (not markdown) show as source only. */
  markdown: boolean;
  /** Shown instead of the text (an image file). */
  body?: ReactNode;
  anchor?: string;
  href: (anchor: string) => string;
  /** Numbered findings are pinnable too (playtest reports). */
  items?: boolean;
  /** The Pin label for the element `anchor` names, as rendered at pin time. */
  labelOf: (el: Element) => string | undefined;
  hint: string;
};

export function Reader({ rail, kind, path, text, markdown, body, anchor, href, items, labelOf, hint }: Props) {
  const [view, setView] = useState<'rendered' | 'source'>('rendered');
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const feedback = useFileFeedback(kind, path);
  const refs = useRefs();
  const mine = useMemo(() => fileRefs(refs, path), [refs, path]);
  // Links from other files into this one: "Mentioned in" (S5).
  const mentions = refs?.links.filter((l) => l.to.path === path && l.from.path !== path) ?? [];
  useEffect(() => (setView('rendered'), setOutline([])), [path]);

  const [label, setLabel] = useState<string>();
  useEffect(() => {
    const el = anchor && view === 'rendered' ? document.getElementById(anchor)?.cloneNode(true) as Element | undefined : undefined;
    el?.querySelectorAll('.pin-count').forEach((c) => c.remove()); // the Feedback count is not part of the label
    setLabel(el ? labelOf(el) : undefined);
  }, [text, anchor, view]);

  const rendered = markdown && view === 'rendered';
  // A persona report is `NN-<persona>.md` (its frontmatter `persona` wins).
  const persona = kind === 'playtest' ? path.match(/(?:^|\/)\d+-([\w.-]+)\.md$/)?.[1] : undefined;
  return (
    <div className="reader">
      <aside className="reader__rail">{rail}</aside>
      <div className="reader__main">
        <div className="reader__bar">
          <code>{path}</code>
          {markdown && (
            <Segmented label="View" value={view} onChange={setView}
              options={[{ value: 'rendered', label: 'Rendered' }, { value: 'source', label: 'Source' }]} />
          )}
        </div>
        {label !== undefined && <PinForm key={`${path}#${anchor}`} pin={{ kind, path, anchor, label }} onCreated={feedback.reload} />}
        {body}
        {text !== undefined && (rendered ? (
          <Markdown text={text} anchor={anchor} href={href} items={items} counts={feedback.counts} onOutline={setOutline} persona={persona} refs={mine} />
        ) : (
          <pre className="reader__source">{text}</pre>
        ))}
        {label === undefined && rendered && text !== undefined && <p className="dim">{hint}</p>}
      </div>
      <aside className="reader__side" aria-label="In this file">
        {rendered && outline.length > 1 && (
          <nav className="outline" aria-label="Outline">
            <span className="label">In this file</span>
            {outline.map((o) => (
              <a key={o.id} href={href(o.id)} aria-current={o.id === anchor?.split('/')[0] ? 'location' : undefined} style={{ paddingLeft: 10 + Math.max(0, o.depth - 2) * 12 }}>
                {o.text}
                {feedback.counts[o.id] ? <span className="inbox__n">{feedback.counts[o.id]}</span> : null}
              </a>
            ))}
          </nav>
        )}
        {mentions.length > 0 && (
          <div className="reader__feedback">
            <span className="label">Mentioned in</span>
            <div className="rows rows--compact">
              {mentions.map((l, i) => {
                const who = l.from.path.match(/(?:^|\/)\d+-([\w.-]+)\.md$/)?.[1];
                return (
                  <a key={i} className="row" href={placeHref(l.from)}>
                    {who ? <Sigil look={lookOf(who)} size={20} label={isHuman(who) ? 'Human session' : personaName(who)} /> : null}
                    <span className="row__text">
                      <span className="row__label">{l.from.label || l.from.path}</span>
                      <span className="dim">{l.from.path.slice(l.from.path.lastIndexOf('/') + 1)}{l.to.anchor && ` → ${l.to.label}`}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
        {feedback.items.length > 0 && (
          <div className="reader__feedback">
            <span className="label">Feedback in this file</span>
            <div className="rows rows--compact">{feedback.items.map((item) => <Row key={item.name} item={item} />)}</div>
          </div>
        )}
      </aside>
    </div>
  );
}
