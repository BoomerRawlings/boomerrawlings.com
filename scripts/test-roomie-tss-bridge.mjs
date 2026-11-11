import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';

const original = await readFile(new URL('../src/scripts/roomie-tss-bridge.ts', import.meta.url), 'utf8');
const source = (await transform(original, { loader: 'ts', target: 'es2022', format: 'iife' })).code;
const CSRF = 'a'.repeat(48);
const LIVE = 'https://live.browser.run/ui/view?mode=tab&wss=synthetic-private-token';
const route = (moduleId, packageId) => `https://tss.ucsd.edu/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/${moduleId}/00000000/0/0/0/00000000-0000-0000-0000-000000000000/${packageId}/2026/3/?`;
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const response = (body, status = 200, type = 'application/json') => ({ ok: status < 400, status, headers: { get: () => type }, json: async () => structuredClone(body) });

class Target {
  listeners = new Map();
  addEventListener(name, callback) { this.listeners.set(name, [...this.listeners.get(name) || [], callback]); }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) || []) callback(event); }
}
class Element extends Target {
  dataset = {}; disabled = false; hidden = false; textContent = ''; attributes = new Map();
  setAttribute(name, value) { this.attributes.set(name, value); }
  closest() { return this.feedback ? { querySelector: () => this.feedback } : null; }
}

