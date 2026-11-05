import { timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();
export const SESSION_SECONDS = 8 * 60 * 60;
export const COOKIE_NAME = 'observatory_session';
export const HASH = /^[a-f0-9]{64}$/;
const ITERATIONS = 100000;
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
export const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' }, key, 256));
}
export async function createAuthConfig(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Use a password between 12 and 128 characters.');
  const salt = randomToken();
  return { version: 1, salt, verifier: await derive(password, salt) };
}
export function configuredAuth(value) {
  try {
    if (typeof value !== 'string' || value.length > 1024) return null;
    const parsed = JSON.parse(value);
    return parsed?.version === 1 && HASH.test(parsed.salt) && HASH.test(parsed.verifier)
      ? { version: 1, salt: parsed.salt, verifier: parsed.verifier } : null;
  } catch { return null; }
}
export async function validPassword(password, config) {
  if (!config || !HASH.test(config.salt) || !HASH.test(config.verifier)) return false;
  return timingSafeEqual(encoder.encode(await derive(password, config.salt)), encoder.encode(config.verifier));
}
export function cookieToken(request) {
  const tokens = (request.headers.get('cookie') || '').split(';').map(item => item.trim()).filter(item => item.startsWith(`${COOKIE_NAME}=`));
  if (tokens.length !== 1) return null;
  const token = tokens[0].slice(COOKIE_NAME.length + 1);
  return HASH.test(token) ? token : null;
}
export function sessionCookie(token, secure, clear = false) {
  return `${COOKIE_NAME}=${clear ? '' : token}; Path=/observatory/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${secure ? '; Secure' : ''}`;
}

// Loopback preview and deterministic tests only. Production uses persistent SQLite.
export class MemoryAuthStore {
  constructor({ now = Date.now } = {}) { this.now = now; this.sessions = new Map(); this.attempts = []; }
  async attempt(key) {
    const now = this.now();
    this.attempts = this.attempts.filter(item => item.expires > now);
    const local = this.attempts.filter(item => item.key === key);
    if (local.length >= 5 || this.attempts.length >= 30) {
      const until = Math.max(local.length >= 5 ? local[0].expires : 0, this.attempts.length >= 30 ? this.attempts[0].expires : 0);
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((until - now) / 1000)) };
    }
    this.attempts.push({ key, expires: now + 900000 });
    return { allowed: true };
  }
  async create(hash) {
    const now = this.now();
    for (const [key, expires] of this.sessions) if (expires <= now) this.sessions.delete(key);
    if (this.sessions.has(hash)) return;
    if (this.sessions.size >= 100) this.sessions.delete(this.sessions.keys().next().value);
    this.sessions.set(hash, now + SESSION_SECONDS * 1000);
  }
  async get(hash) {
    const expires = this.sessions.get(hash);
    if (!expires || expires <= this.now()) { this.sessions.delete(hash); return false; }
    return true;
  }
  async revoke(hash) { this.sessions.delete(hash); }
}
