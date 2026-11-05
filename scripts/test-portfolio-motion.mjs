import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const pipSource = await readFile(new URL('../public/scripts/pip.js', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
const fallbackSource = layout.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(fallbackSource, 'the shared layout must provide the unsupported-browser entrance');

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

function fallbackFixture({ native = false, ready = 'loading', helper = true } = {}) {
  const window = new Target(), document = new Target(), main = new Target();
  document.readyState = ready; document.querySelector = selector => selector === '#main' ? main : null;
  if (native) window.onpagereveal = null;
  const reveals = [];
  if (helper) window.SiteMotion = { revealScreen: (element, options) => reveals.push({ element, kind: options.kind }) };
  vm.runInNewContext(fallbackSource, { window, document, Reflect }, { filename: 'portfolio-fallback.js' });
  return { window, document, main, reveals };
}

test('native document transitions do not stack with the DOM entrance fallback', () => {
  const f = fallbackFixture({ native: true });
  f.document.fire('DOMContentLoaded'); f.window.fire('pageshow', { persisted: true });
  assert.deepEqual(f.reveals, []);
  assert.equal(f.document.listeners.size, 0);
});

test('unsupported browsers reveal only the incoming main once after deferred helpers are ready', () => {
  const f = fallbackFixture();
  assert.deepEqual(f.reveals, []);
  f.document.fire('DOMContentLoaded'); f.document.fire('DOMContentLoaded');
  f.window.fire('pageshow', { persisted: true });
  assert.equal(f.reveals.length, 1); assert.equal(f.reveals[0].element, f.main);
  assert.equal(f.reveals[0].kind, 'portfolio');
  assert.equal(fallbackFixture({ ready: 'complete' }).reveals.length, 1);
  assert.doesNotThrow(() => fallbackFixture({ ready: 'complete', helper: false }));
});
