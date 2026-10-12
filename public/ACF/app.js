import { AtlasGraph } from './graph.js?v=space-20261012';
import { NodePreview } from './node-preview.js?v=space-20261012';
import { previewInfo } from './preview-data.js?v=space-20261012';
import { createIndex, filterItems, graphData, normalizeImport, inferredRelationship, label, safeUrl, THEMES } from './model.js';

const $ = id => document.getElementById(id);
const number = n => n.toLocaleString();
const el = (tag, className, value) => { const n = document.createElement(tag); if (className) n.className = className; if (value !== undefined) n.textContent = value; return n; };
const button = (value, action, className = 'text-button') => { const b = el('button', className, value); b.type = 'button'; b.addEventListener('click', action); return b; };
const link = (value, url) => { const a = el('a', 'source-link', value); a.href = safeUrl(url); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
const catalogs = new Map(), cache = new Map();
let directory, index = createIndex([]), records = [], scope = null, selection = null, pageSize = 40, loading, active = false, importNumber = 0;
let graph;
const preview = new NodePreview($('graph-stage'), $('network'), () => index, node => node.scope ? navigate('scope', node.scope) : navigate('item', node.id));
try {
  graph = new AtlasGraph($('network'), {
    onSelect: (node, anchor) => preview.update(node, anchor, 'select'),
    onPreview: (node, anchor, reason) => preview.update(node, anchor, reason),
    onStatus: stats => { if (records.length) $('graph-status').textContent = `${number(stats.visibleNodes)} sampled nodes · ${number(records.length)} records searchable. Zoom for detail.`; },
  });
  if (!graph.ctx) throw new Error('Canvas unavailable');
} catch { $('graph-status').textContent = 'Map unavailable. Every record is available in the reading room.'; document.body.dataset.view = 'list'; }

async function fetchJSON(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`The catalog could not load (${response.status}).`);
  return response.json();
}
async function catalogData(entry) {
  if (!cache.has(entry.id)) cache.set(entry.id, fetchJSON('/ACF/data/' + entry.file).catch(error => { cache.delete(entry.id); throw error; }));
  return cache.get(entry.id);
}
async function start() {
  if (loading) return loading;
  if (catalogs.size) { graph?.setActive(active && document.body.dataset.view !== 'list'); return; }
  $('dataset-status').textContent = 'Opening the IEET collection…';
  $('load-more').hidden = true;
  loading = (async () => {
    const began = performance.now();
    try {
      directory ||= await fetchJSON('/ACF/data/index.json');
      const first = directory.catalogs.find(c => c.id === directory.defaultCatalog);
      catalogs.set(first.id, await catalogData(first));
      rebuild(false); renderCollections(); readLocation();
      $('atlas-workspace').dataset.loadMs = (performance.now() - began).toFixed(1);
      document.dispatchEvent(new CustomEvent('acf:ready'));
    } catch (error) {
      $('dataset-status').textContent = 'Collection unavailable';
      $('graph-status').textContent = 'Unable to load public metadata. Check your connection and retry.';
      $('results').replaceChildren(el('p', 'error-state', error.name === 'TimeoutError' ? 'The connection took too long.' : error.message), button('Retry loading', () => start(), 'load-more'));
    } finally { loading = null; }
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
  const began = performance.now();
  records = filterItems(index, filters()); pageSize = 40;
  renderList(); renderBreadcrumbs(); renderGraph();
  $('graph-subtitle').textContent = scope?.kind === 'theme' ? 'Inferred from title keywords only. A shared theme does not establish affiliation.' : scope?.kind === 'person' ? 'Documented credits. Names may refer to people, groups or publishing accounts.' : 'Select a credited name or a publication. Every source is a new path.';
  $('atlas-workspace').dataset.updateMs = (performance.now() - began).toFixed(1);
}
function renderGraph() {
  const data = graphData(index, records, $('themes-toggle').checked);
  for (const node of data.nodes) {
    const info = previewInfo(node, index);
    node.typeLabel = index.byId.has(node.id) ? label(index.byId.get(node.id).type) : info.kind === 'person' ? 'Credited name' : 'Inferred theme';
    node.collectionLabel = info.collection;
    node.metaLabel = info.kind === 'item' ? node.typeLabel + ' · ' + info.collection : node.typeLabel;
  }
  graph?.setData(data); graph?.setActive(active && document.body.dataset.view !== 'list');
  if (!records.length) $('graph-status').textContent = 'No records in this view. Try fewer filters.';
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
function renderList() {
  $('results-count').textContent = number(records.length);
  $('results-heading').textContent = scope ? scopeLabel() : 'Explore the collection';
  $('results').replaceChildren(...records.slice(0, pageSize).map(recordCard));
  if (!records.length) {
    const invalidYears = $('year-from').value && $('year-to').value && +$('year-from').value > +$('year-to').value;
    $('results').append(el('p', 'empty-state', invalidYears ? 'The starting year is after the ending year.' : 'No records found. Try a broader search or clear your filters.'), button('Clear filters', clearFilters));
  }
  $('load-more').hidden = pageSize >= records.length;
  $('load-more').textContent = `Show ${Math.min(40, Math.max(0, records.length - pageSize))} more records ↓`;
}
function clearFilters() { for (const id of ['search', 'type-filter', 'year-from', 'year-to']) $(id).value = ''; scope = null; selection = null; closeDetail(); history.pushState(null, '', location.pathname); refresh(); }
function scopeLabel() { return scope?.kind === 'person' ? index.people.get(scope.id)?.name || 'Name not loaded' : scope?.kind === 'theme' ? THEMES.find(t => t[0] === scope.id)?.[1] || 'Theme' : label(scope?.id); }
function renderBreadcrumbs() {
  $('breadcrumbs').replaceChildren(button('All connections', () => { scope = null; closeDetail(); history.pushState(null, '', location.pathname); refresh(); }));
  if (scope) $('breadcrumbs').append(el('span', '', ' / ' + scopeLabel()));
}
function navigate(kind, value) {
  const hash = kind === 'item' ? '#item=' + encodeURIComponent(value) : '#' + value.kind + '=' + encodeURIComponent(value.id);
  history.pushState({ scope }, '', hash); readLocation();
}
function readLocation() {
  const params = new URLSearchParams(location.hash.slice(1));
  const itemId = params.get('item'), personId = params.get('person'), themeId = params.get('theme');
  if (itemId) {
    scope = history.state?.scope || null; refresh();
    if (index.byId.has(itemId)) showItem(index.byId.get(itemId));
    else if (index.items.length) { openDetail(); $('detail-content').replaceChildren(el('h2', 'detail-title', 'Collection not loaded'), el('p', 'detail-note', 'Load this record’s collection, then reopen the link. Imported records exist only in their original browser session.')); }
  } else if (personId && index.people.has(personId)) { scope = { kind: 'person', id: personId }; refresh(); showPerson(personId); }
  else if (themeId && THEMES.some(t => t[0] === themeId)) { scope = { kind: 'theme', id: themeId }; $('themes-toggle').checked = true; closeDetail(); refresh(); }
  else { scope = null; closeDetail(); refresh(); }
}
function openDetail() { preview.close(); $('detail').hidden = false; }
function closeDetail() { $('detail').hidden = true; selection = null; }
function detailSection(title, content) { const section = el('section', 'detail-section'); section.append(el('h3', '', title), ...content); return section; }
function sourceLinks(urls) { return [...new Set(urls.filter(safeUrl))].slice(0, 30).map((u, i) => link(`${i ? 'Evidence' : 'Open source'} · ${new URL(u).hostname} ↗`, u)); }
function showItem(item) {
  selection = item.id; openDetail();
  const content = $('detail-content');
  const catalog = index.catalogById.get(item.catalogId);
  content.replaceChildren(el('p', 'detail-kicker', label(item.type) + ' / ' + catalog.label), el('h2', 'detail-title', item.title));
  const metadata = [item.date || item.dateRaw || 'Date unknown', item.dateKind ? label(item.dateKind) : '', item.datePrecision ? `${item.datePrecision} precision` : '', item.journal, item.publisher, item.doi ? `DOI: ${item.doi}` : '', item.isbn ? `ISBN: ${item.isbn}` : '', item.publicationStatus ? `Publication: ${label(item.publicationStatus)}` : '', item.eventStatus ? `Event: ${label(item.eventStatus)}` : ''].filter(Boolean);
  content.append(el('p', 'detail-meta', metadata.join(' · ')));
  const credits = index.byItem.get(item.id) || [];
  content.append(detailSection('Source credits', credits.length ? credits.map(c => button(`${index.people.get(c.personId)?.name || 'Unresolved name'} · ${label(c.role)}`, () => navigate('scope', { kind: 'person', id: c.personId }), 'credit-chip')) : [el('p', 'detail-note', 'No usable byline in this snapshot. No author has been inferred.')]));
  content.append(detailSection('Source trail', sourceLinks([item.url, ...(item.sourceUrls || []), ...credits.flatMap(c => c.sourceUrls || [])])));
  const relations = index.relationships.filter(r => r.from === item.id || r.to === item.id);
  if (relations.length) content.append(detailSection('Relationships & their basis', relations.map(r => { const outgoing = r.from === item.id; const target = index.byId.get(outgoing ? r.to : r.from); const block = el('div'); block.append(button(`${inferredRelationship(r) ? 'Inferred' : 'Documented'} · ${target?.title || 'Related record'}`, () => target && navigate('item', target.id), 'related-record'), el('p', 'detail-note', `${outgoing ? 'This record → related record' : 'Related record → this record'}: ${label(r.kind)}. Basis: ${label(r.basis)}.`), ...sourceLinks(r.sourceUrls || [])); return block; })));
  if (item.themes.length) content.append(detailSection('Possible themes · inferred', [el('p', 'detail-note', 'Title keyword matches, not source-assigned subjects or evidence of agreement.'), ...item.themes.map(id => button(THEMES.find(t => t[0] === id)[1], () => navigate('scope', { kind: 'theme', id }), 'credit-chip'))]));
  if (item.qualityFlags?.length) content.append(detailSection('Metadata cautions', [el('p', 'detail-note', item.qualityFlags.map(label).join(' · '))]));
  content.append(detailSection('Coverage', [el('p', 'detail-note', `${catalog.snapshot ? `Snapshot ${catalog.snapshot}. ` : ''}${catalog.coverage?.summary || 'Coverage is incomplete.'}`), el('p', 'detail-note', 'Names are source labels, not verified identities. Presence in a catalog does not imply organizational membership or endorsement.')]));
  $('detail-close').focus({ preventScroll: true });
}
function showPerson(id) {
  selection = id; openDetail(); const person = index.people.get(id), credits = index.byPerson.get(id) || [];
  $('detail-content').replaceChildren(el('p', 'detail-kicker', 'Credited name / ' + index.catalogById.get(person.catalogId).label), el('h2', 'detail-title', person.name), el('p', 'detail-note', `${label(person.entityStatus)}. This name label is kept separate from matching names in other catalogs.`), el('p', 'detail-meta', `${number(new Set(credits.map(c => c.itemId)).size)} records with documented credits.`));
  $('detail-content').append(detailSection('Roles in this snapshot', [el('p', 'detail-note', [...new Set(credits.map(c => label(c.role)))].join(' · '))]), detailSection('Credit evidence', sourceLinks(credits.flatMap(c => c.sourceUrls || []).slice(0, 15))));
  const affiliations = index.affiliations.get(id) || [];
  if (affiliations.length) $('detail-content').append(detailSection('Documented affiliation assertions', affiliations.map(a => { const row = el('div'); row.append(el('p', '', [a.organization, a.role, a.temporalStatus].filter(Boolean).join(' · ')), ...sourceLinks(a.sourceUrls || [])); return row; })));
  $('detail-content').append(el('p', 'detail-note', 'The reading room now shows records credited to this label. Close this panel to explore them.'));
  $('detail-close').focus({ preventScroll: true });
}
function renderCollections() {
  const total = directory?.catalogs.reduce((sum, entry) => sum + entry.itemCount, 0) || 0;
  if (!$('load-all-collections') && directory) {
    const all = button(`Load all ${number(total)} records`, async () => {
      all.disabled = true; $('import-status').textContent = 'Opening all collections…';
      try {
        const allData = await Promise.all(directory.catalogs.map(catalogData));
        for (const data of allData) catalogs.set(data.catalog.id, data);
        rebuild(); renderCollections(); $('import-status').textContent = `${number(index.items.length)} records searchable. Names remain separate across collections.`;
      } catch { $('import-status').textContent = 'Some collections could not load. Your current view is preserved; try again.'; }
      finally { all.disabled = false; }
    }, 'load-more');
    all.id = 'load-all-collections'; $('collection-options').before(all);
  }
  const entries = [...(directory?.catalogs || []), ...[...catalogs.values()].filter(c => c.catalog.id.startsWith('local-')).map(c => ({ id: c.catalog.id, label: c.catalog.label, itemCount: c.items.length, coverageSummary: c.catalog.coverage.summary }))];
  $('collection-options').replaceChildren(...entries.map(entry => {
    const row = el('label', 'collection-option'), check = el('input'); check.type = 'checkbox'; check.checked = catalogs.has(entry.id); check.value = entry.id;
    const copy = el('span'); copy.append(el('strong', 'collection-name', entry.label), el('span', 'collection-meta', `${number(entry.itemCount)} records · ${entry.coverageSummary || 'Public metadata snapshot'}`));
    row.append(check, copy);
    check.addEventListener('change', async () => {
      check.disabled = true;
      try {
        if (check.checked) { $('import-status').textContent = `Loading ${entry.label}…`; catalogs.set(entry.id, await catalogData(entry)); }
        else catalogs.delete(entry.id);
        rebuild(); $('import-status').textContent = `${number(index.items.length)} records available.`;
      } catch { check.checked = false; $('import-status').textContent = 'Unable to load that collection. Check your connection and try again.'; }
      finally { check.disabled = false; }
    });
    return row;
  }));
}
$('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  $('import-status').textContent = 'Reading local metadata…';
  try {
    if (file.size > 40 * 1024 * 1024) throw new Error('Choose a file smaller than 40 MB.');
    const contents = await file.text();
    const raw = file.name.toLowerCase().endsWith('.jsonl') ? contents.split(/\r?\n/).filter(s => s.trim()).map(s => JSON.parse(s)) : JSON.parse(contents);
    const data = normalizeImport(raw, 'local-' + ++importNumber);
    if (index.items.length + data.items.length > 120000) throw new Error('This session supports up to 120,000 records. Remove a collection first.');
    catalogs.set(data.catalog.id, data); cache.set(data.catalog.id, Promise.resolve(data)); rebuild(); renderCollections();
    $('import-status').textContent = `${number(data.items.length)} records added. Stored in memory for this session only.`;
  } catch (error) { $('import-status').textContent = error instanceof SyntaxError ? 'The file is not valid JSON. Use the example format below.' : error.message; }
  event.target.value = '';
});

let debounce;
for (const id of ['search', 'year-from', 'year-to']) $(id).addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(refresh, 160); });
for (const id of ['type-filter', 'year-from', 'year-to']) $(id).addEventListener('change', () => { clearTimeout(debounce); refresh(); });
$('themes-toggle').addEventListener('change', renderGraph);
$('load-more').addEventListener('click', () => { const previous = pageSize; pageSize += 40; renderList(); $('results').children[previous]?.focus({ preventScroll: true }); });
$('detail-close').addEventListener('click', () => { closeDetail(); $('search').focus({ preventScroll: true }); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { preview.close(preview.card.contains(document.activeElement)); closeDetail(); } });
$('preview-prev').addEventListener('click', () => graph?.stepPreview(-1));
$('preview-next').addEventListener('click', () => graph?.stepPreview(1));
$('zoom-in').addEventListener('click', () => graph?.zoomBy(1.3));
$('zoom-out').addEventListener('click', () => graph?.zoomBy(1 / 1.3));
$('reset-view').addEventListener('click', () => graph?.reset());
$('motion-toggle').addEventListener('click', () => { const paused = graph?.toggleMotion(); $('motion-toggle').setAttribute('aria-pressed', String(Boolean(paused))); $('motion-toggle').setAttribute('aria-label', paused ? 'Resume map motion' : 'Pause map motion'); });
for (const view of ['map', 'list']) $(view + '-view').addEventListener('click', () => { document.body.dataset.view = view; for (const v of ['map', 'list']) $(v + '-view').setAttribute('aria-pressed', String(v === view)); graph?.setActive(active && view === 'map'); });
for (const name of ['collections', 'about']) {
  $(name + '-open').addEventListener('click', () => { preview.close(); $(name + '-dialog').showModal(); });
  $(name + '-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); } });
}
addEventListener('popstate', readLocation);
document.addEventListener('acf:enter', () => { active = true; start(); });
document.addEventListener('acf:exit', () => { active = false; graph?.setActive(false); });
