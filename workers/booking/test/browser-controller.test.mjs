import test from 'node:test';
import assert from 'node:assert/strict';
import { openManagedBrowser, rendererPreflight, PROTOCOL_TIMEOUT_MS, loadCourse, createBrowserController } from '../src/browser.mjs';
import { DEFAULT_ROUTE } from '../src/routes.mjs';

test('managed transport applies real protocol timeout and full login idle lifetime', async () => {
  let launchOptions, connectOptions, accepted = false;
  const listeners = new Map();
  const socket = { accept() { accepted = true; }, send() {}, close() {}, addEventListener(name, fn) { listeners.set(name, fn); } };
  const expected = { connected: true };
  const env = { BROWSER: { async launch(options) { launchOptions = options; return { sessionId: 'synthetic', webSocket: {
    async fetch(url, options) { assert.equal(url, 'https://browser-binding.invalid'); assert.equal(options.headers.Upgrade, 'websocket'); return { webSocket: socket }; },
  } }; } } };
  const result = await openManagedBrowser(env, { async connect(options) { connectOptions = options; return expected; } });
  assert.equal(result.browser, expected); assert.equal(result.id, 'synthetic'); assert.equal(accepted, true);
  assert.equal(launchOptions.keepAlive, 900000); assert.equal(launchOptions.recording, false);
  assert.equal(connectOptions.protocolTimeout, 20000); assert.equal(PROTOCOL_TIMEOUT_MS, 20000);
  assert.deepEqual(launchOptions.guardrails.allowedDomains, ['ucsd.edu', '*.ucsd.edu', 'duosecurity.com', '*.duosecurity.com']);
  let message; connectOptions.transport.onmessage = value => { message = value; };
  listeners.get('message')({ data: 'synthetic-cdp' }); assert.equal(message, 'synthetic-cdp');
  let closes = 0; connectOptions.transport.onclose = () => { closes++; };
  listeners.get('error')(); listeners.get('close')(); assert.equal(closes, 1);
  assert.throws(() => connectOptions.transport.send('late'), /transport closed/);
});

test('renderer preflight confirms Page.enable and a responsive document before handing off', async () => {
  const calls = [];
  const page = { async createCDPSession() { return {
    async send(method, params, options) { calls.push(method); assert.ok(options.timeout > 0 && options.timeout <= 8000); return method === 'Runtime.evaluate' ? { result: { value: true } } : {}; },
    async detach() { calls.push('detach'); },
  }; } };
  await rendererPreflight(page);
  assert.deepEqual(calls, ['Page.enable', 'Runtime.evaluate', 'detach']);
});

test('renderer preflight rejects hung Page.enable and an empty renderer', async () => {
  await assert.rejects(rendererPreflight({ async createCDPSession() { return {
    send: () => new Promise(() => {}), detach: async () => {},
  }; } }, 5), error => error.stage === 'renderer_preflight' && error.failureDiagnostic.code === 'renderer_timeout' && error.failureDiagnostic.phase === 'page_enable');
  await assert.rejects(rendererPreflight({ async createCDPSession() { return {
    send: async () => ({ result: { value: false } }), detach: async () => {},
  }; } }), error => error.stage === 'renderer_preflight' && error.failureDiagnostic.code === 'renderer_dom_not_ready' && error.failureDiagnostic.phase === 'evaluate');
});

test('responsive DOM succeeds even when best-effort detach hangs', async () => {
  let detached = 0;
  await assert.doesNotReject(rendererPreflight({ async createCDPSession() { return {
    send: async () => ({ result: { value: true } }), detach: () => { detached++; return new Promise(() => {}); },
  }; } }, 5));
  assert.equal(detached, 1);
});

