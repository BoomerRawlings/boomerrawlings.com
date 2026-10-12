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
  const selectedAnchors = [];
  const previews = [];
  const labelReports = [];
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
    onSelect: (node, anchor) => { selected.push(node); selectedAnchors.push(anchor); },
    onPreview: (node, anchor, reason) => previews.push({ node, anchor, reason }),
    onLabels: labels => labelReports.push(labels),
    onStatus: value => status.push(value), onZoom: value => zooms.push(value),
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
  return { graph, canvas, frames, labels, labelBoxes, dashes, status, selected, selectedAnchors, previews, labelReports, zooms, media, doc, tick, send, pointer };
}

function fixture(count = 500) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `work-${i}`, label: i < 12 ? `Name ${i}` : `A publication about contested futures ${i}`, kind: i < 12 ? 'person' : 'item', count: i + 100,
    ...(i < 12 ? {} : { typeLabel: 'Article', collectionLabel: 'IEET' }),
    x: Math.cos(i * 2.39996) * Math.sqrt(i) * 20,
    y: Math.sin(i * 2.39996) * Math.sqrt(i) * 14,
  }));
  const edges = nodes.slice(1).map((node, i) => ({ from: nodes[0].id, to: node.id, inferred: i % 3 === 0 }));
  return { nodes, edges };
}

function assertReadableOverview(h) {
  const compact = h.canvas.rect.width < 500;
  const named = h.graph.labelBoxes.map(box => h.graph.byId.get(box.id));
  const people = named.filter(node => node.kind === 'person');
  const items = named.filter(node => node.kind === 'item');
  assert.ok(people.length >= (compact ? 2 : 3) && people.length <= (compact ? 2 : 4), 'overview reserves readable person labels');
  assert.ok(items.length >= (compact ? 2 : 3) && items.length <= (compact ? 2 : 4), 'overview shows representative publication titles');
  assert.ok(people.some(person => person.label === 'Name 11'), 'highest-count person retains priority');
  for (const person of people) {
    assert.ok(h.labels.includes(person.label));
    assert.ok(h.labels.some(value => value.startsWith(`${person.count} records`)), 'visible person includes its count');
  }
  assert.ok(h.labels.includes('Article · IEET'), 'records expose their type and source collection');
  assert.ok(h.graph.labelPlans.filter(plan => plan.node.kind === 'item').every(plan => plan.lines.length === 2), 'representative titles use two readable lines');
  assert.equal(h.labelBoxes.length, named.length, 'each painted label has one background box');
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

test('desktop and compact views reveal every person through keyboard navigation and pointer pinning', t => {
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
      // Cycling reaches even a hub whose dot is temporarily covered by another title.
      let steps = 0;
      do { h.graph.stepPreview(1); steps++; } while (h.previews.at(-1).node?.id !== person.id && steps <= 501);
      assert.ok(steps <= 501, 'keyboard cycling reaches every source label');
      h.labels.length = 0; h.labelBoxes.length = 0; h.tick(0);
      const title = h.graph.labelBoxes.find(box => box.id === person.id);
      assert.ok(title, 'keyboard focus reveals a visible, clickable person title');
      h.pointer('pointerdown', i + 1, title.x + title.width / 2, title.y + title.height / 2, 'mouse');
      h.pointer('pointerup', i + 1, title.x + title.width / 2, title.y + title.height / 2, 'mouse');
      assert.equal(h.selected.at(-1).id, person.id, 'pointer selection reaches the person callback');
      h.labels.length = 0; h.labelBoxes.length = 0; h.tick(0);
      assert.ok(h.labels.includes(person.label), 'selected person label is always painted');
      assert.ok(h.labels.some(value => value.startsWith(`${person.count} records`)), 'selected person count is always painted');
      h.send('pointerleave');
      const priorSelections = h.selected.length;
      h.send('keydown', { key: 'Enter' });
      assert.equal(h.selected.length, priorSelections + 1, 'keyboard selection reaches the callback');
      assert.equal(h.selected.at(-1).id, person.id, 'keyboard retains the focused person after pointer departure');
      h.labels.length = 0; h.labelBoxes.length = 0; h.tick(0);
      assert.ok(h.labels.includes(person.label), 'keyboard-selected person label remains painted');
      assert.ok(h.labels.some(value => value.startsWith(`${person.count} records`)), 'keyboard-selected person count remains painted');
    }
  }
});

