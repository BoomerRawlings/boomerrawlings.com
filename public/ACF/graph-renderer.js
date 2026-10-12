const PALETTE = { item: '#a9c9db', person: '#aaa4d0', hub: '#d89976' };
const enabled = (kind, layers) => kind === 'item' || (kind === 'person' ? layers.names : layers.inferred);
const rgb = value => /^#[\da-f]{6}$/i.test(value || '') ? [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16) / 255) : [0.66, 0.79, 0.86];
export function routeOpacity(inferred, zoom) {
  const detail = Math.min(1, Math.max(0, Math.log2(Math.max(1, zoom)) / 4));
  return inferred ? 0.006 + detail * 0.094 : 0.008 + detail * 0.072;
}
const POINT_VERTEX = `
attribute vec2 a_position; attribute float a_size; attribute vec3 a_color;
uniform vec2 u_viewport; uniform vec2 u_pan; uniform float u_scale; uniform float u_dpr; uniform float u_zoom;
varying vec3 v_color;
void main() {
  vec2 screen = a_position * u_scale + u_pan;
  gl_Position = vec4(screen.x / u_viewport.x * 2.0 - 1.0, 1.0 - screen.y / u_viewport.y * 2.0, 0.0, 1.0);
  gl_PointSize = clamp(a_size * sqrt(u_zoom), 0.6, 18.0) * 2.0 * u_dpr;
  v_color = a_color;
}`;
const POINT_FRAGMENT = `
precision mediump float; varying vec3 v_color; uniform float u_alpha;
void main() { float d = length(gl_PointCoord - vec2(0.5)) * 2.0; if (d > 1.0) discard; gl_FragColor = vec4(v_color, u_alpha * (1.0 - smoothstep(0.55, 1.0, d))); }
`;
const LINE_VERTEX = `
attribute vec2 a_position; attribute float a_distance;
uniform vec2 u_viewport; uniform vec2 u_pan; uniform float u_scale;
varying float v_distance;
void main() { vec2 screen = a_position * u_scale + u_pan; gl_Position = vec4(screen.x / u_viewport.x * 2.0 - 1.0, 1.0 - screen.y / u_viewport.y * 2.0, 0.0, 1.0); v_distance = a_distance * u_scale; }
`;
const LINE_FRAGMENT = `
precision mediump float; varying float v_distance; uniform float u_inferred; uniform float u_alpha;
void main() { if (u_inferred > 0.5 && mod(v_distance, 8.0) > 3.0) discard; gl_FragColor = u_inferred > 0.5 ? vec4(0.847,0.6,0.463,u_alpha) : vec4(0.663,0.788,0.859,u_alpha); }
`;

