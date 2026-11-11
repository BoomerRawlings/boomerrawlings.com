import test from 'node:test';
import assert from 'node:assert/strict';
import { openManagedBrowser, rendererPreflight, rendererHandoffPreflight, PROTOCOL_TIMEOUT_MS, loadCourse, createBrowserController } from '../src/browser.mjs';
import { DEFAULT_ROUTE, BOOKING_ROUTES, VERIFIED_STANDARD_ROUTES } from '../src/routes.mjs';
import { createAuthTrace } from '../src/auth-trace.mjs';
import { safeAuthDiagnostics } from '../src/diagnostics.mjs';

async function withVerifiedRoutes(routes, run) {
  const original = [...VERIFIED_STANDARD_ROUTES];
  VERIFIED_STANDARD_ROUTES.clear();
  for (const route of routes) VERIFIED_STANDARD_ROUTES.add(route);
  try { await run(); } finally {
    VERIFIED_STANDARD_ROUTES.clear();
    for (const route of original) VERIFIED_STANDARD_ROUTES.add(route);
  }
}
const withVerifiedRoute = (route, run) => withVerifiedRoutes([route], run);

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

test('renderer preflight proves a responsive document without Page event subscription', async () => {
  const calls = [];
  const page = { async createCDPSession() { return {
    async send(method, params, options) { calls.push(method); assert.ok(options.timeout > 0 && options.timeout <= 8000); return method === 'Runtime.evaluate' ? { result: { value: true } } : {}; },
    async detach() { calls.push('detach'); },
  }; } };
  await rendererPreflight(page);
  assert.deepEqual(calls, ['Runtime.evaluate', 'detach']);
});

