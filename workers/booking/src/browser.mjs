import puppeteer from '@cloudflare/puppeteer';
import { installNetworkGuard } from './network-guard.mjs';
import { detectAuthenticated, inspectTss, beginBook, getBookingStatus, detectSessionCsrf } from './tss-adapter.mjs';
import { BOOKING_ROUTES } from './routes.mjs';
import { bounded } from './timeout.mjs';

export const PROTOCOL_TIMEOUT_MS = 20_000;

// WorkersLaunchOptions does not forward protocolTimeout. Use the binding's
// documented session-pinned transport with Puppeteer's public ConnectOptions.
export async function openManagedBrowser(env, client = puppeteer) {
  const session = await env.BROWSER.launch({
    keepAlive: Math.min(15, Math.max(1, Number(env.MAX_SESSION_MINUTES) || 15)) * 60_000,
    recording: false,
    guardrails: { allowedDomains: ['ucsd.edu', '*.ucsd.edu', 'duosecurity.com', '*.duosecurity.com'] },
  });
  const id = session.sessionId;
  try {
    const response = await session.webSocket.fetch('https://browser-binding.invalid', { headers: { Upgrade: 'websocket' } });
    const socket = response.webSocket;
    if (!socket) throw new Error('Browser connection unavailable');
    socket.accept();
    let transportClosed = false;
    const transport = { onmessage: undefined, onclose: undefined,
      send(message) { if (transportClosed) throw new Error('Browser transport closed'); socket.send(message); }, close() { socket.close(); } };
    const notifyClose = () => { if (transportClosed) return; transportClosed = true; transport.onclose?.(); };
    socket.addEventListener('message', event => transport.onmessage?.(event.data));
    socket.addEventListener('close', notifyClose);
    socket.addEventListener('error', () => { try { socket.close(); } finally { notifyClose(); } });
    const browser = await client.connect({ transport, protocolTimeout: PROTOCOL_TIMEOUT_MS });
    return { browser, id };
  } catch {
    await env.BROWSER.closeSession(id).catch(() => {});
    throw Object.assign(new Error('Managed browser unavailable'), { stage: 'launch', browserId: id });
  }
}

export async function rendererPreflight(page, timeoutMs = 8000) {
  const work = (async () => {
    const cdp = await page.createCDPSession();
    try {
      await cdp.send('Page.enable');
      const result = await cdp.send('Runtime.evaluate', { expression: 'Boolean(document.documentElement)', returnByValue: true, timeout: 5000 });
      if (result.result?.value !== true) throw new Error('Renderer not ready');
    } finally { await cdp.detach().catch(() => {}); }
  })();
  try { await bounded(work, timeoutMs, 'renderer_preflight'); }
  catch { throw Object.assign(new Error('Browser renderer unavailable'), { stage: 'renderer_preflight' }); }
}

