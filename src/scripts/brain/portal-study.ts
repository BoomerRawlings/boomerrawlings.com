type Course = '105' | '108';
type Difficulty = 'mixed' | 'foundation' | 'application' | 'challenge';
type Question = {
  id: string; topic: string; kind: 'mcq' | 'truefalse' | 'short';
  difficulty: Exclude<Difficulty, 'mixed'>; prompt: string; explanation: string;
  choices?: string[]; correctIndex?: number; rubric?: string[]; visual?: 'lobes';
};
type Flashcard = { id: string; topic: string; question: string; answer: string };
type CourseBank = { title: string; scope: string; questions: Question[]; flashcards: Flashcard[] };
type Answer = { selected?: number; written?: string; revealed?: boolean; rating?: 'needs' | 'partly' | 'got' };
type Totals = { objective: number; correct: number; recall: number; got: number; partly: number; needs: number; unanswered: number };
type Summary = Totals & { topics: (Totals & { topic: string })[]; reviewIds: string[] };
type Engine = {
  shuffle: <T>(items: T[]) => T[];
  shuffleChoices: (question: Question) => Question;
  selectQuestions: (questions: Question[], options: { length: number; difficulty: Difficulty }) => { questions: Question[]; requested: number; available: number; capped: boolean };
  summarize: (questions: Question[], answers: Record<string, Answer>) => Summary;
};
export type StudyOptions = {
  course: Course; mode: 'quiz' | 'flashcards'; length: 10 | 25 | 40 | 80;
  difficulty: Difficulty; container: HTMLElement; onBack: () => void;
};

let bankPromise: Promise<Record<Course, CourseBank>> | undefined;
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
function sourceNote(course: Course): HTMLElement {
  return node('p', 'portal-subtitle portal-source-note', course === '105'
    ? 'Scope: 105 Study Guide, Modules 1–10, and Exam 1 Review. Original practice questions based on these materials.'
    : 'Scope: PSYC 108 Midterm 1 Study Guide and review materials. Original practice questions based on these materials.');
}

/** A broad lateral-cortex schematic: anterior is left; numbered landmarks match the authored bank. */
function lobesDiagram(): HTMLElement {
  const wrapper = node('figure', 'portal-diagram');
  // The SVG is fixed authored markup. User-entered recall is rendered exclusively as text.
  wrapper.innerHTML = `<svg viewBox="0 0 600 340" role="img" aria-labelledby="portal-lobes-title portal-lobes-desc" xmlns="http://www.w3.org/2000/svg">
    <title id="portal-lobes-title">Numbered lateral view of a cerebral hemisphere</title>
    <desc id="portal-lobes-desc">Anterior is on the left. Identify the four numbered cortical lobes and the two numbered major sulci. The broad diagram is schematic and not to scale.</desc>
    <defs><clipPath id="portal-cortex-clip"><path d="M91 240 C43 187 64 111 115 86 C177 44 241 54 290 68 C365 42 439 75 481 118 C534 140 554 187 525 222 C497 270 426 283 367 271 C297 314 216 302 177 266 C135 271 107 258 91 240Z"/></clipPath></defs>
    <g clip-path="url(#portal-cortex-clip)">
      <path d="M45 35H290L275 113L292 138L274 165L284 181L148 199L122 276H45Z" fill="#a3d8ea"/>
      <path d="M290 35H438L441 166L399 224L376 211Q330 182 284 181L274 165L292 138L275 113Z" fill="#c3c7ef"/>
      <path d="M438 35H580V295H399L399 224L441 166Z" fill="#edc7a6"/>
      <path d="M148 199Q220 184 284 181Q330 182 376 211L399 224V330H122V276Z" fill="#e9dca7"/>
    </g>
    <path d="M91 240 C43 187 64 111 115 86 C177 44 241 54 290 68 C365 42 439 75 481 118 C534 140 554 187 525 222 C497 270 426 283 367 271 C297 314 216 302 177 266 C135 271 107 258 91 240Z" fill="none" stroke="#22364c" stroke-width="3"/>
    <path d="M290 68L275 113L292 138L274 165L284 181M148 199Q220 184 284 181Q330 182 376 211" fill="none" stroke="#22364c" stroke-width="5" stroke-linecap="round"/>
    <path d="M441 107L441 166L399 224" fill="none" stroke="#22364c" stroke-width="2" stroke-dasharray="5 5"/>
    <path d="M277 34L278 92M78 188L147 198" fill="none" stroke="#dcecf5" stroke-width="2"/>
    <g fill="#122334" font-family="system-ui,sans-serif" font-size="24" font-weight="700" text-anchor="middle">
      <circle cx="180" cy="136" r="20" fill="#fff"/><text x="180" y="144">1</text>
      <circle cx="360" cy="135" r="20" fill="#fff"/><text x="360" y="143">2</text>
      <circle cx="288" cy="247" r="20" fill="#fff"/><text x="288" y="255">3</text>
      <circle cx="486" cy="187" r="20" fill="#fff"/><text x="486" y="195">4</text>
      <circle cx="277" cy="23" r="20" fill="#fff"/><text x="277" y="31">5</text>
      <circle cx="62" cy="185" r="20" fill="#fff"/><text x="62" y="193">6</text>
    </g>
    <g fill="#dcecf5" font-family="system-ui,sans-serif" font-size="14"><text x="70" y="328">← Anterior / front</text><text x="395" y="328">Posterior / back →</text></g>
  </svg>`;
  wrapper.append(node('figcaption', 'portal-subtitle', 'Lateral cortical surface • schematic, not to scale. Dashed boundary is approximate.'));
  return wrapper;
}