test('renderer preflight rejects hung evaluation and an empty renderer', async () => {
  await assert.rejects(rendererPreflight({ async createCDPSession() { return {
    send: () => new Promise(() => {}), detach: async () => {},
  }; } }, 5), error => error.stage === 'renderer_preflight' && error.failureDiagnostic.code === 'renderer_timeout' && error.failureDiagnostic.phase === 'evaluate');
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

test('handoff retries one transient preflight on the same page and requires positive DOM proof', async () => {
  // Test retry policy independently of runner contention; the tests above
  // exercise genuinely hung commands and the bounded preflight deadline.
  for (const firstFailure of ['timeout', 'navigation']) {
    let sessions = 0, detaches = 0;
    const calls = [];
    const page = { async createCDPSession() {
      const attempt = ++sessions;
      return { async send(method) {
        calls.push({ attempt, method });
        if (attempt === 1) {
          if (firstFailure === 'timeout') throw Object.assign(Error('Protocol command timed out'), { name: 'TimeoutError' });
          throw Error('Execution context was destroyed');
        }
        return method === 'Runtime.evaluate' ? { result: { value: true } } : {};
      }, async detach() { detaches++; } };
    } };
    await rendererHandoffPreflight(page, 5000, 0);
    assert.equal(sessions, 2); assert.equal(detaches, 2);
    assert.deepEqual(calls, [{ attempt: 1, method: 'Runtime.evaluate' }, { attempt: 2, method: 'Runtime.evaluate' }]);
  }
});

test('handoff never loops, retries permanent failures, or accepts an empty second renderer', async () => {
  for (const kind of ['always_timeout', 'empty_second', 'empty_first', 'protocol']) {
    let sessions = 0;
    const page = { async createCDPSession() {
      const attempt = ++sessions;
      return { async send(method) {
        if (kind === 'always_timeout') throw Object.assign(Error('Protocol command timed out'), { name: 'TimeoutError' });
        if (kind === 'protocol') throw Error('Unsupported protocol command');
        if (kind === 'empty_second' && attempt === 1) throw Error('Execution context was destroyed');
        return method === 'Runtime.evaluate' ? { result: { value: false } } : {};
      }, async detach() {} };
    } };
    await assert.rejects(rendererHandoffPreflight(page, 5000, 0), error => error.stage === 'renderer_preflight');
    assert.equal(sessions, ['always_timeout', 'empty_second'].includes(kind) ? 2 : 1);
  }
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

function controllerFixture(envOptions = {}, controllerOptions = {}) {
  let current = 'about:blank', guard, csrfCalls = 0, bookCalls = 0;
  const operations = [], navigations = [], lifecycle = [], cdpCalls = [], diagnosticEvents = new Map(), pageEvents = new Map();
  const responses = { book: { stage: 'stopped', reason: 'existing_registration', message: 'private native message' }, status: { stage: 'error', reason: 'request_check_failed' } };
  const mainFrame = {};
  const page = { url: () => current, on: (name, fn) => pageEvents.set(name, fn), mainFrame: () => mainFrame,
    async setViewport(value) { assert.equal(current, 'about:blank'); lifecycle.push({ viewport: value }); },
    async goto(route) { lifecycle.push({ navigation: route }); current = route; navigations.push(route); pageEvents.get('framenavigated')?.(mainFrame); }, setDefaultTimeout() {}, setDefaultNavigationTimeout() {}, isClosed: () => false,
    async createCDPSession() { return { on: (name, handler) => diagnosticEvents.set(name, handler), async send(method) {
      cdpCalls.push(method);
      if (method === 'Runtime.evaluate' && responses.preflightFailure) throw responses.preflightFailure;
      if (method === 'Target.getTargetInfo' && responses.targetProbeFailure) throw responses.targetProbeFailure;
      return method === 'Target.getTargetInfo' ? { targetInfo: { targetId: 'synthetic' } } : { result: { value: true } };
    }, async detach() {} }; },
    async evaluate(fn, input) {
      operations.push({ name: fn.name, input });
      if (fn.name === 'authenticationProbe') { csrfCalls++; return responses.authentication ? responses.authentication(input) : { status: 'authenticated', page: 'tss' }; }
      if (input.operation === 'authenticated') return true;
      if (input.operation === 'csrf') { csrfCalls++; return true; }
      if (input.operation === 'inspect') return { loaded: true, ready: true };
      if (input.operation === 'compareNative') return { loaded: true, ready: true, equivalent: true, nativeBookingPath: 'standard' };
      if (input.operation === 'book') { bookCalls++; return responses.book; }
      if (input.operation === 'status') return responses.status;
      if (input.operation === 'confirm' || input.operation === 'cancel') return responses.review ? responses.review(input) : { stage: input.operation === 'confirm' ? 'submitting' : 'stopped' };
      assert.fail('Unexpected evaluation');
    },
  };
  const browser = { connected: true, on() {}, newPage: async () => page, close: async () => {} };
  const controller = createBrowserController({ PROBE_ONLY: 'false', BROWSER: { closeSession: async () => {} }, ...envOptions }, {
    openBrowser: async () => ({ browser, id: 'synthetic' }), installGuard: async (_, options) => { guard = options; return {}; },
    ...controllerOptions,
  });
  return { controller, responses, operations, navigations, lifecycle, cdpCalls, diagnosticEvents, navigate: url => page.goto(url), job: () => guard.getJob(), csrfCalls: () => csrfCalls, bookCalls: () => bookCalls, blocked: value => guard.onBlocked(value) };
}

test('handoff failure captures guard evidence and bounded target liveness without renderer details', async () => {
  for (const [failure, expected] of [[null,'responsive'],[Object.assign(Error('private target timeout'),{name:'TimeoutError'}),'timeout'],[Error('private closed transport'),'unavailable']]) {
    const f=controllerFixture({}, {installGuard:async()=>({
      diagnostics:()=>({pendingCount:1,pending:[{resourceType:'Document',phase:'response_body',ageMs:8000,url:'private-token'}],body:'private-body'}),
      authTrace:()=>[{kind:'document_response',destination:'tss_proxy',resourceType:'Document',status:200,method:'GET',route:'other',atMs:0,count:1,url:'private-url'}],
    })});
    const controller=await f.controller;
    f.responses.preflightFailure=Error('private renderer unavailable');f.responses.targetProbeFailure=failure;
    await assert.rejects(controller.loginUrl(),error=>{
      assert.equal(error.stage,'renderer_preflight');assert.equal(error.authDiagnostics.targetProbe,expected);
      assert.deepEqual(error.authDiagnostics.guard,{pendingCount:1,pending:[{resourceType:'Document',phase:'response_body',ageMs:8000}]});
      assert.equal(error.authDiagnostics.trace.length,1);assert.doesNotMatch(JSON.stringify(error.authDiagnostics),/private/);
      return true;
    });
    assert.equal(f.cdpCalls.filter(method=>method==='Target.getTargetInfo').length,2);
    assert.equal(f.navigations.length,1);
  }
});

test('viewer viewport applies before initial navigation and never on another handoff', async () => {
  const f = controllerFixture({ BROWSER: { closeSession: async () => {}, async getLiveView() { return { devtoolsFrontendUrl: 'https://live.browser.run/ui/view?mode=tab' }; } } },
    { viewport: { width: 509, height: 1000 } });
  const controller = await f.controller;
  assert.deepEqual(f.lifecycle, [{ viewport: { width: 509, height: 1000, deviceScaleFactor: 1 } }, { navigation: 'https://tss.ucsd.edu/fiori' }]);
  assert.equal(f.cdpCalls.includes('Runtime.evaluate'), false); // No redundant creation probe.
  await controller.loginUrl(); await controller.loginUrl();
  assert.equal(f.lifecycle.length, 2);
  assert.equal(f.cdpCalls.filter(method => method === 'Runtime.evaluate').length, 2); // One positive proof per handoff.
  assert.equal(f.cdpCalls.includes('Page.enable'), false);
  const fallback = controllerFixture(); await fallback.controller;
  assert.equal(fallback.lifecycle.some(item => item.viewport), false);
});

test('controller rejects unsupported viewport options before launching a browser', async () => {
  let launches = 0;
  await assert.rejects(createBrowserController({}, { viewport: { width: 390, height: 780, isMobile: true },
    openBrowser: async () => { launches++; throw Error('must not launch'); } }), /Invalid login viewport/);
  assert.equal(launches, 0);
});

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

test('direct mode never loads a course page and keeps one guard job through explicit confirmation', async () => withVerifiedRoute(DEFAULT_ROUTE, async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
  f.responses.book = { stage: 'checking' };
  await controller.authenticated({ fresh: true });
  await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'owned-job');
  const job = f.job(); assert.equal(job.mode, 'direct'); assert.equal(job.requestId, 'owned-job');
  assert.deepEqual(f.navigations, ['https://tss.ucsd.edu/fiori']);
  assert.ok(f.operations.every(value => ['directTssOperation', 'authenticationProbe'].includes(value.name)));
  assert.equal(f.operations.find(value => value.input.operation === 'book').input.allowWrites, true);
  assert.equal(f.operations.find(value => value.input.operation === 'book').input.standardNativeVerified, true);
  f.responses.status = { stage: 'review', reviewMessage: 'Official plain warning', confirmationId: crypto.randomUUID() };
  const review = await controller.bookingStatus('owned-job'); assert.equal(review.reviewMessage, 'Official plain warning');
  assert.equal((await controller.reviewBooking('confirm', 'another-job', review.confirmationId)).reason, 'attempt_unavailable');
  assert.equal((await controller.reviewBooking('confirm', 'owned-job', review.confirmationId)).stage, 'submitting');
  assert.equal(f.job(), job);
  assert.equal((await controller.reviewBooking('cancel', 'owned-job', review.confirmationId)).stage, 'stopped');
  assert.equal(f.job(), null);
}));

test('direct catalog routes remain disabled until server-owned exact-route proof is added', async () => withVerifiedRoutes([], async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
  await controller.authenticated({ fresh: true });
  for (const [route, { courseCode }] of BOOKING_ROUTES) {
    assert.deepEqual(await controller.book(route, courseCode, 'unverified'), { stage: 'stopped', reason: 'unsupported_tss' });
  }
  assert.equal((await controller.book(DEFAULT_ROUTE.replace('166528', '999999'), 'PHIL-010', 'unknown')).reason, 'route_mismatch');
  assert.equal((await controller.book(DEFAULT_ROUTE, 'ECON-100A', 'wrong-code')).reason, 'route_mismatch');
  assert.equal(f.bookCalls(), 0); assert.equal(f.job(), null);
  assert.deepEqual(f.navigations, ['https://tss.ucsd.edu/fiori']);
  assert.ok(f.operations.every(value => value.name === 'authenticationProbe'));
  const proof = await controller.inspectDirect(DEFAULT_ROUTE, 'PHIL-010', true);
  assert.equal(proof.equivalent, true); assert.equal(VERIFIED_STANDARD_ROUTES.size, 0);
  const navigations = f.navigations.length;
  await controller.authenticated({ fresh: true });
  assert.equal((await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'after-comparison')).reason, 'unsupported_tss');
  assert.equal(f.navigations.length, navigations); assert.equal(f.bookCalls(), 0);
}));

