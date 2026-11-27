import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from './engine.mjs';
import { BURST_ID, BURST_START, BURST_END, INFLUENCE_BURST_ID, initializeBurst, beginBurstRound, completeBurstRound } from './burst.mjs';

const now = '2026-11-09T10:00:00.000Z';
const proof = (remaining = 80) => ({checkedAt:now, result:{ordinaryUsageAllowed:true,
  rateLimitsByLimitId:{codex:{primary:{usedPercent:100 - remaining}}}}});
const options = () => ({proof:proof(), now});
const journal = 'I have read the passage and the discussion attached to it. I am leaving it alone for this visit because the example already identifies the uncertainty I had in mind. I would like to come back if somebody supplies a different example. For now I have no correction that would make the wording clearer without repeating the qualification already there.';

function checkpoint() {
  const state = engine.createState({now});
  engine.found(state, {articles:engine.FOUNDING_IDS.map((articleId, index, ids) => ({
    articleId, title:articleId.replaceAll('-', ' '),
    timestamp:new Date(Date.parse(engine.FOUNDING_AT) + (index + 1) * 60000).toISOString(),
    body:`This account of ${articleId} is connected to [[${ids[(index + 1) % ids.length]}]].`,
    categories:['Foundations'], summary:'First entry.', principleIds:['accuracy'], journal,
  }))}, options());
  state.cycles = Array.from({length:85}, (_, index) => ({...engine.cycleWindow(index + 1),
    mode:index < 76 ? 'historical' : 'recurring', participants:[], outcomes:[], actionCount:0,
    completedExecutionAt:'2026-11-08T20:01:00.000Z'}));
  state.latestCompletedAt = BURST_START;
  return state;
}

function abstentions(state) {
  for (const editorId of state.pending.participants) {
    engine.propose(state, {editorId, action:'abstain', timestamp:new Date(Date.parse(state.pending.startAt) + 1000).toISOString(),
      journal, summary:'Leave the current wording for now.'}, options());
  }
}

test('weekend authorization, elapsed time and original checkpoint are mandatory', () => {
  const state = checkpoint();
  assert.throws(() => initializeBurst(state, options()), /authorization/);
  const earlier = '2026-11-09T07:59:00.000Z';
  assert.throws(() => initializeBurst(state, {authorization:BURST_ID, now:earlier,
    proof:{...proof(), checkedAt:earlier}}), /elapsed/);
  state.latestCompletedAt = '2026-11-09T08:00:00.000Z';
  assert.throws(() => initializeBurst(state, {authorization:BURST_ID, ...options()}), /checkpoint/);
});

test('burst resumes exact cohort and proposals after serialization; quota stop preserves progress', () => {
  let state = checkpoint();
  initializeBurst(state, {authorization:BURST_ID, ...options()});
  assert.equal(engine.status(state, now).nextWindow.id, state.burst.windows[0].id);
  assert.equal(engine.recordSkip(state, {reason:'quota', now}).cycleId, state.burst.windows[0].id);
  beginBurstRound(state, options());
  const id = state.pending.participants[0];
  engine.propose(state, {editorId:id, action:'abstain', timestamp:new Date(Date.parse(state.pending.startAt) + 1000).toISOString(),
    journal, summary:'Leave it.'}, options());
  const originalPending = structuredClone(state.pending);
  state = JSON.parse(JSON.stringify(state));
  assert.equal(initializeBurst(state, {authorization:BURST_ID, ...options()}).resumed, true);
  assert.equal(beginBurstRound(state, options()).resumed, true);
  assert.deepEqual(state.pending, originalPending);
  assert.equal(completeBurstRound(state, {now, proof:proof(14)}).ok, false);
  assert.deepEqual(state.pending, originalPending);
  assert.equal(state.burst.rounds.length, 0);
  assert.throws(() => completeBurstRound(state, options()), /all selected/);
});

