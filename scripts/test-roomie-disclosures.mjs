import test from 'node:test';
import assert from 'node:assert/strict';
import { enhanceDisclosures } from '../src/scripts/roomie-disclosures.ts';

// Minimal geometry harness for state-machine checks; actual layout is browser QA.
test('disclosures preserve intent, reverse, settle, and honor reduced motion', () => {
  const names = ['window', 'document', 'HTMLElement', 'Element', 'getComputedStyle', 'requestAnimationFrame'];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  let pending;
  let motionListener;
  const media = { matches: false, addEventListener: (_, fn) => { motionListener = fn; } };
  class Element {
    constructor(tag = 'DIV') {
      this.tagName = tag; this.dataset = {}; this.attributes = new Map(); this.listeners = {};
      this.style = { removeProperty(key) { delete this[key]; } };
      this.open = false; this.hidden = false; this.parent = null;
    }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    toggleAttribute(name, value) { if (value) this.setAttribute(name, ''); else this.removeAttribute(name); }
    contains(node) { return node === this || node?.parent === this; }
    getClientRects() { return this.hidden ? [] : [{}]; }
    getBoundingClientRect() { return { height: this.style.height ? parseFloat(this.style.height) : this.tagName === 'SUMMARY' ? 40 : this.open ? 240 : 40 }; }
    focus() { document.activeElement = this; }
    closest(selector) { return selector === 'summary' ? this : null; }
  }
  const details = new Element('DETAILS');
  const summary = new Element('SUMMARY');
  const content = new Element();
  details.firstElementChild = summary; summary.nextElementSibling = content;
  content.parent = details; summary.parent = details;
  const root = new Element(); details.parent = root;
  root.querySelectorAll = () => [details];
  try {
    Object.assign(globalThis, {
      window: { matchMedia: () => media }, document: { activeElement: null }, HTMLElement: Element, Element,
      getComputedStyle: () => ({ paddingTop: '0', paddingBottom: '0', borderTopWidth: '0', borderBottomWidth: '0' }),
      requestAnimationFrame: callback => { pending = callback; return 1; },
    });
    let notifications = 0;
    const api = enhanceDisclosures(root, () => notifications++);
    const settle = () => { const callback = pending; pending = undefined; callback?.(performance.now() + 1000); };
    api.setOpen(details, true);
    assert.equal(api.isOpen(details), true);
    assert.equal(details.open, true);
    assert.equal(details.dataset.disclosureAnimating, '');
    settle();
    assert.equal(details.style.height, undefined);
    assert.equal(details.style.overflow, undefined);
    assert.equal(content.style.transform, undefined);
    document.activeElement = content;
    api.setOpen(details, false);
    assert.equal(document.activeElement, summary);
    assert.equal(details.open, true, 'native content stays rendered during collapse');
    assert.equal(api.isOpen(details), false, 'logical intent changes immediately');
    assert.equal(summary.attributes.get('aria-expanded'), 'false');
    api.setOpen(details, true);
    settle();
    assert.equal(details.open, true, 'rapid reverse ends open');
    api.setOpen(details, false);
    api.finishWithin(root);
    assert.equal(details.open, false);
    assert.equal(content.attributes.has('inert'), false);
    assert.equal(details.style.height, undefined);
    api.setOpen(details, true);
    media.matches = true; motionListener();
    assert.equal(details.dataset.disclosureAnimating, undefined);
    api.setOpen(details, false);
    assert.equal(details.open, false, 'reduced motion is immediate');
    assert.equal(details.style.height, undefined);
    const event = { target: summary, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    summary.listeners.click(event);
    assert.equal(details.open, true, 'native keyboard-generated click toggles');
    assert.equal(event.defaultPrevented, true);
    assert.ok(notifications >= 6);
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
