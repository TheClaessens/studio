// The asset catalogue: a `.json` file, or a `.js` module whose default export returns the list (possibly async).
// The server `import()`s the module by file URL, so it runs in Node, never in the Studio's bundle.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inside } from './static.ts';

export type Anchor = { name: string; range?: [number, number] };
/** `set` overrides `group` in the view template, for assets that resolve differently (e.g. heroes). */
export type Asset = { id: string; name: string; group: string; set?: string; anchors: Anchor[]; file?: string };

/** With `view: "gltf"`, entries carry `file` and their anchors are the file's animation clips. */
export async function loadCatalogue(root: string, path: string, view?: string): Promise<Asset[]> {
  const base = resolve(root);
  const file = resolve(base, path);
  if (!inside(base, file)) throw new Error(`assets.catalogue "${path}" is outside the Game Project`);
  let list: unknown;
  if (file.endsWith('.json')) {
    list = JSON.parse(await readFile(file, 'utf8'));
  } else {
    // ponytail: the cache-bust re-imports the catalogue module on every request (edits show up without a
    // restart), but its own imports stay cached and each copy is kept in memory; fine for a dev tool.
    const exported = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).default;
    list = typeof exported === 'function' ? await exported() : exported;
  }
  if (view !== 'gltf') return check(list, path, false);
  return Promise.all(check(list, path, true).map(async (a) => ({ ...a, anchors: await clips(base, a.file!) })));
}

/** A clip's range is [0, duration]; glTF requires `max` on animation input accessors, so the JSON alone has it.
 * An unnamed clip is `animation_<i>`, as three.js's GLTFLoader names it. */
async function clips(base: string, path: string): Promise<Anchor[]> {
  const file = resolve(base, path);
  if (!inside(base, file)) throw new Error(`asset file "${path}" is outside the Game Project`);
  const bytes = await readFile(file);
  // .glb: 12-byte header, then the JSON chunk (length at 12, type at 16, data from 20).
  const gltf = JSON.parse(bytes.readUInt32LE(0) === 0x46546c67 ? bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)) : bytes.toString('utf8'));
  return (gltf.animations ?? []).map((anim: { name?: string; samplers: { input: number }[] }, i: number) => ({
    name: anim.name || `animation_${i}`,
    range: [0, Math.max(...anim.samplers.map((s) => gltf.accessors[s.input].max[0]))],
  }));
}

/** Fails loudly, naming the first malformed entry. */
function check(list: unknown, path: string, gltf: boolean): Asset[] {
  if (!Array.isArray(list)) throw new Error(`assets.catalogue "${path}" is not a list`);
  list.forEach((a, i) => {
    const bad =
      typeof a?.id !== 'string' ? 'id' :
      typeof a.name !== 'string' ? 'name' :
      typeof a.group !== 'string' ? 'group' :
      a.set !== undefined && typeof a.set !== 'string' ? 'set' :
      gltf && typeof a.file !== 'string' ? 'file' :
      gltf ? null :
      !Array.isArray(a.anchors) ? 'anchors' :
      a.anchors.some((n: Anchor) => typeof n?.name !== 'string' || (n.range !== undefined && !(Array.isArray(n.range) && n.range.length === 2 && n.range.every((x) => typeof x === 'number')))) ? 'anchors' :
      null;
    if (bad) throw new Error(`assets.catalogue "${path}": entry ${i} (${JSON.stringify(a?.id)}) has a missing or malformed "${bad}"`);
  });
  return list;
}
