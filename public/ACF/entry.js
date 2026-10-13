/* A playful entrance, never authentication. All metadata remains public. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('entry-screen'), prompt = $('entry-prompt'), form = $('entry-form');
  const input = $('entry-input'), feedback = $('entry-feedback'), sequence = $('entry-sequence');
  const letters = Array.from({ length: 5 }, (_, i) => $('atlas-letter-' + i));
  const stars = Array.from({ length: 5 }, (_, i) => $('entry-star-' + i));
  const workspace = $('atlas-workspace'), skip = $('skip-animation'), loading = $('entry-loading');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const neutralTitle = document.title;
  const running = new Set();
  let phase = 'idle', cycle = 0, attempts = 0, entered = false;

  function animate(node, frames, options) {
    if (!node?.animate) return Promise.resolve();
    const animation = node.animate(frames, { fill: 'both', ...options });
    running.add(animation);
    return animation.finished.catch(() => {});
  }
  function clearMotion() {
    running.forEach(animation => animation.cancel());
    running.clear();
  }
  function enter() {
    if (entered) return;
    entered = true;
    document.dispatchEvent(new CustomEvent('acf:enter', { bubbles: true }));
  }
  function finish() {
    if (!['opening', 'loading', 'revealing'].includes(phase)) return;
    phase = 'open'; cycle++;
    clearMotion();
    sequence.hidden = true; loading.hidden = true;
    screen.hidden = true; screen.inert = true;
    screen.removeAttribute('aria-busy');
    workspace.hidden = false; workspace.inert = false;
    skip.hidden = true;
    document.body.classList.remove('entry-pending');
    document.body.classList.remove('entry-revealing');
    enter();
    $('search').focus({ preventScroll: true });
  }
  async function reveal() {
    if (phase !== 'loading') return;
    if (reduced.matches || !screen.animate) { finish(); return; }
    phase = 'revealing';
    const activeCycle = cycle;
    loading.hidden = true;
    document.body.classList.add('entry-revealing');
    // The small, decorative field travels into the actual map viewport while
    // the already prepared universe settles beneath it. No data is fabricated.
    const word = $('entry-word').getBoundingClientRect(), map = $('network').getBoundingClientRect();
    const dx = map.width ? map.left + map.width / 2 - word.left - word.width / 2 : 0;
    const dy = map.height ? map.top + map.height / 2 - word.top - word.height / 2 : 0;
    const surfaces = [$('network'), $('graph-stage').querySelector('.atlas-gpu-points')].filter(Boolean);
    await Promise.all([
      animate(sequence, [{ opacity: 1, transform: 'translate(0, 0) scale(1)' }, { opacity: .65, offset: .45 }, { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(2.4)` }], { duration: 820, easing: 'cubic-bezier(.2,.65,.25,1)' }),
      animate(screen, [{ opacity: 1 }, { opacity: 1, offset: .12 }, { opacity: 0 }], { duration: 820, easing: 'ease-in-out' }),
      ...surfaces.map(surface => animate(surface, [{ opacity: .35, transform: 'scale(1.18)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 820, easing: 'cubic-bezier(.2,.65,.25,1)' })),
    ]);
    if (phase === 'revealing' && cycle === activeCycle) finish();
  }
  function prepare() {
    if (phase !== 'opening') return;
    // No data/index work runs during letter motion. Hold a still constellation
    // while the complete collection loads, then reveal the prepared map.
    clearMotion();
    phase = 'loading';
    prompt.hidden = true;
    workspace.hidden = false; workspace.inert = true;
    loading.hidden = false;
    screen.setAttribute('aria-busy', 'true');
    enter();
  }
  async function open() {
    if (phase !== 'idle') return;
    phase = 'opening';
    const activeCycle = ++cycle;
    document.title = 'The Atlas of Contested Futures';
    feedback.textContent = 'Opening the collection.';
    input.readOnly = true; $('entry-submit').disabled = true; prompt.inert = true;
    input.blur();
    if (reduced.matches || !prompt.animate) { finish(); return; }
    skip.hidden = false; skip.focus({ preventScroll: true }); sequence.hidden = false;
    const fade = animate(prompt, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' });
    const destinations = [[-.1, .15], [.05, -.75], [-.05, .3], [0, -.35], [.1, .5]];
    const flights = letters.map((letter, i) => {
      const delay = 160 + i * 85, duration = 1500 - delay;
      return animate(letter, [
        { offset: 0, easing: 'steps(1, end)', opacity: 0, transform: 'translate(0, 0) scale(1)' },
        { offset: .01, opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { offset: (650 - delay) / duration, opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { offset: (920 - delay) / duration, easing: 'cubic-bezier(.4,0,.2,1)', opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { offset: 1, opacity: 0, transform: `translate(${destinations[i][0]}em, ${destinations[i][1]}em) scale(.025)` },
      ], { duration, delay, easing: 'linear' });
    });
    const anchors = stars.map((star, i) => animate(star, [
      { opacity: 0, offset: 0 }, { opacity: 0, offset: .68 + i * .025 }, { opacity: 1, offset: 1 },
    ], { duration: 1500, easing: 'linear' }));
    const links = animate($('entry-links'), [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .72 }, { opacity: 1, offset: 1 }], { duration: 1500, easing: 'linear' });
    const field = animate($('entry-field'), [{ opacity: 0, offset: 0 }, { opacity: 0, offset: .78 }, { opacity: 1, offset: 1 }], { duration: 1500, easing: 'linear' });
    const cursor = animate($('entry-cursor'), [
      { opacity: 0, transform: 'translateX(0)' },
      { opacity: 1, transform: 'translateX(0)', offset: .16, easing: 'steps(5, end)' },
      { opacity: 1, transform: 'translateX(4em)', offset: .585 },
      { opacity: 1, transform: 'translateX(4em)', offset: .8 },
      { opacity: 0, transform: 'translateX(4em)' },
    ], { duration: 1000, easing: 'linear' });
    await Promise.all([fade, ...flights, ...anchors, links, field, cursor]);
    if (phase === 'opening' && cycle === activeCycle) prepare();
  }
  function returnToEntry() {
    if (phase !== 'open') return;
    cycle++; clearMotion();
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    workspace.hidden = true; workspace.inert = true;
    screen.hidden = false; screen.inert = false; screen.removeAttribute('aria-busy');
    sequence.hidden = true; loading.hidden = true; skip.hidden = true;
    prompt.hidden = false; prompt.inert = false;
    input.readOnly = false; $('entry-submit').disabled = false; input.value = '';
    input.removeAttribute('aria-invalid'); form.classList.remove('invalid'); feedback.textContent = '';
    attempts = 0; entered = false; phase = 'idle';
    document.title = neutralTitle;
    document.body.classList.add('entry-pending'); screen.scrollTop = 0;
    document.dispatchEvent(new CustomEvent('acf:exit', { bubbles: true }));
    input.focus();
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (phase !== 'idle') return;
    if (input.value.trim().toLocaleUpperCase('en-US') !== 'ATLAS') {
      attempts++; form.classList.add('invalid'); input.setAttribute('aria-invalid', 'true');
      feedback.textContent = !input.value.trim() ? 'Try a five-letter answer.' : attempts > 2
        ? 'Think of a five-letter word for a collection of maps.'
        : 'A good exploration starts with another path. Think of a book of maps.';
      input.focus({ preventScroll: true }); input.select(); return;
    }
    input.removeAttribute('aria-invalid'); form.classList.remove('invalid'); open().catch(finish);
  });
  input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); form.classList.remove('invalid'); feedback.textContent = ''; });
  input.addEventListener('keydown', event => { if (event.isComposing && event.key === 'Enter') event.preventDefault(); });
  skip.addEventListener('click', finish);
  $('return-entry').addEventListener('click', returnToEntry);
  document.addEventListener('acf:exit-request', returnToEntry);
  document.addEventListener('acf:ready', () => reveal().catch(finish));
  document.addEventListener('acf:load-error', finish);
  reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.addEventListener('resize', finish);
})();
