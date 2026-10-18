import { initializePortalScene } from './portal-scene';
import { showStudy } from './portal-study';

type Course = '105' | '108';
type Difficulty = 'mixed' | 'foundation' | 'application' | 'challenge';
const portal = document.getElementById('brain-portal')!;
const stage = document.getElementById('portal-stage')!;
const legacy = document.getElementById('brain-legacy')!;
const header = portal.querySelector<HTMLElement>('.portal-header')!;
const intro = document.getElementById('portal-intro')!;
const back = document.getElementById('portal-back') as HTMLButtonElement;
const motion = document.getElementById('portal-motion') as HTMLButtonElement;
let scene: ReturnType<typeof initializePortalScene> | undefined;
let legacyReady: Promise<typeof import('./app')> | undefined;
let unlocked = false;
let routeVersion = 0;
let length: 10 | 25 | 40 | 80 = 25;
let difficulty: Difficulty = 'mixed';
let returnTo = '#portal';
let moving = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let introTimer: ReturnType<typeof setTimeout>;

const icons = {
  mind: '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M39 16C24 10 13 24 18 35 7 46 21 65 35 59M41 16C56 10 67 24 62 35 73 46 59 65 45 59M40 18V62M22 28Q38 26 29 40M18 45Q30 38 33 52M58 28Q42 26 51 40M62 45Q50 38 47 52"/><circle cx="40" cy="40" r="32" stroke-dasharray="2 8"/></svg>',
  orbit: '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><ellipse cx="40" cy="40" rx="32" ry="13" transform="rotate(-35 40 40)"/><ellipse cx="40" cy="40" rx="32" ry="13" transform="rotate(35 40 40)"/><circle cx="40" cy="40" r="8"/><circle cx="63" cy="21" r="3"/></svg>',
  explore: '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><circle cx="40" cy="40" r="26"/><ellipse cx="40" cy="40" rx="12" ry="26"/><path d="M14 40h52M20 24q20 12 40 0M20 56q20-12 40 0"/></svg>',
  lecture: '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><rect x="17" y="18" width="46" height="34" rx="7"/><path d="m34 27 15 9-15 9zM40 52v12M29 64h22"/><path d="M57 18v-4a6 6 0 0 0-12 0v4"/></svg>',
  quiz: '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><rect x="20" y="13" width="40" height="54" rx="10"/><path d="m28 29 4 4 8-9M44 29h8m-24 17 4 4 8-9M44 46h8"/></svg>',
  cards: '<svg viewBox="0 0 80 80" fill="none" aria-hidden="true"><rect x="24" y="18" width="36" height="47" rx="8" transform="rotate(10 42 41)"/><rect x="17" y="12" width="36" height="47" rx="8" transform="rotate(-9 35 35)"/><path d="m34 24 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/></svg>',
};
function button(label: string, action: () => void, className = 'portal-pill') {
  const node = document.createElement('button'); node.type = 'button'; node.className = className;
  node.textContent = label; node.addEventListener('click', action); return node;
}
function go(hash: string) { if (location.hash === hash) void route(); else location.hash = hash; }
function heading(eyebrow: string, title: string, subtitle = '') {
  const wrap = document.createElement('div'); wrap.className = 'portal-heading';
  const eye = document.createElement('p'); eye.className = 'portal-eyebrow'; eye.textContent = eyebrow;
  const h = document.createElement('h2'); h.className = 'portal-title'; h.textContent = title; h.tabIndex = -1;
  wrap.append(eye, h);
  if (subtitle) { const p = document.createElement('p'); p.className = 'portal-subtitle'; p.textContent = subtitle; wrap.append(p); }
  stage.append(wrap);
}
function cloud(label: string, note: string, icon: keyof typeof icons, action: () => void, style = '') {
  const node = button('', action, `portal-cloud ${style}`);
  node.dataset.node = icon;
  const meta = document.createElement('span'); meta.className = 'cloud-meta';
  meta.textContent = ({mind:'01 / STUDY',orbit:'02 / STUDY',explore:'03 / DISCOVER',lecture:'04 / PRIVATE',quiz:'01 / TEST YOURSELF',cards:'02 / ACTIVE RECALL'})[icon];
  meta.setAttribute('aria-hidden', 'true');
  const graphic = document.createElement('span'); graphic.className = 'cloud-icon'; graphic.innerHTML = icons[icon];
  const title = document.createElement('span'); title.className = 'cloud-label'; title.textContent = label;
  const description = document.createElement('span'); description.className = 'cloud-note'; description.textContent = note;
  const arrow = document.createElement('span'); arrow.className = 'cloud-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
  node.append(meta, graphic, title, description, arrow); return node;
}
function home() {
  returnTo = '#portal'; back.hidden = true; stage.dataset.view = 'home';
  heading('NEURAL STUDY INTERFACE', 'Enter your mind.', 'Select a destination. Build a deeper understanding.');
  const clouds = document.createElement('div'); clouds.className = 'portal-clouds';
  clouds.append(cloud('PSYC 105', 'Midterm 1 Study · Modules 1–10', 'mind', () => go('#study=105'), 'cloud-primary'));
  clouds.append(cloud('PSYC 108', 'Midterm 1 Study', 'orbit', () => go('#study=108'), 'cloud-primary'));
  const explore = document.createElement('div'); explore.className = 'portal-explore-stack';
  explore.append(cloud('Explore', 'Step inside the models', 'explore', () => go('#mode=explore'), 'cloud-secondary'));
  explore.append(button('Practice with the atlas ↗', () => go('#mode=practice'), 'portal-practice-link'));
  clouds.append(explore, cloud('Lectures', 'Your private lecture room · Locked', 'lecture', () => go('#mode=lectures'), 'cloud-secondary'));
  stage.append(clouds);
  const coreLabel = document.createElement('div'); coreLabel.className = 'portal-core-label'; coreLabel.setAttribute('aria-hidden','true');
  coreLabel.innerHTML = '<span>NEURAL FIELD</span><small>EXPLORE · CONNECT · RECALL</small>'; stage.append(coreLabel);
}
function courseMenu(course: Course) {
  returnTo = '#portal'; stage.dataset.view = 'course';
  heading(`PSYC ${course} · MIDTERM 1`, 'How would you like to study?', course === '105' ? 'Modules 1–10. One concept at a time.' : 'From neural structures to the evidence behind them.');
  const grid = document.createElement('div'); grid.className = 'portal-choice-grid';
  grid.append(cloud('Practice quizzes', 'Choose your pace. Test your understanding.', 'quiz', () => go(`#study=${course}&step=setup`), 'cloud-primary'), cloud('Flashcards', 'Retrieve. Reveal. Remember.', 'cards', () => go(`#study=${course}&step=cards`), 'cloud-primary'));
  stage.append(grid);
}
function setup(course: Course) {
  returnTo = `#study=${course}`; stage.dataset.view = 'setup';
  heading(`PSYC ${course} · PRACTICE QUIZZES`, 'Make room for a challenge.', 'A fresh mix of recall, explanation, and application.');
  const config = document.createElement('div'); config.className = 'portal-config';
  const countNote = document.createElement('p'); countNote.className = 'portal-subtitle'; countNote.id = 'portal-count-note'; countNote.setAttribute('aria-live','polite');
  const update = () => { const count = Math.min(length, difficulty === 'mixed' ? 80 : difficulty === 'application' ? 40 : 20); countNote.textContent = `${count} unique questions · ${difficulty === 'mixed' ? 'All difficulty levels' : difficulty === 'foundation' ? 'Foundational knowledge' : difficulty === 'application' ? 'Applied understanding' : 'Deeper reasoning'}${count < length ? ` · This level has ${count} questions` : ''}. Written answers include a rubric for self-checking.`; };
  const group = (name: string) => { const node = document.createElement('fieldset'); node.className = 'portal-option-group'; const legend = document.createElement('legend'); legend.textContent = name; node.append(legend); config.append(node); return node; };
  const lengths = group('01 / Choose a length');
  for (const [n, label] of [[10,'10 · Quick orbit'],[25,'25 · Focus session'],[40,'40 · Deep dive'],[80,'80 · Complete bank']] as const) {
    const choice = button(label, () => { length = n; lengths.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', String(b === choice))); update(); });
    choice.setAttribute('aria-pressed', String(length === n)); lengths.append(choice);
  }
  const levels = group('02 / Choose a difficulty');
  for (const [value, label] of [['mixed','Mixed'],['foundation','Foundation'],['application','Application'],['challenge','Challenge']] as const) {
    const choice = button(label, () => { difficulty = value; levels.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', String(b === choice))); update(); });
    choice.setAttribute('aria-pressed', String(difficulty === value)); levels.append(choice);
  }
  update(); config.append(countNote, button('Generate quiz ↗', () => go(`#study=${course}&step=quiz&length=${length}&difficulty=${difficulty}`), 'portal-generate'));
  stage.append(config);
}
async function showLegacy() {
  const params = new URLSearchParams(location.hash.slice(1)); params.set('view','atlas'); history.replaceState(null,'',`#${params}`);
  portal.hidden = true; legacy.hidden = false; legacy.inert = false; document.body.classList.remove('brain-portal-active');
  scene?.dispose(); scene = undefined;
  try { legacyReady ||= import('./app'); const app = await legacyReady; app.resumeLegacy(); window.dispatchEvent(new Event('resize')); }
  catch { legacyReady = undefined; portal.hidden = false; legacy.hidden = true; legacy.inert = true; document.body.classList.add('brain-portal-active'); stage.replaceChildren(); heading('CONNECTION INTERRUPTED', 'The atlas could not open.', 'Try again to load the existing study tools.'); stage.append(button('Try again',()=>void route()), button('Study home',()=>go('#portal'))); }
}
async function route() {
  if (!unlocked) return;
  // Native atlas anchors keep their normal scroll/focus behavior.
  const anchor = document.getElementById(location.hash.slice(1));
  if (!legacy.hidden && anchor?.closest('#brain-legacy')) return;
  const version = ++routeVersion;
  const params = new URLSearchParams(location.hash.slice(1));
  const course = params.get('study');
  if (!course && (params.get('view') === 'atlas' || ['mode','topic','depth'].some(key=>params.has(key)))) { await showLegacy(); return; }
  portal.hidden = false; legacy.hidden = true; legacy.inert = true; document.body.classList.add('brain-portal-active');
  if(legacyReady) void legacyReady.then(app=>app.suspendLegacy());
  if(!scene) updateMotion();
  stage.classList.add('portal-transitioning');
  await new Promise(resolve=>setTimeout(resolve, moving ? 180 : 0));
  if(version !== routeVersion) return;
  stage.replaceChildren(); stage.classList.remove('portal-transitioning'); back.hidden = false;
  if(course === '105' || course === '108') {
    const step = params.get('step');
    if(step === 'setup') setup(course);
    else if(step === 'cards' || step === 'quiz') {
      returnTo = `#study=${course}${step === 'quiz' ? '&step=setup' : ''}`; stage.dataset.view = step;
      const n = Number(params.get('length')); const d = params.get('difficulty');
      const validLength = ([10,25,40,80].includes(n) ? n : length) as typeof length;
      const validDifficulty = (['mixed','foundation','application','challenge'].includes(d || '') ? d : difficulty) as Difficulty;
      const mount = document.createElement('div'); mount.className = 'portal-study-mount'; stage.append(mount);
      await showStudy({course,mode:step === 'cards' ? 'flashcards' : 'quiz',length:validLength,difficulty:validDifficulty,container:mount,onBack:()=>go(returnTo)});
    } else courseMenu(course);
  } else home();
  if(version !== routeVersion) return;
  stage.querySelector<HTMLElement>('.portal-title')?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
}
function runIntro() {
  unlocked = false; portal.hidden = false; legacy.hidden = true; legacy.inert = true;
  stage.inert = true; header.inert = true; intro.hidden = false; intro.classList.remove('is-complete');
  document.body.classList.add('brain-portal-active');
  portal.classList.add('portal-loading');
  clearTimeout(introTimer);
  introTimer = setTimeout(() => { intro.classList.add('is-complete'); portal.classList.remove('portal-loading'); introTimer = setTimeout(()=>{intro.hidden = true; stage.inert = false; header.inert = false; unlocked = true; void route();},500); },3300);
}
back.addEventListener('click',()=>go(returnTo));
document.getElementById('portal-home')!.addEventListener('click',()=>go('#portal'));
function updateMotion() {
  portal.classList.toggle('portal-motion-paused',!moving); motion.setAttribute('aria-pressed',String(moving)); motion.setAttribute('aria-label', moving ? 'Pause ambient motion' : 'Resume ambient motion');
  motion.innerHTML = moving ? 'Ⅱ <span>Motion</span>' : '▷ <span>Motion</span>';
  if(scene) scene.setMotion(moving);
  else { try { scene = initializePortalScene(document.getElementById('portal-canvas') as HTMLCanvasElement, {moving}); } catch {} }
}
motion.addEventListener('click',()=>{moving = !moving; updateMotion();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{moving = !event.matches; updateMotion();});
window.addEventListener('hashchange',()=>void route());
window.addEventListener('pageshow',event=>{if(event.persisted){runIntro();updateMotion();}});
window.addEventListener('pagehide',()=>{clearTimeout(introTimer);scene?.dispose();scene=undefined;});
updateMotion(); runIntro();
