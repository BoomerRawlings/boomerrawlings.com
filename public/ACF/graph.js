import { SpatialGrid } from './graph-spatial.js?v=regions-20261012b';
import { GraphRenderer, routeOpacity } from './graph-renderer.js?v=regions-20261012b';

const COLORS = { hub: '#d89976', item: '#a9c9db', person: '#aaa4d0' };
const REGION_COLORS = ['#90c2d1', '#c5a5cc', '#d6ac7f', '#9ebd92', '#94a8d3', '#c7bb82'];
const regionRGBA = (color, alpha) => `rgba(${[1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16)).join(',')},${alpha})`;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  result = Math.imul(result ^ (result >>> 16), 0x85ebca6b);
  result = Math.imul(result ^ (result >>> 13), 0xc2b2ae35);
  return (result ^ (result >>> 16)) >>> 0;
}

/** Event-driven full-record map. Labels and connection emphasis are bounded; records are not sampled. */
export class AtlasGraph {
  constructor(canvas, { onSelect = () => {}, onPreview = () => {}, onLabels = () => {}, onZoom = () => {}, onStatus = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.onPreview = onPreview;
    this.onLabels = onLabels;
    this.onZoom = onZoom;
    this.onStatus = onStatus;
    this.layers = { names: false, labels: true, relationships: false, regions: true, inferred: false };
    this.renderer = new GraphRenderer(canvas, this.ctx, () => { this.animationUntil = 0; this.connectionPulse = null; this.requestDraw(); });
    this.available = this.renderer.backend !== 'unavailable';
    this.spatial = new SpatialGrid();
    this.adjacency = new Map();
    this.regions = [];
    this.regionNodes = [];
    this.regionSelection = null;
    this.regionSelectionMeta = {};
    this.fixedBounds = null;
    this.dataRevision = 0;
    this.screenKey = '';
    this.focusOrder = [];
    this.labelOrder = { item: [], hub: [] };
    this.nodes = [];
    this.edges = [];
    this.visible = [];
    this.screen = [];
    this.byId = new Map();
    this.pointers = new Map();
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.scale = 1;
    this.baseScale = 1;
    this.pan = { x: 0, y: 0 };
    this.active = false;
    this.destroyed = false;
    this.paused = false;
    this.selected = null;
    this.hovered = null;
    this.keyboardId = null;
    this.frame = null;
    this.animationUntil = 0;
    this.connectionPulse = null;
    this.depthOrigin = { x: 0, y: 0 };
    // Decorative depth texture only: these points never enter node, edge or hit indexes.
    this.depthLayers = [36, 18, 12].map((count, layer) => Array.from({ length: count }, (_, i) => ({
      u: hash(`depth-x:${layer}:${i}`) / 4294967296,
      v: hash(`depth-y:${layer}:${i}`) / 4294967296,
      depth: (layer + 1) / 3,
      radius: 0.45 + layer * 0.2,
    })));
    this.initialized = false;
    this.lastStatus = '';
    this.labelBoxes = [];
    this.labelPlans = [];
    this.labelsDirty = true;
    this.previewId = null;
    this.previewAnchor = { x: 0, y: 0 };
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.canvas.style.touchAction = 'none';
    if (!this.canvas.hasAttribute('tabindex')) this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-keyshortcuts', '+ - ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowUp Shift+ArrowDown Shift+ArrowLeft Shift+ArrowRight [ ] Home Enter Escape');
    canvas.addEventListener('pointerdown', event => this.pointerDown(event), { signal });
    canvas.addEventListener('pointermove', event => this.pointerMove(event), { signal });
    canvas.addEventListener('pointerup', event => this.pointerUp(event), { signal });
    canvas.addEventListener('pointercancel', event => this.pointerCancel(event), { signal });
    canvas.addEventListener('lostpointercapture', event => this.pointerCancel(event), { signal });
    canvas.addEventListener('pointerleave', () => {
      if (!this.pointers.size) this.setHovered(null, true);
    }, { signal });
    canvas.addEventListener('wheel', event => {
      if (!this.active) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1);
      this.zoomBy(Math.exp(-clamp(delta, -500, 500) * 0.0015), this.point(event));
    }, { signal, passive: false });
    canvas.addEventListener('keydown', event => this.keyDown(event), { signal });
    canvas.addEventListener('focus', () => {
      if (!this.active || this.pointers.size) return;
      this.updateScreen();
      this.focusNode(this.byId.get(this.keyboardId) || this.nearestCenter());
    }, { signal });
    canvas.addEventListener('blur', () => this.requestDraw(), { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.dismissPreview('layout'); this.animationUntil = 0; this.cancelFrame(); }
      else this.requestDraw();
    }, { signal });
    this.motion.addEventListener('change', () => {
      this.animationUntil = 0;
      this.connectionPulse = null;
      this.requestDraw();
    }, { signal });
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  setData({ nodes = [], edges = [], regions = [], bounds = null } = {}) {
    if (this.destroyed) return;
    this.byId = new Map();
    for (const node of nodes) {
      if (node?.id == null || this.byId.has(String(node.id))) continue;
      const clean = {
        ...node,
        id: String(node.id),
        label: String(node.label || node.id),
        kind: ['hub', 'person'].includes(node.kind) ? node.kind : 'item',
        x: finite(node.x),
        y: finite(node.y),
        size: clamp(finite(node.size, node.kind === 'hub' ? 5 : node.kind === 'person' ? 0.9 : 0.75), 0.65, node.kind === 'item' ? 0.75 : node.kind === 'person' ? 0.9 : 8),
        seed: hash(`label:${node.id}`),
      };
      this.byId.set(clean.id, clean);
    }
    this.nodes = [...this.byId.values()];
    this.edges = edges.filter(edge => edge && this.byId.has(String(edge.from)) && this.byId.has(String(edge.to)))
      .map(edge => ({ ...edge, from: String(edge.from), to: String(edge.to) }));
    this.regions = regions.map((region, i) => ({ ...region, color: REGION_COLORS[i % REGION_COLORS.length] }));
    this.regionNodes = this.nodes.filter(node => node.kind === 'hub');
    for (const region of this.regions) { const node = this.byId.get(region.id); if (node) node.color = region.color; }
    this.fixedBounds = bounds && ['left', 'right', 'top', 'bottom'].every(key => Number.isFinite(bounds[key])) ? bounds : null;
    this.spatial = new SpatialGrid(this.nodes);
    this.adjacency = new Map(this.nodes.map(node => [node.id, []]));
    for (const edge of this.edges) { this.adjacency.get(edge.from).push(edge); if (edge.to !== edge.from) this.adjacency.get(edge.to).push(edge); }
    this.focusOrder = [...this.nodes].sort((a, b) => a.id.localeCompare(b.id));
    this.labelOrder = {
      item: this.nodes.filter(node => node.kind === 'item').sort((a, b) => a.seed - b.seed),
      hub: this.nodes.filter(node => node.kind !== 'item').sort((a, b) => (b.count || 0) - (a.count || 0) || a.seed - b.seed),
    };
    this.recordCount = this.nodes.filter(node => node.kind === 'item').length;
    this.nameCount = this.nodes.filter(node => node.kind === 'person').length;
    this.canvas.dataset.recordIdCount = String(this.recordCount);
    this.canvas.dataset.recordIdHash = hash(this.nodes.filter(node => node.kind === 'item').map(node => node.id).join('\n')).toString(16);
    this.renderer.setData(this.nodes, this.edges, this.byId);
    // Data replacement can remove records; a retained region selection must never retain stale IDs.
    if (this.regionSelection) this.regionSelection = new Set([...this.regionSelection].filter(id => this.byId.get(id)?.kind === 'item'));
    this.renderer.setRegionSelection(this.regionSelection);
    this.dataRevision++;
    this.screenKey = '';
    this.enabledNodes = this.nodes.filter(node => this.nodeEnabled(node));
    this.enabledFocus = this.focusOrder.filter(node => this.nodeEnabled(node));
    if (!this.byId.has(this.selected)) this.selected = null;
    this.hovered = null;
    this.keyboardId = null;
    this.screen = [];
    const firstData = !this.hasData && this.nodes.length;
    this.hasData ||= this.nodes.length > 0;
    this.dismissPreview('layout');
    if (firstData || !this.initialized) this.reset();
    else this.requestDraw();
    this.startConnectionPulse();
    if (!this.ctx) {
      this.canvas.dataset.graphUnavailable = 'true';
      this.publishStatus({ backend: 'unavailable', submittedRecords: 0, submittedNames: 0, drawnPoints: 0, submittedEdges: 0, drawnEdges: 0 });
    }
  }

