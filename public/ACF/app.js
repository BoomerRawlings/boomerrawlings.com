import { AtlasGraph } from './graph.js?v=mapfirst-20261015';
import { NodePreview } from './node-preview.js?v=mapfirst-20261015';
import { createIndex, filterItems, graphData, normalizeImport, validateSessionImport, inferredRelationship, label, safeUrl, THEMES } from './model.js?v=mapfirst-20261015';
import { getRegions, regionFacets } from './regions.js?v=mapfirst-20261015';
import { UIMotion } from './ui-motion.js?v=mapfirst-20261015';
import { compareTerritories } from './comparison.js?v=mapfirst-20261015';
import { mapReading } from './map-reading.js?v=mapfirst-20261015';
import { territoryGuide } from './territory-guide.js?v=mapfirst-20261015';

const $ = id => document.getElementById(id);
const number = n => n.toLocaleString();
const el = (tag, className, value) => { const n = document.createElement(tag); if (className) n.className = className; if (value !== undefined) n.textContent = value; return n; };
const button = (value, action, className = 'text-button') => { const b = el('button', className, value); b.type = 'button'; b.addEventListener('click', action); return b; };
const link = (value, url) => { const a = el('a', 'source-link', value); a.href = safeUrl(url); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
const catalogs = new Map(), cache = new Map();
const sessionImports = new Map();
let directory, index = createIndex([]), records = [], scope = null, selection = null, pageSize = 40, loading, active = false, initialized = false, preparationPending = false, importNumber = 0;
let graph, graphBackend;
let preparedIndex, preparedFilters;
let resumePreparation;
let regionFilters = {}, regionResult = null, regionPageSize = 20, regionNavigationIndex;
let comparisonResult = null, comparisonDetailsOpen = false;
let collectionGeneration = 0, resetting = false;
const regionKeys = ['term', 'overlap', 'collection', 'type', 'year', 'person', 'role', 'sort'];
const regionScope = () => scope?.kind === 'theme';
const comparisonScope = () => scope?.kind === 'compare';
const subjectScope = () => regionScope() || comparisonScope();
const selectedTerritories = () => comparisonScope() ? scope.ids : regionScope() ? [scope.id] : [];
document.addEventListener('acf:entry-targets', event => {
  if (document.body.dataset.view !== 'list') event.detail.points = graph?.entranceTargets() || [];
});
const uiMotion = new UIMotion(document, { active: false });
const revealPanel = (panel, content) => {
  uiMotion.reveal($(panel), { fields: [...$(content).children].filter(node => !node.classList.contains('region-records')) });
  if (panel === 'detail') scrollToBubble(panel);
};
function scrollToBubble(id) {
  const target = $(id), main = $('main');
  if (!target || target.hidden) return;
  const top = Math.max(0, main.scrollTop + target.getBoundingClientRect().top - main.getBoundingClientRect().top - 12);
  main.scrollTo({ top, behavior: uiMotion.paused || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
let previewCountKey, previewCounts = new Map();
function explainedNode(node) {
  if (!node || !comparisonResult || node.kind === 'item') return node;
  if (previewCountKey !== comparisonResult) { previewCountKey = comparisonResult; previewCounts = new Map(); }
  if (!previewCounts.has(node.id)) {
    const side = [comparisonResult.left, comparisonResult.right].find(region => region.id === node.scope?.id);
    const count = side ? side.memberIds.size : new Set((index.byPerson.get(node.id) || []).filter(credit => comparisonResult.memberIds.has(credit.itemId)).map(credit => credit.itemId)).size;
    previewCounts.set(node.id, count);
  }
  return { ...node, count: previewCounts.get(node.id) };
}
const preview = new NodePreview($('graph-stage'), $('network'), () => index, node => node.scope?.kind === 'theme' ? selectTerritory(node.scope.id) : node.scope ? navigate('scope', node.scope) : navigate('item', node.id), {
  onPanStart: event => graph?.pointerDown(event, { panOnly: true }),
  onZoom: node => graph?.focusRecord(node.id),
  onReveal: (card, fields) => uiMotion.reveal(card, { fields }),
  onDismiss: card => uiMotion.cancel(card),
});
try {
  graph = new AtlasGraph($('network'), {
    onZoom: zoom => { $('map-zoom').value = String(Math.log2(zoom)); $('map-zoom').setAttribute('aria-valuetext', zoom.toFixed(1) + ' times overview'); $('map-zoom-value').textContent = zoom.toFixed(1) + '×'; },
    onSelect: (node, anchor) => node?.scope?.kind === 'theme' ? selectTerritory(node.scope.id) : preview.update(explainedNode(node), anchor, 'select'),
    onPreview: (node, anchor, reason) => { if (node?.scope?.kind !== 'theme' || reason !== 'select') preview.update(explainedNode(node), anchor, reason); },
    onStatus: stats => {
      const empty = stats.recordCount > 0 && stats.inViewRecords === 0;
      if ($('empty-map').hidden === empty) $('empty-map').hidden = !empty;
      if (stats.backend !== graphBackend) {
        graphBackend = stats.backend;
        $('graph-fallback-note').hidden = graphBackend !== 'canvas2d';
      }
      const fallback = stats.backend === 'canvas2d' ? 'Canvas 2D fallback · ' : stats.backend === 'unavailable' ? 'Graphics unavailable · ' : '';
      const selected = comparisonScope() ? `${number(records.length)} unique comparison records. ` : regionScope() ? `${number(records.length)} selected / ${number(regionResult?.total || 0)} region members. ` : '';
      const nameSummary = comparisonScope() ? `${number(stats.comparisonNames ?? comparisonResult?.personIds.size ?? 0)} credited-name endpoints in comparison` : `${number(stats.submittedNames || 0)} name points on`;
      $('graph-status').textContent = `${selected}${fallback}${number(stats.submittedRecords || 0)} of ${number(stats.recordCount || index.items.length)} record points submitted · ${number(stats.inViewRecords || 0)} in view. ${nameSummary}; ${number(stats.nameCount || 0)} catalog-local labels available. Overlapping points remain separate records.`;
    },
  });
  if (graph.available === false) throw new Error('Graphics unavailable');
} catch { $('graph-status').textContent = 'Map unavailable. Every record is available in the reading room.'; document.body.dataset.view = 'list'; }

async function fetchJSON(path) {
  await waitForActive();
  const response = await fetch(path, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`The catalog could not load (${response.status}).`);
  // An in-flight body may arrive after Return. Keep its bytes, but defer JSON
  // parsing until the next entry; response.json() cannot pause that parse.
  const contents = await response.text();
  await waitForActive();
  return JSON.parse(contents);
}
async function catalogData(entry) {
  if (!cache.has(entry.id)) cache.set(entry.id, fetchJSON('/ACF/data/' + entry.file).catch(error => { cache.delete(entry.id); throw error; }));
  return cache.get(entry.id);
}
async function waitForActive() {
  // Returning to the riddle pauses unfinished preparation until its next entry.
  // A delayed fetch must not move index/graph work into a repeated letter intro.
  while (!active) {
    // Share one resumption listener across the directory and all catalog bodies.
    resumePreparation ||= new Promise(resolve => document.addEventListener('acf:enter', () => { resumePreparation = null; resolve(); }, { once: true }));
    await resumePreparation;
  }
}
async function yieldPreparation() {
  await new Promise(resolve => setTimeout(resolve, 0));
  await waitForActive();
}
async function start() {
  if (loading) return loading;
  if (initialized) { graph?.setActive(active && document.body.dataset.view !== 'list'); document.dispatchEvent(new CustomEvent('acf:ready')); return; }
  $('dataset-status').textContent = 'Opening all collections…';
  $('load-more').hidden = true;
  preparationPending = true;
  loading = (async () => {
    const began = performance.now();
    try {
      directory ||= await fetchJSON('/ACF/data/index.json');
      await waitForActive();
      // Publish one complete index only after every catalog arrives. Never show
      // a partial load while labelling it the complete map.
      const allData = await Promise.all(directory.catalogs.map(catalogData));
      await waitForActive();
      for (const data of allData) catalogs.set(data.catalog.id, data);
      rebuild(false);
      // Real task boundaries let the still loading screen respond between CPU
      // stages. The final view reuses this cached graph and current controls.
      await yieldPreparation();
      graphData(index, index.items, true);
      getRegions(index);
      await yieldPreparation();
      preparationPending = false;
      renderCollections(); readLocation();
      initialized = true;
      $('import-file').disabled = false;
      $('reset-atlas').disabled = false;
      $('atlas-workspace').dataset.loadMs = (performance.now() - began).toFixed(1);
      document.dispatchEvent(new CustomEvent('acf:ready'));
    } catch (error) {
      // A late failure belongs to the pending load, not a new riddle/intro.
      await waitForActive();
      catalogs.clear(); cache.clear();
      document.body.dataset.view = 'list'; $('map-view').setAttribute('aria-pressed', 'false'); $('list-view').setAttribute('aria-pressed', 'true'); graph?.setActive(false);
      $('dataset-status').textContent = 'Collection unavailable';
      $('graph-status').textContent = 'Unable to load public metadata. Check your connection and retry.';
      $('import-status').textContent = 'Retry loading the public collections to enable local imports.';
      $('results').replaceChildren(el('p', 'error-state', error.name === 'TimeoutError' ? 'The connection took too long.' : error.message), button('Retry loading', () => start(), 'load-more'));
      document.dispatchEvent(new CustomEvent('acf:load-error'));
    } finally { preparationPending = false; loading = null; }
  })();
  return loading;
}
function rebuild(refreshView = true) {
  index = createIndex(catalogs.values());
  const previous = $('type-filter').value;
  const option = el('option', '', 'All types'); option.value = '';
  $('type-filter').replaceChildren(option);
  for (const type of [...new Set(index.items.map(i => i.type))].sort()) { const o = el('option', '', label(type)); o.value = type; $('type-filter').append(o); }
  if ([...$('type-filter').options].some(o => o.value === previous)) $('type-filter').value = previous;
  if (scope?.kind === 'person' && !index.people.has(scope.id)) scope = null;
  if (selection && !index.byId.has(selection) && !index.people.has(selection)) closeDetail();
  $('dataset-status').textContent = `${number(index.items.length)} records · ${number(catalogs.size)} ${catalogs.size === 1 ? 'collection' : 'collections'}`;
  renderScale();
  if (refreshView) refresh();
}
function renderScale() {
  if (!$('scale-bar')) return;
  const counts = new Map();
  for (const item of index.items) counts.set(item.type, (counts.get(item.type) || 0) + 1);
  const groups = [...counts].sort((a,b) => b[1]-a[1]);
  const palette = ['#e3a481','#c6dff1','#a69dde','#b1b9cb','#a77c77','#8eabd1'];
  let offset = 0;
  $('scale-bar').replaceChildren(...groups.map(([type,count],i) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    const width = index.items.length ? count/index.items.length*1000 : 0;
    rect.setAttribute('x',offset);rect.setAttribute('y','0');rect.setAttribute('width',width);rect.setAttribute('height','8');rect.setAttribute('fill',palette[i%palette.length]);
    const title = document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=`${label(type)}: ${number(count)}`;rect.append(title);offset+=width;return rect;
  }));
  $('scale-total').textContent = `${number(index.items.length)} loaded records`;
  const other = groups.slice(3).reduce((sum,g)=>sum+g[1],0);
  $('scale-legend').textContent = groups.slice(0,3).map(([type,count])=>`${label(type)} ${number(count)}`).concat(other ? [`Other formats ${number(other)}`] : []).join(' · ');
  $('scale-bar').setAttribute('aria-label',`Every loaded record by type. ${groups.map(([type,count])=>`${label(type)} ${count}`).join('; ')}. Bar widths are proportional to record counts.`);
}
function filters() { return { query: $('search').value, type: $('type-filter').value, from: $('year-from').value, to: $('year-to').value, scope }; }
function refresh() {
  if (preparationPending) return;
  const began = performance.now();
  comparisonResult = comparisonScope() ? compareTerritories(index, scope.ids[0], scope.ids[1], filters()) : null;
  regionResult = regionScope() ? regionFacets(index, scope.id, { ...regionFilters, query: $('search').value, from: $('year-from').value, to: $('year-to').value, globalType: $('type-filter').value }) : null;
  records = comparisonResult ? comparisonResult.records : regionResult ? regionResult.records : filterItems(index, filters()); pageSize = 40; regionPageSize = 20;
  document.body.dataset.comparison = String(Boolean(comparisonResult));
  renderList(); renderBreadcrumbs(); renderGraph(); renderRegionNavigation();
  if (regionScope() && comparisonDetailsOpen) renderRegionPanel(); else if (comparisonResult && comparisonDetailsOpen) renderComparisonPanel(); else { uiMotion.cancel($('region-panel')); $('region-panel').hidden = true; }
  renderMapReading();
  const filterCount = ['search', 'type-filter', 'year-from', 'year-to'].filter(id => $(id).value).length;
  $('filter-count').hidden = !filterCount;
  $('filter-count').textContent = String(filterCount);
  $('graph-subtitle').textContent = comparisonResult ? 'Two territories, shared records once in the middle. Credits and record links retain their source evidence; other records stay dimmed.' : regionScope() ? 'Territories trace clusters of title matches; borders are illustrative. Exact membership is shown by the selection.' : scope?.kind === 'person' ? 'Documented credits. Names may refer to people, groups or publishing accounts.' : 'Explore overlapping subject territories. Shapes trace clusters of title matches; exact membership appears on selection.';
  $('graph-heading').textContent = subjectScope() ? scopeLabel() : scope?.kind === 'person' ? 'Credits for ' + scopeLabel() : 'A field of possible futures';
  uiMotion.reveal($('graph-heading'), { fields: [], mode: 'view' });
  $('atlas-workspace').dataset.updateMs = (performance.now() - began).toFixed(1);
}
function renderGraph() {
  // Region drilling changes a membership mask only: every original point and
  // position stays in the surrounding field, including unmatched records.
  const fullField = subjectScope() || (!scope && !$('search').value && !$('type-filter').value && !$('year-from').value && !$('year-to').value);
  const key = fullField ? 'full-field' : JSON.stringify(filters());
  if (preparedIndex === index && preparedFilters === key) { applyRegionSelection(); applyLayers(); graph?.setActive(active && document.body.dataset.view !== 'list'); return; }
  const data = graphData(index, fullField ? index.items : records, true);
  for (const node of data.nodes) {
    if (node.typeLabel) continue;
    const item = index.byId.get(node.id), person = index.people.get(node.id);
    node.typeLabel = item ? label(item.type) : node.roleLabel || (node.visualType === 'source' ? 'Source or group' : person ? 'Credited name' : 'Inferred subject');
    node.collectionLabel = index.catalogById.get((item || person)?.catalogId)?.label || 'Loaded collections';
    node.metaLabel = item ? node.typeLabel + ' · ' + node.collectionLabel : node.typeLabel;
  }
  graph?.setData(data); applyRegionSelection(); applyLayers(); graph?.setActive(active && document.body.dataset.view !== 'list');
  preparedIndex = index; preparedFilters = key;
  if (!records.length && !subjectScope()) $('graph-status').textContent = 'No records in this view. Try fewer filters.';
}
function applyRegionSelection() {
  if (!comparisonScope()) graph?.setComparison?.(null);
  graph?.setRegionSelection?.(regionScope() ? new Set(records.map(item => item.id)) : null, { id: scope?.id, label: scopeLabel(), total: regionResult?.total || 0 });
  if (comparisonScope()) graph?.setComparison?.(comparisonResult);
}
function applyLayers() {
  graph?.setLayers({ names: $('names-toggle').checked, labels: $('labels-toggle').checked, relationships: $('relationships-toggle').checked, regions: $('regions-toggle').checked, inferred: $('themes-toggle').checked });
  const connected = $('relationships-toggle').checked || $('themes-toggle').checked;
  $('connections-toggle').setAttribute('aria-pressed', String(comparisonScope() || connected));
  $('connections-toggle').textContent = comparisonScope() ? 'Comparison routes on' : connected ? 'Hide connections' : 'Show connections';
  $('connections-toggle').disabled = comparisonScope();
  for (const id of ['names-toggle', 'labels-toggle', 'relationships-toggle', 'regions-toggle', 'themes-toggle']) $(id).disabled = comparisonScope();
  uiMotion.reveal($('connections-toggle'), { key: comparisonScope() ? 'comparison' : String(connected), fields: [] });
}
function renderMapReading() {
  const guide = $('map-reading');
  const data = mapReading(index, { comparison: comparisonResult, region: regionScope() ? getRegions(index).byId.get(scope.id) : null, records, scope,
    layers: { names: $('names-toggle').checked, relationships: $('relationships-toggle').checked, inferred: $('themes-toggle').checked, regions: $('regions-toggle').checked } });
  $('map-evidence').hidden = !subjectScope();
  $('map-evidence').setAttribute('aria-expanded', String(comparisonDetailsOpen && !$('region-panel').hidden));
  if (guide.dataset.readingKey === data.key) return;
  uiMotion.cancel(guide); guide.dataset.readingKey = data.key;
  $('map-reading-caption').textContent = data.caption;
  $('map-reading-cards').replaceChildren(...data.cards.map(card => {
    const bubble = el('article', 'map-bubble' + (card.regionId ? ' region-' + card.regionId : ''));
    bubble.dataset.readingId = card.id;
    bubble.append(el('p', 'map-bubble-eyebrow', card.eyebrow), el('h3', '', card.title), el('p', 'map-bubble-value', card.value), el('p', 'map-bubble-copy', card.body));
    if (card.terms?.length) {
      const terms = el('p', 'map-bubble-terms');
      terms.append(el('span', '', 'Matched title words '));
      for (const term of card.terms) terms.append(el('span', 'map-term', `“${term.term}” · ${number(term.count)}`));
      bubble.append(terms);
    }
    return bubble;
  }));
  $('map-reading-routes').replaceChildren(...data.routes.map(route => {
    const bubble = el('details', 'route-bubble route-' + route.id), summary = el('summary');
    summary.append(el('i'), el('span', '', route.label), el('span', 'route-bubble-count', route.count === null ? 'Read key' : number(route.count)));
    bubble.append(summary, el('p', '', route.body));
    bubble.addEventListener('toggle', () => { if (bubble.open) uiMotion.reveal(bubble, { fields: [...bubble.children].slice(1) }); else uiMotion.cancel(bubble); });
    return bubble;
  }));
  $('map-reading-note').textContent = data.note;
  $('node-glyph-note').textContent = data.nodeNote;
  uiMotion.reveal(guide, { key: data.key, fields: [...$('map-reading-cards').children], mode: 'view' });
}
function renderRegionNavigation() {
  const data = getRegions(index);
  if (regionNavigationIndex !== index) {
    $('region-memberships').replaceChildren(...data.regions.map(region => {
      const b = button('', () => selectTerritory(region.id), 'region-choice region-' + region.id);
      b.dataset.regionId = region.id;
      b.append(el('span', 'region-name', region.label), el('span', 'region-count', number(region.memberIds.size)));
      return b;
    }));
    $('region-union').textContent = `${number(data.unionIds.size)} unique title-matched · ${number(data.unmatchedIds.size)} unmatched. Memberships overlap; counts are unique records within each group.`;
    const placeholder = el('option', '', 'Choose a territory'); placeholder.value = '';
    $('comparison-picker').replaceChildren(placeholder, ...data.regions.map(region => { const option = el('option', '', region.label); option.value = region.id; return option; }));
    regionNavigationIndex = index;
  }
  const ids = selectedTerritories();
  const guide = territoryGuide({ selectedIds: ids, byId: data.byId, comparison: comparisonResult });
  $('territory-comparison').dataset.phase = guide.phase;
  $('territory-guide-title').textContent = guide.title;
  $('territory-guide-body').textContent = guide.body;
  uiMotion.reveal($('territory-guide-title'), { key: guide.title, fields: [], mode: 'view' });
  for (const b of $('region-memberships').children) {
    const selected = ids.includes(b.dataset.regionId);
    const changed = b.getAttribute('aria-pressed') !== String(Boolean(selected));
    b.setAttribute('aria-pressed', String(Boolean(selected)));
    if (selected && changed) uiMotion.reveal(b);
  }
  $('comparison-selected').replaceChildren(...ids.map(id => {
    const region = data.byId.get(id), chip = button(region.label + ' ×', () => selectTerritory(id), 'comparison-chip region-' + id);
    chip.setAttribute('aria-label', 'Remove ' + region.label + ' from selection'); return chip;
  }));
  uiMotion.reveal($('comparison-selected'), { key: ids.join(',') });
  $('comparison-picker-label').textContent = guide.pickerLabel;
  $('comparison-picker').options[0].textContent = guide.pickerPlaceholder;
  for (const option of $('comparison-picker').options) option.disabled = ids.includes(option.value);
  $('comparison-picker').value = '';
  $('comparison-clear').hidden = !ids.length;
  $('comparison-details').hidden = false;
  $('comparison-example').hidden = Boolean(ids.length);
  $('comparison-hint').textContent = comparisonResult ? `${number(comparisonResult.leftOnly.size)} first only · ${number(comparisonResult.shared.size)} shared once · ${number(comparisonResult.rightOnly.size)} second only. Group and connection explanations sit below the map.` : ids.length ? 'Select a second territory to compare. Read how this territory is grouped below the map.' : 'Select one territory, then another, to separate their clusters and inspect what connects them.';
  uiMotion.reveal($('comparison-hint'), { key: comparisonResult?.key || ids.join(','), fields: [], mode: 'view' });
}
function setRegionFacet(key, value) {
  history.replaceState(viewContext(), '', location.href);
  if (value) regionFilters[key] = value; else delete regionFilters[key];
  const params = new URLSearchParams({ theme: scope.id, ...regionFilters });
  history.pushState(viewContext(), '', '#' + params); closeDetail(); refresh();
  $('region-facet-' + key)?.focus({ preventScroll: true });
}
function facetSelect(key, title, rows, all = 'All') {
  const wrap = el('label', 'region-facet'), select = el('select'); select.id = 'region-facet-' + key; select.setAttribute('aria-label', title);
  wrap.append(el('span', '', title), select);
  const option = (value, title) => { const o = el('option', '', title); o.value = value; return o; };
  const fillOptions = query => {
    const matches = rows.filter(row => !query || row.label.toLocaleLowerCase().includes(query));
    const shown = key === 'person' ? matches.slice(0, 80) : matches;
    select.replaceChildren(option('', all));
    for (const row of shown) select.append(option(String(row.id), `${row.label} · ${number(row.count)}`));
    if (regionFilters[key] && !shown.some(row => String(row.id) === regionFilters[key])) { const row = rows.find(r => String(r.id) === regionFilters[key]); select.append(option(regionFilters[key], row ? `${row.label} · ${number(row.count)}` : regionFilters[key] + ' · 0')); }
    select.value = regionFilters[key] || '';
    if (key === 'person') hint.textContent = `Showing ${number(shown.length)} of ${number(matches.length)} matching labels. Type a name or collection to narrow all ${number(rows.length)}.`;
  };
  let hint;
  if (key === 'person') {
    const search = el('input'); search.type = 'search'; search.placeholder = 'Find a credited name'; search.setAttribute('aria-label', 'Find a catalog-local credited name');
    hint = el('span', 'region-note'); select.before(search); wrap.append(hint);
    search.addEventListener('input', () => fillOptions(search.value.trim().toLocaleLowerCase()));
  }
  fillOptions('');
  select.addEventListener('change', () => setRegionFacet(key, select.value)); return wrap;
}
function lazyRegionSection(title, populate) {
  const section = el('details', 'region-section'); section.append(el('summary', '', title));
  let populated = false;
  section.addEventListener('toggle', () => {
    if (section.open) {
      if (!populated) { populated = true; populate(section); }
      uiMotion.reveal(section, { fields: [...section.children].slice(1) });
    } else uiMotion.cancel(section);
  });
  return section;
}
function regionPagedRows(container, rows, render, size = 12) {
  const list = el('div'), more = button('Show more', () => append(), 'load-more'); let shown = 0;
  const append = () => {
    const previous = shown;
    const next = Math.min(shown + size, rows.length);
    for (; shown < next; shown++) list.append(render(rows[shown]));
    more.hidden = shown === rows.length;
    more.textContent = `Show ${Math.min(size, rows.length - shown)} more (${number(shown)} of ${number(rows.length)})`;
    if (previous) uiMotion.reveal(list, { fields: [...list.children].slice(previous) });
  };
  container.append(list, more); append();
}
function renderRegionPanel() {
  const data = regionResult, region = getRegions(index).byId.get(scope.id), content = $('region-content');
  if (!region || !data) return;
  const regionChanged = $('region-panel').dataset.regionId !== region.id;
  const previousSameRegionOpen = !regionChanged && content.querySelector('.region-filters')?.open;
  uiMotion.cancel($('region-panel'));
  $('region-panel').hidden = false;
  $('region-panel').dataset.regionId = region.id;
  $('region-panel').dataset.memberCount = String(data.total);
  $('region-panel').dataset.selectedCount = String(records.length);
  $('region-panel').setAttribute('aria-label', 'Selected territory');
  content.replaceChildren(el('p', 'detail-kicker', region.id === 'unmatched' ? 'Unmatched titles · preserved' : 'Title-word region · inferred'), el('h2', 'detail-title', region.label));
  content.append(el('p', 'region-total', `${number(records.length)} selected of ${number(data.total)} unique region records. ${number(index.items.length)} record points remain in the field.`));
  content.append(el('p', 'detail-note', region.id === 'unmatched' ? 'No current English title-keyword match. This includes titles in other languages and ambiguous or missing titles; it does not mean these records lack a theme.' : 'Territories trace clusters of title matches; borders are illustrative. Exact membership is shown by the selection. Literal title words determine membership, which may overlap; shapes establish no objective taxonomy, affiliation, agreement, citation or influence.'));
  const controls = el('details', 'region-section region-filters');
  controls.open = previousSameRegionOpen || Object.keys(regionFilters).some(key => key !== 'sort');
  controls.append(el('summary', '', 'Combine facets & inspect counts'));
  controls.append(el('p', 'region-note', 'Each count uses unique records in the current selection. Filters combine with search and record years. Collections identify provenance; names stay catalog-local.'));
  let facetsPrepared = false;
  const prepareFacets = () => {
    if (facetsPrepared) return; facetsPrepared = true;
    const grid = el('div', 'region-facet-grid');
    grid.append(facetSelect('term', 'Literal matched word', data.terms), facetSelect('overlap', 'Overlapping theme', data.overlaps), facetSelect('collection', 'Collection', data.collections), facetSelect('type', 'Record type', data.types), facetSelect('year', 'Record year / unknown', data.years), facetSelect('person', 'Credited name / collection', data.people.map(p => ({ ...p, label: p.label + ' / ' + p.catalogLabel }))), facetSelect('role', 'Credit role', data.roles));
    const clear = button('Clear region facets', () => {
      history.replaceState(viewContext(), '', location.href); regionFilters = {};
      history.pushState(viewContext(), '', '#theme=' + encodeURIComponent(scope.id)); refresh();
      $('region-clear-facets')?.focus({ preventScroll: true });
    }, 'credit-chip');
    clear.id = 'region-clear-facets'; controls.append(grid, clear);
  };
  controls.addEventListener('toggle', () => {
    if (controls.open) { prepareFacets(); uiMotion.reveal(controls, { fields: [...controls.children].slice(1) }); }
    else uiMotion.cancel(controls);
  });
  if (controls.open) prepareFacets();
  content.append(controls);
  const overlaps = el('p', 'region-note', 'Overlaps in selection: ' + (data.overlaps.length ? data.overlaps.map(row => `${row.label} ${number(row.count)}`).join(' · ') : 'none'));
  content.append(overlaps);
  const order = el('label', 'region-facet region-sort'), sort = el('select'); sort.id = 'region-facet-sort';
  for (const [value, title] of [['date-desc','Date: newest first'],['date-asc','Date: oldest first'],['title-asc','Title: A–Z'],['title-desc','Title: Z–A']]) { const o = el('option', '', title); o.value = value; sort.append(o); }
  sort.value = regionFilters.sort || 'date-desc'; sort.addEventListener('change', () => setRegionFacet('sort', sort.value)); order.append(el('span', '', 'Browse actual records'), sort); content.append(order);
  content.append(el('p', 'region-note', 'Dates use source metadata; meaning and precision remain in each record detail. Unknown dates follow dated records. No importance ranking or generated summaries.'));
  const resultList = el('div', 'region-records'); resultList.id = 'region-records'; content.append(resultList);
  regionPagedRows(resultList, records, item => {
    const card = recordCard(item), terms = item.themeEvidence.filter(e => region.id === 'unmatched' || e.themeId === region.id).flatMap(e => e.terms);
    card.append(el('span', 'record-match', terms.length ? `Literal title match: ${[...new Set(terms)].map(t => '“' + t + '”').join(', ')}` : 'No current title-keyword match'));
    return card;
  }, regionPageSize);
  if (!records.length) resultList.append(el('p', 'detail-note', 'No records match this combination. Clear region facets or the global search/year filters.'));
  content.append(lazyRegionSection(`Credited names & roles · ${number(data.people.length)} catalog-local labels`, section => {
    section.append(el('p', 'region-note', 'Counts are unique selected records per name and role. Multiple roles on one record count once for the name. Labels and source credits do not prove identity or membership.'));
    const selectedIds = new Set(records.map(item => item.id));
    regionPagedRows(section, data.people, p => {
      const row = el('div', 'region-person');
      row.append(button(`${p.label} / ${p.catalogLabel} · ${number(p.count)} records`, () => setRegionFacet('person', p.id), 'related-record'), el('p', 'region-note', p.roles.map(role => `${role.label} ${number(role.count)}`).join(' · ')));
      const credits = (index.byPerson.get(p.id) || []).filter(c => selectedIds.has(c.itemId));
      row.append(...sourceLinks(credits.flatMap(c => c.sourceUrls || []).slice(0, 5))); return row;
    });
  }));
  content.append(lazyRegionSection('Documented neighbor connections & source basis', section => {
    const selected = new Set(records.map(item => item.id));
    const relations = new Set();
    for (const id of selected) for (const r of index.relationshipsByItem.get(id) || []) if (!inferredRelationship(r)) relations.add(r);
    const neighbors = new Set();
    for (const r of relations) for (const id of [r.from, r.to]) if (!selected.has(id)) neighbors.add(id);
    section.append(el('p', 'region-note', `${number(relations.size)} documented relationship assertions involving the selection; ${number(neighbors.size)} unique records outside it. Source relations retain their stated basis; a link alone is not a citation or influence claim.`));
    const rows = [...relations].sort((a, b) => index.byId.get(a.from).title.localeCompare(index.byId.get(b.from).title) || index.byId.get(a.to).title.localeCompare(index.byId.get(b.to).title));
    regionPagedRows(section, rows, r => {
      const row = el('div', 'region-relation');
      row.append(button(index.byId.get(r.from).title, () => navigate('item', r.from), 'related-record'), el('p', 'region-note', '→ ' + label(r.kind)), button(index.byId.get(r.to).title, () => navigate('item', r.to), 'related-record'), el('p', 'detail-note', 'Documented basis: ' + (r.basis || 'Source assertion; unspecified relationship basis.')), ...sourceLinks(r.sourceUrls || [])); return row;
    });
  }));
  if (regionChanged) $('region-panel').scrollTop = 0;
  revealPanel('region-panel', 'region-content');
}
function renderComparisonPanel() {
  const data = comparisonResult, panel = $('region-panel'), content = $('region-content');
  if (!data) return;
  const changed = panel.dataset.regionId !== 'compare:' + data.key;
  uiMotion.cancel(panel); panel.hidden = false;
  panel.dataset.regionId = 'compare:' + data.key;
  panel.dataset.memberCount = panel.dataset.selectedCount = String(data.memberIds.size);
  panel.setAttribute('aria-label', 'Territory comparison evidence');
  content.replaceChildren(el('p', 'detail-kicker', 'Two territories · source evidence'), el('h2', 'detail-title', data.left.label + ' ↔ ' + data.right.label));
  const counts = el('div', 'comparison-counts');
  for (const [count, text] of [[data.leftOnly.size, data.left.label + ' only'], [data.shared.size, 'Shared · shown once'], [data.rightOnly.size, data.right.label + ' only']]) {
    const cell = el('div'); cell.append(el('strong', '', number(count)), el('span', '', text)); counts.append(cell);
  }
  content.append(counts, el('p', 'region-note', 'This is a temporary comparison layout. Shared records appear once between the two clusters; other records remain dimmed. Search, type, year and collection filters apply to both sides.'), el('p', 'region-total', `${number(data.counts.documentedRelationships)} documented cross-territory record links · ${number(data.counts.inferredRelationships)} inferred links.`), el('p', 'region-note', `${number(data.counts.directRelationships)} links join exclusive sides; ${number(data.counts.viaSharedRelationships)} pass through shared records. Source-recorded links include editorial related-article cards; they are not necessarily citations, agreement or influence.`), el('p', 'region-total', `${number(data.sharedPeople.length)} catalog-local names credited in both territories.`), el('p', 'region-note', `${number(data.counts.creditBridges)} names have credits on distinct records in both exclusive sides. Other shared names may be credited only on overlapping records. Names are kept separate across catalogs; a shared label does not establish verified identity.`));
  const recordSection = (title, rows) => lazyRegionSection(title + ' · ' + number(rows.length), section => {
    if (!rows.length) section.append(el('p', 'region-note', 'No records match this part of the comparison.'));
    else regionPagedRows(section, rows, recordCard);
  });
  content.append(recordSection('Shared records in the bridge', data.sharedRecords), recordSection(data.left.label + ' only', data.records.filter(item => data.leftOnly.has(item.id))), recordSection(data.right.label + ' only', data.records.filter(item => data.rightOnly.has(item.id))));
  content.append(lazyRegionSection('Credits in both territories · ' + number(data.sharedPeople.length) + ' catalog-local names', section => {
    if (!data.sharedPeople.length) section.append(el('p', 'region-note', 'No catalog-local name has source credits in both selections.'));
    regionPagedRows(section, data.sharedPeople, person => {
      const row = el('div', 'region-person');
      row.append(el('strong', '', person.label + ' / ' + person.catalogLabel), el('p', 'region-note', `${data.left.label}: ${number(person.leftCount)} records; ${data.right.label}: ${number(person.rightCount)}. ${number(person.sharedCount)} shared records count in both totals.`), el('p', 'region-note', `Exclusive-side records: ${number(person.leftExclusiveCount)} first, ${number(person.rightExclusiveCount)} second.`));
      row.append(lazyRegionSection('Inspect source roles and records', evidence => {
        const credits = [...new Map([...person.leftCredits, ...person.rightCredits].map(credit => [credit.itemId + '\u0000' + credit.role, credit])).values()];
        regionPagedRows(evidence, credits, credit => {
          const item = index.byId.get(credit.itemId), block = el('div', 'region-relation');
          const side = data.shared.has(credit.itemId) ? 'Shared record' : data.leftOnly.has(credit.itemId) ? data.left.label : data.right.label;
          block.append(button(item?.title || 'Source record', () => item && navigate('item', item.id), 'related-record'), el('p', 'region-note', side + ' · ' + label(credit.role)), ...sourceLinks(credit.sourceUrls || [])); return block;
        }, 6);
      }));
      return row;
    }, 6);
  }));
  content.append(lazyRegionSection('Cross-territory record links & their source basis · ' + number(data.relationships.length), section => {
    if (!data.relationships.length) section.append(el('p', 'region-note', 'No source-recorded or inferred record links cross these selections in the loaded metadata. Shared title words alone do not create a record-to-record link.'));
    regionPagedRows(section, data.relationships, relation => {
      const row = el('div', 'region-relation'), from = index.byId.get(relation.from), to = index.byId.get(relation.to);
      row.append(el('p', 'detail-kicker', (relation.inferred ? 'Inferred' : 'Source recorded') + ' · ' + (relation.bridgeType === 'direct' ? 'Exclusive sides' : 'Through shared record')), button(from?.title || 'Source record', () => from && navigate('item', from.id), 'related-record'), el('p', 'region-note', '→ ' + label(relation.kind)), button(to?.title || 'Related record', () => to && navigate('item', to.id), 'related-record'), el('p', 'detail-note', 'Basis: ' + (relation.basis || 'Unspecified in source metadata.')), ...sourceLinks(relation.sourceUrls || []));
      return row;
    }, 8);
  }));
  if (changed) panel.scrollTop = 0;
  revealPanel('region-panel', 'region-content');
}
function recordCard(item) {
  const card = button('', () => navigate('item', item.id), 'record-card');
  card.dataset.recordId = item.id;
  card.append(el('span', 'record-type', label(item.type)), el('span', 'record-title', item.title));
  const names = [...new Set((index.byItem.get(item.id) || []).map(c => index.people.get(c.personId)?.name).filter(Boolean))];
  card.append(el('span', 'record-people', names.length ? names.slice(0, 3).join(' · ') + (names.length > 3 ? ` +${names.length - 3}` : '') : 'No resolved byline'));
  card.append(el('span', 'record-meta', [item.date ? item.date.slice(0, 10) : item.dateRaw || 'Date unknown', index.catalogById.get(item.catalogId)?.label].filter(Boolean).join(' / ')));
  return card;
}
function renderList(revealFrom = 0) {
  uiMotion.cancel($('results'));
  $('results-count').textContent = number(records.length);
  $('results-heading').textContent = scope ? scopeLabel() : 'Explore the collection';
  $('results').replaceChildren(...records.slice(0, pageSize).map(recordCard));
  if (!records.length) {
    const invalidYears = $('year-from').value && $('year-to').value && +$('year-from').value > +$('year-to').value;
    $('results').append(el('p', 'empty-state', invalidYears ? 'The starting year is after the ending year.' : 'No records found. Try a broader search or clear your filters.'), button('Clear filters', clearFilters));
  }
  $('load-more').hidden = pageSize >= records.length;
  $('load-more').textContent = `Show ${Math.min(40, Math.max(0, records.length - pageSize))} more records ↓`;
  uiMotion.reveal($('results'), { fields: [...$('results').children].slice(revealFrom) });
}
function clearFilters() { for (const id of ['search', 'type-filter', 'year-from', 'year-to']) $(id).value = ''; scope = null; regionFilters = {}; selection = null; comparisonDetailsOpen = false; closeDetail(); history.pushState(viewContext(), '', location.pathname); refresh(); }
async function resetAtlas() {
  if (!initialized || preparationPending || resetting) return;
  resetting = true;
  ++collectionGeneration;
  clearTimeout(debounce);
  const control = $('reset-atlas');
  control.disabled = true;
  control.setAttribute('aria-busy', 'true');
  $('reset-status').textContent = 'Restoring the full Atlas…';
  try {
    // Resolve every catalog before touching the current exploration. A failed
    // fetch leaves its records, filters, URL and camera intact for a retry.
    const allData = await Promise.all(directory.catalogs.map(catalogData));
    for (const data of allData) catalogs.set(data.catalog.id, data);
    for (const { data } of sessionImports.values()) catalogs.set(data.catalog.id, data);
    clearTimeout(debounce);
    for (const id of ['search', 'type-filter', 'year-from', 'year-to']) $(id).value = '';
    scope = null; regionFilters = {}; selection = null;
    regionResult = null; comparisonResult = null; comparisonDetailsOpen = false;
    preview.close(); closeDetail();
    for (const name of ['collections', 'about']) {
      const dialog = $(name + '-dialog');
      uiMotion.cancel(dialog);
      if (dialog.open) dialog.close();
    }
    $('map-layers').open = false;
    $('explore-tools').open = false;
    $('map-perspectives').open = false;
    for (const id of ['names-toggle', 'labels-toggle', 'relationships-toggle', 'regions-toggle', 'themes-toggle']) $(id).checked = $(id).defaultChecked;
    history.replaceState(viewContext(), '', location.pathname + location.search);
    const changed = index.catalogById.size !== catalogs.size;
    // Reuse the prepared full field when all catalogs were already present;
    // comparison stars can then glide back into their original positions.
    if (changed) rebuild(false);
    renderCollections();
    expandMap(false);
    setView(graph?.available === false || !graph ? 'list' : 'map');
    refresh();
    if (document.body.dataset.view === 'list' || !matchMedia('(max-width: 680px)').matches) $('main').scrollTop = 0;
    else document.dispatchEvent(new CustomEvent('acf:reveal-map', { detail: { smooth: !uiMotion.paused } }));
    graph?.measure?.();
    graph?.reset({ smooth: true, universe: true });
    $('dataset-status').textContent = `${number(index.items.length)} records · ${number(catalogs.size)} collections`;
    $('reset-status').textContent = `Atlas reset. ${number(index.items.length)} records across all ${number(catalogs.size)} collections.`;
  } catch {
    $('dataset-status').textContent = 'Reset unavailable — current view preserved. Try again.';
    $('reset-status').textContent = 'Unable to restore all collections. Your current view is preserved. Try Reset Atlas again.';
  } finally {
    resetting = false; control.disabled = false; control.setAttribute('aria-busy', 'false');
    if (active) control.focus({ preventScroll: true });
  }
}
function scopeLabel() { return comparisonScope() ? scope.ids.map(id => getRegions(index).byId.get(id)?.label || 'Territory').join(' ↔ ') : scope?.kind === 'person' ? index.people.get(scope.id)?.name || 'Name not loaded' : regionScope() ? getRegions(index).byId.get(scope.id)?.label || 'Theme' : label(scope?.id); }
function renderBreadcrumbs() {
  $('breadcrumbs').replaceChildren(button('All connections', clearFilters));
  if (scope) $('breadcrumbs').append(el('span', '', ' / ' + scopeLabel()));
  uiMotion.reveal($('breadcrumbs'));
}
function viewContext() { return { scope, regionFilters: { ...regionFilters }, comparisonDetailsOpen, fields: Object.fromEntries(['search', 'type-filter', 'year-from', 'year-to'].map(id => [id, $(id).value])) }; }
function selectTerritory(id) {
  if (!getRegions(index).byId.has(id)) return;
  preview.close();
  const ids = selectedTerritories();
  if (ids.includes(id)) {
    const remaining = ids.filter(value => value !== id);
    if (!remaining.length) { clearFilters(); $('comparison-picker').focus({ preventScroll: true }); return; }
    navigate('scope', { kind: 'theme', id: remaining[0] });
  } else if (ids.length) navigate('scope', { kind: 'compare', ids: [ids[0], id] });
  else navigate('scope', { kind: 'theme', id });
}
function navigate(kind, value) {
  history.replaceState(viewContext(), '', location.href);
  const sameRegion = kind === 'scope' && value.kind === 'theme' && regionScope() && value.id === scope.id;
  const params = kind === 'item' ? new URLSearchParams({ item: value, ...(comparisonScope() ? { compare: scope.ids.join(',') } : {}) }) : new URLSearchParams(value.kind === 'compare' ? { compare: value.ids.join(',') } : { [value.kind]: value.id, ...(sameRegion ? regionFilters : {}) });
  if (kind === 'scope' && !sameRegion && (value.kind !== 'compare' || !comparisonScope() || value.ids.join(',') !== scope.ids.join(','))) comparisonDetailsOpen = false;
  history.pushState(viewContext(), '', '#' + params); readLocation();
  if (kind === 'scope' && ['theme', 'compare'].includes(value.kind)) {
    $('explore-tools').open = false;
    $('comparison-picker').focus({ preventScroll: true });
    scrollToBubble('map-surface');
  }
}
function readLocation() {
  const params = new URLSearchParams(location.hash.slice(1));
  const itemId = params.get('item'), personId = params.get('person'), themeId = params.get('theme');
  const compareIds = [...new Set((params.get('compare') || '').split(','))].filter(id => getRegions(index).byId.has(id));
  const comparison = compareIds.length === 2 ? { kind: 'compare', ids: compareIds } : null;
  if (history.state?.fields) for (const [id, value] of Object.entries(history.state.fields)) if (['search', 'type-filter', 'year-from', 'year-to'].includes(id)) $(id).value = value;
  if (itemId) {
    scope = comparison || history.state?.scope || null; regionFilters = history.state?.regionFilters || {}; comparisonDetailsOpen = Boolean(history.state?.comparisonDetailsOpen); refresh();
    if (index.byId.has(itemId)) showItem(index.byId.get(itemId));
    else if (index.items.length) { openDetail(); $('detail-content').replaceChildren(el('h2', 'detail-title', 'Collection not loaded'), el('p', 'detail-note', 'Load this record’s collection, then reopen the link. Imported records exist only in their original browser session.')); revealPanel('detail', 'detail-content'); }
  } else if (comparison) { comparisonDetailsOpen = Boolean(history.state?.comparisonDetailsOpen); scope = comparison; regionFilters = {}; closeDetail(); refresh(); }
  else if (!themeId && personId && index.people.has(personId)) { scope = { kind: 'person', id: personId }; refresh(); showPerson(personId); }
  else if (themeId && getRegions(index).byId.has(themeId)) { comparisonDetailsOpen = Boolean(history.state?.comparisonDetailsOpen); scope = { kind: 'theme', id: themeId }; regionFilters = Object.fromEntries(regionKeys.filter(key => params.has(key)).map(key => [key, params.get(key)])); closeDetail(); refresh(); }
  else { scope = null; regionFilters = {}; closeDetail(); refresh(); }
}
function openDetail() { preview.close(); uiMotion.cancel($('region-panel')); $('region-panel').hidden = true; $('map-evidence').setAttribute('aria-expanded', 'false'); $('detail').hidden = false; }
function closeDetail() { uiMotion.cancel($('detail')); $('detail').hidden = true; selection = null; $('region-panel').hidden = !(subjectScope() && comparisonDetailsOpen); $('map-evidence').setAttribute('aria-expanded', String(!$('region-panel').hidden)); }
function closeRegionDetails() { uiMotion.cancel($('region-panel')); $('region-panel').hidden = true; comparisonDetailsOpen = false; $('map-evidence').setAttribute('aria-expanded', 'false'); $('map-evidence').focus({ preventScroll: true }); scrollToBubble('map-reading'); }
function closeRecordDetails() {
  closeDetail();
  const trails = !$('region-panel').hidden, list = document.body.dataset.view === 'list';
  (trails ? $('region-close') : list ? $('results-heading') : $('network')).focus({ preventScroll: true });
  scrollToBubble(trails ? 'region-panel' : list ? 'results-heading' : 'graph-stage');
}
function detailSection(title, content) { const section = el('section', 'detail-section'); section.append(el('h3', '', title), ...content); return section; }
function sourceLinks(urls) { return [...new Set(urls.filter(safeUrl))].slice(0, 30).map((u, i) => link(`${i ? 'Evidence' : 'Open source'} · ${new URL(u).hostname} ↗`, u)); }
function showItem(item) {
  uiMotion.cancel($('detail'));
  selection = item.id;
  graph?.focusRecord?.(item.id);
  openDetail();
  const content = $('detail-content');
  const catalog = index.catalogById.get(item.catalogId);
  content.replaceChildren(el('p', 'detail-kicker', label(item.type) + ' / ' + catalog.label), el('h2', 'detail-title', item.title));
  if (subjectScope()) content.prepend(button('Back to ' + scopeLabel(), () => navigate('scope', scope), 'credit-chip'));
  const metadata = [item.date || item.dateRaw || 'Date unknown', item.dateKind ? label(item.dateKind) : '', item.datePrecision ? `${item.datePrecision} precision` : '', item.journal, item.publisher, item.doi ? `DOI: ${item.doi}` : '', item.isbn ? `ISBN: ${item.isbn}` : '', item.publicationStatus ? `Publication: ${label(item.publicationStatus)}` : '', item.eventStatus ? `Event: ${label(item.eventStatus)}` : ''].filter(Boolean);
  content.append(el('p', 'detail-meta', metadata.join(' · ')));
  content.append(button('Locate this record on the map', () => {
    if (comparisonScope()) { comparisonDetailsOpen = false; closeDetail(); }
    else { for (const id of ['search', 'type-filter', 'year-from', 'year-to']) $(id).value = ''; scope = null; regionFilters = {}; closeDetail(); refresh(); }
    document.body.dataset.view = 'map'; $('map-view').setAttribute('aria-pressed', 'true'); $('list-view').setAttribute('aria-pressed', 'false');
    graph?.setActive(active); graph?.focusRecord?.(item.id); $('network').focus({ preventScroll: true }); scrollToBubble('graph-stage');
  }, 'locate-record'));
  const credits = index.byItem.get(item.id) || [];
  content.append(detailSection('Source credits', credits.length ? credits.map(c => button(`${index.people.get(c.personId)?.name || 'Unresolved name'} · ${label(c.role)}`, () => navigate('scope', { kind: 'person', id: c.personId }), 'credit-chip')) : [el('p', 'detail-note', 'No usable byline in this snapshot. No author has been inferred.')]));
  content.append(detailSection('Source trail', sourceLinks([item.url, ...(item.sourceUrls || []), ...credits.flatMap(c => c.sourceUrls || [])])));
  const relations = index.relationshipsByItem.get(item.id) || [];
  if (relations.length) content.append(detailSection('Relationships & their basis', relations.map(r => { const outgoing = r.from === item.id; const target = index.byId.get(outgoing ? r.to : r.from); const block = el('div'); block.append(button(`${inferredRelationship(r) ? 'Inferred' : 'Documented'} · ${target?.title || 'Related record'}`, () => target && navigate('item', target.id), 'related-record'), el('p', 'detail-note', `${outgoing ? 'This record → related record' : 'Related record → this record'}: ${label(r.kind)}. Basis: ${label(r.basis)}.`), ...sourceLinks(r.sourceUrls || [])); return block; })));
  if (item.themes.length) content.append(detailSection('Possible themes · inferred', [el('p', 'detail-note', 'Title keyword matches, not source-assigned subjects or evidence of agreement.'), ...item.themeEvidence.map(evidence => {
    const row = el('div');
    row.append(button(THEMES.find(t => t[0] === evidence.themeId)[1], () => selectTerritory(evidence.themeId), 'credit-chip'), el('p', 'detail-note', `Matched title text: ${evidence.terms.map(term => '“' + term + '”').join(', ')}.`), ...sourceLinks(evidence.sourceUrls));
    return row;
  })]));
  if (item.qualityFlags?.length) content.append(detailSection('Metadata cautions', [el('p', 'detail-note', item.qualityFlags.map(label).join(' · '))]));
  content.append(detailSection('Coverage', [el('p', 'detail-note', `${catalog.snapshot ? `Snapshot ${catalog.snapshot}. ` : ''}${catalog.coverage?.summary || 'Coverage is incomplete.'}`), el('p', 'detail-note', 'Names are source labels, not verified identities. Presence in a catalog does not imply organizational membership or endorsement.')]));
  $('detail-close').focus({ preventScroll: true });
  revealPanel('detail', 'detail-content');
}
function showPerson(id) {
  uiMotion.cancel($('detail'));
  selection = id; openDetail(); const person = index.people.get(id), credits = index.byPerson.get(id) || [];
  const roleLabel = index.graph?.byId.get(id)?.roleLabel || 'Credited name';
  $('detail-content').replaceChildren(el('p', 'detail-kicker', roleLabel + ' / ' + index.catalogById.get(person.catalogId).label), el('h2', 'detail-title', person.name), el('p', 'detail-note', `${label(person.entityStatus)}. This name label is kept separate from matching names in other catalogs.`), el('p', 'detail-meta', `${number(new Set(credits.map(c => c.itemId)).size)} records with documented credits.`));
  $('detail-content').append(detailSection('Roles in this snapshot', [el('p', 'detail-note', [...new Set(credits.map(c => label(c.role)))].join(' · '))]), detailSection('Credit evidence', sourceLinks(credits.flatMap(c => c.sourceUrls || []).slice(0, 15))));
  const affiliations = index.affiliations.get(id) || [];
  if (affiliations.length) $('detail-content').append(detailSection('Documented affiliation assertions', affiliations.map(a => { const row = el('div'); row.append(el('p', '', [a.organization, a.role, a.temporalStatus].filter(Boolean).join(' · ')), ...sourceLinks(a.sourceUrls || [])); return row; })));
  $('detail-content').append(el('p', 'detail-note', 'The reading room now shows records credited to this label. Close this panel to explore them.'));
  $('detail-close').focus({ preventScroll: true });
  revealPanel('detail', 'detail-content');
}
function renderCollections() {
  uiMotion.cancel($('collection-options'));
  const total = directory?.catalogs.reduce((sum, entry) => sum + entry.itemCount, 0) || 0;
  if (!$('load-all-collections') && directory) {
    const all = button(`Load all ${number(total)} records`, async () => {
      if (resetting) return;
      const generation = collectionGeneration;
      all.disabled = true; $('import-status').textContent = 'Opening all collections…';
      try {
        const allData = await Promise.all(directory.catalogs.map(catalogData));
        if (generation !== collectionGeneration) return;
        for (const data of allData) catalogs.set(data.catalog.id, data);
        rebuild(); renderCollections(); $('import-status').textContent = `${number(index.items.length)} records searchable. Names remain separate across collections.`;
      } catch { if (generation === collectionGeneration) $('import-status').textContent = 'Some collections could not load. Your current view is preserved; try again.'; }
      finally { all.disabled = false; uiMotion.reveal($('import-status'), { mode: 'view', fields: [] }); }
    }, 'load-more');
    all.id = 'load-all-collections'; $('collection-options').before(all);
  }
  const entries = [...(directory?.catalogs || []), ...[...sessionImports.values()].map(({ data: c }) => ({ id: c.catalog.id, label: c.catalog.label, itemCount: c.items.length, coverageSummary: c.catalog.coverage.summary }))];
  $('collection-options').replaceChildren(...entries.map(entry => {
    const row = el('label', 'collection-option'), check = el('input'); check.type = 'checkbox'; check.checked = catalogs.has(entry.id); check.value = entry.id;
    const copy = el('span'); copy.append(el('strong', 'collection-name', entry.label), el('span', 'collection-meta', `${number(entry.itemCount)} records · ${entry.coverageSummary || 'Public metadata snapshot'}`));
    row.append(check, copy);
    check.addEventListener('change', async () => {
      if (resetting) { check.checked = catalogs.has(entry.id); return; }
      const generation = collectionGeneration;
      check.disabled = true;
      try {
        if (check.checked) {
          $('import-status').textContent = `Loading ${entry.label}…`;
          const data = await catalogData(entry);
          if (generation !== collectionGeneration) return;
          catalogs.set(entry.id, data);
        }
        else catalogs.delete(entry.id);
        rebuild(); $('import-status').textContent = `${number(index.items.length)} records available.`;
      } catch { if (generation === collectionGeneration) { check.checked = false; $('import-status').textContent = 'Unable to load that collection. Check your connection and try again.'; } }
      finally { check.disabled = false; uiMotion.reveal(row); uiMotion.reveal($('import-status'), { mode: 'view', fields: [] }); }
    });
    return row;
  }));
  uiMotion.reveal($('collection-options'));
}
$('import-file').addEventListener('change', async event => {
  if (!initialized) { $('import-status').textContent = 'Finish loading the public collections before importing local metadata.'; event.target.value = ''; return; }
  const file = event.target.files?.[0]; if (!file) return;
  $('import-status').textContent = 'Reading local metadata…';
  try {
    if (file.size > 40 * 1024 * 1024) throw new Error('Choose a file smaller than 40 MB.');
    const contents = await file.text();
    const raw = file.name.toLowerCase().endsWith('.jsonl') ? contents.split(/\r?\n/).filter(s => s.trim()).map(s => JSON.parse(s)) : JSON.parse(contents);
    const data = normalizeImport(raw, 'local-' + ++importNumber);
    // Removed imports remain cached for re-selection. Count the entire session,
    // including inactive imports, so toggling collections cannot bypass limits.
    validateSessionImport(data, file.size, { publicRecords: directory.catalogs.reduce((sum, row) => sum + row.itemCount, 0), imports: sessionImports.values() });
    sessionImports.set(data.catalog.id, { data, bytes: file.size });
    catalogs.set(data.catalog.id, data); cache.set(data.catalog.id, Promise.resolve(data)); rebuild(); renderCollections();
    $('import-status').textContent = `${number(data.items.length)} records added. Stored in memory for this session only.`;
  } catch (error) { $('import-status').textContent = error instanceof SyntaxError ? 'The file is not valid JSON. Use the example format below.' : error.message; }
  event.target.value = '';
  uiMotion.reveal($('import-status'), { mode: 'view', fields: [] });
});

let debounce;
for (const id of ['search', 'year-from', 'year-to']) $(id).addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(refresh, 160); });
for (const id of ['type-filter', 'year-from', 'year-to']) $(id).addEventListener('change', () => { clearTimeout(debounce); refresh(); });
for (const id of ['names-toggle', 'labels-toggle', 'relationships-toggle', 'regions-toggle', 'themes-toggle']) $(id).addEventListener('change', event => { applyLayers(); renderMapReading(); uiMotion.reveal(event.currentTarget.closest('label'), { fields: [] }); });
const layerControls = document.querySelector('.map-layers');
layerControls?.addEventListener('toggle', () => {
  if (layerControls.open) uiMotion.reveal(layerControls, { fields: [...layerControls.children].slice(1) });
  else uiMotion.cancel(layerControls);
});
$('load-more').addEventListener('click', () => { const previous = pageSize; pageSize += 40; renderList(previous); $('results').children[previous]?.focus({ preventScroll: true }); });
$('detail-close').addEventListener('click', closeRecordDetails);
$('region-close').addEventListener('click', closeRegionDetails);
$('comparison-picker').addEventListener('change', () => { if ($('comparison-picker').value) selectTerritory($('comparison-picker').value); });
$('comparison-example').addEventListener('click', () => navigate('scope', { kind: 'compare', ids: ['minds', 'power'] }));
$('return-map').addEventListener('click', () => {
  setView(graph?.available === false || !graph ? 'list' : 'map');
  scrollToBubble('map-surface');
  (document.body.dataset.view === 'list' ? $('results-heading') : $('network')).focus({ preventScroll: true });
});
$('clear-search-filters').addEventListener('click', () => {
  history.replaceState(viewContext(), '', location.href);
  for (const id of ['search', 'type-filter', 'year-from', 'year-to']) $(id).value = '';
  clearTimeout(debounce); regionFilters = {};
  const params = new URLSearchParams(location.hash.slice(1));
  for (const key of regionKeys) params.delete(key);
  history.pushState(viewContext(), '', location.pathname + location.search + (params.size ? '#' + params : ''));
  refresh();
});
$('explore-tools-close').addEventListener('click', () => { $('explore-tools').open = false; $('explore-tools-toggle').focus({ preventScroll: true }); });
for (const id of ['explore-tools', 'map-perspectives']) $(id).addEventListener('toggle', () => {
  const control = $(id);
  if (control.open) {
    uiMotion.reveal(control.lastElementChild, { mode: 'view' });
    if (id === 'explore-tools') $('search').focus({ preventScroll: true });
  } else uiMotion.cancel(control);
  graph?.refreshOverlayLayout?.();
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  for (const id of ['explore-tools', 'map-perspectives']) if ($(id).open) {
    $(id).open = false; $(id + '-toggle').focus({ preventScroll: true });
    event.stopImmediatePropagation(); break;
  }
});
$('comparison-clear').addEventListener('click', () => { clearFilters(); $('comparison-picker').focus({ preventScroll: true }); });
$('comparison-details').addEventListener('click', () => {
  scrollToBubble('map-reading'); $('map-reading-heading').focus({ preventScroll: true });
});
$('map-evidence').addEventListener('click', () => {
  if (comparisonDetailsOpen && !$('region-panel').hidden) { closeRegionDetails(); return; }
  preview.close(); uiMotion.cancel($('detail')); $('detail').hidden = true; selection = null;
  comparisonDetailsOpen = true;
  if (comparisonScope()) renderComparisonPanel();
  else if (regionScope()) renderRegionPanel();
  $('map-evidence').setAttribute('aria-expanded', 'true');
  $('region-close').focus({ preventScroll: true });
  scrollToBubble('region-panel');
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { preview.close(preview.card.contains(document.activeElement)); if (!$('detail').hidden) closeRecordDetails(); else if (!$('region-panel').hidden) closeRegionDetails(); } });
$('preview-prev').addEventListener('click', () => graph?.stepPreview(-1));
$('preview-next').addEventListener('click', () => graph?.stepPreview(1));
$('zoom-in').addEventListener('click', () => graph?.zoomBy(1.3));
$('zoom-out').addEventListener('click', () => graph?.zoomBy(1 / 1.3));
$('reset-view').addEventListener('click', () => graph?.reset());
$('reset-atlas').addEventListener('click', resetAtlas);
$('view-overview').addEventListener('click', () => graph?.reset());
$('connections-toggle').addEventListener('click', () => {
  const enabled = !$('relationships-toggle').checked && !$('themes-toggle').checked;
  $('relationships-toggle').checked = $('themes-toggle').checked = enabled;
  if (enabled) $('names-toggle').checked = true;
  applyLayers();
  renderMapReading();
});
for (const [id, ratio] of [['view-nearby', 4], ['view-close', 12]]) $(id).addEventListener('click', () => graph?.setPerspective?.(ratio));
$('empty-map').addEventListener('click', () => graph?.reset());
$('map-zoom').addEventListener('input', () => { if (graph) graph.zoomBy(2 ** Number($('map-zoom').value) * graph.baseScale / graph.scale); });
function expandMap(expanded) {
  preview.close(); document.body.dataset.mapExpanded = String(expanded);
  $('expand-map').textContent = expanded ? 'Restore layout' : 'Expand map'; $('expand-map').setAttribute('aria-pressed', String(expanded));
  graph?.measure?.();
  uiMotion.reveal($('graph-stage'), { fields: [], mode: 'view' });
  if (!expanded) uiMotion.reveal($('region-memberships'));
}
$('expand-map').addEventListener('click', () => expandMap(document.body.dataset.mapExpanded !== 'true'));
$('motion-toggle').addEventListener('click', () => { const paused = graph ? graph.toggleMotion() : !uiMotion.paused; uiMotion.setPaused(paused); $('motion-toggle').setAttribute('aria-pressed', String(Boolean(paused))); $('motion-toggle').setAttribute('aria-label', paused ? 'Resume motion' : 'Pause motion'); });
function setView(view) {
  if (view === 'list') { expandMap(false); uiMotion.cancel($('graph-stage')); }
  else uiMotion.cancel($('results'));
  document.body.dataset.view = view;
  for (const v of ['map', 'list']) $(v + '-view').setAttribute('aria-pressed', String(v === view));
  graph?.setActive(active && view === 'map');
  uiMotion.reveal(view === 'list' ? $('results') : $('graph-stage'), { ...(view === 'map' ? { fields: [] } : {}), mode: 'view' });
}
for (const view of ['map', 'list']) $(view + '-view').addEventListener('click', () => setView(view));
for (const name of ['collections', 'about']) {
  $(name + '-open').addEventListener('click', () => { preview.close(); $(name + '-dialog').showModal(); uiMotion.reveal($(name + '-dialog')); });
  $(name + '-dialog').addEventListener('close', () => { uiMotion.cancel($(name + '-dialog')); uiMotion.reveal($(name + '-open'), { fields: [] }); });
  $(name + '-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); } });
}
addEventListener('popstate', readLocation);
document.addEventListener('acf:enter', () => { active = true; uiMotion.setActive(true); start(); });
document.addEventListener('acf:exit', () => { active = false; uiMotion.setActive(false); graph?.setActive(false); });
