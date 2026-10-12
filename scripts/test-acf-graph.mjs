import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AtlasGraph } from '../public/ACF/graph.js';

function harness(t, { reducedMotion = false, noCanvas = false } = {}) {
  let time = 0;
  let nextFrame = 1;
  const frames = new Map();
  const labels = [];
  const labelBoxes = [];
  const dashes = [];
  const status = [];
  const selected = [];
  const zooms = [];
  const media = Object.assign(new EventTarget(), { matches: reducedMotion });
  const doc = Object.assign(new EventTarget(), { hidden: false, activeElement: null });
  const originals = new Map();
  const install = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  install('window', { devicePixelRatio: 3, matchMedia: () => media });
  install('document', doc);
  install('performance', { now: () => time });
  install('requestAnimationFrame', callback => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  install('cancelAnimationFrame', id => frames.delete(id));
  install('ResizeObserver', class {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() { this.disconnected = true; }
  });
  const context = new Proxy({
    measureText: value => ({ width: String(value).length * 6 }),
    fillText: value => labels.push(String(value)),
    fillRect: (x, y, width, height) => labelBoxes.push({ x, y, width, height }),
    setLineDash: value => dashes.push([...value]),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  class Canvas extends EventTarget {
    style = {};
    dataset = {};
    captures = new Set();
    attributes = new Map();
    rect = { left: 0, top: 0, width: 1000, height: 700 };
    getContext() { return noCanvas ? null : context; }
    getBoundingClientRect() { return this.rect; }
    hasAttribute(key) { return this.attributes.has(key); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    focus() { doc.activeElement = this; this.dispatchEvent(new Event('focus')); }
    setPointerCapture(id) { this.captures.add(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
  }
  const canvas = new Canvas();
  const graph = new AtlasGraph(canvas, {
    onSelect: node => selected.push(node), onStatus: value => status.push(value), onZoom: value => zooms.push(value),
  });
  t.after(() => {
    graph.destroy();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const tick = milliseconds => {
    time += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(time);
  };
  const send = (type, properties = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), properties);
    canvas.dispatchEvent(event);
    return event;
  };
  const pointer = (type, id, x, y, pointerType = 'touch') => send(type, {
    pointerId: id, pointerType, button: 0, clientX: x, clientY: y,
  });
  return { graph, canvas, frames, labels, labelBoxes, dashes, status, selected, zooms, media, doc, tick, send, pointer };
}

function fixture(count = 500) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `work-${i}`, label: `Name ${i}`, kind: i < 12 ? 'person' : 'item', count: i + 100,
    x: Math.cos(i * 2.39996) * Math.sqrt(i) * 20,
    y: Math.sin(i * 2.39996) * Math.sqrt(i) * 14,
  }));
  const edges = nodes.slice(1).map((node, i) => ({ from: nodes[0].id, to: node.id, inferred: i % 3 === 0 }));
  return { nodes, edges };
}

function assertReadableOverview(h) {
  const names = h.labels.filter(value => /^Name \d+$/.test(value));
  assert.ok(names.length > 0 && names.length < 12, 'crowded overview paints a readable subset of person labels');
  assert.ok(names.includes('Name 11'), 'highest-count person retains priority');
  for (const name of names) {
    const i = Number(name.slice(5));
    assert.ok(h.labels.includes(String(i + 100)), `visible ${name} includes its count`);
  }
  assert.equal(h.labelBoxes.length, names.length, 'each painted label has one background box');
  for (let i = 0; i < h.labelBoxes.length; i++) {
    const a = h.labelBoxes[i];
    assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.width <= h.canvas.rect.width && a.y + a.height <= h.canvas.rect.height, 'label stays inside canvas');
    for (let j = i + 1; j < h.labelBoxes.length; j++) {
      const b = h.labelBoxes[j];
      const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      assert.ok(overlapWidth <= 0 || overlapHeight <= 0, 'unselected overview labels must not overlap');
    }
  }
}

test('overview is bounded, labels avoid collisions, and settling stops at idle', t => {
  const h = harness(t);
  h.graph.setData(fixture());
  assert.equal(h.frames.size, 0, 'closed workspace must not schedule frames');
  h.graph.setActive(true);
  h.tick(0);
  assert.equal(h.graph.chooseVisible().length, 250);
  assert.equal(h.canvas.width, 2000, 'DPR capped at two');
  assert.equal(h.canvas.dataset.totalNodes, '500');
  assertReadableOverview(h);
  assert.ok(h.dashes.some(value => value.join(',') === '2,5'), 'inferred edges remain dashed');
  assert.equal(h.status.at(-1).visibleNodes, Number(h.canvas.dataset.visibleNodes));
  assert.ok(h.frames.size > 0, 'brief settling animation begins');
  h.tick(710);
  assert.equal(h.frames.size, 0, 'no permanent render loop');
  h.graph.zoomBy(2.6);
  assert.equal(h.graph.chooseVisible().length, 500, 'zoom reveals more of the bounded sample');
  h.graph.setActive(false);
  assert.equal(h.frames.size, 0, 'returning to the gate cancels pending frames');
});

test('desktop and compact views reveal every person label on pointer and keyboard selection', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setActive(true);
  for (const viewport of [{ width: 1000, height: 700 }, { width: 390, height: 600 }]) {
    Object.assign(h.canvas.rect, viewport);
    h.graph.measure();
    h.graph.setData({ nodes: [], edges: [] });
    h.graph.setData(fixture());
    h.labels.length = 0; h.labelBoxes.length = 0; h.tick(0);
    assertReadableOverview(h);
    for (let i = 0; i < 12; i++) {
      const person = h.graph.screen.find(node => node.id === `work-${i}`);
      assert.ok(person, 'all person hubs remain available even when their labels are suppressed');
      h.pointer('pointerdown', i + 1, person.sx, person.sy, 'mouse');
      h.pointer('pointerup', i + 1, person.sx, person.sy, 'mouse');
      assert.equal(h.selected.at(-1).id, person.id, 'pointer selection reaches the person callback');
      h.labels.length = 0; h.labelBoxes.length = 0; h.tick(0);
      assert.ok(h.labels.includes(person.label), 'selected person label is always painted');
      assert.ok(h.labels.includes(String(person.count)), 'selected person count is always painted');
      h.send('pointerleave');
      const priorSelections = h.selected.length;
      h.send('keydown', { key: 'Enter' });
      assert.equal(h.selected.length, priorSelections + 1, 'keyboard selection reaches the callback');
      assert.equal(h.selected.at(-1).id, person.id, 'keyboard retains the focused person after pointer departure');
      h.labels.length = 0; h.labelBoxes.length = 0; h.tick(0);
      assert.ok(h.labels.includes(person.label), 'keyboard-selected person label remains painted');
      assert.ok(h.labels.includes(String(person.count)), 'keyboard-selected person count remains painted');
    }
  }
});

