import test from 'node:test';
import assert from 'node:assert/strict';
import { closeProviderSession, providerSessionExists } from '../src/provider-lifecycle.mjs';

test('already-closed provider session is verified independently of close errors', async () => {
  let lookups = 0;
  await closeProviderSession({ closeSession: async () => { throw Error('HTTP 404'); },
    getSession: async () => { lookups++; return null; } }, 'synthetic', { closeLocal: async () => { throw Error('Target closed'); } });
  assert.equal(lookups, 1);
});
test('provider closing status is polled until absence, then accepted', async () => {
  let lookups = 0, waits = 0;
  await closeProviderSession({ closeSession: async () => ({ status: 'closing' }),
    getSession: async () => ++lookups < 3 ? { sessionId: 'synthetic' } : null }, 'synthetic', { sleep: async () => { waits++; } });
  assert.equal(lookups, 3); assert.equal(waits, 2);
});
test('unknown lookup errors or persistent active status cannot release a lease', async () => {
  await assert.rejects(closeProviderSession({ closeSession: async () => ({}), getSession: async () => { throw Error('private failure detail'); } }, 'synthetic'),
    error => error.stage === 'cleanup_lookup' && !error.message.includes('private'));
  await assert.rejects(closeProviderSession({ closeSession: async () => ({}), getSession: async () => ({ sessionId: 'synthetic' }) }, 'synthetic', { sleep: async () => {} }),
    error => error.stage === 'cleanup_pending');
});

test('real BrowserRunSession ended history proves closure; disconnected live session does not', async () => {
  const get = value => ({ getSession: async () => value });
  assert.equal(await providerSessionExists(get({ sessionId: 'synthetic', startTime: 100, endTime: 200, closeReason: 1 }), 'synthetic'), false);
  assert.equal(await providerSessionExists(get({ sessionId: 'synthetic', startTime: 100, connectionEndTime: 200 }), 'synthetic'), true);
  assert.equal(await providerSessionExists(get({ sessionId: 'synthetic', endTime: 0 }), 'synthetic'), true);
  for (const value of [{ status: 'closed' }, { sessionId: 'different', endTime: 200 }, { sessionId: 'synthetic', endTime: '200' },
    { sessionId: 'synthetic', endTime: NaN }, { sessionId: 'synthetic', endTime: Infinity }, { sessionId: 'synthetic', endTime: -1 }]) {
    await assert.rejects(providerSessionExists(get(value), 'synthetic'), error => error.stage === 'cleanup_lookup');
  }
});

test('provider close accepts verified ended metadata without waiting for history disappearance', async () => {
  let waits = 0;
  await closeProviderSession({ closeSession: async () => ({ status: 'closed' }),
    getSession: async () => ({ sessionId: 'synthetic', startTime: 100, endTime: 200 }) }, 'synthetic', { sleep: async () => { waits++; } });
  assert.equal(waits, 0);
});
test('structured/not-found lookups prove absence; undefined responses do not', async () => {
  assert.equal(await providerSessionExists({ getSession: async () => { throw Object.assign(Error('not found'), { status: 404 }); } }, 'synthetic'), false);
  await assert.rejects(providerSessionExists({ getSession: async () => undefined }, 'synthetic'), error => error.stage === 'cleanup_lookup');
});
