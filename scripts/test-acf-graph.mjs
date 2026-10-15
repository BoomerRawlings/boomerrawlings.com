import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AtlasGraph } from '../public/ACF/graph.js';
import { routeOpacity } from '../public/ACF/graph-renderer.js';
import { routeStyle, routePointAt } from '../public/ACF/route-style.js';
import { buildTerritory } from '../public/ACF/territory-geometry.js';
import { nodeAppearance } from '../public/ACF/node-style.js';

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
    getAttribLocation: (_, name) => ({ a_position: 0, a_size: 1, a_distance: 1, a_color: 2, a_selected: 3, a_progress: 4, a_destination: 5, a_viewPosition: 4, a_viewFrom: 5, a_viewTo: 6, a_style: 7 })[name],
    getUniformLocation: (_, name) => name, useProgram: value => { program = value; }, uniform1f: (name, value) => gl.uniforms.push({ program, name, value }), uniform2f() {}, uniform3f() {},
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
  return { graph, canvas, gpuCanvas, gl, frames, labels, labelBoxes, dashes, status, selected, selectedAnchors, previews, labelReports, zooms, media, doc, tick, elapse: milliseconds => { time += milliseconds; }, send, pointer };
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

for (const dense of [false, true]) test(`entrance targets cover real visible records at ${dense ? 'dense' : 'wide'} overview without altering geometry or GPU buffers`, t => {
  const h = harness(t, { gpu: true, reducedMotion: true });
  const camera = { scale: .8, pan: { x: 65, y: 35 } };
  const nodes = [];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 10; col++) for (let copy = 0; copy < 3; copy++) {
    const sx = dense ? 430 + col * 14 + copy : 40 + col * 95 + copy;
    const sy = dense ? 290 + row * 16 + copy : 35 + row * 120 + copy;
    nodes.push({ id: `record-${row}-${col}-${copy}`, kind: 'item', label: 'A real publication', color: '#aaccee',
      x: (sx - camera.pan.x) / camera.scale, y: (sy - camera.pan.y) / camera.scale });
  }
  nodes.push({ id: 'name-only', kind: 'person', x: 400, y: 350 }, { id: '@theme:empty', kind: 'hub', x: 500, y: 350 },
    { id: 'offscreen', kind: 'item', x: -10000, y: -10000 }, { id: 'outside-margin', kind: 'item', x: (5 - camera.pan.x) / camera.scale, y: 250 });
  const canonical = nodes.map(({ id, x, y }) => ({ id, x, y }));
  h.graph.setData({ nodes, edges: [] }); h.graph.setActive(true);
  const cleared = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y }));
  h.graph.scale = camera.scale; h.graph.pan = { ...camera.pan }; h.tick(0);
  const groups = h.graph.renderer.pointGroups.map(group => ({ values: group.values, buffer: group.buffer, bytes: [...group.values] }));
  const uploads = h.gl.uploads.length, targets = h.graph.entranceTargets();
  assert.equal(targets.length, 60, 'Both broad and compact fields produce a geographically spread bounded sample');
  assert.equal(new Set(targets.map(point => point.id)).size, 60);
  assert.equal(new Set(targets.map(point => point.id.split('-').slice(0, 3).join('-'))).size, 60, 'Every occupied test area contributes, rather than selecting one dense corner');
  for (const target of targets) {
    const node = h.graph.byId.get(target.id);
    assert.equal(node.kind, 'item', 'Names and empty territory centers never become transfer stars');
    assert.equal(target.x, node.x * camera.scale + camera.pan.x);
    assert.equal(target.y, node.y * camera.scale + camera.pan.y);
    assert(target.x >= 12 && target.x <= h.graph.width - 12 && target.y >= 12 && target.y <= h.graph.height - 12);
    assert(target.radius > 0 && Number.isFinite(target.radius)); assert.equal(target.color, '#aaccee');
  }
  assert.deepEqual(h.graph.entranceTargets(), targets, 'The same field has stable IDs and destinations');
  assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), cleared);
  assert.deepEqual(nodes.map(({ id, x, y }) => ({ id, x, y })), canonical);
  h.graph.renderer.pointGroups.forEach((group, i) => {
    assert.equal(group.values, groups[i].values); assert.equal(group.buffer, groups[i].buffer);
    assert.deepEqual([...group.values], groups[i].bytes);
  });
  assert.equal(h.gl.uploads.length, uploads, 'Sampling targets uploads no replacement geometry');
  assert.deepEqual(h.graph.pan, camera.pan); assert.equal(h.graph.scale, camera.scale);
});

for (const noCanvas of [false, true]) test(`entrance targets handle ${noCanvas ? 'unavailable graphics' : 'empty and offscreen fields'} without inventing records`, t => {
  const h = harness(t, { noCanvas, reducedMotion: true });
  assert.deepEqual(h.graph.entranceTargets(), []);
  h.graph.setData({ nodes: [{ id: 'item', kind: 'item', x: 0, y: 0 }, { id: 'name', kind: 'person', x: 2, y: 2 }], edges: [] });
  h.graph.setActive(true); h.tick(0);
  if (noCanvas) assert.deepEqual(h.graph.entranceTargets(), []);
  else {
    assert.deepEqual(h.graph.entranceTargets().map(point => point.id), ['item']);
    h.graph.pan = { x: -10000, y: -10000 };
    assert.deepEqual(h.graph.entranceTargets(), []);
    h.graph.width = 0; assert.deepEqual(h.graph.entranceTargets(), []);
  }
});

function territoryFixture() {
  const nodes = [];
  for (const [lobe, cx, cy, radius] of [[0, -145, -35, 85], [1, 135, 0, 105], [2, 20, 145, 65]]) {
    for (let i = 0; i < 90; i++) {
      const angle = i * 2.39996, distance = Math.sqrt((i + 1) / 90) * radius;
      nodes.push({ id: `member-${lobe}-${i}`, kind: 'item', label: `Publication ${lobe}-${i}`, x: cx + Math.cos(angle) * distance, y: cy + Math.sin(angle) * distance });
    }
  }
  for (let i = 0; i < 50; i++) nodes.push({ id: `bridge-${i}`, kind: 'item', label: `Bridge ${i}`, x: -145 + i * 5.7, y: Math.sin(i) * 24 });
  nodes.push({ id: '@theme:organic', kind: 'hub', label: 'Organic subject', x: 0, y: 0, count: 320 });
  const memberIds = nodes.filter(node => node.kind === 'item').map(node => node.id);
  return { nodes, edges: nodes.slice(0, 12).map(node => ({ from: '@theme:organic', to: node.id, inferred: true, type: 'theme' })), regions: [{ id: '@theme:organic', themeId: 'organic', label: 'Organic subject', x: 0, y: 0, count: memberIds.length, memberIds }] };
}

function comparisonFixture() {
  const nodes = Array.from({ length: 100 }, (_, i) => ({ id: `r-${i}`, kind: 'item', label: `Record ${i}`, x: Math.cos(i * 2.4) * 550, y: Math.sin(i * 2.4) * 430 }));
  nodes.push(...Array.from({ length: 4 }, (_, i) => ({ id: `p-${i}`, kind: 'person', label: `Source name ${i}`, x: 750, y: -240 + i * 160 })));
  nodes.push({ id: '@theme:left', kind: 'hub', label: 'Left territory', x: -400, y: 0 }, { id: '@theme:right', kind: 'hub', label: 'Right territory', x: 400, y: 0 });
  const leftIds = new Set(nodes.slice(0, 45).map(node => node.id)), rightIds = new Set(nodes.slice(35, 80).map(node => node.id)), shared = new Set(nodes.slice(35, 45).map(node => node.id));
  const edges = [{ from: 'p-0', to: 'r-0', type: 'credit', role: 'Author' }, { from: 'p-1', to: 'r-60', type: 'credit', role: 'Editor' }, { from: 'p-2', to: 'r-1', type: 'credit', role: 'Author' }, { from: 'p-2', to: 'r-61', type: 'credit', role: 'Author' }, { from: 'p-3', to: 'r-40', type: 'credit', role: 'Author' }, { from: 'r-4', to: 'r-62', type: 'relationship', kind: 'related_article', inferred: false }, { from: 'r-2', to: 'r-63', type: 'relationship', inferred: true }, { from: '@theme:left', to: 'r-0', type: 'theme', inferred: true }, { from: '@theme:right', to: 'r-60', type: 'theme', inferred: true }];
  const config = { key: 'left+right', left: { id: 'left', label: 'Left territory', color: '#90c2d1', memberIds: leftIds }, right: { id: 'right', label: 'Right territory', color: '#c5a5cc', memberIds: rightIds }, leftOnly: new Set([...leftIds].filter(id => !shared.has(id))), rightOnly: new Set([...rightIds].filter(id => !shared.has(id))), shared, memberIds: new Set([...leftIds, ...rightIds]), personIds: new Set(['p-0', 'p-1', 'p-2', 'p-3']), bridgePersonIds: new Set(['p-2']), edges };
  return { data: { nodes, edges }, config };
}

