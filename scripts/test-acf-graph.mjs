import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AtlasGraph } from '../public/ACF/graph.js';
import { routeOpacity } from '../public/ACF/graph-renderer.js';

function fakeGL() {
  let id = 0, buffer = null, program = null;
  const buffers = new Map(), pointers = new Map(), enabled = new Set();
  const gl = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713, LINK_STATUS: 35714, ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, DYNAMIC_DRAW: 35048,
    BLEND: 3042, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, ONE: 1, FLOAT: 5126, COLOR_BUFFER_BIT: 16384, POINTS: 0, LINES: 1,
    lost: false, draws: [], uploads: [], deletedBuffers: [], deletedPrograms: [], uniforms: [],
    createShader: () => ({ id: ++id }), shaderSource() {}, compileShader() {}, getShaderParameter: () => true, deleteShader() {},
    createProgram: () => ({ id: ++id }), attachShader() {}, linkProgram() {}, getProgramParameter: () => true,
    deleteProgram: value => gl.deletedPrograms.push(value),
    getAttribLocation: (_, name) => ({ a_position: 0, a_size: 1, a_distance: 1, a_color: 2, a_selected: 3 })[name],
    getUniformLocation: (_, name) => name, useProgram: value => { program = value; }, uniform1f: (name, value) => gl.uniforms.push({ program, name, value }), uniform2f() {},
    createBuffer: () => ({ id: ++id }), bindBuffer: (_, value) => { buffer = value; },
    bufferData: (_, values) => { buffers.set(buffer, values); gl.uploads.push({ buffer, values }); },
    deleteBuffer: value => gl.deletedBuffers.push(value), enable() {}, blendFuncSeparate: (...factors) => { gl.blendFactors = factors; }, viewport() {}, clearColor() {}, clear() {},
    enableVertexAttribArray: location => enabled.add(location), disableVertexAttribArray: location => enabled.delete(location), vertexAttrib1f() {},
    vertexAttribPointer: (location, size, type, normalized, stride, offset) => pointers.set(location, { buffer, size, stride, offset }),
    drawArrays: (mode, first, count) => {
      for (const location of enabled) {
        const pointer = pointers.get(location), bytes = pointer.offset + Math.max(0, count - 1) * pointer.stride + pointer.size * 4;
        assert.ok(buffers.get(pointer.buffer).byteLength >= bytes, 'every enabled GPU attribute has enough uploaded vertex data');
      }
      gl.draws.push({ mode, first, count, program });
    },
    isContextLost: () => gl.lost,
  };
  return gl;
}

function harness(t, { reducedMotion = false, noCanvas = false, gpu = false, layers = { names: true, relationships: true, inferred: true } } = {}) {
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
  const gl = gpu ? fakeGL() : null;
  let gpuCanvas = null;
  if (gpu) {
    canvas.parentElement = { insertBefore(node) { gpuCanvas = node; }, querySelectorAll: () => [] };
    doc.createElement = () => {
      const node = new Canvas();
      node.getContext = type => type === 'webgl' ? gl : null;
      node.remove = () => { node.removed = true; };
      return node;
    };
  }
  const graph = new AtlasGraph(canvas, {
    onSelect: (node, anchor) => { selected.push(node); selectedAnchors.push(anchor); },
    onPreview: (node, anchor, reason) => previews.push({ node, anchor, reason }),
    onLabels: labels => labelReports.push(labels),
    onStatus: value => status.push(value), onZoom: value => zooms.push(value),
  });
  graph.setLayers(layers);
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
  return { graph, canvas, gpuCanvas, gl, frames, labels, labelBoxes, dashes, status, selected, selectedAnchors, previews, labelReports, zooms, media, doc, tick, send, pointer };
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

test('overview contains every enabled point, labels avoid collisions, and settling stops at idle', t => {
  const h = harness(t);
  h.graph.setData(fixture());
  assert.equal(h.frames.size, 0, 'closed workspace must not schedule frames');
  h.graph.setActive(true);
  h.tick(0);
  assert.equal(h.graph.chooseVisible().length, 500);
  assert.equal(h.canvas.width, 2000, 'DPR capped at two');
  assert.equal(h.canvas.dataset.totalNodes, '500');
  assertReadableOverview(h);
  assert.ok(h.dashes.some(value => value.join(',') === '2,5'), 'inferred edges remain dashed');
  assert.equal(h.status.at(-1).visibleNodes, Number(h.canvas.dataset.visibleNodes));
  assert.ok(h.frames.size > 0, 'brief settling animation begins');
  h.tick(810);
  assert.equal(h.frames.size, 0, 'no permanent render loop');
  h.graph.zoomBy(2.6);
  assert.equal(h.graph.chooseVisible().length, 500, 'zoom never changes which records exist in the map');
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
      const person = h.graph.byId.get(`work-${i}`);
      assert.ok(person, 'all person hubs remain available after selecting another person moves the camera');
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
  const pinched = { ...h.graph.pan };
  h.pointer('pointermove', 4, 620, 360);
  h.pointer('pointerup', 4, 620, 360);
  assert.deepEqual(h.graph.pan, { x: pinched.x + 20, y: pinched.y + 10 }, 'remaining finger continues panning without a jump or new selection');
  assert.equal(h.selected.length, 1, 'ending a pinch must not open a record');
  assert.equal(h.graph.pointers.size, 0);
});

test('dragging a selected star or title pans the whole camera, including release-only motion', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const node = h.graph.byId.get('work-0'), coordinates = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y }));
  for (const pointerType of ['mouse', 'touch', 'pen']) for (const surface of ['star', 'title']) {
    h.graph.select(node); h.tick(0);
    const title = h.graph.labelBoxes.find(box => box.id === node.id);
    assert.ok(title);
    const point = surface === 'star' ? h.graph.anchor(node) : { x: title.x + title.width / 2, y: title.y + title.height / 2 };
    const pan = { ...h.graph.pan }, scale = h.graph.scale, selections = h.selected.length;
    assert.equal(h.pointer('pointerdown', 1, point.x, point.y, pointerType).defaultPrevented, true);
    h.pointer('pointermove', 1, point.x + 3, point.y + 1, pointerType);
    assert.deepEqual(h.graph.pan, pan, 'small press jitter leaves the map still');
    assert.equal(h.graph.selected, node.id);
    h.pointer('pointermove', 1, point.x + 8, point.y + 6, pointerType);
    assert.deepEqual(h.graph.pan, { x: pan.x + 8, y: pan.y + 6 }, 'crossing the drag threshold retains all movement from the press');
    assert.equal(h.graph.selected, null, 'a real drag dismisses the pinned star');
    assert.equal(h.previews.at(-1).node, null);
    h.pointer('pointerup', 1, point.x + 44, point.y + 21, pointerType);
    assert.deepEqual(h.graph.pan, { x: pan.x + 44, y: pan.y + 21 }, 'release consumes movement after the last move event');
    assert.equal(h.graph.scale, scale); assert.equal(h.selected.length, selections);
    assert.equal(h.canvas.captures.size, 0); assert.equal(h.graph.pointers.size, 0);
    assert.equal(h.canvas.style.cursor, 'grab');
    assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), coordinates, 'dragging changes no individual star positions');
    const final = { ...h.graph.pan };
    h.pointer('pointerdown', 2, point.x, point.y, pointerType);
    h.pointer('pointerup', 2, point.x + 70, point.y - 35, pointerType);
    assert.deepEqual(h.graph.pan, { x: final.x + 70, y: final.y - 35 }, 'a fast drag with no move event still pans');
    assert.equal(h.selected.length, selections, 'no drag recenters or opens a star');
  }
});

