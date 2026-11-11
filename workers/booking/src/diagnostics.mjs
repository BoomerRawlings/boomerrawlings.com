import { AUTHENTICATION_PAGES, AUTHENTICATION_ISSUES } from './authentication.mjs';
import { sanitizeAuthTrace, AUTH_TRACE_PHASES, AUTH_TRACE_RESOURCES } from './auth-trace.mjs';

export const BUILD_VERSION = 'auth-proof-5';

const authHosts = new Set(['tss.ucsd.edu', 'tssproxy.ucsd.edu', 'a5.ucsd.edu', 'api-ce13a1a7.duosecurity.com']);
const publicSegments = new Set(['fiori', 'sap', 'public', 'bc', 'sec', 'saml2', 'sp', 'acs', 'opu', 'odata', 'ITUS', 'PR_MY_MODULES_V2_SRV',
  'ited', 'bc_app_settings_srv', 'ParameterSet', 'ActionHdrSet', '$batch', 'idp', 'profile', 'Authn', 'SAML2', 'POST', 'SSO', 'tritON', 'Redirect', 'prompt', 'frame']);
export function safeBlockedRequest(value) {
  const method = ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(value?.method) ? value.method : 'OTHER';
  const hostname = authHosts.has(value?.hostname) ? value.hostname : '[other-host]';
  const pathname = typeof value?.pathname === 'string' ? value.pathname.split('/').slice(0, 14)
    .map(part => !part || publicSegments.has(part) ? part : '[redacted]').join('/') : '/[redacted]';
  return { method, hostname, pathname };
}

const directives = new Set(['connect-src', 'frame-src', 'child-src', 'worker-src', 'script-src', 'script-src-elem', 'script-src-attr', 'form-action', 'sandbox', 'default-src', 'frame-ancestors']);
const networkErrors = new Set(['ERR_ABORTED', 'ERR_FAILED', 'ERR_BLOCKED_BY_CLIENT', 'ERR_BLOCKED_BY_RESPONSE', 'ERR_CONNECTION_CLOSED',
  'ERR_CONNECTION_RESET', 'ERR_CONNECTION_REFUSED', 'ERR_CONNECTION_TIMED_OUT', 'ERR_TIMED_OUT', 'ERR_NAME_NOT_RESOLVED', 'ERR_CERT_AUTHORITY_INVALID',
  'ERR_CERT_DATE_INVALID', 'ERR_CERT_COMMON_NAME_INVALID', 'ERR_INTERNET_DISCONNECTED', 'OTHER']);
