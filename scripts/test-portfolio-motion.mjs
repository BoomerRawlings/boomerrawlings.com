import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pipSource = await readFile(new URL('../public/scripts/pip.js', import.meta.url), 'utf8');
const fallbackSource = await readFile(new URL('../public/scripts/portfolio-motion.js', import.meta.url), 'utf8');

class Target {
  listeners = new Map();
  dataset = {};
  attributes = new Map();
  classes = new Set();
  classList = { add: value => this.classes.add(value), remove: (...values) => values.forEach(value => this.classes.delete(value)) };
  textContent = '';
  hidden = false;
  disabled = false;
  addEventListener(type, handler, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ handler, once: options.once }); this.listeners.set(type, entries);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  fire(type, properties = {}) {
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
    const entries = this.listeners.get(type) || [];
    if (entries.length) this.listeners.set(type, entries.filter(entry => !entry.once));
    for (const entry of entries) entry.handler(event);
    return event;
  }
}

function pipFixture({ terminal = false, blockedStorage = false, failingAudio = false } = {}) {
  const guide = new Target();
  guide.dataset.pipSteps = JSON.stringify(['First note', 'Final note']);
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Target());
    return nodes.get(selector);
  };
  guide.querySelector = selector => selector === '.portfolio-curator' ? null : get(selector);
  const form = get('[data-pip-form]');
  form.action = 'https://boomerrawlings.com/about/';
  form.dataset.pipDestination = 'About';
  if (terminal) form.dataset.pipTerminal = 'true';
  form.querySelector = get;
  const window = new Target();
  const document = new Target();
  const anchor = new Target();
  document.documentElement = new Target();
  document.querySelectorAll = selector => selector === '[data-pip-guide]' ? [guide] : selector === 'a[href]' ? [anchor] : [];
  const timers = [], navigations = [];
  window.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return timers.length; };
  window.clearTimeout = () => {};
  window.location = { pathname: '/', assign: url => navigations.push(url) };
  const storage = { getItem() { if (blockedStorage) throw new Error('disabled'); return null; }, setItem() {}, removeItem() {} };
  window.localStorage = storage; window.sessionStorage = storage;
  if (failingAudio) window.AudioContext = class { constructor() { throw new Error('unavailable'); } };
  vm.runInNewContext(pipSource, { window, document }, { filename: 'pip.js' });
  return { get, form, guide, window, document, anchor, timers, navigations };
}

test('Pip note steps stay local, while the final step submits natively without a navigation timer', () => {
  for (const options of [{}, { blockedStorage: true, failingAudio: true }]) {
    const f = pipFixture(options);
    assert.equal(f.form.fire('submit').defaultPrevented, true);
    assert.equal(f.get('[data-pip-message]').textContent, 'Final note');
    const priorTimers = f.timers.length;
    assert.equal(f.form.fire('submit').defaultPrevented, false);
    assert.equal(f.timers.length, priorTimers, 'navigation must not wait for sound or animation');
    assert.deepEqual(f.navigations, [], 'the browser owns the real form submission');
    assert.equal(f.form.fire('submit').defaultPrevented, false, 'no stale navigation lock may swallow another native submission');
  }
});

test('Pip never intercepts page links, modifier clicks, downloads, anchors or the bespoke Observatory doorway', () => {
  const f = pipFixture();
  assert.equal(f.anchor.listeners.size, 0);
  assert.equal(f.document.listeners.has('click'), false);
  assert.equal(f.window.listeners.has('click'), false);
});

test('Pip Back and browser history restore notes, while terminal tours cannot navigate', () => {
  const f = pipFixture();
  f.form.fire('submit');
  f.get('[data-pip-back]').fire('click');
  assert.equal(f.get('[data-pip-message]').textContent, 'First note');
  f.form.fire('submit'); f.window.fire('pageshow', { persisted: true });
  assert.equal(f.get('[data-pip-message]').textContent, 'First note');
  assert.equal(f.get('[data-pip-back]').hidden, true);
  const terminal = pipFixture({ terminal: true });
  terminal.form.fire('submit');
  assert.equal(terminal.get('button[type="submit"]').disabled, true);
  assert.equal(terminal.get('[data-pip-next-label]').textContent, 'Tour complete');
  assert.equal(terminal.form.fire('submit').defaultPrevented, true);
});

