/* This classic head script must capture pagereveal before the first render. */
(() => {
  const hasPageReveal = 'onpagereveal' in window;
  let incoming = hasPageReveal ? 'pending' : 'fallback';
  let suspended = false;
  let entered = false;

  function reveal() {
    if (suspended || entered || incoming !== 'fallback' || document.readyState === 'loading') return;
    const main = document.querySelector('#main');
    if (!main || !window.SiteMotion) return;
    entered = true;
    window.SiteMotion.revealScreen(main, { kind: 'portfolio' });
  }

  // Retry the initial reveal once parsing and deferred helpers are ready.
  const schedule = () => queueMicrotask(reveal);
  window.addEventListener('pagereveal', event => {
    suspended = false;
    incoming = event.viewTransition ? 'native' : 'fallback';
    schedule();
  });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  window.addEventListener('pagehide', () => {
    suspended = true;
    entered = false;
    incoming = hasPageReveal ? 'pending' : 'fallback';
  });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    suspended = false;
    // A task waits through microtask checkpoints between pageshow listeners.
    if (!hasPageReveal) setTimeout(reveal, 0);
  });
  if (document.readyState !== 'loading') schedule();
})();
