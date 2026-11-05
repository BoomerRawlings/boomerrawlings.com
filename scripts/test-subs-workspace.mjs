import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
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

function workspaceMotionFixture(withMotion = true) {
  const nodes = new Map(), reveals = [], cancelled = [];
  let focused;
  function node(id) {
    if (!nodes.has(id)) {
      const events = new Map(), attributes = new Map();
      nodes.set(id, {
        id, dataset: {}, hidden: false, open: false, value: '', textContent: '', children: [], checked: false,
        addEventListener(type, fn) { const list = events.get(type) || []; list.push(fn); events.set(type, list); },
        async emit(type, values = {}) { const event = { target: this, currentTarget: this, preventDefault() {}, ...values }; for (const fn of events.get(type) || []) await fn(event); },
        setAttribute(name, value) { attributes.set(name, value); }, getAttribute(name) { return attributes.get(name); }, removeAttribute(name) { attributes.delete(name); },
        append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = children; }, get firstChild() { return this.children[0]; },
        querySelectorAll() { return []; }, querySelector(selector) { return node(`${id} ${selector}`); },
        focus() { focused = id; }, showModal() { this.open = true; }, close() { this.open = false; void this.emit('close'); },
      });
    }
    return nodes.get(id);
  }
  const names = ['active', 'gallery', 'releases', 'history'];
  const tabs = names.map(name => { const item = node(`tab-${name}`); item.dataset.tab = name; return item; });
  const panels = names.map(name => { const item = node(`panel-${name}`); item.dataset.panel = name; item.hidden = name !== 'active'; return item; });
  node('subs-roster').textContent = '{"classes":[]}';
  let created = 0;
  const document = {
    getElementById: node, createElement: tag => node(`${tag}-${++created}`),
    querySelectorAll: selector => selector === '[data-tab]' ? tabs : selector === '[data-panel]' ? panels : [],
  };
  const window = { addEventListener() {} };
  if (withMotion) window.SiteMotion = {
    revealScreen(target, options) { reveals.push({ id: target.id, kind: options.kind, hidden: target.hidden, open: target.open }); },
    cancelScreen(target) { cancelled.push(target.id); },
  };
  const source = readFileSync(new URL('../public/subs/workspace.js', import.meta.url), 'utf8').replace(/^export /gm, '');
  runInNewContext(source, {
    document, window, URL, URLSearchParams, Headers, Blob, AbortController, queueMicrotask,
    fetch: async () => json({ items: [], total: 0 }),
    FormData: class { *[Symbol.iterator]() {} }, setTimeout: () => 0, clearTimeout() {},
  }, { filename: 'subs-workspace.js' });
  return { node, reveals, cancelled, get focused() { return focused; } };
}

test('workspace reveals changed tabs after selection while filters and repeated tabs remain still', async () => {
  const ui = workspaceMotionFixture();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(ui.reveals, [], 'initial data loading must not animate the hidden workspace');
  await ui.node('tab-gallery').emit('click');
  assert.deepEqual(ui.reveals.map(item => [item.id, item.kind, item.hidden]), [['panel-gallery', 'instrument', false]]);
  assert.equal(ui.node('tab-gallery').getAttribute('aria-selected'), 'true');
  assert.equal(ui.node('panel-active').hidden, true);
  await ui.node('tab-gallery').emit('click');
  await ui.node('active-search').emit('input');
  await ui.node('gallery-filters').emit('submit');
  assert.equal(ui.reveals.length, 1, 'refreshing a panel must not restart its reveal');
  await ui.node('tab-gallery').emit('keydown', { key: 'ArrowRight' });
  assert.equal(ui.focused, 'tab-releases');
  assert.equal(ui.reveals.at(-1).id, 'panel-releases');
  assert.ok(ui.cancelled.includes('panel-gallery'), 'hidden panels release any in-flight effect');
});

test('workspace dialogs reveal once after opening and cancel on native close; missing motion never blocks navigation', async () => {
  const ui = workspaceMotionFixture();
  await ui.node('owner-open').emit('click');
  await ui.node('owner-open').emit('click');
  assert.deepEqual(ui.reveals.map(item => [item.id, item.kind, item.open]), [['owner-dialog', 'instrument', true]]);
  assert.equal(ui.focused, 'owner-key');
  ui.node('owner-dialog').close();
  assert.ok(ui.cancelled.includes('owner-dialog'));
  await ui.node('owner-open').emit('click');
  assert.equal(ui.reveals.length, 2);
  const plain = workspaceMotionFixture(false);
  await plain.node('tab-history').emit('click');
  await plain.node('owner-open').emit('click');
  assert.equal(plain.node('panel-history').hidden, false);
  assert.equal(plain.node('owner-dialog').open, true);
});
