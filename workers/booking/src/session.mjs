import { BOOKING_ROUTES } from './routes.mjs';
import { probePage } from './probe-page.mjs';
import { closeProviderSession, providerSessionExists } from './provider-lifecycle.mjs';
import { BUILD_VERSION, failureDiagnostic, safeAuthDiagnostics } from './diagnostics.mjs';
import { bounded } from './timeout.mjs';
import { bookingReason } from './booking-result.mjs';
import { DIRECT_READ_STAGES, DIRECT_SCHEMA_ISSUES, DIRECT_SETTING_FLAGS, DIRECT_SETTING_SHAPES } from './direct-tss.mjs';

export const COOKIE_NAME = '__Host-bbb-session';
export const API_PREFIX = '/0311/api';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
export const ttlMs = env => Math.min(15, Math.max(1, Number(env.MAX_SESSION_MINUTES) || 15)) * 60_000;
export const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', ...extra,
} });
const error = (message, status = 400) => json({ state: 'error', message }, status);
const probing = env => env.PROBE_ONLY !== 'false';
const activeBooking = record => record.booking && !['submitted', 'stopped', 'error'].includes(record.booking.stage);
const STAGES = new Set(['loading', 'checking', 'review', 'submitting', 'submitted', 'stopped', 'error']);
const FAILURE_STAGES = new Set(['launch', 'page', 'guard', 'navigation', 'renderer_preflight', 'live_view', 'authentication', 'controller_disconnect', 'object_restart', 'runtime_io_context', 'status', 'cleanup_lookup', 'cleanup_pending', 'quota_service', 'quota_release', 'quota_concurrency', 'quota_budget', 'quota_cleanup', 'initialization', 'session_operation']);
const navigationInProgress = failure => /execution context was destroyed|cannot find context with specified id|inspected target navigated|execution context is not available|execution context is not available in detached frame/i.test(failure?.message || '');
const updateBooking = (record, result) => {
  const reason = bookingReason(result.reason);
  record.booking = { requestId: record.booking.requestId, stage: STAGES.has(result.stage) ? result.stage : 'error',
    ...(record.booking.mode === 'direct' ? { mode: 'direct' } : {}), ...(reason ? { reason } : {}) };
};
const directReadStages = new Set(DIRECT_READ_STAGES), directSchemaIssues = new Set(DIRECT_SCHEMA_ISSUES);
const directSettingFlags = new Set(DIRECT_SETTING_FLAGS), directSettingShapes = new Set(DIRECT_SETTING_SHAPES);
function directDiagnostics(value) {
  const issues = [];
  const seen = new Set();
  for (const item of Array.isArray(value.schemaIssues) ? value.schemaIssues.slice(0, 100) : []) {
    if (!directReadStages.has(item?.readStage) || !directSchemaIssues.has(item?.schemaIssue)) continue;
    const key = item.readStage + ':' + item.schemaIssue;
    if (!seen.has(key) && issues.length < 24) { issues.push({ readStage: item.readStage, schemaIssue: item.schemaIssue }); seen.add(key); }
  }
  const settings = value.settingShapes && typeof value.settingShapes === 'object' && !Array.isArray(value.settingShapes)
    ? Object.fromEntries(Object.entries(value.settingShapes).filter(([key, shape]) => directSettingFlags.has(key) && directSettingShapes.has(shape))) : {};
  return { ...(directReadStages.has(value.readStage) ? { readStage: value.readStage } : {}),
    ...(directSchemaIssues.has(value.schemaIssue) ? { schemaIssue: value.schemaIssue } : {}),
    ...(issues.length ? { schemaIssues: issues } : {}), ...(Object.keys(settings).length ? { settingShapes: settings } : {}) };
}

