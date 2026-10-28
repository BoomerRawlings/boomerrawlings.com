const API_BASE = '/subs/api/v1';
const PAGE_SIZE = 24;
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('en').trim();
const text = value => value === null || value === undefined || value === '' ? 'Unknown' : String(value);
const unwrap = value => value?.image ?? value?.item ?? value;
export const rightsLabel = tier => tier === 'research' ? 'RESEARCH ONLY' : tier === 'commercial' ? 'COMMERCIAL-CAPABLE' : 'RIGHTS PENDING';

export function filterClasses(classes, query = '', origin = '', pilot = false) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return classes.filter(item => (!pilot || item.pilot) && (!origin || (item.origin_countries || []).includes(origin)) && terms.every(term => normalize([item.name, ...(item.aliases || []), ...(item.origin_countries || []), ...(item.operators || [])].join(' ')).includes(term)));
}

export function galleryQuery(values, offset = 0) {
  const params = new URLSearchParams({ offset: String(Math.max(0, offset)), limit: String(PAGE_SIZE) });
  for (const key of ['q', 'class_id', 'domain', 'rights_tier', 'variant', 'operator_country', 'origin_country', 'status']) {
    const value = String(values[key] ?? '').trim();
    if (value) params.set(key, ['variant', 'operator_country'].includes(key) && normalize(value) === 'unknown' ? '__unknown__' : value);
  }
  return `/images?${params}`;
}

export function validateCrop(box, width, height) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isInteger) || !Number.isFinite(width) || !Number.isFinite(height)) throw new Error('Use four whole-pixel crop coordinates.');
  const [x, y, w, h] = box;
  if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > width || y + h > height) throw new Error('The crop must stay inside the original image.');
  return box;
}

