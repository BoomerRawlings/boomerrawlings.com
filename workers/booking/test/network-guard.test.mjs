import test from 'node:test';
import assert from 'node:assert/strict';
import { installNetworkGuard, DOCUMENT_POLICY } from '../src/network-guard.mjs';

function fixture(failResponse = false, { stallMethod, now, failure } = {}) {
  const calls = [], blocked = [], release = []; let handler, guard;
  const client = { on(name, callback) { assert.equal(name, 'Fetch.requestPaused'); handler = callback; },
    async send(method, args) { calls.push({ method, args }); if (method === stallMethod) await new Promise(resolve => release.push(resolve)); if (failResponse && method === 'Fetch.fulfillRequest') throw failure || Error('unsupported'); if (method === 'Fetch.getResponseBody') return { body: '<html></html>', base64Encoded: false }; } };
  const page = { async setBypassServiceWorker(value) { assert.equal(value, true); }, async setCacheEnabled(value) { assert.equal(value, false); },
    async createCDPSession() { return client; } };
  return { calls, blocked, release: () => release.splice(0).forEach(resolve => resolve()), diagnostics: () => guard.diagnostics(),
    authTrace: () => guard.authTrace(), authPage: page => guard.recordAuthPage(page),
    async init() { guard = await installNetworkGuard(page, { onBlocked: value => blocked.push(value), now }); },
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
  assert.equal(f.diagnostics().lastFailure.phase, 'response_fulfill');
  assert.equal(f.diagnostics().pendingCount, 0);
});

test('guard diagnostics expose a stalled response phase and age without request data', async () => {
  let time = 1000;
  const f = fixture(false, { stallMethod: 'Fetch.getResponseBody', now: () => time }); await f.init();
  const pending = f.emit(event({ requestId: 'private-request-id', resourceType: 'Document', responseStatusCode: 200,
    responseHeaders: [{ name: 'Set-Cookie', value: 'private-cookie' }] }));
  time += 2500;
  assert.deepEqual(f.diagnostics(), { pendingCount: 1, pending: [{ resourceType: 'Document', phase: 'response_body', ageMs: 2500 }] });
  assert.doesNotMatch(JSON.stringify(f.diagnostics()), /private|secret|never-log|https|ActionHdrSet|Set-Cookie/);
  f.release(); await pending;
  assert.deepEqual(f.diagnostics(), { pendingCount: 0, pending: [], lastCompleted: { phase: 'response_fulfill', ageMs: 0 } });
});

test('guard diagnostics bound entry count, resource labels and ages during many paused requests', async () => {
  let time = 0;
  const f = fixture(false, { stallMethod: 'Fetch.getResponseBody', now: () => time }); await f.init();
  const pending = Array.from({ length: 20 }, (_, i) => f.emit(event({ requestId: 'private-' + i, resourceType: 'private-resource', responseStatusCode: 200 })));
  time = 1_000_000;
  const result = f.diagnostics();
  assert.equal(result.pendingCount, 20); assert.equal(result.pending.length, 12);
  assert.ok(result.pending.every(item => item.resourceType === 'Other' && item.ageMs === 900_000));
  f.release(); await Promise.all(pending);
  assert.equal(f.diagnostics().pendingCount, 0); assert.deepEqual(f.diagnostics().pending, []);
});

test('original upstream timeout is retained before fail-closed abort rewrites the browser error', async () => {
  const f = fixture(false, { now: () => 0 }); await f.init();
  await f.emit(event({ resourceType: 'Document', responseErrorReason: 'TimedOut',
    request: { url: 'https://a5.ucsd.edu/private-session?token=private-token', method: 'POST', postData: 'private-password' } }));
  assert.deepEqual(f.authTrace(), [{ kind: 'upstream_failure', destination: 'ucsd_idp', resourceType: 'Document', reason: 'TimedOut', atMs: 0, count: 1 }]);
  assert.equal(f.calls.at(-1).args.errorReason, 'BlockedByClient'); // Existing policy unchanged.
  assert.doesNotMatch(JSON.stringify(f.authTrace()), /private|https|password/);
});

test('trace distinguishes an upstream UCSD error page from failed guard response fulfillment', async () => {
  const upstream = fixture(false, { now: () => 0 }); await upstream.init();
  await upstream.emit(event({ resourceType: 'Document', responseStatusCode: 500,
    request: { url: 'https://a5.ucsd.edu/private', method: 'POST' } }));
  upstream.authPage('ucsd_error');
  assert.deepEqual(upstream.authTrace().map(value => value.kind), ['document_response', 'auth_page']);
  assert.equal(upstream.authTrace()[0].status, 500); assert.equal(upstream.calls.at(-1).method, 'Fetch.fulfillRequest');
  const local = fixture(true, { now: () => 0, failure: Error('Fetch.fulfillRequest timed out private-token') }); await local.init();
  await local.emit(event({ resourceType: 'Document', responseStatusCode: 200 }));
  assert.deepEqual(local.authTrace().at(-1), { kind: 'guard_failure', destination: 'tss', resourceType: 'Document', phase: 'response_fulfill', issue: 'timeout', atMs: 0, count: 1 });
  assert.equal(local.calls.at(-1).method, 'Fetch.failRequest');
});

test('Duo desktop loopback preflight denial is separate from upstream or controller failure', async () => {
  const f = fixture(false, { now: () => 0 }); await f.init();
  await f.emit(event({ resourceType: 'Fetch', request: { url: 'https://127.0.0.1:12345/private-device?token=private', method: 'OPTIONS', headers: {} } }));
  assert.deepEqual(f.authTrace(), [{ kind: 'policy_block', destination: 'loopback_device', resourceType: 'Fetch', atMs: 0, count: 1 }]);
  assert.equal(f.calls.at(-1).method, 'Fetch.failRequest');
});

test('proxy HTTP400 trace identifies the exact handoff and request method only', async () => {
  const f=fixture(false,{now:()=>0});await f.init();
  await f.emit(event({resourceType:'Document',responseStatusCode:400,
    request:{url:'https://tssproxy.ucsd.edu/idp/profile/Authn/SAML2/POST/SSO?private-token',method:'POST',postData:'private-assertion'}}));
  assert.deepEqual(f.authTrace(),[{kind:'document_response',destination:'tss_proxy',resourceType:'Document',status:400,
    method:'POST',route:'proxy_saml_response',atMs:0,count:1}]);
  assert.equal(f.calls.at(-1).method,'Fetch.fulfillRequest');
  assert.doesNotMatch(JSON.stringify(f.authTrace()),/private|https/);
});