async function boundedText(request, limit = 4096) {
  if (Number(request.headers.get('Content-Length')) > limit) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (url.origin !== env.APP_ORIGIN || !url.pathname.startsWith(API_PREFIX + '/') || url.search) return error('Not found.', 404);
  const endpoint = url.pathname.slice(API_PREFIX.length);
  if (endpoint === '/test' && request.method === 'GET') return probePage();
  if (endpoint === '/health' && request.method === 'GET') return json({ ok: true, probeOnly: probing(env), directBookingEnabled: env.DIRECT_BOOKING_ENABLED === 'true', build: BUILD_VERSION });
  if (!['/status', '/login', '/logout', '/inspect', '/inspect-direct', '/verify-direct', '/book', '/confirm', '/cancel'].includes(endpoint)) return error('Not found.', 404);
  if (request.method !== (endpoint === '/status' ? 'GET' : 'POST')) return error('Method not allowed.', 405);
  const origin = request.headers.get('Origin');
  if ((origin && origin !== env.APP_ORIGIN) || (request.method === 'POST' && origin !== env.APP_ORIGIN)
      || ['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'))) return error('Request origin rejected.', 403);
  if (request.method === 'POST' && !/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '')) return error('JSON required.', 415);
  const cookie = request.headers.get('Cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE_NAME + '='))?.slice(COOKIE_NAME.length + 1);
  const existing = /^[a-f0-9]{64}$/.test(cookie || '');
  if (!existing && endpoint !== '/status') return error('Refresh the page before signing in.', 401);
  const token = existing ? cookie : randomToken();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const name = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  const response = await env.SESSIONS.get(env.SESSIONS.idFromName(name)).fetch(request);
  const headers = new Headers(response.headers);
  if (!existing) headers.set('Set-Cookie', `${COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600`);
  if (endpoint === '/logout' && response.ok) headers.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);
  return new Response(response.body, { status: response.status, headers });
}

export class SessionCore {
  constructor(ctx, env, { createBrowser, now = Date.now, statusTimeoutMs = 5000, diagnosticsTimeoutMs = 750 } = {}) {
    this.ctx = ctx;
    this.env = env;
    this.createBrowser = createBrowser;
    this.now = now;
    this.browser = null;
    this.busy = false;
    this.generation = 0;
    this.closing = null;
    this.lastDiagnostics = undefined;
    this.lastAuthDiagnostics = [];
    this.review = null;
    this.statusProbe = null;
    this.diagnosticsProbe = null;
    this.statusTimeoutMs = statusTimeoutMs;
    this.diagnosticsTimeoutMs = diagnosticsTimeoutMs;
    this.results = new Map();
    this.initializing = this.initialize();
  }

  async initialize() {
    this.record = await this.ctx.storage.get('session') || { csrf: randomToken(), state: 'signed_out', history: {} };
    // A restarted object has lost its request-interception controller. Destroy
    // the old browser rather than recovering an unguarded authenticated session.
    if (this.record.browserId || this.record.leaseReserved) {
      this.record.failureStage = 'object_restart';
      try { await this.close('expired'); } catch (failure) {
        this.record.lastFailure = failure.failureDiagnostic || failureDiagnostic(failure, 'initialization');
        this.record.failureStage = FAILURE_STAGES.has(failure?.stage) ? failure.stage : 'initialization';
        this.record.state = 'error';
        await this.ctx.storage.setAlarm(this.now() + 10_000);
      }
    }
    await this.persist();
  }

  persist() { return this.ctx.storage.put('session', this.record); }
  quota() { return this.env.QUOTA.get(this.env.QUOTA.idFromName('booking-probe-quota')); }
  async quotaCall(action, data = {}) {
    try { return await this.quota().fetch(new Request('https://quota.internal/' + action, { method: 'POST', body: JSON.stringify({ owner: this.ctx.id.toString(), ...data }) })); }
    catch (failure) { throw Object.assign(new Error('Session quota unavailable'), { stage: 'quota_service', failureDiagnostic: failureDiagnostic(failure, 'quota') }); }
  }
  snapshot(extra = {}) {
    return { state: this.busy || activeBooking(this.record) ? 'busy' : this.record.state, csrf: this.record.csrf, probeOnly: probing(this.env), build: BUILD_VERSION,
      directBookingEnabled: this.env.DIRECT_BOOKING_ENABLED === 'true', authDiagnostics: safeAuthDiagnostics(this.record, this.lastAuthDiagnostics),
      ...(probing(this.env) && this.record.lastFailure ? { failure: this.record.lastFailure } : {}),
      ...(probing(this.env) && this.record.failureStage ? { failureStage: this.record.failureStage } : {}),
      ...(this.record.booking ? { booking: { ...this.record.booking,
        ...(this.record.booking.mode === 'direct' && this.record.booking.stage === 'review' && this.review?.requestId === this.record.booking.requestId
          ? { reviewMessage: this.review.message, confirmationId: this.review.confirmationId } : {}) } } : {}),
      ...(this.record.expiresAt ? { expiresAt: this.record.expiresAt } : {}), ...extra };
  }

