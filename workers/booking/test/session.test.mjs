import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionCore, QuotaCore, handleRequest, COOKIE_NAME, API_PREFIX } from '../src/session.mjs';
import { DEFAULT_ROUTE, BOOKING_ROUTES, VERIFIED_STANDARD_ROUTES } from '../src/routes.mjs';
import { BUILD_VERSION } from '../src/diagnostics.mjs';
import { DIRECT_READ_STAGES, DIRECT_SCHEMA_ISSUES, DIRECT_PREPARATION_NOTES } from '../src/direct-tss.mjs';

const origin = 'https://boomerrawlings.com';
const uuid = () => crypto.randomUUID();
const syntheticCatalog = () => ({ resolved: true, courses: [
  { courseCode: 'ECON-120A', moduleId: '12345', packageIds: ['167365', '167366', '167367', '167368', '167369', '167370', '167371', '167372'] },
  { courseCode: 'MGT-162', moduleId: '54321', packageIds: ['164325', '164326', '164327'] },
], failures: [] });
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

test('login accepts bounded dimensions only and preserves an existing session viewport', async () => {
  const f = fixture(); const a = await f.client();
  for (const viewport of [null, [], { width: 319, height: 600 }, { width: 1441, height: 600 }, { width: 390, height: 239 },
    { width: 390, height: 1001 }, { width: 390.5, height: 600 }, { width: '390', height: 600 }, { width: 390, height: 600, deviceScaleFactor: 3 }]) {
    assert.equal((await a.post('/login', { viewport })).status, 400);
  }
  assert.equal(f.count(), 0);
  const requestId = uuid();
  assert.equal((await a.post('/login', { requestId, viewport: { width: 390, height: 780 } })).status, 200);
  const browser = [...f.live.values()][0];
  assert.deepEqual(browser.hooks.viewport, { width: 390, height: 780 });
  assert.equal((await a.post('/login', { viewport: { width: 1440, height: 836 } })).status, 200);
  assert.equal(f.count(), 1); assert.equal(browser.loginCalls, 2);
  assert.deepEqual(browser.hooks.viewport, { width: 390, height: 780 });
  assert.equal((await a.post('/login', { requestId, viewport: { width: 509, height: 1000 } })).status, 409);
  assert.equal((await a.post('/inspect', { route: DEFAULT_ROUTE, viewport: { width: 390, height: 780 } })).status, 400);
});

test('client JSON cannot forge native verification or read-only exemptions', async () => {
  const f=fixture({PROBE_ONLY:'false',DIRECT_BOOKING_ENABLED:'true'});const a=await f.client();
  await a.post('/login');const owned=[...f.live.values()][0];owned.signedIn=true;
  let reads=0,proofs=0;
  owned.authenticated=async()=>{proofs++;return true;};
  owned.inspectDirect=async()=>{reads++;return{ready:true,loaded:true,equivalent:true,nativeBookingPath:'standard'};};
  for(const flag of ['standardNativeVerified','comparisonOnly','readOnly']){
    for(const action of ['/book','/inspect-direct','/verify-direct','/login']){
      const response=await a.post(action,{route:DEFAULT_ROUTE,[flag]:true});
      assert.equal(response.status,400);assert.equal((await response.json()).message,'Invalid request.');
    }
  }
  assert.equal(proofs,0);assert.equal(reads,0);assert.equal(owned.bookCalls,0);
  assert.equal(VERIFIED_STANDARD_ROUTES.size,0);
  const verified=await(await a.post('/verify-direct',{route:DEFAULT_ROUTE})).json();
  assert.equal(verified.equivalent,true);assert.equal(verified.nativeBookingPath,'standard');
  assert.equal(VERIFIED_STANDARD_ROUTES.size,0,'read-only equivalence cannot grant server release permission');
  assert.equal(owned.bookCalls,0);
});

