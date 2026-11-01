#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RIGHTS = new Set(['user-supplied', 'owned', 'permission', 'public-domain']);
const FORMATS = new Set(['.txt', '.vtt', '.srt', '.json']);
const SAFE_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const MAX_BYTES = 64 * 1024 * 1024;
const DEFAULT_PRIVATE = fileURLToPath(new URL('../.private/', import.meta.url));

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function timestamp(value) {
  const match = /^(?:(\d{1,4}):)?(\d{2}):(\d{2})[.,](\d{3})$/.exec(value);
  invariant(match && Number(match[2]) < 60 && Number(match[3]) < 60, `Invalid subtitle timestamp: ${value}`);
  return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

function speakerFromCue(text, fallback) {
  const voice = /^<v(?:\.[^\s>]+)*\s+([^>]+)>/.exec(text);
  if (voice) return voice[1].trim();
  // Only an explicit leading name label is recognized; never guess identity.
  const label = /^([\p{L}\p{N}][\p{L}\p{N} ._'’()-]{0,79}):[ \t]+/u.exec(text);
  return label ? label[1] : fallback || 'Unattributed';
}

function makeTurn(turn, index, fallback) {
  invariant(turn && typeof turn === 'object' && !Array.isArray(turn), `Turn ${index + 1} must be an object.`);
  invariant(typeof turn.text === 'string' && turn.text.length > 0, `Turn ${index + 1} needs source text.`);
  const startSeconds = turn.startSeconds ?? null;
  const endSeconds = turn.endSeconds ?? null;
  invariant(startSeconds === null || (Number.isFinite(startSeconds) && startSeconds >= 0), `Invalid startSeconds on turn ${index + 1}.`);
  invariant(endSeconds === null || (Number.isFinite(endSeconds) && endSeconds >= (startSeconds ?? 0)), `Invalid endSeconds on turn ${index + 1}.`);
  invariant(turn.speaker === undefined || (typeof turn.speaker === 'string' && turn.speaker.trim().length > 0 && turn.speaker.length <= 200), `Invalid speaker on turn ${index + 1}.`);
  return {
    id: `turn-${String(index + 1).padStart(5, '0')}`,
    speaker: turn.speaker?.trim() || fallback || 'Unattributed',
    startSeconds,
    endSeconds,
    text: turn.text,
    readingText: turn.text,
    annotations: [],
    ...(turn.cueId ? { cueId: turn.cueId } : {}),
  };
}

/** Parse source text without rewriting words, punctuation, or subtitle markup. */
export function parseTranscript(originalText, extension, { speaker } = {}) {
  invariant(typeof originalText === 'string' && originalText.trim(), 'The source is empty.');
  invariant(FORMATS.has(extension), 'Supported formats: .txt, .vtt, .srt, .json.');
  if (extension === '.txt') return [makeTurn({ text: originalText }, 0, speaker)];
  if (extension === '.json') {
    const value = JSON.parse(originalText.replace(/^\uFEFF/, ''));
    const turns = Array.isArray(value) ? value : value.turns;
    invariant(Array.isArray(turns) && turns.length > 0, 'JSON must contain a non-empty turns array.');
    // A pre-edited JSON source can be imported, but its supplied text is the verbatim baseline.
    // Existing readingText is not silently promoted to source text.
    return turns.map((turn, index) => makeTurn(turn, index, speaker));
  }
  const blocks = originalText.replace(/^\uFEFF/, '').split(/(?:\r?\n){2,}/);
  const turns = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split(/\r?\n/);
    if (extension === '.vtt' && /^(WEBVTT(?:\s|$)|NOTE(?:\s|$)|STYLE(?:\s|$)|REGION(?:\s|$))/.test(lines[0])) continue;
    const timingIndex = lines.findIndex(line => line.includes('-->'));
    invariant(timingIndex === 0 || timingIndex === 1, `Unrecognized subtitle block ${turns.length + 1}; source preserved but import stopped.`);
    const timing = /^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/.exec(lines[timingIndex]);
    invariant(timing, `Invalid timing line in block ${turns.length + 1}.`);
    const startSeconds = timestamp(timing[1]);
    const endSeconds = timestamp(timing[2]);
    invariant(endSeconds >= startSeconds, `Subtitle end precedes its start in block ${turns.length + 1}.`);
    // Preserve cue line endings; only the structural timing/identifier lines are separated.
    const bodyMatch = /^(?:[^\r\n]*\r?\n){0,1}[^\r\n]*-->[^\r\n]*\r?\n([\s\S]*)$/.exec(block);
    invariant(bodyMatch && bodyMatch[1].length > 0, `Subtitle block ${turns.length + 1} has no text.`);
    const text = bodyMatch[1];
    turns.push(makeTurn({
      text,
      speaker: speakerFromCue(text, speaker),
      startSeconds,
      endSeconds,
      cueId: timingIndex === 1 ? lines[0] : undefined,
    }, turns.length, speaker));
  }
  invariant(turns.length > 0, 'No subtitle cues were found.');
  return turns;
}

function safeSourceUrl(value) {
  if (!value) return null;
  const parsed = new URL(value);
  invariant(['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password, 'Source URL must be an HTTP(S) URL without credentials.');
  return parsed.href;
}

async function exists(filename) {
  try { await access(filename, constants.F_OK); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function checkedDirectory(root, directory) {
  await mkdir(directory, { recursive: true });
  const resolved = await realpath(directory);
  const relative = path.relative(root, resolved);
  invariant(relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)), 'Archive directory resolves outside the private root.');
  return resolved;
}

async function writeDurable(filename, value) {
  const handle = await open(filename, 'wx', 0o600);
  try { await handle.writeFile(value); await handle.sync(); }
  finally { await handle.close(); }
}

/** The originals and transcript documents never overwrite existing files. */
export async function importTranscript(options) {
  invariant(options && typeof options === 'object', 'Import options are required.');
  invariant(RIGHTS.has(options.rights), 'Explicit --rights is required: user-supplied, owned, permission, or public-domain.');
  invariant(typeof options.title === 'string' && options.title.trim() && options.title.length <= 500, 'A title of 1–500 characters is required.');
  invariant(typeof options.input === 'string' && options.input.trim(), 'A source file is required.');
  invariant(!options.date || /^\d{4}-\d{2}-\d{2}$/.test(options.date) && new Date(`${options.date}T00:00:00Z`).toISOString().slice(0, 10) === options.date, 'Date must be a real YYYY-MM-DD calendar date.');
  invariant(!options.speaker || typeof options.speaker === 'string' && options.speaker.length <= 200, 'Speaker must be at most 200 characters.');
  invariant(!options.sourceId || SAFE_ID.test(options.sourceId), 'Source ID must contain lowercase letters, numbers, underscores, or hyphens.');
  const topics = [...new Set(options.topics || [])];
  invariant(topics.length <= 50 && topics.every(topic => typeof topic === 'string' && topic.trim() && topic.length <= 100), 'Topics must be 1–100 characters, at most 50 topics.');
  const input = await realpath(path.resolve(options.input));
  const extension = path.extname(input).toLowerCase();
  invariant(FORMATS.has(extension), 'Supported formats: .txt, .vtt, .srt, .json.');
  const info = await stat(input);
  invariant(info.isFile() && info.size > 0 && info.size <= MAX_BYTES, 'Source must be a nonempty regular file, at most 64 MiB.');
  const bytes = await readFile(input);
  invariant(bytes.byteLength <= MAX_BYTES, 'Source exceeded 64 MiB while reading.');
  const originalText = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const id = options.id || `transcript-${sha256.slice(0, 16)}`;
  invariant(SAFE_ID.test(id), 'Transcript ID must contain 1–80 lowercase letters, numbers, underscores, or hyphens, starting with a letter or number.');
  const turns = parseTranscript(originalText, extension, options);
  const sourceUrl = safeSourceUrl(options.sourceUrl);
  const privateDir = path.resolve(options.privateDir || DEFAULT_PRIVATE);
  await mkdir(privateDir, { recursive: true });
  const root = await realpath(privateDir);
  const originals = await checkedDirectory(root, path.join(root, 'originals'));
  const documents = await checkedDirectory(root, path.join(root, 'transcripts'));
  const lockPath = path.join(root, '.transcripts-import.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Another import is active, or an interrupted import left .transcripts-import.lock. Inspect before removing the lock.');
    throw error;
  }
  const temporary = [];
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const catalogPath = path.join(root, 'transcripts.json');
    const catalog = await exists(catalogPath) ? JSON.parse(await readFile(catalogPath, 'utf8')) : { records: [] };
    invariant(catalog && Array.isArray(catalog.records), 'Existing catalog must have a records array; it was not changed.');
    invariant(!catalog.records.some(record => record.id === id), `Transcript ID ${id} already exists; nothing was overwritten.`);
    invariant(!catalog.records.some(record => record.provenance?.sha256 === sha256 || record.originalFilename === `${sha256}${extension}`), 'This exact source is already imported; nothing was overwritten.');
    const documentFile = `${id}.json`;
    invariant(!await exists(path.join(documents, documentFile)), 'A document with this ID already exists (possibly an interrupted import). It was not overwritten.');
    const originalFilename = `${sha256}${extension}`;
    const originalPath = path.join(originals, originalFilename);
    if (await exists(originalPath)) {
      invariant(createHash('sha256').update(await readFile(originalPath)).digest('hex') === sha256, 'Existing original has an unexpected hash; import stopped.');
    } else await writeDurable(originalPath, bytes);
    const record = {
      id,
      title: options.title.trim(),
      date: options.date || null,
      speakers: [...new Set(turns.map(turn => turn.speaker))],
      topics,
      sourceId: options.sourceId || null,
      sourceUrl,
      rights: options.rights,
      status: 'Imported — not editorially reviewed',
      turnCount: turns.length,
      documentFile,
      originalFilename,
      provenance: {
        sha256,
        originalName: path.basename(input),
        byteLength: bytes.byteLength,
        format: extension.slice(1),
        encoding: 'UTF-8',
        importedAt: new Date().toISOString(),
        rightsBasis: options.rights,
        readingVersion: 1,
        transformations: 'Timing and explicit speaker labels indexed; source text and initial reading text are identical. No corrections applied.',
      },
    };
    const documentTemp = path.join(documents, `.${id}.${randomUUID()}.tmp`);
    temporary.push(documentTemp);
    await writeDurable(documentTemp, JSON.stringify({ ...record, originalText, turns }, null, 2) + '\n');
    await rename(documentTemp, path.join(documents, documentFile));
    const catalogTemp = path.join(root, `.transcripts.${randomUUID()}.tmp`);
    temporary.push(catalogTemp);
    await writeDurable(catalogTemp, JSON.stringify({ ...catalog, records: [...catalog.records, record] }, null, 2) + '\n');
    await rename(catalogTemp, catalogPath);
    return record;
  } finally {
    await lock.close();
    for (const filename of temporary) await unlink(filename).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await unlink(lockPath);
  }
}

const HELP = `Import a local authorized transcript. No network requests are made.

node scripts/import-transcript.mjs <input.txt|input.vtt|input.srt|input.json>
  --title "Recording title" --rights user-supplied|owned|permission|public-domain
  [--source-url https://example.org/recording] [--source-id source-id]
  [--date YYYY-MM-DD] [--speaker "Explicit speaker"] [--topic "Topic"]
  [--id stable-id] [--private-dir path]

Repeat --topic for multiple topics. Input must be UTF-8 and at most 64 MiB.
Private root defaults to this project's .private folder. No existing document is replaced.
The rights flag records your basis; it does not grant rights or authorize publication.
`;

function cliOptions(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return null;
  const options = { topics: [] };
  const names = new Map([['--title', 'title'], ['--rights', 'rights'], ['--source-url', 'sourceUrl'], ['--source-id', 'sourceId'], ['--date', 'date'], ['--speaker', 'speaker'], ['--id', 'id'], ['--private-dir', 'privateDir']]);
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--topic' || names.has(argument)) {
      const value = argv[++index];
      invariant(value && !value.startsWith('--'), `Missing value for ${argument}.`);
      if (argument === '--topic') options.topics.push(value);
      else options[names.get(argument)] = value;
    } else {
      invariant(!argument.startsWith('-') && !options.input, `Unexpected argument: ${argument}`);
      options.input = argument;
    }
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = cliOptions(process.argv.slice(2));
    if (!options) process.stdout.write(HELP);
    else {
      const record = await importTranscript(options);
      process.stdout.write(`Imported ${record.id}: ${record.turnCount} turns; original SHA-256 ${record.provenance.sha256}.\n`);
    }
  } catch (error) {
    process.stderr.write(`Import stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}
