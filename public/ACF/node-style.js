const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const STYLES = Object.freeze({
  work: { glyph: 0, radius: 0.72, growth: 0.68, brightness: 0.42, gain: 0.16, connections: 24 },
  person: { glyph: 1, radius: 1.15, growth: 2.15, brightness: 0.48, gain: 0.34, connections: 64 },
  source: { glyph: 2, radius: 3.6, growth: 1.9, brightness: 0.7, gain: 0.2, connections: 256 },
  theme: { glyph: 3, radius: 4.2, growth: 0, brightness: 0.38, gain: 0, connections: 1 },
});

/** Presentation only: source identity must be supplied, never inferred from a name or degree. */
export function nodeAppearance(node, zoom = 1, { selected = false, connectionCount } = {}) {
  const role = node.visualType || node.visualRole;
  const type = Object.hasOwn(STYLES, role) ? role : node.kind === 'person' ? 'person' : node.kind === 'hub' ? 'theme' : 'work';
  const style = STYLES[type], rawCount = connectionCount ?? node.connectionCount ?? 0;
  const count = Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0;
  // Fixed logarithmic bands make degree comparable across filters. Theme counts are not degree.
  const emphasis = type === 'theme' ? 0 : clamp(Math.log1p(count) / Math.log1p(style.connections), 0, 1);
  const distance = Number.isFinite(zoom) ? clamp(zoom, 0.4, 64) : 1;
  const detail = clamp(Math.log2(Math.max(1, distance)) / 4, 0, 1);
  const baseRadius = style.radius + style.growth * emphasis;
  const radius = clamp(baseRadius * Math.sqrt(distance) * (selected ? 1.65 : 1), 0.6, 18);
  const baseBrightness = style.brightness + style.gain * emphasis;
  const brightness = clamp(baseBrightness * (type === 'work' ? Math.sqrt(Math.min(1, distance)) + detail * (0.16 / 0.42) : 1), 0, 0.96);
  // No outward glow: high-degree glyphs stay bounded, preserving nearby work stars.
  return { type, glyph: style.glyph, radius, baseRadius, brightness, alpha: brightness, emphasis, haloRadius: radius, haloAlpha: 0 };
}

/** Preserve the actual pre-zoom appearance when a comparison is interrupted.
 * Recomputing logarithmic degree styling from an interpolated count would jump. */
export function nodeEndpointAppearance(node, endpoint = {}) {
  const style = nodeAppearance(node, 1, { connectionCount: endpoint.connectionCount });
  const radius = Number.isFinite(endpoint.baseRadius) ? clamp(endpoint.baseRadius, 0.6, 18) : style.baseRadius;
  const brightness = Number.isFinite(endpoint.brightness) ? clamp(endpoint.brightness, 0, 0.96) : style.brightness;
  return { ...style, baseRadius: radius, radius, haloRadius: radius, brightness, alpha: brightness };
}

/** Append one silhouette to an existing path, allowing full-record Canvas batching. */
export function appendNodeGlyph(ctx, type, x, y, radius) {
  if (type === 'person') {
    ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y); ctx.closePath();
  } else if (type === 'source') {
    ctx.moveTo(x + radius, y);
    for (let side = 1; side < 6; side++) { const angle = side * Math.PI / 3; ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius); }
    ctx.closePath();
  } else {
    ctx.moveTo(x + radius, y); ctx.arc(x, y, radius, 0, Math.PI * 2);
  }
}

/** The same silhouette for focus/route overlays and the full Canvas fallback. */
export function drawNodeGlyph(ctx, node, { x, y, radius, color, opacity = 1 }) {
  const { type } = nodeAppearance(node);
  ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.8, radius * 0.13); ctx.beginPath();
  appendNodeGlyph(ctx, type, x, y, radius);
  if (type === 'source' || type === 'theme') ctx.stroke(); else ctx.fill();
  if (type === 'source') {
    ctx.beginPath(); appendNodeGlyph(ctx, 'person', x, y, Math.max(0.55, radius * 0.18)); ctx.fill();
  }
  ctx.restore();
}
