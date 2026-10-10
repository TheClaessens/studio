// The ⌘K palette (S6): jump to a Surface, a file, a heading, a finding or a persona. Files, headings and findings come
// from the refs index (`places`), personas from the panel. A native <dialog>, so Esc and focus trapping are the browser's.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Kbd, Sigil } from './design/atoms.tsx';
import { isHuman, lookOf, panelIds, personaName } from './design/personas.ts';
import { placeHref, useRefs, type Refs } from './refs.ts';
import { routeHref } from './hash.ts';
import type { Surface } from './shell.tsx';

type Entry = { kind: 'Surface' | 'Persona' | 'File' | 'Heading' | 'Finding'; label: string; sub?: string; href: string; persona?: string };
const rank: Record<Entry['kind'], number> = { Surface: 0, Persona: 1, File: 2, Heading: 3, Finding: 4 };
const round = (path: string) => Number(path.match(/round-(\d+)/)?.[1] ?? -1);

function entries(surfaces: Surface[], refs: Refs | undefined): Entry[] {
  const places = refs?.places ?? [];
  const files = places.filter((p) => !p.anchor);
  const personas = panelIds().map((id): Entry => {
    // A persona goes to their latest report.
    const reports = files.filter((f) => new RegExp(`(^|/)\\d+-${id}\\.md$`).test(f.path)).sort((a, b) => round(b.path) - round(a.path));
    const personasFile = files.find((f) => /(^|\/)PERSONAS\.md$/.test(f.path));
    const to = reports[0] ?? personasFile;
    return { kind: 'Persona', label: personaName(id), sub: to?.path, href: to ? placeHref(to) : '#Playtests', persona: id };
  });
  return [
    ...surfaces.map((s): Entry => ({ kind: 'Surface', label: s.name, href: `#${s.name}` })),
    ...personas,
    ...places.map((p): Entry => ({
      kind: !p.anchor ? 'File' : p.anchor.includes('/') ? 'Finding' : 'Heading',
      label: p.label.replace(/\s*\(LOCKED\)/, ''),
      sub: p.anchor ? `${p.path} · ${p.anchor}` : p.path,
      href: routeHref(p.surface, p.path, p.anchor),
    })),
  ];
}

export function Palette({ surfaces }: { surfaces: Surface[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const refs = useRefs();
  const all = useMemo(() => entries(surfaces, refs), [surfaces, refs]);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all
    .filter((e) => words.every((w) => `${e.label} ${e.sub ?? ''}`.toLowerCase().includes(w)))
    .sort((a, b) => Number(!a.label.toLowerCase().startsWith(words[0] ?? '')) - Number(!b.label.toLowerCase().startsWith(words[0] ?? '')) || rank[a.kind] - rank[b.kind])
    .slice(0, 40);

  const open = () => (setQuery(''), setActive(0), dialog.current?.showModal());
  const go = (e?: Entry) => {
    if (!e) return;
    dialog.current?.close();
    location.hash = e.href.slice(1);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) (e.preventDefault(), dialog.current?.open ? dialog.current.close() : open());
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => setActive(0), [query]);
  useEffect(() => document.getElementById(`palette-${active}`)?.scrollIntoView({ block: 'nearest' }), [active]);

  return (
    <>
      <button className="topbar__search" onClick={open} aria-keyshortcuts="Meta+K Control+K">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span>Search or jump</span>
        <Kbd>⌘K</Kbd>
      </button>
      <dialog ref={dialog} className="palette" aria-label="Search or jump" onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        <input
          autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Surface, file, heading, finding, persona…"
          role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={shown[active] ? `palette-${active}` : undefined}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, shown.length - 1)));
            if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            if (e.key === 'Enter') (e.preventDefault(), go(shown[active]));
          }}
        />
        <ul id="palette-list" role="listbox" aria-label="Results">
          {shown.map((e, i) => (
            <li key={`${e.kind}|${e.persona ?? ''}|${e.href}`} id={`palette-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(e)}>
              {e.persona ? <Sigil look={lookOf(e.persona)} size={20} label={isHuman(e.persona) ? 'Human' : undefined} /> : <span className="palette__kind">{e.kind}</span>}
              <span className="palette__text"><span>{e.label}</span>{e.sub && <span className="dim">{e.sub}</span>}</span>
            </li>
          ))}
          {!shown.length && <li className="dim" role="presentation">Nothing matches “{query}”.</li>}
        </ul>
      </dialog>
    </>
  );
}