function fallbackFixture({ native = true, ready = 'loading', helper = true } = {}) {
  const window = new Target(), document = new Target(), main = new Target();
  document.readyState = ready; document.querySelector = selector => selector === '#main' ? main : null;
  if (native) window.onpagereveal = null;
  const reveals = [], microtasks = [];
  let helperSuspended = false;
  const installHelper = () => {
    window.SiteMotion = { revealScreen: (element, options) => {
      assert.equal(helperSuspended, false, 'the later shared helper must resume before the fallback');
      reveals.push({ element, kind: options.kind });
    } };
  };
  if (helper) installHelper();
  vm.runInNewContext(fallbackSource, { window, document, queueMicrotask: fn => microtasks.push(fn) }, { filename: 'portfolio-motion.js' });
  // The real helper is deferred and registers these after the early controller.
  window.addEventListener('pagehide', () => { helperSuspended = true; });
  window.addEventListener('pageshow', () => { helperSuspended = false; });
  const flush = () => { while (microtasks.length) microtasks.shift()(); };
  const domReady = () => { document.readyState = 'interactive'; document.fire('DOMContentLoaded'); };
  return { window, document, main, reveals, installHelper, flush, domReady };
}

test('successful native arrivals never stack the DOM fallback, before or after DOM readiness', () => {
  for (const eventFirst of [true, false]) {
    const f = fallbackFixture();
    if (!eventFirst) { f.domReady(); f.flush(); }
    f.window.fire('pagereveal', { viewTransition: {} }); f.flush();
    f.domReady(); f.flush();
    assert.deepEqual(f.reveals, []);
  }
});

test('a direct or protected-to-portfolio arrival reveals main even when pagereveal is supported', () => {
  const f = fallbackFixture();
  f.domReady(); f.flush();
  assert.deepEqual(f.reveals, []);
  f.window.fire('pagereveal', { viewTransition: null }); f.flush();
  f.window.fire('pagereveal', { viewTransition: null }); f.domReady(); f.flush();
  assert.equal(f.reveals.length, 1); assert.equal(f.reveals[0].element, f.main);
  assert.equal(f.reveals[0].kind, 'portfolio');
});

test('an early null pagereveal waits for the deferred helper and parsed incoming content', () => {
  const f = fallbackFixture({ helper: false });
  f.window.fire('pagereveal', { viewTransition: null }); f.flush();
  assert.deepEqual(f.reveals, []);
  f.installHelper(); f.domReady(); f.flush();
  assert.equal(f.reveals.length, 1);
  const missing = fallbackFixture({ ready: 'complete', helper: false });
  missing.window.fire('pagereveal', { viewTransition: null });
  assert.doesNotThrow(missing.flush);
});

test('unsupported browsers reveal once after readiness without intercepting links or creating snapshots', () => {
  const f = fallbackFixture({ native: false });
  f.domReady(); f.domReady(); f.flush();
  assert.equal(f.reveals.length, 1);
  const complete = fallbackFixture({ native: false, ready: 'complete' });
  complete.flush(); assert.equal(complete.reveals.length, 1);
  assert.equal(f.window.listeners.has('click'), false); assert.equal(f.document.listeners.has('click'), false);
  assert.doesNotMatch(fallbackSource, /startViewTransition|preventDefault|sessionStorage|localStorage|location\.|fetch\(/);
});

test('pagehide cancels queued entrance work and restored pages wait for their own native decision', () => {
  const f = fallbackFixture({ ready: 'complete' });
  f.window.fire('pagereveal', { viewTransition: null });
  f.window.fire('pagehide'); f.flush();
  assert.deepEqual(f.reveals, []);
  f.window.fire('pageshow', { persisted: true }); f.flush();
  assert.deepEqual(f.reveals, []);
  f.window.fire('pagereveal', { viewTransition: {} }); f.flush();
  assert.deepEqual(f.reveals, []);
  f.window.fire('pagehide'); f.window.fire('pageshow', { persisted: true });
  f.window.fire('pagereveal', { viewTransition: null }); f.flush();
  assert.equal(f.reveals.length, 1);
});

test('unsupported history restores reveal after the later helper pageshow listener has resumed', () => {
  const f = fallbackFixture({ native: false, ready: 'complete' });
  f.flush(); assert.equal(f.reveals.length, 1);
  f.window.fire('pagehide'); f.window.fire('pageshow', { persisted: true }); f.flush();
  assert.equal(f.reveals.length, 2);
});
