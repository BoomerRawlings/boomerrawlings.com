import { AUTHENTICATION_PAGES } from './authentication.mjs';

export const AUTH_TRACE_KINDS = Object.freeze(['document_response', 'policy_block', 'upstream_failure', 'guard_failure', 'auth_page']);
export const AUTH_TRACE_DESTINATIONS = Object.freeze(['ucsd_idp', 'tss_proxy', 'tss', 'duo', 'ucsd_other', 'loopback_device', 'other']);
export const AUTH_TRACE_RESOURCES = Object.freeze(['Document', 'XHR', 'Fetch', 'Script', 'Stylesheet', 'Image', 'Font', 'Other']);
export const AUTH_TRACE_UPSTREAM_REASONS = Object.freeze(['Failed', 'Aborted', 'TimedOut', 'AccessDenied', 'ConnectionClosed', 'ConnectionReset',
  'ConnectionRefused', 'ConnectionAborted', 'ConnectionFailed', 'NameNotResolved', 'InternetDisconnected', 'AddressUnreachable', 'BlockedByClient', 'BlockedByResponse', 'Other']);
export const AUTH_TRACE_PHASES = Object.freeze(['request', 'response_abort', 'response_body', 'response_fulfill', 'request_continue', 'request_block', 'failure_abort']);
export const AUTH_TRACE_GUARD_ISSUES = Object.freeze(['timeout', 'session_closed', 'body_too_large', 'protocol_error']);
export const AUTH_TRACE_METHODS = Object.freeze(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'OTHER']);
export const AUTH_TRACE_ROUTES = Object.freeze(['proxy_saml_request', 'proxy_saml_response', 'ucsd_saml_redirect', 'tss_fiori', 'tss_saml_acs', 'other']);

export function authTraceRoute(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return 'other';
    const routes = {
      'https://tssproxy.ucsd.edu/idp/profile/SAML2/POST/SSO': 'proxy_saml_request',
      'https://tssproxy.ucsd.edu/idp/profile/Authn/SAML2/POST/SSO': 'proxy_saml_response',
      'https://a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO': 'ucsd_saml_redirect',
      'https://tss.ucsd.edu/fiori': 'tss_fiori',
      'https://tss.ucsd.edu/sap/public/bc/sec/saml2/sp/acs': 'tss_saml_acs',
      'https://tss.ucsd.edu/sap/saml2/sp/acs/100': 'tss_saml_acs',
    };
    return routes[url.origin + url.pathname] || 'other';
  } catch { return 'other'; }
}

export function authTraceDestination(value) {
  try {
    const { hostname } = new URL(value);
    if (hostname === 'a5.ucsd.edu') return 'ucsd_idp';
    if (hostname === 'tssproxy.ucsd.edu') return 'tss_proxy';
    if (hostname === 'tss.ucsd.edu') return 'tss';
    if (hostname === 'duosecurity.com' || hostname.endsWith('.duosecurity.com')) return 'duo';
    if (hostname === 'ucsd.edu' || hostname.endsWith('.ucsd.edu')) return 'ucsd_other';
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(hostname) || ['::1', '[::1]'].includes(hostname)) return 'loopback_device';
  } catch { /* Invalid destinations remain an opaque category. */ }
  return 'other';
}

export function authTraceGuardIssue(failure) {
  if (failure?.guardIssue === 'body_too_large') return 'body_too_large';
  const message = typeof failure?.message === 'string' ? failure.message : '';
  if (failure?.name === 'TimeoutError' || /timed out|timeout/i.test(message)) return 'timeout';
  if (/target closed|session closed|connection closed|disconnected|session with given id not found/i.test(message)) return 'session_closed';
  return 'protocol_error';
}

function eventFields(value) {
  if (!AUTH_TRACE_KINDS.includes(value?.kind)) return null;
  if (value.kind === 'auth_page') return AUTHENTICATION_PAGES.includes(value.page) ? { kind: value.kind, page: value.page } : null;
  if (!AUTH_TRACE_DESTINATIONS.includes(value.destination) || !AUTH_TRACE_RESOURCES.includes(value.resourceType)) return null;
  const base = { kind: value.kind, destination: value.destination, resourceType: value.resourceType };
  if (value.kind === 'document_response') return Number.isInteger(value.status) && value.status >= 100 && value.status <= 599
    && value.resourceType === 'Document' ? { ...base, status: value.status,
      ...(AUTH_TRACE_METHODS.includes(value.method) ? { method: value.method } : {}),
      ...(AUTH_TRACE_ROUTES.includes(value.route) ? { route: value.route } : {}) } : null;
  if (value.kind === 'upstream_failure') return AUTH_TRACE_UPSTREAM_REASONS.includes(value.reason) ? { ...base, reason: value.reason } : null;
  if (value.kind === 'guard_failure') return AUTH_TRACE_PHASES.includes(value.phase) && AUTH_TRACE_GUARD_ISSUES.includes(value.issue)
    ? { ...base, phase: value.phase, issue: value.issue } : null;
  return base;
}

// Also used at the owned API/UI boundary. No original event properties survive.
export function sanitizeAuthTrace(value) {
  if (!Array.isArray(value)) return [];
  let previous = 0;
  return value.slice(-40).flatMap(item => {
    const fields = eventFields(item);
    if (!fields || !Number.isInteger(item.atMs) || item.atMs < previous || item.atMs < 0 || item.atMs > 900000
      || !Number.isInteger(item.count) || item.count < 1 || item.count > 1000) return [];
    previous = item.atMs;
    return [{ ...fields, atMs: item.atMs, count: item.count }];
  });
}

export function createAuthTrace(now = Date.now) {
  const started = now(), entries = [];
  let lastTime = 0, lastPage, lastKey;
  const record = value => {
    const fields = eventFields(value);
    if (!fields) return;
    const elapsed = now() - started;
    lastTime = Math.min(900000, Math.max(lastTime, Number.isFinite(elapsed) ? Math.floor(elapsed / 100) * 100 : lastTime));
    const key = JSON.stringify(fields), previous = entries.at(-1);
    if (previous && key === lastKey) { previous.count = Math.min(1000, previous.count + 1); previous.atMs = lastTime; return; }
    entries.push({ ...fields, atMs: lastTime, count: 1 });
    if (entries.length > 40) entries.shift();
    lastKey = key;
  };
  return { record,
    addAuthPage(page) { if (!AUTHENTICATION_PAGES.includes(page) || page === lastPage) return; lastPage = page; record({ kind: 'auth_page', page }); },
    snapshot() { return entries.map(item => ({ ...item })); },
  };
}
