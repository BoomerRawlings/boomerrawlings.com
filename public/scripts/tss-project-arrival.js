// Runs before first paint. Only a short-lived presentation timestamp crosses pages.
(() => {
  try {
    const key = 'tss-project:arrival';
    const value = Number(sessionStorage.getItem(key));
    sessionStorage.removeItem(key);
    const age = Date.now() - value;
    const returning = performance.getEntriesByType('navigation')[0]?.type === 'back_forward';
    if (value && age >= 0 && age < 10000 && !returning && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.setAttribute('data-tss-arrival', '');
    }
  } catch { /* Storage-disabled visitors keep ordinary page entry. */ }
  addEventListener('pageshow', event => { if (event.persisted) document.documentElement.removeAttribute('data-tss-arrival'); });
})();
