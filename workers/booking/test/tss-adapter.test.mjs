import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { detectAuthenticated, detectSessionCsrf, inspectTss, beginBook, getBookingStatus } from '../src/tss-adapter.mjs';

const route = 'https://tss.ucsd.edu/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/14499/00000000/0/0/0/00000000-0000-0000-0000-000000000000/167237/2026/3/?';
const zero = '00000000-0000-0000-0000-000000000000';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Synthetic SAPUI5 controller; no network, account, enrollment or real browser.
function fixture(options = {}) {
  const calls = [], warnings = [], fetches = [], timers = new Set(), listeners = new Map();
  let presses = 0, prepares = 0, refreshes = 0;
  let data = { busy: false, busyEvents: false, EventPackageExist: true, BookingButtonEnabled: true,
    detail: { SmObjid: '14499', SmOtype: 'SM', EventPackageId: '167237', AcademicYear: '2026', AcademicSession: '003', ModregId: zero,
      oCG: { CgObjid: '123', ScObjid: '456', CgTopObjid: '789', Bookable: true }, TemplateId: '100', Eligibility: [], ExamTypes: [],
      EventTypes: ['7898', '7923'].map(id => ({ EventPackageExist: true, Events: [{ EventId: id, SmObjid: '14499', EventPackageId: '167237', AcademicYear: '2026', AcademicSession: '003' }] })) } };
  const model = { getData: () => data, getProperty: path => path.split('/').filter(Boolean).reduce((value, key) => value?.[key], data) };
  const nativeModel = { create(path, payload, callbacks) { calls.push({ path, payload: structuredClone(payload), callbacks }); return { abort() {} }; } };
  const box = { warning(message, config) { warnings.push({ message, config }); } };
  const dom = { isConnected: true, getClientRects: () => [{}], closest: () => null, getAttribute: () => 'detail' };
  const controller = {
    _initialLoad: false,
    _oArguments: { Source: 'EventPackage', Otype: 'SM', Objid: '14499', ScObjid: '00000000', CG: 0, CGTop: 0, State: 0, ModregId: zero, EventPackageId: '167237', AcademicYear: '2026', AcademicSession: '3' },
    getMetadata: () => ({ getName: () => 'itus.mymodules.controller.Detail' }),
    getModel: name => name === 'detailView' ? model : name === 'oData' ? nativeModel : {},
    getOwnerComponent: () => ({ getModel: () => options.changed ? { getProperty: () => ({}) } : undefined }),
    _loadDetailData() { refreshes++; if (options.noRefresh) return; data = structuredClone(data); this._initialLoad = false; },
    _prepareSaveData() {
      prepares++;
      const d = data.detail;
      return { ActionName: 'SaveChanges', ModuleId: d.SmObjid, EventPackId: d.EventPackageId, AcademicYear: d.AcademicYear, AcademicSession: d.AcademicSession,
        ModregId: zero, ProgramId: d.oCG.ScObjid, AssignedCg: d.oCG.CgObjid, AssignedCgTop: d.oCG.CgTopObjid, TemplateId: d.TemplateId,
        Items: d.EventTypes.map(type => ({ EventId: type.Events[0].EventId, ModuleId: d.SmObjid, EventPackId: d.EventPackageId,
          AcademicYear: d.AcademicYear, AcademicSession: d.AcademicSession, ...(options.extraItem || {}) })) };
    },
    onSave() {
      if (options.needsChoice) return;
      const payload = this._prepareSaveData(); payload.ActionName = 'CheckRegistration'; data.busy = true;
      nativeModel.create('/ActionHdrSet', payload, { success: response => {
        if (response.MessageType) box.warning(response.Message, { onClose: action => { if (action === 'OK') this.saveCall(false); else data.busy = false; } });
        else this.saveCall(true);
      }, error: () => { data.busy = false; } });
    },
    saveCall() { nativeModel.create('/ActionHdrSet', this._prepareSaveData(), { success: () => { data.busy = false; }, error: () => { data.busy = false; } }); },
  };
  const button = { isA: name => name === 'sap.m.Button', getBindingInfo: () => ({ parts: [{ model: 'i18n', path: 'SAVE' }] }),
    getVisible: () => true, getEnabled: () => !options.disabled, getDomRef: () => dom, firePress: () => { presses++; controller.onSave(); } };
  const view = { getController: () => controller, getDomRef: () => dom, findAggregatedObjects: (deep, predicate) => predicate(button) ? [button] : [] };
  const location = { origin: 'https://tss.ucsd.edu', pathname: '/fiori', href: route };
  const window = { location, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); },
    async fetch(url, init) { fetches.push({ url, init }); if (options.fetchFailure) throw Error('synthetic fetch failure');
      return { ok: options.httpError !== true, headers: { get: () => options.csrfToken ?? 'synthetic-token-never-returned' } }; },
    sap: { ushell: { Container: { getUser: () => ({ getId: () => options.guest ? 'guest' : 'synthetic-account' }) } },
      ui: { getCore: () => ({ byId: () => view }), require: () => box }, m: { MessageBox: box } } };
  const sandbox = vm.createContext({ window, document: { querySelector: () => dom, querySelectorAll: () => [dom] }, URL, AbortSignal,
    setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timers.add(timer); return timer; }, clearTimeout });
  const page = { async evaluate(fn, input) { return structuredClone(await vm.runInContext(`(${fn.toString()})(${JSON.stringify(input)})`, sandbox)); } };
  return { page, calls, warnings, fetches, controller, nativeModel, location, get data() { return data; },
    get presses() { return presses; }, get prepares() { return prepares; }, get refreshes() { return refreshes; },
    close() { timers.forEach(clearTimeout); },
    begin(id = 'attempt-1', overrides = {}) { return beginBook(page, { route, requestId: id, actionTimeoutMs: 1000, loadTimeoutMs: 100, pollMs: 2, ...overrides }); },
    status(id = 'attempt-1') { return getBookingStatus(page, { requestId: id }); } };
}

