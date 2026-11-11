import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthTrace, sanitizeAuthTrace, authTraceDestination, authTraceGuardIssue, authTraceRoute, createDuoRequestObserver } from '../src/auth-trace.mjs';

test('auth destination categories reveal no hostname, URL, query, port or token', () => {
  for (const [url, expected] of [
    ['https://a5.ucsd.edu/private?token=private', 'ucsd_idp'], ['https://tssproxy.ucsd.edu/private', 'tss_proxy'],
    ['https://tss.ucsd.edu/fiori#private', 'tss'], ['https://private.duosecurity.com/private', 'duo'],
    ['https://private.ucsd.edu/private', 'ucsd_other'], ['http://127.0.0.1:54321/private', 'loopback_device'],
    ['https://localhost:54321/private', 'loopback_device'], ['http://[::1]:12345/private', 'loopback_device'],
    ['https://private.example/private', 'other'], ['invalid private data', 'other'],
  ]) assert.equal(authTraceDestination(url), expected);
});

test('document trace separates exact SAML routes and methods without URL or form data', () => {
  for (const [path, expected] of [
    ['https://tssproxy.ucsd.edu/idp/profile/SAML2/POST/SSO', 'proxy_saml_request'],
    ['https://tssproxy.ucsd.edu/idp/profile/Authn/SAML2/POST/SSO', 'proxy_saml_response'],
    ['https://a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO', 'ucsd_saml_redirect'],
    ['https://tss.ucsd.edu/fiori', 'tss_fiori'],
    ['https://tss.ucsd.edu/sap/saml2/sp/acs/100', 'tss_saml_acs'],
    ['https://tssproxy.ucsd.edu/idp/profile/private-token', 'other'],
    ['https://tssproxy.ucsd.edu.attacker.invalid/idp/profile/SAML2/POST/SSO', 'other'],
    ['https://tssproxy.ucsd.edu:1234/idp/profile/SAML2/POST/SSO', 'other'],
  ]) assert.equal(authTraceRoute(path+'?private-token=secret#private-fragment'),expected);
  const fields={kind:'document_response',destination:'tss_proxy',resourceType:'Document',status:400,method:'POST',route:'proxy_saml_request',atMs:100,count:1};
  assert.deepEqual(sanitizeAuthTrace([{...fields,url:'private-url',body:'private-password'}]),[fields]);
  const [invalid]=sanitizeAuthTrace([{...fields,method:'private-method',route:'private-route'}]);
  assert.equal(invalid.method,undefined);assert.equal(invalid.route,undefined);
  assert.doesNotMatch(JSON.stringify(invalid),/private/);
});

test('bounded trace preserves ordering, merges repeated noise and records only auth transitions', () => {
  let time = 1000; const trace = createAuthTrace(() => time);
  trace.addAuthPage('credentials_ad'); trace.addAuthPage('credentials_ad'); trace.addAuthPage('private-page');
  assert.equal(trace.snapshot().length, 1);
  time = 1299;
  trace.record({ kind: 'policy_block', destination: 'loopback_device', resourceType: 'Fetch', token: 'private-token' });
  time = 1350; trace.record({ kind: 'policy_block', destination: 'loopback_device', resourceType: 'Fetch' });
  time = 900; trace.addAuthPage('duo');
  assert.deepEqual(trace.snapshot().map(value => [value.kind, value.atMs, value.count]),
    [['auth_page', 0, 1], ['policy_block', 300, 2], ['auth_page', 300, 1]]);
  time = 10000000; trace.addAuthPage('ucsd_error');
  assert.equal(trace.snapshot().at(-1).atMs, 900000);
  assert.doesNotMatch(JSON.stringify(trace.snapshot()), /private|https|54321/);
  const copy = trace.snapshot(); copy[0].page = 'private-mutated';
  assert.equal(trace.snapshot()[0].page, 'credentials_ad');
  for (let i = 0; i < 70; i++) trace.record({ kind: 'document_response', destination: 'ucsd_idp', resourceType: 'Document', status: i % 2 ? 200 : 302 });
  assert.equal(trace.snapshot().length, 40);
});

test('trace sanitizer drops arbitrary fields, invalid values, reverse time and oversized counts', () => {
  const valid = { kind: 'upstream_failure', destination: 'duo', resourceType: 'Document', reason: 'TimedOut', atMs: 200, count: 1 };
  assert.deepEqual(sanitizeAuthTrace([
    { ...valid, url: 'private-url', body: 'private-body' }, { ...valid, atMs: 100 }, { ...valid, atMs: 300, reason: 'private-reason' },
    { ...valid, atMs: 400, count: 1001 }, { ...valid, atMs: 500, destination: 'private-host' },
  ]), [valid]);
  assert.equal(authTraceGuardIssue(Object.assign(Error('private'), { guardIssue: 'body_too_large' })), 'body_too_large');
  assert.equal(authTraceGuardIssue(Error('CDP timed out private-token')), 'timeout');
  assert.equal(authTraceGuardIssue(Error('Session closed private-token')), 'session_closed');
  assert.equal(authTraceGuardIssue(Error('private protocol details')), 'protocol_error');
});