test('timed-out attachment never continues renderer commands after returning failure', async () => {
  let attach, detached = 0, commands = 0;
  const attempt = rendererPreflight({ createCDPSession: () => new Promise(resolve => { attach = resolve; }) }, 5);
  await assert.rejects(attempt, error => error.failureDiagnostic.code === 'renderer_timeout' && error.failureDiagnostic.phase === 'attach');
  attach({ send: async () => { commands++; }, detach: async () => { detached++; } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(commands, 0); assert.equal(detached, 1);
});

test('failed CDP connection closes the acquired browser and exposes only fixed stage', async () => {
  let closed;
  const env = { BROWSER: { async launch() { return { sessionId: 'synthetic', webSocket: { async fetch() { return { webSocket: {
    accept() {}, send() {}, close() {}, addEventListener() {},
  } }; } } }; }, async closeSession(id) { closed = id; } } };
  await assert.rejects(openManagedBrowser(env, { async connect() { throw Error('private transport detail'); } }),
    error => error.stage === 'launch' && error.browserId === 'synthetic' && !error.message.includes('private'));
  assert.equal(closed, 'synthetic');
});

test('exact package inspection skips reload; another package navigates once', async () => {
  let current = DEFAULT_ROUTE, navigations = 0, reads = 0;
  const page = { url: () => current, async goto(route) { current = route; navigations++; } };
  const inspect = async () => { reads++; return { loaded: true, ready: true }; };
  assert.equal((await loadCourse(page, DEFAULT_ROUTE, 'PHIL-010', { inspect })).ready, true);
  assert.equal(navigations, 0); assert.equal(reads, 1);
  current = 'https://tss.ucsd.edu/fiori';
  await loadCourse(page, DEFAULT_ROUTE, 'PHIL-010', { inspect });
  assert.equal(navigations, 1); assert.equal(reads, 2);
});

test('course loading bounds an unresponsive inspection and classifies navigation timeouts', async () => {
  const page = { url: () => DEFAULT_ROUTE, goto: async () => assert.fail('Unexpected reload') };
  const result = await loadCourse(page, DEFAULT_ROUTE, 'PHIL-010', { inspect: () => new Promise(() => {}), timeoutMs: 5 });
  assert.deepEqual(result, { loaded: false, ready: false, reason: 'course_load_timeout' });
  const navigation = { url: () => 'https://tss.ucsd.edu/fiori', async goto() { throw Object.assign(Error('Private navigation value'), { name: 'TimeoutError' }); } };
  assert.deepEqual(await loadCourse(navigation, DEFAULT_ROUTE, 'PHIL-010'), result);
});

function controllerFixture(envOptions = {}) {
  let current = 'about:blank', guard, csrfCalls = 0, bookCalls = 0;
  const operations = [], navigations = [], diagnosticEvents = new Map(), pageEvents = new Map();
  const responses = { book: { stage: 'stopped', reason: 'existing_registration', message: 'private native message' }, status: { stage: 'error', reason: 'request_check_failed' } };
  const mainFrame = {};
  const page = { url: () => current, on: (name, fn) => pageEvents.set(name, fn), mainFrame: () => mainFrame,
    async goto(route) { current = route; navigations.push(route); pageEvents.get('framenavigated')?.(mainFrame); }, setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, isClosed: () => false,
    async createCDPSession() { return { on: (name, handler) => diagnosticEvents.set(name, handler), async send(method) {
      if (method === 'Page.enable' && responses.preflightFailure) throw responses.preflightFailure;
      return method === 'Target.getTargetInfo' ? { targetInfo: { targetId: 'synthetic' } } : { result: { value: true } };
    }, async detach() {} }; },
    async evaluate(fn, input) {
      operations.push({ name: fn.name, input });
      if (fn.name === 'authenticationProbe') { csrfCalls++; return responses.authentication ? responses.authentication(input) : { status: 'authenticated', page: 'tss' }; }
      if (input.operation === 'authenticated') return true;
      if (input.operation === 'csrf') { csrfCalls++; return true; }
      if (input.operation === 'inspect') return { loaded: true, ready: true };
      if (input.operation === 'book') { bookCalls++; return responses.book; }
      if (input.operation === 'status') return responses.status;
      if (input.operation === 'confirm' || input.operation === 'cancel') return responses.review ? responses.review(input) : { stage: input.operation === 'confirm' ? 'submitting' : 'stopped' };
      assert.fail('Unexpected evaluation');
    },
  };
  const browser = { connected: true, on() {}, newPage: async () => page, close: async () => {} };
  const controller = createBrowserController({ PROBE_ONLY: 'false', BROWSER: { closeSession: async () => {} }, ...envOptions }, {
    openBrowser: async () => ({ browser, id: 'synthetic' }), installGuard: async (_, options) => { guard = options; return {}; },
  });
  return { controller, responses, operations, navigations, diagnosticEvents, navigate: url => page.goto(url), job: () => guard.getJob(), csrfCalls: () => csrfCalls, bookCalls: () => bookCalls, blocked: value => guard.onBlocked(value) };
}

test('Book reuses fresh auth proof and releases immediate stopped jobs', async () => {
  const f = controllerFixture(), controller = await f.controller;
  assert.equal((await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'unauthenticated')).reason, 'authentication_required');
  assert.equal(f.bookCalls(), 0);
  await controller.authenticated({ fresh: true });
  const stopped = await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'first');
  assert.deepEqual(stopped, { stage: 'stopped', reason: 'existing_registration' });
  assert.equal(f.csrfCalls(), 1); // No extra CSRF fetch inside the booking action.
  await controller.authenticated({ fresh: true });
  await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'second');
  assert.equal(f.bookCalls(), 2); assert.equal(f.csrfCalls(), 2);
});