test('small click jitter selects the pressed star; cancel and lost capture cannot select', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData({ nodes: [
    { id: 'pressed', kind: 'item', x: 0, y: 0 }, { id: 'nearby', kind: 'item', x: 3, y: 0 },
  ], bounds: { left: -250, right: 250, top: -250, bottom: 250 } });
  h.graph.setActive(true); h.tick(0); h.graph.zoomBy(1);
  const press = h.graph.anchor(h.graph.byId.get('pressed')), release = h.graph.anchor(h.graph.byId.get('nearby'));
  assert.ok(release.x - press.x < 5);
  h.pointer('pointerdown', 1, press.x, press.y, 'mouse');
  h.pointer('pointerup', 1, release.x, release.y, 'mouse');
  assert.equal(h.selected.at(-1).id, 'pressed', 'dense adjacent stars cannot replace the original click target');
  for (const type of ['pointercancel', 'lostpointercapture']) {
    h.pointer('pointerdown', 2, press.x, press.y, 'mouse');
    h.send(type, { pointerId: 2 });
    h.pointer('pointerup', 2, press.x, press.y, 'mouse');
    assert.equal(h.selected.length, 1); assert.equal(h.canvas.captures.size, 0); assert.equal(h.graph.pointers.size, 0);
    assert.equal(h.graph.selected, null);
  }
  assert.equal(h.send('dragstart').defaultPrevented, true, 'native HTML dragging never takes over the map');
  for (const pointerType of ['mouse', 'pen']) {
    h.send('pointerdown', { pointerId: 3, pointerType, button: 2, clientX: press.x, clientY: press.y });
    assert.equal(h.canvas.captures.size, 0); assert.equal(h.graph.pointers.size, 0, 'secondary buttons preserve browser interaction');
  }
});

test('forwarded preview gestures capture the canvas, pan only after movement and never select', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  h.graph.select(h.graph.byId.get('work-0')); h.tick(0);
  const pan = { ...h.graph.pan }, selected = h.graph.selected, selections = h.selected.length;
  const press = () => {
    const event = Object.assign(new Event('pointerdown', { cancelable: true }), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 120, clientY: 140 });
    h.graph.pointerDown(event, { panOnly: true });
    assert.equal(event.defaultPrevented, true); assert.equal(h.canvas.hasPointerCapture(1), true);
  };
  press(); h.pointer('pointerup', 1, 120, 140, 'mouse');
  assert.deepEqual(h.graph.pan, pan); assert.equal(h.graph.selected, selected);
  assert.equal(h.selected.length, selections, 'clicking the preview body never activates a hidden star');
  press(); h.pointer('pointermove', 1, 136, 149, 'mouse'); h.pointer('pointerup', 1, 150, 160, 'mouse');
  assert.deepEqual(h.graph.pan, { x: pan.x + 30, y: pan.y + 20 });
  assert.equal(h.graph.selected, null); assert.equal(h.previews.at(-1).node, null);
  assert.equal(h.selected.length, selections); assert.equal(h.canvas.captures.size, 0);
});

for (const reducedMotion of [false, true]) test(`star activation centers without zooming or stale previews (reduced motion: ${reducedMotion})`, t => {
  const h = harness(t, { reducedMotion });
  h.graph.setData({
    nodes: [
      { id: 'record', label: 'Publication', kind: 'item', x: -130, y: -70 },
      { id: 'name', label: 'Credited name', kind: 'person', x: 90, y: 50 },
      { id: 'theme', label: 'Inferred theme', kind: 'hub', x: -30, y: 100 },
    ], bounds: { left: -200, right: 200, top: -200, bottom: 200 },
  });
  h.graph.setActive(true);
  for (const width of [320, 390, 1000]) {
    Object.assign(h.canvas.rect, { width, height: 700, left: 43, top: 87 }); h.graph.measure();
    for (const node of h.graph.nodes) for (const input of ['mouse', 'touch', 'Enter', ' ']) {
      h.graph.reset(); h.graph.zoomBy(1.6);
      const scale = h.graph.scale, pan = { ...h.graph.pan }, anchor = h.graph.anchor(node), center = h.graph.viewportCenter();
      assert.ok(Math.hypot(anchor.x - center.x, anchor.y - center.y) > 20, 'fixture activates an off-center star');
      if (input === 'mouse' || input === 'touch') {
        if (input === 'mouse') {
          h.pointer('pointermove', 1, anchor.x + 43, anchor.y + 87, input);
          assert.deepEqual(h.graph.pan, pan, 'hover previews never recenter the camera');
        }
        h.pointer('pointerdown', 1, anchor.x + 43, anchor.y + 87, input);
        h.pointer('pointerup', 1, anchor.x + 43, anchor.y + 87, input);
      } else {
        h.graph.focusNode(node);
        assert.deepEqual(h.graph.pan, pan, 'focusing an already visible star does not recenter it');
        h.send('keydown', { key: input });
      }
      const centered = h.graph.anchor(node);
      assert.equal(h.selected.at(-1).id, node.id);
      assert.equal(h.graph.scale, scale, 'activation retains the current zoom');
      assert.ok(Math.hypot(centered.x - center.x, centered.y - center.y) < 1e-8, 'selected star reaches the usable map center immediately');
      assert.deepEqual(h.selectedAnchors.at(-1), centered, 'pinned card receives the new canvas-local anchor');
      assert.equal(h.previews.at(-1).node.id, node.id, 'pointer-up does not re-hit the old cursor location');
      assert.deepEqual(h.previews.at(-1).anchor, centered);
      assert.equal(h.graph.previewId, node.id);
      assert.equal(h.graph.labelBoxes.length, 0, 'obsolete painted hit boxes are discarded before the next frame');
      h.tick(0);
      assert.deepEqual(h.graph.anchor(node), centered, 'selection animation never moves the camera farther');
      if (reducedMotion) assert.equal(h.frames.size, 0, 'reduced motion renders centering once');
    }
  }
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
  assert.equal(h.canvas.dataset.visibleNodes, '500');
});

