import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createIndex, graphData, normalizeImport, THEMES } from '../public/ACF/model.js';
import { getRegions, regionRecords, regionFacets } from '../public/ACF/regions.js';

const source = 'https://example.org/evidence';
function fixture() {
  const raw = {
    catalog: { label: 'First catalog' },
    items: [
      { id: 'a', title: 'AI ai climate climate rights', date: '2020-04-03', type: 'article', url: source },
      { id: 'b', title: 'Robots and climate', date: '2023', type: 'event', url: source },
      { id: 'c', title: 'AI', type: 'article', url: source },
      { id: 'd', title: 'Unclassified', date: 'not dated', type: 'article', url: source },
      { id: 'e', title: null, url: source },
    ],
    people: [{ id: 'one', name: 'Same Name' }, { id: 'two', name: 'Other Name' }],
    credits: [
      { itemId: 'a', personId: 'one', role: 'author', sourceUrls: [source] },
      { itemId: 'a', personId: 'one', role: 'editor', sourceUrls: [source] },
      { itemId: 'a', personId: 'two', role: 'reviewer', sourceUrls: [source] },
      { itemId: 'b', personId: 'one', role: 'editor', sourceUrls: [source] },
    ],
  };
  const first = normalizeImport(raw, 'first');
  // Source duplication must not inflate unique-record facets.
  first.credits.push({ ...first.credits[0] });
  const second = normalizeImport({
    catalog: { label: 'Second catalog' },
    items: [{ id: 'a', title: 'AI climate', date: '2018', type: 'article', url: source }],
    people: [{ id: 'one', name: 'Same Name' }],
    credits: [{ itemId: 'a', personId: 'one', role: 'author', sourceUrls: [source] }],
  }, 'second');
  return createIndex([first, second]);
}
const ids = records => records.map(record => record.id);
const counts = entries => Object.fromEntries(entries.map(entry => [entry.id, entry.count]));

test('region membership is unique, overlapping, cached, and preserves unmatched records', () => {
  const index = fixture();
  index.items.push(index.items[0]);
  const result = getRegions(index);
  assert.equal(result, getRegions(index));
  assert.equal(index.graph, undefined, 'membership never prepares graph geometry');
  assert.equal(result.total, 6);
  assert.equal(result.regions.length, 7);
  assert.equal(result.byId.get('minds').count, 4);
  assert.equal(result.byId.get('planet').count, 3);
  assert.equal(result.byId.get('power').count, 1);
  assert.equal(result.unionIds.size, 4);
  assert.deepEqual([...result.unmatchedIds].sort(), ['first:d', 'first:e']);
  assert.equal(result.unmatchedIds, result.byId.get('unmatched').memberIds);
  assert.equal([...result.unionIds].some(id => result.unmatchedIds.has(id)), false);
  assert.equal(result.unionIds.size + result.unmatchedIds.size, result.total);
  assert.notEqual(result.regions.reduce((sum, region) => sum + region.count, 0), result.total, 'overlapping counts cannot be subtracted from total');
});

test('literal title terms and co-membership count unique records, never repeated matches', () => {
  const index = fixture(), result = regionFacets(index, 'minds');
  assert.equal(result, regionFacets(index, 'minds'));
  assert.equal(result.total, 4); assert.equal(result.matched, 4); assert.equal(result.count, 4);
  assert.equal(new Set(ids(result.records)).size, 4);
  assert.deepEqual(counts(result.terms), { ai: 3, robots: 1 });
  assert.deepEqual(counts(result.overlaps), { planet: 3, power: 1 });
  assert.deepEqual(counts(result.collections), { first: 3, second: 1 });
  assert.deepEqual(counts(result.types), { article: 3, event: 1 });
  assert.deepEqual(counts(result.years), { 2023: 1, 2020: 1, 2018: 1, unknown: 1 });
  assert.deepEqual(counts(regionFacets(index, 'unmatched').years), { unknown: 2 });
  assert.deepEqual(regionFacets(index, 'unmatched').terms, []);
  for (const term of result.terms) assert(result.records.some(item => item.title.includes(term.label)), 'displayed spelling is a literal title substring');
});

