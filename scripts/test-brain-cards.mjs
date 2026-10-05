import assert from 'node:assert/strict';
import test from 'node:test';
import { flashcards } from '../public/brain/cards.js';
import { categories, sources, topics } from '../public/brain/curriculum.js';

// These checks protect coverage, readable card copy and traceable lesson references.
// They do not establish scientific truth: prompts and answers also require review
// against the corresponding lessons, including their qualifications and sources.
const topicById = new Map(topics.map(topic => [topic.id, topic]));
const cardById = new Map(flashcards.map(card => [card.id, card]));
const categoryIds = new Set(categories.map(category => category.id));
const visuals = new Set(['brain', 'tract', 'circuit', 'neuron', 'synapse', 'molecule', 'channel', 'plasticity']);
const requirements = [
  { suffix: 'recall', level: 'essentials', kind: 'recall' },
  { suffix: 'mechanism', level: 'mechanism', kind: 'explain' },
  { suffix: 'apply', level: 'advanced', kind: 'apply' },
];
const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });
const plain = value => typeof value === 'string' && value.trim() === value && value.length > 0;

test('The advertised deck covers every topic at all three retrieval depths', () => {
  assert.equal(topics.length, 50);
  assert.equal(flashcards.length, 150);
  assert.equal(cardById.size, flashcards.length, 'Card IDs must be unique for saved review records');
  assert.equal(new Set(flashcards.map(card => card.prompt.toLocaleLowerCase('en'))).size, flashcards.length, 'Repeated prompts do not constitute distinct practice');
  for (const topic of topics) {
    const cards = flashcards.filter(card => card.topicId === topic.id);
    assert.equal(cards.length, 3, `${topic.id}: missing or duplicate depth`);
    for (const { suffix, level, kind } of requirements) {
      const card = cardById.get(`${topic.id}-${suffix}`);
      assert.ok(card, `${topic.id}: missing ${suffix} card`);
      assert.equal(card.topicId, topic.id);
      assert.equal(card.level, level, `${card.id}: wrong lesson depth`);
      assert.equal(card.kind, kind, `${card.id}: wrong retrieval task`);
    }
  }
});

test('Every card resolves to an available lesson, subject deck and visual family', () => {
  for (const card of flashcards) {
    const topic = topicById.get(card.topicId);
    assert.ok(topic, `${card.id}: missing topic`);
    assert.ok(categoryIds.has(topic.category), `${card.id}: unavailable subject deck`);
    assert.ok(plain(topic.title), `${card.id}: missing lesson title`);
    const lesson = topic[card.level];
    assert.ok(lesson && plain(lesson.summary) && lesson.bullets.length > 0, `${card.id}: missing explanation at selected depth`);
    assert.ok(visuals.has(card.visual), `${card.id}: unknown concept-sketch family`);
    assert.equal(card.visual, topic.scene === 'tracts' ? 'tract' : topic.scene, `${card.id}: illustration unrelated to topic scene`);
    if (card.focus !== undefined) assert.ok(plain(card.focus), `${card.id}: empty illustration focus`);
  }
});

test('All card lessons retain complete, resolvable reference sets', () => {
  const referenced = new Set();
  for (const card of flashcards) {
    const topic = topicById.get(card.topicId);
    assert.ok(Array.isArray(topic.sources) && topic.sources.length > 0, `${card.id}: no lesson references`);
    for (const sourceId of topic.sources) {
      const source = sources[sourceId];
      assert.ok(source, `${card.id}: unresolved reference ${sourceId}`);
      assert.ok(plain(source.title) && plain(source.organization), `${sourceId}: missing citation attribution`);
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:', `${sourceId}: unsafe or non-web reference`);
      assert.ok(url.hostname.includes('.'), `${sourceId}: incomplete reference host`);
      referenced.add(sourceId);
    }
  }
  assert.ok(referenced.size >= topics.length, 'The full deck should retain its topic-specific reference coverage');
});