test('empty data and unavailable canvas report useful zero-visible status', t => {
  const h = harness(t, { noCanvas: true });
  h.graph.setData({ nodes: [], edges: [{ from: 'missing', to: 'absent' }] });
  h.graph.setActive(true);
  assert.equal(h.graph.edges.length, 0);
  assert.equal(h.canvas.dataset.graphUnavailable, 'true');
  assert.deepEqual(h.status.at(-1), { visibleNodes: 0, totalNodes: 0, visibleEdges: 0, recordCount: 0, nameCount: 0, selectedRecords: 0, regionId: '', regionLabel: '', regionMemberTotal: 0, inViewRecords: 0, inViewNames: 0, backend: 'unavailable', submittedRecords: 0, submittedNames: 0, drawnPoints: 0, submittedEdges: 0, drawnEdges: 0 });
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
  assert.deepEqual(h.selectedAnchors.at(-1), h.graph.viewportCenter());
  assert.equal(h.previews.at(-1).node.id, node.id);
  assert.deepEqual(h.previews.at(-1).anchor, h.graph.viewportCenter(), 'touch retains the selected star and its centered card anchor');
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
  assert.ok(selector.includes('.map-perspectives'), 'zoom and expanded-view controls are excluded from labels');
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

function recordEdgePaints(h) {
  const painted = [];
  const edgePath = h.graph.edgePath.bind(h.graph);
  h.graph.edgePath = (context, from, to) => {
    painted.push({ from: from.id, to: to.id, dash: [...(h.dashes.at(-1) || [])], style: context.strokeStyle });
    edgePath(context, from, to);
  };
  return painted;
}

test('selection briefly emphasizes only actual visible incident edges, preserving both classifications', t => {
  const h = harness(t);
  const data = fixture();
  data.edges.push({ from: 'work-2', to: 'work-3', inferred: false });
  data.edges.push({ from: 'missing', to: 'work-3', inferred: false });
  h.graph.setData(data); h.graph.setActive(true); h.tick(810);
  const painted = recordEdgePaints(h);
  h.graph.select(h.graph.byId.get('work-0'));
  h.graph.requestDraw(); h.graph.requestDraw();
  assert.equal(h.frames.size, 1, 'selection and repeated invalidations share one animation frame');
  h.tick(390);
  const pulse = painted.filter(edge => edge.style.endsWith(',0.250)'));
  assert.ok(pulse.length > 0 && pulse.length <= 72, 'connection emphasis has a fixed small edge budget');
  assert.equal(Number(h.canvas.dataset.highlightedEdges), pulse.length);
  const visibleIds = new Set(h.graph.screen.map(node => node.id));
  for (const edge of pulse) {
    const source = data.edges.find(candidate => candidate.from === edge.from && candidate.to === edge.to);
    assert.ok(source, 'each emphasized connection exists in the supplied data');
    assert.ok(edge.from === 'work-0' || edge.to === 'work-0', 'unrelated connections receive no selection pulse');
    assert.ok(visibleIds.has(edge.from) && visibleIds.has(edge.to), 'both endpoints must be visible');
    assert.deepEqual(edge.dash, source.inferred ? [3, 5] : [], 'documented and inferred classifications survive emphasis');
  }
  assert.ok(pulse.some(edge => edge.dash.length) && pulse.some(edge => !edge.dash.length));
  const fixedAnchor = h.graph.anchor(h.graph.byId.get('work-0'));
  h.tick(400);
  assert.equal(h.canvas.dataset.highlightedEdges, '0');
  assert.equal(h.graph.connectionPulse, null);
  assert.equal(h.frames.size, 0, 'the entire scene returns to idle within 800 ms');
  assert.deepEqual(h.graph.anchor(h.graph.byId.get('work-0')), fixedAnchor, 'emphasis never moves records');
});

test('data changes replace connection emphasis; zoom, hidden state and exit cancel it', t => {
  const h = harness(t);
  const painted = recordEdgePaints(h);
  h.graph.setData(fixture(8)); h.graph.setActive(true); h.tick(390);
  assert.ok(Number(h.canvas.dataset.highlightedEdges) > 0, 'entry can emphasize the visible relationship sample');
  const replacement = fixture(8);
  replacement.edges = [{ from: 'work-6', to: 'work-7', inferred: true }];
  h.graph.setData(replacement);
  painted.length = 0; h.tick(390);
  assert.deepEqual(painted.filter(edge => edge.style.endsWith(',0.250)')).map(({ from, to, dash }) => ({ from, to, dash })), [
    { from: 'work-6', to: 'work-7', dash: [3, 5] },
  ], 'filter/theme changes cannot retain connections from the preceding graph');
  h.graph.zoomBy(1.2); h.tick(0);
  assert.equal(h.graph.connectionPulse, null, 'zoom clears obsolete connection emphasis');
  h.graph.select(h.graph.byId.get('work-6'));
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.graph.connectionPulse, null);
  assert.equal(h.frames.size, 0, 'a hidden page cancels the bounded loop immediately');
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); h.tick(0);
  assert.equal(h.frames.size, 0, 'visibility return does not replay a stale pulse');
  h.graph.select(h.graph.byId.get('work-6'));
  h.graph.setActive(false);
  assert.equal(h.graph.connectionPulse, null);
  assert.equal(h.frames.size, 0);
  h.graph.setActive(true); h.graph.destroy();
  assert.equal(h.graph.connectionPulse, null);
  assert.equal(h.frames.size, 0);
});

test('reduced and paused motion keep selected relationships static with no replay loop', t => {
  const h = harness(t, { reducedMotion: true });
  const painted = recordEdgePaints(h);
  h.graph.setData(fixture(8)); h.graph.setActive(true); h.tick(0);
  const assertStaticSelection = () => {
    painted.length = 0;
    h.graph.select(h.graph.byId.get('work-0')); h.tick(0);
    const selectedEdges = painted.filter(edge => edge.style === 'rgba(216,153,118,0.64)');
    assert.equal(selectedEdges.length, 7, 'selected relationships remain visible without motion');
    assert.ok(selectedEdges.some(edge => edge.dash.length) && selectedEdges.some(edge => !edge.dash.length));
    assert.equal(h.graph.connectionPulse, null);
    assert.equal(h.frames.size, 0);
  };
  assertStaticSelection();
  h.media.matches = false; h.media.dispatchEvent(new Event('change'));
  h.graph.toggleMotion(); h.tick(0);
  assertStaticSelection();
  h.graph.toggleMotion(); h.tick(810);
  assert.equal(h.frames.size, 0, 'resume does not restart old connection emphasis');
});

