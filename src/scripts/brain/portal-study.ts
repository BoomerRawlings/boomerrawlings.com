import { courseScopeNote, scopeLabel, type Course, type StudyScope } from './course-catalog';
import { selectStudyBank, studyAvailability, flashcardProgressKey, mergeFlashcardQueue, type CourseBank, type Question, type Difficulty, type StudyFocus, type StudyLength } from './study-bank';
import { mountStudyVisual, mountDirectionCompanion } from './study-visuals';
import '../../styles/brain-study-visuals.css';
type Answer = { selected?: number; written?: string; revealed?: boolean; rating?: 'needs' | 'partly' | 'got' };
type Totals = { objective: number; correct: number; recall: number; got: number; partly: number; needs: number; unanswered: number };
type Summary = Totals & { topics: (Totals & { topic: string })[]; reviewIds: string[] };
type Engine = {
  shuffle: <T>(items: T[]) => T[];
  shuffleChoices: (question: Question) => Question;
  selectQuestions: (questions: Question[], options: { length: StudyLength; difficulty: Difficulty }) => { questions: Question[]; requested: number; available: number; capped: boolean };
  summarize: (questions: Question[], answers: Record<string, Answer>) => Summary;
};
export type StudyOptions = {
  course: Course; scope: StudyScope; mode: 'quiz' | 'flashcards'; length: StudyLength;
  difficulty: Difficulty; focus: StudyFocus; container: HTMLElement; onBack: () => void; onFocusChange: (focus: StudyFocus) => void;
};

let bankPromise: Promise<{ standard: Record<Course, CourseBank>; visual: Record<Course, CourseBank> }> | undefined;
const activeViews = new WeakMap<HTMLElement, symbol>();

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
function button(text: string, className: string, action: () => void): HTMLButtonElement {
  const element = node('button', className, text);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}
function readSaved<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
function save(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Study works when storage is unavailable. */ }
}
function focusElement(element: HTMLElement, scroll = false): void {
  requestAnimationFrame(() => {
    if (!element.isConnected) return;
    element.focus({ preventScroll: true });
    if (scroll) element.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  });
}
function focusHeading(panel: HTMLElement, scroll = false): void {
  const heading = panel.querySelector<HTMLElement>('h2');
  if (heading) { heading.tabIndex = -1; focusElement(heading, scroll); }
}
function progress(current: number, max: number, label: string): HTMLElement {
  const wrapper = node('div', 'portal-progress');
  const bar = node('progress');
  bar.max = Math.max(1, max); bar.value = current; bar.setAttribute('aria-label', label);
  wrapper.append(node('span', '', label), bar);
  return wrapper;
}
function sourceNote(course: Course, scope: StudyScope, focus: StudyFocus = 'all'): HTMLElement {
  if (focus === 'visual') return node('p', 'portal-subtitle portal-source-note', 'Wireframe basics: guide-listed regions and directions plus supporting spatial vocabulary. Each item identifies its scope. Supporting items are extra foundations, not a claim that they appear on your exam.');
  const source = course === '105'
    ? 'Scope: 105 Study Guide, Modules 1–10, and Exam 1 Review. Original practice questions based on these materials.'
    : 'Scope: PSYC 108 Midterm 1 Study Guide and review materials. Original practice questions based on these materials.';
  return node('p', 'portal-subtitle portal-source-note', `${scope === 'general' ? `${courseScopeNote(course, scope)} ` : ''}${source} Visual basics are mixed in, including clearly marked supporting spatial vocabulary.`);
}

