const COLORS = { hub: '#d89976', item: '#a9c9db', person: '#aaa4d0' };
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  result = Math.imul(result ^ (result >>> 16), 0x85ebca6b);
  result = Math.imul(result ^ (result >>> 13), 0xc2b2ae35);
  return (result ^ (result >>> 16)) >>> 0;
}

/** An event-driven view of a bounded, pre-positioned section of the catalog. */
export class AtlasGraph {
  constructor(canvas, { onSelect = () => {}, onPreview = () => {}, onLabels = () => {}, onZoom = () => {}, onStatus = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.onPreview = onPreview;
    this.onLabels = onLabels;
    this.onZoom = onZoom;
    this.onStatus = onStatus;
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
      if (document.hidden) { this.dismissPreview('layout'); this.cancelFrame(); }
      else this.requestDraw();
    }, { signal });
    this.motion.addEventListener('change', () => {
      this.animationUntil = 0;
      this.requestDraw();
    }, { signal });
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(canvas);
    this.measure();
  }

  setData({ nodes = [], edges = [] } = {}) {
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
        // LOD selection must not share the layout's angle seed.
        seed: hash(`visible:${node.id}`),
      };
      this.byId.set(clean.id, clean);
    }
    this.nodes = [...this.byId.values()];
    this.edges = edges.filter(edge => edge && this.byId.has(String(edge.from)) && this.byId.has(String(edge.to)))
      .map(edge => ({ ...edge, from: String(edge.from), to: String(edge.to) }));
    if (!this.byId.has(this.selected)) this.selected = null;
    this.hovered = null;
    this.keyboardId = null;
    this.screen = [];
    this.reset();
    if (!this.ctx) {
      this.canvas.dataset.graphUnavailable = 'true';
      this.onStatus({ visibleNodes: 0, totalNodes: this.nodes.length, visibleEdges: 0 });
    }
  }

  setActive(active) {
    if (this.destroyed) return;
    if (!active) this.dismissPreview('layout');
    this.active = Boolean(active);
    if (this.active) {
      this.measure();
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
    const bounds = this.nodes.reduce((box, node) => ({
      left: Math.min(box.left, node.x), right: Math.max(box.right, node.x),
      top: Math.min(box.top, node.y), bottom: Math.max(box.bottom, node.y),
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    if (!this.nodes.length) Object.assign(bounds, { left: -450, right: 450, top: -300, bottom: 300 });
    const { left, right, top, bottom } = this.viewportFrame();
    const center = this.viewportCenter();
    const scale = Math.min(
      Math.max(50, this.width - left - right) / Math.max(240, bounds.right - bounds.left),
      Math.max(50, this.height - top - bottom) / Math.max(180, bounds.bottom - bounds.top),
      1.35,
    );
    this.scale = Math.max(0.08, scale);
    this.baseScale = this.scale;
    this.pan = {
      x: center.x - (bounds.left + bounds.right) / 2 * this.scale,
      y: center.y - (bounds.top + bounds.bottom) / 2 * this.scale,
    };
    this.initialized = true;
    this.onZoom(1);
    this.requestDraw(true);
  }

  zoomBy(factor, anchor = this.viewportCenter()) {
    if (this.destroyed || !Number.isFinite(factor) || factor <= 0) return;
    this.dismissPreview('layout');
    const next = clamp(this.scale * factor, this.baseScale * 0.4, this.baseScale * 8);
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
      const next = clamp(this.scale * ratio, this.baseScale * 0.4, this.baseScale * 8);
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
    const candidates = this.focusCandidates();
    const current = candidates.find(node => node.id === (this.keyboardId || this.hovered)) || this.nearestCenter();
    if (!current) return;
    const origin = this.anchor(current);
    const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    let next = null;
    let best = Infinity;
    for (const candidate of candidates) {
      const x = candidate.sx - origin.x, y = candidate.sy - origin.y;
      const forward = x * dx + y * dy;
      if (candidate.id === current.id || forward < 1) continue;
      const sideways = Math.abs(x * dy - y * dx);
      const score = Math.hypot(x, y) + sideways * 2;
      if (score < best) { best = score; next = candidate; }
    }
    this.focusNode(this.byId.get((next || current).id));
  }

  cycleFocus(direction) {
    const candidates = this.focusCandidates().sort((a, b) => a.id.localeCompare(b.id));
    if (!candidates.length) return;
    const current = candidates.findIndex(node => node.id === (this.keyboardId || this.hovered));
    const index = current < 0 ? (direction > 0 ? 0 : candidates.length - 1) : (current + direction + candidates.length) % candidates.length;
    this.focusNode(this.byId.get(candidates[index].id));
  }

  stepPreview(direction = 1) {
    if (!this.active || this.destroyed) return;
    this.cycleFocus(direction < 0 ? -1 : 1);
  }

  nearestCenter() {
    let nearest = null;
    let distance = Infinity;
    const center = this.viewportCenter();
    for (const node of this.screen) {
      const candidate = (node.sx - center.x) ** 2 + (node.sy - center.y) ** 2;
      if (candidate < distance) { distance = candidate; nearest = node; }
    }
    return nearest ? this.byId.get(nearest.id) : null;
  }

  hit(point) {
    this.updateScreen();
    // Opaque title cards are painted above dots, so their hit regions must win too.
    const label = this.labelBoxes.find(box => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
    if (label) return this.byId.get(label.id);
    let result = null;
    let closest = Infinity;
    for (const node of this.screen) {
      const distance = Math.hypot(point.x - node.sx, point.y - node.sy);
      if (distance <= Math.max(11, node.radius + 6) && distance < closest) { result = node; closest = distance; }
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

  requestDraw(animate = false) {
    if (this.destroyed || !this.active || document.hidden || !this.ctx) return;
    if (animate && !this.paused && !this.motion.matches) this.animationUntil = performance.now() + 700;
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
    const detail = clamp((this.scale / this.baseScale - 1) / 1.6, 0, 1);
    const budget = Math.round(250 + detail * 250);
    const fixed = this.nodes.filter(node => node.kind !== 'item' || [this.selected, this.hovered, this.keyboardId].includes(node.id));
    const fixedIds = new Set(fixed.map(node => node.id));
    const sampled = this.nodes.filter(node => !fixedIds.has(node.id)).sort((a, b) => a.seed - b.seed)
      .slice(0, Math.max(0, budget - fixed.length));
    return [...sampled, ...fixed];
  }

  updateScreen() {
    this.visible = this.chooseVisible();
    this.screen = this.visible.map(node => ({
      ...node,
      sx: node.x * this.scale + this.pan.x,
      sy: node.y * this.scale + this.pan.y,
      radius: clamp(finite(node.size, node.kind === 'hub' ? 8 : node.kind === 'person' ? 4.5 : 2.3) * Math.sqrt(this.scale / this.baseScale), 1.5, 22),
    })).filter(node => node.sx > -24 && node.sx < this.width + 24 && node.sy > -24 && node.sy < this.height + 24);
  }

  draw(time) {
    if (!this.active || this.destroyed || document.hidden || !this.ctx || !this.width || !this.height) return;
    const start = performance.now();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.updateScreen();
    const points = new Map(this.screen.map(node => [node.id, node]));
    const edges = this.edges.filter(edge => points.has(edge.from) && points.has(edge.to));
    const emphasis = this.hovered || this.keyboardId || this.selected;
    ctx.lineCap = 'round';
    for (const inferred of [false, true]) {
      ctx.beginPath();
      ctx.strokeStyle = inferred ? 'rgba(216,153,118,0.18)' : 'rgba(169,201,219,0.19)';
      ctx.lineWidth = inferred ? 0.65 : 0.7;
      ctx.setLineDash(inferred ? [2, 5] : []);
      for (const edge of edges) {
        if (Boolean(edge.inferred) !== inferred) continue;
        this.edgePath(ctx, points.get(edge.from), points.get(edge.to));
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (emphasis) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(216,153,118,0.64)';
      ctx.lineWidth = 1.05;
      for (const edge of edges) if (!edge.inferred && (edge.from === emphasis || edge.to === emphasis)) this.edgePath(ctx, points.get(edge.from), points.get(edge.to));
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      for (const edge of edges) if (edge.inferred && (edge.from === emphasis || edge.to === emphasis)) this.edgePath(ctx, points.get(edge.from), points.get(edge.to));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const settling = !this.paused && !this.motion.matches && time < this.animationUntil;
    const settle = settling ? Math.sin((1 - (this.animationUntil - time) / 700) * Math.PI) : 0;
    for (const node of this.screen) {
      const highlighted = node.id === emphasis;
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
      const hubs = this.screen.filter(node => node.kind !== 'item' && node.id !== emphasis).sort((a, b) => (b.count || 0) - (a.count || 0));
      const items = this.screen.filter(node => node.kind === 'item' && node.id !== emphasis).sort((a, b) => hash(`label:${a.id}`) - hash(`label:${b.id}`));
      // Give both records and source labels space, including results with no people.
      let itemCount = 0, hubCount = 0;
      while ((itemCount < (compact ? 2 : 4) && items.length) || (hubCount < (compact ? 2 : 4) && hubs.length)) {
        if (itemCount < (compact ? 2 : 4) && items.length && this.placeLabel(ctx, items.shift(), false)) itemCount++;
        if (hubCount < (compact ? 2 : 4) && hubs.length && this.placeLabel(ctx, hubs.shift(), false)) hubCount++;
      }
      this.labelsDirty = false;
      this.onLabels(this.labelBoxes.map(box => ({ ...box })));
    }
    for (const plan of this.labelPlans) this.paintLabel(ctx, plan);
    if (document.activeElement === this.canvas) this.drawCrosshair(ctx);
    const status = { visibleNodes: this.screen.length, totalNodes: this.nodes.length, visibleEdges: edges.length };
    const statusKey = `${status.visibleNodes}/${status.totalNodes}/${status.visibleEdges}`;
    if (statusKey !== this.lastStatus) { this.lastStatus = statusKey; this.onStatus(status); }
    this.canvas.dataset.visibleNodes = String(status.visibleNodes);
    this.canvas.dataset.totalNodes = String(status.totalNodes);
    this.canvas.dataset.visibleEdges = String(status.visibleEdges);
    this.canvas.dataset.frameMs = (performance.now() - start).toFixed(2);
    if (settling) this.requestDraw();
  }

  edgePath(ctx, a, b) {
    const bend = ((a.seed ^ b.seed) % 17 - 8) * 0.0035;
    ctx.moveTo(a.sx, a.sy);
    ctx.quadraticCurveTo((a.sx + b.sx) / 2 + (b.sy - a.sy) * bend, (a.sy + b.sy) / 2 - (b.sx - a.sx) * bend, b.sx, b.sy);
  }

  labelExclusions() {
    if (this.exclusions) return this.exclusions;
    const canvas = this.canvas.getBoundingClientRect();
    const elements = this.canvas.parentElement?.querySelectorAll('.graph-intro, .graph-controls, .theme-control, .graph-bottom, .graph-instructions, .preview-navigation') || [];
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
    ctx.fillStyle = node.kind === 'item' ? '#a9c9db' : '#d89976';
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
    this.pointers.clear();
    this.nodes = [];
    this.edges = [];
    this.screen = [];
    this.byId.clear();
  }
}
