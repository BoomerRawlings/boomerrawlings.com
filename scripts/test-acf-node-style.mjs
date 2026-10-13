import test from 'node:test';
import assert from 'node:assert/strict';
import { nodeAppearance, nodeEndpointAppearance, drawNodeGlyph } from '../public/ACF/node-style.js';
import { GraphRenderer } from '../public/ACF/graph-renderer.js';

const nodes = [
  { id: 'work', kind: 'item', visualType: 'work', x: -10, y: 0, color: '#a9c9db', connectionCount: 4 },
  { id: 'author', kind: 'person', visualType: 'person', x: 0, y: 0, color: '#aaa4d0', connectionCount: 64 },
  { id: 'source', kind: 'person', visualType: 'source', x: 10, y: 0, color: '#d89976', connectionCount: 64 },
  { id: 'theme', kind: 'hub', visualType: 'theme', x: 0, y: 10, color: '#aaa4d0', count: 1000 },
];
const camera = { width: 800, height: 600, dpr: 1, scale: 1, baseScale: 1, pan: { x: 400, y: 300 } };
const layers = { names: true, regions: true, relationships: false, inferred: false };

test('identity is explicit; themes and collection counts cannot masquerade as sources or degree', () => {
  assert.deepEqual(nodes.map(node => nodeAppearance(node).type), ['work', 'person', 'source', 'theme']);
  assert.equal(nodeAppearance({ kind: 'hub', count: 100000 }).type, 'theme');
  assert.equal(nodeAppearance({ kind: 'person', label: 'Institution', count: 100000 }).type, 'person');
  assert.equal(nodeAppearance({ kind: 'person', visualRole: 'source' }).type, 'source');
  assert.equal(nodeAppearance({ kind: 'person', visualType: 'person', visualRole: 'source' }).type, 'person');
  assert.deepEqual(nodeAppearance({ kind: 'hub', connectionCount: 100000 }), nodeAppearance({ kind: 'hub', connectionCount: 0 }));
  assert.deepEqual(nodeAppearance({ kind: 'person', count: 100000 }), nodeAppearance({ kind: 'person' }));
});

test('connection emphasis increases monotonically within fixed bands and stays bounded through zoom', () => {
  for (const visualType of ['work', 'person', 'source']) {
    const base = { kind: visualType === 'work' ? 'item' : 'person', visualType };
    const zero = nodeAppearance(base), low = nodeAppearance(base, 1, { connectionCount: 4 }), high = nodeAppearance(base, 1, { connectionCount: 1000 });
    assert(zero.radius < low.radius && low.radius <= high.radius);
    assert(zero.brightness < low.brightness && low.brightness <= high.brightness);
    assert.equal(high.emphasis, 1);
    for (const zoom of [0.4, 1, 4, 64, NaN]) {
      const style = nodeAppearance({ ...base, connectionCount: 1e20 }, zoom, { selected: true });
      assert(style.radius >= 0.6 && style.radius <= 18);
      assert(style.brightness > 0 && style.brightness <= 0.96);
      assert.equal(style.haloAlpha, 0, 'bright hubs do not add an outward glare disk');
      assert(style.haloRadius <= style.radius);
    }
    assert.deepEqual(nodeAppearance(base, 1, { connectionCount: -2 }), zero);
  }
});

function context() {
  const paths = [], paints = []; let path = [];
  return { paths, paints, globalAlpha: 1,
    save() {}, restore() {}, beginPath() { path = []; paths.push(path); },
    moveTo: (...args) => path.push(['moveTo', ...args]), lineTo: (...args) => path.push(['lineTo', ...args]),
    closePath: () => path.push(['closePath']), arc: (...args) => path.push(['arc', ...args]),
    fill() { paints.push({ mode: 'fill', alpha: this.globalAlpha, color: this.fillStyle, path }); },
    stroke() { paints.push({ mode: 'stroke', alpha: this.globalAlpha, color: this.strokeStyle, path }); },
  };
}

test('shared overlay painter exposes four genuinely different silhouettes without a source disk', () => {
  const render = node => { const ctx = context(); drawNodeGlyph(ctx, node, { x: 10, y: 20, radius: 5, color: '#abcdef', opacity: 0.7 }); return ctx.paints; };
  const [work, person, source, theme] = nodes.map(render);
  assert.equal(work[0].mode, 'fill'); assert(work[0].path.some(call => call[0] === 'arc'));
  assert.equal(person[0].path.filter(call => call[0] === 'lineTo').length, 3);
  assert.equal(source[0].mode, 'stroke'); assert.equal(source[0].path.filter(call => call[0] === 'lineTo').length, 5);
  assert.equal(source[1].mode, 'fill'); assert.equal(source[1].path.filter(call => call[0] === 'lineTo').length, 3);
  assert.equal(theme[0].mode, 'stroke'); assert(theme[0].path.some(call => call[0] === 'arc'));
  assert.equal(theme.length, 1); assert.equal(source[0].alpha, 0.7);
});

