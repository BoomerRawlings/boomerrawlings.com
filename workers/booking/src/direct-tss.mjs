export const DIRECT_READ_STAGES = Object.freeze(['service', 'settings', 'header', 'header_logs', 'events', 'event_logs', 'groups', 'package', 'exams', 'templates']);
export const DIRECT_SCHEMA_ISSUES = Object.freeze(['request_timeout', 'network_error', 'authentication_http', 'http_error', 'not_json', 'response_large', 'invalid_json', 'invalid_d', 'error_envelope', 'not_collection', 'paginated', 'nonobject_row', 'missing_csrf', 'unsupported_autobook', 'unsupported_top_module', 'hidden_events']);
export const DIRECT_SETTING_FLAGS = Object.freeze(['ENABLE_AUTOBOOK', 'ENABLE_TOP_MODULE_BOOKING', 'HIDE_TAB_EVENT', 'HIDE_TAB_EXAM', 'SHOW_TEMPLATE', 'SHOW_CREDITS']);
export const DIRECT_SETTING_SHAPES = Object.freeze(['missing', 'null', 'empty', 'X', 'other_string', 'boolean', 'number', 'other']);
export const DIRECT_PREPARATION_NOTES = Object.freeze(['native_group_not_bookable', 'native_first_group', 'native_first_event',
  'native_booking_unavailable', 'native_eligibility_unavailable', 'native_existing_registration', 'native_assessment_review']);

