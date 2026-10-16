import { connectionCounts, clearNodeSpace } from './node-layout.js?v=sources-20261015';

function unit(value) {
  let hash = 2166136261;
  for (const c of value) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

function publicationGrid(count, vertical) {
  const columns = vertical ? (count <= 3 ? 1 : 2) : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return { columns, rows, width: columns * 720, height: rows * 680 };
}

/** World-space framing used before spacing is calculated at its final scale. */
export function comparisonBounds(config, vertical = false) {
  if (config.kind !== 'publications') return vertical
    ? { left: -365, right: 365, top: -865, bottom: 865 }
    : { left: -865, right: 865, top: -365, bottom: 365 };
  const { width, height } = publicationGrid(config.groups.length, vertical);
  return { left: -width / 2, right: width / 2, top: -height / 2, bottom: height / 2 };
}

function publicationLayout(config, byId, vertical, options) {
  const bounds = comparisonBounds(config, vertical), { columns, rows } = publicationGrid(config.groups.length, vertical);
  const targets = new Map(), visible = new Set(), groups = config.groups.map((group, i) => {
    const row = Math.floor(i / columns), remaining = Math.min(columns, config.groups.length - row * columns);
    const x = (i % columns - (remaining - 1) / 2) * 720, y = (row - (rows - 1) / 2) * 680 + 22;
    return { ...group, x, y, center: { x, y }, labelPoint: { x, y: y - 310 },
      bounds: { left: x - 325, right: x + 325, top: y - 225, bottom: y + 270 } };
  });
  const byCatalog = new Map(groups.map(group => [group.id, group]));
  const nodeGroups = new Map();
  const put = (id, group) => {
    const node = byId.get(id);
    if (!node || !group || targets.has(id)) return;
    const angle = unit(`publication-angle:${id}`) * Math.PI * 2;
    const radius = Math.sqrt(unit(`publication-radius:${id}`));
    const ring = node.kind === 'person' ? 0.82 + radius * 0.18 : radius * 0.88;
    const x = group.x + Math.cos(angle) * ring * 300, y = group.y + 22 + Math.sin(angle) * ring * 225;
    targets.set(id, { x, y, color: group.color, opacity: node.kind === 'item' && node.visualType !== 'source' ? 1.35 : 1 });
    visible.add(id); nodeGroups.set(id, group);
  };
  for (const group of groups) for (const id of group.memberIds) put(id, group);
  for (const id of config.personIds) {
    // Names stay with their source catalog when available. Explicit cross-source
    // credits remain edges; an equal name in another catalog is a distinct node.
    const group = byCatalog.get(byId.get(id)?.catalogId) || groups.find(candidate => candidate.personIds.has(id));
    put(id, group);
  }
  const edges = config.edges.filter(edge => visible.has(edge.from) && visible.has(edge.to));
  const copies = [...targets].map(([id, target]) => ({ ...byId.get(id), ...target, layoutBounds: nodeGroups.get(id).bounds }));
  const counts = connectionCounts(copies, edges), cleared = clearNodeSpace(copies, counts, bounds, options);
  for (const [id, point] of cleared) targets.set(id, { ...targets.get(id), ...point });
  const format = value => new Intl.NumberFormat().format(value);
  const annotations = groups.map(group => ({ key: group.id, title: group.label, color: group.color, point: group.labelPoint,
    lines: [`${format(group.memberIds.size)} records · ${format(group.personIds.size)} credited names`, 'Source catalog'] }));
  return { targets, visible, edges, bounds, vertical, connectionCounts: counts, groups, annotations };
}

/** A temporary explanatory arrangement; never changes source or model positions. */
export function comparisonLayout(config, byId, vertical = false, { pixelScale = 1, zoom = 1 } = {}) {
  if (config.kind === 'publications') return publicationLayout(config, byId, vertical, { pixelScale, zoom });
  const targets = new Map(), visible = new Set(), leftPeople = new Set(), rightPeople = new Set(), sides = new Map();
  const transform = (x, y) => vertical ? { x: y, y: x } : { x, y };
  const left = config.left.memberIds, right = config.right.memberIds;
  for (const edge of config.edges) {
    const a = byId.get(edge.from), b = byId.get(edge.to);
    const person = a?.kind === 'person' ? a : b?.kind === 'person' ? b : null, record = a?.kind === 'item' ? a : b?.kind === 'item' ? b : null;
    if (person && record) {
      if (left.has(record.id)) leftPeople.add(person.id);
      if (right.has(record.id)) rightPeople.add(person.id);
    }
  }
  const put = (id, side, kind) => {
    const node = byId.get(id); if (!node) return;
    const angle = unit(`compare-angle:${id}`) * Math.PI * 2, radial = Math.sqrt(unit(`compare-radius:${id}`));
    let x, y;
    if (side === 0) {
      x = kind === 'person' ? (unit(`compare-lane:${id}`) < 0.5 ? -1 : 1) * (78 + radial * 30) : Math.cos(angle) * radial * 35;
      y = (unit(`compare-bridge:${id}`) - 0.5) * (kind === 'person' ? 680 : 580);
    } else if (kind === 'hub') { x = side * 490; y = -25; }
    else {
      const radius = kind === 'person' ? 0.94 + radial * 0.2 : radial * 0.88;
      x = side * 490 + Math.cos(angle) * radius * 300;
      y = Math.sin(angle) * radius * 285;
    }
    const color = side < 0 ? config.left.color : side > 0 ? config.right.color : '#f2d5aa';
    // Leave headroom for degree-based brightness; boosting source/name glyphs
    // above one would clip every well-connected account to the same intensity.
    targets.set(id, { x, y, color, opacity: kind === 'item' && node.visualType !== 'source' ? 1.35 : 1 }); visible.add(id); sides.set(id, side);
  };
  for (const id of config.memberIds) put(id, config.shared.has(id) ? 0 : left.has(id) ? -1 : 1, 'item');
  for (const id of config.personIds) put(id, config.bridgePersonIds.has(id) || (leftPeople.has(id) && rightPeople.has(id)) ? 0 : leftPeople.has(id) ? -1 : 1, 'person');
  for (const [region, side] of [[config.left, -1], [config.right, 1]]) {
    const id = byId.has(region.id) ? region.id : `@theme:${region.id}`;
    if (byId.get(id)?.kind === 'hub') put(id, side, 'hub');
  }
  // Only source-supplied edges, and every endpoint must be in this actual view.
  const edges = config.edges.filter(edge => visible.has(edge.from) && visible.has(edge.to));
  const horizontalBounds = { left: -865, right: 865, top: -365, bottom: 365 };
  const copies = [...targets].map(([id, target]) => {
    const side = sides.get(id);
    const layoutBounds = { left: side < 0 ? -840 : side > 0 ? 145 : -122,
      right: side < 0 ? -145 : side > 0 ? 840 : 122, top: -350, bottom: 350 };
    return { ...byId.get(id), ...target, layoutBounds };
  });
  const counts = connectionCounts(copies, edges);
  const cleared = clearNodeSpace(copies, counts, horizontalBounds, { pixelScale, zoom });
  for (const [id, point] of cleared) targets.set(id, { ...targets.get(id), ...transform(point.x, point.y) });
  const bounds = vertical ? { left: -365, right: 365, top: -865, bottom: 865 } : { left: -865, right: 865, top: -365, bottom: 365 };
  return { targets, visible, edges, bounds, vertical, connectionCounts: counts };
}
