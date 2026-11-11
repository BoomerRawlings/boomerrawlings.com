export const AUTHENTICATION_PAGES = Object.freeze(['login_choice', 'credentials_ad', 'credentials_student', 'duo', 'ucsd_error', 'tss_proxy_error', 'tss_loading', 'tss', 'other']);
export const AUTHENTICATION_ISSUES = Object.freeze(['ucsd_login_exception', 'sso_handoff_failed', 'service_unavailable', 'network_error', 'request_timeout', 'missing_csrf', 'unexpected_response', 'authentication_required']);

export function safeAccountName(value) {
  if (typeof value !== 'string' || value.length > 100 || !/\p{L}/u.test(value) || /[^\p{L}\p{M} .'’\-]/u.test(value)) return undefined;
  return value.trim().replace(/ +/g, ' ') || undefined;
}

// Serialized into the owned browser. Return fixed classifications and an
// optional display name only after positive authentication. Never return
// credentials, cookies, tokens, account IDs, email, URLs or page contents.
export async function authenticationProbe({ requireShell = true } = {}) {
  const origin = window.location.origin;
  const answer = (status, page, issue) => ({ status, page, ...(issue ? { issue } : {}) });
  if (origin === 'https://a5.ucsd.edu') {
    const text = document.body?.innerText?.slice(0, 12000) || '';
    if (/Web Login Service\s*-\s*Uncaught Exception/i.test(text) && /java\.lang\.NullPointerException/.test(text)) {
      return answer('unauthenticated', 'ucsd_error', 'ucsd_login_exception');
    }
    return answer('unauthenticated', /Signing on using:\s*Student SSO/i.test(text) ? 'credentials_student'
      : /Signing on using:\s*Active Directory/i.test(text) ? 'credentials_ad' : 'other');
  }
  if (origin === 'https://tssproxy.ucsd.edu') {
    const text = document.body?.innerText?.slice(0, 12000) || '';
    if (/Post[\s-]+registration\s+notice|Thank\s+you\s+for\s+registering/i.test(text)) {
      return answer('unauthenticated', 'tss_proxy_error', 'sso_handoff_failed');
    }
    return answer('unauthenticated', 'login_choice');
  }
  if (window.location.protocol === 'https:' && (window.location.hostname === 'duosecurity.com' || window.location.hostname.endsWith('.duosecurity.com'))) {
    return answer('unauthenticated', 'duo');
  }
  if (origin !== 'https://tss.ucsd.edu' || !/^\/fiori\/?$/.test(window.location.pathname)) return answer('unauthenticated', 'other');
  if (requireShell) {
    try {
      const id = window.sap?.ushell?.Container?.getUser?.()?.getId?.();
      if (typeof id !== 'string' || !id.trim() || /^(anonymous|guest)$/i.test(id.trim()) || !document.querySelector('[data-sap-ui]')) {
        return answer('unavailable', 'tss_loading');
      }
    } catch { return answer('unavailable', 'tss_loading'); }
  }
  try {
    const response = await window.fetch('https://tss.ucsd.edu/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/', {
      method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { 'X-CSRF-Token': 'Fetch', Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
    });
    if ([401, 403].includes(response.status)) return answer('unauthenticated', 'tss', 'authentication_required');
    if (!response.ok) return answer('unavailable', 'tss', 'service_unavailable');
    if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) return answer('unavailable', 'tss', 'unexpected_response');
    const raw = await response.text();
    if (raw.length > 2_000_000) return answer('unavailable', 'tss', 'unexpected_response');
    let decoded;
    try { decoded = JSON.parse(raw); } catch { return answer('unavailable', 'tss', 'unexpected_response'); }
    if (!decoded?.d || typeof decoded.d !== 'object' || Array.isArray(decoded.d) || decoded.error) return answer('unavailable', 'tss', 'unexpected_response');
    const token = response.headers.get('x-csrf-token')?.trim();
    if (!token || token.length >= 4096 || /^(required|fetch)$/i.test(token)) return answer('unavailable', 'tss', 'missing_csrf');
    let displayName;
    try {
      const value = window.sap?.ushell?.Container?.getUser?.()?.getFullName?.();
      // Keep this self-contained serialized check aligned with safeAccountName.
      if (typeof value === 'string' && value.length <= 100 && /\p{L}/u.test(value) && !/[^\p{L}\p{M} .'’\-]/u.test(value)) {
        displayName = value.trim().replace(/ +/g, ' ') || undefined;
      }
    } catch { /* Missing shell metadata must not change successful auth. */ }
    return { ...answer('authenticated', 'tss'), ...(displayName ? { displayName } : {}) };
  } catch (failure) {
    return answer('unavailable', 'tss', ['TimeoutError', 'AbortError'].includes(failure?.name) ? 'request_timeout' : 'network_error');
  }
}