test('blocked TSS action remains correlated through terminal status without raw diagnostics', async () => {
  const f = controllerFixture(), controller = await f.controller;
  f.responses.book = { stage: 'checking' };
  await controller.authenticated({ fresh: true }); await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'attempt');
  f.blocked({ hostname: 'tss.ucsd.edu', pathname: '/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/$batch', method: 'POST' });
  assert.deepEqual(await controller.bookingStatus('attempt'), { stage: 'error', reason: 'request_blocked' });
  f.responses.book = { stage: 'stopped', reason: 'private unknown reason', message: 'private message' };
  await controller.authenticated({ fresh: true });
  assert.deepEqual(await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'next'), { stage: 'stopped' });
});

test('direct mode never loads a course page and keeps one guard job through explicit confirmation', async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
  f.responses.book = { stage: 'checking' };
  await controller.authenticated({ fresh: true });
  await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'owned-job');
  const job = f.job(); assert.equal(job.mode, 'direct'); assert.equal(job.requestId, 'owned-job');
  assert.deepEqual(f.navigations, ['https://tss.ucsd.edu/fiori']);
  assert.ok(f.operations.every(value => ['directTssOperation', 'authenticationProbe'].includes(value.name)));
  assert.equal(f.operations.find(value => value.input.operation === 'book').input.allowWrites, true);
  f.responses.status = { stage: 'review', reviewMessage: 'Official plain warning', confirmationId: crypto.randomUUID() };
  const review = await controller.bookingStatus('owned-job'); assert.equal(review.reviewMessage, 'Official plain warning');
  assert.equal((await controller.reviewBooking('confirm', 'another-job', review.confirmationId)).reason, 'attempt_unavailable');
  assert.equal((await controller.reviewBooking('confirm', 'owned-job', review.confirmationId)).stage, 'submitting');
  assert.equal(f.job(), job);
  assert.equal((await controller.reviewBooking('cancel', 'owned-job', review.confirmationId)).stage, 'stopped');
  assert.equal(f.job(), null);
});

test('direct writes require explicit true flag and remain blocked in probe mode', async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true', PROBE_ONLY: 'true' }), controller = await f.controller;
  await controller.authenticated({ fresh: true });
  await assert.rejects(controller.book(DEFAULT_ROUTE, 'PHIL-010', 'probe'), /Booking unavailable/);
  assert.equal(f.bookCalls(), 0);
  assert.equal((await controller.reviewBooking('confirm', 'probe', crypto.randomUUID())).reason, 'attempt_unavailable');
});

test('delayed confirmation survives terminal status and cannot clear a replacement job', async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
  f.responses.book = { stage: 'checking' };
  await controller.authenticated({ fresh: true }); await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'first');
  let release;
  f.responses.review = () => new Promise(resolve => { release = resolve; });
  const confirming = controller.reviewBooking('confirm', 'first', crypto.randomUUID());
  while (!release) await new Promise(resolve => setTimeout(resolve, 0));
  f.responses.status = { stage: 'submitted' };
  assert.equal((await controller.bookingStatus('first')).stage, 'submitted'); assert.equal(f.job(), null);
  await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'second');
  const replacement = f.job();
  release({ stage: 'submitted' });
  assert.deepEqual(await confirming, { stage: 'submitted' });
  assert.equal(f.job(), replacement); assert.equal(f.job().requestId, 'second');
});

