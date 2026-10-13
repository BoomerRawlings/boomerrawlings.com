import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseFragment } from 'parse5';

const source = readFileSync(new URL('../public/ACF/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const markup = readFileSync(new URL('../src/pages/ACF/index.astro', import.meta.url), 'utf8');
const defaults = { 'names-toggle': false, 'labels-toggle': true, 'relationships-toggle': false, 'regions-toggle': true, 'themes-toggle': false };
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(setImmediate);

// Run the production reset orchestration with controlled async catalog and frame
// boundaries. Graph interpolation itself belongs to the graph regression suite.
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'));
  assert(start >= 0, `Missing production function ${name}`);
  const rest = source.slice(start);
  const end = rest.indexOf('\n}');
  if (end >= 0 && !rest.slice(0, rest.indexOf('\n')).endsWith('}')) return rest.slice(0, end + 2);
  return rest.slice(0, rest.indexOf('\n'));
}

function harness({ delayed = false, unavailable = false, initialized = true, preparationPending = false, collectionControls = false, compact = false, paused = true } = {}) {
  const events = [], frames = [], pendingCatalogs = [], ids = new Map();
  const publicData = ['public-one', 'public-two'].map(id => ({ catalog: { id }, items: [{ id: `${id}:record` }] }));
  const localData = { catalog: { id: 'local-one', label: 'Local', coverage: {} }, items: [{ id: 'local-one:record' }] };
  const sessionImports = new Map([[localData.catalog.id, { data: localData, bytes: 150 }]]);
  const catalogs = new Map([[publicData[0].catalog.id, publicData[0]]]);
  const $ = id => {
    if (collectionControls && id === 'load-all-collections' && !ids.has(id)) return null;
    if (!ids.has(id)) ids.set(id, {
      id, value: '', checked: defaults[id] ?? false, defaultChecked: defaults[id] ?? false,
      hidden: false, disabled: false, open: id.endsWith('-dialog'), textContent: '', dataset: {},
      attributes: new Map(),
      children: [], listeners: new Map(),
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      before(node) { ids.set(node.id, node); },
      addEventListener(type, callback) { this.listeners.set(type, callback); },
      emit(type) { return this.listeners.get(type)?.({ currentTarget: this, target: this }); },
      setAttribute(name, value) { this.attributes.set(name, String(value)); },
      getAttribute(name) { return this.attributes.get(name) ?? null; },
      close() { this.open = false; events.push(['dialog:close', id]); },
      focus() { events.push(['focus', id]); },
      scrollIntoView() {},
    });
    return ids.get(id);
  };
  for (const id of ['search', 'type-filter', 'year-from', 'year-to']) $(id).value = 'restricted';
  for (const [id, value] of Object.entries(defaults)) { $(id).checked = !value; $(id).disabled = true; }
  for (const id of ['collections-dialog', 'about-dialog', 'detail', 'region-panel', 'reset-atlas']) $(id);
  const layers = $('map-layers'); layers.open = true; layers.children = [];
  let elementNumber = 0;
  const el = (tag, className, value) => Object.assign($(`fixture-${++elementNumber}`), { tagName: tag.toUpperCase(), className, textContent: value ?? '' });
  const button = (value, action, className) => { const node = el('button', className, value); node.addEventListener('click', action); return node; };
  const document = {
    body: { dataset: { view: 'list', mapExpanded: 'true', comparison: 'true' } },
    getElementById: $,
    querySelector(selector) { return selector === '.map-layers' ? layers : null; },
    querySelectorAll(selector) { return selector.includes('dialog') ? [...ids.values()].filter(node => node.id.endsWith('-dialog') && node.open) : []; },
    dispatchEvent(event) { events.push(['document:event', event.type, plain(event.detail ?? null)]); },
  };
  const location = { pathname: '/ACF/', search: '', hash: '#compare=minds,bodies&item=public-one:record', href: 'https://atlas.test/ACF/#compare=minds,bodies&item=public-one:record' };
  const history = {
    state: { scope: { kind: 'compare', ids: ['minds', 'bodies'] } },
    pushState(state, _unused, path) { this.state = plain(state); location.hash = new URL(path, location.href).hash; events.push(['history:push', path]); },
    replaceState(state, _unused, path) { this.state = plain(state); location.hash = new URL(path, location.href).hash; events.push(['history:replace', path]); },
  };
  const graph = unavailable ? undefined : {
    available: true, paused, comparison: { key: 'minds,bodies' }, selected: 'public-one:record',
    setComparison(value) { this.comparison = value; events.push(['graph:comparison', value]); },
    setRegionSelection(value) { this.regionSelection = value; events.push(['graph:region', value]); },
    setLayers(value) { this.layers = plain(value); events.push(['graph:layers', plain(value)]); },
    setActive(value) { this.active = value; events.push(['graph:active', value]); },
    toggleMotion() { this.paused = !this.paused; events.push(['graph:motion', this.paused]); return this.paused; },
    measure() { events.push(['graph:measure', document.body.dataset.view, catalogs.size]); },
    reset(options) { events.push(['graph:reset', plain(options ?? null)]); },
    resetAtlas(options) { events.push(['graph:resetAtlas', plain(options ?? null)]); },
    dismissPreview() { this.selected = null; events.push(['graph:dismiss']); },
  };
  const uiMotion = {
    paused,
    cancel(node) { events.push(['motion:cancel', node?.id]); },
    reveal(node) { events.push(['motion:reveal', node?.id]); },
    setPaused(value) { this.paused = value; events.push(['motion:paused', value]); },
  };
  const sandbox = {
    $, el, button, document, location, history, graph, uiMotion, catalogs, sessionImports,
    directory: { catalogs: publicData.map(data => ({ id: data.catalog.id, label: data.catalog.id, itemCount: 1 })) },
    cache: new Map(publicData.map(data => [data.catalog.id, Promise.resolve(data)])),
    preview: { close() { events.push(['preview:close']); } },
    layerControls: layers, number: value => value.toLocaleString(),
    clearTimeout(id) { events.push(['timer:clear', id]); },
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
    catalogData(entry) {
      events.push(['catalog:request', entry.id]);
      const data = publicData.find(row => row.catalog.id === entry.id);
      if (!delayed) return Promise.resolve(data);
      return new Promise((resolve, reject) => pendingCatalogs.push({ resolve: () => resolve(data), reject }));
    },
    renderCollections() { events.push(['collections:render']); },
    onRebuild() { events.push(['index:rebuild']); },
    localStorage: { setItem() { assert.fail('Reset must preserve saved data'); }, removeItem() { assert.fail('Reset must preserve saved data'); }, clear() { assert.fail('Reset must preserve saved data'); } },
    sessionStorage: { setItem() { assert.fail('Reset must preserve entrance state'); }, removeItem() { assert.fail('Reset must preserve entrance state'); }, clear() { assert.fail('Reset must preserve entrance state'); } },
    matchMedia: () => ({ matches: compact }),
    CustomEvent: class { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } },
  };
  const context = runInNewContext(`
    let active = true, initialized = ${initialized}, preparationPending = ${preparationPending}, debounce = 23;
    let scope = { kind: 'compare', ids: ['minds', 'bodies'] }, selection = 'public-one:record';
    let regionFilters = { term: 'filtered', sort: 'year' }, comparisonDetailsOpen = true;
    let regionResult = {}, comparisonResult = {}, pageSize = 120, regionPageSize = 60;
    let index = { catalogById: new Map(catalogs), items: [...catalogs.values()].flatMap(data => data.items) }, records = [...index.items];
    let resetting = false, collectionGeneration = 0;
    const comparisonScope = () => scope?.kind === 'compare';
    const regionScope = () => scope?.kind === 'theme';
    const subjectScope = () => regionScope() || comparisonScope();
    function refresh() {
      records = [...index.items]; regionResult = null; comparisonResult = null;
      pageSize = 40; regionPageSize = 20; document.body.dataset.comparison = 'false';
      graph?.setComparison(null); graph?.setRegionSelection(null); applyLayers();
    }
    function rebuild(refreshView = true) {
      onRebuild();
      index = { catalogById: new Map(catalogs), items: [...catalogs.values()].flatMap(data => data.items) };
      if (refreshView) refresh();
    }
    ${functionSource('viewContext')}
    ${functionSource('closeDetail')}
    ${functionSource('applyLayers')}
    ${functionSource('expandMap')}
    ${functionSource('setView')}
    ${collectionControls ? functionSource('renderCollections') : ''}
    ${functionSource('resetAtlas')}
    ({ resetAtlas, renderCollections, snapshot: () => ({ scope, selection, regionFilters, comparisonDetailsOpen, regionResult, comparisonResult, pageSize, regionPageSize, active, initialized, records: records.map(row => row.id) }) });
  `, sandbox, { filename: 'public/ACF/app.js reset harness' });
  return { ...context, $, events, frames, pendingCatalogs, catalogs, sessionImports, localData, graph, document, history, location, layers, uiMotion,
    async frame() { frames.shift()?.(100); await flush(); },
  };
}

