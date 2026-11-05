import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../public/scripts/screen-motion.js', import.meta.url), 'utf8');
function setup({ reduced = false, script = null, loading = false } = {}) {
  const events = new Map();
  const media = { matches: reduced, addEventListener: (_, fn) => events.set('motion', fn) };
  const animations = [];
  const surface = { isConnected: true, closest: () => null, animate(frames, options) {
    let finish;
    const animation = { frames, options, cancelled: false, finished: new Promise(resolve => { finish = resolve; }), cancel() { this.cancelled = true; finish(); }, finish };
    animations.push(animation);
    return animation;
  } };
  const document = {
    documentElement: { dataset: {} }, readyState: loading ? 'loading' : 'interactive',
    querySelector: selector => selector.startsWith('script') ? script : surface,
    addEventListener: (name, fn) => events.set(name, fn),
  };
  const window = { matchMedia: () => media, addEventListener: (name, fn) => events.set(name, fn) };
  vm.runInNewContext(source, { window, document });
  return { api: window.SiteMotion, window, document, surface, media, events, animations };
}

test('reveals immediately and never locks or replaces the surface', () => {
  const { api, surface, animations } = setup();
  assert.equal(api.revealScreen(surface, { kind: 'paper' }), animations[0]);
  assert.equal(animations[0].options.duration, 220);
  assert.equal(animations[0].frames[0].translate, '12px 3px');
  assert.equal(surface.hidden, undefined);
});
test('new screen wins immediately; an old completion cannot cancel the replacement', async () => {
  const { api, surface, animations } = setup();
  api.revealScreen(surface);
  api.revealScreen(surface, { kind: 'paper', direction: -1 });
  assert.equal(animations[0].cancelled, true);
  await Promise.resolve();
  assert.equal(animations[1].cancelled, false);
  assert.equal(animations[1].frames[0].translate, '-12px 3px');
  api.cancelScreen(surface);
  assert.equal(animations[1].cancelled, true);
});
test('backward instrument navigation reverses its vertical axis', () => {
  const { api, surface, animations } = setup();
  api.revealScreen(surface, { kind: 'instrument', direction: -1 });
  assert.equal(animations[0].frames[0].translate, '0 -8px');
});
test('motion preference and document lifecycle cancel running surfaces', () => {
  const { api, surface, media, events, animations } = setup();
  api.revealScreen(surface);
  media.matches = true; events.get('motion')();
  assert.equal(animations[0].cancelled, true);
  assert.equal(api.revealScreen(surface), null);
  media.matches = false;
  api.revealScreen(surface); events.get('pagehide')();
  assert.equal(animations[1].cancelled, true);
  events.get('pageshow')({ persisted: true });
  api.revealScreen(surface); events.get('pageshow')({ persisted: true });
  assert.equal(animations[2].cancelled, true);
});
test('late renders after pagehide and background work cannot restart motion', () => {
  const { api, surface, document, events, animations } = setup();
  events.get('pagehide')(); assert.equal(api.revealScreen(surface), null);
  events.get('pageshow')({ persisted: true });
  api.revealScreen(surface);
  document.visibilityState = 'hidden'; events.get('visibilitychange')();
  assert.equal(animations[0].cancelled, true);
  assert.equal(api.revealScreen(surface), null);
  document.visibilityState = 'visible';
  api.revealScreen(surface); assert.equal(animations.length, 2);
});
test('hidden, inert, disconnected and unsupported surfaces stay native', () => {
  const { api, surface, animations } = setup();
  surface.closest = () => ({}); assert.equal(api.revealScreen(surface), null);
  surface.closest = () => null; surface.isConnected = false; assert.equal(api.revealScreen(surface), null);
  surface.isConnected = true; surface.animate = undefined; assert.equal(api.revealScreen(surface), null);
  assert.equal(animations.length, 0);
  assert.equal(api.revealScreen(null), null);
});
test('a failed browser animation cannot prevent a completed screen render', () => {
  const { api, surface } = setup();
  surface.animate = () => { throw new Error('unsupported'); };
  assert.equal(api.revealScreen(surface), null);
});
test('shell opt-in waits only for DOM readiness; helper-only scripts do not animate', () => {
  const helper = setup(); assert.equal(helper.animations.length, 0);
  const page = setup({ loading: true, script: { dataset: { pageMotion: 'instrument', motionTarget: '#screen' } } });
  assert.equal(page.animations.length, 0);
  page.events.get('DOMContentLoaded')();
  assert.equal(page.animations.length, 1);
  assert.equal(page.document.documentElement.dataset.siteMotionReady, 'true');
});
test('no navigation interception, storage, fetching or content snapshot APIs', () => {
  assert.doesNotMatch(source, /preventDefault|location\.|sessionStorage|localStorage|fetch\(|cloneNode|startViewTransition|MutationObserver/);
});
