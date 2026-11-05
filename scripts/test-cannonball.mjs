import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('the legacy Cannonball page forwards to its dedicated domain with a usable fallback', async () => {
  const html = await readFile(new URL('../dist/cannonball/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<link rel="canonical" href="https://ucsdcannonball.com/">'));
  assert.ok(html.includes('<noscript><meta http-equiv="refresh" content="0;url=https://ucsdcannonball.com/">'));
  assert.ok(html.includes('<a id="destination" class="action" href="https://ucsdcannonball.com/">'));
  assert.ok(html.includes('<script type="module" src="./redirect.mjs"></script>'));
  assert.ok(!html.includes('src="./app.mjs"'));
});

test('forwarding preserves queries and deep links without accepting another destination', async () => {
  const script = await readFile(new URL('../dist/cannonball/redirect.mjs', import.meta.url), 'utf8');
  for (const hash of ['', '#leaderboard', '#submit', '#about', '#https://example.com']) {
    const link = {};
    let redirected;
    runInNewContext(script, {
      URL,
      document: { getElementById: id => { assert.equal(id, 'destination'); return link; } },
      location: { search: '?source=shared', hash, replace: url => { redirected = url; } },
    });
    assert.equal(redirected, 'https://ucsdcannonball.com/?source=shared' + hash);
    assert.equal(link.href, redirected);
  }
});
