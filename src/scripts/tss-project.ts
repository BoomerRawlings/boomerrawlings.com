const workflow = document.querySelector<HTMLElement>('[data-workflow]');
if (workflow) {
  const tabs = [...workflow.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const panels = [...workflow.querySelectorAll<HTMLElement>('[data-workflow-panel]')];
  const navigation = workflow.querySelector<HTMLElement>('[data-workflow-tabs]');
  const status = workflow.querySelector<HTMLElement>('[data-workflow-status]');
  const select = (index: number, focus = false) => {
    if (!panels[index] || !tabs[index]) return;
    tabs.forEach((tab, current) => { tab.setAttribute('aria-selected', String(current === index)); tab.tabIndex = current === index ? 0 : -1; });
    panels.forEach((panel, current) => { panel.hidden = current !== index; });
    if (focus) tabs[index].focus();
    if (status) status.textContent = `Step ${index + 1} of ${tabs.length}: ${tabs[index].querySelector('strong')?.textContent || ''}`;
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