// Whole client, synthetic DOM and same-origin API only. No UCSD account,
// browser, enrollment endpoint or persistent credential store is touched.
function harness(options = {}) {
  const names = ['session', 'session-status', 'job-status', 'login', 'logout', 'inspect', 'review', 'probe-note', 'warning', 'warning-message', 'confirm', 'cancel'];
  const elements = Object.fromEntries(names.map(name => [name, new Element()]));
  const buttons = [new Element(), new Element(), new Element(), new Element()];
  buttons.forEach(button => { button.feedback = new Element(); });
  buttons[0].dataset.bookRoute = route('13043', '166528');
  buttons[1].dataset.bookRoute = route('5379', '164082');
  buttons[2].dataset.bookRoute = 'https://evil.example/book';
  buttons[3].dataset.bookRoute = route('14499', '123456'); buttons[3].disabled = true;
  const calls = [], popups = [], timers = new Map(), handlers = new Map();
  let now = 1000, timerId = 0, requestId = 0, storageTouches = 0;
  let status = { state: 'signed_out', csrf: CSRF, probeOnly: true, ...options.status };
  let popupBlocked = false;
  const document = new Target(); document.visibilityState = 'visible';
  document.querySelector = selector => elements[/^\[data-tss-(.+)\]$/.exec(selector)?.[1]] || null;
  document.querySelectorAll = selector => selector === '[data-tss-book]' ? buttons : [];
  const window = new Target();
  window.open = () => {
    if (popupBlocked) return null;
    const popup = { closed: false, opener: window, urls: [], location: { replace(url) { popup.urls.push(url); } }, close() { this.closed = true; }, focus() {} };
    popups.push(popup); return popup;
  };
  const context = {
    window, document, URL, AbortController, console,
    Date: class extends Date { static now() { return now; } },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++requestId).padStart(12, '0')}` },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, init) {
      assert.match(url, /^\/0311\/api\/(status|login|logout|inspect|book|confirm|cancel)$/);
      const path = url.split('/').at(-1);
      const call = { path, init, body: init.body ? JSON.parse(init.body) : null };
      calls.push(call);
      if (handlers.has(path)) return await handlers.get(path)(call);
      if (path === 'status') return response(status);
      if (path === 'login') { if (status.state !== 'busy') status = { ...status, state: 'signing_in' }; return response({ loginUrl: LIVE }); }
      if (path === 'logout') { status = { state: 'signed_out', csrf: CSRF, probeOnly: status.probeOnly }; return response({ state: 'signed_out' }); }
      if (path === 'inspect') return response({ state: 'ready', ready: true, loaded: true, csrfReady: true });
      if (path === 'book') { status = { ...status, state: 'busy', booking: { requestId: call.body.requestId, stage: 'loading' } }; return response(status); }
      throw Error('Unexpected request');
    },
  };
  for (const object of [window, context]) for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) {
    Object.defineProperty(object, name, { get() { storageTouches++; throw Error(`Unexpected ${name}`); } });
  }
  runInNewContext(source, context, { filename: 'roomie-tss-bridge.ts' });
  const click = async (element, isTrusted = true) => { element.emit('click', { isTrusted }); await flush(); };
  return {
    elements, buttons, calls, popups, handlers, window, document,
    get state() { return elements.session.dataset.state; },
    get job() { return elements['job-status'].textContent; },
    get statusText() { return elements['session-status'].textContent; },
    get storageTouches() { return storageTouches; },
    posts(path) { return calls.filter(call => call.path === path && call.init.method === 'POST'); },
    setStatus(update) { status = { ...status, ...update }; },
    replaceStatus(value) { status = value; },
    blockPopup() { popupBlocked = true; },
    click(name = 0, trusted = true) { return click(typeof name === 'number' ? buttons[name] : elements[name], trusted); },
    async poll() { document.emit('visibilitychange'); await flush(); },
    async visible(value) { document.visibilityState = value ? 'visible' : 'hidden'; document.emit('visibilitychange'); await flush(); },
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers.entries()].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, item] = next; now = item.at; timers.delete(id); item.callback(); await flush();
      }
      now = end; await flush();
    },
  };
}

test('default probe is fail-closed, with read-only session inspection', async () => {
  const h = harness();
  assert.equal(h.elements['session-status'].dataset.working, 'true');
  assert.ok(h.buttons[0].disabled);
  await flush();
  assert.equal(h.state, 'signed_out');
  assert.equal(h.elements['session-status'].dataset.working, 'false');
  assert.equal(h.elements.login.disabled, false);
  await h.click(0);
  assert.equal(h.posts('book').length, 0);
  h.setStatus({ state: 'ready' }); await h.poll();
  assert.match(h.statusText, /Login test/);
  assert.equal(h.elements.inspect.hidden, false);
  await h.click('inspect');
  assert.equal(h.posts('inspect').length, 1);
  assert.match(h.job, /No booking request/);
  assert.equal(h.posts('book').length, 0);
});

test('session verification does not require eligibility to book an already-booked course', async () => {
  const h = harness({ status: { state: 'ready' } }); await flush();
  h.handlers.set('inspect', async () => response({ state: 'ready', ready: false, loaded: true, csrfReady: true }));
  await h.click('inspect'); assert.match(h.job, /Session verified/);
  h.handlers.set('inspect', async () => response({ state: 'ready', ready: true, loaded: true, csrfReady: false }));
  await h.click('inspect'); assert.match(h.job, /not verified yet/);
  assert.equal(h.posts('book').length, 0);
});

test('UCSD login errors and temporary TSS failures show safe status without restarting sign-in', async () => {
  const h = harness({ status: { state: 'signing_in', probeOnly: false,
    authDiagnostics: { authentication: { page: 'duo' } } } }); await flush();
  assert.match(h.statusText, /Complete Duo/);
  assert.equal(h.elements['session-status'].dataset.working, 'true');
  h.setStatus({ authDiagnostics: { authentication: { page: 'ucsd_error', issue: 'ucsd_login_exception', message: 'private-login-data' } } }); await h.poll();
  assert.equal(h.statusText, 'UCSD sign-in returned an error. Check the sign-in tab.');
  assert.equal(h.elements['session-status'].dataset.working, 'false');
  h.setStatus({ authDiagnostics: { code: 'authentication_unavailable', authentication: { page: 'tss', issue: 'service_unavailable' } } }); await h.poll();
  assert.match(h.statusText, /temporarily unavailable.*sign-in stays open; checking again/);
  assert.equal(h.elements['session-status'].dataset.working, 'true');
  assert.ok(h.buttons[0].disabled);
  await h.advance(10_000);
  assert.equal(h.posts('login').length, 0); assert.equal(h.posts('book').length, 0);
  h.setStatus({ authDiagnostics: { code: 'private-login-data', authentication: { page: 'private-login-data', issue: 'private-login-data' } } }); await h.poll();
  assert.equal(h.statusText, 'Complete UCSD sign-in');
  assert.doesNotMatch(h.job + h.statusText, /private-login-data/);
  h.setStatus({ state: 'ready', authDiagnostics: { authentication: { page: 'tss' } } }); await h.poll();
  assert.match(h.statusText, /ready to book/); assert.equal(h.buttons[0].disabled, false);
  assert.equal(h.posts('login').length, 0);
});

test('pre-dispatch authentication 503 preserves sign-in and permits only a later explicit Book retry', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  h.handlers.set('book', async () => {
    h.setStatus({ state: 'signing_in', authDiagnostics: { code: 'authentication_unavailable', authentication: { page: 'tss', issue: 'request_timeout' } } });
    return response({ state: 'signing_in', reason: 'authentication_unavailable', message: 'private-login-data' }, 503);
  });
  await h.click(0);
  assert.match(h.job, /No Book request was sent/);
  assert.match(h.statusText, /sign-in stays open; checking again/);
  assert.doesNotMatch(h.statusText + h.job, /unknown|private-login-data/);
  await h.advance(10_000); assert.equal(h.posts('book').length, 1); assert.equal(h.posts('login').length, 0);
  h.setStatus({ state: 'ready', authDiagnostics: {} }); await h.poll();
  assert.equal(h.buttons[0].disabled, false);
  assert.equal(h.posts('book').length, 1);
  h.handlers.delete('book'); await h.click(0);
  assert.equal(h.posts('book').length, 2);
});

test('failed proxy handoff is not presented as a login choice or account creation', async () => {
  const h=harness({status:{state:'signing_in',authDiagnostics:{authentication:{page:'tss_proxy_error',issue:'sso_handoff_failed',raw:'private-token'}}}});
  await flush();
  assert.match(h.statusText,/TSS could not finish sign-in/);
  assert.doesNotMatch(h.statusText,/Choose|account|register|private/);
  await h.advance(10000);assert.equal(h.posts('login').length,0);assert.equal(h.posts('book').length,0);
});

test('sign-in uses same-origin JSON/CSRF and a detached popup without credential storage', async () => {
  const h = harness(); await flush();
  await h.click('login', false); assert.equal(h.posts('login').length, 0);
  await h.click('login');
  const call = h.posts('login')[0];
  assert.equal(call.init.credentials, 'same-origin'); assert.equal(call.init.cache, 'no-store'); assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.headers['X-BBB-CSRF'], CSRF); assert.equal(call.init.headers['Content-Type'], 'application/json');
  assert.match(call.body.requestId, /^[\da-f-]{36}$/);
  assert.equal(h.popups[0].opener, null); assert.deepEqual(h.popups[0].urls, [LIVE]);
  h.setStatus({ state: 'ready' }); await h.poll();
  assert.ok(h.popups[0].closed); assert.equal(h.posts('book').length, 0);
  assert.match(h.job, /^Signed in\./);
  assert.equal(h.storageTouches, 0);
});

test('sign-in sends bounded viewer dimensions for narrow and mobile pages', async () => {
  for (const [width, height, expected] of [[509, 1516, { width: 509, height: 1000 }],
    [320, 568, { width: 320, height: 504 }], [390, 844, { width: 390, height: 780 }],
    [2000, 1200, { width: 1440, height: 1000 }]]) {
    const h = harness(); h.window.innerWidth = width; h.window.innerHeight = height; await flush();
    await h.click('login'); assert.deepEqual(h.posts('login')[0].body.viewport, expected);
    assert.equal(h.posts('book').length, 0); assert.equal(h.storageTouches, 0);
  }
});

test('signed-out Book signs in, never queues or replays a booking', async () => {
  const h = harness({ status: { probeOnly: false } }); await flush();
  await h.click(0); assert.equal(h.posts('login').length, 1);
  h.setStatus({ state: 'ready' }); await h.poll(); await h.advance(10_000);
  assert.equal(h.posts('book').length, 0);
  await h.click(0); assert.equal(h.posts('book').length, 1);
});

test('only trusted user clicks on captured verified routes can book, one request at a time', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  h.buttons[0].dataset.bookRoute = 'https://evil.example/stolen';
  await h.click(0, false); await h.click(2); await h.click(3);
  assert.equal(h.posts('book').length, 0);
  await h.click(0); await h.click(1);
  assert.equal(h.posts('book').length, 1);
  assert.equal(h.posts('book')[0].body.route, route('13043', '166528'));
  assert.ok(h.buttons[0].disabled && h.buttons[1].disabled);
  await h.advance(20_000); assert.equal(h.posts('book').length, 1);
});

test('expired sessions allow fresh sign-in, and cannot submit stale Book actions', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false, expiresAt: 6000 } }); await flush();
  h.setStatus({ state: 'expired' }); await h.advance(5000);
  assert.equal(h.state, 'expired'); assert.equal(h.elements.login.disabled, false);
  await h.click(0);
  assert.equal(h.posts('book').length, 0); assert.equal(h.posts('login').length, 1);
});

test('hidden pages stop polling and stale credentials need refresh before any action', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  await h.visible(false); const before = h.calls.length;
  await h.advance(20_000); assert.equal(h.calls.length, before);
  await h.click(0); assert.equal(h.posts('book').length, 0);
  await h.visible(true); await h.click(0); assert.equal(h.posts('book').length, 1);
});

test('invalid API state, HTML and server failures fail closed without exposing response content', async () => {
  for (const value of [{ state: 'ready', csrf: 'short', probeOnly: false }, { state: 'ready', csrf: CSRF }, { state: 'unknown', csrf: CSRF, probeOnly: false }]) {
    const h = harness(); await flush(); h.replaceStatus(value); await h.poll();
    assert.equal(h.state, 'error'); assert.ok(h.buttons[0].disabled);
  }
  const h = harness(); await flush();
  h.handlers.set('status', async () => response('<script>private-error</script>', 503, 'text/html'));
  await h.poll(); assert.ok(h.buttons[0].disabled); assert.ok(!h.job.includes('private-error'));
  h.handlers.delete('status'); await h.poll(); assert.equal(h.job, '');
});

test('untrusted Live View destinations are refused and popup blocks create no sessions', async () => {
  for (const loginUrl of ['https://evil.example/ui/view?mode=tab', 'https://live.browser.run.evil.example/ui/view?mode=tab', 'https://live.browser.run/ui/view?mode=browser', 'http://live.browser.run/ui/view?mode=tab', 'https://user@live.browser.run/ui/view?mode=tab']) {
    const h = harness(); await flush(); h.handlers.set('login', async () => response({ loginUrl }));
    await h.click('login'); assert.ok(h.popups[0].closed); assert.deepEqual(h.popups[0].urls, []);
    assert.equal(h.storageTouches, 0);
  }
  const h = harness(); await flush(); h.blockPopup(); await h.click('login');
  assert.equal(h.posts('login').length, 0); assert.match(h.job, /Allow the sign-in popup/);
});

test('unknown booking responses and transport failures stay locked despite a later ready state', async () => {
  for (const handler of [async () => response({ booking: { requestId: 'wrong-id', stage: 'submitted' } }), async () => { throw Error('network failed'); }]) {
    const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
    h.handlers.set('book', handler); await h.click(0); await h.poll(); await h.click(1);
    assert.equal(h.posts('book').length, 1); assert.ok(h.buttons[0].disabled); assert.match(h.statusText, /result unknown/);
    await h.click('logout'); assert.equal(h.state, 'signed_out'); assert.equal(h.elements.login.disabled, false);
  }
});

test('fixed booking failure appears beside the clicked option without exposing native error data', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  h.handlers.set('book', call => response({ booking: { requestId: call.body.requestId, stage: 'stopped', reason: 'existing_registration', message: 'private student details' } }));
  await h.click(0);
  assert.match(h.job, /still reports a registration/);
  assert.equal(h.buttons[0].feedback.textContent, h.job);
  assert.equal(h.buttons[1].feedback.textContent, '');
  assert.doesNotMatch(h.job, /private student/);
  h.handlers.set('book', call => response({ booking: { requestId: call.body.requestId, stage: 'error', reason: 'untrusted private details' } }));
  await h.click(1);
  assert.match(h.job, /No confirmed result/);
  assert.equal(h.buttons[1].feedback.textContent, h.job);
  assert.doesNotMatch(h.job, /untrusted private/);
  assert.ok(h.buttons[0].disabled);
});

test('HTTP booking failure preserves only an allowlisted reason and keeps uncertain result locked', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  h.handlers.set('book', () => response({ booking: { reason: 'session_unavailable' }, message: 'private provider error' }, 503));
  await h.click(0);
  assert.match(h.job, /session disconnected/);
  assert.equal(h.buttons[0].feedback.textContent, h.job);
  assert.doesNotMatch(h.job, /private provider/);
  await h.click(1); assert.equal(h.posts('book').length, 1);
});

test('booking timeout is bounded and cannot auto-retry', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  h.handlers.set('book', call => new Promise((resolve, reject) => call.init.signal.addEventListener('abort', () => reject(Error('aborted')))));
  await h.click(0); await h.advance(120_001); await h.click(0);
  assert.equal(h.posts('book').length, 1); assert.match(h.statusText, /result unknown/);
});

test('status jobs are correlated, phase regressions ignored and submitted is not called enrolled', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await h.click(0);
  assert.equal(h.elements['job-status'].dataset.working, 'true');
  assert.equal(h.buttons[0].feedback.dataset.working, 'true');
  assert.notEqual(h.buttons[1].feedback.dataset.working, 'true');
  const requestId = h.posts('book')[0].body.requestId;
  h.setStatus({ booking: { requestId, stage: 'submitting' } }); await h.poll();
  h.setStatus({ booking: { requestId, stage: 'checking' } }); await h.poll();
  assert.match(h.job, /Sending/);
  h.setStatus({ state: 'ready', booking: { requestId, stage: 'submitted' } }); await h.poll();
  assert.equal(h.job, 'Request submitted. Check TSS before trying again.'); assert.equal(h.buttons[0].disabled, false);
  assert.equal(h.elements['job-status'].dataset.working, 'false');
  assert.equal(h.buttons[0].feedback.dataset.working, 'false');
  assert.equal(h.posts('book').length, 1);
  await h.click(1);
  assert.equal(h.buttons[0].feedback.dataset.working, 'false');
  assert.equal(h.buttons[1].feedback.dataset.working, 'true');
  h.setStatus({ booking: { requestId, stage: 'submitted' } }); await h.poll();
  assert.match(h.statusText, /result unknown/); assert.ok(h.buttons[1].disabled);
  assert.equal(h.buttons[1].feedback.dataset.working, 'false');
  assert.equal(h.elements['job-status'].dataset.working, 'false');
});

test('native warnings open only after fresh Review click and mint a new owned-session URL', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await h.click(0);
  const requestId = h.posts('book')[0].body.requestId;
  h.setStatus({ booking: { requestId, stage: 'review' } }); await h.poll();
  assert.equal(h.elements.review.hidden, false); assert.equal(h.posts('login').length, 0); assert.equal(h.popups.length, 0);
  await h.click('review', false); assert.equal(h.posts('login').length, 0);
  await h.click('review'); assert.equal(h.posts('login').length, 1); assert.deepEqual(h.popups[0].urls, [LIVE]);
  assert.equal(h.posts('book').length, 1); assert.ok(h.buttons[0].disabled);
});

test('reload restores server-owned review status read-only and preserves unknown-result locks', async () => {
  const requestId = 'ae034da5-9999-4000-8000-0123456789ab';
  const h = harness({ status: { state: 'busy', probeOnly: false, booking: { requestId, stage: 'review' } } }); await flush();
  assert.equal(h.elements.review.hidden, false); assert.ok(h.buttons[0].disabled);
  assert.equal(h.posts('book').length, 0); assert.equal(h.posts('login').length, 0);
  await h.click('review'); assert.equal(h.posts('login').length, 1);
  const failed = harness({ status: { state: 'ready', probeOnly: false, booking: { requestId, stage: 'error' } } }); await flush();
  assert.match(failed.statusText, /result unknown/); await failed.click(0); assert.equal(failed.posts('book').length, 0);
});

test('direct warnings render plain text and require one trusted confirmation on the original job', async () => {
  const requestId = 'ae034da5-9999-4000-8000-0123456789ab';
  const confirmationId = 'ae034da5-9999-4000-8000-0123456789ac';
  const message = '<img src=x onerror=alert(1)> Schedule conflict. Continue?';
  const h = harness({ status: { state: 'busy', probeOnly: false, booking: { requestId, stage: 'review', mode: 'direct', confirmationId, reviewMessage: message } } });
  await flush();
  assert.equal(h.elements.warning.hidden, false);
  assert.equal(h.elements['job-status'].dataset.working, 'false');
  assert.equal(h.elements['warning-message'].textContent, message);
  assert.equal(h.elements.review.hidden, true);
  await h.click('confirm', false); assert.equal(h.posts('confirm').length, 0);
  h.handlers.set('confirm', call => {
    assert.equal(call.body.bookingRequestId, requestId); assert.equal(call.body.confirmationId, confirmationId);
    assert.notEqual(call.body.requestId, requestId);
    h.setStatus({ booking: { requestId, stage: 'submitting', mode: 'direct' } });
    return response({ booking: { requestId, stage: 'submitting', mode: 'direct' } });
  });
  await h.click('confirm'); await h.click('confirm');
  assert.equal(h.elements['job-status'].dataset.working, 'true');
  assert.equal(h.posts('confirm').length, 1); assert.equal(h.posts('book').length, 0);
  assert.equal(h.posts('login').length, 0); assert.equal(h.elements.warning.hidden, true);
});

test('direct cancellation never confirms or repeats Book', async () => {
  const requestId = 'ae034da5-9999-4000-8000-0123456789ab';
  const confirmationId = 'ae034da5-9999-4000-8000-0123456789ac';
  const h = harness({ status: { state: 'busy', probeOnly: false, booking: { requestId, stage: 'review', mode: 'direct', confirmationId, reviewMessage: 'Review warning' } } });
  await flush();
  h.handlers.set('cancel', () => {
    const booking = { requestId, stage: 'stopped', reason: 'booking_cancelled', mode: 'direct' };
    h.setStatus({ state: 'ready', booking }); return response({ booking });
  });
  await h.click('cancel');
  assert.equal(h.posts('cancel').length, 1); assert.equal(h.posts('confirm').length, 0);
  assert.equal(h.posts('book').length, 0); assert.match(h.job, /cancelled/);
});

test('submitted direct outcomes map exactly and stale or malformed values never claim enrollment', async () => {
  for (const [mode, outcome, expected] of [
    ['direct','booked','Booked.'], ['direct','waitlisted','Waitlisted.'],
    ['direct','unconfirmed','Request submitted. Check TSS before trying again.'],
    ['direct',undefined,'Request submitted. Check TSS before trying again.'],
    ['direct','Booked','Request submitted. Check TSS before trying again.'],
    ['direct',{private:'payload'},'Request submitted. Check TSS before trying again.'],
    ['native','booked','Request submitted. Check TSS before trying again.'],
  ]) {
    const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
    let requestId;
    h.handlers.set('book', call => {
      requestId = call.body.requestId;
      const booking = { requestId, stage: 'submitted', mode, outcome };
      h.setStatus({ state: 'ready', booking }); return response({ booking });
    });
    await h.click(0); assert.equal(h.job, expected); assert.equal(h.buttons[0].feedback.textContent, expected);
    h.setStatus({ booking: { requestId, stage: 'submitted', mode: 'direct', outcome: 'booked' } });
    await h.advance(10000); assert.equal(h.job, expected, 'completed result cannot be rewritten by a stale poll');
    assert.equal(h.posts('book').length, 1); assert.equal(h.posts('confirm').length, 0);
    assert.equal(h.posts('login').length, 0); assert.equal(h.storageTouches, 0);
  }
  const stale = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await stale.click(0);
  stale.setStatus({ booking: { requestId: 'ae034da5-9999-4000-8000-0123456789ab', stage: 'submitted', mode: 'direct', outcome: 'booked' } });
  await stale.poll(); assert.doesNotMatch(stale.job, /^Booked\./); assert.match(stale.statusText, /result unknown/);
  assert.equal(stale.posts('book').length, 1);
});

test('late submitted warning is plain text at the clicked course and never opens confirmation or retries', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  const noticeMessage = '<img src=x onerror=alert(1)> You were waitlisted.';
  h.handlers.set('book', call => {
    const booking = { requestId: call.body.requestId, stage: 'submitted', mode: 'direct', noticeMessage };
    h.setStatus({ state: 'ready', booking }); return response({ booking });
  });
  await h.click(0);
  assert.match(h.job, /Request submitted/); assert.ok(h.job.includes(noticeMessage));
  assert.equal(h.buttons[0].feedback.textContent, h.job); assert.equal(h.buttons[1].feedback.textContent, '');
  assert.equal(h.elements['job-status'].innerHTML, undefined); assert.equal(h.buttons[0].feedback.innerHTML, undefined);
  assert.equal(h.elements.warning.hidden, true); assert.equal(h.elements.confirm.disabled, true); assert.equal(h.elements.cancel.disabled, true);
  await h.click('confirm'); await h.click('cancel'); await h.advance(10_000);
  assert.equal(h.posts('book').length, 1); assert.equal(h.posts('confirm').length, 0); assert.equal(h.posts('cancel').length, 0);
  assert.ok(h.job.includes(noticeMessage)); assert.equal(h.storageTouches, 0);
  h.handlers.delete('book'); await h.click(1);
  assert.equal(h.posts('book').length, 2); assert.equal(h.buttons[0].feedback.textContent, '');
  assert.doesNotMatch(h.job, /waitlisted|img/);
});

test('submitted warning restored from status clears on logout and rejects invalid or non-direct text', async () => {
  const requestId = 'ae034da5-9999-4000-8000-0123456789ab';
  const h = harness({ status: { state: 'ready', probeOnly: false,
    booking: { requestId, stage: 'submitted', mode: 'direct', noticeMessage: 'Synthetic late notice' } } });
  await flush(); assert.match(h.job, /Synthetic late notice/);
  await h.poll(); assert.equal(h.posts('book').length, 0); assert.equal(h.posts('confirm').length, 0);
  await h.click('logout'); assert.doesNotMatch(h.job, /Synthetic late notice/);
  for (const [mode, noticeMessage] of [['native', 'private native notice'], ['direct', 'x'.repeat(4001)],
    ['direct', 'private\u0000notice'], ['direct', { private: 'notice' }]]) {
    const invalid = harness({ status: { state: 'ready', probeOnly: false, booking: { requestId, stage: 'submitted', mode, noticeMessage } } });
    await flush(); assert.equal(invalid.job, 'Request submitted. Check TSS before trying again.');
    assert.equal(invalid.elements.confirm.disabled, true); assert.equal(invalid.posts('book').length, 0);
  }
});

test('terminal booking results survive failed status polls and recovery beside the original course', async () => {
  for (const terminal of [
    { stage: 'submitted', mode: 'direct', outcome: 'booked' },
    { stage: 'submitted', mode: 'direct', outcome: 'waitlisted', noticeMessage: 'Synthetic late notice' },
    { stage: 'submitted', mode: 'direct', outcome: 'unconfirmed' },
    { stage: 'stopped', reason: 'eligibility_unavailable' },
    { stage: 'error', reason: 'submission_uncertain' },
  ]) {
    const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await h.click(0);
    const requestId = h.posts('book')[0].body.requestId;
    h.setStatus({ state: 'ready', booking: { requestId, ...terminal } }); await h.poll();
    const result = h.job; assert.ok(result.length > 0);
    h.handlers.set('status', () => response({}, 503)); await h.poll(); await h.poll();
    assert.equal(h.job, result); assert.equal(h.buttons[0].feedback.textContent, result);
    assert.equal(h.buttons[1].feedback.textContent, '');
    h.handlers.delete('status'); await h.poll(); await h.advance(10_000);
    assert.equal(h.job, result); assert.equal(h.buttons[0].feedback.textContent, result);
    assert.equal(h.posts('book').length, 1); assert.equal(h.posts('confirm').length, 0);
    if (terminal.stage === 'error') { assert.match(h.statusText, /result unknown/); assert.ok(h.buttons[0].disabled); }
  }
});

test('completed result survives passive sign-in transitions and expiry until a new explicit attempt', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await h.click(0);
  const requestId = h.posts('book')[0].body.requestId;
  h.setStatus({ state: 'ready', booking: { requestId, stage: 'submitted', mode: 'direct', outcome: 'booked' } }); await h.poll();
  h.setStatus({ state: 'signing_in' }); await h.poll(); h.setStatus({ state: 'ready' }); await h.poll();
  assert.equal(h.job, 'Booked.'); assert.equal(h.buttons[0].feedback.textContent, 'Booked.');
  h.setStatus({ expiresAt: 4000 }); await h.poll(); await h.advance(3000);
  assert.equal(h.job, 'Booked.'); assert.equal(h.state, 'expired'); assert.equal(h.posts('book').length, 1);
  h.setStatus({ state: 'ready', expiresAt: 0 }); await h.poll(); await h.click(1);
  const nextId = h.posts('book')[1].body.requestId;
  h.setStatus({ state: 'ready', booking: { requestId: nextId, stage: 'stopped', reason: 'booking_unavailable' } }); await h.poll();
  const nextResult = h.job;
  h.handlers.set('status', () => response({}, 503)); await h.poll(); h.handlers.delete('status'); await h.poll();
  assert.match(nextResult, /does not currently allow/); assert.equal(h.job, nextResult);
  assert.equal(h.buttons[1].feedback.textContent, nextResult); assert.equal(h.buttons[0].feedback.textContent, 'Booked.');
  assert.equal(h.posts('book').length, 2);
});

test('expiry and signed-out status discard native notice while retaining only the fixed outcome', async () => {
  for (const endState of ['expired', 'signed_out', 'error']) {
    const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await h.click(0);
    const requestId = h.posts('book')[0].body.requestId;
    const booking = { requestId, stage: 'submitted', mode: 'direct', outcome: 'booked', noticeMessage: 'Private ephemeral notice' };
    h.setStatus({ state: 'ready', booking }); await h.poll(); assert.match(h.job, /Private ephemeral/);
    h.setStatus({ state: endState, booking }); await h.poll();
    assert.equal(h.job, 'Booked.'); assert.equal(h.buttons[0].feedback.textContent, 'Booked.');
    h.handlers.set('status', () => response({}, 503)); await h.poll(); h.handlers.delete('status');
    h.setStatus({ state: 'ready', booking }); await h.poll();
    assert.equal(h.job, 'Booked.'); assert.equal(h.buttons[0].feedback.textContent, 'Booked.');
    assert.equal(h.posts('book').length, 1);
  }
  const timer = harness({ status: { state: 'ready', probeOnly: false, expiresAt: 4000 } }); await flush(); await timer.click(0);
  const requestId = timer.posts('book')[0].body.requestId;
  timer.setStatus({ state: 'ready', booking: { requestId, stage: 'submitted', mode: 'direct', outcome: 'waitlisted', noticeMessage: 'Private ephemeral notice' } });
  await timer.poll(); await timer.advance(3000);
  assert.equal(timer.job, 'Waitlisted.'); assert.equal(timer.buttons[0].feedback.textContent, 'Waitlisted.');
  assert.equal(timer.posts('book').length, 1);
});

test('session refresh and a new sign-in preserve the previous fixed outcome without copying it to another course', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await h.click(0);
  const requestId = h.posts('book')[0].body.requestId;
  h.setStatus({ state: 'ready', booking: { requestId, stage: 'submitted', mode: 'direct', outcome: 'booked' } }); await h.poll();
  h.setStatus({ state: 'signed_out' }); await h.poll(); await h.visible(false); await h.advance(16000);
  await h.click(1); assert.equal(h.job, 'Booked.'); assert.equal(h.buttons[1].feedback.textContent, '');
  await h.visible(true); await h.click('login');
  assert.equal(h.posts('login').length, 1); assert.equal(h.job, 'Booked.');
  assert.equal(h.buttons[0].feedback.textContent, 'Booked.'); assert.equal(h.buttons[1].feedback.textContent, '');
  assert.equal(h.posts('book').length, 1);
});

test('logout clears retained outcome and an uncertain result never becomes a retry', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  h.handlers.set('book', () => { throw Error('synthetic transport failure'); }); await h.click(0);
  const unknown = h.job;
  h.handlers.set('status', () => response({}, 503)); await h.poll(); h.handlers.delete('status'); await h.poll();
  assert.equal(h.job, unknown); assert.match(h.statusText, /result unknown/);
  await h.click(0); assert.equal(h.posts('book').length, 1);
  await h.click('logout'); assert.doesNotMatch(h.job, /No confirmed result received/);
  h.handlers.set('status', () => response({}, 503)); await h.poll(); h.handlers.delete('status'); await h.poll();
  assert.notEqual(h.job, unknown); assert.equal(h.posts('book').length, 1);
});

test('missing direct review details fail closed and cannot fall back to native confirmation', async () => {
  const requestId = 'ae034da5-9999-4000-8000-0123456789ab';
  const h = harness({ status: { state: 'busy', probeOnly: false, booking: { requestId, stage: 'review', mode: 'direct', confirmationId: 'invalid', reviewMessage: 'Warning' } } });
  await flush();
  assert.equal(h.elements.warning.hidden, true); assert.equal(h.elements.review.hidden, true);
  await h.click('review'); await h.click('confirm'); await h.click('cancel');
  assert.equal(h.posts('login').length, 0); assert.equal(h.posts('confirm').length, 0); assert.equal(h.posts('cancel').length, 0);
  assert.match(h.job, /has not been confirmed/);
});

test('malformed logout success never claims sign-out or clears the current session', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush();
  h.handlers.set('logout', async () => response({ state: 'error' }));
  await h.click('logout'); assert.match(h.job, /could not be confirmed/); assert.equal(h.state, 'ready');
});

test('late status reads cannot overwrite a newer login transition', async () => {
  const h = harness({ status: { probeOnly: false } }); await flush();
  const wait = deferred(); h.handlers.set('status', () => wait.promise);
  await h.poll(); await h.click('login');
  wait.resolve(response({ state: 'ready', csrf: CSRF, probeOnly: false })); await flush();
  assert.equal(h.state, 'signing_in'); assert.equal(h.posts('book').length, 0);
});

test('page departure and BFCache restoration never replay a pending booking', async () => {
  const h = harness({ status: { state: 'ready', probeOnly: false } }); await flush(); await h.click(0);
  h.window.emit('pagehide'); h.window.emit('pageshow', { persisted: true }); await flush(); await h.advance(10_000);
  assert.equal(h.posts('book').length, 1); assert.ok(h.buttons[0].disabled); assert.match(h.statusText, /result unknown/);
});

test('client contains no bookmark setup, cross-tab bridge, password fields or persistent token stores', () => {
  assert.doesNotMatch(original, /postMessage|localStorage|sessionStorage|indexedDB|bookmarklet|password\s*[:=]/i);
  assert.doesNotMatch(original, /console\.(log|debug|info)/);
});
