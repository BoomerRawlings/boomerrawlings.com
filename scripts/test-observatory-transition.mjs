import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';
import { parse } from 'parse5';
import { mountObservatoryDoor, ARRIVAL_KEY } from '../src/lib/observatory-transition.ts';

test('the built homepage loads its Observatory controller as an external module allowed by its strict CSP', async () => {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  const html = parse(await readFile(resolve(dist, 'index.html'), 'utf8'));
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.childNodes || []) visit(child); };
  visit(html);
  const attribute = (node, name) => node.attrs?.find(attr => attr.name === name)?.value;
  const policy = nodes.find(node => node.tagName === 'meta' && attribute(node, 'http-equiv')?.toLowerCase() === 'content-security-policy');
  const scriptPolicy = attribute(policy, 'content')?.split(';').map(part => part.trim()).find(part => /^script-src\s/.test(part));
  assert.equal(scriptPolicy, "script-src 'self'", 'fix script delivery without weakening the homepage CSP');

  const origin = 'https://boomerrawlings.com';
  const modules = [];
  for (const script of nodes.filter(node => node.tagName === 'script')) {
    const type = attribute(script, 'type')?.toLowerCase() || '';
    if (['application/ld+json', 'application/json'].includes(type)) continue;
    const src = attribute(script, 'src');
    assert.ok(src, 'executable homepage scripts must not be inlined behind script-src self');
    assert.equal((script.childNodes || []).map(child => child.value || '').join('').trim(), '', 'external scripts must not conceal inline code');
    const url = new URL(src, `${origin}/`);
    assert.equal(url.origin, origin, 'homepage scripts must load from the same origin');
    const assetPath = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    const assetRelative = relative(dist, assetPath);
    assert.ok(assetRelative && !assetRelative.startsWith('..') && !isAbsolute(assetRelative), 'script assets must resolve inside dist');
    const code = await readFile(assetPath, 'utf8');
    if (type === 'module') modules.push({ src, code });
  }
  const controller = modules.filter(({ code }) => code.includes(ARRIVAL_KEY) && code.includes('[data-observatory-door]'));
  assert.equal(controller.length, 1, 'the actual bundled doorway controller must be linked from the homepage');
  assert.match(controller[0].code, /\.animate\(/, 'the external module must contain the transition, not an empty loader');
});

class Target {
  listeners = new Map();
  addEventListener(name, fn) { const values = this.listeners.get(name) || new Set(); values.add(fn); this.listeners.set(name, values); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  fire(name, data = {}) {
    const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...data };
    for (const fn of this.listeners.get(name) || []) fn(event);
    return event;
  }
}
function fixture({ reduced = false, supported = true, storageThrows = false, navigationThrows = false } = {}) {
  const browser = new Target();
  browser.document = Object.assign(new Target(), { visibilityState: 'visible' });
  browser.innerWidth = 1000; browser.innerHeight = 800;
  const media = Object.assign(new Target(), { matches: reduced });
  browser.matchMedia = () => media;
  const storage = new Map();
  browser.sessionStorage = {
    setItem(key, value) { if (storageThrows) throw new Error('disabled'); storage.set(key, value); },
    removeItem(key) { if (storageThrows) throw new Error('disabled'); storage.delete(key); },
  };
  const navigations = [];
  browser.location = { assign(href) { if (navigationThrows) throw new Error('blocked'); navigations.push(href); } };
  let clock = 0, sequence = 0;
  const timers = new Map();
  browser.setTimeout = (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: clock + delay }); return id; };
  browser.clearTimeout = id => timers.delete(id);
  const tick = ms => {
    clock += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn(); }
  };
  const animations = [];
  const animated = () => ({
    animate: supported ? () => {
      let resolve, reject;
      const finished = new Promise((a, b) => { resolve = a; reject = b; });
      const animation = { finished, cancel() { reject(new Error('cancelled')); }, finish() { resolve(); } };
      animations.push(animation);
      return animation;
    } : undefined,
  });
  const parts = new Map(['field', 'rule', 'register'].map(name => [`[data-transfer-${name}]`, animated()]));
  const overlay = { hidden: true, querySelector: selector => parts.get(selector) };
  const attrs = new Map();
  const link = Object.assign(new Target(), {
    href: 'https://boomerrawlings.com/observatory/', target: '', focusCount: 0,
    getBoundingClientRect: () => ({ left: 850, top: 600, width: 44, height: 44 }),
    hasAttribute: key => attrs.has(key), setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
    focus() { this.focusCount++; },
  });
  const status = { textContent: '' };
  const dispose = mountObservatoryDoor(link, overlay, status, browser);
  return { browser, media, storage, navigations, animations, tick, overlay, attrs, link, status, dispose, timers };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('ordinary and keyboard activation reveal the aperture and navigate only once after completion', async () => {
  const f = fixture();
  assert.equal(f.attrs.get('data-observatory-ready'), 'true');
  assert.equal(f.link.fire('click', { detail: 0 }).defaultPrevented, true);
  assert.equal(f.overlay.hidden, false);
  assert.equal(f.attrs.get('aria-busy'), 'true');
  assert.match(f.status.textContent, /Escape/);
  assert.equal(f.navigations.length, 0);
  assert.equal(f.link.fire('click').defaultPrevented, true);
  for (const animation of f.animations) animation.finish();
  await settle();
  assert.deepEqual(f.navigations, ['https://boomerrawlings.com/observatory/']);
  assert.deepEqual(Object.keys(JSON.parse(f.storage.get(ARRIVAL_KEY))), ['at']);
  f.link.fire('click'); f.tick(800); await settle();
  assert.equal(f.navigations.length, 1);
  f.dispose();
  assert.equal(f.attrs.has('data-observatory-ready'), false);
});

