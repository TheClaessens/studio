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

// A 1 × 1 PNG: enough to see the portrait load in place of the sigil.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64').toString('latin1');

test('personas look as PERSONAS.md says across the Playtests Surface; a human session carries the human mark', { skip: noBrowser, timeout: 60_000 }, async (t) => {
  const personas = ['---', 'kind: personas', '---', '# Personas', '', '## 1. Mila', '```persona', 'id: mila', 'archetype: Cozy casual', 'quote: I play to unwind.', 'color: #b0446a', 'sigil: moon', 'portrait: personas/mila.png', '```', '**Play plan**', '- Three runs.', ''].join('\n');
  const mila = ['---', 'kind: persona-report', 'round: 1', 'persona: mila', '---', '# Mila — cozy casual · playtest round 1', '**Lovely.** Fun: 8/10 · Would play again tomorrow: yes · Domain score: 7/10', ''].join('\n');
  const human = ['---', 'kind: human-session', 'round: 1', 'tester: Thomas', '---', '# Human playtester — boss fights · playtest round 1', '', '## Findings', '1. **Too calm.** "I missed the chaos."', ''].join('\n');
  const dir = tempProject({ 'studio.json': { studio: '1.x', name: 'Panel', playtests: 'playtest' }, 'playtest/PERSONAS.md': personas, 'playtest/round-1/01-mila.md': mila, 'playtest/round-1/00-human.md': human });
  // Binary: write the portrait apart from tempProject's text files.
  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync(`${dir}/playtest/personas`);
  writeFileSync(`${dir}/playtest/personas/mila.png`, Buffer.from(png, 'latin1'));
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const browser = await openBrowser();
  t.after(browser.close);

  const look = async (hash: string, ready: string) => {
    await browser.open(`${studio.url}/__studio/?${encodeURIComponent(hash)}${hash}`);
    return browser.evaluate(`(async () => {
      for (const until = Date.now() + 10000; Date.now() < until; await new Promise((r) => setTimeout(r, 100)))
        if (document.querySelector(${JSON.stringify(ready)})?.complete !== false && document.querySelector(${JSON.stringify(ready)})) break;
      const head = document.querySelector('.persona-head, .persona-card');
      return {
        text: document.querySelector('.markdown')?.innerText ?? '',
        rail: document.querySelector('.reader__rail')?.innerText ?? '',
        portrait: head?.querySelector('img')?.naturalWidth ?? 0,
        label: head?.querySelector('[role=img]')?.getAttribute('aria-label'),
      };
    })()`);
  };
  const report = await look('#Playtests/playtest/round-1/01-mila.md', '.persona-head img');
  assert.equal(report.portrait, 1);
  assert.match(report.text, /Persona report · Cozy casual · Round 1/i);
  assert.match(report.text, /I play to unwind\./);
  assert.match(report.rail, /Mila/);
  assert.match(report.rail, /Human session/);

  const session = await look('#Playtests/playtest/round-1/00-human.md', '.persona-head');
  assert.equal(session.portrait, 0); // the human mark, never a persona's portrait
  assert.equal(session.label, 'Thomas');
  assert.match(session.text, /Human session · Thomas · Round 1/i);

  const panel = await look('#Playtests/playtest/PERSONAS.md', '.persona-card img');
  assert.equal(panel.portrait, 1);
  assert.match(panel.text, /Mila · Cozy casual/);
  assert.doesNotMatch(panel.text, /sigil: moon/); // the persona block is a card, not code
  assert.deepEqual(browser.pageErrors, []);
});

