import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createIndex, normalizeImport } from '../public/ACF/model.js';
import { compareTerritories } from '../public/ACF/comparison.js';
import { comparePublications } from '../public/ACF/publication-comparison.js';
import { mapReading } from '../public/ACF/map-reading.js';
import { getRegions } from '../public/ACF/regions.js';

const url = 'https://example.org/source';
function fixture() {
  return createIndex([normalizeImport({ catalog: { label: 'First catalog' }, items: [
    { id: 'left', title: 'AI AI and politics', url },
    { id: 'left2', title: 'Robot minds', url },
    { id: 'right', title: 'Climate', url },
    { id: 'shared', title: 'AI and climate', url },
    { id: 'unmatched', title: 'A different title', url },
  ], people: [{ id: 'bridge', name: 'Same Name' }, { id: 'shared-only', name: 'Shared Credit' }], credits: [
    { itemId: 'left', personId: 'bridge', role: 'author', sourceUrls: [url] },
    { itemId: 'left', personId: 'bridge', role: 'editor', sourceUrls: [url] },
    { itemId: 'right', personId: 'bridge', role: 'speaker', sourceUrls: [url] },
    { itemId: 'shared', personId: 'shared-only', role: 'author', sourceUrls: [url] },
  ], relationships: [
    { from: 'left', to: 'right', kind: 'related_article', sourceUrls: [url] },
    { from: 'left', to: 'left2', kind: 'links_to', sourceUrls: [url] },
    { from: 'shared', to: 'right', kind: 'possibly_same_event', sourceUrls: [url] },
  ] }, 'one'), normalizeImport({ catalog: { label: 'Second catalog' },
    items: [{ id: 'left', title: 'AI', url }], people: [{ id: 'bridge', name: 'Same Name' }],
    credits: [{ itemId: 'left', personId: 'bridge', role: 'author', sourceUrls: [url] }],
  }, 'two')]);
}
const card = (reading, id) => reading.cards.find(entry => entry.id === id);

test('publication reading explains every source cluster without implying subject overlap or identity', () => {
  const index = fixture(), comparison = comparePublications(index, ['one', 'two']);
  const reading = mapReading(index, { comparison });
  assert.deepEqual(reading.cards.map(entry => entry.id), ['publication:one', 'publication:two', 'cross-publication', 'junctions']);
  assert.equal(card(reading, 'publication:one').value, '5 records');
  assert.equal(card(reading, 'publication:two').value, '1 record');
  assert.match(card(reading, 'publication:one').body, /provenance/);
  assert.match(card(reading, 'publication:one').body, /does not establish.*authored or endorsed/);
  assert.match(reading.caption, /^6 unique records across 2 selected source catalogs/);
  assert.equal(card(reading, 'cross-publication').value, '0 recorded links · 0 inferred links');
  assert.match(card(reading, 'cross-publication').body, /no cross-catalog record links/);
  assert.match(card(reading, 'cross-publication').body, /Similar titles, subjects and names do not create a bridge/);
  assert.equal(card(reading, 'junctions').value, '0 names explicitly credited across catalogs');
  assert.match(card(reading, 'junctions').body, /Matching labels in different catalogs stay separate/);
  assert.deepEqual(reading.routes.map(route => [route.id, route.count]), [['credit', 5], ['relationship', 2], ['inferred', 1], ['theme', 0]]);
  assert.match(reading.note, /Title-subject spokes are omitted/);
  assert(reading.cards.every(entry => !entry.regionId && !entry.terms));
});

test('publication reading distinguishes actual cross-source links and keeps empty groups explicit', () => {
  const index = fixture();
  index.relationships.push({ from: 'one:left', to: 'two:left', kind: 'links_to', basis: 'Source link', sourceUrls: [url] });
  const reading = mapReading(index, { comparison: comparePublications(index, ['one', 'two']) });
  assert.equal(card(reading, 'cross-publication').value, '1 recorded links · 0 inferred links');
  assert.match(card(reading, 'cross-publication').body, /explicit record endpoints/);
  const empty = mapReading(index, { comparison: comparePublications(index, ['one', 'two'], { query: 'absent-word' }) });
  assert.equal(card(empty, 'publication:one').value, '0 records');
  assert.equal(card(empty, 'publication:two').value, '0 records');
  assert.match(empty.caption, /^0 unique records across 2/);
  assert(empty.routes.every(route => route.count === 0));
});

