export type Outcome = 'good' | 'poor';
export interface Strength { go: number; nogo: number }
export interface Trial { outcome: Outcome; before: Strength; after: Strength; step: number; committed: boolean }
export interface LearningState { strength: Strength; completed: number; trial: Trial | null }
export const MAX_TRIALS = 3;
export function initialLearningState(): LearningState { return { strength: { go: 0, nogo: 0 }, completed: 0, trial: null }; }
export function beginTrial(state: LearningState, outcome: Outcome): LearningState {
  if (state.completed >= MAX_TRIALS || (state.trial && state.trial.step !== 4)) return state;
  const before = { ...state.strength };
  // These bounded values are display increments, never physiological measurements.
  const after = { go: before.go + (outcome === 'good' ? 1 : -1), nogo: before.nogo + (outcome === 'poor' ? 1 : -1) };
  return { ...state, trial: { outcome, before, after, step: 0, committed: false } };
}
export function moveTrial(state: LearningState, direction: -1 | 1): LearningState {
  if (!state.trial) return state;
  const trial = { ...state.trial, step: Math.max(0, Math.min(4, state.trial.step + direction)) };
  if (trial.step === 4 && !trial.committed) {
    trial.committed = true;
    return { strength: { ...trial.after }, completed: state.completed + 1, trial };
  }
  return { ...state, trial };
}
export function displayedStrength(state: LearningState): Strength {
  return state.trial ? (state.trial.step >= 3 ? state.trial.after : state.trial.before) : state.strength;
}
export function markerScale(value: number) {
  // Larger first changes; bounded endpoints keep labels and firing traces clear.
  const sizes=[.6,.68,.8,1,1.22,1.42,1.58];
  const position=Math.max(0,Math.min(6,value+3)),index=Math.min(5,Math.floor(position));
  return sizes[index]+(sizes[index+1]-sizes[index])*(position-index);
}