function gpu() {
  let bound, next = 0; const buffers = new Map(), pointers = new Map(), enabled = new Set(), uniforms = new Map();
  const attributes = { a_position: 0, a_size: 1, a_color: 2, a_selected: 3, a_viewPosition: 4, a_viewFrom: 5, a_viewTo: 6, a_style: 7, a_progress: 1, a_destination: 2 };
  return { POINTS: 0, LINES: 1, uploads: [], draws: [], deleted: [], sources: [], lost: false,
    createShader: () => ({}), shaderSource(shader, source) { this.sources.push(source); }, compileShader() {}, getShaderParameter: () => true, deleteShader() {},
    createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: () => true, deleteProgram() {},
    getAttribLocation: (_, name) => attributes[name], getUniformLocation: (_, name) => name,
    enable() {}, blendFuncSeparate() {}, useProgram() {}, uniform1f(name, value) { uniforms.set(name, value); }, uniform2f() {}, uniform3f() {}, viewport() {}, clearColor() {}, clear() {}, vertexAttrib1f() {},
    createBuffer: () => ({ id: ++next }), bindBuffer: (_, value) => { bound = value; },
    bufferData(_, values) { buffers.set(bound, values.slice()); this.uploads.push(bound); },
    deleteBuffer(value) { this.deleted.push(value); },
    enableVertexAttribArray: location => { assert(Number.isInteger(location) && location >= 0 && location < 8); enabled.add(location); },
    disableVertexAttribArray: location => enabled.delete(location),
    vertexAttribPointer: (location, size, type, normalized, stride, offset) => pointers.set(location, { bound, size, stride, offset }),
    drawArrays(mode, first, count) {
      for (const attribute of enabled) { const p = pointers.get(attribute); assert(buffers.get(p.bound).byteLength >= p.offset + (count - 1) * p.stride + p.size * 4); }
      this.draws.push({ mode, count, enabled: [...enabled], uniforms: Object.fromEntries(uniforms) });
    },
    isContextLost() { return this.lost; },
  };
}

function renderer(t, withGPU = false) {
  const ctx = context(), gl = withGPU ? gpu() : null;
  const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const layer = Object.assign(new EventTarget(), { style: {}, setAttribute() {}, getContext: () => gl, remove() {} });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: withGPU ? { createElement: () => layer } : {} });
  const canvas = withGPU ? { parentElement: { insertBefore() {} } } : {};
  const r = new GraphRenderer(canvas, ctx); r.setData(nodes, [], new Map(nodes.map(node => [node.id, node])));
  t.after(() => { r.destroy(); if (old) Object.defineProperty(globalThis, 'document', old); else delete globalThis.document; });
  return { r, ctx, gl, layer };
}

test('Canvas fallback renders all four identities and preserves record/name accounting', t => {
  const { r, ctx } = renderer(t);
  const screen = nodes.map(node => ({ ...node, sx: node.x + 400, sy: node.y + 300, radius: 99 }));
  const stats = r.draw(camera, layers, screen);
  assert.equal(stats.submittedRecords, 1); assert.equal(stats.submittedNames, 2); assert.equal(stats.drawnPoints, 4);
  assert.equal(ctx.paints.filter(p => p.mode === 'stroke').length, 2);
  const source = ctx.paints.find(p => p.color === '#d89976' && p.mode === 'stroke');
  assert.equal(source.path.filter(call => call[0] === 'lineTo').length, 5);
  const firstPoint = source.path[0]; assert(Math.abs(firstPoint[1] - (410 + nodeAppearance(nodes[2]).radius)) < 1e-9);
  assert.equal(source.alpha, nodeAppearance(nodes[2]).brightness);
  assert.equal(ctx.globalAlpha, 1);
});

test('Canvas comparison interpolates base radii before zoom clamping, matching the GPU attributes', t => {
  const { r, ctx } = renderer(t);
  const points = new Map(nodes.map(node => [node.id, { from: { ...node, connectionCount: 0, opacity: 1 }, to: { ...node, connectionCount: 256, opacity: 1 } }]));
  r.setComparison({ points, edges: [] }); r.comparisonProgress = 0.5;
  const screen = nodes.map(node => ({ ...node, sx: node.x + 400, sy: node.y + 300 }));
  r.draw({ ...camera, scale: 16 }, layers, screen);
  const beacon = ctx.paints.find(p => p.mode === 'stroke' && p.path.filter(call => call[0] === 'lineTo').length === 5);
  const from = nodeAppearance(nodes[2], 1, { connectionCount: 0 }), to = nodeAppearance(nodes[2], 1, { connectionCount: 256 });
  assert.equal(beacon.path[0][1] - 410, Math.min(18, (from.radius + to.radius) / 2 * 4));
  assert.equal(beacon.alpha, (from.brightness + to.brightness) / 2);
  ctx.paints.length = 0; r.setComparison(null); r.setRegionSelection(new Set(['work']));
  r.draw({ ...camera, scale: 16 }, layers, screen);
  const work = ctx.paints.find(p => p.mode === 'fill' && p.color === '#ffd192');
  assert.equal(work.alpha, Math.min(0.96, nodeAppearance(nodes[0]).brightness * 2.24));
});