/** Full enabled point batches. The existing canvas stays the accessible 2D overlay/fallback. */
export class GraphRenderer {
  constructor(canvas, context, changed = () => {}) {
    this.canvas = canvas; this.context = context; this.changed = changed;
    this.backend = context ? 'canvas2d' : 'unavailable';
    this.nodes = []; this.edges = []; this.byId = new Map(); this.pointGroups = []; this.edgeGroups = [];
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
      this.gl = gl; this.activeAttributes = new Set(); this.pointsProgram = this.program(POINT_VERTEX, POINT_FRAGMENT); this.linesProgram = this.program(LINE_VERTEX, LINE_FRAGMENT);
      const locations = (program, attributes, uniforms) => ({ program,
        attributes: Object.fromEntries(attributes.map(name => [name, gl.getAttribLocation(program, name)])),
        uniforms: Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program, name)])),
      });
      this.pointLocations = locations(this.pointsProgram, ['a_position', 'a_size', 'a_color'], ['u_viewport', 'u_pan', 'u_scale', 'u_dpr', 'u_zoom', 'u_alpha']);
      this.lineLocations = locations(this.linesProgram, ['a_position', 'a_distance'], ['u_viewport', 'u_pan', 'u_scale', 'u_inferred', 'u_alpha']);
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
    if (this.pointsProgram) gl.deleteProgram(this.pointsProgram);
    if (this.linesProgram) gl.deleteProgram(this.linesProgram);
    this.pointsProgram = this.linesProgram = null;
  }
  setData(nodes, edges, byId) {
    if (this.gl) for (const group of [...this.pointGroups, ...this.edgeGroups]) if (group.buffer) this.gl.deleteBuffer(group.buffer);
    this.nodes = nodes; this.edges = edges; this.byId = byId;
    this.pointGroups = ['item', 'person', 'hub'].map(kind => {
      const members = nodes.filter(node => node.kind === kind), values = new Float32Array(members.length * 6);
      members.forEach((node, i) => values.set([node.x, node.y, node.size, ...rgb(node.color || PALETTE[kind])], i * 6));
      return { kind, count: members.length, values };
    });
    const groups = new Map();
    for (const edge of edges) {
      const a = byId.get(edge.from), b = byId.get(edge.to), key = `${Boolean(edge.inferred)}:${a.kind}:${b.kind}`;
      if (!groups.has(key)) groups.set(key, { inferred: Boolean(edge.inferred), fromKind: a.kind, toKind: b.kind, members: [] });
      groups.get(key).members.push(edge);
    }
    this.edgeGroups = [...groups.values()].map(group => {
      const values = new Float32Array(group.members.length * 6);
      group.members.forEach((edge, i) => {
        const a = byId.get(edge.from), b = byId.get(edge.to);
        values.set([a.x, a.y, 0, b.x, b.y, Math.hypot(b.x - a.x, b.y - a.y)], i * 6);
      });
      return { ...group, values, count: group.members.length };
    });
    this.upload();
  }
  upload() {
    if (!this.gl) return;
    const gl = this.gl;
    for (const group of [...this.pointGroups, ...this.edgeGroups]) {
      group.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer); gl.bufferData(gl.ARRAY_BUFFER, group.values, gl.STATIC_DRAW);
    }
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
        const x = values[i] * scale + px, y = values[i + 1] * scale + py, radius = Math.min(18, Math.max(0.6, values[i + 2] * growth));
        if (x + radius >= 0 && x - radius <= width && y + radius >= 0 && y - radius <= height) count++;
      }
      counts.inViewCount += count;
      if (group.kind === 'item') counts.inViewRecords += count;
      if (group.kind === 'person') counts.inViewNames += count;
    }
    return counts;
  }
  draw(camera, layers, screen) {
    const stats = { backend: this.backend, submittedRecords: 0, submittedNames: 0, drawnPoints: 0, submittedEdges: 0, drawnEdges: 0 };
    if (this.backend === 'unavailable') return stats;
    this.checkContext();
    if (this.gl) {
      const gl = this.gl;
      const pixelWidth = Math.round(camera.width * camera.dpr), pixelHeight = Math.round(camera.height * camera.dpr);
      if (this.gpuCanvas.width !== pixelWidth || this.gpuCanvas.height !== pixelHeight) {
        this.gpuCanvas.width = pixelWidth; this.gpuCanvas.height = pixelHeight;
      }
      gl.viewport(0, 0, this.gpuCanvas.width, this.gpuCanvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (layers.relationships || layers.inferred) {
        const locations = this.lineLocations; this.camera(locations, camera);
        for (const group of this.edgeGroups) {
          if (!(group.inferred ? layers.inferred : layers.relationships) || !enabled(group.fromKind, layers) || !enabled(group.toKind, layers) || !group.count) continue;
          gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer); this.attribute(locations.attributes.a_position, 2, 12, 0); this.attribute(locations.attributes.a_distance, 1, 12, 8);
          gl.uniform1f(locations.uniforms.u_inferred, group.inferred ? 1 : 0);
          gl.uniform1f(locations.uniforms.u_alpha, routeOpacity(group.inferred, camera.scale / camera.baseScale));
          gl.drawArrays(gl.LINES, 0, group.count * 2);
          stats.submittedEdges += group.count;
        }
      }
      const locations = this.pointLocations; this.camera(locations, camera);
      gl.uniform1f(locations.uniforms.u_dpr, camera.dpr); gl.uniform1f(locations.uniforms.u_zoom, camera.scale / camera.baseScale);
      for (const group of this.pointGroups) {
        if (!enabled(group.kind, layers) || !group.count) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer);
        this.attribute(locations.attributes.a_position, 2, 24, 0); this.attribute(locations.attributes.a_size, 1, 24, 8); this.attribute(locations.attributes.a_color, 3, 24, 12);
        gl.uniform1f(locations.uniforms.u_alpha, group.kind === 'item' ? 0.42 : group.kind === 'person' ? 0.48 : 0.72);
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
        const color = node.color || PALETTE[node.kind];
        if (!groups.has(color)) groups.set(color, []);
        groups.get(color).push(node);
        if (node.kind === 'item') stats.submittedRecords++;
        if (node.kind === 'person') stats.submittedNames++;
      }
      for (const [color, nodes] of groups) {
        ctx.globalAlpha = nodes[0].kind === 'item' ? 0.42 : nodes[0].kind === 'person' ? 0.48 : 0.72;
        ctx.fillStyle = color; ctx.beginPath();
        for (const node of nodes) { ctx.moveTo(node.sx + node.radius, node.sy); ctx.arc(node.sx, node.sy, node.radius, 0, Math.PI * 2); }
        ctx.fill(); stats.drawnPoints += nodes.length;
      }
      ctx.globalAlpha = 1;
    }
    return stats;
  }
  setActive(active) { if (this.gpuCanvas) this.gpuCanvas.style.display = active ? 'block' : 'none'; }
  destroy() {
    this.destroyed = true; this.abort.abort(); this.release(); this.gl = null; this.gpuCanvas?.remove();
    this.nodes = []; this.edges = []; this.byId = new Map(); this.pointGroups = []; this.edgeGroups = [];
  }
}