test('auth diagnostics retain only CSP directive and fixed network failure counts', async () => {
  const f = controllerFixture(), controller = await f.controller;
  f.diagnosticEvents.get('Audits.issueAdded')({ issue: { details: { contentSecurityPolicyIssueDetails: { violatedDirective: "connect-src https: private-token", blockedURL: 'https://private.invalid/secret' } } } });
  f.diagnosticEvents.get('Network.loadingFailed')({ errorText: 'net::ERR_CONNECTION_RESET', requestId: 'private-request' });
  f.diagnosticEvents.get('Network.loadingFailed')({ errorText: 'Unexpected private-token error' });
  const diagnostics = controller.authDiagnostics();
  assert.deepEqual(diagnostics.csp, [{ directive: 'connect-src', count: 1 }]);
  assert.deepEqual(diagnostics.requestFailures, [{ code: 'ERR_CONNECTION_RESET', count: 1 }, { code: 'OTHER', count: 1 }]);
  assert.equal(JSON.stringify(diagnostics).includes('private'), false);
});

test('startup and login handoff preserve classified preflight failure without raw cause', async () => {
  const startup = controllerFixture();
  startup.responses.preflightFailure = Error('Execution context was destroyed; private startup detail');
  await assert.rejects(startup.controller, error => error.stage === 'renderer_preflight'
    && error.failureDiagnostic.code === 'navigation_context' && error.failureDiagnostic.phase === 'page_enable' && !JSON.stringify(error).includes('private'));
  const handoff = controllerFixture(), controller = await handoff.controller;
  handoff.responses.preflightFailure = Error('Protocol command failed; private handoff detail');
  await assert.rejects(controller.loginUrl(), error => error.stage === 'renderer_preflight'
    && error.failureDiagnostic.code === 'renderer_protocol_error' && error.failureDiagnostic.phase === 'page_enable' && !JSON.stringify(error).includes('private'));
});

test('older failed auth probe cannot replace newer successful proof or diagnostics', async () => {
  const f = controllerFixture(), controller = await f.controller;
  let release;
  f.responses.authentication = () => new Promise(resolve => { release = resolve; });
  const old = controller.authenticated({ fresh: true });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  f.responses.authentication = () => ({ status: 'authenticated', page: 'tss' });
  assert.equal(await controller.authenticated({ fresh: true }), 'authenticated');
  release({ status: 'unavailable', page: 'tss', issue: 'network_error' });
  assert.equal(await old, 'unavailable');
  assert.deepEqual(controller.authDiagnostics().authentication, { page: 'tss' });
  assert.equal(await controller.authenticated(), 'authenticated');
  assert.equal(f.csrfCalls(), 2);
  assert.equal((await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'after-old-probe')).reason, 'existing_registration');
});

test('temporary auth unavailability revokes booking proof without becoming success', async () => {
  const f = controllerFixture(), controller = await f.controller;
  await controller.authenticated({ fresh: true });
  f.responses.authentication = () => ({ status: 'unavailable', page: 'tss', issue: 'service_unavailable' });
  assert.equal(await controller.authenticated({ fresh: true }), 'unavailable');
  assert.equal((await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'unavailable')).reason, 'authentication_required');
  assert.equal(f.bookCalls(), 0);
});

test('main-frame navigation invalidates cached authentication and pending checks', async () => {
  const f = controllerFixture(), controller = await f.controller;
  await controller.authenticated();
  await f.navigate('https://tss.ucsd.edu/fiori'); // A same-URL document reload also invalidates proof.
  assert.equal((await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'after-reload')).reason, 'authentication_required');
  let release;
  f.responses.authentication = () => new Promise(resolve => { release = resolve; });
  const old = controller.authenticated({ fresh: true });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  await f.navigate('https://a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO');
  release({ status: 'authenticated', page: 'tss' });
  assert.equal(await old, 'unavailable');
  assert.equal((await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'after-navigation')).reason, 'authentication_required');
});