  nodeEnabled(node) { return node.kind === 'item' || (node.kind === 'person' ? this.layers.names : this.layers.regions); }
  routeNodeEnabled(node) { return node.kind !== 'person' || this.layers.names; }
  edgeEnabled(edge) { return edge.inferred ? this.layers.inferred : this.layers.relationships; }

  setRegionSelection(memberIds, { id = '', label = '', total = memberIds?.size || 0 } = {}) {
    if (this.destroyed) return;
    const selection = memberIds == null ? null : new Set([...memberIds].map(String).filter(value => this.byId.get(value)?.kind === 'item'));
    const same = selection === null ? this.regionSelection === null : this.regionSelection !== null && selection.size === this.regionSelection.size && [...selection].every(value => this.regionSelection.has(value));
    this.regionSelectionMeta = selection === null ? {} : { id: String(id), label: String(label), total: Math.max(selection.size, finite(total, selection.size)) };
    if (!same) { this.regionSelection = selection; this.renderer.setRegionSelection(selection); }
    this.labelsDirty = true;
    this.requestDraw();
    if (!this.ctx) this.publishStatus({ backend: 'unavailable', submittedRecords: 0, submittedNames: 0, drawnPoints: 0, submittedEdges: 0, drawnEdges: 0 });
  }

  setLayers(layers = {}) {
    let changed = false;
    for (const key of Object.keys(this.layers)) if (typeof layers[key] === 'boolean' && layers[key] !== this.layers[key]) { this.layers[key] = layers[key]; changed = true; }
    if (!changed || this.destroyed) return;
    this.enabledNodes = this.nodes.filter(node => this.nodeEnabled(node));
    this.enabledFocus = this.focusOrder.filter(node => this.nodeEnabled(node));
    this.screenKey = '';
    this.dismissPreview('layout');
    this.startConnectionPulse();
    this.requestDraw();
  }

  focusRecord(id) {
    const node = this.byId.get(String(id));
    if (!node || this.destroyed) return false;
    if (node.kind === 'person' && !this.layers.names) this.setLayers({ names: true });
    if (node.kind === 'hub' && !this.layers.regions) this.setLayers({ regions: true });
    this.dismissPreview('layout');
    this.scale = Math.max(this.scale, this.baseScale * 5);
    const center = this.viewportCenter();
    this.pan = { x: center.x - node.x * this.scale, y: center.y - node.y * this.scale };
    this.onZoom(this.scale / this.baseScale);
    this.select(node, 'keyboard');
    return true;
  }

  setActive(active) {
    if (this.destroyed) return;
    const wasActive = this.active;
    if (!active) this.dismissPreview('layout');
    this.active = Boolean(active);
    this.renderer.setActive(this.active);
    if (this.active) {
      this.measure();
      if (!wasActive) this.startConnectionPulse();
      this.requestDraw(true);
    } else {
      this.cancelFrame();
      this.animationUntil = 0;
      this.pointers.clear();
      this.hovered = null;
      this.canvas.style.cursor = 'grab';
    }
  }

