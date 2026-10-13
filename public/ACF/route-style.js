// Evidence categories, not calculated probabilities or causal direction.
export const ROUTE_STYLES = Object.freeze({
  credit: Object.freeze({ id: 'credit', label: 'Source credit', color: '#65dceb', rgb: [101 / 255, 220 / 255, 235 / 255], speed: 0.32, inferred: false }),
  relationship: Object.freeze({ id: 'relationship', label: 'Recorded relationship', color: '#82e0a4', rgb: [130 / 255, 224 / 255, 164 / 255], speed: 0.23, inferred: false }),
  inferred: Object.freeze({ id: 'inferred', label: 'Inferred relationship', color: '#bc9aff', rgb: [188 / 255, 154 / 255, 1], speed: 0.10, inferred: true }),
  theme: Object.freeze({ id: 'theme', label: 'Title keyword match', color: '#edb56b', rgb: [237 / 255, 181 / 255, 107 / 255], speed: 0.07, inferred: true }),
});

export function routeStyle(edge) {
  if (edge.type === 'theme' || edge.kind === 'title_keyword_match') return ROUTE_STYLES.theme;
  if (edge.inferred) return ROUTE_STYLES.inferred;
  return edge.type === 'credit' || edge.kind === 'credit' ? ROUTE_STYLES.credit : ROUTE_STYLES.relationship;
}

function routeSeed(edge) {
  let hash = 2166136261;
  for (const character of `${edge.from}|${edge.to}|${edge.type || ''}|${edge.kind || ''}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Three straight segments; geometry stays in world space and is cached by the renderer. */
export function routeGeometry(a, b, edge) {
  const dx = b.x - a.x, dy = b.y - a.y, directLength = Math.hypot(dx, dy), seed = routeSeed(edge);
  const bend = Math.min(70, directLength * 0.14) * (seed % 2 ? -1 : 1);
  const nx = directLength ? -dy / directLength * bend : 0, ny = directLength ? dx / directLength * bend : 0;
  const points = [
    { x: a.x, y: a.y },
    { x: a.x + dx * 0.24 + nx, y: a.y + dy * 0.24 + ny },
    { x: a.x + dx * 0.76 + nx, y: a.y + dy * 0.76 + ny },
    { x: b.x, y: b.y },
  ];
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { points, distances, length: distances[3], phase: (seed % 997) / 997 };
}

/** A flow marker advances by arc length, including across corners without a speed jump. */
export function routePointAt(route, progress) {
  const fraction = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const distance = fraction * route.length;
  for (let i = 1; i < route.points.length; i++) {
    if (distance > route.distances[i] && i < route.points.length - 1) continue;
    const a = route.points[i - 1], b = route.points[i], segment = route.distances[i] - route.distances[i - 1];
    const t = segment ? (distance - route.distances[i - 1]) / segment : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return route.points.at(-1);
}
