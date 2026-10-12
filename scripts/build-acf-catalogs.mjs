import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read-only projection of reviewed public metadata. Never copy raw source records,
// prose, account data, caches, or collector state into the public directory.
export const CATALOGS = [
  { id: 'ieet', label: 'IEET', sourceUrl: 'https://ieet.org/', summary: 'IEET archives, journals, bibliographies, newsletters, public reports, people and events.', limits: ['9,449 legacy article records; 3,467 lack a usable byline. Medium and historical event coverage remain incomplete.', 'Includes linked publications and pre-IEET predecessor material; inclusion does not establish contemporary institutional affiliation.'] },
  { id: 'transhumanity', label: 'Transhumanity', sourceUrl: 'https://transhumanity.net/', summary: 'Current and recovered historical metadata, linked subdomains, Foundation Library holdings, publications and events.', limits: ['Historical deletions and restricted Cyberlife/Policy surfaces leave gaps; complete historical coverage is not established.', 'Library holdings and linked works need not concern transhumanism or represent affiliated authors. Publishing accounts remain distinct credit roles.'] },
  { id: 'technophany', label: 'Technophany', sourceUrl: 'https://technophany.philosophyandtechnology.network/', summary: '106 active journal articles across nine issue containers, plus distinct wider-network publications, announcements and events.', limits: ['Wider-network records are not all journal publications. Online First and issue dates retain source uncertainty.', 'Deleted journal tombstones and unavailable metadata are excluded; announced events do not prove occurrence.'] },
  { id: 'posthuman-studies', label: 'Journal of Posthuman Studies', sourceUrl: 'https://www.psupress.org/Journals/jnls_JPHS.html', summary: '164 journal DOI records and 19 reconstructed issue indexes, with editorial and contextual records.', limits: ['Official issue tables of contents were inaccessible; indexes are reconstructed from publisher-deposited registry metadata.', 'Review candidates, contextual works and historical roles remain qualified; complete journal history is not established.'] },
  { id: 'futures-studies', label: 'Journal of Futures Studies', sourceUrl: 'https://jfsdigital.org/homepage/', summary: '1,195 issue-linked items, 113 issues, In Press listings, website publications, editorial roles and event sessions.', limits: ['Supporting website pages are included; not every item is a scholarly publication.', 'Historical completeness is unproven; event announcements and programs do not establish occurrence or journal hosting.'] },
  { id: 'network-cultures', label: 'Institute of Network Cultures', sourceUrl: 'https://networkcultures.org/', summary: 'Publisher catalog, 47 inventoried archive roots, public posts, events, project and program metadata.', limits: ['Author taxonomy labels, source bylines and verified work authors remain separate roles; contributor coverage is selective.', 'Historical program and legacy index review is bounded. Unresolved editions, names and date conflicts remain.'] },
  { id: 'aft-technoprog', label: 'AFT–Technoprog', sourceUrl: 'https://transhumanistes.com/', summary: 'French and English site publications, newsletters, bibliography references, conferences, sessions and public role assertions.', limits: ['Referenced works can predate the association. Inclusion and authorship do not establish membership.', 'Event/session records are not a definitive count of unique historical events; dates and provisional programs can remain uncertain.'] },
  { id: 'biopolitical-times', label: 'Biopolitical Times', sourceUrl: 'https://www.geneticsandsociety.org/biopolitical-times', summary: '1,735 core blog records, 90 additional CGS records and 875 linked external items, with source-qualified relationships.', limits: ['Most linked external items are link-label metadata, not independently verified publications. CGS profile/event enrichment stopped at access restrictions.', 'Event candidates remain qualified; neither full CGS coverage nor complete historical coverage is claimed.'] },
  { id: 'c4ss', label: 'Center for a Stateless Society', sourceUrl: 'https://c4ss.org/', summary: '7,973 current public posts plus editions, zines, studies, audio, podcast, multilingual and event metadata.', limits: ['Publishing-account labels are not universal original-author claims; many language and attribution fields remain unresolved.', 'Historical reprints, inaccessible speaker archives and two unexposed PDF identities remain gaps. Announcements do not prove occurrence.'] },
];

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const unique = values => [...new Set(values.filter(Boolean))].sort(compare);
const text = (value, max = 400) => {
  if (Array.isArray(value)) value = value.filter(v => ['string', 'number'].includes(typeof v)).join('; ');
  if (!['string', 'number'].includes(typeof value)) return null;
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || null;
};

