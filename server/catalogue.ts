// The asset catalogue: a `.json` file, or a `.js` module whose default export returns the list (possibly async).
// The server `import()`s the module by file URL, so it runs in Node, never in the Studio's bundle.
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Anchor = { name: string; range?: [number, number] };
/** `set` overrides `group` in the view template, for assets that resolve differently (e.g. heroes). */
export type Asset = { id: string; name: string; group: string; set?: string; anchors: Anchor[] };

export async function loadCatalogue(root: string, path: string): Promise<Asset[]> {
  const base = resolve(root);
  const file = resolve(base, path);
  if (!file.startsWith(base + sep)) throw new Error(`assets.catalogue "${path}" is outside the Game Project`);
  let list: unknown;
  if (file.endsWith('.json')) {
    list = JSON.parse(await readFile(file, 'utf8'));
  } else {
    // ponytail: the cache-bust re-imports the catalogue module on every request (edits show up without a
    // restart), but its own imports stay cached and each copy is kept in memory; fine for a dev tool.
    const exported = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).default;
    list = typeof exported === 'function' ? await exported() : exported;
  }
  return check(list, path);
}

/** Fails loudly, naming the first malformed entry. */
function check(list: unknown, path: string): Asset[] {
  if (!Array.isArray(list)) throw new Error(`assets.catalogue "${path}" is not a list`);
  list.forEach((a, i) => {
    const bad =
      typeof a?.id !== 'string' ? 'id' :
      typeof a.name !== 'string' ? 'name' :
      typeof a.group !== 'string' ? 'group' :
      a.set !== undefined && typeof a.set !== 'string' ? 'set' :
      !Array.isArray(a.anchors) ? 'anchors' :
      a.anchors.some((n: Anchor) => typeof n?.name !== 'string' || (n.range !== undefined && !(Array.isArray(n.range) && n.range.length === 2 && n.range.every((x) => typeof x === 'number')))) ? 'anchors' :
      null;
    if (bad) throw new Error(`assets.catalogue "${path}": entry ${i} (${JSON.stringify(a?.id)}) has a missing or malformed "${bad}"`);
  });
  return list;
}
