(() => {
  'use strict';
  const counter = document.getElementById('counter');
  const form = document.getElementById('entry-form');
  const input = document.getElementById('entry-input');
  const submit = document.getElementById('entry-submit');
  const feedback = document.getElementById('entry-feedback');
  const descent = document.getElementById('descent');
  const skip = document.getElementById('skip-dive');
  const workspace = document.getElementById('workspace');
  const heading = document.getElementById('archive-title');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let finishTimer;
  let stage = 'counter';

  function finishDive() {
    if (stage !== 'diving') return;
    clearTimeout(finishTimer);
    stage = 'archive';
    document.body.dataset.stage = stage;
    descent.hidden = true;
    counter.hidden = true;
    workspace.hidden = false;
    workspace.inert = false;
    document.title = 'SUBS — Submarine archive';
    document.querySelector('meta[name="theme-color"]').content = '#080f0d';
    window.scrollTo(0, 0);
    heading.focus({ preventScroll: true });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (stage !== 'counter') return;
    // A playful riddle, not authentication. No account or persisted access.
    if (input.value.trim().toLowerCase() !== 'submarine') {
      feedback.textContent = input.value.trim() ? 'Not quite. Think of the full name of a sub.' : 'One full name. What would you order?';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    feedback.textContent = 'Order received. Going below the surface.';
    stage = 'diving';
    submit.disabled = true;
    counter.inert = true;
    descent.hidden = false;
    document.body.dataset.stage = stage;
    window.scrollTo(0, 0);
    skip.focus({ preventScroll: true });
    if (motion.matches) finishDive();
    else finishTimer = window.setTimeout(finishDive, 3600);
  });
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    feedback.textContent = '';
  });
  skip.addEventListener('click', finishDive);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && stage === 'diving') finishDive();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishDive();
  });
  motion.addEventListener('change', () => { if (motion.matches) finishDive(); });
  document.getElementById('return-counter').addEventListener('click', () => {
    clearTimeout(finishTimer);
    stage = 'counter';
    workspace.hidden = true;
    workspace.inert = true;
    descent.hidden = true;
    counter.hidden = false;
    counter.inert = false;
    input.value = '';
    input.removeAttribute('aria-invalid');
    feedback.textContent = '';
    submit.disabled = false;
    document.body.dataset.stage = stage;
    document.title = 'SUBS — The secret menu';
    document.querySelector('meta[name="theme-color"]').content = '#087442';
    window.scrollTo(0, 0);
    input.focus({ preventScroll: true });
  });
})();
