import type { StudyVisualSpec } from './study-visuals';

export type Difficulty = 'mixed' | 'foundation' | 'application' | 'challenge';
export type StudyFocus = 'all' | 'visual';
export type StudyLength = 10 | 25 | 40 | 80 | 'all';
type VisualContent = { visual?: 'lobes' | StudyVisualSpec; grounding?: 'direct' | 'supporting'; sourceNote?: string };
export type Question = VisualContent & {
  id: string; topic: string; kind: 'mcq' | 'truefalse' | 'short';
  difficulty: Exclude<Difficulty, 'mixed'>; prompt: string; explanation: string;
  choices?: string[]; correctIndex?: number; rubric?: string[];
  choiceExplanations?: string[]; commonMistakes?: string[];
};
export type Flashcard = VisualContent & { id: string; topic: string; question: string; answer: string };
export type CourseBank = { title: string; scope: string; questions: Question[]; flashcards: Flashcard[] };

/** Keep supporting spatial vocabulary out of the default exam-scoped sessions. */
export function selectStudyBank(base: CourseBank, visual: CourseBank, focus: StudyFocus = 'all'): CourseBank {
  if (focus === 'visual') return { ...base, scope: 'Wireframe basics · includes supporting visual vocabulary', questions: [...visual.questions], flashcards: [...visual.flashcards] };
  return {
    ...base,
    questions: [...base.questions, ...visual.questions.filter(question => question.grounding === 'direct')],
    flashcards: [...base.flashcards, ...visual.flashcards.filter(card => card.grounding === 'direct')],
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