test('names stay catalog-qualified and duplicate or multiple roles count distinct records', () => {
  const index = fixture(), facets = regionFacets(index, 'minds');
  const names = facets.people.filter(person => person.label === 'Same Name');
  assert.equal(names.length, 2);
  assert.deepEqual(names.map(person => [person.id, person.catalogId, person.catalogLabel, person.count]), [
    ['first:person:one', 'first', 'First catalog', 2],
    ['second:person:one', 'second', 'Second catalog', 1],
  ]);
  assert.deepEqual(counts(names[0].roles), { author: 1, editor: 2 });
  assert.deepEqual(counts(facets.roles), { author: 2, editor: 2, reviewer: 1 });
  assert.deepEqual(ids(regionRecords(index, 'minds', { person: 'first:person:one', role: 'author' })), ['first:a']);
  assert.deepEqual(regionRecords(index, 'minds', { person: 'first:person:one', role: 'reviewer' }), [], 'different credit rows cannot satisfy person+role');
  const filtered = regionFacets(index, 'minds', { person: 'first:person:one' });
  assert.deepEqual(counts(filtered.roles), { author: 1, editor: 2 }, 'role facets use the selected name credit');
  assert.deepEqual(regionFacets(index, 'minds', { role: 'reviewer' }).people.map(person => person.id), ['first:person:two']);
});

test('AND facets preserve unknown dates, empty combinations, and explicit transparent sorts', () => {
  const index = fixture();
  assert.deepEqual(ids(regionRecords(index, 'minds', { term: 'AI', overlap: 'planet', collection: 'first', type: 'article', year: '2020', person: 'first:person:one', role: 'editor' })), ['first:a']);
  assert.deepEqual(ids(regionRecords(index, 'minds', { year: 'unknown' })), ['first:c']);
  assert.deepEqual(ids(regionRecords(index, 'minds', { query: ' SAME  climate ', from: '2020', to: '2021' })), ['first:a']);
  assert.deepEqual(regionRecords(index, 'minds', { year: 'unknown', from: '2000' }), []);
  assert.equal(regionFacets(index, 'minds', { query: 'climate', from: '2020', type: 'article' }).count, 1);
  assert.equal(regionFacets(index, 'minds', { globalType: 'article' }).count, 3);
  assert.equal(regionFacets(index, 'minds', { type: 'article', globalType: 'article' }).count, 3);
  assert.equal(regionFacets(index, 'minds', { type: 'event', globalType: 'article' }).count, 0, 'global and regional type filters intersect rather than override');
  assert.deepEqual(ids(regionRecords(index, 'minds', { sort: 'date-asc' })), ['second:a', 'first:a', 'first:b', 'first:c']);
  assert.deepEqual(ids(regionRecords(index, 'minds', { sort: 'date-desc' })), ['first:b', 'first:a', 'second:a', 'first:c']);
  assert.deepEqual(ids(regionRecords(index, 'minds', { sort: 'title-asc' })), ['first:c', 'first:a', 'second:a', 'first:b']);
  assert.deepEqual(ids(regionRecords(index, 'minds', { sort: 'title-desc' })), ['first:b', 'second:a', 'first:a', 'first:c']);
  assert.deepEqual(regionRecords(index, 'minds', { term: 'climate' }), [], 'literal terms must belong to the selected theme evidence');
  assert.deepEqual(regionRecords(index, 'minds', { overlap: 'unmatched' }), []);
  assert.equal(regionFacets(index, 'not-a-region').count, 0);
  const empty = regionFacets(index, 'minds', { collection: 'missing' });
  assert.equal(empty.total, 4); assert.equal(empty.count, 0);
  for (const key of ['terms', 'overlaps', 'collections', 'types', 'years', 'people', 'roles']) assert.deepEqual(empty[key], []);
});

