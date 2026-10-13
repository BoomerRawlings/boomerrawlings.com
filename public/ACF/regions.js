import { THEMES, label } from './model.js?v=comparison-20261012';

// Titles supply these groups. A region, proximity or overlapping boundary is
// never evidence of affiliation, agreement, citation or influence.
const colors = ['#90c2d1', '#c5a5cc', '#d6ac7f', '#9ebd92', '#94a8d3', '#c7bb82'];
const indexes = new WeakMap();
const CACHE_LIMIT = 8;
const fold = value => String(value ?? '').toLocaleLowerCase();
const compare = (a, b) => String(a).localeCompare(String(b), 'en');

/** Cached membership only; no graph construction, positioning or eager facets. */
export function getRegions(index) {
  let state = indexes.get(index);
  if (state) return state.regions;
  const regions = THEMES.map(([id, name], i) => ({ id, label: name, color: colors[i], memberIds: new Set(), count: 0 }));
  const byId = new Map(regions.map(region => [region.id, region]));
  const unionIds = new Set(), unmatchedIds = new Set();
  for (const source of index.items) {
    const item = index.byId.get(source.id) || source;
    if (unionIds.has(item.id) || unmatchedIds.has(item.id)) continue;
    let matched = false;
    for (const theme of item.themes || []) {
      const region = byId.get(theme);
      if (region) { region.memberIds.add(item.id); matched = true; }
    }
    if (matched) unionIds.add(item.id); else unmatchedIds.add(item.id);
  }
  regions.push({ id: 'unmatched', label: 'No current title-keyword match', color: '#b4b3ae', memberIds: unmatchedIds, count: unmatchedIds.size });
  byId.set('unmatched', regions.at(-1));
  for (const region of regions) region.count = region.memberIds.size;
  const result = { regions, byId, unionIds, unmatchedIds, total: unionIds.size + unmatchedIds.size };
  state = { regions: result, results: new Map() };
  indexes.set(index, state);
  return result;
}

const filterNames = ['term', 'overlap', 'collection', 'type', 'globalType', 'year', 'person', 'role', 'query', 'from', 'to'];
const sortNames = new Set(['date-desc', 'date-asc', 'title-asc', 'title-desc']);
function normalizeFilters(filters) {
  const result = Object.fromEntries(filterNames.map(name => [name, String(filters[name] ?? '')]));
  result.term = fold(result.term);
  result.query = fold(result.query).trim().replace(/\s+/g, ' ');
  result.sort = sortNames.has(filters.sort) ? filters.sort : 'date-desc';
  return result;
}
const yearId = item => item.year === null || item.year === undefined ? 'unknown' : String(item.year);
const titleTerms = (item, regionId) => (item.themeEvidence || []).filter(evidence => evidence.themeId === regionId).flatMap(evidence => evidence.terms || []);
const titleCompare = (a, b) => compare(a.title, b.title) || compare(a.id, b.id);
function recordSort(sort) {
  if (sort.startsWith('title-')) return (a, b) => (sort === 'title-desc' ? -1 : 1) * titleCompare(a, b);
  return (a, b) => {
    // Missing or unparseable years are last in both chronological directions.
    const aKnown = yearId(a) !== 'unknown', bKnown = yearId(b) !== 'unknown';
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    return (sort === 'date-asc' ? 1 : -1) * compare(aKnown ? a.date || String(a.year) : '', bKnown ? b.date || String(b.year) : '') || titleCompare(a, b);
  };
}

function resultFor(index, regionId, filters) {
  const memberships = getRegions(index), state = indexes.get(index), active = normalizeFilters(filters);
  const key = JSON.stringify([regionId, ...filterNames.map(name => active[name]), active.sort]);
  if (state.results.has(key)) {
    const result = state.results.get(key);
    state.results.delete(key); state.results.set(key, result);
    return result;
  }
  const region = memberships.byId.get(regionId);
  const queryTerms = active.query.split(' ').filter(Boolean);
  const records = region ? [...region.memberIds].map(id => index.byId.get(id)).filter(item => item &&
    (!active.term || titleTerms(item, regionId).some(term => fold(term) === active.term)) &&
    (!active.overlap || memberships.byId.get(active.overlap)?.memberIds.has(item.id)) &&
    (!active.collection || item.catalogId === active.collection) &&
    (!active.type || item.type === active.type) &&
    (!active.globalType || item.type === active.globalType) &&
    (!active.year || yearId(item) === active.year) &&
    (!active.from || (item.year && item.year >= Number(active.from))) &&
    (!active.to || (item.year && item.year <= Number(active.to))) &&
    queryTerms.every(term => (item.searchText || '').includes(term)) &&
    (!(active.person || active.role) || (index.byItem.get(item.id) || []).some(credit =>
      (!active.person || credit.personId === active.person) && (!active.role || credit.role === active.role)
    ))
  ).sort(recordSort(active.sort)) : [];
  const result = { regionId, active, records, total: region?.memberIds.size || 0, facets: null };
  state.results.set(key, result);
  if (state.results.size > CACHE_LIMIT) state.results.delete(state.results.keys().next().value);
  return result;
}

