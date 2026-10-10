// Surfaces read only their declared paths and globs. A path naming a folder covers every file in it.
import { globSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** The files under `root` matching `patterns`, as sorted `/`-separated paths relative to `root`. */
export function globFiles(root: string, patterns: string | string[] | undefined): string[] {
  const list = [patterns ?? []].flat().flatMap((p) => [p, `${p}/**`]);
  const files = globSync(list, { cwd: root, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => relative(root, join(d.parentPath, d.name)).split(sep).join('/'))
    .filter((p) => p !== '..' && !p.startsWith('../'));
  return [...new Set(files)].sort();
}