export async function createBrowserController(env, { onDisconnect = () => {} } = {}) {
  let browser, id;
  try { ({ browser, id } = await openManagedBrowser(env)); }
  catch (failure) { throw Object.assign(new Error('Managed browser unavailable'), { stage: 'launch', ...(failure.browserId ? { browserId: failure.browserId } : {}) }); }
  let closing = false;
  let activeJob = null;
  let lastAuthentication = 0;
  let authenticationValid = false;
  const blocked = new Map();
  let stage = 'page';
  browser.on('disconnected', () => {
    if (closing) return;
    // Never reconnect to an uncontrolled authenticated browser after a lost guard.
    env.BROWSER.closeSession(id).catch(() => {});
    onDisconnect();
  });
  try {
    const page = await browser.newPage();
    stage = 'guard';
    const guard = await installNetworkGuard(page, {
      getJob: () => env.PROBE_ONLY === 'false' ? activeJob : null,
      onBlocked: value => {
        const key = `${value.method} ${value.hostname}${value.pathname}`;
        if (blocked.has(key) || blocked.size < 30) blocked.set(key, (blocked.get(key) || 0) + 1);
      },
    });
    page.setDefaultTimeout(15_000);
    page.setDefaultNavigationTimeout(25_000);
    browser.on('targetcreated', async target => {
      if (target.type() !== 'page') return;
      const extra = await target.page().catch(() => null);
      if (extra && extra !== page) await extra.close().catch(() => {});
    });
    const cdp = await page.createCDPSession();
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    await cdp.detach();
    stage = 'navigation';
    await page.goto('https://tss.ucsd.edu/fiori', { waitUntil: 'domcontentloaded' });
    stage = 'renderer_preflight';
    await rendererPreflight(page);
    let formProbe = null;
    let forms = [];
    const load = async (route, courseCode) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      const deadline = Date.now() + 20_000;
      let result;
      do {
        result = await inspectTss(page, { route, courseCode });
        if (result.loaded) return result;
        await new Promise(resolve => setTimeout(resolve, 300));
      } while (Date.now() < deadline);
      return result;
    };
    const authenticated = async ({ fresh = false } = {}) => {
      if (!await detectAuthenticated(page)) { authenticationValid = false; return false; }
      if (!fresh && authenticationValid && Date.now() - lastAuthentication < 30_000) return true;
      authenticationValid = await detectSessionCsrf(page);
      lastAuthentication = Date.now();
      return authenticationValid;
    };
    return {
      id,
      connected() { return browser.connected && !page.isClosed(); },
      authenticated,
      async loginUrl() {
        try {
          await rendererPreflight(page);
          const result = await env.BROWSER.getLiveView(id, { targetId: targetInfo.targetId, mode: 'tab', expiresInMs: 60_000 });
          const url = new URL(result.devtoolsFrontendUrl);
          if (url.origin !== 'https://live.browser.run') throw new Error('Unexpected login view origin');
          return url.href;
        } catch (failure) { throw Object.assign(new Error('Login view unavailable'), { stage: failure?.stage === 'renderer_preflight' ? failure.stage : 'live_view' }); }
      },
      async inspect(route, courseCode) {
        if (!await detectAuthenticated(page)) return { ready: false };
        const result = await load(route, courseCode);
        return { ready: result.ready === true, loaded: result.loaded === true, csrf: await detectSessionCsrf(page) };
      },
      async book(route, courseCode, requestId) {
        if (env.PROBE_ONLY !== 'false' || activeJob) throw new Error('Booking unavailable');
        if (!await authenticated({ fresh: true })) return { stage: 'stopped' };
        const loaded = await load(route, courseCode);
        if (!loaded.ready) return { stage: 'stopped' };
        const metadata = BOOKING_ROUTES.get(route);
        if (!metadata) throw new Error('Unknown route');
        activeJob = { ...metadata, phase: 'check', requestId };
        return beginBook(page, { route, courseCode, requestId });
      },
      async bookingStatus(requestId) {
        const result = await getBookingStatus(page, { requestId });
        if (['submitted', 'error', 'stopped'].includes(result.stage)) activeJob = null;
        return { stage: result.stage };
      },
      // Sanitized diagnostics are exposed only by the owned probe session.
      blockedRequests() { return [...blocked].map(([request, count]) => ({ request, count })); },
      async diagnostics() {
        if (!formProbe) {
          const work = page.evaluate(() => [...document.forms].slice(0, 10).map(form => {
            try { const url = new URL(form.action); return { method: form.method.toUpperCase(), hostname: url.hostname, pathname: url.pathname }; } catch { return null; }
          }).filter(Boolean)).then(value => { forms = value; }).catch(() => {});
          formProbe = work;
          work.finally(() => { if (formProbe === work) formProbe = null; });
        }
        return { blocked: [...blocked].map(([request, count]) => ({ request, count })), forms, ...(guard.diagnostics ? { guard: guard.diagnostics() } : {}) };
      },
      async close() {
        closing = true;
        await browser.close();
      },
    };
  } catch {
    closing = true;
    try { await bounded(browser.close(), 2000, 'local_close_timeout'); } catch { /* Provider closure below. */ }
    await env.BROWSER.closeSession(id).catch(() => {});
    throw Object.assign(new Error('Managed browser unavailable'), { stage, browserId: id });
  }
}
