import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { mountTssProjectDoor, createTssPanelWipe, TSS_ARRIVAL_KEY } from '../src/lib/tss-project-motion.ts';

class Target {
  listeners = new Map();
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(fn); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  fire(name, data = {}) { const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...data }; for (const fn of this.listeners.get(name) || []) fn(event); return event; }
}
function fixture({ reduced = false, supported = true, storageThrows = false, navigationThrows = false } = {}) {
  const browser = new Target(), media = Object.assign(new Target(), { matches: reduced });
  browser.document = Object.assign(new Target(), { visibilityState: 'visible' });
  browser.matchMedia = () => media;
  const storage = new Map(), navigations = [], timers = new Map(), animations = [];
  browser.sessionStorage = { setItem(k, v) { if (storageThrows) throw Error(); storage.set(k, v); }, removeItem(k) { if (storageThrows) throw Error(); storage.delete(k); } };
  browser.location = { origin: 'https://site.test', href: 'https://site.test/', assign(value) { if (navigationThrows) throw Error(); navigations.push(value); } };
  let sequence = 0, now = 0;
  browser.setTimeout = (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; };
  browser.clearTimeout = id => timers.delete(id);
  const tick = ms => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } };
  const wipe = { hidden: true, animate: supported ? (frames, options) => {
    let resolve, reject;
    const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
    const animation = { frames, options, finished, cancelled: false, finish: resolve, cancel() { this.cancelled = true; reject(Error('cancelled')); } };
    animations.push(animation); return animation;
  } : undefined };
  const attrs = new Map();
  const link = Object.assign(new Target(), { href: 'https://site.test/work/tss-better-booking/', target: '', focusCount: 0,
    hasAttribute: k => attrs.has(k), setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k), focus() { this.focusCount++; } });
  return { browser, media, storage, navigations, timers, tick, animations, wipe, attrs, link };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('homepage keyboard activation covers once and navigates once, then back-cache restores clean state', async () => {
  const f = fixture(); mountTssProjectDoor(f.link, f.wipe, f.browser);
  assert.equal(f.link.fire('click', { detail: 0 }).defaultPrevented, true);
  f.link.fire('click'); assert.equal(f.animations.length, 1);
  f.animations[0].finish(); await settle(); f.tick(650);
  assert.deepEqual(f.navigations, [f.link.href]); assert.match(f.storage.get(TSS_ARRIVAL_KEY), /^\d+$/);
  f.browser.fire('pagehide'); assert.equal(f.wipe.hidden, true); assert.ok(f.storage.has(TSS_ARRIVAL_KEY));
  f.browser.fire('pageshow', { persisted: true }); assert.equal(f.storage.size, 0); assert.equal(f.attrs.has('aria-busy'), false);
});
test('pagehide followed by hidden visibility preserves the committed arrival marker', async () => {
  const f = fixture(); mountTssProjectDoor(f.link, f.wipe, f.browser);
  f.link.fire('click'); f.animations[0].finish(); await settle();
  const marker = f.storage.get(TSS_ARRIVAL_KEY); assert.ok(marker);
  f.browser.fire('pagehide'); f.browser.document.visibilityState = 'hidden'; f.browser.document.fire('visibilitychange');
  assert.equal(f.storage.get(TSS_ARRIVAL_KEY), marker); assert.equal(f.wipe.hidden, true);
  assert.equal(f.navigations.length, 1); assert.equal(f.timers.size, 0);
});
test('only the committed gold-wipe navigation skips a competing native page transition', async () => {
  const f = fixture(); const dispose = mountTssProjectDoor(f.link, f.wipe, f.browser);
  let skipped = 0, rejectReady;
  const ready = new Promise((_resolve, reject) => { rejectReady = reject; });
  const event = { viewTransition: { ready, skipTransition() { skipped++; rejectReady(Error('Skipped native transition')); } } };
  f.browser.fire('pageswap', event); assert.equal(skipped, 0);
  f.link.fire('click'); f.browser.fire('pageswap', event); assert.equal(skipped, 0);
  f.animations[0].finish(); await settle(); f.browser.fire('pageswap', event); assert.equal(skipped, 1);
  await settle();
  dispose(); f.browser.fire('pageswap', event); assert.equal(skipped, 1);
});
test('modified, nonprimary, download and new-tab clicks stay native; reduced or unsupported browsers stay native', () => {
  for (const event of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
    const f = fixture(); mountTssProjectDoor(f.link, f.wipe, f.browser); f.link.fire('click', event); assert.equal(f.animations.length, 0);
  }
  for (const options of [{ reduced: true }, { supported: false }]) { const f = fixture(options); mountTssProjectDoor(f.link, f.wipe, f.browser); assert.equal(f.link.fire('click').defaultPrevented, false); }
  for (const mutate of [f => { f.link.target = '_blank'; }, f => f.attrs.set('download', ''), f => { f.link.href = 'https://other.test/work/tss-better-booking/'; }, f => { f.link.href += '?x=1'; }]) {
    const f = fixture(); mutate(f); mountTssProjectDoor(f.link, f.wipe, f.browser); assert.equal(f.link.fire('click').defaultPrevented, false);
  }
});
test('escape, visibility and a reduced-motion change cancel departure without late navigation', async () => {
  for (const cancel of [f => f.browser.fire('keydown', { key: 'Escape' }), f => { f.browser.document.visibilityState = 'hidden'; f.browser.document.fire('visibilitychange'); }, f => { f.media.matches = true; f.media.fire('change'); }]) {
    const f = fixture(); mountTssProjectDoor(f.link, f.wipe, f.browser); f.link.fire('click'); cancel(f); f.tick(1000); await settle();
    assert.equal(f.navigations.length, 0); assert.equal(f.wipe.hidden, true); assert.equal(f.attrs.has('aria-busy'), false);
  }
});
test('stalled animation, blocked storage and rejected navigation cannot trap the homepage', async () => {
  const f = fixture({ storageThrows: true }); mountTssProjectDoor(f.link, f.wipe, f.browser); f.link.fire('click'); f.tick(650);
  assert.equal(f.navigations.length, 1); f.tick(2200); await settle(); assert.equal(f.wipe.hidden, true);
  const blocked = fixture({ navigationThrows: true }); mountTssProjectDoor(blocked.link, blocked.wipe, blocked.browser); blocked.link.fire('click'); blocked.tick(650); await settle(); assert.equal(blocked.wipe.hidden, true); assert.equal(blocked.storage.size, 0);
});
test('rapid panel requests commit only the newest covered panel and release every animation', async () => {
  const f = fixture(), changes = []; const controller = createTssPanelWipe(f.wipe, f.browser);
  controller.transition(() => changes.push('first')); controller.transition(() => changes.push('latest'));
  f.animations[0].finish(); await settle(); assert.deepEqual(changes, ['latest']);
  f.animations[1].finish(); await settle(); assert.equal(f.wipe.hidden, true); assert.ok(f.animations.every(a => a.cancelled));
  controller.destroy();
});
test('new request during exit is preserved, including reverse direction', async () => {
  const f = fixture(), changes = []; const controller = createTssPanelWipe(f.wipe, f.browser);
  controller.transition(() => changes.push('one')); f.animations[0].finish(); await settle();
  controller.transition(() => changes.push('two'), true); f.animations[1].finish(); await settle();
  assert.equal(f.animations[2].frames[0].transform, 'translateX(104%)'); f.animations[2].finish(); await settle(); f.animations[3].finish(); await settle();
  assert.deepEqual(changes, ['one', 'two']); assert.equal(f.wipe.hidden, true); controller.destroy();
});
test('pagehide and reduced-motion changes settle pending panels immediately without stale commits', async () => {
  for (const cancel of [f => f.browser.fire('pagehide'), f => { f.media.matches = true; f.media.fire('change'); }]) {
    const f = fixture(), changes = []; const controller = createTssPanelWipe(f.wipe, f.browser);
    controller.transition(() => changes.push('old')); controller.transition(() => changes.push('latest')); cancel(f); await settle(); f.tick(1000); await settle();
    assert.deepEqual(changes, ['latest']); assert.equal(f.wipe.hidden, true); assert.equal(f.timers.size, 0); controller.destroy();
  }
});
test('panel deadlines finish even if browser animation promises never resolve', async () => {
  const f = fixture(), changes = []; const controller = createTssPanelWipe(f.wipe, f.browser);
  controller.transition(() => changes.push('next')); f.tick(340); await settle(); f.tick(390); await settle();
  assert.deepEqual(changes, ['next']); assert.equal(f.wipe.hidden, true); controller.destroy();
});
test('arrival consumes only a recent timestamp, skips back/forward and reduced motion, resets restored pages', async () => {
  const source = await readFile(new URL('../public/scripts/tss-project-arrival.js', import.meta.url), 'utf8');
  for (const scenario of [{ age: 100, expected: true }, { age: 10001 }, { age: -1 }, { age: 100, type: 'back_forward' }, { age: 100, reduced: true }]) {
    const clock = 100000, attrs = new Map(), events = new Target(), stored = new Map([[TSS_ARRIVAL_KEY, String(clock - scenario.age)]]);
    runInNewContext(source, { Date: { now: () => clock }, Number, sessionStorage: { getItem: k => stored.get(k), removeItem: k => stored.delete(k) }, performance: { getEntriesByType: () => [{ type: scenario.type || 'navigate' }] }, matchMedia: () => ({ matches: !!scenario.reduced }), document: { documentElement: { setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k) } }, addEventListener: events.addEventListener.bind(events) });
    assert.equal(attrs.has('data-tss-arrival'), !!scenario.expected); assert.equal(stored.size, 0); events.fire('pageshow', { persisted: true }); assert.equal(attrs.size, 0);
  }
});

