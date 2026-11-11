import test from 'node:test';
import assert from 'node:assert/strict';
import { openManagedBrowser, rendererPreflight, PROTOCOL_TIMEOUT_MS } from '../src/browser.mjs';

test('managed transport applies real protocol timeout and full login idle lifetime', async () => {
  let launchOptions, connectOptions, accepted = false;
  const listeners = new Map();
  const socket = { accept() { accepted = true; }, send() {}, close() {}, addEventListener(name, fn) { listeners.set(name, fn); } };
  const expected = { connected: true };
  const env = { BROWSER: { async launch(options) { launchOptions = options; return { sessionId: 'synthetic', webSocket: {
    async fetch(url, options) { assert.equal(url, 'https://browser-binding.invalid'); assert.equal(options.headers.Upgrade, 'websocket'); return { webSocket: socket }; },
  } }; } } };
  const result = await openManagedBrowser(env, { async connect(options) { connectOptions = options; return expected; } });
  assert.equal(result.browser, expected); assert.equal(result.id, 'synthetic'); assert.equal(accepted, true);
  assert.equal(launchOptions.keepAlive, 900000); assert.equal(launchOptions.recording, false);
  assert.equal(connectOptions.protocolTimeout, 20000); assert.equal(PROTOCOL_TIMEOUT_MS, 20000);
  assert.deepEqual(launchOptions.guardrails.allowedDomains, ['ucsd.edu', '*.ucsd.edu', 'duosecurity.com', '*.duosecurity.com']);
  let message; connectOptions.transport.onmessage = value => { message = value; };
  listeners.get('message')({ data: 'synthetic-cdp' }); assert.equal(message, 'synthetic-cdp');
  let closes = 0; connectOptions.transport.onclose = () => { closes++; };
  listeners.get('error')(); listeners.get('close')(); assert.equal(closes, 1);
  assert.throws(() => connectOptions.transport.send('late'), /transport closed/);
});

test('renderer preflight confirms Page.enable and a responsive document before handing off', async () => {
  const calls = [];
  const page = { async createCDPSession() { return {
    async send(method) { calls.push(method); return method === 'Runtime.evaluate' ? { result: { value: true } } : {}; },
    async detach() { calls.push('detach'); },
  }; } };
  await rendererPreflight(page);
  assert.deepEqual(calls, ['Page.enable', 'Runtime.evaluate', 'detach']);
});

test('renderer preflight rejects hung Page.enable and an empty renderer', async () => {
  await assert.rejects(rendererPreflight({ async createCDPSession() { return {
    send: () => new Promise(() => {}), detach: async () => {},
  }; } }, 5), error => error.stage === 'renderer_preflight');
  await assert.rejects(rendererPreflight({ async createCDPSession() { return {
    send: async () => ({ result: { value: false } }), detach: async () => {},
  }; } }), error => error.stage === 'renderer_preflight');
});

test('failed CDP connection closes the acquired browser and exposes only fixed stage', async () => {
  let closed;
  const env = { BROWSER: { async launch() { return { sessionId: 'synthetic', webSocket: { async fetch() { return { webSocket: {
    accept() {}, send() {}, close() {}, addEventListener() {},
  } }; } } }; }, async closeSession(id) { closed = id; } } };
  await assert.rejects(openManagedBrowser(env, { async connect() { throw Error('private transport detail'); } }),
    error => error.stage === 'launch' && error.browserId === 'synthetic' && !error.message.includes('private'));
  assert.equal(closed, 'synthetic');
});
