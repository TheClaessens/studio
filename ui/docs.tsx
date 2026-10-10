// The Docs Surface: a file tree of the `docs` globs, the selected doc rendered as markdown.
// Route: `#Docs/<path>#<heading anchor>`.
import { useEffect, useState } from 'react';
import { Markdown } from './markdown.tsx';
import { PinForm } from './feedback.tsx';
import { routeHref, splitRoute } from './hash.ts';

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

function TreeView({ tree, selected }: { tree: Tree; selected: string }) {
  return (
    <ul>
      {Object.entries(tree).map(([name, node]) =>
        typeof node === 'string' ? (
          <li key={name}>
            <a href={link(node)} className={node === selected ? 'on' : ''}>{name}</a>
          </li>
        ) : (
          <li key={name}>
            <details open>
              <summary>{name}/</summary>
              <TreeView tree={node} selected={selected} />
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

  useEffect(() => {
    fetch('/__studio/docs').then((r) => r.json()).then(setDocs);
  }, []);
  useEffect(() => {
    setText(undefined);
    if (selected) fetch(`/__studio/docs/${encodeURI(selected)}`).then((r) => (r.ok ? r.text() : `Not a declared doc: ${selected}`)).then(setText);
  }, [selected]);
  // A heading Pin quotes the heading as rendered at pin time.
  const [label, setLabel] = useState<string>();
  useEffect(() => setLabel(anchor ? document.getElementById(anchor)?.textContent ?? undefined : undefined), [text, anchor]);

  return (
    <div className="docs">
      <aside>{docs.length ? <TreeView tree={toTree(docs)} selected={selected} /> : <p>No files match the docs globs.</p>}</aside>
      <div className="doc">
        {label !== undefined && <PinForm key={`${selected}#${anchor}`} pin={{ kind: 'doc', path: selected, anchor, label }} />}
        {text !== undefined && <Markdown text={text} anchor={anchor} href={(a) => link(selected, a)} />}
        {label === undefined && text !== undefined && <p className="dim">Click a heading to pin Feedback to its section.</p>}
      </div>
    </div>
  );
}