test('aggregate cache is bounded, lazy, and separate for new collection indexes', () => {
  const index = fixture(), first = regionFacets(index, 'minds');
  for (let i = 0; i < 8; i++) regionFacets(index, 'minds', { year: String(1000 + i) });
  assert.notEqual(regionFacets(index, 'minds'), first, 'eight new combinations evict oldest aggregate');
  const other = fixture();
  assert.notEqual(getRegions(index), getRegions(other));
  assert.equal(index.graph, undefined);
  assert.deepEqual(regionRecords(index, 'minds').map(item => item.id), first.records.map(item => item.id));
});

test('all nine actual catalogs retain full geometry and independently audited region/facet counts', t => {
  const directory = JSON.parse(readFileSync('public/ACF/data/index.json', 'utf8'));
  const catalogs = directory.catalogs.map(entry => JSON.parse(readFileSync('public/ACF/data/' + entry.file, 'utf8')));
  const index = createIndex(catalogs), graph = graphData(index);
  const geometry = () => createHash('sha256').update(JSON.stringify(graph.nodes.map(node => [node.id, node.x, node.y]))).digest('hex');
  const before = geometry(), nodeArray = graph.nodes, memberships = getRegions(index);
  assert.equal(catalogs.length, 9); assert.equal(index.items.length, 33945); assert.equal(index.people.size, 7361);
  const independent = new Map(THEMES.map(([id, , rule]) => [id, new Set(index.items.filter(item => rule.test(item.title)).map(item => item.id))]));
  const union = new Set([...independent.values()].flatMap(memberIds => [...memberIds]));
  const unmatched = new Set(index.items.filter(item => !union.has(item.id)).map(item => item.id));
  assert.deepEqual(memberships.unionIds, union); assert.deepEqual(memberships.unmatchedIds, unmatched);
  assert.equal(union.size + unmatched.size, 33945);
  const observed = {};
  for (const region of memberships.regions) {
    const expected = region.id === 'unmatched' ? unmatched : independent.get(region.id);
    assert.deepEqual(region.memberIds, expected);
    const facets = regionFacets(index, region.id);
    assert.equal(facets.count, expected.size);
    assert.deepEqual(new Set(ids(facets.records)), expected);
    assert.equal(facets.collections.reduce((sum, entry) => sum + entry.count, 0), expected.size);
    assert.equal(facets.types.reduce((sum, entry) => sum + entry.count, 0), expected.size);
    assert.equal(facets.years.reduce((sum, entry) => sum + entry.count, 0), expected.size);
    for (const overlap of facets.overlaps) assert.equal(overlap.count, [...expected].filter(id => independent.get(overlap.id).has(id)).length);
    for (const term of facets.terms) {
      const independentlyMatched = facets.records.filter(item => (item.themeEvidence || []).some(evidence => evidence.themeId === region.id && evidence.terms.some(word => word.toLocaleLowerCase() === term.id)));
      assert.equal(term.count, independentlyMatched.length);
    }
    for (const person of facets.people) {
      const credits = index.byPerson.get(person.id) || [];
      assert.equal(person.count, new Set(credits.filter(credit => expected.has(credit.itemId)).map(credit => credit.itemId)).size);
      for (const role of person.roles) assert.equal(role.count, new Set(credits.filter(credit => credit.role === role.id && expected.has(credit.itemId)).map(credit => credit.itemId)).size);
    }
    observed[region.id] = { count: facets.count, unknownDates: facets.years.find(year => year.id === 'unknown')?.count || 0, nameLabels: facets.people.length };
  }
  assert.equal(graphData(index), graph);
  assert.equal(graph.nodes, nodeArray);
  assert.equal(graph.counts.items, 33945);
  assert.equal(geometry(), before, 'faceting cannot change any point identity/coordinate');
  t.diagnostic(JSON.stringify({ total: 33945, matchedUnion: union.size, unmatched: unmatched.size, geometryHash: before, regions: observed }));
});
