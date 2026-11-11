import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionCore, QuotaCore, handleRequest, COOKIE_NAME, API_PREFIX } from '../src/session.mjs';
import { DEFAULT_ROUTE } from '../src/routes.mjs';
import { BUILD_VERSION } from '../src/diagnostics.mjs';

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
    BROWSER: { async closeSession(id) { live.delete(id); }, async getSession(id) { return live.has(id) ? { sessionId: id } : null; } }, ...overrides };
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

test('probe keeps one browser and 90 reserved minutes even with production-sized configuration', async () => {
  const f = fixture({ MAX_BROWSER_SESSIONS: '8', MONTHLY_BROWSER_MINUTES: '600' });
  const first = await f.client(), blocked = await f.client();
  assert.equal((await first.post('/login')).status, 200);
  assert.equal((await blocked.post('/login')).status, 429);
  await first.post('/logout');
  for (let index = 1; index < 6; index++) {
    const client = await f.client();
    assert.equal((await client.post('/login')).status, 200);
    assert.equal((await client.post('/logout')).status, 200);
  }
  const exhausted = await f.client();
  const response = await exhausted.post('/login');
  assert.equal(response.status, 429); assert.equal((await response.json()).failureStage, 'quota_budget');
  assert.equal(f.count(), 6);
});

test('production supports all eight roommates concurrently and rejects a ninth browser', async () => {
  const f = fixture({ PROBE_ONLY: 'false', MAX_BROWSER_SESSIONS: '99', MONTHLY_BROWSER_MINUTES: '600' });
  const clients = await Promise.all(Array.from({ length: 9 }, () => f.client()));
  const responses = await Promise.all(clients.slice(0, 8).map(client => client.post('/login')));
  assert.ok(responses.every(response => response.status === 200)); assert.equal(f.live.size, 8);
  const ninth = await clients[8].post('/login');
  assert.equal(ninth.status, 429); assert.equal((await ninth.json()).state, 'error');
  assert.equal(f.count(), 8);
  assert.equal((await clients[0].post('/logout')).status, 200);
  assert.equal((await clients[8].post('/login')).status, 200); assert.equal(f.live.size, 8);
});

test('production monthly allowance is capped at 600 reserved minutes and resets by UTC month', async () => {
  const f = fixture({ PROBE_ONLY: 'false', MAX_BROWSER_SESSIONS: '8', MONTHLY_BROWSER_MINUTES: '100000' });
  for (let index = 0; index < 40; index++) {
    const client = await f.client();
    assert.equal((await client.post('/login')).status, 200);
    assert.equal((await client.post('/logout')).status, 200);
  }
  const blocked = await f.client();
  const response = await blocked.post('/login');
  assert.equal(response.status, 429); assert.equal((await response.json()).state, 'error');
  assert.equal(f.count(), 40);
  f.advance(31 * 24 * 60 * 60_000);
  assert.equal((await blocked.post('/login')).status, 200); assert.equal(f.count(), 41);
});

test('production budget preserves lower limits and invalid or zero configuration blocks launches', async () => {
  for (const configured of ['0', '-1', 'Infinity', 'NaN', 'invalid']) {
    const f = fixture({ PROBE_ONLY: 'false', MONTHLY_BROWSER_MINUTES: configured });
    const client = await f.client();
    assert.equal((await client.post('/login')).status, 429); assert.equal(f.count(), 0);
  }
  const f = fixture({ PROBE_ONLY: 'false', MONTHLY_BROWSER_MINUTES: '15' });
  const first = await f.client(); await first.post('/login'); await first.post('/logout');
  const second = await f.client(); assert.equal((await second.post('/login')).status, 429); assert.equal(f.count(), 1);
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
  assert.deepEqual(await response.json(), { ok: true, probeOnly: true, build: BUILD_VERSION });
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

test('navigation context loss during status preserves guarded login and recovers on next poll', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  assert.equal((await (await a.get()).json()).state, 'ready');
  owned.connected = () => true;
  owned.authenticated = async () => { throw new Error('Execution context was destroyed, most likely because of a navigation.'); };
  const response = await a.get(); assert.equal(response.status, 200);
  assert.equal((await response.json()).state, 'signing_in'); assert.equal(owned.closed, false); assert.equal(f.live.size, 1);
  owned.authenticated = async () => true;
  assert.equal((await (await a.get()).json()).state, 'ready'); assert.equal(f.count(), 1);
});

test('diagnostic context errors do not close session; known disconnect still fails closed', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.diagnostics = async () => { throw new Error('Execution context was destroyed'); };
  assert.equal((await a.get()).status, 200); assert.equal(owned.closed, false);
  owned.connected = () => false;
  owned.authenticated = async () => { throw new Error('Execution context was destroyed'); };
  const response = await a.get(); const data = await response.json();
  assert.equal(response.status, 503); assert.equal(data.failureStage, 'controller_disconnect'); assert.equal(owned.closed, true);
  assert.equal(JSON.stringify(data).includes('Execution context'), false);
});