test('read-only inspection verifies exact package without preparing payload, refreshing or pressing Book', async t => {
  const f = fixture(); t.after(f.close);
  assert.equal(await detectAuthenticated(f.page), true);
  assert.equal((await inspectTss(f.page, { route })).ready, true);
  assert.equal((await inspectTss(f.page, { route })).loaded, true);
  assert.equal((await inspectTss(f.page, { route: route.replace('/167237/', '/167238/') })).ready, false);
  assert.equal((await inspectTss(f.page, { route: route.replace('/167237/', '/167238/') })).loaded, false);
  assert.equal(f.prepares, 0); assert.equal(f.refreshes, 0); assert.equal(f.presses, 0); assert.equal(f.calls.length, 0);
  assert.equal(JSON.stringify(await inspectTss(f.page, { route })).includes('synthetic-account'), false);
});

test('read-only inspection proves an already-booked or ineligible package loaded without returning its status', async t => {
  for (const mutate of [f => { f.data.detail.ModregId = '11111111-1111-1111-1111-111111111111'; }, f => { f.data.detail.oCG.Bookable = false; }]) {
    const f = fixture(); t.after(f.close); mutate(f);
    const result = await inspectTss(f.page, { route });
    assert.equal(result.loaded, true); assert.equal(result.ready, false);
    assert.equal(result.message, 'Booking requires review in TSS.');
    assert.equal(f.prepares, 0); assert.equal(f.refreshes, 0); assert.equal(f.calls.length, 0);
    assert.deepEqual(Object.keys(result).sort(), ['loaded', 'message', 'ready', 'stage']);
  }
});

test('CSRF availability uses one fixed same-origin GET and returns only boolean, never token/body', async t => {
  const f = fixture(); t.after(f.close);
  assert.equal(await detectSessionCsrf(f.page), true);
  assert.equal(f.fetches.length, 1);
  const { url, init } = f.fetches[0];
  assert.equal(url, 'https://tss.ucsd.edu/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/');
  assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error');
  assert.equal(init.headers['X-CSRF-Token'], 'Fetch'); assert.equal(init.body, undefined);
  assert.equal(f.calls.length, 0); assert.equal(f.prepares, 0); assert.equal(f.presses, 0);
});

test('CSRF availability fails closed for unauthenticated, wrong-origin, missing token, failed HTTP or fetch', async t => {
  for (const options of [{ guest: true }, { csrfToken: '' }, { csrfToken: 'Required' }, { httpError: true }, { fetchFailure: true }, { wrongOrigin: true }]) {
    const f = fixture(options); t.after(f.close);
    if (options.wrongOrigin) f.location.origin = 'https://example.test';
    assert.equal(await detectSessionCsrf(f.page), false);
    if (options.guest || options.wrongOrigin) assert.equal(f.fetches.length, 0);
    assert.equal(f.calls.length, 0);
  }
});

test('guest, wrong origin, busy page and disabled native Book cannot become ready', async t => {
  for (const options of [{ guest: true }, { disabled: true }, {}]) {
    const f = fixture(options); t.after(f.close);
    if (!options.guest && !options.disabled) f.location.origin = 'https://example.test';
    assert.equal((await inspectTss(f.page, { route })).ready, false);
    assert.equal((await f.begin()).stage, 'stopped'); assert.equal(f.calls.length, 0);
  }
  const f = fixture(); t.after(f.close); f.data.busyEvents = true;
  assert.equal((await inspectTss(f.page, { route })).ready, false);
});

