import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../client/gate.js', import.meta.url), 'utf8');
const arrivalSource = await readFile(new URL('../client/arrival.js', import.meta.url), 'utf8');
const gateHTML = await readFile(new URL('../client/gate.html', import.meta.url), 'utf8');
const KEY = 'observatory:arrival';
const NOW = 10000;
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
class Element {
  listeners = new Map();
  attributes = new Map();
  textContent = '';
  value = '';
  disabled = false;
  focused = 0;
  selected = 0;
  classes = new Set();
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) };
  addEventListener(type, callback) {
    const list = this.listeners.get(type) || [];
    list.push(callback); this.listeners.set(type, list);
  }
  emit(type, values = {}) {
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
    return Promise.all((this.listeners.get(type) || []).map(callback => callback(event)));
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  focus() { this.focused++; }
  select() { this.selected++; }
}
function fixture({ marker = null, reduced = false, blocked = '', storage = new Map(), gate = true } = {}) {
  if (marker !== null) storage.set(KEY, marker);
  const elements = new Map();
  const get = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); };
  const queries = [];
  const document = { querySelector: selector => { queries.push(selector); return get(selector); }, documentElement: new Element() };
  const form = get('#entry-form');
  form.valid = true;
  form.reportValidity = () => form.valid;
  form.querySelector = () => get('button');
  const window = new Element();
  const media = new Element(); media.matches = reduced;
  window.matchMedia = () => media;
  let clock = 0, nextTimer = 0;
  const timers = new Map();
  window.setTimeout = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id; };
  window.clearTimeout = id => timers.delete(id);
  const tick = ms => {
    clock += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); }
  };
  const storageOps = [];
  const sessionStorage = {
    getItem(key) { storageOps.push(['get', key]); if (blocked === 'get') throw new Error('storage disabled'); return storage.get(key) ?? null; },
    removeItem(key) { storageOps.push(['remove', key]); if (blocked === 'remove') throw new Error('storage disabled'); storage.delete(key); },
  };
  const calls = [], navigations = [];
  let responder = async () => ({ ok: false, status: 401 });
  const fetch = (path, options) => { calls.push({ path, options }); return responder(path, options); };
  const context = vm.createContext({
    document, window, sessionStorage, fetch,
    location: { replace: path => navigations.push(path) }, Date: { now: () => NOW },
  });
  vm.runInContext(arrivalSource, context, { filename: 'observatory-arrival.js' });
  const startGate = () => vm.runInContext(source, context, { filename: 'observatory-gate.js' });
  if (gate) startGate();
  return { get, form, document, window, media, storage, storageOps, calls, navigations, timers, tick, queries, startGate, respond: fn => { responder = fn; } };
}
const isArriving = f => f.document.documentElement.classes.has('arriving');

test('the blocking head bootstrap establishes arrival before any gate content or form module is available', () => {
  const f = fixture({ marker: JSON.stringify({ at: NOW }), gate: false });
  assert.equal(isArriving(f), true);
  assert.deepEqual(f.queries, [], 'the bootstrap must not depend on parsed body content');
  assert.equal(f.storage.has(KEY), false);
  assert.equal(f.calls.length, 0);
  const script = '<script src="/observatory/arrival.js"></script>';
  assert.ok(gateHTML.indexOf(script) > gateHTML.indexOf('<head>'));
  assert.ok(gateHTML.indexOf(script) < gateHTML.indexOf('<link rel="stylesheet"'));
  assert.match(gateHTML, /<body>\s*<div id="arrival-screen"/);
  f.startGate();
  assert.equal(isArriving(f), true);
  assert.deepEqual(f.storageOps, [['get', KEY], ['remove', KEY]], 'the later module must not read or replay the marker');
  f.tick(700);
  assert.equal(isArriving(f), false);
});

test('a motion preference changed while the gate module is loading cancels its pending arrival', () => {
  const f = fixture({ marker: JSON.stringify({ at: NOW }), gate: false });
  assert.equal(isArriving(f), true);
  f.media.matches = true;
  f.startGate();
  assert.equal(isArriving(f), false);
  assert.equal(f.timers.size, 0);
});

test('a recent arrival marker is consumed once and the entrance always releases on animation completion or timeout', async () => {
  for (const age of [0, 2500, 5000]) {
    const f = fixture({ marker: JSON.stringify({ at: NOW - age }) });
    assert.equal(isArriving(f), true);
    assert.equal(f.storage.has(KEY), false);
    assert.equal(f.timers.size, 1);
    assert.deepEqual(f.storageOps, [['get', KEY], ['remove', KEY]]);
    const restored = fixture({ storage: f.storage });
    assert.equal(isArriving(restored), false, 'a consumed marker must not replay on reload');
    if (age === 0) await f.get('#arrival-screen').emit('animationend');
    else { f.tick(699); assert.equal(isArriving(f), true); f.tick(1); }
    assert.equal(isArriving(f), false); assert.equal(f.timers.size, 0);
  }
});

