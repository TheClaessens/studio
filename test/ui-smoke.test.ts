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