test('failed login preserves sanitized guard evidence after browser closure', async () => {
  const f=fixture({PROBE_ONLY:'false'});const a=await f.client();await a.post('/login');
  const owned=[...f.live.values()][0];
  owned.loginUrl=async()=>{throw Object.assign(Error('private-protocol-error'),{stage:'renderer_preflight',
    failureDiagnostic:{name:'TimeoutError',code:'renderer_timeout',source:'renderer_preflight',phase:'evaluate'},
    authDiagnostics:{targetProbe:'responsive',guard:{pendingCount:1,pending:[{resourceType:'Document',phase:'response_body',ageMs:8000,body:'private-body'}]},
      trace:[{kind:'document_response',destination:'tss_proxy',resourceType:'Document',method:'GET',route:'proxy_saml_request',status:200,atMs:0,count:1,url:'private-url'}],raw:'private-token'}});};
  const failed=await a.post('/login');assert.equal(failed.status,503);const data=await failed.json();
  assert.equal(owned.closed,true);assert.equal(data.authDiagnostics.targetProbe,'responsive');
  assert.deepEqual(data.authDiagnostics.guard,{pendingCount:1,pending:[{resourceType:'Document',phase:'response_body',ageMs:8000}]});
  assert.equal(data.authDiagnostics.phase,'evaluate');assert.equal(data.authDiagnostics.trace[0].route,'proxy_saml_request');
  const after=await(await a.get()).json();assert.deepEqual(after.authDiagnostics,data.authDiagnostics);
  assert.doesNotMatch(JSON.stringify(data)+JSON.stringify(after),/private/);
  assert.doesNotMatch(JSON.stringify([...f.sessions.values()][0].ctx.storage.data),/private/);
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

test('production retains only fixed booking reasons across immediate and polled failure', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  owned.book = async () => ({ stage: 'stopped', reason: 'course_load_timeout', message: 'private native details' });
  const first = await (await a.post('/book', { route: DEFAULT_ROUTE })).json();
  assert.equal(first.booking.reason, 'course_load_timeout');
  assert.equal((await (await a.get()).json()).booking.reason, 'course_load_timeout');
  owned.book = async () => ({ stage: 'checking' });
  await a.post('/book', { route: DEFAULT_ROUTE });
  owned.bookingStatus = async () => ({ stage: 'error', reason: 'request_blocked', message: 'private native details' });
  const failed = await (await a.get()).json();
  assert.equal(failed.booking.reason, 'request_blocked'); assert.equal(failed.booking.stage, 'error');
  assert.equal(JSON.stringify(failed).includes('private native'), false);
  owned.book = async () => ({ stage: 'stopped', reason: 'private arbitrary detail' });
  const unknown = await (await a.post('/book', { route: DEFAULT_ROUTE })).json();
  assert.equal(unknown.booking.reason, undefined); assert.equal(JSON.stringify(unknown).includes('private arbitrary'), false);
});

test('active booking expiry keeps a fixed terminal reason after browser closes', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  await a.post('/book', { route: DEFAULT_ROUTE });
  f.advance(15 * 60_000);
  const ended = await (await a.get()).json();
  assert.equal(ended.booking.stage, 'error'); assert.equal(ended.booking.reason, 'session_expired'); assert.equal(owned.closed, true);
});

