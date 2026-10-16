import { nodeAppearance } from './node-style.js?v=sources-20261015';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const theme = node => node.kind === 'hub' || node.visualType === 'theme';

/** Unique loaded endpoints, not assertions, citations, importance or influence.
 * Inferred record links remain connections; illustrative theme spokes do not. */
export function connectionCounts(nodes, edges) {
  const positions = new Map(nodes.map((node, i) => [node.id, i]));
  const result = new Map(nodes.map(node => [node.id, 0])), pairs = new Set();
  const numeric = Number.isSafeInteger(nodes.length * nodes.length);
  for (const edge of edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    if (a == null || b == null || a === b || edge.type === 'theme' || edge.kind === 'title_keyword_match' || theme(nodes[a]) || theme(nodes[b])) continue;
    const low = Math.min(a, b), high = Math.max(a, b);
    const key = numeric ? low * nodes.length + high : `${low}:${high}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    result.set(edge.from, result.get(edge.from) + 1);
    result.set(edge.to, result.get(edge.to) + 1);
  }
  return result;
}

function unit(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

function limits(node, bounds) {
  const local = node.layoutBounds || bounds;
  const left = Math.max(bounds.left, finite(local.left, bounds.left));
  const right = Math.min(bounds.right, finite(local.right, bounds.right));
  const top = Math.max(bounds.top, finite(local.top, bounds.top));
  const bottom = Math.min(bounds.bottom, finite(local.bottom, bounds.bottom));
  return right >= left && bottom >= top ? { left, right, top, bottom } : bounds;
}

/** Bounded presentation spacing. Only source/group glyphs, connected names or
 * works (8+ neighbors) reserve space. Themes keep their exact centers and never
 * reserve or repel. Ordinary works
 * can move around these markers but never repel one another. Canonical positions
 * are untouched. Dense scenes can exhaust local space; this is not a packing
 * guarantee. pixelScale is CSS pixels per world unit; zoom is the same
 * scale/baseScale ratio used to draw glyphs. Each search remains bounded. */
export function clearNodeSpace(nodes, counts, bounds, { pixelScale = 1, zoom = 1 } = {}) {
  if (!bounds || !['left', 'right', 'top', 'bottom'].every(key => Number.isFinite(bounds[key])) || bounds.left > bounds.right || bounds.top > bounds.bottom) {
    throw new TypeError('Node clearance requires finite ordered bounds.');
  }
  if (!Number.isFinite(pixelScale) || pixelScale <= 0 || !Number.isFinite(zoom) || zoom <= 0) {
    throw new TypeError('Node clearance requires positive finite camera scales.');
  }
  const CELL_LIMIT = 24, RINGS = 4, DIRECTIONS = 12;
  const output = new Map(), grid = new Map(), reserved = [], ordinary = [];
  let maximumRadius = 0;
  for (const node of nodes) {
    const count = Math.max(0, finite(counts.get(node.id)));
    const appearance = nodeAppearance(node, zoom, { connectionCount: count });
    if (theme(node) || appearance.type === 'theme') {
      output.set(node.id, { x: node.x, y: node.y });
      continue;
    }
    const reserve = appearance.type === 'source' || count >= 8;
    const box = limits(node, bounds);
    const worldRadius = reserve ? appearance.baseRadius * 4 + 6 : appearance.baseRadius * 1.5 + 1.5;
    const padding = reserve ? 2 : 1;
    const desired = Math.max(worldRadius, (appearance.radius + padding) / pixelScale);
    const radius = Math.min(desired, Math.max(0, (box.right - box.left) / 2), Math.max(0, (box.bottom - box.top) / 2));
    const entry = { id: node.id, x: finite(node.x), y: finite(node.y), radius, box, count, type: appearance.type };
    maximumRadius = Math.max(maximumRadius, radius);
    if (reserve) reserved.push(entry);
    else ordinary.push(entry);
  }
  // No bright evidence hubs means there is nothing to clear. In particular,
  // theme-only entrance scenes must retain every original target, even offscreen.
  if (!reserved.length) return new Map(nodes.map(node => [node.id, { x: node.x, y: node.y }]));
  // At distant camera scales the world-space discs grow. Adapt the bins too,
  // so each candidate still visits at most a small fixed neighborhood of cells.
  const CELL = Math.max(64, maximumRadius * 2 + 4);
  const priority = node => node.type === 'source' ? 1 : 0;
  reserved.sort((a, b) => priority(b) - priority(a) || b.count - a.count || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
  const penalty = (x, y, radius) => {
    const extent = radius + maximumRadius + 2;
    let total = 0;
    for (let gx = Math.floor((x - extent) / CELL); gx <= Math.floor((x + extent) / CELL); gx++) {
      for (let gy = Math.floor((y - extent) / CELL); gy <= Math.floor((y + extent) / CELL); gy++) {
        const cell = grid.get(`${gx},${gy}`);
        if (!cell) continue;
        // Overflow blocks the whole cell conservatively instead of silently
        // dropping markers or letting a pathological cluster cause quadratic work.
        if (cell.overflow) total += 1000;
        for (const other of cell.entries) {
          const overlap = radius + other.radius + 2 - Math.hypot(x - other.x, y - other.y);
          if (overlap > 0) total += overlap * overlap;
        }
      }
    }
    return total;
  };
  const place = entry => {
    const { box, radius } = entry;
    const constrain = (x, y) => ({ x: clamp(x, box.left + radius, box.right - radius), y: clamp(y, box.top + radius, box.bottom - radius) });
    const origin = constrain(entry.x, entry.y);
    let best = origin, bestPenalty = penalty(origin.x, origin.y, radius), bestDistance = 0;
    if (bestPenalty) {
      const angle = unit(`clearance:${entry.id}`) * Math.PI * 2;
      const step = Math.max(12, radius + maximumRadius + 3);
      search: for (let ring = 1; ring <= RINGS; ring++) for (let direction = 0; direction < DIRECTIONS; direction++) {
        const theta = angle + direction * Math.PI * 2 / DIRECTIONS;
        const candidate = constrain(origin.x + Math.cos(theta) * step * ring, origin.y + Math.sin(theta) * step * ring);
        const score = penalty(candidate.x, candidate.y, radius);
        const distance = Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
        if (score < bestPenalty || (score === bestPenalty && distance < bestDistance)) {
          best = candidate; bestPenalty = score; bestDistance = distance;
        }
        if (score === 0) break search;
      }
    }
    output.set(entry.id, best);
    return { ...entry, ...best };
  };
  for (const entry of reserved) {
    const point = place(entry), key = `${Math.floor(point.x / CELL)},${Math.floor(point.y / CELL)}`;
    let cell = grid.get(key);
    if (!cell) { cell = { entries: [], overflow: false }; grid.set(key, cell); }
    if (cell.entries.length < CELL_LIMIT) cell.entries.push(point); else cell.overflow = true;
  }
  for (const entry of ordinary) place(entry);
  return output;
}
