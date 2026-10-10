// The Assets Surface: the Workbench. Tree on the left, the view in the middle.
// The Studio drives the view by URL only, so the current anchor is always the parameters set here.
import { useEffect, useState } from 'react';
import './assets.css';

type Anchor = { name: string; range?: [number, number] };
type Asset = { id: string; name: string; group: string; set?: string; anchors: Anchor[]; file?: string };
export type Pose = { asset: Asset; anchor: Anchor; t: number; playing: boolean };

const start = (asset: Asset): Pose => ({ asset, anchor: asset.anchors[0], t: asset.anchors[0]?.range?.[0] ?? 0, playing: false });

/** Fills `{group} {id} {anchor} {t} {play}`; an entry's own `set` stands in for its group. */
function viewUrl(template: string, { asset, anchor, t, playing }: Pose) {
  const values: Record<string, string> = {
    group: asset.set ?? asset.group,
    id: asset.id,
    anchor: anchor?.name ?? '',
    t: String(+t.toFixed(2)),
    play: playing ? '1' : '0',
  };
  const url = template.replace(/\{(group|id|anchor|t|play)\}/g, (_, k) => encodeURIComponent(values[k]));
  return url.startsWith('/') ? url : `/${url}`;
}

export function Workbench({ assets }: { assets: { catalogue: string; view: string } }) {
  const [catalogue, setCatalogue] = useState<Asset[]>([]);
  const [error, setError] = useState('');
  const [pose, setPose] = useState<Pose>();

  useEffect(() => {
    fetch('/__studio/catalogue')
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(await r.text()))))
      .then((list: Asset[]) => {
        setCatalogue(list);
        if (list[0]) setPose(start(list[0]));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <pre className="error">{error}</pre>;
  const groups = Map.groupBy(catalogue, (a) => a.group);

  return (
    <div className="workbench">
      <aside className="tree">
        {[...groups].map(([group, list]) => (
          <div key={group}>
            <h3>{group}</h3>
            {list.map((a) => (
              <button key={a.id} className={a.id === pose?.asset.id ? 'on' : ''} onClick={() => setPose(start(a))}>
                {a.name}
              </button>
            ))}
          </div>
        ))}
      </aside>
      {pose && <Stage view={assets.view} pose={pose} setPose={setPose} />}
      {/* #18 adds the Feedback column here; it reads `pose`. */}
    </div>
  );
}

/** `"gltf"` is the Studio's own view page, driven by the same parameters as a URL template (hash, so no reload). */
const gltfView = (file: string) => `/__studio/gltf.html#file=${encodeURIComponent(file)}&anchor={anchor}&t={t}&play={play}`;

function Stage({ view: kind, pose, setPose }: { view: string; pose: Pose; setPose: (p: Pose) => void }) {
  const view = kind === 'gltf' ? gltfView(pose.asset.file!) : kind;
  const [scrub, setScrub] = useState(pose.t);
  useEffect(() => setScrub(pose.t), [pose.t]);
  const { anchor } = pose;
  const commit = () => setPose({ ...pose, t: scrub });

  return (
    <div className="stage">
      <iframe className="view" src={viewUrl(view, pose)} title={pose.asset.name} />
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
