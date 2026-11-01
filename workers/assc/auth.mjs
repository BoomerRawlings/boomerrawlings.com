const encoder = new TextEncoder();
export const SESSION_SECONDS = 8 * 60 * 60;
export const COOKIE_NAME = 'assc_session';
export const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export async function derive(answer, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(answer.trim().toUpperCase()), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name:'PBKDF2', salt:encoder.encode(salt), iterations:100000, hash:'SHA-256' }, key, 256));
}
export async function createAuthConfig(answer) {
  const salt = randomToken();
  return { salt, verifier: await derive(answer, salt) };
}
export async function validAnswer(answer, config) {
  if (!config?.salt || !/^[a-f0-9]{64}$/.test(config.verifier || '')) return false;
  const actual = await derive(answer, config.salt);
  let difference = actual.length ^ config.verifier.length;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ config.verifier.charCodeAt(i);
  return difference === 0;
}
export function cookieToken(request) {
  const tokens = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).filter(x => x.startsWith(`${COOKIE_NAME}=`));
  if (tokens.length !== 1) return null;
  const value = tokens[0].slice(COOKIE_NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function sessionCookie(token, secure, clear = false) {
  return `${COOKIE_NAME}=${clear ? '' : token}; Path=/ASSC; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

// Local adapter only. Production uses the persistent Durable Object implementation.
export class MemoryAuthStore {
  constructor({ now = Date.now } = {}) { this.now = now; this.sessions = new Map(); this.attempts = new Map(); }
  async attempt(key) {
    const now = this.now();
    for (const [id,value] of this.attempts) if (value.until <= now) this.attempts.delete(id);
    const global = this.attempts.get('global') || { count:0, until:now + 900000 };
    const local = this.attempts.get(key) || { count:0, until:now + 900000 };
    if (local.count >= 5 || global.count >= 30) return { allowed:false, retryAfter:Math.ceil((Math.max(local.until, global.until) - now) / 1000) };
    local.count++; global.count++;
    this.attempts.set(key, local); this.attempts.set('global', global);
    return { allowed:true };
  }
  async create(hash) {
    const now = this.now();
    for (const [id,expiry] of this.sessions) if (expiry <= now) this.sessions.delete(id);
    if (this.sessions.size >= 100) this.sessions.delete(this.sessions.keys().next().value);
    this.sessions.set(hash, now + SESSION_SECONDS * 1000);
  }
  async get(hash) { const expiry = this.sessions.get(hash); if (!expiry || expiry <= this.now()) { this.sessions.delete(hash); return false; } return true; }
  async revoke(hash) { this.sessions.delete(hash); }
}