test('read-only direct inspection and verification are allowed with writes disabled', async () => {
  const f = fixture({ DIRECT_BOOKING_ENABLED: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const calls = [];
  owned.inspectDirect = async (route, code, compare) => {
    calls.push({ route, code, compare });
    return { loaded: true, ready: true, csrfReady: true, equivalent: true, mismatchFields: ['Items', 'private account field'], payload: 'private payload' };
  };
  assert.equal((await a.post('/inspect-direct', { route: DEFAULT_ROUTE })).status, 200);
  const proof = await (await a.post('/verify-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(proof.equivalent, true); assert.deepEqual(proof.mismatchFields, ['Items']);
  assert.equal(proof.directBookingEnabled, false); assert.equal(proof.csrfReady, true);
  assert.equal(JSON.stringify(proof).includes('private'), false); assert.equal(owned.bookCalls, 0);
  assert.deepEqual(calls.map(value => value.compare), [false, true]);
  assert.equal((await a.post('/inspect-direct', { route: 'https://tss.ucsd.edu/arbitrary' })).status, 400);
});

test('course resolver requires POST, origin, CSRF, UUID and no caller-controlled route', async () => {
  const f = fixture(); const a = await f.client();
  const get = new Request(origin + API_PREFIX + '/resolve-courses', { headers: { Cookie: a.cookie } });
  assert.equal((await handleRequest(get, f.env)).status, 405);
  for (const [body, headers, expected] of [
    [{}, { Origin: 'https://evil.test' }, 403], [{}, { 'X-BBB-CSRF': 'wrong' }, 403],
    [{ requestId: 'invalid' }, {}, 400], [{ route: DEFAULT_ROUTE }, {}, 400],
    [{ courseCode: 'ECON-120A' }, {}, 400], [{}, { 'Content-Type': 'text/plain' }, 415],
  ]) assert.equal((await a.post('/resolve-courses', body, headers)).status, expected);
  assert.equal((await a.post('/resolve-courses')).status, 401); assert.equal(f.count(), 0);
});

test('course resolver has fresh direct authentication, owned browser and idempotent sanitized results', async () => {
  const f = fixture({ DIRECT_BOOKING_ENABLED: 'false' }); const a = await f.client(), b = await f.client();
  await a.post('/login'); const owned = [...f.live.values()][0], proofOptions = [];
  let resolveCalls = 0;
  owned.authenticated = async options => { proofOptions.push(options); return 'authenticated'; };
  owned.resolveCourses = async () => {
    resolveCalls++;
    const result = syntheticCatalog();
    result.courses[0].moduleId = '00012345'; result.courses[0].private = 'private-student-payload';
    result.raw = 'private-auth-token'; return result;
  };
  assert.equal((await b.post('/resolve-courses')).status, 401); assert.equal(resolveCalls, 0);
  const requestId = uuid(), first = await a.post('/resolve-courses', { requestId });
  assert.equal(first.status, 200); const result = await first.json();
  assert.deepEqual(result.catalog, syntheticCatalog()); assert.equal(result.state, 'ready'); assert.equal(result.csrfReady, true);
  assert.deepEqual(proofOptions, [{ fresh: true, direct: true }]);
  assert.equal((await a.post('/resolve-courses', { requestId })).status, 200); assert.equal(resolveCalls, 1);
  assert.equal((await a.post('/inspect-direct', { requestId, route: DEFAULT_ROUTE })).status, 409);
  assert.equal(owned.bookCalls, 0); assert.equal(BOOKING_ROUTES.size, 20);
  assert.doesNotMatch(JSON.stringify(result), /private-student|private-auth/);
  const core = [...f.sessions.values()][0];
  assert.doesNotMatch(JSON.stringify([...core.ctx.storage.data]), /catalog|12345|54321|private-student|private-auth/);
});

test('course resolver rejects malformed IDs, packages and catalog rows without exposing arbitrary fields', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  for (const change of [
    value => { value.courses[0].moduleId = '123456789'; },
    value => { value.courses[0].moduleId = '00000000'; },
    value => { value.courses[0].moduleId = 'private-module'; },
    value => { value.courses[0].packageIds[0] = '164325'; },
    value => { value.courses[0].packageIds[0] = value.courses[0].packageIds[1]; },
    value => { value.courses[0].courseCode = 'PRIVATE-COURSE'; },
    value => { value.courses[1] = structuredClone(value.courses[0]); },
    value => { value.courses.push({ courseCode: 'private-course', moduleId: 'private-value' }); },
  ]) {
    const value = syntheticCatalog(); change(value); owned.resolveCourses = async () => value;
    const result = await (await a.post('/resolve-courses')).json();
    assert.equal(result.catalog.resolved, false);
    assert.ok(result.catalog.failures.some(item => item.courseCode === 'ECON-120A' && item.reason === 'unsupported_response'));
    assert.doesNotMatch(JSON.stringify(result.catalog), /private-|PRIVATE-/); assert.equal(owned.bookCalls, 0);
  }
  owned.resolveCourses = async () => ({ resolved: true, courses: [], failures: [
    { courseCode: 'ECON-120A', reason: 'course_not_found', private: 'private-response' },
    { courseCode: 'MGT-162', reason: 'private-reason' },
  ] });
  const failed = await (await a.post('/resolve-courses')).json();
  assert.deepEqual(failed.catalog, { resolved: false, courses: [], failures: [
    { courseCode: 'ECON-120A', reason: 'course_not_found' }, { courseCode: 'MGT-162', reason: 'unsupported_response' },
  ] });
  assert.equal(failed.state, 'ready'); assert.equal(owned.closed, false);
});

test('course resolver never runs before positive fresh auth and preserves login on temporary failures', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; let calls = 0;
  owned.resolveCourses = async () => { calls++; return syntheticCatalog(); };
  assert.equal((await a.post('/resolve-courses')).status, 401);
  owned.authenticated = async () => 'unavailable';
  const unavailable = await a.post('/resolve-courses');
  assert.equal(unavailable.status, 503); assert.equal((await unavailable.json()).reason, 'authentication_unavailable');
  assert.equal(calls, 0); assert.equal(owned.closed, false); assert.equal(owned.bookCalls, 0);
  owned.authenticated = async () => 'authenticated';
  owned.resolveCourses = async () => ({ courses: [], failures: [{ courseCode: 'ECON-120A', reason: 'authentication_required' }] });
  const expiredAuth = await (await a.post('/resolve-courses')).json();
  assert.equal(expiredAuth.state, 'signing_in'); assert.equal(expiredAuth.csrfReady, false); assert.equal(owned.closed, false);
});

test('course resolver is single-flight and discards results when its owned session expires', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  let release, calls = 0;
  owned.resolveCourses = async () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const pending = a.post('/resolve-courses');
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await a.post('/resolve-courses')).status, 409);
  assert.equal((await a.post('/book', { route: DEFAULT_ROUTE })).status, 409);
  f.advance(15 * 60_000); release(syntheticCatalog());
  const response = await pending, result = await response.json();
  assert.equal(response.status, 401); assert.equal(result.state, 'expired'); assert.equal(result.catalog, undefined);
  assert.equal(owned.closed, true); assert.equal(calls, 1); assert.equal(owned.bookCalls, 0);
});