test('GPU retains mixed person/source identities in one full batch with at most eight attributes', t => {
  const { r, gl } = renderer(t, true);
  const names = r.pointGroups.find(group => group.kind === 'person');
  assert.equal(names.count, 2); assert.equal(names.values.length, 12);
  assert.deepEqual([names.styleValues[0], names.styleValues[4]], [1, 2]);
  for (const group of r.pointGroups) group.members.forEach((node, i) => {
    assert.equal(group.values[i * 6], node.x); assert.equal(group.values[i * 6 + 1], node.y);
    assert.equal(group.values[i * 6 + 2], Math.fround(nodeAppearance(node).radius));
  });
  const uploads = gl.uploads.length;
  for (const zoom of [1, 4, 16]) {
    const stats = r.draw({ ...camera, scale: zoom }, layers, []);
    assert.equal(stats.submittedRecords, 1); assert.equal(stats.submittedNames, 2); assert.equal(stats.drawnPoints, 4);
  }
  assert.equal(gl.uploads.length, uploads, 'camera changes never rebuild glyph geometry');
  assert(gl.sources.some(source => source.includes('v_glyph > 2.5') && source.includes('v_glyph > 1.5') && source.includes('v_glyph > 0.5')));
});

test('comparison degree interpolates separately from immutable positions and survives context restoration', t => {
  const { r, gl, layer } = renderer(t, true);
  const geometry = r.pointGroups.map(group => ({ values: group.values, bytes: group.values.slice(), buffer: group.buffer }));
  const points = new Map(nodes.map(node => [node.id, { from: { ...node, connectionCount: 0, opacity: 1 }, to: { ...node, x: node.x + 100, connectionCount: 64, opacity: 1 } }]));
  r.setComparison({ points, edges: [] });
  const names = r.pointGroups.find(group => group.kind === 'person'), from = nodeAppearance(nodes[1], 1, { connectionCount: 0 }), to = nodeAppearance(nodes[1], 1, { connectionCount: 64 });
  assert.equal(names.styleValues[2], Math.fround(from.radius)); assert.equal(names.styleValues[3], Math.fround(to.radius));
  assert.equal(names.comparisonValues[7], Math.fround(from.brightness / 0.48)); assert.equal(names.comparisonValues[11], Math.fround(to.brightness / 0.48));
  const uploads = gl.uploads.length;
  for (const progress of [0, 0.5, 1]) { r.comparisonProgress = progress; assert.equal(r.draw(camera, layers, []).drawnPoints, 4); }
  assert.equal(gl.uploads.length, uploads);
  geometry.forEach((entry, i) => { assert.equal(r.pointGroups[i].buffer, entry.buffer); assert.equal(r.pointGroups[i].values, entry.values); assert.deepEqual(entry.values, entry.bytes); });
  const oldStyle = names.styleBuffer;
  gl.lost = true; const loss = new Event('webglcontextlost', { cancelable: true }); layer.dispatchEvent(loss); assert(loss.defaultPrevented); assert.equal(r.backend, 'canvas2d');
  gl.lost = false; layer.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(r.backend, 'webgl'); assert.notEqual(names.styleBuffer, oldStyle); assert.equal(r.draw(camera, layers, []).drawnPoints, 4);
  const restoredStyles = r.pointGroups.map(group => group.styleBuffer); r.destroy();
  assert(restoredStyles.every(buffer => gl.deleted.includes(buffer)));
});

