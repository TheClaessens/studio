// The Media Surface: a grid of the `media` glob matches grouped by folder; images open in a lightbox, videos in a native player.
// Route: `#Media/<path>`, `#Media/<path>#t=<seconds>` or `#Media/<path>#region=<x>,<y>,<w>,<h>` (normalised 0..1).
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { PinForm } from './feedback.tsx';
import { routeHref, splitRoute } from './hash.ts';

type Region = { x: number; y: number; w: number; h: number };
export type MediaAnchor = { t?: number; region?: Region };

const isVideo = (path: string) => /\.(mp4|webm|mov|m4v|ogv)$/i.test(path);
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

export function Media({ route }: { route: string }) {
  const [files, setFiles] = useState<string[]>();
  useEffect(() => void fetch('/__studio/media').then((r) => r.json()).then(setFiles), []);
  const [path, anchor] = splitRoute(route);
  if (!files) return null;

  const groups = Map.groupBy(files, (f) => f.split('/').slice(0, -1).join('/'));
  return (
    <section>
      <h2>Media</h2>
      {!files.length && <p>No files match the media globs.</p>}
      {[...groups].map(([folder, list]) => (
        <div key={folder} className="media-group">
          <h3>{folder || '.'}/</h3>
          <div className="media-grid">
            {list.map((f) => (
              <a key={f} href={mediaHref(f)}>
                {isVideo(f) ? <video src={`${src(f)}#t=0.1`} preload="metadata" muted /> : <img src={src(f)} alt="" loading="lazy" />}
                {name(f)}
              </a>
            ))}
          </div>
        </div>
      ))}
      {path && files.includes(path) && <Lightbox key={route} path={path} anchor={parseAnchor(anchor)} />}
    </section>
  );
}

type Draft = { pin: MediaAnchor & { label: string }; screenshot: string };

function Lightbox({ path, anchor }: { path: string; anchor: MediaAnchor }) {
  const [draft, setDraft] = useState<Draft>();
  const close = () => (location.hash = 'Media');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="lightbox">
      <div className="stage">
        {isVideo(path) ? <VideoStage path={path} t={anchor.t} onPin={setDraft} /> : <ImageStage path={path} shown={anchor.region} onPin={setDraft} />}
      </div>
      <aside>
        <p>
          <strong>{path}</strong> <a href="#Media">close</a>
        </p>
        {draft ? (
          <>
            <img src={draft.screenshot} alt="" style={{ maxWidth: '100%' }} />
            <PinForm pin={{ kind: 'media', path, ...draft.pin }} attachments={{ screenshot: draft.screenshot }} />
          </>
        ) : (
          <p className="dim">{isVideo(path) ? 'Pause on a moment and pin it.' : 'Drag a region on the image to pin it.'}</p>
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
