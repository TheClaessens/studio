// The Media Surface: a grid of the `media` glob matches grouped by folder; images open in a lightbox, videos in a native player.
// Route: `#Media/<path>`, `#Media/<path>#t=<seconds>` or `#Media/<path>#region=<x>,<y>,<w>,<h>` (normalised 0..1).
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { PinForm, Row, listFeedback, type Item } from './feedback.tsx';
import { Button, FilterPill, PinGlyph, Portrait, Sigil } from './design/atoms.tsx';
import { isHuman, lookOf, personaName } from './design/personas.ts';
import { placeHref, useRefs, type Refs } from './refs.ts';
import { routeHref, splitRoute } from './hash.ts';

type Region = { x: number; y: number; w: number; h: number };
export type MediaAnchor = { t?: number; region?: Region };

const isVideo = (path: string) => /\.(mp4|webm|mov|m4v|ogv)$/i.test(path);
const isImage = (path: string) => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(path);
const src = (path: string) => `/__studio/media/${encodeURI(path)}`;
const name = (path: string) => path.split('/').at(-1)!;
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export const mediaHref = (path: string, { t, region }: MediaAnchor = {}) =>
  routeHref('Media', path, typeof t === 'number' ? `t=${t}` : region ? `region=${[region.x, region.y, region.w, region.h].join(',')}` : undefined);

function parseAnchor(anchor = ''): MediaAnchor {
  const [key, value = ''] = anchor.split('=');
  if (key === 't' && value) return { t: +value };
  const [x, y, w, h] = value.split(',').map(Number);
  return key === 'region' && [x, y, w, h].every(Number.isFinite) ? { region: { x, y, w, h } } : {};
}

type Kind = 'all' | 'image' | 'video';
const folderOf = (f: string) => f.split('/').slice(0, -1).join('/');

