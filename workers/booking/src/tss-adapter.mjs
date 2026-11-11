// This function is serialized into the managed TSS page. It never authors an
// enrollment request: only the verified native Book handler can do that.
export function nativeTssOperation({ operation, ...input }) {
  const w = window;
  const marker = '__bbbManagedBookingV1';
  const reasons = {
    'No matching booking attempt exists in this page.': 'attempt_unavailable',
    'Invalid booking command.': 'native_action_failed',
    'Review the previous attempt in TSS before continuing.': 'previous_attempt',
    'Open the exact package and wait for TSS to finish loading.': 'details_loading',
    'The native action includes unexpected booking details.': 'payload_mismatch',
    'This TSS version is unsupported.': 'unsupported_tss',
    'The booking context changed or was already submitted.': 'booking_context_changed',
    'TSS stopped before returning a result.': 'native_action_failed',
    'TSS requires additional choices.': 'additional_choices',
    'An unexpected write action was blocked.': 'payload_mismatch',
    'An unexpected booking action was blocked.': 'payload_mismatch',
    'TSS returned a booking error.': 'booking_error',
    'Booking details changed during the registration check.': 'booking_context_changed',
    'The native warning could not be displayed.': 'warning_unavailable',
    'Booking details changed while the warning was open.': 'booking_context_changed',
    'Booking cancelled in TSS.': 'booking_cancelled',
    'TSS could not display its warning.': 'warning_unavailable',
    'The expected warning was not available.': 'warning_unavailable',
    'The submission result is uncertain.': 'submission_uncertain',
    'TSS could not complete the registration check.': 'request_check_failed',
    'No final result arrived before the deadline.': 'action_timeout',
    'The course changed before booking.': 'booking_context_changed',
    'TSS stopped before completing its check.': 'native_action_failed',
    'Navigation interrupted this booking attempt.': 'booking_context_changed',
    'Navigation changed before booking.': 'booking_context_changed',
    'TSS did not finish loading the package.': 'course_load_timeout',
    'TSS could not refresh this package.': 'course_refresh_failed',
    'The refreshed TSS page could not be verified.': 'native_context_unavailable',
  };
  const answer = (stage, message, reason = reasons[message]) => ({ stage, ...(message ? { message } : {}), ...(reason ? { reason } : {}) });
  const atTss = w.location.origin === 'https://tss.ucsd.edu' && /^\/fiori\/?$/.test(w.location.pathname);
  const authenticated = () => {
    if (!atTss) return false;
    try {
      const user = w.sap?.ushell?.Container?.getUser?.();
      const id = user?.getId?.();
      return typeof id === 'string' && Boolean(id.trim()) && !/^(anonymous|guest)$/i.test(id.trim())
        && Boolean(document.querySelector('[data-sap-ui]'));
    } catch { return false; }
  };
  if (operation === 'authenticated') return authenticated();
  if (operation === 'csrf') {
    if (!authenticated()) return false;
    // A read-only, fixed same-origin probe. Never return a token or response body.
    return w.fetch('https://tss.ucsd.edu/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/', {
      method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { 'X-CSRF-Token': 'Fetch', Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
    }).then(response => {
      const token = response.headers.get('x-csrf-token')?.trim();
      return Boolean(response.ok && token && !/^(required|fetch)$/i.test(token));
    }).catch(() => false);
  }
  if (!atTss || !authenticated()) return { ...answer('stopped', 'Sign in to TSS in this managed session.'), loaded: false, ready: false, reason: 'authentication_required' };
  if (operation === 'status') return w[marker]?.history.get(input.requestId) || answer('stopped', 'No matching booking attempt exists in this page.');
  const digits = value => /^\d+$/.test(String(value)) ? String(value).replace(/^0+(?=\d)/, '') : null;
  const same = (a, b) => digits(a) !== null && digits(a) === digits(b);
  const nonzeroGuid = value => value && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(String(value));
  const targetFor = route => {
    if (typeof route !== 'string' || route.length > 1200) return null;
    try {
      const url = new URL(route);
      if (url.origin !== 'https://tss.ucsd.edu' || !/^\/fiori\/?$/.test(url.pathname) || url.search || url.username || url.password) return null;
      const m = url.hash.match(/^#ZUSModule-display\?TileType=MYMOD&\/Detail\/EventPackage\/SM\/(\d+)\/00000000\/0\/0\/0\/00000000-0000-0000-0000-000000000000\/(\d+)\/(\d{4})\/(\d+)\/\??$/);
      return m && m.slice(1).every(value => digits(value) !== '0') ? { module: m[1], package: m[2], year: m[3], session: m[4] } : null;
    } catch { return null; }
  };
  const equalTarget = (a, b) => a && b && ['module', 'package', 'year', 'session'].every(key => same(a[key], b[key]));
  const shown = control => {
    const element = control?.getDomRef?.();
    if (!element || element.isConnected === false || !element.getClientRects().length || element.closest?.('[aria-hidden="true"]')) return false;
    const style = w.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const findContext = () => {
    const core = w.sap?.ui?.getCore?.();
    if (!core) return null;
    const views = new Map();
    for (const element of document.querySelectorAll('[data-sap-ui]')) {
      let control = core.byId(element.getAttribute('data-sap-ui') || element.id);
      for (let depth = 0; control && depth < 30; depth++, control = control.getParent?.()) {
        const controller = control.getController?.();
        if (controller?.getMetadata?.().getName() === 'itus.mymodules.controller.Detail' && shown(control)) { views.set(controller, control); break; }
      }
    }
    if (views.size !== 1) return null;
    const [controller, view] = [...views][0];
    const buttons = view.findAggregatedObjects?.(true, control => {
      const binding = control.getBindingInfo?.('text');
      return control.isA?.('sap.m.Button') && [binding, ...(binding?.parts || [])].some(part => part?.model === 'i18n' && part?.path === 'SAVE');
    }) || [];
    const visible = buttons.filter(button => button.getVisible?.() && shown(button));
    return { controller, model: controller.getModel('detailView'), nativeModel: controller.getModel('oData'), button: visible.length === 1 ? visible[0] : null };
  };
  const target = targetFor(input.route);
  const inspect = (context, allowBusy = false) => {
    if (!target || !equalTarget(targetFor(w.location.href), target)) return { ready: false, reason: 'route_mismatch' };
    if (!context) return { ready: false, reason: 'native_context_unavailable' };
    const c = context.controller, m = context.model, d = m?.getProperty('/detail'), args = c._oArguments;
    if (!d || !args || c._initialLoad !== false) return { ready: false, reason: 'details_loading' };
    if (args.Source !== 'EventPackage' || args.Otype !== 'SM' || args.NavFromMode
      || !same(args.Objid, target.module) || !same(args.EventPackageId, target.package) || !same(args.AcademicYear, target.year) || !same(args.AcademicSession, target.session)
      || d.SmOtype !== 'SM' || !same(d.SmObjid, target.module) || !same(d.EventPackageId, target.package) || !same(d.AcademicYear, target.year) || !same(d.AcademicSession, target.session)) return { ready: false, reason: 'context_mismatch' };
    const data = m.getData(), types = d.EventTypes, exams = d.ExamTypes || [];
    if (Object.entries(data).some(([key, value]) => /^busy/i.test(key) && value === true && !(allowBusy && key === 'busy'))) return { ready: false, reason: 'details_loading' };
    const unavailable = (reason, stop) => ({ loaded: true, ready: false, reason, ...(stop ? { stop } : {}) });
    if (!Array.isArray(types) || !types.length || !Array.isArray(exams)) return unavailable('event_data_unavailable');
    // A canceled registration may retain its historical detail ID. Native Book
    // uses current event/package flags and always prepares a zero ModregId; the
    // guarded payload below must still prove that zero before any write.
    if (data.WithdrawButtonEnabled || types.some(type => type.booked || type.oBooked || type.Events?.some(event => event.Booked))
      || exams.some(exam => exam.booked || exam.oBooked || exam.Selected?.Booked)) return unavailable('existing_registration', 'An existing registration requires review in TSS.');
    if (c.getOwnerComponent().getModel('tempEventModel')?.getProperty('/changedEvent') !== undefined || types.some(type => type.Changed)) return unavailable('pending_changes', 'Pending section changes require review in TSS.');
    if (!data.EventPackageExist || !data.BookingButtonEnabled || !context.button?.getEnabled?.() || !context.button.getVisible() || !shown(context.button)) return unavailable('booking_unavailable');
    if (!d.oCG?.Bookable || !digits(d.oCG.CgObjid) || digits(d.oCG.CgObjid) === '0') return unavailable('course_group_unavailable', 'TSS requires a course-group choice or eligibility review.');
    if (d.Eligibility?.some(item => item.RulecheckResult === 'N')) return unavailable('eligibility_unavailable', 'TSS requires a course-group choice or eligibility review.');
    if (exams.some(exam => exam.Selected || exam.DoRepetition || exam.Changed)) return unavailable('assessment_review', 'Additional assessment actions require review in TSS.');
    const events = [];
    for (const type of types) {
      if (!type.EventPackageExist || !Array.isArray(type.Events) || type.Events.length !== 1 || type.DoRepetition) return unavailable('ambiguous_package', 'The package has ambiguous selections.');
      const event = type.Events[0];
      if (!digits(event.EventId) || digits(event.EventId) === '0' || !same(event.SmObjid, target.module) || !same(event.AcademicYear, target.year)
        || !same(event.AcademicSession, target.session) || (event.EventPackageId != null && !same(event.EventPackageId, target.package))) return unavailable('section_mismatch', 'The selected sections do not match the requested package.');
      events.push(digits(event.EventId));
    }
    if (new Set(events).size !== events.length) return unavailable('duplicate_sections', 'The package has duplicate sections.');
    return { loaded: true, ready: true, detail: d, events };
  };
  let context, snapshot;
  try { context = findContext(); snapshot = inspect(context); } catch { return { ...answer('stopped', 'This TSS page could not be verified.'), loaded: false, ready: false, reason: 'native_context_unavailable' }; }
  if (operation === 'inspect') return { loaded: Boolean(snapshot.loaded), ready: Boolean(snapshot.ready),
    ...(snapshot.reason ? { reason: snapshot.reason } : {}),
    ...answer(snapshot.loaded && !snapshot.ready ? 'stopped' : 'loading', snapshot.loaded && !snapshot.ready ? 'Booking requires review in TSS.' : undefined) };
  if (operation !== 'book' || typeof input.requestId !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(input.requestId)) return answer('stopped', 'Invalid booking command.');
  const state = w[marker] ||= { history: new Map(), active: null, locked: false };
  if (state.history.has(input.requestId)) return state.history.get(input.requestId);
  if (state.active || state.locked) return answer('stopped', 'Review the previous attempt in TSS before continuing.');
  if (!snapshot.ready) return answer('stopped', snapshot.stop || 'Open the exact package and wait for TSS to finish loading.', snapshot.reason);
  if (typeof context.controller._loadDetailData !== 'function') return answer('stopped', 'This TSS version is unsupported.');
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const fingerprint = payload => JSON.stringify(canonical({ ...payload, ActionName: 'SaveChanges' }));
  const payloadFor = (ctx, snap) => {
    const p = ctx.controller._prepareSaveData(false);
    if (p.ActionName !== 'SaveChanges' || !same(p.ModuleId, target.module) || !same(p.EventPackId, target.package) || !same(p.AcademicYear, target.year)
      || !same(p.AcademicSession, target.session) || nonzeroGuid(p.ModregId) || !Array.isArray(p.Items) || !p.Items.length) throw Error('payload mismatch');
    const actual = p.Items.map(item => {
      if (item.Cancel || item.AssessmentId || item.Resit || !digits(item.EventId) || !same(item.ModuleId, target.module) || !same(item.EventPackId, target.package)
        || !same(item.AcademicYear, target.year) || !same(item.AcademicSession, target.session)) throw Error('unexpected action');
      return digits(item.EventId);
    });
    if (new Set(actual).size !== actual.length || JSON.stringify(actual.sort()) !== JSON.stringify([...snap.events].sort())) throw Error('section mismatch');
    return p;
  };
  const job = { id: input.requestId, beforeDetail: snapshot.detail, context, done: false, locked: false };
  state.active = job;
  const update = (stage, message, reason) => { job.stage = stage; const result = answer(stage, message, reason); state.history.set(job.id, result); return result; };
  const clear = () => { clearTimeout(job.poll); clearTimeout(job.deadline); w.removeEventListener('hashchange', routeChanged); };
  const finish = (stage, message, reason) => {
    if (job.done || job.locked) return;
    job.done = true; clear();
    if (job.context.controller.saveCall === job.guardedSave) job.context.controller.saveCall = job.originalSave;
    if (job.context.nativeModel.create === job.guardedCreate) job.context.nativeModel.create = job.originalCreate;
    state.active = null; update(stage, message, reason);
  };
  const lock = (message, stage = 'stopped') => {
    if (job.done || job.locked) return;
    job.locked = state.locked = true; clear();
    // Keep gates installed so delayed native callbacks cannot resume submission.
    update(stage, message + ' Check TSS and reload this managed session before trying again.', reasons[message]);
  };
  const valid = () => {
    if (job.done || job.locked || state.active !== job || !authenticated()) return false;
    try {
      const current = findContext();
      if (current?.controller !== job.context.controller || current.model !== job.context.model || current.nativeModel !== job.context.nativeModel
        || current.model.getProperty('/detail') !== job.detailSnapshot) return false;
      const snap = inspect(current, true);
      return snap.ready && fingerprint(payloadFor(current, snap)) === job.fingerprint;
    } catch { return false; }
  };
  const run = (ctx, snap) => {
    job.context = ctx;
    job.detailSnapshot = snap.detail;
    try { job.fingerprint = fingerprint(payloadFor(ctx, snap)); } catch { finish('stopped', 'The native action includes unexpected booking details.'); return; }
    job.originalSave = ctx.controller.saveCall; job.originalCreate = ctx.nativeModel?.create;
    if (typeof job.originalSave !== 'function' || typeof job.originalCreate !== 'function') { finish('stopped', 'This TSS version is unsupported.'); return; }
    job.guardedSave = function (...args) {
      if (!valid() || job.finalCalled || !['checking', 'review'].includes(job.stage)) { lock('The booking context changed or was already submitted.'); return; }
      job.finalCalled = true; update('submitting', 'Submitting through TSS.'); job.finalScope = true;
      try { return job.originalSave.apply(this, args); }
      catch { lock('TSS stopped before returning a result.'); }
      finally { job.finalScope = false; if (!job.saveIssued && !job.locked) finish('stopped', 'TSS requires additional choices.'); }
    };
    job.guardedCreate = function (path, payload, options = {}) {
      if (path !== '/ActionHdrSet') { lock('An unexpected write action was blocked.'); return { abort() {} }; }
      const check = payload?.ActionName === 'CheckRegistration' && job.bookScope && !job.checkIssued;
      const save = payload?.ActionName === 'SaveChanges' && job.finalScope && !job.saveIssued;
      if ((!check && !save) || !valid() || fingerprint(payload) !== job.fingerprint) { lock('An unexpected booking action was blocked.'); return { abort() {} }; }
      if (check) job.checkIssued = true;
      if (save) job.saveIssued = true;
      let consumed = false;
      const wrapped = { ...options, success(...args) {
        if (consumed || job.done || job.locked) return;
        consumed = true;
        if (save) {
          try { options.success?.apply(this, args); }
          finally { if (['E', 'A'].includes(String(args[0]?.MessageType || '').toUpperCase())) lock('TSS returned a booking error.', 'error'); else finish('submitted', 'TSS reported submission. Confirm enrollment in My Courses.'); }
          return;
        }
        if (!valid()) { lock('Booking details changed during the registration check.'); return; }
        if (!args[0]?.MessageType) { try { options.success?.apply(this, args); } catch { lock('TSS stopped before returning a result.'); } return; }
        const box = w.sap?.ui?.require?.('sap/m/MessageBox') || w.sap?.m?.MessageBox;
        if (typeof box?.warning !== 'function') { lock('The native warning could not be displayed.'); return; }
        const originalWarning = box.warning;
        let captured = false;
        box.warning = function (message, warningOptions = {}) {
          if (captured) return originalWarning.apply(this, arguments);
          captured = true; let closed = false;
          return originalWarning.call(this, message, { ...warningOptions, onClose(action) {
            if (closed || job.done || job.locked) return;
            closed = true;
            if (!valid()) { lock('Booking details changed while the warning was open.'); return; }
            try { warningOptions.onClose?.call(this, action); } catch { lock('TSS stopped before returning a result.'); }
            if (action !== 'OK' && !job.locked) finish('stopped', 'Booking cancelled in TSS.');
          } });
        };
        update('review', 'Review the official TSS warning in the managed browser.');
        try { options.success?.apply(this, args); } catch { lock('TSS could not display its warning.'); }
        finally { box.warning = originalWarning; if (!captured && !job.locked) lock('The expected warning was not available.'); }
      }, error(...args) {
        if (consumed || job.done || job.locked) return;
        consumed = true;
        try { options.error?.apply(this, args); }
        finally { if (save) lock('The submission result is uncertain.', 'error'); else finish('error', 'TSS could not complete the registration check.'); }
      } };
      return job.originalCreate.call(this, path, payload, wrapped);
    };
    ctx.controller.saveCall = job.guardedSave; ctx.nativeModel.create = job.guardedCreate;
    clearTimeout(job.deadline);
    job.deadline = setTimeout(() => lock('No final result arrived before the deadline.'), input.actionTimeoutMs || 120000);
    update('checking', 'Checking registration through TSS.'); job.bookScope = true;
    try { if (!valid()) { lock('The course changed before booking.'); return; } ctx.button.firePress(); }
    catch { lock('TSS stopped before completing its check.'); }
    finally { job.bookScope = false; if (!job.checkIssued && !job.locked) finish('stopped', 'TSS requires additional choices.'); }
  };
  const routeChanged = () => {
    if (job.done || job.locked || equalTarget(targetFor(w.location.href), target)) return;
    if (job.checkIssued) lock('Navigation interrupted this booking attempt.');
    else finish('stopped', 'Navigation changed before booking.');
  };
  w.addEventListener('hashchange', routeChanged);
  update('loading', 'Refreshing the exact package in TSS.');
  job.deadline = setTimeout(() => finish('error', 'TSS did not finish loading the package.'), input.loadTimeoutMs || 45000);
  try { context.controller._initialLoad = true; context.controller._loadDetailData(context.controller._oArguments, true); }
  catch { finish('error', 'TSS could not refresh this package.'); return state.history.get(job.id); }
  const poll = () => {
    if (job.done || job.locked) return;
    try {
      if (!equalTarget(targetFor(w.location.href), target)) { finish('stopped', 'Navigation changed before booking.'); return; }
      const ctx = findContext(), snap = inspect(ctx);
      if (snap.stop) { finish('stopped', snap.stop, snap.reason); return; }
      if (snap.ready && snap.detail !== job.beforeDetail) { run(ctx, snap); return; }
    } catch { finish('stopped', 'The refreshed TSS page could not be verified.'); return; }
    job.poll = setTimeout(poll, input.pollMs || 200);
  };
  poll();
  return state.history.get(job.id);
}

export const detectAuthenticated = page => page.evaluate(nativeTssOperation, { operation: 'authenticated' });
export const detectSessionCsrf = page => page.evaluate(nativeTssOperation, { operation: 'csrf' });
export const inspectTss = (page, input) => page.evaluate(nativeTssOperation, { ...input, operation: 'inspect' });
export const beginBook = (page, input) => page.evaluate(nativeTssOperation, { ...input, operation: 'book' });
export const getBookingStatus = (page, input) => page.evaluate(nativeTssOperation, { ...input, operation: 'status' });
