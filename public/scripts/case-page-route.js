/** Normalize page addresses only. Asset names never enter the generated lookup. */
export function pageRouteKey(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')
    || /[?#\\\u0000-\u0020]/.test(pathname) || /%(?:2f|5c|00)/i.test(pathname)) return null;
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (/[?#\\\u0000-\u0020]/.test(decoded) || decoded.includes('//')
    || decoded.split('/').some(part => part === '.' || part === '..')) return null;
  let key = decoded.toLowerCase().replace(/\/index\.html$/, '/');
  // Direct standalone HTML pages keep their extension; directory pages get '/'.
  if (!key.endsWith('/') && !key.endsWith('.html')) key += '/';
  return key;
}

async function digestPath(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function resolvePageCase(location, manifest) {
  const key = pageRouteKey(location.pathname);
  if (!key || manifest?.version !== 1 || !manifest.routes) return null;
  const route = manifest.routes[await digestPath(key)];
  if (!route || !Array.isArray(route.upper)
    || route.upper.some(index => !Number.isInteger(index) || index < 0 || index >= key.length)) return null;
  const upper = new Set(route.upper);
  const canonical = route.target ?? [...key].map((letter, index) => upper.has(index) ? letter.toUpperCase() : letter).join('');
  // A missing canonical page must remain a 404, never a reload loop or open redirect.
  if (!pageRouteKey(canonical) || canonical.startsWith('//') || canonical === location.pathname) return null;
  return canonical + (location.search ?? '') + (location.hash ?? '');
}

export async function recoverPageCase({ location, document, fetch }) {
  const status = document.getElementById('route-status');
  try {
    const response = await fetch('/page-case-routes.json', { credentials: 'same-origin', cache: 'no-cache' });
    if (!response.ok) throw new Error('Route lookup unavailable');
    const target = await resolvePageCase(location, await response.json());
    if (target) {
      const link = document.getElementById('route-match');
      link.href = target;
      link.hidden = false;
      status.textContent = 'Opening the matching page…';
      location.replace(target);
      return true;
    }
  } catch { /* Keep a useful, stable 404 if the lookup or navigation fails. */ }
  status.textContent = 'This address does not match a page on this site.';
  return false;
}

if (typeof window !== 'undefined' && document.getElementById('route-status')) {
  void recoverPageCase({ location: window.location, document, fetch: window.fetch.bind(window) });
}
