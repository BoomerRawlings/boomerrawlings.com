import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as wiki from './engine.mjs';

const NOW = '2026-11-04T12:00:00.000Z';
const journal = 'I want these notes to remain useful even when a definition becomes awkward. The existing links give me somewhere to begin, but they do not settle what the words should mean. I am considering one small change and leaving its consequences open. A careful record seems more valuable than winning a disagreement before anyone has actually made one.';
const usage = (remaining = 80, now = NOW) => ({ checkedAt: now, result: { ordinaryUsageAllowed: true, rateLimitsByLimitId: { codex: { primary: { usedPercent: 100 - remaining, windowDurationMins: 10080 }, secondary: null } } } });
const options = () => ({ proof: usage(), now: NOW });
test('a queued suggestion stays with one reviewer and requires a private disposition', () => {
  const state = founded();
  const suggestion = {id:'reader-idea', kind:'revision', subject:'Knowledge', idea:'Clarify what counts as evidence.'};
  wiki.beginCycle(state, {...options(), suggestions:[suggestion]});
  const [editor] = state.pending.participants;
  assert.equal(wiki.characterPacket(state, editor).readerSuggestion.id, suggestion.id);
  assert.equal(wiki.characterPacket(state, editor).targetArticle.id, 'knowledge');
  assert.throws(() => wiki.propose(state, abstention(state), options()), /private review/);
  assert.ok(wiki.propose(state, abstention(state, editor, {
    suggestionReview:{id:suggestion.id, decision:'declined', reason:'The existing distinction is sufficient.'},
  }), options()).ok);
  const {cycle} = wiki.completeCycle(state, options());
  assert.equal(cycle.suggestionReviews[0].outcome, 'abstained');
  assert.equal(cycle.suggestionReviews[0].reviewer, editor);
  assert.ok(!JSON.stringify(wiki.exportPublic(state, options())).includes(suggestion.id));
});
test('a preferred reviewer can pass the idea to someone else and rejection needs a public explanation', () => {
  const state = founded();
  state.cycles = Array.from({length:76}, (_, index) => ({...wiki.cycleWindow(index + 1), mode:'historical'}));
  state.latestCompletedAt = state.cycles.at(-1).endAt;
  const suggestion = {id:'reader-idea', kind:'revision', subject:'Knowledge', idea:'Clarify what counts as evidence.', preferredEditor:'ellis47'};
  const first = '2026-11-04T20:01:00.000Z';
  const second = '2026-11-05T08:01:00.000Z';
  wiki.beginCycle(state, {now:first, proof:usage(80,first), suggestions:[suggestion]});
  assert.equal(state.pending.suggestions[0].reviewer, 'ellis47');
  for (const editor of state.pending.participants) {
    const review = editor === 'ellis47' ? {suggestionReview:{id:suggestion.id, decision:'declined', reason:'Another editor may have a better example.'}} : {};
    wiki.propose(state, abstention(state, editor, review), {now:first, proof:usage(80,first)});
  }
  wiki.completeCycle(state, {now:first, proof:usage(80,first)});
  wiki.beginCycle(state, {now:second, proof:usage(80,second), suggestions:[suggestion]});
  const reviewer = state.pending.suggestions[0].reviewer;
  assert.notEqual(reviewer,'ellis47');
  const review = {id:suggestion.id, decision:'rejected', reason:'The suggestion is already covered.'};
  assert.throws(() => wiki.propose(state, abstention(state, reviewer, {suggestionReview:review}), {now:second, proof:usage(80,second)}), /public note/);
  assert.ok(wiki.propose(state, abstention(state, reviewer, {suggestionReview:{...review, publicNote:'The existing examples already cover this distinction.'}}), {now:second, proof:usage(80,second)}).ok);
});
test('released notes label abstention and disclose only qualitative recorded effects', () => {
  const timestamp = '2026-10-01T00:00:00.000Z';
  const releasedAt = '2026-10-03T00:00:00.000Z';
  const state = {
    cycles: [{id:'cycle-1', outcomes:[{editorId:'editor', action:'abstain', stateUpdate:{frustrationDelta:0.02, evidenceIds:['private-reference']}}]}],
    events: [],
    journals: [{id:'journal-cycle-1-editor', editorId:'editor', eventId:null, timestamp, releasedAt, body:journal, outcome:'No public action was taken.', generatedAt:NOW}],
  };
  assert.deepEqual(wiki.releasedEditorNotes(state, timestamp), []);
  const [note] = wiki.releasedEditorNotes(state, releasedAt);
  assert.equal(note.action, 'abstain');
  assert.deepEqual(note.response, ['More frustrated']);
  assert.equal(note.stateUpdate, undefined);
  assert.equal(note.generatedAt, undefined);
});
const seed = () => ({ articles: wiki.FOUNDING_IDS.map((id, i, ids) => ({ articleId: id, title: id.replaceAll('-', ' '), timestamp: new Date(Date.parse(wiki.FOUNDING_AT) + (i + 1) * 600000).toISOString(), body: `## Starting point\n\nThis short entry considers ${id.replaceAll('-', ' ')}. Its scope is connected with [[${ids[(i + 1) % ids.length]}|the next subject]]. The connection is a starting point rather than a final explanation.`, categories: ['Foundations'], summary: 'Added an initial connected entry.', principleIds: ['comprehensiveness'], journal })) });
function founded() { const state = wiki.createState({ now: NOW }); wiki.found(state, seed(), options()); return state; }
function open(state = founded()) { wiki.beginCycle(state, { ...options(), historical: true }); return state; }
function abstention(state, editorId = state.pending.participants[0], additions = {}) {
  return { editorId, timestamp: new Date(Date.parse(state.pending.startAt) + 3600000).toISOString(), action: 'abstain', journal, summary: 'Considered the existing entries.', ...additions };
}
function finish(state) {
  for (const id of state.pending.participants) wiki.propose(state, abstention(state, id), options());
  return wiki.completeCycle(state, options());
}

