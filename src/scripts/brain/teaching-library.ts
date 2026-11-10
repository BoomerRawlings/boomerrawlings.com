import { initGuitarLearning } from './guitar-learning';
import {initParietalAttention,initRepresentationalNeglect,initSalienceSelection} from './attention-illustrations';
import {initStepIllustrations} from './step-illustrations';

document.querySelector<HTMLButtonElement>('[data-expand-modules]')?.addEventListener('click', event => {
  const modules = [...document.querySelectorAll<HTMLDetailsElement>('[data-module]')];
  const open = modules.some(item => !item.open); modules.forEach(item => item.open = open);
  (event.currentTarget as HTMLButtonElement).textContent = open ? 'Collapse all' : 'Expand all';
});
document.querySelectorAll<HTMLDetailsElement>('[data-module]').forEach(module => module.addEventListener('toggle',()=>{
  const toggle=document.querySelector<HTMLButtonElement>('[data-expand-modules]');
  if(toggle)toggle.textContent=[...document.querySelectorAll<HTMLDetailsElement>('[data-module]')].every(item=>item.open)?'Collapse all':'Expand all';
}));
document.querySelector<HTMLButtonElement>('[data-copy-link]')?.addEventListener('click', async () => {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');
  try { await navigator.clipboard.writeText(location.href); if (status) status.textContent = 'Lesson link copied.'; }
  catch { if (status) status.textContent = 'Copy the address from your browser to share this lesson.'; }
});
const clock = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const presentationBackground = new Map<HTMLElement, boolean>();
let nativePresentationButton:HTMLButtonElement|null=null;
document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement&&nativePresentationButton){
    nativePresentationButton.textContent=nativePresentationButton.dataset.presentationLabel||'⛶ Fullscreen';
    nativePresentationButton=null;
  }
});
function leavePresentation() {
  document.querySelectorAll<HTMLElement>('.is-presenting').forEach(surface => surface.classList.remove('is-presenting'));
  document.querySelectorAll<HTMLButtonElement>('[data-presentation-label]').forEach(button => button.textContent = button.dataset.presentationLabel!);
  document.body.classList.remove('teaching-presenting');
  presentationBackground.forEach((inert,node) => node.inert = inert); presentationBackground.clear();
}
async function present(surface: HTMLElement, button: HTMLButtonElement) {
  if (document.fullscreenElement) { await document.exitFullscreen(); return; }
  if (surface.classList.contains('is-presenting')) { leavePresentation(); return; }
  try { await surface.requestFullscreen?.(); } catch { /* Embedded browsers can disallow native fullscreen. */ }
  if(document.fullscreenElement){
    nativePresentationButton=button;button.dataset.presentationLabel=button.textContent||'⛶ Fullscreen';button.textContent='✕ Exit fullscreen';
  }
  if (!document.fullscreenElement) {
    button.dataset.presentationLabel = button.textContent || '⛶ Fullscreen';
    surface.classList.add('is-presenting'); document.body.classList.add('teaching-presenting');
    for (let node: HTMLElement | null = surface; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement?.children || []) if (sibling !== node && sibling instanceof HTMLElement) {
        presentationBackground.set(sibling,sibling.inert); sibling.inert = true;
      }
    }
    button.textContent = '✕ Exit presentation';
  }
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') leavePresentation();
  if (event.key !== 'Tab') return;
  const surface = document.querySelector<HTMLElement>('.is-presenting'); if (!surface) return;
  const focusable = [...surface.querySelectorAll<HTMLElement | SVGElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex]')].filter(node => node.tabIndex >= 0 && node.getClientRects().length && !node.matches(':disabled'));
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
});
for (const container of document.querySelectorAll<HTMLElement>('[data-animation]')) {
  const video = container.querySelector<HTMLVideoElement>('[data-teaching-video]')!;
  const play = container.querySelector<HTMLButtonElement>('[data-video-play]')!;
  const seek = container.querySelector<HTMLInputElement>('[data-video-seek]')!;
  const currentTime = container.querySelector<HTMLElement>('[data-video-time]')!;
  const chapters = [...container.querySelectorAll<HTMLButtonElement>('[data-chapter-time]')];
  const times = chapters.map(item => Number(item.dataset.chapterTime));
  // Let the brief caption fade finish when a presenter pauses on a chapter.
  const chapterTargets = times.map(time => time === 0 ? 0 : time + Number(container.dataset.chapterOffset || 0));
  let pendingSeek: number | null = null;
  const sync = () => {
    play.textContent = video.paused ? '▶ Play' : 'Ⅱ Pause'; play.setAttribute('aria-label', video.paused ? 'Play animation' : 'Pause animation');
    seek.value = String(video.currentTime); currentTime.textContent = clock(video.currentTime);
    let index = 0; times.forEach((time, i) => { if (time <= video.currentTime + 0.05) index = i; });
    chapters.forEach((chapter, i) => { if (i === index) chapter.setAttribute('aria-current','step'); else chapter.removeAttribute('aria-current'); });
  };
  const jump = (time: number) => {
    video.pause(); const target=Math.max(0,time);
    if(video.readyState===0){
      pendingSeek=target;
      if(video.preload!=='auto'){video.preload='auto';video.load();}
    }else{video.currentTime=target;pendingSeek=null;}
    sync();
  };
  video.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){video.currentTime=pendingSeek;pendingSeek=null;}sync();});
  play.addEventListener('click', () => { if (video.paused) void video.play().catch(() => { currentTime.textContent = 'Select Play to retry'; }); else video.pause(); });
  container.querySelector('[data-video-reset]')?.addEventListener('click', () => jump(0));
  container.querySelector('[data-video-prev]')?.addEventListener('click', () => jump([...chapterTargets].reverse().find(time => time < video.currentTime - 0.2) ?? 0));
  container.querySelector('[data-video-next]')?.addEventListener('click', () => jump(chapterTargets.find(time => time > video.currentTime + 0.2) ?? chapterTargets.at(-1) ?? 0));
  container.querySelector<HTMLSelectElement>('[data-video-speed]')?.addEventListener('change', event => { video.playbackRate = Number((event.target as HTMLSelectElement).value); });
  seek.addEventListener('input', () => jump(Number(seek.value)));
  chapters.forEach((chapter, index) => chapter.addEventListener('click', () => jump(chapterTargets[index])));
  for (const event of ['timeupdate', 'play', 'pause', 'loadedmetadata']) video.addEventListener(event, sync);
  container.querySelector<HTMLButtonElement>('[data-video-fullscreen]')?.addEventListener('click', event => { void present(container.querySelector<HTMLElement>('[data-fullscreen-surface]')!, event.currentTarget as HTMLButtonElement); });
  // Stop playback when a presenter leaves this page, including back-forward cache.
  window.addEventListener('pagehide', () => video.pause());
}

initGuitarLearning(present);
initParietalAttention(present);
initRepresentationalNeglect(present);
initSalienceSelection(present);
initStepIllustrations(present);