test('decorative depth is deterministic, responds to camera changes and never becomes records', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData({ nodes: [], edges: [] }); h.graph.setActive(true); h.tick(0);
  const points = h.graph.depthLayers.flat();
  assert.equal(points.length, 66, 'decoration has a small viewport-independent budget');
  const positions = points.map(point => h.graph.depthPosition(point));
  assert.ok(positions.every(point => point.x >= 0 && point.x < h.graph.width && point.y >= 0 && point.y < h.graph.height));
  for (const point of positions) assert.equal(h.graph.hit(point), null, 'a background point is never a selectable record');
  assert.deepEqual(h.status.at(-1), { visibleNodes: 0, totalNodes: 0, visibleEdges: 0, recordCount: 0, nameCount: 0, selectedRecords: 0, regionId: '', regionLabel: '', regionMemberTotal: 0, inViewRecords: 0, inViewNames: 0, backend: 'canvas2d', submittedRecords: 0, submittedNames: 0, drawnPoints: 0, submittedEdges: 0, drawnEdges: 0, selectedEdges: 0 });
  h.graph.zoomBy(2); h.tick(0);
  const zoomed = points.map(point => h.graph.depthPosition(point));
  assert.ok(zoomed.some((point, i) => Math.hypot(point.x - positions[i].x, point.y - positions[i].y) > 1), 'zoom creates decorative depth');
  h.send('keydown', { key: 'ArrowRight', shiftKey: true }); h.tick(0);
  const panned = points.map(point => h.graph.depthPosition(point));
  for (let i = 0; i < points.length; i++) {
    const expected = (zoomed[i].x - 48 * points[i].depth * 0.1 + h.graph.width) % h.graph.width;
    assert.ok(Math.abs(panned[i].x - expected) < 1e-9, 'depth layers pan a fraction of the record camera');
  }
  h.graph.reset(); h.tick(0);
  assert.deepEqual(points.map(point => h.graph.depthPosition(point)), positions, 'reset reproduces the same decorative field');
  assert.equal(h.graph.nodes.length, 0);
  assert.equal(h.graph.edges.length, 0);
  assert.equal(h.frames.size, 0, 'decorative depth never creates an ambient loop');
});

function fullScaleData() {
  const records = Array.from({ length: 33945 }, (_, i) => ({ id: `record-${String(i).padStart(5, '0')}`, label: `Source publication ${i}`, kind: 'item', x: (i % 240 - 120) * 10, y: (Math.floor(i / 240) - 70) * 10 }));
  const names = Array.from({ length: 7361 }, (_, i) => ({ id: `name-${i}`, label: `Source name ${i}`, kind: 'person', x: (i % 120 - 60) * 20 + 3, y: (Math.floor(i / 120) - 30) * 20 + 3 }));
  const hubs = Array.from({ length: 6 }, (_, i) => ({ id: `@theme:${i}`, label: `Inferred theme ${i}`, kind: 'hub', x: i * 200 - 600, y: -800 }));
  const edges = records.map((node, i) => ({ from: names[i % names.length].id, to: node.id, inferred: false }));
  edges.push(...records.slice(0, 3000).map((node, i) => ({ from: hubs[i % 6].id, to: node.id, inferred: true })));
  return { nodes: [...records, ...names, ...hubs], edges, bounds: { left: -1400, right: 1400, top: -1100, bottom: 1100 } };
}

test('GPU submits all 33,945 record vertices with exact buffer parity; camera and layers never resample', t => {
  const h = harness(t, { gpu: true, layers: {}, reducedMotion: true });
  const data = fullScaleData();
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  assert.equal(h.graph.renderer.backend, 'webgl');
  assert.deepEqual(h.graph.layers, { names: false, labels: true, relationships: false, regions: true, inferred: false });
  const records = h.graph.renderer.pointGroups.find(group => group.kind === 'item');
  assert.equal(records.count, 33945);
  assert.equal(records.values.length, 33945 * 6);
  for (let i = 0; i < records.count; i++) {
    assert.equal(records.values[i * 6], data.nodes[i].x);
    assert.equal(records.values[i * 6 + 1], data.nodes[i].y);
  }
  assert.equal(h.canvas.dataset.recordIdCount, '33945');
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.inViewRecords, '33945');
  assert.equal(h.canvas.dataset.nameCount, '7361');
  assert.equal(h.canvas.dataset.submittedNames, '0');
  assert.ok(h.gl.draws.some(draw => draw.mode === h.gl.POINTS && draw.count === 33945));
  const uploads = h.gl.uploads.length;
  const idHash = h.canvas.dataset.recordIdHash;
  h.graph.zoomBy(12); h.tick(0);
  assert.ok(Number(h.canvas.dataset.inViewRecords) < 33945, 'camera clips records without changing their GPU batch');
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.recordIdHash, idHash);
  assert.equal(h.gl.uploads.length, uploads, 'camera only changes uniforms');
  const geometry = records.values, buffer = records.buffer, coordinates = records.values.slice();
  h.graph.select(h.graph.byId.get('record-20000')); h.tick(0);
  const centered = h.graph.anchor(h.graph.byId.get('record-20000')), center = h.graph.viewportCenter();
  assert.ok(Math.hypot(centered.x - center.x, centered.y - center.y) < 1e-8);
  assert.equal(records.values, geometry); assert.equal(records.buffer, buffer);
  assert.deepEqual(records.values, coordinates, 'centering never changes original record coordinates');
  assert.equal(h.canvas.dataset.recordIdHash, idHash); assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.gl.uploads.length, uploads, 'centering reuses every GPU geometry buffer');
  h.graph.setLayers({ names: true, inferred: true }); h.tick(0);
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.submittedNames, '7361');
  assert.equal(h.canvas.dataset.drawnPoints, String(33945 + 7361 + 6));
  assert.equal(h.canvas.dataset.submittedEdges, '3000', 'inferred routes operate independently of documented relationship visibility');
  assert.equal(h.gl.uploads.length, uploads, 'layer toggles retain cached GPU buffers');
  h.graph.setLayers({ relationships: true }); h.tick(0);
  assert.equal(h.canvas.dataset.submittedEdges, String(33945 + 3000));
  assert.equal(h.frames.size, 0);
  const draws = h.gl.draws.length;
  h.tick(5000);
  assert.equal(h.gl.draws.length, draws, 'an idle full GPU map makes no new draw calls');
});

