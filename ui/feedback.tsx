// The Feedback Surface: a triage inbox across all Surfaces, plus the shared bits other Surfaces pin with.
import { useEffect, useState } from 'react';
import { Markdown } from './markdown.tsx';
import { mediaHref, type MediaAnchor } from './media.tsx';
import { routeHref } from './hash.ts';
import { Button, FilterPill, PinGlyph, Portrait, StatusChip } from './design/atoms.tsx';
import { humanLook, lookFor } from './design/personas.ts';
import type { Pin, Item } from '../server/feedback.ts';
export type { Pin, Item };

const postJson = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const listFeedback = (): Promise<Item[]> => fetch('/__studio/feedback').then((r) => r.json());

/** Creates an item; `attachments` are `{ field: dataUrl }`, saved beside it and referenced from the Pin. */
export async function createFeedback(remark: string, pin: Pin, attachments?: Record<string, string>): Promise<Item> {
  const res = await postJson('/__studio/feedback', { remark, pin, attachments });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Where go-to-pin jumps, per Pin kind. Later Pin kinds add theirs. */
export const pinHref: Record<string, (pin: Pin) => string | undefined> = {
  doc: (pin) => routeHref('Docs', pin.path ?? '', pin.anchor),
  asset: (pin) => `#Assets/${new URLSearchParams(Object.entries({ id: pin.id, anchor: pin.anchor, t: pin.t }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`,
  playtest: (pin) => routeHref('Playtests', pin.path ?? '', pin.anchor),
  media: (pin) => mediaHref(pin.path ?? '', pin as MediaAnchor),
  play: () => '#Play',
};

/** The Surface each Pin kind lives on, for labels and filters. */
export const surfaceOf: Record<string, string> = { doc: 'Docs', asset: 'Assets', playtest: 'Playtests', media: 'Media', play: 'Play' };
const surfaceName = (kind: string) => (Object.hasOwn(surfaceOf, kind) ? surfaceOf[kind] : kind);

/** Live Feedback items still with someone (open or waiting for you), counted per anchor of one file. */
export function useFileFeedback(kind: string, path: string | undefined) {
  const [items, setItems] = useState<Item[]>([]);
  const load = () => void listFeedback().then((all) => setItems(all.filter((i) => i.pin.kind === kind && i.pin.path === path && i.status !== 'closed')));
  useEffect(load, [kind, path]);
  const counts: Record<string, number> = {};
  for (const i of items) if (i.pin.anchor) counts[i.pin.anchor] = (counts[i.pin.anchor] ?? 0) + 1;
  return { items, counts, reload: load };
}

const noLink = () => '';

/** The new-feedback form other Surfaces drop beside what is being pinned. `attach` makes more attachments at pin time (e.g. a screenshot). */
export function PinForm({ pin, attachments, attach, onCreated }: { pin: Pin; attachments?: Record<string, string>; attach?: () => Promise<Record<string, string>>; onCreated?: (item: Item) => void }) {
  const [remark, setRemark] = useState('');
  const [message, setMessage] = useState('');
  const submit = async () => {
    try {
      const item = await createFeedback(remark, pin, attach ? { ...attachments, ...(await attach()) } : attachments);
      setRemark('');
      setMessage(`Saved ${item.name}.md`);
      onCreated?.(item);
    } catch (err) {
      setMessage(String(err));
    }
  };
  return (
    <form className="pin-form" onSubmit={(e) => (e.preventDefault(), submit())}>
      <label>
        <span>Feedback on <q>{pin.label}</q></span>
        <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} placeholder="What should the agent change?" />
      </label>
      <Button variant="primary" disabled={!remark.trim()}>Pin feedback</Button>
      <span className="dim">{message}</span>
    </form>
  );
}

