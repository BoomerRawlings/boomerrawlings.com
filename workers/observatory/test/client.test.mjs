import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { renderSymbol, symbolDescriptions } from '../client/symbols.js';

const source = (await readFile(new URL('../client/app.js', import.meta.url), 'utf8')).replace(/^import .*symbols\.js';\r?\n/, '');
const catalog = { destinations: [{ id: 'fixture', title: 'Synthetic hidden room', kicker: 'Fictional signal', description: 'A test-only description.', href: '/fictional-room/', accent: '#d6b77c' }] };
const okCatalog = (value = catalog) => ({ status: 200, ok: true, json: async () => value });
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

class Element {
  constructor() {
    this.listeners = new Map(); this.attributes = new Map(); this.children = [];
    this.textContent = ''; this.hidden = false; this.disabled = false; this.href = '';
    this.dataset = {}; this.style = { setProperty() {} };
    const classes = new Set();
    this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, active) => active ? classes.add(name) : classes.delete(name) };
  }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback); this.listeners.set(type, callbacks);
  }
  emit(type, event = {}) { return Promise.all((this.listeners.get(type) || []).map(callback => callback(event))); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'href') this.href = ''; }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  querySelector(selector) { return this.children.find(child => child.dataset.world === selector.match(/data-world="([^"]+)"/)?.[1]); }
  focus() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 600 }; }
}

async function fixture() {
  const elements = new Map();
  const get = selector => { if (!elements.has(selector)) elements.set(selector, Object.assign(new Element(), { ownerDocument: document })); return elements.get(selector); };
  const document = new Element();
  document.documentElement = new Element(); document.body = new Element(); document.visibilityState = 'visible';
  document.querySelector = get;
  document.createElement = () => new Element();
  document.createElementNS = () => Object.assign(new Element(), { ownerDocument: document });
  document.querySelectorAll = () => [...get('#world-list').children, ...get('#orbital-selectors').children];
  const window = new Element();
  const media = new Element(); media.matches = false;
  window.matchMedia = () => media;
  const navigations = [];
  let responder = async path => path.endsWith('/api/catalog') ? okCatalog() : { status: 200, ok: true };
  const calls = [];
  const fetch = (path, options) => { calls.push({ path, options }); return responder(path, options); };
  await vm.runInNewContext(`(async () => {\n${source}\n})()`, {
    document, window, fetch, renderSymbol, symbolDescriptions, location: { replace: path => navigations.push(path) },
  }, { filename: 'observatory-client.js' });
  assert.equal(get('#destination-title').textContent, catalog.destinations[0].title);
  assert.equal(get('#enter-world').href, catalog.destinations[0].href);
  return { get, document, window, navigations, calls, respond: callback => { responder = callback; } };
}

function assertClosed(f) {
  assert.equal(f.get('#world-list').children.length, 0);
  assert.equal(f.get('#orbital-selectors').children.length, 0);
  assert.equal(f.get('#destination-description').textContent, '');
  assert.equal(f.get('#enter-world').href, '');
  assert.equal(f.get('#enter-world').hidden, true);
  assert.notEqual(f.get('#destination-title').textContent, catalog.destinations[0].title);
}

test('visible-tab revalidation hides the former directory before I/O and stays closed on a network failure', async () => {
  const f = await fixture();
  const pending = deferred();
  f.respond(() => pending.promise);
  await f.document.emit('visibilitychange');
  assertClosed(f);
  pending.resolve({ status: 503, ok: false });
  await settle();
  assertClosed(f);
  assert.match(f.get('#status').textContent, /Reload to try again/);
  assert.equal(f.calls.at(-1).options.cache, 'no-store');
});

test('a catalog response arriving after pagehide cannot restore a private history snapshot', async () => {
  const f = await fixture();
  const pending = deferred();
  f.respond(() => pending.promise);
  await f.document.emit('visibilitychange');
  await f.window.emit('pagehide');
  pending.resolve(okCatalog());
  await settle();
  assertClosed(f);
  assert.deepEqual(f.navigations, []);
});

test('already-received catalog headers cannot restore content when JSON completes after logout', async () => {
  const f = await fixture();
  const payload = deferred();
  f.respond(async path => path.endsWith('/api/catalog')
    ? { status: 200, ok: true, json: () => payload.promise }
    : { status: 200, ok: true });
  await f.document.emit('visibilitychange');
  await settle();
  await f.get('#logout').emit('click');
  assertClosed(f);
  assert.deepEqual(f.navigations, ['/observatory/']);
  payload.resolve(catalog);
  await settle();
  assertClosed(f);
});

test('an older successful request cannot overwrite a newer failed revalidation', async () => {
  const f = await fixture();
  const older = deferred();
  let request = 0;
  f.respond(() => ++request === 1 ? older.promise : Promise.reject(new Error('offline')));
  await f.document.emit('visibilitychange');
  await f.document.emit('visibilitychange');
  await settle();
  assertClosed(f);
  older.resolve(okCatalog());
  await settle();
  assertClosed(f);
  assert.match(f.get('#status').textContent, /Reload to try again/);
});

test('restored history revalidates and redirects an expired session without restoring the directory', async () => {
  const f = await fixture();
  await f.window.emit('pagehide');
  f.respond(async () => ({ status: 401, ok: false }));
  await f.window.emit('pageshow', { persisted: true });
  await settle();
  assertClosed(f);
  assert.deepEqual(f.navigations, ['/observatory/']);
});