test('dense full-scale picking uses the spatial neighborhood and keeps every record keyboard reachable', t => {
  const h = harness(t, { gpu: true, layers: {}, reducedMotion: true });
  const data = fullScaleData(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const target = h.graph.byId.get('record-20000');
  assert.equal(h.graph.focusRecord(target.id), true); h.tick(0);
  h.graph.zoomBy(4); // Clear title boxes so this specifically exercises point picking.
  const point = h.graph.anchor(target);
  assert.equal(h.graph.hit(point).id, target.id);
  assert.ok(h.graph.spatial.lastVisited < 200, 'pointer picking visits a local grid neighborhood, not 41,312 nodes');
  const originalQuery = h.graph.spatial.query.bind(h.graph.spatial);
  h.graph.spatial.query = (...args) => originalQuery(...args);
  assert.equal(h.graph.focusRecord('missing-id'), false);
  h.graph.focusRecord('record-33944'); h.tick(0);
  assert.equal(h.selected.at(-1).id, 'record-33944', 'list focus reaches a record outside the old bounded sample');
  h.graph.stepPreview(1); h.tick(0);
  assert.equal(h.previews.at(-1).node.id, '@theme:0', 'keyboard cycling includes the independently visible theme hubs');
  for (let i = 0; i < 6; i++) h.graph.stepPreview(1);
  assert.equal(h.previews.at(-1).node.id, 'record-00000', 'keyboard cycling includes every enabled vertex and wraps');
  const anchor = h.previews.at(-1).anchor;
  assert.ok(anchor.x >= 0 && anchor.x <= h.graph.width && anchor.y >= 0 && anchor.y <= h.graph.height, 'offscreen keyboard target is brought into view');
});

test('perspectives recover a real record from empty sky at the requested zoom without changing full geometry', t => {
  const h = harness(t, { gpu: true, layers: {}, reducedMotion: true });
  h.graph.setData(fullScaleData()); h.graph.setActive(true); h.tick(0);
  const records = h.graph.renderer.pointGroups.find(group => group.kind === 'item');
  const values = records.values, coordinates = values.slice(), buffer = records.buffer, uploads = h.gl.uploads.length, idHash = h.canvas.dataset.recordIdHash;
  h.graph.zoomBy(0.4);
  h.pointer('pointerdown', 1, 50, 50, 'mouse'); h.pointer('pointerup', 1, 10050, -7950, 'mouse'); h.tick(0);
  assert.equal(h.canvas.dataset.inViewRecords, '0', 'fixture pans beyond every source record');
  assert.equal(h.graph.selected, null);
  // Far lower-left world coordinates choose the nearest corner record, even
  // though no record can be found by screen-clipped picking at this camera.
  assert.equal(h.graph.setPerspective(4), true); h.tick(0);
  assert.equal(h.selected.at(-1).id, 'record-33840');
  const target = h.graph.byId.get(h.graph.selected), center = h.graph.viewportCenter();
  for (const ratio of [4, 16, 100, 0.1]) {
    assert.equal(h.graph.setPerspective(ratio), true); h.tick(0);
    const anchor = h.graph.anchor(target), expectedRatio = Math.max(0.4, Math.min(64, ratio));
    assert.ok(Math.hypot(anchor.x - center.x, anchor.y - center.y) < 1e-8);
    assert.equal(h.graph.scale, h.graph.baseScale * expectedRatio);
    assert.equal(h.selected.at(-1).id, target.id, 'subsequent perspectives retain the chosen star');
    assert.deepEqual(h.selectedAnchors.at(-1), anchor); assert.equal(h.previews.at(-1).node.id, target.id);
    assert.ok(Number(h.canvas.dataset.inViewRecords) > 0);
    assert.equal(h.canvas.dataset.submittedRecords, '33945'); assert.equal(h.canvas.dataset.recordIdHash, idHash);
    assert.equal(records.values, values); assert.equal(records.buffer, buffer); assert.deepEqual(values, coordinates);
    assert.equal(h.gl.uploads.length, uploads, 'perspectives change only camera uniforms');
  }
  h.graph.select(h.graph.byId.get('@theme:2')); h.graph.setPerspective(8);
  assert.equal(h.selected.at(-1).id, '@theme:2', 'an explicitly selected theme takes priority over automatic record choice');
  h.graph.setLayers({ regions: false });
  assert.equal(h.graph.setPerspective(4), true);
  assert.equal(h.selected.at(-1).kind, 'item', 'automatic perspective targets records rather than hidden hubs');
});

test('perspectives leave empty data and invalid ratios unchanged', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setActive(true);
  const before = { pan: { ...h.graph.pan }, scale: h.graph.scale };
  for (const ratio of [4, 0, -1, NaN, Infinity]) assert.equal(h.graph.setPerspective(ratio), false);
  assert.deepEqual({ pan: h.graph.pan, scale: h.graph.scale }, before);
  assert.equal(h.selected.length, 0);
});

test('context loss renders every in-view record through Canvas2D, restores full buffers, and releases resources', t => {
  const h = harness(t, { gpu: true, layers: {}, reducedMotion: true });
  h.graph.setData(fullScaleData()); h.graph.setActive(true); h.tick(0);
  h.gl.lost = true;
  const loss = new Event('webglcontextlost', { cancelable: true }); h.gpuCanvas.dispatchEvent(loss); h.tick(0);
  assert.equal(loss.defaultPrevented, true, 'renderer opts into context restoration');
  assert.equal(h.canvas.dataset.backend, 'canvas2d');
  assert.equal(h.canvas.dataset.submittedRecords, '33945', 'fallback overview draws every source record, not a smaller sample');
  assert.equal(h.canvas.dataset.drawnPoints, '33951');
  h.graph.zoomBy(8); h.tick(0);
  assert.equal(h.canvas.dataset.submittedRecords, h.canvas.dataset.inViewRecords, 'fallback submission count honestly reflects camera culling');
  assert.ok(Number(h.canvas.dataset.submittedRecords) < 33945);
  assert.equal(h.canvas.dataset.recordCount, '33945', 'all records remain indexed');
  h.gl.lost = false; h.gpuCanvas.dispatchEvent(new Event('webglcontextrestored')); h.tick(0);
  assert.equal(h.canvas.dataset.backend, 'webgl');
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  const uploads = h.gl.uploads.length;
  h.graph.setActive(false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.gpuCanvas.style.display, 'none');
  h.graph.setActive(true); h.tick(0);
  assert.equal(h.gl.uploads.length, uploads, 'reactivation does not reupload unchanged buffers');
  h.graph.destroy();
  assert.ok(h.gl.deletedBuffers.length >= 5);
  assert.ok(h.gl.deletedPrograms.length >= 2);
  assert.equal(h.gpuCanvas.removed, true);
  h.gpuCanvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(h.gl.uploads.length, uploads, 'destroy removes context listeners');
});

