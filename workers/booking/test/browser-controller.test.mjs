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
    async send(method) { calls.push(method); return method === 'Runtime.evaluate' ? { result: { value: true } } : {}; },
    async detach() { calls.push('detach'); },
  }; } };
  await rendererPreflight(page);
  assert.deepEqual(calls, ['Page.enable', 'Runtime.evaluate', 'detach']);
});

test('renderer preflight rejects hung Page.enable and an empty renderer', async () => {
  await assert.rejects(rendererPreflight({ async createCDPSession() { return {
    send: () => new Promise(() => {}), detach: async () => {},
  }; } }, 5), error => error.stage === 'renderer_preflight');
  await assert.rejects(rendererPreflight({ async createCDPSession() { return {
    send: async () => ({ result: { value: false } }), detach: async () => {},
  }; } }), error => error.stage === 'renderer_preflight');
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
  const operations = [], navigations = [], diagnosticEvents = new Map();
  const responses = { book: { stage: 'stopped', reason: 'existing_registration', message: 'private native message' }, status: { stage: 'error', reason: 'request_check_failed' } };
  const page = { url: () => current, async goto(route) { current = route; navigations.push(route); }, setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, isClosed: () => false,
    async createCDPSession() { return { on: (name, handler) => diagnosticEvents.set(name, handler), async send(method) { return method === 'Target.getTargetInfo' ? { targetInfo: { targetId: 'synthetic' } } : { result: { value: true } }; }, async detach() {} }; },
    async evaluate(fn, input) {
      operations.push({ name: fn.name, input });
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
  return { controller, responses, operations, navigations, diagnosticEvents, job: () => guard.getJob(), csrfCalls: () => csrfCalls, bookCalls: () => bookCalls, blocked: value => guard.onBlocked(value) };
}

test('Book reuses fresh auth proof and releases immediate stopped jobs', async () => {
  const f = controllerFixture(), controller = await f.controller;
  assert.equal((await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'unauthenticated')).reason, 'authentication_required');
  assert.equal(f.bookCalls(), 0);
  await controller.authenticated({ fresh: true });
  const stopped = await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'first');
  assert.deepEqual(stopped, { stage: 'stopped', reason: 'existing_registration' });
  await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'second');
  assert.equal(f.bookCalls(), 2); assert.equal(f.csrfCalls(), 1);
});

test('blocked TSS action remains correlated through terminal status without raw diagnostics', async () => {
  const f = controllerFixture(), controller = await f.controller;
  f.responses.book = { stage: 'checking' };
  await controller.authenticated({ fresh: true }); await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'attempt');
  f.blocked({ hostname: 'tss.ucsd.edu', pathname: '/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/$batch', method: 'POST' });
  assert.deepEqual(await controller.bookingStatus('attempt'), { stage: 'error', reason: 'request_blocked' });
  f.responses.book = { stage: 'stopped', reason: 'private unknown reason', message: 'private message' };
  assert.deepEqual(await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'next'), { stage: 'stopped' });
});

test('direct mode never loads a course page and keeps one guard job through explicit confirmation', async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
  f.responses.book = { stage: 'checking' };
  await controller.authenticated({ fresh: true });
  await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'owned-job');
  const job = f.job(); assert.equal(job.mode, 'direct'); assert.equal(job.requestId, 'owned-job');
  assert.deepEqual(f.navigations, ['https://tss.ucsd.edu/fiori']);
  assert.ok(f.operations.every(value => value.name === 'directTssOperation'));
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
