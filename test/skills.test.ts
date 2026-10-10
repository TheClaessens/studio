import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path: string) => JSON.parse(read(path));

test('the plugin, its marketplace entry and package.json share one version', () => {
  const { version } = json('package.json');
  const plugin = json('.claude-plugin/plugin.json');
  const market = json('.claude-plugin/marketplace.json');
  const entry = market.plugins.find((p: { name: string }) => p.name === plugin.name);
  assert.ok(entry, 'the marketplace lists the plugin');
  assert.equal(entry.source, './');
  assert.equal(plugin.version, version);
  assert.equal(entry.version, version);
});

const SKILLS = ['crazygames-release', 'feedback', 'game-design', 'game-playtest', 'game-promo-video', 'orchestrated-game-dev'];
const files = (dir: string): string[] =>
  readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);

test('the six skills each have a SKILL.md whose frontmatter names it and says when to use it', () => {
  assert.deepEqual(readdirSync(new URL('../skills', import.meta.url)).sort(), SKILLS);
  for (const name of SKILLS) {
    const meta = read(`skills/${name}/SKILL.md`).match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    assert.match(meta, new RegExp(`^name: ${name}$`, 'm'), name);
    assert.match(meta, /^description: \S.{20,}$/m, name);
  }
});

test('no skill copies a Kit or runs a kit server', () => {
  for (const file of files('skills')) {
    const text = read(file);
    assert.doesNotMatch(text, /\bkit\//i, `${file} points at a copied kit/ folder`);
    assert.doesNotMatch(text, /copy[^.\n]*\bkit\b/i, `${file} says to copy a Kit`);
    assert.doesNotMatch(text, /serve\.(mjs|ps1|py)|__(playtest|promo)\/out|\b80(96|97|98)\b|dedicated port/, `${file} assumes a kit server`);
  }
});

test("skill templates load Kits the Studio serves, the promo shims as a classic script in <head>", () => {
  const templates = files('skills').filter((f) => f.includes('/templates/'));
  assert.ok(templates.length >= 3);
  for (const file of templates) {
    for (const [, url] of read(file).matchAll(/(?:from |src=)['"]([^'"]+)['"]/g)) {
      if (!url.includes('kit')) continue;
      const kitFile = url.match(/^\/__studio\/kits\/(.+)$/)?.[1];
      assert.ok(kitFile && existsSync(new URL(`../kits/${kitFile}`, import.meta.url)), `${file}: ${url} is not a served Kit file`);
    }
  }
  const head = read('skills/game-promo-video/templates/index.template.html').split('</head>')[0];
  assert.match(head, /<script src="\/__studio\/kits\/promo\/shims\.js"><\/script>/);
});

test('skills that need the Studio launch it with npx at the pin from studio.json', () => {
  for (const name of ['game-playtest', 'game-promo-video', 'crazygames-release']) {
    assert.match(read(`skills/${name}/SKILL.md`), /npx github:TheClaessens\/studio#semver:/, name);
  }
});
