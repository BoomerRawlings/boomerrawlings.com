import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { directTssOperation, DIRECT_READ_STAGES, DIRECT_SCHEMA_ISSUES, DIRECT_SETTING_FLAGS, DIRECT_SETTING_SHAPES } from '../src/direct-tss.mjs';
import { BOOKING_ROUTES } from '../src/routes.mjs';

const route = BOOKING_ROUTES.keys().next().value;
const courseCode = 'PHIL-010';
const zeroGuid = '00000000-0000-0000-0000-000000000000';
const flush = () => new Promise(resolve => setImmediate(resolve));
const settings = () => [
  { Name: 'SHOW_TEMPLATE', Value: 'X' }, { Name: 'SHOW_CREDITS', Value: 'X' },
  { Name: 'HIDE_TAB_EXAM', Value: '' }, { Name: 'HIDE_TAB_EVENT', Value: '' },
];
function harness(options = {}) {
  const calls = [], timers = new Map();
  let nativeCalls = 0;
  const data = {
    settings: settings(),
    header: { SmObjid: '00013043', SmOtype: 'SM', SmShort: 'PHIL-010', AcademicYear: '2026', AcademicSession: '003',
      EventPackageId: '00000000', AssignedCg: '00000200', TemplateId: '0000', IsTemplateUpdateable: true,
      Credits: '4.000', CreditUnit: 'UN', ModregId: 'abcd1234-1234-1234-1234-123456789abc', SmStatus: '00',
      BookingCheckLog: { results: [] }, CreditOptions: { results: [] } },
    events: [{ EventId: '00001234', DObjid: '00000100', SmObjid: '00013043', AcademicYear: '2026', AcademicSession: '003',
      EventPackageId: '00000000', Booked: false, BookingCheckLog: { results: [] } }],
    groups: [{ ScObjid: '00009000', CgObjid: '00000200', CgTopObjid: '00000101', Bookable: true, Selected: true, IsDefault: false }],
    package: { BookingButtonEnabled: true, WithdrawButtonEnabled: false },
    exams: [], templates: [{ TemplateId: '0001', IsDefault: true }],
    check: { MessageType: '', Message: '' }, save: { MessageType: '', ModregId: '12341234-1234-1234-1234-123456789abc' },
    token: 'synthetic-session-token',
  };
  const response = (value, status = 200, type = 'application/json', csrf) => ({ ok: status < 400, status,
    headers: { get: name => name.toLowerCase() === 'content-type' ? type : name.toLowerCase() === 'x-csrf-token' ? csrf : null },
    text: async () => JSON.stringify({ d: structuredClone(value) }),
  });
  let intercept;
  const window = { location: new Proxy({ origin: options.origin || 'https://tss.ucsd.edu' }, { set() { throw Error('Navigation forbidden'); } }),
    async fetch(url, init) {
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://tss.ucsd.edu');
      assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
      const call = { url, init, payload: init.body ? JSON.parse(init.body) : undefined }; calls.push(call);
      const overridden = await intercept?.(call);
      if (overridden) return overridden;
      if (call.payload) return response(data[call.payload.ActionName === 'CheckRegistration' ? 'check' : 'save']);
      const path = parsed.pathname;
      if (path.endsWith('/PR_MY_MODULES_V2_SRV/')) return response({ EntitySets: [] }, 200, 'application/json', data.token);
      if (path.endsWith('/ParameterSet')) return response({ results: data.settings });
      if (path.endsWith('/Event')) return response({ results: data.events });
      if (path.endsWith('/ModuleGroup')) return response({ results: data.groups });
      if (path.endsWith('/Exam')) return response({ results: data.exams });
      if (path.endsWith('/Template')) return response({ results: data.templates });
      if (path.includes('/EventPackageSet(')) return response(data.package);
      if (path.includes('/ModuleHeaderSet(')) return response(data.header);
      throw Error('Unexpected read');
    } };
  const context = { window, URL, AbortController, crypto, console,
    setTimeout(callback, delay) { const timer = setTimeout(callback, delay); timer.unref(); timers.set(timer, { callback, delay }); return timer; },
    clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); } };
  Object.defineProperty(context, 'document', { configurable: true, get() { throw Error('DOM access forbidden'); } });
  Object.defineProperty(window, 'sap', { configurable: true, get() { throw Error('UI5 access forbidden'); } });
  const operation = runInNewContext(`(${directTssOperation.toString()})`, context);
  const invoke = args => operation({ route, courseCode, ...args });
  return { data, calls, response, window,
    get nativeCalls() { return nativeCalls; },
    native(overrides = {}, options = {}) {
      const detail = { ...structuredClone(data.header), EventPackageId: '166528', TemplateId: '0001', TemplateIdOld: '0000',
        CreditOld: data.header.Credits, oCG: data.groups[0], oOrigCG: structuredClone(data.groups[0]),
        EventTypes: [{ Events: data.events, EventPackageExist: true }], ExamTypes: [] };
      const appModel = { getProperty: path => path === '/Settings/ENABLE_TOP_MODULE_BOOKING'
        ? data.settings.filter(row => row?.Name === 'ENABLE_TOP_MODULE_BOOKING').at(-1)?.Value : undefined,
      ...(options.instanceSettings ? { Settings: options.instanceSettings } : {}) };
      const controller = {
        _initialLoad: false,
        _oArguments: { Source: 'EventPackage', Otype: 'SM', Objid: '13043', EventPackageId: '166528', AcademicYear: '2026', AcademicSession: '3' },
        getMetadata: () => ({ getName: () => 'itus.mymodules.controller.Detail' }),
        getModel: name => name === 'detailView' ? { getData: () => ({ detail }) } : options.missingDefaultModel ? undefined : appModel,
        getOwnerComponent: () => ({ getModel: () => options.pending ? { getProperty: () => 'edited' } : undefined }),
        _prepareSaveData(cancel) {
          assert.equal(cancel, false); nativeCalls++;
          return { ModuleId: data.header.SmObjid, ActionName: 'SaveChanges', ProgramId: data.groups[0].ScObjid,
            Items: data.events.map(event => ({ EventId: event.EventId, ModuleId: event.SmObjid, AcademicYear: event.AcademicYear,
              AcademicSession: event.AcademicSession, EventPackId: '166528' })),
            AssignedCg: data.groups[0].CgObjid, AssignedCgTop: data.groups[0].CgTopObjid, TemplateId: '0001',
            EventPackId: '166528', ModregId: zeroGuid, AcademicYear: data.header.AcademicYear, AcademicSession: data.header.AcademicSession,
            Credits: data.header.Credits, CreditUnit: data.header.CreditUnit, ...overrides };
        },
      };
      const dom = { isConnected: true, getClientRects: () => [{}], closest: () => null };
      const view = { getController: () => controller, getDomRef: () => dom };
      Object.defineProperty(context, 'document', { configurable: true, value: { querySelectorAll: () => [{ getAttribute: () => 'native-detail' }] } });
      Object.defineProperty(window, 'sap', { configurable: true, value: { ui: { getCore: () => ({ byId: () => view }) } } });
      window.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });
      return { detail, controller };
    },
    setIntercept(value) { intercept = value; },
    call: invoke,
    book(requestId = crypto.randomUUID()) { return { requestId, result: invoke({ operation: 'book', requestId, allowWrites: true }) }; },
    posts() { return calls.filter(call => call.init.method === 'POST'); },
    async settled(requestId) {
      for (let index = 0; index < 50; index++) {
        await flush(); const result = invoke({ operation: 'status', requestId });
        if (['review', 'submitted', 'stopped', 'error'].includes(result.stage)) return structuredClone(result);
      }
      throw Error('Operation did not settle');
    },
    deadline() { for (const { callback, delay } of [...timers.values()]) if (delay === 120000) callback(); },
    readDeadline() { for (const { callback, delay } of [...timers.values()]) if (delay === 45000) callback(); },
  };
}

