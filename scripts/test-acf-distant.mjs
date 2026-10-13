import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { GraphRenderer, starAppearance, routeOpacity } from '../public/ACF/graph-renderer.js';
import { ROUTE_STYLES, routeStyle, routeGeometry, routePointAt } from '../public/ACF/route-style.js';

function harness(t, gpu = true) {
  const originals = new Map();
  const install = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  let currentBuffer, program;
  const buffers = new Map(), uniforms = new Map();
  const gl = {
    VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713, LINK_STATUS: 35714,
    ARRAY_BUFFER: 34962, STATIC_DRAW: 35044, DYNAMIC_DRAW: 35048, BLEND: 3042,
    SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, ONE: 1, FLOAT: 5126, COLOR_BUFFER_BIT: 16384, POINTS: 0, LINES: 1,
    uploads: [], draws: [],
    createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => true, deleteShader() {},
    createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: () => true, deleteProgram() {},
    getAttribLocation: (_, name) => ({ a_position: 0, a_size: 1, a_distance: 1, a_color: 2, a_selected: 3, a_progress: 4, a_destination: 5, a_viewPosition: 4, a_viewFrom: 5, a_viewTo: 6 })[name],
    getUniformLocation: (_, name) => name,
    useProgram: value => { program = value; }, uniform1f: (name, value) => uniforms.set(name, value), uniform2f() {}, uniform3f: (name, ...values) => uniforms.set(name, values),
    createBuffer: () => ({}), bindBuffer: (_, value) => { currentBuffer = value; },
    bufferData: (_, values) => { buffers.set(currentBuffer, values); gl.uploads.push({ buffer: currentBuffer, values }); },
    deleteBuffer() {}, enable() {}, blendFuncSeparate() {}, viewport() {}, clearColor() {}, clear() {},
    enableVertexAttribArray() {}, disableVertexAttribArray() {}, vertexAttribPointer() {}, vertexAttrib1f() {},
    drawArrays: (mode, first, count) => gl.draws.push({ mode, first, count, program, uniforms: new Map(uniforms) }),
    isContextLost: () => false,
  };
  const fills = [];
  let arcs = 0;
  const context = { beginPath: () => { arcs = 0; }, moveTo() {}, arc: () => { arcs++; },
    fill() { fills.push({ alpha: this.globalAlpha, arcs }); },
  };
  const gpuCanvas = Object.assign(new EventTarget(), { style: {}, setAttribute() {}, getContext: () => gpu ? gl : null, remove() {} });
  install('document', { createElement: () => gpuCanvas });
  install('requestAnimationFrame', () => { throw new Error('Distance appearance must not schedule animation frames'); });
  const canvas = { parentElement: { insertBefore() {} } };
  const renderer = new GraphRenderer(canvas, context);
  t.after(() => {
    renderer.destroy();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return { renderer, gl, fills };
}

const camera = zoom => ({ width: 1280, height: 800, dpr: 1, scale: zoom, baseScale: 1, pan: { x: 640, y: 400 } });
const layers = { names: false, regions: false, relationships: false, inferred: false };
const checksum = values => createHash('sha256').update(Buffer.from(values.buffer, values.byteOffset, values.byteLength)).digest('hex');
const records = () => Array.from({ length: 33945 }, (_, i) => ({ id: `record-${i}`, kind: 'item', size: 0.75,
  x: (i % 240 - 120) * 3.75, y: (Math.floor(i / 240) - 70) * 3.75,
}));

test('distance appearance stays finite and visible, reduces distant saturation, and preserves region contrast', () => {
  const styles = [0.4, 1, 4, 16, 64].map(zoom => starAppearance(zoom));
  assert.ok(styles.every(style => style.alpha > 0.25 && style.alpha <= 0.6 && style.detail >= 0 && style.detail <= 1));
  assert.ok(styles[0].alpha < styles[1].alpha, 'fully zoomed out cloud has less overlapping opacity');
  assert.equal(styles[0].detail, 0, 'tiny stars retain crisp coverage');
  assert.equal(styles.at(-1).detail, 1, 'close stars reveal the full core/halo shape');
  for (const zoom of [-1, 0, 0.4, 1, 64, 1e9, NaN, Infinity]) {
    const style = starAppearance(zoom, true);
    assert.ok(Number.isFinite(style.alpha) && Number.isFinite(style.detail));
    assert.equal(style.alpha, 0.42);
    assert.equal(style.alpha * 0.38, 0.1596, 'nonmembers remain visible with exact prior region contrast');
  }
});

test('every distance submits all 33,945 original vertices with only uniform changes and a separate region mask', t => {
  const { renderer, gl } = harness(t);
  const nodes = records();
  renderer.setData(nodes, [], new Map(nodes.map(node => [node.id, node])));
  const group = renderer.pointGroups.find(group => group.kind === 'item');
  const values = group.values, buffer = group.buffer, original = checksum(values), initialUploads = gl.uploads.length;
  for (const zoom of [0.4, 1, 4, 16, 64, 0.4]) {
    const stats = renderer.draw(camera(zoom), layers, []);
    const draw = gl.draws.at(-1);
    assert.equal(stats.submittedRecords, 33945);
    assert.equal(draw.count, 33945);
    assert.equal(draw.mode, gl.POINTS);
    assert.equal(draw.uniforms.get('u_detail'), starAppearance(zoom).detail);
    assert.equal(draw.uniforms.get('u_alpha'), starAppearance(zoom).alpha);
    assert.equal(draw.uniforms.get('u_zoom'), zoom);
    assert.equal(gl.uploads.length, initialUploads, 'camera changes never replace or reupload coordinates');
  }
  const members = new Set(nodes.filter((_, i) => i % 4 === 0).map(node => node.id));
  renderer.setRegionSelection(members);
  assert.equal(gl.uploads.length, initialUploads + 1);
  assert.equal(gl.uploads.at(-1).values.byteLength, 33945 * 4, 'only a one-float-per-record mask uploads');
  assert.equal(group.selectionValues.reduce((total, value) => total + value, 0), members.size);
  for (const zoom of [0.4, 64]) {
    renderer.draw(camera(zoom), layers, []);
    const draw = gl.draws.at(-1);
    assert.equal(draw.count, 33945);
    assert.equal(draw.uniforms.get('u_alpha'), 0.42);
    assert.equal(draw.uniforms.get('u_hasSelection'), 1);
  }
  renderer.setRegionSelection(null);
  renderer.draw(camera(0.4), layers, []);
  assert.equal(gl.uploads.length, initialUploads + 1);
  assert.equal(group.values, values);
  assert.equal(group.buffer, buffer);
  assert.equal(checksum(values), original, 'all positions, sizes and colors remain byte-for-byte unchanged');
});

test('Canvas fallback retains every supplied in-view record and the same distant opacity without per-star gradients', t => {
  const { renderer, fills } = harness(t, false);
  const nodes = records().map(node => ({ ...node, sx: node.x + 640, sy: node.y + 400, radius: 0.6 }));
  renderer.setData(nodes, [], new Map(nodes.map(node => [node.id, node])));
  const stats = renderer.draw(camera(0.4), layers, nodes);
  assert.equal(stats.submittedRecords, 33945);
  assert.equal(stats.drawnPoints, 33945);
  assert.deepEqual(fills, [{ alpha: starAppearance(0.4).alpha, arcs: 33945 }], 'one batched draw, no new per-record effects');
  renderer.setRegionSelection(new Set([nodes[0].id]));
  fills.length = 0;
  renderer.draw(camera(0.4), layers, nodes);
  assert.equal(fills.reduce((sum, fill) => sum + fill.arcs, 0), 33945);
  assert.ok(fills.some(fill => fill.alpha === 0.16 && fill.arcs === 33944), 'all nonmembers still rendered');
});

test('route categories distinguish source credits, recorded relationships and two inferred bases honestly', () => {
  assert.equal(routeStyle({ type: 'credit', role: 'author' }), ROUTE_STYLES.credit);
  assert.equal(routeStyle({ type: 'relationship', kind: 'published_in', inferred: false }), ROUTE_STYLES.relationship);
  assert.equal(routeStyle({ type: 'relationship', kind: 'name_match', inferred: true }), ROUTE_STYLES.inferred);
  assert.equal(routeStyle({ type: 'theme', inferred: true }), ROUTE_STYLES.theme);
  assert.equal(routeStyle({ kind: 'title_keyword_match', inferred: true }), ROUTE_STYLES.theme);
  assert.equal(routeStyle({ type: 'credit', inferred: true }), ROUTE_STYLES.inferred, 'a flagged inference never receives the direct-credit style');
  const styles = Object.values(ROUTE_STYLES);
  assert.equal(new Set(styles.map(style => style.color)).size, 4);
  assert.ok(styles.every(style => style.speed > 0 && style.speed < 1 && style.rgb.every(value => value >= 0 && value <= 1)));
  assert.ok(ROUTE_STYLES.credit.speed > ROUTE_STYLES.relationship.speed);
  assert.ok(ROUTE_STYLES.relationship.speed > ROUTE_STYLES.inferred.speed);
  assert.ok(ROUTE_STYLES.inferred.speed > ROUTE_STYLES.theme.speed);
  assert.deepEqual(styles.map(style => style.inferred), [false, false, true, true]);
});

test('dense route backdrops fade monotonically while sparse catalogs and selected overlays retain contrast', () => {
  for (const inferred of [false, true]) for (const zoom of [0.4, 1, 4, 12, 64]) {
    const original = routeOpacity(inferred, zoom);
    for (const count of [0, 1, 24, 500, 1200]) assert.equal(routeOpacity(inferred, zoom, count), original);
    const dense = [1200, 5000, 20000, 60431, 73320].map(count => routeOpacity(inferred, zoom, count));
    assert.ok(dense.every((value, i) => value > 0 && (!i || value < dense[i - 1])));
    assert.ok(dense.at(-1) / original < 0.13, 'all-route backdrop loses at least 87% of its original opacity');
    assert.ok(Math.abs(routeOpacity(inferred, zoom, 73320, true) - dense.at(-1) * 0.35) < 1e-12, 'focus further quiets only the backdrop');
  }
});

test('angular routes preserve exact endpoints, deterministic finite bends and constant arc-length progress', () => {
  for (const [a, b] of [[{ x: -600, y: 350 }, { x: 950, y: -700 }], [{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 7, y: 7 }, { x: 7, y: 7 }]]) {
    const edge = { from: 'source', to: 'target', type: 'credit' }, route = routeGeometry(a, b, edge);
    assert.deepEqual(routeGeometry(a, b, edge), route);
    assert.deepEqual(route.points[0], a); assert.deepEqual(route.points.at(-1), b);
    assert.equal(route.points.length, 4); assert.equal(route.distances.length, 4);
    assert.ok(route.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
    assert.ok(route.distances.every((distance, i) => Number.isFinite(distance) && (!i || distance >= route.distances[i - 1])));
    assert.deepEqual(routePointAt(route, 0), a); assert.deepEqual(routePointAt(route, 1), b);
    assert.deepEqual(routePointAt(route, NaN), a);
    if (route.length) {
      assert.ok(route.length > Math.hypot(b.x - a.x, b.y - a.y), 'the three-segment path bends away from a straight chord');
      for (let i = 1; i < 3; i++) {
        const corner = routePointAt(route, route.distances[i] / route.length);
        assert.ok(Math.hypot(corner.x - route.points[i].x, corner.y - route.points[i].y) < 1e-9);
      }
      const p0 = routePointAt(route, 0.02), p1 = routePointAt(route, 0.03);
      assert.ok(Math.abs(Math.hypot(p1.x - p0.x, p1.y - p0.y) - route.length * 0.01) < 1e-9);
    }
  }
});

test('animated route groups retain every enabled edge and all 33,945 records using cached geometry and uniform-only flow', t => {
  const { renderer, gl } = harness(t);
  const nodes = records();
  nodes.push({ id: 'name', kind: 'person', size: 1, x: -10, y: 10 }, { id: 'theme', kind: 'hub', size: 5, x: 12, y: -24 });
  const edges = nodes.slice(0, 400).flatMap((node, i) => [
    { from: 'name', to: node.id, type: 'credit', inferred: false },
    { from: node.id, to: nodes[i + 1].id, type: 'relationship', inferred: false },
    { from: node.id, to: nodes[i + 2].id, type: 'relationship', inferred: true },
    { from: 'theme', to: node.id, type: 'theme', inferred: true },
  ]);
  renderer.setData(nodes, edges, new Map(nodes.map(node => [node.id, node])));
  const recordGroup = renderer.pointGroups[0], original = checksum(recordGroup.values), recordBuffer = recordGroup.buffer;
  const initialUploads = gl.uploads.length, routeBuffers = renderer.edgeGroups.map(group => group.buffer);
  assert.equal(renderer.routes.size, 1600);
  for (const group of renderer.edgeGroups) {
    assert.equal(group.values.length, group.count * 24);
    assert.ok(group.values.every(Number.isFinite));
    group.members.forEach((edge, i) => {
      const route = renderer.routeFor(edge), start = i * 24, end = start + 20;
      assert.equal(group.values[start], Math.fround(route.points[0].x));
      assert.equal(group.values[start + 1], Math.fround(route.points[0].y));
      assert.equal(group.values[end], Math.fround(route.points[3].x));
      assert.equal(group.values[end + 1], Math.fround(route.points[3].y));
    });
  }
  for (const [names, relationships, inferred, regions, count] of [[false, false, false, false, 0], [false, true, false, false, 400], [false, false, true, false, 400], [false, false, true, true, 800], [true, true, true, false, 1200], [true, true, true, true, 1600]]) {
    const before = gl.draws.length;
    const stats = renderer.draw(camera(4), { ...layers, names, relationships, inferred, regions }, [], { flowTime: 27.25, animateRoutes: true });
    assert.equal(stats.submittedEdges, count); assert.equal(stats.drawnEdges, count); assert.equal(stats.submittedRecords, 33945);
    const lines = gl.draws.slice(before).filter(draw => draw.mode === gl.LINES);
    assert.equal(lines.reduce((sum, draw) => sum + draw.count, 0), count * 6);
    for (const draw of lines) {
      assert.equal(draw.uniforms.get('u_time'), 27.25); assert.equal(draw.uniforms.get('u_flow'), 1);
      const style = Object.values(ROUTE_STYLES).find(style => style.speed === draw.uniforms.get('u_speed'));
      assert.ok(style); assert.deepEqual(draw.uniforms.get('u_color'), style.rgb);
      assert.equal(draw.uniforms.get('u_alpha'), routeOpacity(style.inferred, 4, count));
    }
  }
  const all = { ...layers, names: true, relationships: true, inferred: true, regions: true };
  for (let frame = 0; frame < 100; frame++) renderer.draw(camera(frame % 2 ? 0.4 : 64), all, [], { flowTime: frame / 60, animateRoutes: true });
  renderer.draw(camera(4), all, [], { flowTime: Infinity, animateRoutes: false });
  const frozen = gl.draws.filter(draw => draw.mode === gl.LINES).slice(-renderer.edgeGroups.length);
  assert.ok(frozen.every(draw => draw.uniforms.get('u_flow') === 0 && draw.uniforms.get('u_time') === 0));
  assert.equal(gl.uploads.length, initialUploads, 'all animated and static frames reuse initial route and point uploads');
  assert.equal(checksum(recordGroup.values), original); assert.equal(recordGroup.buffer, recordBuffer);
  assert.deepEqual(renderer.edgeGroups.map(group => group.buffer), routeBuffers);
  const cached = renderer.routeFor(edges[0]); renderer.draw(camera(12), all, []);
  assert.equal(renderer.routeFor(edges[0]), cached, 'selected overlay shares the original cached angular geometry');
  const beforeFocus = gl.draws.length;
  const focused = renderer.draw({ ...camera(4), selected: nodes[10].id }, all, [], { flowTime: 33, animateRoutes: true });
  assert.equal(focused.submittedEdges, 1600); assert.equal(focused.submittedRecords, 33945);
  for (const draw of gl.draws.slice(beforeFocus).filter(draw => draw.mode === gl.LINES)) {
    const style = Object.values(ROUTE_STYLES).find(style => style.speed === draw.uniforms.get('u_speed'));
    assert.equal(draw.uniforms.get('u_alpha'), routeOpacity(style.inferred, 4, 1600, true));
  }
  assert.equal(gl.uploads.length, initialUploads); assert.equal(recordGroup.buffer, recordBuffer);
  assert.equal(checksum(recordGroup.values), original);
});
