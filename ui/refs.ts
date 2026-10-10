// Cross-references from `GET /__studio/refs` (server/refs.ts): links between docs and playtest files, and shots.
// Loaded once per Studio page; every Surface reads the same copy.
import { useEffect, useState } from 'react';
import { routeHref } from './hash.ts';
import type { Place, Use, refs } from '../server/refs.ts';
export type { Place, Use };

export type Refs = ReturnType<typeof refs>;

let loading: Promise<Refs> | undefined;
const load = () => (loading ??= fetch('/__studio/refs').then((r) => (r.ok ? r.json() : { places: [], links: [], shots: {} })).catch(() => ({ places: [], links: [], shots: {} })));

export function useRefs() {
  const [refs, setRefs] = useState<Refs>();
  useEffect(() => void load().then(setRefs), []);
  return refs;
}

export const placeHref = (p: Place) => routeHref(p.surface, p.path, p.anchor);

/** What one file's markdown needs: its links' Studio routes, and its shot references' Media files. */
export type FileRefs = { links: Map<string, string>; shots: Map<string, Use & { file: string }> };
export function fileRefs(refs: Refs | undefined, path: string): FileRefs | undefined {
  if (!refs) return undefined;
  const links = new Map(refs.links.filter((l) => l.from.path === path).map((l) => [l.href, placeHref(l.to)]));
  const shots = new Map(Object.entries(refs.shots).flatMap(([file, s]) => s.usedIn.filter((u) => u.path === path).map((u) => [u.ref, { ...u, file }] as const)));
  return { links, shots };
}