test('authentication uses only the protected service and CSRF proof, without UI5 or DOM', async () => {
  const h = harness(); assert.equal(await h.call({ operation: 'authenticated' }), true);
  assert.equal(h.calls.length, 1); assert.equal(h.posts().length, 0);
  h.data.token = 'Required'; assert.equal(await h.call({ operation: 'authenticated' }), false);
  const html = harness(); html.setIntercept(() => html.response({}, 200, 'text/html'));
  assert.equal(await html.call({ operation: 'authenticated' }), false);
  const login = harness({ origin: 'https://a5.ucsd.edu' });
  assert.equal(await login.call({ operation: 'authenticated' }), false); assert.equal(login.calls.length, 0);
});

test('background inspection is single-flight and returns only bounded public results', async () => {
  const h = harness(), readRequestId = crypto.randomUUID();
  assert.equal(h.call({ operation: 'inspect', background: true, readRequestId }).stage, 'loading');
  assert.equal(h.call({ operation: 'inspect', background: true, readRequestId }).stage, 'loading');
  assert.equal(h.call({ operation: 'inspect', background: true, readRequestId: crypto.randomUUID() }).reason, 'previous_attempt');
  assert.equal(h.book().result.reason, 'previous_attempt');
  await flush(); await flush();
  const value = h.call({ operation: 'readStatus', readRequestId });
  assert.equal(value.stage, 'ready'); assert.equal(value.ready, true); assert.equal(h.calls.length, 8);
  assert.doesNotMatch(JSON.stringify(value), /synthetic-session-token|00009000|00000200/);
  assert.equal(h.posts().length, 0);
});

