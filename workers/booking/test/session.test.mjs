import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionCore, QuotaCore, handleRequest, COOKIE_NAME, API_PREFIX } from '../src/session.mjs';
import { DEFAULT_ROUTE } from '../src/routes.mjs';

const origin = 'https://boomerrawlings.com';
const uuid = () => crypto.randomUUID();
const context = name => ({ id: { toString: () => name }, storage: {
  data: new Map(), alarm: null,
  async get(key) { return structuredClone(this.data.get(key)); },
  async put(key, value) { this.data.set(key, structuredClone(value)); },
  async setAlarm(value) { this.alarm = value; }, async deleteAlarm() { this.alarm = null; },
} });

function fixture(overrides = {}) {
  let now = Date.UTC(2026, 10, 10), count = 0;
  const live = new Map(), sessions = new Map(), contexts = new Map();
  const env = { APP_ORIGIN: origin, PROBE_ONLY: 'true', MAX_SESSION_MINUTES: '15', MONTHLY_BROWSER_MINUTES: '90',
    BROWSER: { async closeSession(id) { live.delete(id); }, async getSession(id) { return live.get(id) || null; } }, ...overrides };
  const quota = new QuotaCore(context('quota'), env, { now: () => now });
  env.QUOTA = { idFromName: name => name, get: () => quota };
  const createBrowser = async (_, hooks) => {
    const browser = { id: `browser-${++count}`, signedIn: false, closed: false, bookCalls: 0, loginCalls: 0, stage: 'checking',
      async authenticated() { return this.signedIn; },
      async loginUrl() { this.loginCalls++; return 'https://live.browser.run/ui/view?mode=tab&token=synthetic'; },
      async inspect() { return { ready: true, loaded: true, csrf: true }; },
      async book() { this.bookCalls++; return { stage: this.stage }; },
      async bookingStatus() { return { stage: this.stage }; },
      async close() { this.closed = true; live.delete(this.id); }, hooks,
    };
    live.set(browser.id, browser);
    return browser;
  };
  env.SESSIONS = { idFromName: name => name, get(name) {
    if (!sessions.has(name)) { const ctx = context(name); contexts.set(name, ctx); sessions.set(name, new SessionCore(ctx, env, { createBrowser, now: () => now })); }
    return sessions.get(name);
  } };
  const client = async () => {
    const response = await handleRequest(new Request(origin + API_PREFIX + '/status'), env);
    const cookie = response.headers.get('Set-Cookie').split(';')[0];
    const status = await response.json();
    return { cookie, csrf: status.csrf, initial: status, response,
      async get() { return handleRequest(new Request(origin + API_PREFIX + '/status', { headers: { Cookie: cookie } }), env); },
      async post(action, body = {}, extra = {}) {
        return handleRequest(new Request(origin + API_PREFIX + action, { method: 'POST', headers: {
          Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-BBB-CSRF': status.csrf, ...extra,
        }, body: JSON.stringify({ requestId: uuid(), ...body }) }), env);
      } };
  };
  return { env, live, sessions, contexts, quota, client, advance: ms => { now += ms; }, count: () => count };
}

test('status is allocation-free; secure cookie and independent CSRF per visitor', async () => {
  const f = fixture(); const a = await f.client(), b = await f.client();
  assert.equal(a.initial.state, 'signed_out'); assert.equal(a.initial.probeOnly, true); assert.equal(f.count(), 0);
  assert.match(a.response.headers.get('Set-Cookie'), /Secure; HttpOnly; SameSite=Strict/);
  assert.notEqual(a.cookie, b.cookie); assert.notEqual(a.csrf, b.csrf); assert.equal(f.sessions.size, 2);
  assert.equal(a.response.headers.get('Cache-Control'), 'no-store');
});

test('origin, CSRF, content type and route restrictions precede browser allocation', async () => {
  const f = fixture(); const a = await f.client();
  for (const [extra, status] of [[{ Origin: 'https://evil.test' }, 403], [{ 'X-BBB-CSRF': 'wrong' }, 403],
    [{ 'Sec-Fetch-Site': 'same-site' }, 403], [{ 'Content-Type': 'text/plain' }, 415]]) {
    assert.equal((await a.post('/login', {}, extra)).status, status);
  }
  assert.equal((await a.post('/inspect', { route: 'https://tss.ucsd.edu/unverified' })).status, 400);
  assert.equal((await a.post('/login', { surprise: true })).status, 400);
  assert.equal(f.count(), 0);
});

test('one probe browser, per-user ownership, logout closes and clears cookie', async () => {
  const f = fixture(); const a = await f.client(), b = await f.client();
  assert.equal((await a.post('/login')).status, 200);
  assert.equal((await b.post('/login')).status, 429);
  assert.equal((await b.get()).status, 200); assert.equal((await (await b.get()).json()).state, 'signed_out');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  assert.equal((await (await a.get()).json()).state, 'ready');
  const response = await a.post('/logout'); assert.equal(response.status, 200);
  assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/); assert.equal(owned.closed, true); assert.equal(f.live.size, 0);
  assert.equal((await b.post('/login')).status, 200);
});

