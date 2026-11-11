import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { gzipSync } from 'node:zlib';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Puppeteer } from '@cloudflare/puppeteer';
import { installNetworkGuard } from '../src/network-guard.mjs';

// All traffic is synthetic. A local CONNECT proxy accepts only these fixture
// names and connects exclusively to the loopback TLS server, never DNS/network.
const hosts = ['tss.ucsd.edu', 'tssproxy.ucsd.edu', 'a5.ucsd.edu', 'api-ce13a1a7.duosecurity.com'];
const [tss, proxy, idp, duo] = hosts.map(host => 'https://' + host);
const endpoint = '/tritON/profile/SAML2/Redirect/SSO';
const cookie = (name, value, policy = 'None', httpOnly = true) => `${name}=${value}; Path=/; Secure; SameSite=${policy}${httpOnly ? '; HttpOnly' : ''}`;
const hidden = (name, value) => `<input type="hidden" name="${name}" value="${value}">`;
const form = (action, fields, button) => `<!doctype html><title>Synthetic SSO</title><form method="post" action="${action}">${Object.entries(fields).map(([name, value]) => hidden(name, value)).join('')}${button ? `<button id="${button}">Continue synthetic login</button>` : ''}</form>${button ? '' : '<script>document.forms[0].submit()</script>'}`;
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