test('background read timeout stops pending reads and does not claim ready', async () => {
  const h = harness(), readRequestId = crypto.randomUUID();
  h.setIntercept(call => call.url.endsWith('/PR_MY_MODULES_V2_SRV/')
    ? new Promise((resolve, reject) => call.init.signal.addEventListener('abort', () => reject(Error('aborted')))) : undefined);
  h.call({ operation: 'inspect', background: true, readRequestId });
  await flush(); h.readDeadline(); await flush();
  const value = h.call({ operation: 'readStatus', readRequestId });
  assert.equal(value.stage, 'stopped'); assert.equal(value.reason, 'course_load_timeout'); assert.equal(value.ready, false);
  assert.equal(h.posts().length, 0);
});

test('read-only history is bounded and a request ID cannot switch diagnostic operations', async () => {
  const h = harness(); const ids = [];
  for (let index = 0; index < 9; index++) {
    const readRequestId = crypto.randomUUID(); ids.push(readRequestId);
    await h.call({ operation: 'inspect', readRequestId });
  }
  assert.equal(h.call({ operation: 'readStatus', readRequestId: ids[0] }).reason, 'attempt_unavailable');
  assert.equal(h.call({ operation: 'compareNative', readRequestId: ids[8] }).reason, 'request_blocked');
});

test('native equivalence calls preparation only and exports no student payload or identifiers', async () => {
  const h = harness(); h.native();
  const value = await h.call({ operation: 'compareNative' });
  assert.equal(value.equivalent, true); assert.equal(value.ready, true); assert.deepEqual([...value.mismatchFields], []);
  assert.equal(h.nativeCalls, 1); assert.equal(h.posts().length, 0);
  assert.doesNotMatch(JSON.stringify(value), /00009000|00000200|00001234|synthetic-session-token|Items|TemplateId/);
});

test('equivalence reports only fixed field names and rejects native model edits before preparation', async () => {
  const h = harness(); h.native({ Credits: '99.000', PrivateUnexpectedField: 'private-native-value' });
  const value = await h.call({ operation: 'compareNative' });
  assert.equal(value.equivalent, false); assert.equal(value.reason, 'payload_mismatch');
  assert.deepEqual([...value.mismatchFields], ['Credits', 'UnexpectedFields']);
  assert.doesNotMatch(JSON.stringify(value), /99\.000|private-native-value|PrivateUnexpectedField|00009000/);
  const edited = harness(); edited.native({}, { pending: true });
  const blocked = await edited.call({ operation: 'compareNative' });
  assert.equal(blocked.reason, 'pending_changes'); assert.equal(edited.nativeCalls, 0); assert.equal(edited.posts().length, 0);
  const mismatch = harness(); mismatch.native().controller._oArguments.Objid = '5379';
  assert.equal((await mismatch.call({ operation: 'compareNative' })).reason, 'context_mismatch'); assert.equal(mismatch.nativeCalls, 0);
});

test('prepare derives context with authoritative GETs, without DOM, navigation or writes', async () => {
  const h = harness(); const value = await h.call({ operation: 'prepare' });
  assert.equal(value.loaded, true); assert.equal(value.ready, true); assert.equal(value.csrfReady, true); assert.equal(value.itemCount, 1);
  assert.equal(h.posts().length, 0); assert.equal(h.calls.length, 8);
  assert.ok(h.calls.some(call => call.url.includes("ScObjid='00009000'") && call.url.includes('/Template')));
  assert.ok(h.calls.some(call => decodeURIComponent(call.url).includes("AppName eq 'ITUS.MYMODULES'")));
  assert.ok(h.calls.some(call => call.url.includes("ModregId=guid'" + zeroGuid + "'")));
  assert.doesNotMatch(JSON.stringify(value), /synthetic-session-token|00009000|00000200/);
});