  measure() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width < 1 || height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    const wasInitialized = this.initialized && this.width > 0 && this.height > 0;
    const oldCenter = this.viewportCenter();
    const worldCenter = { x: (oldCenter.x - this.pan.x) / this.scale, y: (oldCenter.y - this.pan.y) / this.scale };
    const zoom = this.scale / this.baseScale;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.reset();
    if (wasInitialized) {
      const center = this.viewportCenter();
      this.scale = this.baseScale * zoom;
      this.pan = { x: center.x - worldCenter.x * this.scale, y: center.y - worldCenter.y * this.scale };
      this.onZoom(zoom);
      this.requestDraw();
    }
  }

  viewportFrame() {
    const compact = this.width < 500;
    // The heading occupies the upper left; controls and the legend occupy the bottom.
    const left = compact ? 32 : clamp(this.width * 0.15, 64, 112);
    const right = compact ? 32 : 64;
    const top = compact ? 54 : clamp(this.height * 0.25, 70, 160);
    const bottom = compact ? 124 : clamp(this.height * 0.14, 56, 90);
    return { left, right, top, bottom };
  }

  viewportCenter() {
    const { left, right, top, bottom } = this.viewportFrame();
    return { x: (this.width + left - right) / 2, y: (this.height + top - bottom) / 2 };
  }

  reset() {
    if (this.destroyed) return;
    this.dismissPreview('layout');
    if (!this.width || !this.height) {
      this.initialized = false;
      return;
    }
    const bounds = this.fixedBounds || this.nodes.reduce((box, node) => ({
      left: Math.min(box.left, node.x), right: Math.max(box.right, node.x),
      top: Math.min(box.top, node.y), bottom: Math.max(box.bottom, node.y),
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    if (!this.nodes.length && !this.fixedBounds) Object.assign(bounds, { left: -450, right: 450, top: -300, bottom: 300 });
    const { left, right, top, bottom } = this.viewportFrame();
    const center = this.viewportCenter();
    const scale = Math.min(
      Math.max(50, this.width - left - right) / Math.max(240, bounds.right - bounds.left),
      Math.max(50, this.height - top - bottom) / Math.max(180, bounds.bottom - bounds.top),
      1.35,
    );
    this.scale = Math.max(0.000001, scale);
    this.baseScale = this.scale;
    this.pan = {
      x: center.x - (bounds.left + bounds.right) / 2 * this.scale,
      y: center.y - (bounds.top + bounds.bottom) / 2 * this.scale,
    };
    this.depthOrigin = { ...this.pan };
    this.initialized = true;
    this.onZoom(1);
    this.requestDraw(true);
  }

  zoomBy(factor, anchor = this.viewportCenter()) {
    if (this.destroyed || !Number.isFinite(factor) || factor <= 0) return;
    this.dismissPreview('layout');
    const next = clamp(this.scale * factor, this.baseScale * 0.4, this.baseScale * 64);
    const ratio = next / this.scale;
    this.pan.x = anchor.x - (anchor.x - this.pan.x) * ratio;
    this.pan.y = anchor.y - (anchor.y - this.pan.y) * ratio;
    this.scale = next;
    this.onZoom(this.scale / this.baseScale);
    this.requestDraw(true);
  }

  toggleMotion() {
    this.paused = !this.paused;
    this.animationUntil = 0;
    this.connectionPulse = null;
    this.requestDraw(!this.paused);
    return this.paused;
  }

  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  pointerDown(event) {
    if (!this.active || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = this.point(event);
    if (!this.pointers.size) {
      this.start = point;
      this.moved = false;
    } else { this.moved = true; this.dismissPreview('layout'); }
    this.pointers.set(event.pointerId, point);
    this.canvas.setPointerCapture(event.pointerId);
    this.canvas.focus({ preventScroll: true });
    this.canvas.style.cursor = 'grabbing';
  }

  pointerMove(event) {
    if (!this.active) return;
    const point = this.point(event);
    if (!this.pointers.has(event.pointerId)) {
      if (!this.pointers.size && event.pointerType !== 'touch') this.setHovered(this.hit(point)?.id || null);
      return;
    }
    const previous = this.pointers.get(event.pointerId);
    const oldPair = [...this.pointers.values()];
    this.pointers.set(event.pointerId, point);
    if (this.pointers.size > 1) {
      const newPair = [...this.pointers.values()];
      const center = pair => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
      const distance = pair => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const before = center(oldPair);
      const after = center(newPair);
      const ratio = distance(newPair) / Math.max(1, distance(oldPair));
      const next = clamp(this.scale * ratio, this.baseScale * 0.4, this.baseScale * 64);
      this.pan.x = after.x - (before.x - this.pan.x) * next / this.scale;
      this.pan.y = after.y - (before.y - this.pan.y) * next / this.scale;
      this.scale = next;
      this.moved = true;
      this.onZoom(this.scale / this.baseScale);
    } else {
      if (Math.hypot(point.x - this.start.x, point.y - this.start.y) > 5) this.moved = true;
      if (this.moved) {
        this.pan.x += point.x - previous.x;
        this.pan.y += point.y - previous.y;
      }
    }
    if (this.moved) this.dismissPreview('layout');
    this.requestDraw(true);
  }

  pointerUp(event) {
    if (!this.pointers.has(event.pointerId)) return;
    const point = this.point(event);
    const canSelect = this.pointers.size === 1 && !this.moved;
    this.pointers.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (canSelect) this.select(this.hit(point), 'hover');
    if (!this.pointers.size) {
      this.canvas.style.cursor = 'grab';
      this.setHovered(event.pointerType === 'mouse' && !this.moved ? this.hit(point)?.id || null : null, event.pointerType === 'touch');
    }
  }

  pointerCancel(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    this.moved = true;
    this.dismissPreview('layout');
    if (!this.pointers.size) this.canvas.style.cursor = 'grab';
  }

  keyDown(event) {
    if (!this.active || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['+', '=', '-', '_', '[', ']', 'Escape', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) event.preventDefault();
    else return;
    if (event.key === '+' || event.key === '=') this.zoomBy(1.25);
    else if (event.key === '-' || event.key === '_') this.zoomBy(0.8);
    else if (event.key === 'Home') this.reset();
    else if (event.key === 'Escape') { this.dismissPreview('dismiss'); this.requestDraw(); }
    else if (event.key === '[' || event.key === ']') this.cycleFocus(event.key === ']' ? 1 : -1);
    else if (event.key === 'Enter' || event.key === ' ') {
      this.updateScreen();
      const target = this.byId.get(this.hovered || this.keyboardId) || this.nearestCenter();
      this.select(target, 'keyboard');
    } else if (event.shiftKey) {
      const shifts = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] };
      const [x, y] = shifts[event.key];
      this.pan.x += x;
      this.pan.y += y;
      this.dismissPreview('layout');
      this.requestDraw(true);
    } else this.directionalFocus(event.key);
  }

  focusNode(node) {
    if (!node) return;
    this.keyboardId = node.id;
    this.hovered = null;
    this.emitPreview(node, 'keyboard');
    this.requestDraw();
  }

  focusCandidates() {
    this.updateScreen();
    return this.screen.filter(node => node.sx >= 8 && node.sx <= this.width - 8 && node.sy >= 8 && node.sy <= this.height - 8);
  }

  directionalFocus(key) {
    const current = this.byId.get(this.keyboardId || this.hovered) || this.nearestCenter();
    if (!current) return;
    const origin = this.anchor(current);
    const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    let next = null;
    let best = Infinity;
    for (let radius = 32; radius <= Math.max(this.width, this.height) * 4; radius *= 2) {
      const range = radius / this.scale;
      const candidates = this.spatial.query(current.x - range, current.y - range, current.x + range, current.y + range);
      for (const node of candidates) {
        const candidate = this.project(node); if (!candidate) continue;
        const x = candidate.sx - origin.x, y = candidate.sy - origin.y;
        const forward = x * dx + y * dy;
        if (candidate.id === current.id || forward < 1) continue;
        const sideways = Math.abs(x * dy - y * dx);
        const score = Math.hypot(x, y) + sideways * 2;
        if (score < best) { best = score; next = candidate; }
      }
      if (best <= radius) break;
    }
    this.focusNode(this.byId.get((next || current).id));
  }

  cycleFocus(direction) {
    const candidates = this.enabledFocus || [];
    if (!candidates.length) return;
    const current = candidates.findIndex(node => node.id === (this.keyboardId || this.hovered));
    const index = current < 0 ? (direction > 0 ? 0 : candidates.length - 1) : (current + direction + candidates.length) % candidates.length;
    const node = candidates[index], point = this.anchor(node);
    if (point.x < 8 || point.x > this.width - 8 || point.y < 8 || point.y > this.height - 8) {
      const center = this.viewportCenter(); this.pan = { x: center.x - node.x * this.scale, y: center.y - node.y * this.scale };
      this.dismissPreview('layout');
    }
    this.focusNode(node);
  }

  stepPreview(direction = 1) {
    if (!this.active || this.destroyed) return;
    this.cycleFocus(direction < 0 ? -1 : 1);
  }

  nearestCenter() {
    let nearest = null;
    let distance = Infinity;
    const center = this.viewportCenter();
    const x = (center.x - this.pan.x) / this.scale, y = (center.y - this.pan.y) / this.scale;
    for (let radius = 16; radius <= Math.max(this.width, this.height) * 4; radius *= 2) {
      const range = radius / this.scale;
      for (const value of this.spatial.query(x - range, y - range, x + range, y + range)) {
        const node = this.project(value); if (!node) continue;
        const candidate = (node.sx - center.x) ** 2 + (node.sy - center.y) ** 2;
        if (candidate < distance) { distance = candidate; nearest = node; }
      }
      if (distance <= radius * radius) break;
    }
    return nearest ? this.byId.get(nearest.id) : null;
  }

  hit(point) {
    // Opaque title cards are painted above dots, so their hit regions must win too.
    const label = this.labelBoxes.find(box => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
    if (label) return this.byId.get(label.id);
    let result = null;
    let closest = Infinity;
    const x = (point.x - this.pan.x) / this.scale, y = (point.y - this.pan.y) / this.scale, range = 26 / this.scale;
    for (const node of this.spatial.query(x - range, y - range, x + range, y + range)) {
      if (!this.nodeEnabled(node)) continue;
      const anchor = this.anchor(node), distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (distance <= Math.max(8, this.radius(node) + 4) && (distance < closest || (distance === closest && node.id < result.id))) { result = node; closest = distance; }
    }
    return result ? this.byId.get(result.id) : null;
  }

  setHovered(id, force = false) {
    if (id === this.hovered && !force) return;
    this.hovered = id;
    this.canvas.style.cursor = id ? 'pointer' : 'grab';
    this.emitPreview(this.byId.get(id) || null, 'hover');
    this.requestDraw();
  }

  select(node, reason = 'keyboard') {
    if (!node) { this.dismissPreview('dismiss'); this.requestDraw(); return; }
    this.selected = node.id;
    this.keyboardId = node.id;
    this.emitPreview(node, reason);
    this.startConnectionPulse(node.id);
    this.requestDraw(true);
    this.onSelect(node, this.anchor(node));
  }

  anchor(node) {
    return { x: node.x * this.scale + this.pan.x, y: node.y * this.scale + this.pan.y };
  }

  emitPreview(node, reason) {
    this.labelsDirty = true;
    this.previewId = node?.id || null;
    if (node) this.previewAnchor = this.anchor(node);
    if (this.active) this.onPreview(node, { ...this.previewAnchor }, reason);
  }

  dismissPreview(reason = 'layout') {
    this.connectionPulse = null;
    this.hovered = null;
    this.keyboardId = null;
    this.selected = null;
    this.labelBoxes = [];
    this.labelPlans = [];
    this.labelsDirty = true;
    this.exclusions = null;
    this.canvas.style.cursor = this.pointers.size ? 'grabbing' : 'grab';
    this.emitPreview(null, reason);
    if (this.active) this.onLabels([]);
  }

  startConnectionPulse(nodeId = null) {
    this.connectionPulse = null;
    if (!this.active || this.destroyed || document.hidden || this.paused || this.motion.matches || (!this.layers.relationships && !this.layers.inferred)) return;
    const edges = [];
    for (const edge of nodeId ? this.adjacency.get(nodeId) || [] : this.edges) {
      if (!this.edgeEnabled(edge) || !this.routeNodeEnabled(this.byId.get(edge.from)) || !this.routeNodeEnabled(this.byId.get(edge.to))) continue;
      edges.push(edge); if (edges.length === 72) break;
    }
    if (!edges.length) return;
    this.connectionPulse = { started: performance.now(), duration: 780, nodeId, edges };
    this.requestDraw();
  }

  depthPosition(point) {
    const center = this.viewportCenter();
    const zoomDepth = 1 + Math.log2(this.scale / this.baseScale) * point.depth * 0.055;
    const x = center.x + (point.u - 0.5) * this.width * zoomDepth + (this.pan.x - this.depthOrigin.x) * point.depth * 0.1;
    const y = center.y + (point.v - 0.5) * this.height * zoomDepth + (this.pan.y - this.depthOrigin.y) * point.depth * 0.1;
    return { x: ((x % this.width) + this.width) % this.width, y: ((y % this.height) + this.height) % this.height };
  }

  paintDepth(ctx) {
    this.depthLayers.forEach((points, layer) => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(156,151,181,${0.12 + layer * 0.035})`;
      for (const point of points) {
        const { x, y } = this.depthPosition(point);
        ctx.moveTo(x + point.radius, y);
        ctx.arc(x, y, point.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    });
  }

  paintConnectionPulse(ctx, points, time) {
    const pulse = this.connectionPulse;
    this.canvas.dataset.highlightedEdges = '0';
    if (!pulse || this.paused || this.motion.matches || !this.active || document.hidden) return false;
    const progress = (time - pulse.started) / pulse.duration;
    if (progress >= 1) { this.connectionPulse = null; return false; }
    const amount = Math.sin(Math.PI * clamp(progress, 0, 1));
    const visible = pulse.edges.filter(edge => points.has(edge.from) && points.has(edge.to));
    if (!visible.length) { this.connectionPulse = null; return false; }
    // Whole edges brighten together: no particles, arrows, travel or causal direction.
    for (const inferred of [false, true]) {
      ctx.beginPath();
      ctx.setLineDash(inferred ? [3, 5] : []);
      ctx.strokeStyle = inferred ? `rgba(216,153,118,${(amount * 0.25).toFixed(3)})` : `rgba(169,201,219,${(amount * 0.25).toFixed(3)})`;
      ctx.lineWidth = 0.8 + amount * 0.35;
      for (const edge of visible) if (Boolean(edge.inferred) === inferred) this.edgePath(ctx, points.get(edge.from), points.get(edge.to));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    this.canvas.dataset.highlightedEdges = String(visible.length);
    return true;
  }

  requestDraw(animate = false) {
    if (this.destroyed || !this.active || document.hidden || !this.ctx) return;
    if (animate && this.selected && !this.paused && !this.motion.matches) this.animationUntil = performance.now() + 700;
    if (this.frame === null) this.frame = requestAnimationFrame(time => {
      this.frame = null;
      this.draw(time);
    });
  }

  cancelFrame() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  chooseVisible() {
    return this.enabledNodes || [];
  }

  radius(node) { return clamp(node.size * Math.sqrt(this.scale / this.baseScale), 0.6, 18); }

  project(node, route = false) {
    if (!node || !(route ? this.routeNodeEnabled(node) : this.nodeEnabled(node))) return null;
    const x = node.x * this.scale + this.pan.x, y = node.y * this.scale + this.pan.y, radius = this.radius(node);
    if (x + radius < 0 || x - radius > this.width || y + radius < 0 || y - radius > this.height) return null;
    node.sx = x; node.sy = y; node.radius = radius; return node;
  }

  updateScreen() {
    const key = `${this.dataRevision}:${this.renderer.backend}:${this.layers.names}:${this.layers.regions}:${this.layers.inferred}:${this.layers.relationships}:${this.width}:${this.height}:${this.pan.x}:${this.pan.y}:${this.scale}`;
    if (key === this.screenKey) return;
    this.screenKey = key;
    this.visible = this.chooseVisible();
    if (this.renderer.backend === 'webgl') {
      Object.assign(this, this.renderer.countInView(this, this.layers));
      this.screenLabelOrder = { item: [], hub: [] };
      const points = new Map();
      for (const node of this.regionNodes) { const point = this.project(node); if (point) points.set(node.id, point); }
      for (const kind of ['item', 'hub']) {
        for (const node of this.labelOrder[kind].slice(0, 512)) {
          const point = this.project(node);
          if (point) { points.set(node.id, point); this.screenLabelOrder[kind].push(point); }
          if (this.screenLabelOrder[kind].length === 160) break;
        }
      }
      if (this.screenLabelOrder.item.length < 8) {
        const local = this.spatial.query(-this.pan.x / this.scale, -this.pan.y / this.scale, (this.width - this.pan.x) / this.scale, (this.height - this.pan.y) / this.scale);
        for (const node of local) if (node.kind === 'item' && !points.has(node.id)) {
          const point = this.project(node); if (point) { points.set(node.id, point); this.screenLabelOrder.item.push(point); }
          if (this.screenLabelOrder.item.length === 32) break;
        }
      }
      this.screenPoints = points; this.screen = [...points.values()];
      this.visibleEdges = []; this.displayedEdges = [];
      this.labelsDirty = true; return;
    }
    this.screen = this.spatial.query((-24 - this.pan.x) / this.scale, (-24 - this.pan.y) / this.scale, (this.width + 24 - this.pan.x) / this.scale, (this.height + 24 - this.pan.y) / this.scale).filter(node => this.nodeEnabled(node)).map(node => {
      node.sx = node.x * this.scale + this.pan.x; node.sy = node.y * this.scale + this.pan.y; node.radius = this.radius(node); return node;
    }).filter(node => node.sx + node.radius >= 0 && node.sx - node.radius <= this.width && node.sy + node.radius >= 0 && node.sy - node.radius <= this.height);
    this.screenPoints = new Map(this.screen.map(node => [node.id, node]));
    this.routePoints = new Map(this.screenPoints);
    if (this.layers.inferred && !this.layers.regions) for (const node of this.regionNodes) { const point = this.project(node, true); if (point) this.routePoints.set(node.id, point); }
    this.visibleEdges = this.edges.filter(edge => this.edgeEnabled(edge) && this.routePoints.has(edge.from) && this.routePoints.has(edge.to));
    this.displayedEdges = this.visibleEdges.filter(edge => edge.inferred ? this.layers.inferred : this.layers.relationships);
    this.inViewRecords = this.screen.filter(node => node.kind === 'item').length;
    this.inViewNames = this.screen.filter(node => node.kind === 'person').length;
    this.inViewCount = this.screen.length;
    this.screenLabelOrder = {};
    for (const kind of ['item', 'hub']) {
      const candidates = [];
      for (const node of this.labelOrder[kind]) if (this.screenPoints.has(node.id)) { candidates.push(node); if (candidates.length === 160) break; }
      this.screenLabelOrder[kind] = candidates;
    }
    this.labelsDirty = true;
  }

  draw(time) {
    if (!this.active || this.destroyed || document.hidden || !this.ctx || !this.width || !this.height) return;
    const start = performance.now();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.paintDepth(ctx);
    this.renderer.checkContext();
    this.updateScreen();
    const points = this.renderer.backend === 'webgl' ? new Map(this.screenPoints) : this.routePoints;
    const edges = this.visibleEdges;
    const emphasis = this.hovered || this.keyboardId || this.selected;
    const focusPoint = this.project(this.byId.get(emphasis)); if (focusPoint) points.set(emphasis, focusPoint);
    const selectedEdges = [];
    if (emphasis && (this.layers.relationships || this.layers.inferred)) for (const edge of this.adjacency.get(emphasis) || []) {
      if (!this.edgeEnabled(edge)) continue;
      const a = this.project(this.byId.get(edge.from), true), b = this.project(this.byId.get(edge.to), true);
      if (a && b) { points.set(a.id, a); points.set(b.id, b); selectedEdges.push(edge); }
      if (selectedEdges.length === 256) break;
    }
    if (this.connectionPulse) for (const edge of this.connectionPulse.edges) {
      const a = this.project(this.byId.get(edge.from), true), b = this.project(this.byId.get(edge.to), true);
      if (a && b) { points.set(a.id, a); points.set(b.id, b); }
    }
    if (this.layers.regions) this.paintRegions(ctx);
    ctx.lineCap = 'round';
    const displayedEdges = this.displayedEdges;
    if (this.renderer.backend !== 'webgl' && (this.layers.relationships || this.layers.inferred)) {
      for (const inferred of [false, true]) {
        ctx.beginPath();
        const opacity = routeOpacity(inferred, this.scale / this.baseScale);
        ctx.strokeStyle = inferred ? `rgba(216,153,118,${opacity})` : `rgba(169,201,219,${opacity})`;
        ctx.lineWidth = inferred ? 0.65 : 0.7;
        ctx.setLineDash(inferred ? [2, 5] : []);
        for (const edge of displayedEdges) {
          if (Boolean(edge.inferred) !== inferred) continue;
          this.edgePath(ctx, points.get(edge.from), points.get(edge.to));
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    const drawStats = this.renderer.draw(this, this.layers, this.screen);
    if (drawStats.backend === 'canvas2d') drawStats.submittedEdges = drawStats.drawnEdges = displayedEdges.length;
    if (emphasis) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(216,153,118,0.64)';
      ctx.lineWidth = 1.05;
      for (const edge of selectedEdges) if (!edge.inferred) this.edgePath(ctx, points.get(edge.from), points.get(edge.to));
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      for (const edge of selectedEdges) if (edge.inferred) this.edgePath(ctx, points.get(edge.from), points.get(edge.to));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const highlighting = this.paintConnectionPulse(ctx, points, time);
    const settling = !this.paused && !this.motion.matches && time < this.animationUntil;
    const settle = settling ? Math.sin((1 - (this.animationUntil - time) / 700) * Math.PI) : 0;
    const focus = points.get(emphasis);
    for (const node of focus ? [focus] : []) {
      const highlighted = true;
      const color = node.color || COLORS[node.kind];
      if (node.kind !== 'item' || highlighted) {
        const glowSize = node.radius * (highlighted ? 5 : 3.6) + settle * 3;
        const glow = ctx.createRadialGradient(node.sx, node.sy, 0, node.sx, node.sy, glowSize);
        glow.addColorStop(0, highlighted ? 'rgba(216,153,118,0.26)' : 'rgba(169,201,219,0.13)');
        glow.addColorStop(1, 'rgba(169,201,219,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = node.kind === 'item' && !highlighted ? 0.78 : 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (node.kind !== 'item' || highlighted) {
        ctx.strokeStyle = highlighted ? '#f0cfba' : 'rgba(216,153,118,0.48)';
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, node.radius + 4 + settle, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (this.labelsDirty) {
      this.previousLabelBoxes = new Map(this.labelBoxes.map(box => [box.id, box]));
      this.labelBoxes = [];
      this.labelPlans = [];
      const compact = this.width < 500;
      if (points.has(emphasis)) this.placeLabel(ctx, points.get(emphasis), true);
      // Regions explain the field independently of optional record/name labels or route lines.
      if (this.layers.regions) for (const node of this.regionNodes) if (node.id !== emphasis && points.has(node.id)) this.placeLabel(ctx, points.get(node.id), false);
      const hubs = this.layers.labels ? this.screenLabelOrder.hub.filter(node => node.kind !== 'hub' && node.id !== emphasis) : [];
      const items = this.layers.labels ? this.screenLabelOrder.item.filter(node => node.id !== emphasis) : [];
      // Give both records and source labels space, including results with no people.
      let itemCount = 0, hubCount = 0;
      while ((itemCount < (compact ? 2 : 4) && items.length) || (hubCount < (compact ? 2 : 4) && hubs.length)) {
        if (itemCount < (compact ? 2 : 4) && items.length && this.placeLabel(ctx, points.get(items.shift().id), false)) itemCount++;
        if (hubCount < (compact ? 2 : 4) && hubs.length && this.placeLabel(ctx, points.get(hubs.shift().id), false)) hubCount++;
      }
      this.labelsDirty = false;
      this.onLabels(this.labelBoxes.map(box => ({ ...box })));
    }
    for (const plan of this.labelPlans) this.paintLabel(ctx, plan);
    if (document.activeElement === this.canvas) this.drawCrosshair(ctx);
    drawStats.visibleEdges = this.renderer.backend === 'webgl' ? null : displayedEdges.length;
    drawStats.selectedEdges = selectedEdges.length;
    drawStats.drawnEdges += selectedEdges.length + Number(this.canvas.dataset.highlightedEdges || 0);
    this.publishStatus(drawStats);
    this.canvas.dataset.frameMs = (performance.now() - start).toFixed(2);
    this.canvas.dataset.renderRevision = String((Number(this.canvas.dataset.renderRevision) || 0) + 1);
    if (settling || highlighting) this.requestDraw();
  }

  publishStatus(drawStats) {
    const available = drawStats.backend !== 'unavailable';
    const status = { visibleNodes: available ? this.inViewCount || 0 : 0, totalNodes: this.nodes.length,
      visibleEdges: drawStats.visibleEdges || 0, recordCount: this.recordCount || 0, nameCount: this.nameCount || 0,
      selectedRecords: this.regionSelection?.size || 0, regionId: this.regionSelectionMeta.id || '', regionLabel: this.regionSelectionMeta.label || '', regionMemberTotal: this.regionSelectionMeta.total || 0,
      inViewRecords: available ? this.inViewRecords || 0 : 0, inViewNames: available ? this.inViewNames || 0 : 0, ...drawStats };
    const statusKey = JSON.stringify(status);
    if (statusKey !== this.lastStatus) { this.lastStatus = statusKey; this.onStatus(status); }
    for (const [key, value] of Object.entries(status)) this.canvas.dataset[key] = String(value);
    this.canvas.dataset.graphUnavailable = String(!available);
    this.available = available;
  }

  paintRegions(ctx) {
    for (const region of this.regions) {
      if (region.count === 0) continue;
      if (![region.x, region.y, region.radiusX, region.radiusY].every(Number.isFinite)) continue;
      const anchor = this.anchor(region);
      const selected = this.regionSelectionMeta.id === region.id || this.regionSelectionMeta.id === region.themeId;
      // A small fixed number of overlapping illustrative bands, never derived record membership.
      for (const band of [1, 0.94, 0.88]) {
        ctx.beginPath(); ctx.ellipse(anchor.x, anchor.y, Math.abs(region.radiusX * this.scale * band), Math.abs(region.radiusY * this.scale * band), 0, 0, Math.PI * 2);
        ctx.fillStyle = regionRGBA(region.color, selected ? 0.025 : 0.013); ctx.fill();
        ctx.strokeStyle = regionRGBA(region.color, band === 1 ? selected ? 0.58 : 0.25 : 0.05); ctx.lineWidth = selected && band === 1 ? 1.5 : 1; ctx.setLineDash(band === 1 ? [4, 7] : []); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  edgePath(ctx, a, b) {
    const bend = ((a.seed ^ b.seed) % 17 - 8) * 0.0035;
    ctx.moveTo(a.sx, a.sy);
    ctx.quadraticCurveTo((a.sx + b.sx) / 2 + (b.sy - a.sy) * bend, (a.sy + b.sy) / 2 - (b.sx - a.sx) * bend, b.sx, b.sy);
  }

  labelExclusions() {
    if (this.exclusions) return this.exclusions;
    const canvas = this.canvas.getBoundingClientRect();
    const elements = this.canvas.parentElement?.querySelectorAll?.('.graph-intro, .graph-controls, .theme-control, .region-controls, .region-bar, .graph-bottom, .graph-instructions, .preview-navigation, .map-layers') || [];
    this.exclusions = [...elements].map(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left - canvas.left - 6, y: rect.top - canvas.top - 6, width: rect.width + 12, height: rect.height + 12 };
    }).filter(box => box.width > 12 && box.height > 12 && box.y + box.height > 0 && box.y < this.height);
    if (!this.exclusions.length) {
      const compact = this.width < 500;
      this.exclusions = [
        { x: 0, y: 0, width: compact ? this.width : Math.min(310, this.width * 0.5), height: compact ? 42 : Math.min(150, this.height * 0.27) },
        { x: 0, y: this.height - (compact ? 112 : 54), width: this.width, height: compact ? 112 : 54 },
      ];
    }
    return this.exclusions;
  }

  overlaps(a, b, gap = 6) {
    return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
  }

  fitText(ctx, value, maximum) {
    let text = String(value || '').slice(0, 240);
    if (ctx.measureText(text).width <= maximum) return text;
    while (text.length && ctx.measureText(`${text}…`).width > maximum) text = text.slice(0, -1);
    return `${text.trimEnd()}…`;
  }

  titleLines(ctx, title, maximum) {
    const words = String(title).slice(0, 240).trim().split(/\s+/);
    let first = '';
    while (words.length && ctx.measureText(first ? `${first} ${words[0]}` : words[0]).width <= maximum) first += `${first ? ' ' : ''}${words.shift()}`;
    if (!first) return [this.fitText(ctx, words.shift() || '', maximum), ...(words.length ? [this.fitText(ctx, words.join(' '), maximum)] : [])];
    return [first, ...(words.length ? [this.fitText(ctx, words.join(' '), maximum)] : [])];
  }

  placeLabel(ctx, node, highlighted) {
    const compact = this.width < 500;
    const maximum = Math.min(compact ? 154 : 214, this.width - 36);
    const font = `500 ${compact ? 12 : 13}px system-ui, sans-serif`;
    ctx.font = font;
    const lines = this.titleLines(ctx, node.label, maximum);
    const count = node.kind !== 'item' && node.count != null ? `${new Intl.NumberFormat().format(finite(node.count))} records` : '';
    const meta = node.metaLabel || [node.typeLabel, node.collectionLabel].filter(Boolean).join(' · ');
    const sublabel = count ? [count, meta].filter(Boolean).join(' · ') : meta || (node.kind === 'item' ? 'Record' : node.kind === 'person' ? 'Source name label' : 'Theme');
    const titleWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    ctx.font = '11px system-ui, sans-serif';
    const sub = this.fitText(ctx, sublabel, maximum);
    const width = Math.min(maximum, Math.max(titleWidth, ctx.measureText(sub).width)) + 16;
    const height = lines.length * 16 + 25;
    const outward = node.sx < this.viewportCenter().x ? -1 : 1;
    const candidates = [];
    const previous = this.previousLabelBoxes?.get(node.id);
    if (highlighted && previous?.width === width && previous?.height === height) candidates.push({ ...previous });
    for (const distance of [node.radius + 12, 42, 76, 112]) {
      for (const [dx, dy] of [[outward, 0], [0, 1], [0, -1], [-outward, 0], [outward, 1], [outward, -1], [-outward, 1], [-outward, -1]]) {
        candidates.push({ id: node.id, x: node.sx + dx * distance - (dx < 0 ? width : dx === 0 ? width / 2 : 0), y: node.sy + dy * distance - (dy < 0 ? height : dy === 0 ? height / 2 : 0), width, height });
      }
    }
    const valid = box => box.x >= 8 && box.y >= 8 && box.x + box.width <= this.width - 8 && box.y + box.height <= this.height - 8 && !this.labelExclusions().some(other => this.overlaps(box, other, 3)) && !this.labelBoxes.some(other => this.overlaps(box, other));
    let box = candidates.find(valid);
    if (!box && highlighted) {
      // Selected records retain their title even when controls leave very little space.
      for (let y = 12; y + height < this.height - 8 && !box; y += 24) for (let x = 12; x + width < this.width - 8; x += 32) {
        const candidate = { id: node.id, x, y, width, height };
        if (valid(candidate)) { box = candidate; break; }
      }
    }
    if (!box) return false;
    this.labelBoxes.push(box);
    this.labelPlans.push({ node, highlighted, box, lines, sub, font });
    return true;
  }

  paintLabel(ctx, { node, highlighted, box, lines, sub, font }) {
    ctx.beginPath();
    ctx.moveTo(node.sx, node.sy);
    ctx.lineTo(clamp(node.sx, box.x + 4, box.x + box.width - 4), clamp(node.sy, box.y + 4, box.y + box.height - 4));
    ctx.strokeStyle = highlighted ? 'rgba(216,153,118,0.8)' : 'rgba(169,201,219,0.38)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = highlighted ? 'rgba(14,16,30,0.97)' : 'rgba(14,16,30,0.91)';
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = font;
    ctx.fillStyle = highlighted ? '#f5e0d1' : '#d9d7e6';
    lines.forEach((line, i) => ctx.fillText(line, box.x + 8, box.y + 16 + i * 16));
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = node.kind === 'hub' ? node.color || '#d89976' : node.kind === 'item' ? '#a9c9db' : '#d89976';
    ctx.fillText(sub, box.x + 8, box.y + 16 + lines.length * 16);
  }

  drawCrosshair(ctx) {
    const { x, y } = this.viewportCenter();
    ctx.strokeStyle = 'rgba(240,207,186,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 10, y); ctx.lineTo(x - 4, y);
    ctx.moveTo(x + 4, y); ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 4);
    ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 10);
    ctx.stroke();
  }

  destroy() {
    if (this.destroyed) return;
    this.dismissPreview('dismiss');
    this.destroyed = true;
    this.active = false;
    this.cancelFrame();
    this.abort.abort();
    this.resize.disconnect();
    this.renderer.destroy();
    this.pointers.clear();
    this.nodes = [];
    this.edges = [];
    this.screen = [];
    this.byId.clear();
    this.adjacency.clear();
    this.spatial = new SpatialGrid();
    this.focusOrder = []; this.labelOrder = { item: [], hub: [] };
    this.regionNodes = []; this.regions = []; this.regionSelection = null; this.regionSelectionMeta = {};
  }
}