test('game-facing Surfaces: frame Pins mark the scrubber, a frame step makes a frame pinnable, media tiles count Feedback', { skip: noBrowser, timeout: 60_000 }, async (t) => {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'Game', assets: { catalogue: 'catalogue.json', view: 'viewer.html?id={id}&pose={anchor}:{t}&play={play}' }, media: ['shots'] },
    'catalogue.json': [{ id: 'grunt', name: 'Goblin Grunt', group: 'greenskins', anchors: [{ name: 'idle' }, { name: 'walk', range: [0, 1.6] }] }],
    'viewer.html': '<canvas width="8" height="8"></canvas>',
  });
  mkdirSync(`${dir}/shots`);
  writeFileSync(`${dir}/shots/a.png`, Buffer.from(png, 'latin1'));
  writeFileSync(`${dir}/shots/b.png`, Buffer.from(png, 'latin1'));
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const screenshot = `data:image/png;base64,${Buffer.from(png, 'latin1').toString('base64')}`;
  const frame = { kind: 'asset', id: 'grunt', anchor: 'walk', t: 0.4, label: 'Goblin Grunt · walk @ 0.40' };
  assert.equal((await postJson(`${studio.url}/__studio/feedback`, { remark: 'Foot slides', pin: frame, attachments: { screenshot } })).status, 201);
  const region = { kind: 'media', path: 'shots/a.png', region: { x: 0, y: 0, w: 1, h: 1 }, label: 'a.png region' };
  assert.equal((await postJson(`${studio.url}/__studio/feedback`, { remark: 'Too dark', pin: region, attachments: { screenshot } })).status, 201);

  const browser = await openBrowser();
  t.after(browser.close);
  const until = (expr: string) => `(async () => { for (const end = Date.now() + 10000; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) { const v = ${expr}; if (v) return v; } return null; })()`;

  // Go-to-pin restores the frame; its Feedback is a marker on the scrubber.
  await browser.open(`${studio.url}/__studio/#Assets/id=grunt&anchor=walk&t=0.4`);
  assert.equal(await browser.evaluate(until(`document.querySelectorAll('.scrubber__mark').length`)), 1);
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="Pin scope"] [aria-pressed=true]').textContent`), 'This frame');
  // Pick the animation again (not pinnable as a frame), then step one frame: a frame is pinnable again, one step on.
  await browser.evaluate(`[...document.querySelectorAll('[aria-label=Animation] button')].find((b) => b.textContent === 'walk').click()`);
  assert.equal(await browser.evaluate(until(`document.querySelector('[aria-label="Pin scope"] [aria-pressed=true]')?.textContent === 'Animation'`)), true);
  await browser.evaluate(`document.querySelector('[aria-label="Next frame"]').click()`);
  assert.match(await browser.evaluate(until(`document.querySelector('[aria-label="Pin scope"] [aria-pressed=true]')?.textContent === 'This frame' && document.querySelector('.side q')?.textContent`)), /walk @ 0\.03$/);

  // Media: the tile carries its live Feedback count; the lightbox steps to the next file with →.
  await browser.open(`${studio.url}/__studio/?m#Media`);
  assert.equal(await browser.evaluate(until(`document.querySelector('.media-tile__count')?.textContent`)), '1');
  await browser.open(`${studio.url}/__studio/?l#Media/shots/a.png`);
  assert.equal(await browser.evaluate(until(`document.querySelector('.lightbox__n')?.textContent`)), '1 / 2');
  await browser.evaluate(`dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))`);
  assert.equal(await browser.evaluate(until(`location.hash.endsWith('b.png') && document.querySelector('.lightbox__n')?.textContent`)), '2 / 2');
  assert.deepEqual(browser.pageErrors, []);
});

test('cross-links: report links jump within the Studio, shots show captioned, docs and Media list where they are used', { skip: noBrowser, timeout: 60_000 }, async (t) => {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const report = ['---', 'kind: playtest-report', '---', '# Synthesis', '', '## Top issues', '1. **Lost in effects** — [mila 1](01-mila.md#pain-points/1), [Combat](../../DESIGN.md#combat)', ''].join('\n');
  const mila = ['---', 'kind: persona-report', 'persona: mila', '---', '# Mila', '', '## Pain points', '1. **Where am I?** (shot: `out/mila-boss.png` · caption: "Can you see me?" · at: 0.4,0.5)', ''].join('\n');
  const dir = tempProject({
    'studio.json': { studio: '1.x', name: 'Links', docs: ['DESIGN.md'], playtests: 'playtest', media: ['out'] },
    'DESIGN.md': '# Design\n\n## Combat\n',
    'playtest/round-1/REPORT.md': report,
    'playtest/round-1/01-mila.md': mila,
  });
  mkdirSync(`${dir}/out`);
  writeFileSync(`${dir}/out/mila-boss.png`, Buffer.from(png, 'latin1'));
  const studio = await startStudio(dir);
  t.after(studio.stop);
  const browser = await openBrowser();
  t.after(browser.close);
  const until = (expr: string) => `(async () => { for (const end = Date.now() + 10000; Date.now() < end; await new Promise((r) => setTimeout(r, 100))) { const v = ${expr}; if (v) return v; } return null; })()`;

  await browser.open(`${studio.url}/__studio/?a#Playtests/playtest/round-1/REPORT.md`);
  assert.deepEqual(await browser.evaluate(until(`(() => { const a = [...document.querySelectorAll('.markdown li a:not(.anchor)')].map((a) => a.getAttribute('href')); return a.length === 2 && a[0].startsWith('#') && a; })()`)),
    ['#Playtests/playtest/round-1/01-mila.md#pain-points/1', '#Docs/DESIGN.md#combat']);

  await browser.open(`${studio.url}/__studio/?b#Playtests/playtest/round-1/01-mila.md`);
  assert.equal(await browser.evaluate(until(`document.querySelector('.shot--captioned img')?.complete && document.querySelector('.shot__caption')?.textContent`)), 'Can you see me?');
  assert.equal(await browser.evaluate(`document.querySelector('.shot--captioned').getAttribute('href')`), '#Media/out/mila-boss.png');
  assert.match(await browser.evaluate(until(`document.querySelector('[aria-label="In this file"]')?.innerText.includes('Mentioned in') && document.querySelector('[aria-label="In this file"]').innerText`)), /Lost in effects/);

  await browser.open(`${studio.url}/__studio/?c#Docs/DESIGN.md`);
  assert.match(await browser.evaluate(until(`document.querySelector('[aria-label="In this file"]')?.innerText.includes('Mentioned in') && document.querySelector('[aria-label="In this file"]').innerText`)), /Lost in effects[\s\S]*REPORT\.md → Combat/);

  await browser.open(`${studio.url}/__studio/?d#Media/out/mila-boss.png`);
  assert.match(await browser.evaluate(until(`document.querySelector('.lightbox aside')?.innerText.includes('Used in') && document.querySelector('.lightbox aside').innerText`)), /Taken by\s*Mila[\s\S]*Used in[\s\S]*Can you see me\?/);
  assert.deepEqual(browser.pageErrors, []);
});