test('fresh package sends native CheckRegistration then identical SaveChanges payload, ignoring historical registration ID', async () => {
  const h = harness(); const { requestId, result } = h.book();
  assert.equal(result.stage, 'checking'); assert.equal((await h.settled(requestId)).stage, 'submitted');
  const posts = h.posts(); assert.equal(posts.length, 2);
  const expected = { ModuleId: '00013043', ActionName: 'SaveChanges', ProgramId: '00009000',
    Items: [{ EventId: '00001234', ModuleId: '00013043', AcademicYear: '2026', AcademicSession: '003', EventPackId: '166528' }],
    AssignedCg: '00000200', AssignedCgTop: '00000101', TemplateId: '0001', EventPackId: '166528', ModregId: zeroGuid,
    AcademicYear: '2026', AcademicSession: '003', Credits: '4.000', CreditUnit: 'UN' };
  assert.deepEqual(posts[0].payload, { ...expected, ActionName: 'CheckRegistration' }); assert.deepEqual(posts[1].payload, expected);
  assert.ok(posts.every(call => call.url.endsWith('/ActionHdrSet') && call.init.headers['X-CSRF-Token'] === h.data.token));
});

test('server-controlled write gate and exact known route prevent allocation or writes', async () => {
  const h = harness();
  assert.equal(h.call({ operation: 'book', requestId: crypto.randomUUID() }).reason, 'request_blocked');
  assert.equal(h.call({ operation: 'book', allowWrites: true, requestId: crypto.randomUUID(), route: route.replace('166528', '999999') }).reason, 'route_mismatch');
  assert.equal(h.call({ operation: 'prepare', courseCode: 'ECON-100A' }).reason, 'route_mismatch');
  assert.equal(h.calls.length, 0);
});

test('authoritative zero program/top-group values are preserved, never guessed', async () => {
  const h = harness(); h.data.groups[0].ScObjid = '00000000'; h.data.groups[0].CgTopObjid = '00000000';
  const { requestId } = h.book(); assert.equal((await h.settled(requestId)).stage, 'submitted');
  assert.equal(h.posts()[1].payload.ProgramId, '00000000'); assert.equal(h.posts()[1].payload.AssignedCgTop, '00000000');
});

test('duplicate Book and parallel attempts cannot generate duplicate writes', async () => {
  const h = harness(); const { requestId } = h.book();
  assert.equal(h.book(requestId).result.stage, 'checking'); assert.equal(h.book().result.reason, 'previous_attempt');
  await h.settled(requestId); h.book(requestId); await flush(); assert.equal(h.posts().length, 2);
});

test('native warning requires explicit one-use confirmation and unchanged payload', async () => {
  const h = harness(); h.data.check = { MessageType: 'W', Message: 'Official warning: this is a waitlist booking.' };
  const { requestId } = h.book(); const review = await h.settled(requestId);
  assert.equal(review.stage, 'review'); assert.match(review.reviewMessage, /waitlist/); assert.equal(h.posts().length, 1);
  assert.equal(h.call({ operation: 'confirm', requestId, allowWrites: true, confirmationId: crypto.randomUUID() }).reason, 'attempt_unavailable');
  assert.equal(h.posts().length, 1);
  h.call({ operation: 'confirm', requestId, allowWrites: true, confirmationId: review.confirmationId });
  h.call({ operation: 'confirm', requestId, allowWrites: true, confirmationId: review.confirmationId });
  assert.equal((await h.settled(requestId)).stage, 'submitted'); assert.equal(h.posts().length, 2);
  assert.deepEqual({ ...h.posts()[0].payload, ActionName: 'SaveChanges' }, h.posts()[1].payload);
});

test('changed server context after warning prevents SaveChanges without rerunning CheckRegistration', async () => {
  const h = harness(); h.data.check = { MessageType: 'W', Message: 'Review warning.' };
  const { requestId } = h.book(); const review = await h.settled(requestId);
  h.data.header.Credits = '5.000';
  h.call({ operation: 'confirm', requestId, allowWrites: true, confirmationId: review.confirmationId });
  const result = await h.settled(requestId); assert.equal(result.reason, 'booking_context_changed'); assert.equal(h.posts().length, 1);
});

