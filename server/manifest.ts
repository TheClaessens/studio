// Loads and validates a Game Project's `studio.json` against the manifest schema.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv } from 'ajv';
import { schema } from './schema.ts';

export type Manifest = {
  studio: string;
  name: string;
  assets?: { catalogue: string; view: string };
  play?: { entry: string; hooks?: string };
  playtests?: string;
  media?: string | string[];
  docs?: string | string[];
  feedback?: string;
  out?: Record<string, string>;
};

const validate = new Ajv({ allErrors: true }).compile(schema);

/** x-range pins only: "1.x", "1.2.x", "1.2.3", "1"; missing parts and x/* match anything. */
export function inPin(version: string, pin: string) {
  const v = version.split('-')[0].split('.');
  return pin
    .trim()
    .split('.')
    .every((part, i) => ['x', 'X', '*'].includes(part) || part === v[i]);
}

/** Throws an Error whose message names every malformed section. */
export function loadManifest(root: string): Manifest {
  const file = join(root, 'studio.json');
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`No studio.json in ${root}. A Game Project needs a Project Manifest.`);
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch (err) {
    throw new Error(`studio.json is not valid JSON: ${(err as Error).message}`);
  }
  if (validate(manifest)) return manifest as Manifest;

  const bySection = new Map<string, string>();
  for (const e of validate.errors ?? []) {
    const section = e.instancePath.split('/')[1] || e.params.additionalProperty || e.params.missingProperty || '(root)';
    const where = e.instancePath || '/';
    const detail = e.params.additionalProperty ? 'is not a manifest section' : `${where} ${e.message}`;
    if (!bySection.has(section)) bySection.set(section, detail);
  }
  const lines = [...bySection].map(([section, detail]) => `  section "${section}" is malformed: ${detail}`);
  throw new Error(`studio.json is invalid:\n${lines.join('\n')}`);
}
