import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../handler.mjs';
import { MemoryAuthStore, createAuthConfig, configuredAuth, normalizeRiddleAnswer, validPassword, RIDDLE_NORMALIZATION, COOKIE_NAME } from '../auth.mjs';
import { configuredCatalog } from '../catalog.mjs';

const origin = 'https://boomerrawlings.com';
const password = 'Testing-only-observatory-password';
const authConfig = await createAuthConfig(password);
const catalog = { destinations: [{ id: 'fixture', title: 'Private fixture title', kicker: 'A fictional doorway', description: 'Synthetic test directory content.', href: '/fictional-room/#mode=sample&view=map', accent: '#aabbcc' }] };
const files = {
  'client/gate.html': 'gate only', 'client/gate.css': 'gate style', 'client/gate.js': 'gate script', 'client/arrival.js': 'public arrival bootstrap',
  'client/theme.css': 'public theme', 'client/font-source-sans.woff2': 'public font', 'client/font-teko.woff2': 'public font',
  'client/app.html': 'protected shell', 'client/app.css': 'protected style', 'client/app.js': 'protected script', 'client/departure.js': 'protected departure',
  'client/symbols.js': 'protected symbols', 'client/symbols.css': 'protected symbol styles'
};
function fixture(options = {}) {
  const reads = [];
  const store = options.store || new MemoryAuthStore();
  const handle = createHandler({
    read: async name => { reads.push(name); return new Response(files[name] || 'Not found', { status: name in files ? 200 : 404, headers: { ETag: 'fixture', 'Cache-Control': 'public,max-age=9999' } }); },
    store, authConfig, catalog, origin, clientAddress: req => req.headers.get('x-test-ip') || 'local', ...options
  });
  const call = (path = '', options = {}) => handle(new Request(`${origin}/observatory/${path}`, options));
  const login = (value = password, headers = {}) => call('api/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ password: value }) });
  return { call, handle, login, store, reads };
}
const cookie = response => response.headers.get('set-cookie')?.split(';')[0];

test('riddle answers use one explicit normalization without guessing punctuation or internal spaces', async () => {
  const config = await createAuthConfig(' Fixtureword ', { mode: 'riddle' });
  assert.equal(config.version, 2);
  assert.equal(config.normalization, RIDDLE_NORMALIZATION);
  assert.deepEqual(configuredAuth(JSON.stringify(config)), config);
  assert.equal(JSON.stringify(config).includes('fixtureword'), false);
  for (const answer of ['fixtureword', 'FIXTUREWORD', ' \tFixtureWord\n', '\uff26\uff29\uff38\uff34\uff35\uff32\uff25\uff37\uff2f\uff32\uff24']) {
    assert.equal(normalizeRiddleAnswer(answer), 'fixtureword');
    const f = fixture({ authConfig: config });
    const response = await f.login(answer);
    assert.equal(response.status, 200);
    assert.equal((await f.call('api/catalog', { headers: { Cookie: cookie(response) } })).status, 200);
  }
  for (const answer of ['fixturewords', 'fixture word', 'fixture-word', 'fixtureword!', 'fixtureword1', 'f\u00edxtureword', 'fixture\u200bword', '', 'x'.repeat(129), null]) {
    assert.equal((await fixture({ authConfig: config }).login(answer)).status, 401);
  }
  for (const answer of ['ab', 'x'.repeat(41), 'two words', 'word!', '\u03bb\u03ad\u03be\u03b7']) {
    await assert.rejects(createAuthConfig(answer, { mode: 'riddle' }), /one answer/);
  }
});

test('riddle verifier format is explicit and legacy exact verifiers do not acquire normalization', async () => {
  const config = await createAuthConfig('fixtureword', { mode: 'riddle' });
  for (const invalid of [
    { ...config, normalization: undefined }, { ...config, normalization: 'guess-anything' },
    { ...config, version: 3 }, { ...config, salt: [] }, { ...config, verifier: 'a'.repeat(63) }
  ]) {
    assert.equal(configuredAuth(JSON.stringify(invalid)), null);
  }
  assert.equal(await validPassword('fixtureword', { ...config, normalization: 'guess-anything' }), false);
  assert.equal(await validPassword(password, authConfig), true);
  assert.equal(await validPassword(` ${password} `, authConfig), false);
  assert.equal(await validPassword(password.toLowerCase(), authConfig), false);
  await assert.rejects(createAuthConfig('fixtureword', { mode: 'unknown' }), /Unknown/);
});

test('short riddle answers retain the same persistent-style attempt budget before verification', async () => {
  const config = await createAuthConfig('fixtureword', { mode: 'riddle' });
  const f = fixture({ authConfig: config });
  for (const answer of ['wrong', 'WRONG', ' wrong ', 'wrong!', 'two words']) assert.equal((await f.login(answer)).status, 401);
  const response = await f.login('FIXTUREWORD');
  assert.equal(response.status, 429);
  assert.equal(cookie(response), undefined);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
});

test('unauthenticated page and direct requests disclose no private application or directory', async () => {
  const f = fixture();
  assert.equal(await (await f.call()).text(), 'gate only');
  for (const path of ['app.html', 'app.css', 'app.js', 'departure.js', 'symbols.js', 'symbols.css', 'api/catalog', 'api/session', 'client/app.js', '.private/catalog.json', '.private/auth.json', '_protected/client/app.html', 'worker.mjs', 'gate.js.map']) {
    const response = await f.call(path);
    assert.equal(response.status, 401, path);
    assert.doesNotMatch(await response.text(), /protected|Private fixture|fictional-room|Synthetic/);
  }
  assert.deepEqual(f.reads, ['client/gate.html']);
  for (const path of ['gate.js', 'gate.css', 'arrival.js', 'theme.css', 'font-source-sans.woff2', 'font-teko.woff2']) assert.equal((await f.call(path)).status, 200);
});

test('password is case-sensitive and exact; cookie is random, scoped, Secure and HttpOnly', async () => {
  const f = fixture();
  for (const wrong of ['wrong', password.toUpperCase(), ` ${password}`]) {
    const response = await f.login(wrong);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  const response = await f.login();
  assert.equal(response.status, 200);
  const set = response.headers.get('set-cookie');
  assert.match(set, /^observatory_session=[a-f0-9]{64};/);
  assert.match(set, /Path=\/observatory\/;/);
  assert.match(set, /HttpOnly; SameSite=Strict; Max-Age=28800; Secure$/);
  assert.doesNotMatch(set, /Testing|password/);
  const headers = { Cookie: cookie(response) };
  assert.equal(await (await f.call('', { headers })).text(), 'protected shell');
  assert.deepEqual(await (await f.call('api/catalog', { headers })).json(), catalog);
  for (const path of ['app.html', 'app.css', 'app.js', 'departure.js', 'symbols.js', 'symbols.css']) assert.equal((await f.call(path, { headers })).status, 200);
});

test('login rotates prior sessions; logout and expiry invalidate copied tokens', async () => {
  let now = 10;
  const f = fixture({ store: new MemoryAuthStore({ now: () => now }) });
  const first = cookie(await f.login());
  const second = cookie(await f.login(password, { Cookie: first }));
  assert.notEqual(first, second);
  assert.equal((await f.call('api/catalog', { headers: { Cookie: first } })).status, 401);
  const logout = await f.call('api/logout', { method: 'POST', headers: { Origin: origin, Cookie: second } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await f.call('api/catalog', { headers: { Cookie: second } })).status, 401);
  const third = cookie(await f.login());
  now += 28800001;
  assert.equal((await f.call('api/catalog', { headers: { Cookie: third } })).status, 401);
  const reload = await f.call('', { headers: { Cookie: third } });
  assert.equal(await reload.text(), 'gate only');
  assert.match(reload.headers.get('set-cookie'), /Max-Age=0/);
});

test('forged, duplicate and other application cookies cannot grant access', async () => {
  const f = fixture();
  const token = cookie(await f.login());
  for (const Cookie of [`${COOKIE_NAME}=${'a'.repeat(64)}`, `${token}; ${token}`, token.replace(COOKIE_NAME, 'unrelated_session'), `${token}x`]) {
    assert.equal((await f.call('api/catalog', { headers: { Cookie } })).status, 401);
  }
});

test('canonical redirect, host checks, origin checks and methods close alternate routes', async () => {
  const f = fixture();
  const redirect = await f.handle(new Request(`${origin}/observatory`));
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/observatory/');
  for (const url of ['https://example.workers.dev/observatory/', 'https://preview.example/observatory/app.js']) assert.equal((await f.handle(new Request(url))).status, 421);
  for (const path of ['api/login', 'api/logout']) {
    for (const headers of [{}, { Origin: 'https://attacker.example' }, { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }]) {
      assert.equal((await f.call(path, { method: 'POST', headers, body: '{}' })).status, 403);
    }
  }
  assert.equal((await f.call('api/catalog', { method: 'PUT' })).status, 405);
  assert.equal((await f.call('api/catalog', { method: 'POST', headers: { Origin: origin } })).status, 404);
});

test('unknown and traversal paths never reach assets, even after authentication', async () => {
  const f = fixture();
  const headers = { Cookie: cookie(await f.login()) };
  for (const path of ['.private/auth.json', '../_protected/client/app.html', '_protected/client/app.html', 'client/app.js', 'client/../../auth.mjs', '%2fapp.js', 'app%2ejs', 'app.js.map', 'server.mjs']) {
    assert.equal((await f.call(path, { headers })).status, 404, path);
  }
  assert.deepEqual(f.reads, []);
});

test('responses are no-store, noindex, no-referrer; validators removed; HEAD contains no bytes', async () => {
  const f = fixture();
  const headers = { Cookie: cookie(await f.login()) };
  for (const path of ['', 'gate.js', 'app.js', 'api/catalog', 'unknown']) {
    const response = await f.call(path, { headers });
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('etag'), null);
    const head = await f.call(path, { method: 'HEAD', headers });
    assert.equal(await head.text(), '');
  }
  assert.equal((await f.call('api/catalog', { method: 'HEAD' })).status, 401);
});

test('missing or malformed private configuration and storage errors fail closed', async () => {
  for (const options of [{ authConfig: null }, { catalog: null }]) {
    const f = fixture(options);
    assert.equal((await f.login()).status, 503);
    assert.equal(await (await f.call()).text(), 'gate only');
    assert.equal((await f.call('api/catalog')).status, 401);
  }
  const f = fixture({ store: { attempt: async () => { throw new Error('private implementation error'); } } });
  const response = await f.login();
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /implementation error/);
  for (const value of ['', 'null', '{}', '{', JSON.stringify({ version: 1, salt: 'bad', verifier: 'bad' })]) assert.equal(configuredAuth(value), null);
});

