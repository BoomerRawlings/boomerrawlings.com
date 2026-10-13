/* A playful entrance, never authentication. All metadata remains public. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('entry-screen'), prompt = $('entry-prompt'), form = $('entry-form');
  const input = $('entry-input'), feedback = $('entry-feedback'), sequence = $('entry-sequence');
  const letters = Array.from({ length: 5 }, (_, i) => $('atlas-letter-' + i));
  const stars = Array.from({ length: 5 }, (_, i) => $('entry-star-' + i));
  const routes = Array.from({ length: 6 }, (_, i) => $('entry-route-' + i));
  const branches = Array.from({ length: 8 }, (_, i) => $('entry-branch-' + i));
  const satellites = Array.from({ length: 3 }, (_, i) => $('entry-satellites-' + i));
  const workspace = $('atlas-workspace'), skip = $('skip-animation'), loading = $('entry-loading');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const neutralTitle = document.title;
  const running = new Set();
  let phase = 'idle', cycle = 0, attempts = 0, entered = false;
  let cancelFrameWait;

  function animate(node, frames, options, sharedStart) {
    if (!node?.animate) return Promise.resolve();
    const animation = node.animate(frames, { fill: 'both', ...options });
    running.add(animation);
    const settled = animation.finished.catch(() => {});
    if (Number.isFinite(sharedStart)) {
      try { animation.startTime = sharedStart; } catch { /* Implicit timeline remains a safe fallback. */ }
    }
    return settled;
  }
  function clearMotion() {
    cancelFrameWait?.();
    running.forEach(animation => animation.cancel());
    running.clear();
  }
  function freshRevealFrame() {
    if (typeof requestAnimationFrame !== 'function') return Promise.resolve(undefined);
    return new Promise(resolve => {
      let frame, timeout, settled = false;
      const complete = timestamp => {
        if (settled) return;
        settled = true;
        if (frame !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
        clearTimeout(timeout); cancelFrameWait = null;
        resolve(timestamp);
      };
      cancelFrameWait = () => complete(undefined);
      // The document timeline can still point to the frame before expensive
      // catalog preparation. Wait for a fresh rendering tick, never reuse it.
      frame = requestAnimationFrame(() => complete(performance.now()));
      timeout = setTimeout(() => complete(undefined), 100);
    });
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
  function revealMapViewport() {
    if (document.body.dataset.view === 'list' || document.body.dataset.mapExpanded === 'true' || document.body.dataset.comparison === 'true' || !matchMedia('(max-width: 680px)').matches) return;
    const main = $('main'), stage = $('graph-stage');
    if (!main || !stage || main.scrollHeight <= main.clientHeight) return;
    const frame = main.getBoundingClientRect(), field = stage.getBoundingClientRect();
    if (!frame.height || !field.height) return;
    // Only the workspace scroller moves. Reserve the sticky subject picker so
    // the ready field, not the controls above it, receives the final retreat.
    const controls = $('territory-comparison')?.getBoundingClientRect().height || 0;
    main.scrollTop = Math.max(0, main.scrollTop + field.top - frame.top - controls);
  }
  async function reveal() {
    if (phase !== 'loading') return;
    revealMapViewport();
    if (reduced.matches || !screen.animate) { finish(); return; }
    phase = 'revealing';
    const activeCycle = cycle;
    const sharedStart = await freshRevealFrame();
    if (phase !== 'revealing' || cycle !== activeCycle) return;
    loading.hidden = true;
    document.body.classList.add('entry-revealing');
    // Both fields retreat toward the same viewport center. The decorative
    // constellation recedes while every prepared record becomes visible.
    const word = $('entry-word').getBoundingClientRect(), map = $('network').getBoundingClientRect();
    const dx = map.width ? map.left + map.width / 2 - word.left - word.width / 2 : 0;
    const dy = map.height ? map.top + map.height / 2 - word.top - word.height / 2 : 0;
    const surfaces = [$('network'), $('graph-stage').querySelector('.atlas-gpu-points')].filter(Boolean);
    const retreat = { duration: 2600, easing: 'cubic-bezier(.2,.55,.25,1)' };
    await Promise.all([
      animate(sequence, [
        { opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { opacity: .9, offset: .25 },
        { opacity: .42, offset: .7 },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.48)` },
      ], retreat, sharedStart),
      animate(screen, [{ opacity: 1 }, { opacity: 1, offset: .15 }, { opacity: .64, offset: .4 }, { opacity: 0 }], { duration: 2600, easing: 'ease-in-out' }, sharedStart),
      ...surfaces.map(surface => animate(surface, [
        { opacity: .25, transform: `translate(${-dx}px, ${-dy}px) scale(2.05)` },
        { opacity: .65, offset: .4 },
        { opacity: 1, transform: 'translate(0px, 0px) scale(1)' },
      ], retreat, sharedStart)),
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
    const fade = animate(prompt, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' });
    const caption = animate($('entry-caption'), [{ opacity: 0 }, { opacity: 1 }], { delay: 350, duration: 1250, easing: 'ease-in-out' });
    const destinations = [[-.1, .15], [.05, -.75], [-.05, .3], [0, -.35], [.1, .5]];
    const flights = letters.map((letter, i) => {
      const delay = 300 + i * 220, finishAt = 3020 + i * 35, duration = finishAt - delay;
      return animate(letter, [
        { offset: 0, easing: 'steps(1, end)', opacity: 0, transform: 'translate(0, 0) scale(1)' },
        { offset: .01, opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { offset: (2000 - delay) / duration, easing: 'cubic-bezier(.4,0,.2,1)', opacity: 1, transform: 'translate(0, 0) scale(1)' },
        { offset: (finishAt - 170 - delay) / duration, opacity: .36, transform: `translate(${destinations[i][0]}em, ${destinations[i][1]}em) scale(.09)` },
        { offset: 1, opacity: 0, transform: `translate(${destinations[i][0]}em, ${destinations[i][1]}em) scale(.025)` },
      ], { duration, delay, easing: 'linear' });
    });
    const anchors = stars.map((star, i) => animate(star, [
      { opacity: 0 }, { opacity: .45, offset: .55 }, { opacity: 1 },
    ], { delay: 2530 + i * 70, duration: 680, easing: 'ease-in-out' }));
    const links = animate($('entry-links'), [{ opacity: 0 }, { opacity: 1 }], { delay: 2980, duration: 450, easing: 'ease-out' });
    const tracings = routes.map((route, i) => animate(route, [
      { strokeDashoffset: '1000', opacity: .2 }, { strokeDashoffset: '0', opacity: 1 },
    ], { delay: i < 4 ? 2980 + i * 170 : 3770 + (i - 4) * 160, duration: i < 4 ? 920 : 990, easing: 'cubic-bezier(.3,.1,.25,1)' }));
    const field = animate($('entry-field'), [{ opacity: 0 }, { opacity: 1 }], { delay: 3400, duration: 1600, easing: 'linear' });
    const branching = branches.map((branch, i) => animate(branch, [
      { strokeDashoffset: '1000', opacity: 0 }, { opacity: .5, offset: .2 }, { strokeDashoffset: '0', opacity: 1 },
    ], { delay: 3500 + i * 100, duration: 800, easing: 'ease-in-out' }));
    const expanding = satellites.map((group, i) => animate(group, [
      { opacity: 0 }, { opacity: 1 },
    ], { delay: 3590 + i * 270, duration: 860, easing: 'ease-in-out' }));
    const cursor = animate($('entry-cursor'), [
      { opacity: 0, transform: 'translateX(.8em)', offset: 0 },
      { opacity: 1, transform: 'translateX(.8em)', offset: 300 / 2050, easing: 'steps(4, end)' },
      { opacity: 1, transform: 'translateX(4em)', offset: 1180 / 2050 },
      { opacity: .65, transform: 'translateX(4em)', offset: 1730 / 2050 },
      { opacity: 0, transform: 'translateX(4em)', offset: 1 },
    ], { duration: 2050, easing: 'linear' });
    await Promise.all([fade, caption, ...flights, ...anchors, links, ...tracings, field, ...branching, ...expanding, cursor]);
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
  document.addEventListener('acf:ready', () => { if (phase === 'open') revealMapViewport(); reveal().catch(finish); });
  document.addEventListener('acf:load-error', finish);
  reduced.addEventListener('change', () => { if (reduced.matches) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.addEventListener('resize', finish);
})();