for (const vertical of [false, true]) test(`comparison captions explain exclusive clouds and the shared middle at ${vertical ? 'phone' : 'desktop'} overview without entering hit indexes`, t => {
  const h = harness(t, { gpu: true, reducedMotion: true }), { data, config } = comparisonFixture();
  if (vertical) { h.canvas.rect = { ...h.canvas.rect, width: 320, height: 520 }; h.graph.measure(); }
  h.graph.setData(data); h.graph.setActive(true); h.graph.setComparison(config); h.tick(0);
  const plans = h.graph.comparisonLabelPlans;
  assert.equal(plans.length, 3, 'Every membership group has a persistent caption');
  assert.deepEqual(plans.map(plan => plan.key), ['left', 'shared', 'right']);
  assert.equal(plans[0].title.join(' '), 'Left territory');
  assert.equal(plans[2].title.join(' '), 'Right territory');
  assert.deepEqual(plans[0].lines, ['35 records', 'Only this side']);
  assert.equal(plans[1].lines[0], '10 records');
  assert.equal(plans[1].lines[1], '2 name hubs', 'Middle includes a name credited only to shared records; it is not necessarily an exclusive-side bridge');
  for (const plan of plans) {
    const { box } = plan;
    assert(box.x >= 0 && box.x + box.width <= h.graph.width && box.y >= 0 && box.y + box.height <= h.graph.height);
    assert(h.graph.labelBoxes.every(label => label !== box && !h.graph.overlaps(label, box, 3)), 'Record hover boxes and spatial captions do not overlap');
    assert(h.labelReports.at(-1).every(label => label.id !== plan.key), 'Decorative captions are never reported as selectable records');
  }
  if (vertical) assert(plans[0].box.y < plans[1].box.y && plans[1].box.y < plans[2].box.y);
  else assert(plans[0].box.x < plans[1].box.x && plans[1].box.x < plans[2].box.x);
  const canonical = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), uploads = h.gl.uploads.length;
  h.graph.requestDraw(); h.tick(0);
  assert.equal(h.gl.uploads.length, uploads, 'Caption drawing does not rebuild graph buffers');
  assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), canonical);
  h.graph.setComparison(null); h.tick(0);
  assert.deepEqual(h.graph.comparisonLabelPlans, [], 'Caption geometry clears with comparison');
});

test('comparison name labels count distinct displayed credit records, retaining ordinary hover and catalog-wide source counts', t => {
  const h = harness(t, { gpu: true, reducedMotion: true }), { data, config } = comparisonFixture();
  const person = data.nodes.find(node => node.id === 'p-2'); person.count = 1699;
  data.edges.push({ from: 'p-2', to: 'r-1', type: 'credit', role: 'Editor' });
  h.graph.setData(data); h.graph.setActive(true); h.graph.setComparison(config); h.tick(0);
  const node = h.graph.byId.get('p-2'), anchor = h.graph.anchor(node);
  h.graph.labelBoxes = [];
  h.pointer('pointermove', 1, anchor.x, anchor.y, 'mouse'); h.tick(0);
  assert.equal(h.graph.hovered, node.id);
  assert.equal(h.previews.at(-1).node.id, node.id);
  assert.equal(h.graph.comparison.labelCounts.get(node.id), 2, 'Two roles on the same record do not inflate displayed count');
  assert.equal(node.count, 1699, 'Original catalog-wide metadata stays intact');
  assert.equal(h.graph.labelPlans.find(plan => plan.node.id === node.id)?.count, '2 connections');
  assert.equal(h.graph.comparison.labelCounts.get('@theme:left'), 45, 'A hovered theme counts all selected theme members, including shared records');
});

test('full Atlas reset glides from close-up to overview without reopening a selected record', t => {
  const h = harness(t), data = fixture();
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const overview = { scale: h.graph.scale, pan: { ...h.graph.pan } };
  const canonical = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y }));
  h.graph.focusRecord('work-40'); h.tick(600);
  const selectedCount = h.selected.length, closeScale = h.graph.scale, closePan = { ...h.graph.pan };
  h.graph.reset({ smooth: true, universe: true });
  assert.equal(h.graph.scale, closeScale, 'Reset starts at the visible camera');
  assert.deepEqual(h.graph.pan, closePan);
  assert(h.graph.cameraFlight);
  assert.equal(h.graph.selected, null);
  assert.equal(h.graph.regionSelection, null);
  h.tick(400);
  assert(h.graph.scale < closeScale && h.graph.scale > overview.scale, 'Intermediate frame has genuine continuous zoom');
  h.tick(400);
  assert.equal(h.graph.cameraFlight, null);
  assert.equal(h.graph.scale, overview.scale);
  assert.deepEqual(h.graph.pan, overview.pan);
  assert.equal(h.selected.length, selectedCount, 'Overview arrival emits no item selection');
  assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), canonical);
});

test('full Atlas reset exits comparison to universe, overriding the saved close-up camera', t => {
  const h = harness(t, { gpu: true }), { data, config } = comparisonFixture();
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const overview = { scale: h.graph.scale, pan: { ...h.graph.pan } };
  const canonical = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y }));
  h.graph.zoomBy(7); h.graph.setComparison(config); h.tick(800);
  h.graph.reset({ smooth: true, universe: true });
  assert.equal(h.graph.comparison.exiting, true);
  assert.equal(h.graph.comparison.cameraFollowing, false, 'Comparison exit cannot overwrite overview flight');
  h.tick(400); assert(h.graph.comparison);
  h.tick(400);
  assert.equal(h.graph.comparison, null);
  assert.equal(h.graph.renderer.comparison, null);
  assert.equal(h.graph.scale, overview.scale);
  assert.deepEqual(h.graph.pan, overview.pan);
  h.tick(1600);
  assert.equal(h.graph.scale, overview.scale, 'No late close-up restoration');
  assert.deepEqual(h.graph.pan, overview.pan);
  assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), canonical);
});

test('full Atlas reset remains an overview when the viewport resizes during comparison exit', t => {
  const h = harness(t, { gpu: true }), { data, config } = comparisonFixture();
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  h.graph.zoomBy(7); h.graph.setComparison(config); h.tick(800);
  h.graph.reset({ smooth: true, universe: true }); h.tick(200);
  Object.assign(h.canvas.rect, { width: 390, height: 844 });
  h.graph.measure(); h.tick(1200);
  assert.equal(h.graph.comparison, null);
  assert.equal(h.graph.cameraFlight, null);
  assert.equal(h.graph.scale, h.graph.baseScale, 'Reset remains at overview scale after resize');
  const frame = h.graph.viewportFrame(), points = h.graph.nodes.map(node => h.graph.anchor(node));
  assert(Math.min(...points.map(point => point.x)) >= frame.left - 1e-8);
  assert(Math.max(...points.map(point => point.x)) <= h.graph.width - frame.right + 1e-8);
  assert(Math.min(...points.map(point => point.y)) >= frame.top - 1e-8);
  assert(Math.max(...points.map(point => point.y)) <= h.graph.height - frame.bottom + 1e-8);
});

for (const mode of ['reduced motion', 'paused', 'hidden', 'inactive']) {
  test(`full Atlas reset settles immediately when ${mode}`, t => {
    const h = harness(t, { reducedMotion: mode === 'reduced motion' });
    h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
    const overview = { scale: h.graph.scale, pan: { ...h.graph.pan } };
    h.graph.zoomBy(8);
    if (mode === 'paused') h.graph.toggleMotion();
    if (mode === 'hidden') h.doc.hidden = true;
    if (mode === 'inactive') h.graph.setActive(false);
    h.graph.reset({ smooth: true, universe: true });
    assert.equal(h.graph.cameraFlight, null);
    assert.equal(h.graph.scale, overview.scale);
    assert.deepEqual(h.graph.pan, overview.pan);
    assert.equal(h.graph.selected, null);
  });
}

