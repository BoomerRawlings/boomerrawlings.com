import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';
import { selectQuestions, shuffleChoices, summarize } from '../public/brain/midterm-engine.js';

const bank = JSON.parse(await readFile(new URL('../public/brain/midterm-bank.json', import.meta.url), 'utf8'));
const visualBank = JSON.parse(await readFile(new URL('../public/brain/visual-study-bank.json', import.meta.url), 'utf8'));
const studyBankSource = (await transform(await readFile(new URL('../src/scripts/brain/study-bank.ts', import.meta.url), 'utf8'), { loader: 'ts', target: 'es2022' })).code;
const { selectStudyBank, selectQuizQuestions, studyAvailability } = await import(`data:text/javascript;base64,${Buffer.from(studyBankSource).toString('base64')}`);
const seeded = () => { let state = 5341; return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646; };
const catalogSource = (await transform(await readFile(new URL('../src/scripts/brain/course-catalog.ts', import.meta.url), 'utf8'), { loader: 'ts', target: 'es2022' })).code;
const { COURSE_CATALOG, courseScopeNote, resolveStudyScope } = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const recoverySource = (await transform(await readFile(new URL('../src/scripts/brain/portal-load-recovery.ts', import.meta.url), 'utf8'), { loader: 'ts', target: 'es2022' })).code;
const { claimStudyToolsReload } = await import(`data:text/javascript;base64,${Buffer.from(recoverySource).toString('base64')}`);

test('stale study chunks recover once and cannot create an automatic reload loop', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(claimStudyToolsReload(new TypeError('Failed to fetch dynamically imported module: /_astro/app.old.js'), () => storage, 100_000), true);
  assert.equal(claimStudyToolsReload(new TypeError('Importing a module script failed.'), () => storage, 100_100), false);
  assert.equal(claimStudyToolsReload(new Error('Unable to preload CSS for /_astro/app.old.css'), () => storage, 161_000), true);
  assert.equal(claimStudyToolsReload(new Error('Load failed'), () => storage, 160_000), false);
});

test('study recovery does not refresh on application bugs or without a safe reload guard', () => {
  const unexpectedStorage = () => { throw new Error('Storage should not be accessed'); };
  assert.equal(claimStudyToolsReload(new TypeError("Cannot read properties of null (reading 'addEventListener')"), unexpectedStorage), false);
  assert.equal(claimStudyToolsReload({ message: 'Load failed' }, unexpectedStorage), false);
  assert.equal(claimStudyToolsReload(new Error('Failed to load module script'), unexpectedStorage), false);
  assert.equal(claimStudyToolsReload('Load failed', () => ({ getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } })), false);
});

test('both syllabus frameworks expose only available study scopes and retain their distinct exam dates', () => {
  for (const course of ['105', '108']) {
    assert.deepEqual(COURSE_CATALOG[course].assessments.map(item => item.id), ['midterm-1', 'midterm-2', 'final']);
    assert.deepEqual(COURSE_CATALOG[course].assessments.filter(item => item.available).map(item => item.id), ['midterm-1']);
    assert.equal(COURSE_CATALOG[course].assessments[0].date, '2026-10-19');
    assert.equal(COURSE_CATALOG[course].assessments[2].coverage, 'Cumulative');
    assert.match(courseScopeNote(course, 'general'), /currently covers Midterm 1/);
  }
  assert.equal(COURSE_CATALOG['105'].assessments[1].date, '2026-11-16');
  assert.equal(COURSE_CATALOG['108'].assessments[1].date, '2026-11-20');
  assert.match(COURSE_CATALOG['105'].assessments[2].dateLabel, /3–6 p.m./);
  assert.match(COURSE_CATALOG['108'].assessments[2].dateLabel, /8–10 a.m./);
});

test('study routing blocks locked deep links, preserves old sessions and separates the course chooser', () => {
  assert.deepEqual(resolveStudyScope(null, null), { scope: null, blocked: false });
  for (const step of ['setup', 'quiz', 'cards']) {
    assert.deepEqual(resolveStudyScope(null, step), { scope: 'midterm-1', blocked: false });
    for (const scope of ['general', 'midterm-1']) assert.deepEqual(resolveStudyScope(scope, step), { scope, blocked: false });
    for (const locked of ['midterm-2', 'final', 'midterm-3', '']) assert.deepEqual(resolveStudyScope(locked, step), { scope: null, blocked: true });
  }
});

