import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { transform } from 'esbuild';

const source = (await transform(await readFile(new URL('../src/scripts/roomie-tss-bridge.ts', import.meta.url), 'utf8'), {
  loader: 'ts', target: 'es2022', format: 'iife',
})).code;
const CHANNEL = 'bbb-tss-v1';
const TSS_ORIGIN = 'https://tss.ucsd.edu';
const NONCE = '0123456789abcdef0123456789abcdef';
const route = (moduleId, packageId) => `${TSS_ORIGIN}/fiori#ZUSModule-display?TileType=MYMOD&/Detail/EventPackage/SM/${moduleId}/00000000/0/0/0/00000000-0000-0000-0000-000000000000/${packageId}/2026/3/?`;

class Target {
  listeners = new Map();
  addEventListener(type, callback) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(callback);
    this.listeners.set(type, handlers);
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((handler) => handler !== callback));
  }
  emit(type, event = {}) {
    event.type = type;
    for (const callback of this.listeners.get(type) ?? []) callback({ ...event, currentTarget: this });
  }
}
class Element extends Target {
  dataset = {};
  disabled = false;
  hidden = false;
  open = false;
  value = '';
  attributes = new Map();
  textWrites = 0;
  text = '';
  get textContent() { return this.text; }
  set textContent(value) { this.text = value; this.textWrites++; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  focus() {}
  select() {}
}

// Execute the whole client with synthetic DOM, windows and clock. Network and
// credential/storage access are forbidden; no real TSS account is involved.
function harness({ hash = `#tss-connect=${NONCE}`, hasOpener = true, navigationType = 'navigate' } = {}) {
  const names = ['connection', 'connection-status', 'job-status', 'setup', 'disconnect', 'focus',
    'dialog', 'bookmarklet', 'copy-code', 'show-code', 'code-field', 'bookmark-code', 'copy-status'];
  const elements = Object.fromEntries(names.map((name) => [name, new Element()]));
  const buttons = [new Element(), new Element(), new Element()];
  buttons[0].dataset.bookRoute = route('13043', '166528');
  buttons[1].dataset.bookRoute = route('5379', '164082');
  buttons[2].dataset.bookRoute = 'https://untrusted.example/book';
  const sent = [];
  const timers = new Map();
  let clock = 1_000, nextTimer = 0, nextRequest = 0, storageTouches = 0, autoPong = false;
  const windowEvents = new Target();
  const document = new Target();
  document.visibilityState = 'visible';
  document.querySelector = (selector) => elements[/^\[data-tss-(.+)\]$/.exec(selector)?.[1]] ?? null;
  document.querySelectorAll = (selector) => selector === '[data-tss-book]' ? buttons : [];
  const location = { hash, pathname: '/0311/', search: '?view=all' };
  const historyCalls = [];
  const history = {
    state: { fixture: true },
    replaceState(state, unused, url) {
      historyCalls.push({ state, unused, url });
      location.hash = new URL(url, 'https://boomerrawlings.com').hash;
    },
  };
  const schedule = (callback, delay, interval = false) => {
    const id = ++nextTimer;
    timers.set(id, { callback, at: clock + delay, interval: interval ? delay : null });
    return id;
  };
  const peer = {
    closed: false,
    focus() {},
    postMessage(data, targetOrigin) {
      sent.push({ data: structuredClone(data), targetOrigin });
      if (autoPong && data.type === 'ping') emitMessage({ type: 'pong' });
    },
  };
  const context = {
    document, location, history, opener: hasOpener ? peer : null, URL, URLSearchParams,
    Date: class extends Date { static now() { return clock; } },
    crypto: { randomUUID: () => `request-${++nextRequest}` },
    performance: { getEntriesByType: () => [{ type: navigationType }] },
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout: (callback, delay) => schedule(callback, delay),
    clearTimeout: (id) => timers.delete(id),
    setInterval: (callback, delay) => schedule(callback, delay, true),
    clearInterval: (id) => timers.delete(id),
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    fetch() { throw new Error('The BBB client must never request a TSS API.'); },
    XMLHttpRequest: class { constructor() { throw new Error('Unexpected network access.'); } },
    console,
  };
  context.window = context;
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB']) {
    Object.defineProperty(context, name, { get() { storageTouches++; throw new Error(`Unexpected ${name} access.`); } });
  }
  const emitMessage = (data, override = {}) => windowEvents.emit('message', {
    origin: TSS_ORIGIN, source: peer, data: { channel: CHANNEL, nonce: NONCE, ...data }, ...override,
  });
  runInNewContext(source, context, { filename: 'src/scripts/roomie-tss-bridge.ts' });
  const click = (element, { trusted = true } = {}) => element.emit('click', {
    isTrusted: trusted, target: element, preventDefault() {}, stopPropagation() {},
  });
  return {
    elements, buttons, sent, peer, context, document, location, historyCalls,
    get storageTouches() { return storageTouches; },
    get books() { return sent.filter((message) => message.data.type === 'book'); },
    get state() { return elements.connection.dataset.state; },
    get job() { return elements['job-status'].textContent; },
    message: emitMessage,
    connect() { emitMessage({ type: 'hello' }); },
    click(index = 0, options) { click(buttons[index], options); },
    disconnect() { click(elements.disconnect); },
    keepAlive(value = true) { autoPong = value; },
    status(status, requestId = sent.findLast((message) => message.data.type === 'book')?.data.requestId, overrides) {
      emitMessage({ type: 'status', status, requestId }, overrides);
    },
    emit(type, event) { windowEvents.emit(type, event); },
    advance(milliseconds) {
      const until = clock + milliseconds;
      let steps = 0;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        assert.ok(++steps < 1_000, 'Bounded fixture timers');
        const [id, timer] = next;
        clock = timer.at;
        if (timer.interval) timer.at += timer.interval;
        else timers.delete(id);
        timer.callback();
      }
      clock = until;
    },
  };
}