export function safePublicUrl(value) {
  if (typeof value !== 'string' || /[\s\u0000-\u001f\\]/u.test(value) || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || host.startsWith('[') || /(?:^|\.)(?:localhost|local|localdomain|internal|intranet|lan|home|home\.arpa|invalid|test)$/.test(host)) return null;
    if (/^\d+(?:\.\d+){3}$/.test(host)) return null; // No public dataset needs direct IP links.
    for (const key of url.searchParams.keys()) {
      if (/^(?:access_?token|auth(?:orization)?|api_?key|secret|password|token|session(?:id)?|signature|x-amz-.*)$/i.test(key)) return null;
    }
    return url.href;
  } catch { return null; }
}

function urls(...values) {
  return unique(values.flat(Infinity).map(safePublicUrl));
}

function evidenceUrls(row) {
  const evidence = row.evidence;
  return urls(row.source_url, row.source_urls || [], evidence?.source_url,
    Array.isArray(evidence) ? evidence.map(e => e?.source_url) : [],
    Array.isArray(row.provenance) ? row.provenance.map(e => e?.source_url) : []);
}

function roleTime(row) {
  const status = text(row.temporal_status || row.temporal_scope || row.role_status || row.current_status || row.tenure, 400) || 'Tenure unspecified; historical or source-listed assertion.';
  // These are literal date assertions, never calculated tenure or dates borrowed
  // from an article. Label source-document dates separately from role dates.
  const values = [
    ['role date', row.evidence?.role_date],
    ['source-listed role dates', row.source_record?.role_dates_as_printed],
    ['start', row.start_date || row.date_start], ['end', row.end_date || row.date_end],
    ['assertion date', row.temporal_date || row.date || row.asserted_as_of || row.effective_date],
    ['source document date', row.evidence?.source_document_date || row.source_date || row.asserted_in_publication_date],
  ].map(([label, value]) => [label, text(value, 100)]).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
  return [status, ...values].join('; ');
}

function readJsonl(directory, name, optional = false) {
  const filename = path.join(directory, `${name}.jsonl`);
  if (optional && !fs.existsSync(filename)) return [];
  return fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
    try { return JSON.parse(line); } catch { throw new Error(`Invalid ${name} metadata at row ${i + 1}`); }
  });
}

function assertUnique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    if (!row[key] || seen.has(row[key])) throw new Error(`${label}: missing or repeated ${key}`);
    seen.add(row[key]);
  }
  return seen;
}

export function projectCatalog(config, tables, manifest) {
  const ns = id => `${config.id}:${id}`;
  const items = tables.items.map(row => ({
    id: ns(row.item_id), title: text(row.title, 1000), type: text(row.type, 100) || 'record',
    date: text(row.date, 100), dateKind: text(row.date_kind, 200), datePrecision: text(row.date_precision, 40),
    dateRaw: text(row.date_raw, 250), url: safePublicUrl(row.url || row.canonical_url),
    doi: text(row.doi, 250), isbn: text(row.isbn, 250), journal: text(row.journal, 400), publisher: text(row.publisher, 400),
    sourceUrls: urls(row.source_urls || [], row.url, row.canonical_url),
    qualityFlags: unique((row.quality_flags || []).map(flag => text(flag, 300))),
    eventStatus: text(row.event_status, 200), publicationStatus: text(row.publication_status, 200),
  })).sort((a, b) => compare(a.id, b.id));
  const people = tables.people.map(row => ({ id: ns(row.person_id), name: text(row.name, 300), entityStatus: text(row.entity_status, 120) || 'unresolved_name_label' })).sort((a, b) => compare(a.id, b.id));
  const itemIds = assertUnique(items, 'id', config.id);
  const personIds = assertUnique(people, 'id', config.id);
  const creditMap = new Map();
  let omittedCredits = 0;
  for (const row of tables.credits) {
    const itemId = ns(row.item_id), personId = ns(row.person_id), role = text(row.role, 200);
    if (!itemIds.has(itemId) || !personIds.has(personId) || !role) { omittedCredits++; continue; }
    const key = JSON.stringify([itemId, personId, role]);
    const prior = creditMap.get(key);
    creditMap.set(key, { itemId, personId, role, sourceUrls: urls(prior?.sourceUrls || [], evidenceUrls(row)) });
  }
  const relationMap = new Map();
  let omittedRelationships = 0;
  for (const row of tables.relationships) {
    const from = ns(row.source_item_id), to = ns(row.target_item_id), kind = text(row.relationship, 200);
    if (!itemIds.has(from) || !itemIds.has(to) || !kind) { omittedRelationships++; continue; }
    // Keep uncertainty/inference explicit instead of turning candidates into facts.
    const basis = [text(row.confidence, 150), text(row.basis || row.relation_basis, 500)].filter(Boolean).join(': ') || 'Source-recorded relationship; see evidence.';
    const key = JSON.stringify([from, to, kind, basis]);
    const prior = relationMap.get(key);
    relationMap.set(key, { from, to, kind, basis, sourceUrls: urls(prior?.sourceUrls || [], evidenceUrls(row)) });
  }
  const affiliationMap = new Map();
  let omittedAffiliations = 0;
  for (const row of tables.affiliations) {
    const personId = ns(row.person_id), role = text(row.role, 200);
    if (!personIds.has(personId) || !role) { omittedAffiliations++; continue; }
    const organization = text(row.organization || (config.id === 'futures-studies' && row.scope === 'journal' ? 'Journal of Futures Studies' : null), 400);
    const temporalStatus = roleTime(row);
    const key = JSON.stringify([personId, role, organization, temporalStatus]);
    const prior = affiliationMap.get(key);
    affiliationMap.set(key, { personId, role, organization, temporalStatus, sourceUrls: urls(prior?.sourceUrls || [], evidenceUrls(row)) });
  }
  const sortValues = map => [...map.entries()].sort((a, b) => compare(a[0], b[0])).map(([, value]) => value);
  const credits = sortValues(creditMap), relationships = sortValues(relationMap), affiliations = sortValues(affiliationMap);
  const snapshot = manifest.generated_at_utc || manifest.generated_at || manifest.built_at_utc || manifest.built_at;
  if (typeof snapshot !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(snapshot)) throw new Error(`${config.id}: missing snapshot timestamp`);
  const limits = [...config.limits,
    'Metadata only. Names are source labels, not globally resolved identities; catalogs are not merged by name. Coauthorship, citation and thematic similarity do not establish affiliation.',
    'This compact view omits full text and detailed competing source assertions. Open the evidence links to assess dates, roles and uncertainty.'];
  if (omittedRelationships) limits.push(`${omittedRelationships.toLocaleString('en-US')} relationship assertions with endpoints outside this catalog are omitted from the graph.`);
  if (omittedCredits || omittedAffiliations) limits.push(`${omittedCredits} credit and ${omittedAffiliations} role assertions lacking resolved local endpoints are omitted.`);
  return {
    schemaVersion: 1,
    catalog: { id: config.id, label: config.label, sourceUrl: config.sourceUrl, snapshot, coverage: { summary: config.summary, limits }, counts: { items: items.length, people: people.length, credits: credits.length, relationships: relationships.length, affiliations: affiliations.length } },
    items, people, credits, relationships, affiliations,
  };
}

