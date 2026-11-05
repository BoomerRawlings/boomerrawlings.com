import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { migrateCannonballCatalog, prepareCatalogFile } from '../scripts/update-cannonball-catalog.mjs';

const privateDirectory = resolve(fileURLToPath(new URL('../.private/', import.meta.url)));
const inputPath = resolve(privateDirectory, 'synthetic-source.json');
const outputPath = resolve(privateDirectory, 'synthetic-prepared.json');
const record = (id, title) => ({ id, title, kicker: 'Fictional doorway', description: 'Synthetic test content.', href: '/fictional-room/', accent: '#aabbcc' });
const fixture = () => ({ revision: 3, destinations: [
  { ...record('first', 'Unrelated room'), extra: { retained: true } },
  record('brain', 'Synthetic study room'),
  { ...record('last', 'Another room'), symbol: 'folio' },
] });

test('the exact target id is replaced in place without mutating or changing unrelated catalog fields', () => {
  const source = fixture();
  const before = structuredClone(source);
  const result = migrateCannonballCatalog(source);
  assert.deepEqual(source, before);
  assert.deepEqual(result.destinations.map(item => item.id), ['first', 'cannonball', 'last']);
  assert.deepEqual(result.destinations[0], before.destinations[0]);
  assert.deepEqual(result.destinations[2], before.destinations[2]);
  assert.equal(result.revision, before.revision);
  assert.deepEqual(result.destinations[1], {
    id: 'cannonball', title: 'Cannonball', kicker: 'Campus time trial',
    description: 'North Point to Gilman Gateway. Explore the course, submit a run, and compare verified times.',
    href: 'https://ucsdcannonball.com/', accent: '#ffcd00', symbol: 'race',
  });
});

test('missing or duplicate target IDs, destination conflicts, and invalid schemas fail closed', () => {
  const missing = fixture(); missing.destinations[1].id = 'study'; missing.destinations[1].title = 'BRAIN';
  assert.throws(() => migrateCannonballCatalog(missing), /exactly one target/);
  const ambiguous = fixture(); ambiguous.destinations.push(record('brain', 'Duplicate fixture'));
  assert.throws(() => migrateCannonballCatalog(ambiguous), /Invalid source/);
  const conflict = fixture(); conflict.destinations.push(record('cannonball', 'Existing fixture'));
  assert.throws(() => migrateCannonballCatalog(conflict), /identifier already exists/);
  for (const source of [null, {}, { destinations: [] }, { destinations: [{ ...record('brain', 'Fixture'), href: 'https://untrusted.example/' }] }]) {
    assert.throws(() => migrateCannonballCatalog(source), /Invalid source/);
  }
  const tooLargeAfterReplacement = fixture(); tooLargeAfterReplacement.padding = '';
  tooLargeAfterReplacement.padding = 'x'.repeat(20000 - JSON.stringify(tooLargeAfterReplacement).length);
  assert.throws(() => migrateCannonballCatalog(tooLargeAfterReplacement), /Invalid output/);
});

function mockFiles(t, options = {}) {
  const content = JSON.stringify(fixture());
  const sourcePath = options.inputPath || inputPath;
  const calls = { reads: [], opens: [], writes: [], closes: 0 };
  t.mock.method(fs, 'lstat', async path => ({
    isFile: () => path === sourcePath,
    isDirectory: () => path === privateDirectory,
    isSymbolicLink: () => Boolean((options.linkedInput && path === sourcePath) || (options.linkedDirectory && path === privateDirectory)),
    size: options.oversize ? 20001 : Buffer.byteLength(content),
  }));
  t.mock.method(fs, 'realpath', async path => options.escapedParent === path ? resolve(privateDirectory, '../elsewhere') : resolve(path));
  t.mock.method(fs, 'readFile', async path => { calls.reads.push(path); return content; });
  t.mock.method(fs, 'open', async (path, flags, mode) => {
    calls.opens.push({ path, flags, mode });
    if (options.existingOutput) throw new Error('Synthetic private path and contents must not be printed');
    return {
      writeFile: async value => { calls.writes.push(value); },
      close: async () => { calls.closes++; },
    };
  });
  return calls;
}

test('file preparation writes only a validated private output with exclusive creation', async t => {
  const calls = mockFiles(t);
  await prepareCatalogFile(inputPath, outputPath);
  assert.deepEqual(calls.opens, [{ path: outputPath, flags: 'wx', mode: 0o600 }]);
  assert.deepEqual(JSON.parse(calls.writes[0]), migrateCannonballCatalog(fixture()));
  assert.equal(calls.closes, 1);
});

test('a regular source may be outside the private output directory', async t => {
  const externalInput = resolve(privateDirectory, '../synthetic-readonly-source.json');
  const calls = mockFiles(t, { inputPath: externalInput });
  await prepareCatalogFile(externalInput, outputPath);
  assert.deepEqual(calls.reads, [externalInput]);
  assert.equal(calls.opens[0].path, outputPath);
});

test('output outside the ignored directory is refused before reading any source', async t => {
  const calls = mockFiles(t);
  await assert.rejects(prepareCatalogFile(inputPath, resolve(privateDirectory, '../public.json')), /inside the ignored private/);
  assert.deepEqual(calls.reads, []);
  assert.deepEqual(calls.opens, []);
});

test('linked and oversized input files are rejected without creating output', async t => {
  for (const options of [{ linkedInput: true }, { oversize: true }]) {
    const calls = mockFiles(t, options);
    await assert.rejects(prepareCatalogFile(inputPath, outputPath), /regular, non-linked/);
    assert.deepEqual(calls.opens, []);
    t.mock.restoreAll();
  }
});

test('linked private directories and escaping output parents are rejected before creation', async t => {
  const nestedOutput = resolve(privateDirectory, 'nested/new-catalog.json');
  for (const options of [{ linkedDirectory: true }, { escapedParent: dirname(nestedOutput) }]) {
    const calls = mockFiles(t, options);
    await assert.rejects(prepareCatalogFile(inputPath, nestedOutput), /existing directory inside/);
    assert.deepEqual(calls.opens, []);
    t.mock.restoreAll();
  }
});

test('an existing output is never overwritten and filesystem errors do not reveal private content', async t => {
  const calls = mockFiles(t, { existingOutput: true });
  await assert.rejects(prepareCatalogFile(inputPath, outputPath), error => {
    assert.match(error.message, /never overwritten/);
    assert.doesNotMatch(error.message, /Synthetic private/);
    return true;
  });
  assert.deepEqual(calls.writes, []);
});