/** Remark, resolution, `---`, new remark…: the item's history in order (see the feedback skill). */
function thread(body: string) {
  // A `---` line separates only after a `## Resolution`; inside a remark it is part of the remark.
  const [remark, ...rest] = body.split(/^## Resolution[ \t]*$/m);
  const out: { who: 'you' | 'agent'; text: string }[] = [{ who: 'you', text: remark.trim() }];
  for (const part of rest) {
    const cut = part.search(/^---[ \t]*\r?$/m);
    out.push({ who: 'agent' as const, text: (cut < 0 ? part : part.slice(0, cut)).trim() });
    if (cut >= 0) out.push({ who: 'you' as const, text: part.slice(cut).replace(/^---[ \t]*\r?\n?/, '').trim() });
  }
  return out.filter((m) => m.text);
}

/** A playtest Pin on a persona report (`NN-<persona>.md`) shows that persona. */
function personaOf(pin: Pin) {
  const id = pin.kind === 'playtest' ? pin.path?.match(/(?:^|\/)\d+-([\w.-]+)\.md$/)?.[1] : undefined;
  return id ? { id, look: /human/i.test(id) ? humanLook : lookFor(id) } : undefined;
}

/** One Feedback item in full: what it points at, the remark and resolution history, and the human's actions. */
export function Card({ item, onChange }: { item: Item; onChange: () => void }) {
  const [reopening, setReopening] = useState(false);
  const [remark, setRemark] = useState('');
  const act = async (action: string, body: object = {}) => {
    const res = await postJson(`/__studio/feedback/${item.name}/${action}`, body);
    if (!res.ok) return alert(await res.text());
    setRemark('');
    setReopening(false);
    onChange();
  };
  const href = Object.hasOwn(pinHref, item.pin.kind) ? pinHref[item.pin.kind](item.pin) : undefined;
  const shot = typeof item.pin.screenshot === 'string' ? item.pin.screenshot : undefined;
  const persona = personaOf(item.pin);
  return (
    <article className="card">
      {persona ? (
        <Portrait look={persona.look} size={64} label={persona.id} />
      ) : shot ? (
        <img className="card__shot" src={`/__studio/feedback/${encodeURIComponent(shot)}`} alt="" />
      ) : null}
      <div className="card__body">
        <header>
          <StatusChip status={item.status} />
          {!item.resolved && <StatusChip status="missing" />}
          <span className="dim">{surfaceName(item.pin.kind)}</span>
          {href && item.resolved && <a href={href}>Go to pin</a>}
        </header>
        <q className="card__label">{item.pin.label}</q>
        <div className="card__thread">
          {thread(item.body).map((m, i) => (
            <div key={i} className={`card__msg card__msg--${m.who}`}>
              {m.who === 'agent' && <span className="card__who">Resolution</span>}
              <Markdown text={m.text} href={noLink} />
            </div>
          ))}
        </div>
        {(item.status === 'addressed' || item.status === 'closed') && (
          <div className="card__actions">
            {item.status === 'addressed' && <Button variant="primary" onClick={() => act('close')}>Close</Button>}
            {!reopening && <Button onClick={() => setReopening(true)}>Reopen with a remark</Button>}
          </div>
        )}
        {reopening && (
          <form className="card__reopen" onSubmit={(e) => (e.preventDefault(), act('reopen', { remark }))}>
            <textarea autoFocus placeholder="What still needs to change?" value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} />
            <div className="card__actions">
              <Button variant="primary" disabled={!remark.trim()}>Reopen</Button>
              <Button type="button" variant="ghost" onClick={() => setReopening(false)}>Cancel</Button>
            </div>
          </form>
        )}
        <div className="card__meta">
          {item.pin.path ?? item.pin.id}
          {item.pin.anchor ? `#${item.pin.anchor}` : ''} · {item.author} · {item.created?.slice(0, 16).replace('T', ' ')} · {item.name}.md
        </div>
      </div>
    </article>
  );
}

