import l15 from './l15-teaching.json';
import l12 from './l12-teaching.json';
import l13 from './l13-teaching.json';
import l14 from './l14-teaching.json';
import l16 from './l16-teaching.json';
import l17 from './l17-teaching.json';
import l19 from './l19-teaching.json';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
export interface TeachingModule {id:string;number:number;title:string;subtitle:string;assets:TeachingAsset[];downloadBundle:string}
const l13Assets:TeachingAsset[]=[...(l13.assets as TeachingAsset[]),{id:'parietal-attention',title:'Compare parietal contributions',type:'interactive',concept:'Hemispheric specialization and lesions',slides:[15,16,17],sources:['L13 slides15–17: hemispheric contributions and pseudoneglect.','Lecture14 transcript: graded right-hemisphere coverage, primarily rightward left-hemisphere attention, and lesion comparisons.']}];
const l14Assets:TeachingAsset[]=[...(l14.assets as TeachingAsset[]),
  {id:'representational-neglect',title:'Turn the imagined viewpoint',type:'interactive',concept:'Neglect in imagined space',slides:[11,12],sources:['L14 slides11–12; Lecture15 transcript: Bisiach and Luzzatti’s imagined Milan square and opposite viewpoints.']},
  {id:'salience-selection',title:'Compare salience and parietal stimulation',type:'interactive',concept:'Selecting salient information',slides:[14,15,16],sources:['L14 slides14–16; Lecture15 transcript: global/local bias and left/right PPC stimulation comparisons.']}
];
const l16Assets:TeachingAsset[]=[...(l16.assets as TeachingAsset[]),{id:'synapse-effects',title:'Explore postsynaptic effects',type:'interactive',concept:'Chemical signaling across a synapse',slides:[4,5,6],sources:['L16 slides4–6; Lecture17 transcript: transmitter release, excitatory and inhibitory postsynaptic potentials, and second messengers.']}];
const l17Assets:TeachingAsset[]=[...(l17.assets as TeachingAsset[]),{id:'parkinsons-illustration',title:'Dopamine support and treatment context',type:'interactive',concept:'Parkinson’s circuit and treatments',slides:[4,5,6,7,8,9,10,11],sources:['L17 slides4–11; Lecture18 transcript: dopamine loss, Go/No-Go balance, L-DOPA, and deep brain stimulation.']}];
const catalog:TeachingModule[] = [
  {id:'l12',number:12,title:'Attention',subtitle:'Posner cueing and covert attention',assets:l12.assets as TeachingAsset[],downloadBundle:l12.downloadBundle},
  {id:'l13',number:13,title:'Attention networks',subtitle:'Orienting, reorienting, and hemispheric contributions',assets:l13Assets,downloadBundle:l13.downloadBundle},
  {id:'l14',number:14,title:'Attention and neglect',subtitle:'Imagined space and salience-based selection',assets:l14Assets,downloadBundle:l14.downloadBundle},
  {id:'l15',number:15,title:'Basal ganglia',subtitle:'Movement selection and learning from outcomes',assets:l15Assets,downloadBundle:l15.downloadBundle},
  {id:'l16',number:16,title:'Memory at the synapse',subtitle:'Synaptic signaling, LTP, and LTD',assets:l16Assets,downloadBundle:l16.downloadBundle},
  {id:'l17',number:17,title:'Types of memory',subtitle:'Parkinson’s circuits, H.M., and distinct memory systems',assets:l17Assets,downloadBundle:l17.downloadBundle},
  {id:'l19',number:19,title:'Sleep and memory',subtitle:'Place cells, coordinated replay, and lasting consolidation',assets:l19.assets as TeachingAsset[],downloadBundle:l19.downloadBundle}
];
// Only reviewed modules receive routes, navigation, or downloadable public media.
// Other catalog entries remain drafts until source, visual, and motion review pass.
export const modules = catalog.filter(module => ['l12', 'l13', 'l14', 'l15', 'l16', 'l19'].includes(module.id));
export function assetUrl(moduleId: string, assetId: string) { return `/brain/psyc108/${moduleId}/${assetId}/`; }
const mediaVersions = new Map<string,string>();
export function mediaUrl(file: string | undefined, moduleId = 'l15') {
  if(!file)return '';
  const path=`/brain/teaching/${moduleId}/${file.split(/[\\/]/).pop()}`;
  // Static generation: a changed file must not reuse an older browser media cache.
  if(!mediaVersions.has(path))mediaVersions.set(path,createHash('sha256').update(readFileSync(`public${path}`)).digest('hex').slice(0,12));
  return `${path}?v=${mediaVersions.get(path)}`;
}
export function slideLabel(slides: number[]) {
  if (!slides.length) return 'Lecture context';
  const groups: string[] = []; let first = slides[0], last = first;
  for (const n of [...slides.slice(1), NaN]) {
    if (n === last + 1) { last = n; continue; }
    groups.push(first === last ? String(first) : `${first}–${last}`); first = last = n;
  }
  return `${slides.length === 1 ? 'Slide' : 'Slides'} ${groups.join(', ')}`;
}