test('76 exact windows retain the requested Pacific midnight across DST', () => {
  assert.equal(wiki.cycleWindow(1).startAt, wiki.CYCLE_START);
  assert.equal(wiki.cycleWindow(76).endAt, wiki.HISTORICAL_END);
  assert.equal((Date.parse(wiki.HISTORICAL_END) - Date.parse(wiki.CYCLE_START)) / wiki.WINDOW_MS, 76);
  for (let index = 1; index <= 76; index++) assert.equal(Date.parse(wiki.cycleWindow(index).endAt) - Date.parse(wiki.cycleWindow(index).startAt), wiki.WINDOW_MS);
  const fmt = date => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23' }).format(new Date(date));
  assert.equal(fmt(wiki.cycleWindow(1).startAt), '01');
  assert.equal(fmt(wiki.HISTORICAL_END), '00');
});

test('arrivals are reproducible, fixed second date, separated, and all before cutoff', () => {
  const first = wiki.initialEditors();
  assert.deepEqual(first, wiki.initialEditors());
  assert.equal(first[0].id, 'bluemonday');
  assert.equal(first[1].id, 'ellis47');
  assert.equal(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(first[1].joinedAt)), '2026-10-02');
  for (let i = 2; i < first.length; i++) assert.ok(Date.parse(first[i].joinedAt) - Date.parse(first[i - 1].joinedAt) >= 10 * wiki.WINDOW_MS);
  assert.ok(first.at(-1).joinedAt < wiki.HISTORICAL_END);
  assert.notDeepEqual(first.map(item => item.joinedAt), wiki.initialEditors('different').map(item => item.joinedAt));
});