test('passive Duo trace records completion and failure classes without request data', () => {
  let time = 1000;
  const trace = createAuthTrace(() => time), observer = createDuoRequestObserver(trace.record, () => time);
  const start = (id, path, type = 'XHR') => observer.start({ requestId: id, type,
    request: { url: 'https://api-ce13a1a7.duosecurity.com' + path + '?private-token=secret#private', method: 'POST', headers: { Cookie: 'private-cookie' }, postData: 'private-password' } });
  start('private-id', '/prompt/private-session');
  time = 1299;
  observer.response({ requestId: 'private-id', response: { status: 200, url: 'private-response', headers: { 'Set-Cookie': 'private-cookie' } } });
  observer.finish({ requestId: 'private-id', encodedDataLength: 12345 });
  start('private-id-2', '/frame/private-session', 'Fetch');
  time = 1450;
  observer.fail({ requestId: 'private-id-2', errorText: 'net::ERR_CONNECTION_RESET', blockedReason: 'private-reason' });
  assert.deepEqual(trace.snapshot(), [
    { kind: 'request_complete', destination: 'duo', resourceType: 'XHR', method: 'POST', route: 'duo_prompt', durationMs: 200, status: 200, atMs: 200, count: 1 },
    { kind: 'request_failure', destination: 'duo', resourceType: 'Fetch', method: 'POST', route: 'duo_frame', durationMs: 100, error: 'ERR_CONNECTION_RESET', atMs: 400, count: 1 },
  ]);
  observer.finish({ requestId: 'private-id' }); observer.fail({ requestId: 'private-id-2', errorText: 'private-error' });
  assert.equal(trace.snapshot().length, 2); assert.doesNotMatch(JSON.stringify(trace.snapshot()), /private|secret|12345|https/);
});

test('Duo request correlation bounds memory, handles redirects and clears with the session', () => {
  const events = [], observer = createDuoRequestObserver(value => events.push(value), () => 1000);
  const start = (id, url = 'https://api-ce13a1a7.duosecurity.com/unrecognized/private', extra = {}) => observer.start({ requestId: id, type: 'XHR', request: { url, method: 'GET' }, ...extra });
  for (const url of ['https://private.example/prompt/test', 'http://api-ce13a1a7.duosecurity.com/prompt/test', 'https://private@api-ce13a1a7.duosecurity.com/prompt/test']) {
    start('excluded', url); observer.fail({ requestId: 'excluded', errorText: 'net::ERR_FAILED' });
  }
  start('excluded', undefined, { type: 'Document' }); observer.fail({ requestId: 'excluded', errorText: 'net::ERR_FAILED' });
  assert.equal(events.length, 0);
  for (let i = 0; i < 65; i++) start('id-' + i);
  for (let i = 0; i < 65; i++) observer.fail({ requestId: 'id-' + i, errorText: 'private raw error' });
  assert.equal(events.length, 64); assert.ok(events.every(item => item.error === 'OTHER' && item.route === 'other'));
  start('redirect'); start('redirect', 'https://a5.ucsd.edu/private', { redirectResponse: { status: 303, headers: { private: 'secret' } } });
  observer.fail({ requestId: 'redirect', errorText: 'net::ERR_FAILED' });
  assert.equal(events.length, 65); assert.equal(events.at(-1).status, 303);
  start('closed'); observer.clear(); observer.fail({ requestId: 'closed', errorText: 'net::ERR_FAILED' });
  assert.equal(events.length, 65); assert.doesNotMatch(JSON.stringify(events), /private|secret|id-|https/);
});

test('Duo completion sanitizer rejects malformed metadata and preserves bounded counts only', () => {
  const valid = { kind: 'request_complete', destination: 'duo', resourceType: 'XHR', method: 'GET', route: 'duo_prompt', durationMs: 100, status: 200, atMs: 100, count: 2 };
  assert.deepEqual(sanitizeAuthTrace([{ ...valid, requestId: 'private-id', url: 'private-url', body: 'private-body' }]), [valid]);
  for (const changed of [{ destination: 'tss' }, { resourceType: 'Document' }, { method: 'private' }, { route: 'private' }, { durationMs: Infinity }, { durationMs: 900001 }, { status: 999 }, { kind: 'request_failure', error: 'private' }]) {
    assert.deepEqual(sanitizeAuthTrace([{ ...valid, ...changed }]), []);
  }
});
