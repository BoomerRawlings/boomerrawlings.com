import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIndex, graphData, normalizeImport } from '../public/ACF/model.js';
import { comparePublications, publicationColor } from '../public/ACF/publication-comparison.js';
import { comparisonBounds, comparisonLayout } from '../public/ACF/comparison-layout.js';

const url = 'https://example.org/source';
const ids = values => [...values].sort();
function fixture(count = 3) {
  const catalogs = Array.from({ length: count }, (_, i) => normalizeImport({ catalog: { label: `Catalog ${i}` },
    items: [{ id: 'a', title: 'AI and climate', date: '2024', type: 'article', url },
      { id: 'b', title: 'Climate', date: '2025', type: 'event', url }],
    people: [{ id: 'person', name: 'Same Name' }],
    credits: [{ itemId: 'a', personId: 'person', role: 'author', sourceUrls: [url] },
      { itemId: 'a', personId: 'person', role: 'editor', sourceUrls: [url] }],
    relationships: [{ from: 'a', to: 'b', kind: 'links_to', basis: 'Source link', sourceUrls: [url] }],
  }, `catalog-${i}`));
  return { catalogs, index: createIndex(catalogs) };
}

test('publication comparison preserves catalog identity without invented bridges', () => {
  const { index } = fixture();
  const graph = graphData(index), before = JSON.stringify(graph.nodes);
  const result = comparePublications(index, ['catalog-1', 'catalog-0', 'catalog-0', 'missing']);
  assert.equal(result.kind, 'publications');
  assert.deepEqual(result.groups.map(group => group.id), ['catalog-0', 'catalog-1']);
  assert.deepEqual(ids(result.memberIds), ['catalog-0:a', 'catalog-0:b', 'catalog-1:a', 'catalog-1:b']);
  assert.equal(result.records.length, result.memberIds.size);
  assert.equal(result.personIds.size, 2, 'same label remains two source-local people');
  assert.equal(result.sharedPeople.length, 0);
  assert.equal(result.relationships.length, 0, 'matching titles and themes do not bridge catalogs');
  assert.equal(result.counts.internalRelationships, 2);
  assert.equal(result.counts.credits, 4, 'role assertions remain evidence');
  assert.equal(result.counts.total, 4);
  assert.equal(result.counts.groups, 2);
  assert.equal(result.edges.filter(edge => edge.type === 'theme').length, 0);
  assert(result.edges.every(edge => graph.edges.includes(edge)));
  assert(result.edges.every(edge => edge.sourceUrls?.length));
  assert.equal(result, comparePublications(index, ['catalog-0', 'catalog-1']));
  assert.equal(comparePublications(index, ['catalog-0']), null);
  assert.equal(comparePublications(index, ['catalog-0', 'missing']), null);
  assert.equal(JSON.stringify(graph.nodes), before);
});

test('explicit cross-source records retain relationship evidence and source-local names', () => {
  const { catalogs } = fixture();
  catalogs[0].relationships.push({ from: 'catalog-0:a', to: 'catalog-1:a', kind: 'links_to', basis: 'Explicit source link', sourceUrls: [url] });
  catalogs[1].relationships.push({ from: 'catalog-1:b', to: 'catalog-0:b', kind: 'possibly_same_event', basis: 'Source-qualified possible event match', sourceUrls: [url] });
  catalogs[1].credits.push({ itemId: 'catalog-1:a', personId: 'catalog-0:person:person', role: 'author', sourceUrls: [url] });
  const index = createIndex(catalogs), graph = graphData(index), result = comparePublications(index, ['catalog-0', 'catalog-1']);
  assert.equal(result.relationships.length, 2);
  assert.equal(result.counts.documentedRelationships, 1);
  assert.equal(result.counts.inferredRelationships, 1);
  assert(result.relationships.every(edge => graph.edges.includes(edge)), 'source edge object and provenance survive');
  assert.deepEqual(ids(result.bridgePersonIds), ['catalog-0:person:person']);
  assert.equal(result.sharedPeople.length, 1);
  assert.deepEqual(result.sharedPeople[0].groups, [{ id: 'catalog-0', count: 1 }, { id: 'catalog-1', count: 1 }], 'roles count one credited record once');
  assert.equal(result.personIds.size, 2, 'explicit bridge does not merge another equal name');
});

