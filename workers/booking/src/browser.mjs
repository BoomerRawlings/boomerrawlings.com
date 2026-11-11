import puppeteer from '@cloudflare/puppeteer';
import { installNetworkGuard } from './network-guard.mjs';
import { detectAuthenticated, inspectTss, beginBook, getBookingStatus, detectSessionCsrf } from './tss-adapter.mjs';
import { BOOKING_ROUTES, VERIFIED_STANDARD_ROUTES } from './routes.mjs';
import { bounded } from './timeout.mjs';
import { bookingReason, bookingResult, terminalBooking } from './booking-result.mjs';
import { directTssOperation } from './direct-tss.mjs';
import { authenticationProbe, safeAccountName } from './authentication.mjs';
import { resolveRoomieCourses } from './resolve-courses.mjs';
import { loginViewport } from './viewport.mjs';
import { safeBlockedRequest, safeCspDirective, safeNetworkError, preflightDiagnostic, safeAuthDiagnostics } from './diagnostics.mjs';

export const PROTOCOL_TIMEOUT_MS = 20_000;

export async function loadCourse(page, route, courseCode, { inspect = inspectTss, timeoutMs = 20_000, pollMs = 300 } = {}) {
  try {
    // An identical URL reloads the SAP document. A loaded exact package only
    // needs inspection; beginBook independently refreshes its native data.
    if (page.url() !== route) await page.goto(route, { waitUntil: 'domcontentloaded' });
    const deadline = Date.now() + timeoutMs;
    do {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const result = await bounded(inspect(page, { route, courseCode }), remaining, 'course_load_timeout');
      if (result.loaded) return result;
      await new Promise(resolve => setTimeout(resolve, Math.min(pollMs, Math.max(0, deadline - Date.now()))));
    } while (Date.now() < deadline);
    return { loaded: false, ready: false, reason: 'course_load_timeout' };
  } catch (failure) {
    if (failure?.name === 'TimeoutError' || failure?.stage === 'course_load_timeout' || /timed out|timeout/i.test(failure?.message || '')) {
      return { loaded: false, ready: false, reason: 'course_load_timeout' };
    }
    throw failure;
  }
}

// WorkersLaunchOptions does not forward protocolTimeout. Use the binding's
// documented session-pinned transport with Puppeteer's public ConnectOptions.
export async function openManagedBrowser(env, client = puppeteer) {
  const session = await env.BROWSER.launch({
    keepAlive: Math.min(15, Math.max(1, Number(env.MAX_SESSION_MINUTES) || 15)) * 60_000,
    recording: false,
    guardrails: { allowedDomains: ['ucsd.edu', '*.ucsd.edu', 'duosecurity.com', '*.duosecurity.com'] },
  });
  const id = session.sessionId;
  try {
    const response = await session.webSocket.fetch('https://browser-binding.invalid', { headers: { Upgrade: 'websocket' } });
    const socket = response.webSocket;
    if (!socket) throw new Error('Browser connection unavailable');
    socket.accept();
    let transportClosed = false;
    const transport = { onmessage: undefined, onclose: undefined,
      send(message) { if (transportClosed) throw new Error('Browser transport closed'); socket.send(message); }, close() { socket.close(); } };
    const notifyClose = () => { if (transportClosed) return; transportClosed = true; transport.onclose?.(); };
    socket.addEventListener('message', event => transport.onmessage?.(event.data));
    socket.addEventListener('close', notifyClose);
    socket.addEventListener('error', () => { try { socket.close(); } finally { notifyClose(); } });
    const browser = await client.connect({ transport, protocolTimeout: PROTOCOL_TIMEOUT_MS });
    return { browser, id };
  } catch {
    await env.BROWSER.closeSession(id).catch(() => {});
    throw Object.assign(new Error('Managed browser unavailable'), { stage: 'launch', browserId: id });
  }
}