test('filter replacement preserves camera and exact full-record membership without stale GPU vertices', t => {
  const h = harness(t, { gpu: true, layers: {}, reducedMotion: true });
  const data = fullScaleData(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  h.graph.zoomBy(3.5); h.send('keydown', { key: 'ArrowRight', shiftKey: true }); h.tick(0);
  const camera = { pan: { ...h.graph.pan }, scale: h.graph.scale };
  const retained = data.nodes.filter(node => node.kind === 'item' && Number(node.id.slice(-5)) % 4 === 0);
  h.graph.setData({ nodes: retained, edges: [], bounds: data.bounds }); h.tick(0);
  assert.deepEqual({ pan: h.graph.pan, scale: h.graph.scale }, camera);
  assert.equal(Number(h.canvas.dataset.submittedRecords), retained.length);
  assert.equal(h.graph.renderer.pointGroups.find(group => group.kind === 'item').values.length, retained.length * 6);
  assert.equal(h.graph.byId.has('record-00001'), false);
  assert.equal(h.graph.hit(h.graph.anchor(data.nodes[1]))?.id === 'record-00001', false, 'filtered-out record cannot remain pickable');
  const uploads = h.gl.uploads.length;
  const screen = h.graph.screen;
  h.graph.requestDraw(); h.graph.requestDraw(); h.tick(0);
  assert.equal(h.graph.screen, screen, 'unchanged camera reuses its screen index');
  assert.equal(h.gl.uploads.length, uploads);
  assert.equal(h.frames.size, 0, 'idle invalidation never starts a permanent loop');
});

test('unavailable graphics reports zero submissions while retaining exact source-record counts', t => {
  const h = harness(t, { noCanvas: true, layers: {} });
  h.graph.setData(fixture(100)); h.graph.setActive(true);
  assert.equal(h.graph.available, false);
  assert.equal(h.canvas.dataset.backend, 'unavailable');
  assert.equal(h.canvas.dataset.recordCount, '88');
  assert.equal(h.canvas.dataset.nameCount, '12');
  assert.equal(h.canvas.dataset.submittedRecords, '0');
  assert.equal(h.canvas.dataset.drawnPoints, '0');
  assert.equal(h.graph.byId.size, 100);
  assert.equal(h.frames.size, 0);
});

test('camera redraw and nearby picking do not sort catalog arrays or reupload buffers', t => {
  const h = harness(t, { gpu: true, layers: {}, reducedMotion: true });
  h.graph.setData(fixture(5000)); h.graph.setActive(true); h.tick(0);
  const originalSort = Array.prototype.sort, uploads = h.gl.uploads.length;
  Array.prototype.sort = () => { throw new Error('Unexpected per-frame catalog sort'); };
  try {
    h.graph.zoomBy(2); h.tick(0);
    const target = h.graph.byId.get('work-3000');
    h.graph.hit(h.graph.anchor(target));
    h.graph.requestDraw(); h.tick(0);
  } finally { Array.prototype.sort = originalSort; }
  assert.equal(h.gl.uploads.length, uploads);
});

test('all four route-toggle combinations govern both base routes and selected emphasis independently', t => {
  const h = harness(t, { gpu: true, reducedMotion: true, layers: {} });
  const nodes = [
    { id: 'a', label: 'Record A', kind: 'item', x: -60, y: 0 },
    { id: 'b', label: 'Record B', kind: 'item', x: 60, y: 0 },
    { id: 'theme', label: 'Inferred theme', kind: 'hub', x: 0, y: -60 },
  ];
  h.graph.setData({ nodes, edges: [{ from: 'a', to: 'b', inferred: false }, { from: 'theme', to: 'a', inferred: true }] });
  h.graph.setActive(true); h.tick(0);
  const painted = recordEdgePaints(h);
  for (const relationships of [false, true]) for (const inferred of [false, true]) {
    h.graph.setLayers({ relationships, inferred }); h.tick(0);
    h.graph.select(h.graph.byId.get('a')); painted.length = 0; h.tick(0);
    const selection = painted.filter(edge => edge.style === 'rgba(216,153,118,0.64)');
    assert.equal(Number(h.canvas.dataset.submittedEdges), Number(relationships) + Number(inferred));
    assert.equal(selection.filter(edge => !edge.dash.length).length, Number(relationships), 'documented emphasis follows its own toggle');
    assert.equal(selection.filter(edge => edge.dash.length).length, Number(inferred), 'inferred emphasis follows its own toggle');
    assert.equal(h.graph.selected, 'a', 'turning routes off preserves focused record visibility');
    assert.equal(h.canvas.dataset.submittedRecords, '2');
  }
});

test('GPU camera changes project bounded labels and never iterate the relationship collection', t => {
  const h = harness(t, { gpu: true, reducedMotion: true, layers: {} });
  h.graph.setData(fullScaleData()); h.graph.setActive(true); h.tick(0);
  const edges = h.graph.edges;
  h.graph.edges = new Proxy(edges, { get(target, key) {
    if (key === Symbol.iterator || ['filter', 'map', 'forEach'].includes(key)) throw new Error('Unexpected full relationship scan during camera draw');
    return Reflect.get(target, key);
  } });
  try {
    for (let i = 0; i < 8; i++) { h.graph.zoomBy(1.03); h.tick(0); }
  } finally { h.graph.edges = edges; }
  assert.ok(h.graph.screen.length <= 320, 'CPU projection is bounded while GPU renders the full dataset');
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.inViewRecords, '33945');
});

test('fractional device pixel ratios resize the GPU backing store once, not on every camera frame', t => {
  const h = harness(t, { gpu: true, reducedMotion: true, layers: {} });
  window.devicePixelRatio = 1.25;
  Object.assign(h.canvas.rect, { width: 997, height: 701 });
  let width = 0, writes = 0;
  Object.defineProperty(h.gpuCanvas, 'width', { get: () => width, set: value => { width = Math.trunc(value); writes++; } });
  h.graph.measure(); h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  assert.equal(width, Math.round(997 * 1.25));
  assert.equal(writes, 1);
  for (let i = 0; i < 5; i++) { h.graph.zoomBy(1.1); h.tick(0); }
  assert.equal(writes, 1, 'pan/zoom must not repeatedly reset the GPU drawing buffer');
});