test('keyboard previews on focus, navigates directionally, cycles, pans with Shift and pins with Enter', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const base = h.graph.scale;
  h.canvas.focus();
  assert.equal(h.previews.at(-1).reason, 'keyboard');
  assert.ok(h.previews.at(-1).node, 'focusing canvas provides a useful preview immediately');
  assert.equal(h.send('keydown', { key: '+' }).defaultPrevented, true);
  assert.equal(h.graph.scale, base * 1.25);
  const x = h.graph.pan.x;
  h.send('keydown', { key: 'ArrowRight' });
  assert.equal(h.graph.pan.x, x, 'plain arrows move between nodes rather than panning');
  const right = h.previews.at(-1);
  assert.equal(right.reason, 'keyboard');
  h.send('keydown', { key: 'ArrowRight', shiftKey: true });
  assert.equal(h.graph.pan.x, x - 48);
  h.send('keydown', { key: 'Home' }); h.tick(0);
  assert.equal(h.graph.scale, base);
  const expected = h.graph.nearestCenter().id;
  h.send('keydown', { key: 'Enter' });
  assert.equal(h.selected.at(-1).id, expected);
  h.send('keydown', { key: ']' });
  const next = h.previews.at(-1).node.id;
  assert.notEqual(next, expected);
  h.send('keydown', { key: '[' });
  assert.equal(h.previews.at(-1).node.id, expected);
  h.graph.stepPreview(1);
  assert.equal(h.previews.at(-1).node.id, next, 'external Next button uses the same preview order');
  assert.equal(h.send('keydown', { key: 'Tab' }).defaultPrevented, false, 'Tab remains a normal escape to other controls');
  h.send('keydown', { key: 'Escape' });
  assert.equal(h.previews.at(-1).node, null);
  assert.equal(h.previews.at(-1).reason, 'dismiss');
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

test('hover uses canvas-local anchors with page offsets and stays accurate across zoom levels', t => {
  const h = harness(t, { reducedMotion: true });
  Object.assign(h.canvas.rect, { left: 83, top: 121 });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const target = h.graph.byId.get('work-0');
  for (const factor of [1, 1.6, 0.65]) {
    h.graph.zoomBy(factor);
    assert.equal(h.previews.at(-1).reason, 'layout');
    assert.equal(h.previews.at(-1).node, null, 'zoom dismisses the old anchor');
    const anchor = h.graph.anchor(target);
    // Deliberately hit before the next frame: stale screen coordinates must not be used.
    h.pointer('pointermove', 50, anchor.x + 83, anchor.y + 121, 'mouse');
    const preview = h.previews.at(-1);
    assert.equal(preview.node.id, target.id);
    assert.equal(preview.reason, 'hover');
    assert.deepEqual(preview.anchor, anchor, 'page offsets are excluded from the reported anchor');
    h.tick(0);
    h.send('pointerleave');
    assert.equal(h.previews.at(-1).node, null);
    assert.equal(h.previews.at(-1).reason, 'hover', 'leaving canvas allows the card to delay hover dismissal');
  }
});

test('touch pinning, empty-space dismissal and layout changes have distinct preview lifecycles', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const node = h.graph.byId.get('work-0');
  const anchor = h.graph.anchor(node);
  h.pointer('pointerdown', 1, anchor.x, anchor.y);
  h.pointer('pointerup', 1, anchor.x, anchor.y);
  assert.equal(h.selected.at(-1).id, node.id, 'first touch tap selects the card');
  assert.deepEqual(h.selectedAnchors.at(-1), anchor);
  assert.equal(h.previews.at(-1).node, null);
  assert.equal(h.previews.at(-1).reason, 'hover', 'touch cleanup must not dismiss a pinned card');
  for (const change of [
    () => h.graph.reset(),
    () => { h.canvas.rect.width = 980; h.graph.measure(); },
    () => h.graph.setData(fixture()),
    () => h.graph.setActive(false),
  ]) {
    change();
    assert.equal(h.previews.at(-1).node, null);
    assert.equal(h.previews.at(-1).reason, 'layout');
  }
  h.graph.setActive(true);
  h.graph.setData({ nodes: [], edges: [] }); h.tick(0);
  h.pointer('pointerdown', 2, 15, 15, 'mouse');
  h.pointer('pointerup', 2, 15, 15, 'mouse');
  assert.equal(h.previews.at(-1).reason, 'dismiss', 'empty canvas click explicitly closes a pinned preview');
  assert.equal(h.selected.length, 1);
});

