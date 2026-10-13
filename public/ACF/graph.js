import { SpatialGrid } from './graph-spatial.js?v=comparison-20261012';
import { GraphRenderer, routeOpacity } from './graph-renderer.js?v=comparison-20261012';
import { ROUTE_STYLES, routeStyle, routePointAt } from './route-style.js?v=comparison-20261012';
import { buildTerritory } from './territory-geometry.js?v=comparison-20261012';
import { comparisonLayout } from './comparison-layout.js?v=comparison-20261012';

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
    this.territoryReveal = null;
    this.selectionReveal = null;
    this.cameraFlight = null;
    this.comparison = null;
    this.comparisonRestore = null;
    this.flowTime = 0;
    this.flowClock = null;
    this.lastDrawTime = -Infinity;
    this.flowOnly = false;
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
    canvas.addEventListener('dragstart', event => event.preventDefault(), { signal });
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
      if (document.hidden) { this.advanceComparison(Infinity); this.dismissPreview('layout'); this.animationUntil = 0; this.territoryReveal = null; this.flowClock = null; this.cancelFrame(); }
      else this.requestDraw();
    }, { signal });
    this.motion.addEventListener('change', () => {
      if (this.motion.matches) this.advanceCamera(Infinity);
      if (this.motion.matches) this.advanceComparison(Infinity);
      this.animationUntil = 0;
      this.connectionPulse = null;
      this.territoryReveal = null;
      this.selectionReveal = null;
      this.flowClock = null;
      if (!this.motion.matches && this.renderer.backend === 'webgl') this.startConnectionPulse(this.selected);
      this.requestDraw();
    }, { signal });
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  setData({ nodes = [], edges = [], regions = [], bounds = null } = {}) {
    if (this.destroyed) return;
    this.comparison = null; this.comparisonRestore = null;
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
    this.edgeSourceMap = new Map();
    this.edges = edges.filter(edge => edge && this.byId.has(String(edge.from)) && this.byId.has(String(edge.to)))
      .map(edge => { const normalized = { ...edge, from: String(edge.from), to: String(edge.to) }; this.edgeSourceMap.set(edge, normalized); return normalized; });
    this.regions = regions.map((region, i) => ({ ...region, color: REGION_COLORS[i % REGION_COLORS.length], members: new Set(region.memberIds || []), territory: buildTerritory(region, this.byId) }));
    this.territoryReveal = null;
    this.selectionReveal = null;
    this.canvas.dataset.territoryCount = String(this.regions.filter(region => region.territory).length);
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

  effectiveLayers() { return this.comparison ? { names: true, labels: true, regions: true, relationships: true, inferred: true } : this.layers; }
  nodeEnabled(node) { return Boolean(node) && (this.comparison ? this.comparison.layout.visible.has(node.id) : node.kind === 'item' || (node.kind === 'person' ? this.layers.names : this.layers.regions)); }
  routeNodeEnabled(node) { return this.nodeEnabled(node); }
  edgeEnabled(edge) { return this.comparison ? this.comparison.edgeSet.has(edge) : edge.inferred ? this.layers.inferred : this.layers.relationships; }

  displayPosition(node) {
    const point = node?.id && this.comparison?.points.get(node.id);
    if (!point) return node;
    const progress = this.comparison.progress;
    return { x: point.from.x + (point.to.x - point.from.x) * progress, y: point.from.y + (point.to.y - point.from.y) * progress };
  }

  querySpatial(left, top, right, bottom) {
    if (!this.comparison) return this.spatial.query(left, top, right, bottom);
    if (this.comparison.spatial) return this.comparison.spatial.query(left, top, right, bottom).map(node => this.byId.get(node.id));
    return this.comparison.pickNodes.filter(node => { const point = this.displayPosition(node); return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom; });
  }

  setComparison(config) {
    if (this.destroyed || (!config && !this.comparison) || (config && !this.comparison?.exiting && this.comparison?.key === config.key)) return;
    if (config && !this.comparisonRestore) this.comparisonRestore = { scale: this.scale, pan: { ...this.pan }, baseScale: this.baseScale, center: this.viewportCenter() };
    // UI comparison controls can resize the stage before ResizeObserver fires.
    // Read its dimensions now, retaining the current camera as the animation's start.
    const rect = this.canvas.getBoundingClientRect(), width = Math.round(rect.width), height = Math.round(rect.height);
    if (width > 0 && height > 0 && (width !== this.width || height !== this.height)) {
      const oldCenter = this.viewportCenter();
      this.width = width; this.height = height;
      this.canvas.width = Math.round(width * this.dpr); this.canvas.height = Math.round(height * this.dpr); this.exclusions = null;
      this.resizeComparisonRestore(oldCenter);
    }
    this.advanceComparison(performance.now());
    if (!config && !this.comparison) return;
    const previous = this.comparison;
    const edgeSet = new Set(this.edges);
    const normalized = config && { ...config, edges: config.edges.map(edge => this.edgeSourceMap.get(edge) || (edgeSet.has(edge) ? edge : null)).filter(Boolean) };
    const layout = config ? comparisonLayout(normalized, this.byId, this.width < 650) : previous.layout;
    if (config && !layout.visible.size) return;
    const points = new Map(), progress = previous?.progress || 0;
    for (const node of this.nodes) {
      const prior = previous?.points.get(node.id), position = this.displayPosition(node);
      const normalVisible = node.kind === 'item' || (node.kind === 'person' ? this.layers.names : this.layers.regions);
      const from = prior ? { ...position, color: this.mixColor(prior.from.color, prior.to.color, progress), opacity: prior.from.opacity + (prior.to.opacity - prior.from.opacity) * progress } : { x: node.x, y: node.y, color: node.color || COLORS[node.kind], opacity: normalVisible ? 1 : 0 };
      const to = config ? layout.targets.get(node.id) || { x: node.x, y: node.y, color: node.color || COLORS[node.kind], opacity: node.kind === 'item' ? 0.018 : 0 } : { x: node.x, y: node.y, color: node.color || COLORS[node.kind], opacity: normalVisible ? 1 : 0 };
      points.set(node.id, { from, to });
    }
    if (!this.comparisonRestore) this.comparisonRestore = { scale: this.scale, pan: { ...this.pan }, baseScale: this.baseScale, center: this.viewportCenter() };
    const frame = this.viewportFrame(), center = this.viewportCenter(), bounds = layout.bounds;
    const fit = Math.min(Math.max(50, this.width - frame.left - frame.right) / (bounds.right - bounds.left), Math.max(50, this.height - frame.top - frame.bottom) / (bounds.bottom - bounds.top));
    const targetCamera = config ? { scale: fit, pan: { x: center.x, y: center.y } } : this.comparisonRestore;
    const edges = config ? layout.edges : previous.edges;
    const regions = config ? [config.left, config.right].map(region => {
      const hubId = this.byId.has(region.id) ? region.id : `@theme:${region.id}`, hub = layout.targets.get(hubId) || { x: 0, y: 0 };
      const targetNodes = new Map([...layout.targets].map(([id, point]) => [id, { ...this.byId.get(id), ...point }]));
      return { ...region, id: hubId, themeId: region.id, ...hub, members: new Set(region.memberIds), territory: buildTerritory(region, targetNodes) };
    }) : previous.regions;
    this.dismissPreview('layout'); this.territoryReveal = null;
    this.comparison = { key: config?.key || previous.key, config: config || previous.config, layout, points, edges, edgeSet: new Set(edges), regions, pickNodes: [...layout.visible].map(id => this.byId.get(id)), labelOrder: { item: this.labelOrder.item.filter(node => layout.visible.has(node.id)), hub: this.labelOrder.hub.filter(node => layout.visible.has(node.id)) }, started: performance.now(), duration: 800, progress: 0, exiting: !config, fromCamera: { scale: this.scale, pan: { ...this.pan } }, targetCamera, cameraFollowing: true, spatial: null };
    this.renderer.setComparison({ points, edges, exiting: !config });
    this.enabledNodes = this.nodes.filter(node => this.nodeEnabled(node)); this.enabledFocus = this.focusOrder.filter(node => this.nodeEnabled(node));
    this.screenKey = ''; this.flowClock = null;
    if (!this.active || document.hidden || this.paused || this.motion.matches || !this.ctx) this.advanceComparison(Infinity);
    this.requestDraw();
  }

  mixColor(a, b, fraction) {
    const channel = (color, offset) => parseInt((color || '#a9c9db').slice(offset, offset + 2), 16);
    return '#' + [1, 3, 5].map(offset => Math.round(channel(a, offset) + (channel(b, offset) - channel(a, offset)) * fraction).toString(16).padStart(2, '0')).join('');
  }

  resizeComparisonRestore(oldCenter) {
    const restore = this.comparisonRestore;
    if (!restore) return;
    const origin = restore.center || oldCenter;
    const world = { x: (origin.x - restore.pan.x) / restore.scale, y: (origin.y - restore.pan.y) / restore.scale }, zoom = restore.scale / restore.baseScale;
    const bounds = this.fixedBounds || this.nodes.reduce((box, node) => ({ left: Math.min(box.left, node.x), right: Math.max(box.right, node.x), top: Math.min(box.top, node.y), bottom: Math.max(box.bottom, node.y) }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    const frame = this.viewportFrame(), center = this.viewportCenter();
    const base = Math.max(0.000001, Math.min(Math.max(50, this.width - frame.left - frame.right) / Math.max(240, bounds.right - bounds.left), Math.max(50, this.height - frame.top - frame.bottom) / Math.max(180, bounds.bottom - bounds.top), 1.35));
    this.baseScale = base; restore.baseScale = base; restore.scale = base * zoom;
    restore.pan = { x: center.x - world.x * restore.scale, y: center.y - world.y * restore.scale };
    restore.center = center;
  }

  advanceComparison(time) {
    const view = this.comparison;
    if (!view || view.progress === 1) return false;
    const progress = clamp((time - view.started) / view.duration, 0, 1), eased = progress * progress * (3 - 2 * progress);
    view.progress = eased; this.renderer.comparisonProgress = eased;
    if (view.cameraFollowing) {
      this.scale = Math.exp(Math.log(view.fromCamera.scale) + Math.log(view.targetCamera.scale / view.fromCamera.scale) * eased);
      for (const axis of ['x', 'y']) this.pan[axis] = view.fromCamera.pan[axis] + (view.targetCamera.pan[axis] - view.fromCamera.pan[axis]) * eased;
      this.onZoom(this.scale / this.baseScale);
    }
    this.screenKey = ''; this.labelsDirty = true;
    if (progress < 1) return true;
    if (view.exiting) {
      this.comparison = null; this.comparisonRestore = null; this.renderer.setComparison(null);
      this.enabledNodes = this.nodes.filter(node => this.nodeEnabled(node)); this.enabledFocus = this.focusOrder.filter(node => this.nodeEnabled(node));
      this.startTerritoryReveal();
    } else view.spatial = new SpatialGrid(view.pickNodes.map(node => ({ id: node.id, ...this.displayPosition(node) })));
    return false;
  }

  setRegionSelection(memberIds, { id = '', label = '', total = memberIds?.size || 0 } = {}) {
    if (this.destroyed) return;
    const selection = memberIds == null ? null : new Set([...memberIds].map(String).filter(value => this.byId.get(value)?.kind === 'item'));
    const same = selection === null ? this.regionSelection === null : this.regionSelection !== null && selection.size === this.regionSelection.size && [...selection].every(value => this.regionSelection.has(value));
    const previousRegion = this.regionSelectionMeta.id;
    this.regionSelectionMeta = selection === null ? {} : { id: String(id), label: String(label), total: Math.max(selection.size, finite(total, selection.size)) };
    if (!same) { this.regionSelection = selection; this.renderer.setRegionSelection(selection); }
    if (!same || previousRegion !== this.regionSelectionMeta.id) this.startTerritoryReveal(selection === null ? null : String(id));
    this.labelsDirty = true;
    this.requestDraw();
    if (!this.ctx) this.publishStatus({ backend: 'unavailable', submittedRecords: 0, submittedNames: 0, drawnPoints: 0, submittedEdges: 0, drawnEdges: 0 });
  }

  setLayers(layers = {}) {
    const regionsVisible = this.layers.regions;
    let changed = false;
    for (const key of Object.keys(this.layers)) if (typeof layers[key] === 'boolean' && layers[key] !== this.layers[key]) { this.layers[key] = layers[key]; changed = true; }
    if (!changed || this.destroyed) return;
    this.enabledNodes = this.nodes.filter(node => this.nodeEnabled(node));
    this.enabledFocus = this.focusOrder.filter(node => this.nodeEnabled(node));
    this.screenKey = '';
    this.dismissPreview('layout');
    this.startConnectionPulse();
    if (!this.layers.regions) this.territoryReveal = null;
    else if (!regionsVisible) this.startTerritoryReveal();
    this.requestDraw();
  }

  focusRecord(id) {
    const node = this.byId.get(String(id));
    if (!node || this.destroyed) return false;
    if (!this.comparison && node.kind === 'person' && !this.layers.names) this.setLayers({ names: true });
    if (!this.comparison && node.kind === 'hub' && !this.layers.regions) this.setLayers({ regions: true });
    this.dismissPreview('layout');
    this.select(node, 'keyboard', Math.max(this.scale, this.baseScale * 5));
    return true;
  }

  setPerspective(ratio) {
    if (this.destroyed || !Number.isFinite(ratio) || ratio <= 0) return false;
    let node = this.byId.get(this.selected);
    if (!node || !this.nodeEnabled(node)) {
      node = null;
      const center = this.viewportCenter();
      const x = (center.x - this.pan.x) / this.scale, y = (center.y - this.pan.y) / this.scale;
      let distance = Infinity;
      // An explicit perspective change must find a record even after the camera
      // has been panned outside the cloud. Screen projection would discard it.
      for (const candidate of this.nodes) {
        if (candidate.kind !== 'item' || !this.nodeEnabled(candidate)) continue;
        const position = this.displayPosition(candidate), next = Math.hypot(position.x - x, position.y - y);
        if (next < distance) { node = candidate; distance = next; }
      }
    }
    if (!node) return false;
    this.select(node, 'keyboard', this.baseScale * clamp(ratio, 0.4, 64));
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
      if (!wasActive) { this.startConnectionPulse(); this.startTerritoryReveal(); }
      this.requestDraw(true);
    } else {
      this.advanceComparison(Infinity);
      this.cancelFrame();
      this.animationUntil = 0;
      this.territoryReveal = null;
      this.flowClock = null;
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
    if (this.comparison?.exiting) { this.resizeComparisonRestore(oldCenter); this.advanceComparison(Infinity); this.requestDraw(); return; }
    const comparisonConfig = this.comparison && !this.comparison.exiting ? this.comparison.config : null;
    if (comparisonConfig) {
      this.resizeComparisonRestore(oldCenter);
      this.comparison.key = '';
      this.setComparison(comparisonConfig);
      return;
    }
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
    if (this.comparison && !this.comparison.exiting) {
      const config = this.comparison.config; this.comparison.key = ''; this.setComparison(config); return;
    }
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
    if (this.comparison) this.comparison.cameraFollowing = false;
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
    if (this.paused) this.advanceCamera(Infinity);
    if (this.paused) this.advanceComparison(Infinity);
    this.animationUntil = 0;
    this.connectionPulse = null;
    this.territoryReveal = null;
    this.selectionReveal = null;
    this.flowClock = null;
    if (!this.paused && this.renderer.backend === 'webgl') this.startConnectionPulse(this.selected);
    this.requestDraw(!this.paused);
    return this.paused;
  }

  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  pointerDown(event, { panOnly = false } = {}) {
    if (!this.active || event.button !== 0) return;
    event.preventDefault();
    this.cameraFlight = null;
    if (this.comparison) this.comparison.cameraFollowing = false;
    const point = this.point(event);
    if (!this.pointers.size) {
      this.start = point;
      this.panOnly = panOnly;
      this.pressTarget = panOnly ? null : this.hit(point)?.id || null;
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
    event.preventDefault();
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
      const origin = this.moved ? previous : this.start;
      if (Math.hypot(point.x - this.start.x, point.y - this.start.y) > 5) this.moved = true;
      if (!this.moved) return;
      this.pan.x += point.x - origin.x;
      this.pan.y += point.y - origin.y;
    }
    if (this.moved) this.dismissPreview('layout');
    this.requestDraw(true);
  }

  pointerUp(event) {
    if (!this.pointers.has(event.pointerId)) return;
    event.preventDefault();
    // A quick drag may deliver its final position only on release.
    this.pointerMove(event);
    const canSelect = this.pointers.size === 1 && !this.moved && !this.panOnly;
    this.pointers.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (canSelect) this.select(this.byId.get(this.pressTarget), 'hover');
    if (!this.pointers.size) {
      this.pressTarget = null;
      this.canvas.style.cursor = 'grab';
      // Selection moves the camera: the old pointer position no longer identifies
      // the selected star. Keep its new preview anchor until the pointer moves.
      if (!canSelect) this.setHovered(null, event.pointerType === 'touch');
    }
  }

  pointerCancel(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.moved = true;
    this.dismissPreview('layout');
    if (!this.pointers.size) { this.pressTarget = null; this.canvas.style.cursor = 'grab'; }
    this.requestDraw();
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
    if (this.cameraFlight?.nodeId === node.id) return;
    this.cameraFlight = null;
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
      const currentPosition = this.displayPosition(current), candidates = this.querySpatial(currentPosition.x - range, currentPosition.y - range, currentPosition.x + range, currentPosition.y + range);
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
      const center = this.viewportCenter(), position = this.displayPosition(node); this.pan = { x: center.x - position.x * this.scale, y: center.y - position.y * this.scale };
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
      for (const value of this.querySpatial(x - range, y - range, x + range, y + range)) {
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
    for (const node of this.querySpatial(x - range, y - range, x + range, y + range)) {
      if (!this.nodeEnabled(node)) continue;
      const anchor = this.anchor(node), distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
      if (distance <= Math.max(8, this.radius(node) + 4) && (distance < closest || (distance === closest && node.id < result.id))) { result = node; closest = distance; }
    }
    return result ? this.byId.get(result.id) : null;
  }

  setHovered(id, force = false) {
    if (this.cameraFlight) return;
    if (id === this.hovered && !force) return;
    this.hovered = id;
    this.canvas.style.cursor = id ? 'pointer' : 'grab';
    this.emitPreview(this.byId.get(id) || null, 'hover');
    this.requestDraw();
  }

  select(node, reason = 'keyboard', targetScale = this.scale) {
    if (!node) { this.dismissPreview('dismiss'); this.requestDraw(); return; }
    if (this.comparison) { this.advanceComparison(performance.now()); if (this.comparison) this.comparison.cameraFollowing = false; }
    const center = this.viewportCenter();
    this.cameraFlight = null;
    this.selectionReveal = null;
    this.hovered = null;
    this.labelBoxes = [];
    this.labelPlans = [];
    this.exclusions = null;
    this.selected = node.id;
    this.keyboardId = node.id;
    const position = this.comparison && this.comparison.progress < 1 ? this.comparison.points.get(node.id)?.to || this.displayPosition(node) : this.displayPosition(node);
    const target = { scale: targetScale, pan: { x: center.x - position.x * targetScale, y: center.y - position.y * targetScale } };
    const distance = Math.hypot(target.pan.x - this.pan.x, target.pan.y - this.pan.y);
    if (this.active && this.ctx && !document.hidden && !this.paused && !this.motion.matches && (distance > 0.5 || Math.abs(targetScale - this.scale) > 1e-8)) {
      // Delay the card until arrival: its hit area must not slide under a user's pointer.
      this.emitPreview(null, 'layout');
      const layoutRemaining = this.comparison && this.comparison.progress < 1 ? this.comparison.started + this.comparison.duration - performance.now() : 0;
      this.cameraFlight = { started: performance.now(), duration: Math.max(600, layoutRemaining), fromScale: this.scale, fromPan: { ...this.pan }, target, nodeId: node.id, reason };
      this.requestDraw(true);
      return;
    }
    this.scale = target.scale;
    this.pan = target.pan;
    this.onZoom(this.scale / this.baseScale);
    this.finishSelection(node, reason);
  }

  finishSelection(node, reason) {
    this.emitPreview(node, reason);
    this.startConnectionPulse(node.id);
    this.startTerritoryReveal(node.id);
    this.selectionReveal = this.active && !document.hidden && !this.paused && !this.motion.matches ? { nodeId: node.id, started: performance.now(), duration: 620 } : null;
    this.requestDraw(true);
    this.onSelect(node, this.anchor(node));
  }

  advanceCamera(time) {
    const flight = this.cameraFlight;
    if (!flight) return false;
    const progress = clamp((time - flight.started) / flight.duration, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    const center = this.viewportCenter();
    this.scale = Math.exp(Math.log(flight.fromScale) + Math.log(flight.target.scale / flight.fromScale) * eased);
    // Interpolate world center and logarithmic zoom together to avoid a curved overshoot.
    for (const axis of ['x', 'y']) {
      const from = (center[axis] - flight.fromPan[axis]) / flight.fromScale;
      const to = (center[axis] - flight.target.pan[axis]) / flight.target.scale;
      this.pan[axis] = center[axis] - (from + (to - from) * eased) * this.scale;
    }
    this.onZoom(this.scale / this.baseScale);
    if (progress < 1) return true;
    this.scale = flight.target.scale;
    this.pan = flight.target.pan;
    this.cameraFlight = null;
    const node = this.byId.get(flight.nodeId);
    if (node && this.selected === node.id) this.finishSelection(node, flight.reason);
    return false;
  }

  anchor(node) {
    const point = this.displayPosition(node);
    return { x: point.x * this.scale + this.pan.x, y: point.y * this.scale + this.pan.y };
  }

  emitPreview(node, reason) {
    this.labelsDirty = true;
    this.previewId = node?.id || null;
    if (node) this.previewAnchor = this.anchor(node);
    if (this.active) this.onPreview(node, { ...this.previewAnchor }, reason);
  }

  dismissPreview(reason = 'layout') {
    this.cameraFlight = null;
    this.connectionPulse = null;
    this.selectionReveal = null;
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
    const layers = this.effectiveLayers();
    if (!nodeId || !this.active || this.destroyed || document.hidden || this.paused || this.motion.matches || (!layers.relationships && !layers.inferred)) return;
    const edges = [];
    for (const edge of nodeId ? this.adjacency.get(nodeId) || [] : this.edges) {
      if (!this.edgeEnabled(edge) || !this.routeNodeEnabled(this.byId.get(edge.from)) || !this.routeNodeEnabled(this.byId.get(edge.to))) continue;
      edges.push(edge); if (edges.length === 12) break;
    }
    if (!edges.length) return;
    this.connectionPulse = { started: performance.now(), duration: 2600, nodeId, edges };
    this.requestDraw();
  }

  startTerritoryReveal(nodeId = null) {
    this.territoryReveal = null;
    if (this.comparison || !this.active || this.destroyed || document.hidden || this.paused || this.motion.matches || !this.layers.regions) return;
    const ids = this.regions.filter(region => region.territory && (nodeId === null || region.id === nodeId || region.themeId === nodeId || region.members.has(nodeId))).map(region => region.id);
    if (!ids.length) return;
    this.territoryReveal = { ids: new Set(ids), started: performance.now(), duration: 920 };
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
    const persistent = this.renderer.backend === 'webgl' && this.selected === pulse.nodeId;
    if (!persistent && progress >= 1) { this.connectionPulse = null; return false; }
    const amount = persistent ? Math.min(1, progress * 8) : Math.min(1, progress * 8, (1 - progress) * 8);
    const visible = pulse.edges.filter(edge => points.has(edge.from) && points.has(edge.to));
    if (!visible.length) { this.connectionPulse = null; return false; }
    // Equal counterflows communicate evidence classes without implying causation.
    for (const edge of visible) {
      const style = routeStyle(edge), route = this.renderer.routeFor(edge);
      if (!route) continue;
      const seconds = this.renderer.backend === 'webgl' ? this.flowTime : (time - pulse.started) / 1000;
      const fractions = [seconds * style.speed + 0.12 - route.phase, 0.12 - seconds * style.speed - 0.5 - route.phase];
      ctx.fillStyle = regionRGBA(style.color, amount * 0.92);
      for (const fraction of fractions) {
        const point = this.anchor(routePointAt(route, ((fraction % 1) + 1) % 1));
        ctx.beginPath(); ctx.arc(point.x, point.y, 2.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.setLineDash([]);
    this.canvas.dataset.highlightedEdges = String(visible.length);
    return true;
  }

  routesFlowing() {
    const layers = this.effectiveLayers();
    return !this.paused && !this.motion.matches && this.renderer.backend === 'webgl' && (this.comparison ? this.renderer.comparisonEdgeGroups : this.renderer.edgeGroups).some(group => group.count &&
      (group.inferred ? layers.inferred : layers.relationships) && (layers.names || (group.fromKind !== 'person' && group.toKind !== 'person')) && (layers.regions || (group.fromKind !== 'hub' && group.toKind !== 'hub')));
  }

  requestDraw(animate = false, flowOnly = false) {
    if (this.destroyed || !this.active || document.hidden || !this.ctx) return;
    if (animate && this.selected && !this.paused && !this.motion.matches) this.animationUntil = performance.now() + 700;
    if (!flowOnly) this.flowOnly = false;
    else if (this.frame === null) this.flowOnly = true;
    if (this.frame === null) this.frame = requestAnimationFrame(time => {
      this.frame = null;
      if (this.flowOnly && !this.cameraFlight && time - this.lastDrawTime < 1000 / 30) { this.requestDraw(false, true); return; }
      this.flowOnly = false;
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
    const position = this.anchor(node), x = position.x, y = position.y, radius = this.radius(node);
    if (x + radius < 0 || x - radius > this.width || y + radius < 0 || y - radius > this.height) return null;
    node.sx = x; node.sy = y; node.radius = radius; return node;
  }

  updateScreen() {
    const layers = this.effectiveLayers(), order = this.comparison?.labelOrder || this.labelOrder;
    const key = `${this.dataRevision}:${this.comparison?.key}:${this.comparison?.progress}:${this.renderer.backend}:${layers.names}:${layers.regions}:${layers.inferred}:${layers.relationships}:${this.width}:${this.height}:${this.pan.x}:${this.pan.y}:${this.scale}`;
    if (key === this.screenKey) return;
    this.screenKey = key;
    this.visible = this.chooseVisible();
    if (this.renderer.backend === 'webgl') {
      Object.assign(this, this.renderer.countInView(this, layers));
      this.screenLabelOrder = { item: [], hub: [] };
      const points = new Map();
      for (const node of this.regionNodes) { const point = this.project(node); if (point) points.set(node.id, point); }
      for (const kind of ['item', 'hub']) {
        for (const node of order[kind].slice(0, 512)) {
          const point = this.project(node);
          if (point) { points.set(node.id, point); this.screenLabelOrder[kind].push(point); }
          if (this.screenLabelOrder[kind].length === 160) break;
        }
      }
      if (this.screenLabelOrder.item.length < 8) {
        const local = this.querySpatial(-this.pan.x / this.scale, -this.pan.y / this.scale, (this.width - this.pan.x) / this.scale, (this.height - this.pan.y) / this.scale);
        for (const node of local) if (node.kind === 'item' && !points.has(node.id)) {
          const point = this.project(node); if (point) { points.set(node.id, point); this.screenLabelOrder.item.push(point); }
          if (this.screenLabelOrder.item.length === 32) break;
        }
      }
      this.screenPoints = points; this.screen = [...points.values()];
      this.visibleEdges = []; this.displayedEdges = [];
      this.labelsDirty = true; return;
    }
    this.screen = (this.comparison ? this.nodes : this.spatial.query((-24 - this.pan.x) / this.scale, (-24 - this.pan.y) / this.scale, (this.width + 24 - this.pan.x) / this.scale, (this.height + 24 - this.pan.y) / this.scale)).filter(node => this.comparison || this.nodeEnabled(node)).map(node => {
      const point = this.anchor(node); node.sx = point.x; node.sy = point.y; node.radius = this.radius(node); return node;
    }).filter(node => node.sx + node.radius >= 0 && node.sx - node.radius <= this.width && node.sy + node.radius >= 0 && node.sy - node.radius <= this.height);
    this.screenPoints = new Map(this.screen.map(node => [node.id, node]));
    this.routePoints = new Map(this.screenPoints);
    this.visibleEdges = (this.comparison?.edges || this.edges).filter(edge => this.edgeEnabled(edge) && this.routeNodeEnabled(this.byId.get(edge.from)) && this.routeNodeEnabled(this.byId.get(edge.to)) && this.routePoints.has(edge.from) && this.routePoints.has(edge.to));
    this.displayedEdges = this.visibleEdges;
    this.inViewRecords = this.screen.filter(node => node.kind === 'item').length;
    this.inViewNames = this.screen.filter(node => node.kind === 'person').length;
    this.inViewCount = this.screen.length;
    this.screenLabelOrder = {};
    for (const kind of ['item', 'hub']) {
      const candidates = [];
      for (const node of order[kind]) if (this.screenPoints.has(node.id)) { candidates.push(node); if (candidates.length === 160) break; }
      this.screenLabelOrder[kind] = candidates;
    }
    this.labelsDirty = true;
  }

  draw(time) {
    if (!this.active || this.destroyed || document.hidden || !this.ctx || !this.width || !this.height) return;
    const start = performance.now();
    this.lastDrawTime = time;
    const comparing = this.advanceComparison(time), layers = this.effectiveLayers();
    const flying = this.advanceCamera(time);
    const flowing = this.routesFlowing();
    if (flowing && this.flowClock !== null) this.flowTime += Math.max(0, time - this.flowClock) / 1000;
    this.flowClock = flowing ? time : null;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.paintDepth(ctx);
    this.renderer.checkContext();
    this.updateScreen();
    const points = this.renderer.backend === 'webgl' ? new Map(this.screenPoints) : this.routePoints;
    const edges = this.visibleEdges;
    const emphasis = this.hovered || this.keyboardId || this.selected;
    let selectionReveal = this.selectionReveal;
    if (selectionReveal && (time >= selectionReveal.started + selectionReveal.duration || this.paused || this.motion.matches || selectionReveal.nodeId !== this.selected)) { this.selectionReveal = null; selectionReveal = null; }
    const acquisition = selectionReveal ? clamp((time - selectionReveal.started) / selectionReveal.duration, 0, 1) : 1;
    const routeReveal = selectionReveal?.nodeId === emphasis ? 1 - (1 - acquisition) ** 3 : 1;
    const focusPoint = this.project(this.byId.get(emphasis)); if (focusPoint) points.set(emphasis, focusPoint);
    const selectedEdges = [];
    if (emphasis && (layers.relationships || layers.inferred)) for (const edge of this.adjacency.get(emphasis) || []) {
      if (!this.edgeEnabled(edge)) continue;
      const a = this.project(this.byId.get(edge.from), true), b = this.project(this.byId.get(edge.to), true);
      if (a && b) { points.set(a.id, a); points.set(b.id, b); selectedEdges.push(edge); }
      if (selectedEdges.length === 48) break;
    }
    if (this.connectionPulse) for (const edge of this.connectionPulse.edges) {
      const a = this.project(this.byId.get(edge.from), true), b = this.project(this.byId.get(edge.to), true);
      if (a && b) { points.set(a.id, a); points.set(b.id, b); }
    }
    const revealingTerritories = layers.regions && this.paintRegions(ctx, time);
    ctx.lineCap = 'round';
    const displayedEdges = this.displayedEdges;
    if (this.renderer.backend !== 'webgl' && (layers.relationships || layers.inferred)) {
      for (const style of Object.values(ROUTE_STYLES)) {
        ctx.beginPath();
        const opacity = routeOpacity(style.inferred, this.scale / this.baseScale, displayedEdges.length, Boolean(emphasis)) * (this.comparison ? 2.8 * (this.comparison.exiting ? 1 - this.comparison.progress : 1) : 1);
        ctx.strokeStyle = regionRGBA(style.color, opacity);
        ctx.lineWidth = style.inferred ? 0.65 : 0.7;
        ctx.setLineDash(style.inferred ? [2, 5] : []);
        for (const edge of displayedEdges) {
          if (routeStyle(edge) !== style) continue;
          this.edgePath(ctx, points.get(edge.from), points.get(edge.to), edge);
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    const drawStats = this.renderer.draw(this, layers, this.screen, { flowTime: this.flowTime, animateRoutes: flowing });
    if (drawStats.backend === 'canvas2d') drawStats.submittedEdges = drawStats.drawnEdges = displayedEdges.length;
    if (emphasis) {
      for (const style of Object.values(ROUTE_STYLES)) {
        ctx.beginPath();
        ctx.strokeStyle = regionRGBA(style.color, 0.64);
        ctx.lineWidth = 1.05;
        ctx.setLineDash(style.inferred ? [3, 5] : []);
        for (const edge of selectedEdges) if (routeStyle(edge) === style) this.edgePath(ctx, points.get(edge.from), points.get(edge.to), edge, routeReveal, emphasis);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // A bounded endpoint ring makes a selected evidence fan terminate at
      // visible stars; these are the same real nodes used by hit testing.
      const endpoints = new Set();
      for (const edge of selectedEdges) { endpoints.add(edge.from); endpoints.add(edge.to); }
      endpoints.delete(emphasis);
      for (const id of endpoints) {
        const node = points.get(id); if (!node) continue;
        const color = this.comparison?.layout.targets.get(id)?.color || node.color || COLORS[node.kind];
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(node.sx, node.sy, Math.max(1.2, Math.min(2.2, node.radius)), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = regionRGBA(color, 0.42 * routeReveal); ctx.lineWidth = 0.65;
        ctx.beginPath(); ctx.arc(node.sx, node.sy, Math.max(3, node.radius + 1.5), 0, Math.PI * 2); ctx.stroke();
      }
    }
    const highlighting = this.paintConnectionPulse(ctx, points, time);
    const settling = !this.paused && !this.motion.matches && time < this.animationUntil;
    const settle = settling ? Math.sin((1 - (this.animationUntil - time) / 700) * Math.PI) : 0;
    const focus = points.get(emphasis);
    for (const node of focus ? [focus] : []) {
      const highlighted = true;
      const color = this.comparison?.layout.targets.get(node.id)?.color || node.color || COLORS[node.kind];
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
      if (selectionReveal?.nodeId === node.id) {
        ctx.strokeStyle = regionRGBA(color, (1 - acquisition) * 0.85); ctx.lineWidth = 1;
        const radius = node.radius + 7 + (1 - acquisition) * 18;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = i * Math.PI * 2 / 3 + acquisition * 0.55, sweep = 0.22 + acquisition * 1.45;
          ctx.moveTo(node.sx + Math.cos(angle) * radius, node.sy + Math.sin(angle) * radius);
          ctx.arc(node.sx, node.sy, radius, angle, angle + sweep);
        }
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
      if (layers.regions) for (const node of this.regionNodes) if (node.id !== emphasis && points.has(node.id) && this.nodeEnabled(node)) this.placeLabel(ctx, points.get(node.id), false);
      const hubs = layers.labels ? this.screenLabelOrder.hub.filter(node => node.kind !== 'hub' && node.id !== emphasis) : [];
      const items = layers.labels ? this.screenLabelOrder.item.filter(node => node.id !== emphasis) : [];
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
    this.canvas.dataset.cameraMoving = String(Boolean(this.cameraFlight));
    this.canvas.dataset.routesFlowing = String(flowing);
    this.canvas.dataset.territoriesRevealing = String(Boolean(revealingTerritories));
    this.canvas.dataset.selectionRevealing = String(Boolean(selectionReveal));
    this.canvas.dataset.selectionRevealProgress = String(routeReveal);
    this.canvas.dataset.comparisonKey = this.comparison?.key || '';
    this.canvas.dataset.comparisonProgress = String(this.comparison?.progress ?? 1);
    this.canvas.dataset.comparisonRecords = String(this.comparison?.config.memberIds.size || 0);
    this.canvas.dataset.comparisonNames = String(this.comparison?.config.personIds.size || 0);
    this.canvas.dataset.comparisonEdges = String(this.comparison?.edges.length || 0);
    this.canvas.dataset.comparisonShared = String(this.comparison?.config.shared.size || 0);
    this.canvas.dataset.comparisonExiting = String(Boolean(this.comparison?.exiting));
    if (flying || comparing) this.requestDraw();
    else if (settling || highlighting || flowing || revealingTerritories || selectionReveal) this.requestDraw(false, true);
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

  paintRegions(ctx, time) {
    let reveal = this.territoryReveal;
    if (reveal && (time >= reveal.started + reveal.duration || this.paused || this.motion.matches)) { this.territoryReveal = null; reveal = null; }
    const trace = (points, progress = 1) => {
      const count = points.length, length = count * progress, first = this.anchor(points[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i <= Math.floor(length); i++) { const point = this.anchor(points[i % count]); ctx.lineTo(point.x, point.y); }
      if (progress < 1) {
        const index = Math.floor(length), a = points[index % count], b = points[(index + 1) % count], amount = length - index;
        const point = this.anchor({ x: a.x + (b.x - a.x) * amount, y: a.y + (b.y - a.y) * amount }); ctx.lineTo(point.x, point.y);
      } else ctx.closePath();
    };
    for (const region of this.comparison?.regions || this.regions) {
      const territory = region.territory;
      if (!territory) continue;
      const bounds = territory.bounds;
      if (bounds.right * this.scale + this.pan.x < -12 || bounds.left * this.scale + this.pan.x > this.width + 12 || bounds.bottom * this.scale + this.pan.y < -12 || bounds.top * this.scale + this.pan.y > this.height + 12) continue;
      const selected = this.regionSelectionMeta.id === region.id || this.regionSelectionMeta.id === region.themeId || this.selected === region.id || region.members.has(this.selected);
      const rawProgress = reveal?.ids.has(region.id) ? clamp((time - reveal.started) / reveal.duration, 0, 1) : 1;
      const progress = 1 - (1 - rawProgress) ** 3, opacity = (0.35 + progress * 0.65) * (this.comparison ? this.comparison.exiting ? 1 - this.comparison.progress : this.comparison.progress : 1);
      ctx.setLineDash([]);
      ctx.beginPath();
      for (const loop of territory.outer) trace(loop.points);
      ctx.fillStyle = regionRGBA(region.color, (selected ? 0.105 : 0.075) * opacity); ctx.fill('evenodd');
      ctx.beginPath();
      for (const loop of territory.outer) trace(loop.points, progress);
      // Layered narrow strokes soften the rim without a per-frame blur/filter.
      ctx.strokeStyle = regionRGBA(region.color, (selected ? 0.065 : 0.035) * opacity); ctx.lineWidth = selected ? 10 : 7; ctx.stroke();
      ctx.strokeStyle = regionRGBA(region.color, (selected ? 0.17 : 0.09) * opacity); ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = regionRGBA(region.color, (selected ? 0.77 : 0.55) * opacity); ctx.lineWidth = selected ? 1.25 : 0.85; ctx.stroke();
      ctx.beginPath();
      for (const loop of territory.outer) {
        const count = loop.points.length;
        trace(loop.rim, progress);
        for (let i = 0; i < Math.floor(count * progress); i += 4) {
          const a = this.anchor(loop.points[i]), b = this.anchor(loop.rim[i]), c = this.anchor(loop.points[(i + 4) % count]);
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
        }
      }
      ctx.strokeStyle = regionRGBA(region.color, (selected ? 0.26 : 0.17) * opacity); ctx.lineWidth = 0.6; ctx.stroke();
      ctx.beginPath();
      for (const loop of territory.inner) trace(loop.points, progress);
      ctx.strokeStyle = regionRGBA(region.color, (selected ? 0.16 : 0.075) * opacity); ctx.lineWidth = 0.65; ctx.stroke();
    }
    ctx.setLineDash([]);
    return Boolean(reveal);
  }

  edgePath(ctx, a, b, edge, progress = 1, originId = edge.from) {
    const route = this.renderer.routeFor(edge);
    const reversed = originId === edge.to, start = reversed ? b : a, end = reversed ? a : b;
    ctx.moveTo(start.sx, start.sy);
    if (route) {
      const points = reversed ? [...route.points].reverse() : route.points;
      let remaining = route.length * progress;
      for (let i = 1; i < points.length; i++) {
        const from = points[i - 1], to = points[i], length = Math.hypot(to.x - from.x, to.y - from.y), fraction = length ? Math.min(1, remaining / length) : 1;
        const anchor = this.anchor({ x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction }); ctx.lineTo(anchor.x, anchor.y);
        remaining -= length;
        if (remaining <= 0) break;
      }
    } else ctx.lineTo(start.sx + (end.sx - start.sx) * progress, start.sy + (end.sy - start.sy) * progress);
  }

  labelExclusions() {
    if (this.exclusions) return this.exclusions;
    const canvas = this.canvas.getBoundingClientRect();
    const elements = this.canvas.parentElement?.querySelectorAll?.('.graph-intro, .graph-controls, .theme-control, .region-controls, .region-bar, .graph-bottom, .graph-instructions, .preview-navigation, .map-layers, .map-perspectives') || [];
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
    // Distant hubs can share a tiny patch of sky. A bounded outer search keeps
    // their existing labels and leader lines readable without moving any stars.
    const distances = [node.radius + 12, 42, 76, 112];
    if (node.kind === 'hub' && this.scale / this.baseScale <= 1.3) distances.push(160, 224);
    for (const distance of distances) {
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
    this.regionNodes = []; this.regions = []; this.territoryReveal = null; this.regionSelection = null; this.regionSelectionMeta = {};
    this.comparison = null; this.comparisonRestore = null; this.edgeSourceMap?.clear();
  }
}