export function buildCatalogs(sourceRoot, outputDirectory) {
  const root = path.resolve(sourceRoot), output = path.resolve(outputDirectory);
  const bundles = CATALOGS.map(config => {
    const directory = path.join(root, ...(config.id === 'ieet' ? [] : ['related-catalogs', config.id]), 'catalog');
    const validation = JSON.parse(fs.readFileSync(path.join(directory, 'validation.json'), 'utf8'));
    if (validation.valid === false || validation.passed === false || validation.errors?.length || validation.failure_count > 0) throw new Error(`${config.id}: source validation is not passing`);
    const tables = Object.fromEntries(['items', 'people', 'credits', 'relationships', 'affiliations'].map(name => [name, readJsonl(directory, name, ['relationships', 'affiliations'].includes(name))]));
    if (config.id === 'futures-studies') tables.affiliations = readJsonl(directory, 'roles');
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    return projectCatalog(config, tables, manifest);
  });
  fs.mkdirSync(output, { recursive: true });
  for (const bundle of bundles) fs.writeFileSync(path.join(output, `${bundle.catalog.id}.json`), `${JSON.stringify(bundle)}\n`);
  const index = { schemaVersion: 1, defaultCatalog: 'ieet', catalogs: bundles.map(({ catalog }) => ({ id: catalog.id, label: catalog.label, file: `${catalog.id}.json`, itemCount: catalog.counts.items, peopleCount: catalog.counts.people, snapshot: catalog.snapshot, coverageSummary: catalog.coverage.summary })) };
  fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index)}\n`);
  return index;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), sourceFlag = args.indexOf('--source-root'), outputFlag = args.indexOf('--output');
  if (sourceFlag < 0 || !args[sourceFlag + 1]) throw new Error('Usage: node scripts/build-acf-catalogs.mjs --source-root <reviewed-IEET-directory> [--output <public-data-directory>]');
  const output = outputFlag >= 0 ? args[outputFlag + 1] : fileURLToPath(new URL('../public/ACF/data/', import.meta.url));
  if (!output) throw new Error('--output requires a directory');
  const index = buildCatalogs(args[sourceFlag + 1], output);
  console.log(JSON.stringify({ catalogs: index.catalogs.length, items: index.catalogs.reduce((sum, row) => sum + row.itemCount, 0), people: index.catalogs.reduce((sum, row) => sum + row.peopleCount, 0) }));
}
