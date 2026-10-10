// The Assets Surface: the Workbench. Tree on the left, the view in the middle, Feedback on the right.
// The Studio drives the view by URL only, so the current anchor is always the parameters set here.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Card, PinForm, listFeedback, type Item, type Pin } from './feedback.tsx';
import { capture, dataUrl, loadCapture } from './capture.ts';
import { viewTemplate, viewUrl } from '../server/view.ts';
import './assets.css';

type Anchor = { name: string; range?: [number, number] };
type Asset = { id: string; name: string; group: string; set?: string; anchors: Anchor[]; file?: string };
export type Pose = { asset: Asset; anchor: Anchor; t: number; playing: boolean };

const start = (asset: Asset): Pose => ({ asset, anchor: asset.anchors[0], t: asset.anchors[0]?.range?.[0] ?? 0, playing: false });


const assetItems = (items: Item[]) => items.filter((i) => i.pin.kind === 'asset');

export function Workbench({ assets }: { assets: { catalogue: string; view: string; capture?: string } }) {
  const [catalogue, setCatalogue] = useState<Asset[]>([]);
  const [error, setError] = useState('');
  const [pose, setPose] = useState<Pose>();
  const [items, setItems] = useState<Item[]>([]);
  const [showUnresolved, setShowUnresolved] = useState(false);
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
      setPose(anchor ? { asset, anchor, t: p.has('t') ? Number(p.get('t')) : (anchor.range?.[0] ?? 0), playing: false } : start(asset));
      setShowUnresolved(false);
      history.replaceState(null, '', '#Assets'); // so going to the same pin again is a hash change
    };
    go();
    addEventListener('hashchange', go);
    return () => removeEventListener('hashchange', go);
  }, [catalogue]);

  if (error) return <pre className="error">{error}</pre>;
  const groups = Map.groupBy(catalogue, (a) => a.group);
  const openCount = (id: string) => items.filter((i) => i.pin.id === id && i.resolved && i.status === 'open').length;
  const unresolved = items.filter((i) => !i.resolved && i.status !== 'closed');
  const shoot = async () => ({
    screenshot: await dataUrl(await capture(frame.current!.contentWindow!, await loadCapture(assets.capture))),
  });

  return (
    <div className="workbench">
      <aside className="tree">
        {[...groups].map(([group, list]) => (
          <div key={group}>
            <h3>{group}</h3>
            {list.map((a) => (
              <button
                key={a.id}
                className={a.id === pose?.asset.id && !showUnresolved ? 'on' : ''}
                onClick={() => (setPose(start(a)), setShowUnresolved(false))}
              >
                {a.name} {openCount(a.id) > 0 && <span className="count">{openCount(a.id)}</span>}
              </button>
            ))}
          </div>
        ))}
        {unresolved.length > 0 && (
          <div>
            <h3>Unresolved pins</h3>
            <button className={showUnresolved ? 'on' : ''} onClick={() => setShowUnresolved(true)}>
              Pin not found <span className="count">{unresolved.length}</span>
            </button>
          </div>
        )}
      </aside>
      {pose && <Stage view={assets.view} pose={pose} setPose={setPose} frame={frame} />}
      <aside className="side">
        {showUnresolved ? (
          <>
            <h3>Unresolved pins</h3>
            {unresolved.map((item) => <Card key={item.name} item={item} onChange={loadItems} />)}
          </>
        ) : (
          pose && (
            <>
              <NewFeedback pose={pose} shoot={shoot} onCreated={loadItems} />
              {items.filter((i) => i.pin.id === pose.asset.id).map((item) => <Card key={item.name} item={item} onChange={loadItems} />)}
            </>
          )
        )}
      </aside>
    </div>
  );
}

type Scope = 'asset' | 'animation' | 'frame';

/** The three Pin scopes. A frame needs a paused, ranged anchor, so its `t` is always one the Studio set;
 *  pinning while playing defaults to the animation. Every scope saves a screenshot and a quoted label. */
function NewFeedback({ pose, shoot, onCreated }: { pose: Pose; shoot: () => Promise<Record<string, string>>; onCreated: () => void }) {
  const { asset, anchor, t, playing } = pose;
  const can: Record<Scope, boolean> = { asset: true, animation: !!anchor, frame: !!anchor?.range && !playing };
  const preferred: Scope = playing ? 'animation' : can.frame ? 'frame' : can.animation ? 'animation' : 'asset';
  const [chosen, setChosen] = useState<Scope>(preferred);
  useEffect(() => setChosen(preferred), [preferred]);
  const scope = can[chosen] ? chosen : preferred;
  const pin: Pin =
    scope === 'asset' ? { kind: 'asset', id: asset.id, label: asset.name } :
    scope === 'animation' ? { kind: 'asset', id: asset.id, anchor: anchor.name, label: `${asset.name} · ${anchor.name}` } :
    { kind: 'asset', id: asset.id, anchor: anchor.name, t: +t.toFixed(2), label: `${asset.name} · ${anchor.name} @ ${t.toFixed(2)}` };
  const labels: Record<Scope, string> = { asset: 'This asset', animation: 'This animation', frame: 'This frame' };
  return (
    <div className="new-feedback">
      <div className="scopes">
        {(Object.keys(labels) as Scope[]).map((s) => (
          <label key={s} className={can[s] ? '' : 'dim'} title={s === 'frame' && !can.frame ? 'Pause and scrub to pin a frame' : undefined}>
            <input type="radio" name="scope" checked={scope === s} disabled={!can[s]} onChange={() => setChosen(s)} /> {labels[s]}
          </label>
        ))}
      </div>
      <PinForm pin={pin} attach={shoot} onCreated={onCreated} />
    </div>
  );
}


function Stage({ view: kind, pose, setPose, frame }: { view: string; pose: Pose; setPose: (p: Pose) => void; frame: RefObject<HTMLIFrameElement | null> }) {
  const view = viewTemplate(kind, pose.asset);
  const [scrub, setScrub] = useState(pose.t);
  useEffect(() => setScrub(pose.t), [pose.t]);
  const { anchor } = pose;
  const commit = () => setPose({ ...pose, t: scrub });

  return (
    <div className="stage">
      <iframe ref={frame} className="view" src={viewUrl(view, pose)} title={pose.asset.name} />
      <div className="anchors">
        {view.includes('{play}') && (
          <button onClick={() => setPose({ ...pose, playing: !pose.playing })}>{pose.playing ? 'Pause' : 'Play'}</button>
        )}
        {pose.asset.anchors.map((a) => (
          <button key={a.name} className={a.name === anchor?.name ? 'on' : ''} onClick={() => setPose({ ...pose, anchor: a, t: a.range?.[0] ?? 0 })}>
            {a.name}
          </button>
        ))}
        {anchor?.range && (
          <label>
            <input
              type="range"
              min={anchor.range[0]}
              max={anchor.range[1]}
              step={0.01}
              value={scrub}
              disabled={pose.playing}
              onChange={(e) => setScrub(+e.target.value)}
              onPointerUp={commit}
              onKeyUp={commit}
            />
            {scrub.toFixed(2)}
          </label>
        )}
      </div>
    </div>
  );
}
