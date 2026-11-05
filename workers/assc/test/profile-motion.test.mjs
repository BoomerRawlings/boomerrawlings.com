import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = (await readFile(new URL('../client/profiles.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '').replace('export function createProfileController', 'function createProfileController');
function deferred() { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
const record = (id = 'sample') => ({ id, kind: 'person', label: 'Synthetic record', observedNames: [], relationships: [], replyPairs: [], events: [], passages: [], posts: [], sources: [] });

function fixture(api) {
  const nodes = [], focused = [], scrolled = [], historyChanges = [], cancellations = [], frames = new Map();
  let nextFrame = 0;
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.listeners = new Map(); this.attributes = new Map(); this.open = false; this.removed = false; this.isConnected = true; this.writes = 0; this.animations = []; }
    append(...children) { this.writes++; this.children.push(...children); for (const child of children) child.parent = this; }
    replaceChildren(...children) { this.writes++; this.children = []; this.append(...children); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    addEventListener(name, callback, { signal } = {}) { const list = this.listeners.get(name) || []; list.push(callback); this.listeners.set(name, list); signal?.addEventListener('abort', () => this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item !== callback)), { once: true }); }
    dispatchEvent(event) { for (const callback of this.listeners.get(event.type) || []) callback(event); }
    getClientRects() { return [ {} ]; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { this.removed = true; this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
    focus(options) { focused.push({ node: this, options }); }
    animate() { throw new Error('Profile must not stack a second entrance animation'); }
    getAnimations() { return this.animations; }
  }
  const document = new Element('document');
  document.body = new Element('body'); document.activeElement = new Element('button');
  document.createElement = tag => { const node = new Element(tag); nodes.push(node); return node; };
  document.querySelector = () => document.activeElement;
  document.querySelectorAll = () => [];
  const window = new Element('window');
  window.SiteMotion = { cancelScreen: node => cancellations.push(node) };
  window.scrollTo = options => scrolled.push(options);
  const location = { hash: '#bios' };
  const history = {
    state: null,
    pushState(state, _, hash) { this.state = state; location.hash = hash; historyChanges.push(hash); },
    replaceState(state, _, hash) { this.state = state; location.hash = hash; historyChanges.push(hash); },
    back() { historyChanges.push('back'); }, go(delta) { historyChanges.push(delta); },
  };
  const create = vm.runInNewContext(`${source}\ncreateProfileController`, { document, window, location, history, presentation: { text: {}, subjectId: 'fictional-subject', subjectLabel: 'Fictional Person', forumProfileIdPrefix: 'fixture-user-' }, scrollY: 55, URL, URLSearchParams, AbortController, HashChangeEvent: class { constructor(type) { this.type = type; } }, requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id) });
  const controller = create({ api });
  return { controller, document, dialog: nodes[0], body: nodes[1], focused, scrolled, historyChanges, cancellations, frames, flush() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); } };
}

test('destroyed profile ignores a delayed record and cannot reopen or navigate', async () => {
  const pending = deferred(); let requests = 0;
  const f = fixture(() => { requests++; return pending.promise; });
  const opening = f.controller.open('sample');
  let animationCancelled = 0; f.dialog.animations.push({ cancel() { animationCancelled++; } });
  f.controller.destroy(); const writes = f.body.writes;
  pending.resolve(record()); await opening;
  await f.controller.open('another'); f.controller.navigate('another');
  assert.equal(requests, 1); assert.equal(f.body.writes, writes); assert.equal(f.body.children.length, 0);
  assert.equal(f.dialog.removed, true); assert.equal(f.dialog.open, false); assert.equal(f.controller.isOpen(), false);
  assert.equal(animationCancelled, 1); assert.equal(f.cancellations.at(-1), f.body);
  assert.deepEqual(f.historyChanges, []); assert.deepEqual(f.focused, []);
  assert.equal(f.controller.closeForRoute(), false);
  f.dialog.dispatchEvent({ type: 'cancel', preventDefault() {} }); assert.deepEqual(f.historyChanges, []);
});

test('destroyed profile ignores a delayed failure without restoring an error panel', async () => {
  const pending = deferred(), f = fixture(() => pending.promise);
  const opening = f.controller.open('sample'); f.controller.destroy(); const writes = f.body.writes;
  pending.reject(new Error('Synthetic delayed failure')); await opening;
  assert.equal(f.body.writes, writes); assert.equal(f.body.children.length, 0);
});

test('destroy during relationship lookup prevents later profile sections from rendering', async () => {
  const pending = deferred(), f = fixture(path => path === 'corpus' ? pending.promise : Promise.resolve({ ...record(), graphPresent: true }));
  const opening = f.controller.open('sample'); await new Promise(resolve => setImmediate(resolve));
  f.controller.destroy(); const writes = f.body.writes;
  pending.reject(new Error('Synthetic suspended corpus request')); await opening;
  assert.equal(f.body.writes, writes); assert.equal(f.body.children.length, 0); assert.deepEqual(f.focused, []);
});

test('destroy cancels focus restoration and an already queued callback stays inert', async () => {
  const pending = deferred(), f = fixture(() => pending.promise);
  f.controller.navigate('sample', f.document.activeElement);
  const opening = f.controller.open('sample'); assert.equal(f.controller.closeForRoute(), true);
  const queued = [...f.frames.values()][0]; assert.equal(typeof queued, 'function');
  f.controller.destroy(); assert.equal(f.frames.size, 0); queued();
  pending.resolve(record()); await opening;
  assert.deepEqual(f.focused, []); assert.deepEqual(f.scrolled, []);
});

test('active profile retains native history, scroll and focus return with no duplicate animation', async () => {
  const f = fixture(async () => record());
  const origin = f.document.activeElement;
  f.controller.navigate('sample', origin); await f.controller.open('sample');
  assert.equal(f.dialog.open, true); assert.equal(f.controller.isOpen(), true);
  assert.equal(f.historyChanges[0], '#profile/sample?back=bios');
  f.focused.length = 0;
  assert.equal(f.controller.closeForRoute(), true); f.flush();
  assert.equal(f.dialog.open, false); assert.equal(f.controller.isOpen(), false);
  assert.equal(f.scrolled[0].top, 55); assert.equal(f.scrolled[0].behavior, 'instant');
  assert.equal(f.focused[0].node, origin); assert.equal(f.focused[0].options.preventScroll, true);
});
