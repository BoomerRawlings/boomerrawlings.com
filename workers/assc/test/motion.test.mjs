import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { readLocal } from '../server.mjs';
import { createHandler } from '../handler.mjs';
import { createAuthConfig, MemoryAuthStore } from '../auth.mjs';
import { summarizeKF, filterKFPosts, metrics } from '../client/kf-model.js';
import { kfDefaults, filterAccount, selectedKFMonth, toggleKFMonth, encodeKFRoute, decodeKFRoute } from '../client/kf-state.js';

const source = (await readFile(new URL('../client/app.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '').replace(/\ninit\(\);\r?\n/, '\n');
const kfSource = (await readFile(new URL('../client/kf.js', import.meta.url), 'utf8')).replace(/^import .*\r?\n/gm, '').replace('export async function mountKF', 'async function mountKF');
const emptyCorpus = () => ({ meta: {}, people: [], sources: [], nodes: [], edges: [], events: [], questions: [] });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

class Element {
  constructor(id = '') {
    this.id = id; this.hidden = false; this.inert = false; this.open = false; this.textContent = ''; this.children = [];
    this.dataset = {}; this.listeners = new Map(); this.attributes = new Map(); this.value = ''; this.disabled = false; this.style = {}; this.isConnected = true;
  }
  addEventListener(name, callback, { signal } = {}) { const items = this.listeners.get(name) || []; items.push(callback); this.listeners.set(name, items); signal?.addEventListener('abort', () => this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item !== callback)), { once: true }); }
  emit(name, event = {}) { return Promise.all((this.listeners.get(name) || []).map(callback => callback(event))); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  replaceChildren(...nodes) { this.children = nodes; this.textContent = ''; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  append(...nodes) { this.children.push(...nodes); }
  add(node) { this.append(node); }
  close() { this.open = false; }
  showModal() { this.open = true; }
}

function fixture() {
  const frames = new Map(), observers = []; let nextFrame = 0;
  const elements = new Map();
  const get = selector => { if (!elements.has(selector)) elements.set(selector, new Element(selector.slice(1))); return elements.get(selector); };
  const sections = ['brief', 'bios', 'sources', 'connections', 'timeline', 'kf'].map(id => get(`#${id}`));
  get('.assc-profile .ap-body').id = 'profile-body';
  const navigation = sections.map(section => Object.assign(new Element(), { dataset: { route: section.id } }));
  const subnav = ['index', 'transcripts'].map(sourceTab => Object.assign(new Element(), { dataset: { sourceTab } }));
  const document = {
    body: { hidden: false, inert: false, classList: { contains: () => false } }, title: '',
    querySelector: get,
    querySelectorAll: selector => selector === '.page' ? sections : selector === '.primary-nav a' ? navigation : selector === '[data-source-tab]' ? subnav : [],
    createElement: () => new Element(), createTextNode: value => ({ textContent: value }),
  };
  const window = new Element();
  const reveals = [], cancellations = [];
  window.SiteMotion = { revealScreen: (node, options) => reveals.push({ id: node.id, ...options }), cancelAll: () => cancellations.push(true) };
  const navigations = [];
  const location = { hash: '', href: 'https://boomerrawlings.com/ASSC/', origin: 'https://boomerrawlings.com', assign: path => navigations.push(path), replace: path => navigations.push(path), reload: () => navigations.push('reload') };
  let respond = async () => ({ ok: true, status: 200, json: async () => emptyCorpus() });
  const app = vm.runInNewContext(`${source}\n({ state, route, api, suspendPrivateView, screenForRoute, openTranscript, mountFeature, afterActiveFrame, watchPrivate,
    renderers(overrides) {
      if(overrides.people) renderPeople=overrides.people;
      if(overrides.sources) renderSources=overrides.sources;
      if(overrides.person) showPerson=overrides.person;
      if(overrides.source) showSource=overrides.source;
      if(overrides.transcripts) loadTranscripts=overrides.transcripts;
      if(overrides.reader) renderReader=overrides.reader;
      if(overrides.feature) mountFeature=overrides.feature;
      if(overrides.loader) loadFeatureModule=overrides.loader;
      if(overrides.profile) profileController=overrides.profile;
      arrangeNetworkConsole=()=>{};
    }
  })`, { window, document, location, configurePresentation() {}, history: { replaceState: (_, unused, hash) => { location.hash = hash; } }, fetch: (...args) => respond(...args), URL, URLSearchParams, DOMException, Node: Element, setTimeout, clearTimeout, console,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    MutationObserver: class { constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); } observe(target) { this.target = target; } disconnect() { this.disconnected = true; this.target = null; } },
  }, { filename: 'assc-app.js' });
  app.state.corpus = emptyCorpus();
  app.renderers({ people() {}, sources() {}, person() { get('#detail-dialog').open = true; }, source() { get('#detail-dialog').open = true; }, transcripts: async () => {}, reader() { get('#transcript-reader').textContent = 'synthetic protected transcript'; } });
  let profileOpen = false;
  app.renderers({ profile: { isOpen: () => profileOpen, open: async () => { profileOpen = true; }, closeForRoute() { const wasOpen = profileOpen; profileOpen = false; return wasOpen; }, destroy() { profileOpen = false; } } });
  return { app, window, document, location, get, reveals, cancellations, navigations, frames, observers, respond: callback => { respond = callback; } };
}

test('real hash router reveals only the newly selected meaningful surface', async () => {
  const f = fixture();
  await f.app.route(); assert.equal(f.reveals.length, 0, 'initial load belongs to the gate');
  f.location.hash = '#sources'; await f.app.route();
  assert.deepEqual(f.reveals.at(-1), { id: 'source-index', kind: 'paper', direction: 1 });
  const count = f.reveals.length;
  f.location.hash = '#sources/index'; await f.app.route(); assert.equal(f.reveals.length, count, 'equivalent routes do not animate twice');
  f.location.hash = '#sources/transcripts'; await f.app.route();
  assert.deepEqual(f.reveals.at(-1), { id: 'transcript-library', kind: 'paper', direction: 1 });
  f.location.hash = '#bios/sample'; await f.app.route();
  assert.deepEqual(f.reveals.at(-1), { id: 'profile-body', kind: 'panel', direction: -1 });
});

test('passage, graph-node and timeline-event changes do not replay screen motion', async () => {
  const f = fixture();
  f.app.state.route = 'sources/transcripts/sample'; f.app.state.reader = { id: 'sample' };
  f.location.hash = '#sources/transcripts/sample/turn-two'; await f.app.route();
  f.app.renderers({ feature: async () => ({ resize() {}, focusNode() {}, focusEvent() {} }) });
  f.app.state.motionRoute = f.app.state.route = 'connections/first'; f.location.hash = '#connections/second'; await f.app.route();
  f.app.state.motionRoute = f.app.state.route = 'timeline/first'; f.location.hash = '#timeline/second'; await f.app.route();
  assert.equal(f.reveals.length, 0);
});

test('gate choreography is not stacked and missing enhancement retains native routing', async () => {
  const f = fixture();
  f.app.state.route = 'brief'; f.document.body.classList.contains = name => name === 'gate-body';
  f.location.hash = '#bios'; await f.app.route(); assert.equal(f.reveals.length, 0);
  f.window.SiteMotion = undefined; f.location.hash = '#sources'; await f.app.route();
  assert.equal(f.app.state.route, 'sources'); assert.equal(f.get('#sources').hidden, false);
});

test('a delayed older hash route cannot animate after a newer selection', async () => {
  const f = fixture(), pending = deferred();
  f.app.state.route = 'brief'; f.app.renderers({ feature: () => pending.promise });
  f.location.hash = '#connections'; const older = f.app.route();
  f.location.hash = '#bios'; await f.app.route();
  pending.resolve({ resize() { throw new Error('Stale feature must not resize'); } });
  await older;
  assert.deepEqual(f.reveals.map(item => item.id), ['bios']);
});

test('the sixth screen reveals once while filter-only history updates retain native controls', async () => {
  const f = fixture();
  f.app.state.route = 'brief'; f.app.renderers({ feature: async () => ({}) });
  f.location.hash = '#kf'; await f.app.route();
  assert.deepEqual(f.reveals.at(-1), { id: 'kf', kind: 'instrument', direction: 1 });
  f.location.hash = '#kf?from=2020-01-01&metric=characters'; await f.app.route();
  assert.equal(f.reveals.length, 1);
  assert.equal(f.get('#kf').hidden, false);
});

test('rapid reentry shares one pending feature mount and shutdown removes its listener', async () => {
  const f = fixture(), mounted = deferred();
  let loads = 0, mounts = 0, destroyed = 0, lateRenders = 0;
  f.app.renderers({ loader: async () => {
    loads++;
    return { mountKF: async () => {
      mounts++; const abort = new AbortController();
      f.window.addEventListener('hashchange', () => { lateRenders++; }, { signal: abort.signal });
      await mounted.promise;
      return { destroy() { destroyed++; abort.abort(); } };
    } };
  } });
  f.app.state.route = 'brief';
  f.location.hash = '#kf'; const first = f.app.route();
  await new Promise(resolve => setImmediate(resolve));
  f.location.hash = '#bios'; await f.app.route();
  f.location.hash = '#kf'; const second = f.app.route();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(loads, 1); assert.equal(mounts, 1);
  mounted.resolve(); await Promise.all([first, second]);
  assert.deepEqual(f.reveals.map(item => item.id), ['bios', 'kf']);
  await f.window.emit('pagehide'); await f.window.emit('hashchange');
  assert.equal(destroyed, 1); assert.equal(lateRenders, 0); assert.equal(f.app.state.kf, null);
});

test('a feature module arriving after pagehide is never mounted', async () => {
  const f = fixture(), module = deferred(); let mounts = 0;
  f.app.renderers({ loader: () => module.promise });
  const pending = f.app.mountFeature('graph');
  await f.window.emit('pagehide');
  module.resolve({ mountGraph() { mounts++; return {}; } });
  assert.equal(await pending, null); assert.equal(mounts, 0); assert.equal(f.app.state.graph, null);
});

test('a controller finishing after pagehide is destroyed once and never retained', async () => {
  const f = fixture(), mounted = deferred(); let destroyed = 0;
  f.app.renderers({ loader: async () => ({ mountTimeline: () => mounted.promise }) });
  const pending = f.app.mountFeature('timeline');
  await new Promise(resolve => setImmediate(resolve)); await f.window.emit('pagehide');
  mounted.resolve({ destroy() { destroyed++; } });
  assert.equal(await pending, null); assert.equal(destroyed, 1); assert.equal(f.app.state.timeline, null);
});

test('suspension cancels queued frames and disconnects private DOM observers', async () => {
  const f = fixture(); let mutations = 0;
  f.app.afterActiveFrame(() => { mutations++; });
  f.app.watchPrivate(f.get('#graph-host'), { childList: true }, () => { mutations++; });
  const queued = [...f.frames.values()][0], observer = f.observers[0];
  await f.window.emit('pagehide');
  assert.equal(f.frames.size, 0); assert.equal(observer.disconnected, true);
  queued(); observer.callback();
  f.app.afterActiveFrame(() => { mutations++; });
  assert.equal(f.app.watchPrivate(f.get('#graph-host'), {}, () => { mutations++; }), null);
  assert.equal(mutations, 0); assert.equal(f.frames.size, 0);
});

test('a delayed KF load preserves a newer non-KF route and keeps native filter history', async () => {
  const pending = deferred(), window = new Element(), host = new Element('kf-host'), changes = [];
  const location = { hash: '#kf' };
  const document = { createElement: () => new Element(), createElementNS: () => new Element(), querySelectorAll: () => [] };
  const history = { state: null, pushState(_, unused, hash) { changes.push(hash); location.hash = hash; } };
  const mount = vm.runInNewContext(`${kfSource}\nmountKF`, { document, window, location, history, presentation: { text: {}, subjectLabel: 'Fictional Person', forumProfileIdPrefix: 'fixture-user-' }, Option: class extends Element { constructor(label, value) { super(); this.textContent = label; this.value = value; } }, URL, URLSearchParams, AbortController, setTimeout, matchMedia: () => ({ matches: true }), summarizeKF, filterKFPosts, metrics, kfDefaults, filterAccount, selectedKFMonth, toggleKFMonth, encodeKFRoute, decodeKFRoute });
  const opening = mount(host, { api: () => pending.promise });
  location.hash = '#profile/sample?back=bios';
  pending.resolve({ accounts: [{ id: 'fixture', name: 'Synthetic', names: ['Synthetic'] }], posts: [{ id: 'one', at: '2020-01-01T00:00:00Z', month: '2020-01', account: 'fixture', characters: 3, targets: [], thread: 'fixture' }], coverage: { pages: [1], namespace: ['fixture'], reportedThreadPages: 1 }, diagnostics: {}, method: {} });
  const feature = await opening;
  assert.equal(location.hash, '#profile/sample?back=bios'); assert.deepEqual(changes, []);
  location.hash = '#kf/view?metric=characters'; await window.emit('hashchange');
  assert.equal(location.hash, '#kf/view?metric=characters'); assert.deepEqual(changes, [], 'history restoration does not push a duplicate');
  feature.destroy(); assert.equal(host.children.length, 0);
  assert.equal(window.listeners.get('hashchange').length, 0); assert.equal(window.listeners.get('popstate').length, 0);
});

test('a delayed profile selection cannot reveal after pagehide or restore private search results', async () => {
  const f = fixture(), profile = deferred();
  f.app.state.route = 'brief';
  let destroyed = 0;
  f.app.renderers({ profile: { open: () => profile.promise, isOpen: () => false, destroy: () => destroyed++ } });
  f.app.state.kf = { destroy: () => destroyed++ }; f.app.state.profileIndex = [{ id: 'fixture' }];
  f.get('.console-results').textContent = 'synthetic private result'; f.get('.console-search input').value = 'fixture';
  f.location.hash = '#profile/sample?back=brief'; const pending = f.app.route();
  await f.window.emit('pagehide'); profile.resolve(); await pending;
  assert.equal(destroyed, 2); assert.equal(f.app.state.kf, null); assert.equal(f.app.state.profileIndex, null);
  assert.equal(f.get('.console-results').textContent, ''); assert.equal(f.get('.console-search input').value, '');
  assert.equal(f.reveals.length, 0);
});

test('pagehide conceals and clears private DOM, cancels motion, destroys features and invalidates pending JSON', async () => {
  const f = fixture(), payload = deferred();
  f.respond(async () => ({ ok: true, status: 200, json: () => payload.promise }));
  f.app.state.route = 'brief'; f.location.hash = '#sources/transcripts/sample';
  const request = f.app.route();
  await new Promise(resolve => setImmediate(resolve));
  let destroyed = 0;
  f.app.state.graph = { destroy: () => destroyed++ }; f.app.state.timeline = { destroy: () => destroyed++ };
  f.get('#detail-dialog').open = true; f.get('#detail-content').textContent = 'synthetic private detail';
  await f.window.emit('pagehide');
  payload.resolve({ id: 'sample', turns: [{ text: 'late private payload' }] }); await request;
  assert.equal(f.document.body.hidden, true); assert.equal(f.document.body.inert, true);
  assert.equal(f.app.state.corpus, null); assert.equal(f.app.state.reader, null); assert.equal(destroyed, 2);
  assert.equal(f.get('#detail-dialog').open, false); assert.equal(f.get('#detail-content').textContent, '');
  assert.equal(f.get('#transcript-reader').textContent, ''); assert.equal(f.reveals.length, 0);
  await f.window.emit('pageshow', { persisted: true }); assert.deepEqual(f.navigations, ['reload']);
});

test('successful logout revokes first, then clears without a reveal; late responses cannot repopulate', async () => {
  const f = fixture(), payload = deferred();
  f.respond(async path => path.endsWith('/logout') ? { ok: true, status: 200 } : { ok: true, status: 200, json: () => payload.promise });
  const pending = f.app.api('corpus');
  await new Promise(resolve => setImmediate(resolve));
  await f.get('#logout').emit('click');
  payload.resolve(emptyCorpus()); await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.document.body.hidden, true); assert.deepEqual(f.navigations, ['/ASSC/']); assert.equal(f.reveals.length, 0);
});

