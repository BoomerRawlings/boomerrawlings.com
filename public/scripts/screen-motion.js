/* Incoming surfaces only. No routing, snapshots, storage, or navigation delays. */
(() => {
  if (window.SiteMotion) return;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const running = new Map();
  let suspended = false;
  const families = {
    portfolio: { duration: 240, from: { opacity: .35, translate: '0 10px' } },
    paper: { duration: 220, from: { opacity: .4, translate: '12px 3px' } },
    atlas: { duration: 260, from: { opacity: .5, scale: '.985' } },
    instrument: { duration: 200, from: { opacity: .4, translate: '0 8px', clipPath: 'inset(3% 0 0)' } },
    terminal: { duration: 220, from: { opacity: .5, clipPath: 'inset(0 0 18% 0)' } },
    panel: { duration: 180, from: { opacity: .5, translate: '8px 0' } },
  };

  function cancelScreen(element) {
    const animation = running.get(element);
    running.delete(element);
    animation?.cancel();
  }

  function cancelAll() {
    for (const element of running.keys()) cancelScreen(element);
  }

  function revealScreen(element, { kind = 'panel', direction = 1 } = {}) {
    if (!element) return null;
    cancelScreen(element);
    if (suspended || document.visibilityState === 'hidden' || media.matches || !element.isConnected || element.closest('[hidden], [inert]')
      || typeof element.animate !== 'function') return null;
    const family = families[kind] || families.panel;
    const from = { ...family.from };
    if (direction < 0 && from.translate) {
      const axes = from.translate.split(' ');
      const axis = parseFloat(axes[0]) === 0 ? 1 : 0;
      axes[axis] = `${-parseFloat(axes[axis])}px`;
      from.translate = axes.join(' ');
    }
    let animation;
    try {
      animation = element.animate([from, {
        opacity: 1,
        ...(from.translate ? { translate: '0 0' } : {}),
        ...(from.scale ? { scale: '1' } : {}),
        ...(from.clipPath ? { clipPath: 'inset(0)' } : {}),
      }], { duration: family.duration, easing: 'cubic-bezier(.2,.7,.2,1)' });
    } catch { return null; }
    running.set(element, animation);
    const release = () => {
      if (running.get(element) === animation) running.delete(element);
    };
    // A superseding render cancels immediately; it never queues or blocks an action.
    animation.finished.then(release, release);
    return animation;
  }

  window.SiteMotion = Object.freeze({ revealScreen, cancelScreen, cancelAll });
  document.documentElement.dataset.siteMotionReady = 'true';
  media.addEventListener('change', () => { if (media.matches) cancelAll(); });
  window.addEventListener('pagehide', () => { suspended = true; cancelAll(); });
  window.addEventListener('pageshow', event => { suspended = false; if (event.persisted) cancelAll(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cancelAll(); });

  // Standalone documents opt in by naming their own surface in their own shell.
  // There is deliberately no public registry of routes or protected destinations.
  const script = document.querySelector('script[data-page-motion]');
  if (script?.dataset.pageMotion) {
    const enter = () => {
      try {
        revealScreen(document.querySelector(script.dataset.motionTarget || 'main'), { kind: script.dataset.pageMotion });
      } catch { /* A missing optional surface must not prevent native navigation. */ }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enter, { once: true });
    else enter();
  }
})();