test('only submitted direct outcomes survive API status and request deduplication', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  for (const outcome of ['booked', 'waitlisted', 'unconfirmed', 'private-result', 'Booked', true, null, { private: 'payload' }]) {
    const requestId = uuid();
    owned.book = async () => ({ stage: 'submitted', outcome, rawResponse: 'private-response' });
    const result = await (await a.post('/book', { route: DEFAULT_ROUTE, requestId })).json();
    const expected = ['booked', 'waitlisted', 'unconfirmed'].includes(outcome) ? outcome : undefined;
    assert.equal(result.booking.outcome, expected);
    assert.equal((await (await a.get()).json()).booking.outcome, expected);
    assert.equal((await (await a.post('/book', { route: DEFAULT_ROUTE, requestId })).json()).booking.outcome, expected);
    assert.doesNotMatch(JSON.stringify(result), /private/);
  }
  owned.book = async () => ({ stage: 'stopped', outcome: 'booked' });
  assert.equal((await (await a.post('/book', { route: DEFAULT_ROUTE })).json()).booking.outcome, undefined);
  f.env.DIRECT_BOOKING_ENABLED = 'false';
  owned.book = async () => ({ stage: 'submitted', outcome: 'booked' });
  assert.equal((await (await a.post('/book', { route: DEFAULT_ROUTE })).json()).booking.outcome, undefined);
});

test('late status outcome cannot replace a newer confirmed submission', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const requestId = uuid(), confirmationId = uuid();
  await a.post('/book', { route: DEFAULT_ROUTE, requestId });
  owned.bookingStatus = async () => ({ stage: 'review', confirmationId, reviewMessage: 'Synthetic official warning' });
  await a.get();
  let release;
  owned.bookingStatus = () => new Promise(resolve => { release = resolve; });
  const pending = a.get(); while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  owned.reviewBooking = async () => ({ stage: 'submitted', outcome: 'booked' });
  const submitted = await (await a.post('/confirm', { bookingRequestId: requestId, confirmationId })).json();
  assert.equal(submitted.booking.outcome, 'booked');
  release({ stage: 'submitted', outcome: 'waitlisted' });
  const after = await (await pending).json();
  assert.equal(after.booking.requestId, requestId); assert.equal(after.booking.outcome, 'booked');
});

test('submitted direct notice is owned and ephemeral, excluded from records and duplicate response cache', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' });
  const a = await f.client(), b = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const noticeMessage = 'Synthetic late TSS warning <plain text>', requestId = uuid();
  owned.book = async () => { owned.bookCalls++; return { stage: 'submitted', noticeMessage }; };
  const first = await (await a.post('/book', { route: DEFAULT_ROUTE, requestId })).json();
  assert.equal(first.booking.stage, 'submitted'); assert.equal(first.booking.noticeMessage, noticeMessage);
  assert.equal(first.state, 'ready'); assert.equal(first.booking.confirmationId, undefined);
  assert.equal((await (await a.get()).json()).booking.noticeMessage, noticeMessage);
  assert.equal((await (await b.get()).json()).booking, undefined);
  const duplicate = await (await a.post('/book', { route: DEFAULT_ROUTE, requestId })).json();
  assert.equal(duplicate.booking.noticeMessage, undefined); assert.equal(owned.bookCalls, 1);
  const core = [...f.sessions.values()][0];
  for (const value of [core.record, [...core.ctx.storage.data], [...core.results]]) {
    assert.doesNotMatch(JSON.stringify(value), /Synthetic late TSS|noticeMessage/);
  }
  owned.book = async () => ({ stage: 'checking' });
  const next = await (await a.post('/book', { route: DEFAULT_ROUTE })).json();
  assert.equal(next.booking.noticeMessage, undefined); assert.equal(core.notice, null);
  await a.post('/logout'); assert.equal(core.notice, null); assert.equal(core.snapshot().booking, undefined);
});

test('polled submitted notices survive only their current request and never create confirmation', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' });
  const a = await f.client(); await a.post('/login'); const owned = [...f.live.values()][0]; owned.signedIn = true;
  await a.post('/book', { route: DEFAULT_ROUTE });
  owned.bookingStatus = async () => ({ stage: 'submitted', noticeMessage: 'Synthetic polled notice', confirmationId: uuid() });
  const result = await (await a.get()).json();
  assert.equal(result.booking.stage, 'submitted'); assert.equal(result.booking.noticeMessage, 'Synthetic polled notice');
  assert.equal(result.booking.confirmationId, undefined); assert.equal(owned.bookCalls, 1);
  assert.equal((await a.post('/confirm', { bookingRequestId: result.booking.requestId, confirmationId: uuid() })).status, 409);
  const core = [...f.sessions.values()][0];
  core.notice.requestId = uuid(); assert.equal(core.snapshot().booking.noticeMessage, undefined);
  await a.post('/logout'); assert.equal(core.notice, null);
});

test('session expiry and error closure clear submitted notice text while preserving the submitted result', async () => {
  for (const state of ['expired', 'error']) {
    const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' });
    const a = await f.client(); await a.post('/login');
    const owned = [...f.live.values()][0]; owned.signedIn = true;
    owned.book = async () => ({ stage: 'submitted', noticeMessage: 'Synthetic session-scoped notice' });
    await a.post('/book', { route: DEFAULT_ROUTE });
    const core = [...f.sessions.values()][0];
    assert.equal(core.snapshot().booking.noticeMessage, 'Synthetic session-scoped notice');
    if (state === 'expired') { f.advance(15 * 60_000); await a.get(); }
    else await core.close('error');
    const result = core.snapshot();
    assert.equal(result.state, state); assert.equal(result.booking.stage, 'submitted');
    assert.equal(result.booking.noticeMessage, undefined); assert.equal(core.notice, null);
    assert.doesNotMatch(JSON.stringify(result), /Synthetic session-scoped notice/);
    assert.equal(owned.closed, true);
  }
});