async function loadBank(): Promise<{ standard: Record<Course, CourseBank>; visual: Record<Course, CourseBank> }> {
  if (!bankPromise) bankPromise = Promise.all(['/brain/midterm-bank.json?v=5', '/brain/visual-study-bank.json?v=1'].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Study material could not be loaded.');
    const bank = await response.json();
    for (const course of ['105', '108']) {
      if (!bank[course]?.questions?.length || !bank[course]?.flashcards?.length) throw new Error('Study material is unavailable.');
      for (const q of bank[course].questions) {
        const explanations = q.kind === 'short' ? q.commonMistakes : q.choiceExplanations;
        if (!Array.isArray(explanations) || !explanations.length || explanations.some((text: unknown) => typeof text !== 'string' || !text.trim()) || (q.choices && explanations.length !== q.choices.length)) throw new Error('Complete answer explanations are unavailable.');
      }
    }
    return bank as Record<Course, CourseBank>;
  })).then(([standard, visual]) => ({ standard, visual })).catch((error) => { bankPromise = undefined; throw error; });
  return bankPromise;
}

export async function getStudyAvailability(course: Course, focus: StudyFocus): Promise<Record<Difficulty, number>> {
  const banks = await loadBank();
  return studyAvailability(selectStudyBank(banks.standard[course], banks.visual[course], focus));
}

export async function showStudy(options: StudyOptions): Promise<void> {
  const { container, course } = options;
  const token = Symbol('study');
  activeViews.set(container, token);
  const host = node('div', 'portal-study-view');
  const current = () => activeViews.get(container) === token && host.isConnected;
  const back = () => { activeViews.delete(container); options.onBack(); };
  const loading = node('div', 'portal-panel');
  loading.setAttribute('role', 'status');
  loading.append(node('p', 'portal-subtitle', 'Gathering your study material…'));
  host.append(loading);
  container.replaceChildren(host);
  try {
    const engineUrl = '/brain/midterm-engine.js?v=3';
    const [banks, engine] = await Promise.all([loadBank(), import(/* @vite-ignore */ engineUrl) as Promise<Engine>]);
    if (!current()) return;
    // The current course bank contains Midterm 1 only. General grows with future authored banks;
    // exam-specific sessions remain limited to the selected assessment's material.
    const data = { ...selectStudyBank(banks.standard[course], banks.visual[course], options.focus), title: `PSYC ${course} · ${scopeLabel(options.scope)}` };
    if (options.mode === 'flashcards') showFlashcards(data, engine, { ...options, container: host, onBack: back }, current);
    else showQuiz(data, engine, { ...options, container: host, onBack: back }, current);
  } catch (error) {
    console.error('Unable to open study material.', error);
    if (!current()) return;
    const panel = node('section', 'portal-panel');
    panel.append(node('h2', 'portal-title', 'Let’s reconnect.'), node('p', 'portal-subtitle', 'The study material did not load. Your browser may be offline. Try again when you are connected.'));
    const actions = node('div', 'portal-actions');
    actions.append(button('Try again', 'portal-generate', () => { void showStudy(options); }), button('Study options', 'portal-pill', back));
    panel.append(actions); host.replaceChildren(panel); focusHeading(panel);
  }
}

