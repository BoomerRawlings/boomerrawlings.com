import test from 'node:test';
import assert from 'node:assert/strict';
import { configurePresentation, presentation } from '../client/presentation.js';
import { createHandler } from '../handler.mjs';
import { createAuthConfig, MemoryAuthStore } from '../auth.mjs';

const fixture = () => ({ version: 1, subjectId: 'fictional-subject', subjectLabel: 'Fictional Person', forumAccountId: 'fixture.example:user:42', forumAccountToken: '42', forumProfileIdPrefix: 'fixture-user-', text: { text01: 'Synthetic private heading' } });

test('presentation settings remain immutable and clear when the private view suspends', () => {
  const input = fixture(); configurePresentation(input); input.text.text01 = 'changed';
  assert.equal(presentation.text.text01, 'Synthetic private heading');
  assert(Object.isFrozen(presentation)); assert(Object.isFrozen(presentation.text));
  configurePresentation(null); assert.equal(presentation.subjectId, ''); assert.deepEqual(presentation.text, {});
});

test('invalid presentation settings cannot configure the workspace', () => {
  for (const value of [{}, { ...fixture(), subjectId: '' }, { ...fixture(), text: { invalid: 'value' } }, { ...fixture(), text: [] }]) {
    assert.throws(() => configurePresentation(value), /unavailable/);
  }
});

test('presentation settings use the authenticated no-store boundary and logout revocation', async () => {
  const origin = 'https://presentation.test', reads = [];
  const handler = createHandler({ origin, authConfig: await createAuthConfig('synthetic-settings-test'), store: new MemoryAuthStore(), repository: {}, read: async name => { reads.push(name); return Response.json(fixture()); } });
  const request = (path, options = {}) => handler(new Request(`${origin}/ASSC/${path}`, options));
  for (const path of ['api/presentation', 'client/presentation.js', '.private/presentation.json', '_protected/private/presentation.json']) assert.equal((await request(path)).status, 401);
  assert.equal(reads.length, 0);
  const login = await request('login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'synthetic-settings-test' }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const response = await request('api/presentation', { headers: { Cookie: cookie } });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), fixture()); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(reads, ['.private/presentation.json']);
  for (const path of ['.private/presentation.json', '_protected/private/presentation.json']) assert.equal((await request(path, { headers: { Cookie: cookie } })).status, 404);
  await request('logout', { method: 'POST', headers: { Origin: origin, Cookie: cookie } });
  assert.equal((await request('api/presentation', { headers: { Cookie: cookie } })).status, 401);
});
