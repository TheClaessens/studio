// UI smoke: the built UI shows what the HTTP API holds. Asserts on what a user sees, never component internals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noBrowser, openBrowser, postJson, startStudio, tempProject } from './harness.ts';

test('the Feedback inbox shows an item created over HTTP', { skip: noBrowser, timeout: 60_000 }, async (t) => {
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'Smoke', docs: ['DESIGN.md'] }, 'DESIGN.md': '# Design\n\n## Combat\n' });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const res = await postJson(`${studio.url}/__studio/feedback`, { remark: 'Combat drags on', pin: { kind: 'doc', path: 'DESIGN.md', anchor: 'combat', label: 'Combat' } });
  assert.equal(res.status, 201);

  const browser = await openBrowser();
  t.after(browser.close);
  await browser.open(`${studio.url}/__studio/#Feedback`);
  const text = await browser.evaluate(`(async () => {
    for (const until = Date.now() + 10000; Date.now() < until; await new Promise((r) => setTimeout(r, 100)))
      if (document.querySelector('.inbox .card')) return document.querySelector('.inbox').innerText;
    return document.body.innerText;
  })()`);
  assert.match(text, /Open \(1\)/);
  assert.match(text, /Combat drags on/);
  assert.match(text, /go to pin/);
  assert.deepEqual(browser.pageErrors, []);
  assert.ok((await browser.screenshot()).length > 0);
});

// Headings and findings in the shapes that trip a renderer up: repeats, inline markup, setext, fenced and indented
// code, quotes, nested and `)` lists, frontmatter.
const tricky = [
  '---', 'kind: playtest-report', '---',
  '# Title with `code` and **bold**', '', '## Notes', '', '1. **First finding.** text', '2. Second', '',
  '## Notes', '', '| # | Issue |', '|---|---|', '| 1 | a |', '| x | b |', '| 2 | c |', '',
  'Setext Heading', '==============', '', 'Second setext', '-------------', '',
  '### Q&A: [links](x.md), _em_ and ~~gone~~', '', '```', '## fake', '1. fake', '```', '', '    # indented code', '',
  '> ## quoted heading', '> 1. quoted item', '', '- nested', '  1. nested item', '', '3) Paren item', '4) Paren two', '',
  '## Ünïcödé — dash’s “quotes”', '', '## Trailing hashes ##', '', '#### Notes', '',
].join('\n');

test('every anchor the rendered Docs and Playtests pages offer resolves as a Pin', { skip: noBrowser, timeout: 90_000 }, async (t) => {
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'Anchors', docs: ['DESIGN.md'], playtests: 'playtest' },
    'DESIGN.md': tricky,
    'playtest/round-1/REPORT.md': tricky,
  });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const browser = await openBrowser();
  t.after(browser.close);

  // A distinct query per page, so each open is a full load rather than a same-document hash change.
  const ids = async (hash: string) => {
    await browser.open(`${studio.url}/__studio/?${encodeURIComponent(hash)}${hash}`);
    return browser.evaluate(`(async () => {
      for (const until = Date.now() + 10000; Date.now() < until; await new Promise((r) => setTimeout(r, 100)))
        if (document.querySelector('.markdown h1')) return [...document.querySelectorAll('.markdown [id]')].map((e) => e.id);
      return [];
    })()`);
  };
  const docIds: string[] = await ids('#Docs/DESIGN.md');
  const playtestIds: string[] = await ids('#Playtests/playtest/round-1/REPORT.md');
  assert.deepEqual(browser.pageErrors, []);
  assert.ok(docIds.includes('notes-1') && docIds.includes('setext-heading'), docIds.join(' '));
  assert.ok(playtestIds.includes('notes/2') && playtestIds.includes('notes-1/2'), playtestIds.join(' '));

  const pins = [
    ...docIds.map((anchor) => ({ kind: 'doc', path: 'DESIGN.md', anchor, label: anchor })),
    ...playtestIds.map((anchor) => ({ kind: 'playtest', path: 'playtest/round-1/REPORT.md', anchor, label: anchor })),
  ];
  for (const pin of pins) assert.equal((await postJson(`${studio.url}/__studio/feedback`, { remark: `${pin.kind} ${pin.anchor}`, pin })).status, 201);
  const items: { body: string; resolved: boolean }[] = await (await fetch(`${studio.url}/__studio/feedback`)).json();
  assert.deepEqual(items.filter((i) => !i.resolved).map((i) => i.body.trim()), []);
});