test('cancelled warning never submits', async () => {
  const h = harness(); h.data.check = { MessageType: 'W', Message: 'Review warning.' };
  const { requestId } = h.book(); const review = await h.settled(requestId);
  assert.equal(h.call({ operation: 'cancel', requestId, allowWrites: true, confirmationId: review.confirmationId }).reason, 'booking_cancelled');
  await flush(); assert.equal(h.posts().length, 1);
});

test('ambiguous groups, ambiguous templates and unsupported settings fail before any POST', async () => {
  for (const change of [
    h => { h.data.header.AssignedCg = '0'; h.data.groups = [{ ...h.data.groups[0], Selected: false }, { ...h.data.groups[0], Selected: false, CgObjid: '201' }]; },
    h => { h.data.templates = [{ TemplateId: '1' }, { TemplateId: '2' }]; },
    h => h.data.settings.push({ Name: 'ENABLE_TOP_MODULE_BOOKING', Value: 'X' }),
    h => h.data.settings.push({ Name: 'ENABLE_AUTOBOOK', Value: 'X' }),
  ]) {
    const h = harness(); change(h); const { requestId } = h.book();
    assert.equal((await h.settled(requestId)).stage, 'stopped'); assert.equal(h.posts().length, 0);
  }
});

test('existing bookings, blocked eligibility and unavailable packages fail before any POST', async () => {
  for (const change of [
    h => { h.data.events[0].Booked = true; }, h => { h.data.exams = [{ Booked: true }]; },
    h => { h.data.package.BookingButtonEnabled = false; }, h => { h.data.package.WithdrawButtonEnabled = true; },
    h => { h.data.header.BookingCheckLog.results = [{ RulecheckResult: 'N' }]; },
  ]) {
    const h = harness(); change(h); const { requestId } = h.book();
    assert.equal((await h.settled(requestId)).stage, 'stopped'); assert.equal(h.posts().length, 0);
  }
});

test('mismatched course/term and ambiguous package events fail before any POST', async () => {
  for (const change of [
    h => { h.data.header.SmObjid = '5379'; }, h => { h.data.header.SmShort = 'PHIL-020'; },
    h => { h.data.events[0].AcademicSession = '2'; },
    h => { h.data.events[0].EventPackageId = '999999'; },
    h => { h.data.package.SmObjid = '999999'; },
    h => { h.data.events.push({ ...h.data.events[0], EventId: '2222' }); },
    h => { h.data.events.push({ ...h.data.events[0], DObjid: '2222' }); },
  ]) {
    const h = harness(); change(h); const { requestId } = h.book();
    assert.equal((await h.settled(requestId)).stage, 'stopped'); assert.equal(h.posts().length, 0);
  }
});

test('missing CSRF or login HTML cannot appear ready or issue writes', async () => {
  const h = harness(); h.data.token = 'Required';
  assert.equal((await h.call({ operation: 'prepare' })).reason, 'authentication_required'); assert.equal(h.posts().length, 0);
  const html = harness(); html.setIntercept(() => html.response({}, 200, 'text/html'));
  const { requestId } = html.book(); assert.equal((await html.settled(requestId)).reason, 'authentication_required'); assert.equal(html.posts().length, 0);
});

test('registration check error never advances to save', async () => {
  const h = harness(); h.data.check = { MessageType: 'E', Message: 'Not eligible.' };
  const { requestId } = h.book(); assert.equal((await h.settled(requestId)).reason, 'booking_error'); assert.equal(h.posts().length, 1);
  const http = harness(); http.setIntercept(call => call.payload && http.response({}, 503));
  const second = http.book(); assert.equal((await http.settled(second.requestId)).stage, 'stopped'); assert.equal(http.posts().length, 1);
});

test('uncertain save response locks later attempts and never retries', async () => {
  const h = harness(); h.setIntercept(call => { if (call.payload?.ActionName === 'SaveChanges') throw Error('network loss'); });
  const { requestId } = h.book(); assert.equal((await h.settled(requestId)).reason, 'submission_uncertain');
  assert.equal(h.book().result.reason, 'previous_attempt'); assert.equal(h.posts().length, 2);
});

test('deadline while save is pending stays uncertain even if a response arrives late', async () => {
  const h = harness(); let release;
  h.setIntercept(call => call.payload?.ActionName === 'SaveChanges' ? new Promise(resolve => { release = resolve; }) : undefined);
  const { requestId } = h.book();
  for (let index = 0; index < 50 && !release; index++) await flush();
  assert.ok(release); h.deadline(); release(h.response(h.data.save)); await flush();
  assert.equal((await h.settled(requestId)).reason, 'submission_uncertain'); assert.equal(h.posts().length, 2);
});