test('usage checks lowest window, exact thresholds, absent windows, unknown and stale', () => {
  assert.equal(wiki.checkUsage(usage(15), NOW).allowed, true);
  assert.equal(wiki.checkUsage(usage(14), NOW).reason, 'low-usage');
  assert.equal(wiki.checkUsage(usage(10), NOW).reason, 'hard-usage-stop');
  const two = usage(80); two.result.rateLimitsByLimitId.codex.secondary = { usedPercent: 91 };
  assert.equal(wiki.checkUsage(two, NOW).remaining, 9);
  assert.equal(wiki.checkUsage({ checkedAt: NOW, result: { ordinaryUsageAllowed: true, rateLimits: { primary: null } } }, NOW).allowed, false);
  assert.equal(wiki.checkUsage(usage(80, '2026-11-04T11:00:00Z'), NOW).allowed, false);
  const wrapped = { checkedAt: NOW, result: { content: [{ type: 'text', text: JSON.stringify(usage().result) }] } };
  assert.equal(wiki.checkUsage(wrapped, NOW).remaining, 80);
  const denied = usage(); denied.result.ordinaryUsageAllowed = false;
  assert.equal(wiki.checkUsage(denied, NOW).allowed, false);
  const malformed = usage(); malformed.result.rateLimitsByLimitId.codex.secondary = { usedPercent: null };
  assert.equal(wiki.checkUsage(malformed, NOW).allowed, false);
  const otherUnknown = usage(); otherUnknown.result.rateLimitsByLimitId.model = { primary: {} };
  otherUnknown.limitIds = ['codex'];
  assert.equal(wiki.checkUsage(otherUnknown, NOW).allowed, false);
});

test('founding is validated atomically and duplicate input is idempotent', () => {
  const state = wiki.createState({ now: NOW }), input = seed();
  const invalid = structuredClone(input); invalid.articles[4].body = '<script>bad()</script>';
  assert.throws(() => wiki.found(state, invalid, options()), /HTML/);
  assert.equal(state.events.length, 0);
  wiki.found(state, input, options());
  const size = state.events.length;
  assert.equal(wiki.found(state, input, options()).duplicate, true);
  assert.equal(state.events.length, size);
  const different = structuredClone(input); different.articles[0].summary = 'Changed';
  assert.throws(() => wiki.found(state, different, options()), /different content/);
});

test('cohorts preserve historical bounds and use 4–24 for later turns', () => {
  const editors = Array.from({ length: 35 }, (_, index) => ({ id: `editor-${index}`, joinedAt: wiki.FOUNDING_AT, activity: 0.5 + (index % 5) / 10, lastActedCycle: 0 }));
  const sizes = new Set();
  for (let i = 1; i <= 150; i++) {
    const window = wiki.cycleWindow(i), cohort = wiki.selectCohort(editors, window, 'test');
    const [minimum, maximum] = i <= 76 ? [3,20] : [4,24];
    assert.ok(cohort.length >= minimum && cohort.length <= maximum);
    assert.equal(new Set(cohort).size, cohort.length);
    assert.deepEqual(cohort, wiki.selectCohort(editors, window, 'test'));
    sizes.add(cohort.length);
  }
  assert.ok(sizes.has(3) && sizes.has(24) && sizes.size > 10);
  assert.equal(wiki.selectCohort(editors.slice(0, 1), wiki.cycleWindow(1), 'test').length, 1);
  assert.equal(wiki.selectCohort(editors.slice(0, 2), wiki.cycleWindow(1), 'test').length, 2);
  assert.equal(wiki.selectCohort([{ ...editors[0], joinedAt: wiki.cycleWindow(1).endAt }], wiki.cycleWindow(1), 'test').length, 0);
});

test('begin resumes the same cohort and excludes incomplete future windows', () => {
  const state = founded();
  const before = '2026-09-27T19:59:59Z';
  assert.equal(wiki.beginCycle(state, { proof: usage(80, before), now: before, historical: true }).due, false);
  assert.equal(state.pending, null);
  wiki.beginCycle(state, { ...options(), historical: true });
  const first = structuredClone(state.pending);
  assert.equal(wiki.beginCycle(state, { ...options(), historical: true }).resumed, true);
  assert.deepEqual(state.pending, first);
});

