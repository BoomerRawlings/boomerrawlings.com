import { createTssPanelWipe } from '../lib/tss-project-motion';

const workflow = document.querySelector<HTMLElement>('[data-workflow]');
if (workflow) {
  const tabs = [...workflow.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const panels = [...workflow.querySelectorAll<HTMLElement>('[data-workflow-panel]')];
  const navigation = workflow.querySelector<HTMLElement>('[data-workflow-tabs]');
  const status = workflow.querySelector<HTMLElement>('[data-workflow-status]');
  const panelRegion = workflow.querySelector<HTMLElement>('.workflow-panels');
  const wipe = workflow.querySelector<HTMLElement>('[data-workflow-wipe]');
  const transition = wipe ? createTssPanelWipe(wipe) : null;
  let selected = 0;
  let initialized = false;
  const select = (index: number, focus = false) => {
    if (!panels[index] || !tabs[index]) return;
    if (initialized && selected === index) { if (focus) tabs[index].focus(); return; }
    const reverse = index < selected;
    selected = index;
    tabs.forEach((tab, current) => { tab.setAttribute('aria-selected', String(current === index)); tab.tabIndex = current === index ? 0 : -1; });
    if (focus) tabs[index].focus();
    const commit = () => {
      panels.forEach((panel, current) => { panel.hidden = current !== index; });
      panelRegion?.removeAttribute('aria-busy');
      if (status) status.textContent = `Step ${index + 1} of ${tabs.length}: ${tabs[index].querySelector('strong')?.textContent || ''}`;
    };
    if (initialized && transition) { panelRegion?.setAttribute('aria-busy', 'true'); transition.transition(commit, reverse); } else commit();
    initialized = true;
  };
  if (navigation && tabs.length === panels.length && tabs.length) {
    navigation.hidden = false;
    navigation.setAttribute('role', 'tablist');
    navigation.setAttribute('aria-orientation', 'vertical');
    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panels[index].id);
      panels[index].setAttribute('role', 'tabpanel'); panels[index].setAttribute('aria-labelledby', tab.id); panels[index].tabIndex = 0;
      tab.addEventListener('click', () => select(index));
      tab.addEventListener('keydown', event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : ['ArrowDown', 'ArrowRight'].includes(event.key) ? (index + 1) % tabs.length
          : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? (index + tabs.length - 1) % tabs.length : -1;
        if (next >= 0) { event.preventDefault(); select(next, true); }
      });
    });
    workflow.querySelectorAll<HTMLButtonElement>('[data-workflow-next]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', () => select(Number(button.dataset.workflowNext), true));
    });
    workflow.dataset.enhanced = 'true'; select(0);
  }
}

// Enhance visible content only; missing JS/observer support never hides a section.
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const entrances = new Set<Animation>();
const stopEntrances = () => { entrances.forEach(animation => animation.cancel()); entrances.clear(); };
if (!motion.matches && typeof IntersectionObserver === 'function') {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (motion.matches || document.visibilityState === 'hidden' || typeof (entry.target as HTMLElement).animate !== 'function') continue;
      const animation = (entry.target as HTMLElement).animate([
        { opacity: .45, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      entrances.add(animation);
      void animation.finished.then(() => entrances.delete(animation), () => entrances.delete(animation));
    }
  }, { threshold: .08 });
  document.querySelectorAll('.hero-copy, .flow-preview, .project-principles, .flow-comparison, .plain-section, .workflow-section, .evidence-section, .limits-section, .setup-section').forEach(element => observer.observe(element));
  window.addEventListener('pagehide', () => { observer.disconnect(); stopEntrances(); });
  motion.addEventListener('change', () => { if (motion.matches) { observer.disconnect(); stopEntrances(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stopEntrances(); });
}
const prompt = document.querySelector<HTMLTextAreaElement>('#project-agent-prompt');
const copyButton = document.querySelector<HTMLButtonElement>('[data-copy-prompt]');
const copyStatus = document.querySelector<HTMLElement>('[data-copy-status]');
if (prompt && copyButton) {
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(prompt.value); if (copyStatus) copyStatus.textContent = 'Prompt copied.'; }
    catch { prompt.focus(); prompt.select(); if (copyStatus) copyStatus.textContent = 'Prompt selected. Copy it with your keyboard.'; }
  });
}