test('comparison explains the exact partition without conflating roles, overlap or name identity', () => {
  const index = fixture(), comparison = compareTerritories(index, 'minds', 'planet');
  const reading = mapReading(index, { comparison });
  assert.deepEqual(reading.cards.map(entry => entry.id), ['left', 'shared', 'right', 'junctions']);
  assert.equal(card(reading, 'left').value, '3 records');
  assert.equal(card(reading, 'shared').value, '1 shown once');
  assert.equal(card(reading, 'right').value, '1 record');
  assert.match(reading.caption, /5 unique records/);
  assert.match(card(reading, 'left').body, /other territories/);
  assert.deepEqual(card(reading, 'left').terms, [{ term: 'ai', count: 2 }, { term: 'minds', count: 1 }, { term: 'robot', count: 1 }]);
  assert(!card(reading, 'left').terms.some(term => term.term === 'politics'));
  assert.deepEqual(card(reading, 'shared').terms, [{ term: 'ai', count: 1 }, { term: 'climate', count: 1 }]);
  assert.equal(card(reading, 'junctions').value, '2 names credited in both territories');
  assert.match(card(reading, 'junctions').body, /1 have credits on distinct records/);
  assert.match(card(reading, 'junctions').body, /Shared records alone/);
});

test('route legend totals include internal links while crossing explanation stays separate', () => {
  const index = fixture(), comparison = compareTerritories(index, 'minds', 'planet');
  const reading = mapReading(index, { comparison, layers: { relationships: false, inferred: false, regions: false } });
  assert.deepEqual(reading.routes.map(route => [route.id, route.count]), [['credit', 5], ['relationship', 2], ['inferred', 1], ['theme', 6]]);
  assert.match(card(reading, 'shared').body, /1 recorded and 1 inferred record links cross/);
  assert.match(reading.note, /including links inside each cluster/);
  assert.match(reading.note, /not a confidence score/);
  assert(!reading.routes.some(route => route.body.includes('layer is off')), 'comparison forces route layers on');
});

test('filtered and empty comparisons expose zeroes instead of catalog totals or fabricated connections', () => {
  const index = fixture();
  const filtered = mapReading(index, { comparison: compareTerritories(index, 'minds', 'planet', { query: 'robot' }) });
  assert.equal(card(filtered, 'left').value, '1 record');
  assert.equal(card(filtered, 'shared').value, '0 shown once');
  assert.equal(card(filtered, 'junctions').value, '0 names credited in both territories');
  assert.deepEqual(filtered.routes.map(route => route.count), [0, 0, 0, 1]);
  const empty = mapReading(index, { comparison: compareTerritories(index, 'minds', 'planet', { query: 'absent-word' }) });
  assert.match(empty.caption, /^0 unique records/);
  assert(empty.routes.every(route => route.count === 0));
  assert(empty.cards.every(entry => !entry.terms?.length));
});

test('single territory counts only unique selected rows and never claims the field route count', () => {
  const index = fixture(), left = index.byId.get('one:left'), robot = index.byId.get('one:left2');
  const first = mapReading(index, { region: { regionId: 'minds', total: 999 }, records: [left, left], layers: { relationships: false, inferred: false } });
  assert.equal(card(first, 'territory').value, '1 selected record');
  assert.deepEqual(card(first, 'territory').terms, [{ term: 'ai', count: 1 }]);
  assert(first.routes.every(route => route.count === null && route.body.includes('layer is off')));
  const second = mapReading(index, { region: { regionId: 'minds', total: 999 }, records: [robot], layers: { relationships: false, inferred: false } });
  assert.notEqual(first.key, second.key, 'same count but different matched words must update the reading');
  assert.equal(first.key, mapReading(index, { region: { regionId: 'minds', total: 999 }, records: [left, left], layers: { relationships: false, inferred: false } }).key);
});

