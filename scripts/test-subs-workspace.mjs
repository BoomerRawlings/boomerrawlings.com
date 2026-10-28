import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError, applyBatch, filterClasses, galleryQuery, validateCrop, cropFromDrag, rightsLabel } from '../public/subs/workspace.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('missing rights evidence is never displayed as commercial permission', () => {
  assert.equal(rightsLabel(undefined), 'RIGHTS PENDING');
  assert.equal(rightsLabel('unknown'), 'RIGHTS PENDING');
  assert.equal(rightsLabel('research'), 'RESEARCH ONLY');
  assert.equal(rightsLabel('commercial'), 'COMMERCIAL-CAPABLE');
});

test('class filters compose aliases, accents, origin, and pilot membership without conflating operators', () => {
  const classes = [
    { id: 'scorpene', name: 'Scorpène', aliases: ['Kalvari'], origin_countries: ['France', 'Spain'], operators: ['India'], pilot: true },
    { id: 'kilo', name: 'Kilo', aliases: ['Project 877'], origin_countries: ['Soviet Union'], operators: ['India'], pilot: true },
    { id: 'other', name: 'Other', origin_countries: ['France'], operators: [], pilot: false },
  ];
  assert.deepEqual(filterClasses(classes, ' SCORPENE INDIA ', 'France', true).map(item => item.id), ['scorpene']);
  assert.deepEqual(filterClasses(classes, 'Kalvari').map(item => item.id), ['scorpene']);
  assert.equal(filterClasses(classes, '', 'India').length, 0, 'operator country is not a design origin');
  assert.deepEqual(filterClasses(classes, '877', '', true).map(item => item.id), ['kilo']);
  assert.equal(filterClasses(classes, 'absent').length, 0);
});

test('gallery filters are encoded independently and cannot inject status or page parameters', () => {
  const query = galleryQuery({ q: 'sea & status=candidate', class_id: 'type-212a', domain: 'camera', rights_tier: 'research', status: '', unknown: 'ignored' }, 24);
  const params = new URL(`https://example.invalid${query}`).searchParams;
  assert.equal(params.get('q'), 'sea & status=candidate');
  assert.equal(params.get('status'), null);
  assert.equal(params.get('class_id'), 'type-212a');
  assert.equal(params.get('limit'), '24');
  assert.equal(params.get('offset'), '24');
  assert.equal(params.get('unknown'), null);
  const unknown = new URL(`https://example.invalid${galleryQuery({variant:'Unknown',operator_country:'Unknown'})}`).searchParams;
  assert.equal(unknown.get('variant'), '__unknown__');
  assert.equal(unknown.get('operator_country'), '__unknown__');
  const historical = new URL(`https://example.invalid${galleryQuery({operator_country:'Soviet Union'})}`).searchParams;
  assert.equal(historical.get('operator_country'), 'Soviet Union');
});

test('crop drawing supports reverse drags and clamps to native bounds; invalid saves fail', () => {
  assert.deepEqual(cropFromDrag([900, 600], [100, 200], 1200, 800), [100, 200, 800, 400]);
  assert.deepEqual(cropFromDrag([-10, -30], [1400, 900], 1200, 800), [0, 0, 1200, 800]);
  assert.deepEqual(validateCrop([100, 200, 800, 400], 1200, 800), [100, 200, 800, 400]);
  for (const box of [[-1, 0, 400, 200], [0, 0, 0, 100], [1000, 0, 400, 100], [0, 0, 1.5, 20], [0, 0, NaN, 20]]) {
    assert.throws(() => validateCrop(box, 1200, 800));
  }
});

test('owner credentials use an authorization header, never cookies/query, and clear immediately', async () => {
  const calls = [];
  const api = new ApiClient(async (url, options) => { calls.push({ url, options }); return json({ role: 'owner' }); });
  api.setToken(' test-owner-token ');
  await api.request('/session');
  assert.equal(calls[0].url, '/subs/api/v1/session');
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer test-owner-token');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.ok(!calls[0].url.includes('test-owner-token'));
  api.clearToken();
  await api.request('/classes');
  assert.equal(calls[1].options.headers.has('Authorization'), false);
  assert.equal(api.hasToken(), false);
});

test('the authenticated client rejects destinations outside its API path', async () => {
  let requests = 0;
  const api = new ApiClient(async () => { requests++; return json({}); }); api.setToken('token');
  for (const path of ['https://other.invalid/', '//other.invalid/', '/../outside', '/%2e%2e/outside', '/%2f%2fother.invalid/', '/foo\\bar', '/bad\r\nheader', '/%invalid']) {
    await assert.rejects(api.request(path), /Invalid collection API path/);
  }
  assert.equal(requests, 0);
});

test('correction batches preserve revisions, retain partial failures, and do not retry conflicts', async () => {
  const calls = [];
  const api = new ApiClient(async (url, options) => {
    calls.push({ url, revision: options.headers.get('If-Match'), body: JSON.parse(options.body) });
    return url.endsWith('/b') ? json({ error: { code: 'revision_conflict', message: 'Record changed' } }, 409) : json({ id: 'a', revision: 4, status: 'candidate' });
  });
  const result = await applyBatch(api, [{ id: 'a', revision: 3 }, { id: 'b', revision: 8 }], { variant: 'Block II' }, 'Source correction');
  assert.deepEqual(calls.map(item => item.revision), ['3', '8']);
  assert.equal(calls[0].body.reason, 'Source correction');
  assert.equal(result[0].image.status, 'candidate');
  assert.equal(result[1].ok, false);
  assert.equal(result[1].conflict, true);
  assert.equal(calls.length, 2);
  await assert.rejects(applyBatch(api, [{ id: 'a', revision: 3 }], {}, ' '), /reason is required/);
  assert.equal(calls.length, 2);
});

test('static fallback HTML and API errors remain failures rather than empty successful datasets', async () => {
  const html = new ApiClient(async () => new Response('<html>Fallback</html>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(html.request('/classes'), /invalid response/);
  const denied = new ApiClient(async () => json({ error: { message: 'Owner authorization required', code: 'forbidden' } }, 403));
  await assert.rejects(denied.request('/images/private'), error => error instanceof ApiError && error.status === 403 && error.code === 'forbidden');
});

test('ending an edit session stops remaining corrections even if a new key becomes available', async () => {
  let active = true, calls = 0;
  const api = { patch: async record => { calls++; active = false; return record; } };
  const results = await applyBatch(api, [{id:'a'}, {id:'b'}], {variant:'II'}, 'Documented correction', () => active);
  assert.equal(calls, 1);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.match(results[1].message, /not sent/);
});

test('protected asset downloads retain exact bytes and request private reads without browser caching', async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]); let options;
  const api = new ApiClient(async (_url, request) => { options = request; return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } }); });
  api.setToken('read-test');
  const blob = await api.request('/images/image-1/assets/original', { blob: true });
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(options.headers.get('Authorization'), 'Bearer read-test');
  assert.equal(options.cache, 'no-store');
});
