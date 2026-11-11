import test from 'node:test';
import assert from 'node:assert/strict';
import { allowProbeRequest, authorizeNativeWrite, isReadOnlyBatch } from '../src/read-only.mjs';

const origin = 'https://tss.ucsd.edu';
const service = '/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/';
const mime = (boundary, parts) => parts.map(part => `--${boundary}\r\n${part}\r\n`).join('') + `--${boundary}--\r\n`;
const http = (method, target, headers = '', body = '') => `Content-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n${method} ${target} HTTP/1.1\r\n${headers}${headers ? '\r\n' : ''}\r\n${body}`;
const readBatch = (parts = [http('GET', 'ModuleHeaderSet', 'Accept: application/json')]) => ({
  contentType: 'multipart/mixed; boundary=batch_test', body: mime('batch_test', parts),
});
const payload = (ActionName = 'CheckRegistration') => ({
  ActionName, ModuleId: '014499', EventPackId: '167237', AcademicYear: '2026', AcademicSession: '003',
  ModregId: '00000000-0000-0000-0000-000000000000', ProgramId: '456', AssignedCg: '123', AssignedCgTop: '789', TemplateId: '100',
  Items: [{ EventId: '7898', ModuleId: '14499', EventPackId: '167237', AcademicYear: '2026', AcademicSession: '003' }],
});
const write = value => ({ url: origin + service + 'ActionHdrSet', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const batchWrite = value => ({ url: origin + service + '$batch', method: 'POST', headers: { 'content-type': 'multipart/mixed; boundary=batch_write' },
  body: mime('batch_write', [`Content-Type: multipart/mixed; boundary=changeset_test\r\n\r\n${mime('changeset_test', [http('POST', 'ActionHdrSet', 'Content-Type: application/json', JSON.stringify(value))])}`]),
});
const job = () => ({ moduleId: '14499', packageId: '167237', phase: 'check' });

test('read-only batches accept bounded bodyless GETs with ordinary or shared framing CRLF', () => {
  for (const parts of [[http('GET', 'ModuleHeaderSet')], [http('GET', 'ModuleHeaderSet', 'Accept: application/json')],
    [http('HEAD', 'ModuleHeaderSet'), http('GET', 'EventSet?$filter=ModuleId%20eq%20%2714499%27', 'Content-Length: 0')]]) {
    const batch = readBatch(parts);
    assert.equal(isReadOnlyBatch(batch.contentType, batch.body), true);
  }
  const shared = readBatch(); shared.body = shared.body.replace('Accept: application/json\r\n\r\n\r\n--', 'Accept: application/json\r\n\r\n--');
  assert.equal(isReadOnlyBatch(shared.contentType, shared.body), true);
});

test('read-only batches reject changesets, writes, bodies, overrides, duplicate headers and foreign targets', () => {
  const badParts = [http('POST', 'ModuleHeaderSet'), http('GET', 'ActionHdrSet'), http('GET', 'https://elsewhere.test/data'),
    http('GET', 'ModuleHeaderSet', '', 'unexpected body'), http('GET', 'ModuleHeaderSet', '', ' '), http('GET', 'ModuleHeaderSet', 'X-HTTP-Method: POST'),
    http('GET', 'ModuleHeaderSet', 'Transfer-Encoding: chunked'), http('GET', 'ModuleHeaderSet', 'Accept: one\r\nAccept: two'),
    http('GET', 'ModuleHeaderSet', 'Content-Length: 1')];
  for (const part of badParts) { const batch = readBatch([part]); assert.equal(isReadOnlyBatch(batch.contentType, batch.body), false); }
  const writeBatch = batchWrite(payload());
  assert.equal(isReadOnlyBatch(writeBatch.headers['content-type'], writeBatch.body), false);
  const batch = readBatch();
  assert.equal(isReadOnlyBatch(batch.contentType, batch.body.replaceAll('\r\n', '\n')), false);
  assert.equal(isReadOnlyBatch(batch.contentType, batch.body + 'extra'), false);
  assert.equal(isReadOnlyBatch(batch.contentType, 'x'.repeat(512 * 1024 + 1)), false);
});

test('probe permits reads and only the observed SAML authentication POST shapes', () => {
  assert.equal(allowProbeRequest({ url: origin + '/fiori', method: 'GET' }), true);
  assert.equal(allowProbeRequest({ url: 'https://api-example.duosecurity.com/prompt', method: 'GET' }), true);
  for (const [url, body] of [
    ['https://tssproxy.ucsd.edu/idp/profile/SAML2/POST/SSO', 'SAMLRequest=synthetic&RelayState=synthetic'],
    ['https://tssproxy.ucsd.edu/idp/profile/Authn/SAML2/POST/SSO', 'SAMLResponse=synthetic&RelayState=synthetic'],
    [origin + '/sap/public/bc/sec/saml2/sp/acs', 'SAMLResponse=synthetic&RelayState=synthetic'],
  ]) assert.equal(allowProbeRequest({ url, method: 'POST', resourceType: 'Document', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }), true);
  const batch = readBatch();
  assert.equal(allowProbeRequest({ url: origin + service + '$batch', method: 'POST', headers: { 'content-type': batch.contentType }, body: batch.body }), true);
});

test('observed tssproxy authentication callback accepts only a document SAMLResponse form', () => {
  const request = { url: 'https://tssproxy.ucsd.edu/idp/profile/Authn/SAML2/POST/SSO', method: 'POST', resourceType: 'Document',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'SAMLResponse=synthetic&RelayState=synthetic' };
  assert.equal(allowProbeRequest(request), true);
  for (const override of [{ url: request.url + '?unexpected=1' }, { url: request.url + '#fragment' },
    { url: request.url.replace('/Authn/', '/Other/') }, { url: request.url.replace('tssproxy.', 'other.') },
    { resourceType: 'XHR' }, { method: 'PUT' }, { headers: { 'content-type': 'application/json' } },
    { body: 'SAMLRequest=synthetic' }, { body: 'SAMLResponse=' }, { body: 'SAMLResponse=a&SAMLResponse=b' },
    { body: 'SAMLResponse=synthetic&other=field' }, { body: 'SAMLResponse=' + 'x'.repeat(512 * 1024) }]) {
    assert.equal(allowProbeRequest({ ...request, ...override }), false);
  }
});

test('documented SAP client ACS family allows only bounded SAMLResponse document forms on TSS', () => {
  const request = { url: origin + '/sap/saml2/sp/acs/123', method: 'POST', resourceType: 'Document',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'SAMLResponse=synthetic&RelayState=synthetic' };
  assert.equal(allowProbeRequest(request), true);
  assert.equal(allowProbeRequest({ ...request, url: request.url + '/' }), true);
  for (const suffix of ['', '12', '1234', 'abc', '123/extra', '123?sap-client=123', '123#fragment']) {
    assert.equal(allowProbeRequest({ ...request, url: origin + '/sap/saml2/sp/acs/' + suffix }), false);
  }
  for (const override of [{ url: request.url.replace('tss.', 'other.') }, { method: 'GET', url: origin + service + 'ActionHdrSet' },
    { method: 'PUT' }, { resourceType: 'XHR' }, { headers: { 'content-type': 'application/json' } },
    { body: 'SAMLRequest=synthetic' }, { body: 'SAMLResponse=' }, { body: 'SAMLResponse=a&SAMLResponse=b' },
    { body: 'SAMLResponse=synthetic&ActionName=SaveChanges' }, { body: 'SAMLResponse=' + 'x'.repeat(512 * 1024) }]) {
    assert.equal(allowProbeRequest({ ...request, ...override }), false);
  }
  assert.equal(allowProbeRequest(write(payload())), false);
  assert.equal(allowProbeRequest(batchWrite(payload())), false);
});

test('observed final fiori authentication POST accepts only a bounded SAMLResponse document form', () => {
  const request = { url: origin + '/fiori', method: 'POST', resourceType: 'Document',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'SAMLResponse=synthetic&RelayState=synthetic' };
  assert.equal(allowProbeRequest(request), true);
  assert.equal(allowProbeRequest({ ...request, body: 'SAMLResponse=synthetic' }), true);
  for (const override of [{ url: request.url + '/' }, { url: request.url + '?sap-client=500' }, { url: request.url + '#Shell-home' },
    { url: request.url.replace('tss.', 'other.') }, { resourceType: 'XHR' }, { resourceType: 'Fetch' }, { method: 'PUT' },
    { headers: { 'Content-Type': 'application/json' } }, { headers: { ...request.headers, 'X-HTTP-Method-Override': 'DELETE' } },
    { body: '' }, { body: 'username=synthetic&password=synthetic' }, { body: 'SAMLRequest=synthetic' },
    { body: 'ActionName=SaveChanges' }, { body: 'SAMLResponse=synthetic&ActionName=SaveChanges' },
    { body: 'SAMLResponse=synthetic&RelayState=a&RelayState=b' }, { body: 'SAMLResponse=a&SAMLResponse=b' },
    { body: 'SAMLResponse=' + 'x'.repeat(512 * 1024) }]) {
    assert.equal(allowProbeRequest({ ...request, ...override }), false);
  }
  assert.equal(allowProbeRequest(write(payload())), false);
  assert.equal(allowProbeRequest(batchWrite(payload())), false);
});

test('probe rejects arbitrary UCSD/Duo writes, credential-shaped unknown forms and ambiguous SAML', () => {
  const request = { method: 'POST', resourceType: 'document', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'SAMLRequest=synthetic' };
  for (const url of ['https://ucsd.edu/update', 'https://other.ucsd.edu/action', 'https://api-example.duosecurity.com/unknown',
    'https://tssproxy.ucsd.edu/unknown', 'https://evil.test/idp/profile/SAML2/POST/SSO', 'https://tssproxy.ucsd.edu.evil.test/idp/profile/SAML2/POST/SSO']) {
    assert.equal(allowProbeRequest({ ...request, url }), false);
  }
  const url = 'https://tssproxy.ucsd.edu/idp/profile/SAML2/POST/SSO';
  for (const body of ['SAMLRequest=', 'SAMLRequest=a&SAMLRequest=b', 'SAMLRequest=a&password=never', 'username=never&password=never']) {
    assert.equal(allowProbeRequest({ ...request, url, body }), false);
  }
  assert.equal(allowProbeRequest({ ...request, url, resourceType: 'XHR' }), false);
  assert.equal(allowProbeRequest({ ...request, url, headers: { ...request.headers, 'X-HTTP-Method-Override': 'DELETE' } }), false);
  assert.equal(allowProbeRequest({ url: origin + service + 'ActionHdrSet', method: 'GET' }), false);
  assert.equal(allowProbeRequest(write(payload())), false);
});

test('probe permits only the observed a5 login form endpoint and execution query', () => {
  const url = 'https://a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO?execution=e1s1';
  const request = { url, method: 'POST', resourceType: 'Document', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: 'synthetic=fixture' };
  assert.equal(allowProbeRequest(request), true);
  assert.equal(allowProbeRequest({ ...request, url: url.replace('e1s1', 'e12s345') }), true);
  for (const invalid of [url.replace('a5.', 'other.'), url.replace('/SSO?', '/other?'), url.replace('?execution=e1s1', ''),
    url + '&extra=1', url + '&execution=e2s2', url.replace('e1s1', 'invalid'), url + '#fragment']) {
    assert.equal(allowProbeRequest({ ...request, url: invalid }), false);
  }
  for (const override of [{ method: 'PUT' }, { resourceType: 'XHR' }, { headers: { 'content-type': 'application/json' } },
    { headers: { ...request.headers, 'X-HTTP-Method-Override': 'DELETE' } }, { body: '' }, { body: undefined },
    { body: 'x'.repeat(64 * 1024 + 1) }, { body: '\u00e9'.repeat(33 * 1024) }]) {
    assert.equal(allowProbeRequest({ ...request, ...override }), false);
  }
});

test('probe permits bounded auth POSTs only within the observed UCSD Duo tenant prompt/frame paths', () => {
  const tenant = 'https://api-ce13a1a7.duosecurity.com';
  const request = { url: tenant + '/prompt/synthetic', method: 'POST', resourceType: 'document', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'synthetic=fixture' };
  for (const path of ['/prompt/synthetic', '/frame/v4/preauth', '/frame/v4/auth?synthetic=fixture']) {
    for (const resourceType of ['document', 'XHR', 'Fetch']) {
      for (const contentType of ['application/x-www-form-urlencoded', 'application/json; charset=utf-8']) {
        assert.equal(allowProbeRequest({ ...request, url: tenant + path, resourceType, headers: { 'content-type': contentType } }), true);
      }
    }
  }
  for (const url of [tenant + '/admin/v1/auth', tenant + '/auth/v2/auth', tenant + '/prompt', tenant + '/frame-other/action',
    tenant + '/frame/%2e%2e%2fadmin/action', tenant + '/frame/%252e%252e/admin', tenant + '/frame/action#fragment',
    'https://api-other.duosecurity.com/frame/v4/preauth', 'https://api-ce13a1a7.duosecurity.com.evil.test/frame/v4/preauth']) {
    assert.equal(allowProbeRequest({ ...request, url }), false);
  }
  for (const override of [{ method: 'DELETE' }, { resourceType: 'image' }, { headers: { 'content-type': 'text/plain' } },
    { headers: { ...request.headers, 'X-HTTP-Method': 'DELETE' } }, { body: '' }, { body: 'x'.repeat(64 * 1024 + 1) }]) {
    assert.equal(allowProbeRequest({ ...request, ...override }), false);
  }
  assert.equal(allowProbeRequest(write(payload())), false);
  assert.equal(allowProbeRequest(batchWrite(payload())), false);
});

test('native direct writes require active job and exactly one matching check then save', () => {
  const state = job();
  assert.equal(authorizeNativeWrite(write(payload()), null), false);
  assert.equal(authorizeNativeWrite(write(payload('SaveChanges')), state), false);
  assert.equal(authorizeNativeWrite(write(payload()), state), true); assert.equal(state.phase, 'save');
  assert.equal(authorizeNativeWrite(write(payload()), state), false);
  assert.equal(authorizeNativeWrite(write(payload('SaveChanges')), state), true); assert.equal(state.phase, 'complete');
  assert.equal('writeFingerprint' in state, false);
  assert.equal(authorizeNativeWrite(write(payload('SaveChanges')), state), false);
});

test('native batch writes accept exactly one JSON ActionHdrSet POST within exactly one changeset', () => {
  const state = job();
  assert.equal(authorizeNativeWrite(batchWrite(payload()), state), true);
  assert.equal(authorizeNativeWrite(batchWrite(payload('SaveChanges')), state), true);
  const two = batchWrite(payload());
  two.body = mime('batch_write', [`Content-Type: multipart/mixed; boundary=changeset_test\r\n\r\n${mime('changeset_test', [http('POST', 'ActionHdrSet', 'Content-Type: application/json', JSON.stringify(payload())), http('POST', 'ActionHdrSet', 'Content-Type: application/json', JSON.stringify(payload()))])}`]);
  assert.equal(authorizeNativeWrite(two, job()), false);
  const foreign = batchWrite(payload()); foreign.body = foreign.body.replace('POST ActionHdrSet ', 'POST https://elsewhere.test/ActionHdrSet ');
  assert.equal(authorizeNativeWrite(foreign, job()), false);
});

test('native gate rejects drop, wrong course/term, extra assessments, duplicate sections and changed save payload', () => {
  const mutations = [p => { p.ActionName = 'CancelBooking'; }, p => { p.EventPackId = '167238'; }, p => { p.AcademicYear = '2027'; },
    p => { p.Items[0].Cancel = true; }, p => { p.Items[0].AssessmentId = '1'; }, p => { p.Items[0].Resit = true; },
    p => { p.Items.push({ ...p.Items[0] }); }, p => { p.ModregId = '11111111-1111-1111-1111-111111111111'; }, p => { p.Unexpected = true; }];
  for (const mutate of mutations) { const value = payload(); mutate(value); assert.equal(authorizeNativeWrite(write(value), job()), false); assert.equal(authorizeNativeWrite(batchWrite(value), job()), false); }
  const state = job(); assert.equal(authorizeNativeWrite(write(payload()), state), true);
  const changed = payload('SaveChanges'); changed.TemplateId = 'different';
  assert.equal(authorizeNativeWrite(write(changed), state), false); assert.equal(state.phase, 'save');
  const query = write(payload()); query.url += '?unexpected=1'; assert.equal(authorizeNativeWrite(query, job()), false);
});
