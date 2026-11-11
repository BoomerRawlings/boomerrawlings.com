import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { BOOKING_ROUTES } from '../src/routes.mjs';
import { directTssOperation } from '../src/direct-tss.mjs';

test('all twenty verified routes agree with the serialized direct reader allowlist', async () => {
  assert.equal(BOOKING_ROUTES.size, 20);
  for (const [route, { courseCode }] of BOOKING_ROUTES) {
    let reads = 0;
    const window = { location: { origin: 'https://tss.ucsd.edu' }, async fetch(url, init) {
      assert.equal(init.method, 'GET'); assert.equal(init.body, undefined); reads++;
      return { status: 401, ok: false };
    } };
    const operation = runInNewContext(`(${directTssOperation.toString()})`, { window, URL, crypto, AbortController, setTimeout, clearTimeout });
    const result = await operation({ operation: 'inspect', route, courseCode });
    assert.equal(result.reason, 'authentication_required', courseCode + ' must reach its authenticated read gate');
    assert.ok(reads > 0);
    const before = reads;
    assert.equal((await operation({ operation: 'inspect', route: route.replace('/2026/3/', '/2026/4/'), courseCode })).reason, 'route_mismatch');
    assert.equal(reads, before);
  }
});
