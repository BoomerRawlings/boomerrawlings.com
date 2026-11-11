import test from 'node:test';
import assert from 'node:assert/strict';
import { failureDiagnostic } from '../src/diagnostics.mjs';

test('failure diagnostics expose fixed classification only', () => {
  const error = new TypeError('binding.getSession is not a function; private data must never appear');
  assert.deepEqual(failureDiagnostic(error, 'provider_cleanup'), { name: 'TypeError', code: 'method_unavailable', source: 'provider_cleanup' });
  assert.equal(failureDiagnostic(Error('Cannot perform I/O on behalf of a different request'), 'authentication').code, 'cross_request_io');
  assert.equal(failureDiagnostic(Error('HTTP 404 private value'), 'provider_cleanup').code, 'provider_not_found');
  assert.equal(failureDiagnostic(Error('BrowserBindingError: Session not found (status=404)'), 'provider_cleanup').code, 'provider_not_found');
  assert.equal(failureDiagnostic(Error('arbitrary private data'), 'session_fetch').code, 'unclassified');
});
