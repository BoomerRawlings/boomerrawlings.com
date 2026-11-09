import test from 'node:test';
import assert from 'node:assert/strict';
import {setupCommunity, prepareCommunityWindow, communityPacket} from './community.mjs';

const generatedAt = '2026-11-09T12:00:00.000Z';
function fixture() {
  return {
    seed: 'community-test', latestCompletedAt: '2026-11-08T20:00:00.000Z',
    editors: ['norab', 'ellis47', 'paulm', 'bluemonday'].map(id => ({id})),
    events: [
      {id: 'care-1', revisionId: 'care-1', timestamp: '2026-11-08T17:00:00.000Z', action: 'create', articleId: 'care', title: 'Care', body: 'The helpers arranged a visit.', editorId: 'norab'},
      {id: 'comment-1', timestamp: '2026-11-08T17:01:00.000Z', action: 'comment', articleId: 'care', body: 'Who agreed to it?', editorId: 'ellis47', references: ['care-1']},
      {id: 'future', timestamp: '2026-11-09T05:00:00.000Z', action: 'comment', articleId: 'future', body: 'Future knowledge.', editorId: 'paulm'},
    ],
  };
}
function window(index) {
  const start = Date.parse('2026-11-08T20:00:00.000Z') + index * 60000;
  return {id: `burst-${index}`, startAt: new Date(start).toISOString(), endAt: new Date(start + 60000).toISOString(), participants: ['norab', 'ellis47', 'paulm']};
}

test('explicit setup is idempotent and preserves existing history', () => {
  const state = fixture();
  state.events.pop();
  const original = structuredClone(state.events);
  const setup = setupCommunity(state, generatedAt);
  assert.equal(setupCommunity(state, '2026-11-10T00:00:00.000Z'), setup);
  assert.equal(setup.effectiveAt, '2026-11-08T17:01:00.001Z');
  assert.deepEqual(state.events, original);
  assert.equal(state.editors.filter(editor => editor.personalContext?.adult).length, 3);
  assert.ok(state.editors.filter(editor => editor.personalContext).every(editor => editor.personalContext.age >= 30));
  assert.equal(state.editors[3].personalContext, undefined);
});

test('first outside input is fair care criticism with distinct private provenance', () => {
  const state = fixture();
  state.events.pop();
  setupCommunity(state, generatedAt);
  const opening = window(0);
  prepareCommunityWindow(state, opening, generatedAt);
  const packet = communityPacket(state, 'norab', opening);
  assert.equal(state.communityExperiment.inputs[0].origin, 'fictional-outside');
  assert.equal(packet.outsideInputs[0].source, 'Exceptions');
  assert.match(packet.outsideInputs[0].body, /ask the person receiving help/);
  assert.equal(packet.outsideInputs[0].revisionId, 'care-1');
  assert.equal(packet.readerSuggestion, undefined);
  assert.equal(packet.outsideInputs[0].generatedAt, undefined);
  assert.equal(packet.outsideInputs[0].origin, undefined);
  assert.ok(packet.publicEvidence.some(event => event.id === 'care-1'));
});

test('retries preserve exposures and packet reads do not change private state', () => {
  const state = fixture();
  state.events.pop();
  setupCommunity(state, generatedAt);
  const opening = window(0);
  prepareCommunityWindow(state, opening, generatedAt);
  const before = structuredClone(state);
  prepareCommunityWindow(state, opening, '2026-11-10T00:00:00.000Z');
  communityPacket(state, 'norab', opening);
  assert.deepEqual(state, before);
  assert.deepEqual(communityPacket(state, 'bluemonday', opening).outsideInputs, []);
});

test('persistent dated discussions carry exact references without future or other private knowledge', () => {
  const state = fixture();
  const future = state.events.pop();
  setupCommunity(state, generatedAt);
  state.events.push(future);
  state.events.push({id: 'reply-1', timestamp: '2026-11-08T18:00:00.000Z', action: 'comment', articleId: 'care', editorId: 'norab', body: 'Exceptions raised that question too.', references: ['care-1'], replyTo: 'comment-1', threadId: 'discussion-care'});
  prepareCommunityWindow(state, window(0), generatedAt);
  const packet = communityPacket(state, 'norab', window(0));
  assert.ok(packet.discussionThreads.some(thread => thread.comments.some(event => event.id === 'comment-1')));
  assert.ok(packet.publicEvidence.some(event => event.id === 'reply-1' && event.replyTo === 'comment-1'));
  assert.ok(!packet.publicEvidence.some(event => event.id === 'future'));
  assert.equal(packet.personalContext.age, 36);
  assert.ok(!JSON.stringify(packet).includes('Single and bisexual. Open to adult romance'));
  assert.deepEqual(communityPacket(state, 'norab', {...window(0), startAt: '2026-10-01T00:00:00.000Z'}), {});
});

test('a hundred opportunities produce occasional varied inputs with stable provenance', () => {
  const state = fixture();
  state.events.pop();
  setupCommunity(state, generatedAt);
  for (let index = 0; index < 100; index++) prepareCommunityWindow(state, window(index), generatedAt);
  const inputs = state.communityExperiment.inputs;
  assert.ok(inputs.length > 5 && inputs.length < 50);
  assert.ok(inputs.some(input => input.source === 'Practical Arrangements'));
  const fridge = inputs.filter(input => /fridge/.test(input.body));
  assert.ok(fridge.length < inputs.length / 3);
  assert.ok(inputs.every(input => input.origin === 'fictional-outside' && input.generatedAt === generatedAt));
  assert.ok(new Set(inputs.map(input => input.body)).size > 8);
});