test('keyboard supports zoom, pan, reset and selecting the center-nearest node', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const base = h.graph.scale;
  assert.equal(h.send('keydown', { key: '+' }).defaultPrevented, true);
  assert.equal(h.graph.scale, base * 1.25);
  const x = h.graph.pan.x;
  h.send('keydown', { key: 'ArrowRight' });
  assert.equal(h.graph.pan.x, x - 48);
  h.send('keydown', { key: 'Home' }); h.tick(0);
  assert.equal(h.graph.scale, base);
  const expected = h.graph.nearestCenter().id;
  h.send('keydown', { key: 'Enter' });
  assert.equal(h.selected.at(-1).id, expected);
  const unchanged = h.graph.scale;
  h.send('keydown', { key: '+', ctrlKey: true });
  assert.equal(h.graph.scale, unchanged, 'browser shortcuts remain available');
});

test('pointer click selects, drag pans, and touch pinch zooms without selecting', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const node = h.graph.screen[0];
  h.pointer('pointerdown', 1, node.sx, node.sy, 'mouse');
  h.pointer('pointerup', 1, node.sx, node.sy, 'mouse');
  assert.equal(h.selected.at(-1).id, node.id);
  const initial = { ...h.graph.pan };
  h.pointer('pointerdown', 2, 100, 100);
  h.pointer('pointermove', 2, 150, 125);
  h.pointer('pointerup', 2, 150, 125);
  assert.equal(h.graph.pan.x, initial.x + 50);
  assert.equal(h.graph.pan.y, initial.y + 25);
  assert.equal(h.selected.length, 1);
  const scale = h.graph.scale;
  h.pointer('pointerdown', 3, 450, 350);
  h.pointer('pointerdown', 4, 550, 350);
  h.pointer('pointermove', 3, 400, 350);
  h.pointer('pointermove', 4, 600, 350);
  assert.ok(Math.abs(h.graph.scale - scale * 2) < 1e-10);
  h.pointer('pointerup', 3, 400, 350);
  h.pointer('pointerup', 4, 600, 350);
  assert.equal(h.selected.length, 1, 'ending a pinch must not open a record');
  assert.equal(h.graph.pointers.size, 0);
});

