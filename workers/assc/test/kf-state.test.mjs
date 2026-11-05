import { configurePresentation } from '../client/presentation.js';
configurePresentation({ version: 1, subjectId: 'fictional-subject', subjectLabel: 'Fictional Person', forumAccountId: 'fixture.example:user:42', forumAccountToken: '42', forumProfileIdPrefix: 'fixture-user-', text: {} });
import test from 'node:test';
import assert from 'node:assert/strict';
import {kfDefaults,toggleKFMonth,selectedKFMonth,encodeKFRoute,decodeKFRoute,filterAccount} from '../client/kf-state.js';
test('selecting the same month clears it; another month and clear preserve other filters',()=>{
  let state={...kfDefaults(),excludeSubject:true,metric:'characters'};state=toggleKFMonth(state,'2020-02');assert.equal(state.to,'2020-02-29');assert.equal(selectedKFMonth(state),'2020-02');state=toggleKFMonth(state,'2020-02');assert.equal(state.from,'');assert(state.excludeSubject);state=toggleKFMonth(state,'2021-03');assert.equal(state.to,'2021-03-31');
});
test('filter routes round-trip dates, exact account exclusion, search and chart state',()=>{
  const state={...kfDefaults(),from:'2022-01-01',to:'2022-12-31',excludeSubject:true,metric:'repliesReceived',top:25,trend:'cumulative',query:'some / handle',page:2};assert.deepEqual(decodeKFRoute(encodeKFRoute(state)),state);assert.equal(decodeKFRoute('#profile/someone'),null);
});
test('subject filter resolves only its explicit observed forum account; never substring aliases',()=>{
  assert.equal(filterAccount({accounts:[{id:'other',names:['Fictional Person']},{id:'fixture.example:user:42',names:['NotFictional Person'] }]}),null);
  assert.equal(filterAccount({accounts:[{id:'fixture.example:user:42',names:['Fictional Person']}]}).id,'fixture.example:user:42');
});
