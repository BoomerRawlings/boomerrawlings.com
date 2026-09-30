import { images, questions, sources, topics } from './questions.js';
import { createRound, answerRound, nextRound } from './round.js';

const $ = id => document.getElementById(id);
const buttons = [...document.querySelectorAll('[data-topic]')];
let round, timer, topic = 'all', reviewing = false, imageReady = false;
const auto = $('auto-next');

function clearTimer() { clearTimeout(timer); timer = null; }
function start(pool, review = false) {
  clearTimer();
  reviewing = review;
  round = createRound(pool, review ? pool.length : 10);
  $('summary').hidden = true;
  $('quiz').hidden = false;
  render();
}
function stats() {
  $('progress').textContent = `${reviewing ? 'Review' : 'Question'} ${Math.min(round.index + 1, round.cards.length)} / ${round.cards.length}`;
  $('score').textContent = `${round.correct} correct`;
  $('streak').textContent = `${round.streak} in a row`;
  $('progress-bar').value = round.index + Number(round.answered);
  $('progress-bar').max = round.cards.length;
}
function render() {
  clearTimer();
  imageReady = false;
  const card = round.cards[round.index], visual = images[card.image];
  $('question').textContent = card.prompt;
  $('question-category').textContent = topics[card.topic];
  $('feedback').hidden = true;
  $('next').hidden = true;
  $('photo-credit').hidden = true;
  $('image-error').hidden = true;
  $('image-loading').hidden = false;
  $('photo-wrap').hidden = false;
  $('photo-wrap').classList.toggle('dark', !!visual.dark);
  $('image-kind').textContent = `${visual.kind}${card.marker ? ' · identify the numbered point' : ''}`;
  $('answers').replaceChildren(...card.choices.map((choice, i) => {
    const button = document.createElement('button');
    button.className = 'answer';
    button.disabled = true;
    const number = document.createElement('span'); number.className = 'key'; number.textContent = String(i + 1); number.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = choice;
    button.append(number, label);
    button.addEventListener('click', () => answer(choice));
    return button;
  }));
  const marker = $('marker');
  marker.hidden = !card.marker;
  if (card.marker) { marker.style.left = `${card.marker[0]}%`; marker.style.top = `${card.marker[1]}%`; }
  const photo = $('photo');
  photo.onload = () => {
    imageReady = true;
    $('image-loading').hidden = true;
    if (!round.answered) document.querySelectorAll('.answer').forEach(button => button.disabled = false);
  };
  photo.onerror = () => {
    imageReady = false;
    $('image-loading').hidden = true;
    $('photo-wrap').hidden = true;
    $('image-error').hidden = false;
  };
  photo.alt = visual.alt + (card.marker ? ' A numbered marker indicates the structure to identify.' : '');
  photo.src = `/psyc/images/${visual.file}`;
  if (photo.complete && photo.naturalWidth) photo.onload();
  stats();
  $('question').focus({ preventScroll: true });
  if ($('question').getBoundingClientRect().top < 0) $('question').scrollIntoView({ block: 'start' });
}
function answer(choice) {
  if (!imageReady) return;
  const correct = answerRound(round, choice);
  if (correct === null) return;
  const card = round.cards[round.index];
  document.querySelectorAll('.answer').forEach((button, index) => {
    button.disabled = true;
    const value = card.choices[index];
    if (value === card.answer) { button.classList.add('correct'); button.append(document.createTextNode(' ✓')); }
    else if (value === choice) { button.classList.add('incorrect'); button.append(document.createTextNode(' ×')); }
  });
  $('feedback').className = correct ? 'feedback correct-feedback' : 'feedback incorrect-feedback';
  $('verdict').textContent = correct ? 'Correct.' : `Answer: ${card.answer}`;
  $('explanation').textContent = card.explanation;
  $('source').href = sources[card.source].url;
  $('source').textContent = sources[card.source].label;
  $('feedback').hidden = false;
  $('photo-credit').textContent = $('credit-' + card.image)?.textContent || 'Image credit below.';
  $('photo-credit').hidden = false;
  $('next').textContent = round.index === round.cards.length - 1 ? 'See results' : 'Next question';
  $('next').hidden = false;
  $('next').focus({ preventScroll: true });
  stats();
  if (correct && auto.checked) timer = setTimeout(advance, 1400);
}
function advance() {
  clearTimer();
  if (!nextRound(round)) return;
  if (round.complete) finish(); else render();
}
function finish() {
  $('quiz').hidden = true;
  $('summary').hidden = false;
  $('result').textContent = `${round.correct} / ${round.cards.length}`;
  $('result-note').textContent = round.missed.length ? `${round.missed.length} to revisit. Best streak: ${round.best}.` : `All correct. Best streak: ${round.best}.`;
  $('review').hidden = round.missed.length === 0;
  $('review').textContent = `Retry ${round.missed.length} missed`;
  $('summary-title').focus({ preventScroll: true });
}
buttons.forEach(button => button.addEventListener('click', () => {
  topic = button.dataset.topic;
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  start(questions.filter(card => topic === 'all' || card.topic === topic));
}));
$('next').addEventListener('click', advance);
$('again').addEventListener('click', () => start(questions.filter(card => topic === 'all' || card.topic === topic)));
$('review').addEventListener('click', () => start(round.missed, true));
$('restart').addEventListener('click', () => start(questions.filter(card => topic === 'all' || card.topic === topic)));
$('retry-image').addEventListener('click', render);
auto.addEventListener('change', clearTimer);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimer(); });
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !round || round.complete) return;
  if (event.target.closest('input, select, textarea, summary, a, [data-topic], #restart, #retry-image')) return;
  if (/^[1-4]$/.test(event.key) && !round.answered) {
    const choice = round.cards[round.index].choices[Number(event.key) - 1];
    if (choice) { event.preventDefault(); answer(choice); }
  } else if ([' ', 'Enter'].includes(event.key) && round.answered) {
    event.preventDefault(); advance();
  }
});
// Opening references pauses the automatic transition so feedback stays readable.
$('source').addEventListener('focus', clearTimer);
$('credits').addEventListener('toggle', () => { if ($('credits').open) clearTimer(); });
start(questions);