test('proof for one package cannot enable another package of the same course', async () => {
  const econ = [...BOOKING_ROUTES].filter(([, item]) => item.courseCode === 'ECON-100A');
  await withVerifiedRoute(econ[0][0], async () => {
    const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
    await controller.authenticated({ fresh: true });
    assert.equal((await controller.book(econ[1][0], 'ECON-100A', 'other-package')).reason, 'unsupported_tss');
    assert.equal(f.bookCalls(), 0); assert.equal(f.job(), null);
    assert.deepEqual(f.navigations, ['https://tss.ucsd.edu/fiori']);
  });
});

test('direct writes require explicit true flag and remain blocked in probe mode', async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true', PROBE_ONLY: 'true' }), controller = await f.controller;
  await controller.authenticated({ fresh: true });
  await assert.rejects(controller.book(DEFAULT_ROUTE, 'PHIL-010', 'probe'), /Booking unavailable/);
  assert.equal(f.bookCalls(), 0);
  assert.equal((await controller.reviewBooking('confirm', 'probe', crypto.randomUUID())).reason, 'attempt_unavailable');
});

test('delayed confirmation survives terminal status and cannot clear a replacement job', async () => withVerifiedRoute(DEFAULT_ROUTE, async () => {
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
  assert.deepEqual(await controller.bookingStatus('first'), { stage: 'submitted' });
  assert.equal(f.job(), replacement);
}));