export async function rendererPreflight(page, timeoutMs = 8000) {
  let cdp, phase = 'attach', abandoned = false, cleanupStarted = false;
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());
  const cleanup = () => {
    if (!cdp || cleanupStarted) return;
    cleanupStarted = true;
    // A responsive renderer is ready even if CDP detach is slow. Cleanup is
    // separately bounded and never changes a successful readiness result.
    void bounded(Promise.resolve().then(() => cdp.detach()), 250, 'preflight_cleanup_timeout').catch(() => {});
  };
  const work = (async () => {
    try {
      cdp = await page.createCDPSession();
      if (abandoned) return;
      // Runtime.evaluate works without enabling Page event subscriptions.
      // Readiness only needs the current renderer's positive DOM response.
      phase = 'evaluate';
      const result = await cdp.send('Runtime.evaluate', { expression: 'Boolean(document.documentElement)', returnByValue: true, timeout: Math.min(5000, remaining()) }, { timeout: remaining() });
      if (result.exceptionDetails) throw new Error('Renderer evaluation failed');
      if (result.result?.value !== true) throw Object.assign(new Error('Renderer not ready'), { preflightIssue: 'dom_not_ready' });
    } finally { cleanup(); }
  })();
  try { await bounded(work, timeoutMs, 'renderer_preflight_timeout'); }
  catch (failure) { throw Object.assign(new Error('Browser renderer unavailable'), { stage: 'renderer_preflight', failureDiagnostic: preflightDiagnostic(failure, phase) }); }
  finally { abandoned = true; cleanup(); }
}

export async function rendererHandoffPreflight(page, timeoutMs = 16000, retryDelayMs = 250) {
  const deadline = Date.now() + timeoutMs;
  try { await rendererPreflight(page, Math.min(8000, Math.floor(timeoutMs / 2))); }
  catch (failure) {
    // Redirects/renderer startup can outlive one CDP probe. Retry this guarded
    // page once, without navigation or another browser/session reservation.
    if (!['renderer_timeout', 'navigation_context'].includes(failure?.failureDiagnostic?.code)
      || deadline - Date.now() <= retryDelayMs) throw failure;
    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw failure;
    await rendererPreflight(page, remaining);
  }
}