test('entrance target handoff settles comparison positions and excludes faded background records', t => {
  const h = harness(t, { gpu: true }), { data, config } = comparisonFixture();
  config.left.memberIds = new Set(['r-0']); config.right.memberIds = new Set(['r-60']);
  config.leftOnly = config.left.memberIds; config.rightOnly = config.right.memberIds;
  config.shared = new Set(); config.memberIds = new Set(['r-0', 'r-60']);
  config.personIds = new Set(); config.bridgePersonIds = new Set(); config.edges = [];
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const canonical = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y }));
  const baseBuffers = h.graph.renderer.pointGroups.map(group => group.buffer);
  h.graph.setComparison(config); h.tick(180);
  assert(h.graph.comparison.progress > 0 && h.graph.comparison.progress < 1, 'The handoff begins during an actual layout transition');
  const targets = h.graph.entranceTargets();
  assert.equal(h.graph.comparison.progress, 1, 'Handoff records the settled temporary layout');
  assert.deepEqual(new Set(targets.map(point => point.id)), config.memberIds, 'Only the two active subject records become destinations; background stars remain faded');
  for (const target of targets) {
    const expected = h.graph.anchor(h.graph.byId.get(target.id));
    assert.equal(target.x, expected.x); assert.equal(target.y, expected.y);
  }
  assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), canonical);
  h.graph.renderer.pointGroups.forEach((group, i) => assert.equal(group.buffer, baseBuffers[i]));
});

test('comparison interpolates cached GPU attributes and truthful routes, with exact reversible model positions', t => {
  const h = harness(t, { gpu: true, layers: { names: false, regions: false, relationships: false, inferred: false, labels: false } }), { data, config } = comparisonFixture();
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const before = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), baseGroups = h.graph.renderer.pointGroups.map(group => ({ values: group.values, buffer: group.buffer })), camera = { scale: h.graph.scale, pan: { ...h.graph.pan } };
  h.graph.setComparison(config); h.tick(0);
  const uploads = h.gl.uploads.length, point = h.graph.byId.get('r-0'), original = { x: point.x, y: point.y }, target = h.graph.comparison.layout.targets.get(point.id);
  assert.deepEqual(h.graph.displayPosition(point), original);
  h.tick(400); assert.equal(h.canvas.dataset.comparisonProgress, '0.5');
  assert.ok(Math.hypot(h.graph.displayPosition(point).x - (original.x + target.x) / 2, h.graph.displayPosition(point).y - (original.y + target.y) / 2) < 1e-10);
  assert.equal(h.gl.uploads.length, uploads, 'intermediate frames change only progress/camera uniforms');
  for (const edge of h.graph.comparison.edges) {
    const route = h.graph.renderer.routeFor(edge);
    assert.deepEqual(route.points[0], h.graph.displayPosition(h.graph.byId.get(edge.from)));
    assert.deepEqual(route.points.at(-1), h.graph.displayPosition(h.graph.byId.get(edge.to)));
    assert.ok(h.graph.nodeEnabled(h.graph.byId.get(edge.from)) && h.graph.nodeEnabled(h.graph.byId.get(edge.to)), 'every displayed evidence route has two actual enabled endpoints');
  }
  h.tick(400); assert.equal(h.canvas.dataset.comparisonProgress, '1');
  assert.equal(h.canvas.dataset.comparisonRecords, '80'); assert.equal(h.canvas.dataset.comparisonNames, '4'); assert.equal(h.canvas.dataset.comparisonShared, '10'); assert.equal(h.canvas.dataset.comparisonEdges, '9');
  assert.equal(h.canvas.dataset.submittedRecords, '100', 'unrelated records stay in the complete point buffer');
  assert.equal(h.canvas.dataset.submittedEdges, '9', 'only supplied, actual comparison assertions are drawn');
  assert.deepEqual(h.graph.layers, { names: false, labels: false, regions: false, relationships: false, inferred: false }, 'comparison visibility never overwrites user layer preferences');
  assert.ok(h.graph.comparison.points.get('r-99').to.opacity < 0.02); assert.equal(h.graph.nodeEnabled(h.graph.byId.get('r-99')), false, 'unrelated ghosts do not steal picks');
  for (const [id, expected] of [['r-0', -1], ['r-60', 1], ['r-40', 0], ['p-2', 0], ['p-3', 0]]) {
    const position = h.graph.displayPosition(h.graph.byId.get(id));
    assert.ok(expected === 0 ? Math.abs(position.x) < 115 : position.x * expected > 180, `${id} occupies the correct cluster or shared lane`);
  }
  h.graph.labelBoxes = []; const selected = h.graph.anchor(point); assert.equal(h.graph.hit(selected)?.id, point.id, 'temporary positions are truly pickable');
  h.graph.setComparison(null); h.tick(400); assert.ok(h.graph.comparison.exiting); h.tick(400);
  assert.equal(h.graph.comparison, null); assert.equal(h.graph.renderer.comparison, null); assert.equal(h.canvas.dataset.comparisonKey, '');
  assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), before);
  assert.deepEqual(h.graph.displayPosition(point), point, 'clearing restores canonical coordinates');
  assert.ok(Math.abs(h.graph.scale - camera.scale) < 1e-12); assert.deepEqual(h.graph.pan, camera.pan);
  baseGroups.forEach((group, i) => { assert.equal(h.graph.renderer.pointGroups[i].values, group.values); assert.equal(h.graph.renderer.pointGroups[i].buffer, group.buffer); });
  assert.equal(h.canvas.dataset.submittedEdges, '0'); assert.equal(h.frames.size, 0);
});

test('comparison switching, drag, static motion, hidden state and phone orientation preserve a coherent current layout', t => {
  const h = harness(t, { gpu: true, layers: { labels: false } }), { data, config } = comparisonFixture(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const initialCenter = h.graph.viewportCenter(), initialWorld = { x: (initialCenter.x - h.graph.pan.x) / h.graph.scale, y: (initialCenter.y - h.graph.pan.y) / h.graph.scale }, initialZoom = h.graph.scale / h.graph.baseScale;
  h.graph.setComparison(config); h.tick(240);
  const before = h.graph.displayPosition(h.graph.byId.get('r-0'));
  const reversed = { ...config, key: 'right+left', left: config.right, right: config.left, leftOnly: config.rightOnly, rightOnly: config.leftOnly };
  h.graph.setComparison(reversed); assert.deepEqual(h.graph.displayPosition(h.graph.byId.get('r-0')), before, 'replacement starts from current interpolated positions');
  h.tick(200); const pan = { ...h.graph.pan };
  h.pointer('pointerdown', 1, 900, 500); h.pointer('pointermove', 1, 925, 530); h.pointer('pointerup', 1, 925, 530); h.tick(600);
  assert.deepEqual(h.graph.pan, { x: pan.x + 25, y: pan.y + 30 }, 'drag interrupts auto-framing, never snaps back when layout completes');
  h.graph.select(h.graph.byId.get('r-60')); h.tick(600);
  const centered = h.graph.anchor(h.graph.byId.get('r-60')), center = h.graph.viewportCenter();
  assert.ok(Math.hypot(centered.x - center.x, centered.y - center.y) < 1e-8, 'click centers the temporary, not canonical, star location');
  h.graph.setComparison(config); h.tick(180); h.graph.toggleMotion(); h.tick(0);
  assert.equal(h.graph.comparison.progress, 1); assert.equal(h.frames.size, 0, 'pause settles comparison and stops flow');
  h.graph.setComparison(reversed); h.tick(0); assert.equal(h.graph.comparison.progress, 1, 'paused changes render their final state directly');
  h.graph.toggleMotion(); h.graph.setComparison(config); h.tick(160); h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.graph.comparison.progress, 1); assert.equal(h.frames.size, 0);
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); h.tick(0);
  h.media.matches = true; h.media.dispatchEvent(new Event('change'));
  Object.assign(h.canvas.rect, { width: 390, height: 844 }); h.graph.measure(); h.tick(0);
  assert.equal(h.graph.comparison.layout.vertical, true);
  assert.ok(h.graph.displayPosition(h.graph.byId.get('r-0')).y < -180 && h.graph.displayPosition(h.graph.byId.get('r-60')).y > 180, 'phone places both clusters vertically');
  assert.ok(Math.abs(h.graph.displayPosition(h.graph.byId.get('r-40')).y) < 36, 'shared records remain in the narrow middle bridge');
  const uploads = h.gl.uploads.length; h.graph.setComparison(config); h.tick(0); assert.equal(h.gl.uploads.length, uploads, 'same pair refresh reuses layout/buffers');
  h.gl.lost = true; h.gpuCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); h.tick(0);
  assert.equal(h.canvas.dataset.backend, 'canvas2d'); assert.equal(h.canvas.dataset.comparisonRecords, '80');
  for (const node of h.graph.screen) assert.deepEqual({ x: node.sx, y: node.sy }, h.graph.anchor(node), 'fallback and picking share shader-equivalent positions');
  h.gl.lost = false; h.gpuCanvas.dispatchEvent(new Event('webglcontextrestored')); h.tick(0);
  assert.equal(h.canvas.dataset.backend, 'webgl'); assert.equal(h.canvas.dataset.submittedEdges, '9');
  h.graph.setComparison(null); h.tick(0); assert.equal(h.graph.comparison, null); assert.equal(h.frames.size, 0);
  const restoredCenter = h.graph.viewportCenter();
  assert.ok(Math.hypot((restoredCenter.x - h.graph.pan.x) / h.graph.scale - initialWorld.x, (restoredCenter.y - h.graph.pan.y) / h.graph.scale - initialWorld.y) < 1e-10, 'clearing after phone resize restores the original world center in the new viewport');
  assert.ok(Math.abs(h.graph.scale / h.graph.baseScale - initialZoom) < 1e-12);
});