/** One line per item, for lists of items that are with agents. */
export function Row({ item }: { item: Item }) {
  const href = Object.hasOwn(pinHref, item.pin.kind) && item.resolved ? pinHref[item.pin.kind](item.pin) : undefined;
  const first = thread(item.body).at(-1)?.text.split('\n')[0] ?? '';
  const persona = personaOf(item.pin);
  const inner = (
    <>
      {persona ? <Portrait look={persona.look} size={32} label={persona.id} /> : <span className="row__glyph"><PinGlyph /></span>}
      <span className="row__text">
        <span className="row__label">{item.pin.label}</span>
        <span className="dim">{surfaceName(item.pin.kind)} · {first}</span>
      </span>
      <StatusChip status={item.status} />
      {!item.resolved && <StatusChip status="missing" />}
    </>
  );
  return href ? <a className="row" href={href}>{inner}</a> : <div className="row">{inner}</div>;
}

type Group = { key: string; title: string; hint?: string; test: (i: Item) => boolean; full: boolean };
const groups: Group[] = [
  { key: 'waiting', title: 'Waiting for you', hint: 'addressed by an agent', test: (i) => i.status === 'addressed', full: true },
  { key: 'open', title: 'Open', hint: 'with agents', test: (i) => i.resolved && i.status === 'open', full: false },
  { key: 'missing', title: 'Unresolved pins', hint: 'what they point at is gone', test: (i) => !i.resolved && i.status === 'open', full: true },
  { key: 'closed', title: 'Closed', test: (i) => i.status === 'closed', full: true },
];

export function Feedback({ setUp, onChange }: { setUp: boolean; onChange?: () => void }) {
  const [items, setItems] = useState<Item[]>();
  const [kinds, setKinds] = useState<string[]>([]);
  const load = () => listFeedback().then((all) => (setItems(all), onChange?.()));
  useEffect(() => void load(), []);
  if (!items) return null;
  const present = [...new Set(items.map((i) => i.pin.kind))];
  const shown = items.filter((i) => !kinds.length || kinds.includes(i.pin.kind));
  const toggle = (k: string) => setKinds((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  return (
    <div className="inbox">
      <aside className="inbox__rail" aria-label="Feedback filters">
        <nav>
          {groups.map((g) => {
            const n = shown.filter(g.test).length;
            return (
              <a key={g.key} href={`#Feedback`} onClick={(e) => (e.preventDefault(), document.getElementById(`group-${g.key}`)?.scrollIntoView())} className={n ? '' : 'dim'}>
                {g.title}
                <span className={g.key === 'waiting' && n ? 'topbar__count' : 'inbox__n'}>{n}</span>
              </a>
            );
          })}
        </nav>
        {present.length > 1 && (
          <div className="inbox__kinds" role="group" aria-label="Pinned on">
            <span className="label">Pinned on</span>
            {present.map((k) => <FilterPill key={k} on={kinds.includes(k)} onClick={() => toggle(k)}>{surfaceName(k)}</FilterPill>)}
          </div>
        )}
      </aside>
      <section className="inbox__main">
        <h1>Feedback</h1>
        <p className="dim">
          Remarks you pinned for agents. Addressed ones wait here until you close or reopen them.
          {!setUp && <> No <code>feedback</code> section in <code>studio.json</code>; items go to <code>feedback/</code>.</>}
        </p>
        {!items.length && <p>No Feedback yet. Pin some from a Surface, e.g. a heading in Docs.</p>}
        {groups.map((g) => {
          const group = shown.filter(g.test);
          if (!group.length) return null;
          const list = g.full ? group.map((item) => <Card key={item.name} item={item} onChange={load} />) : <div className="rows">{group.map((item) => <Row key={item.name} item={item} />)}</div>;
          const title = <h2 id={`group-${g.key}`}>{g.title} <span className="dim">{group.length}{g.hint && ` · ${g.hint}`}</span></h2>;
          return g.key === 'closed' ? (
            <details key={g.key} className="inbox__group"><summary>{title}</summary>{list}</details>
          ) : (
            <div key={g.key} className="inbox__group">{title}{list}</div>
          );
        })}
      </section>
    </div>
  );
}
