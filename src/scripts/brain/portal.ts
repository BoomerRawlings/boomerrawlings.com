import { initializePortalScene } from './portal-scene';
import { showStudy, getStudyAvailability } from './portal-study';
import { claimStudyToolsReload } from './portal-load-recovery';
import { COURSE_CATALOG, courseScopeNote, resolveStudyScope, scopeLabel, type Course, type StudyScope } from './course-catalog';
import type { Difficulty, StudyFocus, StudyLength } from './study-bank';

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
let length: StudyLength = 25;
let difficulty: Difficulty = 'mixed';
let returnTo = '#portal';
let moving = !matchMedia('(prefers-reduced-motion: reduce)').matches;
let introTimer: ReturnType<typeof setTimeout>;
let hoverFrame = 0;
let hoverCloud: HTMLElement | null = null;
let hoverX = 0, hoverY = 0, targetX = 0, targetY = 0, velocityX = 0, velocityY = 0;

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
  return wrap;
}
function cloud(label: string, note: string, icon: keyof typeof icons, action: () => void, style = '', metaLabel?: string) {
  const node = button('', action, `portal-cloud ${style}`);
  node.dataset.node = icon;
  const meta = document.createElement('span'); meta.className = 'cloud-meta';
  meta.textContent = metaLabel || ({mind:'01 / STUDY',orbit:'02 / STUDY',explore:'03 / DISCOVER',lecture:'04 / PRIVATE',quiz:'01 / TEST YOURSELF',cards:'02 / ACTIVE RECALL'})[icon];
  meta.setAttribute('aria-hidden', 'true');
  const graphic = document.createElement('span'); graphic.className = 'cloud-icon'; graphic.innerHTML = icons[icon];
  const title = document.createElement('span'); title.className = 'cloud-label'; title.textContent = label;
  const description = document.createElement('span'); description.className = 'cloud-note'; description.textContent = note;
  const arrow = document.createElement('span'); arrow.className = 'cloud-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
  node.append(meta, graphic, title, description, arrow); return node;
}
function home() {
  returnTo = '#portal'; back.hidden = true; stage.dataset.view = 'home';
  const homeHeading = heading('NEURAL STUDY INTERFACE', 'Choose your destination.');
  homeHeading.classList.add('portal-home-heading');
  homeHeading.querySelector('.portal-title')!.classList.add('portal-visually-hidden');
  const clouds = document.createElement('div'); clouds.className = 'portal-clouds';
  clouds.append(cloud('PSYC 105', 'Choose your study path', 'mind', () => go('#study=105'), 'cloud-primary'));
  clouds.append(cloud('PSYC 108', 'Choose your study path', 'orbit', () => go('#study=108'), 'cloud-primary'));
  const explore = document.createElement('div'); explore.className = 'portal-explore-stack';
  explore.append(cloud('Explore', 'Step inside the models', 'explore', () => go('#mode=explore'), 'cloud-secondary'));
  explore.append(button('Practice with the atlas ↗', () => go('#mode=practice'), 'portal-practice-link'));
  clouds.append(explore, cloud('Lectures', 'Your private lecture room · Locked', 'lecture', () => go('#mode=lectures'), 'cloud-secondary'));
  stage.append(clouds);
  const coreLabel = document.createElement('div'); coreLabel.className = 'portal-core-label'; coreLabel.setAttribute('aria-hidden','true');
  coreLabel.innerHTML = '<span>NEURAL FIELD</span><small>EXPLORE · CONNECT · RECALL</small>'; stage.append(coreLabel);
}
function studyHash(course: Course, scope: StudyScope, step?: string): string {
  return `#study=${course}&scope=${scope}${step ? `&step=${step}` : ''}`;
}
function quizHash(course: Course, scope: StudyScope, step: 'setup' | 'quiz', focus: StudyFocus, includeShortAnswer: boolean, selectedLength = length, selectedDifficulty = difficulty): string {
  return `${studyHash(course, scope, step)}&length=${selectedLength}&difficulty=${selectedDifficulty}&focus=${focus}&shortAnswer=${includeShortAnswer ? '1' : '0'}`;
}
function scopeMenu(course: Course, blocked = false) {
  returnTo = '#portal'; stage.dataset.view = 'scope';
  heading(`PSYC ${course}`, 'Choose your study path.', 'Build across the course, or focus on the next exam.');
  const grid = document.createElement('div'); grid.className = 'portal-scope-grid';
  const general = cloud('General study', `All available topics · ${COURSE_CATALOG[course].availableCoverage} currently`, 'mind', () => go(studyHash(course, 'general')), 'cloud-primary', '01 / COURSE LIBRARY');
  general.dataset.scope = 'general'; grid.append(general);
  COURSE_CATALOG[course].assessments.forEach((assessment, index) => {
    const option = cloud(assessment.title, `${assessment.dateLabel} · ${assessment.coverage}`, assessment.id === 'final' ? 'orbit' : 'quiz', () => { if (assessment.available && assessment.id === 'midterm-1') go(studyHash(course, assessment.id)); }, `cloud-primary${assessment.available ? '' : ' cloud-locked'}`, `${String(index + 2).padStart(2, '0')} / ${assessment.available ? 'READY TO STUDY' : 'LOCKED'}`);
    option.dataset.scope = assessment.id;
    if (!assessment.available) {
      option.disabled = true;
      const lock = document.createElement('span'); lock.className = 'cloud-lock'; lock.textContent = 'Locked';
      option.append(lock);
    }
    grid.append(option);
  });
  stage.append(grid);
  const note = document.createElement('p'); note.className = 'portal-subtitle portal-scope-note';
  note.textContent = 'Fall 2026 syllabus · 2 midterms + 1 cumulative final. Dates may change with course announcements. General study currently contains the same available material as Midterm 1.';
  stage.append(note);
  if (blocked) {
    const notice = document.createElement('p'); notice.className = 'portal-subtitle portal-scope-notice'; notice.setAttribute('role', 'status');
    notice.textContent = 'That study section is not available yet. Choose General study or Midterm 1 to begin.';
    stage.append(notice);
  }
}
function courseMenu(course: Course, scope: StudyScope) {
  returnTo = `#study=${course}`; stage.dataset.view = 'course';
  heading(`PSYC ${course} · ${scopeLabel(scope).toUpperCase()}`, 'How would you like to study?', courseScopeNote(course, scope));
  const grid = document.createElement('div'); grid.className = 'portal-choice-grid';
  grid.append(cloud('Practice quizzes', 'Choose your pace. Test your understanding.', 'quiz', () => go(studyHash(course, scope, 'setup')), 'cloud-primary'), cloud('Flashcards', 'Retrieve. Reveal. Remember.', 'cards', () => go(studyHash(course, scope, 'cards')), 'cloud-primary'));
  stage.append(grid);
}
function setup(course: Course, scope: StudyScope, focus: StudyFocus, includeShortAnswer = false) {
  returnTo = studyHash(course, scope); stage.dataset.view = 'setup';
  heading(`PSYC ${course} · ${scopeLabel(scope).toUpperCase()} · PRACTICE QUIZZES`, focus === 'visual' ? 'Start with the basics.' : 'Make room for a challenge.', courseScopeNote(course, scope));
  const config = document.createElement('div'); config.className = 'portal-config';
  const countNote = document.createElement('p'); countNote.className = 'portal-subtitle'; countNote.id = 'portal-count-note'; countNote.setAttribute('aria-live','polite');
  let available: { choice: Record<Difficulty, number>; withShort: Record<Difficulty, number> } | undefined;
  const remember = () => history.replaceState(null, '', quizHash(course, scope, 'setup', focus, includeShortAnswer));
  const update = () => {
    if (!available) { countNote.textContent = 'Loading available questions…'; return; }
    const level = focus === 'visual' ? 'foundation' : difficulty;
    const counts = includeShortAnswer ? available.withShort : available.choice;
    const count = length === 'all' ? counts[level] : Math.min(length, counts[level]);
    generate.disabled = count === 0;
    if (!count) {
      countNote.textContent = !includeShortAnswer && available.withShort[level] > 0
        ? 'No multiple-choice questions at this difficulty yet. Turn on Short answer or choose another difficulty.'
        : 'No questions match these options. Choose another difficulty or focus.';
      return;
    }
    countNote.textContent = `${count} unique questions · ${focus === 'visual' ? 'Very basic visual identification' : level === 'mixed' ? 'All difficulty levels' : level === 'foundation' ? 'Foundational knowledge' : level === 'application' ? 'Applied understanding' : 'Deeper reasoning'}${length !== 'all' && count < length ? ` · This selection has ${count} questions` : ''}. Every answer includes an explanation.`;
  };
  const group = (name: string) => { const node = document.createElement('fieldset'); node.className = 'portal-option-group'; const legend = document.createElement('legend'); legend.textContent = name; node.append(legend); config.append(node); return node; };
  const focusChoices = group('01 / Choose a focus');
  for (const [value, label] of [['all', 'All course topics'], ['visual', 'Wireframe basics']] as const) {
    const choice = button(label, () => go(quizHash(course, scope, 'setup', value, includeShortAnswer)));
    choice.setAttribute('aria-pressed', String(focus === value)); focusChoices.append(choice);
  }
  if (focus === 'visual') {
    const note = document.createElement('p'); note.className = 'portal-subtitle';
    note.textContent = 'Identify highlighted regions, follow direction arrows and yellow tract connections, and distinguish surface views from section planes. Includes clearly marked supporting visual vocabulary.'; config.append(note);
  } else {
    const note = document.createElement('p'); note.className = 'portal-subtitle';
    note.textContent = 'Visual brain questions are included in course review. Choose Wireframe basics for a visual-only session.'; config.append(note);
  }
  const lengths = group('02 / Choose a length');
  for (const [n, label] of [[10,'10 · Quick orbit'],[25,'25 · Focus session'],[40,'40 · Deep dive'],[80,'80 · Extended practice'],['all','All · Complete bank']] as const) {
    const choice = button(label, () => { length = n; lengths.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', String(b === choice))); remember(); update(); });
    choice.setAttribute('aria-pressed', String(length === n)); lengths.append(choice);
  }
  const levels = group('03 / Choose a difficulty');
  levels.hidden = focus === 'visual';
  for (const [value, label] of [['mixed','Mixed'],['foundation','Foundation'],['application','Application'],['challenge','Challenge']] as const) {
    const choice = button(label, () => { difficulty = value; levels.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed', String(b === choice))); remember(); update(); });
    choice.setAttribute('aria-pressed', String(difficulty === value)); levels.append(choice);
  }
  const formats = group('04 / Question types');
  const formatNote = document.createElement('p'); formatNote.className = 'portal-subtitle'; formatNote.id = 'portal-short-answer-note';
  formatNote.textContent = focus === 'visual'
    ? 'Wireframe basics contains only multiple-choice questions. Short answer adds no questions to this focus.'
    : 'Multiple choice, including true/false, by default. Turn on Short answer to include written recall.';
  const shortState = document.createElement('span'); shortState.className = 'portal-toggle-state'; shortState.setAttribute('aria-hidden', 'true');
  const syncToggle = () => { shortToggle.setAttribute('aria-checked', String(includeShortAnswer)); shortState.textContent = includeShortAnswer ? 'On' : 'Off'; };
  const shortToggle = button('Short answer', () => { includeShortAnswer = !includeShortAnswer; syncToggle(); remember(); update(); }, 'portal-pill portal-short-answer');
  shortToggle.setAttribute('role', 'switch'); shortToggle.setAttribute('aria-describedby', formatNote.id); shortToggle.append(shortState); syncToggle();
  formats.append(shortToggle, formatNote);
  const generate = button('Generate quiz →', () => go(quizHash(course, scope, 'quiz', focus, includeShortAnswer, length, focus === 'visual' ? 'foundation' : difficulty)), 'portal-generate');
  generate.disabled = true; update(); config.append(countNote, generate);
  stage.append(config);
  void Promise.all([getStudyAvailability(course, focus), getStudyAvailability(course, focus, true)]).then(([choice, withShort]) => {
    if (!config.isConnected) return;
    available = { choice, withShort }; update();
  }).catch(() => {
    if (!config.isConnected) return;
    countNote.textContent = 'Question counts could not load. Generate a quiz to try loading your study material again.'; generate.disabled = false;
  });
}
async function showLegacy(version: number) {
  const params = new URLSearchParams(location.hash.slice(1)); params.set('view','atlas'); history.replaceState(null,'',`#${params}`);
  portal.hidden = true; legacy.hidden = false; legacy.inert = false; document.body.classList.remove('brain-portal-active');
  try {
    scene?.dispose(); scene = undefined;
    legacyReady ||= import('./app');
    const app = await legacyReady;
    if (version !== routeVersion) { if (legacy.hidden) app.suspendLegacy(); return; }
    app.resumeLegacy(); window.dispatchEvent(new Event('resize'));
  } catch (error) {
    if (version !== routeVersion) return;
    legacyReady = undefined;
    console.error('Unable to open study tools.', error);
    if (claimStudyToolsReload(error, () => sessionStorage)) { location.reload(); return; }
    portal.hidden = false; legacy.hidden = true; legacy.inert = true;
    document.body.classList.add('brain-portal-active');
    stage.classList.remove('portal-transitioning'); stage.dataset.view = 'error';
    returnTo = '#portal'; back.hidden = false; stage.replaceChildren();
    heading('CONNECTION INTERRUPTED', 'Study tools could not open.', 'Reload to get the latest version, then try Explore or Lectures again.');
    stage.append(button('Reload study tools', () => location.reload()), button('Study home', () => go('#portal')));
    updateMotion(); stage.querySelector<HTMLElement>('.portal-title')?.focus({preventScroll:true});
  }
}
async function route() {
  if (!unlocked) return;
  // Native atlas anchors keep their normal scroll/focus behavior.
  const anchor = document.getElementById(location.hash.slice(1));
  if (!legacy.hidden && anchor?.closest('#brain-legacy')) return;
  const version = ++routeVersion;
  resetCloudMotion();
  const params = new URLSearchParams(location.hash.slice(1));
  const course = params.get('study');
  const focus: StudyFocus = params.get('focus') === 'visual' ? 'visual' : 'all';
  const includeShortAnswer = params.get('shortAnswer') === '1';
  if (!course && (params.get('view') === 'atlas' || ['mode','topic','depth'].some(key=>params.has(key)))) { await showLegacy(version); return; }
  portal.hidden = false; legacy.hidden = true; legacy.inert = true; document.body.classList.add('brain-portal-active');
  if(legacyReady) void legacyReady.then(app=>{ if (legacy.hidden) app.suspendLegacy(); }).catch(()=>{});
  if(!scene) updateMotion();
  stage.classList.add('portal-transitioning');
  await new Promise(resolve=>setTimeout(resolve, moving ? 180 : 0));
  if(version !== routeVersion) return;
  stage.replaceChildren(); stage.classList.remove('portal-transitioning'); back.hidden = false;
  if(course === '105' || course === '108') {
    const step = params.get('step');
    if (step === 'setup' || step === 'quiz') {
      const n = Number(params.get('length')), d = params.get('difficulty');
      if (params.get('length') === 'all') length = 'all';
      else if ([10,25,40,80].includes(n)) length = n as StudyLength;
      if (['mixed','foundation','application','challenge'].includes(d || '')) difficulty = d as Difficulty;
    }
    const { scope, blocked } = resolveStudyScope(params.get('scope'), step);
    if (blocked) {
      history.replaceState(null, '', `#study=${course}`);
      scopeMenu(course, true);
    } else if (!scope) scopeMenu(course);
    else if(step === 'setup') setup(course, scope, focus, includeShortAnswer);
    else if(step === 'cards' || step === 'quiz') {
      returnTo = step === 'quiz' ? quizHash(course, scope, 'setup', focus, includeShortAnswer) : studyHash(course, scope); stage.dataset.view = step;
      const n = Number(params.get('length')); const d = params.get('difficulty');
      const validLength = (params.get('length') === 'all' ? 'all' : [10,25,40,80].includes(n) ? n : length) as StudyLength;
      const validDifficulty = (focus === 'visual' ? 'foundation' : ['mixed','foundation','application','challenge'].includes(d || '') ? d : difficulty) as Difficulty;
      const mount = document.createElement('div'); mount.className = 'portal-study-mount'; stage.append(mount);
      const studyBack = returnTo;
      await showStudy({course,scope,focus,includeShortAnswer,mode:step === 'cards' ? 'flashcards' : 'quiz',length:validLength,difficulty:validDifficulty,container:mount,onBack:()=>go(studyBack),onFocusChange:value=>go(step === 'quiz' ? quizHash(course, scope, 'quiz', value, includeShortAnswer, validLength, validDifficulty) : `${studyHash(course, scope, step)}&focus=${value}`)});
    } else courseMenu(course, scope);
  } else home();
  if(version !== routeVersion) return;
  stage.querySelector<HTMLElement>('.portal-title')?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
}
function runIntro() {
  unlocked = false; portal.hidden = false; legacy.hidden = true; legacy.inert = true;
  stage.inert = true; header.inert = true; intro.hidden = false; intro.classList.remove('is-complete');
  document.body.classList.add('brain-portal-active');
  // A fresh visit (including the back-forward cache) replays the full type-to-brain sequence.
  portal.classList.remove('portal-loading');
  void intro.offsetWidth;
  portal.classList.add('portal-loading');
  clearTimeout(introTimer);
  introTimer = setTimeout(() => { intro.classList.add('is-complete'); portal.classList.remove('portal-loading'); introTimer = setTimeout(()=>{intro.hidden = true; stage.inert = false; header.inert = false; unlocked = true; void route();},500); },6500);
}
back.addEventListener('click',()=>go(returnTo));
document.getElementById('portal-home')!.addEventListener('click',()=>go('#portal'));
function resetCloudMotion() {
  cancelAnimationFrame(hoverFrame); hoverFrame = 0;
  if (hoverCloud) for (const name of ['--cloud-x', '--cloud-y', '--cloud-tilt-x', '--cloud-tilt-y']) hoverCloud.style.removeProperty(name);
  hoverCloud = null; hoverX = hoverY = targetX = targetY = velocityX = velocityY = 0;
}
function animateCloud() {
  hoverFrame = 0;
  if (!moving || !hoverCloud?.isConnected) { resetCloudMotion(); return; }
  // A damped spring lets each option catch up to the pointer instead of snapping flat.
  velocityX = (velocityX + (targetX - hoverX) * .13) * .68;
  velocityY = (velocityY + (targetY - hoverY) * .13) * .68;
  hoverX += velocityX; hoverY += velocityY;
  hoverCloud.style.setProperty('--cloud-x', `${50 + hoverX * 45}%`);
  hoverCloud.style.setProperty('--cloud-y', `${50 + hoverY * 45}%`);
  hoverCloud.style.setProperty('--cloud-tilt-x', `${-hoverY * 5}deg`);
  hoverCloud.style.setProperty('--cloud-tilt-y', `${hoverX * 7}deg`);
  if (Math.abs(targetX - hoverX) + Math.abs(targetY - hoverY) + Math.abs(velocityX) + Math.abs(velocityY) > .002) hoverFrame = requestAnimationFrame(animateCloud);
}
stage.addEventListener('pointermove', event => {
  if (!moving || event.pointerType !== 'mouse') return;
  const option = event.target instanceof Element ? event.target.closest<HTMLElement>('.portal-cloud:not(:disabled)') : null;
  if (!option) { if (hoverCloud) { targetX = targetY = 0; if (!hoverFrame) hoverFrame = requestAnimationFrame(animateCloud); } return; }
  if (option !== hoverCloud) { resetCloudMotion(); hoverCloud = option; }
  const bounds = option.getBoundingClientRect();
  targetX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
  targetY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
  if (!hoverFrame) hoverFrame = requestAnimationFrame(animateCloud);
});
stage.addEventListener('pointerleave', () => { targetX = targetY = 0; if (hoverCloud && !hoverFrame) hoverFrame = requestAnimationFrame(animateCloud); });
function updateMotion() {
  if (!moving) resetCloudMotion();
  portal.classList.toggle('portal-motion-paused',!moving); motion.setAttribute('aria-pressed',String(moving)); motion.setAttribute('aria-label', moving ? 'Pause ambient motion' : 'Resume ambient motion');
  motion.innerHTML = moving ? 'Ⅱ <span>Motion</span>' : '▷ <span>Motion</span>';
  if(scene) scene.setMotion(moving);
  else if (!portal.hidden) { try { scene = initializePortalScene(document.getElementById('portal-canvas') as HTMLCanvasElement, {moving}); } catch {} }
}
window.addEventListener('brain-motion-change', event => {
  const value = (event as CustomEvent<{ moving?: boolean }>).detail?.moving;
  if (typeof value === 'boolean') { moving = value; updateMotion(); }
});
motion.addEventListener('click',()=>{moving = !moving; updateMotion();});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{moving = !event.matches; updateMotion();});
window.addEventListener('hashchange',()=>void route());
window.addEventListener('pageshow',event=>{if(event.persisted){runIntro();updateMotion();}});
window.addEventListener('pagehide',()=>{clearTimeout(introTimer);resetCloudMotion();scene?.dispose();scene=undefined;});
updateMotion(); runIntro();