test('delayed repeated comparison clearing and UI stage resizing restore safely without replay', t => {
  const h = harness(t, { gpu: true, layers: { labels: false, relationships: false, inferred: false } }), { data, config } = comparisonFixture(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const center = h.graph.viewportCenter(), originalWorld = { x: (center.x - h.graph.pan.x) / h.graph.scale, y: (center.y - h.graph.pan.y) / h.graph.scale }, originalZoom = h.graph.scale / h.graph.baseScale;
  Object.assign(h.canvas.rect, { width: 1000, height: 1000 });
  h.graph.setComparison(config); h.tick(800);
  assert.equal(h.graph.height, 1000, 'comparison observes the new UI stage before ResizeObserver delivery');
  Object.assign(h.canvas.rect, { width: 1000, height: 700 });
  h.graph.setComparison(null); h.elapse(900);
  assert.doesNotThrow(() => h.graph.setComparison(null), 'a late repeat clear can complete the prior exit during advanceComparison');
  h.tick(0); assert.equal(h.graph.comparison, null); assert.equal(h.graph.renderer.comparison, null);
  const restored = h.graph.viewportCenter();
  assert.ok(Math.hypot((restored.x - h.graph.pan.x) / h.graph.scale - originalWorld.x, (restored.y - h.graph.pan.y) / h.graph.scale - originalWorld.y) < 1e-10);
  assert.ok(Math.abs(h.graph.scale / h.graph.baseScale - originalZoom) < 1e-12);
  assert.equal(h.frames.size, 0); assert.equal(h.canvas.dataset.comparisonKey, '');
});

test('clicking during comparison flies to the moving star without snapping its remaining layout', t => {
  const h = harness(t, { gpu: true, layers: { labels: false } }), { data, config } = comparisonFixture(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  h.graph.setComparison(config); h.tick(120);
  const node = h.graph.byId.get('r-0'), before = h.graph.displayPosition(node), progress = h.graph.comparison.progress;
  h.graph.select(node);
  assert.equal(h.graph.comparison.progress, progress); assert.deepEqual(h.graph.displayPosition(node), before, 'selection preserves the currently displayed interpolated location');
  assert.equal(h.graph.cameraFlight.duration, 680);
  h.tick(340); assert.ok(h.graph.comparison.progress < 1 && h.graph.cameraFlight);
  h.tick(340); assert.equal(h.graph.comparison.progress, 1); assert.equal(h.graph.cameraFlight, null);
  const star = h.graph.anchor(node), center = h.graph.viewportCenter(); assert.ok(Math.hypot(star.x - center.x, star.y - center.y) < 1e-10);
});

test('territories follow actual lobes, retain disconnected islands and are stable under member order', () => {
  const data = territoryFixture(), before = JSON.stringify(data), byId = new Map(data.nodes.map(node => [node.id, node]));
  const region = data.regions[0], territory = buildTerritory(region, byId);
  assert.equal(territory.memberCount, 320);
  assert.ok(territory.gridCells <= 67 * 67, 'density work is bounded independently of the record count');
  assert.ok(territory.outer.length && territory.inner.length, 'both membrane and density contours exist');
  const points = territory.outer[0].points;
  let positive = 0, negative = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], c = points[(i + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross > 1e-6) positive++;
    if (cross < -1e-6) negative++;
  }
  assert.ok(positive > 4 && negative > 4, 'a lobed member distribution produces a concave contour, not an ellipse');
  assert.deepEqual(buildTerritory({ ...region, memberIds: [...region.memberIds].reverse().concat(region.memberIds[0]) }, byId), territory, 'ordering/duplicate member IDs cannot change the shape');
  for (const loop of [...territory.outer, ...territory.inner]) {
    assert.ok(loop.points.length >= 24 && loop.points.length <= 240, 'cached paths have bounded drawing cost');
    assert.equal(loop.rim.length, loop.points.length);
    for (const point of [...loop.points, ...loop.rim]) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= territory.bounds.left && point.x <= territory.bounds.right && point.y >= territory.bounds.top && point.y <= territory.bounds.bottom);
    }
  }
  const sparse = new Map([['a', { id: 'a', kind: 'item', x: -500, y: 0 }], ['b', { id: 'b', kind: 'item', x: 500, y: 0 }]]);
  assert.equal(buildTerritory({ memberIds: ['a', 'b'] }, sparse).outer.length, 2, 'distant sparse clusters remain separate islands');
  assert.equal(buildTerritory({ memberIds: ['a'] }, sparse).outer.length, 1, 'one actual member has a finite local bubble');
  assert.equal(buildTerritory({ memberIds: [] }, sparse), null);
  assert.equal(buildTerritory({ memberIds: ['missing', '@theme:organic'] }, byId), null, 'missing IDs and hub/name records never contribute density');
  assert.equal(JSON.stringify(data), before, 'building territories never mutates input records, membership or coordinates');
  const shifted = new Map(data.nodes.map(node => [node.id, { ...node, x: node.x + 300, y: node.y - 120 }]));
  const shiftedPoints = buildTerritory(region, shifted).outer[0].points;
  assert.equal(shiftedPoints.length, points.length);
  for (let i = 0; i < points.length; i++) assert.ok(Math.hypot(shiftedPoints[i].x - points[i].x - 300, shiftedPoints[i].y - points[i].y + 120) < 1e-8, 'contours track member positions, not generic theme anchors');
});

test('territory geometry is cached across camera, exact membership masks and Canvas/GPU paints', t => {
  const h = harness(t, { gpu: true, reducedMotion: true, layers: { labels: false } }), data = territoryFixture();
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const territory = h.graph.regions[0].territory, members = [...h.graph.regions[0].members], geometry = h.graph.renderer.pointGroups.find(group => group.kind === 'item').values;
  const coordinates = h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), uploads = h.gl.uploads.length;
  assert.equal(h.canvas.dataset.territoryCount, '1');
  // Rendering must consume the cache, even if the original input becomes unreadable.
  data.regions[0].memberIds[Symbol.iterator] = () => { throw new Error('membership was traversed during paint'); };
  h.graph.zoomBy(1.7); h.tick(0);
  h.graph.setRegionSelection(new Set(members.slice(0, 20)), { id: 'organic', total: 320 }); h.tick(0);
  h.graph.setLayers({ regions: false }); h.tick(0); h.graph.setLayers({ regions: true }); h.tick(0);
  assert.equal(h.gl.uploads.length, uploads + 1, 'only the exact selection mask uploads; contour drawing never uploads/replaces point geometry');
  assert.equal(h.graph.renderer.pointGroups.find(group => group.kind === 'item').values, geometry);
  assert.equal(h.canvas.dataset.submittedRecords, '320');
  h.gl.lost = true; h.gpuCanvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })); h.tick(0);
  assert.equal(h.canvas.dataset.backend, 'canvas2d');
  assert.equal(h.graph.regions[0].territory, territory, 'the fallback consumes exactly the same contours');
  assert.deepEqual([...h.graph.regions[0].members], members);
  assert.deepEqual(h.graph.nodes.map(({ id, x, y }) => ({ id, x, y })), coordinates);
  assert.equal(h.frames.size, 0);
});