function showQuiz(data: CourseBank, engine: Engine, options: StudyOptions, current: () => boolean): void {
  const selection = engine.selectQuestions(data.questions, options);
  let questions = selection.questions;
  let answers: Record<string, Answer> = {};
  let index = 0;
  let reviewing = false;
  let resultsSaved = false;
  let retryRound = false;
  let disposeVisual: (() => void) | undefined;
  const { container, course, onBack } = options;
  const complete = (question: Question) => question.kind === 'short' ? Boolean(answers[question.id]?.rating) : Boolean(answers[question.id]?.revealed);

  function render(focus: 'question' | 'feedback' = 'question'): void {
    if (!current()) return;
    disposeVisual?.(); disposeVisual = undefined;
    if (!questions.length) { renderEmpty(); return; }
    const q = questions[index];
    const answer = answers[q.id] ||= {};
    const panel = node('section', 'portal-panel portal-quiz');
    panel.append(button('← Study options', 'portal-pill portal-study-back', onBack));
    const status = node('div', 'portal-study-status');
    status.append(node('p', 'portal-eyebrow', `${data.title} · ${reviewing ? 'Review answers' : retryRound ? 'Practice again' : 'Practice quiz'}`));
    const finished = questions.filter(complete).length;
    status.append(progress(finished, questions.length, `Question ${index + 1} of ${questions.length} · ${finished} answered`));
    if (selection.capped && !retryRound) status.append(node('p', 'portal-subtitle', `${selection.available} questions available at this difficulty; this session contains all ${selection.available}.`));
    panel.append(status);
    const metadata = node('div', 'portal-actions');
    metadata.append(node('span', 'portal-topic-chip', q.topic), node('span', 'portal-topic-chip', q.difficulty), node('span', 'portal-topic-chip', q.kind === 'short' ? 'Written recall · self-rated' : 'Auto-checked'));
    panel.append(metadata, node('h2', 'portal-question-title', q.prompt));
    if (q.visual) {
      metadata.append(node('span', 'portal-topic-chip', q.grounding === 'supporting' ? 'Supporting visual vocabulary' : 'From your study guide'));
      const visual = node('div', 'portal-visual-slot'); panel.append(visual);
      disposeVisual = mountStudyVisual(visual, q.visual, { revealed: Boolean(answer.revealed) });
      if (q.sourceNote && answer.revealed) panel.append(node('p', 'portal-subtitle portal-item-source', q.sourceNote));
    }

    if (q.kind === 'short') {
      const label = node('label', 'portal-subtitle', 'Recall it in your own words, then compare with the rubric.');
      const input = node('textarea', 'portal-recall');
      input.id = `recall-${q.id}`; label.htmlFor = input.id;
      input.rows = 5; input.placeholder = 'What do you remember?'; input.value = answer.written || '';
      input.readOnly = Boolean(answer.revealed);
      input.addEventListener('input', () => { answer.written = input.value; });
      panel.append(label, input);
      if (!answer.revealed) panel.append(button('Reveal answer & rubric', 'portal-generate', () => { answer.revealed = true; render('feedback'); }));
    } else {
      const choices = node('div', 'portal-answers');
      choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Answer choices');
      let check: HTMLButtonElement | undefined;
      q.choices!.forEach((choice, choiceIndex) => {
        const choose = () => {
          if (answer.revealed) return;
          answer.selected = choiceIndex;
          for (const other of choices.querySelectorAll<HTMLButtonElement>('button')) other.setAttribute('aria-pressed', String(other === option));
          if (check) check.disabled = false;
        };
        const option = answer.revealed ? node('div', 'portal-answer portal-answer-explained') : button('', 'portal-answer', choose);
        const content = node('div', 'portal-choice-content');
        const title = node('span', 'portal-choice-title', choice);
        title.id = `choice-${q.id}-${choiceIndex}`;
        content.append(title);
        option.append(node('span', 'portal-answer-letter', String.fromCharCode(65 + choiceIndex)), content);
        if (answer.revealed) {
          const correct = choiceIndex === q.correctIndex;
          option.dataset.state = correct ? 'correct' : 'incorrect';
          option.dataset.selected = String(choiceIndex === answer.selected);
          option.setAttribute('role', 'group'); option.setAttribute('aria-labelledby', title.id);
          const badges = node('div', 'portal-choice-badges');
          badges.append(node('span', 'portal-choice-badge', correct ? '✓ Correct option' : '✕ Incorrect option'));
          if (choiceIndex === answer.selected) badges.append(node('span', 'portal-choice-badge portal-your-choice', 'Your answer'));
          content.prepend(badges);
          content.append(node('p', 'portal-choice-explanation', q.choiceExplanations![choiceIndex]));
        } else option.setAttribute('aria-pressed', String(answer.selected === choiceIndex));
        choices.append(option);
      });
      panel.append(choices);
      if (!answer.revealed) {
        check = button('Check answer', 'portal-generate', () => { if (answer.selected !== undefined) { answer.revealed = true; render('feedback'); } });
        check.disabled = answer.selected === undefined; panel.append(check);
      }
    }

    if (answer.revealed) {
      const isRecall = q.kind === 'short';
      const correct = answer.selected === q.correctIndex;
      const feedback = node('section', 'portal-feedback');
      feedback.dataset.state = isRecall ? (answer.rating || 'self-check') : correct ? 'correct' : 'incorrect';
      const ratingLabels = {needs:'↻ Self-rated: Needs review', partly:'◐ Self-rated: Partly recalled', got:'✓ Self-rated: Recalled well'};
      const feedbackHeading = node('h3', 'portal-feedback-heading', isRecall ? (answer.rating ? ratingLabels[answer.rating] : 'Written answer — self-check') : correct ? '✓ Correct' : '✕ Incorrect');
      feedbackHeading.tabIndex = -1;
      feedback.append(feedbackHeading);
      if (!isRecall) {
        const selectedLetter = String.fromCharCode(65 + answer.selected!);
        const correctLetter = String.fromCharCode(65 + q.correctIndex!);
        const summary = node('p', 'portal-feedback-summary', `Your answer: ${selectedLetter}. ${q.choices![answer.selected!]}`);
        summary.id = `feedback-summary-${q.id}`;
        feedbackHeading.setAttribute('aria-describedby', summary.id);
        feedback.append(summary);
        if (!correct) feedback.append(node('p', 'portal-correct-answer', `Correct answer: ${correctLetter}. ${q.choices![q.correctIndex!]}`));
        feedback.append(node('h4', 'portal-reason-label', 'Why this is the correct answer'), node('p', '', q.explanation), node('p', 'portal-feedback-guide', 'Every option is explained below.'));
      } else {
        feedback.append(node('p', 'portal-feedback-guide', 'Written responses are not automatically graded. Compare your reasoning with the model answer, then rate your recall.'), node('h4', 'portal-reason-label', 'Model answer and key reasoning'));
        const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();
        if (q.rubric?.length && normalized(q.rubric.join(' ')) === normalized(q.explanation)) {
          const rubric = node('ol', 'portal-rubric'); q.rubric.forEach((point) => rubric.append(node('li', '', point))); feedback.append(rubric);
        } else {
          feedback.append(node('p', '', q.explanation));
          if (q.rubric?.length) {
            feedback.append(node('h4', 'portal-reason-label', 'Self-check: key points to include'));
            const rubric = node('ol', 'portal-rubric'); q.rubric.forEach((point) => rubric.append(node('li', '', point))); feedback.append(rubric);
          }
        }
        feedback.append(node('h4', 'portal-reason-label', 'Common mistakes — and why they are wrong'));
        const mistakes = node('ul', 'portal-common-mistakes');
        q.commonMistakes!.forEach(mistake => mistakes.append(node('li', '', mistake)));
        feedback.append(mistakes, node('p', 'portal-feedback-guide', 'Rate the ideas and reasoning you recalled before revealing the answer.'));
        const ratings = node('div', 'portal-actions');
        for (const [value, label] of [['needs', '↻ Needs review'], ['partly', '◐ Partly'], ['got', '✓ Got it']] as const) {
          const rating = button(label, 'portal-pill', () => {
            answer.rating = value;
            feedback.dataset.state = value; feedbackHeading.textContent = ratingLabels[value];
            for (const choice of ratings.querySelectorAll('button')) choice.setAttribute('aria-pressed', String(choice === rating));
            const finished = questions.filter(complete).length;
            const progressLabel = `Question ${index + 1} of ${questions.length} · ${finished} answered`;
            const progressText = panel.querySelector<HTMLElement>('.portal-progress > span');
            const progressBar = panel.querySelector<HTMLProgressElement>('.portal-progress > progress');
            if (progressText) progressText.textContent = progressLabel;
            if (progressBar) { progressBar.value = finished; progressBar.setAttribute('aria-label', progressLabel); }
            const next = panel.querySelector<HTMLButtonElement>('.portal-question-navigation .portal-generate');
            if (next) next.disabled = false;
          });
          rating.dataset.rating = value;
          rating.setAttribute('aria-pressed', String(answer.rating === value));
          ratings.append(rating);
        }
        feedback.append(ratings);
      }
      if (q.companion === 'forebrain-directions') {
        panel.classList.add('portal-panel-companion');
        const layout = node('div', 'portal-companion-layout portal-companion-feedback');
        const model = node('aside', 'portal-companion-slot');
        model.setAttribute('aria-label', 'Interactive explanation of forebrain directions');
        layout.append(feedback, model); panel.append(layout);
        disposeVisual = mountDirectionCompanion(model, { revealed: true });
      }
      const choiceList = panel.querySelector('.portal-answers');
      if (choiceList) panel.insertBefore(feedback, choiceList);
      else if (!q.companion) panel.append(feedback);
    }
    const navigation = node('div', 'portal-actions portal-question-navigation');
    const previous = button('← Previous', 'portal-pill', () => { index -= 1; render(); }); previous.disabled = index === 0;
    navigation.append(previous);
    if (reviewing) navigation.append(button('Back to results', 'portal-pill', renderResults));
    const next = button(index === questions.length - 1 ? 'See results' : 'Next question →', 'portal-generate', () => {
      if (!complete(q)) return;
      if (index === questions.length - 1) renderResults();
      else { index += 1; render(); }
    });
    next.disabled = !complete(q); navigation.append(next); panel.append(navigation, sourceNote(course, options.scope, options.focus));
    container.replaceChildren(panel);
    const feedbackHeading = panel.querySelector<HTMLElement>('.portal-feedback h3');
    if (focus === 'feedback' && feedbackHeading) focusElement(feedbackHeading, true);
    else focusHeading(panel, true);
  }

  function renderEmpty(): void {
    disposeVisual?.(); disposeVisual = undefined;
    const panel = node('section', 'portal-panel');
    panel.append(node('h2', 'portal-title', 'No questions at this difficulty'), button('Choose study options', 'portal-generate', onBack));
    container.replaceChildren(panel); focusHeading(panel);
  }

  function renderResults(): void {
    if (!current()) return;
    disposeVisual?.(); disposeVisual = undefined;
    const result = engine.summarize(questions, answers);
    if (!resultsSaved) {
      const stored = readSaved<unknown>('brain-midterm-results-v1', []);
      const history = Array.isArray(stored) ? stored : [];
      save('brain-midterm-results-v1', [{ course, scope: options.scope, focus: options.focus, at: new Date().toISOString(), difficulty: options.difficulty, count: questions.length, retry: retryRound, ...result }, ...history].slice(0, 20));
      resultsSaved = true;
    }
    const panel = node('section', 'portal-panel portal-results');
    panel.append(node('p', 'portal-eyebrow', `${data.title} · ${data.scope}`), node('h2', 'portal-title', 'Make the next pass count.'), node('p', 'portal-subtitle', `${questions.length} questions completed. Check your strengths and revisit anything that needs another pass.`));
    const scores = node('div', 'portal-score-grid');
    if (result.objective) {
      const card = node('div', 'portal-card');
      card.append(node('h3', '', `${result.correct} / ${result.objective}`), node('p', '', 'Auto-checked answers correct'), node('p', 'portal-subtitle', `${Math.round(result.correct / result.objective * 100)}% of multiple-choice and true/false items`)); scores.append(card);
    }
    if (result.recall) {
      const card = node('div', 'portal-card');
      card.append(node('h3', '', `${result.got} / ${result.recall}`), node('p', '', 'Written answers self-rated “Got it”'), node('p', 'portal-subtitle', `${result.partly} partly · ${result.needs} need review. These are your own ratings, not an automatic grade.`)); scores.append(card);
    }
    panel.append(scores, node('h3', '', 'Topic coverage'));
    const topics = node('ul', 'portal-topic-results');
    for (const topic of result.topics) {
      const row = node('li'); row.append(node('strong', '', topic.topic));
      const details: string[] = [];
      if (topic.objective) details.push(`${topic.correct}/${topic.objective} auto-checked correct`);
      if (topic.recall) details.push(`Recall: ${topic.got} got it, ${topic.partly} partly, ${topic.needs} need review`);
      row.append(node('span', '', details.join(' · '))); topics.append(row);
    }
    panel.append(topics);
    const actions = node('div', 'portal-actions');
    if (result.reviewIds.length) actions.append(button(`Retry ${result.reviewIds.length} to review`, 'portal-generate', () => {
      const ids = new Set(result.reviewIds);
      questions = engine.shuffle(data.questions.filter((q) => ids.has(q.id))).map((q) => engine.shuffleChoices(q));
      answers = {}; index = 0; reviewing = false; retryRound = true; resultsSaved = false; render();
    }));
    actions.append(button('Review all answers', 'portal-pill', () => { reviewing = true; index = 0; render(); }), button('New study session', 'portal-pill', onBack));
    panel.append(actions, node('p', 'portal-subtitle', 'Your recent session summary is saved in this browser when local storage is available.'), sourceNote(course, options.scope, options.focus));
    container.replaceChildren(panel); focusHeading(panel);
  }
  render();
}

