import test from 'node:test';
import assert from 'node:assert/strict';
import { topics, sources } from '../public/brain/curriculum.js';
import { questionFeedback } from '../public/brain/question-feedback.js';

const plain = value => typeof value === 'string' && value === value.trim() && value.length > 0;
const byId = new Map(topics.map(topic => [topic.id, topic]));

test('Every curriculum question has feedback for every original choice, in exact order', () => {
  assert.deepEqual(Object.keys(questionFeedback).sort(), topics.map(topic => topic.id).sort());
  let answers = 0;
  let corrections = 0;
  for (const topic of topics) {
    const entry = questionFeedback[topic.id];
    assert.ok(Array.isArray(entry.choices), topic.id + ': missing choice feedback');
    assert.equal(entry.choices.length, topic.question.choices.length, topic.id + ': missing or extra feedback');
    for (let index = 0; index < topic.question.choices.length; index++) {
      const item = entry.choices[index];
      assert.ok(item, topic.id + ': sparse feedback at ' + index);
      assert.equal(item.choice, topic.question.choices[index], topic.id + ': feedback attached to a different choice');
      assert.ok(plain(item.explanation), topic.id + ': no explanation at ' + index);
      if (index === topic.question.answer) {
        assert.equal(item.correction, undefined, topic.id + ': correct answer wrongly receives a correction');
        answers++;
      } else {
        assert.ok(plain(item.correction), topic.id + ': no targeted correction for wrong choice ' + index);
        assert.notEqual(item.correction, item.explanation, topic.id + ': correction merely repeats explanation');
        corrections++;
      }
    }
  }
  assert.equal(answers, 50);
  assert.equal(corrections, 100);
});

test('Feedback retains resolvable references from its own lesson', () => {
  for (const [id, entry] of Object.entries(questionFeedback)) {
    assert.ok(Array.isArray(entry.sourceIds) && entry.sourceIds.length > 0, id + ': no references');
    assert.equal(new Set(entry.sourceIds).size, entry.sourceIds.length, id + ': duplicate reference');
    for (const sourceId of entry.sourceIds) {
      assert.ok(byId.get(id).sources.includes(sourceId), id + ': reference not associated with the lesson');
      const source = sources[sourceId];
      assert.ok(source && plain(source.title) && plain(source.organization), id + ': unresolved source ' + sourceId);
      assert.equal(new URL(source.url).protocol, 'https:', id + ': invalid source URL');
    }
  }
});

test('Each explanation is specific, readable plain text with no template or grading placeholders', () => {
  const explanations = new Set();
  const corrections = new Set();
  for (const [id, entry] of Object.entries(questionFeedback)) {
    for (const [index, item] of entry.choices.entries()) {
      const label = id + '/' + index;
      for (const field of ['explanation', 'correction']) {
        if (item[field] === undefined) continue;
        const text = item[field];
        assert.ok(plain(text), label + ': invalid ' + field);
        assert.ok(text.length >= 35 && text.length <= 650, label + ': unhelpfully short or oversized ' + field);
        assert.ok(!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text), label + ': markup or control characters');
        assert.ok(!/\b(?:TODO|TBD|Lorem ipsum)\b|\[object Object\]|\{\{.*\}\}/i.test(text), label + ': unfinished copy');
        assert.ok(!/^(?:you are wrong|incorrect|try again|correct answer is)\b/i.test(text), label + ': generic grading instead of mechanism');
      }
      explanations.add(item.explanation);
      if (item.correction) corrections.add(item.correction);
    }
  }
  assert.equal(explanations.size, 150, 'Each selected choice needs its own explanation');
  assert.equal(corrections.size, 100, 'Wrong-choice corrections must distinguish the selected misconception');
});

// Focused distinctions most likely to be lost when shortening this feedback.
// These do not certify factual accuracy; edited claims still need source review.
// Select by exact choice text rather than assuming answer order.
const distinctions = [
  ['brain-overview', 'Necessarily inhibitory', [/direction/i, /effect|excit/i]],
  ['thalamus', 'Medial geniculate nucleus', [/auditory/i, /lateral.*visual/i]],
  ['dorsal-column', 'Ipsilaterally in the dorsal column', [/primary.*ipsilaterally/i, /second.order.*cross.*medulla/i]],
  ['optic-radiation', 'The right eye only', [/nasal.*cross/i, /temporal.*do not/i, /both eyes/i]],
  ['white-matter', 'A model-derived candidate trajectory', [/not an axon count/i, /does not establish signaling direction/i]],
  ['cerebellar-circuit', 'Dentate granule cell', [/hippocampal/i, /cerebellar granule.*parallel fibers/i, /inferior olive/i]],
  ['resting-potential', 'The electrochemical driving force can favor inward movement', [/more negative.*equilibrium/i, /potassium entry/i]],
  ['synaptic-integration', 'Yes, through effects such as shunting', [/conductance.*shunt/i, /depolarization/i, /threshold/i]],
  ['electrical-synapses', 'It requires a vesicle to cross the cleft', [/intact vesicle does not cross/i, /transmitter molecules cross/i]],
  ['short-term-plasticity', 'Every second spike is twice as large', [/spike size/i, /release probability/i]],
  ['glutamate', 'It always turns into GABA in the cleft', [/within GABAergic neurons/i, /does not invariably/i, /inhibitory interneuron/i]],
  ['glycine', 'All glycine receptors are NMDA receptors', [/separate anion.channel/i, /different receptor complex.*cations/i]],
  ['acetylcholine', 'Muscarinic: ion channel; nicotinic: enzyme', [/acetylcholinesterase.*enzyme/i, /nicotinic.*ion channels/i, /muscarinic.*GPCR/i]],
  ['ampa', 'Absence of all glutamate', [/gating from selectivity/i, /edited GluA2.*calcium permeability/i]],
  ['nmda', 'Magnesium binding with no ligand', [/magnesium.*obstructs/i, /negative voltages/i, /not.*activating ligand/i]],
  ['ltd', 'Yes; all LTD is irreversible', [/persistence from irreversibility/i, /later activity/i]],
  ['spike-timing', 'The timing rule varies across cells and conditions', [/experimental conditions/i, /not a universal rule/i]],
  ['structural-plasticity', 'The exact content of a stored memory', [/shape alone does not reveal/i, /morphological/i]],
  ['memory-consolidation', 'Memory depends on interacting cellular and network changes', [/synaptic consolidation/i, /systems consolidation/i]],
];

test('Feedback preserves key anatomical, mechanistic and inference distinctions', () => {
  for (const [id, choice, expected] of distinctions) {
    const item = questionFeedback[id].choices.find(item => item.choice === choice);
    assert.ok(item, id + ': missing reviewed choice ' + choice);
    const text = item.explanation + ' ' + (item.correction || '');
    for (const distinction of expected) assert.match(text, distinction, id + ': lost distinction ' + distinction);
  }
});
