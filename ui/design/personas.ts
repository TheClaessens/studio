// Persona identities: the panel from the Game Project's PERSONAS.md (`GET /__studio/personas`), loaded once before
// the Studio renders. Colours, sigils and voices are the skill's choice, written there; the Studio keeps only the
// sigil shapes, the human mark and a neutral look for an id PERSONAS.md doesn't name.

/** Sigils as single stroke paths in a 24 × 24 box: the shape carries the identity, colour backs it up. */
export const sigils = {
  moon: 'M15 4a8 8 0 1 0 5 13A7 7 0 0 1 15 4z M19 3v3 M17.5 4.5h3',
  blocks: 'M4 14h7v7H4z M13 14h7v7h-7z M8.5 5h7v7h-7z',
  compass: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M15.5 8.5l-2 5-5 2 2-5z',
  crosshair: 'M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M12 2v6 M12 16v6 M2 12h6 M16 12h6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  bars: 'M4 20h16 M6 20v-8 M11 20V6 M16 20v-11',
  book: 'M3 5c3-1 6-1 9 1v14c-3-2-6-2-9-1z M21 5c-3-1-6-1-9 1v14c3-2 6-2 9-1z',
  person: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4 21c1-4 4-6 8-6s7 2 8 6',
  // The extended library (skills/game-playtest/references/personas.md).
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  crack: 'M4 4h16v16H4z M12 4l-2 5 3 3-2 4 1 4',
  hourglass: 'M6 3h12 M6 21h12 M7 3c0 5 10 6 10 9s-10 4-10 9 M17 3c0 5-10 6-10 9s10 4 10 9',
  grid: 'M4 4h16v16H4z M4 10h16 M4 15h16 M10 4v16 M15 4v16',
  quill: 'M20 3C12 4 7 10 5 21 M20 3c-1 6-5 10-11 11 M9 9l3 3',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6 M11 11V4a1.5 1.5 0 0 1 3 0v7 M14 11V5a1.5 1.5 0 0 1 3 0v8c0 5-3 8-7 8-3 0-5-2-6-5l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 14',
  signal: 'M12 12h.01 M8.5 8.5a5 5 0 0 0 0 7 M15.5 8.5a5 5 0 0 1 0 7 M5.5 5.5a9 9 0 0 0 0 13 M18.5 5.5a9 9 0 0 1 0 13',
} as const;
export type SigilName = keyof typeof sigils;

/** How a persona's own words are set: verdicts and quotes only, everything else stays in house type. */
export type Voice = 'soft' | 'heavy' | 'mono' | 'loud';
/** `portrait` is a URL the Studio serves. */
export type PersonaLook = { color: string; mid: string; tint: string; sigil: SigilName; voice?: Voice; ink?: string; portrait?: string };
/** One persona as PERSONAS.md describes it (server/personas.ts); every field but `id` may be missing. */
export type Persona = { id: string; plan: string[]; questions: string[]; archetype?: string; quote?: string; hands?: string; save?: string; model?: string } & Record<string, unknown>;

const neutral: PersonaLook = { color: '#4a463e', mid: '#b5afa3', tint: '#e8e4dc', sigil: 'person' };
/** A human tester: neutral ink, never mistaken for an AI persona (D5). */
export const humanLook: PersonaLook = { color: '#1d1b17', mid: '#b5afa3', tint: '#ede9e1', sigil: 'person' };

let panel = new Map<string, Persona>();
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const mix = (color: string, pct: number, base: string) => `color-mix(in srgb, ${color} ${pct}%, ${base})`;

/** Loads the panel; the Studio renders with an empty panel (neutral looks) if PERSONAS.md can't be read. */
export const loadPanel = () =>
  fetch('/__studio/personas').then((r) => (r.ok ? r.json() : [])).catch(() => []).then((list: Persona[]) => void (panel = new Map(list.map((p) => [p.id, p]))));

export const personaOf = (id: string) => panel.get(id.toLowerCase());

/** The look PERSONAS.md gives `id`; a missing `mid`, `tint` or `ink` is mixed from its colour. */
export function lookFor(id: string): PersonaLook {
  const p = personaOf(id);
  const color = str(p?.color);
  if (!p || !color) return neutral;
  const portrait = str(p.portrait);
  return {
    color,
    mid: str(p.mid) ?? mix(color, 45, '#fbf9f5'),
    tint: str(p.tint) ?? mix(color, 15, '#fbf9f5'),
    ink: str(p.ink) ?? mix(color, 65, '#1d1b17'),
    sigil: Object.hasOwn(sigils, String(p.sigil)) ? (p.sigil as SigilName) : 'person',
    voice: (['soft', 'heavy', 'mono', 'loud'] as const).find((v) => v === p.voice),
    portrait: portrait && `/__studio/playtests/${encodeURI(portrait)}`,
  };
}

/** A persona id as a display name: `mila` → `Mila`. */
export const personaName = (id: string) => id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** A human tester's id: their session file is `00-human.md` or `00-human-<name>.md` (D5). */
export const isHuman = (id: string) => /^human\b/i.test(id);
/** The look for a persona id, a human tester's included. */
export const lookOf = (id: string): PersonaLook => (isHuman(id) ? humanLook : lookFor(id));