test('overview names and routes stay faint while zoom strengthens routes without dropping vertices or edges', t => {
  const h = harness(t, { gpu: true, reducedMotion: true });
  h.graph.setData(fullScaleData()); h.graph.setActive(true); h.tick(0);
  const renderer = h.graph.renderer, nameBatch = renderer.pointGroups.find(group => group.kind === 'person');
  assert.equal(nameBatch.count, 7361);
  for (let i = 2; i < nameBatch.values.length; i += 6) assert.ok(Math.abs(nameBatch.values[i] - 0.9) < 1e-6);
  assert.ok(h.gl.uniforms.some(call => call.program === renderer.pointsProgram && call.name === 'u_alpha' && call.value === 0.48));
  assert.deepEqual(h.gl.blendFactors, [h.gl.SRC_ALPHA, h.gl.ONE_MINUS_SRC_ALPHA, h.gl.ONE, h.gl.ONE_MINUS_SRC_ALPHA], 'transparent compositing preserves source alpha rather than squaring it');
  for (const inferred of [false, true]) {
    const samples = [1, 2, 4, 8, 16, 64].map(zoom => routeOpacity(inferred, zoom));
    assert.equal(samples[0], inferred ? 0.006 : 0.008);
    assert.ok(samples.slice(1).every((value, i) => value >= samples[i]));
    assert.ok(samples.every(value => value <= (inferred ? 0.100001 : 0.080001)));
    assert.ok(h.gl.uniforms.some(call => call.program === renderer.linesProgram && call.name === 'u_alpha' && call.value === samples[0]));
  }
  const uploads = h.gl.uploads.length, edges = h.canvas.dataset.submittedEdges;
  h.graph.zoomBy(16); h.tick(0);
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.submittedNames, '7361');
  assert.equal(h.canvas.dataset.submittedEdges, edges);
  assert.equal(h.gl.uploads.length, uploads, 'zoom opacity uses uniforms, never resampling data');
});

test('region selection highlights exact unique record membership without replacing full geometry', t => {
  const h = harness(t, { gpu: true, reducedMotion: true, layers: {} });
  h.graph.setData(fullScaleData()); h.graph.setActive(true); h.tick(0);
  const renderer = h.graph.renderer, records = renderer.pointGroups.find(group => group.kind === 'item');
  const geometry = records.values, buffer = records.buffer, hash = h.canvas.dataset.recordIdHash;
  const initialUploads = h.gl.uploads.length;
  const ids = new Set(['record-00003', 'record-10000', 'record-33944', 'name-1', '@theme:0', 'missing']);
  h.graph.setRegionSelection(ids, { id: 'minds', label: 'Minds & machines', total: 1584 }); h.tick(0);
  assert.deepEqual([...h.graph.regionSelection], ['record-00003', 'record-10000', 'record-33944']);
  assert.deepEqual([...records.selectionValues.keys()].filter(i => records.selectionValues[i]), [3, 10000, 33944]);
  assert.equal(h.canvas.dataset.selectedRecords, '3'); assert.equal(h.canvas.dataset.regionMemberTotal, '1584');
  assert.equal(h.canvas.dataset.regionId, 'minds'); assert.equal(h.canvas.dataset.regionLabel, 'Minds & machines');
  assert.equal(h.canvas.dataset.submittedRecords, '33945'); assert.equal(h.canvas.dataset.recordIdHash, hash);
  assert.equal(records.values, geometry); assert.equal(records.buffer, buffer);
  assert.equal(h.gl.uploads.length, initialUploads + 1, 'only the small selection mask uploads');
  assert.equal(h.gl.uploads.at(-1).values.length, 33945);
  const selectionBuffer = records.selectionBuffer;
  ids.clear();
  assert.equal(h.graph.regionSelection.size, 3, 'caller mutations cannot alter a rendered selection silently');
  h.graph.setRegionSelection(new Set(['record-00003', 'record-10000', 'record-33944']), { id: 'minds', total: 1584 }); h.tick(0);
  assert.equal(h.gl.uploads.length, initialUploads + 1, 'same membership reuses the mask');
  h.graph.reset(); h.tick(0);
  assert.equal(h.canvas.dataset.selectedRecords, '3', 'camera reset preserves the active exact membership');
  assert.equal(records.buffer, buffer); assert.equal(h.gl.uploads.length, initialUploads + 1);
  h.graph.zoomBy(2); h.graph.setLayers({ regions: false, inferred: true, names: true }); h.tick(0);
  assert.equal(h.gl.uploads.length, initialUploads + 1, 'camera and independent layers upload nothing');
  assert.equal(h.canvas.dataset.submittedRecords, '33945'); assert.equal(h.canvas.dataset.submittedEdges, '3000');
  h.graph.setRegionSelection(new Set(['record-00000', 'record-00001']), { id: 'unmatched', label: 'No current title-keyword match', total: 20000 }); h.tick(0);
  assert.equal(records.selectionBuffer, selectionBuffer); assert.equal(records.buffer, buffer); assert.equal(records.values, geometry);
  assert.deepEqual([...records.selectionValues.keys()].filter(i => records.selectionValues[i]), [0, 1]);
  const uploads = h.gl.uploads.length;
  h.graph.setRegionSelection(null); h.tick(0);
  assert.equal(h.canvas.dataset.selectedRecords, '0'); assert.equal(h.canvas.dataset.regionId, '');
  assert.equal(h.gl.uploads.length, uploads, 'clearing selection changes a uniform, not data');
  assert.equal(h.canvas.dataset.submittedRecords, '33945'); assert.equal(h.frames.size, 0);
});

test('all six region labels and hub picking work without inferred routes or record labels', t => {
  const h = harness(t, { gpu: true, reducedMotion: true, layers: { labels: false } });
  Object.assign(h.canvas.rect, { width: 1400, height: 1000 }); h.graph.measure();
  const data = fullScaleData();
  data.nodes.filter(node => node.kind === 'hub').forEach((node, i) => { node.x = (i % 3 - 1) * 760; node.y = (Math.floor(i / 3) - 0.5) * 1000; node.count = i + 20; });
  data.regions = data.nodes.filter(node => node.kind === 'hub').map(node => ({ ...node, radiusX: 400, radiusY: 300 }));
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const regionLabels = h.graph.labelBoxes.filter(box => h.graph.byId.get(box.id).kind === 'hub');
  assert.equal(regionLabels.length, 6, 'six spatial labels are attempted independently; generous space shows all');
  assert.equal(h.canvas.dataset.submittedEdges, '0');
  for (const box of regionLabels) assert.equal(h.graph.hit({ x: box.x + 4, y: box.y + 4 }).id, box.id);
  h.graph.setLayers({ inferred: true, regions: false }); h.tick(0);
  assert.equal(h.canvas.dataset.submittedEdges, '3000', 'route lines remain available when region shapes/hubs are off');
  assert.equal(h.canvas.dataset.drawnPoints, '33945');
  assert.equal(h.graph.labelBoxes.length, 0);
  h.graph.focusRecord('@theme:2'); h.tick(0);
  assert.equal(h.graph.layers.regions, true, 'locating a theme enables regions');
  h.graph.setLayers({ inferred: false }); h.tick(0);
  assert.equal(h.graph.nodeEnabled(h.graph.byId.get('@theme:2')), true);
});

