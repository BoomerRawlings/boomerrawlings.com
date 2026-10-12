/* A playful entrance, never authentication. All metadata remains public. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const screen = $('entry-screen');
  const prompt = $('entry-prompt');
  const form = $('entry-form');
  const input = $('entry-input');
  const feedback = $('entry-feedback');
  const sequence = $('entry-sequence');
  const workspace = $('atlas-workspace');
  const skip = $('skip-animation');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Set();
  const timers = new Map();
  let phase = 'idle';
  let cycle = 0;
  let attempts = 0;
  let wave;

  function animate(node, frames, options) {
    if (!node.animate) return Promise.resolve();
    const animation = node.animate(frames, { fill: 'both', ...options });
    running.add(animation);
    return animation.finished.catch(() => {});
  }
  function wait(ms) {
    return new Promise(resolve => {
      const timer = setTimeout(() => { timers.delete(timer); resolve(); }, ms);
      timers.set(timer, resolve);
    });
  }
  function clearMotion() {
    running.forEach(animation => animation.cancel());
    running.clear();
    timers.forEach((resolve, timer) => { clearTimeout(timer); resolve(); });
    timers.clear();
    wave?.remove();
    wave = null;
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
    document.body.classList.remove('entry-pending', 'entry-revealing');
    document.dispatchEvent(new CustomEvent('acf:enter', { bubbles: true }));
    $('search').focus({ preventScroll: true });
  }

  async function open() {
    if (phase !== 'idle') return;
    phase = 'opening';
    const activeCycle = ++cycle;
    const active = () => phase === 'opening' && cycle === activeCycle;
    feedback.textContent = 'Atlas. A whole world of connections. Opening the collection.';
    input.readOnly = true;
    $('entry-submit').disabled = true;
    prompt.inert = true;
    input.blur();
    if (reduced.matches || !sequence.animate) { finish(); return; }
    skip.hidden = false;
    // Keep the transition keyboard-operable without requiring anyone to wait.
    skip.focus({ preventScroll: true });
    sequence.hidden = false;
    const title = sequence.querySelector('.sequence-title');
    const subtitle = sequence.querySelector('.sequence-subtitle');
    const coordinate = sequence.querySelector('.sequence-coordinate');
    const compass = sequence.querySelector('.sequence-compass');
    animate(prompt, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 260, easing: 'ease-in' });
    animate(screen.querySelector('.entry-orbits'), [{ opacity: .28 }, { opacity: .55, transform: 'scale(1.06)' }], { duration: 1000, easing: 'ease-out' });
    animate(coordinate, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 220 });
    animate(subtitle, [{ opacity: 0, clipPath: 'inset(0 50%)', transform: 'translateY(6px)' }, { opacity: 1, clipPath: 'inset(0 0%)', transform: 'translateY(0)' }], { duration: 620, delay: 480, easing: 'cubic-bezier(.2,.7,.2,1)' });
    animate(compass, [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 580, delay: 550, easing: 'ease-out' });
    await Promise.all([...title.children].map((letter, i) => animate(letter, [
      { opacity: 0, transform: `translateY(${25 + i * 3}px) rotateX(-85deg) rotateY(${(2 - i) * 13}deg)` },
      { opacity: 1, transform: 'translateY(0) rotateX(0) rotateY(0)' }
    ], { duration: 700, delay: 210 + i * 85, easing: 'cubic-bezier(.16,.7,.2,1)' })));
    if (!active()) return;
    await wait(260);
    if (!active()) return;
    workspace.hidden = false;
    document.body.classList.add('entry-revealing');
    wave = document.createElement('div');
    wave.className = 'atlas-wave';
    wave.setAttribute('aria-hidden', 'true');
    document.body.append(wave);
    animate(wave, [{ transform: 'scale(0)', opacity: .9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 1200, easing: 'cubic-bezier(.14,.62,.3,1)' });
    animate(sequence, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 430, easing: 'ease-in' });
    await animate(workspace, [{ clipPath: 'circle(0 at 50% 48%)', opacity: .4 }, { clipPath: 'circle(150vmax at 50% 48%)', opacity: 1 }], { duration: 1100, easing: 'cubic-bezier(.14,.62,.3,1)' });
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
    sequence.hidden = true;
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
    document.body.classList.remove('entry-revealing');
    screen.scrollTop = 0;
    document.dispatchEvent(new CustomEvent('acf:exit', { bubbles: true }));
    input.focus({ preventScroll: true });
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
