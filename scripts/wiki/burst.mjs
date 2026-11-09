import { createHash } from 'node:crypto';
import { articlesAt, checkUsage, completeCycle, cycleWindow, recordSkip, seeded, selectCohort } from './engine.mjs';
import { setupCommunity, prepareCommunityWindow } from './community.mjs';

export const BURST_ID = 'weekend-2026-11-07-08';
export const BURST_ROUNDS = 100;
export const BURST_START = '2026-11-08T20:00:00.000Z';
export const BURST_END = '2026-11-09T08:00:00.000Z';
const assert = (condition, message) => { if (!condition) throw Error(message); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function guard(state, proof, now) {
  const usage = checkUsage(proof, now);
  state.lastUsage = usage;
  return usage.allowed ? null : { ok: false, usage, deferred: recordSkip(state, {reason:usage.reason, usage, now}) };
}

function assertOriginalHistory(state) {
  const original = state.burst.originalEvents;
  assert(state.events.length >= original.count && hash(state.events.slice(0, original.count)) === original.sha256,
    'published history changed during the burst');
}

function summary(state) {
  const burst = state.burst;
  return {id:burst.id, completed:burst.rounds.length, total:burst.total, startAt:burst.startAt,
    endAt:burst.endAt, completedAt:burst.completedAt ?? null, nextScheduledCycle:burst.coveredCycleIndex + 1};
}

export function initializeBurst(state, {authorization, proof, now = new Date().toISOString()} = {}) {
  const denied = guard(state, proof, now); if (denied) return denied;
  assert(authorization === BURST_ID, `explicit --authorization ${BURST_ID} required`);
  if (state.burst) {
    assert(state.burst.id === BURST_ID, 'another burst is already recorded');
    assertOriginalHistory(state);
    return {ok:true, resumed:true, burst:summary(state)};
  }
  assert(state.foundingComplete && !state.pending, 'complete the pending scheduled window before starting the burst');
  assert(Date.parse(now) >= Date.parse(BURST_END), 'the complete Pacific weekend must have elapsed');
  assert(state.cycles.length === 85 && state.latestCompletedAt === BURST_START,
    'burst requires the verified turn-85 checkpoint; later history needs a new chronology plan');
  assert(state.events.every(event => event.timestamp <= BURST_START), 'existing event exceeds the burst start');
  assert((state.relationships ?? []).every(item => item.timestamp <= BURST_START), 'existing relationship exceeds the burst start');
  const windows = [];
  const weights = Array.from({length:BURST_ROUNDS}, (_, i) => 0.4 + seeded(state.seed, `${BURST_ID}:duration:${i}`) * 1.2);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let elapsedWeight = 0, start = Date.parse(BURST_START);
  for (const [index, weight] of weights.entries()) {
    elapsedWeight += weight;
    const end = index === BURST_ROUNDS - 1 ? Date.parse(BURST_END)
      : Date.parse(BURST_START) + Math.floor(elapsedWeight / totalWeight * (Date.parse(BURST_END) - Date.parse(BURST_START)));
    windows.push({id:`${BURST_ID}-round-${String(index + 1).padStart(3, '0')}`, round:index + 1,
      index:86, startAt:new Date(start).toISOString(), endAt:new Date(end).toISOString()});
    start = end;
  }
  state.burst = {id:BURST_ID, authorization, initializedAt:now, startAt:BURST_START, endAt:BURST_END,
    total:BURST_ROUNDS, coveredCycleIndex:86, originalEvents:{count:state.events.length, sha256:hash(state.events)},
    windows, rounds:[]};
  setupCommunity(state, now);
  state.updatedAt = now;
  state.operations.push({type:'burst-authorized', burstId:BURST_ID, at:now, total:BURST_ROUNDS});
  return {ok:true, burst:summary(state)};
}

export function beginBurstRound(state, {proof, now = new Date().toISOString()} = {}) {
  const denied = guard(state, proof, now); if (denied) return denied;
  assert(state.burst?.id === BURST_ID, 'initialize the explicitly authorized burst first');
  assertOriginalHistory(state);
  if (state.burst.completedAt) return {ok:true, complete:true, burst:summary(state)};
  if (state.pending) {
    assert(state.pending.mode === 'burst', 'another window is pending');
    return {ok:true, resumed:true, window:pendingSummary(state.pending)};
  }
  const window = state.burst.windows[state.burst.rounds.length];
  assert(window && Date.parse(window.endAt) <= Date.parse(now), 'burst round is not elapsed');
  assert(state.latestCompletedAt === window.startAt, 'burst checkpoint is not contiguous');
  state.pending = {...window, mode:'burst', participants:selectCohort(state.editors, window, state.seed),
    proposals:{}, openedAt:now,
    snapshotRevisionIds:Object.fromEntries([...articlesAt(state, window.startAt)].map(([id, article]) => [id, article.revisionId]))};
  prepareCommunityWindow(state, state.pending, now);
  state.updatedAt = now;
  return {ok:true, window:pendingSummary(state.pending)};
}

function pendingSummary(window) {
  return {id:window.id, round:window.round, startAt:window.startAt, endAt:window.endAt,
    participants:window.participants, proposed:Object.keys(window.proposals),
    remaining:window.participants.filter(id => !window.proposals[id])};
}

export function completeBurstRound(state, {proof, now = new Date().toISOString()} = {}) {
  const denied = guard(state, proof, now); if (denied) return denied;
  assert(state.burst?.id === BURST_ID, 'no authorized burst');
  assertOriginalHistory(state);
  if (!state.pending && state.burst.rounds.length) return {ok:true, duplicate:true, burst:summary(state)};
  assert(state.pending?.mode === 'burst', 'no pending burst round');
  const result = completeCycle(state, {proof, now});
  if (!result.ok) return result;
  const cycle = state.cycles.pop();
  assert(cycle.id === result.cycle.id, 'burst completion ledger mismatch');
  state.burst.rounds.push({...cycle, round:state.burst.rounds.length + 1});
  if (state.burst.rounds.length === state.burst.total) {
    const covered = cycleWindow(state.burst.coveredCycleIndex);
    state.cycles.push({...covered, mode:'burst-covered', coveredBy:state.burst.id,
      participants:[], actionCount:0, outcomes:[], completedExecutionAt:now});
    state.burst.completedAt = now;
    state.operations.push({type:'burst-complete', burstId:state.burst.id, at:now, coveredCycleId:covered.id});
  }
  assertOriginalHistory(state);
  return {...result, burst:summary(state)};
}
