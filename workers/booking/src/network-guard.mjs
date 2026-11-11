import { allowProbeRequest, authorizeNativeWrite } from './read-only.mjs';
import { Buffer } from 'node:buffer';
import { createAuthTrace, authTraceDestination, authTraceGuardIssue, authTraceRoute, AUTH_TRACE_METHODS, AUTH_TRACE_UPSTREAM_REASONS } from './auth-trace.mjs';

// A response header, not an editable iframe attribute: popup/form targets are
// denied by Chromium before a second target can send its first request. Frames
// and workers remain disabled until a real SSO probe establishes a safe need.
export const DOCUMENT_POLICY = "sandbox allow-scripts allow-forms allow-same-origin allow-top-navigation-by-user-activation; frame-src 'none'; worker-src 'none'; object-src 'none'; connect-src https:";

export async function installNetworkGuard(page, { getJob = () => null, onBlocked = () => {}, now = Date.now } = {}) {
  await page.setBypassServiceWorker(true);
  await page.setCacheEnabled(false);
  const client = await page.createCDPSession();
  const trace = createAuthTrace(now);
  client.authTrace = trace.snapshot;
  client.recordAuthPage = trace.addAuthPage;
  const pending = new Set();
  let pendingCount = 0, lastCompleted, lastFailure;
  const age = at => Math.min(900_000, Math.max(0, now() - at));
  // Synchronous: remains available when the renderer or CDP command is stalled.
  // No URLs, request IDs, headers, bodies, raw errors or account values escape.
  client.diagnostics = () => ({
    pendingCount: Math.min(1000, pendingCount),
    pending: [...pending].map(item => ({ resourceType: item.resourceType, phase: item.phase, ageMs: age(item.at) })),
    ...(lastCompleted ? { lastCompleted: { phase: lastCompleted.phase, ageMs: age(lastCompleted.at) } } : {}),
    ...(lastFailure ? { lastFailure: { phase: lastFailure.phase, ageMs: age(lastFailure.at) } } : {}),
  });
  client.on('Fetch.requestPaused', async event => {
    const { requestId, request, resourceType } = event;
    const progress = { resourceType: ['Document', 'XHR', 'Fetch', 'Script', 'Stylesheet', 'Image', 'Font'].includes(resourceType) ? resourceType : 'Other', phase: 'request', at: now() };
    const destination = authTraceDestination(request.url);
    const traceEvent = value => trace.record({ destination, resourceType: progress.resourceType, ...value });
    pendingCount++;
    if (pending.size < 12) pending.add(progress);
    const send = (phase, method, args) => {
      progress.phase = phase; progress.at = now();
      return client.send(method, args);
    };
    let completed = false;
    try {
      if (event.responseErrorReason) {
        traceEvent({ kind: 'upstream_failure', reason: AUTH_TRACE_UPSTREAM_REASONS.includes(event.responseErrorReason) ? event.responseErrorReason : 'Other' });
        await send('response_abort', 'Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
        completed = true;
        return;
      }
      if (event.responseStatusCode !== undefined) {
        if (resourceType === 'Document') traceEvent({ kind: 'document_response', status: event.responseStatusCode,
          method: AUTH_TRACE_METHODS.includes(request.method) ? request.method : 'OTHER', route: authTraceRoute(request.url) });
        const redirect = [301, 302, 303, 307, 308].includes(event.responseStatusCode);
        const original = redirect ? null : await send('response_body', 'Fetch.getResponseBody', { requestId });
        if (original && original.body.length > 4 * 1024 * 1024) throw Object.assign(new Error('Document too large'), { guardIssue: 'body_too_large' });
        await send('response_fulfill', 'Fetch.fulfillRequest', {
          requestId, responseCode: event.responseStatusCode,
          ...(event.responseStatusText ? { responsePhrase: event.responseStatusText } : {}),
          responseHeaders: [...(event.responseHeaders || []).filter(header => !['content-length', 'content-encoding'].includes(header.name.toLowerCase())), { name: 'Content-Security-Policy', value: DOCUMENT_POLICY }],
          ...(original ? { body: original.base64Encoded ? original.body : Buffer.from(original.body).toString('base64') } : {}),
        });
        completed = true;
        return;
      }
      const description = { url: request.url, method: request.method, headers: request.headers,
        body: request.postData, resourceType: resourceType.toLowerCase() };
      if (allowProbeRequest(description) || authorizeNativeWrite(description, getJob())) {
        await send('request_continue', 'Fetch.continueRequest', { requestId, ...(resourceType === 'Document' ? { interceptResponse: true } : {}) });
      } else {
        traceEvent({ kind: 'policy_block' });
        const url = new URL(request.url);
        onBlocked({ hostname: url.hostname, pathname: url.pathname, method: request.method });
        await send('request_block', 'Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      }
      completed = true;
    } catch (failure) {
      // Unsupported response-header interception fails closed, never reloads a
      // document without the popup policy. No raw protocol errors are logged.
      lastFailure = { phase: progress.phase, at: now() };
      traceEvent({ kind: 'guard_failure', phase: progress.phase, issue: authTraceGuardIssue(failure) });
      await send('failure_abort', 'Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    } finally {
      if (completed) lastCompleted = { phase: progress.phase, at: now() };
      pending.delete(progress); pendingCount--;
    }
  });
  await client.send('Fetch.enable', { patterns: [
    { urlPattern: '*', requestStage: 'Request' },
    { urlPattern: '*', resourceType: 'Document', requestStage: 'Response' },
  ] });
  return client;
}