test('Reset defaults agree with initial layer controls', () => {
  for (const [id, checked] of Object.entries(defaults)) {
    const input = markup.match(new RegExp(`<input\\b[^>]*\\bid="${id}"[^>]*>`))?.[0];
    assert(input, `Missing ${id}`);
    assert.equal(/\bchecked\b/.test(input), checked, id);
  }
});

test('Header and favicon use the same emblem; Reset remains a separate accessible control', () => {
  const icon = readFileSync(new URL('../public/ACF/icon.svg', import.meta.url), 'utf8');
  const emblem = markup.match(/<svg class="atlas-emblem"[\s\S]*?<\/svg>/)?.[0];
  assert(emblem);
  const geometry = svg => parseFragment(svg).childNodes[0].childNodes
    .filter(node => ['path', 'circle'].includes(node.tagName))
    .map(node => ({ type: node.tagName, ...Object.fromEntries(node.attrs.filter(attr => ['d', 'cx', 'cy', 'r'].includes(attr.name)).map(attr => [attr.name, attr.value])) }));
  assert(geometry(emblem).length >= 4, 'Custom shell, meridians, bearing and poles retained');
  assert.deepEqual(geometry(emblem), geometry(icon), 'Header and tab share one recognizable geometry');
  const header = markup.match(/<header class="atlas-header">[\s\S]*?<\/header>/)?.[0];
  assert.match(header, /<span class="brand-title">The Atlas of Contested Futures<\/span>/);
  assert.match(header, /<button id="reset-atlas"[^>]*type="button"[^>]*disabled[^>]*>[\s\S]*?Reset Atlas<\/button>/);
  assert.match(header, /id="reset-status"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.equal((header.match(/id="reset-atlas"/g) || []).length, 1);
  assert.match(source, /\$\('reset-atlas'\)\.addEventListener\('click', resetAtlas\)/);
});

test('Reset clears filtering, territory/comparison/detail state and URL while preserving the open session', async () => {
  const h = harness();
  await h.resetAtlas();
  await h.frame();
  const state = plain(h.snapshot());
  for (const id of ['search', 'type-filter', 'year-from', 'year-to']) assert.equal(h.$(id).value, '', id);
  assert.equal(state.scope, null);
  assert.equal(state.selection, null);
  assert.deepEqual(state.regionFilters, {});
  assert.equal(state.regionResult, null);
  assert.equal(state.comparisonResult, null);
  assert.equal(state.comparisonDetailsOpen, false);
  assert.equal(h.location.hash, '');
  assert.equal(h.history.state.scope, null, 'History cannot revive the cleared comparison on reload');
  assert.equal(h.document.body.dataset.view, 'map');
  assert.equal(h.document.body.dataset.comparison, 'false');
  assert.equal(state.active, true);
  assert.equal(state.initialized, true);
  assert.match(h.$('reset-status').textContent, /^Atlas reset\./);
  assert(!h.events.some(event => event[0] === 'document:event' && ['acf:exit', 'acf:enter'].includes(event[1])), 'Reset does not replay the entrance');
  assert(h.events.some(event => event[0] === 'timer:clear' && event[1] === 23), 'Pending filter debounce is cancelled');
});

test('Reset restores every public collection and inactive local import without replacing its data', async () => {
  const h = harness();
  await h.resetAtlas();
  assert.deepEqual([...h.catalogs.keys()].sort(), ['local-one', 'public-one', 'public-two']);
  assert.deepEqual(plain(h.snapshot()).records.sort(), ['local-one:record', 'public-one:record', 'public-two:record']);
  assert.equal(h.catalogs.get('local-one'), h.localData, 'Imported object and IDs preserved');
  assert.equal(h.sessionImports.get('local-one').data, h.localData);
  assert.equal(h.sessionImports.get('local-one').bytes, 150, 'Import accounting preserved');
  assert(h.events.some(event => event[0] === 'collections:render'), 'Collection controls update after restoration');
});

test('Reset closes transient UI and restores initial layers with comparison controls enabled', async () => {
  const h = harness();
  await h.resetAtlas();
  for (const id of ['collections-dialog', 'about-dialog']) assert.equal(h.$(id).open, false, id);
  for (const id of ['detail', 'region-panel']) assert.equal(h.$(id).hidden, true, id);
  assert(h.events.some(event => event[0] === 'preview:close'));
  assert.equal(h.layers.open, false);
  assert.equal(h.document.body.dataset.mapExpanded, 'false');
  for (const [id, value] of Object.entries(defaults)) {
    assert.equal(h.$(id).checked, value, id);
    assert.equal(h.$(id).disabled, false, `${id} no longer locked by comparison`);
  }
  assert.deepEqual(h.graph.layers, { names: false, labels: true, relationships: false, regions: true, inferred: false });
  assert.equal(h.$('connections-toggle').disabled, false);
  assert.equal(h.graph.paused, true, 'Explicit motion preference is preserved');
});

test('Reset waits for complete collection restoration and measures the visible map before moving the camera', async () => {
  const h = harness({ delayed: true });
  const reset = h.resetAtlas();
  await flush();
  const cameraCalls = () => h.events.filter(event => /^graph:reset/.test(event[0]));
  assert.equal(cameraCalls().length, 0, 'No camera move over a partial index');
  assert.equal(h.catalogs.size, 1, 'No partially restored catalog set while fetches are pending');
  assert(h.pendingCatalogs.length > 0);
  for (const pending of h.pendingCatalogs) pending.resolve();
  await reset;
  assert.equal(h.catalogs.size, 3);
  assert.equal(cameraCalls().length, 1);
  assert.deepEqual(cameraCalls()[0][1], { smooth: true, universe: true });
  const cameraIndex = h.events.findIndex(event => /^graph:reset/.test(event[0]));
  assert(h.events.slice(0, cameraIndex).some(event => event[0] === 'graph:measure' && event[1] === 'map' && event[2] === 3), 'Camera reads current map dimensions after all collections return');
  assert.equal(h.document.body.dataset.view, 'map');
  assert.equal(h.$('reset-atlas').disabled, false, 'Reset becomes available again');
});

test('Reset remains usable when graphics are unavailable', async () => {
  const h = harness({ unavailable: true });
  await h.resetAtlas();
  await h.frame();
  assert.equal(plain(h.snapshot()).records.length, 3);
  assert.equal(h.location.hash, '');
  assert.equal(h.document.body.dataset.view, 'list');
  assert.equal(h.$('reset-atlas').disabled, false);
});

for (const paused of [false, true]) {
  test(`Phone reset reveals the map with smooth scrolling ${paused ? 'disabled by pause' : 'enabled'}`, async () => {
    const h = harness({ compact: true, paused });
    h.$('main').scrollTop = 83;
    await h.resetAtlas();
    const reveal = h.events.filter(event => event[0] === 'document:event' && event[1] === 'acf:reveal-map');
    assert.deepEqual(reveal, [['document:event', 'acf:reveal-map', { smooth: !paused }]]);
    assert.equal(h.$('main').scrollTop, 83, 'Map reveal helper owns phone viewport positioning');
    assert.equal(h.document.body.dataset.view, 'map');
    assert.equal(h.document.body.dataset.comparison, 'false');
    assert.equal(h.document.body.dataset.mapExpanded, 'false');
    assert.match(h.$('reset-status').textContent, /^Atlas reset\./);
  });
}

for (const options of [{ compact: false }, { compact: true, unavailable: true }]) {
  test(`Reset preserves top-of-workspace behavior outside phone Map: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    h.$('main').scrollTop = 83;
    await h.resetAtlas();
    assert.equal(h.$('main').scrollTop, 0);
    assert(!h.events.some(event => event[0] === 'document:event' && event[1] === 'acf:reveal-map'));
  });
}

test('Failed catalog restoration keeps exploration intact and releases Reset for retry', async () => {
  const h = harness({ delayed: true });
  const original = plain(h.snapshot());
  const originalHash = h.location.hash;
  const reset = h.resetAtlas();
  await flush();
  h.pendingCatalogs[0].reject(new Error('Temporary network failure'));
  for (const pending of h.pendingCatalogs.slice(1)) pending.resolve();
  await reset;
  assert.deepEqual(plain(h.snapshot()), original);
  assert.equal(h.location.hash, originalHash);
  assert.deepEqual([...h.catalogs.keys()], ['public-one']);
  assert.equal(h.$('search').value, 'restricted');
  assert.equal(h.$('reset-atlas').disabled, false);
  assert.equal(h.$('reset-atlas').getAttribute('aria-busy'), 'false');
  assert.match(h.$('reset-status').textContent, /current view is preserved.*again/i);
  assert(!h.events.some(event => /^graph:reset|^history:/.test(event[0])));
  const retry = h.resetAtlas();
  await flush();
  for (const pending of h.pendingCatalogs.slice(2)) pending.resolve();
  await retry;
  assert.equal(h.catalogs.size, 3);
  assert.match(h.$('reset-status').textContent, /^Atlas reset\./);
});

test('Repeated reset clicks share one in-flight restoration', async () => {
  const h = harness({ delayed: true });
  const first = h.resetAtlas();
  await flush();
  await h.resetAtlas();
  assert.equal(h.pendingCatalogs.length, 2, 'Second invocation starts no duplicate catalog requests');
  assert.equal(h.$('reset-atlas').disabled, true);
  for (const pending of h.pendingCatalogs) pending.resolve();
  await first;
  assert.equal(h.events.filter(event => /^graph:reset/.test(event[0])).length, 1);
});

for (const options of [{ initialized: false }, { preparationPending: true }]) {
  test(`Reset waits for initialization/preparation: ${JSON.stringify(options)}`, async () => {
    const h = harness(options), before = plain(h.snapshot());
    await h.resetAtlas();
    assert.deepEqual(plain(h.snapshot()), before);
    assert.equal(h.events.length, 0);
  });
}

for (const failure of [false, true]) {
  test(`An old collection ${failure ? 'failure' : 'response'} cannot overwrite a completed reset`, async () => {
    const h = harness({ delayed: true, collectionControls: true });
    h.renderCollections();
    const check = h.$('collection-options').children[1].children[0];
    check.checked = true;
    const oldChange = check.emit('change');
    const reset = h.resetAtlas();
    await flush();
    for (const pending of h.pendingCatalogs.slice(1)) pending.resolve();
    await reset;
    const state = plain(h.snapshot()), rebuilds = h.events.filter(event => event[0] === 'index:rebuild').length;
    const status = h.$('import-status').textContent;
    if (failure) h.pendingCatalogs[0].reject(new Error('Stale request failed'));
    else h.pendingCatalogs[0].resolve();
    await oldChange;
    assert.deepEqual(plain(h.snapshot()), state);
    assert.equal(h.events.filter(event => event[0] === 'index:rebuild').length, rebuilds, 'Stale callback cannot rebuild the restored map');
    assert.equal(h.$('import-status').textContent, status, 'Stale callback cannot overwrite status');
    assert.equal(h.catalogs.size, 3);
  });
}

test('Collection changes are ignored while reset is restoring the full map', async () => {
  const h = harness({ delayed: true, collectionControls: true });
  h.renderCollections();
  const check = h.$('collection-options').children[0].children[0];
  const reset = h.resetAtlas();
  check.checked = false;
  await check.emit('change');
  assert.equal(check.checked, true);
  assert(h.catalogs.has('public-one'));
  assert.equal(h.pendingCatalogs.length, 2);
  for (const pending of h.pendingCatalogs) pending.resolve();
  await reset;
  assert.equal(h.catalogs.size, 3);
});

test('An old Load all callback cannot rebuild after Reset has restored the full map', async () => {
  const h = harness({ delayed: true, collectionControls: true });
  h.renderCollections();
  const oldLoad = h.$('load-all-collections').emit('click');
  const reset = h.resetAtlas();
  await flush();
  assert.equal(h.pendingCatalogs.length, 4);
  for (const pending of h.pendingCatalogs.slice(2)) pending.resolve();
  await reset;
  const before = plain(h.snapshot()), rebuilds = h.events.filter(event => event[0] === 'index:rebuild').length;
  for (const pending of h.pendingCatalogs.slice(0, 2)) pending.resolve();
  await oldLoad;
  assert.deepEqual(plain(h.snapshot()), before);
  assert.equal(h.events.filter(event => event[0] === 'index:rebuild').length, rebuilds);
  assert.equal(h.$('load-all-collections').disabled, false);
  assert.equal(h.catalogs.size, 3);
});
