import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { installTssBookingHelper } from '../src/scripts/tss-booking-helper.mjs';

const route = 'https://tss.ucsd.edu/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/14499/00000000/0/0/0/00000000-0000-0000-0000-000000000000/167237/2026/3/?';
const zeroGuid = '00000000-0000-0000-0000-000000000000';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// This fixture mirrors the saved Detail controller's two-stage native flow.
// It performs no HTTP, authentication, enrollment or UI automation.
function fixture(options = {}) {
  const listeners = new Map();
  const outbound = [];
  const requests = [];
  const warnings = [];
  const nativeEvents = [];
  const intervals = new Set();
  const timers = new Set();
  const appWindow = { closed: false, postMessage: (value, origin) => outbound.push({ value, origin }) };
  const element = () => ({
    style: {}, isConnected: true, textContent: '', id: '', children: [],
    append(...children) { this.children.push(...children); },
    remove() { this.isConnected = false; },
    addEventListener() {}, getClientRects: () => [{}], closest: () => null,
    getAttribute: () => 'detail-view',
  });
  const dom = element();
  const event = (id) => ({ EventId: id, SmObjid: '14499', AcademicYear: '2026', AcademicSession: '003', EventPackageId: '167237', Booked: false });
  let data = {
    busy: false, busyEvents: false, busyInformation: false, busyModuleGroups: false,
    EventPackageExist: true, BookingButtonEnabled: true, WithdrawButtonEnabled: false,
    detail: {
      SmObjid: '14499', SmOtype: 'SM', EventPackageId: '167237', AcademicYear: '2026', AcademicSession: '003', ModregId: zeroGuid,
      oCG: { CgObjid: '123', ScObjid: '456', CgTopObjid: '789', Bookable: true }, TemplateId: '100', Eligibility: [],
      // Saved _getEventData (Component-preload line 22, offset 61202):
      // EventPackageExist copies the boolean derived from the package route.
      EventTypes: ['00007898', '00007923'].map(id => ({ EventPackageExist: true, Selected: null, booked: false, oBooked: null, Events: [event(id)] })),
      ExamTypes: [],
    },
  };
  const model = {
    getData: () => data,
    getProperty: path => path.split('/').filter(Boolean).reduce((value, key) => value?.[key], data),
  };
  const nativeModel = { create(path, payload, callbacks) {
    requests.push({ path, payload: structuredClone(payload), callbacks });
    return { abort() {} };
  } };
  const args = { Source: 'EventPackage', Otype: 'SM', Objid: '14499', ScObjid: '00000000', CG: 0, CGTop: 0, State: 0,
    ModregId: zeroGuid, EventPackageId: '167237', AcademicYear: '2026', AcademicSession: '3' };
  const messageBox = { warning(message, config) { warnings.push({ message, config }); } };
  const controller = {
    _initialLoad: false, _oArguments: args,
    getMetadata: () => ({ getName: () => 'itus.mymodules.controller.Detail' }),
    getModel: name => name === 'detailView' ? model : name === 'oData' ? nativeModel : {},
    getOwnerComponent: () => ({ getModel: name => name === 'tempEventModel' && options.tempChange ? { getProperty: () => options.tempChange } : undefined }),
    _loadDetailData() { data = structuredClone(data); this._initialLoad = false; },
    _prepareSaveData() {
      const d = data.detail;
      return {
        ActionName: 'SaveChanges', ModuleId: d.SmObjid, EventPackId: d.EventPackageId,
        AcademicYear: d.AcademicYear, AcademicSession: d.AcademicSession, ModregId: zeroGuid,
        ProgramId: d.oCG.ScObjid, AssignedCg: d.oCG.CgObjid, AssignedCgTop: d.oCG.CgTopObjid, TemplateId: d.TemplateId,
        // Saved _prepareSaveData (line 22, offset 47833) constructs package
        // event items with these fields. AssessmentId/Cancel/Resit are absent.
        Items: d.EventTypes.map(type => ({ EventId: type.Events[0].EventId, ModuleId: type.Events[0].SmObjid,
          EventPackId: d.EventPackageId, AcademicYear: type.Events[0].AcademicYear, AcademicSession: type.Events[0].AcademicSession,
          ...(options.cancelItem ? { Cancel: true } : {}) })),
      };
    },
    onSave() {
      nativeEvents.push('onSave');
      if (options.needsChoice) return;
      const payload = this._prepareSaveData(false);
      payload.ActionName = 'CheckRegistration';
      data.busy = true;
      nativeModel.create('/ActionHdrSet', payload, {
        success: response => {
          if (response.MessageType) messageBox.warning(response.Message, { onClose: action => {
            if (action === 'OK') this.saveCall(false); else data.busy = false;
          } });
          else this.saveCall(true);
        },
        error: () => { nativeEvents.push('checkError'); data.busy = false; },
      });
    },
    saveCall() {
      nativeEvents.push('saveCall');
      data.busy = true;
      nativeModel.create('/ActionHdrSet', this._prepareSaveData(false), {
        success: () => { nativeEvents.push('saveSuccess'); data.busy = false; },
        error: () => { nativeEvents.push('saveError'); data.busy = false; },
      });
    },
  };
  const button = {
    isA: name => name === 'sap.m.Button', getBindingInfo: () => ({ parts: [{ model: 'i18n', path: 'SAVE' }] }),
    getVisible: () => !options.hiddenButton, getEnabled: () => !options.disabledButton,
    getDomRef: () => dom, firePress: () => { nativeEvents.push('firePress'); controller.onSave(); },
  };
  const view = {
    getController: () => controller, getDomRef: () => dom,
    findAggregatedObjects: (deep, predicate) => predicate(button) ? [button] : [],
  };
  controller.getView = () => view;
  const location = {
    origin: 'https://tss.ucsd.edu', pathname: '/fiori', href: route,
    get hash() { return new URL(this.href).hash; },
    set hash(value) { const url = new URL(this.href); url.hash = value; this.href = url.href; listeners.get('hashchange')?.forEach(fn => fn()); },
  };
  const windowMock = {
    location, crypto: { getRandomValues: array => array.fill(17) },
    open: () => appWindow, alert: message => nativeEvents.push(`alert:${message}`), getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    addEventListener(type, fn) { const set = listeners.get(type) || new Set(); set.add(fn); listeners.set(type, set); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    sap: { ui: { getCore: () => ({ byId: () => view }), require: () => messageBox }, m: { MessageBox: messageBox } },
  };
  const sandbox = {
    window: windowMock, document: { body: element(), createElement: element, querySelectorAll: () => [dom] },
    URL, Uint8Array, Date,
    setTimeout(fn, ms) { const id = setTimeout(fn, ms); timers.add(id); return id; }, clearTimeout,
    setInterval(fn, ms) { const id = setInterval(fn, ms); intervals.add(id); return id; }, clearInterval,
  };
  const context = vm.createContext(sandbox);
  const helper = vm.runInContext(`(${installTssBookingHelper.toString()})(${JSON.stringify({ loadTimeoutMs: 50, actionTimeoutMs: 100, pollMs: 2, ...options.config })})`, context);
  const nonce = outbound[0].value.nonce;
  const receive = (message, overrides = {}) => listeners.get('message')?.forEach(fn => fn({
    origin: 'https://boomerrawlings.com', source: appWindow,
    data: { channel: 'bbb-tss-v1', nonce, ...message }, ...overrides,
  }));
  const book = (id = 'request-1', target = route) => receive({ type: 'book', requestId: id, route: target });
  const cleanup = () => { helper.stop(); for (const id of intervals) clearInterval(id); for (const id of timers) clearTimeout(id); };
  receive({ type: 'ack' });
  return { helper, receive, book, cleanup, outbound, requests, warnings, nativeEvents, controller, model, nativeModel, location,
    appWindow, get data() { return data; }, statuses: () => outbound.filter(entry => entry.value.type === 'status').map(entry => entry.value.status) };
}

test('valid package automatically fires native Book once, check then save; duplicate messages/callbacks do not replay', t => {
  const f = fixture(); t.after(f.cleanup);
  f.book(); f.book();
  assert.deepEqual(f.nativeEvents, ['firePress', 'onSave']);
  assert.equal(f.requests[0].payload.ActionName, 'CheckRegistration');
  f.requests[0].callbacks.success({});
  f.requests[0].callbacks.success({});
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].payload.ActionName, 'SaveChanges');
  f.requests[1].callbacks.success({ MessageType: 'S' });
  f.requests[1].callbacks.success({ MessageType: 'S' });
  f.book();
  assert.equal(f.nativeEvents.filter(value => value === 'firePress').length, 1);
  assert.equal(f.nativeEvents.filter(value => value === 'saveCall').length, 1);
  assert.equal(f.nativeEvents.filter(value => value === 'saveSuccess').length, 1);
  assert.equal(f.statuses().at(-1), 'submitted');
});

