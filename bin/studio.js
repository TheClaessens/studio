#!/usr/bin/env node
// Plain JS entry so `npm i -g` / `npx` work: Node refuses to strip types under node_modules,
// so when installed there we strip our own .ts files with a load hook.
// Imports are dynamic so an older Node reaches the version check instead of failing to link.
if (Number(process.versions.node.split('.')[0]) < 26) {
  console.error(`\nstudio: needs Node 26 or newer; this is Node ${process.versions.node}.\n`);
  process.exit(1);
}
const { registerHooks, stripTypeScriptTypes } = await import('node:module');
const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');

const pkg = new URL('../', import.meta.url).href;
if (pkg.includes('/node_modules/')) {
  const emitWarning = process.emitWarning;
  process.emitWarning = (warning, ...rest) =>
    String(warning).includes('stripTypeScriptTypes') ? undefined : Reflect.apply(emitWarning, process, [warning, ...rest]);
  registerHooks({
    load(url, context, next) {
      if (!url.startsWith(pkg) || !url.endsWith('.ts')) return next(url, context);
      const source = stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'));
      return { format: 'module', source, shortCircuit: true };
    },
  });
}

await import('../server/main.ts');
