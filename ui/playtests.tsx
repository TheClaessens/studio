// The Playtests Surface: rounds latest first; layout files rendered as markdown, the rest raw.
// Route: `#Playtests/<path>#<finding anchor>`, the path relative to the Game Project.
import { useEffect, useState } from 'react';
import { Reader } from './reader.tsx';
import { routeHref, splitRoute } from './hash.ts';
import { Sigil } from './design/atoms.tsx';
import { isHuman, lookOf, personaName } from './design/personas.ts';

type File = { path: string; markdown: boolean };
type Listing = { rounds: { name: string; files: File[] }[]; files: File[] };

const link = (path: string, anchor?: string) => routeHref('Playtests', path, anchor);
const name = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const image = (path: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(path);

/** A persona report (`NN-<id>.md`) or human session (`00-human….md`) is listed as its author. */
function FileLabel({ path }: { path: string }) {
  const id = name(path).match(/^\d+-([\w.-]+)\.md$/)?.[1];
  if (!id) return <>{name(path)}</>;
  const who = isHuman(id) ? 'Human session' : personaName(id);
  return <span className="rail-persona" title={name(path)}><Sigil look={lookOf(id)} size={20} />{who}</span>;
}

function Files({ files, selected }: { files: File[]; selected: string }) {
  return (
    <ul>
      {files.map((f) => (
        <li key={f.path}>
          <a href={link(f.path)} className={f.path === selected ? 'on' : ''}><FileLabel path={f.path} /></a>
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
  const url = selected && `/__studio/playtests/${encodeURI(selected)}`;

  useEffect(() => {
    fetch('/__studio/playtests').then((r) => r.json()).then(setListing);
  }, []);
  useEffect(() => {
    setText(undefined);
    if (url && !image(selected)) fetch(url).then((r) => (r.ok ? r.text() : `Not a playtest file: ${selected}`)).then(setText);
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
      body={url && image(selected) ? <img className="reader__image" src={url} alt={name(selected)} /> : undefined}
      // A finding Pin quotes the finding's title as rendered at pin time: its bold lead, else its text.
      labelOf={(el) => (el.querySelector('strong') ?? el).textContent?.replace(/^#\s*/, '').trim().slice(0, 160) || undefined}
      hint="Click a heading or a numbered finding's # to pin Feedback to it."
    />
  );
}
