import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createAuthConfig, digest, COOKIE_NAME } from '../auth.mjs';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://boomerrawlings.com';
const password = 'Runtime-test-observatory-password';
const catalog = { destinations: [{ id: 'fixture', title: 'Restricted fixture directory', kicker: 'Fictional destination', description: 'Runtime test content.', href: '/fictional-room/', accent: '#abcdef' }] };
const files = {
  '/_protected/client/gate.html': 'gate only', '/_protected/client/gate.css': 'gate style', '/_protected/client/gate.js': 'gate script', '/_protected/client/arrival.js': 'public arrival bootstrap',
  '/_protected/client/theme.css': 'public theme', '/_protected/client/font-source-sans.woff2': 'public font', '/_protected/client/font-teko.woff2': 'public font',
  '/_protected/client/app.html': 'protected shell', '/_protected/client/app.css': 'protected style', '/_protected/client/app.js': 'protected script',
  '/_protected/client/symbols.js': 'protected symbols', '/_protected/client/symbols.css': 'protected symbol styles'
};
let runtime, unconfigured, namespace, sessionStore, riddleStore, config;
const reads = [];
before(async () => {
  const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
  config = await createAuthConfig(password);
  const rotated = await createAuthConfig('Rotated-test-password-only');
  const riddleConfig = await createAuthConfig('fixtureword', { mode: 'riddle' });
  const harness = `
    import worker, { ObservatoryAuthStore } from './worker.mjs';
    export class TestAuthStore extends ObservatoryAuthStore {
      async expire() {
        this.ctx.storage.sql.exec('UPDATE sessions SET expires=0');
        this.ctx.storage.sql.exec('UPDATE attempts SET expires=0');
        await this.alarm();
      }
      async inspect() {
        return {sessions:this.ctx.storage.sql.exec('SELECT token_hash,created,expires FROM sessions').toArray(),
          attempts:this.ctx.storage.sql.exec('SELECT ip_hash,expires FROM attempts').toArray(),alarm:await this.ctx.storage.getAlarm()};
      }
    }
    export default { fetch(request,env) {
      if(request.headers.has('x-test-rotate')) env={...env,OBSERVATORY_AUTH_CONFIG:${JSON.stringify(JSON.stringify(rotated))}};
      if(request.headers.has('x-test-riddle')) env={...env,OBSERVATORY_AUTH_CONFIG:${JSON.stringify(JSON.stringify(riddleConfig))}};
      return worker.fetch(request,env);
    }};
  `;
  const options = {
    name: 'observatory-security-test',
    modules: [{ type: 'ESModule', path: resolve(root, 'test-harness.mjs'), contents: harness },
      ...['worker.mjs', 'auth.mjs', 'catalog.mjs', 'handler.mjs'].map(name => ({ type: 'ESModule', path: resolve(root, name) }))],
    modulesRoot: root, compatibilityDate: '2026-11-05', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { OBSERVATORY_AUTH: { className: 'TestAuthStore', useSQLite: true } },
    serviceBindings: { ASSETS: async request => {
      const path = new URL(request.url).pathname;
      reads.push(path);
      return new Response(files[path] || 'Not found', { status: path in files ? 200 : 404, headers: { 'Cache-Control': 'public,max-age=99999', ETag: 'fixture' } });
    } }
  };
  const normalize = value => convertV4MiniflareOptions ? convertV4MiniflareOptions(value) : value;
  runtime = new Miniflare(normalize({ ...options, bindings: { OBSERVATORY_AUTH_CONFIG: JSON.stringify(config), OBSERVATORY_CATALOG: JSON.stringify(catalog) } }));
  unconfigured = new Miniflare(normalize({ ...options, name: 'observatory-unconfigured-test' }));
  namespace = await runtime.getDurableObjectNamespace('OBSERVATORY_AUTH');
  sessionStore = namespace.getByName(`observatory-v1-${await digest(`${config.salt}:${config.verifier}`)}`);
  riddleStore = namespace.getByName(`observatory-v1-${await digest(`${riddleConfig.salt}:${riddleConfig.verifier}`)}`);
});
after(async () => { await Promise.all([runtime?.dispose(), unconfigured?.dispose()]); });
const call = (path = '', options = {}) => runtime.dispatchFetch(`${origin}/observatory/${path}`, options);
const login = (value = password, headers = {}) => call('api/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ password: value }) });
const cookie = response => response.headers.get('set-cookie')?.split(';')[0];

test('actual Worker transitions from the exact credential to a normalized riddle without accepting old sessions', async () => {
  await sessionStore.expire(); await riddleStore.expire();
  const previousCookie = cookie(await login());
  assert.equal((await call('api/catalog', { headers: { Cookie: previousCookie, 'x-test-riddle': 'yes' } })).status, 401);
  assert.equal((await login(password, { 'x-test-riddle': 'yes' })).status, 401);
  assert.equal((await login('fixture-word', { 'x-test-riddle': 'yes' })).status, 401);
  const response = await login(' \uff26\uff29\uff38\uff34\uff35\uff32\uff25\uff37\uff2f\uff32\uff24 ', { 'x-test-riddle': 'yes' });
  assert.equal(response.status, 200);
  const Cookie = cookie(response);
  assert.equal((await call('api/catalog', { headers: { Cookie, 'x-test-riddle': 'yes' } })).status, 200);
  assert.equal((await call('api/catalog', { headers: { Cookie } })).status, 401);
  const logout = await call('api/logout', { method: 'POST', headers: { Origin: origin, Cookie, 'x-test-riddle': 'yes' } });
  assert.equal(logout.status, 200);
  assert.equal((await call('api/catalog', { headers: { Cookie, 'x-test-riddle': 'yes' } })).status, 401);
  await riddleStore.expire();
  for (let i = 0; i < 5; i++) assert.equal((await login('wrong', { 'x-test-riddle': 'yes' })).status, 401);
  assert.equal((await login('fixtureword', { 'x-test-riddle': 'yes' })).status, 429);
});

test('actual Worker gates all private paths; only generic entrance assets can be requested directly', async () => {
  await sessionStore.expire(); reads.length = 0;
  assert.equal(await (await call()).text(), 'gate only');
  for (const path of ['api/catalog', 'app.html', 'app.css', 'app.js', 'symbols.js', 'symbols.css', 'client/app.html', '.private/catalog.json']) {
    const response = await call(path);
    assert.equal(response.status, 401, path);
    assert.doesNotMatch(await response.text(), /Restricted fixture|protected shell|fictional-room/);
  }
  assert.deepEqual(reads, ['/_protected/client/gate.html']);
  for (const path of ['gate.css', 'gate.js', 'arrival.js', 'theme.css', 'font-source-sans.woff2', 'font-teko.woff2']) assert.equal((await call(path)).status, 200);
  const bad = await login('wrong'); assert.equal(bad.status, 401); assert.equal(cookie(bad), undefined);
  const good = await login(); assert.equal(good.status, 200);
  const headers = { Cookie: cookie(good) };
  assert.equal(await (await call('', { headers })).text(), 'protected shell');
  assert.deepEqual(await (await call('api/catalog', { headers })).json(), catalog);
  for (const path of ['app.html', 'app.css', 'app.js', 'symbols.js', 'symbols.css']) assert.equal((await call(path, { headers })).status, 200);
  const head = await call('api/catalog', { method: 'HEAD', headers }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const cached = await call('app.js', { headers: { ...headers, 'If-None-Match': 'fixture' } });
  assert.equal(cached.status, 200); assert.equal(cached.headers.get('etag'), null); assert.match(cached.headers.get('cache-control'), /no-store/);
});

test('actual Worker rotates, expires and revokes server-side sessions, and password rotation invalidates old sessions', async () => {
  await sessionStore.expire();
  const first = cookie(await login());
  const second = cookie(await login(password, { Cookie: first }));
  assert.notEqual(first, second);
  assert.equal((await call('api/catalog', { headers: { Cookie: first } })).status, 401);
  assert.equal((await call('api/catalog', { headers: { Cookie: second, 'x-test-rotate': 'yes' } })).status, 401);
  assert.equal((await call('api/catalog', { headers: { Cookie: `${second}; ${second}` } })).status, 401);
  assert.equal((await call('api/catalog', { headers: { Cookie: `${COOKIE_NAME}=${'a'.repeat(64)}` } })).status, 401);
  const logout = await call('api/logout', { method: 'POST', headers: { Origin: origin, Cookie: second } });
  assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await call('api/catalog', { headers: { Cookie: second } })).status, 401);
  const third = cookie(await login());
  await sessionStore.expire();
  const response = await call('', { headers: { Cookie: third } });
  assert.equal(await response.text(), 'gate only'); assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('actual Worker refuses cross-site writes, alternate hosts and internal asset bypasses', async () => {
  await sessionStore.expire();
  const Cookie = cookie(await login()); reads.length = 0;
  for (const path of ['.private/auth.json', '_protected/client/app.html', 'client/app.js', 'app.js.map', '%2fapp.js', 'app%2ejs']) assert.equal((await call(path, { headers: { Cookie } })).status, 404, path);
  for (const url of ['https://example.workers.dev/observatory/app.js', 'https://preview.example/observatory/', `${origin}/_protected/client/app.html`]) {
    const response = await runtime.dispatchFetch(url, { headers: { Cookie } });
    assert.ok([404, 421].includes(response.status));
    assert.doesNotMatch(await response.text(), /protected|Restricted fixture/);
  }
  assert.deepEqual(reads, []);
  for (const path of ['api/login', 'api/logout']) {
    for (const headers of [{}, { Origin: 'https://attacker.example' }, { Origin: origin, 'Sec-Fetch-Site': 'cross-site' }]) assert.equal((await call(path, { method: 'POST', headers: { Cookie, ...headers }, body: '{}' })).status, 403);
  }
  assert.equal((await call('api/catalog', { headers: { Cookie } })).status, 200);
});

test('missing runtime secrets serve only gate and never bypass authentication', async () => {
  assert.equal(await (await unconfigured.dispatchFetch(`${origin}/observatory/`)).text(), 'gate only');
  for (const path of ['app.html', 'app.js', 'symbols.js', 'symbols.css', 'api/catalog', '_protected/client/app.html']) {
    const response = await unconfigured.dispatchFetch(`${origin}/observatory/${path}`);
    assert.equal(response.status, 401);
    assert.doesNotMatch(await response.text(), /protected|Restricted fixture/);
  }
  const response = await unconfigured.dispatchFetch(`${origin}/observatory/api/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
  assert.equal(response.status, 503); assert.equal(cookie(response), undefined);
});

test('persistent limiter atomically enforces per-address and aggregate limits under concurrency', async () => {
  const perAddress = namespace.getByName('test-per-address');
  const results = await Promise.all(Array.from({ length: 12 }, () => perAddress.attempt('a'.repeat(64))));
  assert.equal(results.filter(item => item.allowed).length, 5);
  assert.equal((await perAddress.inspect()).attempts.length, 5);
  assert.equal((await namespace.getByName('test-per-address').attempt('a'.repeat(64))).allowed, false);
  const global = namespace.getByName('test-global');
  const all = await Promise.all(Array.from({ length: 45 }, async (_, i) => global.attempt(await digest(String(i)))));
  assert.equal(all.filter(item => item.allowed).length, 30);
  assert.equal((await global.inspect()).attempts.length, 30);
  assert.ok(all.filter(item => !item.allowed).every(item => item.retryAfter > 0 && item.retryAfter <= 900));
  await global.expire();
  assert.equal((await global.attempt('a'.repeat(64))).allowed, true);
});

test('persistent session state stores only hashes, caps sessions, enforces expiry and cleans alarms', async () => {
  const store = namespace.getByName('test-sessions');
  const hash = await digest('synthetic-token');
  await store.create(hash);
  assert.equal(await namespace.getByName('test-sessions').get(hash), true);
  const first = (await store.inspect()).sessions[0];
  assert.equal(first.expires - first.created, 28800000);
  await store.create(hash);
  assert.equal((await store.inspect()).sessions[0].expires, first.expires);
  await store.revoke(hash); assert.equal(await store.get(hash), false);
  for (let i = 0; i < 105; i++) await store.create(await digest(`synthetic-token-${i}`));
  assert.equal((await store.inspect()).sessions.length, 100);
  await store.expire();
  assert.equal((await store.inspect()).sessions.length, 0);
  assert.equal((await store.inspect()).alarm, null);
  for (const method of ['attempt', 'create', 'get', 'revoke']) await assert.rejects(store[method]('not-a-hash'));
});

test('actual Worker persists failed-login rate limit before verifying correct password', async () => {
  await sessionStore.expire();
  for (let i = 0; i < 5; i++) assert.equal((await login('wrong')).status, 401);
  const response = await login();
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0); assert.equal(cookie(response), undefined);
});

test('deployment routes intercept all assets, disable alternate public URLs and contain no secrets', async () => {
  const config = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.assets.run_worker_first, true);
  assert.equal(config.assets.html_handling, 'none');
  assert.equal(config.assets.not_found_handling, 'none');
  assert.equal(config.workers_dev, false); assert.equal(config.preview_urls, false);
  assert.deepEqual(config.routes.map(item => item.pattern), ['boomerrawlings.com/observatory', 'boomerrawlings.com/observatory/*']);
  assert.equal(config.vars, undefined);
  assert.equal(config.durable_objects.bindings[0].name, 'OBSERVATORY_AUTH');
});