test('connection nonce is removed from the address, never persisted; valid hello receives exact-origin ack', () => {
  const h = harness();
  assert.equal(h.location.hash, '');
  assert.equal(h.historyCalls.length, 1);
  assert.equal(h.historyCalls[0].url, '/0311/?view=all');
  assert.equal(h.storageTouches, 0);
  assert.equal(h.books.length, 0);
  h.connect();
  assert.equal(h.state, 'connected');
  assert.equal(h.sent.filter((message) => message.data.type === 'ack').length, 1);
  assert.ok(h.sent.every((message) => message.targetOrigin === TSS_ORIGIN && message.data.nonce === NONCE));
  assert.equal(h.books.length, 0, 'Handshake never books automatically');
});

test('missing, malformed or restored connection cannot be activated by an unsolicited hello', () => {
  for (const options of [{ hash: '' }, { hash: '#tss-connect=short' }, { hasOpener: false }, { hash: '', navigationType: 'reload' }]) {
    const h = harness(options);
    h.connect(); h.click();
    assert.equal(h.state, 'disconnected');
    assert.equal(h.books.length, 0);
    assert.equal(h.elements.dialog.open, true);
    assert.equal(h.storageTouches, 0);
  }
});

test('lost opener explains browser connection limitation without preserving or activating the nonce', () => {
  const h = harness({ hasOpener: false });
  assert.equal(h.location.hash, '');
  assert.match(h.job, /browser did not preserve the TSS connection/);
  assert.match(h.job, /Keep TSS open and run your Connect TSS bookmark again/);
  assert.match(h.job, /If this persists, the connection is unavailable in this browser/);
  h.connect(); h.click();
  assert.equal(h.state, 'disconnected');
  assert.equal(h.sent.length, 0);
  assert.equal(h.storageTouches, 0);
  assert.equal(h.elements.dialog.open, true);
});

test('connection nonce accepts only 32 through 64 hexadecimal characters', () => {
  for (const length of [31, 32, 64, 65]) {
    const nonce = 'a'.repeat(length);
    const h = harness({ hash: `#tss-connect=${nonce}` });
    assert.equal(h.location.hash, '');
    h.message({ type: 'hello', nonce });
    assert.equal(h.state, length >= 32 && length <= 64 ? 'connected' : 'disconnected');
    assert.equal(h.books.length, 0);
  }
});

test('wrong origin, source, channel or nonce cannot connect or update in-flight state', () => {
  const spoofed = [
    { origin: 'https://tss.ucsd.edu.attacker.example' },
    { source: {} },
    { data: { channel: CHANNEL, nonce: 'f'.repeat(32), type: 'hello' } },
    { data: { channel: 'another-channel', nonce: NONCE, type: 'hello' } },
  ];
  for (const override of spoofed) {
    const h = harness();
    h.message({ type: 'hello' }, override);
    assert.equal(h.state, 'disconnected');
    assert.equal(h.sent.length, 0);
    h.connect(); h.click();
    const previous = h.job;
    const statusOverride = override.data
      ? { data: { ...override.data, type: 'status', status: 'submitted', requestId: h.books[0].data.requestId } }
      : override;
    h.status('submitted', undefined, statusOverride);
    assert.equal(h.job, previous);
    assert.ok(h.buttons.slice(0, 2).every((button) => button.disabled));
  }
});