test('native warning remains manual; Cancel submits nothing and stale OK is ignored', t => {
  const f = fixture(); t.after(f.cleanup); f.book();
  f.requests[0].callbacks.success({ MessageType: 'W', Message: 'Native warning text' });
  assert.equal(f.requests.length, 1);
  assert.equal(f.statuses().at(-1), 'review');
  f.warnings[0].config.onClose('CANCEL');
  f.warnings[0].config.onClose('OK');
  assert.equal(f.requests.length, 1);
  assert.equal(f.statuses().at(-1), 'stopped');
});

test('native warning OK runs one guarded SaveChanges', t => {
  const f = fixture(); t.after(f.cleanup); f.book();
  f.requests[0].callbacks.success({ MessageType: 'W', Message: 'Native warning text' });
  f.warnings[0].config.onClose('OK'); f.warnings[0].config.onClose('OK');
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[1].payload.ActionName, 'SaveChanges');
});

test('model changes between check and save fail closed; warning callback cannot use another course', t => {
  const f = fixture(); t.after(f.cleanup); f.book();
  f.requests[0].callbacks.success({ MessageType: 'W', Message: 'Native warning text' });
  f.data.detail.TemplateId = 'changed';
  f.warnings[0].config.onClose('OK');
  assert.equal(f.requests.length, 1);
  assert.equal(f.helper.state, 'locked');
});

