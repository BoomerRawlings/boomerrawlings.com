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
  let cancelFrameWait, transfer;

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
    transfer?.remove(); transfer = null;
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
    // the ready field, not the controls above it, receives the constellation.
    const controls = $('territory-comparison')?.getBoundingClientRect().height || 0;
    main.scrollTop = Math.max(0, main.scrollTop + field.top - frame.top - controls);
  }
  async function reveal() {
    if (phase !== 'loading') return;
    revealMapViewport();
    if (reduced.matches || !screen.animate) { finish(); return; }
    phase = 'revealing';
    const activeCycle = cycle;
    const playTransfer = prepareTransfer();
    const sharedStart = await freshRevealFrame();
    if (phase !== 'revealing' || cycle !== activeCycle) return;
    loading.hidden = true;
    document.body.classList.add('entry-revealing');
    transfer.removeAttribute('hidden');
    await playTransfer(sharedStart);
    if (phase === 'revealing' && cycle === activeCycle) finish();
  }

  function prepareTransfer() {
    const word = $('entry-word').getBoundingClientRect(), map = $('network').getBoundingClientRect();
    const viewport = screen.getBoundingClientRect(), width = viewport.width, height = viewport.height;
    const origins = [...stars, ...satellites.flatMap(group => [...group.children])].map(node => ({
      x: word.left + Number(node.getAttribute('cx')) / 400 * word.width,
      y: word.top + Number(node.getAttribute('cy')) / 250 * word.height,
    }));
    const detail = { points: [] };
    document.dispatchEvent(new CustomEvent('acf:entry-targets', { detail }));
    const pool = detail.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)).slice(0, 60).map(point => ({ ...point, x: map.left + point.x, y: map.top + point.y }));
    const destinations = [];
    for (const [u, v] of [[.14, .53], [.31, .24], [.49, .62], [.7, .34], [.86, .67]]) {
      if (!pool.length) break;
      const target = { x: map.left + map.width * u, y: map.top + map.height * v };
      pool.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
      destinations.push(pool.shift());
    }
    destinations.push(...pool);
    const duration = destinations.length ? 3200 : 1100;
    const svg = (tag, attributes = {}) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      return node;
    };
    transfer = svg('svg', { id: 'entry-transfer', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' });
    transfer.setAttribute('hidden', '');
    const defs = svg('defs'), mask = svg('mask', { id: 'entry-apertures', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height });
    const feather = svg('radialGradient', { id: 'entry-feather' });
    feather.append(svg('stop', { offset: '0', 'stop-color': 'black' }), svg('stop', { offset: '.38', 'stop-color': 'black' }), svg('stop', { offset: '1', 'stop-color': 'black', 'stop-opacity': '0' }));
    defs.append(feather);
    mask.append(svg('rect', { x: 0, y: 0, width, height, fill: 'white' }));
    defs.append(mask); transfer.append(defs);
    transfer.append(svg('rect', { x: 0, y: 0, width, height, fill: '#10111f', mask: 'url(#entry-apertures)' }));
    const tracings = svg('g', { class: 'entry-transfer-tracings' }), points = svg('g', { class: 'entry-transfer-points' });
    transfer.append(tracings, points); screen.prepend(transfer);
    const tracks = [];
    const plan = (node, frames, options) => tracks.push({ node, frames, options });
    plan(sequence, [{ opacity: 1 }, { opacity: 0 }], { duration: 560, easing: 'ease-out' });
    const transform = (point, scale = 1) => `translate(${point.x}px, ${point.y}px) scale(${scale})`;
    // Five growing windows follow the original five stars. The real field
    // stays at its final scale throughout: no zoomed bitmap or scene crossfade.
    for (let i = 0; i < 5; i++) {
      const origin = origins[i], destination = destinations[i] || origin;
      const aperture = svg('circle', { id: 'entry-aperture-' + i, cx: 0, cy: 0, r: 1, fill: 'url(#entry-feather)' });
      mask.append(aperture);
      const reach = Math.hypot(width, height) * 3;
      plan(aperture, [
        { offset: 0, transform: transform(origin, .01) },
        { offset: .16, transform: transform(origin, 2) },
        { offset: .51, transform: transform(destination, reach * .11) },
        { offset: 1, transform: transform(destination, reach) },
      ], { duration, easing: 'cubic-bezier(.48,0,.2,1)' });
    }
    destinations.forEach((destination, i) => {
      const origin = origins[i % origins.length], delay = i < 5 ? i * 50 : 180 + (i % 9) * 65;
      const span = duration - delay, arrival = i < 5 ? .56 : .68;
      const bend = { x: origin.x + (destination.x - origin.x) * .58, y: origin.y + (destination.y - origin.y) * .25 };
      const radius = Math.max(.7, Math.min(2.5, destination.radius || 1));
      const point = svg('circle', { id: 'entry-transfer-star-' + i, cx: 0, cy: 0, r: radius, fill: destination.color || '#c6dff1', 'data-record-id': destination.id });
      points.append(point);
      plan(point, [
        { offset: 0, opacity: i < 5 ? 1 : .55, transform: transform(origin, i < 5 ? 2.5 * word.width / 400 / radius : 1) },
        { offset: arrival * .42, opacity: 1, transform: transform(bend) },
        { offset: arrival, opacity: 1, transform: transform(destination) },
        { offset: .91, opacity: .65, transform: transform(destination) },
        { offset: 1, opacity: 0, transform: transform(destination) },
      ], { delay, duration: span, easing: 'cubic-bezier(.22,.65,.3,1)' });
      if (i < 18) {
        const path = svg('path', { id: 'entry-transfer-route-' + i, d: `M${origin.x} ${origin.y} L${bend.x} ${bend.y} L${destination.x} ${destination.y}`, pathLength: 1000, stroke: i % 4 === 0 ? '#d6ac7f' : '#90c2d1' });
        tracings.append(path);
        plan(path, [
          { offset: 0, strokeDashoffset: '1000', opacity: 0 },
          { offset: .18, opacity: .3 },
          { offset: arrival, strokeDashoffset: '0', opacity: .28 },
          { offset: 1, strokeDashoffset: '-1000', opacity: 0 },
        ], { delay, duration: span, easing: 'ease-in-out' });
      }
    });
    return sharedStart => Promise.all(tracks.map(track => animate(track.node, track.frames, track.options, sharedStart)));
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
