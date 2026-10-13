import { nodeIdentity } from './node-identity.js?v=glyphs-20261013';

// Public metadata only. Identity is local to each catalog, never inferred from a name.
export const THEMES = [
  ['minds', 'Minds & machines', /\b(ai|artificial intelligence|robot\w*|conscious\w*|cognit\w*|mind\w*|machine\w*)\b/i],
  ['bodies', 'Bodies & enhancement', /\b(enhanc\w*|transhuman\w*|posthuman\w*|genetic\w*|biotech\w*|longevity|aging|ageing|cyborg\w*)\b/i],
  ['power', 'Power & justice', /\b(democra\w*|politic\w*|capital\w*|inequal\w*|justice|rights|libert\w*|anarch\w*|labor|labour)\b/i],
  ['planet', 'Planet & possibility', /\b(climate|environment\w*|ecolog\w*|energy|space|planet\w*|sustain\w*|earth)\b/i],
  ['culture', 'Culture & networks', /\b(cultur\w*|internet|network\w*|media|art|design|digital|philosoph\w*|ethic\w*)\b/i],
  ['futures', 'Futures & risk', /\b(futur\w*|risk\w*|utopia\w*|dystopia\w*|scenario\w*|foresight|singularit\w*)\b/i],
];
const themeMatchers = THEMES.map(([id, , rule]) => [id, new RegExp(rule.source, 'gi')]);
export const label = value => String(value || 'Unspecified').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export const text = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const uncertainKinds = new Set(['thematically_related_to_dossier', 'possibly_same_event', 'original_publication_wording_candidate', 'associated_event', 'episode_announcement']);
export const inferredRelationship = relation => uncertainKinds.has(relation.kind) || /^(?:inferred|inference|possible|candidate|topic_and_issue_inference|exact_normalized_title_match|identity_review_needed)(?:\b|_)/i.test(relation.basis || '');
export function safeUrl(value) {
  if (typeof value !== 'string' || /[\s\u0000-\u001f\\]/u.test(value) || value.length > 4096) return '';
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || !host.includes('.') || host.startsWith('[') || /(?:^|\.)(?:localhost|local|localdomain|internal|intranet|lan|home|home\.arpa|invalid|test)$/.test(host) || /^\d+(?:\.\d+){3}$/.test(host)) return '';
    for (const key of u.searchParams.keys()) if (/^(?:access_?token|auth(?:orization)?|api_?key|secret|password|token|session(?:id)?|signature|x-amz-.*)$/i.test(key)) return '';
    return u.href;
  } catch { return ''; }
}
const urls = values => [...new Set((Array.isArray(values) ? values : []).flat().map(safeUrl).filter(Boolean))];
// Per-file row limits precede normalization/allocation. The app also budgets
// cumulative imported bytes and rows across the browser session.
export const IMPORT_LIMITS = Object.freeze({ items: 60000, people: 20000, credits: 150000, relationships: 100000, affiliations: 30000 });
export const SESSION_IMPORT_LIMITS = Object.freeze({ records: 120000, people: 60000, relations: 500000, bytes: 120 * 1024 * 1024 });
export function validateSessionImport(data, byteLength, { publicRecords = 0, imports = [] } = {}) {
  const measure = (catalog, bytes) => {
    if (!catalog || !Array.isArray(catalog.items) || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Import accounting requires a catalog and a nonnegative byte length.');
    const count = key => {
      if (catalog[key] === undefined) return 0;
      if (!Array.isArray(catalog[key])) throw new Error(`Import accounting requires an array for ${key}.`);
      return catalog[key].length;
    };
    return { records: count('items'), people: count('people'), relations: count('credits') + count('relationships') + count('affiliations'), bytes };
  };
  if (!Number.isSafeInteger(publicRecords) || publicRecords < 0) throw new Error('Public record accounting must be a nonnegative integer.');
  const totals = measure(data, byteLength);
  totals.records += publicRecords;
  // Deliberately include cached, deselected imports: unchecking a collection
  // does not release its metadata or restore the session's memory budget.
  for (const previous of imports) {
    const used = measure(previous.data, previous.bytes);
    for (const key of Object.keys(totals)) totals[key] += used[key];
  }
  const names = { records: 'records including public collections', people: 'imported name labels', relations: 'imported credit, relationship and affiliation rows', bytes: 'imported bytes' };
  for (const [key, limit] of Object.entries(SESSION_IMPORT_LIMITS)) if (totals[key] > limit) throw new Error(`This session exceeds ${limit.toLocaleString('en-US')} ${names[key]}. Reload to clear previous imports before importing more.`);
  return totals;
}
export function normalizeImport(raw, namespace) {
  if (Array.isArray(raw)) raw = { items: raw, catalog: { label: 'Imported collection' } };
  if (!raw || !Array.isArray(raw.items) || !raw.items.length) throw new Error('Use a catalog with an items array, or one item per JSONL line.');
  if (raw.items.length > IMPORT_LIMITS.items) throw new Error('Use at most 60,000 records per import.');
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) throw new Error('This importer supports schemaVersion 1.');
  if (!/^[a-z0-9-]+$/i.test(namespace)) throw new Error('Use a valid collection namespace.');
  const rows = key => {
    if (raw[key] === undefined) return [];
    if (!Array.isArray(raw[key])) throw new Error(`${key} must be an array.`);
    return raw[key];
  };
  for (const [key, limit] of Object.entries(IMPORT_LIMITS)) if (rows(key).length > limit) throw new Error(`Use at most ${limit.toLocaleString('en-US')} ${key} rows per import.`);
  const object = (value, kind) => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${kind} records must be objects.`); return value; };
  const scalar = value => Array.isArray(value) ? value.filter(v => typeof v === 'string' || typeof v === 'number').join('; ') : typeof value === 'number' ? String(value) : value;
  const evidence = v => urls([v.sourceUrls || v.source_urls || [], v.source_url, v.evidence?.source_url]);
  const id = `${namespace}:`, itemIds = new Map(), personIds = new Map();
  const items = raw.items.map((v, index) => {
    object(v, 'Item');
    const key = text(v.id || v.item_id) || String(index);
    if (itemIds.has(key)) throw new Error(`Duplicate item ID: ${key}`);
    if (!text(v.title) && v.title !== null) throw new Error(`Record ${index + 1} needs a title, or explicit null for an unknown source title.`);
    const flags = v.qualityFlags || v.quality_flags || [];
    if (!Array.isArray(flags)) throw new Error(`Record ${index + 1} quality flags must be an array.`);
    const item = { id: id + key, title: text(v.title) || null, type: text(v.type || v.item_type, 100) || 'publication', sourceUrls: evidence(v), url: safeUrl(v.url || v.canonical_url), qualityFlags: [...new Set(flags.map(x => text(x, 300)).filter(Boolean))] };
    if (!item.title && !item.qualityFlags.includes('title_missing_in_source')) item.qualityFlags.push('title_missing_in_source');
    const aliases = { date: 'date', dateKind: 'date_kind', datePrecision: 'date_precision', dateRaw: 'date_raw', doi: 'doi', isbn: 'isbn', journal: 'journal', publisher: 'publisher', eventStatus: 'event_status', publicationStatus: 'publication_status' };
    for (const [key, alias] of Object.entries(aliases)) { const value = text(scalar(v[key] ?? v[alias]), 400); if (value) item[key] = value; }
    if (!item.url && !item.sourceUrls.length) throw new Error(`Record ${index + 1} needs a public HTTP(S) URL or sourceUrls.`);
    itemIds.set(key, item.id); return item;
  });
  const people = rows('people').map((v, i) => {
    object(v, 'Person');
    const key = text(v.id || v.person_id) || String(i);
    if (personIds.has(key) || !text(v.name)) throw new Error('People need unique IDs and names.');
    personIds.set(key, id + 'person:' + key);
    return { id: personIds.get(key), name: text(v.name, 250), entityStatus: text(v.entityStatus || v.entity_status, 200) || 'unresolved_name_label' };
  });
  const mappedItems = new Set(itemIds.values());
  if ([...personIds.values()].some(personId => mappedItems.has(personId))) throw new Error('Item and person IDs overlap after namespacing. Use distinct IDs.');
  const creditMap = new Map();
  for (const v of rows('credits')) {
    object(v, 'Credit');
    const itemId = itemIds.get(v.itemId || v.item_id), personId = personIds.get(v.personId || v.person_id);
    if (!itemId || !personId) throw new Error('A credit references an unknown item or person.');
    const sourceUrls = evidence(v);
    if (!sourceUrls.length) throw new Error('Credits need sourceUrls documenting the relationship.');
    const role = text(v.role, 200) || 'credited', key = JSON.stringify([itemId, personId, role]);
    creditMap.set(key, { itemId, personId, role, sourceUrls: urls([creditMap.get(key)?.sourceUrls || [], sourceUrls]) });
  }
  const credits = [...creditMap.values()];
  // Imports never create relationships from text similarity or matching name strings.
  const relationships = rows('relationships').map(v => {
    object(v, 'Relationship');
    const from = itemIds.get(v.from || v.source_item_id), to = itemIds.get(v.to || v.target_item_id);
    if (!from || !to) throw new Error('A relationship references an unknown item.');
    const sourceUrls = evidence(v);
    if (!sourceUrls.length) throw new Error('Relationships need sourceUrls.');
    return { from, to, kind: text(v.kind || v.relationship, 200) || 'related', basis: [text(v.confidence, 150), text(v.basis || v.relation_basis, 650)].filter(Boolean).join(': '), sourceUrls };
  });
  const affiliations = rows('affiliations').map(v => {
    object(v, 'Affiliation');
    const personId = personIds.get(v.personId || v.person_id), role = text(v.role, 200), sourceUrls = evidence(v);
    if (!personId) throw new Error('An affiliation references an unknown person.');
    if (!role || !sourceUrls.length) throw new Error('Affiliations need a role and public sourceUrls documenting the assertion.');
    const temporal = text(v.temporalStatus || v.temporal_status || v.temporal_scope || v.role_status || v.current_status, 1000) || 'Tenure unspecified; source-listed assertion.';
    const dateParts = [['start', v.start_date || v.date_start], ['end', v.end_date || v.date_end], ['assertion date', v.temporal_date || v.date || v.asserted_as_of], ['source document date', v.evidence?.source_document_date]].map(([label, value]) => [label, text(scalar(value), 100)]).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
    return { personId, role, organization: text(v.organization, 400) || null, temporalStatus: [temporal, ...dateParts].join('; '), sourceUrls };
  });
  return { schemaVersion: 1, catalog: { id: namespace, label: text(raw.catalog?.label, 150) || 'Imported collection', sourceUrl: safeUrl(raw.catalog?.sourceUrl), snapshot: text(raw.catalog?.snapshot, 40), coverage: { summary: 'Local import. Provenance supplied by the importer; not independently verified.', limits: ['No identity merging across catalogs. Imported data stays in this browser session.', ...((Array.isArray(raw.catalog?.coverage?.limits) ? raw.catalog.coverage.limits : []).map(value => text(value, 1000)).filter(Boolean))] } }, items, people, credits, relationships, affiliations };
}
export function createIndex(catalogs) {
  const items = [], byId = new Map(), people = new Map(), byItem = new Map(), byPerson = new Map(), catalogById = new Map(), relationships = [], relationshipsByItem = new Map(), affiliations = new Map();
  for (const data of [...catalogs].sort((a, b) => a.catalog.id.localeCompare(b.catalog.id))) {
    if (catalogById.has(data.catalog.id)) throw new Error('Duplicate catalog ID.');
    catalogById.set(data.catalog.id, data.catalog);
    for (const p of data.people) {
      if (people.has(p.id) || String(p.id).startsWith('@theme:')) throw new Error('Duplicate or reserved name-label ID.');
      people.set(p.id, { ...p, catalogId: data.catalog.id });
    }
    for (const item of data.items) {
      if (byId.has(item.id) || String(item.id).startsWith('@theme:')) throw new Error('Duplicate or reserved item ID.');
      const copy = { ...item, title: item.title || 'Untitled source record', catalogId: data.catalog.id };
      items.push(copy); byId.set(copy.id, copy);
    }
    for (const c of data.credits) {
      if (!byItem.has(c.itemId)) byItem.set(c.itemId, []);
      if (!byPerson.has(c.personId)) byPerson.set(c.personId, []);
      byItem.get(c.itemId).push(c); byPerson.get(c.personId).push(c);
    }
    for (const relation of data.relationships || []) {
      relationships.push(relation);
      for (const id of new Set([relation.from, relation.to])) {
        if (!relationshipsByItem.has(id)) relationshipsByItem.set(id, []);
        relationshipsByItem.get(id).push(relation);
      }
    }
    for (const a of data.affiliations || []) { if (!affiliations.has(a.personId)) affiliations.set(a.personId, []); affiliations.get(a.personId).push(a); }
  }
  for (const id of people.keys()) if (byId.has(id)) throw new Error('Item and name-label IDs overlap.');
  for (const i of items) {
    i.themeEvidence = [];
    for (const [themeId, rule] of themeMatchers) {
      const terms = i.title.match(rule);
      if (terms) i.themeEvidence.push({ themeId, field: 'title', terms: [...new Set(terms)], rule: rule.source, sourceUrls: i.sourceUrls?.length ? i.sourceUrls : i.url ? [i.url] : [] });
    }
    i.themes = i.themeEvidence.map(evidence => evidence.themeId);
    i.year = /^\d{4}/.test(i.date || '') ? Number(i.date.slice(0, 4)) : null;
    i.searchText = [i.title, i.doi, i.type, i.publisher, i.journal, ...(byItem.get(i.id) || []).map(c => people.get(c.personId)?.name || '')].join(' ').toLocaleLowerCase();
  }
  items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
  return { items, byId, people, byItem, byPerson, catalogById, relationships, relationshipsByItem, affiliations };
}
export function filterItems(index, { query = '', type = '', from = '', to = '', scope = null } = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const personItems = scope?.kind === 'person' ? new Set((index.byPerson.get(scope.id) || []).map(c => c.itemId)) : null;
  return index.items.filter(i => (!type || i.type === type) && (!from || (i.year && i.year >= Number(from))) && (!to || (i.year && i.year <= Number(to))) && terms.every(t => i.searchText.includes(t)) && (!scope || (scope.kind === 'person' ? personItems.has(i.id) : scope.kind === 'theme' ? i.themes.includes(scope.id) : scope.kind === 'type' ? i.type === scope.id : true)));
}
export function hash(value) { let h = 2166136261; for (const c of String(value ?? '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export const GRAPH_BOUNDS = Object.freeze({ left: -1400, right: 1400, top: -1100, bottom: 1100 });
const themeRegions = THEMES.map(([themeId, name, rule], i) => {
  const angle = i * Math.PI / 3 - Math.PI / 2;
  return { id: '@theme:' + themeId, themeId, label: name, x: Math.cos(angle) * 550, y: Math.sin(angle) * 400, radiusX: 900, radiusY: 680, color: '#aaa4d0', inferred: true, basis: 'Title keyword match; not documented affiliation, agreement, citation or influence.', rule: rule.source };
});
const regionById = new Map(themeRegions.map(region => [region.themeId, region]));

function itemPosition(item) {
  const angle = hash('angle:' + item.id) * Math.PI * 2, radius = Math.sqrt(hash('radius:' + item.id));
  if (!item.themes.length) return { x: Math.cos(angle) * radius * 1220, y: Math.sin(angle) * radius * 900 };
  let x = 0, y = 0;
  for (const theme of item.themes) { const region = regionById.get(theme); x += region.x; y += region.y; }
  // Position is an illustrative title-keyword arrangement, never evidence of a
  // source relationship. It depends only on this record's ID and title.
  return { x: x / item.themes.length + Math.cos(angle) * radius * 240, y: y / item.themes.length + Math.sin(angle) * radius * 180 };
}

function fullGraph(index) {
  const nodes = [], edges = [], byId = new Map(), adjacency = new Map();
  const members = new Map(THEMES.map(([id]) => [id, []]));
  const addNode = node => { nodes.push(node); byId.set(node.id, node); adjacency.set(node.id, []); };
  for (const item of index.items) {
    addNode({ id: item.id, label: item.title, kind: 'item', catalogId: item.catalogId, ...nodeIdentity({ kind: 'item', type: item.type }), ...itemPosition(item), size: 2.5, color: '#a9c9db', themes: item.themes });
    for (const theme of item.themes) members.get(theme).push(item.id);
  }
  let orphanPeople = 0;
  for (const person of index.people.values()) {
    const count = new Set((index.byPerson.get(person.id) || []).map(credit => credit.itemId)).size;
    const angle = hash('person-angle:' + person.id) * Math.PI * 2, radius = .5 + Math.sqrt(hash('person-radius:' + person.id)) * .5;
    if (!count) orphanPeople++;
    addNode({ id: person.id, label: person.name, kind: 'person', catalogId: person.catalogId, entityStatus: person.entityStatus, ...nodeIdentity({ kind: 'person', catalogId: person.catalogId, label: person.name, entityStatus: person.entityStatus }), scope: { kind: 'person', id: person.id }, count, orphan: count === 0, x: Math.cos(angle) * radius * 1240, y: Math.sin(angle) * radius * 920, size: 4, color: '#d89976' });
  }
  const regions = themeRegions.map(region => ({ ...region, memberIds: members.get(region.themeId), count: members.get(region.themeId).length, totalCount: members.get(region.themeId).length }));
  if (index.items.length) for (const region of regions) addNode({ id: region.id, label: region.label, kind: 'hub', ...nodeIdentity({ kind: 'hub' }), scope: { kind: 'theme', id: region.themeId }, count: region.count, x: region.x, y: region.y, size: 7, color: region.color, inferred: true });
  const addEdge = edge => {
    if (!byId.has(edge.from) || !byId.has(edge.to)) throw new Error('Graph relationship references an unknown endpoint.');
    edges.push(edge); adjacency.get(edge.from).push(edge);
    if (edge.to !== edge.from) adjacency.get(edge.to).push(edge);
  };
  for (const credits of index.byItem.values()) for (const credit of credits) addEdge({ from: credit.personId, to: credit.itemId, type: 'credit', kind: 'credit', role: credit.role, basis: 'Source-listed credit; matching names do not establish identity.', sourceUrls: credit.sourceUrls, inferred: false });
  for (const relation of index.relationships) addEdge({ ...relation, type: 'relationship', inferred: inferredRelationship(relation) });
  for (const item of index.items) for (const evidence of item.themeEvidence) addEdge({ from: '@theme:' + evidence.themeId, to: item.id, type: 'theme', kind: 'title_keyword_match', basis: 'Inferred from literal title keywords only.', sourceUrls: evidence.sourceUrls, evidence, inferred: true });
  return { nodes, edges, byId, adjacency, regions, bounds: GRAPH_BOUNDS, counts: { items: index.items.length, people: index.people.size, orphanPeople, themes: index.items.length ? THEMES.length : 0, edges: edges.length } };
}

/** All graph data is cached once per index. Rendering layers control visibility;
 * filtering selects a view in O(N+E), without re-sorting or re-positioning nodes. */
export function graphData(index, records = index.items) {
  const graph = index.graph ||= fullGraph(index);
  if (records === index.items) return graph;
  const available = new Set();
  for (const record of records) if (index.byId.has(record.id)) available.add(record.id);
  if (available.size === index.items.length) return graph;
  const personCounts = new Map(), themeCounts = new Map();
  for (const id of available) {
    const credited = new Set((index.byItem.get(id) || []).map(credit => credit.personId));
    for (const person of credited) personCounts.set(person, (personCounts.get(person) || 0) + 1);
    for (const theme of index.byId.get(id).themes) themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
  }
  const nodes = [];
  for (const node of graph.nodes) {
    if (node.kind === 'item' && available.has(node.id)) nodes.push(node);
    else if (node.kind === 'person' && personCounts.has(node.id)) nodes.push({ ...node, count: personCounts.get(node.id) });
    else if (node.kind === 'hub' && themeCounts.has(node.scope.id)) nodes.push({ ...node, count: themeCounts.get(node.scope.id) });
  }
  const selected = new Set(nodes.map(node => node.id));
  const edges = graph.edges.filter(edge => selected.has(edge.from) && selected.has(edge.to));
  const regions = graph.regions.map(region => ({ ...region, count: themeCounts.get(region.themeId) || 0, memberIds: region.memberIds.filter(id => available.has(id)) }));
  return { nodes, edges, regions, bounds: graph.bounds, counts: { items: available.size, people: personCounts.size, orphanPeople: 0, themes: themeCounts.size, edges: edges.length } };
}
