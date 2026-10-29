import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { d1DailyLimit } from '../src/index.js';

const quota = kind => new Error(`Your account has exceeded D1's free tier daily row ${kind} limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.`);

test('D1 daily read/write exhaustion has bounded UTC reset; unrelated errors do not', () => {
  for (const kind of ['read', 'write']) {
    assert.deepEqual(d1DailyLimit(new Error('D1 query failed', { cause: quota(kind) }), new Date('2026-10-29T23:59:59.900Z')), { retry_at: '2026-10-30T00:00:00.000Z', retry_after: 1 });
    assert.equal(d1DailyLimit(quota(kind), new Date('2026-10-29T00:00:00Z')).retry_after, 86400);
  }
  for (const message of ['SQLITE_ERROR: secret query', 'D1_ERROR: storage limit exceeded', 'daily row read limit exceeded']) assert.equal(d1DailyLimit(new Error(message)), null);
  const cyclic = new Error('D1 error'); cyclic.cause = cyclic; assert.equal(d1DailyLimit(cyclic), null);
});

test('quota responses expose retry time without SQL/source details; unknown failures remain generic', async () => {
  for (const [error, expected] of [[new Error('SELECT private details', { cause: quota('read') }), 503], [new Error('SELECT private details'), 500]]) {
    const env = { DB: { prepare() { throw error; } } };
    const response = await worker.fetch(new Request('https://boomerrawlings.com/subs/api/v1/stats'), env);
    assert.equal(response.status, expected);
    const result = await response.json(); assert.doesNotMatch(JSON.stringify(result), /SELECT|private details/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    if (expected === 503) {
      assert.equal(result.error.code, 'provider_daily_limit');
      assert.match(result.error.retry_at, /T00:00:00.000Z$/);
      assert.ok(Number(response.headers.get('Retry-After')) >= 1 && Number(response.headers.get('Retry-After')) <= 86400);
    } else { assert.equal(result.error.code, 'internal_error'); assert.equal(response.headers.get('Retry-After'), null); }
  }
});
