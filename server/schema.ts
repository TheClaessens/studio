// JSON Schema for the Project Manifest (`studio.json`), manifest v1.
// Served at /__studio/schema/studio.json and used to validate on start.
// A section's presence is its capability; each optional section's first `examples` entry is what the
// UI shows on a Surface that is "not set up".

const path = { type: 'string', minLength: 1 };
const paths = {
  oneOf: [path, { type: 'array', items: path, minItems: 1 }],
  description: 'A path or glob relative to the Game Project, or a list of them.',
};

export const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Studio Project Manifest',
  type: 'object',
  required: ['studio', 'name'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    studio: {
      ...path,
      description: 'The Studio version pin, e.g. "1.x". The Studio warns when its own version is outside it.',
      examples: ['1.x'],
    },
    name: { ...path, description: 'The Game Project name.' },
    assets: {
      type: 'object',
      description: 'The asset catalogue and how to view an asset (the Assets Surface).',
      required: ['catalogue', 'view'],
      additionalProperties: false,
      properties: {
        catalogue: {
          ...path,
          description: 'A .json file, or a .js module whose default export returns the list (possibly async).',
        },
        view: {
          ...path,
          description:
            '"gltf" for the Studio\'s own viewer, or a same-origin URL template with {group} {id} {anchor} {t} and an optional {play}.',
        },
      },
      examples: [
        { catalogue: 'dev/studio/catalogue.json', view: 'dev/viewer.html?set={group}&id={id}&pose={anchor}:{t}&play={play}' },
      ],
    },
    play: {
      type: 'object',
      description: 'The playable game (the Play Surface).',
      required: ['entry'],
      additionalProperties: false,
      properties: {
        entry: { ...path, description: 'A same-origin path, or an absolute URL (no hooks, no auto-screenshot).' },
        hooks: {
          ...path,
          description:
            'A same-origin module exporting snapshot(win) and an optional capture(win). The export name `actions` is reserved and not implemented in v1.',
        },
        adapter: {
          ...path,
          description:
            "The Game Adapter: a same-origin module whose default export is the playtest Kit's PT. `studio check` loads it on `entry` and runs the Kit self-test against it.",
        },
      },
      examples: [{ entry: 'index.html', hooks: 'dev/studio/hooks.js' }],
    },
    playtests: { ...path, description: 'The playtest rounds root (the Playtests Surface).', examples: ['design/playtest'] },
    media: { ...paths, description: 'Folders or globs of rendered media (the Media Surface).', examples: [['out', 'dev/shots']] },
    docs: { ...paths, description: 'Markdown docs or globs (the Docs Surface).', examples: [['DESIGN.md', 'design/**/*.md']] },
    feedback: { ...path, description: 'The folder Feedback files are written to (the Feedback Surface).', examples: ['feedback'] },
    out: {
      type: 'object',
      description: 'Kit output kinds and the folder each one is written to.',
      additionalProperties: path,
      examples: [{ playtest: 'playtest/out', promo: 'out', shots: 'dev/shots' }],
    },
  },
} as const;