test('isolated Chromium preserves SSO cookies, redirects, cross-site forms and referrers under the production guard',
  { skip: !process.env.BBB_TEST_CHROME || !process.env.BBB_TEST_OPENSSL, timeout: 60_000 }, async t => {
    const root = path.resolve(tmpdir());
    const directory = await mkdtemp(path.join(root, 'bbb-sso-guard-'));
    const cert = path.join(directory, 'cert.pem'), key = path.join(directory, 'key.pem');
    let fixture, tunnel, child, browser, active;
    const sockets = new Set(), proxyDenials = [], socketErrors = [];
    const track = socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      // Chromium may reset idle/preconnected tunnels when closing a context.
      // Handle those transport events without masking failed SSO assertions.
      socket.on('error', error => {
        if (!['ECONNRESET', 'EPIPE'].includes(error.code)) socketErrors.push(error.code || error.name);
        socket.destroy();
      });
      return socket;
    };
    try {
      execFileSync(process.env.BBB_TEST_OPENSSL, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
        '-out', cert, '-days', '1', '-subj', '/CN=tss.ucsd.edu'], { stdio: 'ignore', windowsHide: true });
      fixture = https.createServer({ key: await readFile(key), cert: await readFile(cert) }, async (request, response) => {
        let raw = '';
        for await (const chunk of request) { raw += chunk; if (raw.length > 128_000) { request.destroy(); return; } }
        const host = request.headers.host;
        if (!active || !hosts.includes(host)) { response.writeHead(400).end(); return; }
        const url = new URL(request.url, 'https://' + host), fields = new URLSearchParams(raw);
        const cookies = Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map(value => value.trim().split('=')));
        const label = host === hosts[0] ? 'tss' : host === hosts[1] ? 'proxy' : host === hosts[2] ? 'idp' : 'duo';
        const originLabel = value => {
          if (!value) return 'absent';
          try { const index = hosts.indexOf(new URL(value).hostname); return index < 0 ? 'other' : ['tss', 'proxy', 'idp', 'duo'][index]; }
          catch { return value === 'null' ? 'null' : 'other'; }
        };
        const observed = { host: label, method: request.method, path: url.pathname, execution: url.searchParams.get('execution') || '',
          origin: originLabel(request.headers.origin), referrer: originLabel(request.headers.referer),
          cookieNames: Object.keys(cookies).sort(), csrfValid: fields.has('csrf') ? fields.get('csrf') === 'synthetic-csrf' : null };
        active.requests.push(observed);
        const html = (body, setCookies = [], status = 200) => {
          const compressed = gzipSync(body);
          response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Encoding': 'gzip', 'Content-Length': compressed.length,
            'Referrer-Policy': 'strict-origin-when-cross-origin', ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}) });
          response.end(compressed);
        };
        const redirect = (status, location, setCookies = []) => {
          response.writeHead(status, { Location: location, 'Content-Length': 0, 'Referrer-Policy': 'strict-origin-when-cross-origin',
            ...(setCookies.length ? { 'Set-Cookie': setCookies } : {}) }); response.end();
        };
        const need = (condition, issue) => {
          if (condition) return true;
          active.issues.push(issue); html('<!doctype html><title>Synthetic SSO failed</title><p id="failed">Fixture validation failed</p>', [], 400); return false;
        };
        if (host === hosts[0] && url.pathname === '/fiori' && request.method === 'GET' && !url.searchParams.has('done')) {
          html(form(proxy + '/idp/profile/SAML2/POST/SSO', { SAMLRequest: 'synthetic-request', RelayState: 'synthetic-relay' }),
            [cookie('fixture_tss', 'start'), cookie('fixture_tss_lax', 'start', 'Lax')]);
        } else if (host === hosts[1] && url.pathname === '/idp/profile/SAML2/POST/SSO' && request.method === 'POST') {
          if (!need(fields.get('SAMLRequest') === 'synthetic-request', 'proxy_initial_form')) return;
          redirect(302, idp + endpoint + '?execution=e1s1', [cookie('fixture_proxy', 'start'), cookie('fixture_proxy_lax', 'start', 'Lax')]);
        } else if (host === hosts[2] && url.pathname === endpoint && url.search === '?execution=e1s1' && request.method === 'GET') {
          html(form(idp + endpoint + '?execution=e1s1', { csrf: 'synthetic-csrf', realm: active.realm }, 'signin'),
            [cookie('fixture_idp', 'start'), cookie('fixture_idp_lax', 'start', 'Lax'), cookie('fixture_idp_strict', 'start', 'Strict')]);
        } else if (host === hosts[2] && url.pathname === endpoint && url.search === '?execution=e1s1' && request.method === 'POST') {
          if (!need(cookies.fixture_idp === 'start' && cookies.fixture_idp_lax === 'start' && cookies.fixture_idp_strict === 'start'
            && fields.get('csrf') === 'synthetic-csrf' && fields.get('realm') === active.realm, 'idp_credentials_context')) return;
          redirect(303, duo + '/prompt/synthetic', [cookie('fixture_idp', 'rotated'), cookie('fixture_idp_aux', 'rotated')]);
        } else if (host === hosts[3] && url.pathname === '/prompt/synthetic' && request.method === 'GET') {
          html(form(duo + '/prompt/synthetic', { csrf: 'synthetic-csrf', approved: 'synthetic' }, 'approve'),
            [cookie('fixture_duo', 'start'), cookie('fixture_duo_lax', 'start', 'Lax'), cookie('fixture_duo_strict', 'start', 'Strict')]);
        } else if (host === hosts[3] && url.pathname === '/prompt/synthetic' && request.method === 'POST') {
          if (!need(cookies.fixture_duo === 'start' && fields.get('csrf') === 'synthetic-csrf', 'duo_approval_context')) return;
          redirect(307, duo + '/prompt/continue', [cookie('fixture_duo', 'rotated'), cookie('fixture_duo_aux', 'rotated')]);
        } else if (host === hosts[3] && url.pathname === '/prompt/continue' && request.method === 'POST') {
          if (!need(cookies.fixture_duo === 'rotated' && cookies.fixture_duo_aux === 'rotated' && fields.get('approved') === 'synthetic', 'duo_redirect_context')) return;
          html(form(idp + endpoint + '?execution=e1s2', { csrf: 'synthetic-csrf', result: 'synthetic-approved' }));
        } else if (host === hosts[2] && url.pathname === endpoint && url.search === '?execution=e1s2' && request.method === 'POST') {
          if (!need(cookies.fixture_idp === 'rotated' && cookies.fixture_idp_aux === 'rotated' && fields.get('csrf') === 'synthetic-csrf'
            && fields.get('result') === 'synthetic-approved', 'idp_cross_site_callback')) return;
          html(form(proxy + '/idp/profile/Authn/SAML2/POST/SSO', { SAMLResponse: 'synthetic-assertion', RelayState: 'synthetic-relay' }));
        } else if (host === hosts[1] && url.pathname === '/idp/profile/Authn/SAML2/POST/SSO' && request.method === 'POST') {
          if (!need(cookies.fixture_proxy === 'start' && fields.get('SAMLResponse') === 'synthetic-assertion', 'proxy_assertion_context')) return;
          html(form(tss + '/fiori', { SAMLResponse: 'synthetic-final', RelayState: 'synthetic-relay' }));
        } else if (host === hosts[0] && url.pathname === '/fiori' && request.method === 'POST') {
          if (!need(cookies.fixture_tss === 'start' && fields.get('SAMLResponse') === 'synthetic-final', 'tss_assertion_context')) return;
          redirect(303, tss + '/fiori?done=1', [cookie('fixture_tss', 'complete'), cookie('fixture_auth', 'complete'), cookie('fixture_visible', 'complete', 'None', false)]);
        } else if (host === hosts[0] && url.pathname === '/fiori' && url.search === '?done=1' && request.method === 'GET') {
          if (!need(cookies.fixture_tss === 'complete' && cookies.fixture_auth === 'complete', 'tss_completed_cookies')) return;
          html('<!doctype html><title>Synthetic SSO complete</title><p id="complete">Complete</p>');
        } else if (url.pathname === '/favicon.ico') { response.writeHead(204).end(); active.requests.pop(); }
        else { active.issues.push('unexpected_fixture_request'); html('<title>Unexpected fixture request</title>', [], 404); }
      });
      fixture.on('connection', track); await listen(fixture);
      tunnel = http.createServer((_request, response) => response.writeHead(403).end());
      tunnel.on('connection', track);
      tunnel.on('connect', (request, socket, head) => {
        if (!hosts.some(host => request.url === host + ':443')) { proxyDenials.push('non_fixture_destination'); socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
        const upstream = track(net.connect(fixture.address().port, '127.0.0.1', () => {
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head); socket.pipe(upstream); upstream.pipe(socket);
        }));
        upstream.on('error', () => socket.destroy()); socket.on('error', () => upstream.destroy());
      });
      await listen(tunnel);
      child = spawn(process.env.BBB_TEST_CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(directory, 'profile')}`,
        '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-quic',
        '--ignore-certificate-errors', `--proxy-server=http://127.0.0.1:${tunnel.address().port}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
      let address;
      for (let index = 0; index < 100; index++) {
        try { const [port, endpoint] = (await readFile(path.join(directory, 'profile', 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); address = `ws://127.0.0.1:${port}${endpoint}`; break; }
        catch { await new Promise(resolve => setTimeout(resolve, 100)); }
      }
      assert.ok(address, 'isolated Chromium started');
      browser = await new Puppeteer({ isPuppeteerCore: true }).connect({ browserWSEndpoint: address });
      const results = [];
      for (const guarded of [false, true]) {
        for (const realm of ['student', 'active-directory']) {
          const context = await browser.createBrowserContext(), page = await context.newPage();
          active = { realm, requests: [], issues: [] };
          const blocked = [], failures = [];
          page.setDefaultTimeout(12_000); page.setDefaultNavigationTimeout(12_000);
          page.on('requestfailed', request => failures.push({ method: request.method(), type: request.resourceType(), code: request.failure()?.errorText }));
          if (guarded) await installNetworkGuard(page, { onBlocked: item => blocked.push({ method: item.method, hostKnown: hosts.includes(item.hostname) }) });
          await page.goto(tss + '/fiori', { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('#signin'); await page.click('#signin');
          await page.waitForSelector('#approve'); await page.click('#approve');
          try { await page.waitForSelector('#complete'); }
          catch { assert.fail(JSON.stringify({ guarded, realm, issues: active.issues, requests: active.requests, blocked, failures })); }
          const documentState = await page.evaluate(() => ({ origin: location.origin, visibleCookie: document.cookie.includes('fixture_visible=complete'),
            hiddenCookieProtected: !document.cookie.includes('fixture_auth='), topLevel: self === top }));
          assert.deepEqual(active.issues, []); assert.deepEqual(blocked, []);
          assert.equal(active.requests.length, 11); assert.deepEqual(documentState, { origin: tss, visibleCookie: true, hiddenCookieProtected: true, topLevel: true });
          results.push({ guarded, realm, requests: structuredClone(active.requests), documentState });
          t.diagnostic(`${guarded ? 'guarded' : 'baseline'} ${realm}: 11 document requests; all cookie rotations, CSRF fields and SAML posts verified`);
          await context.close(); active = undefined;
        }
      }
      for (const realm of ['student', 'active-directory']) {
        const baseline = results.find(value => !value.guarded && value.realm === realm), guarded = results.find(value => value.guarded && value.realm === realm);
        assert.deepEqual(guarded.requests, baseline.requests, `${realm}: guard changed cookie/referrer/origin/form behavior`);
      }
      assert.ok(results.every(value => value.requests.some(request => request.host === 'idp' && request.execution === 'e1s2' && request.origin === 'duo')));
      assert.deepEqual(socketErrors, []);
      t.diagnostic('Guarded and baseline request metadata identical; local proxy rejected all non-fixture destinations.');
    } finally {
      await browser?.close().catch(() => {}); child?.kill();
      for (const socket of sockets) socket.destroy();
      if (tunnel) await new Promise(resolve => tunnel.close(resolve));
      if (fixture) await new Promise(resolve => fixture.close(resolve));
      const resolved = path.resolve(directory);
      assert.ok(resolved.startsWith(root + path.sep) && path.basename(resolved).startsWith('bbb-sso-guard-'));
      await rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
