import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { CATALOGS, projectCatalog, safePublicUrl } from './build-acf-catalogs.mjs';

const directory = fileURLToPath(new URL('../public/ACF/data/', import.meta.url));
const expectedKeys = {
  bundle: ['schemaVersion', 'catalog', 'items', 'people', 'credits', 'relationships', 'affiliations'],
  catalog: ['id', 'label', 'sourceUrl', 'snapshot', 'coverage', 'counts'],
  item: ['id', 'title', 'type', 'date', 'dateKind', 'datePrecision', 'dateRaw', 'url', 'doi', 'isbn', 'journal', 'publisher', 'sourceUrls', 'qualityFlags', 'eventStatus', 'publicationStatus'],
  person: ['id', 'name', 'entityStatus'], credit: ['itemId', 'personId', 'role', 'sourceUrls'],
  relationship: ['from', 'to', 'kind', 'basis', 'sourceUrls'], affiliation: ['personId', 'role', 'organization', 'temporalStatus', 'sourceUrls'],
};
const keys = (value, name) => assert.deepEqual(Object.keys(value).sort(), [...expectedKeys[name]].sort(), `${name} allowlist`);
const checkUrls = values => { assert.ok(Array.isArray(values)); assert.equal(values.length, new Set(values).size); for (const url of values) assert.equal(safePublicUrl(url), url); };
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));

test('URL boundary rejects local, credential-bearing, non-web and secret-bearing addresses', () => {
  for (const value of ['file:///C:/private', 'javascript:alert(1)', 'mailto:author@example.com', 'https://user:secret@example.com/a', 'http://127.0.0.1/a', 'http://192.168.1.1/a', 'http://localhost/a', 'https://foo.local/a', 'https://foo.internal/a', 'https://foo.localdomain/a', 'https://router.home.arpa/a', 'https://[::1]/a', 'https://example.com/?token=secret', 'https://example.com/?X-Amz-Signature=secret', 'https://example.com/a b', 'https://example.com\\private']) assert.equal(safePublicUrl(value), null, value);
  assert.equal(safePublicUrl('https://doi.org/10.1000/example'), 'https://doi.org/10.1000/example');
});

test('projection excludes private/prose fields, preserves literal roles, qualifies uncertain links, and merges evidence', () => {
  const marker = 'PRIVATE_EXCLUDED_SENTINEL';
  const tables = {
    items: [{ item_id: 'a', title: 'Public title', type: 'article', url: 'https://example.org/a', abstract: marker, source_notes: marker, token: marker, contact_email: marker }, { item_id: 'b', title: 'Second title', type: 'event' }],
    people: [{ person_id: 'p', name: 'Public byline', entity_status: 'unresolved_name_label', email: marker, source_record: marker }],
    credits: [{ item_id: 'a', person_id: 'p', role: 'publishing_account', source_url: 'https://example.org/a', account_id: marker }, { item_id: 'a', person_id: 'p', role: 'publishing_account', source_url: 'https://example.org/b' }],
    relationships: [{ source_item_id: 'a', target_item_id: 'b', relationship: 'possibly_same_event', confidence: 'candidate', source_url: 'https://example.org/a' }, { source_item_id: 'a', target_item_id: 'outside', relationship: 'links_to' }],
    affiliations: [{ person_id: 'p', role: 'Editor', organization: 'Journal', temporal_status: 'historical', evidence: { source_url: 'https://example.org/a', source_document_date: '2022' }, source_record: { private_note: marker } }],
  };
  const value = projectCatalog(CATALOGS[0], tables, { generated_at: '2026-10-12T00:00:00Z' });
  assert.ok(!JSON.stringify(value).includes(marker));
  assert.equal(value.credits.length, 1);
  assert.equal(value.credits[0].role, 'publishing_account');
  assert.equal(value.credits[0].sourceUrls.length, 2);
  assert.equal(value.relationships.length, 1);
  assert.match(value.relationships[0].basis, /candidate/);
  assert.equal(value.affiliations[0].temporalStatus, 'historical; source document date: 2022');
  assert.deepEqual(value, projectCatalog(CATALOGS[0], tables, { generated_at: '2026-10-12T00:00:00Z' }));
});

