import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { createRound, answerRound, nextRound } from '../public/psyc/round.js';

const helper = readFileSync('public/scripts/screen-motion.js', 'utf8');
const quiz = readFileSync('public/psyc/quiz.js', 'utf8').replace(/^import .*;\r?$/gm, '');

function practice({ reduced = false, motion = true } = {}) {
  const elements = new Map(), animations = [], events = new Map();
  let document;
  function element(id = '') {
    const item = {
      id, children: [], dataset: {}, style: {}, hidden: false, isConnected: true,
      complete: true, naturalWidth: 400, checked: false, textContent: '',
      classList: { toggle() {}, add() {} },
      setAttribute() {}, addEventListener() {}, scrollIntoView() {},
      getBoundingClientRect: () => ({ top: 20 }),
      focus() { document.activeElement = item; },
      closest: () => item.hidden ? item : null,
      append(...children) { item.children.push(...children); },
      replaceChildren(...children) { item.children = children; },
      animate(frames, options) {
        const animation = { target: id, frames, options, cancelled: false,
          finished: new Promise(() => {}), cancel() { this.cancelled = true; } };
        animations.push(animation); return animation;
      },
    };
    return item;
  }
  const get = id => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  document = {
    documentElement: { dataset: {} }, readyState: 'complete',
    getElementById: get, createElement: () => element(), createTextNode: text => ({ textContent: text }),
    querySelector: () => null,
    querySelectorAll: selector => selector === '.answer' ? get('answers').children : [],
    addEventListener() {},
  };
  const window = {
    matchMedia: () => ({ matches: reduced, addEventListener() {} }),
    addEventListener: (name, callback) => events.set(name, callback),
  };
  const questions = [1, 2].map(n => ({ id: String(n), prompt: `Question ${n}`, topic: 'anatomy',
    image: 'brain', choices: ['correct', 'wrong'], answer: 'correct', source: 'study', explanation: 'A reason.' }));
  const context = vm.createContext({ window, document, questions,
    images: { brain: { kind: 'Diagram', alt: 'Brain', file: 'brain.svg' } },
    topics: { anatomy: 'Anatomy' }, sources: { study: { url: '#source', label: 'Study source' } },
    createRound, answerRound, nextRound, setTimeout: () => 1, clearTimeout() {} });
  if (motion) vm.runInContext(helper, context);
  vm.runInContext(quiz, context);
  return { get, animations, events, document, run: code => vm.runInContext(code, context) };
}

test('question transitions call the real helper without delaying answers, focus, or results', () => {
  const p = practice();
  assert.equal(p.animations.length, 1);
  assert.equal(p.animations[0].target, 'quiz');
  assert.ok(p.get('answers').children.every(button => !button.disabled));
  p.run('answer(round.cards[round.index].answer)');
  assert.equal(p.document.activeElement.id, 'next');
  assert.equal(p.get('score').textContent, '1 correct');
  assert.equal(p.animations.length, 1, 'answer feedback must not replay the entire screen');
  p.run('advance()');
  assert.equal(p.document.activeElement.id, 'question');
  assert.equal(p.animations.length, 2);
  assert.equal(p.animations[0].cancelled, true, 'rapid navigation supersedes the old entrance');
  p.run('advance()');
  assert.equal(p.animations.length, 2, 'repeated advance cannot bypass an unanswered question');
  p.run('answer(round.cards[round.index].answer); advance()');
  assert.equal(p.get('quiz').hidden, true);
  assert.equal(p.get('summary').hidden, false);
  assert.equal(p.document.activeElement.id, 'summary-title');
  assert.equal(p.animations.at(-1).target, 'summary');
  p.events.get('pagehide')();
  assert.ok(p.animations.every(animation => animation.cancelled));
});

for (const options of [{ reduced: true }, { motion: false }]) {
  test(`practice remains synchronous with ${options.reduced ? 'reduced motion' : 'the optional helper unavailable'}`, () => {
    const p = practice(options);
    p.run('answer(round.cards[round.index].answer); advance(); answer(round.cards[round.index].answer); advance()');
    assert.equal(p.animations.length, 0);
    assert.equal(p.get('result').textContent, '2 / 2');
    assert.equal(p.document.activeElement.id, 'summary-title');
  });
}
