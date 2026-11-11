export const BUILD_VERSION = 'probe-diagnostics-1';

// Classify internally; never return the original message, stack or properties.
export function failureDiagnostic(failure, source) {
  const name = ['Error', 'TypeError', 'ReferenceError', 'RangeError', 'SyntaxError', 'DOMException'].includes(failure?.name) ? failure.name : 'Error';
  const message = typeof failure?.message === 'string' ? failure.message : '';
  const code = /different request|I\/O on behalf/i.test(message) ? 'cross_request_io'
    : /execution context was destroyed|cannot find context|inspected target navigated/i.test(message) ? 'navigation_context'
    : /not a function|does not implement|no such method|method.*not found/i.test(message) ? 'method_unavailable'
    : failure?.status === 404 || failure?.statusCode === 404 || /\b(?:status|code|HTTP)\s*:?\s*404\b/i.test(message) ? 'provider_not_found'
    : /target closed|session closed|connection closed|disconnected/i.test(message) ? 'connection_closed'
    : /storage|sqlite|transaction/i.test(message) ? 'storage_error'
    : /quota|lease/i.test(message) ? 'quota_error'
    : /pending|closure/i.test(message) ? 'cleanup_pending'
    : 'unclassified';
  return { name, code, source };
}