test('packets expose only own memory and known current public material', () => {
  const state = open();
  state.editors[1].memory.push({ text: 'OTHER_PRIVATE_SECRET', references: [] });
  state.journals.push({ body: 'JOURNAL_SECRET' });
  const packet = wiki.characterPacket(state, 'bluemonday');
  const serialized = JSON.stringify(packet);
  assert.ok(!serialized.includes('OTHER_PRIVATE_SECRET') && !serialized.includes('JOURNAL_SECRET'));
  assert.ok(!serialized.includes('wiki/map') && !serialized.includes('remaining') && !serialized.includes('deferrals'));
  assert.equal(packet.targetArticle.body.includes('\n\n'), true);
  assert.ok(packet.recentEvents.length <= 5 && packet.personalMemory.important.length <= 3);
  assert.equal(packet.community.length, 1);
  assert.throws(() => wiki.characterPacket(state, 'ellis47'), /not selected/);
});

test('proposal rejects future reference, orphan, unknown link, HTML and off-window time', () => {
  const state = open();
  const valid = abstention(state, 'bluemonday', { action: 'create', articleId: 'a-new-entry', title: 'A new entry', body: 'A small note connected to [[knowledge]].' });
  assert.throws(() => wiki.propose(state, { ...valid, body: 'An isolated thought.' }, options()), /must link/);
  assert.throws(() => wiki.propose(state, { ...valid, body: 'Connected to [[not-created-yet]].' }, options()), /must link/);
  assert.throws(() => wiki.propose(state, { ...valid, body: '[[knowledge]] <img src=x onerror=alert(1)>' }, options()), /HTML/);
  assert.throws(() => wiki.propose(state, { ...valid, references: ['cycle-9999-ellis47'] }, options()), /observations/);
  assert.throws(() => wiki.propose(state, { ...valid, timestamp: state.pending.endAt }, options()), /outside/);
  assert.equal(wiki.propose(state, valid, options()).ok, true);
  assert.equal(wiki.propose(state, valid, options()).duplicate, true);
  assert.throws(() => wiki.propose(state, { ...valid, summary: 'Different proposal' }, options()), /already exists/);
});

test('conflicting edits preserve first revision, accepted/rejected journals and complete cohort', () => {
  const state = founded(); state.editors[1].joinedAt = wiki.FOUNDING_AT;
  state.events.find(event => event.articleId === 'knowledge').body += '\n\nSharedtarget.';
  for (const editor of state.editors.slice(0, 2)) editor.interests = Array(8).fill('sharedtarget');
  wiki.beginCycle(state, { ...options(), historical: true });
  const original = wiki.articlesAt(state).get('knowledge');
  for (const [index, id] of state.pending.participants.entries()) {
    assert.equal(wiki.characterPacket(state, id).targetArticle.id, 'knowledge');
    wiki.propose(state, abstention(state, id, { action: 'expand', articleId: 'knowledge', baseRevisionId: original.revisionId, timestamp: new Date(Date.parse(state.pending.startAt) + (index + 1) * 3600000).toISOString(), body: `${original.body}\n\nEditor ${index} proposes a modest addition.` }), options());
  }
  const result = wiki.completeCycle(state, options());
  assert.equal(result.cycle.actionCount, 1);
  assert.deepEqual(result.cycle.outcomes.map(item => item.outcome), ['accepted', 'conflict']);
  const current = wiki.articlesAt(state).get('knowledge');
  assert.ok(current.body.includes('Editor 0') && !current.body.includes('Editor 1'));
  assert.deepEqual(current.categories, original.categories);
  assert.match(state.journals.at(-1).outcome, /Not published/);
  assert.equal(state.journals.at(-1).eventId, null);
  assert.match(state.editors.find(editor => editor.id === result.cycle.outcomes[1].editorId).memory.at(-1).text, /Not published/);
  assert.equal(wiki.completeCycle(state, options()).duplicate, true);
  assert.equal(state.cycles.length, 1);
});