  captureBooking(result) {
    updateBooking(this.record, result);
    this.review = this.record.booking.mode === 'direct' && result.stage === 'review' && UUID.test(result.confirmationId || '')
      && typeof result.reviewMessage === 'string' && result.reviewMessage.length > 0 && result.reviewMessage.length <= 4000
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result.reviewMessage)
      ? { requestId: this.record.booking.requestId, confirmationId: result.confirmationId, message: result.reviewMessage } : null;
  }

  close(state) {
    if (this.closing) return this.closing;
    const work = this.closeCurrent(state);
    this.closing = work;
    work.finally(() => { if (this.closing === work) this.closing = null; }).catch(() => {});
    return work;
  }

  async closeCurrent(state) {
    this.generation++;
    this.statusProbe = null;
    this.diagnosticsProbe = null;
    const generation = this.generation;
    const browser = this.browser;
    const browserId = this.record.browserId;
    this.review = null;
    this.browser = null;
    await closeProviderSession(this.env.BROWSER, browserId, { closeLocal: browser ? () => browser.close() : undefined });
    if (generation !== this.generation || this.record.browserId !== browserId) throw new Error('Session changed during closure');
    if ((browserId || this.record.leaseReserved) && !(await this.quotaCall('release')).ok) throw Object.assign(new Error('Session lease release pending'), { stage: 'quota_release' });
    delete this.record.browserId;
    delete this.record.leaseReserved;
    delete this.record.expiresAt;
    this.record.state = state;
    if (activeBooking(this.record)) updateBooking(this.record, { stage: 'error', reason: state === 'expired' ? 'session_expired' : 'session_unavailable' });
    await this.ctx.storage.deleteAlarm();
    await this.persist();
  }

  async alarm() {
    await this.initializing;
    if (['expired', 'error'].includes(this.record.state) || (this.record.expiresAt && this.now() >= this.record.expiresAt)) await this.close('expired');
    else if (this.record.expiresAt) await this.ctx.storage.setAlarm(this.record.expiresAt);
  }

  async refresh() {
    if (!this.browser && (this.record.browserId || this.record.leaseReserved) && this.record.state === 'error') await this.close('expired');
    if (this.record.expiresAt && this.now() >= this.record.expiresAt) await this.close('expired');
    if (!this.browser || this.busy) return;
    const generation = this.generation;
    if (activeBooking(this.record)) {
      const attempt = this.record.booking;
      const result = await this.browser.bookingStatus(attempt.requestId);
      // A status read may overlap a confirmation. It must not restore an old
      // review grant or replace a newer terminal/submitting state.
      if (generation !== this.generation || this.busy || this.record.booking !== attempt) return;
      this.captureBooking(result);
      if (!activeBooking(this.record)) this.record.state = 'ready';
      await this.persist();
      return;
    }
    let authenticated;
    try { authenticated = await this.browser.authenticated(); }
    catch (failure) {
      if (generation !== this.generation || this.busy || activeBooking(this.record)) return;
      if (navigationInProgress(failure) && this.browser?.connected?.() !== false) {
        // SAML navigation replaces execution contexts. It must revoke ready
        // state while preserving the controlled browser for the next poll.
        this.record.state = 'signing_in';
        await this.persist();
        return;
      }
      const stage = this.browser?.connected?.() === false ? 'controller_disconnect'
        : /different request|I\/O on behalf/i.test(failure?.message || '') ? 'runtime_io_context' : 'authentication';
      throw Object.assign(new Error('Authentication status unavailable'), { stage, failureDiagnostic: failureDiagnostic(failure, 'authentication') });
    }
    if (generation !== this.generation || this.busy || activeBooking(this.record)) return;
    if (authenticated) this.record.state = 'ready';
    else if (this.record.state === 'ready') await this.close('expired');
    else this.record.state = 'signing_in';
    await this.persist();
  }

  async readStatus() {
    if (this.browser?.authDiagnostics) this.lastAuthDiagnostics = this.browser.authDiagnostics();
    if (probing(this.env) && this.browser && !this.busy && this.browser.diagnostics) {
      if (!this.diagnosticsProbe) {
        const generation = this.generation;
        const work = this.browser.diagnostics().then(value => { if (generation === this.generation) this.lastDiagnostics = value; });
        this.diagnosticsProbe = work;
        work.finally(() => { if (this.diagnosticsProbe === work) this.diagnosticsProbe = null; }).catch(() => {});
      }
    }
    await this.refresh();
    if (this.diagnosticsProbe) await bounded(this.diagnosticsProbe, this.diagnosticsTimeoutMs, 'diagnostics_timeout').catch(() => {});
  }

  async status() {
    if (!this.statusProbe) {
      const work = this.readStatus();
      this.statusProbe = work;
      work.finally(() => { if (this.statusProbe === work) this.statusProbe = null; }).catch(() => {});
    }
    const generation = this.generation;
    try {
      await bounded(this.statusProbe, this.statusTimeoutMs, 'status_timeout');
      if (this.record.failureStage === 'status_timeout') { delete this.record.failureStage; delete this.record.lastFailure; await this.persist(); }
    } catch (failure) {
      if (failure?.stage !== 'status_timeout') throw failure;
      if (generation === this.generation && this.browser && !this.busy && !activeBooking(this.record)) this.record.state = 'signing_in';
      this.record.failureStage = 'status_timeout';
      this.record.lastFailure = { name: 'TimeoutError', code: 'read_timeout', source: 'status' };
      await this.persist();
    }
    return json(this.snapshot(probing(this.env) && this.lastDiagnostics ? { diagnostics: this.lastDiagnostics } : {}));
  }

  async fetch(request) {
    try {
      await this.initializing;
      const action = new URL(request.url).pathname.slice(API_PREFIX.length);
      if (action === '/status') return await this.status();
      if (request.headers.get('X-BBB-CSRF') !== this.record.csrf) return error('Session verification failed.', 403);
      const raw = await boundedText(request);
      if (raw === null) return error('Request too large.', 413);
      let body;
      try { body = JSON.parse(raw); } catch { return error('Invalid request.'); }
      const reviewing = ['/confirm', '/cancel'].includes(action);
      const allowedKeys = reviewing ? ['requestId', 'bookingRequestId', 'confirmationId'] : ['requestId', 'route'];
      if (!body || typeof body !== 'object' || Array.isArray(body) || !UUID.test(body.requestId || '')
          || Object.keys(body).some(key => !allowedKeys.includes(key))
          || (reviewing && (!UUID.test(body.bookingRequestId || '') || !UUID.test(body.confirmationId || '')))) return error('Invalid request.');
      if (body.route !== undefined && !BOOKING_ROUTES.has(body.route)) return error('Unknown booking option.');
      if (['/inspect', '/inspect-direct', '/verify-direct', '/book'].includes(action) && !BOOKING_ROUTES.has(body.route)) return error('Choose a verified booking option.');
      const confirmationDigest = reviewing ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.confirmationId)))].map(value => value.toString(16).padStart(2, '0')).join('') : '';
      const fingerprint = action + '\n' + (body.route || '') + (reviewing ? '\n' + body.bookingRequestId + '\n' + confirmationDigest : '');
      if (this.record.history[body.requestId]) {
        if (this.record.history[body.requestId] !== fingerprint) return error('Request identifier already used.', 409);
        const prior = this.results.get(body.requestId);
        return prior ? json(prior.body, prior.status) : error('Request already processed. Refresh session status.', 409);
      }
      if (this.busy) return json(this.snapshot(), 409);
      if (activeBooking(this.record) && !['/login', '/logout', '/confirm', '/cancel'].includes(action)) return json(this.snapshot(), 409);
      if (Object.keys(this.record.history).length >= 64) return error('Start a fresh page session.', 429);
      if (['/book', '/confirm', '/cancel'].includes(action) && probing(this.env)) return error('Booking is disabled during session testing.', 403);
      if (reviewing && (this.env.DIRECT_BOOKING_ENABLED !== 'true' || this.record.booking?.mode !== 'direct' || this.record.booking.stage !== 'review'
        || this.record.booking.requestId !== body.bookingRequestId || this.review?.confirmationId !== body.confirmationId)) return error('No matching confirmation is available.', 409);
      this.busy = true;
      this.record.history[body.requestId] = fingerprint;
      await this.persist();
      let result;
      try {
        result = await this.perform(action, body);
      } finally { this.busy = false; }
      const data = { ...this.snapshot(), ...result.body };
      // Review text belongs only to this live response and in-memory controller.
      // Request deduplication stores no native messages or confirmation grants.
      this.results.set(body.requestId, { status: result.status || 200, body: { ...data, ...(data.booking ? { booking: { ...this.record.booking } } : {}) } });
      return json(data, result.status || 200);
    } catch (failure) {
      this.busy = false;
      if (this.record) this.record.lastFailure = failure.failureDiagnostic || failureDiagnostic(failure, 'session_fetch');
      if (this.record) this.record.failureStage = FAILURE_STAGES.has(failure?.stage) ? failure.stage : 'session_operation';
      try { await this.close('error'); } catch (cleanupFailure) {
        this.record.lastFailure = cleanupFailure.failureDiagnostic || failureDiagnostic(cleanupFailure, 'session_cleanup');
        if (FAILURE_STAGES.has(cleanupFailure?.stage)) this.record.failureStage = cleanupFailure.stage;
        this.record.state = 'error';
        await this.persist().catch(() => {});
        await this.ctx.storage.setAlarm(this.now() + 10_000).catch(() => {});
      }
      return json(this.snapshot({ state: 'error', message: 'The managed TSS session is unavailable. Try signing in again.',
        ...(probing(this.env) && this.lastDiagnostics ? { diagnostics: this.lastDiagnostics } : {}) }), 503);
    }
  }

  async perform(action, body) {
    if (this.record.expiresAt && this.now() >= this.record.expiresAt) await this.close('expired');
    if (action === '/logout') {
      await this.close('signed_out');
      delete this.record.booking;
      this.review = null;
      await this.persist();
      this.results.clear();
      return { body: { state: 'signed_out' } };
    }
    if (action === '/login') {
      if (this.closing) await this.closing;
      if (!this.browser && (this.record.browserId || this.record.leaseReserved)) await this.close('expired');
      if (!this.browser) {
        const expiresAt = this.now() + ttlMs(this.env);
        const reservation = await this.quotaCall('reserve', { expiresAt });
        if (!reservation.ok) {
          const { reason } = await reservation.json();
          this.record.failureStage = ['quota_concurrency', 'quota_budget', 'quota_cleanup'].includes(reason) ? reason : 'quota_service';
          await this.persist();
          return { status: 429, body: { state: 'error', message: 'The login test is at its session or usage limit. Try later.' } };
        }
        this.record.leaseReserved = true;
        await this.persist();
        const generation = ++this.generation;
        delete this.record.failureStage;
        delete this.record.lastFailure;
        this.lastDiagnostics = undefined;
        let browser;
        try {
          browser = await this.createBrowser(this.env, { onDisconnect: () => {
            this.record.state = 'expired';
            this.record.failureStage = 'controller_disconnect';
            this.ctx.storage.setAlarm(this.now() + 1000).catch(() => {});
          } });
          if (generation !== this.generation || this.now() >= expiresAt) throw new Error('Session expired during startup');
          this.browser = browser;
          this.record.browserId = browser.id;
          this.record.expiresAt = expiresAt;
          this.record.state = 'signing_in';
          if (!(await this.quotaCall('attach', { browserId: browser.id })).ok) throw new Error('Lease unavailable');
          await this.persist();
          await this.ctx.storage.setAlarm(expiresAt);
        } catch (failure) {
          // Preserve a known startup browser ID before cleanup so a provider or
          // quota outage remains recoverable on a later status/alarm request.
          if (!this.record.browserId && typeof failure?.browserId === 'string') this.record.browserId = failure.browserId;
          if (browser) this.browser = browser;
          await this.persist();
          await this.close('error');
          throw failure;
        }
      }
      const generation = this.generation;
      const loginUrl = await this.browser.loginUrl();
      if (generation !== this.generation) throw new Error('Session changed');
      return { body: { state: this.record.state, loginUrl } };
    }
    if (action === '/confirm' || action === '/cancel') {
      const generation = this.generation;
      const result = await this.browser.reviewBooking(action.slice(1), body.bookingRequestId, body.confirmationId);
      if (generation !== this.generation || this.now() >= this.record.expiresAt) throw new Error('Session changed');
      this.captureBooking(result);
      await this.persist();
      return { body: { state: activeBooking(this.record) ? 'busy' : 'ready', booking: this.snapshot().booking } };
    }
    if (['/inspect', '/inspect-direct', '/verify-direct', '/book'].includes(action)) {
      const directRead = ['/inspect-direct', '/verify-direct'].includes(action);
      if (!this.browser || !await this.browser.authenticated({ fresh: true, direct: directRead })) return { status: 401, body: { state: this.browser ? 'signing_in' : 'signed_out', ready: false, reason: 'authentication_required' } };
      const generation = this.generation;
      const { courseCode } = BOOKING_ROUTES.get(body.route);
      if (action === '/book') {
        this.record.booking = { requestId: body.requestId, stage: 'loading', ...(this.env.DIRECT_BOOKING_ENABLED === 'true' ? { mode: 'direct' } : {}) };
        await this.persist();
        const result = await this.browser.book(body.route, courseCode, body.requestId);
        if (generation !== this.generation || this.now() >= this.record.expiresAt) throw new Error('Session changed');
        this.captureBooking(result);
        await this.persist();
        return { body: { state: activeBooking(this.record) ? 'busy' : 'ready', booking: this.snapshot().booking } };
      }
      const result = directRead ? await this.browser.inspectDirect(body.route, courseCode, action === '/verify-direct') : await this.browser.inspect(body.route, courseCode);
      if (generation !== this.generation || this.now() >= this.record.expiresAt) throw new Error('Session changed');
      // The fresh authentication gate above already proved this session. A
      // course eligibility failure is not a logout; explicit auth failure is.
      const csrfReady = directRead ? result.reason !== 'authentication_required' : result.csrf === true;
      this.record.state = csrfReady ? 'ready' : 'signing_in';
      await this.persist();
      const reason = bookingReason(result.reason);
      const fields = new Set(['ModuleId', 'ActionName', 'ProgramId', 'Items', 'AssignedCg', 'AssignedCgTop', 'TemplateId', 'EventPackId', 'ModregId', 'AcademicYear', 'AcademicSession', 'Credits', 'CreditUnit', 'UnexpectedFields']);
      return { body: { state: this.record.state, ready: result.ready === true && csrfReady, loaded: result.loaded === true, csrfReady, courseCode, ...(reason ? { reason } : {}),
        ...(directRead ? directDiagnostics(result) : {}),
        ...(action === '/verify-direct' ? { equivalent: result.equivalent === true, mismatchFields: Array.isArray(result.mismatchFields) ? result.mismatchFields.filter(field => fields.has(field)) : [] } : {}) } };
    }
    return { status: 404, body: { state: 'error', message: 'Not found.' } };
  }
}

