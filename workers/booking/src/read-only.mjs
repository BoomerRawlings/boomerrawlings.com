const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MAX_BATCH_BYTES = 512 * 1024;
const MAX_AUTH_BYTES = 64 * 1024;
const TSS_ORIGIN = 'https://tss.ucsd.edu';
const SERVICE_ROOT = '/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/';
const noOverrides = headers => !headers.has('transfer-encoding') && !headers.has('x-http-method') && !headers.has('x-http-method-override');
const contentTypeIs = (value, type) => new RegExp('^' + type + '(?:;|$)', 'i').test(value || '');

function parseHeaders(block) {
  const headers = new Map();
  if (!block) return headers;
  for (const line of block.split('\r\n')) {
    const match = /^([!#$%&'*+.^_`|~0-9A-Za-z-]+):[ \t]*([^\r\n]*)$/.exec(line);
    if (!match || headers.has(match[1].toLowerCase())) return null;
    headers.set(match[1].toLowerCase(), match[2].trim());
  }
  return headers;
}

function harmlessTarget(target) {
  try {
    const url = new URL(target, 'https://tss.ucsd.edu/sap/opu/odata/');
    return url.origin === 'https://tss.ucsd.edu' && !url.username && !url.password
      && !/ActionHdrSet|\$batch|\$method/i.test(decodeURIComponent(url.pathname + url.search));
  } catch { return false; }
}

function multipart(contentType, body) {
  if (typeof body !== 'string' || body.length > MAX_BATCH_BYTES || !body.length) return false;
  const type = /^multipart\/mixed;\s*boundary=(?:"([A-Za-z0-9_'()+,./:=?-]{1,70})"|([A-Za-z0-9_'()+,./:=?-]{1,70}))\s*$/i.exec(contentType || '');
  if (!type || /(?<!\r)\n|\r(?!\n)/.test(body)) return false;
  const segments = body.split('--' + (type[1] || type[2]));
  if (segments.length < 3 || segments.length > 102 || segments[0].trim()
      || !/^--\r\n?$|^--$/.test(segments.at(-1))) return false;
  const parts = [];
  for (const raw of segments.slice(1, -1)) {
    if (!raw.startsWith('\r\n') || !raw.endsWith('\r\n')) return false;
    const part = raw.slice(2, -2);
    const split = part.indexOf('\r\n\r\n');
    if (split < 0) return false;
    const headers = parseHeaders(part.slice(0, split));
    if (!headers || [...headers.keys()].some(key => !['content-type', 'content-transfer-encoding', 'content-id'].includes(key))
      || (headers.has('content-transfer-encoding') && headers.get('content-transfer-encoding').toLowerCase() !== 'binary')) return false;
    parts.push({ headers, body: part.slice(split + 4) });
  }
  return parts;
}

function httpPart(part) {
  if (part.headers.get('content-type')?.toLowerCase() !== 'application/http') return null;
  const end = part.body.indexOf('\r\n');
  if (end < 0) return null;
  const line = /^(GET|HEAD|OPTIONS|POST) ([^\s]+) HTTP\/1\.[01]$/.exec(part.body.slice(0, end));
  if (!line) return null;
  const remaining = part.body.slice(end + 2), separator = remaining.indexOf('\r\n\r\n');
  let headerText, body;
  if (remaining.startsWith('\r\n')) { headerText = ''; body = remaining.slice(2); }
  else if (separator >= 0) { headerText = remaining.slice(0, separator); body = remaining.slice(separator + 4); }
  else {
    // Some UI5 serializers share the final header CRLF with MIME framing.
    // This form may only represent a bodyless read, never a write.
    if (!READ_METHODS.has(line[1]) || (remaining && !remaining.endsWith('\r\n'))) return null;
    headerText = remaining.replace(/\r\n$/, ''); body = '';
  }
  const headers = parseHeaders(headerText);
  if (!headers || !noOverrides(headers)) return null;
  if (headers.has('content-length') && (!/^\d+$/.test(headers.get('content-length'))
    || Number(headers.get('content-length')) !== new TextEncoder().encode(body).length)) return null;
  return { method: line[1], target: line[2], headers, body };
}

// Only bodyless application/http reads. Changesets and extra bodies fail closed.
export function isReadOnlyBatch(contentType, body) {
  const parts = multipart(contentType, body);
  if (!parts || !parts.length) return false;
  for (const part of parts) {
    const request = httpPart(part);
    if (!request || !READ_METHODS.has(request.method) || request.body !== '' || !harmlessTarget(request.target)) return false;
  }
  return true;
}

function assertionForm(body, requiredKey) {
  if (typeof body !== 'string' || body.length > MAX_BATCH_BYTES) return false;
  const form = new URLSearchParams(body);
  return form.getAll(requiredKey).length === 1 && Boolean(form.get(requiredKey)) && form.getAll('RelayState').length <= 1
    && [...form.keys()].every(key => key === requiredKey || key === 'RelayState');
}

export function allowProbeRequest({ url, method, headers = {}, body, resourceType }) {
  let target;
  try { target = new URL(url); } catch { return false; }
  if (!['http:', 'https:', 'data:', 'blob:', 'about:'].includes(target.protocol)) return false;
  if (target.protocol !== 'https:' && target.hostname) return false;
  const host = target.hostname;
  if (host && !['ucsd.edu', 'duosecurity.com'].some(domain => host === domain || host.endsWith('.' + domain))) return false;
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  if (lower['x-http-method'] || lower['x-http-method-override'] || target.username || target.password) return false;
  let path;
  try { path = decodeURIComponent(target.pathname); } catch { return false; }
  if (/ActionHdrSet/i.test(path)) return false;
  if (READ_METHODS.has(method)) return true;
  if (host === 'tss.ucsd.edu' && method === 'POST' && /\/sap\/opu\/odata\/.*\/\$batch\/?$/i.test(path)) {
    return isReadOnlyBatch(lower['content-type'], body);
  }
  // Observed UCSD login and this UCSD Duo tenant only. Never inspect form values.
  const boundedAuthBody = typeof body === 'string' && body.length > 0 && body.length <= MAX_AUTH_BYTES
    && new TextEncoder().encode(body).length <= MAX_AUTH_BYTES;
  const resource = resourceType?.toLowerCase();
  const formEncoded = contentTypeIs(lower['content-type'], 'application/x-www-form-urlencoded');
  if (method === 'POST' && boundedAuthBody && !target.hash) {
    if (target.origin === 'https://a5.ucsd.edu' && path === '/tritON/profile/SAML2/Redirect/SSO'
      && /^\?execution=e\d+s\d+$/.test(target.search) && resource === 'document' && formEncoded) return true;
    if (target.origin === 'https://api-ce13a1a7.duosecurity.com' && /^\/(?:prompt|frame)\//.test(path)
      && !/(?:^|\/)\.\.?(?:\/|$)|\\|%/.test(path)
      && ['document', 'xhr', 'fetch'].includes(resource)
      && (formEncoded || contentTypeIs(lower['content-type'], 'application/json'))) return true;
  }
  // Other observed SAML handoffs. New login/Duo POST paths require evidence.
  if (method === 'POST' && resourceType?.toLowerCase() === 'document'
    && contentTypeIs(lower['content-type'], 'application/x-www-form-urlencoded') && !target.search && !target.hash) {
    // Observed final auth POST; SAP also authenticates at the protected resource.
    if (target.origin === TSS_ORIGIN && path === '/fiori') return assertionForm(body, 'SAMLResponse');
    if (target.origin === TSS_ORIGIN && /^\/sap\/public\/bc\/sec\/saml2\/sp\/acs\/?$/i.test(path)) return assertionForm(body, 'SAMLResponse');
    if (target.origin === TSS_ORIGIN && /^\/sap\/saml2\/sp\/acs\/\d{3}\/?$/.test(path)) return assertionForm(body, 'SAMLResponse');
    if (target.origin === 'https://tssproxy.ucsd.edu' && path === '/idp/profile/SAML2/POST/SSO') return assertionForm(body, 'SAMLRequest');
    if (target.origin === 'https://tssproxy.ucsd.edu' && path === '/idp/profile/Authn/SAML2/POST/SSO') return assertionForm(body, 'SAMLResponse');
  }
  return false;
}

export function authorizeNativeWrite(request, job) {
  if (!job || request.method !== 'POST') return false;
  let url;
  try { url = new URL(request.url); } catch { return false; }
  if (url.origin !== TSS_ORIGIN || url.username || url.password || url.search || url.hash) return false;
  const headers = new Map(Object.entries(request.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
  if (!noOverrides(headers) || typeof request.body !== 'string' || request.body.length > MAX_BATCH_BYTES) return false;
  let body = request.body;
  if (url.pathname === SERVICE_ROOT + '$batch') {
    const outer = multipart(headers.get('content-type'), body);
    if (!outer || outer.length !== 1 || outer[0].headers.size !== 1) return false;
    const changes = multipart(outer[0].headers.get('content-type'), outer[0].body);
    if (!changes || changes.length !== 1) return false;
    const inner = httpPart(changes[0]);
    if (!inner || inner.method !== 'POST' || !contentTypeIs(inner.headers.get('content-type'), 'application/json')) return false;
    let destination;
    try { destination = new URL(inner.target, TSS_ORIGIN + SERVICE_ROOT); } catch { return false; }
    if (destination.origin !== TSS_ORIGIN || destination.pathname !== SERVICE_ROOT + 'ActionHdrSet'
      || destination.search || destination.hash || destination.username || destination.password) return false;
    body = inner.body;
  } else if (url.pathname !== SERVICE_ROOT + 'ActionHdrSet' || !contentTypeIs(headers.get('content-type'), 'application/json')) return false;
  let payload;
  try { payload = JSON.parse(body); } catch { return false; }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const fields = ['ModuleId', 'ActionName', 'ProgramId', 'Items', 'AssignedCg', 'AssignedCgTop', 'TemplateId', 'EventPackId', 'ModregId', 'AcademicYear', 'AcademicSession', 'Credits', 'CreditUnit'];
  if (Object.keys(payload).some(key => !fields.includes(key)) || (payload.ModregId && payload.ModregId !== '00000000-0000-0000-0000-000000000000')) return false;
  const number = value => /^\d+$/.test(String(value)) ? String(value).replace(/^0+(?=\d)/, '') : null;
  if (number(payload.ModuleId) !== number(job.moduleId) || number(payload.EventPackId) !== number(job.packageId)
      || number(payload.AcademicYear) !== '2026' || number(payload.AcademicSession) !== '3') return false;
  if (!Array.isArray(payload.Items) || !payload.Items.length || payload.Items.length > 30) return false;
  const eventIds = new Set();
  for (const item of payload.Items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some(key => !['EventId', 'ModuleId', 'EventPackId', 'AcademicYear', 'AcademicSession'].includes(key))
      || !number(item.EventId) || number(item.EventId) === '0' || eventIds.has(number(item.EventId))
      || number(item.ModuleId) !== number(job.moduleId) || number(item.EventPackId) !== number(job.packageId)
      || number(item.AcademicYear) !== '2026' || number(item.AcademicSession) !== '3') return false;
    eventIds.add(number(item.EventId));
  }
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const fingerprint = JSON.stringify(canonical({ ...payload, ActionName: 'SaveChanges' }));
  if (job.phase === 'check' && payload.ActionName === 'CheckRegistration') { job.phase = 'save'; job.writeFingerprint = fingerprint; return true; }
  if (job.phase === 'save' && payload.ActionName === 'SaveChanges' && job.writeFingerprint === fingerprint) {
    job.phase = 'complete'; delete job.writeFingerprint; return true;
  }
  return false;
}

export async function installReadOnlyGuard(page, { getJob = () => null, onBlocked = () => {} } = {}) {
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  page.on('request', async request => {
    try {
      if (request.isInterceptResolutionHandled()) return;
      const body = request.postData();
      const description = { url: request.url(), method: request.method(), headers: request.headers(), body, resourceType: request.resourceType() };
      const allowed = allowProbeRequest(description) || authorizeNativeWrite(description, getJob());
      if (allowed) await request.continue();
      else {
        const url = new URL(request.url());
        // Internal aggregate only; never query strings, request data or tokens.
        onBlocked({ hostname: url.hostname, pathname: url.pathname, method: request.method() });
        await request.abort('blockedbyclient');
      }
    } catch {
      try { if (!request.isInterceptResolutionHandled()) await request.abort('blockedbyclient'); } catch { /* Closed page. */ }
    }
  });
}

