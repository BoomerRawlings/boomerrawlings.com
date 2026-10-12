import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'parse5';

const source = readFileSync(new URL('../public/ACF/entry.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../src/pages/ACF/index.astro', import.meta.url), 'utf8');
const flush = () => new Promise(setImmediate);
const event = (type, properties = {}) => Object.assign(new Event(type, { cancelable: true }), properties);

// Exercise the real script against the real markup. This deliberately models only
// the DOM APIs used by the entrance; rendered geometry belongs to browser checks.
function harness({ reduced = false, animationAPI = true } = {}) {
  let now = 0, timerId = 0, animations = 0, enters = 0, exits = 0;
  const timers = new Map(), ids = new Map();
  const document = new EventTarget(), window = new EventTarget();
  document.hidden = false;
  const schedule = (callback, delay = 0) => {
    const id = ++timerId;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  const clear = id => timers.delete(id);
  class Element extends EventTarget {
    constructor(tag = 'div', attributes = []) {
      super();
      this.tagName = tag.toUpperCase();
      this.attributes = new Map(attributes.map(a => [a.name, a.value]));
      this.children = []; this.parentElement = null;
      this.hidden = this.attributes.has('hidden'); this.inert = this.attributes.has('inert');
      this.open = this.attributes.has('open'); this.readOnly = false; this.disabled = false;
      this.value = ''; this.textContent = ''; this.innerHTML = ''; this.scrollTop = 0;
      this.focusCount = 0; this.selectCount = 0;
      const classes = new Set((this.attributes.get('class') || '').split(/\s+/).filter(Boolean));
      this.classList = {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        contains: name => classes.has(name),
      };
      if (!animationAPI) this.animate = undefined;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { document.activeElement = this; this.focusCount++; }
    blur() { if (document.activeElement === this) document.activeElement = null; }
    select() { this.selectCount++; }
    append(child) { this.children.push(child); child.parentElement = this; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
    close() { this.open = false; this.removeAttribute('open'); }
    querySelector(selector) {
      assert(selector.startsWith('.'), `Unexpected selector ${selector}`);
      const descendants = [...this.children];
      for (let i = 0; i < descendants.length; i++) descendants.push(...descendants[i].children);
      return descendants.find(n => n.classList.contains(selector.slice(1))) || null;
    }
    animate(_frames, options = {}) {
      animations++;
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const timer = schedule(resolve, (options.duration || 0) + (options.delay || 0));
      return { finished, cancel() { clear(timer); reject(new Error('Animation cancelled')); } };
    }
  }
  const root = new Element('document');
  function build(node, parent) {
    let next = parent;
    if (node.tagName) {
      next = new Element(node.tagName, node.attrs);
      parent.append(next);
      if (next.attributes.has('id')) ids.set(next.attributes.get('id'), next);
      if (node.tagName === 'body') document.body = next;
    }
    for (const child of node.childNodes || []) build(child, next);
  }
  build(parse(markup), root);
  const $ = id => { assert(ids.has(id), `Missing real markup ID ${id}`); return ids.get(id); };
  document.getElementById = $;
  document.createElement = tag => new Element(tag);
  document.querySelectorAll = selector => {
    assert.equal(selector, 'dialog[open]');
    return [...ids.values()].filter(n => n.tagName === 'DIALOG' && n.open);
  };
  const motion = new EventTarget(); motion.matches = reduced;
  document.addEventListener('acf:enter', () => enters++);
  document.addEventListener('acf:exit', () => exits++);
  runInNewContext(source, {
    document, window, Event, CustomEvent,
    matchMedia: query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return motion; },
    setTimeout: schedule, clearTimeout: clear,
  }, { filename: 'public/ACF/entry.js' });
  return {
    $, document, window, motion,
    get enters() { return enters; }, get exits() { return exits; },
    get animations() { return animations; }, get pendingTimers() { return timers.size; },
    type(value) { $('entry-input').value = value; $('entry-input').dispatchEvent(event('input')); },
    submit() { const e = event('submit'); $('entry-form').dispatchEvent(e); assert(e.defaultPrevented, 'Submission must not navigate'); },
    click(id) { $(id).dispatchEvent(event('click')); },
    async tick() {
      assert(timers.size, 'Expected pending motion');
      const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      timers.delete(id); now = timer.at; timer.callback(); await flush();
    },
    async settle() {
      await flush();
      for (let i = 0; timers.size && i < 80; i++) await this.tick();
      assert.equal(timers.size, 0, 'No orphaned animation/timer'); await flush();
    },
  };
}
function closed(h, expectedEntries = 0) {
  assert.equal(h.enters, expectedEntries);
  assert.equal(h.$('entry-screen').hidden, false);
  assert.equal(h.$('atlas-workspace').hidden, true);
  assert.equal(h.$('atlas-workspace').inert, true);
}
function usable(h, expectedEntries = 1) {
  assert.equal(h.enters, expectedEntries, 'One entry event per successful opening');
  assert.equal(h.$('entry-screen').hidden, true);
  assert.equal(h.$('entry-screen').inert, true);
  assert.equal(h.$('atlas-workspace').hidden, false);
  assert.equal(h.$('atlas-workspace').inert, false);
  assert.equal(h.$('skip-animation').hidden, true);
  assert.equal(h.document.body.classList.contains('entry-pending'), false);
  assert.equal(h.document.body.classList.contains('entry-revealing'), false);
  assert.equal(h.document.activeElement, h.$('search'), 'Focus enters the usable search control');
  assert.equal(h.pendingTimers, 0, 'Opening cancels remaining motion');
}
let cases = 0;

for (const value of ['', 'world', 'ATLA', 'ATLASS', 'A TLAS']) {
  const h = harness({ reduced: true }); h.type(value); h.submit(); closed(h);
  assert.equal(h.$('entry-input').getAttribute('aria-invalid'), 'true');
  assert(h.$('entry-feedback').textContent.trim(), 'Helpful feedback is announced');
  assert.equal(h.document.activeElement, h.$('entry-input'));
  assert.equal(h.animations, 0);
  h.type('another path');
  assert.equal(h.$('entry-input').getAttribute('aria-invalid'), null);
  assert.equal(h.$('entry-feedback').textContent, ''); cases++;
}
{
  const h = harness({ reduced: true });
  assert.equal(h.$('hint-copy').hidden, true);
  h.click('entry-hint');
  assert.equal(h.$('hint-copy').hidden, false);
  assert.equal(h.$('entry-hint').getAttribute('aria-expanded'), 'true'); closed(h);
  h.click('entry-hint');
  assert.equal(h.$('hint-copy').hidden, true);
  assert.equal(h.$('entry-hint').getAttribute('aria-expanded'), 'false');
  for (let i = 0; i < 3; i++) { h.type('world'); h.submit(); }
  assert(h.$('entry-feedback').textContent.includes('Try ATLAS'), 'Repeated misses expose the playful answer');
  closed(h); cases++;
}
for (const value of ['ATLAS', 'atlas', 'aTlAs', '  atlas  ', '\tatlas\u00a0']) {
  const h = harness({ reduced: true }); h.type(value); closed(h); h.submit();
  usable(h); // Synchronous: reduced motion does not wait for a timer or animation.
  assert.equal(h.animations, 0, 'Reduced motion creates no Web Animations');
  h.submit(); usable(h); cases++;
}
{
  const h = harness({ animationAPI: false }); h.type('atlas'); h.submit(); usable(h);
  assert.equal(h.animations, 0); cases++;
}
for (const reduced of [false, true]) {
  const h = harness({ reduced });
  for (let entry = 1; entry <= 3; entry++) {
    h.type('  ATLas '); h.submit(); h.submit();
    await h.settle(); usable(h, entry);
    const dialog = h.$('about-dialog'); dialog.open = true;
    h.click('return-entry'); closed(h, entry);
    assert.equal(h.exits, entry);
    assert.equal(dialog.open, false, 'Return closes open dialogs');
    assert.equal(h.$('entry-input').value, '');
    assert.equal(h.$('entry-input').readOnly, false);
    assert.equal(h.$('entry-submit').disabled, false);
    assert.equal(h.$('entry-prompt').inert, false);
    assert.equal(h.$('entry-sequence').hidden, true);
    assert.equal(h.$('entry-screen').inert, false);
    assert.equal(h.$('hint-copy').hidden, true);
    assert.equal(h.$('entry-feedback').textContent, '');
    assert.equal(h.document.activeElement, h.$('entry-input'));
    h.document.dispatchEvent(event('acf:exit-request'));
    assert.equal(h.exits, entry, 'Repeated exit request is harmless');
  }
  cases++;
}
for (const stage of ['letters', 'radial-reveal']) for (const interruption of ['skip', 'resize', 'hidden', 'reduced-motion']) {
  const h = harness(); h.type('atlas'); h.submit();
  assert.equal(h.$('skip-animation').hidden, false);
  assert.equal(h.document.activeElement, h.$('skip-animation'));
  if (stage === 'radial-reveal') {
    for (let i = 0; !h.document.body.classList.contains('entry-revealing') && i < 30; i++) await h.tick();
    assert(h.document.body.classList.contains('entry-revealing'));
    assert.equal(h.$('atlas-workspace').inert, true, 'Visual reveal cannot receive premature input');
  }
  if (interruption === 'skip') h.click('skip-animation');
  else if (interruption === 'resize') h.window.dispatchEvent(event('resize'));
  else if (interruption === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(event('visibilitychange')); }
  else { h.motion.matches = true; h.motion.dispatchEvent(event('change')); }
  usable(h);
  // Return before the cancelled promises resolve. They must not reopen the gate.
  h.click('return-entry'); await h.settle(); closed(h, 1);
  h.type('atlas'); h.submit(); await h.settle(); usable(h, 2); cases++;
}
{
  const h = harness();
  h.window.dispatchEvent(event('resize')); h.document.hidden = true;
  h.document.dispatchEvent(event('visibilitychange'));
  h.motion.matches = true; h.motion.dispatchEvent(event('change')); closed(h);
  const key = event('keydown', { key: 'Enter', isComposing: true });
  h.$('entry-input').dispatchEvent(key);
  assert(key.defaultPrevented, 'IME composition does not submit on Enter'); cases++;
}

console.log(`Verified ${cases} ACF entrance behavior cases: answer handling, hints, reduced motion, repeated navigation and interrupted reveal. Geometry remains covered by browser checks.`);
