import test from 'node:test';
import assert from 'node:assert/strict';
import { createIndex, normalizeImport } from '../public/ACF/model.js';
import { getRegions } from '../public/ACF/regions.js';
import { compareTerritories } from '../public/ACF/comparison.js';
import { territoryGuide } from '../public/ACF/territory-guide.js';

const index = createIndex([normalizeImport({ catalog: { label: 'Guide fixture' }, items: [
  { id: 'minds', title: 'Robot minds', url: 'https://example.org/minds' },
  { id: 'planet', title: 'Climate', url: 'https://example.org/planet' },
  { id: 'shared', title: 'AI and climate', url: 'https://example.org/shared' },
] }, 'guide')]);
const byId = getRegions(index).byId;
const guide = (selectedIds, filters) => territoryGuide({ selectedIds, byId,
  comparison: selectedIds.length === 2 ? compareTerritories(index, ...selectedIds, filters) : null });

test('directions follow first, second, comparison, removal and reset without retained tour state', () => {
  const steps = [[], ['minds'], ['minds', 'planet'], ['planet'], []];
  assert.deepEqual(steps.map(ids => guide(ids).phase), ['first', 'second', 'compare', 'second', 'first']);
  assert.match(guide(['minds']).body, /Minds & machines/);
  assert.match(guide(['planet']).body, /Planet & possibility/);
  assert.deepEqual(guide([]), guide(steps.at(-1)));
});

test('comparison directions distinguish actual overlap from disjoint and filtered-empty views', () => {
  assert.match(guide(['minds', 'planet']).body, /^Shared records sit between/);
  assert.match(guide(['minds', 'planet'], { query: 'robot' }).body, /^No shared records/);
  const empty = guide(['minds', 'planet'], { query: 'no matching title' });
  assert.equal(empty.phase, 'compare');
  assert.match(empty.title, /No matching records/);
  assert.match(empty.body, /Clear filters/);
});

test('duplicate and unavailable selections do not falsely advance the guide', () => {
  assert.equal(guide(['missing']).phase, 'first');
  assert.equal(guide(['minds', 'minds']).phase, 'second');
  assert.equal(guide(['missing', 'planet']).phase, 'second');
});

test('stale comparison evidence cannot claim overlap for a different selected pair', () => {
  const comparison = compareTerritories(index, 'minds', 'planet');
  const result = territoryGuide({ selectedIds: ['minds', 'power'], byId, comparison });
  assert.equal(result.phase, 'compare');
  assert.doesNotMatch(result.body, /Shared records sit|No shared records|No records match/);
});

test('deriving directions does not mutate source membership, selection or comparison', () => {
  const selectedIds = Object.freeze(['minds', 'planet']);
  const comparison = compareTerritories(index, ...selectedIds);
  const source = JSON.stringify(index.items), shared = [...comparison.shared], memberships = [...byId.get('minds').memberIds];
  territoryGuide({ selectedIds, byId, comparison });
  assert.equal(JSON.stringify(index.items), source);
  assert.deepEqual([...comparison.shared], shared);
  assert.deepEqual([...byId.get('minds').memberIds], memberships);
});
