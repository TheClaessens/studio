// The Assets Surface: the Workbench. Tree on the left, the view in the middle, Feedback on the right.
// The Studio drives the view by URL only, so the current anchor is always the parameters set here.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Card, PinForm, listFeedback, type Item, type Pin } from './feedback.tsx';
import { capture, dataUrl, loadCapture } from './capture.ts';
import { Segmented } from './design/atoms.tsx';
import { viewTemplate, viewUrl } from '../server/view.ts';
import './assets.css';

type Anchor = { name: string; range?: [number, number] };
type Asset = { id: string; name: string; group: string; set?: string; anchors: Anchor[]; file?: string };
/** `scrubbed`: `t` is a frame the user chose by scrubbing while paused (or a frame Pin restored), so it can be pinned. */
export type Pose = { asset: Asset; anchor: Anchor; t: number; playing: boolean; scrubbed: boolean };

const start = (asset: Asset): Pose => ({ asset, anchor: asset.anchors[0], t: asset.anchors[0]?.range?.[0] ?? 0, playing: false, scrubbed: false });

const assetItems = (items: Item[]) => items.filter((i) => i.pin.kind === 'asset');

export function Workbench({ assets }: { assets: { catalogue: string; view: string; capture?: string } }) {
  const [catalogue, setCatalogue] = useState<Asset[]>([]);
  const [error, setError] = useState('');
  const [pose, setPose] = useState<Pose>();
  const [items, setItems] = useState<Item[]>([]);
  const [showUnresolved, setShowUnresolved] = useState(false);
  const [filter, setFilter] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const loadItems = () => listFeedback().then((all) => setItems(assetItems(all)));
  useEffect(() => void loadItems(), []);

  useEffect(() => {
    fetch('/__studio/catalogue')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(await r.text()))))
      .then((list: Asset[]) => {
        setCatalogue(list);
        if (list[0]) setPose(start(list[0]));
      })
      .catch((e) => setError(e.message));
  }, []);

  // Go-to-pin: `#Assets/id=…&anchor=…&t=…` (see pinHref) restores that exact asset, anchor and frame.
  useEffect(() => {
    if (!catalogue.length) return;
    const go = () => {
      const route = location.hash.match(/^#Assets\/(.+)/)?.[1];
      if (!route) return;
      const p = new URLSearchParams(route);
      const asset = catalogue.find((a) => a.id === p.get('id'));
      if (!asset) return;
      const anchor = asset.anchors.find((a) => a.name === p.get('anchor'));
      setPose(anchor ? { asset, anchor, t: p.has('t') ? Number(p.get('t')) : (anchor.range?.[0] ?? 0), playing: false, scrubbed: p.has('t') } : start(asset));
      setShowUnresolved(false);
      history.replaceState(null, '', '#Assets'); // so going to the same pin again is a hash change
    };
    go();
    addEventListener('hashchange', go);
    return () => removeEventListener('hashchange', go);
  }, [catalogue]);

  if (error) return <pre className="error">{error}</pre>;
  const q = filter.trim().toLowerCase();
  const shown = q ? catalogue.filter((a) => [a.name, a.id, a.group].some((s) => s.toLowerCase().includes(q))) : catalogue;
  const groups = Map.groupBy(shown, (a) => a.group);
  const openCount = (id: string) => items.filter((i) => i.pin.id === id && i.resolved && i.status === 'open').length;
  const groupCount = (list: Asset[]) => list.reduce((sum, a) => sum + openCount(a.id), 0);
  const unresolved = items.filter((i) => !i.resolved && i.status !== 'closed');
  const shoot = async () => ({
    screenshot: await dataUrl(await capture(frame.current!.contentWindow!, await loadCapture(assets.capture))),
  });
  const Count = ({ n }: { n: number }) => (n > 0 ? <span className="count" aria-label={`${n} open`}>{n}</span> : null);

  return (
    <div className="workbench">
      <aside className="tree" aria-label="Catalogue">
        <label className="tree__filter">
          <span className="sr-only">Filter assets</span>
          <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter assets" />
        </label>
        {[...groups].map(([group, list]) => (
          <div key={group}>
            <h3>{group} <Count n={groupCount(list)} /></h3>
            {list.map((a) => (
              <button
                key={a.id}
                aria-current={a.id === pose?.asset.id && !showUnresolved ? 'true' : undefined}
                onClick={() => (setPose(start(a)), setShowUnresolved(false))}
              >
                <span>{a.name}</span> <Count n={openCount(a.id)} />
              </button>
            ))}
          </div>
        ))}
        {q && !shown.length && <p className="dim">No asset matches “{filter}”.</p>}
        {unresolved.length > 0 && (
          <div>
            <h3>Unresolved pins</h3>
            <button aria-current={showUnresolved ? 'true' : undefined} onClick={() => setShowUnresolved(true)}>
              <span>Pin not found</span> <Count n={unresolved.length} />
            </button>
          </div>
        )}
      </aside>
      {pose && <Stage view={assets.view} pose={pose} setPose={setPose} frame={frame} frames={items.filter((i) => i.pin.id === pose.asset.id && i.status !== 'closed')} />}
      <aside className="side" aria-label="Feedback on this asset">
        {showUnresolved ? (
          <>
            <span className="label">Unresolved pins</span>
            {unresolved.map((item) => <Card key={item.name} item={item} onChange={loadItems} />)}
          </>
        ) : (
          pose && (
            <>
              <NewFeedback pose={pose} shoot={shoot} onCreated={loadItems} />
              {items.some((i) => i.pin.id === pose.asset.id) && <span className="label">On this asset</span>}
              {items.filter((i) => i.pin.id === pose.asset.id).map((item) => <Card key={item.name} item={item} onChange={loadItems} />)}
            </>
          )
        )}
      </aside>
    </div>
  );
}