test('full replacements cannot delete an unseen tail or rewrite an index-only article', () => {
  const state = founded();
  for (const event of state.events.filter(event => event.revisionId)) event.body += `\n\n${'observations '.repeat(700)}UNSEEN_TAIL`;
  open(state);
  const packet = wiki.characterPacket(state, 'bluemonday'), target = packet.targetArticle;
  assert.equal(target.bodyComplete, false);
  assert.throws(() => wiki.propose(state, abstention(state, 'bluemonday', { action: 'revise', articleId: target.id, baseRevisionId: target.revisionId, body: target.body }), options()), /complete observed target/);
  assert.ok(wiki.articlesAt(state).get(target.id).body.endsWith('UNSEEN_TAIL'));
  assert.deepEqual(state.pending.proposals, {});
  const short = open(), visible = wiki.characterPacket(short, 'bluemonday').targetArticle;
  const unseen = [...wiki.articlesAt(short).values()].find(article => article.id !== visible.id);
  assert.throws(() => wiki.propose(short, abstention(short, 'bluemonday', { action: 'expand', articleId: unseen.id, baseRevisionId: unseen.revisionId, body: `${unseen.body}\n\nAn unobserved replacement.` }), options()), /complete observed target/);
});

test('revert sources must be observed revisions, not guessed archive identifiers', () => {
  const state = founded(), first = state.events.find(event => event.articleId === 'knowledge');
  first.body += '\n\nSharedtarget.';
  state.editors[0].interests = Array(8).fill('sharedtarget');
  state.editors[0].memory = []; state.editors[0].longTermMemory = [];
  for (let index = 1; index <= 10; index++) state.events.push({ ...first, id: `prior-${index}`, revisionId: `prior-${index}`, action: 'expand', timestamp: new Date(Date.parse(wiki.FOUNDING_END) + index * 60000).toISOString(), body: `${first.body}\n\nRecorded addition ${index}.` });
  open(state);
  const packet = wiki.characterPacket(state, 'bluemonday');
  assert.equal(packet.targetArticle.id, 'knowledge');
  assert.ok(!packet.knownEventIds.includes(first.id));
  const input = abstention(state, 'bluemonday', { action: 'revert', articleId: 'knowledge', baseRevisionId: packet.targetArticle.revisionId, revertRevisionId: first.id });
  assert.throws(() => wiki.propose(state, input, options()), /not observed/);
  const known = packet.recentEvents.find(event => event.articleId === 'knowledge' && event.id !== packet.targetArticle.revisionId);
  assert.ok(known);
  assert.equal(wiki.propose(state, { ...input, revertRevisionId: known.id }, options()).ok, true);
});

test('partial cycles remain private and usage deferral preserves choices for resume', () => {
  const state = founded(); state.editors[1].joinedAt = wiki.FOUNDING_AT;
  wiki.beginCycle(state, { ...options(), historical: true });
  wiki.propose(state, abstention(state), options());
  assert.throws(() => wiki.completeCycle(state, options()), /all selected/);
  const before = structuredClone(state.pending);
  const result = wiki.completeCycle(state, { proof: usage(14), now: NOW });
  assert.equal(result.ok, false);
  assert.deepEqual(state.pending, before);
  assert.equal(state.deferrals[0].cycleId, 'cycle-0001');
  assert.equal(state.cycles.length, 0);
  const published = wiki.exportPublic(state, options());
  assert.equal(published.cycles.length, 0);
  const remaining = state.pending.participants.filter(id => !state.pending.proposals[id]);
  for (const id of remaining) wiki.propose(state, abstention(state, id), options());
  wiki.completeCycle(state, options());
  assert.equal(state.cycles.length, 1);
});

test('journal release follows completed simulated time, never elapsed wall clock', () => {
  const state = open(); finish(state);
  const firstJournal = state.journals.find(entry => entry.id === 'journal-cycle-0001-bluemonday');
  assert.ok(!wiki.exportPublic(state, options()).journals.some(entry => entry.id === firstJournal.id));
  const yearsLater = '2029-11-04T12:00:00Z';
  assert.ok(!wiki.exportPublic(state, { proof: usage(80, yearsLater), now: yearsLater }).journals.some(entry => entry.id === firstJournal.id));
  for (let index = 2; index <= 5; index++) { wiki.beginCycle(state, { ...options(), historical: true }); finish(state); }
  const data = wiki.exportPublic(state, options());
  assert.ok(data.journals.some(entry => entry.id === firstJournal.id));
  assert.ok(data.journals.every(entry => entry.releasedAt <= data.meta.latestCompletedAt));
  assert.ok(!JSON.stringify(data).includes('generatedAt":"2026-11-04T12:00:00.000Z","outcome'));
  assert.ok(data.editors.every(editor => !('memory' in editor) && !('temporary' in editor)));
  assert.equal(wiki.validatePublic(data).cycles, 5);
});

