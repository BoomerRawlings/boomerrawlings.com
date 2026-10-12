/* A playful entrance, never authentication. All metadata remains public. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const screen = $('entry-screen');
  const prompt = $('entry-prompt');
  const form = $('entry-form');
  const input = $('entry-input');
  const feedback = $('entry-feedback');
  const workspace = $('atlas-workspace');
  const skip = $('skip-animation');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  let phase = 'idle';
  let cycle = 0;
  let attempts = 0;

  function animate(node, frames, options) {
    if (!node.animate) return Promise.resolve();
    const animation = node.animate(frames, { fill: 'both', ...options });
    running.add(animation);
    return animation.finished.catch(() => {});
  }
  function clearMotion() {
    running.forEach(animation => animation.cancel());
    running.clear();
  }
  function finish() {
    if (phase !== 'opening') return;
    phase = 'open';
    cycle++;
    clearMotion();
    screen.hidden = true;
    screen.inert = true;
    workspace.hidden = false;
    workspace.inert = false;
    skip.hidden = true;
    document.body.classList.remove('entry-pending');
    document.dispatchEvent(new CustomEvent('acf:enter', { bubbles: true }));
    $('search').focus({ preventScroll: true });
  }

  async function open() {
    if (phase !== 'idle') return;
    phase = 'opening';
    const activeCycle = ++cycle;
    const active = () => phase === 'opening' && cycle === activeCycle;
    feedback.textContent = 'Atlas. Opening the collection.';
    input.readOnly = true;
    $('entry-submit').disabled = true;
    prompt.inert = true;
    input.blur();
    if (reduced.matches || !prompt.animate) { finish(); return; }
    skip.hidden = false;
    // Keep the transition keyboard-operable without requiring anyone to wait.
    skip.focus({ preventScroll: true });
    await animate(prompt, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
    if (active()) finish();
  }

  function returnToEntry() {
    if (phase !== 'open') return;
    cycle++;
    clearMotion();
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    workspace.hidden = true;
    workspace.inert = true;
    screen.hidden = false;
    screen.inert = false;
    skip.hidden = true;
    prompt.inert = false;
    input.readOnly = false;
    $('entry-submit').disabled = false;
    input.value = '';
    input.removeAttribute('aria-invalid');
    form.classList.remove('invalid');
    feedback.textContent = '';
    $('hint-copy').hidden = true;
    $('entry-hint').setAttribute('aria-expanded', 'false');
    $('entry-hint').innerHTML = 'A gentle hint <span aria-hidden="true">+</span>';
    attempts = 0;
    phase = 'idle';
    document.body.classList.add('entry-pending');
    screen.scrollTop = 0;
    document.dispatchEvent(new CustomEvent('acf:exit', { bubbles: true }));
    input.focus();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (phase !== 'idle') return;
    if (input.value.trim().toLocaleUpperCase('en-US') !== 'ATLAS') {
      attempts++;
      form.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      feedback.textContent = !input.value.trim()
        ? 'Try a five-letter answer. A hint is just below.'
        : attempts > 2
          ? 'A collection of maps is an atlas. Try ATLAS to explore.'
          : 'A good exploration starts with another path. Think of a book of maps.';
      input.focus({ preventScroll: true });
      input.select();
      return;
    }
    input.removeAttribute('aria-invalid');
    form.classList.remove('invalid');
    open().catch(finish);
  });
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    form.classList.remove('invalid');
    feedback.textContent = '';
  });
  input.addEventListener('keydown', event => {
    if (event.isComposing && event.key === 'Enter') event.preventDefault();
  });
  $('entry-hint').addEventListener('click', () => {
    const hint = $('hint-copy');
    hint.hidden = !hint.hidden;
    $('entry-hint').setAttribute('aria-expanded', String(!hint.hidden));
    $('entry-hint').innerHTML = `A gentle hint <span aria-hidden="true">${hint.hidden ? '+' : '−'}</span>`;
  });
  skip.addEventListener('click', finish);
  $('return-entry').addEventListener('click', returnToEntry);
  document.addEventListener('acf:exit-request', returnToEntry);
  // Interruptions resolve the reveal instead of leaving an invisible overlay.
  reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.addEventListener('resize', () => { if (phase === 'opening') finish(); });
})();