export function Media({ route }: { route: string }) {
  const [files, setFiles] = useState<string[]>();
  const [folder, setFolder] = useState<string>();
  const [kind, setKind] = useState<Kind>('all');
  const [items, setItems] = useState<Item[]>([]);
  const [takers, setTakers] = useState<string[]>([]);
  const refs = useRefs();
  const loadItems = () => void listFeedback().then((all) => setItems(all.filter((i) => i.pin.kind === 'media' && i.status !== 'closed')));
  useEffect(() => void fetch('/__studio/media').then((r) => r.json()).then(setFiles), []);
  useEffect(loadItems, []);
  const [path, anchor] = splitRoute(route);
  if (!files) return null;

  const folders = Map.groupBy(files, folderOf);
  const takenBy = (f: string) => refs?.shots[f]?.takenBy;
  const panel = [...new Set(files.map(takenBy).filter((id): id is string => !!id))];
  const shown = files.filter((f) => (folder === undefined || folderOf(f) === folder) && (kind === 'all' || (kind === 'video' ? isVideo(f) : isImage(f))) && (!takers.length || takers.includes(takenBy(f)!)));
  const toggle = (id: string) => setTakers((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));
  const who = (id: string) => (isHuman(id) ? 'Human tester' : personaName(id));
  const groups = Map.groupBy(shown, folderOf);
  const count = (f: string) => items.filter((i) => i.pin.path === f).length;
  return (
    <div className="media">
      <aside className="media__rail" aria-label="Folders">
        <span className="label">Folders</span>
        <nav>
          <a href="#Media" aria-current={folder === undefined ? 'page' : undefined} onClick={(e) => (e.preventDefault(), setFolder(undefined))}>All<span className="inbox__n">{files.length}</span></a>
          {[...folders].map(([f, list]) => (
            <a key={f} href="#Media" aria-current={folder === f ? 'page' : undefined} onClick={(e) => (e.preventDefault(), setFolder(f))}>{f || '.'}<span className="inbox__n">{list.length}</span></a>
          ))}
        </nav>
        {panel.length > 0 && (
          <>
            <span className="label">Taken by</span>
            <div className="media__takers" role="group" aria-label="Taken by">
              {panel.map((id) => (
                <button key={id} aria-pressed={takers.includes(id)} aria-label={who(id)} title={who(id)} onClick={() => toggle(id)}>
                  <Portrait look={lookOf(id)} size={32} label={who(id)} />
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
      <section className="media__main">
        <div className="media__head">
          <h1>Media</h1>
          <div role="group" aria-label="Type" className="media__types">
            {(['all', 'image', 'video'] as const).map((k) => <FilterPill key={k} on={kind === k} onClick={() => setKind(k)}>{{ all: 'All', image: 'Images', video: 'Video' }[k]}</FilterPill>)}
          </div>
        </div>
        {!files.length && <p>No files match the media globs.</p>}
        {files.length > 0 && !shown.length && <p className="dim">Nothing here of that type.</p>}
        {[...groups].map(([f, list]) => (
          <div key={f} className="media-group">
            <h2>{f.split('/').at(-1) || '.'} <code>{f || '.'}/</code></h2>
            <div className="media-grid">
              {list.map((file) => (
                <a key={file} href={mediaHref(file)}>
                  <span className="media-tile">
                    {isVideo(file) ? <video src={`${src(file)}#t=0.1`} preload="metadata" muted /> : isImage(file) ? <img src={src(file)} alt="" loading="lazy" /> : <span className="media-tile__file">{file.split('.').at(-1)}</span>}
                    {isVideo(file) && <span className="media-tile__play" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l12 7-12 7z" /></svg></span>}
                    {takenBy(file) && <span className="media-tile__who"><Sigil look={lookOf(takenBy(file)!)} size={20} label={who(takenBy(file)!)} /></span>}
                    {count(file) > 0 && <span className="media-tile__count" aria-label={`${count(file)} live Feedback`}><PinGlyph size={10} />{count(file)}</span>}
                  </span>
                  {name(file)}
                </a>
              ))}
            </div>
          </div>
        ))}
      </section>
      {path && files.includes(path) && <Lightbox key={route} path={path} anchor={parseAnchor(anchor)} list={shown.includes(path) ? shown : files} items={items.filter((i) => i.pin.path === path)} onFeedback={loadItems} shot={refs?.shots[path]} />}
    </div>
  );
}

type Draft = { pin: MediaAnchor & { label: string }; screenshot: string };

const icon = (d: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={d} /></svg>;

/** One file on ink with the pin form beside it; ← / → step through `list`, Esc closes. */
function Lightbox({ path, anchor, list, items, onFeedback, shot }: { path: string; anchor: MediaAnchor; list: string[]; items: Item[]; onFeedback: () => void; shot?: Refs['shots'][string] }) {
  const [draft, setDraft] = useState<Draft>();
  const i = list.indexOf(path);
  const go = (d: number) => (location.hash = mediaHref(list[(i + d + list.length) % list.length]));
  const close = () => (location.hash = 'Media');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('textarea, input')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [path, list]);
  return (
    <div className="lightbox" role="dialog" aria-label={name(path)}>
      <div className="lightbox__main">
        <div className="lightbox__bar">
          <a href="#Media">{icon('M15 6l-6 6 6 6')}Media</a>
          <code>{path}</code>
          <span className="lightbox__n">{i + 1} / {list.length}</span>
          <button aria-label="Previous" onClick={() => go(-1)}>{icon('M15 6l-6 6 6 6')}</button>
          <button aria-label="Next" onClick={() => go(1)}>{icon('M9 6l6 6-6 6')}</button>
          <button onClick={close}>Esc {icon('M6 6l12 12M18 6L6 18')}</button>
        </div>
        <div className="lightbox__stage">
          {isVideo(path) ? <VideoStage path={path} t={anchor.t} onPin={setDraft} /> : <ImageStage path={path} shown={anchor.region} onPin={setDraft} />}
        </div>
        <p className="lightbox__hint">{isVideo(path) ? 'Pause on a moment and pin it.' : 'Drag on the image to pin a region.'}</p>
      </div>
      <aside aria-label="About this file">
        {shot?.takenBy && (
          <div className="lightbox__who">
            <Portrait look={lookOf(shot.takenBy)} size={64} label={isHuman(shot.takenBy) ? 'Human tester' : personaName(shot.takenBy)} />
            <div><span className="label">Taken by</span><span className="lightbox__name">{isHuman(shot.takenBy) ? 'Human tester' : personaName(shot.takenBy)}</span></div>
          </div>
        )}
        {shot && (
          <>
            <span className="label">Used in</span>
            <div className="rows rows--compact">
              {shot.usedIn.map((u, i) => (
                <a key={i} className="row" href={placeHref(u)}>
                  <span className="row__text"><span className="row__label">{u.caption || u.label}</span><span className="dim">{u.path.slice(u.path.lastIndexOf('/') + 1)}{u.anchor && ` · ${u.anchor}`}</span></span>
                </a>
              ))}
            </div>
          </>
        )}
        {draft ? (
          <div className="lightbox__draft">
            <img src={draft.screenshot} alt="" />
            <PinForm pin={{ kind: 'media', path, ...draft.pin }} attachments={{ screenshot: draft.screenshot }} onCreated={onFeedback} />
            <Button variant="ghost" onClick={() => setDraft(undefined)}>{isVideo(path) ? 'Clear moment' : 'Clear region'}</Button>
          </div>
        ) : (
          <p className="dim">{isVideo(path) ? 'Pause on a moment and pin it.' : 'Drag a region on the image to pin it.'}</p>
        )}
        {items.length > 0 && (
          <>
            <span className="label">On this file</span>
            <div className="rows rows--compact">{items.map((item) => <Row key={item.name} item={item} />)}</div>
          </>
        )}
      </aside>
    </div>
  );
}

function VideoStage({ path, t, onPin }: { path: string; t?: number; onPin: (d: Draft) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const pin = () => {
    const v = video.current!;
    v.pause();
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [v.videoWidth, v.videoHeight];
    canvas.getContext('2d')!.drawImage(v, 0, 0);
    const time = Math.round(v.currentTime * 100) / 100;
    onPin({ pin: { t: time, label: `${name(path)} @ ${clock(time)}` }, screenshot: canvas.toDataURL('image/png') });
  };
  return (
    <>
      <video ref={video} src={src(path)} controls autoPlay={t === undefined} onLoadedMetadata={(e) => t !== undefined && (e.currentTarget.currentTime = t)} />
      <button onClick={pin}>Pin this moment</button>
    </>
  );
}

function ImageStage({ path, shown, onPin }: { path: string; shown?: Region; onPin: (d: Draft) => void }) {
  const img = useRef<HTMLImageElement>(null);
  const [start, setStart] = useState<{ x: number; y: number }>();
  const [region, setRegion] = useState(shown);
  const at = (e: PointerEvent) => {
    const r = img.current!.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };
  const drag = (e: PointerEvent, a = start) => {
    if (!a) return;
    const b = at(e);
    setRegion({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  };
  const drop = () => {
    setStart(undefined);
    if (!region || region.w < 0.01 || region.h < 0.01) return;
    const i = img.current!;
    const [sx, sy, sw, sh] = [region.x * i.naturalWidth, region.y * i.naturalHeight, region.w * i.naturalWidth, region.h * i.naturalHeight];
    const canvas = document.createElement('canvas');
    [canvas.width, canvas.height] = [Math.max(1, Math.round(sw)), Math.max(1, Math.round(sh))];
    canvas.getContext('2d')!.drawImage(i, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const pinned = { x: round(region.x), y: round(region.y), w: round(region.w), h: round(region.h) };
    onPin({ pin: { region: pinned, label: `${name(path)} region` }, screenshot: canvas.toDataURL('image/png') });
  };
  return (
    <div
      className="frame"
      onPointerDown={(e) => (e.preventDefault(), e.currentTarget.setPointerCapture(e.pointerId), setStart(at(e)), setRegion(undefined))}
      onPointerMove={(e) => drag(e)}
      onPointerUp={drop}
    >
      <img ref={img} src={src(path)} alt="" draggable={false} />
      {region && (
        <div className="region" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }} />
      )}
    </div>
  );
}
