import { filterItems, graphData } from './model.js?v=sources-20261015';

const caches = new WeakMap();
const palette = ['#88c9d8', '#d5ae7c', '#b3a1df', '#97c496', '#dc9ca4', '#b5c9e7', '#c6ba80', '#84c8b6', '#d6a2c7'];
const knownCatalogs = ['ieet', 'transhumanity', 'technophany', 'posthuman-studies', 'futures-studies', 'network-cultures', 'aft-technoprog', 'biopolitical-times', 'c4ss'];

/** Stable catalog identity color, including when other catalogs are hidden. */
export function publicationColor(id) {
  let position = knownCatalogs.indexOf(id);
  if (position < 0) {
    let hash = 2166136261;
    for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    position = (hash >>> 0) % palette.length;
  }
  return palette[position];
}

/** Compare source catalogs, not inferred affiliations. A record belongs to its
 * catalog exactly once. Equal names, titles and themes never manufacture bridges. */
export function comparePublications(index, catalogIds, filters = {}) {
  const selected = [...new Set(catalogIds)].filter(id => index.catalogById.has(id)).sort();
  if (selected.length < 2) return null;
  const active = Object.fromEntries(['query', 'type', 'from', 'to'].map(key => [key, String(filters[key] || '')]));
  const key = JSON.stringify(['publications', selected, active]);
  let cache = caches.get(index);
  if (!cache) { cache = new Map(); caches.set(index, cache); }
  if (cache.has(key)) return cache.get(key);
  const groups = selected.map(id => ({ id, label: index.catalogById.get(id).label || id,
    color: publicationColor(id), total: 0, memberIds: new Set(), personIds: new Set() }));
  const byCatalog = new Map(groups.map(group => [group.id, group]));
  for (const item of index.items) if (byCatalog.has(item.catalogId)) byCatalog.get(item.catalogId).total++;
  const records = filterItems(index, active).filter(item => byCatalog.has(item.catalogId));
  for (const item of records) byCatalog.get(item.catalogId).memberIds.add(item.id);
  const memberIds = new Set(records.map(item => item.id)), personIds = new Set(), personGroups = new Map();
  for (const item of records) for (const credit of index.byItem.get(item.id) || []) {
    if (!index.people.has(credit.personId)) continue;
    personIds.add(credit.personId);
    byCatalog.get(item.catalogId).personIds.add(credit.personId);
    if (!personGroups.has(credit.personId)) personGroups.set(credit.personId, new Map());
    const memberships = personGroups.get(credit.personId);
    if (!memberships.has(item.catalogId)) memberships.set(item.catalogId, new Set());
    memberships.get(item.catalogId).add(item.id);
  }
  const sharedPeople = [...personGroups].filter(([, memberships]) => memberships.size > 1).map(([id, memberships]) => ({
    id, label: index.people.get(id).name, catalogId: index.people.get(id).catalogId,
    groups: [...memberships].map(([catalogId, items]) => ({ id: catalogId, count: items.size })),
  }));
  const bridgePersonIds = new Set(sharedPeople.map(person => person.id));
  const graph = graphData(index);
  const edges = graph.edges.filter(edge => edge.type === 'credit'
    ? personIds.has(edge.from) && memberIds.has(edge.to)
    : edge.type === 'relationship' && memberIds.has(edge.from) && memberIds.has(edge.to));
  const relationships = edges.filter(edge => edge.type === 'relationship'
    && index.byId.get(edge.from).catalogId !== index.byId.get(edge.to).catalogId);
  const counts = {
    groups: groups.length, total: memberIds.size, people: personIds.size,
    shared: 0, sharedPeople: sharedPeople.length, creditBridges: bridgePersonIds.size,
    credits: edges.filter(edge => edge.type === 'credit').length,
    documentedRelationships: relationships.filter(edge => !edge.inferred).length,
    inferredRelationships: relationships.filter(edge => edge.inferred).length,
    directRelationships: relationships.length, viaSharedRelationships: 0,
    internalRelationships: edges.filter(edge => edge.type === 'relationship').length - relationships.length,
    edges: edges.length,
  };
  const result = { kind: 'publications', key, groups, memberIds, personIds, edges, records, relationships,
    shared: new Set(), sharedRecords: [], sharedPeople, bridgePersonIds, counts,
    // These aliases keep generic empty-state/diagnostic code safe; consumers
    // describing this view must use all groups rather than just these two.
    left: groups[0], right: groups[1], leftOnly: groups[0].memberIds, rightOnly: groups[1].memberIds };
  cache.set(key, result);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return result;
}
