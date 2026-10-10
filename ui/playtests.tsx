// The Playtests Surface: rounds latest first; layout files rendered as markdown, the rest raw.
// Route: `#Playtests/<path>#<finding anchor>`, the path relative to the Game Project.
import { useEffect, useState } from 'react';
import { Reader } from './reader.tsx';
import { routeHref, splitRoute } from './hash.ts';

type File = { path: string; markdown: boolean };
type Listing = { rounds: { name: string; files: File[] }[]; files: File[] };

const link = (path: string, anchor?: string) => routeHref('Playtests', path, anchor);
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
  const [path, anchor] = splitRoute(route);
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
  return (
    <Reader
      rail={
        <>
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
        </>
      }
      kind="playtest" path={selected ?? ''} text={text} markdown={!!file?.markdown} anchor={anchor} href={(a) => link(selected, a)} items
      // A finding Pin quotes the finding's title as rendered at pin time: its bold lead, else its text.
      labelOf={(el) => (el.querySelector('strong') ?? el).textContent?.replace(/^#\s*/, '').trim().slice(0, 160) || undefined}
      hint="Click a heading or a numbered finding's # to pin Feedback to it."
    />
  );
}
