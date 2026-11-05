import test from 'node:test';
import assert from 'node:assert/strict';
import {openPolicy, policyPacket, recordPolicyDecision, advancePolicy} from './policy.mjs';

test('policy discussion precedes independent ballots and adoption needs a majority of eligible editors', () => {
  const now = '2026-11-04T20:00:00.000Z';
  const editors = ['a','b','c','d','e','f'];
  for (const support of [3,4]) {
    const state = {
      editors: editors.map(id => ({id,name:id,joinedAt:now})),
      events: [{id:'policy-1',action:'policy',title:'Categories',body:'Use topic categories.',editorId:'a',timestamp:now}],
      journals: [],
    };
    const session = openPolicy(state, 'policy-1', now);
    const record = (editorId, phase, vote) => recordPolicyDecision(state, {id:session.id, editorId, phase, vote, body:'A reason.', journal:'An editor note.'}, now);
    assert.throws(() => record('a','vote','support'), /wrong phase/);
    assert.throws(() => advancePolicy(state,session.id,now), /Awaiting/);
    for (const editor of editors) record(editor,'discussion');
    assert.throws(() => record('a','discussion'), /already responded/);
    advancePolicy(state,session.id,now);
    assert.equal(policyPacket(state,session.id,'a').discussion.length,6);
    for (const [index,editor] of editors.entries()) record(editor,'vote',index < support ? 'support' : 'abstain');
    advancePolicy(state,session.id,now);
    assert.equal(session.result, support === 4 ? 'adopted' : 'rejected');
    assert.equal(state.journals.length,12);
    assert.throws(() => record('a','vote','support'), /unavailable/);
  }
});
