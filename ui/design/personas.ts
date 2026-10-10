// Persona identity defaults for the core panel (docs/design/ui-redesign.md, Tokens). Until the Studio reads
// PERSONAS.md (S2), these are the fallback colours and sigils for the skill's core panel ids.

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
} as const;
export type SigilName = keyof typeof sigils;

/** How a persona's own words are set: verdicts and quotes only, everything else stays in house type. */
export type Voice = 'soft' | 'heavy' | 'mono' | 'loud';
export type PersonaLook = { color: string; mid: string; tint: string; sigil: SigilName; voice?: Voice; ink?: string };

export const corePanel: Record<string, PersonaLook> = {
  mila: { color: '#b0446a', mid: '#e2a9bd', tint: '#f6e1e8', sigil: 'moon', voice: 'soft', ink: '#5e1f37' },
  viktor: { color: '#5b3fa8', mid: '#bfb0e4', tint: '#e8e2f5', sigil: 'blocks', ink: '#3a2873' },
  noor: { color: '#1f6d77', mid: '#9cc8cd', tint: '#dcecee', sigil: 'compass', voice: 'loud', ink: '#134a51' },
  rhea: { color: '#8f1f2e', mid: '#d99ca4', tint: '#f3dcdf', sigil: 'crosshair', voice: 'heavy', ink: '#5f1220' },
  ilse: { color: '#8a6100', mid: '#dcc28a', tint: '#f3e8cf', sigil: 'eye', ink: '#5c4100' },
  dex: { color: '#2f5486', mid: '#a6bcdc', tint: '#dde6f2', sigil: 'bars', voice: 'mono', ink: '#1e3a60' },
  sam: { color: '#3f6b2c', mid: '#aac899', tint: '#e1ecd9', sigil: 'book', ink: '#2a4a1c' },
};

/** A human tester: neutral ink, never mistaken for an AI persona (D5). */
export const humanLook: PersonaLook = { color: '#1d1b17', mid: '#b5afa3', tint: '#ede9e1', sigil: 'person' };

/** Any other id gets a neutral look until PERSONAS.md says otherwise. */
export const lookFor = (id: string): PersonaLook => corePanel[id] ?? { color: '#4a463e', mid: '#b5afa3', tint: '#e8e4dc', sigil: 'person' };

/** A persona id as a display name: `mila` → `Mila`. */
export const personaName = (id: string) => id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** The look for a persona id, a human tester's (`human`, `00-human`…) included. */
export const lookOf = (id: string): PersonaLook => (/human/i.test(id) ? humanLook : lookFor(id.toLowerCase()));
