// A local departure only: no catalog data, session marker, or prefetch crosses origins.
export function mountRaceDeparture(link, overlay, status, browser = window, isPaused = () => false) {
  const field = overlay?.querySelector('[data-race-field]');
  const lane = overlay?.querySelector('[data-race-lane]');
  const marker = overlay?.querySelector('[data-race-marker]');
  if (!link || !field || !lane || !marker) return { cancel() {}, dispose() {} };
  const reduced = browser.matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;

  function cancel(restoreFocus = false) {
    const previous = active;
    active = null;
    if (!previous) return;
    browser.clearTimeout(previous.deadline);
    browser.clearTimeout(previous.watchdog);
    for (const animation of previous.animations) animation.cancel();
    overlay.hidden = true;
    link.removeAttribute('aria-busy');
    if (status) status.textContent = '';
    if (restoreFocus) link.focus({ preventScroll: true });
  }

  function click(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    if (active) { event.preventDefault(); return; }
    if (link.href !== 'https://ucsdcannonball.com/' || reduced.matches || isPaused()
      || [field, lane, marker].some(part => typeof part.animate !== 'function')) return;
    event.preventDefault();
    const current = { href: link.href, animations: [], navigating: false };
    active = current;
    overlay.hidden = false;
    link.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Opening Cannonball. Press Escape to stay here.';

    const navigate = () => {
      if (active !== current || current.navigating) return;
      if (link.href !== current.href || browser.document.visibilityState === 'hidden' || reduced.matches || isPaused()) {
        cancel(); return;
      }
      current.navigating = true;
      browser.clearTimeout(current.deadline);
      current.watchdog = browser.setTimeout(() => cancel(true), 2200);
      try { browser.location.assign(current.href); } catch { cancel(true); }
    };
    current.deadline = browser.setTimeout(navigate, 760);
    try {
      const options = { duration: 620, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' };
      current.animations.push(field.animate([
        { clipPath: 'inset(46% 100% 46% 0)', offset: 0 },
        { clipPath: 'inset(46% 0 46% 0)', offset: .38 },
        { clipPath: 'inset(0)', offset: 1 },
      ], options));
      current.animations.push(lane.animate([
        { transform: 'translateX(-105%) skewX(-16deg)', opacity: 0, offset: 0 },
        { transform: 'translateX(-30%) skewX(-16deg)', opacity: 1, offset: .35 },
        { transform: 'translateX(0) skewX(-16deg)', opacity: 1, offset: 1 },
      ], options));
      current.animations.push(marker.animate([
        { transform: 'translateX(-12vw)', opacity: 0, offset: 0 },
        { transform: 'translateX(0)', opacity: 1, offset: .2 },
        { transform: 'translateX(90vw)', opacity: 1, offset: .85 },
        { transform: 'translateX(110vw)', opacity: 0, offset: 1 },
      ], options));
      void Promise.all(current.animations.map(animation => animation.finished)).then(navigate, navigate);
    } catch {
      for (const animation of current.animations) void animation.finished.catch(() => {});
      navigate();
    }
  }

  const keydown = event => { if (event.key === 'Escape' && active && !active.navigating) { event.preventDefault(); cancel(true); } };
  const reset = () => cancel();
  const visibility = () => { if (browser.document.visibilityState === 'hidden') cancel(); };
  const motion = () => { if (reduced.matches) cancel(true); };
  link.addEventListener('click', click);
  browser.addEventListener('keydown', keydown);
  browser.addEventListener('pagehide', reset);
  browser.addEventListener('pageshow', reset);
  browser.document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', motion);
  return { cancel, dispose() {
    cancel();
    link.removeEventListener('click', click);
    browser.removeEventListener('keydown', keydown);
    browser.removeEventListener('pagehide', reset);
    browser.removeEventListener('pageshow', reset);
    browser.document.removeEventListener('visibilitychange', visibility);
    reduced.removeEventListener('change', motion);
  } };
}
