export type Course = '105' | '108';
export type StudyScope = 'general' | 'midterm-1';
type Assessment = {
  id: 'midterm-1' | 'midterm-2' | 'final';
  title: string;
  date: string;
  dateLabel: string;
  coverage: string;
  available: boolean;
};

/** Fall 2026 syllabi. Availability describes the authored bank, not the exam date. */
export const COURSE_CATALOG: Record<Course, { title: string; availableCoverage: string; assessments: Assessment[] }> = {
  '105': {
    title: 'PSYC 105',
    availableCoverage: 'Modules 1–10',
    assessments: [
      { id: 'midterm-1', title: 'Midterm 1', date: '2026-10-19', dateLabel: 'October 19', coverage: 'Modules 1–10', available: true },
      { id: 'midterm-2', title: 'Midterm 2', date: '2026-11-16', dateLabel: 'November 16', coverage: 'Study materials coming later', available: false },
      { id: 'final', title: 'Final exam', date: '2026-12-11', dateLabel: 'December 11 · 3–6 p.m.', coverage: 'Cumulative', available: false },
    ],
  },
  '108': {
    title: 'PSYC 108',
    availableCoverage: 'Midterm 1 topics',
    assessments: [
      { id: 'midterm-1', title: 'Midterm 1', date: '2026-10-19', dateLabel: 'October 19', coverage: 'Midterm 1 study guide and review', available: true },
      { id: 'midterm-2', title: 'Midterm 2', date: '2026-11-20', dateLabel: 'November 20', coverage: 'Study materials coming later', available: false },
      { id: 'final', title: 'Final exam', date: '2026-12-11', dateLabel: 'December 11 · 8–10 a.m.', coverage: 'Cumulative', available: false },
    ],
  },
};

export const scopeLabel = (scope: StudyScope): string => scope === 'general' ? 'General study' : 'Midterm 1';

export function courseScopeNote(course: Course, scope: StudyScope): string {
  if (scope === 'general') return `All currently available ${COURSE_CATALOG[course].title} material. This bank currently covers ${course === '105' ? 'Midterm 1, Modules 1–10' : 'Midterm 1 only'}; later course material will be added as it becomes available.`;
  return course === '105' ? 'Focused on Midterm 1: Modules 1–10.' : 'Focused on the Midterm 1 study guide and review materials.';
}

/** Keep existing quiz/card links working, but never route a locked or unknown scope into a bank. */
export function resolveStudyScope(rawScope: string | null, step: string | null): { scope: StudyScope | null; blocked: boolean } {
  if (rawScope === 'general' || rawScope === 'midterm-1') return { scope: rawScope, blocked: false };
  if (rawScope !== null) return { scope: null, blocked: true };
  return { scope: ['setup', 'quiz', 'cards'].includes(step || '') ? 'midterm-1' : null, blocked: false };
}