test('a terminal direct poll discarded during confirmation remains available to the next poll', async () => withVerifiedRoute(DEFAULT_ROUTE, async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
  f.responses.book = { stage: 'checking' };
  await controller.authenticated({ fresh: true }); await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'owned');
  let finishPoll;
  f.responses.status = new Promise(resolve => { finishPoll = resolve; });
  const stalePoll = controller.bookingStatus('owned');
  assert.equal((await controller.reviewBooking('confirm', 'owned', crypto.randomUUID())).stage, 'submitting');
  finishPoll({ stage: 'submitted', outcome: 'booked', noticeMessage: 'Bounded official notice', privatePayload: 'never-export' });
  await stalePoll; // SessionCore discards this poll because confirmation changed its revision.
  assert.equal(f.job(), null);
  const operationCount = f.operations.length;
  const expected = { stage: 'submitted', outcome: 'booked', noticeMessage: 'Bounded official notice' };
  const recovered = await controller.bookingStatus('owned');
  assert.deepEqual(recovered, expected);
  recovered.noticeMessage = 'caller mutation';
  assert.deepEqual(await controller.bookingStatus('owned'), expected);
  assert.deepEqual(await controller.reviewBooking('confirm', 'owned', crypto.randomUUID()), expected);
  assert.deepEqual(await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'owned'), expected);
  assert.equal(f.operations.length, operationCount); assert.equal(f.bookCalls(), 1);
}));

test('terminal direct cache is bounded, request-correlated and cleared with the controller', async () => withVerifiedRoute(DEFAULT_ROUTE, async () => {
  const f = controllerFixture({ DIRECT_BOOKING_ENABLED: 'true' }), controller = await f.controller;
  await controller.authenticated({ fresh: true });
  for (let n = 0; n < 10; n++) {
    f.responses.book = { stage: 'submitted', outcome: 'waitlisted', noticeMessage: 'notice-' + n, rawPayload: 'never-export' };
    await controller.book(DEFAULT_ROUTE, 'PHIL-010', 'attempt-' + n);
  }
  const operationCount = f.operations.length;
  for (const id of ['attempt-0', 'attempt-1', 'unknown']) assert.deepEqual(await controller.bookingStatus(id), { stage: 'stopped', reason: 'attempt_unavailable' });
  for (let n = 2; n < 10; n++) assert.deepEqual(await controller.bookingStatus('attempt-' + n), { stage: 'submitted', outcome: 'waitlisted', noticeMessage: 'notice-' + n });
  assert.equal(f.operations.length, operationCount); // Never invokes the native adapter.
  await controller.close();
  assert.deepEqual(await controller.bookingStatus('attempt-9'), { stage: 'stopped', reason: 'session_unavailable' });
}));

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

