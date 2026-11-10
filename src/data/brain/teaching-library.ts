import l15 from './l15-teaching.json';

export type AssetKind = 'master' | 'breakdown' | 'interactive';
export interface TeachingAsset {
  id: string; title: string; type: AssetKind; concept: string; slides: number[];
  duration?: number; gif?: string; video?: string; poster?: string;
  chapters?: { time: number; title: string }[]; sources: string[];
}
export const kindLabels: Record<AssetKind, string> = { master: 'Overview', breakdown: 'Breakdown', interactive: 'Interactable' };
const l15Order = ['circuit-master','baseline-brake','direct-go','indirect-no-go','dopamine-modulation','learning-master','successful-strum','unsuccessful-strum','parkinsons-circuit'];
export const l15Assets: TeachingAsset[] = [
  ...(l15.assets as TeachingAsset[]).toSorted((a,b)=>l15Order.indexOf(a.id)-l15Order.indexOf(b.id)),
  { id: 'guitar-learning', title: 'Learn from a guitar strum', type: 'interactive', concept: 'Learning from outcomes', slides: [22, 23, 24, 25, 26, 27], sources: [
    'L15 slides 22–27: dopamine, action selection, and learning from outcomes.',
    'Lecture 16 transcript: guitar example; Lecture 17 transcript: LTP/LTD explanation and correction.'
  ] }
];
export const modules = [{ id: 'l15', number: 15, title: 'Basal ganglia', subtitle: 'Movement selection and learning from outcomes', assets: l15Assets, downloadBundle: l15.downloadBundle }];
export function assetUrl(moduleId: string, assetId: string) { return `/brain/psyc108/${moduleId}/${assetId}/`; }
export function mediaUrl(file: string | undefined, moduleId = 'l15') { return file ? `/brain/teaching/${moduleId}/${file.split(/[\\/]/).pop()}` : ''; }
export function slideLabel(slides: number[]) {
  if (!slides.length) return 'Lecture context';
  const groups: string[] = []; let first = slides[0], last = first;
  for (const n of [...slides.slice(1), NaN]) {
    if (n === last + 1) { last = n; continue; }
    groups.push(first === last ? String(first) : `${first}–${last}`); first = last = n;
  }
  return `${slides.length === 1 ? 'Slide' : 'Slides'} ${groups.join(', ')}`;
}
