import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { questions, images, sources, topics } from '../public/psyc/questions.js';
import { createRound, answerRound, nextRound } from '../public/psyc/round.js';

test('every question has one valid answer, a local image and a study source', () => {
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  for (const q of questions) {
    assert.ok(topics[q.topic]);
    assert.ok(sources[q.source]?.url.startsWith('https://'));
    assert.ok(images[q.image]?.alt);
    assert.ok(existsSync(`public/psyc/images/${images[q.image].file}`));
    assert.equal(q.choices.filter(answer => answer === q.answer).length, 1);
    assert.equal(new Set(q.choices).size, q.choices.length);
    assert.ok(q.choices.length >= 3 && q.choices.length <= 4);
    if (q.marker) assert.ok(q.marker.every(n => n > 0 && n < 100));
  }
});

test('each topic creates a nonempty round without repeated questions', () => {
  for (const topic of Object.keys(topics)) {
    const pool = questions.filter(q => topic === 'all' || q.topic === topic);
    const round = createRound(pool);
    assert.equal(round.cards.length, Math.min(10, pool.length));
    assert.equal(new Set(round.cards.map(q => q.id)).size, round.cards.length);
    assert.ok(round.cards.every(q => pool.includes(questions.find(item => item.id === q.id))));
  }
});

test('double clicks and invalid answers cannot change a score', () => {
  const round = createRound(questions);
  assert.equal(nextRound(round), false);
  assert.equal(answerRound(round, 'not an answer'), null);
  assert.equal(answerRound(round, round.cards[0].answer), true);
  assert.equal(answerRound(round, round.cards[0].answer), null);
  assert.equal(round.correct, 1);
  assert.equal(round.streak, 1);
});

test('mixed results preserve missed questions and compute the best streak', () => {
  const round = createRound(questions, 4);
  for (const correct of [true, true, false, true]) {
    const card = round.cards[round.index];
    answerRound(round, correct ? card.answer : card.choices.find(c => c !== card.answer));
    nextRound(round);
  }
  assert.equal(round.correct, 3);
  assert.equal(round.best, 2);
  assert.equal(round.streak, 1);
  assert.equal(round.missed.length, 1);
  assert.equal(round.complete, true);
  assert.equal(answerRound(round, 'anything'), null);
  assert.equal(nextRound(round), false);
  const review = createRound(round.missed, round.missed.length);
  assert.equal(review.cards.length, 1);
  assert.equal(review.cards[0].id, round.missed[0].id);
  answerRound(review, review.cards[0].answer);
  nextRound(review);
  assert.equal(review.correct, 1);
  assert.equal(review.missed.length, 0);
  assert.equal(review.complete, true);
});

test('new rounds reset scores and leave the content bank unchanged', () => {
  const original = JSON.stringify(questions);
  const first = createRound(questions);
  answerRound(first, first.cards[0].answer);
  const second = createRound(questions);
  assert.equal(second.correct, 0);
  assert.equal(second.streak, 0);
  assert.equal(JSON.stringify(questions), original);
});

test('all image licenses and authors appear in the published page', () => {
  const html = readFileSync('dist/psyc/index.html', 'utf8');
  const credits = JSON.parse(readFileSync('public/psyc/images/credits.json', 'utf8'));
  for (const image of Object.values(images)) {
    const credit = credits.find(c => c.file === image.file);
    assert.ok(credit?.author && credit?.licenseUrl && credit?.source);
    assert.ok(html.includes(credit.author));
    assert.ok(html.includes(credit.licenseUrl));
    assert.deepEqual(readFileSync(`dist/psyc/images/${image.file}`), readFileSync(`public/psyc/images/${image.file}`));
  }
  assert.ok(html.includes('noindex,nofollow,noarchive,noimageindex'));
  assert.ok(html.includes('https://boomerrawlings.com/psyc/'));
  assert.ok(!readFileSync('dist/sitemap-0.xml', 'utf8').includes('/psyc/'));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
});