test('reduced motion, pause, hidden tabs and destruction suppress animation', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  assert.equal(h.frames.size, 0, 'reduced motion renders once');
  h.media.matches = false; h.media.dispatchEvent(new Event('change')); h.tick(0);
  assert.equal(h.graph.toggleMotion(), true);
  h.graph.zoomBy(1.1); h.tick(0);
  assert.equal(h.frames.size, 0, 'user pause renders changes without animation');
  assert.equal(h.graph.toggleMotion(), false);
  assert.equal(h.frames.size, 1);
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size, 0);
  h.graph.zoomBy(1.1);
  assert.equal(h.frames.size, 0, 'hidden tabs do not schedule work');
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.frames.size, 1);
  h.graph.destroy();
  assert.equal(h.frames.size, 0);
  assert.equal(h.graph.resize.disconnected, true);
  const scale = h.graph.scale;
  h.send('keydown', { key: '+' });
  assert.equal(h.graph.scale, scale, 'destroy removes event listeners');
});

test('responsive fit preserves world center and relative zoom', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  assert.ok(h.graph.viewportCenter().x > h.canvas.rect.width / 2);
  assert.ok(h.graph.viewportCenter().y > h.canvas.rect.height / 2);
  h.graph.zoomBy(1.7);
  const oldCenter = h.graph.viewportCenter();
  const oldWorld = { x: (oldCenter.x - h.graph.pan.x) / h.graph.scale, y: (oldCenter.y - h.graph.pan.y) / h.graph.scale };
  Object.assign(h.canvas.rect, { width: 390, height: 600 }); h.graph.measure();
  const center = h.graph.viewportCenter();
  assert.ok(Math.abs(h.graph.scale / h.graph.baseScale - 1.7) < 1e-8);
  assert.ok(Math.abs((center.x - h.graph.pan.x) / h.graph.scale - oldWorld.x) < 1e-8);
  assert.ok(Math.abs((center.y - h.graph.pan.y) / h.graph.scale - oldWorld.y) < 1e-8);
  h.graph.reset(); h.tick(0);
  assert.equal(h.canvas.dataset.visibleNodes, '250');
});

test('empty data and unavailable canvas report useful zero-visible status', t => {
  const h = harness(t, { noCanvas: true });
  h.graph.setData({ nodes: [], edges: [{ from: 'missing', to: 'absent' }] });
  h.graph.setActive(true);
  assert.equal(h.graph.edges.length, 0);
  assert.equal(h.canvas.dataset.graphUnavailable, 'true');
  assert.deepEqual(h.status.at(-1), { visibleNodes: 0, totalNodes: 0, visibleEdges: 0 });
  assert.equal(h.frames.size, 0);
});