test('filters retain empty selected groups and exclude hidden endpoints', () => {
  const { index } = fixture();
  const result = comparePublications(index, ['catalog-0', 'catalog-1'], { from: '2025', type: 'event' });
  assert.equal(result.counts.total, 2);
  assert.equal(result.counts.people, 0);
  assert.equal(result.edges.length, 0);
  assert(result.groups.every(group => group.total === 2 && group.memberIds.size === 1));
  const empty = comparePublications(index, ['catalog-0', 'catalog-1'], { query: 'no source has these words' });
  assert.equal(empty.groups.length, 2);
  assert.equal(empty.records.length, 0);
  const layout = comparisonLayout(empty, graphData(index).byId);
  assert.equal(layout.visible.size, 0);
  assert.equal(layout.annotations.length, 2);
  assert(layout.annotations.every(annotation => annotation.lines[0].startsWith('0 records')));
  const noRecords = createIndex([{ catalog: { id: 'empty', label: 'Empty source' }, items: [], people: [], credits: [] },
    { catalog: { id: 'other', label: 'Other source' }, items: [], people: [], credits: [] }]);
  const emptyCatalogs = comparePublications(noRecords, ['empty', 'other']);
  assert.equal(emptyCatalogs.groups.length, 2);
  assert.equal(emptyCatalogs.counts.total, 0);
});

test('two through nine catalog groups have deterministic bounded layouts and real endpoints', () => {
  const { index } = fixture(9), graph = graphData(index), before = JSON.stringify(graph.nodes);
  const available = [...index.catalogById.keys()];
  for (let count = 2; count <= 9; count++) for (const vertical of [false, true]) {
    const config = comparePublications(index, available.slice(0, count));
    const layout = comparisonLayout(config, graph.byId, vertical, { pixelScale: 0.3, zoom: 1.2 });
    assert.equal(layout.visible.size, count * 3);
    assert.equal(layout.groups.length, count);
    assert.equal(layout.annotations.length, count);
    assert.deepEqual(layout.bounds, comparisonBounds(config, vertical));
    assert.deepEqual([...layout.targets], [...comparisonLayout(config, graph.byId, vertical, { pixelScale: 0.3, zoom: 1.2 }).targets]);
    assert.equal(new Set(layout.groups.map(group => `${group.x}:${group.y}`)).size, count);
    for (const [id, point] of layout.targets) {
      assert(graph.byId.has(id), 'no manufactured catalog hub');
      const group = layout.groups.find(group => group.id === graph.byId.get(id).catalogId);
      assert(point.x >= group.bounds.left && point.x <= group.bounds.right);
      assert(point.y >= group.bounds.top && point.y <= group.bounds.bottom);
      assert(point.x >= layout.bounds.left && point.x <= layout.bounds.right);
      assert(point.y >= layout.bounds.top && point.y <= layout.bounds.bottom);
    }
    for (const edge of layout.edges) assert(layout.visible.has(edge.from) && layout.visible.has(edge.to));
    assert.equal(layout.connectionCounts.get('catalog-0:person:person'), 1, 'duplicate credit roles do not inflate brightness');
  }
  assert.equal(JSON.stringify(graph.nodes), before, 'canonical coordinates remain unchanged');
  assert.equal(publicationColor('ieet'), publicationColor('ieet'));
  assert.equal(publicationColor('local-import'), publicationColor('local-import'));
});

test('all nine public catalogs remain complete and source-qualified in publication comparison', () => {
  const root = new URL('../public/ACF/data/', import.meta.url);
  const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
  const index = createIndex(read('index.json').catalogs.map(catalog => read(catalog.file))), graph = graphData(index);
  const result = comparePublications(index, [...index.catalogById.keys()]);
  assert.equal(result.groups.length, 9);
  assert.equal(result.memberIds.size, index.items.length);
  assert.equal(result.groups.reduce((sum, group) => sum + group.memberIds.size, 0), index.items.length);
  assert.equal(result.relationships.length, 0, 'public source catalogs currently contain no cross-catalog record endpoint pairs');
  assert.equal(result.sharedPeople.length, 0, 'public credited identities are catalog-local');
  const edgeSet = new Set(graph.edges);
  assert(result.edges.every(edge => edgeSet.has(edge) && edge.sourceUrls?.length));
  const layout = comparisonLayout(result, graph.byId, false, { pixelScale: 0.5, zoom: 1.2 });
  assert.equal(layout.visible.size, result.memberIds.size + result.personIds.size);
  assert.equal(layout.annotations.length, 9);
  assert(layout.edges.every(edge => layout.visible.has(edge.from) && layout.visible.has(edge.to)));
});