test('unmatched and credited-name views preserve their different source meanings', () => {
  const index = fixture();
  const unmatched = mapReading(index, { scope: { kind: 'theme', id: 'unmatched' }, records: [index.byId.get('one:unmatched')] });
  assert.match(card(unmatched, 'territory').body, /other languages/);
  assert.deepEqual(card(unmatched, 'territory').terms, []);
  const person = mapReading(index, { scope: { kind: 'person', id: 'one:person:bridge' }, records: [index.byId.get('one:left')] });
  assert.equal(card(person, 'credits').title, 'Same Name');
  assert.match(card(person, 'credits').body, /author, editor, speaker/);
  assert.match(card(person, 'credits').body, /Matching names in other catalogs stay separate/);
  assert(person.routes.every(route => route.count === null));
});

test('reading adds no classification or source mutation and does not require a graph', () => {
  const index = fixture();
  const before = JSON.stringify(index.items);
  const reading = mapReading(index, { records: index.items });
  assert.equal(card(reading, 'field').value, '6 records in this view');
  assert.equal(card(reading, 'territories').value, '6 subject groups');
  assert.equal(index.graph, undefined);
  assert.equal(JSON.stringify(index.items), before);
  assert(reading.routes.every(route => route.count === null));
  assert.match(card(reading, 'junctions').body, /Hexagonal beacons identify known source or group labels/);
  assert.match(card(reading, 'junctions').body, /Diamonds represent authors and other credited names/);
  assert.match(card(reading, 'junctions').body, /Hollow rings mark inferred title subjects/);
  assert.match(card(reading, 'field').body, /At the overview, select an inferred subject/);
  assert.match(card(reading, 'field').body, /Zoom in to hover over a record/);
});

test('glyph explanation distinguishes bounded connection emphasis from reach and grouping', () => {
  const index = fixture();
  for (const comparison of [null, compareTerritories(index, 'minds', 'planet')]) {
    const reading = mapReading(index, { records: index.items, comparison });
    assert.doesNotMatch(JSON.stringify(reading), /subject suns/i);
    assert.match(reading.nodeNote, /Within each type/);
    assert.match(reading.nodeNote, /unique linked neighbors in the current view/);
    assert.match(reading.nodeNote, /Size is bounded/);
    assert.match(reading.nodeNote, /Title-group spokes are excluded/);
    assert.match(reading.nodeNote, /does not measure readership or influence/);
  }
});