async function loadBank(): Promise<Record<Course, CourseBank>> {
  if (!bankPromise) bankPromise = fetch('/brain/midterm-bank.json').then(async (response) => {
    if (!response.ok) throw new Error('Study material could not be loaded.');
    const bank = await response.json();
    if (!bank['105']?.questions?.length || !bank['108']?.flashcards?.length) throw new Error('Study material is unavailable.');
    return bank;
  }).catch((error) => { bankPromise = undefined; throw error; });
  return bankPromise;
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
    const engineUrl = '/brain/midterm-engine.js';
    const [bank, engine] = await Promise.all([loadBank(), import(/* @vite-ignore */ engineUrl) as Promise<Engine>]);
    if (!current()) return;
    const data = bank[course];
    if (options.mode === 'flashcards') showFlashcards(data, engine, { ...options, container: host, onBack: back }, current);
    else showQuiz(data, engine, { ...options, container: host, onBack: back }, current);
  } catch {
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
  const { container, course, onBack } = options;
  const complete = (question: Question) => question.kind === 'short' ? Boolean(answers[question.id]?.rating) : Boolean(answers[question.id]?.revealed);

  function render(focus: 'question' | 'feedback' = 'question'): void {
    if (!current()) return;
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
    if (q.visual === 'lobes') panel.append(lobesDiagram());

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
        const option = button(`${String.fromCharCode(65 + choiceIndex)}. ${choice}`, 'portal-answer', () => {
          if (answer.revealed) return;
          answer.selected = choiceIndex;
          for (const other of choices.querySelectorAll<HTMLButtonElement>('button')) other.setAttribute('aria-pressed', String(other === option));
          if (check) check.disabled = false;
        });
        option.setAttribute('aria-pressed', String(answer.selected === choiceIndex));
        if (answer.revealed) {
          option.disabled = true;
          if (choiceIndex === q.correctIndex) { option.dataset.state = 'correct'; option.append(node('strong', '', ' · Correct answer')); }
          else if (choiceIndex === answer.selected) { option.dataset.state = 'incorrect'; option.append(node('strong', '', ' · Your answer')); }
        }
        choices.append(option);
      });
      panel.append(choices);
      if (!answer.revealed) {
        check = button('Check answer', 'portal-generate', () => { if (answer.selected !== undefined) { answer.revealed = true; render('feedback'); } });
        check.disabled = answer.selected === undefined; panel.append(check);
      }
    }

    if (answer.revealed) {
      const feedback = node('div', 'portal-feedback');
      const feedbackHeading = node('h3', '', q.kind === 'short' ? 'Compare your answer' : answer.selected === q.correctIndex ? 'Correct' : 'A useful one to revisit');
      feedbackHeading.tabIndex = -1;
      feedback.append(feedbackHeading);
      if(q.kind !== 'short' || !q.rubric?.length) feedback.append(node('p', '', q.explanation));
      if (q.kind === 'short') {
        if (q.rubric?.length) {
          const rubric = node('ul'); q.rubric.forEach((point) => rubric.append(node('li', '', point))); feedback.append(rubric);
        }
        feedback.append(node('p', 'portal-subtitle', 'This answer is self-rated. Compare the key ideas, then choose how well you recalled them.'));
        const ratings = node('div', 'portal-actions');
        for (const [value, label] of [['needs', 'Needs review'], ['partly', 'Partly'], ['got', 'Got it']] as const) {
          const rating = button(label, 'portal-pill', () => {
            answer.rating = value;
            for (const choice of ratings.querySelectorAll('button')) choice.setAttribute('aria-pressed', String(choice === rating));
            const finished = questions.filter(complete).length;
            const progressLabel = `Question ${index + 1} of ${questions.length} \u00b7 ${finished} answered`;
            const progressText = panel.querySelector<HTMLElement>('.portal-progress > span');
            const progressBar = panel.querySelector<HTMLProgressElement>('.portal-progress > progress');
            if (progressText) progressText.textContent = progressLabel;
            if (progressBar) { progressBar.value = finished; progressBar.setAttribute('aria-label', progressLabel); }
            const next = panel.querySelector<HTMLButtonElement>('.portal-question-navigation .portal-generate');
            if (next) next.disabled = false;
          });
          rating.setAttribute('aria-pressed', String(answer.rating === value));
          ratings.append(rating);
        }
        feedback.append(ratings);
      }
      panel.append(feedback);
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
    next.disabled = !complete(q); navigation.append(next); panel.append(navigation, sourceNote(course));
    container.replaceChildren(panel);
    const feedbackHeading = panel.querySelector<HTMLElement>('.portal-feedback h3');
    if (focus === 'feedback' && feedbackHeading) focusElement(feedbackHeading, true);
    else focusHeading(panel, true);
  }

  function renderEmpty(): void {
    const panel = node('section', 'portal-panel');
    panel.append(node('h2', 'portal-title', 'No questions at this difficulty'), button('Choose study options', 'portal-generate', onBack));
    container.replaceChildren(panel); focusHeading(panel);
  }

  function renderResults(): void {
    if (!current()) return;
    const result = engine.summarize(questions, answers);
    if (!resultsSaved) {
      const stored = readSaved<unknown>('brain-midterm-results-v1', []);
      const history = Array.isArray(stored) ? stored : [];
      save('brain-midterm-results-v1', [{ course, at: new Date().toISOString(), difficulty: options.difficulty, count: questions.length, retry: retryRound, ...result }, ...history].slice(0, 20));
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
    panel.append(actions, node('p', 'portal-subtitle', 'Your recent session summary is saved in this browser when local storage is available.'), sourceNote(course));
    container.replaceChildren(panel); focusHeading(panel);
  }
  render();
}