test('navigation during check blocks late check callback and further requests', t => {
  const f = fixture(); t.after(f.cleanup); f.book();
  f.location.hash = '#Shell-home';
  f.requests[0].callbacks.success({});
  f.book('request-2');
  assert.equal(f.requests.length, 1);
  assert.equal(f.helper.state, 'locked');
});

test('disconnect or closed BBB window blocks pending native callbacks', t => {
  for (const close of [false, true]) {
    const f = fixture(); t.after(f.cleanup); f.book();
    if (close) f.appWindow.closed = true; else f.receive({ type: 'disconnect' });
    f.requests[0].callbacks.success({});
    assert.equal(f.requests.length, 1);
    assert.equal(f.helper.state, 'locked');
  }
});

test('timeout retains gates; late warning approval cannot submit', async t => {
  const f = fixture({ config: { actionTimeoutMs: 10 } }); t.after(f.cleanup); f.book();
  f.requests[0].callbacks.success({ MessageType: 'W', Message: 'Native warning text' });
  await sleep(25);
  f.warnings[0].config.onClose('OK');
  assert.equal(f.requests.length, 1);
  assert.equal(f.helper.state, 'locked');
});

test('existing registration, cancelled items, changed selections and wrong event IDs never fire Book', t => {
  for (const mode of ['registered', 'booked', 'cancel', 'changed', 'wrong']) {
    const f = fixture({ cancelItem: mode === 'cancel', tempChange: mode === 'changed' ? '[]' : undefined }); t.after(f.cleanup);
    if (mode === 'registered') f.data.detail.ModregId = '11111111-2222-3333-4444-555555555555';
    if (mode === 'booked') f.data.detail.EventTypes[0].booked = true;
    if (mode === 'wrong') f.data.detail.EventTypes[0].Events[0].SmObjid = 'other';
    f.book();
    assert.equal(f.requests.length, 0, mode);
    assert.equal(f.nativeEvents.includes('firePress'), false, mode);
  }
});