test('territory growth completes, respects static motion and cancels on layer, hidden or inactive changes', t => {
  const h = harness(t, { layers: { labels: false } }); h.graph.setData(territoryFixture()); h.graph.setActive(true); h.tick(0);
  assert.equal(h.canvas.dataset.territoriesRevealing, 'true');
  const geometry = h.graph.regions[0].territory;
  h.tick(400); assert.ok(h.graph.territoryReveal);
  h.tick(600); assert.equal(h.graph.territoryReveal, null); assert.equal(h.frames.size, 0, 'intro membrane growth returns to idle');
  h.graph.setRegionSelection(new Set(['member-0-0']), { id: 'organic', total: 320 }); h.tick(0);
  assert.deepEqual([...h.graph.territoryReveal.ids], ['@theme:organic']);
  h.graph.toggleMotion(); h.tick(0); assert.equal(h.graph.territoryReveal, null); assert.equal(h.frames.size, 0);
  h.graph.setRegionSelection(new Set(['member-0-1']), { id: 'organic', total: 320 }); h.tick(0); assert.equal(h.graph.territoryReveal, null);
  h.graph.toggleMotion(); h.tick(0);
  h.graph.setLayers({ regions: false }); h.tick(0); h.graph.setLayers({ regions: true }); h.tick(0); assert.ok(h.graph.territoryReveal);
  h.media.matches = true; h.media.dispatchEvent(new Event('change')); h.tick(0); assert.equal(h.graph.territoryReveal, null); assert.equal(h.frames.size, 0);
  h.media.matches = false; h.media.dispatchEvent(new Event('change')); h.tick(0);
  h.graph.startTerritoryReveal(); h.tick(0); h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.graph.territoryReveal, null); assert.equal(h.frames.size, 0);
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); h.tick(0); assert.equal(h.frames.size, 0, 'returning to a tab never replays an obsolete reveal');
  h.graph.startTerritoryReveal(); h.graph.setLayers({ regions: false }); h.tick(0); assert.equal(h.graph.territoryReveal, null); assert.equal(h.frames.size, 0);
  h.graph.setLayers({ regions: true }); h.graph.setActive(false); assert.equal(h.graph.territoryReveal, null); assert.equal(h.frames.size, 0);
  assert.equal(h.graph.regions[0].territory, geometry);
});

test('ordinary selection traces grow from either endpoint after arrival and cancel cleanly', t => {
  const h = harness(t, { layers: { labels: false } }); h.graph.setData(fixture(30)); h.graph.setActive(true); h.tick(0);
  const node = h.graph.byId.get('work-20'); h.graph.select(node); h.tick(300);
  assert.equal(h.graph.selectionReveal, null, 'selection artwork waits for the camera, preserving stable preview hit areas');
  h.tick(300); assert.equal(h.graph.selectionReveal.nodeId, node.id); assert.equal(h.canvas.dataset.selectionRevealing, 'true');
  assert.equal(h.canvas.dataset.selectionRevealProgress, '0');
  h.tick(310); assert.equal(Number(h.canvas.dataset.selectionRevealProgress), 0.875);
  const edge = h.graph.adjacency.get(node.id)[0], a = h.graph.byId.get(edge.from), b = h.graph.byId.get(edge.to), route = h.graph.renderer.routeFor(edge), path = [];
  const ctx = { moveTo: (x, y) => path.push({ x, y }), lineTo: (x, y) => path.push({ x, y }) };
  for (const endpoint of [edge.from, edge.to]) {
    path.length = 0; h.graph.edgePath(ctx, { sx: h.graph.anchor(a).x, sy: h.graph.anchor(a).y }, { sx: h.graph.anchor(b).x, sy: h.graph.anchor(b).y }, edge, 0.4, endpoint);
    assert.deepEqual(path[0], h.graph.anchor(h.graph.byId.get(endpoint)), 'activation starts at the selected end regardless of stored edge direction');
    const expected = h.graph.anchor(routePointAt(route, endpoint === edge.from ? 0.4 : 0.6));
    assert.ok(Math.hypot(path.at(-1).x - expected.x, path.at(-1).y - expected.y) < 1e-8, 'trace advances along cached angular segments, not a straight chord');
  }
  h.tick(400); assert.equal(h.graph.selectionReveal, null); assert.equal(h.frames.size, 0);
  h.graph.select(node); h.tick(0); assert.ok(h.graph.selectionReveal);
  h.pointer('pointerdown', 1, 800, 400); h.pointer('pointermove', 1, 835, 420); h.pointer('pointerup', 1, 835, 420); h.tick(0);
  assert.equal(h.graph.selectionReveal, null, 'dragging cancels stale selected artwork');
  h.graph.select(h.graph.byId.get('work-0')); h.tick(600); assert.equal(h.graph.selectionReveal.nodeId, 'work-0', 'source names get the same acquisition treatment');
  h.graph.toggleMotion(); h.tick(0); assert.equal(h.graph.selectionReveal, null); assert.equal(h.frames.size, 0);
  h.graph.select(node); h.tick(0); assert.equal(h.graph.selectionReveal, null, 'paused selections show final static state immediately');
  h.graph.toggleMotion(); h.media.matches = true; h.media.dispatchEvent(new Event('change')); h.graph.select(node); h.tick(0);
  assert.equal(h.graph.selectionReveal, null); assert.equal(h.frames.size, 0);
});