test('per-address and global rate limits run before password verification', async () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) assert.equal((await f.login('wrong')).status, 401);
  const blocked = await f.login();
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('retry-after')) > 0); assert.equal(cookie(blocked), undefined);
  const global = fixture();
  for (let i = 0; i < 30; i++) assert.equal((await global.login('wrong', { 'x-test-ip': String(i) })).status, 401);
  assert.equal((await global.login(password, { 'x-test-ip': 'new' })).status, 429);
});

test('login input is bounded and rejects unsupported media types or malformed JSON', async () => {
  for (const [body, headers, status] of [
    ['x'.repeat(2000), { 'Content-Type': 'application/json' }, 400],
    ['{', { 'Content-Type': 'application/json' }, 400],
    ['{}', { 'Content-Type': 'text/plain' }, 415],
    [JSON.stringify({ password: null }), { 'Content-Type': 'application/json' }, 401]
  ]) {
    assert.equal((await fixture().call('api/login', { method: 'POST', headers: { Origin: origin, ...headers }, body })).status, status);
  }
});

test('directory parser permits only bounded local paths or the exact Cannonball homepage and strips unknown fields', () => {
  assert.deepEqual(configuredCatalog(JSON.stringify(catalog)), catalog);
  const external = { ...catalog.destinations[0], href: 'https://ucsdcannonball.com/', symbol: 'race' };
  assert.deepEqual(configuredCatalog(JSON.stringify({ destinations: [external] })), { destinations: [external] });
  for (const href of ['https://external.example/', '//external.example/', '/../../secret/', '/path\\escape/', '/x?secret=1', 'javascript:alert(1)',
    'http://ucsdcannonball.com/', 'https://ucsdcannonball.com.evil.example/', 'https://ucsdcannonball.com@evil.example/',
    'https://user@ucsdcannonball.com/', 'https://ucsdcannonball.com:443/', 'https://www.ucsdcannonball.com/',
    'https://ucsdcannonball.com/?catalog=private', 'https://ucsdcannonball.com/#arrival', 'https://ucsdcannonball.com/other']) {
    assert.equal(configuredCatalog(JSON.stringify({ destinations: [{ ...catalog.destinations[0], href }] })), null);
  }
  for (const value of ['{}', 'null', '{', JSON.stringify({ destinations: [] }), JSON.stringify({ destinations: [catalog.destinations[0], catalog.destinations[0]] })]) assert.equal(configuredCatalog(value), null);
  const stripped = configuredCatalog(JSON.stringify({ destinations: [{ ...catalog.destinations[0], password: 'never-return', other: 'never-return' }], secret: 'never-return' }));
  assert.deepEqual(stripped, catalog);
});