test('100 additional rounds preserve history, release delay and next regular cadence', () => {
  const state = checkpoint(), original = structuredClone(state.events);
  initializeBurst(state, {authorization:BURST_ID, ...options()});
  assert.throws(() => engine.beginCycle(state, options()), /burst/);
  const durations = new Set();
  for (let round = 1; round <= 100; round++) {
    beginBurstRound(state, options());
    assert.equal(state.pending.round, round);
    assert.ok(state.pending.participants.length >= 4 && state.pending.participants.length <= 6);
    durations.add(Date.parse(state.pending.endAt) - Date.parse(state.pending.startAt));
    const packet = engine.characterPacket(state, state.pending.participants[0]);
    assert.ok(packet.recentEvents.every(event => event.timestamp <= packet.window.startAt));
    abstentions(state);
    completeBurstRound(state, options());
    assert.equal(state.burst.rounds.length, round);
    assert.deepEqual(state.events.slice(0, original.length), original);
    assert.equal(state.cycles.length, round === 100 ? 86 : 85);
  }
  assert.ok(durations.size > 90, 'round lengths are irregular');
  assert.equal(state.latestCompletedAt, BURST_END);
  assert.equal(state.cycles.at(-1).mode, 'burst-covered');
  assert.equal(engine.status(state, now).nextWindow.id, 'cycle-0087');
  assert.equal(engine.status(state, now).nextWindow.startAt, BURST_END);
  assert.equal(completeBurstRound(state, options()).duplicate, true);
  const output = engine.exportPublic(state, options());
  assert.equal(output.meta.burstRoundCount, 100);
  assert.equal(output.cycles.filter(cycle => cycle.mode === 'burst').length, 100);
  assert.ok(output.journals.every(entry => !entry.id.includes(BURST_ID)), 'new burst journals retain 48 hour delay');
  assert.equal(engine.validatePublic(output).cycles, 186);
  state.events[0].body += ' altered';
  assert.throws(() => beginBurstRound(state, options()), /published history changed/);
});

test('50 influence rounds archive the completed weekend and resume at scheduled123', () => {
  const state=checkpoint();initializeBurst(state,{authorization:BURST_ID,...options()});
  state.burst.rounds=state.burst.windows.map(w=>({...w,mode:'burst',participants:[],outcomes:[],actionCount:0}));state.burst.completedAt=now;
  state.cycles=Array.from({length:121},(_,i)=>({...engine.cycleWindow(i+1),mode:'recurring',participants:[],outcomes:[],actionCount:0}));
  state.latestCompletedAt='2026-11-26T20:00:00.000Z';
  const actual='2026-11-27T09:00:00.000Z', opts={now:actual,proof:{...proof(),checkedAt:actual}};
  engine.addInfluenceEditors(state,opts);engine.enableBackendEdits(state,opts);
  const original=structuredClone(state.events);
  assert.equal(initializeBurst(state,{authorization:INFLUENCE_BURST_ID,...opts}).burst.total,50);
  assert.equal(state.burstArchive[0].rounds.length,100);
  assert.ok(state.editors.filter(e=>e.strategicContext).every(e=>e.joinedAt===state.burst.startAt));
  assert.equal(initializeBurst(state,{authorization:INFLUENCE_BURST_ID,...opts}).resumed,true);
  for(let round=0;round<50;round++){
    beginBurstRound(state,opts);const cohort=structuredClone(state.pending.participants);
    assert.equal(beginBurstRound(state,opts).resumed,true);assert.deepEqual(state.pending.participants,cohort);
    for(const editorId of cohort)engine.propose(state,{editorId,action:'abstain',timestamp:new Date(Date.parse(state.pending.startAt)+1000).toISOString(),journal,summary:'Wait.'},opts);
    completeBurstRound(state,opts);
  }
  assert.deepEqual(state.events.slice(0,original.length),original);
  const data=engine.exportPublic(state,opts);assert.equal(data.meta.burstRoundCount,150);assert.equal(data.cycles.filter(c=>c.mode==='burst').length,150);
  assert.equal(engine.status(state,actual).nextWindow.id,'cycle-0123');assert.equal(engine.validatePublic(data).cycles,272);
});
