import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { connectionCounts, clearNodeSpace } from '../public/ACF/node-layout.js';
import { comparisonLayout } from '../public/ACF/comparison-layout.js';
import { SpatialGrid } from '../public/ACF/graph-spatial.js';
import { nodeAppearance } from '../public/ACF/node-style.js';

const bounds = { left: -1400, right: 1400, top: -1100, bottom: 1100 };
let checks = 0;
function check(name, test) { test(); checks++; console.log(`ok ${checks} - ${name}`); }
const node = (id, kind = 'item', x = 0, y = 0, visualType) => ({ id, kind, x, y, visualType });

check('degree counts unique real endpoints and retains inferred record links', () => {
  const nodes = [node('a'), node('b'), node('c'), node('p', 'person'), node('t', 'hub')];
  const edges = [{ from: 'a', to: 'b', type: 'relationship' }, { from: 'b', to: 'a', type: 'relationship' },
    { from: 'b', to: 'c', type: 'relationship', inferred: true }, { from: 'p', to: 'a', type: 'credit', role: 'author' },
    { from: 'p', to: 'a', type: 'credit', role: 'editor' }, { from: 't', to: 'a', type: 'theme' },
    { from: 't', to: 'b' }, { from: 'a', to: 'c', type: 'theme' }, { from: 'a', to: 'a' }, { from: 'a', to: 'missing' }];
  assert.deepEqual([...connectionCounts(nodes, edges)], [['a', 2], ['b', 2], ['c', 1], ['p', 1], ['t', 0]]);
});

check('source clearance grows with degree and subject membership never inflates a theme', () => {
  const nodes = [node('source', 'person', 0, 0, 'source'), node('near')];
  const low = clearNodeSpace(nodes, new Map([['source', 0]]), bounds);
  const high = clearNodeSpace(nodes, new Map([['source', 256]]), bounds);
  const distance = points => Math.hypot(points.get('near').x - points.get('source').x, points.get('near').y - points.get('source').y);
  assert(distance(low) > 20); assert(distance(high) > distance(low));
  const theme = [node('subject', 'hub'), node('near')];
  assert.deepEqual(clearNodeSpace(theme, new Map([['subject', 0]]), bounds), clearNodeSpace(theme, new Map([['subject', 50000]]), bounds));
});

check('themes stay fixed and theme-only fields retain nearby and offscreen targets', () => {
  const nodes = [node('subject', 'hub', 550, -400), node('near', 'item', 550, -400),
    node('edge', 'item', 1399, 1099), node('offscreen', 'item', 5000, -5000)];
  const expected = new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]));
  for (const pixelScale of [1, 320 / 2800, 0.001]) {
    assert.deepEqual(clearNodeSpace(nodes, new Map([['subject', 50000]]), bounds, { pixelScale, zoom: 0.4 }), expected);
  }
  const source = node('source', 'person', 550, -400, 'source');
  const withSource = clearNodeSpace([...nodes, source], new Map([['source', 256], ['subject', 50000]]), bounds, { pixelScale: 320 / 2800 });
  assert.deepEqual(withSource.get('subject'), expected.get('subject'));
  assert.deepEqual(withSource.get('source'), { x: source.x, y: source.y }, 'hollow themes do not repel evidence sources');
});

check('deterministic targets preserve original nodes and respect individual regions', () => {
  const nodes = [node('source', 'person', 0, 0, 'source'), node('person', 'person'), node('work'), node('boundary', 'item', 5000, -5000)];
  nodes[1].layoutBounds = { left: 20, right: 100, top: -100, bottom: 100 };
  const frozen = JSON.stringify(nodes), counts = new Map([['person', 25]]);
  const first = clearNodeSpace(nodes, counts, bounds), second = clearNodeSpace([...nodes].reverse(), counts, bounds);
  for (const [id, point] of first) assert.deepEqual(point, second.get(id));
  assert.equal(JSON.stringify(nodes), frozen); assert.equal(first.size, nodes.length);
  assert(first.get('person').x >= 20 && first.get('person').x <= 100);
  for (const point of first.values()) assert(point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom);
});

check('320px camera clearance separates the actual source and work glyphs', () => {
  const nodes = [node('source', 'person', 0, 0, 'source'), node('near')];
  const pixelScale = 320 / (bounds.right - bounds.left), zoom = 1;
  const counts = new Map([['source', 256]]), points = clearNodeSpace(nodes, counts, bounds, { pixelScale, zoom });
  const distance = Math.hypot(points.get('source').x - points.get('near').x, points.get('source').y - points.get('near').y) * pixelScale;
  const glyphRadii = nodeAppearance(nodes[0], zoom, { connectionCount: 256 }).radius + nodeAppearance(nodes[1], zoom).radius;
  assert(distance >= glyphRadii + 3, `${distance}px must clear ${glyphRadii}px of glyphs plus padding`);
  assert.deepEqual(points.get('source'), { x: 0, y: 0 });
  const distant = clearNodeSpace(nodes, counts, bounds, { pixelScale: pixelScale * 0.4, zoom: 0.4 });
  const distantDistance = Math.hypot(distant.get('source').x - distant.get('near').x, distant.get('source').y - distant.get('near').y) * pixelScale * 0.4;
  assert(distantDistance >= nodeAppearance(nodes[0], 0.4, { connectionCount: 256 }).radius + nodeAppearance(nodes[1], 0.4).radius + 3);
});

