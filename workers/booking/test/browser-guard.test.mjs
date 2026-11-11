import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Puppeteer } from '@cloudflare/puppeteer';
import { installNetworkGuard } from '../src/network-guard.mjs';

// Optional real Chromium test. All target DNS maps to a loopback fixture; no
// UCSD accounts, real services or persistent browser profiles are involved.
test('Chromium blocks popup/form/iframe/worker escapes before any modifying fixture request',
  { skip: !process.env.BBB_TEST_CHROME || !process.env.BBB_TEST_OPENSSL, timeout: 30_000 }, async () => {
    const root = path.resolve(tmpdir());
    const directory = await mkdtemp(path.join(root, 'bbb-guard-'));
    const cert = path.join(directory, 'cert.pem'), key = path.join(directory, 'key.pem');
    let server, child, browser;
    const received = [];
    try {
      execFileSync(process.env.BBB_TEST_OPENSSL, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
        '-out', cert, '-days', '1', '-subj', '/CN=tss.ucsd.edu'], { stdio: 'ignore', windowsHide: true });
      server = https.createServer({ key: await readFile(key), cert: await readFile(cert) }, (request, response) => {
        received.push({ method: request.method, path: request.url });
        response.setHeader('Content-Type', 'text/html');
        response.end('<!doctype html><title>Guard fixture</title><button id="attack">Try</button><script>document.querySelector("button").onclick=()=>{window.open("/popup", "_blank");const f=document.createElement("form");f.method="POST";f.action="/popup-form";f.target="_blank";document.body.append(f);f.submit();const i=document.createElement("iframe");i.src="/iframe";document.body.append(i);try{new Worker("/worker")}catch{};fetch("/sap/opu/odata/ITUS/PR_MY_MODULES_V2_SRV/ActionHdrSet",{method:"POST",body:"blocked"}).catch(()=>{});fetch("/read-ok");}</script>');
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;
      child = spawn(process.env.BBB_TEST_CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${path.join(directory, 'profile')}`,
        '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--no-proxy-server',
        '--ignore-certificate-errors', '--host-resolver-rules=MAP tss.ucsd.edu 127.0.0.1', 'about:blank'], { stdio: 'ignore', windowsHide: true });
      let address;
      for (let n = 0; n < 100; n++) {
        try { const [debugPort, endpoint] = (await readFile(path.join(directory, 'profile', 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); address = `ws://127.0.0.1:${debugPort}${endpoint}`; break; }
        catch { await new Promise(resolve => setTimeout(resolve, 100)); }
      }
      assert.ok(address, 'isolated Chromium started');
      browser = await new Puppeteer({ isPuppeteerCore: true }).connect({ browserWSEndpoint: address });
      const page = await browser.newPage();
      const events = [];
      const guard = await installNetworkGuard(page);
      guard.on('Fetch.requestPaused', event => events.push({ type: event.resourceType, status: event.responseStatusCode }));
      await page.goto(`https://tss.ucsd.edu:${port}/`, { waitUntil: 'domcontentloaded' });
      assert.ok(events.some(event => event.type === 'Document' && event.status === 200));
      assert.equal(await page.title(), 'Guard fixture');
      await page.click('#attack');
      for (let n = 0; n < 30 && !received.some(item => item.path === '/read-ok'); n++) await new Promise(resolve => setTimeout(resolve, 50));
      assert.ok(received.some(item => item.path === '/read-ok'), 'ordinary read reached fixture');
      assert.equal(received.some(item => item.method !== 'GET'), false);
      assert.equal(received.some(item => ['/popup', '/popup-form', '/iframe', '/worker'].includes(item.path)), false, JSON.stringify({received,events}));
      assert.equal((await browser.pages()).length, 2); // Initial blank page and the guarded page.
    } finally {
      await browser?.close().catch(() => {}); child?.kill();
      if (server) await new Promise(resolve => server.close(resolve));
      const resolved = path.resolve(directory);
      assert.ok(resolved.startsWith(root + path.sep) && path.basename(resolved).startsWith('bbb-guard-'));
      await rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