test('a full historical traversal is chronological, joined users never act early, and duplicate-free', () => {
  const state = founded();
  for (let index = 1; index <= 76; index++) {
    wiki.beginCycle(state, { ...options(), historical: true });
    for (const id of state.pending.participants) assert.ok(state.editors.find(editor => editor.id === id).joinedAt <= state.pending.startAt);
    finish(state);
  }
  assert.equal(state.latestCompletedAt, wiki.HISTORICAL_END);
  assert.equal(state.cycles.length, 76);
  assert.equal(new Set(state.events.map(event => event.id)).size, state.events.length);
  assert.equal(state.events.filter(event => event.action === 'join').length, 6);
  assert.equal(wiki.exportPublic(state, options()).editors.length, 6);
  assert.equal(wiki.beginCycle(state, { ...options(), historical: true }).due, false);
});

test('recurring catch-up stops after three windows per real wake without losing backlog', () => {
  const state = founded();
  for (let i = 0; i < 3; i++) { assert.equal(wiki.beginCycle(state, options()).ok, true); finish(state); }
  const fourth = wiki.beginCycle(state, options());
  assert.equal(fourth.ok, false);
  assert.equal(fourth.reason, 'catch-up-batch-limit');
  assert.equal(state.cycles.length, 3);
  const nextWake = '2026-11-05T00:00:00Z';
  assert.equal(wiki.beginCycle(state, { proof: usage(80, nextWake), now: nextWake }).window.id, 'cycle-0004');
});

test('public validator rejects private state, unreleased journals and broken links', () => {
  const data = wiki.exportPublic(founded(), options());
  assert.equal(wiki.validatePublic(data).articles, 5);
  assert.throws(() => wiki.validatePublic({ ...data, pending: {} }), /unexpected/);
  const privateEditor = structuredClone(data); privateEditor.editors[0].memory = ['secret'];
  assert.throws(() => wiki.validatePublic(privateEditor), /private/);
  const leak = structuredClone(data); leak.journals.push({ timestamp: NOW, releasedAt: '2026-11-06T12:00:00Z' });
  assert.throws(() => wiki.validatePublic(leak), /unreleased/);
  const broken = structuredClone(data); broken.events.find(event => event.action === 'create').body = 'A link to [[missing]].';
  assert.throws(() => wiki.validatePublic(broken), /broken/);
});