test('native or non-submitted results and malformed notice text cannot expose submitted notices', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' });
  const a = await f.client(); await a.post('/login'); const owned = [...f.live.values()][0]; owned.signedIn = true;
  for (const [stage, noticeMessage] of [['submitted', ''], ['submitted', ' '.repeat(10)], ['submitted', 'x'.repeat(4001)],
    ['submitted', 'private\u0000notice'], ['submitted', { private: 'text' }], ['stopped', 'private stopped notice']]) {
    owned.book = async () => ({ stage, noticeMessage });
    const result = await (await a.post('/book', { route: DEFAULT_ROUTE })).json();
    assert.equal(result.booking.noticeMessage, undefined);
  }
  f.env.DIRECT_BOOKING_ENABLED = 'false'; owned.book = async () => ({ stage: 'submitted', noticeMessage: 'private native notice' });
  assert.equal((await (await a.post('/book', { route: DEFAULT_ROUTE })).json()).booking.noticeMessage, undefined);
});

test('direct confirmation is owned, correlated, idempotent and keeps review text out of storage/cache', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true', MAX_BROWSER_SESSIONS: '8' });
  const a = await f.client(), b = await f.client(); await a.post('/login'); await b.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const bookingRequestId = uuid(), confirmationId = uuid(), reviewMessage = 'Synthetic official warning <plain text>';
  await a.post('/book', { route: DEFAULT_ROUTE, requestId: bookingRequestId });
  owned.bookingStatus = async () => ({ stage: 'review', reviewMessage, confirmationId });
  const reviewed = await (await a.get()).json();
  assert.equal(reviewed.booking.mode, 'direct'); assert.equal(reviewed.booking.reviewMessage, reviewMessage);
  const core = [...f.sessions.values()][0];
  assert.equal(JSON.stringify(core.record).includes(reviewMessage), false);
  assert.equal(JSON.stringify([...core.ctx.storage.data]).includes(reviewMessage), false);
  await a.post('/login');
  assert.equal(JSON.stringify([...core.results]).includes(reviewMessage), false);
  let confirmations = 0;
  owned.reviewBooking = async (operation, request, confirmation) => {
    confirmations++; assert.equal(operation, 'confirm'); assert.equal(request, bookingRequestId); assert.equal(confirmation, confirmationId);
    return { stage: 'submitting' };
  };
  assert.equal((await b.post('/confirm', { bookingRequestId, confirmationId })).status, 409);
  assert.equal((await a.post('/confirm', { bookingRequestId, confirmationId: uuid() })).status, 409);
  assert.equal((await a.post('/confirm', { bookingRequestId, confirmationId }, { 'X-BBB-CSRF': 'wrong' })).status, 403);
  const confirmationRequest = { requestId: uuid(), bookingRequestId, confirmationId };
  assert.equal((await a.post('/confirm', confirmationRequest)).status, 200);
  assert.equal((await a.post('/confirm', confirmationRequest)).status, 200); assert.equal(confirmations, 1);
  assert.equal(JSON.stringify([...core.ctx.storage.data]).includes(confirmationId), false);
  assert.equal(core.record.booking.stage, 'submitting'); assert.equal(core.review, null);
  assert.equal((await a.post('/confirm', { bookingRequestId, confirmationId })).status, 409);
});

test('direct cancellation requires current review; invalid warning text cannot authorize either action', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const bookingRequestId = uuid(), confirmationId = uuid();
  await a.post('/book', { route: DEFAULT_ROUTE, requestId: bookingRequestId });
  owned.bookingStatus = async () => ({ stage: 'review', confirmationId, reviewMessage: 'x'.repeat(4001) });
  const invalid = await (await a.get()).json(); assert.equal(invalid.booking.reviewMessage, undefined);
  assert.equal((await a.post('/cancel', { bookingRequestId, confirmationId })).status, 409);
  owned.bookingStatus = async () => ({ stage: 'review', confirmationId, reviewMessage: 'Safe text' });
  await a.get();
  owned.reviewBooking = async operation => { assert.equal(operation, 'cancel'); return { stage: 'stopped', reason: 'booking_cancelled' }; };
  const cancelled = await (await a.post('/cancel', { bookingRequestId, confirmationId })).json();
  assert.equal(cancelled.booking.reason, 'booking_cancelled'); assert.equal(cancelled.booking.stage, 'stopped');
  assert.equal(cancelled.booking.reviewMessage, undefined);
});

