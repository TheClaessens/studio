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

const icon = (d: string) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={d} /></svg>
);

export function Play({ play }: { play: PlayConfig }) {
  const absolute = isAbsolute(play.entry);
  const frame = useRef<HTMLIFrameElement>(null);
  const [label, setLabel] = useState('');
  const [pasted, setPasted] = useState<string>();
  const [items, setItems] = useState<Item[]>([]);
  const [run, setRun] = useState(0);
  const [hookNames, setHookNames] = useState<string[]>([]);
  const loadItems = () => listFeedback().then((all) => setItems(all.filter((i) => i.pin.kind === 'play')));
  useEffect(() => void loadItems(), []);
  const loadHooks = async (): Promise<Hooks> => (play.hooks && !absolute ? import(/* @vite-ignore */ sameOrigin(play.hooks)) : {});
  useEffect(() => void loadHooks().then((h) => setHookNames(['snapshot', 'capture'].filter((k) => k in h))).catch(() => setHookNames([])), [play.hooks]);

  const onPaste = async (e: ClipboardEvent) => {
    const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (file) setPasted(await dataUrl(file));
  };

  // At pin time: the pasted image if any, else (same-origin) the hooks' or default capture, plus the snapshot.
  const attach = async () => {
    if (absolute) return pasted ? { screenshot: pasted } : {};
    const win = frame.current!.contentWindow!;
    const hooks = await loadHooks();
    const out: Record<string, string> = { screenshot: pasted ?? (await dataUrl(await capture(win, hooks.capture))) };
    if (hooks.snapshot) out.snapshot = await dataUrl(new Blob([JSON.stringify(await hooks.snapshot(win), null, 2)], { type: 'application/json' }));
    return out;
  };

  return (
    <div className="workbench workbench--play">
      <main className="stage">
        <div className="stage__bar">
          <code>{play.entry}</code>
          {hookNames.length > 0 && <span className="stage__hooks">hooks: {hookNames.join(' · ')}</span>}
          <div className="stage__chips">
            <button onClick={() => setRun((n) => n + 1)}>{icon('M4 12a8 8 0 1 0 3-6.2 M4 4v4h4')} Reload</button>
            <button aria-label="Full screen" onClick={() => frame.current?.requestFullscreen()}>{icon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')}</button>
          </div>
        </div>
        <div className="stage__frame">
          <iframe key={run} ref={frame} className="view" src={absolute ? play.entry : sameOrigin(play.entry)} title="Play" allow="autoplay; fullscreen; gamepad" />
        </div>
      </main>
      <aside className="side" aria-label="Play moments" onPaste={onPaste}>
        <h2>Pin this moment</h2>
        <div className="pin-form">
          <label>
            What's on screen
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Wave 3, boss spawn" />
          </label>
          <p className="dim pin-hint">
            {absolute ? 'Cross-origin game: no auto-screenshot. Paste an image here to attach one.' : 'A screenshot' + (hookNames.includes('snapshot') ? " and the game's snapshot are" : ' is') + ' saved when you pin. Paste an image to use it instead.'}
          </p>
          {pasted && (
            <p>
              <img src={pasted} alt="Pasted screenshot" /> <button onClick={() => setPasted(undefined)}>Remove image</button>
            </p>
          )}
        </div>
        <PinForm pin={{ kind: 'play', path: play.entry, label: label.trim() }} attach={attach} onCreated={() => (setPasted(undefined), loadItems())} />
        {items.length > 0 && <span className="label">Pinned moments</span>}
        {items.map((item) => <Card key={item.name} item={item} onChange={loadItems} />)}
      </aside>
    </div>
  );
}
