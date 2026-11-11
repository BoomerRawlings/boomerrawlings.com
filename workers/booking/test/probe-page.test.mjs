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
  assert.match(html, /<details><summary>Login test diagnostics<\/summary>/);
  assert.match(script[2], /diagnostics\(data\);if\(!response.ok\)/);
});

test('probe page renders bounded Fetch phase diagnostics without arbitrary fields', async () => {
  const html = await probePage().text();
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(html)[2];
  const elements = new Map();
  const document = { hidden: true, addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
  const context = vm.createContext({ document, setInterval() {}, input: { diagnostics: { guard: {
    pendingCount: 1, pending: [{ resourceType: 'Document', phase: 'response_body', ageMs: 2500, url: 'never-log' }],
    lastCompleted: { phase: 'request_continue', ageMs: 3000 }, lastFailure: { phase: 'response_fulfill', ageMs: 5000 },
    body: 'never-log', headers: 'never-log',
  } } } });
  vm.runInContext(script, context); vm.runInContext('diagnostics(input)', context);
  assert.equal(elements.get('diagnostics').textContent,
    'Fetch pending: 1\nFetch phase: Document response_body (2.5s)\nLast Fetch completion: request_continue (3s ago)\nLast Fetch failure: response_fulfill (5s ago)');
  context.input = { diagnostics: { guard: { pendingCount: 1001,
    pending: [{ resourceType: 'Document', phase: 'never-log', ageMs: 0 }, { resourceType: 'never-log', phase: 'request', ageMs: 0 },
      { resourceType: 'Document', phase: 'request', ageMs: Infinity }], lastFailure: { phase: 'never-log', ageMs: 0 } } } };
  vm.runInContext('diagnostics(input)', context);
  assert.equal(elements.get('diagnostics').textContent, 'No blocked requests or forms observed.');
});