test('expired sessions conceal before redirect and do not leave an animating private view', async () => {
  const f = fixture(); f.respond(async () => ({ ok: false, status: 401 }));
  await assert.rejects(f.app.api('corpus'), /session ended/);
  assert.equal(f.document.body.hidden, true); assert.equal(f.app.state.corpus, null);
  assert.deepEqual(f.navigations, ['/ASSC/']); assert.equal(f.reveals.length, 0);
});

test('a delayed logout response cannot navigate after pagehide', async () => {
  const f = fixture(), response = deferred();
  f.respond(() => response.promise);
  const logout = f.get('#logout').emit('click');
  await f.window.emit('pagehide');
  response.resolve({ ok: true, status: 200 }); await logout;
  assert.equal(f.document.body.hidden, true); assert.equal(f.app.state.corpus, null);
  assert.deepEqual(f.navigations, []); assert.equal(f.reveals.length, 0);
});

test('self-contained motion asset is authenticated and compatible with the existing CSP', async () => {
  const read = async name => name === 'client/screen-motion.js' ? readLocal(name) : new Response('fixture');
  const origin = 'https://boomerrawlings.com';
  const handle = createHandler({ read, repository: {}, store: new MemoryAuthStore(), authConfig: await createAuthConfig('synthetic-motion-test'), origin });
  const path = `${origin}/ASSC/client/screen-motion.js`;
  assert.equal((await handle(new Request(path))).status, 401);
  const login = await handle(new Request(`${origin}/ASSC/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'synthetic-motion-test' }) }));
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const asset = await handle(new Request(path, { headers: { Cookie: cookie } }));
  assert.equal(asset.status, 200); assert.match(asset.headers.get('content-type'), /javascript/);
  assert.match(asset.headers.get('cache-control'), /no-store/);
  assert.match(asset.headers.get('content-security-policy'), /script-src 'self'/);
  const generic = await readFile(new URL('../../../public/scripts/screen-motion.js', import.meta.url), 'utf8');
  assert.equal(await asset.text(), generic);
  const html = await readFile(new URL('../client/app.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="\/ASSC\/client\/screen-motion\.js" defer><\/script>/);
  assert.doesNotMatch(html, /data-page-motion|startViewTransition|rel="prefetch"/);
});