test('modified clicks, non-primary buttons and new-tab targets keep native anchor behavior', () => {
  const f = fixture();
  for (const input of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }, { defaultPrevented: true }]) {
    assert.equal(f.link.fire('click', input).defaultPrevented, !!input.defaultPrevented);
  }
  f.link.target = '_blank';
  assert.equal(f.link.fire('click').defaultPrevented, false);
  assert.equal(f.overlay.hidden, true); assert.equal(f.animations.length, 0); assert.equal(f.storage.size, 0);
  f.dispose();
});

test('reduced motion and unsupported animation navigate immediately through the native link', () => {
  for (const options of [{ reduced: true }, { supported: false }]) {
    const f = fixture(options);
    f.storage.set(ARRIVAL_KEY, 'stale');
    assert.equal(f.link.fire('click').defaultPrevented, false);
    assert.equal(f.overlay.hidden, true); assert.equal(f.animations.length, 0); assert.equal(f.timers.size, 0);
    assert.equal(f.storage.has(ARRIVAL_KEY), false);
    assert.equal(f.status.textContent, 'Opening the Observatory.');
    f.dispose();
  }
});

test('Escape cancels the departure and late animation completions cannot navigate', async () => {
  const f = fixture();
  f.link.fire('click');
  assert.equal(f.browser.fire('keydown', { key: 'Escape' }).defaultPrevented, true);
  for (const animation of f.animations) animation.finish();
  f.tick(4000); await settle();
  assert.equal(f.overlay.hidden, true); assert.equal(f.navigations.length, 0); assert.equal(f.link.focusCount, 1);
  assert.equal(f.storage.size, 0); assert.equal(f.status.textContent, '');
  f.link.fire('click');
  f.tick(800); await settle();
  assert.equal(f.navigations.length, 1);
  f.dispose();
});

test('pagehide preserves only the new arrival timestamp; Back/Forward pageshow removes overlay and marker', async () => {
  const f = fixture();
  f.link.fire('click'); f.tick(800);
  const marker = f.storage.get(ARRIVAL_KEY);
  f.browser.fire('pagehide'); await settle();
  assert.equal(f.overlay.hidden, true); assert.equal(f.storage.get(ARRIVAL_KEY), marker);
  f.browser.fire('pageshow', { persisted: true }); f.tick(8000); await settle();
  assert.equal(f.overlay.hidden, true); assert.equal(f.storage.has(ARRIVAL_KEY), false); assert.equal(f.navigations.length, 1);
  assert.equal(f.attrs.has('aria-busy'), false);
  f.link.fire('click'); f.tick(800); await settle();
  assert.equal(f.navigations.length, 2);
  f.dispose();
});

test('hidden tabs and a new reduced-motion preference interrupt departure without delayed navigation', async () => {
  for (const interrupt of ['visibility', 'motion']) {
    const f = fixture(); f.link.fire('click');
    if (interrupt === 'visibility') { f.browser.document.visibilityState = 'hidden'; f.browser.document.fire('visibilitychange'); }
    else { f.media.matches = true; f.media.fire('change'); }
    f.tick(8000); await settle();
    assert.equal(f.overlay.hidden, true); assert.equal(f.navigations.length, 0);
    f.dispose();
  }
});

test('an unfinished animation has a bounded navigation fallback and a cancelled navigation cannot trap the page', async () => {
  const f = fixture({ storageThrows: true });
  f.link.fire('click'); f.tick(799);
  assert.equal(f.navigations.length, 0);
  f.tick(1);
  assert.deepEqual(f.navigations, ['https://boomerrawlings.com/observatory/#arrival'], 'blocked storage uses only the non-secret arrival fragment');
  assert.equal(f.storage.size, 0);
  f.tick(2200); await settle();
  assert.equal(f.overlay.hidden, true); assert.equal(f.attrs.has('aria-busy'), false); assert.equal(f.link.focusCount, 1);
  f.dispose();
});

test('rejected navigation and disposal both release the overlay, listeners, and pending timers', async () => {
  const f = fixture({ navigationThrows: true });
  f.link.fire('click'); f.tick(800); await settle();
  assert.equal(f.overlay.hidden, true); assert.equal(f.storage.size, 0);
  f.link.fire('click'); f.dispose(); f.tick(8000); await settle();
  assert.equal(f.overlay.hidden, true); assert.equal(f.timers.size, 0);
  assert.equal(f.link.fire('click').defaultPrevented, false);
});
