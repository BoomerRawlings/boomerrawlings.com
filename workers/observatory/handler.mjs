import { cookieToken, digest, randomToken, sessionCookie, validPassword } from './auth.mjs';

const ENTRY_FILES = new Set(['gate.css', 'gate.js', 'arrival.js', 'theme.css', 'font-source-sans.woff2', 'font-teko.woff2']);
const PRIVATE_FILES = new Set(['app.html', 'app.css', 'app.js', 'departure.js', 'symbols.js', 'symbols.css']);
export const securityHeaders = {
  'Cache-Control': 'no-store, private, max-age=0',
  'Pragma': 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, noimageindex',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
const notFound = () => new Response('Not found', { status: 404 });
async function boundedBody(request) {
  if (Number(request.headers.get('content-length')) > 1024) throw new Error('Body too large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  let bytes = 0;
  const pieces = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 1024) { await reader.cancel(); throw new Error('Body too large'); }
    pieces.push(value);
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const piece of pieces) { data.set(piece, offset); offset += piece.byteLength; }
  return new TextDecoder().decode(data);
}

export function createHandler({ read, store, authConfig, catalog, origin, secure = true, clientAddress = () => 'loopback', revision = 'local' }) {
  async function process(request) {
    const url = new URL(request.url);
    if (url.origin !== origin) return json({ error: 'Invalid host.' }, 421);
    if (url.pathname !== '/observatory' && !url.pathname.startsWith('/observatory/')) return notFound();
    if (/%|\\/.test(url.pathname)) return notFound();
    if (!['GET', 'HEAD', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
    if (request.method === 'POST' && (request.headers.get('origin') !== origin || (request.headers.get('sec-fetch-site') && !['same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))))) return json({ error: 'Request refused.' }, 403);
    if (url.pathname === '/observatory') return request.method === 'POST' ? notFound() : new Response(null, { status: 308, headers: { Location: '/observatory/' } });
    const path = url.pathname.slice('/observatory/'.length);
    if (path === 'api/login' && request.method === 'POST') {
      if (!authConfig || !catalog) return json({ error: 'The observatory is not configured yet.' }, 503);
      const limit = await store.attempt(await digest(clientAddress(request)));
      if (!limit.allowed) return json({ error: 'Please wait before trying again.', retryAfter: limit.retryAfter }, 429, { 'Retry-After': String(limit.retryAfter) });
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Send a JSON request.' }, 415);
      let password;
      try { password = JSON.parse(await boundedBody(request)).password; }
      catch { return json({ error: 'Invalid request.' }, 400); }
      if (typeof password !== 'string' || password.length > 128 || !await validPassword(password, authConfig)) return json({ error: 'That answer does not open this door.' }, 401);
      const prior = cookieToken(request);
      if (prior) await store.revoke(await digest(prior));
      const token = randomToken();
      await store.create(await digest(token));
      return json({ ok: true, redirect: '/observatory/' }, 200, { 'Set-Cookie': sessionCookie(token, secure) });
    }
    const token = cookieToken(request);
    if (path === 'api/logout' && request.method === 'POST') {
      if (token) await store.revoke(await digest(token));
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', secure, true) });
    }
    if (request.method === 'POST') return notFound();
    if (ENTRY_FILES.has(path)) return read(`client/${path}`);
    const authenticated = Boolean(authConfig && catalog && token && await store.get(await digest(token)));
    if (path === '') {
      const result = await read(authenticated ? 'client/app.html' : 'client/gate.html');
      const headers = new Headers(result.headers);
      if (token && !authenticated) headers.set('Set-Cookie', sessionCookie('', secure, true));
      return new Response(result.body, { status: result.status, headers });
    }
    if (!authenticated) return json({ error: 'Enter the password to continue.' }, 401, token ? { 'Set-Cookie': sessionCookie('', secure, true) } : {});
    if (path === 'api/catalog') return json(catalog);
    if (path === 'api/session') return json({ authenticated: true, revision });
    if (PRIVATE_FILES.has(path)) return read(`client/${path}`);
    return notFound();
  }
  return async request => {
    let result;
    try { result = await process(request); }
    catch { result = json({ error: 'The observatory is temporarily unavailable.' }, 503); }
    const headers = new Headers(result.headers);
    for (const [key, value] of Object.entries(securityHeaders)) headers.set(key, value);
    headers.set('Vary', 'Cookie');
    headers.delete('ETag');
    headers.delete('Last-Modified');
    if (secure) headers.set('Strict-Transport-Security', 'max-age=31536000');
    return new Response(request.method === 'HEAD' ? null : result.body, { status: result.status, headers });
  };
}