test('only trusted clicks on captured known booking routes send one command', () => {
  const h = harness(); h.connect();
  h.click(0, { trusted: false }); h.click(2);
  assert.equal(h.books.length, 0);
  const original = h.buttons[0].dataset.bookRoute;
  h.buttons[0].dataset.bookRoute = 'https://untrusted.example/changed';
  h.click(); h.click(); h.click(1);
  assert.equal(h.books.length, 1);
  assert.equal(h.books[0].data.route, original);
  assert.equal(h.books[0].targetOrigin, TSS_ORIGIN);
});

test('one in-flight request locks every Book button; review keeps the lock', () => {
  const h = harness(); h.connect(); h.click();
  assert.ok(h.buttons.slice(0, 2).every((button) => button.disabled));
  h.status('review'); h.click(1);
  assert.match(h.job, /review/i);
  assert.equal(h.books.length, 1);
  h.status('submitted');
  assert.ok(h.buttons.slice(0, 2).every((button) => !button.disabled));
  assert.equal(h.books.length, 1, 'A terminal status never automatically sends another command');
  h.click(1);
  assert.equal(h.books.length, 2);
  assert.notEqual(h.books[0].data.requestId, h.books[1].data.requestId);
});

test('duplicate, regressive and old-request statuses cannot change the current result', () => {
  const h = harness(); h.connect(); h.click();
  const firstId = h.books[0].data.requestId;
  h.status('submitting');
  const writes = h.elements['job-status'].textWrites;
  const text = h.job;
  h.status('submitting'); h.status('loading'); h.status('checking');
  assert.equal(h.job, text);
  assert.equal(h.elements['job-status'].textWrites, writes);
  h.status('submitted');
  const terminal = h.job;
  h.status('error', firstId);
  assert.equal(h.job, terminal);
  h.click(1);
  const second = h.job;
  h.status('submitted', firstId);
  assert.equal(h.job, second);
  assert.ok(h.buttons[1].disabled);
});

test('unknown status or missing final result never triggers an automatic resend', () => {
  const h = harness(); h.keepAlive(); h.connect(); h.click();
  const initial = h.job;
  h.status('success<script>bad()</script>');
  assert.equal(h.job, initial);
  h.advance(120_001);
  assert.equal(h.state, 'disconnected');
  assert.match(h.job, /no final result|check TSS/i);
  assert.equal(h.books.length, 1);
  h.status('submitted'); h.connect(); h.click();
  assert.equal(h.state, 'disconnected');
  assert.equal(h.books.length, 1);
  assert.equal(h.elements.dialog.open, true);
});

test('closed peer and heartbeat loss require fresh activation', () => {
  for (const reason of ['closed', 'heartbeat']) {
    const h = harness(); h.connect();
    if (reason === 'closed') h.peer.closed = true;
    h.advance(reason === 'closed' ? 5_001 : 20_001);
    assert.equal(h.state, 'disconnected');
    h.peer.closed = false;
    h.connect(); h.click();
    assert.equal(h.state, 'disconnected');
    assert.equal(h.books.length, 0);
    assert.equal(h.elements.dialog.open, true);
  }
});

test('disconnect during a request keeps an unknown result and rejects late messages', () => {
  const h = harness(); h.connect(); h.click();
  h.disconnect();
  const message = h.job;
  assert.match(message, /may already have reached TSS/i);
  h.status('submitted'); h.connect(); h.click();
  assert.equal(h.state, 'disconnected');
  assert.equal(h.books.length, 1);
  assert.equal(h.job, message);
});

test('handshake timeout rejects a late hello rather than silently reactivating', () => {
  const h = harness();
  h.advance(15_001); h.connect(); h.click();
  assert.equal(h.state, 'disconnected');
  assert.equal(h.books.length, 0);
  assert.equal(h.sent.filter((message) => message.data.type === 'ack').length, 0);
});

test('page restore or departure invalidates the old connection', () => {
  for (const [type, event] of [['pagehide', {}], ['pageshow', { persisted: true }]]) {
    const h = harness(); h.connect();
    h.emit(type, event); h.connect(); h.click();
    assert.equal(h.state, 'disconnected');
    assert.equal(h.books.length, 0);
    assert.equal(h.elements.dialog.open, true);
  }
});
