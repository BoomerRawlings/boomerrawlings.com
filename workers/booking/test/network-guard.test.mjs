import test from 'node:test';
import assert from 'node:assert/strict';
import { installNetworkGuard, DOCUMENT_POLICY } from '../src/network-guard.mjs';

function fixture(failResponse = false) {
  const calls = [], blocked = []; let handler;
  const client = { on(name, callback) { assert.equal(name, 'Fetch.requestPaused'); handler = callback; },
    async send(method, args) { calls.push({ method, args }); if (failResponse && method === 'Fetch.fulfillRequest') throw Error('unsupported'); if (method === 'Fetch.getResponseBody') return { body: '<html></html>', base64Encoded: false }; } };
  const page = { async setBypassServiceWorker(value) { assert.equal(value, true); }, async setCacheEnabled(value) { assert.equal(value, false); },
    async createCDPSession() { return client; } };
  return { calls, blocked, async init() { await installNetworkGuard(page, { onBlocked: value => blocked.push(value) }); },
    emit: event => handler(event) };
}
const event = overrides => ({ requestId: 'id', resourceType: 'XHR', request: { url: 'https://tss.ucsd.edu/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/ActionHdrSet?secret=never-log', method: 'POST', headers: {}, postData: 'never-log' }, ...overrides });

test('network guard blocks modifying requests and redacts diagnostics', async () => {
  const f = fixture(); await f.init(); await f.emit(event());
  assert.equal(f.calls.at(-1).method, 'Fetch.failRequest');
  assert.deepEqual(f.blocked, [{ hostname: 'tss.ucsd.edu', pathname: '/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/ActionHdrSet', method: 'POST' }]);
});
test('document response preserves headers and injects browser-enforced popup/worker/frame policy', async () => {
  const f = fixture(); await f.init(); await f.emit(event({ resourceType: 'Document', responseStatusCode: 200,
    responseHeaders: [{ name: 'Existing', value: 'unchanged' }] }));
  const result = f.calls.at(-1); assert.equal(result.method, 'Fetch.fulfillRequest');
  assert.deepEqual(result.args.responseHeaders, [{ name: 'Existing', value: 'unchanged' }, { name: 'Content-Security-Policy', value: DOCUMENT_POLICY }]);
  assert.equal(DOCUMENT_POLICY.includes('allow-popups'), false); assert.match(DOCUMENT_POLICY, /worker-src 'none'/);
});
test('unsupported response interception fails closed', async () => {
  const f = fixture(true); await f.init(); await f.emit(event({ resourceType: 'Document', responseStatusCode: 200 }));
  assert.equal(f.calls.at(-1).method, 'Fetch.failRequest');
  assert.equal(f.calls.some(call => call.method === 'Fetch.continueRequest'), false);
});
