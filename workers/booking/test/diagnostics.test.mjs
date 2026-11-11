import test from 'node:test';
import assert from 'node:assert/strict';
import { failureDiagnostic, safeBlockedRequest, safeAuthDiagnostics, preflightDiagnostic } from '../src/diagnostics.mjs';

test('failure diagnostics expose fixed classification only', () => {
  const error = new TypeError('binding.getSession is not a function; private data must never appear');
  assert.deepEqual(failureDiagnostic(error, 'provider_cleanup'), { name: 'TypeError', code: 'method_unavailable', source: 'provider_cleanup' });
  assert.equal(failureDiagnostic(Error('Cannot perform I/O on behalf of a different request'), 'authentication').code, 'cross_request_io');
  assert.equal(failureDiagnostic(Error('HTTP 404 private value'), 'provider_cleanup').code, 'provider_not_found');
  assert.equal(failureDiagnostic(Error('BrowserBindingError: Session not found (status=404)'), 'provider_cleanup').code, 'provider_not_found');
  assert.equal(failureDiagnostic(Error('arbitrary private data'), 'session_fetch').code, 'unclassified');
});

test('renderer failures expose fixed class and phase with no protocol text', () => {
  const detail = preflightDiagnostic(Error('Runtime.evaluate timed out private-token'), 'evaluate');
  assert.deepEqual(detail, { name: 'TimeoutError', code: 'renderer_timeout', source: 'renderer_preflight', phase: 'evaluate' });
  assert.deepEqual(safeAuthDiagnostics({ failureStage: 'renderer_preflight', lastFailure: detail }),
    { stage: 'renderer_preflight', code: 'renderer_timeout', phase: 'evaluate', blocked: [] });
  assert.equal(preflightDiagnostic(Error('Session closed private-token'), 'page_enable').code, 'connection_closed');
  assert.equal(preflightDiagnostic(Error('Unknown private-token'), 'private-phase').phase, 'attach');
  assert.equal(safeAuthDiagnostics({ failureStage: 'renderer_preflight', lastFailure: { code: 'renderer_protocol_error', phase: 'private-phase' } }).phase, undefined);
});

test('owned auth diagnostics redact opaque hosts and path values', () => {
  const opaque = 'private-student-token';
  assert.deepEqual(safeBlockedRequest({ method: 'POST', hostname: 'a5.ucsd.edu', pathname: '/tritON/profile/SAML2/Redirect/SSO/' + opaque }),
    { method: 'POST', hostname: 'a5.ucsd.edu', pathname: '/tritON/profile/SAML2/Redirect/SSO/[redacted]' });
  const safe = safeAuthDiagnostics({ failureStage: 'authentication', lastFailure: { code: 'connection_closed', message: opaque } },
    [{ method: opaque, hostname: opaque + '.ucsd.edu', pathname: '/prompt/' + opaque, count: 3 }]);
  assert.equal(safe.stage, 'authentication'); assert.equal(safe.code, 'connection_closed');
  assert.equal(safe.blocked[0].hostname, '[other-host]'); assert.equal(safe.blocked[0].method, 'OTHER');
  assert.equal(JSON.stringify(safe).includes(opaque), false);
  assert.deepEqual(safeAuthDiagnostics({ failureStage: opaque, lastFailure: { code: opaque } }), { blocked: [] });
});
