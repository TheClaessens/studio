// The Docs Surface: a file tree of the `docs` globs, the selected doc rendered as markdown.
// Route: `#Docs/<path>#<heading anchor>`.
import { useEffect, useState } from 'react';
import { Reader } from './reader.tsx';
import { routeHref, splitRoute } from './hash.ts';
import { useRefs } from './refs.ts';
import { LockGlyph } from './markdown.tsx';

type Tree = { [name: string]: Tree | string };

function toTree(paths: string[]) {
  const root: Tree = {};
  for (const path of paths) {
    const parts = path.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) node = (node[dir] ??= {}) as Tree;
    node[parts.at(-1)!] = path;
  }
  return root;
}

const link = (path: string, anchor?: string) => routeHref('Docs', path, anchor);

/** `locked`: docs whose title says `(LOCKED)`, a locked design spec. */
function TreeView({ tree, selected, locked }: { tree: Tree; selected: string; locked: Set<string> }) {
  return (
    <ul>
      {Object.entries(tree).map(([name, node]) =>
        typeof node === 'string' ? (
          <li key={name}>
            <a href={link(node)} className={node === selected ? 'on' : ''}>{name}{locked.has(node) && <span className="locked" aria-label="locked"> <LockGlyph /></span>}</a>
          </li>
        ) : (
          <li key={name}>
            <details open>
              <summary>{name}/</summary>
              <TreeView tree={node} selected={selected} locked={locked} />
            </details>
          </li>
        ),
      )}
    </ul>
  );
}

/** `route` is the hash after `Docs/`: `<path>` or `<path>#<anchor>`. */
export function Docs({ route }: { route: string }) {
  const [docs, setDocs] = useState<string[]>([]);
  const [text, setText] = useState<string>();
  const [path, anchor] = splitRoute(route);
  const selected = path || docs[0];
  const refs = useRefs();
  const locked = new Set(refs?.places.filter((p) => !p.anchor && /\(LOCKED\)/.test(p.label)).map((p) => p.path));

  useEffect(() => {
    fetch('/__studio/docs').then((r) => r.json()).then(setDocs);
  }, []);
  useEffect(() => {
    setText(undefined);
    if (selected) fetch(`/__studio/docs/${encodeURI(selected)}`).then((r) => (r.ok ? r.text() : `Not a declared doc: ${selected}`)).then(setText);
  }, [selected]);

  return (
    <Reader
      rail={docs.length ? <TreeView tree={toTree(docs)} selected={selected} locked={locked} /> : <p>No files match the docs globs.</p>}
      kind="doc" path={selected ?? ''} text={text} markdown anchor={anchor} href={(a) => link(selected, a)}
      // A heading Pin quotes the heading as rendered at pin time.
      labelOf={(el) => el.textContent ?? undefined}
      hint="Click a heading to pin Feedback to its section."
    />
  );
}
