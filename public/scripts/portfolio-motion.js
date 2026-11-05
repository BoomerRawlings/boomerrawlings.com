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

  // Deferred helpers and all pageshow listeners finish before this attempt.
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
    if (!hasPageReveal) schedule();
  });
  if (document.readyState !== 'loading') schedule();
})();