test('all server-owned routes are accepted for inspect without falling back to navigation', async () => {
  for (const [known, metadata] of BOOKING_ROUTES) {
    const h = harness(); const value = await h.call({ operation: 'inspect', route: known, courseCode: metadata.courseCode });
    assert.notEqual(value.reason, 'route_mismatch'); assert.ok(h.calls.length > 0); assert.equal(h.posts().length, 0);
  }
});

function assertSafeDiagnostics(value) {
  const safe = structuredClone(value);
  assert.ok(DIRECT_READ_STAGES.includes(safe.readStage));
  assert.ok(DIRECT_SCHEMA_ISSUES.includes(safe.schemaIssue));
  assert.ok(Array.isArray(safe.schemaIssues) && safe.schemaIssues.length <= 24);
  for (const issue of safe.schemaIssues) {
    assert.deepEqual(Object.keys(issue).sort(), ['readStage', 'schemaIssue']);
    assert.ok(DIRECT_READ_STAGES.includes(issue.readStage));
    assert.ok(DIRECT_SCHEMA_ISSUES.includes(issue.schemaIssue));
  }
  assert.equal(new Set(safe.schemaIssues.map(issue => issue.readStage + ':' + issue.schemaIssue)).size, safe.schemaIssues.length);
  for (const [name, shape] of Object.entries(safe.settingShapes || {})) {
    assert.ok(DIRECT_SETTING_FLAGS.includes(name)); assert.ok(DIRECT_SETTING_SHAPES.includes(shape));
  }
  assert.doesNotMatch(JSON.stringify(safe), /private-|synthetic-session-token|00013043|00001234|00009000|__proto__/);
  return new Set(safe.schemaIssues.map(issue => issue.readStage + ':' + issue.schemaIssue));
}

test('settings match native last-assignment semantics and ignore unrelated values', async () => {
  const h = harness();
  h.data.settings.push(
    { Name: 'private-unrelated', Value: { token: 'private-secret' } },
    { Name: '__proto__', Value: { private: true } }, { Name: null, Value: null },
    { Name: 'SHOW_TEMPLATE', Value: null }, { Name: 'SHOW_CREDITS', Value: 'private-other-value' },
    { Name: 'HIDE_TAB_EVENT', Value: true }, { Name: 'ENABLE_TOP_MODULE_BOOKING', Value: true },
    { Name: 'ENABLE_AUTOBOOK', Value: 'X' }, { Name: 'ENABLE_AUTOBOOK', Value: false },
  );
  const { requestId } = h.book(); assert.equal((await h.settled(requestId)).stage, 'submitted');
  assert.equal(h.posts()[1].payload.TemplateId, '0000');
  assert.equal(Object.hasOwn(h.posts()[1].payload, 'Credits'), false);
  assert.equal(h.calls.some(call => new URL(call.url).pathname.endsWith('/Template')), false);
  assert.equal(h.calls.some(call => new URL(call.url).pathname.endsWith('/Exam')), true);
  assert.doesNotMatch(JSON.stringify(h.posts().map(call => call.payload)), /private-|__proto__/);
});

test('only exact X enables native equality flags; any truthy autobook still blocks', async () => {
  for (const value of [undefined, null, '', ' ', 'false', false, true, 0, 1, {}, []]) {
    const h = harness();
    h.data.settings = DIRECT_SETTING_FLAGS.map(Name => ({ Name, Value: Name === 'ENABLE_AUTOBOOK' ? false : value }));
    assert.equal((await h.call({ operation: 'inspect' })).ready, true);
    assert.equal(h.posts().length, 0);
  }
  for (const value of ['X', ' ', 'false', true, 1, {}, []]) {
    const h = harness(); h.data.settings.push({ Name: 'ENABLE_AUTOBOOK', Value: value });
    const stopped = await h.call({ operation: 'inspect' });
    assert.equal(stopped.reason, 'unsupported_tss');
    assert.ok(assertSafeDiagnostics(stopped).has('settings:unsupported_autobook'));
    assert.equal(h.posts().length, 0);
  }
});