const preflightPhases = new Set(['attach', 'page_enable', 'evaluate']);
const authenticationPages = new Set(AUTHENTICATION_PAGES), authenticationIssues = new Set(AUTHENTICATION_ISSUES);
export function preflightDiagnostic(failure, phase) {
  const message = typeof failure?.message === 'string' ? failure.message : '';
  const code = failure?.stage === 'renderer_preflight_timeout' || failure?.name === 'TimeoutError' || /timed out|timeout/i.test(message) ? 'renderer_timeout'
    : failure?.preflightIssue === 'dom_not_ready' ? 'renderer_dom_not_ready'
    : /execution context was destroyed|cannot find context|inspected target navigated/i.test(message) ? 'navigation_context'
    : /target closed|session closed|connection closed|disconnected/i.test(message) ? 'connection_closed'
    : 'renderer_protocol_error';
  return { name: code === 'renderer_timeout' ? 'TimeoutError' : 'Error', code, source: 'renderer_preflight',
    phase: preflightPhases.has(phase) ? phase : 'attach' };
}
export const safeCspDirective = value => typeof value === 'string' && directives.has(value.split(/\s/)[0]) ? value.split(/\s/)[0] : undefined;
export const safeNetworkError = value => typeof value === 'string' && networkErrors.has(value.replace(/^net::/, '')) ? value.replace(/^net::/, '') : 'OTHER';
function safeGuardDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const phase = item => item && AUTH_TRACE_PHASES.includes(item.phase) && Number.isFinite(item.ageMs) && item.ageMs >= 0 && item.ageMs <= 900000
    ? { phase: item.phase, ageMs: item.ageMs } : null;
  const pending = (Array.isArray(value.pending) ? value.pending : []).slice(0,12).flatMap(item => {
    const safe = phase(item); return safe && AUTH_TRACE_RESOURCES.includes(item.resourceType) ? [{ resourceType: item.resourceType, ...safe }] : [];
  });
  return { ...(Number.isInteger(value.pendingCount) && value.pendingCount >= 0 && value.pendingCount <= 1000 ? { pendingCount: value.pendingCount } : {}),
    pending, ...(phase(value.lastCompleted) ? { lastCompleted: phase(value.lastCompleted) } : {}),
    ...(phase(value.lastFailure) ? { lastFailure: phase(value.lastFailure) } : {}) };
}
export function safeAuthDiagnostics(record, diagnostics = []) {
  const blocked = Array.isArray(diagnostics) ? diagnostics : diagnostics?.blocked || [];
  const stages = new Set(['launch', 'page', 'guard', 'navigation', 'renderer_preflight', 'live_view', 'authentication', 'controller_disconnect',
    'object_restart', 'runtime_io_context', 'status', 'status_timeout', 'cleanup_lookup', 'cleanup_pending', 'quota_service', 'quota_release',
    'quota_concurrency', 'quota_budget', 'quota_cleanup', 'initialization', 'session_operation']);
  const codes = new Set(['cross_request_io', 'navigation_context', 'method_unavailable', 'provider_not_found', 'connection_closed',
    'storage_error', 'quota_error', 'cleanup_pending', 'unclassified', 'read_timeout', 'renderer_timeout', 'renderer_dom_not_ready', 'renderer_protocol_error', 'authentication_unavailable']);
  const authentication = diagnostics?.authentication;
  const trace = sanitizeAuthTrace(diagnostics?.trace);
  const guard = safeGuardDiagnostics(diagnostics?.guard);
  return { ...(stages.has(record.failureStage) ? { stage: record.failureStage } : {}),
    ...(trace.length ? { trace } : {}),
    ...(guard ? { guard } : {}),
    ...(['responsive', 'timeout', 'unavailable'].includes(diagnostics?.targetProbe) ? { targetProbe: diagnostics.targetProbe } : {}),
    ...(codes.has(record.lastFailure?.code) ? { code: record.lastFailure.code } : {}),
    ...(record.failureStage === 'renderer_preflight' && preflightPhases.has(record.lastFailure?.phase) ? { phase: record.lastFailure.phase } : {}),
    ...(authenticationPages.has(authentication?.page) ? { authentication: { page: authentication.page,
      ...(authenticationIssues.has(authentication.issue) ? { issue: authentication.issue } : {}) } } : {}),
    blocked: blocked.slice(0, 30).map(value => ({ ...safeBlockedRequest(value), count: Math.min(1000, Math.max(1, Number(value.count) || 1)) })),
    ...(Array.isArray(diagnostics?.csp) ? { csp: diagnostics.csp.filter(value => directives.has(value.directive)).slice(0, 12)
      .map(value => ({ directive: value.directive, count: Math.min(1000, Math.max(1, Number(value.count) || 1)) })) } : {}),
    ...(Array.isArray(diagnostics?.requestFailures) ? { requestFailures: diagnostics.requestFailures.filter(value => networkErrors.has(value.code)).slice(0, 16)
      .map(value => ({ code: value.code, count: Math.min(1000, Math.max(1, Number(value.count) || 1)) })) } : {}) };
}

// Classify internally; never return the original message, stack or properties.
export function failureDiagnostic(failure, source) {
  const name = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'DOMException'].includes(failure?.name) ? failure.name : 'Error';
  const message = typeof failure?.message === 'string' ? failure.message : '';
  const code = /different request|I\/O on behalf/i.test(message) ? 'cross_request_io'
    : /execution context was destroyed|cannot find context|inspected target navigated/i.test(message) ? 'navigation_context'
    : /not a function|does not implement|no such method|method.*not found/i.test(message) ? 'method_unavailable'
    : failure?.status === 404 || failure?.statusCode === 404 || /\b(?:status|code|HTTP)\s*[:=]?\s*404\b/i.test(message) ? 'provider_not_found'
    : /target closed|session closed|connection closed|disconnected/i.test(message) ? 'connection_closed'
    : /storage|sqlite|transaction/i.test(message) ? 'storage_error'
    : /quota|lease/i.test(message) ? 'quota_error'
    : /pending|closure/i.test(message) ? 'cleanup_pending'
    : 'unclassified';
  return { name, code, source };
}