function assertReadableOverview(h) {
  const compact = h.canvas.rect.width < 500;
  const named = h.graph.labelBoxes.map(box => h.graph.byId.get(box.id));
  const people = named.filter(node => node.kind === 'person');
  const items = named.filter(node => node.kind === 'item');
  assert.ok(people.length >= (compact ? 2 : 3) && people.length <= (compact ? 2 : 4), 'overview reserves readable person labels');
  assert.ok(items.length >= (compact ? 2 : 3) && items.length <= (compact ? 2 : 4), 'overview shows representative publication titles');
  assert.ok(people.some(person => person.label === 'Name 0'), 'most connected person retains priority over catalog-wide counts');
  for (const person of people) {
    assert.ok(h.labels.includes(person.label));
    assert.ok(h.labels.includes(`${person.connectionCount} connections`), 'visible person includes its unique-neighbor count');
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
  assert.equal(h.frames.size, 0, 'Canvas overview avoids a permanent CPU animation loop');
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
      assert.ok(h.labels.includes(`${person.connectionCount} connections`), 'selected person connection count is always painted');
      h.send('pointerleave');
      const priorSelections = h.selected.length;
      h.send('keydown', { key: 'Enter' });
      assert.equal(h.selected.length, priorSelections + 1, 'keyboard selection reaches the callback');
      assert.equal(h.selected.at(-1).id, person.id, 'keyboard retains the focused person after pointer departure');
      h.labels.length = 0; h.labelBoxes.length = 0; h.tick(0);
      assert.ok(h.labels.includes(person.label), 'keyboard-selected person label remains painted');
      assert.ok(h.labels.some(value => value === `${person.connectionCount} connections`), 'keyboard-selected person count remains painted');
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
      if (!reducedMotion) {
        assert.deepEqual(h.graph.pan, pan, 'activation starts at the current camera without a jump');
        assert.equal(h.previews.at(-1).node, null, 'moving camera defers the pinned card');
        h.tick(600);
      }
      const centered = h.graph.anchor(node);
      assert.equal(h.selected.at(-1).id, node.id);
      assert.equal(h.graph.scale, scale, 'activation retains the current zoom');
      assert.ok(Math.hypot(centered.x - center.x, centered.y - center.y) < 1e-8, 'selected star reaches the usable map center');
      assert.deepEqual(h.selectedAnchors.at(-1), centered, 'pinned card receives the new canvas-local anchor');
      assert.equal(h.previews.at(-1).node.id, node.id, 'pointer-up does not re-hit the old cursor location');
      assert.deepEqual(h.previews.at(-1).anchor, centered);
      assert.equal(h.graph.previewId, node.id);
      if (reducedMotion) assert.equal(h.graph.labelBoxes.length, 0, 'obsolete painted hit boxes are discarded before the next frame');
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

test('camera flights ease between real positions, preserve zoom on click and settle exactly once', t => {
  const h = harness(t, { gpu: true, layers: {} });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const node = h.graph.byId.get('work-200'), start = h.graph.anchor(node), center = h.graph.viewportCenter();
  const scale = h.graph.scale, uploads = h.gl.uploads.length;
  h.graph.select(node); const from = { ...h.graph.pan };
  assert.deepEqual(h.graph.anchor(node), start, 'click does not jump on the input event');
  h.tick(100);
  const first = h.graph.anchor(node);
  const distance = point => Math.hypot(point.x - center.x, point.y - center.y);
  assert.ok(distance(first) < distance(start) && distance(first) > distance(start) * 0.8, 'ease-in begins gently');
  assert.equal(h.selected.length, 0, 'pinned preview waits until camera arrival');
  h.tick(200);
  const middle = h.graph.anchor(node);
  assert.ok(Math.abs(distance(middle) - distance(start) / 2) < 1e-7, 'halfway travel has an intermediate view');
  assert.notDeepEqual(h.graph.pan, from); assert.equal(h.graph.scale, scale);
  h.tick(300);
  assert.ok(distance(h.graph.anchor(node)) < 1e-8); assert.equal(h.graph.cameraFlight, null);
  assert.equal(h.selected.length, 1); assert.ok(distance(h.selectedAnchors[0]) < 1e-8);
  assert.equal(h.gl.uploads.length, uploads, 'flight changes camera uniforms only');
  h.tick(710); assert.equal(h.frames.size, 0, 'routes-off map stops after the finite camera/selection motion');
  h.tick(5000); assert.equal(h.selected.length, 1, 'arrival callback is never replayed');
});

test('drag and wheel interrupt in-flight camera at its current position without a delayed snap', t => {
  const h = harness(t, { gpu: true, layers: {} });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const node = h.graph.byId.get('work-200');
  h.graph.select(node); h.tick(230);
  const current = { ...h.graph.pan };
  h.pointer('pointerdown', 1, 100, 120, 'mouse');
  assert.equal(h.graph.cameraFlight, null); assert.deepEqual(h.graph.pan, current);
  h.pointer('pointermove', 1, 160, 155, 'mouse'); h.pointer('pointerup', 1, 160, 155, 'mouse');
  const dragged = { x: current.x + 60, y: current.y + 35 };
  assert.deepEqual(h.graph.pan, dragged); h.tick(1200);
  assert.deepEqual(h.graph.pan, dragged); assert.equal(h.selected.length, 0);
  h.graph.select(node); h.tick(200); h.graph.zoomBy(1.2);
  const zoomed = { pan: { ...h.graph.pan }, scale: h.graph.scale };
  h.tick(1000);
  assert.equal(h.graph.cameraFlight, null); assert.deepEqual({ pan: h.graph.pan, scale: h.graph.scale }, zoomed);
  assert.equal(h.selected.length, 0, 'interrupted flights never open a stale card');
});

test('replacement flights, resize, hidden state and static motion never replay an obsolete target', t => {
  const h = harness(t, { gpu: true, layers: {} });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  const a = h.graph.byId.get('work-200'), b = h.graph.byId.get('work-210');
  h.graph.select(a); h.tick(200); const current = { ...h.graph.pan };
  h.graph.select(b); assert.deepEqual(h.graph.pan, current, 'new flight starts at the actual intermediate view');
  h.tick(600); assert.equal(h.selected.length, 1); assert.equal(h.selected[0].id, b.id);
  h.graph.select(a); h.tick(200); Object.assign(h.canvas.rect, { width:390,height:700 }); h.graph.measure();
  assert.equal(h.graph.cameraFlight, null); const resized = { ...h.graph.pan }; h.tick(1000);
  assert.deepEqual(h.graph.pan, resized); assert.equal(h.selected.length, 1);
  h.graph.select(a); h.tick(200); h.graph.toggleMotion(); h.tick(0);
  assert.deepEqual(h.graph.anchor(a), h.graph.viewportCenter()); assert.equal(h.graph.cameraFlight, null);
  assert.equal(h.frames.size, 0, 'pause completes navigation in one static render');
  h.graph.toggleMotion(); h.graph.select(b); h.tick(200);
  h.media.matches = true; h.media.dispatchEvent(new Event('change')); h.tick(0);
  assert.deepEqual(h.graph.anchor(b), h.graph.viewportCenter()); assert.equal(h.frames.size, 0);
  h.media.matches = false; h.media.dispatchEvent(new Event('change'));
  h.graph.select(a); h.tick(200); h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  const hidden = { ...h.graph.pan }; assert.equal(h.graph.cameraFlight, null); assert.equal(h.frames.size, 0);
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); h.tick(1000);
  assert.deepEqual(h.graph.pan, hidden); assert.equal(h.frames.size, 0);
});

test('GPU route flow is capped at30Hz, preserves full buffers, pauses and stops when layers are off', t => {
  const h = harness(t, { gpu: true, layers: {} });
  h.graph.setData(fullScaleData()); h.graph.setActive(true); h.tick(0);
  const records = h.graph.renderer.pointGroups.find(group => group.kind === 'item');
  const coordinates = records.values.slice(), values = records.values, buffer = records.buffer, uploads = h.gl.uploads.length;
  h.graph.setLayers({ relationships:true, inferred:true, names:true }); h.tick(0);
  assert.equal(h.canvas.dataset.routesFlowing, 'true'); const revision = Number(h.canvas.dataset.renderRevision);
  h.tick(16); assert.equal(Number(h.canvas.dataset.renderRevision), revision);
  h.tick(18); assert.equal(Number(h.canvas.dataset.renderRevision), revision + 1);
  assert.equal(h.canvas.dataset.submittedRecords, '33945'); assert.equal(h.canvas.dataset.submittedEdges, '36945');
  assert.equal(records.values, values); assert.equal(records.buffer, buffer); assert.deepEqual(records.values, coordinates);
  assert.equal(h.gl.uploads.length, uploads);
  const phase = h.graph.flowTime; assert.ok(phase > 0);
  h.graph.toggleMotion(); h.tick(0); assert.equal(h.frames.size, 0); assert.equal(h.canvas.dataset.routesFlowing, 'false');
  h.tick(5000); assert.equal(h.graph.flowTime, phase, 'static interval advances no flow');
  h.graph.toggleMotion(); h.tick(0); assert.equal(h.graph.flowTime, phase, 'resume keeps its phase');
  h.tick(34); assert.ok(h.graph.flowTime > phase);
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(h.frames.size, 0);
  const hiddenPhase = h.graph.flowTime; h.tick(5000);
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); h.tick(0); assert.equal(h.graph.flowTime, hiddenPhase);
  h.graph.setLayers({ relationships:false, inferred:false }); h.tick(0);
  assert.equal(h.frames.size, 0); assert.equal(h.canvas.dataset.routesFlowing, 'false');
  h.tick(5000); assert.equal(h.gl.uploads.length, uploads); assert.deepEqual(records.values, coordinates);
});

test('map-first overview uses the available field on desktop and phones', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData({ nodes: [
    { id: 'left', kind: 'item', label: 'Left', x: -500, y: -400 },
    { id: 'right', kind: 'item', label: 'Right', x: 500, y: 400 },
  ], edges: [], bounds: { left: -500, right: 500, top: -400, bottom: 400 } });
  h.graph.setActive(true);
  for (const [width, height] of [[1280, 720], [390, 600], [320, 400]]) {
    Object.assign(h.canvas.rect, { width, height }); h.graph.measure(); h.graph.reset(); h.tick(0);
    const frame = h.graph.viewportFrame();
    assert.ok(frame.top + frame.bottom <= 100, 'The external guide and reading key no longer shrink the field');
    assert.ok(frame.left + frame.right <= width * 0.18, 'Overview retains most of the horizontal canvas');
    for (const node of h.graph.nodes) {
      const point = h.graph.anchor(node);
      assert.ok(point.x >= frame.left - 1e-8 && point.x <= width - frame.right + 1e-8);
      assert.ok(point.y >= frame.top - 1e-8 && point.y <= height - frame.bottom + 1e-8);
    }
  }
});