export async function createBrowserController(env, { onDisconnect = () => {}, openBrowser = openManagedBrowser, installGuard = installNetworkGuard, viewport } = {}) {
  const initialViewport = viewport === undefined ? undefined : loginViewport(viewport);
  if (initialViewport === null) throw Object.assign(new Error('Invalid login viewport'), { stage: 'page' });
  let browser, id;
  try { ({ browser, id } = await openBrowser(env)); }
  catch (failure) { throw Object.assign(new Error('Managed browser unavailable'), { stage: 'launch', ...(failure.browserId ? { browserId: failure.browserId } : {}) }); }
  let closing = false;
  let activeJob = null;
  // A SessionCore revision may discard an overlapping poll after this
  // controller observes completion. Preserve that terminal result for its
  // next poll instead of falling through to the unrelated native adapter.
  const completedDirectJobs = new Map();
  const finishJob = (job, result) => {
    if (job?.mode === 'direct' && !closing) {
      const previous = completedDirectJobs.get(job.requestId);
      if (previous) return { ...previous };
      if (terminalBooking(result)) {
        completedDirectJobs.set(job.requestId, { ...result });
        if (completedDirectJobs.size > 8) completedDirectJobs.delete(completedDirectJobs.keys().next().value);
      }
    }
    if (terminalBooking(result) && activeJob === job) activeJob = null;
    return result;
  };
  let lastAuthentication = 0;
  let authenticationValid = false;
  let authenticatedName;
  let authenticationRevision = 0, authenticationUrl = '', authenticationMode = '', authenticationState;
  const blocked = new Map();
  const authBlocked = new Map();
  const cspViolations = new Map(), requestFailures = new Map();
  let stage = 'page';
  browser.on('disconnected', () => {
    authenticationValid = false; authenticatedName = undefined;
    if (closing) return;
    // Never reconnect to an uncontrolled authenticated browser after a lost guard.
    env.BROWSER.closeSession(id).catch(() => {});
    onDisconnect();
  });
  try {
    const page = await browser.newPage();
    // Resize only the blank page, before any human login/navigation. Reopening
    // LiveView for an existing session must never reload or resize that session.
    if (initialViewport) await page.setViewport({ ...initialViewport, deviceScaleFactor: 1 });
    page.on?.('framenavigated', frame => {
      if (frame !== page.mainFrame()) return;
      authenticationRevision++; authenticationValid = false; authenticatedName = undefined;
    });
    stage = 'guard';
    const guard = await installGuard(page, {
      getJob: () => env.PROBE_ONLY === 'false' ? activeJob : null,
      onBlocked: value => {
        const safe = safeBlockedRequest(value), safeKey = JSON.stringify(safe);
        const key = `${safe.method} ${safe.hostname}${safe.pathname}`;
        if (blocked.has(key) || blocked.size < 30) blocked.set(key, (blocked.get(key) || 0) + 1);
        if (authBlocked.has(safeKey) || authBlocked.size < 30) authBlocked.set(safeKey, { ...safe, count: (authBlocked.get(safeKey)?.count || 0) + 1 });
        if (activeJob && value.hostname === 'tss.ucsd.edu' && !['GET', 'HEAD', 'OPTIONS'].includes(value.method)
          && /\/(?:ActionHdrSet|\$batch)$/.test(value.pathname)) activeJob.requestBlocked = true;
      },
    });
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(25_000);
    browser.on('targetcreated', async target => {
      if (target.type() !== 'page') return;
      const extra = await target.page().catch(() => null);
      if (extra && extra !== page) await extra.close().catch(() => {});
    });
    const cdp = await page.createCDPSession();
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    // Record only fixed failure classes. Never retain URLs, issue payloads,
    // request identifiers, headers, document contents or raw Chromium errors.
    cdp.on?.('Audits.issueAdded', event => {
      const directive = safeCspDirective(event.issue?.details?.contentSecurityPolicyIssueDetails?.violatedDirective);
      if (directive) cspViolations.set(directive, Math.min(1000, (cspViolations.get(directive) || 0) + 1));
    });
    cdp.on?.('Network.loadingFailed', event => {
      const code = safeNetworkError(event.errorText);
      requestFailures.set(code, Math.min(1000, (requestFailures.get(code) || 0) + 1));
    });
    await cdp.send('Network.enable').catch(() => {});
    await cdp.send('Audits.enable').catch(() => {});
    stage = 'navigation';
    await page.goto('https://tss.ucsd.edu/fiori', { waitUntil: 'domcontentloaded' });
    // SessionCore holds the login mutation lock and calls loginUrl immediately.
    // Perform readiness there, once per handoff, not twice during creation.
    let formProbe = null;
    let forms = [];
    const load = (route, courseCode) => loadCourse(page, route, courseCode);
    const directEnabled = env.DIRECT_BOOKING_ENABLED === 'true';
    const directRead = async (operation, route, courseCode) => {
      const readRequestId = crypto.randomUUID();
      let result = await page.evaluate(directTssOperation, { operation, route, courseCode, background: true, readRequestId });
      const deadline = Date.now() + 45_000;
      while (result?.stage === 'loading' && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 300));
        result = await page.evaluate(directTssOperation, { operation: 'readStatus', readRequestId });
      }
      return result?.stage === 'loading' ? { loaded: false, ready: false, reason: 'course_load_timeout' } : result;
    };
    const authenticated = async ({ fresh = false, direct = false } = {}) => {
      const mode = directEnabled || direct ? 'direct' : 'native', url = page.url();
      if (!fresh && authenticationValid && authenticationUrl === url && authenticationMode === mode && Date.now() - lastAuthentication < 30_000) return 'authenticated';
      const revision = ++authenticationRevision;
      authenticationValid = false; authenticatedName = undefined;
      const proof = await page.evaluate(authenticationProbe, { requireShell: mode === 'native' });
      // Navigation or a newer fresh check supersedes this result, even when the
      // older request finishes after a successful new proof.
      if (revision !== authenticationRevision || page.url() !== url) return 'unavailable';
      const status = ['authenticated', 'unauthenticated', 'unavailable'].includes(proof?.status) ? proof.status : 'unavailable';
      authenticationValid = status === 'authenticated';
      authenticatedName = authenticationValid ? safeAccountName(proof?.displayName) : undefined;
      authenticationState = { page: proof?.page, ...(proof?.issue ? { issue: proof.issue } : {}) };
      guard.recordAuthPage?.(proof?.page);
      authenticationUrl = url; authenticationMode = mode; lastAuthentication = Date.now();
      return status;
    };
    return {
      id,
      connected() { return browser.connected && !page.isClosed(); },
      authenticated,
      accountName() {
        return !closing && authenticationValid && authenticationUrl === page.url() && Date.now() - lastAuthentication < 30_000
          ? authenticatedName : undefined;
      },
      resolveCourses() { return page.evaluate(resolveRoomieCourses); },
      async loginUrl() {
        try {
          await rendererHandoffPreflight(page);
          const result = await env.BROWSER.getLiveView(id, { targetId: targetInfo.targetId, mode: 'tab', expiresInMs: 60_000 });
          const url = new URL(result.devtoolsFrontendUrl);
          if (url.origin !== 'https://live.browser.run') throw new Error('Unexpected login view origin');
          return url.href;
        } catch (failure) {
          // Snapshot synchronous guard evidence before cleanup destroys it. The
          // browser-level target command needs no renderer/DOM; return an enum,
          // never target details, URLs, headers or original protocol errors.
          const evidence = safeAuthDiagnostics({}, { blocked: [...authBlocked.values()], trace: guard.authTrace?.() || [],
            guard: guard.diagnostics?.(), ...(authenticationState ? { authentication: authenticationState } : {}),
            csp: [...cspViolations].map(([directive, count]) => ({ directive, count })),
            requestFailures: [...requestFailures].map(([code, count]) => ({ code, count })) });
          let targetProbe = 'unavailable';
          try {
            const target = await bounded(cdp.send('Target.getTargetInfo', { targetId: targetInfo.targetId }, { timeout: 1000 }), 1000, 'target_probe_timeout');
            if (target?.targetInfo?.targetId === targetInfo.targetId) targetProbe = 'responsive';
          } catch (error) { if (error?.name === 'TimeoutError' || /timed out|timeout/i.test(error?.message || '')) targetProbe = 'timeout'; }
          throw Object.assign(new Error('Login view unavailable'), { stage: failure?.stage === 'renderer_preflight' ? failure.stage : 'live_view',
            authDiagnostics: { ...evidence, targetProbe },
            ...(failure?.stage === 'renderer_preflight' ? { failureDiagnostic: failure.failureDiagnostic } : {}) });
        }
      },
      async inspect(route, courseCode) {
        if (!await detectAuthenticated(page)) return { ready: false, reason: 'authentication_required' };
        const result = await load(route, courseCode);
        const reason = bookingReason(result.reason);
        return { ready: result.ready === true, loaded: result.loaded === true, csrf: await detectSessionCsrf(page), ...(reason ? { reason } : {}) };
      },
      async inspectDirect(route, courseCode, compare = false) {
        if (compare) {
          const loaded = await load(route, courseCode);
          if (!loaded.loaded) return loaded;
        }
        return directRead(compare ? 'compareNative' : 'inspect', route, courseCode);
      },
      async book(route, courseCode, requestId) {
        if (closing || env.PROBE_ONLY !== 'false' || activeJob) throw new Error('Booking unavailable');
        const completed = directEnabled && completedDirectJobs.get(requestId);
        if (completed) return { ...completed };
        // SessionCore has just required fresh authentication. Reuse that proof
        // rather than sending a second CSRF fetch before the same action.
        if (!authenticationValid || Date.now() - lastAuthentication >= 30_000) return { stage: 'stopped', reason: 'authentication_required' };
        const metadata = BOOKING_ROUTES.get(route);
        if (!metadata || metadata.courseCode !== courseCode) return { stage: 'stopped', reason: 'route_mismatch' };
        const standardNativeVerified = directEnabled && VERIFIED_STANDARD_ROUTES.has(route);
        // Catalog IDs are not proof of the native submission path. Unverified
        // direct routes stop here, without a native-page fallback or guard job.
        if (directEnabled && !standardNativeVerified) return { stage: 'stopped', reason: 'unsupported_tss' };
        if (!directEnabled) {
          const loaded = await load(route, courseCode);
          if (!loaded.ready) return bookingResult({ stage: 'stopped', reason: loaded.reason || 'booking_unavailable' });
        }
        const job = { ...metadata, phase: 'check', requestId, ...(directEnabled ? { mode: 'direct' } : {}) };
        activeJob = job;
        const value = directEnabled ? await page.evaluate(directTssOperation, { operation: 'book', route, courseCode, requestId, allowWrites: true, standardNativeVerified })
          : await beginBook(page, { route, courseCode, requestId });
        const result = bookingResult(value, job.requestBlocked);
        return finishJob(job, result);
      },
      async bookingStatus(requestId) {
        if (closing) return { stage: 'stopped', reason: 'session_unavailable' };
        const completed = completedDirectJobs.get(requestId);
        if (completed) return { ...completed };
        const job = activeJob;
        if (directEnabled && (job?.mode !== 'direct' || job.requestId !== requestId)) return { stage: 'stopped', reason: 'attempt_unavailable' };
        const value = job?.mode === 'direct' ? await page.evaluate(directTssOperation, { operation: 'status', requestId }) : await getBookingStatus(page, { requestId });
        const result = bookingResult(value, job?.requestBlocked);
        if (job?.mode === 'direct' && result.stage === 'review') {
          result.reviewMessage = value.reviewMessage; result.confirmationId = value.confirmationId;
        }
        return finishJob(job, result);
      },
      async reviewBooking(operation, requestId, confirmationId) {
        if (!closing && directEnabled && env.PROBE_ONLY === 'false' && ['confirm', 'cancel'].includes(operation)) {
          const completed = completedDirectJobs.get(requestId);
          if (completed) return { ...completed };
        }
        const job = activeJob;
        if (!directEnabled || env.PROBE_ONLY !== 'false' || !['confirm', 'cancel'].includes(operation)
          || job?.mode !== 'direct' || job.requestId !== requestId) return { stage: 'stopped', reason: 'attempt_unavailable' };
        const value = await page.evaluate(directTssOperation, { operation, requestId, confirmationId, allowWrites: true });
        const result = bookingResult(value, job.requestBlocked);
        return finishJob(job, result);
      },
      authDiagnostics() { return { blocked: [...authBlocked.values()], trace: guard.authTrace?.() || [], ...(authenticationState ? { authentication: authenticationState } : {}),
        csp: [...cspViolations].map(([directive, count]) => ({ directive, count })),
        requestFailures: [...requestFailures].map(([code, count]) => ({ code, count })) }; },
      // Sanitized diagnostics are exposed only by the owned probe session.
      blockedRequests() { return [...blocked].map(([request, count]) => ({ request, count })); },
      async diagnostics() {
        if (!formProbe) {
          const work = page.evaluate(() => [...document.forms].slice(0, 10).map(form => {
            try { const url = new URL(form.action); return { method: form.method.toUpperCase(), hostname: url.hostname, pathname: url.pathname }; } catch { return null; }
          }).filter(Boolean)).then(value => { forms = value.map(safeBlockedRequest); }).catch(() => {});
          formProbe = work;
          work.finally(() => { if (formProbe === work) formProbe = null; });
        }
        return { blocked: [...blocked].map(([request, count]) => ({ request, count })), forms, ...(guard.diagnostics ? { guard: guard.diagnostics() } : {}) };
      },
      async close() {
        closing = true;
        authenticationValid = false; authenticatedName = undefined;
        completedDirectJobs.clear();
        activeJob = null;
        await browser.close();
      },
    };
  } catch (failure) {
    closing = true;
    try { await bounded(browser.close(), 2000, 'local_close_timeout'); } catch { /* Provider closure below. */ }
    await env.BROWSER.closeSession(id).catch(() => {});
    throw Object.assign(new Error('Managed browser unavailable'), { stage, browserId: id,
      ...(failure?.stage === 'renderer_preflight' ? { failureDiagnostic: failure.failureDiagnostic } : {}) });
  }
}