test('sanitized diagnostics survive status failure and never include the raw error', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0];
  const diagnostics = { blocked: [{ request: 'POST tssproxy.ucsd.edu/idp/login', count: 1 }], forms: [] };
  owned.diagnostics = async () => diagnostics;
  owned.authenticated = async () => { throw new Error('Cannot perform I/O on behalf of a different request: synthetic-private-detail'); };
  const data = await (await a.get()).json();
  assert.equal(data.failureStage, 'runtime_io_context'); assert.deepEqual(data.diagnostics, diagnostics);
  assert.equal(JSON.stringify(data).includes('synthetic-private-detail'), false);
});

test('already-closed browser cannot strand the ownership lease when close reports 404', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  f.live.clear(); f.env.BROWSER.closeSession = async () => { throw Object.assign(Error('closed'), { status: 404 }); };
  assert.equal((await a.post('/logout')).status, 200);
  const b = await f.client(); assert.equal((await b.post('/login')).status, 200);
});

test('quota reclaims orphan lease only after provider proves absence', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  f.live.clear(); // Provider ended browser; owning object never released its lease.
  const b = await f.client(); assert.equal((await b.post('/login')).status, 200); assert.equal(f.count(), 2);
  const c = await f.client(); const rejected = await (await c.post('/login')).json();
  assert.equal(rejected.failureStage, 'quota_concurrency'); assert.equal(f.count(), 2);
  assert.equal((await (await c.get()).json()).failureStage, 'quota_concurrency');
});

test('failed restart cleanup recovers on later status instead of permanently rejecting initialization', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const [name] = [...f.sessions][0];
  f.env.BROWSER.closeSession = async () => {};
  const resumed = new SessionCore(f.contexts.get(name), f.env, { createBrowser: async () => { throw Error('unexpected launch'); } });
  await resumed.initializing; assert.equal(resumed.record.failureStage, 'cleanup_pending');
  f.live.clear();
  const response = await resumed.fetch(new Request(origin + API_PREFIX + '/status'));
  assert.equal(response.status, 200); assert.equal((await response.json()).state, 'expired'); assert.equal(resumed.record.browserId, undefined);
});

test('failed startup retains reservation ownership until quota release succeeds', async () => {
  const f = fixture(); const a = await f.client(); const core = [...f.sessions.values()][0];
  core.createBrowser = async () => { throw Object.assign(Error('startup unavailable'), { stage: 'launch' }); };
  const quotaFetch = f.quota.fetch.bind(f.quota); let failRelease = true;
  f.quota.fetch = request => new URL(request.url).pathname === '/release' && failRelease ? Promise.reject(Error('unavailable')) : quotaFetch(request);
  const response = await a.post('/login'); assert.equal(response.status, 503); assert.equal(core.record.leaseReserved, true);
  failRelease = false;
  assert.equal((await a.get()).status, 200); assert.equal(core.record.leaseReserved, undefined);
  const b = await f.client(); assert.equal((await b.post('/login')).status, 200);
});

test('hung readiness reads are bounded and single-flight; timeout never claims ready', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const core = [...f.sessions.values()][0], owned = [...f.live.values()][0]; core.statusTimeoutMs = 10;
  let calls = 0, resolve;
  owned.authenticated = async () => { calls++; await new Promise(done => { resolve = done; }); return true; };
  const responses = await Promise.all([a.get(), a.get()]);
  for (const response of responses) { const data = await response.json(); assert.equal(data.state, 'signing_in'); assert.equal(data.failureStage, 'status_timeout'); }
  assert.equal(calls, 1); assert.equal(owned.closed, false);
  assert.equal((await a.get()).status, 200); assert.equal(calls, 1);
  resolve(); await core.statusProbe;
  owned.authenticated = async () => true;
  const ready = await (await a.get()).json(); assert.equal(ready.state, 'ready'); assert.equal(ready.failureStage, undefined);
});

test('hung diagnostic evaluation cannot block readiness or accumulate evaluations', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const core = [...f.sessions.values()][0], owned = [...f.live.values()][0]; core.diagnosticsTimeoutMs = 5;
  let calls = 0; owned.signedIn = true;
  owned.diagnostics = async () => { calls++; return new Promise(() => {}); };
  for (let n = 0; n < 3; n++) assert.equal((await (await a.get()).json()).state, 'ready');
  assert.equal(calls, 1); assert.equal(owned.closed, false);
});
