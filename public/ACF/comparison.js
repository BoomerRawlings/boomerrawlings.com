import { filterItems, graphData } from './model.js?v=reset-20261013';
import { getRegions } from './regions.js?v=reset-20261013';

const caches = new WeakMap();
const compare = (a, b) => String(a).localeCompare(String(b), 'en');

/** A temporary view of existing evidence. Never synthesizes record-to-record
 * links from names, proximity, shared subject words, or coincident positions. */
export function compareTerritories(index, leftId, rightId, filters = {}) {
  const regions = getRegions(index).byId;
  if (leftId === rightId || !regions.has(leftId) || !regions.has(rightId)) return null;
  const active = Object.fromEntries(['query', 'type', 'from', 'to'].map(key => [key, String(filters[key] || '')]));
  const key = JSON.stringify([leftId, rightId, active]);
  let cache = caches.get(index);
  if (!cache) { cache = new Map(); caches.set(index, cache); }
  if (cache.has(key)) return cache.get(key);
  const available = new Set(filterItems(index, active).map(item => item.id));
  const side = id => {
    const region = regions.get(id);
    return { id, label: region.label, color: region.color, total: region.count,
      memberIds: new Set([...region.memberIds].filter(itemId => available.has(itemId))) };
  };
  const left = side(leftId), right = side(rightId);
  const leftOnly = new Set(), rightOnly = new Set(), shared = new Set();
  for (const id of left.memberIds) (right.memberIds.has(id) ? shared : leftOnly).add(id);
  for (const id of right.memberIds) if (!left.memberIds.has(id)) rightOnly.add(id);
  const memberIds = new Set([...left.memberIds, ...right.memberIds]);
  const records = index.items.filter(item => memberIds.has(item.id));
  const personIds = new Set(), bridgePersonIds = new Set(), sharedPeople = [];
  for (const id of memberIds) for (const credit of index.byItem.get(id) || []) personIds.add(credit.personId);
  for (const id of personIds) {
    const credits = index.byPerson.get(id) || [];
    const leftCredits = credits.filter(credit => left.memberIds.has(credit.itemId));
    const rightCredits = credits.filter(credit => right.memberIds.has(credit.itemId));
    if (!leftCredits.length || !rightCredits.length) continue;
    const person = index.people.get(id);
    const unique = rows => new Set(rows.map(credit => credit.itemId));
    const leftItems = unique(leftCredits), rightItems = unique(rightCredits);
    sharedPeople.push({ id, label: person?.name || id, catalogId: person?.catalogId,
      catalogLabel: index.catalogById.get(person?.catalogId)?.label || 'Loaded collection',
      leftCount: leftItems.size, rightCount: rightItems.size,
      leftExclusiveCount: [...leftItems].filter(itemId => leftOnly.has(itemId)).length,
      rightExclusiveCount: [...rightItems].filter(itemId => rightOnly.has(itemId)).length,
      sharedCount: [...leftItems].filter(itemId => shared.has(itemId)).length,
      leftCredits, rightCredits });
  }
  for (const person of sharedPeople) if (person.leftExclusiveCount && person.rightExclusiveCount) bridgePersonIds.add(person.id);
  sharedPeople.sort((a, b) => compare(a.label, b.label) || compare(a.id, b.id));
  const graph = graphData(index);
  const selectedHubs = new Set([`@theme:${leftId}`, `@theme:${rightId}`]);
  const edges = graph.edges.filter(edge => edge.type === 'credit'
    ? personIds.has(edge.from) && memberIds.has(edge.to)
    : edge.type === 'theme' ? selectedHubs.has(edge.from) && memberIds.has(edge.to)
      : memberIds.has(edge.from) && memberIds.has(edge.to));
  // A direct bridge joins exclusive sides. A link through an overlapping record
  // is stated separately; relations wholly inside shared membership are internal.
  const relationships = [];
  for (const edge of edges) {
    if (edge.type !== 'relationship' || edge.from === edge.to) continue;
    const direct = (leftOnly.has(edge.from) && rightOnly.has(edge.to)) || (rightOnly.has(edge.from) && leftOnly.has(edge.to));
    const viaShared = shared.has(edge.from) !== shared.has(edge.to);
    if (direct || viaShared) relationships.push({ ...edge, cross: true, bridgeType: direct ? 'direct' : 'via_shared' });
  }
  const counts = {
    left: left.memberIds.size, right: right.memberIds.size,
    leftOnly: leftOnly.size, rightOnly: rightOnly.size, shared: shared.size, total: memberIds.size,
    people: personIds.size, sharedPeople: sharedPeople.length,
    creditBridges: bridgePersonIds.size,
    credits: edges.filter(edge => edge.type === 'credit').length,
    documentedRelationships: relationships.filter(edge => !edge.inferred).length,
    inferredRelationships: relationships.filter(edge => edge.inferred).length,
    directRelationships: relationships.filter(edge => edge.bridgeType === 'direct').length,
    viaSharedRelationships: relationships.filter(edge => edge.bridgeType === 'via_shared').length,
    edges: edges.length,
  };
  const result = { key, left, right, leftOnly, rightOnly, shared, memberIds, personIds, bridgePersonIds,
    edges, records, sharedRecords: records.filter(item => shared.has(item.id)), sharedPeople, relationships, counts };
  cache.set(key, result);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return result;
}