for (const course of ['105', '108']) {
  test(`${course}: quiz formats default to objective choices and add written recall only when enabled`, () => {
    const data = selectStudyBank(bank[course], visualBank[course], 'all');
    const before = JSON.stringify(data);
    const expectedObjective = data.questions.filter(question => question.kind !== 'short');
    for (const questions of [selectQuizQuestions(data.questions), selectQuizQuestions(data.questions, false)]) {
      assert.deepEqual(questions.map(question => question.id), expectedObjective.map(question => question.id));
      assert.ok(questions.every(question => question.kind === 'mcq' || question.kind === 'truefalse'));
      for (const visual of visualBank[course].questions) assert.ok(questions.some(question => question.id === visual.id), `${visual.id}: visual basics must remain in default review`);
      for (const question of data.questions.filter(question => question.kind === 'truefalse')) {
        assert.ok(questions.some(candidate => candidate.id === question.id), `${question.id}: two-choice true/false remains available`);
      }
    }
    const withRecall = selectQuizQuestions(data.questions, true);
    assert.deepEqual(withRecall.map(question => question.id), data.questions.map(question => question.id));
    assert.ok(withRecall.some(question => question.kind === 'short'));
    assert.equal(JSON.stringify(data), before, 'format selection must not alter question content or ordering');
  });

  test(`${course}: format-aware availability matches generated counts and caps across all difficulties`, () => {
    const data = selectStudyBank(bank[course], visualBank[course], 'all');
    const before = JSON.stringify(data);
    const expectedCounts = course === '105'
      ? { mixed: 157, foundation: 77, application: 54, challenge: 26 }
      : { mixed: 147, foundation: 75, application: 46, challenge: 26 };
    assert.deepEqual(studyAvailability({ ...data, questions: selectQuizQuestions(data.questions) }), expectedCounts);
    for (const includeShortAnswer of [false, true]) {
      const questions = selectQuizQuestions(data.questions, includeShortAnswer);
      const counts = studyAvailability({ ...data, questions });
      for (const difficulty of ['mixed', 'foundation', 'application', 'challenge']) {
        const eligible = data.questions.filter(question => (includeShortAnswer || question.kind !== 'short') && (difficulty === 'mixed' || question.difficulty === difficulty));
        assert.equal(counts[difficulty], eligible.length);
        for (const length of [10, 25, 40, 'all']) {
          const result = selectQuestions(questions, { length, difficulty }, seeded());
          const requested = length === 'all' ? eligible.length : length;
          assert.equal(result.available, counts[difficulty]);
          assert.equal(result.requested, requested);
          assert.equal(result.questions.length, Math.min(requested, eligible.length));
          assert.equal(result.capped, requested > eligible.length);
          assert.equal(new Set(result.questions.map(question => question.id)).size, result.questions.length);
          assert.ok(result.questions.every(question => eligible.some(candidate => candidate.id === question.id)));
        }
      }
    }
    assert.equal(selectQuestions(selectQuizQuestions(data.questions), { length: 'all', difficulty: 'challenge' }, seeded()).questions.length, 26);
    assert.equal(selectQuestions(selectQuizQuestions(data.questions, true), { length: 'all', difficulty: 'challenge' }, seeded()).questions.length, 46);
    assert.equal(JSON.stringify(data), before, 'generation must not mutate the authored question pool');
  });

  test(`${course}: visual-only quizzes keep all 26 multiple-choice questions with either format setting`, () => {
    const data = selectStudyBank(bank[course], visualBank[course], 'visual');
    for (const includeShortAnswer of [false, true]) {
      const questions = selectQuizQuestions(data.questions, includeShortAnswer);
      const result = selectQuestions(questions, { length: 'all', difficulty: 'foundation' }, seeded());
      assert.equal(result.questions.length, 26);
      assert.deepEqual(new Set(result.questions.map(question => question.id)), new Set(visualBank[course].questions.map(question => question.id)));
      assert.ok(result.questions.every(question => question.kind === 'mcq' && question.visual));
    }
  });

  test(`${course}: authored bank has valid answers, scope and unique question/card identities`, () => {
    const data = bank[course];
    assert.equal(data.questions.length, 186);
    assert.equal(data.flashcards.length, 40);
    assert.equal(new Set(data.questions.map((q) => q.id)).size, 186);
    assert.equal(new Set(data.flashcards.map((q) => q.id)).size, 40);
    for (const q of data.questions) {
      assert.ok(q.prompt && q.explanation && q.topic);
      assert.ok(['foundation', 'application', 'challenge'].includes(q.difficulty));
      if (q.kind !== 'short') {
        assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.choices.length);
        assert.equal(new Set(q.choices).size, q.choices.length);
        assert.equal(q.choiceExplanations?.length, q.choices.length, `${q.id} must explain every option`);
        assert.equal(new Set(q.choiceExplanations).size, q.choices.length, `${q.id} needs distinct option explanations`);
        for (const explanation of q.choiceExplanations) assert.ok(typeof explanation === 'string' && explanation.trim().length >= 60, `${q.id} has missing or superficial option feedback`);
      } else {
        assert.ok(q.rubric?.length, `${q.id} needs a self-assessment rubric`);
        assert.ok(q.commonMistakes?.length, `${q.id} needs corrective feedback for written recall`);
        for (const mistake of q.commonMistakes) assert.ok(typeof mistake === 'string' && mistake.trim().length >= 60, `${q.id} needs a concrete misconception and correction`);
      }
    }
    if (course === '105') {
      assert.match(data.scope, /1[\u2013-]10/);
      for (const q of data.questions) assert.ok(Number(q.topic.match(/^M(\d+)/)?.[1]) <= 10);
    }
  });

  test(`${course}: expansion adds 106 distinct, grounded multiple-choice questions with complete option feedback`, () => {
    const expectedIds = new Set(Array.from({ length: 106 }, (_, index) => `${course}-q${String(index + 81).padStart(3, '0')}`));
    const additions = bank[course].questions.filter(question => expectedIds.has(question.id));
    assert.equal(additions.length, 106);
    assert.deepEqual(new Set(additions.map(question => question.id)), expectedIds);
    const normalize = text => text.trim().toLowerCase().replace(/\s+/g, ' ');
    const allPrompts = [...bank[course].questions, ...visualBank[course].questions].map(question => normalize(question.prompt));
    assert.deepEqual(Object.fromEntries(['foundation', 'application', 'challenge'].map(difficulty => [difficulty, additions.filter(question => question.difficulty === difficulty).length])), { foundation: 40, application: 40, challenge: 26 });
    for (const question of additions) {
      assert.equal(allPrompts.filter(prompt => prompt === normalize(question.prompt)).length, 1, `${question.id}: new questions must not repeat another prompt`);
      assert.equal(question.kind, 'mcq', `${question.id}: newly authored questions must be multiple choice`);
      assert.equal(question.choices?.length, 4, `${question.id}: requires four answer options`);
      assert.ok(question.choices.every(choice => typeof choice === 'string' && choice.trim()), `${question.id}: answer options cannot be blank`);
      assert.equal(new Set(question.choices.map(normalize)).size, 4, `${question.id}: answer options must differ`);
      assert.ok(Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4, `${question.id}: invalid correct option`);
      assert.equal(question.choiceExplanations?.length, 4, `${question.id}: must explain every answer option`);
      assert.ok(question.choiceExplanations.every(explanation => typeof explanation === 'string' && explanation.trim().length >= 60), `${question.id}: every option needs substantive feedback`);
      assert.equal(new Set(question.choiceExplanations.map(normalize)).size, 4, `${question.id}: explanations must distinguish the options`);
      assert.ok(['direct', 'supporting'].includes(question.grounding), `${question.id}: missing source scope`);
      assert.ok(typeof question.sourceNote === 'string' && question.sourceNote.trim().length > 30, `${question.id}: missing source explanation`);
      if (course === '105') {
        const module = Number(question.topic.match(/^M(\d+)\b/)?.[1]);
        assert.ok(module >= 1 && module <= 10, `${question.id}: outside the covered Modules 1-10`);
      }
    }
  });

  test(`${course}: filtered sessions cap honestly without duplicates, preserve answers and cover topics`, () => {
    for (const difficulty of ['foundation', 'application', 'challenge', 'mixed']) {
      const result = selectQuestions(bank[course].questions, { length: 80, difficulty }, seeded());
      const eligible = bank[course].questions.filter((q) => difficulty === 'mixed' || q.difficulty === difficulty);
      assert.equal(result.questions.length, Math.min(80, eligible.length));
      assert.equal(result.capped, eligible.length < 80);
      assert.equal(new Set(result.questions.map((q) => q.id)).size, result.questions.length);
      for (const q of result.questions) {
        const original = eligible.find((item) => item.id === q.id);
        assert.ok(original);
        if (q.choices) {
          assert.equal(q.choices[q.correctIndex], original.choices[original.correctIndex]);
          q.choices.forEach((choice, index) => assert.equal(q.choiceExplanations[index], original.choiceExplanations[original.choices.indexOf(choice)], `${q.id}: explanation drifted from its option`));
        }
      }
    }
    const topics = new Set(bank[course].questions.map((q) => q.topic));
    const result = selectQuestions(bank[course].questions, { length: topics.size, difficulty: 'mixed' }, seeded());
    assert.equal(new Set(result.questions.map((q) => q.topic)).size, topics.size);
  });
}