async function workflowFixture({ reduced = true } = {}) {
  const f = fixture({ reduced });
  const element = (id = '') => Object.assign(new Target(), { id, hidden: false, tabIndex: 0, attrs: new Map(), focusCount: 0,
    setAttribute(k,v) { this.attrs.set(k,v); }, removeAttribute(k) { this.attrs.delete(k); }, focus() { this.focusCount++; } });
  const tabs = Array.from({ length: 7 }, (_, i) => Object.assign(element(`tab-${i}`), { querySelector: () => ({ textContent: `Stage ${i}` }) }));
  const panels = Array.from({ length: 7 }, (_, i) => element(`panel-${i}`));
  const next = Array.from({ length: 6 }, (_, i) => Object.assign(element(), { hidden: true, dataset: { workflowNext: String(i + 1) } }));
  const navigation = element(), status = element(), region = element();
  navigation.hidden = true;
  const workflow = Object.assign(element(), { dataset: {},
    querySelectorAll: selector => selector === '[data-step]' ? tabs : selector === '[data-workflow-panel]' ? panels : next,
    querySelector: selector => ({ '[data-workflow-tabs]': navigation, '[data-workflow-status]': status, '[data-workflow-wipe]': f.wipe, '.workflow-panels': region })[selector],
  });
  f.browser.document.querySelector = selector => selector === '[data-workflow]' ? workflow : null;
  const output = await build({ entryPoints: ['src/scripts/tss-project.ts'], bundle: true, write: false, format: 'iife', logLevel: 'silent' });
  runInNewContext(output.outputFiles[0].text, { window: f.browser, document: f.browser.document, URL, console });
  return { ...f, tabs, panels, next, navigation, status, region };
}
test('actual workflow initializes accessible tab/panel relationships and supports arrows, Home, End and Next', async () => {
  const f = await workflowFixture();
  assert.equal(f.navigation.hidden, false); assert.equal(f.navigation.attrs.get('role'), 'tablist');
  assert.equal(f.panels.filter(panel => !panel.hidden).length, 1);
  for (let i=0; i<7; i++) { assert.equal(f.tabs[i].attrs.get('aria-controls'), f.panels[i].id); assert.equal(f.panels[i].attrs.get('aria-labelledby'), f.tabs[i].id); }
  f.tabs[0].fire('keydown', { key: 'ArrowLeft' }); assert.equal(f.tabs[6].focusCount, 1); assert.equal(f.panels[6].hidden, false);
  f.tabs[6].fire('keydown', { key: 'Home' }); assert.equal(f.panels[0].hidden, false);
  f.tabs[0].fire('keydown', { key: 'End' }); assert.equal(f.panels[6].hidden, false);
  f.next[2].fire('click'); assert.equal(f.panels[3].hidden, false); assert.equal(f.tabs[3].focusCount, 1);
  assert.equal(f.tabs.filter(tab => tab.tabIndex === 0).length, 1); assert.equal(f.animations.length, 0);
});
test('actual animated workflow focuses the latest requested tab immediately and commits only that panel', async () => {
  const f = await workflowFixture({ reduced: false });
  f.tabs[0].fire('keydown', { key: 'ArrowRight' }); assert.equal(f.tabs[1].focusCount, 1);
  f.tabs[1].fire('keydown', { key: 'ArrowRight' }); assert.equal(f.tabs[2].focusCount, 1);
  assert.equal(f.region.attrs.get('aria-busy'), 'true');
  f.animations[0].finish(); await settle();
  assert.equal(f.panels[2].hidden, false); assert.equal(f.panels[1].hidden, true); assert.equal(f.region.attrs.has('aria-busy'), false);
  f.animations[1].finish(); await settle();
  f.tabs[2].fire('click'); assert.equal(f.animations.length, 2, 'same-target selection must not replay the wipe');
});
