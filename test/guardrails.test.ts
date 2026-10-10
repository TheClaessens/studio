// Mechanical rules over the source, so a reviewer never has to spot them. Line-based regexes, deliberately simple.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const serverDir = new URL('../server/', import.meta.url);
const read = (dir: URL, file: string) => readFileSync(new URL(file, dir), 'utf8');

// Tests check external behaviour; test/harness.ts is the one seam that may reach into server/.
test('no test file imports from ../server/ (only test/harness.ts may)', () => {
  const offenders = readdirSync(here)
    .filter((f) => f.endsWith('.test.ts'))
    .filter((f) => /(\bfrom\s*|\bimport\s*\(\s*)['"]\.\.\/server\//.test(read(here, f)));
  assert.deepEqual(offenders, [], 'go through test/harness.ts instead');
});

// Every path built from the Game Project root must stay inside it. Pragmatic check: a server file that calls
// `resolve(root, …)` or `join(root, …)` imports `inside` from ./static.ts, or the line carries
// `// guardrail: contained (<why>)` saying what already keeps it inside.
test('server paths built from root go through inside() or are marked contained', () => {
  const rootPath = /\b(resolve|join)\((\w+\.)?root\s*,/;
  const offenders = readdirSync(serverDir)
    .filter((f) => f.endsWith('.ts') && f !== 'static.ts')
    .flatMap((f) => {
      const text = read(serverDir, f);
      if (/import\s*\{[^}]*\binside\b[^}]*\}\s*from\s*'\.\/static\.ts'/.test(text)) return [];
      return text
        .split('\n')
        .map((line, i) => [line, i + 1] as const)
        .filter(([line]) => rootPath.test(line) && !/\/\/ guardrail: contained \(.+\)/.test(line))
        .map(([line, n]) => `server/${f}:${n}: ${line.trim()}`);
    });
  assert.deepEqual(offenders, [], 'check the path with inside() from server/static.ts, or mark the line contained with a reason');
});
