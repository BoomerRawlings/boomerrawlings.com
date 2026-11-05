import test from 'node:test';
import assert from 'node:assert/strict';
import { mountRaceDeparture } from '../client/departure.js';

class Target {
  listeners = new Map();
  addEventListener(name, fn) { const list = this.listeners.get(name) || new Set(); list.add(fn); this.listeners.set(name, list); }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  fire(name, properties = {}) {
    const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (const fn of this.listeners.get(name) || []) fn(event);
    return event;
  }
}
function fixture({ reduced = false, paused = false, supported = true, navigationThrows = false, animationThrows = false } = {}) {
  const browser = new Target();
  browser.document = Object.assign(new Target(), { visibilityState: 'visible' });
  const media = Object.assign(new Target(), { matches: reduced });
  browser.matchMedia = () => media;
  const navigations = [];
  browser.location = { assign(href) { if (navigationThrows) throw new Error('blocked'); navigations.push(href); } };
  let time = 0, sequence = 0;
  const timers = new Map();
  browser.setTimeout = (fn, delay) => { const id = ++sequence; timers.set(id, { fn, at: time + delay }); return id; };
  browser.clearTimeout = id => timers.delete(id);
  const tick = ms => { time += ms; for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); } };
  const animations = [];
  const part = () => ({ animate: supported ? () => {
    if (animationThrows && animations.length === 1) throw new Error('animation unavailable');
    let finish, reject;
    const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
    const animation = { finished, finish, cancel: () => reject(new Error('cancelled')) };
    animations.push(animation); return animation;
  } : undefined });
  const parts = new Map(['field', 'lane', 'marker'].map(name => [`[data-race-${name}]`, part()]));
  const overlay = { hidden: true, querySelector: name => parts.get(name) };
  const attrs = new Map();
  const link = Object.assign(new Target(), {
    href: 'https://ucsdcannonball.com/', target: '', focusCount: 0,
    hasAttribute: name => attrs.has(name), setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name),
    focus() { this.focusCount++; },
  });
  const status = { textContent: '' };
  let motionPaused = paused;
  const control = mountRaceDeparture(link, overlay, status, browser, () => motionPaused);
  return { browser, media, link, overlay, status, attrs, control, animations, navigations, timers, tick, pause() { motionPaused = true; } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('keyboard or ordinary activation completes one direct Cannonball handoff without markers or data', async () => {
  const f = fixture();
  assert.equal(f.link.fire('click', { detail: 0 }).defaultPrevented, true);
  assert.equal(f.overlay.hidden, false);
  assert.equal(f.attrs.get('aria-busy'), 'true');
  assert.match(f.status.textContent, /Escape/);
  assert.deepEqual(f.navigations, []);
  assert.equal(f.link.fire('click').defaultPrevented, true);
  f.animations.forEach(animation => animation.finish());
  await settle();
  f.tick(800);
  assert.deepEqual(f.navigations, ['https://ucsdcannonball.com/']);
  f.browser.fire('pagehide');
  assert.equal(f.overlay.hidden, true);
  assert.equal(f.timers.size, 0);
});

test('other destinations, modified clicks, new tabs, reduced/paused motion and unsupported browsers stay native', () => {
  for (const options of [{ reduced: true }, { paused: true }, { supported: false }]) {
    const f = fixture(options);
    assert.equal(f.link.fire('click').defaultPrevented, false);
    assert.equal(f.animations.length, 0);
  }
  const f = fixture();
  for (const event of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }, { button: 2 }]) {
    assert.equal(f.link.fire('click', event).defaultPrevented, false);
  }
  f.link.target = '_blank'; assert.equal(f.link.fire('click').defaultPrevented, false);
  f.link.target = ''; f.attrs.set('download', ''); assert.equal(f.link.fire('click').defaultPrevented, false);
  f.attrs.delete('download'); f.link.href = 'https://boomerrawlings.com/fictional-room/';
  assert.equal(f.link.fire('click').defaultPrevented, false);
  assert.deepEqual(f.navigations, []);
});

test('Escape, hidden tabs, history lifecycle, changed motion and explicit reselection/logout cancellation prevent late navigation', async () => {
  const interruptions = [
    f => f.browser.fire('keydown', { key: 'Escape' }),
    f => { f.browser.document.visibilityState = 'hidden'; f.browser.document.fire('visibilitychange'); },
    f => f.browser.fire('pagehide'), f => f.browser.fire('pageshow', { persisted: true }),
    f => { f.media.matches = true; f.media.fire('change'); },
    f => f.control.cancel(), f => f.control.dispose(),
  ];
  for (const interrupt of interruptions) {
    const f = fixture(); f.link.fire('click'); interrupt(f);
    f.animations.forEach(animation => animation.finish()); f.tick(4000); await settle();
    assert.equal(f.overlay.hidden, true);
    assert.deepEqual(f.navigations, []);
    assert.equal(f.timers.size, 0);
    assert.equal(f.attrs.has('aria-busy'), false);
  }
});

test('a changed target or paused preference cannot send the previous destination after animation completion', async () => {
  for (const change of [f => { f.link.href = 'https://boomerrawlings.com/fictional-room/'; }, f => f.pause()]) {
    const f = fixture(); f.link.fire('click'); change(f);
    f.animations.forEach(animation => animation.finish()); await settle(); f.tick(4000);
    assert.equal(f.overlay.hidden, true); assert.deepEqual(f.navigations, []);
  }
});

test('missing animation completion has a bounded handoff and blocked navigation releases the overlay', async () => {
  const f = fixture(); f.link.fire('click'); f.tick(760);
  assert.deepEqual(f.navigations, ['https://ucsdcannonball.com/']);
  f.tick(2200); await settle();
  assert.equal(f.overlay.hidden, true); assert.equal(f.link.focusCount, 1);
  for (const options of [{ navigationThrows: true }, { animationThrows: true }]) {
    const blocked = fixture(options); blocked.link.fire('click'); blocked.animations.forEach(animation => animation.finish());
    await settle(); blocked.tick(3000); await settle();
    assert.equal(blocked.overlay.hidden, true);
    assert.equal(blocked.attrs.has('aria-busy'), false);
    assert.ok(blocked.navigations.length <= 1);
  }
});