test('interrupted comparison preserves rendered radius and brightness rather than interpolated degree', t => {
  const { r, gl } = renderer(t, true), node = nodes[1];
  const originalFrom = nodeAppearance(node, 1, { connectionCount: 64 });
  const originalTo = nodeAppearance(node, 1, { connectionCount: 0 });
  const baseRadius = (originalFrom.radius + originalTo.radius) / 2;
  const brightness = (originalFrom.brightness * 1.4 + originalTo.brightness * 0.2) / 2 / 0.8;
  const endpoint = { ...node, connectionCount: 32, baseRadius, brightness, opacity: 0.8 };
  assert.notEqual(nodeAppearance(node, 1, { connectionCount: 32 }).radius, baseRadius);
  assert.equal(nodeEndpointAppearance(node, endpoint).radius, baseRadius);
  assert.equal(nodeEndpointAppearance(node, endpoint).brightness, brightness);
  const points = new Map(nodes.map(value => [value.id, { from: { ...value, opacity: 1 }, to: { ...value, opacity: 1 } }]));
  points.set(node.id, { from: endpoint, to: { ...node, opacity: 1, connectionCount: 8 } });
  r.setComparison({ points, edges: [] });
  const group = r.pointGroups.find(value => value.kind === 'person');
  assert.equal(group.styleValues[2], Math.fround(baseRadius));
  assert.equal(group.comparisonValues[7], Math.fround(brightness * endpoint.opacity / 0.48));
  assert.equal(r.draw(camera, layers, []).drawnPoints, 4);
  assert.equal(gl.draws.length, 3);
  assert.deepEqual(nodeEndpointAppearance(node, { connectionCount: 0, baseRadius: NaN, brightness: Infinity }), nodeAppearance(node, 1, { connectionCount: 0 }));
});

test('Canvas uses the same explicit retarget endpoint as GPU and picking', t => {
  const { r, ctx } = renderer(t), node = nodes[2];
  const points = new Map(nodes.map(value => [value.id, { from: { ...value, opacity: 1 }, to: { ...value, opacity: 1 } }]));
  points.set(node.id, { from: { ...node, baseRadius: 4.1, brightness: 0.63, opacity: 0.8 }, to: { ...node, opacity: 1 } });
  r.setComparison({ points, edges: [] }); r.comparisonProgress = 0;
  const screen = nodes.map(value => ({ ...value, sx: value.x + 400, sy: value.y + 300 }));
  r.draw({ ...camera, scale: 4 }, layers, screen);
  const source = ctx.paints.find(value => value.mode === 'stroke' && value.path.filter(call => call[0] === 'lineTo').length === 5);
  assert(Math.abs(source.path[0][1] - (410 + 8.2)) < 1e-10);
  assert.equal(source.alpha, 0.63 * 0.8);
});

test('publication sources in item batches keep GPU/Canvas brightness parity at distant and close zoom', t => {
  const publication = { id: 'journal', kind: 'item', visualType: 'source', connectionCount: 64, x: 20, y: 0, color: '#fedcba' };
  const values = [nodes[0], publication], byId = new Map(values.map(node => [node.id, node]));
  const gpuRenderer = renderer(t, true), fallback = renderer(t);
  for (const r of [gpuRenderer.r, fallback.r]) r.setData(values, [], byId);
  const screen = values.map(node => ({ ...node, sx: node.x + 400, sy: node.y + 300 }));
  for (const comparison of [false, true]) {
    const points = new Map(values.map(node => [node.id, {
      from: { ...node, connectionCount: 0, opacity: 0.35 },
      to: { ...node, connectionCount: 256, opacity: 1.1 },
    }]));
    for (const r of [gpuRenderer.r, fallback.r]) { r.setComparison(comparison ? { points, edges: [] } : null); r.comparisonProgress = 0.4; }
    for (const zoom of [0.4, 16]) {
      fallback.ctx.paints.length = 0; gpuRenderer.gl.draws.length = 0;
      assert.equal(gpuRenderer.r.draw({ ...camera, scale: zoom }, layers, []).submittedRecords, 2);
      assert.equal(fallback.r.draw({ ...camera, scale: zoom }, layers, screen).submittedRecords, 2);
      const group = gpuRenderer.r.pointGroups.find(value => value.kind === 'item');
      const uniforms = gpuRenderer.gl.draws.find(value => value.mode === gpuRenderer.gl.POINTS).uniforms;
      const opacity = comparison ? group.comparisonValues[19] + (group.comparisonValues[23] - group.comparisonValues[19]) * 0.4 : group.styleValues[5];
      const gpuAlpha = Math.min(0.96, uniforms.u_alpha * opacity); // Source branch excludes the work-only uniform.
      const canvasSource = fallback.ctx.paints.find(paint => paint.mode === 'stroke');
      assert(Math.abs(canvasSource.alpha - gpuAlpha) < 1e-6);
      const style = nodeAppearance(publication);
      const expected = comparison ? nodeAppearance(publication, 1, { connectionCount: 0 }).brightness * 0.35 * 0.6 + nodeAppearance(publication, 1, { connectionCount: 256 }).brightness * 1.1 * 0.4 : style.brightness;
      assert(Math.abs(canvasSource.alpha - expected) < 1e-9);
      assert.equal(uniforms.u_alpha, 0.42);
      assert.notEqual(uniforms.u_workZoomBrightness, 1);
      assert(gpuRenderer.gl.sources.some(source => source.includes('u_alpha * v_opacity * u_workZoomBrightness')));
    }
  }
});
