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
  const { text, href } = await browser.evaluate(`(async () => {
    for (const until = Date.now() + 10000; Date.now() < until; await new Promise((r) => setTimeout(r, 100))) {
      const row = document.querySelector('.inbox .row');
      if (row) return { text: document.querySelector('.inbox').innerText, href: row.getAttribute('href') };
    }
    return { text: document.body.innerText, href: null };
  })()`);
  assert.match(text, /Open\s+1/);
  assert.match(text, /Combat drags on/);
  assert.equal(href, '#Docs/DESIGN.md#combat'); // the row goes to its Pin
  assert.deepEqual(browser.pageErrors, []);
  assert.ok((await browser.screenshot()).length > 0);
});

// Headings and findings in the shapes that trip a renderer up: repeats, inline markup, setext, fenced and indented
// code, quotes, nested and `)` lists, frontmatter, HTML comments, paragraph-interrupting lists, emoji-only headings.
const tricky = [
  '---', 'kind: playtest-report', '---',
  '# Title with `code` and **bold**', '', '## Notes', '', '1. **First finding.** text', '2. Second', '',
  '## Notes', '', '| # | Issue |', '|---|---|', '| 1 | a |', '| x | b |', '| 2 | c |', '',
  'Setext Heading', '==============', '', 'Second setext', '-------------', '',
  '### Q&A: [links](x.md), _em_ and ~~gone~~', '', '```', '## fake', '1. fake', '```', '', '    # indented code', '',
  '> ## quoted heading', '> 1. quoted item', '', '- nested', '  1. nested item', '', '3) Paren item', '4) Paren two', '',
  'Two lines', 'of paragraph', '---', '', '**Bold**', '=====', '', '| a | b |', '|---|---|', '| 1 | x |', '---', '',
  '<!--', '## Hidden', '-->', '', '````', '```js', '## not', '````', '', '**Next:**', '6. item', '7. item', '',
  '## 🎮', '', '1. gamer', '', '## After the emoji', '', '1. last', '',
  '## Ünïcödé — dash’s “quotes”', '', '## Trailing hashes ##', '', '#### Notes', '',
].join('\n');

test('every anchor the rendered Docs and Playtests Surfaces offer resolves as a Pin', { skip: noBrowser, timeout: 90_000 }, async (t) => {
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'Anchors', docs: ['DESIGN.md'], playtests: 'playtest' },
    'DESIGN.md': tricky,
    'playtest/round-1/REPORT.md': tricky,
  });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const browser = await openBrowser();
  t.after(browser.close);

  // A distinct query per Surface, so each open is a full load rather than a same-document hash change.
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
  // Document order, as TanStack Markdown lays the file out: the emoji-only heading has no anchor, `6.` after a paragraph is no finding.
  const headings = [
    'title-with-code-and-bold', 'notes', 'notes-1', 'setext-heading', 'second-setext', 'qa-links-em-and-gone', 'after-the-emoji',
    'ünïcödé--dashs-quotes', 'trailing-hashes', 'notes-2',
  ];
  const withFindings = [
    'title-with-code-and-bold', 'notes', 'notes/1', 'notes/2', 'notes-1', 'notes-1/1', 'notes-1/2', 'setext-heading', 'second-setext',
    'qa-links-em-and-gone', 'qa-links-em-and-gone/1', 'qa-links-em-and-gone/2', 'qa-links-em-and-gone/3',
    'after-the-emoji', 'after-the-emoji/1', 'ünïcödé--dashs-quotes', 'trailing-hashes', 'notes-2',
  ];
  assert.deepEqual(docIds, headings);
  const outline: string[] = await browser.evaluate(`[...document.querySelectorAll('nav[aria-label=Outline] a')].map((a) => a.textContent)`);
  assert.ok(outline.includes('After the emoji'), outline.join(' | ')); // the heading after `## 🎮` is not dropped
  assert.deepEqual(playtestIds, withFindings);

  const pins = [
    ...docIds.map((anchor) => ({ kind: 'doc', path: 'DESIGN.md', anchor, label: anchor })),
    ...playtestIds.map((anchor) => ({ kind: 'playtest', path: 'playtest/round-1/REPORT.md', anchor, label: anchor })),
  ];
  for (const pin of pins) assert.equal((await postJson(`${studio.url}/__studio/feedback`, { remark: `${pin.kind} ${pin.anchor}`, pin })).status, 201);
  const items: { body: string; resolved: boolean }[] = await (await fetch(`${studio.url}/__studio/feedback`)).json();
  assert.deepEqual(items.filter((i) => !i.resolved).map((i) => i.body.trim()), []);
});

test('playtest files with a kind show the Studio blocks: scores, severity, verdicts, who raised it', { skip: noBrowser, timeout: 60_000 }, async (t) => {
  const report = [
    '---', 'kind: playtest-report', 'round: 1', '---', '# Arena — Simulated Playtest, Round 1 · Synthesis', '',
    '## 3. Verified by the orchestrator', '| Claim | Verdict | Evidence |', '|---|---|---|', '| Boss stall | real bug | probe hit dealt 0 |', '',
    '## 4. Top issues', '| # | Issue | Sev. | Raised by |', '|---|---|---|---|', '| 1 | **Boss unkillable** | blocker | mila, rhea |', '',
  ].join('\n');
  const mila = [
    '---', 'kind: persona-report', 'round: 1', 'persona: mila', '---', '# Mila — cozy casual · playtest round 1',
    '**Pretty, and I felt strong.** Fun: 8/10 · Would play again tomorrow: yes · Domain score: 7/10', '',
    '## Pain points (ranked, worst first)', '1. **I lose my own character in the effects.** Severity: major', '',
  ].join('\n');
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'Blocks', playtests: 'playtest' }, 'playtest/round-1/REPORT.md': report, 'playtest/round-1/01-mila.md': mila });
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const browser = await openBrowser();
  t.after(browser.close);

  const look = async (hash: string, ready: string) => {
    await browser.open(`${studio.url}/__studio/?${encodeURIComponent(hash)}${hash}`);
    return browser.evaluate(`(async () => {
      for (const until = Date.now() + 10000; Date.now() < until; await new Promise((r) => setTimeout(r, 100)))
        if (document.querySelector(${JSON.stringify(ready)})) break;
      const m = document.querySelector('.markdown');
      return { text: m?.innerText ?? '', sev: [...m.querySelectorAll('.sev')].map((e) => e.innerText), verdicts: [...m.querySelectorAll('.verdict')].map((e) => e.innerText), raised: [...m.querySelectorAll('.raised [role=img]')].map((e) => e.getAttribute('aria-label')) };
    })()`);
  };
  const synthesis = await look('#Playtests/playtest/round-1/REPORT.md', '.verdict');
  assert.deepEqual(synthesis.verdicts, ['Real bug']);
  assert.deepEqual(synthesis.sev, ['Blocker']);
  assert.deepEqual(synthesis.raised, ['Mila', 'Rhea']);
  assert.doesNotMatch(synthesis.text, /kind: playtest-report/); // frontmatter is data, not text

  const persona = await look('#Playtests/playtest/round-1/01-mila.md', '.scores');
  assert.match(persona.text, /Pretty, and I felt strong\./);
  assert.match(persona.text, /Again tomorrow\?\s*Yes/);
  assert.deepEqual(persona.sev, ['Major']);
  assert.deepEqual(browser.pageErrors, []);
});
