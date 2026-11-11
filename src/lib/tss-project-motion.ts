// Presentation only. The arrival marker contains a timestamp, never session data.
export const TSS_ARRIVAL_KEY = 'tss-project:arrival';

export function mountTssProjectDoor(link: HTMLAnchorElement, wipe: HTMLElement, browser: Window = window) {
  const reduced = browser.matchMedia('(prefers-reduced-motion: reduce)');
  let active = false, navigating = false, generation = 0;
  let animation: Animation | undefined;
  let deadline: number | undefined, watchdog: number | undefined;
  const clearMarker = () => { try { browser.sessionStorage.removeItem(TSS_ARRIVAL_KEY); } catch {} };
  const reset = (clear = true, focus = false) => {
    generation++; active = false; navigating = false;
    browser.clearTimeout(deadline); browser.clearTimeout(watchdog);
    animation?.cancel(); animation = undefined; wipe.hidden = true;
    link.removeAttribute('aria-busy');
    if (clear) clearMarker();
    if (focus) link.focus({ preventScroll: true });
  };
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const destination = new URL(link.href, browser.location.href);
    if (destination.origin !== browser.location.origin || destination.pathname !== '/work/tss-better-booking/' || destination.search || destination.hash) return;
    if (active) { event.preventDefault(); return; }
    if (reduced.matches || typeof wipe.animate !== 'function') { clearMarker(); return; }
    event.preventDefault(); reset(); active = true;
    const current = generation;
    wipe.hidden = false; link.setAttribute('aria-busy', 'true');
    const navigate = () => {
      if (!active || navigating || generation !== current) return;
      navigating = true; browser.clearTimeout(deadline);
      try { browser.sessionStorage.setItem(TSS_ARRIVAL_KEY, String(Date.now())); } catch {}
      watchdog = browser.setTimeout(() => reset(true, true), 2200);
      try { browser.location.assign(destination.href); } catch { reset(true, true); }
    };
    deadline = browser.setTimeout(navigate, 650);
    try {
      animation = wipe.animate([{ transform: 'translateX(-104%)' }, { transform: 'translateX(0)' }],
        { duration: 190, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' });
      void animation.finished.then(navigate, navigate);
    } catch { navigate(); }
  };
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && active && !navigating) { event.preventDefault(); reset(true, true); } };
  const hide = () => reset(false);
  const show = () => reset();
  const visibility = () => { if (browser.document.visibilityState === 'hidden' && active && !navigating) reset(); };
  const swap = (event: Event) => {
    if (!active || !navigating) return;
    const native = (event as Event & { viewTransition?: { skipTransition: () => void; ready?: Promise<void> } }).viewTransition;
    if (native) { void native.ready?.catch(() => {}); native.skipTransition(); }
  };
  const motion = () => { if (reduced.matches && active && !navigating) reset(true, true); };
  link.addEventListener('click', click);
  browser.addEventListener('keydown', escape); browser.addEventListener('pagehide', hide); browser.addEventListener('pageshow', show);
  browser.addEventListener('pageswap', swap);
  browser.document.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', motion);
  return () => {
    reset(); link.removeEventListener('click', click);
    browser.removeEventListener('keydown', escape); browser.removeEventListener('pagehide', hide); browser.removeEventListener('pageshow', show);
    browser.removeEventListener('pageswap', swap);
    browser.document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', motion);
  };
}

// The newest requested panel wins while the cover is moving; navigation semantics stay in the caller.
export function createTssPanelWipe(wipe: HTMLElement, browser: Window = window) {
  const reduced = browser.matchMedia('(prefers-reduced-motion: reduce)');
  let pending: { change: () => void; reverse: boolean } | undefined;
  let busy = false, generation = 0;
  let animation: Animation | undefined;
  let finishWait: (() => void) | undefined;
  const apply = () => { const next = pending; pending = undefined; next?.change(); };
  const settle = () => {
    generation++; busy = false; finishWait?.(); animation?.cancel(); animation = undefined;
    wipe.hidden = true; apply();
  };
  const move = (from: number, to: number, duration: number) => new Promise<void>(resolve => {
    let timer: number | undefined;
    const done = () => { browser.clearTimeout(timer); if (finishWait === done) finishWait = undefined; resolve(); };
    finishWait = done;
    timer = browser.setTimeout(done, duration + 180);
    try {
      const previous = animation;
      animation = wipe.animate([{ transform: `translateX(${from}%)` }, { transform: `translateX(${to}%)` }],
        { duration, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' });
      previous?.cancel();
      void animation.finished.then(done, done);
    } catch { done(); }
  });
  const run = async () => {
    busy = true;
    const current = generation;
    try {
      while (pending && current === generation) {
        const direction = pending.reverse ? -1 : 1;
        wipe.hidden = false;
        await move(-104 * direction, 0, 160);
        if (current !== generation) return;
        apply();
        await move(0, 104 * direction, 210);
        if (current !== generation) return;
        animation?.cancel(); animation = undefined; wipe.hidden = true;
      }
    } finally { if (current === generation) { busy = false; wipe.hidden = true; } }
  };
  const transition = (change: () => void, reverse = false) => {
    pending = { change, reverse };
    if (reduced.matches || browser.document.visibilityState === 'hidden' || typeof wipe.animate !== 'function') { settle(); return; }
    if (!busy) void run();
  };
  const motion = () => { if (reduced.matches) settle(); };
  const visibility = () => { if (browser.document.visibilityState === 'hidden') settle(); };
  reduced.addEventListener('change', motion); browser.addEventListener('pagehide', settle); browser.addEventListener('pageshow', settle);
  browser.document.addEventListener('visibilitychange', visibility);
  return { transition, destroy() {
    settle(); reduced.removeEventListener('change', motion); browser.removeEventListener('pagehide', settle); browser.removeEventListener('pageshow', settle);
    browser.document.removeEventListener('visibilitychange', visibility);
  } };
}
