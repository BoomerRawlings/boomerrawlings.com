#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as engine from './engine.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2), command = args.shift() ?? 'help';
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith('--')) throw new Error(`unexpected argument ${args[i]}`);
  const key = args[i].slice(2); flags[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
}
const directory = resolve(flags.private ?? process.env.WIKI_PRIVATE_DIR ?? resolve(repo, '.wiki-private'));
const stateFile = resolve(directory, 'state.json'), lockFile = resolve(directory, 'state.lock');
const now = flags.now ? new Date(flags.now).toISOString() : new Date().toISOString();
const readJson = path => JSON.parse(readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, ''));
const print = value => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const proof = () => { if (!flags.usage) throw new Error('--usage requires a fresh native Codex usage proof JSON'); return readJson(flags.usage); };
const input = () => { if (!flags.file) throw new Error('--file requires a JSON input path'); return readJson(flags.file); };
function save(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (existsSync(path)) copyFileSync(path, `${path}.bak`);
  renameSync(temporary, path);
}
const production = directory === resolve(repo, '.wiki-private') && !flags.now && !flags.historical;
const suggestionEndpoint = 'https://boomerrawlings.com/wiki/api/suggestions/review';
async function suggestionRequest(reviews) {
  const key = readFileSync(resolve(directory, 'suggestions-key'), 'utf8').trim();
  if (!key) throw Error('Suggestion review key is missing');
  const response = await fetch(suggestionEndpoint, {
    method: reviews ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, ...(reviews ? {'Content-Type':'application/json'} : {}) },
    body: reviews ? JSON.stringify({reviews}) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error(`Suggestion queue returned HTTP ${response.status}`);
  return response.json();
}
function terminalReview(review) {
  if (review.decision === 'rejected') return {id:review.id, resolution:'rejected', note:review.publicNote};
  if (review.decision === 'adopted' && review.outcome === 'accepted') return {id:review.id, resolution:'adopted'};
  return null;
}
async function pendingSuggestions(state) {
  const {suggestions} = await suggestionRequest();
  if (!Array.isArray(suggestions) || suggestions.length > 3) throw Error('Invalid suggestion queue response');
  const reviewed = new Map(state.cycles.flatMap(cycle => (cycle.suggestionReviews ?? []).flatMap(review => {
    const terminal = terminalReview(review);
    return terminal ? [[review.id, terminal]] : [];
  })));
  const completed = suggestions.flatMap(item => reviewed.has(item.id) ? [reviewed.get(item.id)] : []);
  if (completed.length) await suggestionRequest(completed);
  return suggestions.filter(item => !reviewed.has(item.id));
}
async function transaction(fn) {
  mkdirSync(directory, { recursive: true });
  let descriptor;
  try { descriptor = openSync(lockFile, 'wx'); } catch { throw new Error('wiki state is locked; inspect the owning process before recovering a stale state.lock'); }
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })); closeSync(descriptor);
  try {
    const state = existsSync(stateFile) ? readJson(stateFile) : null;
    const result = await fn(state);
    if (result.state) save(stateFile, result.state);
    print(result.output);
    if (result.output?.ok === false) process.exitCode = 2;
  } finally { unlinkSync(lockFile); }
}
try {
  if (command === 'help') {
    print({ commands: ['init [--seed value]', 'status', 'usage --usage proof.json', 'found --file founding.json --usage proof.json', 'begin --usage proof.json [--historical]', 'packet --editor id [--out packet.json]', 'propose --file proposal.json --usage proof.json', 'complete --usage proof.json', 'export --out public/wiki-assets/data.json --usage proof.json', 'skip --reason text [--usage proof.json]', 'recruit --file profile.json --usage proof.json', 'validate --file public-data.json', 'published --commit sha --url url --usage proof.json'], common: ['--private path (default ignored .wiki-private)', '--now ISO (deterministic tests only)'], note: 'Codex produces character decisions. This program never calls a model or schedules itself.' });
  } else if (command === 'init') await transaction(state => ({ state: state ?? engine.createState({ seed: flags.seed, now }), output: { ok: true, existed: Boolean(state), privateDirectory: directory } }));
  else if (command === 'validate') print(engine.validatePublic(input()));
  else if (command === 'status') print(engine.status(readJson(stateFile), now));
  else if (command === 'packet') {
    const packet = engine.characterPacket(readJson(stateFile), flags.editor);
    if (flags.out) { const out = resolve(flags.out); mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, `${JSON.stringify(packet, null, 2)}\n`); print({ ok: true, packet: out, editorId: flags.editor }); }
    else print(packet);
  } else if (command === 'export') await transaction(state => {
    if (!state) throw new Error('run init first');
    if (!flags.out) throw new Error('--out is required; exporting is deliberate');
    const data = engine.exportPublic(state, { proof: proof(), now });
    const verification = engine.validatePublic(data), target = resolve(flags.out);
    // Public output never receives a backup containing an older/private structure.
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(`${target}.tmp-${process.pid}`, `${JSON.stringify(data)}\n`); renameSync(`${target}.tmp-${process.pid}`, target);
    const hash = createHash('sha256').update(readFileSync(target)).digest('hex');
    state.lastExport = { at: now, latestCompletedAt: state.latestCompletedAt, sha256: hash };
    return { state, output: { ok: true, output: target, ...verification, sha256: hash } };
  });
  else await transaction(async state => {
    if (!state) throw new Error('run init first');
    let output;
    if (command === 'usage') { const usage = engine.checkUsage(proof(), now); state.lastUsage = usage; output = { ok: usage.allowed, ...usage }; }
    else if (command === 'found') output = engine.found(state, input(), { proof: proof(), now });
    else if (command === 'begin') {
      const receipt = proof();
      const shouldImport = production && !state.pending && engine.status(state, now).nextWindow.due && engine.checkUsage(receipt, now).allowed;
      const suggestions = shouldImport ? await pendingSuggestions(state) : [];
      output = engine.beginCycle(state, { proof: receipt, now, historical: flags.historical === true, suggestions });
    }
    else if (command === 'propose') output = engine.propose(state, input(), { proof: proof(), now });
    else if (command === 'complete') {
      output = engine.completeCycle(state, { proof: proof(), now });
      if (production && output.ok && output.cycle?.suggestionReviews?.length) {
        const receipts = output.cycle.suggestionReviews.map(terminalReview).filter(Boolean);
        save(stateFile, state);
        try { if (receipts.length) await suggestionRequest(receipts); }
        catch { output.suggestionReceiptPending = true; }
        const {suggestionReviews, ...cycle} = output.cycle;
        output.cycle = {...cycle, suggestionsReviewed:suggestionReviews.length};
        return {output};
      }
    }
    else if (command === 'skip') output = { ok: true, note: engine.recordSkip(state, { reason: flags.reason, usage: flags.usage ? engine.checkUsage(proof(), now) : null, now }) };
    else if (command === 'recruit') output = engine.recruit(state, input(), { proof: proof(), now });
    else if (command === 'published') {
      const usage = engine.checkUsage(proof(), now); if (!usage.allowed) output = { ok: false, usage };
      else {
        if (!/^[a-f0-9]{7,40}$/.test(flags.commit ?? '') || !/^https:\/\//.test(flags.url ?? '')) throw new Error('published requires verified --commit and --url');
        state.published = { commit: flags.commit, url: flags.url, at: now, latestCompletedAt: state.lastExport?.latestCompletedAt, sha256: state.lastExport?.sha256 }; output = { ok: true, published: state.published };
      }
    } else throw new Error(`unknown command ${command}`);
    return { state, output };
  });
} catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