test('CLI persistence survives restart; init preserves existing private inputs; no lock leak', () => {
  const directory = mkdtempSync(join(tmpdir(), 'wiki-engine-test-'));
  try {
    const run = (...args) => spawnSync(process.execPath, [resolve('scripts/wiki/cli.mjs'), ...args, '--private', directory, '--now', NOW], { encoding: 'utf8' });
    const proposal = join(directory, 'founding.json'), meter = join(directory, 'usage.json');
    writeFileSync(proposal, JSON.stringify(seed())); writeFileSync(meter, JSON.stringify(usage()));
    assert.equal(run('init').status, 0);
    assert.ok(existsSync(proposal));
    assert.equal(run('found', '--file', proposal, '--usage', meter).status, 0);
    assert.equal(run('begin', '--historical', '--usage', meter).status, 0);
    const state = JSON.parse(readFileSync(join(directory, 'state.json'), 'utf8'));
    assert.equal(state.pending.id, 'cycle-0001');
    assert.equal(run('init').status, 0);
    assert.equal(JSON.parse(run('status').stdout).pending.id, 'cycle-0001');
    assert.ok(!existsSync(join(directory, 'state.lock')));
    const bad = run('propose', '--file', proposal, '--usage', meter);
    assert.notEqual(bad.status, 0);
    assert.ok(!existsSync(join(directory, 'state.lock')));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('optional state and long-term updates reject unobserved evidence and invalid bounds', () => {
  const state = open(), evidence = wiki.characterPacket(state, 'bluemonday').knownEventIds[0];
  const input = additions => abstention(state, 'bluemonday', additions);
  for (const update of [
    { frustrationDelta: 0.09, evidenceIds: [evidence] },
    { enthusiasmDelta: null, evidenceIds: [evidence] },
    { enthusiasmDelta: '0.02', evidenceIds: [evidence] },
    { frustrationDelta: 0.02, evidenceIds: ['cycle-9999-bluemonday'] },
    { enthusiasmDelta: 0.02, evidenceIds: [] },
  ]) assert.throws(() => wiki.propose(state, input({ stateUpdate: update }), options()), /state update/);
  for (const memory of [
    [{ text: 'An unsupported private observation.', references: [] }],
    [{ text: 'An observation of a future edit.', references: ['cycle-9999-bluemonday'] }],
    [{ text: 'A '.repeat(41), references: [evidence] }],
    Array.from({ length: 4 }, () => ({ text: 'A remembered observation.', references: [evidence] })),
  ]) assert.throws(() => wiki.propose(state, input({ longTermMemory: memory }), options()), /long-term memory/);
  assert.deepEqual(state.pending.proposals, {});
});

test('moods respond to evidence, decay and clamp without altering stable traits or relationships', () => {
  const state = open(), editor = state.editors[0], stable = structuredClone(editor.dispositions);
  editor.temporary = { frustration: 0, enthusiasm: 1 };
  const evidenceIds = [wiki.characterPacket(state, editor.id).knownEventIds[0]];
  wiki.propose(state, abstention(state, editor.id, { stateUpdate: { frustrationDelta: 0.08, enthusiasmDelta: 0.08, evidenceIds } }), options());
  wiki.completeCycle(state, options());
  assert.deepEqual(editor.temporary, { frustration: 0.08, enthusiasm: 1 });
  assert.deepEqual(editor.dispositions, stable);
  assert.deepEqual(state.relationships, []);
  assert.deepEqual(state.cycles[0].outcomes[0].stateUpdate.evidenceIds, evidenceIds);
  assert.ok(!JSON.stringify(wiki.exportPublic(state, options())).includes('stateUpdate'));
  wiki.beginCycle(state, { ...options(), historical: true }); finish(state);
  assert.equal(editor.temporary.frustration, 0.08 * 0.9);
  assert.equal(editor.temporary.enthusiasm, 0.97);
  wiki.beginCycle(state, { ...options(), historical: true });
  wiki.propose(state, abstention(state, editor.id, { stateUpdate: { frustrationDelta: -0.08, evidenceIds } }), options());
  wiki.completeCycle(state, options());
  assert.equal(editor.temporary.frustration, 0);
});

test('retained memory survives rolling eviction, summaries are bounded and packets include the latest receipt', () => {
  const state = open(), editor = state.editors[0];
  const evidence = wiki.characterPacket(state, editor.id).knownEventIds[0];
  const retained = [
    { text: 'Knowledge remains connected to human behavior and significance.', references: [evidence] },
    { text: Array(40).fill('Observation').join(' '), references: [evidence] },
    { text: Array(40).fill('Context').join(' '), references: [evidence] },
  ];
  wiki.propose(state, abstention(state, editor.id, { longTermMemory: retained }), options());
  wiki.completeCycle(state, options());
  for (let i = 2; i <= 14; i++) { wiki.beginCycle(state, { ...options(), historical: true }); finish(state); }
  assert.equal(editor.memory.length, 12);
  assert.equal(editor.longTermMemory.length, 3);
  assert.ok(wiki.wordCount(editor.memorySummary) <= 120);
  wiki.beginCycle(state, { ...options(), historical: true });
  // Cohort selection can omit an account later; these first fifteen windows contain the founder.
  const before = JSON.stringify(state), packet = wiki.characterPacket(state, editor.id);
  assert.equal(JSON.stringify(state), before, 'packet reads must not mutate the checkpoint');
  assert.deepEqual(packet, wiki.characterPacket(JSON.parse(before), editor.id));
  assert.ok(packet.personalMemory.important.length <= 3);
  assert.equal(packet.personalMemory.important[0].text, editor.memory.at(-1).text);
  assert.ok(packet.personalMemory.important.some(memory => memory.text === retained[0].text));
  assert.ok(packet.personalMemory.summary.includes(retained[0].text));
  assert.ok(packet.personalMemory.summaryReferences.every(id => packet.knownEventIds.includes(id)));
  const data = wiki.exportPublic(state, options());
  assert.ok(data.editors.every(value => !('longTermMemory' in value) && !('memorySummary' in value)));
});

test('old checkpoints and old pending proposals upgrade from own memories without rewriting history', () => {
  const state = open(), editor = state.editors[0];
  delete editor.longTermMemory; editor.memorySummary = '';
  editor.memory.push({ text: 'MY_OWN_OBSERVATION about knowledge.', references: ['founding-knowledge'], timestamp: wiki.FOUNDING_END });
  state.editors[1].memory.push({ text: 'OTHER_PRIVATE_OBSERVATION', references: ['founding-knowledge'], timestamp: wiki.FOUNDING_END });
  editor.memory.push({ text: 'FUTURE_MEMORY', references: ['cycle-9999-bluemonday'], timestamp: wiki.FOUNDING_END });
  const packet = wiki.characterPacket(state, editor.id);
  assert.ok(packet.personalMemory.summary.includes('MY_OWN_OBSERVATION'));
  assert.ok(!JSON.stringify(packet).includes('OTHER_PRIVATE_OBSERVATION') && !JSON.stringify(packet).includes('FUTURE_MEMORY'));
  wiki.propose(state, abstention(state), options());
  const saved = JSON.parse(JSON.stringify(state)), events = JSON.stringify(saved.events), journals = JSON.stringify(saved.journals);
  assert.equal(wiki.propose(saved, abstention(saved), options()).duplicate, true);
  wiki.completeCycle(saved, options());
  assert.equal(JSON.stringify(saved.events), events);
  assert.equal(JSON.stringify(saved.journals.slice(0, -1)), journals);
  assert.ok(saved.editors[0].longTermMemory.some(memory => memory.text.includes('MY_OWN_OBSERVATION')));
  assert.ok(saved.editors[0].memorySummary && wiki.wordCount(saved.editors[0].memorySummary) <= 120);
});

test('new recruits accept bounded dispositions without changing existing profiles', () => {
  const state = founded();
  state.cycles = Array.from({ length: 100 }, (_, i) => wiki.cycleWindow(i + 1));
  state.latestCompletedAt = wiki.cycleWindow(100).endAt;
  for (let i = 0; i < 1000 && !wiki.recruitmentOpportunity(state); i++) state.seed = `recruit-fixture-${i}`;
  assert.ok(wiki.recruitmentOpportunity(state));
  const before = state.editors.map(editor => structuredClone(editor.dispositions));
  const profile = { id: 'morris', name: 'Morris', interests: ['knowledge', 'experience'], description: 'Interested in how ordinary experiences become accepted knowledge.', style: 'Direct, patient, careful about definitions.', dispositions: { curiosity: 0.8, cooperation: 0.4 } };
  assert.throws(() => wiki.recruit(state, { ...profile, dispositions: { curiosity: 1.1 } }, options()), /disposition values/);
  assert.throws(() => wiki.recruit(state, { ...profile, dispositions: { toString: 0.4 } }, options()), /unknown disposition/);
  wiki.recruit(state, profile, options());
  assert.deepEqual(state.editors.slice(0, -1).map(editor => editor.dispositions), before);
  assert.deepEqual(state.editors.at(-1).dispositions, { curiosity: 0.8, conscientiousness: 0.7, cooperation: 0.4 });
});
