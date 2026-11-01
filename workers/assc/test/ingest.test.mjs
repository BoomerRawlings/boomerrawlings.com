import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTranscript, parseTranscript } from '../scripts/import-transcript.mjs';

async function fixture(t) {
  const fixtureRoot = fileURLToPath(new URL('./', import.meta.url));
  const directory = await mkdtemp(path.join(fixtureRoot, '.ingest-fixture-'));
  t.after(() => {
    const relative = path.relative(fixtureRoot, path.resolve(directory));
    assert.ok(relative.startsWith('.ingest-fixture-') && !relative.includes(path.sep));
    return rm(directory, { recursive: true, force: true });
  });
  return { directory, privateDir: path.join(directory, '.private') };
}

test('plain text retains exact source with unknown timing and speaker', () => {
  const input = '\uFEFFOne line.\r\n\r\nA second line.\r\n';
  const turns = parseTranscript(input, '.txt');
  assert.equal(turns.length, 1);
  assert.equal(turns[0].text, input);
  assert.equal(turns[0].readingText, input);
  assert.equal(turns[0].startSeconds, null);
  assert.equal(turns[0].speaker, 'Unattributed');
});

test('subtitle parsing preserves cue words, line endings, timestamps, and explicit speaker labels', () => {
  const input = '1\r\n00:00:01,500 --> 00:00:03,000\r\nAlice: I said this.\r\nAnd this.\r\n\r\n2\r\n00:00:05,000 --> 00:00:06,000\r\nSecond cue.';
  const turns = parseTranscript(input, '.srt');
  assert.equal(turns.length, 2);
  assert.equal(turns[0].startSeconds, 1.5);
  assert.equal(turns[0].endSeconds, 3);
  assert.equal(turns[0].speaker, 'Alice');
  assert.equal(turns[0].text, 'Alice: I said this.\r\nAnd this.');
  assert.equal(turns[1].speaker, 'Unattributed');
  assert.deepEqual(turns[0].annotations, []);
  assert.equal(turns[1].id, 'turn-00002');
});

test('VTT indexes explicit voice tags without silently stripping markup', () => {
  const input = 'WEBVTT\n\nNOTE Source note\nNot spoken\n\ncue-a\n01:02.300 --> 01:04.600 align:start\n<v Alice>Hello &amp; goodbye.</v>\n\n';
  const [turn] = parseTranscript(input, '.vtt');
  assert.equal(turn.startSeconds, 62.3);
  assert.equal(turn.speaker, 'Alice');
  assert.equal(turn.text, '<v Alice>Hello &amp; goodbye.</v>');
  assert.equal(turn.readingText, turn.text);
  assert.equal(turn.cueId, 'cue-a');
});

test('malformed subtitles and unsafe JSON values fail instead of inventing turns', () => {
  assert.throws(() => parseTranscript('1\n00:00:05,000 --> 00:00:02,000\nText', '.srt'), /end precedes/);
  assert.throws(() => parseTranscript('Unrecognized subtitle', '.vtt'), /Unrecognized/);
  assert.throws(() => parseTranscript('[{"text":"Text","startSeconds":-2}]', '.json'), /startSeconds/);
  const [turn] = parseTranscript('{"turns":[{"text":"Baseline","readingText":"Changed","speaker":"A"}]}', '.json');
  assert.equal(turn.text, 'Baseline');
  assert.equal(turn.readingText, 'Baseline');
});

test('import writes byte-identical original, separate document and lightweight catalog', async t => {
  const { directory, privateDir } = await fixture(t);
  const input = path.join(directory, 'source.txt');
  const bytes = Buffer.from('\uFEFFFirst.\r\nSecond.\r\n', 'utf8');
  await writeFile(input, bytes);
  const record = await importTranscript({ input, privateDir, title: 'A source', rights: 'user-supplied', sourceId: 'source-1', sourceUrl: 'https://example.org/video', topics: ['Topic'], date: '2026-11-01' });
  assert.equal(record.provenance.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(await readFile(path.join(privateDir, 'originals', record.originalFilename)), bytes);
  const catalog = JSON.parse(await readFile(path.join(privateDir, 'transcripts.json'), 'utf8'));
  assert.equal(catalog.records.length, 1);
  assert.equal(catalog.records[0].turns, undefined);
  assert.equal(catalog.records[0].originalText, undefined);
  const document = JSON.parse(await readFile(path.join(privateDir, 'transcripts', record.documentFile), 'utf8'));
  assert.equal(document.originalText, bytes.toString('utf8'));
  assert.equal(document.turns[0].readingText, bytes.toString('utf8'));
  assert.equal(document.provenance.originalName, 'source.txt');
  assert.ok(!JSON.stringify(document.provenance).includes(directory));
});

test('duplicates, ID traversal, and undeclared rights preserve existing archive', async t => {
  const { directory, privateDir } = await fixture(t);
  const input = path.join(directory, 'source.txt');
  await writeFile(input, 'Words.');
  const options = { input, privateDir, title: 'Source', rights: 'owned', id: 'source-1' };
  await importTranscript(options);
  const before = await readFile(path.join(privateDir, 'transcripts.json'));
  await assert.rejects(importTranscript(options), /already exists/);
  await assert.rejects(importTranscript({ ...options, id: 'different' }), /exact source/);
  await assert.rejects(importTranscript({ ...options, id: '../escape' }), /Transcript ID/);
  await assert.rejects(importTranscript({ ...options, rights: undefined }), /Explicit --rights/);
  assert.deepEqual(await readFile(path.join(privateDir, 'transcripts.json')), before);
});

test('unsafe source URLs, invalid dates and invalid UTF-8 fail before mutation', async t => {
  const { directory, privateDir } = await fixture(t);
  const input = path.join(directory, 'source.txt');
  await writeFile(input, 'Words.');
  const options = { input, privateDir, title: 'Source', rights: 'owned' };
  await assert.rejects(importTranscript({ ...options, sourceUrl: 'javascript:alert(1)' }), /HTTP/);
  await assert.rejects(importTranscript({ ...options, sourceUrl: 'https://name:password@example.org' }), /credentials/);
  await assert.rejects(importTranscript({ ...options, date: '2026-02-30' }), /calendar date/);
  await writeFile(input, Buffer.from([0xc3, 0x28]));
  await assert.rejects(importTranscript(options), /encoded data/);
});

test('existing import lock blocks mutation and is never removed by a second import', async t => {
  const { directory, privateDir } = await fixture(t);
  await mkdir(privateDir);
  const lockPath = path.join(privateDir, '.transcripts-import.lock');
  await writeFile(lockPath, 'retained lock');
  const input = path.join(directory, 'source.txt');
  await writeFile(input, 'Words.');
  await assert.rejects(importTranscript({ input, privateDir, title: 'Source', rights: 'owned' }), /Another import/);
  assert.equal(await readFile(lockPath, 'utf8'), 'retained lock');
});