test('delayed review status cannot restore a consumed confirmation after submitting', async () => {
  const f = fixture({ PROBE_ONLY: 'false', DIRECT_BOOKING_ENABLED: 'true' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const bookingRequestId = uuid(), confirmationId = uuid();
  await a.post('/book', { route: DEFAULT_ROUTE, requestId: bookingRequestId });
  const review = { stage: 'review', reviewMessage: 'Official warning', confirmationId };
  owned.bookingStatus = async () => review; await a.get();
  let resolveStatus;
  owned.bookingStatus = () => new Promise(resolve => { resolveStatus = resolve; });
  const delayed = a.get();
  while (!resolveStatus) await new Promise(resolve => setTimeout(resolve, 0));
  owned.reviewBooking = async () => ({ stage: 'submitting' });
  assert.equal((await a.post('/confirm', { bookingRequestId, confirmationId })).status, 200);
  resolveStatus(review);
  const latest = await (await delayed).json();
  assert.equal(latest.booking.stage, 'submitting'); assert.equal(latest.booking.confirmationId, undefined);
  assert.equal((await a.post('/confirm', { bookingRequestId, confirmationId })).status, 409);
});

test('production auth diagnostics expose only fixed classes and redacted endpoints', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0];
  owned.authDiagnostics = () => [{ hostname: 'a5.ucsd.edu', pathname: '/tritON/private-token-value', method: 'POST', count: 1 }];
  const status = await (await a.get()).json();
  assert.deepEqual(status.authDiagnostics.blocked, [{ hostname: 'a5.ucsd.edu', pathname: '/tritON/[redacted]', method: 'POST', count: 1 }]);
  assert.equal(JSON.stringify(status).includes('private-token'), false);
});

test('successful logout clears old uncertain booking but automatic expiry preserves it', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  await a.post('/book', { route: DEFAULT_ROUTE });
  f.advance(15 * 60_000);
  assert.equal((await (await a.get()).json()).booking.reason, 'session_expired');
  assert.equal((await a.post('/logout')).status, 200);
  const after = await (await a.get()).json();
  assert.equal(after.state, 'signed_out'); assert.equal(after.booking, undefined);
});

