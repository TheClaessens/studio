// The Play Surface: `play.entry` embedded, and play-moment Pins beside it.
// Same-origin entry: the Studio page imports `play.hooks` and calls it with the game iframe's window —
// `snapshot(win) → JSON` (descriptive only, never restored) and optional `capture(win) → Blob`.
// `actions` is a reserved export name, not implemented in v1.
// Absolute entry (e.g. Pixel Streaming): no hooks, no auto-screenshot; the dev may paste an image.
import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Card, PinForm, listFeedback, type Item } from './feedback.tsx';
import { capture, dataUrl } from './capture.ts';
import './assets.css';

type PlayConfig = { entry: string; hooks?: string };
type Hooks = { snapshot?: (win: Window) => unknown; capture?: (win: Window) => Blob | Promise<Blob> };

const isAbsolute = (entry: string) => /^[a-z][\w+.-]*:/i.test(entry);
const sameOrigin = (path: string) => `/${path.replace(/^\//, '')}`;

export function Play({ play }: { play: PlayConfig }) {
  const absolute = isAbsolute(play.entry);
  const frame = useRef<HTMLIFrameElement>(null);
  const [label, setLabel] = useState('');
  const [pasted, setPasted] = useState<string>();
  const [items, setItems] = useState<Item[]>([]);
  const loadItems = () => listFeedback().then((all) => setItems(all.filter((i) => i.pin.kind === 'play')));
  useEffect(() => void loadItems(), []);

  const onPaste = async (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (file) setPasted(await dataUrl(file));
  };

  // At pin time: the pasted image if any, else (same-origin) the hooks' or default capture, plus the snapshot.
  const attach = async () => {
    if (absolute) return pasted ? { screenshot: pasted } : {};
    const win = frame.current!.contentWindow!;
    const hooks: Hooks = play.hooks ? await import(/* @vite-ignore */ sameOrigin(play.hooks)) : {};
    const out: Record<string, string> = { screenshot: pasted ?? (await dataUrl(await capture(win, hooks.capture))) };
    if (hooks.snapshot) out.snapshot = await dataUrl(new Blob([JSON.stringify(await hooks.snapshot(win), null, 2)], { type: 'application/json' }));
    return out;
  };

  return (
    <div className="workbench" style={{ gridTemplateColumns: '1fr 340px' }}>
      <iframe ref={frame} className="view" src={absolute ? play.entry : sameOrigin(play.entry)} title="Play" allow="autoplay; fullscreen; gamepad" />
      <aside className="side" onPaste={onPaste}>
        <div className="pin-form">
          <label>
            Label (what's on screen)
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Wave 3, boss spawn" />
          </label>
          <p className="dim">
            {absolute ? 'Cross-origin game: no auto-screenshot. Paste an image here to attach one.' : 'A screenshot' + (play.hooks ? ' and the hooks\' snapshot are' : ' is') + ' saved when you pin. Paste an image to use it instead.'}
          </p>
          {pasted && (
            <p>
              <img src={pasted} alt="Pasted screenshot" /> <button onClick={() => setPasted(undefined)}>Remove image</button>
            </p>
          )}
        </div>
        <PinForm pin={{ kind: 'play', path: play.entry, label: label.trim() }} attach={attach} onCreated={() => (setPasted(undefined), loadItems())} />
        {items.map((item) => <Card key={item.name} item={item} onChange={loadItems} />)}
      </aside>
    </div>
  );
}
