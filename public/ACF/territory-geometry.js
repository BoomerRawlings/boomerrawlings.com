const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function smoothLoop(points) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    result.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  return result;
}

function prepareLoop(points, cell) {
  const smooth = smoothLoop(points), lengths = [0];
  for (let i = 0; i < smooth.length; i++) lengths.push(lengths.at(-1) + Math.hypot(smooth[(i + 1) % smooth.length].x - smooth[i].x, smooth[(i + 1) % smooth.length].y - smooth[i].y));
  const length = lengths.at(-1), count = clamp(Math.ceil(length / cell), 24, 240), sampled = [];
  let edge = 0;
  for (let i = 0; i < count; i++) {
    const distance = length * i / count;
    while (lengths[edge + 1] < distance) edge++;
    const a = smooth[edge], b = smooth[(edge + 1) % smooth.length], fraction = (distance - lengths[edge]) / Math.max(1e-9, lengths[edge + 1] - lengths[edge]);
    sampled.push({ x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction });
  }
  let area = 0;
  for (let i = 0; i < count; i++) { const a = sampled[i], b = sampled[(i + 1) % count]; area += a.x * b.y - b.x * a.y; }
  // A narrow triangulated ribbon follows the local boundary normal. It is a
  // cartographic surface cue, not an additional relationship between records.
  const rim = sampled.map((point, i) => {
    const a = sampled[(i + count - 1) % count], b = sampled[(i + 1) % count], distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const inset = cell * 1.2 * Math.sign(area);
    return { x: point.x - (b.y - a.y) / distance * inset, y: point.y + (b.x - a.x) / distance * inset };
  });
  return { points: sampled, rim, length, area: Math.abs(area) / 2 };
}

function contours(field, width, height, origin, cell, level) {
  const vertices = new Map(), neighbors = new Map();
  const segment = (a, b) => {
    if (!neighbors.has(a)) neighbors.set(a, []);
    if (!neighbors.has(b)) neighbors.set(b, []);
    neighbors.get(a).push(b); neighbors.get(b).push(a);
  };
  const pairs = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[3, 2]], [[2, 3]], [[2, 0]], null, [[2, 1]], [[1, 3]], [[1, 0]], [[0, 3]], []];
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const values = [field[y * width + x], field[y * width + x + 1], field[(y + 1) * width + x + 1], field[(y + 1) * width + x]];
    const mask = values.reduce((bits, value, i) => bits | (value >= level ? 1 << i : 0), 0);
    if (!mask || mask === 15) continue;
    const centerInside = values.reduce((sum, value) => sum + value, 0) / 4 >= level;
    const connections = pairs[mask] || (mask === 5 ? centerInside ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]] : centerInside ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]]);
    const keys = [`h:${x}:${y}`, `v:${x + 1}:${y}`, `h:${x}:${y + 1}`, `v:${x}:${y}`];
    const positions = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
    const vertex = edge => {
      const key = keys[edge];
      if (!vertices.has(key)) {
        const next = (edge + 1) % 4, fraction = clamp((level - values[edge]) / (values[next] - values[edge]), 0, 1), a = positions[edge], b = positions[next];
        vertices.set(key, { x: origin.x + (a[0] + (b[0] - a[0]) * fraction) * cell, y: origin.y + (a[1] + (b[1] - a[1]) * fraction) * cell });
      }
      return key;
    };
    for (const [a, b] of connections) segment(vertex(a), vertex(b));
  }
  const visited = new Set(), loops = [];
  for (const start of neighbors.keys()) {
    if (visited.has(start)) continue;
    const points = [];
    let previous = null, current = start;
    do {
      points.push(vertices.get(current)); visited.add(current);
      const next = neighbors.get(current).find(key => key !== previous);
      previous = current; current = next;
    } while (current && current !== start && !visited.has(current));
    if (current === start && points.length >= 4) loops.push(prepareLoop(points, cell));
  }
  return loops.sort((a, b) => b.area - a.area);
}

/** Cached illustrative density contours. Every unique member contributes;
 * neither these contours nor their bounds define or change membership. */
export function buildTerritory(region, byId) {
  const members = [...new Set(region.memberIds || [])].map(id => byId.get(String(id))).filter(node => node?.kind === 'item' && Number.isFinite(node.x) && Number.isFinite(node.y));
  if (!members.length) return null;
  // Stable summation also makes array/Set membership order immaterial.
  members.sort((a, b) => a.id.localeCompare(b.id));
  const bounds = members.reduce((box, node) => ({ left: Math.min(box.left, node.x), right: Math.max(box.right, node.x), top: Math.min(box.top, node.y), bottom: Math.max(box.bottom, node.y) }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  const cell = Math.max(6, Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top) / 52), sigma = cell * 2, padding = sigma * 3.5;
  const origin = { x: bounds.left - padding, y: bounds.top - padding };
  const width = Math.ceil((bounds.right - bounds.left + padding * 2) / cell) + 1, height = Math.ceil((bounds.bottom - bounds.top + padding * 2) / cell) + 1;
  const field = new Float64Array(width * height), kernel = 6;
  for (const node of members) {
    const gx = (node.x - origin.x) / cell, gy = (node.y - origin.y) / cell;
    for (let y = Math.max(0, Math.ceil(gy - kernel)); y <= Math.min(height - 1, Math.floor(gy + kernel)); y++) for (let x = Math.max(0, Math.ceil(gx - kernel)); x <= Math.min(width - 1, Math.floor(gx + kernel)); x++) {
      const distance = (x - gx) ** 2 + (y - gy) ** 2;
      if (distance <= kernel * kernel) field[y * width + x] += Math.exp(-distance / 8);
    }
  }
  const peak = field.reduce((maximum, value) => Math.max(maximum, value), 0), level = Math.max(0.18, peak * 0.03);
  const outer = contours(field, width, height, origin, cell, level), inner = contours(field, width, height, origin, cell, level * 2.5);
  return { outer, inner, cell, memberCount: members.length, gridCells: field.length, bounds: { left: origin.x, right: origin.x + (width - 1) * cell, top: origin.y, bottom: origin.y + (height - 1) * cell } };
}