function showFlashcards(data: CourseBank, engine: Engine, options: StudyOptions, current: () => boolean): void {
  const { container, course, onBack } = options;
  const key = flashcardProgressKey(course, options.scope, options.focus);
  const cards = new Map(data.flashcards.map((card) => [card.id, card]));
  const saved = readSaved<{ queue?: string[]; mastered?: string[]; reviews?: number }>(key, {});
  const restored = mergeFlashcardQueue(saved, [...cards.keys()]);
  let mastered = new Set(restored.mastered);
  let queue = restored.queue;
  let reviews = Number.isFinite(saved.reviews) ? Number(saved.reviews) : 0;
  let flipped = false;
  let lastAction = '';
  let disposeVisual: (() => void) | undefined;
  const persist = () => save(key, { queue, mastered: [...mastered], reviews });

  function restart(): void {
    queue = engine.shuffle([...cards.keys()]); mastered = new Set(); reviews = 0; flipped = false; lastAction = ''; persist(); render(true);
  }
  function rate(again: boolean): void {
    const id = queue.shift();
    if (!id) return;
    if (again) { queue.push(id); lastAction = 'Queued for another look.'; }
    else { mastered.add(id); lastAction = 'Marked Got it.'; }
    reviews += 1; flipped = false; persist(); render(true);
  }
  function render(focusCard = false, animateFlip = false): void {
    if (!current()) return;
    disposeVisual?.(); disposeVisual = undefined;
    const panel = node('section', 'portal-panel portal-flashcards');
    panel.append(button('← Study options', 'portal-pill portal-study-back', onBack), node('p', 'portal-eyebrow', `${data.title} · Flashcards`));
    const focusChoices = node('div', 'portal-actions portal-focus-choices');
    focusChoices.setAttribute('role', 'group'); focusChoices.setAttribute('aria-label', 'Flashcard focus');
    for (const [value, label] of [['all', 'All course topics'], ['visual', 'Wireframe basics']] as const) {
      const choice = button(label, 'portal-pill', () => { if (value !== options.focus) options.onFocusChange(value); });
      choice.setAttribute('aria-pressed', String(options.focus === value)); focusChoices.append(choice);
    }
    panel.append(focusChoices);
    panel.append(progress(mastered.size, cards.size, `${mastered.size} of ${cards.size} marked Got it · ${queue.length} remaining`));
    if (!queue.length) {
      panel.append(node('h2', 'portal-title', 'Every card, one more connection.'), node('p', 'portal-subtitle', `You have marked all ${cards.size} cards Got it after ${reviews} reviews. This reflects your own recall ratings.`));
      const actions = node('div', 'portal-actions'); actions.append(button('Shuffle & restart', 'portal-generate', restart), button('Study options', 'portal-pill', onBack));
      panel.append(actions, sourceNote(course, options.scope, options.focus)); container.replaceChildren(panel); focusHeading(panel); return;
    }
    const card = cards.get(queue[0])!;
    panel.append(node('span', 'portal-topic-chip', card.topic), node('h2', 'portal-question-title', 'Bring it back to mind.'));
    const surface = node('div', 'portal-card');
    if (card.visual) {
      surface.classList.add('portal-card-visual');
      panel.append(node('span', 'portal-topic-chip', card.grounding === 'supporting' ? 'Supporting visual vocabulary' : 'From your study guide'));
      const visual = node('div', 'portal-visual-slot'); surface.append(visual);
      disposeVisual = mountStudyVisual(visual, card.visual, { revealed: flipped });
      if (card.sourceNote && flipped) panel.append(node('p', 'portal-subtitle portal-item-source', card.sourceNote));
    }
    const flip = button('', `portal-flashcard${animateFlip ? ' is-flipping' : ''}`, () => { flipped = !flipped; render(true, true); });
    if (card.visual) surface.addEventListener('click', event => {
      // Extend the flip button's pointer target across the illustration while
      // keeping its keyboard behavior and the source links independent.
      if (event.target instanceof Element && !event.target.closest('button, a')) flip.click();
    });
    const side = node('span', 'portal-eyebrow', flipped ? 'Answer' : 'Question');
    const content = node('span', 'portal-flashcard-text', flipped ? card.answer : card.question);
    const hint = node('span', 'portal-subtitle', flipped ? 'Click or press Enter to see the question' : 'Recall first. Click or press Enter to reveal.');
    side.id = `portal-card-side-${course}`; content.id = `portal-card-content-${course}`; hint.id = `portal-card-hint-${course}`;
    flip.setAttribute('aria-labelledby', `${side.id} ${content.id}`);
    flip.setAttribute('aria-describedby', hint.id);
    flip.setAttribute('aria-expanded', String(flipped));
    flip.dataset.flipped = String(flipped);
    flip.append(side, content, hint);
    surface.append(flip);
    if (card.companion === 'forebrain-directions') {
      panel.classList.add('portal-panel-companion');
      surface.classList.add('portal-companion-layout');
      const model = node('aside', 'portal-companion-slot');
      model.setAttribute('aria-label', flipped ? 'Interactive explanation of forebrain directions' : 'Companion brain model');
      surface.append(model);
      disposeVisual = mountDirectionCompanion(model, { revealed: flipped });
    }
    panel.append(surface);
    const actions = node('div', 'portal-actions');
    const again = button('↻ Again', 'portal-pill', () => rate(true));
    const got = button('✓ Got it', 'portal-generate', () => rate(false));
    again.dataset.rating = 'needs'; got.dataset.rating = 'got';
    again.disabled = !flipped; got.disabled = !flipped; actions.append(again, got);
    panel.append(actions);
    const notice = node('p', 'portal-subtitle', lastAction || '“Again” returns the card later in this deck. “Got it” saves your progress in this browser.');
    notice.setAttribute('aria-live', 'polite'); panel.append(notice);
    const secondary = node('div', 'portal-actions');
    secondary.append(button('Shuffle remaining', 'portal-pill', () => { queue = engine.shuffle(queue); flipped = false; persist(); render(true); }));
    if (mastered.size || reviews) secondary.append(button('Restart deck', 'portal-pill', restart));
    panel.append(secondary, sourceNote(course, options.scope, options.focus)); container.replaceChildren(panel);
    if (focusCard) focusElement(flip, true);
    else focusHeading(panel, true);
  }
  render();
}