test('built map includes four labeled glyphs and visible names as the resettable initial state', () => {
  const html = readFileSync(new URL('../src/pages/ACF/index.astro', import.meta.url), 'utf8');
  const legend = html.slice(html.indexOf('<div class="node-glyph-key"'), html.indexOf('<p id="map-reading-caption"'));
  assert(html.indexOf('<section id="map-reading"') > html.indexOf('<canvas id="network"'), 'key follows the map');
  assert.equal((legend.match(/<li class="glyph-/g) || []).length, 4);
  assert.equal((legend.match(/<svg[^>]*aria-hidden="true"/g) || []).length, 4);
  for (const label of ['Institutions / publications', 'Authors &amp; credited names', 'Works / source records', 'Inferred subjects']) assert(legend.includes(label));
  assert.match(html, /id="names-toggle"[^>]*\bchecked\b/);
  assert.match(html, /aria-describedby="node-glyph-note"/);
});

const appSource = readFileSync(new URL('../public/ACF/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function appFunction(name) {
  const start = appSource.search(new RegExp(`^function ${name}\\(`, 'm'));
  assert(start >= 0, `Production function ${name} is present`);
  const rest = appSource.slice(start), line = rest.slice(0, rest.indexOf('\n'));
  return line.endsWith('}') ? line : rest.slice(0, rest.indexOf('\n}') + 2);
}

test('graph metadata honors supplied source/name roles while retaining work type and collection', () => {
  const work = { id: 'work', type: 'paper', catalogId: 'catalog' }, source = { id: 'source', catalogId: 'catalog' }, author = { id: 'author', catalogId: 'catalog' };
  const index = { byId: new Map([['work', work]]), people: new Map([['source', source], ['author', author]]), catalogById: new Map([['catalog', { label: 'Public collection' }]]) };
  const data = { nodes: [
    { id: 'work', visualType: 'work', roleLabel: 'Source record' },
    { id: 'source', visualType: 'source', roleLabel: 'Source or group' },
    { id: 'author', visualType: 'person', roleLabel: 'Credited name' },
    { id: 'theme', visualType: 'theme', roleLabel: 'Inferred subject' },
  ] };
  let submitted;
  runInNewContext(`let preparedIndex, preparedFilters, scope = null, records = [work], active = true; ${appFunction('renderGraph')} renderGraph();`, {
    index, work, $: () => ({ value: '' }), subjectScope: () => false, publicationScope: () => false, filters: () => ({}), graphData: () => data,
    label: value => value === 'paper' ? 'Paper' : value, document: { body: { dataset: { view: 'map' } } },
    graph: { setData: value => { submitted = value; }, setActive() {} }, applyRegionSelection() {}, applyLayers() {},
  });
  assert.equal(submitted, data);
  assert.deepEqual(data.nodes.map(node => node.typeLabel), ['Paper', 'Source or group', 'Credited name', 'Inferred subject']);
  assert.equal(data.nodes[0].metaLabel, 'Paper · Public collection');
  assert.equal(data.nodes[1].collectionLabel, 'Public collection');
  assert.equal(data.nodes[1].metaLabel, 'Source or group');
});

// Execute the production handlers with controlled layout offsets. No re-created
// handler logic: these checks cover navigation from the newly inline content.
function inlineHarness({ view = 'map', scope = null, trailsOpen = false, paused = false, reduced = false } = {}) {
  const nodes = new Map(), events = [], index = fixture();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      id, hidden: false, checked: true, value: '', dataset: {}, attributes: {}, children: [], top: 1150, scrollTop: 800,
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; },
      append(...children) { this.children.push(...children); },
      prepend(...children) { this.children.unshift(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener() {},
      focus(options) { events.push(['focus', id, options.preventScroll]); },
      getBoundingClientRect() { return { top: this.top }; },
      scrollTo(options) { events.push(['scroll', options.top, options.behavior]); },
    });
    return nodes.get(id);
  };
  node('main').top = 100; node('graph-stage').top = -650; node('results-heading').top = -500;
  node('region-panel').hidden = !trailsOpen;
  let serial = 0;
  const el = (tag, className, textContent) => Object.assign(node(`generated-${++serial}`), { tag, className, textContent });
  const button = (text, action, className) => Object.assign(el('button', className, text), { action });
  const sandbox = {
    $: node, el, button, index, scopeInput: scope, trailsInput: trailsOpen,
    document: { body: { dataset: { view } } }, mapReading, getRegions,
    uiMotion: { paused, cancel() {}, reveal() {} }, matchMedia: () => ({ matches: reduced }),
    preview: { close() { events.push(['preview:close']); } },
    graph: { focusRecord(id) { events.push(['graph:focus', id]); }, setActive(value) { events.push(['graph:active', value]); } },
    number: value => value.toLocaleString('en-US'), label: value => value,
    sourceLinks: () => [], detailSection: (title, children) => ({ title, children }), revealPanel() {},
    refresh() { events.push(['refresh']); }, scopeLabel: () => 'Selected territory',
  };
  const api = runInNewContext(`
    let scope = scopeInput, comparisonDetailsOpen = trailsInput, selection = 'selected';
    let comparisonResult = null, regionFilters = {}, records = index.items, active = true;
    const regionScope = () => scope?.kind === 'theme';
    const publicationScope = () => scope?.kind === 'publications';
    const comparisonScope = () => scope?.kind === 'compare' || publicationScope();
    const subjectScope = () => regionScope() || scope?.kind === 'compare';
    ${['scrollToBubble', 'openDetail', 'closeDetail', 'closeRecordDetails', 'renderMapReading', 'showItem', 'showPerson'].map(appFunction).join('\n')}
    ({ scrollToBubble, openDetail, closeDetail, closeRecordDetails, renderMapReading, showItem, showPerson,
       state: () => ({ scope, comparisonDetailsOpen, selection }) });
  `, sandbox);
  return { ...api, node, events, index, document: sandbox.document };
}

test('reading follows disabled subject-anchor layers and stays available in List', () => {
  const h = inlineHarness({ view: 'list', scope: { kind: 'theme', id: 'minds' }, trailsOpen: true });
  h.node('regions-toggle').checked = false;
  h.renderMapReading();
  assert.equal(h.node('map-reading').hidden, false);
  assert.equal(h.node('map-evidence').hidden, false);
  assert.equal(h.node('map-evidence').getAttribute('aria-expanded'), 'true');
  const amber = h.node('map-reading-routes').children.find(child => child.className === 'route-bubble route-theme');
  assert.match(amber.children[1].textContent, /This layer is off/);
  const cyan = h.node('map-reading-routes').children.find(child => child.className === 'route-bubble route-credit');
  assert.doesNotMatch(cyan.children[1].textContent, /This layer is off/);
  assert.match(h.node('node-glyph-note').textContent, /unique linked neighbors/);
});

test('inline credited-label detail uses the model role without changing the credit action', () => {
  const h = inlineHarness(), id = 'one:person:bridge';
  h.index.graph = { byId: new Map([[id, { roleLabel: 'Source or group', visualType: 'source' }]]) };
  h.showPerson(id);
  assert.equal(h.node('detail-content').children[0].textContent, 'Source or group / First catalog');
  assert.equal(h.node('detail-content').children[1].textContent, 'Same Name');
  assert.equal(h.state().selection, id);
  assert.equal(h.node('detail').hidden, false);
});

test('inline record details keep source-trail expansion state synchronized', () => {
  const h = inlineHarness({ scope: { kind: 'theme', id: 'minds' }, trailsOpen: true });
  h.openDetail();
  assert.equal(h.node('region-panel').hidden, true);
  assert.equal(h.node('detail').hidden, false);
  assert.equal(h.node('map-evidence').getAttribute('aria-expanded'), 'false');
  h.closeDetail();
  assert.equal(h.node('detail').hidden, true);
  assert.equal(h.node('region-panel').hidden, false);
  assert.equal(h.node('map-evidence').getAttribute('aria-expanded'), 'true');
  assert.equal(h.state().selection, null);
  const unscoped = inlineHarness({ trailsOpen: true });
  unscoped.closeDetail();
  assert.equal(unscoped.node('region-panel').hidden, true, 'An unrelated view cannot reopen stale subject evidence');
  assert.equal(unscoped.node('map-evidence').getAttribute('aria-expanded'), 'false');
});

test('closing inline records returns focus and scroll to the visible Map, List or evidence target', () => {
  for (const [options, focus, top] of [
    [{ view: 'map' }, 'network', 38],
    [{ view: 'list' }, 'results-heading', 188],
    [{ view: 'list', scope: { kind: 'theme', id: 'minds' }, trailsOpen: true }, 'region-close', 1838],
  ]) {
    const h = inlineHarness(options);
    h.closeRecordDetails();
    assert.deepEqual(h.events.filter(event => event[0] === 'focus'), [['focus', focus, true]]);
    assert.deepEqual(h.events.filter(event => event[0] === 'scroll'), [['scroll', top, 'smooth']]);
  }
});

test('Locate from an inline record returns to the actual map viewport and preserves comparison scope', () => {
  for (const scope of [null, { kind: 'compare', ids: ['minds', 'planet'] }, { kind: 'publications', ids: ['one', 'two'] }]) {
    const h = inlineHarness({ view: 'list', scope, trailsOpen: Boolean(scope) });
    const item = { ...h.index.byId.get('one:unmatched'), themes: [] };
    h.showItem(item);
    const locate = h.node('detail-content').children.find(child => child.className === 'locate-record');
    assert(locate, 'The rendered record includes Locate');
    h.events.length = 0;
    locate.action();
    assert.equal(h.document.body.dataset.view, 'map');
    assert.equal(h.node('detail').hidden, true);
    assert.equal(h.node('region-panel').hidden, true);
    assert.equal(h.node('map-view').getAttribute('aria-pressed'), 'true');
    assert.equal(h.node('list-view').getAttribute('aria-pressed'), 'false');
    assert(h.events.some(event => event[0] === 'graph:focus' && event[1] === item.id));
    assert.deepEqual(h.events.slice(-2), [['focus', 'network', true], ['scroll', 38, 'smooth']]);
    assert.equal(h.state().scope, scope, 'Locate retains a comparison rather than changing its grouping');
  }
});

test('inline scrolling respects paused/reduced motion and ignores hidden targets', () => {
  for (const options of [{ paused: true }, { reduced: true }]) {
    const h = inlineHarness(options);
    h.scrollToBubble('graph-stage');
    assert.deepEqual(h.events, [['scroll', 38, 'instant']]);
    h.node('graph-stage').hidden = true;
    h.scrollToBubble('graph-stage');
    assert.equal(h.events.length, 1, 'Hidden content cannot pull the viewport away');
  }
});