// Serialized into the already-authenticated, owned TSS browser. The archived
// MyModules controller is the source of the reads, defaults and payload below.
// Booking never navigates or invokes UI5; compareNative alone reads the loaded
// official controller's preparation result for the read-only equivalence gate.
// allowWrites and standardNativeVerified come from server-owned gates, never
// client JSON. Verification changes only the mismatched data-property top flag.
export function directTssOperation(input) {
  const origin = 'https://tss.ucsd.edu';
  const service = origin + '/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/';
  const zeroGuid = '00000000-0000-0000-0000-000000000000';
  const marker = '__bbbDirectTssV1';
  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  const result = (stage, reason, extra = {}) => ({ stage, ...(reason ? { reason } : {}), ...extra });
  if (window.location.origin !== origin) return input.operation === 'authenticated' ? false : result('stopped', 'authentication_required');
  const state = window[marker] ||= { active: null, history: new Map(), locked: false };
  state.readHistory ||= new Map();
  const digits = value => /^\d+$/.test(String(value)) ? String(value).replace(/^0+(?=\d)/, '') : null;
  const positive = value => digits(value) !== null && digits(value) !== '0';
  const same = (a, b) => digits(a) !== null && digits(a) === digits(b);
  const codes = [
    ['13043', '166528', 'PHIL-010'], ['5379', '164082', 'PSYC-106'], ['5417', '164087', 'PSYC-110'],
    ['5441', '164089', 'PSYC-111A'], ['5647', '164113', 'PSYC-125'],
    ['14499', '167237', 'ECON-100A'], ['14499', '167238', 'ECON-100A'],
    ['14499', '167239', 'ECON-100A'], ['14499', '167240', 'ECON-100A'],
    ['14794', '167365', 'ECON-120A'], ['14794', '167366', 'ECON-120A'],
    ['14794', '167367', 'ECON-120A'], ['14794', '167368', 'ECON-120A'],
    ['14794', '167369', 'ECON-120A'], ['14794', '167370', 'ECON-120A'],
    ['14794', '167371', 'ECON-120A'], ['14794', '167372', 'ECON-120A'],
    ['6359', '164325', 'MGT-162'], ['6359', '164326', 'MGT-162'], ['6359', '164327', 'MGT-162'],
  ];
  const targetFor = route => {
    if (typeof route !== 'string' || route.length > 1200) return null;
    const match = /^https:\/\/tss\.ucsd\.edu\/fiori#ZUSModule-display\?TileType=MYMOD&\/Detail\/EventPackage\/SM\/(\d+)\/00000000\/0\/0\/0\/00000000-0000-0000-0000-000000000000\/(\d+)\/2026\/3\/\?$/.exec(route);
    const entry = match && codes.find(([moduleId, packageId, code]) => moduleId === match[1] && packageId === match[2] && code === input.courseCode);
    return entry ? { moduleId: entry[0], packageId: entry[1], code: entry[2], year: '2026', session: '3' } : null;
  };
  const codeKey = value => String(value || '').toUpperCase().replace(/[ -]/g, '').replace(/^([A-Z]+)0+(?=\d)/, '$1');
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const fingerprint = value => JSON.stringify(canonical(value));
  const fail = reason => { throw Object.assign(new Error(reason), { reason }); };
  const plain = value => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 4000) : '';
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const note = (job, readStage, schemaIssue) => {
    if (!job?.readOnly || !readStage) return;
    const issues = job.schemaIssues ||= [];
    if (issues.length < 24 && !issues.some(issue => issue.readStage === readStage && issue.schemaIssue === schemaIssue)) issues.push({ readStage, schemaIssue });
  };
  const schemaFail = (job, readStage, schemaIssue, reason = 'unsupported_tss') => { note(job, readStage, schemaIssue); fail(reason); };
  const diagnostics = job => {
    const issues = job.schemaIssues || [];
    return { ...(issues.length ? { ...issues[0], schemaIssues: issues.map(issue => ({ ...issue })) } : {}),
      ...(job.settingShapes ? { settingShapes: { ...job.settingShapes } } : {}),
      ...(job.preparationNotes?.length ? { preparationNotes: [...job.preparationNotes] } : {}) };
  };
  const preparationNote = (job, value) => {
    if (job?.readOnly && !(job.preparationNotes ||= []).includes(value)) job.preparationNotes.push(value);
  };
  const comparisonRestriction = (job, reason, note) => {
    if (job?.comparisonOnly !== true) fail(reason);
    job.bookingRestricted = true;
    preparationNote(job, note);
  };
  // Check every available collection before stopping, so one read-only probe
  // explains parallel response-shape failures without exposing response data.
  const collection = (value, readStage, job) => {
    let valid = true;
    if (!object(value) || !Array.isArray(value.results)) { note(job, readStage, 'not_collection'); valid = false; }
    if (value?.__next) { note(job, readStage, 'paginated'); valid = false; }
    if (Array.isArray(value?.results) && value.results.some(item => !object(item))) { note(job, readStage, 'nonobject_row'); valid = false; }
    return valid ? value.results : null;
  };
  const key = (target, program = '00000000') => `ModuleHeaderSet(SmObjid='${target.moduleId}',SmOtype='SM',ScObjid='${program}',ModregId=guid'${zeroGuid}',EventPackageId='${target.packageId}',AcademicYear='${target.year}',AcademicSession='${target.session}')`;
  const address = (path, expand) => service + path + (expand ? '?$expand=' + encodeURIComponent(expand) : '');
  const current = job => !job || ((job.readOnly ? state.readActive : state.active) === job && !job.done);
  async function request(url, { payload, csrf, job, fetchCsrf = false, readStage } = {}) {
    if (!current(job)) fail('previous_attempt');
    const controller = new AbortController();
    job?.controllers.add(controller);
    let timedOut = false;
    if (readStage) job?.pendingStages?.set(controller, readStage);
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, payload ? 60000 : 12000);
    try {
      const response = await window.fetch(url, {
        method: payload ? 'POST' : 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}),
          ...(fetchCsrf ? { 'X-CSRF-Token': 'Fetch' } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}), signal: controller.signal,
      });
      if (!current(job)) fail('previous_attempt');
      if (!response.ok) schemaFail(job, readStage, [401, 403].includes(response.status) ? 'authentication_http' : 'http_error', [401, 403].includes(response.status) ? 'authentication_required' : 'native_action_failed');
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) schemaFail(job, readStage, 'not_json', 'authentication_required');
      const raw = await response.text();
      if (raw.length > 2_000_000) schemaFail(job, readStage, 'response_large');
      let decoded;
      try { decoded = JSON.parse(raw); } catch { schemaFail(job, readStage, 'invalid_json'); }
      if (decoded?.error) schemaFail(job, readStage, 'error_envelope');
      if (!object(decoded?.d)) schemaFail(job, readStage, 'invalid_d');
      return { data: decoded.d, csrf: response.headers.get('x-csrf-token')?.trim() };
    } catch (error) {
      if (error.reason) throw error;
      schemaFail(job, readStage, timedOut ? 'request_timeout' : 'network_error', 'request_check_failed');
    } finally { clearTimeout(timeout); job?.controllers.delete(controller); job?.pendingStages?.delete(controller); }
  }
  const read = async (path, expand, job, readStage) => (await request(address(path, expand), { job, readStage })).data;
  const validToken = token => typeof token === 'string' && token.length > 0 && token.length < 4096 && !/^(required|fetch)$/i.test(token);
  if (input.operation === 'authenticated') return request(service, { fetchCsrf: true, readStage: 'service' })
    .then(value => validToken(value.csrf)).catch(() => false);
  const eligible = (logs, job) => {
    if (logs.some(item => item.RulecheckResult === 'N')) comparisonRestriction(job, 'eligibility_unavailable', 'native_eligibility_unavailable');
  };
  const fulfilled = entry => entry.status === 'fulfilled' ? entry.value : undefined;
  const rejectReadErrors = entries => {
    const rejected = entries.filter(entry => entry.status === 'rejected');
    const error = rejected.find(entry => entry.reason?.reason === 'authentication_required') || rejected[0];
    if (error) throw error.reason;
  };
  async function prepare(target, job) {
    // Native Component._loadSettings: the settings service is separate from
    // PR_MY_MODULES. No student identifier is guessed or supplied in these reads.
    const firstReads = await Promise.allSettled([
      request(service, { fetchCsrf: true, job, readStage: 'service' }),
      request(origin + '/sap/opu/odata/ited/bc_app_settings_srv/ParameterSet?$filter=' + encodeURIComponent("AppName eq 'ITUS.MYMODULES'"), { job, readStage: 'settings' }),
      read(key(target), 'BookingCheckLog,CreditOptions', job, 'header'),
    ]);
    const [tokenResponse, settingsResponse, header] = firstReads.map(fulfilled);
    const settingFlags = ['ENABLE_AUTOBOOK', 'ENABLE_TOP_MODULE_BOOKING', 'HIDE_TAB_EVENT', 'HIDE_TAB_EXAM', 'SHOW_TEMPLATE', 'SHOW_CREDITS'];
    const settingsRows = settingsResponse && collection(settingsResponse.data, 'settings', job);
    const headerLogs = header && collection(header.BookingCheckLog, 'header_logs', job);
    const settings = {};
    // Native _loadSettings assigns in response order. Only these names affect
    // this operation: unrelated values are irrelevant, and last assignment wins.
    for (const row of Array.isArray(settingsResponse?.data?.results) ? settingsResponse.data.results : []) {
      if (object(row) && settingFlags.includes(row.Name)) settings[row.Name] = row.Value;
    }
    if (job?.readOnly) {
      const shape = value => value === undefined ? 'missing' : value === null ? 'null' : value === '' ? 'empty' : value === 'X' ? 'X'
        : typeof value === 'string' ? 'other_string' : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'other';
      job.settingShapes = Object.fromEntries(settingFlags.map(name => [name, shape(settings[name])]));
    }
    if (tokenResponse && !validToken(tokenResponse.csrf)) note(job, 'service', 'missing_csrf');
    const unsupported = [
      [!!settings.ENABLE_AUTOBOOK, 'unsupported_autobook'],
      // Read-only inspection may derive and compare the package payload even
      // when the data flag is set. Writes require a separately verified standard
      // native path for this exact route before bypassing the data-property flag.
      [settings.ENABLE_TOP_MODULE_BOOKING === 'X' && job?.readOnly !== true && job?.standardNativeVerified !== true, 'unsupported_top_module'],
      [settings.HIDE_TAB_EVENT === 'X', 'hidden_events'],
    ];
    for (const [enabled, issue] of unsupported) if (enabled) note(job, 'settings', issue);
    rejectReadErrors(firstReads);
    if (!validToken(tokenResponse.csrf)) fail('authentication_required');
    if (!settingsRows || !headerLogs || unsupported.some(([enabled]) => enabled)) fail('unsupported_tss');
    if (header.SmOtype !== 'SM' || !same(header.SmObjid, target.moduleId) || !same(header.AcademicYear, target.year)
      || !same(header.AcademicSession, target.session) || codeKey(header.SmShort) !== codeKey(target.code)) fail('context_mismatch');
    if (header.SmStatus === '02' || header.Lockflag === true) comparisonRestriction(job, 'booking_unavailable', 'native_booking_unavailable');
    eligible(headerLogs, job);
    const secondReads = await Promise.allSettled([
      read(key(target) + '/Event', 'BookingCheckLog,Request,EventSchedule,CreditOptions', job, 'events'),
      read(key(target) + '/ModuleGroup', undefined, job, 'groups'),
      read(`EventPackageSet(EventPackageId='${target.packageId}',SmObjid='${target.moduleId}',AcademicYear='${header.AcademicYear}',AcademicSession='${header.AcademicSession}')`, undefined, job, 'package'),
      settings.HIDE_TAB_EXAM === 'X' ? Promise.resolve({ results: [] }) : read(key(target) + '/Exam', 'BookingCheckLog,Request', job, 'exams'),
    ]);
    const [eventsData, groupsData, packageData, examsData] = secondReads.map(fulfilled);
    const events = eventsData && collection(eventsData, 'events', job);
    const groups = groupsData && collection(groupsData, 'groups', job);
    const exams = examsData && collection(examsData, 'exams', job);
    const eventLogs = new Map();
    for (const event of Array.isArray(eventsData?.results) ? eventsData.results : []) {
      if (object(event)) eventLogs.set(event, collection(event.BookingCheckLog, 'event_logs', job));
    }
    rejectReadErrors(secondReads);
    if (!events || !groups || !exams || [...eventLogs.values()].some(logs => !logs)) fail('unsupported_tss');
    for (const [field, expected] of [['EventPackageId', target.packageId], ['SmObjid', target.moduleId], ['AcademicYear', target.year], ['AcademicSession', target.session]]) {
      if (positive(packageData[field]) && !same(packageData[field], expected)) fail('context_mismatch');
    }
    if (packageData.BookingButtonEnabled !== true) {
      if (packageData.BookingButtonEnabled !== false) fail('booking_unavailable');
      comparisonRestriction(job, 'booking_unavailable', 'native_booking_unavailable');
    }
    if (packageData.WithdrawButtonEnabled !== false) {
      if (packageData.WithdrawButtonEnabled !== true) fail('existing_registration');
      comparisonRestriction(job, 'existing_registration', 'native_existing_registration');
    }
    if (exams.some(row => row.Booked === true)) comparisonRestriction(job, 'assessment_review', 'native_assessment_review');
    // Native getSelectedModuleGroup compares AssignedCg strictly, then uses the
    // first selected/default row. Numeric normalization can choose another row.
    let candidates = header.AssignedCg ? groups.filter(group => group.CgObjid === header.AssignedCg) : [];
    if (!candidates.length) candidates = groups.filter(group => job?.readOnly ? !!group.Selected : group.Selected === true);
    if (!candidates.length) candidates = groups.filter(group => job?.readOnly ? !!group.IsDefault : group.IsDefault === true);
    if (!candidates.length && groups.length === 1) candidates = groups;
    if (!candidates.length || (candidates.length !== 1 && !job?.readOnly)) fail('course_group_unavailable');
    if (candidates.length > 1) preparationNote(job, 'native_first_group');
    const group = candidates[0];
    // The native visibility formatter permits the top-module data flag/status00
    // branch independently of group.Bookable. Derive it only for comparison;
    // writes still require the strict Bookable flag and unambiguous selection.
    const nativeGroupVisible = !!group.Bookable || (settings.ENABLE_TOP_MODULE_BOOKING === 'X' && header.SmStatus === '00');
    if (!positive(group.CgObjid) || digits(group.ScObjid) === null || digits(group.CgTopObjid) === null) fail('course_group_unavailable');
    if (group.Bookable !== true && !(job?.readOnly && nativeGroupVisible)) {
      comparisonRestriction(job, 'course_group_unavailable', 'native_group_not_bookable');
    }
    if (group.Bookable !== true) preparationNote(job, 'native_group_not_bookable');
    let template = header.TemplateId;
    const hasTemplate = value => typeof value === 'string' && value.trim().length > 0 && value !== '0000';
    if (settings.SHOW_TEMPLATE === 'X') {
      const templateProgram = group.ScObjid && group.ScObjid !== '00000000' ? group.ScObjid : '00000000';
      const templates = collection(await read(key(target, templateProgram) + '/Template', undefined, job, 'templates'), 'templates', job);
      if (!templates) fail('unsupported_tss');
      if (!hasTemplate(template) && header.IsTemplateUpdateable === true) {
        const choices = templates.length === 1 ? templates : templates.filter(row => row.IsDefault === true);
        if (choices.length === 1) template = choices[0].TemplateId;
      }
      if (!hasTemplate(template)) fail('additional_choices');
    }
    if (!events.length) fail('event_data_unavailable');
    const types = new Map(), ids = new Set();
    for (const event of events) {
      if (!positive(event.DObjid) || !positive(event.EventId) || !same(event.SmObjid, target.moduleId)
        || !same(event.AcademicYear, target.year) || !same(event.AcademicSession, target.session)) fail('section_mismatch');
      if (positive(event.EventPackageId) && !same(event.EventPackageId, target.packageId)) fail('section_mismatch');
      if (event.Booked !== false) {
        if (event.Booked !== true) fail('existing_registration');
        comparisonRestriction(job, 'existing_registration', 'native_existing_registration');
      }
      // Native package Book visibility uses header Eligibility only. Event log
      // messages are informational here; CheckRegistration evaluates this exact
      // package before SaveChanges and any warning still requires confirmation.
      // Native EventTypes preserves the raw DObjid grouping and response order;
      // a fresh package sends Events[0] only. Multiple choices remain a write
      // blocker, but do not prevent read-only comparison with that exact branch.
      const typeKey = job?.readOnly ? String(event.DObjid) : digits(event.DObjid);
      const existingType = types.has(typeKey);
      if (existingType && !job?.readOnly) fail('ambiguous_package');
      if (existingType) preparationNote(job, 'native_first_event');
      else {
        if (ids.has(digits(event.EventId))) fail('duplicate_sections');
        types.set(typeKey, event); ids.add(digits(event.EventId));
      }
    }
    // Exact fresh-package branch of _prepareSaveData(false). Historical
    // header.ModregId is intentionally ignored: native always sends zero here.
    const payload = {
      ModuleId: header.SmObjid, ActionName: 'SaveChanges', ProgramId: group.ScObjid,
      Items: [...types.values()].map(event => ({ EventId: event.EventId, ModuleId: event.SmObjid,
        AcademicYear: event.AcademicYear, AcademicSession: event.AcademicSession, EventPackId: target.packageId })),
      AssignedCg: group.CgObjid, AssignedCgTop: group.CgTopObjid, TemplateId: template,
      EventPackId: target.packageId, ModregId: zeroGuid, AcademicYear: header.AcademicYear, AcademicSession: header.AcademicSession,
    };
    if (settings.SHOW_CREDITS === 'X') {
      if (!['string', 'number'].includes(typeof header.Credits) || !Number.isFinite(Number(header.Credits))
        || Number(header.Credits) < 0 || typeof header.CreditUnit !== 'string') fail('additional_choices');
      payload.Credits = header.Credits; payload.CreditUnit = header.CreditUnit;
    }
    return { payload, csrf: tokenResponse.csrf };
  }
  // Diagnostic only: compare the live GET-derived payload with the already
  // loaded official app. Book/inspect/authentication never enter this branch.
  function compareNative(target, prepared) {
    let nativeBookingPath = 'unknown', dataTopModuleEnabled;
    const branch = () => ({ nativeBookingPath, ...(typeof dataTopModuleEnabled === 'boolean' ? { dataTopModuleEnabled } : {}) });
    try {
      const core = window.sap?.ui?.getCore?.();
      if (!core) fail('native_context_unavailable');
      const controllers = new Set();
      for (const element of document.querySelectorAll('[data-sap-ui]')) {
        let control = core.byId(element.getAttribute('data-sap-ui') || element.id);
        for (let depth = 0; control && depth < 30; depth++, control = control.getParent?.()) {
          const candidate = control.getController?.(), dom = control.getDomRef?.();
          if (candidate?.getMetadata?.().getName() !== 'itus.mymodules.controller.Detail' || !dom
            || dom.isConnected === false || !dom.getClientRects().length || dom.closest?.('[aria-hidden="true"]')) continue;
          const style = window.getComputedStyle(dom);
          if (style.display !== 'none' && style.visibility !== 'hidden') controllers.add(candidate);
        }
      }
      if (controllers.size !== 1) fail('native_context_unavailable');
      const controller = [...controllers][0], args = controller._oArguments;
      const appModel = controller.getModel?.();
      if (!appModel || typeof appModel.getProperty !== 'function') fail('native_context_unavailable');
      // Exact archived onSave/saveCall predicate: these handlers read a direct
      // model-instance property, unlike the formatter's /Settings data path.
      // Observe both; never call either handler or infer one from the other.
      nativeBookingPath = appModel.Settings && appModel.Settings.ENABLE_TOP_MODULE_BOOKING
        && appModel.Settings.ENABLE_TOP_MODULE_BOOKING === 'X' ? 'top_module' : 'standard';
      dataTopModuleEnabled = appModel.getProperty('/Settings/ENABLE_TOP_MODULE_BOOKING') === 'X';
      if (nativeBookingPath !== 'standard') fail('unsupported_tss');
      const model = controller.getModel?.('detailView'), data = model?.getData?.(), detail = data?.detail;
      if (!detail || controller._initialLoad !== false || !args || Object.entries(data).some(([name, value]) => /^busy/i.test(name) && value === true)) fail('details_loading');
      if (args.Source !== 'EventPackage' || args.Otype !== 'SM' || args.NavFromMode || !same(args.Objid, target.moduleId)
        || !same(args.EventPackageId, target.packageId) || !same(args.AcademicYear, target.year) || !same(args.AcademicSession, target.session)
        || detail.SmOtype !== 'SM' || !same(detail.SmObjid, target.moduleId) || !same(detail.EventPackageId, target.packageId)
        || !same(detail.AcademicYear, target.year) || !same(detail.AcademicSession, target.session)) fail('context_mismatch');
      if (controller.getOwnerComponent?.().getModel('tempEventModel')?.getProperty('/changedEvent') !== undefined
        || detail.EventTypes?.some(type => type.Changed || (type.Selected && !type.booked))
        || detail.ExamTypes?.some(type => type.Changed || type.DoRepetition || (type.Selected && !type.booked))
        || (detail.oOrigCG && fingerprint(detail.oCG) !== fingerprint(detail.oOrigCG))
        || (detail.CreditOld != null && detail.Credits !== detail.CreditOld)
        || (detail.TemplateIdOld && detail.TemplateIdOld !== '0000' && detail.TemplateId !== detail.TemplateIdOld)) fail('pending_changes');
      if (typeof controller._prepareSaveData !== 'function') fail('unsupported_tss');
      const native = controller._prepareSaveData(false);
      if (!object(native)) fail('unsupported_tss');
      const fields = ['ModuleId', 'ActionName', 'ProgramId', 'Items', 'AssignedCg', 'AssignedCgTop', 'TemplateId', 'EventPackId', 'ModregId', 'AcademicYear', 'AcademicSession', 'Credits', 'CreditUnit'];
      const mismatchFields = fields.filter(field => fingerprint(native[field]) !== fingerprint(prepared.payload[field]));
      if (Object.keys(native).some(field => !fields.includes(field))) mismatchFields.push('UnexpectedFields');
      return { loaded: true, ready: mismatchFields.length === 0, csrfReady: true, equivalent: mismatchFields.length === 0,
        mismatchFields, ...branch(), ...(mismatchFields.length ? { reason: 'payload_mismatch' } : {}) };
    } catch (error) {
      return { loaded: true, ready: false, csrfReady: true, equivalent: false, mismatchFields: [], ...branch(), reason: error.reason || 'native_context_unavailable' };
    }
  }
  function startRead(target) {
    const readRequestId = input.readRequestId || crypto.randomUUID();
    if (!uuid(readRequestId)) return result('stopped', 'request_blocked', { loaded: false, ready: false });
    const readKey = input.operation + '\n' + input.route;
    const prior = state.readHistory.get(readRequestId);
    if (prior) return prior.key === readKey ? prior.result : result('stopped', 'request_blocked', { loaded: false, ready: false });
    if (state.active || state.readActive || state.locked) return result('stopped', 'previous_attempt', { loaded: false, ready: false });
    // Comparison is observational even for a hidden/disabled Book button. The
    // native preparation method does not read eligibility/availability flags.
    // Never derive this exemption from caller-supplied readOnly/comparison flags.
    const readJob = { readOnly: true, comparisonOnly: input.operation === 'compareNative', controllers: new Set(), pendingStages: new Map(), schemaIssues: [], done: false };
    state.readActive = readJob;
    const entry = { key: readKey, result: result('loading') };
    state.readHistory.set(readRequestId, entry);
    while (state.readHistory.size > 8) state.readHistory.delete(state.readHistory.keys().next().value);
    const done = value => {
      if (!current(readJob)) return entry.result;
      readJob.done = true; clearTimeout(readJob.timer);
      for (const controller of readJob.controllers) controller.abort();
      state.readActive = null;
      entry.result = { stage: value.stage || 'ready', ...value, ...(value.ready === false ? diagnostics(readJob)
        : readJob.preparationNotes?.length ? { preparationNotes: [...readJob.preparationNotes] } : {}),
      ...(readJob.comparisonOnly ? { bookingEligible: value.ready === true && !readJob.bookingRestricted && !readJob.preparationNotes?.length } : {}) };
      return entry.result;
    };
    readJob.timer = setTimeout(() => {
      for (const readStage of readJob.pendingStages.values()) note(readJob, readStage, 'request_timeout');
      done(result('stopped', 'course_load_timeout', { loaded: false, ready: false }));
    }, 45000);
    const work = prepare(target, readJob).then(prepared => done(input.operation === 'compareNative'
      ? compareNative(target, prepared)
      : { loaded: true, ready: true, csrfReady: true, courseCode: target.code, itemCount: prepared.payload.Items.length }))
      .catch(error => done(result('stopped', error.reason || 'request_check_failed', { loaded: false, ready: false })));
    return input.background === true ? entry.result : work;
  }
  const snapshot = job => state.history.get(job.requestId);
  const update = (job, stage, reason, extra) => {
    const value = result(stage, reason, extra);
    state.history.set(job.requestId, value);
    job.stage = stage;
    return value;
  };
  const finish = (job, stage, reason, extra) => {
    if (!current(job)) return snapshot(job);
    job.done = true; clearTimeout(job.timer);
    for (const controller of job.controllers) controller.abort();
    job.payload = null; job.csrf = ''; job.confirmationId = '';
    state.active = null;
    if (stage === 'error') state.locked = true;
    return update(job, stage, reason, extra);
  };
  async function verifySaved(job) {
    // Native saveCall reloads this same route after success. Inspect only the
    // exact submitted events: native bookingConfirmed/bookingWaitlisted require
    // Booked plus the waitlist flag. IDs, status text and warnings alone cannot
    // prove enrollment, and a failed read must never repeat the submission.
    const submitted = job.payload.Items;
    try {
      const [header, response] = await Promise.all([
        read(key(job.target), undefined, job, 'header'),
        read(key(job.target) + '/Event', undefined, job, 'events'),
      ]);
      if (!current(job) || header.SmOtype !== 'SM' || !same(header.SmObjid, job.target.moduleId)
        || !same(header.AcademicYear, job.target.year) || !same(header.AcademicSession, job.target.session)
        || codeKey(header.SmShort) !== codeKey(job.target.code) || typeof header.WaitlistBooking !== 'boolean') return 'unconfirmed';
      if (positive(header.EventPackageId) && !same(header.EventPackageId, job.target.packageId)) return 'unconfirmed';
      const events = collection(response, 'events', job);
      if (!events) return 'unconfirmed';
      let waitlisted = false;
      for (const item of submitted) {
        const matches = events.filter(event => same(event.EventId, item.EventId));
        if (matches.length !== 1) return 'unconfirmed';
        const event = matches[0];
        if (!same(event.SmObjid, job.target.moduleId) || !same(event.AcademicYear, job.target.year)
          || !same(event.AcademicSession, job.target.session) || event.Booked !== true || event.Deleted !== false
          || typeof event.WaitlistBooking !== 'boolean'
          || (positive(event.EventPackageId) && !same(event.EventPackageId, job.target.packageId))) return 'unconfirmed';
        waitlisted ||= event.WaitlistBooking;
      }
      if (header.WaitlistBooking !== waitlisted) return 'unconfirmed';
      return waitlisted ? 'waitlisted' : 'booked';
    } catch { return 'unconfirmed'; }
  }
  async function save(job) {
    if (!current(job) || job.saveIssued) return;
    update(job, 'submitting'); job.saveIssued = true;
    try {
      const saved = await request(service + 'ActionHdrSet', { payload: job.payload, csrf: job.csrf, job });
      if (!current(job)) return;
      if (['E', 'A'].includes(saved.data.MessageType)) finish(job, 'error', 'booking_error');
      else {
        // Native saveCall shows a late warning even when CheckRegistration was
        // clean. The write already happened: this is informational, never a new
        // confirmation or a retry. Render as text only; retain only in memory.
        const noticeMessage = saved.data.MessageType === 'W' ? plain(saved.data.Message) : '';
        const extra = noticeMessage ? { noticeMessage } : {};
        // The accepted Save is already known. A bounded verification failure
        // remains submitted/unconfirmed, not an invitation to retry Book.
        clearTimeout(job.timer);
        job.timer = setTimeout(() => finish(job, 'submitted', undefined, { ...extra, outcome: 'unconfirmed' }), 8000);
        const outcome = await verifySaved(job);
        if (current(job)) finish(job, 'submitted', undefined, { ...extra, outcome });
      }
    } catch { if (current(job)) finish(job, 'error', 'submission_uncertain'); }
  }
  async function begin(job) {
    try {
      const prepared = await prepare(job.target, job);
      if (!current(job)) return;
      job.payload = prepared.payload; job.csrf = prepared.csrf; job.fingerprint = fingerprint(job.payload);
      const checked = await request(service + 'ActionHdrSet', { payload: { ...job.payload, ActionName: 'CheckRegistration' }, csrf: job.csrf, job });
      if (!current(job)) return;
      if (['E', 'A'].includes(checked.data.MessageType)) { finish(job, 'stopped', 'booking_error'); return; }
      if (checked.data.MessageType) {
        const reviewMessage = plain(checked.data.Message);
        if (!reviewMessage || typeof checked.data.MessageType !== 'string') { finish(job, 'stopped', 'warning_unavailable'); return; }
        job.confirmationId = crypto.randomUUID();
        // The website must render reviewMessage as textContent, never HTML.
        update(job, 'review', undefined, { reviewMessage, confirmationId: job.confirmationId });
      } else await save(job);
    } catch (error) { if (current(job)) finish(job, 'stopped', error.reason || 'request_check_failed'); }
  }
  async function confirm(job) {
    try {
      const prepared = await prepare(job.target, job);
      if (!current(job)) return;
      if (fingerprint(prepared.payload) !== job.fingerprint) { finish(job, 'stopped', 'booking_context_changed'); return; }
      job.csrf = prepared.csrf;
      await save(job);
    } catch (error) { if (current(job)) finish(job, 'stopped', error.reason || 'request_check_failed'); }
  }
  if (input.operation === 'readStatus') return uuid(input.readRequestId) && state.readHistory.get(input.readRequestId)?.result || result('stopped', 'attempt_unavailable');
  if (input.operation === 'status') return uuid(input.requestId) && state.history.get(input.requestId) || result('stopped', 'attempt_unavailable');
  if (input.operation === 'confirm' || input.operation === 'cancel') {
    const job = state.active;
    if (input.allowWrites !== true || !job || job.requestId !== input.requestId || job.stage !== 'review'
      || !uuid(input.confirmationId) || input.confirmationId !== job.confirmationId) return result('stopped', 'attempt_unavailable');
    job.confirmationId = '';
    if (input.operation === 'cancel') return finish(job, 'stopped', 'booking_cancelled');
    update(job, 'submitting'); void confirm(job);
    return snapshot(job);
  }
  const target = targetFor(input.route);
  if (!target) return result('stopped', 'route_mismatch', { loaded: false, ready: false });
  if (['inspect', 'prepare', 'compareNative'].includes(input.operation)) return startRead(target);
  if (input.operation !== 'book' || input.allowWrites !== true || !uuid(input.requestId)) return result('stopped', 'request_blocked');
  if (state.history.has(input.requestId)) return state.history.get(input.requestId);
  if (state.active || state.readActive || state.locked || state.history.size >= 64) return result('stopped', 'previous_attempt');
  const job = { requestId: input.requestId, target, standardNativeVerified: input.standardNativeVerified === true,
    controllers: new Set(), done: false, saveIssued: false };
  state.active = job;
  job.timer = setTimeout(() => finish(job, job.saveIssued ? 'error' : 'stopped', job.saveIssued ? 'submission_uncertain' : 'action_timeout'), 120000);
  update(job, 'checking'); void begin(job);
  return snapshot(job);
}