test('nine independently namespaced catalog bundles match their index and strict public schema', () => {
  const index = read('index.json');
  assert.deepEqual(Object.keys(index).sort(), ['catalogs', 'defaultCatalog', 'schemaVersion']);
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.defaultCatalog, 'ieet');
  assert.deepEqual(index.catalogs.map(c => c.id), CATALOGS.map(c => c.id));
  const globalIds = new Set();
  for (const entry of index.catalogs) {
    assert.equal(entry.file, `${entry.id}.json`);
    const bundle = read(entry.file);
    keys(bundle, 'bundle'); keys(bundle.catalog, 'catalog');
    assert.equal(bundle.schemaVersion, 1); assert.equal(bundle.catalog.id, entry.id);
    assert.equal(bundle.catalog.snapshot, entry.snapshot);
    assert.equal(safePublicUrl(bundle.catalog.sourceUrl), bundle.catalog.sourceUrl);
    assert.ok(bundle.catalog.coverage.summary.length > 20); assert.ok(bundle.catalog.coverage.limits.length >= 3);
    const itemIds = new Set(bundle.items.map(row => row.id)), personIds = new Set(bundle.people.map(row => row.id));
    assert.equal(itemIds.size, bundle.items.length); assert.equal(personIds.size, bundle.people.length);
    assert.equal(entry.itemCount, itemIds.size); assert.equal(entry.peopleCount, personIds.size);
    for (const id of [...itemIds, ...personIds]) { assert.ok(id.startsWith(`${entry.id}:`)); assert.ok(!globalIds.has(id)); globalIds.add(id); }
    for (const row of bundle.items) {
      keys(row, 'item'); assert.ok(row.title === null || typeof row.title === 'string'); assert.ok(row.type);
      if (row.url) assert.equal(safePublicUrl(row.url), row.url);
      checkUrls(row.sourceUrls); assert.ok(row.sourceUrls.length > 0, `${row.id} has provenance`);
      assert.ok(row.qualityFlags.every(flag => typeof flag === 'string'));
    }
    for (const row of bundle.people) { keys(row, 'person'); assert.ok(row.name); assert.ok(row.entityStatus); }
    const triples = new Set();
    for (const row of bundle.credits) {
      keys(row, 'credit'); assert.ok(itemIds.has(row.itemId)); assert.ok(personIds.has(row.personId)); assert.ok(row.role);
      const key = JSON.stringify([row.itemId, row.personId, row.role]); assert.ok(!triples.has(key)); triples.add(key); checkUrls(row.sourceUrls); assert.ok(row.sourceUrls.length > 0);
    }
    for (const row of bundle.relationships) { keys(row, 'relationship'); assert.ok(itemIds.has(row.from)); assert.ok(itemIds.has(row.to)); assert.ok(row.kind); assert.ok(row.basis); checkUrls(row.sourceUrls); assert.ok(row.sourceUrls.length > 0); }
    for (const row of bundle.affiliations) { keys(row, 'affiliation'); assert.ok(personIds.has(row.personId)); assert.ok(row.role); assert.ok(row.temporalStatus); checkUrls(row.sourceUrls); assert.ok(row.sourceUrls.length > 0); }
    for (const field of ['items', 'people', 'credits', 'relationships', 'affiliations']) assert.equal(bundle.catalog.counts[field], bundle[field].length);
    assert.ok(!/PRIVATE_EXCLUDED_SENTINEL|C:\\\\Users\\\\|OneDrive[\\/]|\.sandbox-secrets|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/.test(JSON.stringify(bundle)));
  }
});
