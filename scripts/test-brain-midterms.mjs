import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { selectQuestions, shuffleChoices, summarize } from '../public/brain/midterm-engine.js';

const bank = JSON.parse(await readFile(new URL('../public/brain/midterm-bank.json', import.meta.url), 'utf8'));
const seeded = () => { let state = 5341; return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646; };

for (const course of ['105', '108']) {
  test(`${course}: authored bank has valid answers, scope and unique question/card identities`, () => {
    const data = bank[course];
    assert.equal(data.questions.length, 80);
    assert.equal(data.flashcards.length, 40);
    assert.equal(new Set(data.questions.map((q) => q.id)).size, 80);
    assert.equal(new Set(data.flashcards.map((q) => q.id)).size, 40);
    for (const q of data.questions) {
      assert.ok(q.prompt && q.explanation && q.topic);
      assert.ok(['foundation', 'application', 'challenge'].includes(q.difficulty));
      if (q.kind !== 'short') {
        assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.choices.length);
        assert.equal(new Set(q.choices).size, q.choices.length);
      } else assert.ok(q.rubric?.length, `${q.id} needs a self-assessment rubric`);
    }
    if (course === '105') {
      assert.match(data.scope, /1[\u2013-]10/);
      for (const q of data.questions) assert.ok(Number(q.topic.match(/^M(\d+)/)?.[1]) <= 10);
    }
  });

  test(`${course}: filtered sessions cap honestly without duplicates, preserve answers and cover topics`, () => {
    for (const difficulty of ['foundation', 'application', 'challenge', 'mixed']) {
      const result = selectQuestions(bank[course].questions, { length: 80, difficulty }, seeded());
      const eligible = bank[course].questions.filter((q) => difficulty === 'mixed' || q.difficulty === difficulty);
      assert.equal(result.questions.length, eligible.length);
      assert.equal(result.capped, eligible.length < 80);
      assert.equal(new Set(result.questions.map((q) => q.id)).size, eligible.length);
      for (const q of result.questions) {
        const original = eligible.find((item) => item.id === q.id);
        assert.ok(original);
        if (q.choices) assert.equal(q.choices[q.correctIndex], original.choices[original.correctIndex]);
      }
    }
    const topics = new Set(bank[course].questions.map((q) => q.topic));
    const result = selectQuestions(bank[course].questions, { length: topics.size, difficulty: 'mixed' }, seeded());
    assert.equal(new Set(result.questions.map((q) => q.topic)).size, topics.size);
  });
}

test('choice randomization does not mutate the canonical bank or lose its answer', () => {
  const q = { id: 'q', choices: ['A', 'B', 'C', 'D'], correctIndex: 2 };
  const output = shuffleChoices(q, () => 0);
  assert.deepEqual(q.choices, ['A', 'B', 'C', 'D']);
  assert.equal(q.correctIndex, 2);
  assert.notDeepEqual(output.choices, q.choices);
  assert.equal(output.choices[output.correctIndex], 'C');
});

test('scores keep machine-marked answers separate from recall self-ratings and review all weak items', () => {
  const questions = [
    { id: 'a', topic: 'Methods', kind: 'mcq', correctIndex: 1 },
    { id: 'b', topic: 'Methods', kind: 'truefalse', correctIndex: 0 },
    { id: 'c', topic: 'Anatomy', kind: 'short' },
    { id: 'd', topic: 'Anatomy', kind: 'short' },
    { id: 'e', topic: 'Anatomy', kind: 'short' },
  ];
  const result = summarize(questions, { a: { revealed: true, selected: 1 }, b: { revealed: true, selected: 1 }, c: { rating: 'got' }, d: { rating: 'partly' }, e: { rating: 'needs' } });
  assert.deepEqual([result.correct, result.objective, result.got, result.partly, result.needs, result.recall], [1, 2, 1, 1, 1, 3]);
  assert.deepEqual(result.reviewIds, ['b', 'd', 'e']);
  assert.equal(result.topics.find((t) => t.topic === 'Anatomy').objective, 0);
});

test('unknown filter and empty bank return an empty session instead of looping', () => {
  assert.equal(selectQuestions([], { length: 80 }).questions.length, 0);
  assert.equal(selectQuestions(bank['105'].questions, { difficulty: 'invalid' }).questions.length, 0);
});