type Scope = 'asset' | 'animation' | 'frame';

/** The three Pin scopes. A frame needs a ranged anchor the user scrubbed to while paused, so its `t` is always one
 *  the Studio set from a scrub; otherwise the default is the animation (or the asset). Every scope saves a screenshot
 *  and a quoted label. */
function NewFeedback({ pose, shoot, onCreated }: { pose: Pose; shoot: () => Promise<Record<string, string>>; onCreated: () => void }) {
  const { asset, anchor, t, playing, scrubbed } = pose;
  const can: Record<Scope, boolean> = { asset: true, animation: !!anchor, frame: !!anchor?.range && !playing && scrubbed };
  const preferred: Scope = playing ? 'animation' : can.frame ? 'frame' : can.animation ? 'animation' : 'asset';
  const [chosen, setChosen] = useState<Scope>(preferred);
  useEffect(() => setChosen(preferred), [preferred]);
  const scope = can[chosen] ? chosen : preferred;
  const pin: Pin =
    scope === 'asset' ? { kind: 'asset', id: asset.id, label: asset.name } :
    scope === 'animation' ? { kind: 'asset', id: asset.id, anchor: anchor.name, label: `${asset.name} · ${anchor.name}` } :
    { kind: 'asset', id: asset.id, anchor: anchor.name, t: +t.toFixed(2), label: `${asset.name} · ${anchor.name} @ ${t.toFixed(2)}` };
  return (
    <div className="new-feedback">
      <span className="label">Pin to</span>
      <Segmented label="Pin scope" value={scope} onChange={setChosen} options={[
        { value: 'asset', label: 'This asset' },
        { value: 'animation', label: 'Animation', disabled: !can.animation },
        { value: 'frame', label: 'This frame', disabled: !can.frame },
      ]} />
      {!can.frame && anchor?.range && <p className="dim">Pause and scrub, or step a frame, to pin a frame.</p>}
      <PinForm pin={pin} attach={shoot} onCreated={onCreated} />
    </div>
  );
}

const icon = (d: string, fill = false) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="2" aria-hidden="true"><path d={d} /></svg>
);

/** The view on ink, its animation chips and the transport: play, frame step, scrubber with a marker per frame Pin. */
function Stage({ view: kind, pose, setPose, frame, frames }: { view: string; pose: Pose; setPose: (p: Pose) => void; frame: RefObject<HTMLIFrameElement | null>; frames: Item[] }) {
  const view = viewTemplate(kind, pose.asset);
  const [scrub, setScrub] = useState(pose.t);
  useEffect(() => setScrub(pose.t), [pose.t]);
  const { anchor, asset } = pose;
  const at = (t: number) => setPose({ ...pose, t, playing: false, scrubbed: true });
  const range = anchor?.range;
  // ponytail: anchors carry no frame rate, so a frame step is 1/60 of the range; add one to the catalogue if steps must match the game's frames.
  const step = range ? (range[1] - range[0]) / 60 : 0;
  const pct = (t: number) => (range ? ((t - range[0]) / (range[1] - range[0] || 1)) * 100 : 0);
  const marks = frames.filter((i) => i.pin.anchor === anchor?.name && typeof i.pin.t === 'number');

  return (
    <main className="stage">
      <div className="stage__bar">
        <span className="stage__name">{asset.name}</span>
        <code>{asset.id}</code>
        <div className="stage__chips" role="group" aria-label="Animation">
          {asset.anchors.map((a) => (
            <button key={a.name} aria-pressed={a.name === anchor?.name} onClick={() => setPose({ ...pose, anchor: a, t: a.range?.[0] ?? 0, scrubbed: false })}>{a.name}</button>
          ))}
        </div>
      </div>
      <iframe ref={frame} className="view" src={viewUrl(view, pose)} title={asset.name} />
      {(view.includes('{play}') || range) && (
        <div className="transport">
          {view.includes('{play}') && (
            <button className="transport__play" aria-label={pose.playing ? 'Pause' : 'Play'} onClick={() => setPose({ ...pose, playing: !pose.playing, scrubbed: false })}>
              {icon(pose.playing ? 'M7 4h3v16H7zM14 4h3v16h-3z' : 'M7 4l13 8-13 8z', true)}
            </button>
          )}
          {range && (
            <>
              <button aria-label="Previous frame" disabled={pose.playing} onClick={() => at(Math.max(range[0], scrub - step))}>{icon('M15 6l-6 6 6 6')}</button>
              <button aria-label="Next frame" disabled={pose.playing} onClick={() => at(Math.min(range[1], scrub + step))}>{icon('M9 6l6 6-6 6')}</button>
              <div className="scrubber">
                <input type="range" aria-label="Time" min={range[0]} max={range[1]} step={0.01} value={scrub} disabled={pose.playing}
                  onChange={(e) => setScrub(+e.target.value)} onPointerUp={() => at(scrub)} onKeyUp={() => at(scrub)} />
                {marks.map((i) => (
                  <button key={i.name} className="scrubber__mark" style={{ left: `${pct(i.pin.t as number)}%` }} aria-label={`Feedback at ${i.pin.t}`} title={i.pin.label}
                    onClick={() => at(i.pin.t as number)} />
                ))}
              </div>
              <span className="transport__time">{scrub.toFixed(2)} / {range[1].toFixed(2)}</span>
              {!pose.playing && pose.scrubbed && <span className="transport__chip">Paused · pinnable</span>}
            </>
          )}
        </div>
      )}
    </main>
  );
}