/** Exact AND facets. person+role must occur on the same documented credit. */
export function regionRecords(index, regionId, filters = {}) {
  return resultFor(index, regionId, filters).records;
}

function increment(map, id, name, extra = {}) {
  let entry = map.get(id);
  if (!entry) { entry = { id, label: name, count: 0, ...extra }; map.set(id, entry); }
  entry.count++;
  return entry;
}
const alphabetical = map => [...map.values()].sort((a, b) => compare(a.label, b.label) || compare(a.id, b.id));
function incrementLabel(map, id) {
  const entry = map.get(id);
  if (entry) entry.count++; else increment(map, id, label(id));
}

/** Aggregates the current unique-record result, prepared only when opened.
 * Counts in different themes, terms, names or roles can overlap. Names retain
 * their catalog ID; identical spelling never merges distinct source labels. */
export function regionFacets(index, regionId, filters = {}) {
  const result = resultFor(index, regionId, filters);
  if (result.facets) return result.facets;
  const { records, active } = result, memberships = getRegions(index);
  const terms = new Map(), overlaps = new Map(), collections = new Map(), types = new Map(), years = new Map(), people = new Map(), roles = new Map();
  for (const item of records) {
    // Deduplicate within each record, including duplicated imported credit rows.
    if (regionId !== 'unmatched') {
      const itemTerms = new Map();
      for (const term of titleTerms(item, regionId)) {
        const id = fold(term), previous = itemTerms.get(id);
        if (!previous || compare(term, previous) < 0) itemTerms.set(id, term);
      }
      for (const [id, term] of itemTerms) {
        const entry = increment(terms, id, term);
        if (compare(term, entry.label) < 0) entry.label = term;
      }
      for (const id of new Set(item.themes || [])) if (id !== regionId && memberships.byId.has(id)) increment(overlaps, id, memberships.byId.get(id).label);
    }
    increment(collections, item.catalogId, index.catalogById.get(item.catalogId)?.label || item.catalogId);
    incrementLabel(types, item.type);
    const year = yearId(item);
    increment(years, year, year === 'unknown' ? 'Unknown date' : year);
    const credits = index.byItem.get(item.id);
    if (!credits?.length) continue;
    const itemPeople = new Map(), itemRoles = new Set();
    for (const credit of credits) {
      if (!active.person || credit.personId === active.person) itemRoles.add(credit.role);
      if (active.role && credit.role !== active.role) continue;
      if (!index.people.has(credit.personId)) continue;
      if (!itemPeople.has(credit.personId)) itemPeople.set(credit.personId, new Set());
      itemPeople.get(credit.personId).add(credit.role);
    }
    for (const role of itemRoles) incrementLabel(roles, role);
    for (const [id, personRoles] of itemPeople) {
      let entry = people.get(id);
      if (entry) entry.count++;
      else {
        const person = index.people.get(id), catalog = index.catalogById.get(person.catalogId);
        entry = increment(people, id, person.name, { catalogId: person.catalogId, catalogLabel: catalog?.label || person.catalogId, roles: new Map() });
      }
      for (const role of personRoles) incrementLabel(entry.roles, role);
    }
  }
  const sortedYears = [...years.values()].sort((a, b) => a.id === 'unknown' ? 1 : b.id === 'unknown' ? -1 : Number(b.id) - Number(a.id));
  const sortedPeople = [...people.values()].map(person => ({ ...person, roles: alphabetical(person.roles) })).sort((a, b) => compare(a.label, b.label) || compare(a.catalogLabel, b.catalogLabel) || compare(a.id, b.id));
  result.facets = {
    regionId, total: result.total, matched: records.length, count: records.length, records,
    terms: alphabetical(terms), overlaps: alphabetical(overlaps), collections: alphabetical(collections),
    types: alphabetical(types), years: sortedYears, people: sortedPeople, roles: alphabetical(roles),
    basis: 'Counts are unique record IDs in the current result. Different themes, words, names and roles can overlap. Name identity stays within its catalog.',
  };
  return result.facets;
}