test('Every face contains concise plain-language content, with no placeholders', () => {
  for (const card of flashcards) {
    for (const field of ['prompt', 'answer', 'detail']) {
      const copy = card[field];
      assert.ok(plain(copy), `${card.id}: missing or untrimmed ${field}`);
      assert.ok(!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(copy), `${card.id}: markup or control characters in ${field}`);
      assert.ok(!/\b(?:TODO|TBD|Lorem ipsum)\b|\[object Object\]|\{\{.*\}\}/i.test(copy), `${card.id}: placeholder in ${field}`);
      assert.ok(copy.length <= 350, `${card.id}: ${field} exceeds a brief card face`);
    }
    assert.notEqual(card.prompt, card.answer, `${card.id}: prompt gives only its own answer`);
    for (const field of ['answer', 'detail']) {
      const count = [...sentences.segment(card[field])].filter(item => item.segment.trim()).length;
      assert.ok(count >= 1 && count <= 2, `${card.id}: ${field} must contain one or two sentences (found ${count})`);
    }
  }
});

test('Recall cards retain the explanation of their existing sourced question', () => {
  for (const card of flashcards.filter(card => card.kind === 'recall')) {
    const { question } = topicById.get(card.topicId);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length, `${card.id}: invalid source-question answer`);
    assert.ok(plain(question.choices[question.answer]) && plain(question.explanation), `${card.id}: incomplete source question`);
    assert.equal(card.detail, question.explanation, `${card.id}: recall explanation drifted from the reviewed curriculum`);
  }
});

// Deliberately selected safeguards for distinctions that are easy to lose when
// shortening neuroscience explanations. These are concept checks, not snapshots
// of every sentence or a substitute for reviewing changed scientific claims.
const distinctions = [
  ['white-matter-apply', [/not an axon count/i, /does not establish signaling direction/i]],
  ['corticospinal-apply', [/above.*opposite body side/i, /below.*side of its spinal targets/i, /does not describe every/i]],
  ['dorsal-column-apply', [/primary afferents ascend ipsilaterally/i, /second-order axons cross in the medulla/i]],
  ['optic-radiation-apply', [/inferior.retinal/i, /superior contralateral visual field/i]],
  ['hippocampus-apply', [/CA3 recurrent/i, /models, not exclusive functions/i]],
  ['astrocytes-apply', [/endothelial tight junctions/i, /astrocytes support and regulate/i]],
  ['synaptic-integration-apply', [/shunt/i, /despite depolarization/i]],
  ['transmitter-clearance-apply', [/membrane recovery and transmitter.*distinct/i, /endocytosis recovers membrane/i]],
  ['serotonin-apply', [/5-HT3 is an ion channel/i, /5-HT1.*Gi\/o/i, /5-HT2.*Gq\/11/i]],
  ['glycine-apply', [/different molecular target/i, /glutamate at GluN2/i, /separate pentameric anion channels/i]],
  ['ampa-recall', [/edited GluA2.*limits calcium permeability/i]],
  ['nmda-recall', [/glutamate, a coagonist/i, /magnesium block/i]],
  ['nmda-apply', [/magnesium.*negative voltages/i, /different mechanism from.*sodium channel/i]],
  ['gabaa-apply', [/alpha.gamma.*allosteric/i, /GABA binds at beta.alpha interfaces/i]],
  ['ltp-apply', [/NMDA-independent/i, /presynaptically/i]],
  ['spike-timing-apply', [/specified conditions/i, /different rules/i]],
  ['memory-consolidation-apply', [/first addresses synaptic consolidation/i, /second addresses systems consolidation/i]],
];

test('Condensed answers retain key anatomical and molecular qualifications', () => {
  for (const [id, concepts] of distinctions) {
    const card = cardById.get(id);
    assert.ok(card, `Missing scientific distinction card: ${id}`);
    const text = `${card.answer} ${card.detail}`;
    for (const concept of concepts) assert.match(text, concept, `${id}: lost distinction ${concept}`);
  }
});
