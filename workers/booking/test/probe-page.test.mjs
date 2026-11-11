import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { probePage } from '../src/probe-page.mjs';

test('probe page scripts compile, use owned API and omit booking mutation controls', async () => {
  const response = probePage(); const html = await response.text();
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(script); new vm.Script(script[2]);
  assert.ok(response.headers.get('Content-Security-Policy').includes(`'nonce-${script[1]}'`));
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal((html.match(/<option /g) || []).length, 9);
  assert.equal(/post\(['"]book['"]/.test(html), false);
  assert.equal(/console\.|localStorage|sessionStorage/.test(html), false);
});
