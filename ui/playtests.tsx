// The Playtests Surface: rounds latest first; layout files rendered as markdown, the rest raw.
// Route: `#Playtests/<path>#<finding anchor>`, the path relative to the Game Project.
import { useEffect, useState } from 'react';
import { Markdown } from './markdown.tsx';
import { PinForm } from './feedback.tsx';

type File = { path: string; markdown: boolean };
type Listing = { rounds: { name: string; files: File[] }[]; files: File[] };

const link = (path: string, anchor?: string) => `#Playtests/${encodeURI(path)}${anchor ? `#${anchor}` : ''}`;
const name = (path: string) => path.slice(path.lastIndexOf('/') + 1);

function Files({ files, selected }: { files: File[]; selected: string }) {
  return (
    <ul>
      {files.map((f) => (
        <li key={f.path}>
          <a href={link(f.path)} className={f.path === selected ? 'on' : ''}>{name(f.path)}</a>
        </li>
      ))}
    </ul>
  );
}

/** `route` is the hash after `Playtests/`: `<path>` or `<path>#<anchor>`. */
export function Playtests({ route }: { route: string }) {
  const [listing, setListing] = useState<Listing>({ rounds: [], files: [] });
  const [text, setText] = useState<string>();
  const hash = route.indexOf('#');
  const path = hash < 0 ? route : route.slice(0, hash);
  const anchor = hash < 0 ? undefined : route.slice(hash + 1);
  const all = [...listing.rounds.flatMap((r) => r.files), ...listing.files];
  const latest = listing.rounds[0]?.files;
  const selected = path || latest?.find((f) => name(f.path) === 'REPORT.md')?.path || all[0]?.path;
  const file = all.find((f) => f.path === selected);

  useEffect(() => {
    fetch('/__studio/playtests').then((r) => r.json()).then(setListing);
  }, []);
  useEffect(() => {
    setText(undefined);
    if (selected) fetch(`/__studio/playtests/${encodeURI(selected)}`).then((r) => (r.ok ? r.text() : `Not a playtest file: ${selected}`)).then(setText);
  }, [selected]);
  // A finding Pin quotes the finding's title as rendered at pin time: its bold lead, else its text.
  const [label, setLabel] = useState<string>();
  useEffect(() => {
    const el = anchor ? document.getElementById(anchor) : null;
    const title = el && (el.querySelector('strong') ?? el).textContent?.replace(/^#\s*/, '').trim();
    setLabel(title ? title.slice(0, 160) : undefined);
  }, [text, anchor]);

  return (
    <div className="docs">
      <aside>
        {listing.rounds.map((r, i) => (
          <details key={r.name} open={i === 0 || r.files.some((f) => f.path === selected)}>
            <summary>{r.name}{i === 0 && ' (latest)'}</summary>
            <Files files={r.files} selected={selected} />
          </details>
        ))}
        {listing.files.length > 0 && (
          <details open={listing.files.some((f) => f.path === selected)}>
            <summary>other files</summary>
            <Files files={listing.files} selected={selected} />
          </details>
        )}
        {!all.length && <p>No files under the playtests root.</p>}
      </aside>
      <div className="doc">
        {label !== undefined && <PinForm key={`${selected}#${anchor}`} pin={{ kind: 'playtest', path: selected, anchor, label }} />}
        {text !== undefined && (file?.markdown ? <Markdown text={text} anchor={anchor} href={(a) => link(selected, a)} items /> : <pre>{text}</pre>)}
        {label === undefined && file?.markdown && text !== undefined && <p className="dim">Click a heading or a numbered finding's # to pin Feedback to it.</p>}
      </div>
    </div>
  );
}