test('distant region labels use bounded outer positions without covering controls or moving hubs', t => {
  const h = harness(t, { reducedMotion: true, layers: { names: false, labels: false, regions: true } });
  const names = ['Minds and machines', 'Bodies and medicine', 'Power and society', 'Planet and environment', 'Culture and identity', 'Futures and change'];
  const nodes = names.map((label, i) => ({ id: `theme-${i}`, label, count: 100 + i, kind: 'hub', x: (i % 3 - 1) * 90, y: (Math.floor(i / 3) - 0.5) * 90 }));
  const overlays = [{ left: 0, top: 0, width: 260, height: 120 }, { left: 760, top: 0, width: 240, height: 90 }, { left: 410, top: 275, width: 230, height: 220 }, { left: 0, top: 590, width: 1000, height: 110 }];
  h.canvas.parentElement = { querySelectorAll: () => overlays.map(rect => ({ getBoundingClientRect: () => rect })) };
  h.graph.setData({ nodes, bounds: { left: -1400, right: 1400, top: -1100, bottom: 1100 } });
  h.graph.setActive(true); h.graph.zoomBy(0.4); h.tick(0);
  assert.equal(h.graph.labelBoxes.length, 6, 'a roomy distant view labels all six clustered hubs');
  assert.ok(h.graph.labelBoxes.some(box => {
    const point = h.graph.anchor(h.graph.byId.get(box.id));
    return Math.max(box.x - point.x, point.x - box.x - box.width, box.y - point.y, point.y - box.y - box.height) > 112;
  }), 'crowded hubs use space beyond the old local search');
  for (const box of h.graph.labelBoxes) {
    assert.ok(box.x >= 8 && box.y >= 8 && box.x + box.width <= h.graph.width - 8 && box.y + box.height <= h.graph.height - 8);
    assert.ok(h.graph.labelExclusions().every(other => !h.graph.overlaps(box, other, 3)));
    assert.ok(h.graph.labelBoxes.every(other => box === other || !h.graph.overlaps(box, other)));
    assert.equal(h.graph.hit({ x: box.x + box.width / 2, y: box.y + box.height / 2 }).id, box.id, 'displaced titles retain their original hub hit target');
  }
  assert.deepEqual(h.graph.nodes.map(({ x, y }) => ({ x, y })), nodes.map(({ x, y }) => ({ x, y })), 'leaders displace only labels');
  assert.equal(h.frames.size, 0, 'distant label layout returns to idle');
});

test('selection survives graphics loss/restoration, empty facets and stale record removal', t => {
  const h = harness(t, { gpu: true, reducedMotion: true, layers: {} });
  const data = fullScaleData(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  h.graph.setRegionSelection(new Set(['record-00003', 'record-10000']), { id: 'futures', total: 2700 }); h.tick(0);
  const oldBuffer = h.graph.renderer.pointGroups[0].selectionBuffer;
  h.gl.lost = true; h.gpuCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); h.tick(0);
  assert.equal(h.canvas.dataset.backend, 'canvas2d'); assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.selectedRecords, '2');
  h.gl.lost = false; h.gpuCanvas.dispatchEvent(new Event('webglcontextrestored')); h.tick(0);
  const records = h.graph.renderer.pointGroups[0];
  assert.notEqual(records.selectionBuffer, oldBuffer);
  assert.deepEqual([...records.selectionValues.keys()].filter(i => records.selectionValues[i]), [3, 10000]);
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  h.graph.setRegionSelection(new Set(), { id: 'futures', total: 2700 }); h.tick(0);
  assert.equal(h.graph.regionSelection.size, 0); assert.equal(h.canvas.dataset.selectedRecords, '0');
  assert.equal(records.selectionValues.some(value => value !== 0), false);
  h.graph.setRegionSelection(new Set(['record-00003', 'record-10000']), { id: 'futures', total: 2700 });
  h.graph.setData({ nodes: data.nodes.slice(0, 100), edges: [], bounds: data.bounds }); h.tick(0);
  assert.deepEqual([...h.graph.regionSelection], ['record-00003']);
  assert.equal(h.canvas.dataset.selectedRecords, '1'); assert.equal(h.canvas.dataset.recordCount, '100');
  assert.equal(h.graph.renderer.pointGroups[0].selectionValues.length, 100);
});

test('Canvas fallback keeps region routes independent and highlights all selected visible records', t => {
  const h = harness(t, { reducedMotion: true, layers: { names: false, labels: false, regions: false, inferred: true, relationships: false } });
  const data = fullScaleData(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  h.graph.setRegionSelection(new Set(data.nodes.filter(node => node.kind === 'item').map(node => node.id)), { id: 'unmatched' }); h.tick(0);
  assert.equal(h.canvas.dataset.backend, 'canvas2d'); assert.equal(h.canvas.dataset.selectedRecords, '33945');
  assert.equal(h.canvas.dataset.drawnPoints, '33945'); assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.submittedEdges, '3000'); assert.equal(h.frames.size, 0);
});

test('Canvas selection paints only exact member IDs bright while surrounding records stay visible', t => {
  const h = harness(t, { reducedMotion: true, layers: { labels: false, names: false, inferred: false, relationships: false } });
  const nodes = Array.from({ length: 20 }, (_, i) => ({ id: `record-${i}`, label: `Record ${i}`, kind: 'item', x: i * 30, y: i % 2 * 50 }));
  h.graph.setData({ nodes, edges: [] }); h.graph.setActive(true); h.tick(0);
  const ctx = h.graph.ctx, batches = []; let arcs = [];
  ctx.beginPath = () => { arcs = []; };
  ctx.arc = (x, y) => arcs.push({ x, y });
  ctx.fill = () => batches.push({ color: ctx.fillStyle, alpha: ctx.globalAlpha, arcs });
  h.graph.setRegionSelection(new Set(['record-1', 'record-7', 'record-19']), { id: 'unmatched' }); h.tick(0);
  const bright = batches.find(batch => batch.color === '#ffd192'), dim = batches.find(batch => batch.color === '#a9c9db');
  assert.equal(bright.alpha, 0.94); assert.equal(dim.alpha, 0.16);
  assert.deepEqual(bright.arcs, ['record-1', 'record-7', 'record-19'].map(id => h.graph.anchor(h.graph.byId.get(id))));
  assert.equal(dim.arcs.length, 17); assert.equal(h.canvas.dataset.submittedRecords, '20');
  assert.equal(h.frames.size, 0, 'selection is static under reduced motion');
});
