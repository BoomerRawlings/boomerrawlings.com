import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UIMotion } from '../public/ACF/ui-motion.js';

function fixture() {
  const animations = [];
  const eventTarget = () => {
    const listeners = new Map();
    return {
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
      emit(type) { for (const listener of listeners.get(type) || []) listener(); },
    };
  };
  const media = { ...eventTarget(), matches: false };
  const document = { ...eventTarget(), hidden: false, defaultView: { matchMedia: () => media }, activeElement: null };
  const make = (tag = 'div', textContent = '') => {
    const node = {
      tagName: tag.toUpperCase(), textContent, children: [], attributes: {}, dataset: {}, hidden: false, scrollTop: 172,
      classList: { values: new Set(), add(value) { this.values.add(value); }, remove(value) { this.values.delete(value); }, contains(value) { return this.values.has(value); } },
      setAttribute(key, value) { this.attributes[key] = value; },
      append(child) { this.children.push(child); child.parentElement = this; },
      remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; },
      matches(selector) { return selector.split(',').includes(tag); },
      querySelector(selector) { return this.children.find(child => child.matches(selector) || child.querySelector(selector)) || null; },
      contains(child) { for (let current = child; current; current = current.parentElement) if (current === this) return true; return false; },
      closest() { for (let current = this; current; current = current.parentElement) if (current.hidden) return current; return null; },
      getClientRects() { return [{}]; },
      animate(frames, options) {
        let resolve, reject;
        const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
        const animation = { node: this, frames, options, finished, cancelled: false, complete: resolve, cancel() { this.cancelled = true; reject(new Error('Cancelled')); } };
        animations.push(animation); return animation;
      },
    };
    return node;
  };
  document.createElement = make; document.body = make('body');
  const panel = make(), title = make('h2', 'Complete record title'), paragraph = make('p', 'Literal title words; source evidence available.'), control = make('button', 'Open record');
  panel.append(title); panel.append(paragraph); panel.append(control);
  document.body.append(panel); document.activeElement = control;
  const motion = new UIMotion(document);
  return { document, media, make, panel, title, paragraph, control, motion, animations };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test('semantic reveal preserves full text, focus, scrolling and stable control targets', async () => {
  const ui = fixture();
  ui.motion.reveal(ui.panel, { key: 'record:a' });
  assert.equal(ui.title.textContent, 'Complete record title');
  assert.equal(ui.paragraph.textContent, 'Literal title words; source evidence available.');
  assert.equal(ui.document.activeElement, ui.control); assert.equal(ui.panel.scrollTop, 172);
  assert.equal(ui.panel.children.at(-1).attributes['aria-hidden'], 'true');
  const controlAnimation = ui.animations.find(animation => animation.node === ui.control);
  assert.ok(controlAnimation);
  assert.ok(controlAnimation.frames.every(frame => !('transform' in frame) && !('clipPath' in frame)), 'Controls never move or lose their clickable area');
  assert.ok(ui.animations.find(animation => animation.node === ui.paragraph).frames[0].clipPath);
  const count = ui.animations.length;
  ui.motion.reveal(ui.panel, { key: 'record:a' }); assert.equal(ui.animations.length, count);
  ui.animations.forEach(animation => animation.complete()); await settle();
  assert.equal(ui.motion.running.size, 0); assert.equal(ui.panel.children.length, 3);
  assert.equal(ui.panel.dataset.uiMotion, 'settled');
});

test('rapid replacement cancels the former reveal without stale completion erasing the new one', async () => {
  const ui = fixture();
  ui.motion.reveal(ui.panel, { key: 'a' });
  const previous = [...ui.animations], oldTrace = ui.panel.children.at(-1);
  ui.motion.reveal(ui.panel, { key: 'b' });
  assert.ok(previous.every(animation => animation.cancelled)); assert.equal(oldTrace.parentElement, null);
  await settle();
  assert.equal(ui.motion.running.size, 1); assert.equal(ui.panel.dataset.uiMotion, 'revealing');
  ui.motion.cancel(ui.panel); await settle();
  assert.equal(ui.panel.children.length, 3); assert.equal(ui.motion.running.size, 0);
});