test('stale, future, malformed, missing and nonnumeric arrival markers do not animate or survive consumption', () => {
  const markers = [
    JSON.stringify({ at: NOW - 5001 }), JSON.stringify({ at: NOW + 1 }),
    '{broken', '{}', 'null', '[]', JSON.stringify({ at: String(NOW) }),
    JSON.stringify({ at: true }), JSON.stringify({ at: null }), '{"at":1e309}',
  ];
  for (const marker of markers) {
    const f = fixture({ marker });
    assert.equal(isArriving(f), false, marker); assert.equal(f.timers.size, 0, marker);
    assert.equal(f.storage.has(KEY), false, marker);
  }
  assert.equal(isArriving(fixture()), false);
});

test('reduced motion suppresses arrival and changing the preference interrupts an active entrance', async () => {
  const marker = JSON.stringify({ at: NOW });
  const reduced = fixture({ marker, reduced: true });
  assert.equal(isArriving(reduced), false); assert.equal(reduced.timers.size, 0); assert.equal(reduced.storage.has(KEY), false);
  const f = fixture({ marker });
  assert.equal(isArriving(f), true);
  f.media.matches = true; await f.media.emit('change');
  assert.equal(isArriving(f), false); assert.equal(f.timers.size, 0);
});

test('pagehide and restored history remove an unfinished arrival without replaying it', async () => {
  for (const event of ['pagehide', 'pageshow']) {
    const f = fixture({ marker: JSON.stringify({ at: NOW }) });
    await f.window.emit(event, { persisted: true });
    f.tick(5000);
    assert.equal(isArriving(f), false); assert.equal(f.timers.size, 0);
    await f.window.emit('pageshow', { persisted: true });
    assert.equal(isArriving(f), false); assert.equal(f.storage.has(KEY), false);
  }
});

test('repeated submissions produce one login request; success clears the answer before navigation', async () => {
  const f = fixture(); const pending = deferred();
  f.respond(() => pending.promise);
  f.get('#password').value = 'fictionalword';
  const first = f.form.emit('submit');
  await f.form.emit('submit'); await f.form.emit('submit');
  assert.equal(f.calls.length, 1); assert.equal(f.get('button').disabled, true);
  assert.equal(f.calls[0].path, '/observatory/api/login');
  assert.equal(f.calls[0].options.method, 'POST'); assert.equal(f.calls[0].options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(f.calls[0].options.body), { password: 'fictionalword' });
  pending.resolve({ ok: true, status: 200 }); await first;
  assert.deepEqual(f.navigations, ['/observatory/']); assert.equal(f.get('#password').value, '');
});

test('an interrupted login cannot navigate, restore the submitted answer, or overwrite a later attempt', async () => {
  const f = fixture(); const old = deferred(); const newer = deferred();
  let attempts = 0;
  f.respond(() => ++attempts === 1 ? old.promise : newer.promise);
  f.get('#password').value = 'fictionalword'; const first = f.form.emit('submit');
  await f.window.emit('pagehide'); await f.window.emit('pageshow', { persisted: true });
  assert.equal(f.get('#password').value, ''); assert.equal(f.get('button').disabled, false); assert.equal(f.get('#entry-message').textContent, '');
  f.get('#password').value = 'anotherfixture'; const second = f.form.emit('submit');
  old.resolve({ ok: true, status: 200 }); await first;
  assert.deepEqual(f.navigations, []); assert.equal(f.get('button').disabled, true);
  assert.equal(f.get('#password').value, 'anotherfixture');
  newer.resolve({ ok: false, status: 401 }); await second;
  assert.equal(f.get('button').disabled, false); assert.deepEqual(f.navigations, []);
  assert.equal(f.get('#password').attributes.get('aria-invalid'), 'true');
});

test('an interrupted failed login does not repopulate the error state of a restored gate', async () => {
  const f = fixture(); const pending = deferred();
  f.respond(() => pending.promise);
  f.get('#password').value = 'fictionalword'; const submitted = f.form.emit('submit');
  await f.window.emit('pagehide'); pending.reject(new Error('offline')); await submitted;
  assert.equal(f.get('#entry-message').textContent, ''); assert.equal(f.get('#password').value, '');
  assert.equal(f.get('button').disabled, false); assert.deepEqual(f.navigations, []);
});

test('blocked storage leaves the form usable and failed requests permit a deliberate retry', async () => {
  for (const blocked of ['get', 'remove']) {
    const f = fixture({ marker: JSON.stringify({ at: NOW }), blocked });
    assert.equal(isArriving(f), false);
    f.get('#password').value = 'fictionalword';
    f.respond(async () => { throw new Error('offline'); });
    await f.form.emit('submit');
    assert.match(f.get('#entry-message').textContent, /Could not connect/);
    assert.equal(f.get('button').disabled, false);
    f.respond(async () => ({ ok: false, status: 429 })); await f.form.emit('submit');
    assert.equal(f.calls.length, 2); assert.match(f.get('#entry-message').textContent, /wait/i);
    assert.equal(f.get('button').disabled, false);
  }
});

test('browser-invalid forms never send a login request', async () => {
  const f = fixture(); f.form.valid = false;
  await f.form.emit('submit'); await settle();
  assert.equal(f.calls.length, 0); assert.equal(f.get('button').disabled, false);
});
