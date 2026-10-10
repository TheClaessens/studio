#!/usr/bin/env node
// Plain JS entry so `npm i -g` / `npx` work: Node refuses to strip types under node_modules,
// so when installed there we strip our own .ts files with a load hook.
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = new URL('../', import.meta.url).href;
if (pkg.includes('/node_modules/')) {
  const emitWarning = process.emitWarning;
  process.emitWarning = (warning, ...rest) =>
    String(warning).includes('stripTypeScriptTypes') ? undefined : emitWarning.call(process, warning, ...rest);
  registerHooks({
    load(url, context, next) {
      if (!url.startsWith(pkg) || !url.endsWith('.ts')) return next(url, context);
      const source = stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'));
      return { format: 'module', source, shortCircuit: true };
    },
  });
}

await import('../server/main.ts');