export class QuotaCore {
  constructor(ctx, env, { now = Date.now } = {}) { this.ctx = ctx; this.env = env; this.now = now; this.queue = Promise.resolve(); }
  fetch(request) {
    const work = this.queue.then(() => this.handle(request));
    this.queue = work.catch(() => {});
    return work;
  }
  async handle(request) {
    const body = await request.json();
    const action = new URL(request.url).pathname;
    const month = new Date(this.now()).toISOString().slice(0, 7);
    const record = await this.ctx.storage.get('quota') || { month, reservedMs: 0, leases: {} };
    if (record.month !== month) { record.month = month; record.reservedMs = 0; }
    if (action === '/reserve') {
      for (const [owner, lease] of Object.entries(record.leases)) {
        if (this.now() < lease.expiresAt) {
          // A controller may have died after closing its browser but before
          // releasing the lease. Provider absence, not age, proves reclaim safe.
          if (lease.browserId) {
            try { if (!await providerSessionExists(this.env.BROWSER, lease.browserId)) delete record.leases[owner]; }
            catch { /* Unknown provider state keeps the lease. */ }
          }
          continue;
        }
        if (lease.browserId) {
          try { await closeProviderSession(this.env.BROWSER, lease.browserId); }
          catch { return json({ ok: false, reason: 'quota_cleanup' }, 409); }
        }
        delete record.leases[owner];
      }
      if (record.leases[body.owner]) return json({ ok: true });
      const concurrency = probing(this.env) ? 1 : Math.min(8, Math.max(1, Number(this.env.MAX_BROWSER_SESSIONS) || 1));
      if (Object.keys(record.leases).length >= concurrency) return json({ ok: false, reason: 'quota_concurrency' }, 409);
      const duration = ttlMs(this.env);
      const configured = Number(this.env.MONTHLY_BROWSER_MINUTES ?? 90);
      const ceiling = probing(this.env) ? 150 : 600;
      const limit = (Number.isFinite(configured) ? Math.min(ceiling, Math.max(0, configured)) : 0) * 60_000;
      if (record.reservedMs + duration > limit) return json({ ok: false, reason: 'quota_budget' }, 429);
      record.reservedMs += duration; // Reserve the full window; never refund unknown usage.
      record.leases[body.owner] = { expiresAt: this.now() + duration, browserId: null };
    } else if (action === '/attach') {
      if (!record.leases[body.owner] || typeof body.browserId !== 'string') return json({ ok: false }, 409);
      record.leases[body.owner].browserId = body.browserId;
    } else if (action === '/release') {
      delete record.leases[body.owner];
    } else return json({ ok: false }, 404);
    await this.ctx.storage.put('quota', record);
    return json({ ok: true });
  }
}