export function cropFromDrag(start, end, width, height) {
  const clamp = (value, limit) => Math.max(0, Math.min(limit, Math.round(value)));
  const x1 = clamp(start[0], width), x2 = clamp(end[0], width), y1 = clamp(start[1], height), y2 = clamp(end[1], height);
  return [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
}

export class ApiError extends Error {
  constructor(message, status = 0, code = '') { super(message); this.status = status; this.code = code; }
}

export class ApiClient {
  #token = '';
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.fetcher = fetcher; }
  setToken(token) { this.#token = String(token).trim(); }
  clearToken() { this.#token = ''; }
  hasToken() { return Boolean(this.#token); }
  async request(path, options = {}) {
    const pathname = path.split('?')[0];
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { throw new Error('Invalid collection API path.'); }
    if (!pathname.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || decoded.split('/').some(part => part === '.' || part === '..') || /[\r\n]/.test(path)) throw new Error('Invalid collection API path.');
    const headers = new Headers(options.headers);
    if (this.#token) headers.set('Authorization', `Bearer ${this.#token}`);
    headers.set('Accept', options.blob ? '*/*' : 'application/json');
    if (options.body !== undefined && !(options.body instanceof Blob)) headers.set('Content-Type', 'application/json');
    let response;
    try {
      response = await this.fetcher(`${API_BASE}${path}`, { ...options, headers, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', body: options.body === undefined || options.body instanceof Blob ? options.body : JSON.stringify(options.body) });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new ApiError('The collection API is unavailable. Try refreshing later.');
    }
    if (!response.ok) {
      let details;
      try { details = await response.json(); } catch { /* A static-host fallback is not an API response. */ }
      throw new ApiError(details?.error?.message || (response.status === 404 ? 'The collection API is not available at this address yet.' : `Request failed (${response.status}).`), response.status, details?.error?.code);
    }
    if (options.blob) return response.blob();
    try { return await response.json(); } catch { throw new ApiError('The collection returned an invalid response. No changes were assumed.'); }
  }
  patch(image, changes, reason) { return this.request(`/images/${encodeURIComponent(image.id)}`, { method: 'PATCH', headers: { 'If-Match': String(image.revision) }, body: { changes, reason } }); }
}

export async function applyBatch(api, records, changes, reason, active = () => true) {
  if (!String(reason).trim()) throw new Error('A correction reason is required.');
  const results = [];
  for (const record of records) {
    if (!active()) { results.push({ id: record.id, ok: false, message: 'Edit session changed; correction was not sent.', conflict: false }); continue; }
    try { results.push({ id: record.id, ok: true, image: unwrap(await api.patch(record, changes, reason)) }); }
    catch (error) { results.push({ id: record.id, ok: false, message: error.message, conflict: error.status === 409 || error.status === 412 }); }
  }
  return results;
}

function element(tag, className = '', content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function button(label, action, className = 'dataset-button') { const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
function safeLink(url, label = url) {
  try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return element('span', '', 'Source URL unavailable'); }
  catch { return element('span', '', 'Source URL unavailable'); }
  const link = element('a', '', label); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function badge(label, tone = '') { const node = element('span', 'dataset-pill', label); if (tone) node.dataset.tone = tone; return node; }
const number = value => Number.isFinite(value) ? value.toLocaleString('en') : '—';

export function initWorkspace() {
  const $ = id => document.getElementById(id);
  if (!$('subs-roster')) return;
  let seed;
  try { seed = JSON.parse($('subs-roster').textContent); } catch { seed = { classes: [] }; }
  const api = new ApiClient();
  const state = { classes: seed.classes || [], tab: 'active', connected: false, owner: false, epoch: 0, classRun: 0, galleryRun: 0, galleryOffset: 0, galleryTotal: 0, galleryItems: [], selected: new Map(), image: null, release: null, auditIndex: 0, releaseOffset: 0, sourceOffset: 0, sourcesStarted: false, objectURLs: new Map(), galleryAbort: null, inspectionRun: 0, releaseRun: 0, releaseInspectionRun: 0 };
  const className = id => state.classes.find(item => item.id === id)?.name || id;
  const message = (id, content, error = false) => { $(id).textContent = content; $(id).dataset.error = String(error); };
  const assetPath = (record, kind) => `/images/${encodeURIComponent(record.id)}/assets/${kind}`;
  const sourceSet = new Set([...document.querySelectorAll('#sources a')].map(link => link.href));
  const initialSources = new Set(sourceSet);
  let refreshTimer;

  function closeDialog(id) { if ($(id).open) $(id).close(); }
  document.querySelectorAll('[data-close]').forEach(node => node.addEventListener('click', () => closeDialog(node.dataset.close)));
  function dialog(id) { if (!$(id).open) $(id).showModal(); }
  function revokeObject(url) { if (state.objectURLs.has(url)) { URL.revokeObjectURL(url); state.objectURLs.delete(url); } }
  function clearObjects(group) { [...state.objectURLs].forEach(([url, category]) => { if (!group || group === category) revokeObject(url); }); }
  async function imageURL(record, kind, group = 'gallery') {
    const epoch = state.epoch;
    if (!api.hasToken()) return `${API_BASE}${assetPath(record, kind)}?revision=${record.revision}`;
    const blob = await api.request(assetPath(record, kind), { blob: true });
    if (epoch !== state.epoch) throw new Error('Edit session changed.');
    if (!blob.type.startsWith('image/')) throw new Error('This asset is not a valid image response.');
    const url = URL.createObjectURL(blob); state.objectURLs.set(url, group); return url;
  }
  async function loadPreview(node, record, kind = 'preview', group = 'gallery') {
    const epoch = state.epoch;
    try {
      const url = await imageURL(record, kind, group);
      if (epoch === state.epoch && node.isConnected) node.src = url;
      else revokeObject(url);
    } catch { if (node.isConnected) node.alt = 'Preview unavailable; inspect the record for details.'; }
  }
  function options(id, values, label) {
    const select = $(id), previous = select.value;
    select.replaceChildren(element('option', '', label)); select.firstChild.value = '';
    values.forEach(value => { const option = element('option', '', value); option.value = value; select.append(option); });
    if (values.includes(previous)) select.value = previous;
  }
  function classOptions() {
    const origins = [...new Set(state.classes.flatMap(item => item.origin_countries || []))].sort();
    const operators = [...new Set(state.classes.flatMap(item => item.operators || []))].sort();
    options('active-origin', origins, 'All origins'); options('photo-origin', origins, 'All origins');
    const suggestions = (id, values) => $(id).replaceChildren(...['Unknown', ...values].map(value => { const option = element('option'); option.value = value; return option; }));
    suggestions('operator-options', operators);
    suggestions('variant-options', [...new Set(state.classes.flatMap(item => item.variants || []))].sort());
    for (const id of ['photo-class', 'edit-class']) {
      const select = $(id), previous = select.value;
      select.replaceChildren();
      if (id === 'photo-class') { const first = element('option', '', 'All classes'); first.value = ''; select.append(first); }
      state.classes.forEach(item => { const option = element('option', '', item.name); option.value = item.id; select.append(option); });
      if (state.classes.some(item => item.id === previous)) select.value = previous;
    }
  }
  function renderClasses() {
    const matching = filterClasses(state.classes, $('active-search').value, $('active-origin').value, $('active-pilot').checked);
    $('active-classes').replaceChildren();
    matching.forEach(item => {
      const card = element('article', 'dataset-class-card');
      const top = element('div', 'dataset-class-top'); top.append(element('h3', '', item.name)); if (item.pilot) top.append(badge('PILOT')); card.append(top);
      card.append(element('p', 'dataset-origins', (item.origin_countries || []).join(' / ') || 'Origin under review'));
      card.append(element('p', 'dataset-operators', `Operators: ${(item.operators || []).join(', ') || 'Under review'}`));
      const progress = element('div', 'dataset-class-progress'); const line = element('div');
      line.append(element('strong', '', number(item.counts?.camera)), element('span', '', '/ 400 CAMERA'));
      progress.append(line);
      const bar = element('progress'); bar.max = 400; bar.value = Math.min(400, item.counts?.camera ?? 0); bar.setAttribute('aria-label', `${item.name}: ${Number.isFinite(item.counts?.camera) ? `${item.counts.camera} approved camera originals` : 'counts unavailable'}`); progress.append(bar);
      const counts = element('div', 'dataset-class-counts');
      counts.append(element('span', '', `${number(item.counts?.satellite)} satellite`), element('span', '', `${number(item.counts?.candidates)} candidates`), element('span', '', `${number(item.counts?.deficit)} remaining`)); progress.append(counts);
      card.append(progress, button('View photographs →', () => { $('photo-class').value = item.id; state.galleryOffset = 0; switchTab('gallery'); }));
      $('active-classes').append(card);
    });
    $('active-count').textContent = `${matching.length} of ${state.classes.length} snapshot classes${state.connected ? '' : ' · collection counts unavailable'}`;
    $('active-empty').hidden = matching.length > 0;
  }
  async function refreshCollection() {
    const run = ++state.classRun;
    $('dataset-refresh').disabled = true;
    message('dataset-status', 'Connecting to the collection…');
    try {
      const classes = [];
      let offset = 0, total;
      do {
        const page = await api.request(`/classes?limit=100&offset=${offset}`);
        if (!Array.isArray(page.items)) throw new Error('Invalid class response.');
        classes.push(...page.items); total = page.total; offset += page.items.length;
        if (!page.items.length || offset > 5000) break;
      } while (offset < total);
      const stats = await api.request('/stats');
      if (run !== state.classRun) return;
      state.classes = classes; state.connected = true;
      $('stat-classes').textContent = number(stats.classes ?? classes.length); $('stat-camera').textContent = number(stats.approved_camera); $('stat-satellite').textContent = number(stats.approved_satellite);
      $('stat-candidates').textContent = `${number(stats.candidates)} candidates awaiting verification`;
      $('snapshot-date').textContent = stats.snapshot_date ? `As of ${stats.snapshot_date}` : seed.snapshot_date ? `As of ${seed.snapshot_date}` : 'Snapshot date unavailable';
      message('dataset-status', state.owner ? 'Owner edit mode · keys clear when you leave this session.' : 'Collection connected · public, redistribution-cleared photographs.');
      classOptions(); renderClasses();
    } catch (error) {
      if (run !== state.classRun) return;
      state.connected = false; state.classes = seed.classes || [];
      ['stat-camera', 'stat-satellite'].forEach(id => { $(id).textContent = '—'; });
      $('stat-classes').textContent = number(state.classes.length); $('stat-candidates').textContent = 'Live counts unavailable';
      message('dataset-status', `Collection unavailable. Showing the dated class snapshot; photo counts are unknown. ${error.message}`, true);
      classOptions(); renderClasses();
    } finally { if (run === state.classRun) $('dataset-refresh').disabled = false; }
  }
  function switchTab(name, focus = false) {
    state.tab = name;
    document.querySelectorAll('[data-tab]').forEach(tab => { const selected = tab.dataset.tab === name; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; if (selected && focus) tab.focus(); });
    document.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
    if (name === 'gallery') loadGallery();
    if (name === 'releases') loadReleases(true);
  }
  const tabs = [...document.querySelectorAll('[data-tab]')];
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) { event.preventDefault(); switchTab(tabs[target].dataset.tab, true); }
    });
  });
  ['active-search', 'active-origin', 'active-pilot'].forEach(id => $(id).addEventListener(id === 'active-search' ? 'input' : 'change', renderClasses));
  $('dataset-refresh').addEventListener('click', async () => { await refreshCollection(); if (state.tab === 'gallery') loadGallery(); if (state.tab === 'releases') loadReleases(true); });

  function filterValues() { return Object.fromEntries(new FormData($('gallery-filters'))); }
  function updateSelection() {
    $('selected-count').textContent = state.selected.size;
    $('batch-open').disabled = state.selected.size === 0;
    $('select-page').checked = state.galleryItems.length > 0 && state.galleryItems.every(item => state.selected.has(item.id));
    $('select-page').indeterminate = state.galleryItems.some(item => state.selected.has(item.id)) && !$('select-page').checked;
  }
  function photoCard(record) {
    const card = element('article', 'dataset-photo-card'); card.dataset.id = record.id; card.dataset.selected = String(state.selected.has(record.id));
    if (state.owner) {
      const label = element('label', 'dataset-photo-select'); const check = element('input'); check.type = 'checkbox'; check.checked = state.selected.has(record.id); check.setAttribute('aria-label', `Select ${className(record.class_id)} photograph ${record.id}`);
      check.addEventListener('change', () => { if (check.checked) state.selected.set(record.id, record); else state.selected.delete(record.id); card.dataset.selected = String(check.checked); updateSelection(); }); label.append(check); card.append(label);
    }
    const open = button('', () => inspect(record.id), 'dataset-preview-button'); open.setAttribute('aria-label', `Inspect ${className(record.class_id)} photograph ${record.id}`);
    const img = element('img', 'dataset-photo-preview'); img.alt = `${className(record.class_id)} — ${record.viewpoint || record.domain} preview`; img.loading = 'lazy'; img.width = 640; img.height = 400;
    img.addEventListener('error', () => { if (!card.querySelector('.dataset-preview-error')) card.append(element('p', 'dataset-preview-error', 'Preview unavailable. Inspect the record or download its original.')); }); open.append(img); card.append(open);
    const caption = element('div', 'dataset-photo-caption'); caption.append(element('h3', '', className(record.class_id)));
    caption.append(element('p', '', `${number(record.quality?.original_width)} × ${number(record.quality?.original_height)} px · ${record.domain}`), element('p', '', `${record.operator_country || 'Operator unknown'} · ${record.captured_at || 'Date unknown'}`));
    const badges = element('div', 'dataset-badges'); badges.append(badge(rightsLabel(record.rights?.tier)), badge(text(record.status).toUpperCase(), record.status === 'accepted' ? '' : 'amber')); caption.append(badges); card.append(caption);
    queueMicrotask(() => loadPreview(img, record)); return card;
  }
  async function loadGallery() {
    state.galleryAbort?.abort(); state.galleryAbort = new AbortController(); const run = ++state.galleryRun;
    $('gallery').replaceChildren(); clearObjects('gallery'); $('gallery-empty').hidden = true;
    message('gallery-count', 'Loading photographs…'); $('gallery-next').disabled = true; $('gallery-previous').disabled = true;
    try {
      const result = await api.request(galleryQuery(filterValues(), state.galleryOffset), { signal: state.galleryAbort.signal });
      if (run !== state.galleryRun) return;
      state.galleryItems = result.items || []; state.galleryTotal = result.total || 0;
      $('gallery').replaceChildren(...state.galleryItems.map(photoCard));
      $('gallery-empty').hidden = state.galleryItems.length > 0;
      const start = state.galleryItems.length ? state.galleryOffset + 1 : 0;
      message('gallery-count', `${start}–${state.galleryOffset + state.galleryItems.length} of ${number(state.galleryTotal)} photographs${state.owner ? ' · owner view' : ' · public accepted originals'}`);
      $('gallery-page').textContent = `Page ${Math.floor(state.galleryOffset / PAGE_SIZE) + 1} of ${Math.max(1, Math.ceil(state.galleryTotal / PAGE_SIZE))}`;
      $('gallery-previous').disabled = state.galleryOffset === 0; $('gallery-next').disabled = state.galleryOffset + state.galleryItems.length >= state.galleryTotal;
      updateSelection();
    } catch (error) { if (error.name !== 'AbortError' && run === state.galleryRun) { state.galleryItems = []; message('gallery-count', error.message, true); $('gallery-page').textContent = 'Unavailable'; updateSelection(); } }
  }
  $('gallery-filters').addEventListener('submit', event => { event.preventDefault(); state.galleryOffset = 0; state.selected.clear(); loadGallery(); });
  $('gallery-clear').addEventListener('click', () => { $('gallery-filters').reset(); state.galleryOffset = 0; state.selected.clear(); loadGallery(); });
  $('gallery-previous').addEventListener('click', () => { state.galleryOffset = Math.max(0, state.galleryOffset - PAGE_SIZE); loadGallery(); });
  $('gallery-next').addEventListener('click', () => { state.galleryOffset += PAGE_SIZE; loadGallery(); });
  $('select-page').addEventListener('change', () => { state.galleryItems.forEach(item => { if ($('select-page').checked) state.selected.set(item.id, item); else state.selected.delete(item.id); }); $('gallery').replaceChildren(...state.galleryItems.map(photoCard)); updateSelection(); });

  function resetSources() { state.sourceOffset = 0; state.sourcesStarted = false; sourceSet.clear(); initialSources.forEach(url => sourceSet.add(url)); $('dataset-source-urls').replaceChildren(); $('dataset-source-status').textContent = ''; $('sources-more').hidden = false; }
  function clearOwner(refresh = true) {
    api.clearToken(); state.owner = false; state.epoch++; state.inspectionRun++; state.releaseInspectionRun++; state.galleryRun++; state.classRun++;
    state.galleryAbort?.abort(); clearObjects(); state.selected.clear(); state.galleryItems = []; state.image = null; state.release = null;
    state.connected = false; state.classes = seed.classes || []; classOptions(); renderClasses();
    ['stat-camera', 'stat-satellite'].forEach(id => { $(id).textContent = '—'; }); $('stat-classes').textContent = number(state.classes.length); $('stat-candidates').textContent = 'Live counts unavailable';
    ['photo-dialog', 'release-dialog', 'batch-dialog'].forEach(closeDialog);
    $('gallery').replaceChildren(); $('release-list').replaceChildren(); $('owner-key').value = ''; $('owner-clear').hidden = true;
    ['photo-metadata', 'photo-evidence', 'photo-badges', 'release-files', 'duplicate-list'].forEach(id => $(id).replaceChildren());
    ['photo-subtitle', 'photo-title', 'release-description', 'audit-item-title', 'batch-status', 'batch-summary'].forEach(id => { $(id).textContent = ''; });
    $('owner-open').textContent = 'Owner edit mode'; $('owner-open').dataset.enabled = 'false'; $('photo-status').disabled = true; $('photo-status').value = ''; $('photo-status').options[0].textContent = 'Public accepted photos'; $('gallery-selection').hidden = true;
    resetSources(); updateSelection();
    if (refresh) { refreshCollection(); if (state.tab === 'gallery') loadGallery(); if (state.tab === 'releases') loadReleases(true); }
    else message('dataset-status', 'Edit key cleared. Refresh to reconnect to the public collection.');
  }
  $('owner-open').addEventListener('click', () => { message('owner-status', state.owner ? 'Owner mode enabled. Clear the key to return to public reads.' : ''); dialog('owner-dialog'); if (!state.owner) $('owner-key').focus(); });
  $('owner-form').addEventListener('submit', async event => {
    event.preventDefault(); const key = $('owner-key').value.trim(); $('owner-key').value = '';
    if (!key) return;
    const submit = $('owner-form').querySelector('[type=submit]'), epoch = ++state.epoch; submit.disabled = true; api.setToken(key);
    try {
      const session = await api.request('/session');
      if (epoch !== state.epoch) return;
      if (session.role !== 'owner') throw new Error('This key does not authorize owner edits.');
      state.owner = true; state.epoch++; clearObjects(); state.selected.clear();
      $('owner-open').textContent = 'Owner mode · on'; $('owner-open').dataset.enabled = 'true'; $('owner-clear').hidden = false;
      $('photo-status').disabled = false; $('photo-status').options[0].textContent = 'All review statuses'; $('gallery-selection').hidden = false;
      message('owner-status', 'Owner mode enabled. Key held in memory only.'); closeDialog('owner-dialog'); resetSources();
      await refreshCollection(); if (state.tab === 'gallery') loadGallery(); if (state.tab === 'releases') loadReleases(true);
    } catch (error) { if (epoch === state.epoch) { clearOwner(); message('owner-status', error.message, true); } }
    finally { submit.disabled = false; }
  });
  $('owner-clear').addEventListener('click', () => { clearOwner(); message('owner-status', 'Key cleared. Public read-only view restored.'); });
  $('return-counter').addEventListener('click', () => { if (state.owner || api.hasToken()) clearOwner(); });
  window.addEventListener('pagehide', () => { if (api.hasToken() || state.owner) clearOwner(false); else clearObjects(); });

  function meta(label, value) { $('photo-metadata').append(element('dt', '', label), element('dd', '', text(value))); }
  function bboxFields(box) { ['crop-x', 'crop-y', 'crop-width', 'crop-height'].forEach((id, i) => { $(id).value = box?.[i] ?? 0; }); drawCrop(); }
  function readBox() { return ['crop-x', 'crop-y', 'crop-width', 'crop-height'].map(id => Number($(id).value)); }
  function drawCrop() {
    if (!state.image) return;
    const [x, y, w, h] = readBox(), q = state.image.quality || {};
    $('crop-overlay').setAttribute('viewBox', `0 0 ${q.original_width || 1} ${q.original_height || 1}`);
    ['x', 'y', 'width', 'height'].forEach((key, i) => $('crop-rectangle').setAttribute(key, [x, y, w, h][i]));
  }
  async function inspect(id) {
    const run = ++state.inspectionRun;
    clearObjects('inspection'); clearObjects('duplicates');
    state.image = null; $('inspect-image').removeAttribute('src'); $('inspect-image').alt = 'Loading photograph';
    $('photo-title').textContent = 'Loading photograph…'; $('photo-subtitle').textContent = id; $('photo-metadata').replaceChildren(); $('photo-evidence').replaceChildren(); $('photo-badges').replaceChildren();
    $('photo-edit-form').hidden = true; $('duplicate-panel').hidden = true; $('photo-stage').dataset.native = 'false'; $('native-size').setAttribute('aria-pressed', 'false'); $('native-size').textContent = 'Actual pixels'; $('native-size').disabled = true;
    message('photo-action-status', ''); message('original-status', 'Loading preview…'); $('quality-summary').textContent = ''; $('crop-rectangle').setAttribute('width', '0');
    $('load-original').disabled = true; $('download-original').disabled = true; dialog('photo-dialog');
    try {
      const record = unwrap(await api.request(`/images/${encodeURIComponent(id)}`));
      if (run !== state.inspectionRun) return;
      state.image = record; renderInspection(record);
      const preview = Boolean(record.assets?.preview), url = await imageURL(record, preview ? 'preview' : 'original', 'inspection');
      if (run !== state.inspectionRun) { revokeObject(url); return; }
      $('inspect-image').src = url; $('inspect-image').alt = `${className(record.class_id)}; ${record.viewpoint || 'viewpoint unknown'}`;
      $('native-size').disabled = preview;
      message('original-status', preview ? 'Preview displayed. Inspect the full-resolution original to judge detail.' : 'Original displayed. Use Actual pixels to judge native detail.');
      findDuplicates(record, run);
    } catch (error) { if (run === state.inspectionRun) message('photo-action-status', error.message, true); }
  }
  function renderInspection(record) {
    $('photo-title').textContent = className(record.class_id); $('photo-subtitle').textContent = `${record.id} · REVISION ${record.revision}`;
    $('photo-badges').replaceChildren(badge(text(record.status).toUpperCase(), record.status === 'accepted' ? '' : 'amber'), badge(record.domain.toUpperCase()), badge(rightsLabel(record.rights?.tier)));
    $('photo-metadata').replaceChildren(); const q = record.quality || {};
    meta('Original', `${number(q.original_width)} × ${number(q.original_height)} pixels`); meta('Submarine', `${number(q.subject_length_px)} native pixels`);
    if (record.domain === 'satellite') meta('Resolution', `${text(q.gsd_m_per_px)} m/pixel`);
    meta('Variant', record.variant); meta('Operator', record.operator_country); meta('Hull / vessel', record.hull); meta('Captured', record.captured_at); meta('Viewpoint', record.viewpoint); meta('Condition', record.condition);
    meta('License', record.rights?.license); meta('Attribution', record.rights?.attribution); meta('Event group', record.event_group); meta('Duplicate group', record.duplicate_group); meta('SHA-256', record.sha256);
    $('quality-summary').textContent = `Original resolution: ${q.original_resolution ? 'verified' : 'unverified'} · Not upscaled: ${q.not_upscaled ? 'verified' : 'unverified'} · Sharpness: ${q.sharpness_ok ? 'passed' : 'pending / failed'}`;
    $('photo-evidence').replaceChildren();
    for (const [label, url] of [['Source page', record.source?.page_url], ['Original source file', record.source?.original_url], ['Rights evidence', record.rights?.evidence_url]]) {
      if (url) { const block = element('div'); block.append(element('p', '', label), safeLink(url)); $('photo-evidence').append(block); }
    }
    (record.verification?.class_evidence || []).forEach(evidence => { const url = typeof evidence === 'string' ? evidence : evidence.url; if (url) $('photo-evidence').append(safeLink(url)); });
    $('photo-edit-form').hidden = !state.owner;
    $('crop-overlay').dataset.editable = String(state.owner);
    for (const [field, id] of [['class_id', 'edit-class'], ['variant', 'edit-variant'], ['operator_country', 'edit-operator'], ['hull', 'edit-hull'], ['captured_at', 'edit-date'], ['viewpoint', 'edit-viewpoint'], ['condition', 'edit-condition']]) $(id).value = record[field] || '';
    $('edit-reason').value = ''; bboxFields(record.target_bbox);
    $('load-original').disabled = !record.assets?.original; $('download-original').disabled = !record.assets?.original;
  }
  $('photo-dialog').addEventListener('close', () => { state.inspectionRun++; state.image = null; $('inspect-image').removeAttribute('src'); clearObjects('inspection'); clearObjects('duplicates'); });
  $('inspect-image').addEventListener('error', () => { if (state.image) message('original-status', 'This file cannot be displayed here. Download the original; TIFF images may require a desktop viewer.', true); });
  $('load-original').addEventListener('click', async () => {
    if (!state.image) return;
    const record = state.image, run = state.inspectionRun; $('load-original').disabled = true; message('original-status', 'Loading original bytes…');
    try {
      const url = await imageURL(record, 'original', 'inspection');
      if (run !== state.inspectionRun) { revokeObject(url); return; }
      $('inspect-image').src = url; $('native-size').disabled = false;
      message('original-status', `Original loaded: ${number(record.quality.original_width)} × ${number(record.quality.original_height)} px. Use Actual pixels to inspect native detail.`);
    } catch (error) { if (run === state.inspectionRun) message('original-status', error.message, true); }
    finally { if (run === state.inspectionRun) $('load-original').disabled = false; }
  });
  $('native-size').addEventListener('click', () => { const native = $('photo-stage').dataset.native !== 'true'; $('photo-stage').dataset.native = String(native); $('native-size').setAttribute('aria-pressed', String(native)); $('native-size').textContent = native ? 'Fit to view' : 'Actual pixels'; });
  async function download(path, filename, statusId) {
    const epoch = state.epoch;
    try {
      message(statusId, 'Downloading…'); const blob = await api.request(path, { blob: true });
      if (epoch !== state.epoch) return;
      const url = URL.createObjectURL(blob); state.objectURLs.set(url, 'download'); const link = element('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
      message(statusId, `Downloaded ${filename}.`);
      setTimeout(() => revokeObject(url), 60000);
    } catch (error) { message(statusId, error.message, true); }
  }
  $('download-original').addEventListener('click', () => { if (state.image) { const mime = state.image.assets?.original?.content_type || ''; const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/tiff': 'tif' }[mime] || 'image'; download(assetPath(state.image, 'original'), `${state.image.id}.${ext}`, 'original-status'); } });
  ['crop-x', 'crop-y', 'crop-width', 'crop-height'].forEach(id => $(id).addEventListener('input', drawCrop));
  let drag;
  function imagePoint(event) { const bounds = $('crop-overlay').getBoundingClientRect(); return [(event.clientX - bounds.left) * state.image.quality.original_width / bounds.width, (event.clientY - bounds.top) * state.image.quality.original_height / bounds.height]; }
  $('crop-overlay').addEventListener('pointerdown', event => { if (!state.owner || !state.image || event.button !== 0) return; drag = { start: imagePoint(event), before: readBox() }; $('crop-overlay').setPointerCapture(event.pointerId); event.preventDefault(); });
  $('crop-overlay').addEventListener('pointermove', event => { if (drag && state.image) bboxFields(cropFromDrag(drag.start, imagePoint(event), state.image.quality.original_width, state.image.quality.original_height)); });
  $('crop-overlay').addEventListener('pointerup', event => { if (!drag) return; if (readBox()[2] < 1 || readBox()[3] < 1) bboxFields(drag.before); drag = null; $('crop-overlay').releasePointerCapture(event.pointerId); });
  $('crop-overlay').addEventListener('pointercancel', () => { if (drag) bboxFields(drag.before); drag = null; });

  async function saveCorrection(changes, reason) {
    if (!state.owner || !state.image) return;
    if (!reason.trim()) { message('photo-action-status', 'Add a correction reason first.', true); $('edit-reason').focus(); return; }
    const original = state.image;
    $('photo-edit-form').querySelectorAll('button').forEach(node => { node.disabled = true; });
    try {
      const updated = unwrap(await api.patch(original, changes, reason));
      if (state.image?.id !== original.id) return;
      state.image = updated; renderInspection(updated);
      message('photo-action-status', changes.status === 'rejected' || changes.status === 'quarantined' ? `Record ${changes.status}. It is excluded from approved counts and releases.` : changes.target_bbox ? 'Correction saved. The crop must be regenerated and the record verified again before acceptance.' : 'Correction saved. The updated record requires verification before acceptance.');
      state.selected.delete(original.id); scheduleRefresh();
    } catch (error) { message('photo-action-status', error.status === 409 || error.status === 412 ? 'Another process changed this record. Reopen it before editing; your correction was not applied.' : error.message, true); }
    finally { $('photo-edit-form').querySelectorAll('button').forEach(node => { node.disabled = false; }); }
  }
  $('photo-edit-form').addEventListener('submit', event => {
    event.preventDefault(); if (!state.image) return;
    try {
      const box = validateCrop(readBox(), state.image.quality.original_width, state.image.quality.original_height), changes = {};
      for (const [field, id] of [['class_id', 'edit-class'], ['variant', 'edit-variant'], ['operator_country', 'edit-operator'], ['hull', 'edit-hull'], ['captured_at', 'edit-date'], ['viewpoint', 'edit-viewpoint'], ['condition', 'edit-condition']]) {
        const value = $(id).value.trim(); if (value !== (state.image[field] || '')) changes[field] = value || null;
      }
      if (box.some((value, i) => value !== state.image.target_bbox[i])) changes.target_bbox = box;
      if (!Object.keys(changes).length) { message('photo-action-status', 'No changes to save.'); return; }
      saveCorrection(changes, $('edit-reason').value);
    } catch (error) { message('photo-action-status', error.message, true); }
  });
  $('photo-reject').addEventListener('click', () => saveCorrection({ status: 'rejected' }, $('edit-reason').value));
  $('photo-quarantine').addEventListener('click', () => saveCorrection({ status: 'quarantined' }, $('edit-reason').value));
  async function findDuplicates(record, run) {
    if (!record.duplicate_group) return;
    try {
      const result = await api.request(`/images?duplicate_group=${encodeURIComponent(record.duplicate_group)}&limit=100&offset=0`);
      if (run !== state.inspectionRun) return;
      const duplicates = result.items.filter(other => other.id !== record.id && other.duplicate_group === record.duplicate_group);
      $('duplicate-panel').hidden = duplicates.length === 0; $('duplicate-list').replaceChildren();
      duplicates.forEach(other => { const open = button('', () => inspect(other.id), 'dataset-duplicate'); const img = element('img'); img.alt = `Compare ${other.id}`; img.loading = 'lazy'; open.append(img, element('span', '', `${other.id} · ${other.status}`)); $('duplicate-list').append(open); loadPreview(img, other, 'preview', 'duplicates'); });
    } catch { /* Main image remains usable when comparison data is unavailable. */ }
  }
  function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => { refreshCollection(); if (state.tab === 'gallery') loadGallery(); if (state.tab === 'releases') loadReleases(true); }, 250); }
  $('batch-open').addEventListener('click', () => { $('batch-summary').textContent = `${state.selected.size} selected photographs. Accepted records return to verification when corrected.`; message('batch-status', ''); dialog('batch-dialog'); });
  $('batch-field').addEventListener('change', () => { $('batch-value-label').hidden = ['reject', 'quarantine'].includes($('batch-field').value); });
  $('batch-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!state.owner || !state.selected.size) return;
    const field = $('batch-field').value, changes = field === 'reject' ? { status: 'rejected' } : field === 'quarantine' ? { status: 'quarantined' } : { [field]: $('batch-value').value.trim() || null };
    const submit = $('batch-form').querySelector('[type=submit]'), epoch = state.epoch; submit.disabled = true;
    try {
      const results = await applyBatch(api, [...state.selected.values()], changes, $('batch-reason').value, () => state.owner && epoch === state.epoch);
      if (epoch !== state.epoch) return;
      results.filter(item => item.ok).forEach(item => state.selected.delete(item.id));
      const failures = results.filter(item => !item.ok);
      message('batch-status', `${results.length - failures.length} saved; ${failures.length} unchanged.${failures.length ? ` ${failures.map(item => `${item.id}: ${item.message}`).join(' ')}` : ' Corrected records require verification.'}`, failures.length > 0);
      updateSelection(); scheduleRefresh();
    } catch (error) { message('batch-status', error.message, true); }
    finally { submit.disabled = false; }
  });

  function releaseCard(release) {
    const card = element('article', 'dataset-release-card'), info = element('div');
    info.append(element('h3', '', release.id));
    info.append(element('p', '', `${release.domain === 'satellite' ? 'Satellite supplement' : 'Balanced camera dataset'} · ${release.rights_tier === 'research' ? 'Research-only rights' : 'Commercial-capable rights'}${Number.isFinite(release.image_count) ? ` · ${number(release.image_count)} originals` : ''}`));
    const badges = element('div', 'dataset-badges'); badges.append(badge(text(release.status).toUpperCase(), release.status === 'withdrawn' ? 'red' : release.status === 'provisional' ? 'amber' : ''), badge(release.public ? 'PUBLIC DELIVERY' : 'RESTRICTED DELIVERY', 'muted')); info.append(badges);
    card.append(info, button('Files and sample audit →', () => inspectRelease(release.id))); return card;
  }
  async function loadReleases(reset = false) {
    const epoch = state.epoch, run = ++state.releaseRun;
    if (reset) { state.releaseOffset = 0; $('release-list').replaceChildren(); }
    $('releases-more').disabled = true; message('release-status', 'Loading releases…');
    try {
      const result = await api.request(`/releases?offset=${state.releaseOffset}&limit=24`);
      if (epoch !== state.epoch || run !== state.releaseRun) return;
      result.items.forEach(release => $('release-list').append(releaseCard(release))); state.releaseOffset += result.items.length;
      $('releases-more').hidden = state.releaseOffset >= result.total;
      message('release-status', result.total ? `${state.releaseOffset} of ${result.total} releases · provisional until audited` : 'No releases yet. A camera release requires at least two classes with 100 eligible originals each in the same rights tier.');
    } catch (error) { if (epoch === state.epoch && run === state.releaseRun) message('release-status', error.message, true); }
    finally { if (run === state.releaseRun) $('releases-more').disabled = false; }
  }
  $('releases-more').addEventListener('click', () => loadReleases());
  async function inspectRelease(id) {
    const run = ++state.releaseInspectionRun;
    $('release-title').textContent = id; $('release-description').textContent = 'Loading release…'; $('release-files').replaceChildren(); $('audit-item').hidden = true; message('release-action-status', ''); dialog('release-dialog');
    try {
      const data = await api.request(`/releases/${encodeURIComponent(id)}`);
      if (run !== state.releaseInspectionRun) return;
      state.release = data.release || data; state.auditIndex = 0;
      const release = state.release; $('release-description').textContent = `${release.domain} · ${release.rights_tier === 'research' ? 'Research-only' : 'Commercial-capable'} · ${release.status}. Files and checksums are frozen for this release; corrections create a new version.`;
      if (release.status !== 'withdrawn') ['classes.json', 'images.jsonl', 'README.md', 'ATTRIBUTION.json', 'coverage.json', 'CHANGELOG.md', 'checksums.json'].forEach(file => $('release-files').append(button(file, () => download(`/releases/${encodeURIComponent(id)}/files/${file}`, `${id}-${file}`, 'release-action-status'))));
      else $('release-files').append(element('p', 'dataset-help', 'This release was withdrawn. Its files are no longer available for training.'));
      renderAudit();
    } catch (error) { if (run === state.releaseInspectionRun) message('release-action-status', error.message, true); }
  }
  $('release-dialog').addEventListener('close', () => { state.releaseInspectionRun++; state.release = null; });
  function renderAudit() {
    const release = state.release, samples = release?.audit_sample || [], audits = release?.audits || [];
    const latest = new Map(audits.map(audit => [audit.image_id, audit]));
    const passed = samples.filter(sample => latest.get(typeof sample === 'string' ? sample : sample.image_id)?.result === 'pass').length;
    const status = release?.audit_status === 'sample_passed' ? 'Sample audit passed' : release?.status === 'withdrawn' ? 'Withdrawn' : 'Audit pending';
    $('audit-summary').textContent = `${status} · ${passed} of ${samples.length} samples passed · ${audits.length} recorded checks. Samples are stratified across classes, sources, and views.${state.owner ? '' : ' Enable owner edit mode to record an audit.'}`;
    if (release) $('release-description').textContent = `${release.domain} · ${release.rights_tier === 'research' ? 'Research-only' : 'Commercial-capable'} · ${release.status}. Files and checksums are frozen for this release; corrections create a new version.`;
    $('audit-item').hidden = samples.length === 0;
    if (!samples.length) return;
    const sample = samples[state.auditIndex], id = typeof sample === 'string' ? sample : sample.image_id;
    const done = latest.get(id);
    $('audit-item-title').textContent = `${className(sample.class_id || '')} · ${id}${done ? ` · ${done.result.toUpperCase()}` : ''}`;
    $('audit-position').textContent = `${state.auditIndex + 1} / ${samples.length}`;
    $('audit-previous').disabled = state.auditIndex === 0; $('audit-next').disabled = state.auditIndex >= samples.length - 1;
    $('audit-form').hidden = !state.owner; $('audit-reason').value = done?.reason || '';
  }
  $('audit-previous').addEventListener('click', () => { state.auditIndex--; renderAudit(); }); $('audit-next').addEventListener('click', () => { state.auditIndex++; renderAudit(); });
  $('audit-inspect').addEventListener('click', () => { const sample = state.release?.audit_sample?.[state.auditIndex]; if (sample) inspect(typeof sample === 'string' ? sample : sample.image_id); });
  $('audit-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!state.owner || !state.release) return;
    const sample = state.release.audit_sample[state.auditIndex], result = event.submitter?.value || 'pass', reason = $('audit-reason').value.trim(), run = state.releaseInspectionRun, epoch = state.epoch, id = state.release.id;
    if (!reason) { message('release-action-status', result === 'fail' ? 'Explain the failure before quarantining the sample.' : 'Record what you checked before passing the sample.', true); $('audit-reason').focus(); return; }
    $('audit-form').querySelectorAll('button').forEach(node => { node.disabled = true; });
    try {
      await api.request(`/releases/${encodeURIComponent(id)}/audits`, { method: 'POST', body: { image_id: typeof sample === 'string' ? sample : sample.image_id, result, reason } });
      if (epoch !== state.epoch || run !== state.releaseInspectionRun) return;
      const updated = await api.request(`/releases/${encodeURIComponent(id)}`);
      if (epoch !== state.epoch || run !== state.releaseInspectionRun) return;
      state.release = updated.release || updated; renderAudit();
      message('release-action-status', result === 'fail' ? 'Failure recorded. Affected records are quarantined and releases withdrawn; a corrected version is required.' : 'Sample audit recorded.');
      if (result === 'fail') $('release-files').replaceChildren(element('p', 'dataset-help', 'Release withdrawn after an audit failure.'));
      scheduleRefresh();
    } catch (error) { if (epoch === state.epoch && run === state.releaseInspectionRun) message('release-action-status', error.message, true); }
    finally { $('audit-form').querySelectorAll('button').forEach(node => { node.disabled = false; }); }
  });

  async function loadSources() {
    const epoch = state.epoch; $('sources-more').disabled = true; state.sourcesStarted = true;
    try {
      const result = await api.request(`/sources?offset=${state.sourceOffset}&limit=100`);
      if (epoch !== state.epoch) return;
      result.items.forEach(url => { if (!sourceSet.has(url)) { const row = element('li'); row.append(safeLink(url)); $('dataset-source-urls').append(row); sourceSet.add(url); } });
      state.sourceOffset += result.items.length; $('sources-more').hidden = state.sourceOffset >= result.total;
      $('sources-more').textContent = 'Load more dataset sources'; message('dataset-source-status', `${state.sourceOffset} of ${result.total} dataset source references checked; repeated URLs shown once.`);
    } catch (error) { if (epoch === state.epoch) message('dataset-source-status', `Historical references remain available. ${error.message}`, true); }
    finally { $('sources-more').disabled = false; }
  }
  $('sources-more').addEventListener('click', loadSources);
  $('open-sources').addEventListener('click', () => { if (!state.sourcesStarted) loadSources(); });
  classOptions(); renderClasses(); refreshCollection();
}

if (typeof document !== 'undefined') initWorkspace();
