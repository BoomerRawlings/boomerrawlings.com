import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { authenticationProbe, safeAccountName } from '../src/authentication.mjs';

async function probe({ url = 'https://tss.ucsd.edu/fiori', text = '', shell = true, response, failure, requireShell = true, displayName, nameFailure = false } = {}) {
  const calls = [];
  let nameReads = 0;
  const window = { location: new URL(url), ...(shell ? { sap: { ushell: { Container: { getUser: () => ({ getId: () => 'private-account',
    getFullName: () => { nameReads++; if (nameFailure) throw Error('private shell error'); return displayName; } }) } } } } : {}),
    async fetch(address, options) { calls.push({ address, options }); if (failure) throw failure;
      return response || new Response(JSON.stringify({ d: { EntitySets: [] } }), { headers: { 'content-type': 'application/json', 'x-csrf-token': 'private-token' } }); } };
  const result = JSON.parse(JSON.stringify(await runInNewContext(`(${authenticationProbe.toString()})({requireShell})`, {
    window, document: { body: { innerText: text }, querySelector: () => shell ? {} : null }, AbortSignal, requireShell,
  })));
  assert.doesNotMatch(JSON.stringify(result), /private|https|password|SAML/);
  return { result, calls, nameReads };
}

test('successful authentication is a bodyless read; credentials and token never escape', async () => {
  const { result, calls } = await probe();
  assert.deepEqual(result, { status: 'authenticated', page: 'tss' });
  assert.equal(calls.length, 1); assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.body, undefined); assert.equal(calls[0].options.redirect, 'error');
});

test('verified shell display name is bounded Unicode plain text and never required for authentication', async () => {
  for (const [value, expected] of [['  Jane   Doe ', 'Jane Doe'], ['Rémi D’Arcy-Anne', 'Rémi D’Arcy-Anne'], ['李 明', '李 明'], ['A. Example', 'A. Example']]) {
    const { result, calls, nameReads } = await probe({ displayName: value });
    assert.deepEqual(result, { status: 'authenticated', page: 'tss', displayName: expected });
    assert.equal(safeAccountName(value), expected); assert.equal(calls.length, 1); assert.equal(nameReads, 1);
  }
  for (const value of [undefined, null, {}, '', '---', '12345', 'P12345', 'name@example.test', '<b>Jane Doe</b>',
    'Jane\nDoe', 'Jane Doe\n', 'Jane\tDoe', 'Jane\u0000Doe', 'Jane\u202eDoe', 'Jane\u2066Doe', 'Jane\u2028', 'A'.repeat(101)]) {
    assert.equal(safeAccountName(value), undefined);
    assert.deepEqual((await probe({ displayName: value })).result, { status: 'authenticated', page: 'tss' });
  }
  assert.deepEqual((await probe({ displayName: 'Jane Doe', nameFailure: true })).result, { status: 'authenticated', page: 'tss' });
  const unavailable = await probe({ displayName: 'Jane Doe', response: new Response('', { status: 503 }) });
  const rejected = await probe({ displayName: 'Jane Doe', response: new Response('', { status: 401 }) });
  for (const value of [unavailable, rejected]) { assert.equal(value.result.displayName, undefined); assert.equal(value.nameReads, 0); }
});

test('transient TSS errors differ from authentication rejection', async () => {
  for (const status of [429, 500, 503]) assert.deepEqual((await probe({ response: new Response('', { status }) })).result,
    { status: 'unavailable', page: 'tss', issue: 'service_unavailable' });
  for (const status of [401, 403]) assert.deepEqual((await probe({ response: new Response('', { status }) })).result,
    { status: 'unauthenticated', page: 'tss', issue: 'authentication_required' });
  assert.equal((await probe({ failure: new TypeError('private transport details') })).result.issue, 'network_error');
  assert.equal((await probe({ failure: new DOMException('private timing details', 'TimeoutError') })).result.issue, 'request_timeout');
});

test('false ready cannot be inferred from malformed responses or token placeholders', async () => {
  for (const response of [new Response('<html>private login</html>'), new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    new Response('{"d":[]}', { headers: { 'content-type': 'application/json', 'x-csrf-token': 'private' } })]) {
    assert.equal((await probe({ response })).result.issue, 'unexpected_response');
  }
  for (const token of ['', 'Required', 'Fetch']) assert.equal((await probe({ response: new Response('{"d":{}}', {
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
  }) })).result.issue, 'missing_csrf');
});

test('known UCSD exception and login stages expose fixed labels without requesting credentials', async () => {
  const cases = [
    ['https://a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO?execution=private', 'Web Login Service - Uncaught Exception java.lang.NullPointerException private', 'ucsd_error'],
    ['https://a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO', 'Signing on using: Active Directory private', 'credentials_ad'],
    ['https://a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO', 'Signing on using: Student SSO private', 'credentials_student'],
    ['https://tssproxy.ucsd.edu/idp/profile/SAML2/POST/SSO', '', 'login_choice'],
    ['https://api-ce13a1a7.duosecurity.com/prompt/private', '', 'duo'],
    ['https://a5.ucsd.edu.attacker.invalid/', 'Web Login Service - Uncaught Exception java.lang.NullPointerException', 'other'],
  ];
  for (const [url, text, page] of cases) {
    const { result, calls } = await probe({ url, text });
    assert.equal(result.page, page); assert.equal(result.status, 'unauthenticated'); assert.equal(calls.length, 0);
    assert.equal(result.issue, page === 'ucsd_error' ? 'ucsd_login_exception' : undefined);
  }
});

test('native shell loading preserves unavailable state; direct proof needs no shell', async () => {
  assert.deepEqual((await probe({ shell: false })).result, { status: 'unavailable', page: 'tss_loading' });
  assert.equal((await probe({ shell: false, requireShell: false })).result.status, 'authenticated');
});

test('observed proxy notice is a failed handoff, not a login choice or account creation claim', async () => {
  for (const text of ['Post-registration notice private-account', 'Thank you for registering. private-token']) {
    const { result, calls } = await probe({ url: 'https://tssproxy.ucsd.edu/idp/profile/SAML2/POST/SSO?private-token', text });
    assert.deepEqual(result, { status: 'unauthenticated', page: 'tss_proxy_error', issue: 'sso_handoff_failed' });
    assert.equal(calls.length, 0);
  }
  assert.equal((await probe({ url: 'https://tssproxy.ucsd.edu.attacker.invalid/', text: 'Post-registration notice' })).result.page, 'other');
});
