import type { StudyVisualSpec } from './study-visuals';

export type Difficulty = 'mixed' | 'foundation' | 'application' | 'challenge';
export type StudyFocus = 'all' | 'visual';
export type StudyLength = 10 | 25 | 40 | 80 | 'all';
type VisualContent = { visual?: StudyVisualSpec; companion?: 'forebrain-directions'; grounding?: 'direct' | 'supporting'; sourceNote?: string };
export type Question = VisualContent & {
  id: string; topic: string; kind: 'mcq' | 'truefalse' | 'short';
  difficulty: Exclude<Difficulty, 'mixed'>; prompt: string; explanation: string;
  choices?: string[]; correctIndex?: number; rubric?: string[];
  choiceExplanations?: string[]; commonMistakes?: string[];
};
export type Flashcard = VisualContent & { id: string; topic: string; question: string; answer: string };
export type CourseBank = { title: string; scope: string; questions: Question[]; flashcards: Flashcard[] };

/** Mix the requested visual foundations into course review while retaining
 * each item's source scope. The separate focus remains a visual-only deck. */
export function selectStudyBank(base: CourseBank, visual: CourseBank, focus: StudyFocus = 'all'): CourseBank {
  if (focus === 'visual') return { ...base, scope: 'Wireframe basics · includes supporting visual vocabulary', questions: [...visual.questions], flashcards: [...visual.flashcards] };
  return {
    ...base,
    questions: [...base.questions, ...visual.questions],
    flashcards: [...base.flashcards, ...visual.flashcards],
  };
}

export function studyAvailability(bank: CourseBank): Record<Difficulty, number> {
  return {
    mixed: bank.questions.length,
    foundation: bank.questions.filter(question => question.difficulty === 'foundation').length,
    application: bank.questions.filter(question => question.difficulty === 'application').length,
    challenge: bank.questions.filter(question => question.difficulty === 'challenge').length,
  };
}

export function flashcardProgressKey(course: string, scope: string, focus: StudyFocus): string {
  return `brain-${scope === 'general' ? 'general' : 'midterm'}-flashcards-${course}${focus === 'visual' ? '-visual' : ''}-v1`;
}

/** Restore progress without leaving newly authored cards at the end of an old
 * queue. Random insertions preserve the user's existing review order. */
export function mergeFlashcardQueue(
  saved: { queue?: unknown; mastered?: unknown },
  allIds: readonly string[],
  random: () => number = Math.random,
): { queue: string[]; mastered: string[] } {
  const available = new Set(allIds);
  const safeIds = (value: unknown): string[] => Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && available.has(id)))]
    : [];
  const mastered = safeIds(saved.mastered), masteredSet = new Set(mastered);
  const queue = safeIds(saved.queue).filter(id => !masteredSet.has(id));
  const queued = new Set(queue);
  const additions = [...available].filter(id => !masteredSet.has(id) && !queued.has(id));
  for (let i = additions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [additions[i], additions[j]] = [additions[j], additions[i]];
  }
  for (const id of additions) queue.splice(Math.floor(random() * (queue.length + 1)), 0, id);
  return { queue, mastered };
}