test('opening map options refreshes label exclusions without changing the camera, selection or graph buffers', t => {
  const h = harness(t, { gpu: true, reducedMotion: true });
  let open = false;
  h.canvas.parentElement.querySelectorAll = selector => {
    assert.ok(selector.includes('.perspective-options'), 'The actual dropdown panel participates in label avoidance');
    return [
      { getBoundingClientRect: () => ({ left: 840, top: 8, width: 150, height: 38 }) },
      { getBoundingClientRect: () => open ? { left: 720, top: 48, width: 270, height: 220 } : { left: 0, top: 0, width: 0, height: 0 } },
    ];
  };
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  h.graph.focusRecord('work-50'); h.tick(0);
  const camera = { scale: h.graph.scale, pan: { ...h.graph.pan } }, uploads = h.gl.uploads.length;
  const before = h.graph.labelExclusions();
  assert.equal(before.length, 1, 'Closed native details content excludes no map space');
  open = true; h.graph.refreshOverlayLayout(); h.tick(0);
  assert.equal(h.graph.labelExclusions().length, 2);
  assert.equal(h.graph.labelExclusions().some(box => box.width === 282 && box.height === 232), true);
  assert.deepEqual({ scale: h.graph.scale, pan: h.graph.pan }, camera);
  assert.equal(h.graph.selected, 'work-50');
  assert.equal(h.gl.uploads.length, uploads);
  open = false; h.graph.refreshOverlayLayout(); h.tick(0);
  assert.equal(h.graph.labelExclusions().length, 1);
  assert.equal(h.frames.size, 0, 'Overlay changes do not start a permanent render loop');
});