test('one failed initial read reports all available schema problems and final setting shapes', async () => {
  const h = harness();
  h.data.header.BookingCheckLog = { results: [null], __next: 'private-next-url' };
  h.data.settings.push(null, { Name: 'ENABLE_AUTOBOOK', Value: 'private-secret' }, { Name: 'SHOW_CREDITS', Value: { secret: 'private-value' } });
  h.setIntercept(call => call.url.endsWith('/PR_MY_MODULES_V2_SRV/')
    ? { ...h.response({}), text: async () => 'private-invalid-json' } : undefined);
  const value = await h.call({ operation: 'inspect' });
  assert.equal(value.reason, 'unsupported_tss'); assert.equal(value.ready, false);
  const issues = assertSafeDiagnostics(value);
  for (const issue of ['service:invalid_json', 'settings:nonobject_row', 'header_logs:paginated', 'header_logs:nonobject_row', 'settings:unsupported_autobook']) assert.ok(issues.has(issue), issue);
  assert.equal(value.settingShapes.ENABLE_AUTOBOOK, 'other_string'); assert.equal(value.settingShapes.SHOW_CREDITS, 'other');
  assert.equal(h.calls.length, 3); assert.equal(h.posts().length, 0);
});

test('parallel course reads collect collection failures before stopping, without template or write requests', async () => {
  const h = harness(); h.data.events[0].BookingCheckLog = { results: 'private-invalid-logs' }; h.data.events.push(null);
  h.setIntercept(call => {
    const path = new URL(call.url).pathname;
    if (path.endsWith('/ModuleGroup')) return h.response({ results: 'private-invalid-groups' });
    if (path.includes('/EventPackageSet(')) return h.response([]);
    if (path.endsWith('/Exam')) return h.response({ results: [], __next: 'private-next-url' });
  });
  const value = await h.call({ operation: 'inspect' });
  assert.equal(value.ready, false); const issues = assertSafeDiagnostics(value);
  for (const issue of ['package:invalid_d', 'events:nonobject_row', 'groups:not_collection', 'exams:paginated', 'event_logs:not_collection']) assert.ok(issues.has(issue), issue);
  assert.equal(h.calls.length, 7); assert.equal(h.posts().length, 0);
});

test('request failure diagnostics are resource-scoped, fixed and never copy response data', async () => {
  const cases = [
    ['http_error', h => h.response({}, 503)], ['authentication_http', h => h.response({}, 401)],
    ['not_json', h => h.response({}, 200, 'text/html')],
    ['response_large', h => ({ ...h.response({}), text: async () => 'x'.repeat(2_000_001) })],
    ['invalid_json', h => ({ ...h.response({}), text: async () => 'private-invalid-json' })],
    ['invalid_d', h => ({ ...h.response({}), text: async () => JSON.stringify({ private: 'private-value' }) })],
    ['error_envelope', h => ({ ...h.response({}), text: async () => JSON.stringify({ error: { message: 'private-error' } }) })],
    ['network_error', () => { throw Error('private-network-error'); }],
  ];
  for (const [expected, response] of cases) {
    const h = harness(); h.setIntercept(call => new URL(call.url).pathname.endsWith('/ParameterSet') ? response(h) : undefined);
    const value = await h.call({ operation: 'inspect' });
    assert.equal(value.ready, false); assert.ok(assertSafeDiagnostics(value).has('settings:' + expected));
    assert.equal(h.posts().length, 0);
  }
});

test('authentication rejection wins over parallel schema failure while preserving both diagnostics', async () => {
  const h = harness();
  h.setIntercept(call => {
    if (call.url.endsWith('/PR_MY_MODULES_V2_SRV/')) return h.response([]);
    if (new URL(call.url).pathname.endsWith('/ParameterSet')) return h.response({}, 403);
  });
  const value = await h.call({ operation: 'inspect' });
  assert.equal(value.reason, 'authentication_required');
  const issues = assertSafeDiagnostics(value);
  assert.ok(issues.has('service:invalid_d')); assert.ok(issues.has('settings:authentication_http'));
  assert.equal(h.posts().length, 0);
});

test('missing CSRF and unsupported read features are reported together while top flag stays visible as a shape', async () => {
  const h = harness(); h.data.token = 'Required';
  h.data.settings.push({ Name: 'ENABLE_AUTOBOOK', Value: 'X' }, { Name: 'ENABLE_TOP_MODULE_BOOKING', Value: 'X' }, { Name: 'HIDE_TAB_EVENT', Value: 'X' });
  const value = await h.call({ operation: 'inspect' });
  assert.equal(value.reason, 'authentication_required'); const issues = assertSafeDiagnostics(value);
  for (const issue of ['service:missing_csrf', 'settings:unsupported_autobook', 'settings:hidden_events']) assert.ok(issues.has(issue), issue);
  assert.equal(value.settingShapes.ENABLE_TOP_MODULE_BOOKING, 'X');
  assert.equal(h.posts().length, 0);
});

