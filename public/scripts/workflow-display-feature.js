/* Keep this external: the portfolio permits same-origin scripts, not inline JS. */
(() => {
  const copyButton = document.querySelector('#copy-workflow-prompt');
  const prompt = document.querySelector('#workflow-agent-prompt');
  const status = document.querySelector('#workflow-copy-status');
  if (!copyButton || !prompt || !status) return;
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(prompt.value);
      status.textContent = 'Prompt copied.';
    } catch {
      prompt.focus();
      prompt.select();
      status.textContent = 'Prompt selected. Copy it with your keyboard or selection menu.';
    }
  });
})();