test('direct eligibility failure preserves fresh authentication; explicit auth failure revokes it', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  owned.inspectDirect = async () => ({ loaded: false, ready: false, reason: 'existing_registration' });
  const ineligible = await (await a.post('/inspect-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(ineligible.state, 'ready'); assert.equal(ineligible.ready, false); assert.equal(ineligible.csrfReady, true);
  owned.inspectDirect = async () => ({ loaded: false, ready: false, reason: 'authentication_required' });
  const expired = await (await a.post('/inspect-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(expired.state, 'signing_in'); assert.equal(expired.csrfReady, false);
});

test('direct schema diagnostics retain fixed names/shapes only and deduplicate issues', async () => {
  const f = fixture({ DIRECT_BOOKING_ENABLED: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const readStage = DIRECT_READ_STAGES[0], schemaIssue = DIRECT_SCHEMA_ISSUES[0];
  owned.inspectDirect = async () => ({ loaded: false, ready: false, reason: 'unsupported_tss', readStage, schemaIssue,
    schemaIssues: [
      { readStage, schemaIssue, body: 'private response body', url: 'https://private.invalid/token' },
      { readStage, schemaIssue }, { readStage: 'private student value', schemaIssue }, { readStage, schemaIssue: 'private token' },
    ], settingShapes: { SHOW_TEMPLATE: 'X', HIDE_TAB_EVENT: 'private setting value', PRIVATE_FLAG: 'X' },
    rawSettings: { SECRET: 'private secret' }, response: 'private response' });
  const result = await (await a.post('/inspect-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(result.readStage, readStage); assert.equal(result.schemaIssue, schemaIssue);
  assert.deepEqual(result.schemaIssues, [{ readStage, schemaIssue }]);
  assert.deepEqual(result.settingShapes, { SHOW_TEMPLATE: 'X' });
  assert.equal(result.reason, 'unsupported_tss'); assert.equal(result.state, 'ready');
  assert.equal(result.directBookingEnabled, false); assert.equal(owned.bookCalls, 0);
  assert.equal(JSON.stringify(result).toLowerCase().includes('private'), false);
  owned.inspectDirect = async () => ({ loaded: false, ready: false, readStage: 'private value', schemaIssue: 'private value', schemaIssues: 'private value', settingShapes: ['private value'] });
  const unknown = await (await a.post('/verify-direct', { route: DEFAULT_ROUTE })).json();
  for (const name of ['readStage', 'schemaIssue', 'schemaIssues', 'settingShapes']) assert.equal(unknown[name], undefined);
  assert.equal(JSON.stringify(unknown).toLowerCase().includes('private'), false);
});

test('comparison exports boolean eligibility and all seven fixed notes without native data', async () => {
  const f = fixture({ DIRECT_BOOKING_ENABLED: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  assert.equal(DIRECT_PREPARATION_NOTES.length, 7);
  for (const bookingEligible of [true, false, 'true', 'private-token', 1, null, { private: 'student' }]) {
    owned.inspectDirect = async () => ({ loaded: true, ready: true, equivalent: true, bookingEligible,
      preparationNotes: ['private note', ...DIRECT_PREPARATION_NOTES, ...DIRECT_PREPARATION_NOTES, { private: 'response' }],
      rawPayload: 'private student data', enrollment: 'private raw response' });
    const result = await (await a.post('/verify-direct', { route: DEFAULT_ROUTE })).json();
    assert.equal(result.bookingEligible, typeof bookingEligible === 'boolean' ? bookingEligible : undefined);
    assert.deepEqual(result.preparationNotes, DIRECT_PREPARATION_NOTES);
    assert.equal(result.equivalent, true); assert.equal(result.directBookingEnabled, false);
    assert.doesNotMatch(JSON.stringify(result), /private/);
  }
  owned.inspectDirect = async () => ({ loaded: true, ready: true, bookingEligible: true });
  const inspection = await (await a.post('/inspect-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(inspection.bookingEligible, undefined); assert.equal(owned.bookCalls, 0);
});

test('native path verification exports only the fixed path enum and a boolean flag', async () => {
  const f = fixture({ DIRECT_BOOKING_ENABLED: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  for (const nativeBookingPath of ['standard', 'top_module', 'unknown']) {
    owned.inspectDirect = async () => ({ loaded: true, ready: true, equivalent: true, nativeBookingPath, dataTopModuleEnabled: true,
      nativeSettings: 'private model contents' });
    const result = await (await a.post('/verify-direct', { route: DEFAULT_ROUTE })).json();
    assert.equal(result.nativeBookingPath, nativeBookingPath); assert.equal(result.dataTopModuleEnabled, true);
    assert.equal(result.directBookingEnabled, false); assert.equal(JSON.stringify(result).includes('private'), false);
  }
  owned.inspectDirect = async () => ({ loaded: true, ready: true, nativeBookingPath: 'private model value', dataTopModuleEnabled: 'X' });
  const invalid = await (await a.post('/verify-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(invalid.nativeBookingPath, undefined); assert.equal(invalid.dataTopModuleEnabled, undefined);
  owned.inspectDirect = async () => ({ loaded: true, ready: true, nativeBookingPath: 'standard', dataTopModuleEnabled: false });
  const falseFlag = await (await a.post('/verify-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(falseFlag.dataTopModuleEnabled, false);
  const inspection = await (await a.post('/inspect-direct', { route: DEFAULT_ROUTE })).json();
  assert.equal(inspection.nativeBookingPath, undefined); assert.equal(inspection.dataTopModuleEnabled, undefined);
  assert.equal(owned.bookCalls, 0);
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

test('probe keeps one browser and 150 reserved minutes even with production-sized configuration', async () => {
  const f = fixture({ MAX_BROWSER_SESSIONS: '8', MONTHLY_BROWSER_MINUTES: '600' });
  const first = await f.client(), blocked = await f.client();
  assert.equal((await first.post('/login')).status, 200);
  assert.equal((await blocked.post('/login')).status, 429);
  await first.post('/logout');
  for (let index = 1; index < 10; index++) {
    const client = await f.client();
    assert.equal((await client.post('/login')).status, 200);
    assert.equal((await client.post('/logout')).status, 200);
  }
  const exhausted = await f.client();
  const response = await exhausted.post('/login');
  assert.equal(response.status, 429); assert.equal((await response.json()).failureStage, 'quota_budget');
  assert.equal(f.count(), 10);
});

test('raising configured probe budget from 90 to 150 permits only four additional full reservations', async () => {
  const f = fixture();
  const launchAndClose = async () => {
    const client = await f.client();
    assert.equal((await client.post('/login')).status, 200);
    assert.equal((await client.post('/logout')).status, 200);
  };
  for (let index = 0; index < 6; index++) await launchAndClose();
  const blocked = await f.client();
  assert.equal((await blocked.post('/login')).status, 429); assert.equal(f.count(), 6);
  f.env.MONTHLY_BROWSER_MINUTES = '150';
  for (let index = 0; index < 4; index++) await launchAndClose();
  assert.equal((await blocked.post('/login')).status, 429); assert.equal(f.count(), 10);
  assert.equal((await blocked.post('/book', { route: DEFAULT_ROUTE })).status, 403);
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
  assert.deepEqual(await response.json(), { ok: true, probeOnly: true, directBookingEnabled: false, build: BUILD_VERSION });
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

test('late negative auth poll cannot close a session freshly proven by a completed inspection', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  await a.get();
  let release;
  owned.authenticated = ({ fresh } = {}) => fresh ? Promise.resolve(true) : new Promise(resolve => { release = resolve; });
  const staleStatus = a.get();
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await (await a.post('/inspect', { route: DEFAULT_ROUTE })).json()).state, 'ready');
  release(false);
  const result = await (await staleStatus).json();
  assert.equal(result.state, 'ready'); assert.equal(owned.closed, false); assert.equal(f.live.size, 1);
});

test('stale auth timeout cannot revoke a newer proof and next poll does not reuse stale work', async () => {
  const f = fixture(); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0], core = [...f.sessions.values()][0];
  owned.signedIn = true; await a.get(); core.statusTimeoutMs = 100;
  let started = false;
  owned.authenticated = ({ fresh } = {}) => { if (fresh) return Promise.resolve('authenticated'); started = true; return new Promise(() => {}); };
  const oldPoll = a.get();
  while (!started) await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((await (await a.post('/inspect', { route: DEFAULT_ROUTE })).json()).state, 'ready');
  const oldResult = await (await oldPoll).json();
  assert.equal(oldResult.state, 'ready'); assert.equal(oldResult.failureStage, undefined);
  owned.authenticated = async () => 'authenticated';
  assert.equal((await (await a.get()).json()).state, 'ready'); assert.equal(owned.closed, false);
});

test('unavailable and unauthenticated proofs revoke readiness without destroying owned login', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.authenticated = async () => 'authenticated';
  assert.equal((await (await a.get()).json()).state, 'ready');
  owned.authenticated = async () => 'unavailable';
  const unavailable = await (await a.get()).json();
  assert.equal(unavailable.state, 'signing_in'); assert.equal(owned.closed, false);
  const stopped = await a.post('/book', { route: DEFAULT_ROUTE });
  assert.equal(stopped.status, 503); assert.equal((await stopped.json()).reason, 'authentication_unavailable');
  assert.equal(owned.bookCalls, 0); assert.equal(owned.closed, false);
  owned.authenticated = async () => 'unauthenticated';
  const signedOut = await a.post('/book', { route: DEFAULT_ROUTE });
  assert.equal(signedOut.status, 401); assert.equal((await signedOut.json()).reason, 'authentication_required');
  assert.equal((await (await a.get()).json()).state, 'signing_in'); assert.equal(owned.closed, false);
  owned.authenticated = async () => 'authenticated';
  assert.equal((await (await a.get()).json()).state, 'ready'); assert.equal(f.count(), 1);
});

test('unknown proof and connected transport errors fail closed without discarding login', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.connected = () => true;
  for (const operation of [async () => 'unexpected', async () => { throw Error('private transient protocol failure'); }]) {
    owned.authenticated = operation;
    const response = await a.post('/book', { route: DEFAULT_ROUTE });
    const result = await response.json();
    assert.equal(response.status, 503); assert.equal(result.reason, 'authentication_unavailable');
    assert.equal(owned.closed, false); assert.equal(owned.bookCalls, 0); assert.equal(JSON.stringify(result).includes('private'), false);
  }
});

test('fresh authentication completing after absolute expiry cannot revive readiness or Book', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; let release;
  owned.authenticated = () => new Promise(resolve => { release = resolve; });
  const booking = a.post('/book', { route: DEFAULT_ROUTE });
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  f.advance(15 * 60_000); release('authenticated');
  const response = await booking;
  assert.equal(response.status, 401); assert.equal((await response.json()).state, 'expired');
  assert.equal(owned.bookCalls, 0); assert.equal(owned.closed, true);
});

test('status authentication completing beyond lifetime expires even before the alarm runs', async () => {
  for (const outcome of ['authenticated', 'unavailable']) {
    const f = fixture(); const a = await f.client(); await a.post('/login');
    const owned = [...f.live.values()][0]; let release;
    owned.authenticated = () => new Promise(resolve => { release = resolve; });
    const status = a.get();
    while (!release) await new Promise(resolve => setTimeout(resolve, 0));
    f.advance(15 * 60_000); release(outcome);
    const result = await (await status).json();
    assert.equal(result.state, 'expired'); assert.equal(owned.closed, true); assert.equal(result.expiresAt, undefined);
  }
});

test('booking status arriving after expiry preserves an uncertain terminal result', async () => {
  const f = fixture({ PROBE_ONLY: 'false' }); const a = await f.client(); await a.post('/login');
  const owned = [...f.live.values()][0]; owned.signedIn = true;
  const requestId = uuid();
  await a.post('/book', { route: DEFAULT_ROUTE, requestId });
  let release;
  owned.bookingStatus = () => new Promise(resolve => { release = resolve; });
  const status = a.get();
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  f.advance(15 * 60_000); release({ stage: 'submitted' });
  const result = await (await status).json();
  assert.equal(result.state, 'expired'); assert.equal(owned.closed, true);
  assert.deepEqual(result.booking, { requestId, stage: 'error', reason: 'session_expired' });
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
  assert.equal(data.failureStage, 'authentication'); assert.equal(data.failure.code, 'authentication_unavailable'); assert.deepEqual(data.diagnostics, diagnostics);
  assert.equal(data.state, 'signing_in'); assert.equal(owned.closed, false);
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