test('malformed template results and read timeout identify only their fixed resource', async () => {
  const template = harness(); template.setIntercept(call => new URL(call.url).pathname.endsWith('/Template') ? template.response({ results: 'private-template' }) : undefined);
  assert.ok(assertSafeDiagnostics(await template.call({ operation: 'inspect' })).has('templates:not_collection'));
  const timeout = harness(), readRequestId = crypto.randomUUID();
  timeout.setIntercept(call => new URL(call.url).pathname.endsWith('/ParameterSet')
    ? new Promise((resolve, reject) => call.init.signal.addEventListener('abort', () => reject(Error('private-abort')))) : undefined);
  timeout.call({ operation: 'inspect', background: true, readRequestId });
  await flush(); timeout.readDeadline(); await flush();
  const value = timeout.call({ operation: 'readStatus', readRequestId });
  assert.equal(value.reason, 'course_load_timeout'); assert.ok(assertSafeDiagnostics(value).has('settings:request_timeout'));
  assert.equal(timeout.posts().length, 0);
});

test('data top-module flag permits read preparation and standard native comparison but never Book', async () => {
  const h = harness(); h.data.settings.push({ Name: 'ENABLE_TOP_MODULE_BOOKING', Value: 'X' });
  const inspected = await h.call({ operation: 'inspect' });
  assert.equal(inspected.ready, true); assert.equal(h.posts().length, 0);
  const { controller } = h.native();
  controller.onSave = () => { throw Error('Booking handler must never be invoked'); };
  controller.saveCall = () => { throw Error('Save handler must never be invoked'); };
  const compared = await h.call({ operation: 'compareNative' });
  assert.equal(compared.nativeBookingPath, 'standard'); assert.equal(compared.dataTopModuleEnabled, true);
  assert.equal(compared.ready, true); assert.equal(compared.equivalent, true); assert.equal(h.nativeCalls, 1);
  const requestId = crypto.randomUUID();
  h.call({ operation: 'book', requestId, allowWrites: true, readOnly: true });
  assert.equal((await h.settled(requestId)).reason, 'unsupported_tss');
  assert.equal(h.posts().length, 0);
});

test('actual model-instance top-module branch is reported and cannot claim equivalence or ready', async () => {
  const h = harness(); h.data.settings.push({ Name: 'ENABLE_TOP_MODULE_BOOKING', Value: 'X' });
  h.native({}, { instanceSettings: { ENABLE_TOP_MODULE_BOOKING: 'X', private: 'private-value' } });
  const compared = await h.call({ operation: 'compareNative' });
  assert.equal(compared.nativeBookingPath, 'top_module'); assert.equal(compared.dataTopModuleEnabled, true);
  assert.equal(compared.ready, false); assert.equal(compared.equivalent, false); assert.equal(compared.reason, 'unsupported_tss');
  assert.equal(h.nativeCalls, 0); assert.equal(h.posts().length, 0);
  assert.doesNotMatch(JSON.stringify(compared), /private-|00013043|synthetic-session-token/);
});

test('unknown native model stays unverified; non-X instance flags follow the exact standard predicate', async () => {
  const unknown = harness(); unknown.native({}, { missingDefaultModel: true });
  const failed = await unknown.call({ operation: 'compareNative' });
  assert.equal(failed.nativeBookingPath, 'unknown'); assert.equal(failed.ready, false); assert.equal(failed.equivalent, false);
  assert.equal(Object.hasOwn(failed, 'dataTopModuleEnabled'), false); assert.equal(unknown.nativeCalls, 0);
  for (const value of [undefined, null, '', ' ', true, 'x']) {
    const h = harness(); h.native({}, { instanceSettings: { ENABLE_TOP_MODULE_BOOKING: value } });
    const compared = await h.call({ operation: 'compareNative' });
    assert.equal(compared.nativeBookingPath, 'standard'); assert.equal(compared.dataTopModuleEnabled, false);
    assert.equal(compared.ready, true); assert.equal(h.posts().length, 0);
  }
});
