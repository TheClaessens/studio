// `studio <game-dir> [--port N]`: one Studio server for one Game Project.
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { createStudioServer } from './app.ts';
import { readFileSync } from 'node:fs';
import { loadManifest, inPin, type Manifest } from './manifest.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { port: { type: 'string', default: '5170' } },
});

const root = resolve(positionals[0] ?? '.');
let manifest: Manifest;
try {
  manifest = loadManifest(root);
} catch (err) {
  console.error(`\nstudio: ${(err as Error).message}\n`);
  process.exit(1);
}
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (!inPin(version, manifest.studio)) {
  console.error(
    `\n!!! WARNING: this Studio is version ${version}, outside the pin "${manifest.studio}" in studio.json.\n` +
      `!!! Things may break. Run the pinned version: npx github:TheClaessens/studio#<tag> ${positionals[0] ?? '.'}\n`,
  );
}

const server = createStudioServer({ root, manifest });

function listen(port: number) {
  server.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && port !== 0) return listen(0); // preferred port taken: any free one
    throw err;
  });
  server.listen(port, '127.0.0.1', () => {
    const { port } = server.address() as { port: number };
    console.log(`Studio for ${manifest.name} (${root})\n  http://localhost:${port}/__studio/`);
  });
}
listen(Number(values.port));