test('choice randomization does not mutate the canonical bank or lose its answer', () => {
  const q = { id: 'q', choices: ['A', 'B', 'C', 'D'], choiceExplanations: ['Why A', 'Why B', 'Why C', 'Why D'], correctIndex: 2 };
  const output = shuffleChoices(q, () => 0);
  assert.deepEqual(q.choices, ['A', 'B', 'C', 'D']);
  assert.equal(q.correctIndex, 2);
  assert.notDeepEqual(output.choices, q.choices);
  assert.equal(output.choices[output.correctIndex], 'C');
  assert.deepEqual(q.choiceExplanations, ['Why A', 'Why B', 'Why C', 'Why D']);
  output.choices.forEach((choice, i) => assert.equal(output.choiceExplanations[i], `Why ${choice}`));
  const retry = shuffleChoices(output, seeded());
  retry.choices.forEach((choice, i) => assert.equal(retry.choiceExplanations[i], `Why ${choice}`));
});

test('every objective item retains all option reasoning through repeated shuffles and retries', () => {
  for (const data of Object.values(bank)) for (const q of data.questions.filter(q => q.kind !== 'short')) {
    let shuffled = q;
    const random = seeded();
    for (let pass = 0; pass < 20; pass++) {
      shuffled = shuffleChoices(shuffled, random);
      assert.equal(shuffled.choices[shuffled.correctIndex], q.choices[q.correctIndex]);
      shuffled.choices.forEach((choice, i) => assert.equal(shuffled.choiceExplanations[i], q.choiceExplanations[q.choices.indexOf(choice)], `${q.id}, pass ${pass}`));
    }
  }
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

test('a written-only difficulty remains empty until Short Answer is enabled', () => {
  const questions = [
    { id: 'choice', kind: 'mcq', topic: 'Example', difficulty: 'foundation', choices: ['A', 'B'], correctIndex: 0 },
    { id: 'written', kind: 'short', topic: 'Example', difficulty: 'challenge' },
  ];
  const choicesOnly = selectQuizQuestions(questions);
  assert.equal(studyAvailability({ questions: choicesOnly }).challenge, 0);
  assert.equal(selectQuestions(choicesOnly, { length: 10, difficulty: 'challenge' }, seeded()).questions.length, 0);
  const withRecall = selectQuizQuestions(questions, true);
  assert.equal(studyAvailability({ questions: withRecall }).challenge, 1);
  assert.deepEqual(selectQuestions(withRecall, { length: 10, difficulty: 'challenge' }, seeded()).questions.map(question => question.id), ['written']);
});