test('probe rejects Book; read-only inspection exposes booleans and known code only', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  assert.equal((await a.post('/book', { route: DEFAULT_ROUTE })).status, 403); assert.equal(owned.bookCalls, 0);
  const result = await (await a.post('/inspect', { route: DEFAULT_ROUTE })).json();
  assert.equal(result.loaded, true); assert.equal(result.ready, true); assert.equal(result.csrfReady, true);
  assert.equal(result.courseCode, 'PHIL-010');
  assert.equal(JSON.stringify(result).includes('student'), false);
});

test('absolute expiry destroys browser even when user stays active', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  f.advance(15 * 60_000);
  const status = await (await a.get()).json();
  assert.equal(status.state, 'expired'); assert.equal(owned.closed, true); assert.equal(f.live.size, 0);
  assert.equal(status.expiresAt, undefined);
});

test('object restart closes persisted provider browser instead of reconnecting without guard', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const [name, old] = [...f.sessions][0];
  const resumed = new SessionCore(f.contexts.get(name), f.env, { createBrowser: async () => { throw Error('unexpected launch'); } });
  await resumed.initializing;
  assert.equal(f.live.size, 0); assert.equal(resumed.record.state, 'expired'); assert.equal(old.record.browserId !== undefined, true);
});

test('production Book is correlated and idempotent; review login preserves job', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const requestId = uuid(), body = { route: DEFAULT_ROUTE, requestId };
  const first = await (await a.post('/book', body)).json();
  assert.equal(first.booking.requestId, requestId); assert.equal(first.booking.stage, 'checking'); assert.equal(first.state, 'busy');
  await a.post('/book', body); assert.equal(owned.bookCalls, 1);
  assert.equal((await a.post('/book', { route: DEFAULT_ROUTE })).status, 409);
  assert.equal((await a.post('/inspect', body)).status, 409);
  owned.stage = 'review'; assert.equal((await (await a.get()).json()).booking.stage, 'review');
  const review = await (await a.post('/login')).json(); assert.match(review.loginUrl, /^https:\/\/live.browser.run\//);
  assert.equal(review.booking.requestId, requestId); assert.equal(owned.loginCalls, 2); assert.equal(f.count(), 1);
  owned.stage = 'submitted'; const done = await (await a.get()).json();
  assert.equal(done.booking.stage, 'submitted'); assert.equal(done.state, 'ready'); assert.equal(owned.bookCalls, 1);
});

test('concurrent POST sees busy and cannot start a second job', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  let release; owned.book = async () => { owned.bookCalls++; await new Promise(resolve => { release = resolve; }); return { stage: 'checking' }; };
  const first = a.post('/book', { route: DEFAULT_ROUTE });
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await a.post('/book', { route: DEFAULT_ROUTE })).status, 409);
  release(); await first; assert.equal(owned.bookCalls, 1);
});

test('failed fresh authentication never permits Book', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0];
  assert.equal((await a.post('/book', { route: DEFAULT_ROUTE })).status, 401); assert.equal(owned.bookCalls, 0);
});

test('body and request count bounded without launching browsers', async () => {
  const f = fixture(); const a = await f.client();
  assert.equal((await a.post('/login', { route: 'x'.repeat(5000) })).status, 413); assert.equal(f.count(), 0);
});

test('zero usage limit stops allocation; reserved full windows are not refunded', async () => {
  const zero = fixture({ MONTHLY_BROWSER_MINUTES: '0' }); const z = await zero.client();
  assert.equal((await z.post('/login')).status, 429); assert.equal(zero.count(), 0);
  const f = fixture({ MONTHLY_BROWSER_MINUTES: '15' }); const a = await f.client(); await a.post('/login'); await a.post('/logout');
  const b = await f.client(); assert.equal((await b.post('/login')).status, 429); assert.equal(f.count(), 1);
});

test('provider closure must be verified before releasing concurrent-browser lease', async () => {
  const f = fixture(); const a = await f.client(), b = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.close = async () => {}; f.env.BROWSER.closeSession = async () => {};
  assert.equal((await a.post('/logout')).status, 503);
  assert.equal((await b.post('/login')).status, 429);
  assert.equal(f.live.size, 1);
});

test('health never creates cookie, object or browser', async () => {
  const f = fixture(); const response = await handleRequest(new Request(origin + API_PREFIX + '/health'), f.env);
  assert.deepEqual(await response.json(), { ok: true, probeOnly: true });
  assert.equal(response.headers.has('Set-Cookie'), false); assert.equal(f.sessions.size, 0); assert.equal(f.count(), 0);
});

test('expiry, alarm and login share closure; stale alarm cannot close replacement browser', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const old = [...f.live.values()][0]; const core = [...f.sessions.values()][0];
  let release, closed = 0;
  old.close = async () => { closed++; await new Promise(resolve => { release = resolve; }); f.live.delete(old.id); };
  f.advance(15 * 60_000);
  const status = a.get();
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  const alarm = core.alarm(); const login = a.post('/login');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(closed, 1); assert.equal(f.count(), 1);
  release(); await Promise.all([status, alarm]); assert.equal((await login).status, 200);
  const replacement = [...f.live.values()][0]; assert.notEqual(replacement.id, old.id); assert.equal(core.record.browserId, replacement.id);
  await core.alarm(); // Delayed delivery of an obsolete alarm.
  assert.equal(replacement.closed, false); assert.equal(core.record.browserId, replacement.id);
  assert.equal(f.live.size, 1);
});