check('comparison clearance retains sides, endpoint targets, edges and exact vertical transpose', () => {
  const nodes = [node('left'), node('right'), node('shared'), node('source', 'person', 20, 10, 'source'), node('@theme:minds', 'hub'), node('@theme:power', 'hub')];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const config = { left: { id: 'minds', memberIds: new Set(['left', 'shared']), color: '#abcdef' },
    right: { id: 'power', memberIds: new Set(['right', 'shared']), color: '#fedcba' },
    memberIds: new Set(['left', 'right', 'shared']), shared: new Set(['shared']), personIds: new Set(['source']), bridgePersonIds: new Set(['source']),
    edges: [{ from: 'source', to: 'left', type: 'credit' }, { from: 'source', to: 'right', type: 'credit' }, { from: '@theme:minds', to: 'left', type: 'theme' }] };
  const before = JSON.stringify(nodes), horizontal = comparisonLayout(config, byId), vertical = comparisonLayout(config, byId, true);
  assert(horizontal.targets.get('left').x <= -145); assert(horizontal.targets.get('right').x >= 145);
  for (const id of ['shared', 'source']) assert(Math.abs(horizontal.targets.get(id).x) <= 122);
  for (const [id, point] of horizontal.targets) assert.deepEqual(vertical.targets.get(id), { ...point, x: point.y, y: point.x });
  for (const edge of horizontal.edges) { assert(horizontal.targets.has(edge.from)); assert(horizontal.targets.has(edge.to)); assert(config.edges.includes(edge)); }
  const picking = new SpatialGrid([...horizontal.targets].map(([id, point]) => ({ ...byId.get(id), ...point })));
  for (const [id, point] of horizontal.targets) assert(picking.query(point.x, point.y, point.x, point.y).some(n => n.id === id));
  assert.equal(horizontal.connectionCounts.get('source'), 2); assert.equal(horizontal.connectionCounts.get('@theme:minds'), 0);
  assert.equal(JSON.stringify(nodes), before);
  const phone = { pixelScale: 320 / 1730, zoom: 1.3 };
  const narrow = comparisonLayout(config, byId, false, phone), tall = comparisonLayout(config, byId, true, phone);
  for (const [id, point] of narrow.targets) assert.deepEqual(tall.targets.get(id), { ...point, x: point.y, y: point.x });
  assert.deepEqual(narrow.targets.get('@theme:minds'), { ...narrow.targets.get('@theme:minds'), x: -490, y: -25 });
});

check('saturated coincident anchors remain bounded and no IDs are dropped', () => {
  const nodes = Array.from({ length: 2048 }, (_, i) => node(`crowded${i}`, 'person', 0, 0, 'source'));
  const small = { left: -80, right: 80, top: -80, bottom: 80 };
  const points = clearNodeSpace(nodes, new Map(), small, { pixelScale: 0.001, zoom: 0.4 });
  assert.equal(points.size, nodes.length);
  for (const point of points.values()) assert(point.x >= -80 && point.x <= 80 && point.y >= -80 && point.y <= 80);
});

check('34,000 nodes use bounded local work and return every original ID', () => {
  const nodes = Array.from({ length: 34000 }, (_, i) => node(`n${i}`, i % 120 === 0 ? 'person' : 'item', (i * 47 % 2700) - 1350, (i * 83 % 2100) - 1050, i % 120 === 0 ? 'source' : 'work'));
  const edges = nodes.slice(1).map((n, i) => ({ from: nodes[Math.floor(i / 120) * 120].id, to: n.id, type: 'credit' }));
  const start = performance.now(), counts = connectionCounts(nodes, edges), targets = clearNodeSpace(nodes, counts, bounds);
  assert.equal(targets.size, 34000); assert.equal(counts.size, 34000);
  for (const n of nodes) { const p = targets.get(n.id); assert(p && Number.isFinite(p.x) && Number.isFinite(p.y)); assert(p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.top && p.y <= bounds.bottom); }
  console.log(JSON.stringify({ nodes: nodes.length, edges: edges.length, elapsedMs: Math.round(performance.now() - start), heapUsedBytes: process.memoryUsage().heapUsed, rssBytes: process.memoryUsage().rss }));
});

console.log(`${checks} node layout checks passed`);
