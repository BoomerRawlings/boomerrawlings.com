// Only a short-lived entrance timestamp crosses the public page boundary.
// No destination, password, or authenticated content is prefetched or stored.
export const ARRIVAL_KEY = 'observatory:arrival';

export function mountObservatoryDoor(
  link: HTMLAnchorElement,
  overlay: HTMLElement,
  status: HTMLElement | null = null,
  browser: Window = window,
) {
  const field = overlay.querySelector<HTMLElement>('[data-transfer-field]');
  const rule = overlay.querySelector<HTMLElement>('[data-transfer-rule]');
  const register = overlay.querySelector<HTMLElement>('[data-transfer-register]');
  if (!field || !rule || !register) return () => {};

  const reduced = browser.matchMedia('(prefers-reduced-motion: reduce)');
  link.setAttribute('data-observatory-ready', 'true');
  let active = false;
  let navigating = false;
  let generation = 0;
  let deadline: number | undefined;
  let watchdog: number | undefined;
  let animations: Animation[] = [];

  function clearMarker() {
    try { browser.sessionStorage.removeItem(ARRIVAL_KEY); } catch { /* Storage may be disabled. */ }
  }
  function reset(removeMarker = true, restoreFocus = false) {
    generation++;
    active = false;
    navigating = false;
    browser.clearTimeout(deadline);
    browser.clearTimeout(watchdog);
    for (const animation of animations) animation.cancel();
    animations = [];
    overlay.hidden = true;
    link.removeAttribute('aria-busy');
    if (status) status.textContent = '';
    if (removeMarker) clearMarker();
    if (restoreFocus) link.focus({ preventScroll: true });
  }
  function click(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    if (active) { event.preventDefault(); return; }
    // Keep ordinary anchor navigation for reduced motion and unsupported browsers.
    if (reduced.matches || typeof field!.animate !== 'function') {
      clearMarker();
      if (status) status.textContent = 'Opening the Observatory.';
      return;
    }
    event.preventDefault();
    reset();
    active = true;
    const current = generation;
    const box = link.getBoundingClientRect();
    const width = browser.innerWidth;
    const height = browser.innerHeight;
    const x = Math.min(width, Math.max(0, box.left + box.width / 2));
    const y = Math.min(height, Math.max(0, box.top + box.height / 2));
    const inset = (top: number, right: number, bottom: number, left: number) =>
      `inset(${Math.max(0, top)}px ${Math.max(0, right)}px ${Math.max(0, bottom)}px ${Math.max(0, left)}px)`;
    overlay.hidden = false;
    link.setAttribute('aria-busy', 'true');
    if (status) status.textContent = 'Opening the Observatory. Press Escape to stay here.';

    const navigate = () => {
      if (!active || navigating || current !== generation) return;
      navigating = true;
      browser.clearTimeout(deadline);
      let destination = link.href;
      try { browser.sessionStorage.setItem(ARRIVAL_KEY, JSON.stringify({ at: Date.now() })); }
      catch {
        // This non-secret fragment is consumed before either entrance renders.
        const fallback = new URL(destination);
        fallback.hash = 'arrival';
        destination = fallback.href;
      }
      // A cancelled navigation or offline browser must not trap the homepage.
      watchdog = browser.setTimeout(() => reset(true, true), 2200);
      try { browser.location.assign(destination); } catch { reset(true, true); }
    };
    deadline = browser.setTimeout(navigate, 800);
    try {
      const options: KeyframeAnimationOptions = { duration: 640, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' };
      animations = [
        field!.animate([
          { clipPath: inset(y - 22, width - x - 22, height - y - 22, x - 22), offset: 0 },
          { clipPath: inset(y - 1, 0, height - y - 1, 0), offset: .34 },
          { clipPath: 'inset(0px 0px 0px 0px)', offset: .88 },
          { clipPath: 'inset(0px 0px 0px 0px)', offset: 1 },
        ], options),
        rule!.animate([
          { left: `${x - 11}px`, top: `${y}px`, width: '22px', opacity: 1, offset: 0 },
          { left: '0px', top: `${y}px`, width: '100%', opacity: 1, offset: .34 },
          { left: '0px', top: '50%', width: '100%', opacity: 1, offset: 1 },
        ], options),
        register!.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: .7 }, { opacity: 1, offset: 1 }], options),
      ];
      void Promise.all(animations.map(animation => animation.finished)).then(navigate, () => {
        if (active && current === generation) navigate();
      });
    } catch { navigate(); }
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && active && !navigating) { event.preventDefault(); reset(true, true); }
  };
  const pagehide = () => reset(false);
  const pageshow = () => reset();
  const visibility = () => { if (browser.document.visibilityState === 'hidden' && active && !navigating) reset(); };
  const motionChange = () => { if (reduced.matches && active && !navigating) reset(true, true); };
  link.addEventListener('click', click);
  browser.addEventListener('keydown', keydown);
  browser.addEventListener('pagehide', pagehide);
  browser.addEventListener('pageshow', pageshow);
  browser.document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', motionChange);
  return () => {
    reset();
    link.removeAttribute('data-observatory-ready');
    link.removeEventListener('click', click);
    browser.removeEventListener('keydown', keydown);
    browser.removeEventListener('pagehide', pagehide);
    browser.removeEventListener('pageshow', pageshow);
    browser.document.removeEventListener('visibilitychange', visibility);
    reduced.removeEventListener('change', motionChange);
  };
}