test('wrong origin, source, nonce and unsupported navigation routes are ignored or refused', t => {
  const f = fixture(); t.after(f.cleanup);
  const message = { type: 'book', requestId: 'bad', route };
  f.receive(message, { origin: 'https://attacker.example' });
  f.receive(message, { source: {} });
  f.receive({ ...message, nonce: 'bad' });
  f.book('bad-url', 'https://tss.ucsd.edu/fiori#Shell-home');
  f.book('bad-origin', route.replace('tss.ucsd.edu', 'attacker.example'));
  assert.equal(f.requests.length, 0);
});

test('semantic error and transport error on final submission never report submitted and lock retries', t => {
  for (const mode of ['E', 'A', 'transport']) {
    const f = fixture(); t.after(f.cleanup); f.book(); f.requests[0].callbacks.success({});
    if (mode === 'transport') f.requests[1].callbacks.error({ responseText: 'private error detail' });
    else f.requests[1].callbacks.success({ MessageType: mode, Message: 'private error detail' });
    f.book('another');
    assert.equal(f.requests.length, 2);
    assert.equal(f.statuses().includes('submitted'), false);
    assert.equal(f.helper.state, 'locked');
    assert.equal(JSON.stringify(f.outbound).includes('private error detail'), false);
  }
});

test('drop action while helper is active is blocked; no authored or modified requests', t => {
  const f = fixture(); t.after(f.cleanup); f.book();
  f.nativeModel.create('/ActionHdrSet', { ActionName: 'CancelBooking' }, {});
  assert.equal(f.requests.length, 1);
  assert.equal(f.helper.state, 'locked');
  f.requests[0].callbacks.success({});
  assert.equal(f.requests.length, 1);
});

test('native validation requiring choices does not manufacture or retry a request', t => {
  const f = fixture({ needsChoice: true }); t.after(f.cleanup); f.book();
  assert.equal(f.requests.length, 0);
  assert.equal(f.nativeEvents.filter(value => value === 'firePress').length, 1);
  assert.equal(f.statuses().at(-1), 'stopped');
});

test('request IDs remain deduplicated for the whole connection, beyond 100 messages', t => {
  const f = fixture({ needsChoice: true }); t.after(f.cleanup);
  f.book('first');
  for (let index = 0; index < 110; index++) f.book(`rejected-${index}`, 'https://tss.ucsd.edu/fiori#Shell-home');
  f.book('first');
  assert.equal(f.nativeEvents.filter(value => value === 'firePress').length, 1);
  assert.equal(f.requests.length, 0);
});

test('saved package item shape omits assessment defaults; unselected exams add no assessment action', t => {
  const f = fixture(); t.after(f.cleanup);
  // _getExamData initializes Selected:null, booked:false and oBooked:null.
  // _prepareSaveData emits assessment items only when Selected is present.
  f.data.detail.ExamTypes = [{ Selected: null, booked: false, oBooked: null, DoRepetition: false, Offers: [] }];
  f.book();
  assert.equal(f.requests.length, 1);
  for (const item of f.requests[0].payload.Items) {
    assert.equal(Object.hasOwn(item, 'AssessmentId'), false);
    assert.equal(Object.hasOwn(item, 'Cancel'), false);
    assert.equal(Object.hasOwn(item, 'Resit'), false);
  }
  f.requests[0].callbacks.success({});
  assert.equal(f.requests[1].payload.ActionName, 'SaveChanges');
});
