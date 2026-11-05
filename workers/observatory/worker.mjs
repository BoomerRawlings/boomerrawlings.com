import { DurableObject } from 'cloudflare:workers';
import { SESSION_SECONDS, HASH, configuredAuth, digest } from './auth.mjs';
import { configuredCatalog } from './catalog.mjs';
import { createHandler, securityHeaders } from './handler.mjs';

const ORIGIN = 'https://boomerrawlings.com';
const WINDOW_MS = 15 * 60 * 1000;
const CLIENT_FILES = new Set(['gate.html', 'gate.css', 'gate.js', 'arrival.js', 'theme.css', 'font-source-sans.woff2', 'font-teko.woff2', 'app.html', 'app.css', 'app.js', 'departure.js', 'symbols.js', 'symbols.css']);

// One password scope is the coordination atom. This namespace never shares sessions
// with other applications. Only authentication state reaches this object.
export class ObservatoryAuthStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, ip_hash TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS attempts_expiry ON attempts(expires);
        CREATE INDEX IF NOT EXISTS attempts_ip ON attempts(ip_hash, expires);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, created INTEGER NOT NULL, expires INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
      `);
    });
  }
  #validate(hash) {
    if (typeof hash !== 'string' || !HASH.test(hash)) throw new TypeError('Invalid authentication key');
  }
  #cleanup(now) {
    this.ctx.storage.sql.exec('DELETE FROM attempts WHERE expires <= ?', now);
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE expires <= ?', now);
  }
  async #schedule() {
    const next = this.ctx.storage.sql.exec(`
      SELECT MIN(expires) AS next FROM (
        SELECT MIN(expires) AS expires FROM attempts
        UNION ALL SELECT MIN(expires) AS expires FROM sessions
      )
    `).one().next;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(Date.now() + 1, next));
  }
  async attempt(ipHash) {
    this.#validate(ipHash);
    const now = Date.now();
    const result = this.ctx.storage.transactionSync(() => {
      this.#cleanup(now);
      const global = this.ctx.storage.sql.exec('SELECT COUNT(*) AS n, MIN(expires) AS next FROM attempts').one();
      const local = this.ctx.storage.sql.exec('SELECT COUNT(*) AS n, MIN(expires) AS next FROM attempts WHERE ip_hash = ?', ipHash).one();
      if (global.n >= 30 || local.n >= 5) {
        const until = Math.max(global.n >= 30 ? global.next : 0, local.n >= 5 ? local.next : 0);
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((until - now) / 1000)) };
      }
      this.ctx.storage.sql.exec('INSERT INTO attempts(ip_hash, expires) VALUES (?, ?)', ipHash, now + WINDOW_MS);
      return { allowed: true };
    });
    await this.#schedule();
    return result;
  }
  async create(tokenHash) {
    this.#validate(tokenHash);
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.#cleanup(now);
      if (this.ctx.storage.sql.exec('SELECT token_hash FROM sessions WHERE token_hash = ?', tokenHash).toArray().length) return;
      const count = this.ctx.storage.sql.exec('SELECT COUNT(*) AS n FROM sessions').one().n;
      if (count >= 100) this.ctx.storage.sql.exec('DELETE FROM sessions WHERE token_hash IN (SELECT token_hash FROM sessions ORDER BY created, token_hash LIMIT ?)', count - 99);
      this.ctx.storage.sql.exec('INSERT INTO sessions(token_hash, created, expires) VALUES (?, ?, ?)', tokenHash, now, now + SESSION_SECONDS * 1000);
    });
    await this.#schedule();
  }
  async get(tokenHash) {
    this.#validate(tokenHash);
    const now = Date.now();
    const row = this.ctx.storage.sql.exec('SELECT expires FROM sessions WHERE token_hash = ?', tokenHash).toArray()[0];
    if (!row) return false;
    if (row.expires > now) return true;
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
    await this.#schedule();
    return false;
  }
  async revoke(tokenHash) {
    this.#validate(tokenHash);
    this.ctx.storage.sql.exec('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
    await this.#schedule();
  }
  async alarm() {
    this.ctx.storage.transactionSync(() => this.#cleanup(Date.now()));
    await this.#schedule();
  }
}

export async function storeName(authConfig) {
  // Password rotation also invalidates all outstanding sessions without a second secret.
  return `observatory-v1-${await digest(`${authConfig.salt}:${authConfig.verifier}`)}`;
}
export default {
  async fetch(request, env) {
    try {
      const authConfig = configuredAuth(env.OBSERVATORY_AUTH_CONFIG);
      const catalog = configuredCatalog(env.OBSERVATORY_CATALOG);
      const store = authConfig && catalog ? env.OBSERVATORY_AUTH.getByName(await storeName(authConfig)) : { get: async () => false, revoke: async () => {} };
      const read = name => {
        if (!name.startsWith('client/') || !CLIENT_FILES.has(name.slice(7))) return new Response('Not found', { status: 404 });
        return env.ASSETS.fetch(new Request(`${ORIGIN}/_protected/${name}`, { method: 'GET' }));
      };
      return await createHandler({
        read, store, authConfig, catalog, origin: ORIGIN,
        revision: env.CF_VERSION_METADATA?.id || 'unavailable',
        clientAddress: req => req.headers.get('CF-Connecting-IP') || 'unavailable'
      })(request);
    } catch {
      return new Response('The observatory is temporarily unavailable.', { status: 503, headers: securityHeaders });
    }
  }
};
