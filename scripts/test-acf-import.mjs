import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { normalizeImport, safeUrl } from '../public/ACF/model.js';
import { safePublicUrl } from './build-acf-catalogs.mjs';

const fixture = () => ({
  items: [{ item_id: 'work', title: 'Public work', type: 'journal_article', url: 'https://example.org/work', date: '2020', date_kind: 'source_publication_date', date_precision: 'year', date_raw: '2020', quality_flags: ['date_partial'], publication_status: 'in_press' }, { item_id: 'next', title: 'Second work', url: 'https://example.org/next' }],
  people: [{ person_id: 'author', name: 'A. Public', entity_status: 'unresolved_name_label' }],
  credits: [{ item_id: 'work', person_id: 'author', role: 'publishing_account', source_url: 'https://example.org/work' }],
  relationships: [{ source_item_id: 'next', target_item_id: 'work', relationship: 'possibly_same_event', confidence: 'candidate', basis: 'Dates remain uncertain.', source_url: 'https://example.org/next' }],
  affiliations: [{ person_id: 'author', role: 'Editor', organization: 'Public journal', temporal_status: 'historical', start_date: '2017', end_date: '2019', evidence: { source_url: 'https://example.org/board', source_document_date: '2020' } }],
});

test('browser URL boundary matches public adapter, including local hosts and secret queries', () => {
  const rejected = ['file:///C:/private', 'javascript:alert(1)', 'mailto:a@example.org', 'https://user:password@example.org/', 'http://localhost/', 'https://a.localhost./', 'https://a.local/', 'https://a.localdomain/', 'https://a.internal/', 'https://a.intranet/', 'https://a.lan/', 'https://a.home/', 'https://router.home.arpa/', 'https://a.test/', 'https://a.invalid/', 'http://127.0.0.1/', 'http://192.168.1.1/', 'http://2130706433/', 'http://[::1]/', 'https://example.org/?token=secret', 'https://example.org/?access_token=secret', 'https://example.org/?api_key=secret', 'https://example.org/?password=secret', 'https://example.org/?sessionid=secret', 'https://example.org/?X-Amz-Signature=secret', 'https://example.org\\private', 'https://example.org/a b'];
  for (const url of rejected) { assert.equal(safeUrl(url), '', url); assert.equal(safePublicUrl(url), null, url); }
  for (const url of ['https://doi.org/10.1234/test', 'https://example.org/path?article=20#citation']) assert.equal(safeUrl(url), safePublicUrl(url));
});

test('collector aliases, affiliation dates and source evidence survive normalization', () => {
  const data = normalizeImport(fixture(), 'local-1');
  assert.equal(data.items[0].id, 'local-1:work');
  assert.equal(data.people[0].id, 'local-1:person:author');
  assert.equal(data.items[0].dateKind, 'source_publication_date');
  assert.equal(data.items[0].datePrecision, 'year');
  assert.equal(data.items[0].dateRaw, '2020');
  assert.deepEqual(data.items[0].qualityFlags, ['date_partial']);
  assert.equal(data.items[0].publicationStatus, 'in_press');
  assert.equal(data.credits[0].role, 'publishing_account');
  assert.match(data.relationships[0].basis, /candidate: Dates remain uncertain/);
  assert.equal(data.affiliations[0].personId, data.people[0].id);
  assert.equal(data.affiliations[0].temporalStatus, 'historical; start: 2017; end: 2019; source document date: 2020');
  assert.deepEqual(data.affiliations[0].sourceUrls, ['https://example.org/board']);
  assert.match(data.catalog.coverage.summary, /not independently verified/);
});

test('malformed affiliations and unknown endpoints fail instead of disappearing', () => {
  for (const change of [
    f => { f.affiliations = {}; },
    f => { f.affiliations[0].person_id = 'missing'; },
    f => { f.affiliations[0].role = ''; },
    f => { f.affiliations[0].evidence = {}; },
    f => { f.affiliations[0].evidence.source_url = 'https://router.home.arpa/'; },
    f => { f.credits[0].person_id = 'missing'; },
    f => { f.relationships[0].target_item_id = 'missing'; },
  ]) { const input = fixture(); change(input); assert.throws(() => normalizeImport(input, 'local-2')); }
});

test('allowlist removes private and prose fields, retains all evidence, and avoids identity joins', () => {
  const input = fixture(), sentinel = 'DO_NOT_COPY_PRIVATE_FIELD';
  input.items[0].abstract = sentinel; input.items[0].source_notes = sentinel;
  input.people[0].email = sentinel; input.people[0].account = sentinel;
  input.affiliations[0].source_record = { private_note: sentinel };
  input.credits.push({ ...input.credits[0], source_url: 'https://example.org/second-evidence' });
  input.items[0].source_urls = Array.from({ length: 35 }, (_, i) => `https://example.org/evidence/${i}`);
  input.people.push({ person_id: 'different', name: 'A. Public' });
  const data = normalizeImport(input, 'local-3');
  assert.ok(!JSON.stringify(data).includes(sentinel));
  assert.equal(data.items[0].sourceUrls.length, 35);
  assert.equal(data.people.length, 2); assert.notEqual(data.people[0].id, data.people[1].id);
  assert.equal(data.credits.length, 1); assert.equal(data.credits[0].sourceUrls.length, 2);
  const overlap = fixture(); overlap.items[0].item_id = 'person:author';
  assert.throws(() => normalizeImport(overlap, 'local-4'), /overlap/);
  assert.throws(() => normalizeImport({ items: Array(60001).fill(input.items[0]) }, 'local-5'), /60,000/);
});

test('all nine shipped bundles reimport without losing item, people, relationship or affiliation rows', () => {
  const directory = new URL('../public/ACF/data/', import.meta.url);
  const index = JSON.parse(fs.readFileSync(new URL('index.json', directory), 'utf8'));
  for (const entry of index.catalogs) {
    const original = JSON.parse(fs.readFileSync(new URL(entry.file, directory), 'utf8'));
    const imported = normalizeImport(original, `local-${entry.id}`);
    for (const key of ['items', 'people', 'credits', 'relationships', 'affiliations']) assert.equal(imported[key].length, original[key].length, `${entry.id} ${key}`);
    for (let i = 0; i < original.affiliations.length; i++) assert.equal(imported.affiliations[i].temporalStatus, original.affiliations[i].temporalStatus);
    assert.ok(!imported.items.some(item => item.title === 'Untitled source record')); // Missing titles remain explicitly null metadata.
  }
});
