import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Independent, frozen source/release baseline: no collector or projection code reused.
// This verifies publication coverage and provenance, not the underlying research claims.
const read = relative => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
const baseline = read('./fixtures/ead-full-research-baseline.json');
const atlas = read('../dist/ead/data/china-map.json');
const original = read('../dist/ead/data/china-labs.json');
const papers = read('../dist/ead/data/sources.json');
const failures = [];
const check = (value, message) => { if (!value) failures.push(message); };
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const equal = (actual, expected) => JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected));
const rows = value => Array.isArray(value) ? value : [];
function index(records, key, label) {
  const result = new Map();
  for (const row of rows(records)) {
    check(typeof row[key] === 'string' && row[key].length > 0, `${label}: missing ${key}`);
    check(!result.has(row[key]), `${label}: duplicate ${row[key]}`);
    result.set(row[key], row);
  }
  return result;
}
function preservedFields(record, prior, label) {
  if (!record) { check(false, `${label}: missing original record`); return; }
  const keys = baseline.schemas[prior.schema];
  check(keys.every(key => Object.hasOwn(record, key)), `${label}: removed original field`);
  check(digest(Object.fromEntries(keys.map(key => [key, record[key]]))) === prior.sha256, `${label}: original field or provenance changed`);
}
function source(value, label) {
  try { const url = new URL(value); check(['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname), `${label}: invalid public URL`); }
  catch { check(false, `${label}: missing or invalid URL`); }
}

check(digest(original) === baseline.index_sha256, 'Parallel research archive differs from the independently frozen index');
for (const [name, count] of Object.entries(baseline.index_counts)) {
  check(Array.isArray(original[name]) && original[name].length === count, `Parallel index ${name}: expected ${count} original records`);
}
for (const field of ['title', 'reviewed_at', 'cutoff_date', 'counts']) {
  check(equal(atlas.indexMetadata?.[field], original[field]), `Merged index metadata: ${field} was dropped or altered`);
}
const entities = index(atlas.entities, 'id', 'atlas entities');
const edges = index(atlas.connections, 'id', 'atlas connections');
const sources = index(atlas.sourceIndex, 'url', 'source ledger');
const claims = index(atlas.reportedCases, 'id', 'reported cases');
const publications = index(papers.entries, 'id', 'papers');
for (const [name, current] of [['entities', entities], ['connections', edges], ['papers', publications]]) {
  for (const prior of baseline.collections[name]) preservedFields(current.get(prior.id), prior, `${name} ${prior.id}`);
}

const indexedIds = new Set();
for (const [section, type] of [['researchers', 'person'], ['labs', 'lab'], ['institutions', 'institution']]) {
  for (const record of rows(original[section])) {
    indexedIds.add(record.id);
    const entity = entities.get(record.id);
    check(Boolean(entity), `${section} ${record.id}: not mapped into atlas`);
    if (!entity) continue;
    check(entity.type === type, `${record.id}: ${section} mapped to incorrect entity type`);
    check(entity.name === record.name, `${record.id}: indexed identity changed`);
    check(equal(entity.indexRecord, record), `${record.id}: source record metadata/provenance dropped or altered`);
    source(entity.sourceUrl, `${record.id} source`);
    for (const author of rows(record.author_affiliations)) {
      if (author.researcher_id) check(entities.has(author.researcher_id), `${record.id}: unresolved author affiliation ${author.researcher_id}`);
    }
  }
}
const originalNodeIds = new Set(baseline.collections.entities.map(row => row.id));
const expectedNodeIds = new Set([...originalNodeIds, ...indexedIds]);
check(entities.size === expectedNodeIds.size, 'Atlas entity count must equal the union of original and indexed profiles');
for (const id of entities.keys()) check(expectedNodeIds.has(id), `Atlas contains an unaccounted profile ${id}`);

for (const record of rows(original.edges)) {
  const edge = edges.get(record.id);
  check(Boolean(edge), `${record.id}: indexed relationship not mapped`);
  if (!edge) continue;
  check(equal(edge.indexRecord, record), `${record.id}: relationship metadata/provenance dropped or altered`);
  for (const [field, key] of [['source', 'source'], ['target', 'target'], ['kind', 'relation_basis'], ['basis', 'explanation'], ['sourceUrl', 'source_url']]) {
    check(edge[field] === record[key], `${record.id}: projected ${field} changes the original relationship`);
  }
  check(entities.has(edge.source) && entities.has(edge.target), `${record.id}: unresolved endpoint`);
  for (const url of [record.source_url, record.supporting_source_url, ...rows(record.additional_source_urls)].filter(Boolean)) {
    source(url, `${record.id} evidence`);
    check(sources.has(url), `${record.id}: evidence URL missing from searchable source ledger`);
  }
}
const expectedEdgeIds = new Set([...baseline.collections.connections.map(row => row.id), ...rows(original.edges).map(row => row.id)]);
check(edges.size === expectedEdgeIds.size, 'Atlas relationship count must equal the union of original and indexed relationships');
for (const id of edges.keys()) check(expectedEdgeIds.has(id), `Atlas contains an unaccounted relationship ${id}`);

check(sources.size >= original.sources.length, 'Searchable source ledger must preserve every indexed source');
check(equal(rows(atlas.sourceIndex).slice(0, original.sources.length), original.sources), 'Original source ledger must remain intact before supplemental evidence records');
for (const record of rows(original.sources)) {
  const published = sources.get(record.url);
  check(published && Object.keys(record).every(key => equal(published[key], record[key])), `${record.url}: source title/date/type/evidence metadata dropped or altered`);
  source(record.url, 'source ledger');
}
for (const record of sources.values()) {
  source(record.url, 'searchable source ledger');
  check(typeof record.title === 'string' && record.title.trim().length > 0, `${record.url}: missing searchable source title`);
}
for (const edge of edges.values()) {
  const raw = edge.indexRecord || {};
  const evidence = [edge.sourceUrl, edge.supportingSourceUrl, edge.supporting_source_url,
    ...rows(edge.additionalSourceUrls), ...rows(edge.additional_source_urls), ...rows(edge.evidenceUrls),
    raw.source_url, raw.supporting_source_url, ...rows(raw.additional_source_urls)].filter(Boolean);
  for (const url of evidence) {
    source(url, `${edge.id} evidence`);
    check(sources.has(url), `${edge.id}: original or supplemental evidence missing from searchable ledger`);
  }
}
check(claims.size === original.claims.length, 'Reported cases must preserve all indexed claims');
for (const record of rows(original.claims)) {
  const published = claims.get(record.id);
  check(published && Object.keys(record).every(key => equal(published[key], record[key])), `${record.id}: claim attribution, status or evidence trail dropped or altered`);
  check(published?.kind === 'claim' && Boolean(published.claim_type) && Boolean(published.status), `${record.id}: claim classification must remain explicit`);
  check(!entities.has(record.id), `${record.id}: a reported claim must not become a factual profile`);
  check(![...edges.values()].some(edge => edge.source === record.id || edge.target === record.id), `${record.id}: a reported claim must not become an unqualified graph relationship`);
  check(Object.hasOwn(published || {}, 'verified_connection') && Object.hasOwn(published || {}, 'inference'), `${record.id}: verified connection and inference must remain separate`);
  for (const id of rows(record.related_lab_ids)) check(entities.has(id), `${record.id}: unresolved related profile ${id}`);
  for (const evidence of rows(record.evidence)) {
    source(evidence.url, `${record.id} evidence`);
    check(sources.has(evidence.url), `${record.id}: evidence missing from searchable source ledger`);
  }
}

assert.equal(failures.length, 0, `EAD full research: ${failures.length} coverage/provenance failure(s)\n${[...new Set(failures)].slice(0, 40).join('\n')}`);
console.log(`Verified EAD full research: ${original.researchers.length} researchers, ${original.labs.length} labs, ${original.institutions.length} institutions, ${original.edges.length} relationships, ${sources.size} sources and ${claims.size} explicitly classified cases; all ${baseline.collections.entities.length} original profiles, ${baseline.collections.connections.length} original relationships and ${baseline.collections.papers.length} papers preserved.`);
