// Runs before the entrance is parsed: the handoff contains only a short-lived timestamp.
(() => {
  try {
    const stored = sessionStorage.getItem('observatory:arrival');
    sessionStorage.removeItem('observatory:arrival');
    const at = JSON.parse(stored)?.at;
    const age = Date.now() - at;
    if (typeof at === 'number' && age >= 0 && age <= 5000
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('arriving');
    }
  } catch { /* Storage is optional; direct entrances remain usable. */ }
})();
