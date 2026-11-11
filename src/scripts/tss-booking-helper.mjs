// Self-contained: the site serializes this function into its bookmarklet.
// Requests are issued only by TSS's own Book handler, never by this helper.
export function installTssBookingHelper(config = {}) {
  const w = window;
  const doc = document;
  const channel = 'bbb-tss-v1';
  const marker = '__bbbTssBookingHelperV1';
  const tssOrigin = config.tssOrigin || 'https://tss.ucsd.edu';
  const appOrigin = config.appOrigin || 'https://boomerrawlings.com';
  const appPath = config.appPath || '/0311/';
  const loadTimeout = config.loadTimeoutMs || 45000;
  const actionTimeout = config.actionTimeoutMs || 120000;
  const pollDelay = config.pollMs || 200;
  const peerTimeout = config.peerTimeoutMs || 30000;
  if (w.location.origin !== tssOrigin || !/^\/fiori\/?$/.test(w.location.pathname)) {
    w.alert('Open your signed-in TSS page, then activate the BBB helper there.');
    return null;
  }
  if (w[marker]?.state === 'locked' || w[marker]?.inFlight) {
    w.alert('A previous booking attempt is still guarded. Check TSS and reload before reconnecting.');
    return w[marker];
  }
  w[marker]?.stop();
  const appUrl = new URL(appPath, appOrigin);
  if (appUrl.origin !== appOrigin || new URL(tssOrigin).origin !== tssOrigin) throw new Error('Invalid helper origins.');
  const nonce = Array.from(w.crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, '0')).join('');
  appUrl.hash = `tss-connect=${nonce}`;
  const appWindow = w.open(appUrl.href, '_blank');
  if (!appWindow) {
    w.alert('Allow this TSS popup, then activate the BBB helper again.');
    return null;
  }
  let paired = false;
  let disconnected = false;
  let locked = false;
  let active = null;
  let lastPeerAt = Date.now();
  const history = new Map();
  const panel = doc.createElement('div');
  panel.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483647;max-width:330px;padding:12px;background:#172735;color:#fff;border:1px solid #abc;border-radius:8px;font:14px/1.4 system-ui;box-shadow:0 2px 16px #0005';
  const panelText = doc.createElement('div');
  const stopButton = doc.createElement('button');
  stopButton.textContent = 'Stop BBB helper';
  stopButton.style.cssText = 'margin-top:8px;padding:5px 9px;cursor:pointer';
  panel.append(panelText, stopButton);
  doc.body.append(panel);
  const say = message => { panelText.textContent = message; };
  const send = envelope => {
    try { if (!appWindow.closed) appWindow.postMessage({ channel, nonce, ...envelope }, appOrigin); } catch { /* User may close the companion tab. */ }
  };
  const status = (job, value, message) => {
    if (job) {
      const envelope = { type: 'status', requestId: job.id, status: value, message };
      history.set(job.id, envelope);
      send(envelope);
    }
    say(message);
  };
  const digits = value => /^\d+$/.test(String(value)) ? String(value).replace(/^0+(?=\d)/, '') : null;
  const same = (left, right) => digits(left) !== null && digits(left) === digits(right);
  const nonzeroGuid = value => value && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(String(value));
  function targetFor(route) {
    if (typeof route !== 'string' || route.length > 1200) return null;
    let url;
    try { url = new URL(route); } catch { return null; }
    if (url.origin !== tssOrigin || url.username || url.password || !/^\/fiori\/?$/.test(url.pathname) || url.search) return null;
    const match = url.hash.match(/^#ZUSModule-display\?TileType=MYMOD&\/Detail\/EventPackage\/SM\/(\d+)\/00000000\/0\/0\/0\/00000000-0000-0000-0000-000000000000\/(\d+)\/(\d{4})\/(\d+)\/\??$/);
    if (!match || match.slice(1).some(value => digits(value) === '0')) return null;
    return { hash: url.hash, module: match[1], package: match[2], year: match[3], session: match[4] };
  }
  const sameTarget = (left, right) => left && right && ['module', 'package', 'year', 'session'].every(key => same(left[key], right[key]));
  function shown(control) {
    const element = control?.getDomRef?.();
    if (!element || element.isConnected === false || !element.getClientRects().length) return false;
    if (element.closest?.('[aria-hidden="true"]')) return false;
    const style = w.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }
  function saveBinding(control) {
    if (!control?.isA?.('sap.m.Button')) return false;
    const binding = control.getBindingInfo?.('text');
    return [binding, ...(binding?.parts || [])].some(part => part?.model === 'i18n' && part?.path === 'SAVE');
  }
  function findContext() {
    const core = w.sap?.ui?.getCore?.();
    if (!core) return null;
    const candidates = new Map();
    for (const element of doc.querySelectorAll('[data-sap-ui]')) {
      let control = core.byId(element.getAttribute('data-sap-ui') || element.id);
      for (let depth = 0; control && depth < 30; depth++, control = control.getParent?.()) {
        const controller = control.getController?.();
        if (controller?.getMetadata?.().getName() === 'itus.mymodules.controller.Detail' && shown(control)) {
          candidates.set(controller, control);
          break;
        }
      }
    }
    if (candidates.size !== 1) return null;
    const [controller, view] = [...candidates][0];
    const buttons = view.findAggregatedObjects?.(true, saveBinding) || [];
    const visible = buttons.filter(button => button.getVisible?.() && shown(button));
    return { controller, view, button: visible.length === 1 ? visible[0] : null,
      model: controller.getModel('detailView'), nativeModel: controller.getModel('oData') };
  }
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  };
  function fingerprint(payload) {
    return JSON.stringify(canonical({ ...payload, ActionName: 'SaveChanges' }));
  }
  function inspect(context, target, allowBusy = false) {
    if (!context || !sameTarget(targetFor(w.location.href), target)) return { ready: false };
    const c = context.controller;
    const m = context.model;
    const d = m?.getProperty('/detail');
    const args = c._oArguments;
    if (!d || !args || c._initialLoad !== false) return { ready: false };
    if (args.Source !== 'EventPackage' || args.Otype !== 'SM' || args.NavFromMode
      || !same(args.Objid, target.module) || !same(args.EventPackageId, target.package)
      || !same(args.AcademicYear, target.year) || !same(args.AcademicSession, target.session)) return { ready: false };
    if (d.SmOtype !== 'SM' || !same(d.SmObjid, target.module) || !same(d.EventPackageId, target.package)
      || !same(d.AcademicYear, target.year) || !same(d.AcademicSession, target.session)) return { ready: false };
    const data = m.getData();
    if (Object.entries(data).some(([key, value]) => /^busy/i.test(key) && value === true && !(allowBusy && key === 'busy'))) return { ready: false };
    const types = d.EventTypes;
    const exams = d.ExamTypes || [];
    if (!Array.isArray(types) || !types.length || !Array.isArray(exams)) return { ready: false };
    if (nonzeroGuid(d.ModregId) || data.WithdrawButtonEnabled || types.some(type => type.booked || type.oBooked || type.Events?.some(event => event.Booked))
      || exams.some(exam => exam.booked || exam.oBooked || exam.Selected?.Booked)) {
      return { stop: 'TSS shows an existing registration. Review it in TSS; BBB will not change or drop it.' };
    }
    if (c.getOwnerComponent().getModel('tempEventModel')?.getProperty('/changedEvent') !== undefined
      || types.some(type => type.Changed) || args.NavFromMode === 'ChangeEvent') {
      return { stop: 'TSS has pending section changes. Review them in TSS before using BBB.' };
    }
    if (!data.EventPackageExist || !data.BookingButtonEnabled || !context.button?.getEnabled?.()
      || !context.button.getVisible() || !shown(context.button)) return { ready: false };
    if (!d.oCG?.Bookable || !digits(d.oCG.CgObjid) || digits(d.oCG.CgObjid) === '0') return { stop: 'Choose the course group in TSS before using BBB.' };
    if (d.Eligibility?.some(item => item.RulecheckResult === 'N')) return { stop: 'TSS reports a booking requirement. Review it in TSS.' };
    let payload;
    try { payload = c._prepareSaveData(false); } catch { return { stop: 'TSS booking details are incomplete. Review the course in TSS.' }; }
    if (payload.ActionName !== 'SaveChanges' || !same(payload.ModuleId, target.module) || !same(payload.EventPackId, target.package)
      || !same(payload.AcademicYear, target.year) || !same(payload.AcademicSession, target.session)
      || nonzeroGuid(payload.ModregId) || !Array.isArray(payload.Items) || !payload.Items.length) {
      return { stop: 'The TSS booking details do not match the requested package.' };
    }
    const expected = [];
    for (const type of types) {
      if (!type.EventPackageExist || !Array.isArray(type.Events) || type.Events.length !== 1) return { stop: 'TSS has an ambiguous section selection. Review it in TSS.' };
      const event = type.Events[0];
      if (!digits(event.EventId) || digits(event.EventId) === '0' || !same(event.SmObjid, target.module)
        || !same(event.AcademicYear, target.year) || !same(event.AcademicSession, target.session)
        || (event.EventPackageId != null && !same(event.EventPackageId, target.package))) return { stop: 'A TSS section does not match the requested package.' };
      expected.push(digits(event.EventId));
    }
    const actual = [];
    for (const item of payload.Items) {
      if (item.Cancel || item.AssessmentId || item.Resit || !digits(item.EventId) || !same(item.ModuleId, target.module)
        || !same(item.EventPackId, target.package) || !same(item.AcademicYear, target.year) || !same(item.AcademicSession, target.session)) {
        return { stop: 'The native action includes changes beyond this booking. Review it in TSS.' };
      }
      actual.push(digits(item.EventId));
    }
    if (new Set(actual).size !== actual.length || JSON.stringify(actual.sort()) !== JSON.stringify(expected.sort())) {
      return { stop: 'The native action does not match this package’s sections.' };
    }
    return { ready: true, payload, fingerprint: fingerprint(payload), detail: d };
  }
  function clearJobTimers(job) {
    clearTimeout(job.poll);
    clearTimeout(job.deadline);
  }
  function restore(job) {
    if (job.context?.controller.saveCall === job.guardedSave) job.context.controller.saveCall = job.originalSave;
    if (job.context?.nativeModel.create === job.guardedCreate) job.context.nativeModel.create = job.originalCreate;
  }
  function finish(job, value, message) {
    if (active !== job || job.done) return;
    job.done = true;
    clearJobTimers(job);
    restore(job);
    status(job, value, message);
    active = null;
  }
  function failClosed(job, message, value = 'stopped') {
    if (job.done || active !== job) return;
    job.locked = true;
    locked = true;
    clearJobTimers(job);
    // Keep native gates installed: a delayed check/warning must never regain
    // an unguarded saveCall after timeout, navigation or disconnection.
    status(job, value, message + ' Check TSS and reload before reconnecting.');
  }
  function guardSnapshot(job) {
    if (job.locked || job.done || active !== job || disconnected || appWindow.closed || Date.now() - lastPeerAt > peerTimeout) return false;
    const result = inspect(job.context, job.target, true);
    return result.ready && result.fingerprint === job.fingerprint;
  }
  function runNative(job, context, snapshot) {
    job.context = context;
    job.fingerprint = snapshot.fingerprint;
    job.originalSave = context.controller.saveCall;
    job.originalCreate = context.nativeModel.create;
    if (typeof job.originalSave !== 'function' || typeof job.originalCreate !== 'function') {
      finish(job, 'stopped', 'This TSS version does not match the booking helper. Use TSS directly.');
      return;
    }
    job.guardedSave = function (...args) {
      if (!guardSnapshot(job) || job.finalCalled || !['checking', 'review'].includes(job.stage)) {
        failClosed(job, 'The booking context changed or was already submitted.');
        return;
      }
      job.finalCalled = true;
      job.stage = 'submitting';
      status(job, 'submitting', 'Submitting through the real TSS Book button…');
      job.finalScope = true;
      try { return job.originalSave.apply(this, args); }
      catch { failClosed(job, 'TSS stopped before a booking result was received.'); }
      finally {
        job.finalScope = false;
        if (!job.saveIssued && !job.locked) finish(job, 'stopped', 'TSS needs additional choices. Review its dialog or course details.');
      }
    };
    job.guardedCreate = function (path, payload, options = {}) {
      if (path !== '/ActionHdrSet') return job.originalCreate.apply(this, arguments);
      const check = payload?.ActionName === 'CheckRegistration' && job.bookScope && !job.checkIssued;
      const save = payload?.ActionName === 'SaveChanges' && job.finalScope && !job.saveIssued;
      if ((!check && !save) || !guardSnapshot(job) || fingerprint(payload) !== job.fingerprint) {
        failClosed(job, 'An unexpected booking or change was blocked.');
        return { abort() {} };
      }
      if (check) job.checkIssued = true;
      if (save) job.saveIssued = true;
      let consumed = false;
      const wrapped = { ...options };
      wrapped.success = function (...args) {
        if (consumed) return;
        consumed = true;
        if (job.locked && !save) return;
        if (job.done) return;
        if (save) {
          try { options.success?.apply(this, args); }
          finally {
            if (['E', 'A'].includes(String(args[0]?.MessageType || '').toUpperCase())) {
              failClosed(job, 'TSS returned a booking error. Confirm the result in My Courses.', 'error');
            } else finish(job, 'submitted', 'TSS reported the booking submitted. Confirm it in My Courses.');
          }
          return;
        }
        if (!guardSnapshot(job)) { failClosed(job, 'The course or booking details changed during the registration check.'); return; }
        if (!args[0]?.MessageType) {
          try { options.success?.apply(this, args); } catch { failClosed(job, 'TSS stopped before a booking result was received.'); }
          return;
        }
        const messageBox = w.sap?.ui?.require?.('sap/m/MessageBox') || w.sap?.m?.MessageBox;
        if (!messageBox || typeof messageBox.warning !== 'function') {
          failClosed(job, 'TSS requires a warning review that this helper could not attach to.');
          return;
        }
        const originalWarning = messageBox.warning;
        let captured = false;
        messageBox.warning = function (message, warningOptions = {}) {
          if (captured) return originalWarning.apply(this, arguments);
          captured = true;
          let closed = false;
          return originalWarning.call(this, message, { ...warningOptions, onClose(action) {
            if (closed || job.locked || job.done) return;
            closed = true;
            if (!guardSnapshot(job)) { failClosed(job, 'The course or booking details changed while the warning was open.'); return; }
            try { warningOptions.onClose?.call(this, action); }
            catch { failClosed(job, 'TSS stopped before a booking result was received.'); }
            if (action !== 'OK' && !job.locked) finish(job, 'stopped', 'Booking cancelled in the TSS warning.');
          } });
        };
        job.stage = 'review';
        status(job, 'review', 'Review the native TSS warning. BBB will not confirm it for you.');
        try { options.success?.apply(this, args); }
        catch { failClosed(job, 'TSS could not display its warning.'); }
        finally {
          messageBox.warning = originalWarning;
          if (!captured && !job.locked) failClosed(job, 'The expected TSS warning was not available.');
        }
      };
      wrapped.error = function (...args) {
        if (consumed) return;
        consumed = true;
        if (job.locked || job.done) return;
        try { options.error?.apply(this, args); }
        finally {
          if (save) failClosed(job, 'The submission result is uncertain. Check My Courses before trying again.', 'error');
          else finish(job, 'error', 'TSS could not complete its registration check. Review the TSS error.');
        }
      };
      return job.originalCreate.call(this, path, payload, wrapped);
    };
    context.controller.saveCall = job.guardedSave;
    context.nativeModel.create = job.guardedCreate;
    clearTimeout(job.deadline);
    job.deadline = setTimeout(() => failClosed(job, 'No final booking result was received in time.'), actionTimeout);
    job.stage = 'checking';
    status(job, 'checking', 'Pressing the real TSS Book button once and checking registration…');
    job.bookScope = true;
    try {
      if (!guardSnapshot(job)) { failClosed(job, 'The course changed before its Book button was pressed.'); return; }
      context.button.firePress();
    } catch { failClosed(job, 'TSS stopped before its registration check completed.'); }
    finally {
      job.bookScope = false;
      if (!job.checkIssued && !job.locked) finish(job, 'stopped', 'TSS needs additional choices. Review its dialog or course details.');
    }
  }
  function begin(id, route) {
    if (history.has(id)) { send(history.get(id)); return; }
    // Keep every ID for this connection: an old message must never replay Book.
    if (active || locked) {
      status({ id }, 'stopped', locked ? 'Check TSS and reload before reconnecting.' : 'Finish the current TSS booking attempt first.');
      return;
    }
    const target = targetFor(route);
    if (!target) { status({ id }, 'stopped', 'That route is not a supported TSS booking package.'); return; }
    const before = findContext();
    const job = { id, target, stage: 'loading', beforeDetail: before?.model?.getProperty('/detail') };
    active = job;
    status(job, 'loading', 'Opening the exact course package in TSS…');
    job.deadline = setTimeout(() => finish(job, 'error', 'TSS did not finish loading. Review TSS, then start a new attempt.'), loadTimeout);
    const wasSame = sameTarget(targetFor(w.location.href), target);
    try {
      if (wasSame && before?.controller && typeof before.controller._loadDetailData === 'function') {
        before.controller._initialLoad = true;
        before.controller._loadDetailData(before.controller._oArguments, true);
      } else w.location.hash = target.hash;
    } catch { finish(job, 'error', 'TSS could not open the requested package.'); return; }
    const poll = () => {
      if (active !== job || job.done || job.locked || disconnected) return;
      try {
        const context = findContext();
        const result = inspect(context, target);
        if (result.stop) { finish(job, 'stopped', result.stop); return; }
        if (result.ready && result.detail !== job.beforeDetail) { runNative(job, context, result); return; }
      } catch { finish(job, 'stopped', 'This TSS page could not be verified. Use TSS directly.'); return; }
      job.poll = setTimeout(poll, pollDelay);
    };
    poll();
  }
  function receive(event) {
    if (disconnected || event.origin !== appOrigin || event.source !== appWindow) return;
    const data = event.data;
    if (!data || data.channel !== channel || data.nonce !== nonce) return;
    lastPeerAt = Date.now();
    if (data.type === 'ack') { paired = true; say('BBB connected. Use Book on the BBB page; keep this TSS tab open.'); return; }
    if (data.type === 'ping') { send({ type: 'pong' }); return; }
    if (data.type === 'disconnect') { stop(); return; }
    if (data.type === 'book' && paired && typeof data.requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(data.requestId)) begin(data.requestId, data.route);
  }
  function routeChanged() {
    const job = active;
    if (!job || job.done || job.locked || sameTarget(targetFor(w.location.href), job.target)) return;
    if (job.checkIssued && !job.saveIssued) failClosed(job, 'Navigation interrupted the booking check.');
    else if (!job.checkIssued) finish(job, 'stopped', 'Navigation changed before booking. Nothing was submitted by BBB.');
  }
  function stop() {
    if (disconnected) return;
    const job = active;
    if (job && !job.done) {
      if (job.checkIssued || job.saveIssued) failClosed(job, job.saveIssued ? 'Submission already started; stopping cannot undo it.' : 'The helper stopped while a registration check was pending.');
      else finish(job, 'stopped', 'BBB helper stopped before booking.');
    }
    disconnected = true;
    send({ type: 'disconnect', message: 'The TSS helper disconnected. Reconnect from TSS when ready.' });
    clearInterval(helloTimer);
    w.removeEventListener('message', receive);
    w.removeEventListener('hashchange', routeChanged);
    if (!locked) { panel.remove(); if (w[marker] === api) delete w[marker]; }
    else stopButton.disabled = true;
  }
  w.addEventListener('message', receive);
  w.addEventListener('hashchange', routeChanged);
  stopButton.addEventListener('click', stop);
  const helloTimer = setInterval(() => {
    if (disconnected) return;
    if (appWindow.closed || (paired && Date.now() - lastPeerAt > peerTimeout)) { stop(); return; }
    if (!paired) send({ type: 'hello' });
  }, 1000);
  const api = { stop, get state() { return locked ? 'locked' : active?.stage || 'idle'; }, get inFlight() { return Boolean(active); } };
  w[marker] = api;
  say('Connecting to BBB. Keep this TSS tab open.');
  send({ type: 'hello' });
  return api;
}
