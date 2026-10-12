// Public metadata only. Identity is local to each catalog, never inferred from a name.
export const THEMES = [
  ['minds', 'Minds & machines', /\b(ai|artificial intelligence|robot\w*|conscious\w*|cognit\w*|mind\w*|machine\w*)\b/i],
  ['bodies', 'Bodies & enhancement', /\b(enhanc\w*|transhuman\w*|posthuman\w*|genetic\w*|biotech\w*|longevity|aging|ageing|cyborg\w*)\b/i],
  ['power', 'Power & justice', /\b(democra\w*|politic\w*|capital\w*|inequal\w*|justice|rights|libert\w*|anarch\w*|labor|labour)\b/i],
  ['planet', 'Planet & possibility', /\b(climate|environment\w*|ecolog\w*|energy|space|planet\w*|sustain\w*|earth)\b/i],
  ['culture', 'Culture & networks', /\b(cultur\w*|internet|network\w*|media|art|design|digital|philosoph\w*|ethic\w*)\b/i],
  ['futures', 'Futures & risk', /\b(futur\w*|risk\w*|utopia\w*|dystopia\w*|scenario\w*|foresight|singularit\w*)\b/i],
];
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
export function normalizeImport(raw, namespace) {
  if (Array.isArray(raw)) raw = { items: raw, catalog: { label: 'Imported collection' } };
  if (!raw || !Array.isArray(raw.items) || !raw.items.length) throw new Error('Use a catalog with an items array, or one item per JSONL line.');
  if (raw.items.length > 60000) throw new Error('Use at most 60,000 records per import.');
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) throw new Error('This importer supports schemaVersion 1.');
  if (!/^[a-z0-9-]+$/i.test(namespace)) throw new Error('Use a valid collection namespace.');
  const rows = key => {
    if (raw[key] === undefined) return [];
    if (!Array.isArray(raw[key])) throw new Error(`${key} must be an array.`);
    return raw[key];
  };
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
  const items = [], byId = new Map(), people = new Map(), byItem = new Map(), byPerson = new Map(), catalogById = new Map(), relationships = [], affiliations = new Map();
  for (const data of catalogs) {
    catalogById.set(data.catalog.id, data.catalog);
    for (const p of data.people) people.set(p.id, { ...p, catalogId: data.catalog.id });
    for (const item of data.items) { const copy = { ...item, title: item.title || 'Untitled source record', catalogId: data.catalog.id }; items.push(copy); byId.set(copy.id, copy); }
    for (const c of data.credits) {
      if (!byItem.has(c.itemId)) byItem.set(c.itemId, []);
      if (!byPerson.has(c.personId)) byPerson.set(c.personId, []);
      byItem.get(c.itemId).push(c); byPerson.get(c.personId).push(c);
    }
    relationships.push(...(data.relationships || []));
    for (const a of data.affiliations || []) { if (!affiliations.has(a.personId)) affiliations.set(a.personId, []); affiliations.get(a.personId).push(a); }
  }
  for (const i of items) {
    i.sampleScore = hash('sample:' + i.id);
    i.themes = THEMES.filter(t => t[2].test(i.title)).map(t => t[0]);
    i.year = /^\d{4}/.test(i.date || '') ? Number(i.date.slice(0, 4)) : null;
    i.searchText = [i.title, i.doi, i.type, i.publisher, i.journal, ...(byItem.get(i.id) || []).map(c => people.get(c.personId)?.name || '')].join(' ').toLocaleLowerCase();
  }
  items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
  return { items, byId, people, byItem, byPerson, catalogById, relationships, affiliations };
}
export function filterItems(index, { query = '', type = '', from = '', to = '', scope = null } = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const personItems = scope?.kind === 'person' ? new Set((index.byPerson.get(scope.id) || []).map(c => c.itemId)) : null;
  return index.items.filter(i => (!type || i.type === type) && (!from || (i.year && i.year >= Number(from))) && (!to || (i.year && i.year <= Number(to))) && terms.every(t => i.searchText.includes(t)) && (!scope || (scope.kind === 'person' ? personItems.has(i.id) : scope.kind === 'theme' ? i.themes.includes(scope.id) : scope.kind === 'type' ? i.type === scope.id : true)));
}
export function hash(value) { let h = 2166136261; for (const c of String(value ?? '')) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function graphData(index, records, inferred = false) {
  const nodes = [], edges = [], itemNodes = new Map(), groups = [], memberships = new Map();
  const available = new Set(records.map(i => i.id));
  if (inferred) {
    for (const [id, name] of THEMES) { const members = records.filter(i => i.themes.includes(id)); if (members.length) groups.push({ id: 'theme:' + id, scope: { kind: 'theme', id }, label: name, kind: 'hub', members, inferred: true }); }
  } else {
    for (const [id, credits] of index.byPerson) {
      const members = [...new Set(credits.filter(c => available.has(c.itemId)).map(c => c.itemId))];
      if (members.length > 1) groups.push({ id, scope: { kind: 'person', id }, label: index.people.get(id)?.name || 'Unresolved name', kind: 'person', members: members.map(id => index.byId.get(id)) });
    }
    groups.sort((a, b) => b.members.length - a.members.length);
    groups.splice(12);
  }
  // A small representative sample keeps large catalogs responsive. The reading room searches every record.
  groups.forEach((group, n) => {
    const angle = n * Math.PI * 2 / Math.max(groups.length, 1) - Math.PI / 2;
    const hub = { id: group.id, label: group.label, kind: group.kind, count: group.members.length, scope: group.scope, x: Math.cos(angle) * 270, y: Math.sin(angle) * 225, size: 7, color: group.inferred ? '#aaa4d0' : '#d89976' };
    nodes.push(hub);
    const members = group.members.slice().sort((a,b) => a.sampleScore - b.sampleScore).slice(0, Math.floor(380 / Math.max(groups.length, 1)));
    for (const item of members) {
      if (!memberships.has(item.id)) memberships.set(item.id, []);
      memberships.get(item.id).push(hub);
      edges.push({ from: hub.id, to: item.id, inferred: group.inferred || false });
      if (!itemNodes.has(item.id)) itemNodes.set(item.id, item);
    }
  });
  const remaining = records.filter(i => !itemNodes.has(i.id)).sort((a,b) => a.sampleScore - b.sampleScore).slice(0, Math.max(0, 480 - nodes.length - itemNodes.size));
  for (const item of remaining) itemNodes.set(item.id, item);
  for (const item of itemNodes.values()) {
    const hubs = memberships.get(item.id) || [], a = hash('angle:' + item.id) * Math.PI * 2, r = 30 + Math.sqrt(hash('radius:' + item.id)) * 125;
    const x = hubs.length ? hubs.reduce((s,h) => s+h.x, 0) / hubs.length + Math.cos(a)*r : Math.cos(a)*(150+hash(item.id+'x')*310);
    const y = hubs.length ? hubs.reduce((s,h) => s+h.y, 0) / hubs.length + Math.sin(a)*r : Math.sin(a)*(110+hash(item.id+'y')*245);
    nodes.push({ id: item.id, label: item.title, kind: 'item', x, y, size: 2.5, color: '#a9c9db' });
    // Preserve all known credits between the visible people and visible works.
    if (!inferred) for (const c of index.byItem.get(item.id) || []) if (groups.some(g => g.id === c.personId) && !edges.some(e => e.from === c.personId && e.to === item.id)) edges.push({ from: c.personId, to: item.id, inferred: false });
  }
  for (const r of index.relationships) if (itemNodes.has(r.from) && itemNodes.has(r.to) && (inferred || !inferredRelationship(r))) edges.push({ from: r.from, to: r.to, inferred: inferredRelationship(r) });
  return { nodes, edges };
}