test('responsive fit preserves world center and relative zoom', t => {
  const h = harness(t, { reducedMotion: true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  assert.equal(h.graph.viewportCenter().x, h.canvas.rect.width / 2, 'The removed introduction no longer shifts the field sideways');
  assert.ok(Math.abs(h.graph.viewportCenter().y - h.canvas.rect.height / 2) <= 12, 'Only the small control rim offsets vertical framing');
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
  h.graph.edgePath = (context, from, to, edge) => {
    painted.push({ from: from.id, to: to.id, dash: [...(h.dashes.at(-1) || [])], style: context.strokeStyle });
    edgePath(context, from, to, edge);
  };
  return painted;
}

test('selected routes use bounded paired flow with evidence colors and speeds', t => {
  const h = harness(t);
  const data = fixture();
  data.edges.push({ from: 'work-2', to: 'work-3', inferred: false });
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  h.graph.select(h.graph.byId.get('work-0')); h.tick(600); h.tick(400);
  const pulse = h.graph.connectionPulse;
  assert.ok(pulse && pulse.edges.length > 0 && pulse.edges.length <= 12, 'at most24 paired markers');
  assert.equal(Number(h.canvas.dataset.highlightedEdges), pulse.edges.length);
  for (const edge of pulse.edges) {
    assert.ok(edge.from === 'work-0' || edge.to === 'work-0');
    const route = h.graph.renderer.routeFor(edge), style = routeStyle(edge);
    assert.equal(route.points.length, 4, 'three straight angular segments');
    assert.ok(style.speed > 0);
    const a = routePointAt(route, 0.1), b = routePointAt(route, 0.2);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0, 'markers move along an actual route');
  }
  const fixedAnchor = h.graph.anchor(h.graph.byId.get('work-0'));
  h.tick(2300);
  assert.equal(h.canvas.dataset.highlightedEdges, '0');
  assert.equal(h.graph.connectionPulse, null);
  assert.equal(h.frames.size, 0, 'Canvas flow ends after the bounded selection burst');
  assert.deepEqual(h.graph.anchor(h.graph.byId.get('work-0')), fixedAnchor);
});

test('selected GPU markers continue beyond the Canvas burst and resume only when motion is enabled', t => {
  const h = harness(t, { gpu:true });
  h.graph.setData(fixture()); h.graph.setActive(true); h.tick(0);
  h.graph.select(h.graph.byId.get('work-0')); h.tick(600); h.tick(3400);
  assert.ok(h.graph.connectionPulse, 'selected GPU markers remain available after2.6s');
  assert.equal(h.canvas.dataset.highlightedEdges, '12'); assert.equal(h.frames.size, 1);
  h.graph.toggleMotion(); h.tick(0);
  assert.equal(h.canvas.dataset.highlightedEdges, '0'); assert.equal(h.frames.size, 0);
  h.graph.toggleMotion(); h.tick(3400);
  assert.equal(h.canvas.dataset.highlightedEdges, '12', 'explicit resume restores selected marker flow');
  h.media.matches = true; h.media.dispatchEvent(new Event('change')); h.tick(0);
  assert.equal(h.canvas.dataset.highlightedEdges, '0'); assert.equal(h.frames.size, 0);
  h.media.matches = false; h.media.dispatchEvent(new Event('change')); h.tick(3400);
  assert.equal(h.canvas.dataset.highlightedEdges, '12');
  h.graph.setLayers({ relationships:false, inferred:false }); h.tick(0);
  assert.equal(h.graph.connectionPulse, null); assert.equal(h.canvas.dataset.highlightedEdges, '0');
  assert.equal(h.frames.size, 0, 'disabled routes stop both GPU and selected flows');
});

test('data changes, zoom, hidden state and exit cancel obsolete flow and flights', t => {
  const h = harness(t);
  h.graph.setData(fixture(8)); h.graph.setActive(true); h.tick(0);
  h.graph.select(h.graph.byId.get('work-6')); h.tick(600);
  assert.ok(h.graph.connectionPulse);
  const replacement = fixture(8);
  replacement.edges = [{ from: 'work-6', to: 'work-7', inferred: true }];
  h.graph.setData(replacement); h.tick(0);
  assert.equal(h.graph.connectionPulse, null);
  h.graph.select(h.graph.byId.get('work-6')); h.tick(600);
  assert.deepEqual(h.graph.connectionPulse.edges.map(({from,to}) => ({from,to})), [{ from:'work-6', to:'work-7' }]);
  h.graph.zoomBy(1.2); h.tick(0);
  assert.equal(h.graph.connectionPulse, null);
  h.graph.select(h.graph.byId.get('work-6'));
  h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.graph.connectionPulse, null); assert.equal(h.graph.cameraFlight, null);
  assert.equal(h.frames.size, 0);
  h.doc.hidden = false; h.doc.dispatchEvent(new Event('visibilitychange')); h.tick(0);
  assert.equal(h.frames.size, 0, 'Canvas visibility return does not replay a stale burst');
  h.graph.select(h.graph.byId.get('work-6')); h.graph.setActive(false);
  assert.equal(h.graph.connectionPulse, null); assert.equal(h.graph.cameraFlight, null);
  assert.equal(h.frames.size, 0);
  h.graph.setActive(true); h.graph.destroy();
  assert.equal(h.graph.connectionPulse, null); assert.equal(h.frames.size, 0);
});

test('reduced and paused motion keep selected relationships static with no replay loop', t => {
  const h = harness(t, { reducedMotion: true });
  const painted = recordEdgePaints(h);
  h.graph.setData(fixture(8)); h.graph.setActive(true); h.tick(0);
  const assertStaticSelection = () => {
    painted.length = 0;
    h.graph.select(h.graph.byId.get('work-0')); h.tick(0);
    const selectedEdges = painted.filter(edge => edge.style.endsWith(',0.64)'));
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

test('full comparison retains all 33,945 original GPU records while isolated attributes animate and restore', t => {
  const h = harness(t, { gpu: true, layers: { names: true, relationships: true, inferred: true } }), data = fullScaleData();
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const records = h.graph.renderer.pointGroups.find(group => group.kind === 'item'), geometry = records.values, bytes = geometry.slice(), buffer = records.buffer, originalNodes = h.graph.nodes.map(node => [node.id, node.x, node.y]);
  const ids = data.nodes.filter(node => node.kind === 'item').map(node => node.id), left = new Set(ids.slice(0, 2200)), right = new Set(ids.slice(1700, 4000)), memberIds = new Set([...left, ...right]), shared = new Set(ids.slice(1700, 2200));
  const edges = data.edges.filter(edge => memberIds.has(edge.to) && (edge.from.startsWith('name-') || edge.from === '@theme:0' || edge.from === '@theme:1'));
  const config = { key: 'full-pair', left: { id: '0', label: 'First territory', color: '#90c2d1', memberIds: left }, right: { id: '1', label: 'Second territory', color: '#c5a5cc', memberIds: right }, leftOnly: new Set([...left].filter(id => !shared.has(id))), rightOnly: new Set([...right].filter(id => !shared.has(id))), memberIds, shared, personIds: new Set(edges.filter(edge => edge.from.startsWith('name-')).map(edge => edge.from)), bridgePersonIds: new Set(), edges };
  h.graph.setComparison(config); h.tick(0);
  const uploads = h.gl.uploads.length, comparisonValues = records.comparisonValues, comparisonBuffer = records.comparisonBuffer;
  assert.notEqual(comparisonBuffer, buffer); assert.equal(comparisonValues.length, 33945 * 12);
  for (let i = 0; i < records.count; i++) {
    assert.equal(comparisonValues[i * 12], bytes[i * 6]); assert.equal(comparisonValues[i * 12 + 1], bytes[i * 6 + 1]);
    const point = h.graph.comparison.points.get(records.members[i].id).to;
    assert.equal(comparisonValues[i * 12 + 2], Math.fround(point.x)); assert.equal(comparisonValues[i * 12 + 3], Math.fround(point.y));
  }
  for (let i = 0; i < 20; i++) { h.tick(40); assert.equal(h.canvas.dataset.submittedRecords, '33945'); }
  assert.equal(h.gl.uploads.length, uploads); assert.equal(h.graph.comparison.progress, 1);
  assert.equal(h.canvas.dataset.comparisonRecords, '4000'); assert.equal(h.canvas.dataset.comparisonShared, '500');
  assert.equal(Number(h.canvas.dataset.submittedEdges), edges.length); assert.equal(Number(h.canvas.dataset.inViewNames), config.personIds.size, 'transparent unrelated names never inflate visible-name counts');
  assert.equal(records.values, geometry); assert.equal(records.buffer, buffer); assert.deepEqual(records.values, bytes);
  assert.deepEqual(h.graph.nodes.map(node => [node.id, node.x, node.y]), originalNodes);
  h.graph.setComparison(null); h.tick(800);
  assert.equal(h.graph.comparison, null); assert.equal(records.comparisonValues, null); assert.equal(records.comparisonBuffer, null);
  assert.equal(records.values, geometry); assert.equal(records.buffer, buffer); assert.deepEqual(records.values, bytes);
  assert.equal(h.canvas.dataset.submittedRecords, '33945'); assert.equal(Number(h.canvas.dataset.submittedEdges), data.edges.length);
});

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
    assert.equal(records.values[i * 6], Math.fround(h.graph.byId.get(data.nodes[i].id).x));
    assert.equal(records.values[i * 6 + 1], Math.fround(h.graph.byId.get(data.nodes[i].id).y));
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
    const selection = painted.filter(edge => edge.style.endsWith(',0.64)'));
    assert.equal(Number(h.canvas.dataset.submittedEdges), Number(relationships) + Number(inferred));
    assert.equal(selection.filter(edge => !edge.dash.length).length, Number(relationships), 'documented emphasis follows its own toggle');
    assert.equal(selection.filter(edge => edge.dash.length).length, Number(inferred), 'inferred emphasis follows its own toggle');
    assert.equal(h.graph.selected, 'a', 'turning routes off preserves focused record visibility');
    assert.equal(h.canvas.dataset.submittedRecords, '2');
  }
});

test('high-degree stars highlight48 routes while every enabled base route remains submitted', t => {
  const h = harness(t, { gpu:true, reducedMotion:true });
  const data = fixture(500);
  h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  const values = h.graph.renderer.edgeGroups.map(group => group.values), uploads = h.gl.uploads.length;
  const painted = recordEdgePaints(h);
  h.graph.select(h.graph.byId.get('work-0')); h.tick(0);
  const highlighted = painted.filter(edge => edge.style.endsWith(',0.64)'));
  assert.equal(highlighted.length, 48);
  assert.equal(h.canvas.dataset.selectedEdges, '48');
  assert.equal(Number(h.canvas.dataset.submittedEdges), data.edges.length, 'emphasis cap never removes a base route');
  assert.ok(highlighted.every(edge => edge.from === 'work-0' || edge.to === 'work-0'));
  assert.ok(highlighted.some(edge => edge.dash.length) && highlighted.some(edge => !edge.dash.length));
  assert.equal(h.gl.uploads.length, uploads);
  h.graph.renderer.edgeGroups.forEach((group, i) => assert.equal(group.values, values[i]));
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
  for (let i = 0; i < nameBatch.count; i++) assert.ok(Math.abs(nameBatch.values[i * 6 + 2] - nodeAppearance(nameBatch.members[i]).radius) < 1e-6);
  assert.ok(h.gl.uniforms.some(call => call.program === renderer.pointsProgram && call.name === 'u_alpha' && call.value === 0.48));
  assert.deepEqual(h.gl.blendFactors, [h.gl.SRC_ALPHA, h.gl.ONE_MINUS_SRC_ALPHA, h.gl.ONE, h.gl.ONE_MINUS_SRC_ALPHA], 'transparent compositing preserves source alpha rather than squaring it');
  for (const inferred of [false, true]) {
    const samples = [1, 2, 4, 8, 16, 64].map(zoom => routeOpacity(inferred, zoom));
    assert.equal(samples[0], inferred ? 0.006 : 0.008);
    assert.ok(samples.slice(1).every((value, i) => value >= samples[i]));
    assert.ok(samples.every(value => value <= (inferred ? 0.100001 : 0.080001)));
    const expected = routeOpacity(inferred, 1, Number(h.canvas.dataset.submittedEdges), false);
    assert.ok(expected < samples[0], 'dense full-catalog routes retain a subdued backdrop');
    assert.ok(h.gl.uniforms.some(call => call.program === renderer.linesProgram && call.name === 'u_alpha' && call.value === expected));
  }
  const uploads = h.gl.uploads.length, edges = h.canvas.dataset.submittedEdges;
  h.graph.zoomBy(16); h.tick(0);
  assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.submittedNames, '7361');
  assert.equal(h.canvas.dataset.submittedEdges, edges);
  assert.equal(h.gl.uploads.length, uploads, 'zoom opacity uses uniforms, never resampling data');
  for (const inferred of [false, true]) assert.ok(h.gl.uniforms.some(call => call.program === renderer.linesProgram && call.name === 'u_alpha' && call.value === routeOpacity(inferred, 16, Number(edges), false)));
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
  assert.equal(h.canvas.dataset.submittedRecords, '33945'); assert.equal(h.canvas.dataset.submittedEdges, '0', 'hidden territory hubs cannot leave phantom route endpoints');
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
  assert.equal(h.canvas.dataset.submittedEdges, '0', 'routes to hidden hubs disappear with their endpoints');
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

test('Canvas fallback hides phantom region routes and highlights all selected visible records', t => {
  const h = harness(t, { reducedMotion: true, layers: { names: false, labels: false, regions: false, inferred: true, relationships: false } });
  const data = fullScaleData(); h.graph.setData(data); h.graph.setActive(true); h.tick(0);
  h.graph.setRegionSelection(new Set(data.nodes.filter(node => node.kind === 'item').map(node => node.id)), { id: 'unmatched' }); h.tick(0);
  assert.equal(h.canvas.dataset.backend, 'canvas2d'); assert.equal(h.canvas.dataset.selectedRecords, '33945');
  assert.equal(h.canvas.dataset.drawnPoints, '33945'); assert.equal(h.canvas.dataset.submittedRecords, '33945');
  assert.equal(h.canvas.dataset.submittedEdges, '0'); assert.equal(h.frames.size, 0);
  h.graph.setLayers({ regions: true }); h.tick(0);
  assert.equal(h.canvas.dataset.submittedEdges, '3000', 'showing real hub endpoints restores their routes');
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
  assert.ok(Math.abs(bright.alpha - 0.94) < 0.002); assert.ok(Math.abs(dim.alpha - 0.16) < 0.002);
  assert.deepEqual(bright.arcs, ['record-1', 'record-7', 'record-19'].map(id => h.graph.anchor(h.graph.byId.get(id))));
  assert.equal(dim.arcs.length, 17); assert.equal(h.canvas.dataset.submittedRecords, '20');
  assert.equal(h.frames.size, 0, 'selection is static under reduced motion');
});
