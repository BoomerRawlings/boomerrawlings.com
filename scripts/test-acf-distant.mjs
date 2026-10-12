import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { GraphRenderer, starAppearance } from '../public/ACF/graph-renderer.js';

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
    getAttribLocation: (_, name) => ({ a_position: 0, a_size: 1, a_distance: 1, a_color: 2, a_selected: 3 })[name],
    getUniformLocation: (_, name) => name,
    useProgram: value => { program = value; }, uniform1f: (name, value) => uniforms.set(name, value), uniform2f() {},
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