test('normal status includes guard progress and passive Duo completion without new browser commands', async () => {
  const trace = createAuthTrace(() => 1000);
  const f = controllerFixture({}, { installGuard: async () => ({ recordRequestTrace: trace.record, authTrace: trace.snapshot,
    diagnostics: () => ({ pendingCount: 1, pending: [{ resourceType: 'Document', phase: 'response_body', ageMs: 3210, url: 'private-url' }] }),
  }) });
  const controller = await f.controller, initialCommands = [...f.cdpCalls];
  f.diagnosticEvents.get('Network.requestWillBeSent')({ requestId: 'private-id', type: 'XHR', request: {
    url: 'https://api-ce13a1a7.duosecurity.com/prompt/private?private-token=secret', method: 'POST', postData: 'private-credentials' } });
  f.diagnosticEvents.get('Network.responseReceived')({ requestId: 'private-id', response: { status: 200, headers: { 'Set-Cookie': 'private-cookie' } } });
  f.diagnosticEvents.get('Network.loadingFinished')({ requestId: 'private-id' });
  const safe = safeAuthDiagnostics({}, controller.authDiagnostics());
  assert.deepEqual(safe.guard, { pendingCount: 1, pending: [{ resourceType: 'Document', phase: 'response_body', ageMs: 3210 }] });
  assert.equal(safe.trace.length, 1); assert.equal(safe.trace[0].kind, 'request_complete'); assert.equal(safe.trace[0].status, 200);
  assert.deepEqual(f.cdpCalls, initialCommands); assert.equal(f.operations.length, 0); assert.equal(f.navigations.length, 1);
  assert.doesNotMatch(JSON.stringify(safe), /private|secret|https/);
  await controller.close();
});

test('login handoff preserves classified preflight failure without raw cause', async () => {
  const transient = controllerFixture();
  const transientController = await transient.controller;
  transient.responses.preflightFailure = Error('Execution context was destroyed; private startup detail');
  await assert.rejects(transientController.loginUrl(), error => error.stage === 'renderer_preflight'
    && error.failureDiagnostic.code === 'navigation_context' && error.failureDiagnostic.phase === 'evaluate' && !JSON.stringify(error).includes('private'));
  assert.equal(transient.cdpCalls.filter(method => method === 'Runtime.evaluate').length, 2);
  const handoff = controllerFixture(), controller = await handoff.controller;
  handoff.responses.preflightFailure = Error('Protocol command failed; private handoff detail');
  await assert.rejects(controller.loginUrl(), error => error.stage === 'renderer_preflight'
    && error.failureDiagnostic.code === 'renderer_protocol_error' && error.failureDiagnostic.phase === 'evaluate' && !JSON.stringify(error).includes('private'));
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

test('account name follows the same current authentication proof and never survives navigation or auth loss', async () => {
  const f = controllerFixture(), controller = await f.controller;
  assert.equal(controller.accountName(), undefined);
  f.responses.authentication = () => ({ status: 'authenticated', page: 'tss', displayName: 'Jane Example' });
  await controller.authenticated({ fresh: true });
  assert.equal(controller.accountName(), 'Jane Example');
  await controller.authenticated(); assert.equal(f.csrfCalls(), 1);
  await f.navigate('https://tss.ucsd.edu/fiori#another-page');
  assert.equal(controller.accountName(), undefined);
  let oldProof;
  f.responses.authentication = () => new Promise(resolve => { oldProof = resolve; });
  const old = controller.authenticated({ fresh: true });
  f.responses.authentication = () => ({ status: 'authenticated', page: 'tss', displayName: 'Other Example' });
  await controller.authenticated({ fresh: true });
  oldProof({ status: 'authenticated', page: 'tss', displayName: 'Stale Example' });
  assert.equal(await old, 'unavailable'); assert.equal(controller.accountName(), 'Other Example');
  for (const status of ['unavailable', 'unauthenticated']) {
    f.responses.authentication = () => ({ status, page: 'tss', displayName: 'Stale Example' });
    await controller.authenticated({ fresh: true }); assert.equal(controller.accountName(), undefined);
  }
  f.responses.authentication = () => ({ status: 'authenticated', page: 'tss', displayName: 'name@example.test' });
  assert.equal(await controller.authenticated({ fresh: true }), 'authenticated'); assert.equal(controller.accountName(), undefined);
  f.responses.authentication = () => ({ status: 'authenticated', page: 'tss', displayName: 'Jane Example' });
  await controller.authenticated({ fresh: true });
  f.responses.authentication = () => { throw Error('synthetic failed probe'); };
  await assert.rejects(controller.authenticated({ fresh: true })); assert.equal(controller.accountName(), undefined);
  f.responses.authentication = () => ({ status: 'authenticated', page: 'tss', displayName: 'Jane Example' });
  await controller.authenticated({ fresh: true }); await controller.close(); assert.equal(controller.accountName(), undefined);
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