function showFlashcards(data: CourseBank, engine: Engine, options: StudyOptions, current: () => boolean): void {
  const { container, course, onBack } = options;
  const key = `brain-midterm-flashcards-${course}-v1`;
  const cards = new Map(data.flashcards.map((card) => [card.id, card]));
  const saved = readSaved<{ queue?: string[]; mastered?: string[]; reviews?: number }>(key, {});
  const safeIds = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && cards.has(id)))] : [];
  let mastered = new Set(safeIds(saved.mastered));
  let queue = safeIds(saved.queue).filter((id) => !mastered.has(id));
  // Add newly authored cards and recover from incomplete stored progress without losing mastered cards.
  for (const id of engine.shuffle([...cards.keys()])) if (!mastered.has(id) && !queue.includes(id)) queue.push(id);
  let reviews = Number.isFinite(saved.reviews) ? Number(saved.reviews) : 0;
  let flipped = false;
  let lastAction = '';
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
  function render(focusCard = false): void {
    if (!current()) return;
    const panel = node('section', 'portal-panel portal-flashcards');
    panel.append(button('← Study options', 'portal-pill portal-study-back', onBack), node('p', 'portal-eyebrow', `${data.title} · Flashcards`));
    panel.append(progress(mastered.size, cards.size, `${mastered.size} of ${cards.size} marked Got it · ${queue.length} remaining`));
    if (!queue.length) {
      panel.append(node('h2', 'portal-title', 'Every card, one more connection.'), node('p', 'portal-subtitle', `You have marked all ${cards.size} cards Got it after ${reviews} reviews. This reflects your own recall ratings.`));
      const actions = node('div', 'portal-actions'); actions.append(button('Shuffle & restart', 'portal-generate', restart), button('Study options', 'portal-pill', onBack));
      panel.append(actions, sourceNote(course)); container.replaceChildren(panel); focusHeading(panel); return;
    }
    const card = cards.get(queue[0])!;
    panel.append(node('span', 'portal-topic-chip', card.topic), node('h2', 'portal-question-title', 'Bring it back to mind.'));
    const surface = node('div', 'portal-card');
    const flip = button('', 'portal-flashcard', () => { flipped = !flipped; render(true); });
    const side = node('span', 'portal-eyebrow', flipped ? 'Answer' : 'Question');
    const content = node('span', 'portal-flashcard-text', flipped ? card.answer : card.question);
    const hint = node('span', 'portal-subtitle', flipped ? 'Click or press Enter to see the question' : 'Recall first. Click or press Enter to reveal.');
    side.id = `portal-card-side-${course}`; content.id = `portal-card-content-${course}`; hint.id = `portal-card-hint-${course}`;
    flip.setAttribute('aria-labelledby', `${side.id} ${content.id}`);
    flip.setAttribute('aria-describedby', hint.id);
    flip.setAttribute('aria-expanded', String(flipped));
    flip.dataset.flipped = String(flipped);
    flip.append(side, content, hint);
    surface.append(flip); panel.append(surface);
    const actions = node('div', 'portal-actions');
    const again = button('Again', 'portal-pill', () => rate(true));
    const got = button('Got it', 'portal-generate', () => rate(false));
    again.disabled = !flipped; got.disabled = !flipped; actions.append(again, got);
    panel.append(actions);
    const notice = node('p', 'portal-subtitle', lastAction || '“Again” returns the card later in this deck. “Got it” saves your progress in this browser.');
    notice.setAttribute('aria-live', 'polite'); panel.append(notice);
    const secondary = node('div', 'portal-actions');
    secondary.append(button('Shuffle remaining', 'portal-pill', () => { queue = engine.shuffle(queue); flipped = false; persist(); render(true); }));
    if (mastered.size || reviews) secondary.append(button('Restart deck', 'portal-pill', restart));
    panel.append(secondary, sourceNote(course)); container.replaceChildren(panel);
    if (focusCard) focusElement(flip, true);
    else focusHeading(panel, true);
  }
  render();
}
