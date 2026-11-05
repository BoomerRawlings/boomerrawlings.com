// Blocking head bootstrap, shared by both the locked entrance and the open index.
// A handoff carries no private data: only a short-lived timestamp or a one-use fragment.
(() => {
  let fromStorage = false;
  try {
    const stored = sessionStorage.getItem('observatory:arrival');
    sessionStorage.removeItem('observatory:arrival');
    const at = JSON.parse(stored)?.at;
    const age = Date.now() - at;
    fromStorage = typeof at === 'number' && Number.isFinite(at) && age >= 0 && age <= 5000;
  } catch { /* A marker that cannot be consumed must not replay. */ }

  let fromFragment = false;
  if (location.hash === '#arrival') {
    try {
      history.replaceState(history.state, '', location.pathname + location.search);
      fromFragment = true;
    } catch { /* An unconsumable fragment leaves an ordinary, usable entrance. */ }
  }
  const root = document.documentElement;
  let media;
  try { media = window.matchMedia('(prefers-reduced-motion: reduce)'); }
  catch { return; }
  if ((!fromStorage && !fromFragment) || media.matches) return;

  let timer;
  const clear = () => {
    root.classList.remove('arriving');
    window.clearTimeout(timer);
  };
  root.classList.add('arriving');
  // Set in the head, so failed modules, slow fonts or missing animation events
  // cannot hold either page behind the decorative arrival layer.
  timer = window.setTimeout(clear, 650);
  document.addEventListener('animationend', event => {
    if (event.target?.id === 'arrival-screen' && event.animationName === 'observatory-arrival-open') clear();
  });
  media.addEventListener('change', () => { if (media.matches) clear(); });
  window.addEventListener('pagehide', clear);
  window.addEventListener('pageshow', event => { if (event.persisted) clear(); });
})();
