// The Feedback Surface: a triage inbox across all Surfaces, plus the shared bits other Surfaces pin with.
import { useEffect, useState } from 'react';
import { Markdown } from './markdown.tsx';
import { mediaHref, type MediaAnchor } from './media.tsx';

export type Pin = { kind: string; label: string; path?: string; id?: string; anchor?: string; [field: string]: unknown };
export type Item = { name: string; status: 'open' | 'addressed' | 'closed'; pin: Pin; author: string; created: string; body: string; resolved: boolean };

export const listFeedback = (): Promise<Item[]> => fetch('/__studio/feedback').then((r) => r.json());

/** Creates an item; `attachments` are `{ field: dataUrl }`, saved beside it and referenced from the Pin. */
export async function createFeedback(remark: string, pin: Pin, attachments?: Record<string, string>): Promise<Item> {
  const res = await fetch('/__studio/feedback', { method: 'POST', body: JSON.stringify({ remark, pin, attachments }) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Where go-to-pin jumps, per Pin kind. Later Pin kinds add theirs. */
export const pinHref: Record<string, (pin: Pin) => string | undefined> = {
  doc: (pin) => `#Docs/${encodeURI(pin.path ?? '')}${pin.anchor ? `#${pin.anchor}` : ''}`,
  playtest: (pin) => `#Playtests/${encodeURI(pin.path ?? '')}${pin.anchor ? `#${pin.anchor}` : ''}`,
  media: (pin) => mediaHref(pin.path ?? '', pin as MediaAnchor),
};

const noLink = () => '';

/** The new-feedback form other Surfaces drop beside what is being pinned. */
export function PinForm({ pin, attachments, onCreated }: { pin: Pin; attachments?: Record<string, string>; onCreated?: (item: Item) => void }) {
  const [remark, setRemark] = useState('');
  const [note, setNote] = useState('');
  const submit = async () => {
    try {
      const item = await createFeedback(remark, pin, attachments);
      setRemark('');
      setNote(`Saved ${item.name}.md`);
      onCreated?.(item);
    } catch (err) {
      setNote(String(err));
    }
  };
  return (
    <form className="pin-form" onSubmit={(e) => (e.preventDefault(), submit())}>
      <label>
        Feedback on <q>{pin.label}</q>
        <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} />
      </label>
      <button disabled={!remark.trim()}>Pin feedback</button> <span className="dim">{note}</span>
    </form>
  );
}

function Card({ item, onChange }: { item: Item; onChange: () => void }) {
  const [remark, setRemark] = useState('');
  const act = async (action: string, body: object = {}) => {
    const res = await fetch(`/__studio/feedback/${item.name}/${action}`, { method: 'POST', body: JSON.stringify(body) });
    if (!res.ok) return alert(await res.text());
    setRemark('');
    onChange();
  };
  const href = Object.hasOwn(pinHref, item.pin.kind) ? pinHref[item.pin.kind](item.pin) : undefined;
  const shot = typeof item.pin.screenshot === 'string' ? item.pin.screenshot : undefined;
  return (
    <article className="card">
      <header>
        <span className={`chip ${item.status}`}>{item.status === 'addressed' ? 'waiting for you' : item.status}</span>
        {!item.resolved && <span className="chip missing">pin not found</span>}
        <strong>{item.pin.kind}</strong> <q>{item.pin.label}</q>
        {href && item.resolved && <a href={href}>go to pin</a>}
      </header>
      <div className="dim">
        {item.pin.path ?? item.pin.id}
        {item.pin.anchor ? `#${item.pin.anchor}` : ''} · {item.author} · {item.created?.slice(0, 16).replace('T', ' ')} · {item.name}.md
      </div>
      {shot && <img src={`/__studio/feedback/${encodeURIComponent(shot)}`} alt="" />}
      <Markdown text={item.body} href={noLink} />
      {item.status === 'addressed' && <button onClick={() => act('close')}>Close</button>}
      {item.status !== 'open' && (
        <form onSubmit={(e) => (e.preventDefault(), act('reopen', { remark }))}>
          <textarea placeholder="Reopen with a new remark" value={remark} onChange={(e) => setRemark(e.target.value)} rows={2} />
          <button disabled={!remark.trim()}>Reopen</button>
        </form>
      )}
    </article>
  );
}

const groups: [title: string, test: (i: Item) => boolean][] = [
  ['Waiting for you', (i) => i.resolved && i.status === 'addressed'],
  ['Open', (i) => i.resolved && i.status === 'open'],
  ['Unresolved pins', (i) => !i.resolved && i.status !== 'closed'],
  ['Closed', (i) => i.status === 'closed'],
];

export function Feedback({ setUp }: { setUp: boolean }) {
  const [items, setItems] = useState<Item[]>();
  const load = () => listFeedback().then(setItems);
  useEffect(() => void load(), []);
  if (!items) return null;
  return (
    <section className="inbox">
      <h2>Feedback</h2>
      {!setUp && (
        <p className="dim">
          No <code>feedback</code> section in <code>studio.json</code>; items go to <code>feedback/</code>.
        </p>
      )}
      {!items.length && <p>No Feedback yet. Pin some from a Surface, e.g. a heading in Docs.</p>}
      {groups.map(([title, test]) => {
        const group = items.filter(test);
        return group.length ? (
          <details key={title} open={title !== 'Closed'}>
            <summary>
              {title} ({group.length})
            </summary>
            {group.map((item) => <Card key={item.name} item={item} onChange={load} />)}
          </details>
        ) : null;
      })}
    </section>
  );
}
