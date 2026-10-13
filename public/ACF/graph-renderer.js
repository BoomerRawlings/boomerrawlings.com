import { routeGeometry, routeStyle } from './route-style.js?v=continuum-20261013';

const PALETTE = { item: '#a9c9db', person: '#aaa4d0', hub: '#d89976' };
const enabled = (kind, layers) => kind === 'item' || (kind === 'person' ? layers.names : layers.regions);
const routeEndpointEnabled = enabled;
const rgb = value => /^#[\da-f]{6}$/i.test(value || '') ? [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16) / 255) : [0.66, 0.79, 0.86];
export function routeOpacity(inferred, zoom, edgeCount = 0, focused = false) {
  const detail = Math.min(1, Math.max(0, Math.log2(Math.max(1, zoom)) / 4));
  // Dense catalogs retain every route, but their combined backdrop must not cover the stars.
  // Small imported catalogs keep their original visibility; the selected overlay stays bright.
  const count = Number.isFinite(edgeCount) ? Math.max(1200, edgeCount) : 1200;
  const density = Math.sqrt(1200 / count) * (focused ? 0.35 : 1);
  return (inferred ? 0.006 + detail * 0.094 : 0.008 + detail * 0.072) * density;
}
export function starAppearance(zoom, selected = false) {
  const distance = Number.isFinite(zoom) ? Math.min(64, Math.max(0.4, zoom)) : 1;
  const detail = Math.min(1, Math.log2(Math.max(1, distance)) / 4);
  // Distant overlapping stars keep their density structure. Close stars reveal a core and halo.
  // Region contrast is fixed: every nonmember remains visible under the unchanged mask.
  return { detail, alpha: selected ? 0.42 : 0.42 * Math.sqrt(Math.min(1, distance)) + detail * 0.16 };
}
const POINT_VERTEX = `
attribute vec2 a_position; attribute float a_size; attribute vec3 a_color; attribute float a_selected;
attribute vec4 a_viewPosition; attribute vec4 a_viewFrom; attribute vec4 a_viewTo;
uniform vec2 u_viewport; uniform vec2 u_pan; uniform float u_scale; uniform float u_dpr; uniform float u_zoom;
uniform float u_hasSelection; varying vec3 v_color; varying float v_opacity;
uniform float u_viewActive; uniform float u_viewProgress;
void main() {
  vec2 position = mix(a_position, mix(a_viewPosition.xy, a_viewPosition.zw, u_viewProgress), u_viewActive);
  vec2 screen = position * u_scale + u_pan;
  gl_Position = vec4(screen.x / u_viewport.x * 2.0 - 1.0, 1.0 - screen.y / u_viewport.y * 2.0, 0.0, 1.0);
  float selected = a_selected * u_hasSelection;
  gl_PointSize = clamp(a_size * sqrt(u_zoom) * (1.0 + selected * 0.65), 0.6, 18.0) * 2.0 * u_dpr;
  v_color = mix(a_color, vec3(1.0, 0.82, 0.57), selected);
  v_opacity = mix(1.0, mix(0.38, 2.24, a_selected), u_hasSelection);
  vec4 viewStyle = mix(a_viewFrom, a_viewTo, u_viewProgress);
  v_color = mix(v_color, viewStyle.rgb, u_viewActive);
  v_opacity = mix(v_opacity, viewStyle.a, u_viewActive);
}`;
const POINT_FRAGMENT = `
precision mediump float; varying vec3 v_color; varying float v_opacity; uniform float u_alpha; uniform float u_detail;
void main() {
  float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 0.38, d);
  float halo = (1.0 - d) * (1.0 - d);
  float shape = mix(1.0 - smoothstep(0.55, 1.0, d), core * 0.7 + halo * 0.3, u_detail);
  vec3 color = mix(v_color, vec3(1.0), core * u_detail * 0.42);
  gl_FragColor = vec4(color, u_alpha * v_opacity * shape);
}
`;
const LINE_VERTEX = `
attribute vec2 a_position; attribute vec2 a_progress; attribute vec2 a_destination;
uniform vec2 u_viewport; uniform vec2 u_pan; uniform float u_scale;
varying mediump float v_progress;
uniform float u_viewActive; uniform float u_viewProgress;
void main() { vec2 position = mix(a_position, mix(a_position, a_destination, u_viewProgress), u_viewActive); vec2 screen = position * u_scale + u_pan; gl_Position = vec4(screen.x / u_viewport.x * 2.0 - 1.0, 1.0 - screen.y / u_viewport.y * 2.0, 0.0, 1.0); v_progress = a_progress.x + a_progress.y; }
`;
const LINE_FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying mediump float v_progress;
uniform float u_inferred; uniform float u_alpha; uniform vec3 u_color;
uniform float u_time; uniform float u_speed; uniform float u_flow;
void main() {
  float forward = 1.0 - smoothstep(0.0, 0.08, abs(fract(v_progress - u_time * u_speed) - 0.12));
  float reverse = 1.0 - smoothstep(0.0, 0.08, abs(fract(v_progress + u_time * u_speed + 0.5) - 0.12));
  float flow = max(forward, reverse) * u_flow;
  if (u_inferred > 0.5 && fract(v_progress * 36.0) > 0.42 && flow < 0.2) discard;
  gl_FragColor = vec4(mix(u_color, vec3(1.0), flow * 0.35), u_alpha * (1.0 + flow * 3.0));
}
`;

/** Full enabled point batches. The existing canvas stays the accessible 2D overlay/fallback. */
export class GraphRenderer {
  constructor(canvas, context, changed = () => {}) {
    this.canvas = canvas; this.context = context; this.changed = changed;
    this.backend = context ? 'canvas2d' : 'unavailable';
    this.nodes = []; this.edges = []; this.byId = new Map(); this.pointGroups = []; this.edgeGroups = []; this.routes = new Map();
    this.selection = null;
    this.comparison = null; this.comparisonProgress = 1; this.comparisonRoutes = new Map(); this.comparisonEdgeGroups = [];
    this.abort = new AbortController(); this.gl = null; this.gpuCanvas = null; this.destroyed = false;
    if (!context || !document.createElement || !canvas.parentElement?.insertBefore) return;
    try {
      this.gpuCanvas = document.createElement('canvas');
      this.gpuCanvas.className = 'atlas-gpu-points';
      this.gpuCanvas.setAttribute('aria-hidden', 'true');
      this.gpuCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
      canvas.parentElement.insertBefore(this.gpuCanvas, canvas);
      this.gpuCanvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); this.gl = null; this.backend = this.context ? 'canvas2d' : 'unavailable';
        this.gpuCanvas.style.visibility = 'hidden'; this.changed();
      }, { signal: this.abort.signal });
      this.gpuCanvas.addEventListener('webglcontextrestored', () => {
        if (this.destroyed) return;
        this.initialize(); this.upload(); this.changed();
      }, { signal: this.abort.signal });
      this.initialize();
    } catch { this.fallback(); }
  }
  program(vertex, fragment) {
    const gl = this.gl, shaders = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
        const shader = gl.createShader(type); shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Shader compilation unavailable');
      }
      const program = gl.createProgram(); shaders.forEach(shader => gl.attachShader(program, shader)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('Shader linking unavailable'); }
      return program;
    } finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  }
  initialize() {
    try {
      const gl = this.gpuCanvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL unavailable');
      this.gl = gl;
      for (const attribute of this.activeAttributes || []) gl.disableVertexAttribArray(attribute);
      this.activeAttributes = new Set(); this.pointsProgram = this.program(POINT_VERTEX, POINT_FRAGMENT); this.linesProgram = this.program(LINE_VERTEX, LINE_FRAGMENT);
      const locations = (program, attributes, uniforms) => ({ program,
        attributes: Object.fromEntries(attributes.map(name => [name, gl.getAttribLocation(program, name)])),
        uniforms: Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program, name)])),
      });
      this.pointLocations = locations(this.pointsProgram, ['a_position', 'a_size', 'a_color', 'a_selected', 'a_viewPosition', 'a_viewFrom', 'a_viewTo'], ['u_viewport', 'u_pan', 'u_scale', 'u_dpr', 'u_zoom', 'u_alpha', 'u_detail', 'u_hasSelection', 'u_viewActive', 'u_viewProgress']);
      this.lineLocations = locations(this.linesProgram, ['a_position', 'a_progress', 'a_destination'], ['u_viewport', 'u_pan', 'u_scale', 'u_inferred', 'u_alpha', 'u_color', 'u_time', 'u_speed', 'u_flow', 'u_viewActive', 'u_viewProgress']);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.backend = 'webgl'; this.gpuCanvas.style.visibility = 'visible';
    } catch { this.fallback(); }
  }
  fallback() {
    this.release(); this.gl = null; this.backend = this.context ? 'canvas2d' : 'unavailable';
    if (this.gpuCanvas) this.gpuCanvas.style.visibility = 'hidden';
  }
  release() {
    const gl = this.gl;
    if (!gl) return;
    for (const group of [...this.pointGroups, ...this.edgeGroups]) if (group.buffer) gl.deleteBuffer(group.buffer);
    for (const group of this.pointGroups) if (group.selectionBuffer) gl.deleteBuffer(group.selectionBuffer);
    this.releaseComparison();
    if (this.pointsProgram) gl.deleteProgram(this.pointsProgram);
    if (this.linesProgram) gl.deleteProgram(this.linesProgram);
    this.pointsProgram = this.linesProgram = null;
  }
  setData(nodes, edges, byId) {
    this.setComparison(null);
    if (this.gl) for (const group of [...this.pointGroups, ...this.edgeGroups]) if (group.buffer) this.gl.deleteBuffer(group.buffer);
    if (this.gl) for (const group of this.pointGroups) if (group.selectionBuffer) this.gl.deleteBuffer(group.selectionBuffer);
    this.nodes = nodes; this.edges = edges; this.byId = byId;
    this.pointGroups = ['item', 'person', 'hub'].map(kind => {
      const members = nodes.filter(node => node.kind === kind), values = new Float32Array(members.length * 6);
      members.forEach((node, i) => values.set([node.x, node.y, node.size, ...rgb(node.color || PALETTE[kind])], i * 6));
      return { kind, count: members.length, values, members };
    });
    const groups = new Map(); this.routes = new Map();
    for (const edge of edges) {
      const a = byId.get(edge.from), b = byId.get(edge.to), style = routeStyle(edge), key = `${style.id}:${Boolean(edge.inferred)}:${a.kind}:${b.kind}`;
      this.routes.set(edge, routeGeometry(a, b, edge));
      if (!groups.has(key)) groups.set(key, { style, inferred: Boolean(edge.inferred), fromKind: a.kind, toKind: b.kind, members: [] });
      groups.get(key).members.push(edge);
    }
    this.edgeGroups = [...groups.values()].map(group => {
      const values = new Float32Array(group.members.length * 24);
      group.members.forEach((edge, i) => {
        const route = this.routes.get(edge);
        for (let segment = 0; segment < 3; segment++) for (let end = 0; end < 2; end++) {
          const index = segment + end, point = route.points[index], distance = route.distances[index];
          values.set([point.x, point.y, route.length ? distance / route.length : 0, route.phase], i * 24 + (segment * 2 + end) * 4);
        }
      });
      return { ...group, values, count: group.members.length };
    });
    this.upload();
  }
  routeFor(edge) {
    const route = this.comparisonRoutes.get(edge);
    if (!route || !this.comparison) return this.routes.get(edge);
    const progress = this.comparisonProgress, points = route.from.points.map((point, i) => ({ x: point.x + (route.to.points[i].x - point.x) * progress, y: point.y + (route.to.points[i].y - point.y) * progress })), distances = [0];
    for (let i = 1; i < points.length; i++) distances.push(distances.at(-1) + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    return { points, distances, length: distances.at(-1), phase: route.to.phase };
  }
  releaseComparison() {
    if (this.gl) {
      for (const group of this.pointGroups) if (group.comparisonBuffer) this.gl.deleteBuffer(group.comparisonBuffer);
      for (const group of this.comparisonEdgeGroups) if (group.buffer) this.gl.deleteBuffer(group.buffer);
    }
    for (const group of this.pointGroups) group.comparisonBuffer = null;
  }
  setComparison(comparison) {
    this.releaseComparison(); this.comparison = comparison; this.comparisonProgress = comparison ? 0 : 1;
    this.comparisonRoutes = new Map(); this.comparisonEdgeGroups = [];
    for (const group of this.pointGroups) {
      group.comparisonValues = null;
      if (!comparison) continue;
      group.comparisonValues = new Float32Array(group.count * 12);
      group.members.forEach((node, i) => {
        const { from, to } = comparison.points.get(node.id);
        group.comparisonValues.set([from.x, from.y, to.x, to.y, ...rgb(from.color), from.opacity, ...rgb(to.color), to.opacity], i * 12);
      });
    }
    if (comparison) {
      const groups = new Map();
      for (const edge of comparison.edges) {
        const a = comparison.points.get(edge.from), b = comparison.points.get(edge.to); if (!a || !b) continue;
        const style = routeStyle(edge), key = `${style.id}:${Boolean(edge.inferred)}`;
        const route = { from: routeGeometry(a.from, b.from, edge), to: routeGeometry(a.to, b.to, edge) };
        this.comparisonRoutes.set(edge, route);
        if (!groups.has(key)) groups.set(key, { style, inferred: Boolean(edge.inferred), fromKind: 'item', toKind: 'item', members: [] });
        groups.get(key).members.push(edge);
      }
      this.comparisonEdgeGroups = [...groups.values()].map(group => {
        const values = new Float32Array(group.members.length * 36);
        group.members.forEach((edge, i) => {
          const route = this.comparisonRoutes.get(edge);
          for (let segment = 0; segment < 3; segment++) for (let end = 0; end < 2; end++) {
            const index = segment + end, a = route.from.points[index], b = route.to.points[index];
            values.set([a.x, a.y, route.to.length ? route.to.distances[index] / route.to.length : 0, route.to.phase, b.x, b.y], i * 36 + (segment * 2 + end) * 6);
          }
        });
        return { ...group, count: group.members.length, values };
      });
    }
    this.uploadComparison();
  }
  uploadComparison() {
    if (!this.gl || !this.comparison) return;
    const gl = this.gl;
    for (const group of this.pointGroups) if (group.comparisonValues) { group.comparisonBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, group.comparisonBuffer); gl.bufferData(gl.ARRAY_BUFFER, group.comparisonValues, gl.STATIC_DRAW); }
    for (const group of this.comparisonEdgeGroups) { group.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer); gl.bufferData(gl.ARRAY_BUFFER, group.values, gl.STATIC_DRAW); }
  }
  setRegionSelection(selection) {
    this.selection = selection;
    const records = this.pointGroups.find(group => group.kind === 'item');
    if (!records || !selection) return;
    // Only this small mask changes. Original coordinates, colors and GPU geometry stay intact.
    records.selectionValues ||= new Float32Array(records.count);
    records.members.forEach((node, i) => { records.selectionValues[i] = selection.has(node.id) ? 1 : 0; });
    this.uploadSelection(records);
  }
  uploadSelection(group) {
    if (!this.gl || !group.selectionValues) return;
    const gl = this.gl;
    group.selectionBuffer ||= gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, group.selectionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, group.selectionValues, gl.DYNAMIC_DRAW);
  }
  upload() {
    if (!this.gl) return;
    const gl = this.gl;
    for (const group of [...this.pointGroups, ...this.edgeGroups]) {
      group.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer); gl.bufferData(gl.ARRAY_BUFFER, group.values, gl.STATIC_DRAW);
    }
    // A restored context needs a new mask buffer as well as the original geometry.
    for (const group of this.pointGroups) if (group.selectionValues) { group.selectionBuffer = null; this.uploadSelection(group); }
    this.uploadComparison();
  }
  camera(locations, camera) {
    const gl = this.gl, u = locations.uniforms;
    for (const attribute of this.activeAttributes) gl.disableVertexAttribArray(attribute);
    this.activeAttributes.clear();
    gl.useProgram(locations.program);
    gl.uniform2f(u.u_viewport, camera.width, camera.height); gl.uniform2f(u.u_pan, camera.pan.x, camera.pan.y); gl.uniform1f(u.u_scale, camera.scale);
  }
  attribute(location, size, stride, offset) {
    const gl = this.gl; gl.enableVertexAttribArray(location); this.activeAttributes.add(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  }
  checkContext() {
    if (this.gl && this.gl.isContextLost()) { this.gl = null; this.gpuCanvas.style.visibility = 'hidden'; this.backend = this.context ? 'canvas2d' : 'unavailable'; this.changed(); }
  }
  countInView(camera, layers) {
    const counts = { inViewRecords: 0, inViewNames: 0, inViewCount: 0 }, growth = Math.sqrt(camera.scale / camera.baseScale);
    // Tight typed-array pass: no per-record objects, maps, sorting or edge inspection.
    for (const group of this.pointGroups) {
      if (!enabled(group.kind, layers)) continue;
      let count = 0;
      const values = group.values, scale = camera.scale, px = camera.pan.x, py = camera.pan.y, width = camera.width, height = camera.height;
      for (let i = 0; i < values.length; i += 6) {
        const view = group.comparisonValues, vi = i * 2, progress = this.comparisonProgress;
        if (this.comparison && group.kind !== 'item' && view[vi + 7] + (view[vi + 11] - view[vi + 7]) * progress <= 0.001) continue;
        const wx = this.comparison ? view[vi] + (view[vi + 2] - view[vi]) * progress : values[i], wy = this.comparison ? view[vi + 1] + (view[vi + 3] - view[vi + 1]) * progress : values[i + 1];
        const x = wx * scale + px, y = wy * scale + py, radius = Math.min(18, Math.max(0.6, values[i + 2] * growth));
        if (x + radius >= 0 && x - radius <= width && y + radius >= 0 && y - radius <= height) count++;
      }
      counts.inViewCount += count;
      if (group.kind === 'item') counts.inViewRecords += count;
      if (group.kind === 'person') counts.inViewNames += count;
    }
    return counts;
  }
  draw(camera, layers, screen, { flowTime = 0, animateRoutes = false } = {}) {
    const stats = { backend: this.backend, submittedRecords: 0, submittedNames: 0, drawnPoints: 0, submittedEdges: 0, drawnEdges: 0 };
    if (this.backend === 'unavailable') return stats;
    this.checkContext();
    const appearance = starAppearance(camera.scale / camera.baseScale, this.selection !== null);
    if (this.gl) {
      const gl = this.gl;
      const pixelWidth = Math.round(camera.width * camera.dpr), pixelHeight = Math.round(camera.height * camera.dpr);
      if (this.gpuCanvas.width !== pixelWidth || this.gpuCanvas.height !== pixelHeight) {
        this.gpuCanvas.width = pixelWidth; this.gpuCanvas.height = pixelHeight;
      }
      gl.viewport(0, 0, this.gpuCanvas.width, this.gpuCanvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (layers.relationships || layers.inferred) {
        const locations = this.lineLocations; this.camera(locations, camera);
        const groups = (this.comparison ? this.comparisonEdgeGroups : this.edgeGroups).filter(group => (group.inferred ? layers.inferred : layers.relationships) && routeEndpointEnabled(group.fromKind, layers) && routeEndpointEnabled(group.toKind, layers) && group.count);
        const edgeCount = groups.reduce((sum, group) => sum + group.count, 0);
        const focused = Boolean(camera.hovered || camera.keyboardId || camera.selected);
        // All category speeds make a whole number of cycles in 100s: wrap without a seam or precision growth.
        gl.uniform1f(locations.uniforms.u_time, Number.isFinite(flowTime) ? flowTime % 100 : 0);
        gl.uniform1f(locations.uniforms.u_flow, animateRoutes ? 1 : 0);
        gl.uniform1f(locations.uniforms.u_viewActive, this.comparison ? 1 : 0); gl.uniform1f(locations.uniforms.u_viewProgress, this.comparisonProgress);
        for (const group of groups) {
          const stride = this.comparison ? 24 : 16;
          gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer); this.attribute(locations.attributes.a_position, 2, stride, 0); this.attribute(locations.attributes.a_progress, 2, stride, 8);
          if (this.comparison) this.attribute(locations.attributes.a_destination, 2, stride, 16);
          gl.uniform1f(locations.uniforms.u_inferred, group.inferred ? 1 : 0);
          gl.uniform3f(locations.uniforms.u_color, ...group.style.rgb);
          gl.uniform1f(locations.uniforms.u_speed, group.style.speed);
          const comparisonFade = this.comparison?.exiting ? 1 - this.comparisonProgress : 1;
          gl.uniform1f(locations.uniforms.u_alpha, routeOpacity(group.inferred, camera.scale / camera.baseScale, edgeCount, focused) * (this.comparison ? 2.8 * comparisonFade : 1));
          gl.drawArrays(gl.LINES, 0, group.count * 6);
          stats.submittedEdges += group.count;
        }
      }
      const locations = this.pointLocations; this.camera(locations, camera);
      gl.uniform1f(locations.uniforms.u_dpr, camera.dpr); gl.uniform1f(locations.uniforms.u_zoom, camera.scale / camera.baseScale);
      gl.uniform1f(locations.uniforms.u_detail, appearance.detail);
      gl.uniform1f(locations.uniforms.u_viewActive, this.comparison ? 1 : 0); gl.uniform1f(locations.uniforms.u_viewProgress, this.comparisonProgress);
      for (const group of this.pointGroups) {
        if (!enabled(group.kind, layers) || !group.count) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer);
        this.attribute(locations.attributes.a_position, 2, 24, 0); this.attribute(locations.attributes.a_size, 1, 24, 8); this.attribute(locations.attributes.a_color, 3, 24, 12);
        if (this.comparison) {
          gl.bindBuffer(gl.ARRAY_BUFFER, group.comparisonBuffer);
          this.attribute(locations.attributes.a_viewPosition, 4, 48, 0); this.attribute(locations.attributes.a_viewFrom, 4, 48, 16); this.attribute(locations.attributes.a_viewTo, 4, 48, 32);
        }
        const selected = !this.comparison && group.kind === 'item' && this.selection !== null;
        gl.uniform1f(locations.uniforms.u_hasSelection, selected ? 1 : 0);
        if (selected && group.selectionBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, group.selectionBuffer); this.attribute(locations.attributes.a_selected, 1, 4, 0);
        } else {
          gl.disableVertexAttribArray(locations.attributes.a_selected); this.activeAttributes.delete(locations.attributes.a_selected);
          gl.vertexAttrib1f(locations.attributes.a_selected, 0);
        }
        gl.uniform1f(locations.uniforms.u_alpha, group.kind === 'item' ? appearance.alpha : group.kind === 'person' ? 0.48 : 0.72);
        gl.drawArrays(gl.POINTS, 0, group.count); stats.drawnPoints += group.count;
        if (group.kind === 'item') stats.submittedRecords += group.count;
        if (group.kind === 'person') stats.submittedNames += group.count;
      }
      stats.drawnEdges = stats.submittedEdges;
    } else {
      stats.backend = this.backend;
      const ctx = this.context;
      if (!ctx) return stats;
      // Full data fallback: cull only outside the camera, never sample or drop visible records.
      const groups = new Map();
      for (const node of screen) {
        const selected = !this.comparison && node.kind === 'item' && this.selection?.has(node.id);
        const transition = this.comparison?.points.get(node.id), progress = this.comparisonProgress;
        const fromColor = transition ? rgb(transition.from.color) : null, toColor = transition ? rgb(transition.to.color) : null;
        const color = transition ? `rgb(${fromColor.map((value, i) => Math.round((value + (toColor[i] - value) * progress) * 255)).join(',')})` : selected ? '#ffd192' : node.color || PALETTE[node.kind];
        const alpha = (node.kind === 'item' ? (!this.comparison && this.selection ? selected ? 0.94 : 0.16 : appearance.alpha) : node.kind === 'person' ? 0.48 : 0.72) * (transition ? transition.from.opacity + (transition.to.opacity - transition.from.opacity) * progress : 1);
        const key = `${color}:${alpha}`;
        if (!groups.has(key)) groups.set(key, { color, alpha, growth: selected ? 1.65 : 1, nodes: [] });
        groups.get(key).nodes.push(node);
        if (node.kind === 'item') stats.submittedRecords++;
        if (node.kind === 'person') stats.submittedNames++;
      }
      for (const { color, alpha, growth, nodes } of groups.values()) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color; ctx.beginPath();
        for (const node of nodes) { const radius = Math.min(18, node.radius * growth); ctx.moveTo(node.sx + radius, node.sy); ctx.arc(node.sx, node.sy, radius, 0, Math.PI * 2); }
        ctx.fill(); stats.drawnPoints += nodes.length;
      }
      ctx.globalAlpha = 1;
    }
    return stats;
  }
  setActive(active) { if (this.gpuCanvas) this.gpuCanvas.style.display = active ? 'block' : 'none'; }
  destroy() {
    this.destroyed = true; this.abort.abort(); this.release(); this.gl = null; this.gpuCanvas?.remove();
    this.nodes = []; this.edges = []; this.byId = new Map(); this.pointGroups = []; this.edgeGroups = []; this.routes.clear();
    this.selection = null; this.comparison = null; this.comparisonRoutes.clear(); this.comparisonEdgeGroups = [];
  }
}