test('one explicit begin refreshes then native CheckRegistration and SaveChanges; IDs and callbacks deduplicate', async t => {
  const f = fixture(); t.after(f.close);
  assert.equal((await f.begin()).stage, 'checking'); assert.equal(f.refreshes, 1); assert.equal(f.presses, 1);
  assert.equal(f.calls[0].payload.ActionName, 'CheckRegistration');
  assert.equal((await f.begin()).stage, 'checking'); assert.equal(f.presses, 1);
  f.calls[0].callbacks.success({}); f.calls[0].callbacks.success({});
  assert.equal(f.calls.length, 2); assert.equal(f.calls[1].payload.ActionName, 'SaveChanges');
  f.calls[1].callbacks.success({});
  assert.equal((await f.status()).stage, 'submitted'); assert.equal((await f.begin()).stage, 'submitted'); assert.equal(f.presses, 1);
  assert.deepEqual(Object.keys(await f.status()).sort(), ['message', 'stage']);
});

test('official warning remains manual; cancellation never submits and stale approval is ignored', async t => {
  const f = fixture(); t.after(f.close); await f.begin();
  f.calls[0].callbacks.success({ MessageType: 'W', Message: 'Synthetic warning' });
  assert.equal((await f.status()).stage, 'review'); assert.equal(f.calls.length, 1);
  f.warnings[0].config.onClose('CANCEL'); f.warnings[0].config.onClose('OK');
  assert.equal(f.calls.length, 1); assert.equal((await f.status()).stage, 'stopped');
});

test('official warning OK triggers exactly one guarded native save', async t => {
  const f = fixture(); t.after(f.close); await f.begin();
  f.calls[0].callbacks.success({ MessageType: 'W', Message: 'Synthetic warning' });
  f.warnings[0].config.onClose('OK'); f.warnings[0].config.onClose('OK');
  assert.equal(f.calls.length, 2); assert.equal((await f.status()).stage, 'submitting');
});

test('context/payload/navigation changes between check and save fail closed', async t => {
  for (const mutate of [f => { f.data.detail.TemplateId = 'changed'; }, f => { f.location.href = route.replace('/167237/', '/167238/'); }, f => { f.data.detail.EventTypes[0].Events[0].EventId = '999'; }, f => f.controller._loadDetailData()]) {
    const f = fixture(); t.after(f.close); await f.begin(); mutate(f); f.calls[0].callbacks.success({});
    assert.equal(f.calls.length, 1); assert.equal((await f.status()).stage, 'stopped');
    assert.equal((await f.begin('attempt-2')).stage, 'stopped'); assert.equal(f.presses, 1);
  }
});

test('existing registration, changes and assessment extras cannot press Book', async t => {
  for (const mutate of [f => { f.data.detail.ModregId = '11111111-1111-1111-1111-111111111111'; }, f => { f.data.WithdrawButtonEnabled = true; },
    f => { f.data.detail.EventTypes[0].Changed = true; }, f => { f.data.detail.ExamTypes = [{ Selected: { AssessmentId: '1' } }]; }]) {
    const f = fixture(); t.after(f.close); mutate(f); assert.equal((await f.begin()).stage, 'stopped'); assert.equal(f.presses, 0);
  }
  for (const extraItem of [{ Cancel: true }, { AssessmentId: '1' }, { Resit: true }]) {
    const f = fixture({ extraItem }); t.after(f.close); assert.equal((await f.begin()).stage, 'stopped'); assert.equal(f.presses, 0);
  }
});

test('deadline keeps native gates installed and late callback cannot submit', async t => {
  const f = fixture(); t.after(f.close); await f.begin('attempt-1', { actionTimeoutMs: 15 }); await wait(30);
  assert.equal((await f.status()).stage, 'stopped'); f.calls[0].callbacks.success({}); f.controller.saveCall();
  assert.equal(f.calls.length, 1); assert.equal((await f.begin('attempt-2')).stage, 'stopped');
});

test('semantic save error or uncertain transport outcome never reports submitted or retries', async t => {
  for (const fail of [call => call.callbacks.success({ MessageType: 'E' }), call => call.callbacks.error({})]) {
    const f = fixture(); t.after(f.close); await f.begin(); f.calls[0].callbacks.success({}); fail(f.calls[1]);
    assert.equal((await f.status()).stage, 'error'); assert.equal((await f.begin('attempt-2')).stage, 'stopped'); assert.equal(f.calls.length, 2);
  }
});

test('unrelated writes/drop and incomplete native selection are never authored or replayed', async t => {
  const f = fixture(); t.after(f.close); await f.begin();
  f.nativeModel.create('/ActionHdrSet', { ActionName: 'CancelBooking' }, {});
  f.nativeModel.create('/OtherSet', {}, {});
  assert.equal(f.calls.length, 1); assert.equal((await f.status()).stage, 'stopped');
  const g = fixture({ needsChoice: true }); t.after(g.close);
  assert.equal((await g.begin()).stage, 'stopped'); assert.equal(g.calls.length, 0); assert.equal(g.presses, 1);
});

test('same-package refresh must return fresh data before native Book; stale data times out', async t => {
  const f = fixture({ noRefresh: true }); t.after(f.close);
  assert.equal((await f.begin('attempt-1', { loadTimeoutMs: 10 })).stage, 'loading'); await wait(25);
  assert.equal((await f.status()).stage, 'error'); assert.equal(f.presses, 0);
});