test('closing a panel immediately cancels nested facets and leaves data and controls intact', async () => {
  const ui = fixture(), section = ui.make(); section.append(ui.make('select', 'All types')); ui.panel.append(section);
  ui.motion.reveal(ui.panel); ui.motion.reveal(section);
  assert.equal(ui.motion.running.size, 2);
  ui.motion.cancel(ui.panel); ui.panel.hidden = true; await settle();
  assert.equal(ui.motion.running.size, 0); assert.ok(ui.animations.every(animation => animation.cancelled));
  assert.equal(section.children.length, 1); assert.equal(ui.document.activeElement, ui.control);
});

for (const condition of ['pause', 'reduced', 'hidden', 'inactive']) test(`${condition} cancels pending work, stays idle, and permits only later user changes after restoration`, async () => {
  const ui = fixture(); ui.motion.reveal(ui.panel);
  const change = value => {
    if (condition === 'pause') ui.motion.setPaused(value);
    if (condition === 'reduced') { ui.media.matches = value; ui.media.emit('change'); }
    if (condition === 'hidden') { ui.document.hidden = value; ui.document.emit('visibilitychange'); }
    if (condition === 'inactive') ui.motion.setActive(!value);
  };
  change(true); await settle();
  assert.equal(ui.motion.running.size, 0); assert.ok(ui.animations.every(animation => animation.cancelled));
  const count = ui.animations.length;
  ui.motion.reveal(ui.panel); assert.equal(ui.animations.length, count);
  change(false); await settle(); assert.equal(ui.animations.length, count, 'Returning does not replay stale UI');
  ui.motion.reveal(ui.panel); assert.ok(ui.animations.length > count);
  ui.motion.destroy(); await settle(); assert.equal(ui.motion.running.size, 0);
});

test('a long result list has bounded work and finishes under 700ms', () => {
  const ui = fixture(); for (let i = 0; i < 100; i++) ui.panel.append(ui.make('button', 'Record ' + i));
  ui.motion.reveal(ui.panel);
  assert.ok(ui.animations.length <= 13);
  assert.ok(ui.animations.every(animation => animation.options.duration + (animation.options.delay || 0) <= 700));
  assert.ok(ui.animations.every(animation => !animation.options.iterations || animation.options.iterations === 1));
  ui.motion.stop();
});

test('the entrance owns startup animation until the workspace is revealed', () => {
  const ui = fixture();
  ui.document.body.classList.add('entry-pending');
  ui.motion.reveal(ui.panel, { key: 'loading:a' });
  assert.equal(ui.animations.length, 0); assert.equal(ui.motion.running.size, 0);
  assert.equal(ui.panel.children.length, 3); assert.equal(ui.title.textContent, 'Complete record title');
  ui.document.body.classList.remove('entry-pending');
  assert.equal(ui.animations.length, 0, 'Completing the entrance must not replay old startup work');
  ui.motion.reveal(ui.panel, { key: 'selection:b' });
  assert.ok(ui.animations.length > 0, 'A later semantic change reveals normally');
  ui.motion.stop();
});

test('unsupported animation and hidden responsive panels keep a complete working UI', async () => {
  const ui = fixture(); ui.panel.animate = undefined;
  ui.motion.reveal(ui.panel); assert.equal(ui.animations.length, 0); assert.equal(ui.panel.children.length, 3);
  const other = ui.make(); other.append(ui.make('p', 'Readable'));
  other.getClientRects = () => []; ui.motion.reveal(other); assert.equal(ui.animations.length, 0);
  other.getClientRects = () => [{}]; other.children[0].animate = () => { throw new Error('Unsupported'); };
  ui.motion.reveal(other); await settle();
  assert.equal(ui.motion.running.size, 0); assert.equal(other.children.length, 1); assert.equal(other.children[0].textContent, 'Readable');
});