test('item-only results retain readable titles and avoid measured overlay controls', t => {
  const h = harness(t, { reducedMotion: true });
  Object.assign(h.canvas.rect, { width: 390, height: 600, left: 40, top: 70 });
  let selector = '';
  const overlays = [
    { left: 40, top: 70, width: 390, height: 48 },
    { left: 40, top: 542, width: 390, height: 128 },
  ];
  h.canvas.parentElement = { querySelectorAll(value) { selector = value; return overlays.map(rect => ({ getBoundingClientRect: () => rect })); } };
  const data = fixture(); data.nodes = data.nodes.filter(node => node.kind === 'item'); data.edges = [];
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  assert.ok(selector.includes('.preview-navigation'));
  assert.equal(h.graph.labelBoxes.length, 2, 'compact item-only search still shows two real publication titles');
  assert.ok(h.labels.includes('Article · IEET'));
  for (const box of h.graph.labelBoxes) {
    assert.ok(box.y >= 54 && box.y + box.height <= 466, 'title avoids measured heading and navigation');
    assert.equal(h.graph.byId.get(box.id).kind, 'item');
  }
  const [first, second] = h.graph.labelBoxes;
  assert.ok(first.x + first.width <= second.x || second.x + second.width <= first.x || first.y + first.height <= second.y || second.y + second.height <= first.y);
});

test('painted title boxes preview their records and retain position while hovered', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const box = h.graph.labelBoxes.find(box => h.graph.byId.get(box.id).kind === 'item');
  const samples = [
    { x: box.x + 7, y: box.y + 7 }, { x: box.x + box.width - 7, y: box.y + 7 },
    { x: box.x + 7, y: box.y + box.height - 7 },
  ];
  const point = samples.find(point => !h.graph.screen.some(node => Math.hypot(node.sx - point.x, node.sy - point.y) <= node.radius + 3));
  assert.ok(point, 'fixture provides a clear label hit region');
  h.pointer('pointermove', 1, point.x, point.y, 'mouse');
  assert.equal(h.previews.at(-1).node.id, box.id);
  h.tick(0);
  assert.deepEqual(h.graph.labelBoxes.find(label => label.id === box.id), box, 'hover does not move the hit region away from the pointer');
  assert.ok(h.labelReports.at(-1).some(label => label.id === box.id), 'label geometry callback exposes rendered hit regions');
});

test('an opaque publication title wins over a different dot hidden underneath it', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  let overlap;
  for (const box of h.graph.labelBoxes) {
    if (h.graph.byId.get(box.id).kind !== 'item') continue;
    const covered = h.graph.screen.find(node => node.id !== box.id && node.sx - node.radius > box.x && node.sx + node.radius < box.x + box.width && node.sy - node.radius > box.y && node.sy + node.radius < box.y + box.height);
    if (covered) { overlap = { box, covered }; break; }
  }
  assert.ok(overlap, 'fixture includes a real dot fully covered by an opaque title box');
  const { box, covered } = overlap;
  assert.equal(h.graph.hit({ x: covered.sx, y: covered.sy }).id, box.id, 'hit testing follows the visible paint order');
  h.pointer('pointermove', 8, covered.sx, covered.sy, 'mouse');
  assert.equal(h.previews.at(-1).node.id, box.id, 'hover previews the visible title, not its hidden dot');
  h.pointer('pointerdown', 8, covered.sx, covered.sy, 'mouse');
  h.pointer('pointerup', 8, covered.sx, covered.sy, 'mouse');
  assert.equal(h.selected.at(-1).id, box.id, 'click pins the visible publication');
});
