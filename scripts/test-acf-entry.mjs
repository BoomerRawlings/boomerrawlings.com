import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'parse5';
import * as model from '../public/ACF/model.js';
import * as regions from '../public/ACF/regions.js';
import { compareTerritories } from '../public/ACF/comparison.js';
import { comparePublications } from '../public/ACF/publication-comparison.js';
import { previewInfo } from '../public/ACF/preview-data.js';
import { UIMotion } from '../public/ACF/ui-motion.js';
import { mapReading } from '../public/ACF/map-reading.js';
import { territoryGuide } from '../public/ACF/territory-guide.js';

const source = readFileSync(new URL('../public/ACF/entry.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../public/ACF/app.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../src/pages/ACF/index.astro', import.meta.url), 'utf8');
// Reuse immutable fixture bytes, never parsed catalogs, model indexes or VMs.
// Each simulated response still exercises the application's real JSON parse.
const catalogSourceTexts = new Map();
function catalogSource(file) {
  if (!catalogSourceTexts.has(file)) catalogSourceTexts.set(file, readFileSync(new URL('../public/ACF/data/' + file, import.meta.url), 'utf8'));
  return catalogSourceTexts.get(file);
}
const flush = () => new Promise(setImmediate);
const event = (type, properties = {}) => Object.assign(new Event(type, { cancelable: true }), properties);

// Exercise the real script against the real markup. This deliberately models only
// the DOM APIs used by the entrance; rendered geometry belongs to browser checks.
function harness({ reduced = false, animationAPI = true, entrySource = source, autoReady = true, bounds = {}, gpuCanvas = true, animationStartSkew = 0, timelineClock = true, timelineLag = 0, frameTimestampLag = 0, frameMode = 'normal', rejectAnimationClock = false, compact = false, targetCount = 60, targetPreparationTime = 0 } = {}) {
  let hasApp = false, currentGraph;
  let now = 0, timerId = 0, animations = 0, enters = 0, exits = 0, task = 0;
  const timers = new Map(), ids = new Map(), activeAnimations = new Map(), trace = [];
  const document = new EventTarget(), window = new EventTarget();
  const location = { hash: '', search: '', pathname: '/ACF/', href: 'https://atlas.example/ACF/' };
  const historyEntries = [{ state: null, url: location.href }]; let historyPosition = 0;
  const setLocation = url => { const parsed = new URL(url, location.href); location.href = parsed.href; location.hash = parsed.hash; location.search = parsed.search; location.pathname = parsed.pathname; };
  const history = {
    get state() { return historyEntries[historyPosition].state; },
    pushState(state, _unused, url) { setLocation(url); historyEntries.splice(++historyPosition); historyEntries.push({ state: structuredClone(state), url: location.href }); },
    replaceState(state, _unused, url) { setLocation(url); historyEntries[historyPosition] = { state: structuredClone(state), url: location.href }; },
    go(delta) { const next = historyPosition + delta; if (next < 0 || next >= historyEntries.length) return; historyPosition = next; setLocation(historyEntries[next].url); window.dispatchEvent(event('popstate')); },
  };
  document.hidden = false;
  document.timeline = { get currentTime() { return timelineClock ? now - timelineLag : null; } };
  document.title = markup.match(/<title>(.*?)<\/title>/)[1];
  // Reports outlive each harness. Nested VM objects retain their realm, including
  // its complete app index; copy diagnostic values without retaining that realm.
  const record = (event, detail = {}) => trace.push({ at: now, task, event, activeAnimations: activeAnimations.size,
    entranceAnimations: [...activeAnimations.values()].filter(target => /^(entry-|atlas-letter-|atlas-gpu-points$|network$)/.test(target)).length, ...structuredClone(detail) });
  const schedule = (callback, delay = 0) => {
    const id = ++timerId;
    timers.set(id, { at: now + delay, callback });
    return id;
  };
  const clear = id => timers.delete(id);
  class Element extends EventTarget {
    constructor(tag = 'div', attributes = []) {
      super();
      this.tagName = tag.toUpperCase();
      this.attributes = new Map(attributes.map(a => [a.name, a.value]));
      this.children = []; this.parentElement = null;
      this.hidden = this.attributes.has('hidden'); this.inert = this.attributes.has('inert');
      this.open = this.attributes.has('open'); this.readOnly = false; this.disabled = false;
      this.checked = this.attributes.has('checked');
      this.defaultChecked = this.checked;
      this.value = ''; this.textContent = ''; this.innerHTML = '';
      let scrollTop = 0;
      Object.defineProperty(this, 'scrollTop', { get: () => scrollTop, set: value => {
        scrollTop = Math.max(0, Number(value));
        if (Number.isFinite(this.scrollHeight) && Number.isFinite(this.clientHeight)) scrollTop = Math.min(scrollTop, Math.max(0, this.scrollHeight - this.clientHeight));
        record('element:scroll', { target: this.id, top: scrollTop });
      } });
      this.focusCount = 0; this.selectCount = 0;
      this.dataset = Object.fromEntries(attributes.filter(a => a.name.startsWith('data-')).map(a => [a.name.slice(5), a.value]));
      this.style = {};
      const classes = new Set((this.attributes.get('class') || '').split(/\s+/).filter(Boolean));
      this.classList = {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        contains: name => classes.has(name),
      };
      Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set: value => { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(name => classes.add(name)); } });
      if (!animationAPI) this.animate = undefined;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'id') ids.set(String(value), this); if (name === 'hidden') this.hidden = true; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); if (name === 'hidden') this.hidden = false; }
    focus() { document.activeElement = this; this.focusCount++; }
    blur() { if (document.activeElement === this) document.activeElement = null; }
    select() { this.selectCount++; }
    get id() { return this.attributes.get('id') || ''; }
    set id(value) { this.attributes.set('id', value); ids.set(value, this); }
    get options() { return this.children; }
    get lastElementChild() { return this.children.at(-1) || null; }
    append(...children) { for (const child of children) { this.children.push(child); child.parentElement = this; } }
    prepend(...children) { for (const child of children) child.parentElement = this; this.children.unshift(...children); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    before(child) { const position = this.parentElement.children.indexOf(this); this.parentElement.children.splice(position, 0, child); child.parentElement = this.parentElement; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
    close() { this.open = false; this.removeAttribute('open'); }
    matches(selector) {
      return selector.split(',').some(part => {
        const value = part.trim();
        if (value === '[hidden]') return this.hidden;
        if (value.startsWith('.')) return this.classList.contains(value.slice(1));
        if (value.startsWith('#')) return this.id === value.slice(1);
        return this.tagName === value.toUpperCase();
      });
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    getClientRects() { return this.closest('[hidden]') ? [] : [this.getBoundingClientRect()]; }
    querySelector(selector) {
      const descendants = [...this.children];
      for (let i = 0; i < descendants.length; i++) descendants.push(...descendants[i].children);
      if (selector.startsWith('.')) return descendants.find(n => n.classList.contains(selector.slice(1))) || null;
      if (/^[a-zA-Z,\s]+$/.test(selector)) return descendants.find(n => n.matches(selector)) || null;
      const attribute = selector.match(/^\[([^=]+)="([^"]*)"\]$/);
      assert(attribute, `Unexpected selector ${selector}`);
      return descendants.find(n => n.getAttribute(attribute[1]) === attribute[2]) || null;
    }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    getBoundingClientRect() {
      const supplied = bounds[this.id];
      const box = (typeof supplied === 'function' ? supplied(this) : supplied) || { left: 0, top: 0, width: 400, height: 250 };
      record('geometry:measure', { target: this.id, top: box.top, height: box.height });
      return { ...box, right: box.right ?? box.left + box.width, bottom: box.bottom ?? box.top + box.height };
    }
    scrollTo(options) { this.scrollTop = options.top; }
    animate(frames, options = {}) {
      animations++;
      const animationId = animations, target = this.id || this.className || this.attributes.get('class') || this.tagName;
      activeAnimations.set(animationId, target);
      const properties = [...new Set((Array.isArray(frames) ? frames : [frames]).flatMap(frame => Object.keys(frame)))].filter(key => !['offset', 'easing', 'composite'].includes(key));
      let visible = true;
      for (let node = this; node; node = node.parentElement) if (node.hidden) visible = false;
      let startTime = now + (animationId - 1) * animationStartSkew;
      record('animation:start', { target, recordId: this.getAttribute('data-record-id'), startTime, duration: options.duration || 0, delay: options.delay || 0, easing: options.easing || 'linear', properties, visible, keyframes: Array.isArray(frames) ? Array.from(frames, frame => ({ ...frame })) : frames });
      const started = trace.at(-1);
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const completion = () => { activeAnimations.delete(animationId); record('animation:finish', { target }); resolve(); };
      let timer = schedule(completion, startTime - now + (options.duration || 0) + (options.delay || 0));
      return {
        finished,
        get startTime() { return startTime; },
        set startTime(value) { if (rejectAnimationClock) throw new Error('Animation clock unavailable'); assert(Number.isFinite(value), 'An explicit animation clock must be finite'); startTime = value; started.startTime = value; clear(timer); timer = schedule(completion, Math.max(0, value - now + (options.duration || 0) + (options.delay || 0))); record('animation:clock', { target, startTime: value }); },
        cancel() { clear(timer); if (activeAnimations.delete(animationId)) record('animation:cancel', { target }); reject(new Error('Animation cancelled')); },
      };
    }
  }
  const root = new Element('document');
  function build(node, parent) {
    let next = parent;
    if (node.nodeName === '#text') parent.textContent += node.value;
    if (node.tagName) {
      next = new Element(node.tagName, node.attrs);
      parent.append(next);
      if (next.attributes.has('id')) ids.set(next.attributes.get('id'), next);
      if (node.tagName === 'body') document.body = next;
    }
    for (const child of node.childNodes || []) build(child, next);
  }
  build(parse(markup), root);
  const $ = id => { assert(ids.has(id), `Missing real markup ID ${id}`); return ids.get(id); };
  // The renderer creates this sibling canvas at runtime. Exercise the entrance
  // against both that WebGL surface and the overlay-only Canvas fallback.
  if (gpuCanvas) $('graph-stage').append(new Element('canvas', [{ name: 'class', value: 'atlas-gpu-points' }]));
  document.getElementById = id => {
    const node = ids.get(id);
    for (let parent = node; parent; parent = parent.parentElement) if (parent === root) return node;
    return null;
  };
  document.createElement = tag => { record('element:create', { tag }); return new Element(tag); };
  document.createElementNS = (_namespace, tag) => new Element(tag);
  document.querySelectorAll = selector => {
    if (selector === 'dialog[open]') return [...ids.values()].filter(n => n.tagName === 'DIALOG' && n.open);
    assert(/^[.#]?[a-zA-Z0-9_-]+$/.test(selector), `Unexpected document selector ${selector}`);
    const descendants = [...root.children];
    for (let i = 0; i < descendants.length; i++) descendants.push(...descendants[i].children);
    return descendants.filter(node => node.matches(selector));
  };
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  const motion = new EventTarget(); motion.matches = reduced;
  const entranceTargets = () => {
    const map = $('network').getBoundingClientRect();
    if (!map.width || !map.height || document.body.dataset.view === 'list') return [];
    const records = hasApp ? (currentGraph?.data?.nodes || []).filter(node => node.kind === 'item').slice(0, targetCount) : null;
    return Array.from({ length: records ? records.length : targetCount }, (_, i) => ({ id: records ? records[i].id : `actual-record-${i}`, x: ((i % 10) + .5) / 10 * map.width,
      y: ((Math.floor(i / 10) % 6) + .5) / 6 * map.height, radius: .8 + (i % 4) * .2, color: '#c6dff1' }));
  };
  document.addEventListener('acf:entry-targets', e => { if (!hasApp) { now += targetPreparationTime; e.detail.points = entranceTargets(); } record('acf:entry-targets'); });
  document.addEventListener('acf:enter', () => { enters++; record('acf:enter', { workspaceHidden: $('atlas-workspace').hidden, workspaceInert: $('atlas-workspace').inert }); if (!hasApp && autoReady) document.dispatchEvent(new CustomEvent('acf:ready')); });
  document.addEventListener('acf:exit', () => { exits++; record('acf:exit'); });
  document.addEventListener('acf:ready', () => record('acf:ready'));
  document.addEventListener('acf:load-error', () => record('acf:load-error'));
  const globals = {
    document, window, Event, CustomEvent, performance: { now: () => now },
    matchMedia: query => {
      if (query === '(prefers-reduced-motion: reduce)') return motion;
      assert.equal(query, '(max-width: 680px)');
      return { matches: compact };
    },
    setTimeout: (callback, delay) => { record('timer:schedule', { delay: delay || 0 }); return schedule(callback, delay); }, clearTimeout: clear,
    requestAnimationFrame: frameMode === 'unavailable' ? undefined : callback => {
      record('frame:request');
      if (frameMode === 'stalled') return ++timerId;
      return schedule(() => { record('frame:callback', { timestamp: now - frameTimestampLag, currentTime: now }); callback(now - frameTimestampLag); }, 16);
    },
    cancelAnimationFrame: id => { clear(id); record('frame:cancel'); },
  };
  document.defaultView = { matchMedia: globals.matchMedia };
  runInNewContext(entrySource, globals, { filename: 'public/ACF/entry.js' });
  return {
    $, document, window, motion, trace, history, location, entranceTargets,
    get graph() { return currentGraph; },
    get enters() { return enters; }, get exits() { return exits; },
    get animations() { return animations; }, get pendingTimers() { return timers.size; },
    type(value) { $('entry-input').value = value; $('entry-input').dispatchEvent(event('input')); },
    submit() { const e = event('submit'); $('entry-form').dispatchEvent(e); assert(e.defaultPrevented, 'Submission must not navigate'); },
    click(id) { $(id).dispatchEvent(event('click')); },
    loadApp({ fetchDelay = 0, directoryDelay = fetchDelay, bodyDelay = 0, failPath = null, networkFailPath = null, corruptPath = null } = {}) {
      hasApp = true;
      const directory = JSON.parse(catalogSource('index.json'));
      const data = new Map(directory.catalogs.map(entry => ['/ACF/data/' + entry.file, catalogSource(entry.file)]));
      const body = path => path === corruptPath ? '{invalid json' : path.endsWith('/index.json') ? JSON.stringify(directory) : data.get(path);
      class Graph {
        constructor(_canvas, options = {}) { currentGraph = this; this.ctx = {}; this.onStatus = options.onStatus; this.onSelect = options.onSelect; record('graph:construct'); }
        setData(graph) { this.data = graph; record('graph:setData', { nodes: graph.nodes.length, records: graph.nodes.filter(node => node.kind === 'item').length }); }
        setRegionSelection(ids, meta) { this.regionSelection = ids; this.regionSelectionMeta = meta; record('graph:setRegionSelection', { selected: ids === null ? null : ids.size, meta }); }
        setComparison(value) { this.comparison = value; record('graph:setComparison', { key: value?.key || null }); }
        setActive(active) { record('graph:setActive', { active }); }
        setLayers(layers) { record('graph:setLayers', { layers }); }
        focusRecord(id) { record('graph:focusRecord', { id }); return true; }
        reset(options) { record('graph:reset', options); }
        entranceTargets() { return entranceTargets(); }
      }
      class Preview { constructor() { this.card = new Element(); } close() {} }
      const moduleGlobals = {
        ...globals, ...model, ...regions, compareTerritories, comparePublications, AtlasGraph: Graph, NodePreview: Preview, previewInfo, UIMotion, mapReading, territoryGuide,
        URL, URLSearchParams, location, history,
        addEventListener: window.addEventListener.bind(window), performance: { now: () => now },
        AbortSignal: { timeout: () => undefined },
        JSON: { stringify: JSON.stringify, parse: value => { record('json:parse'); return JSON.parse(value); } },
        createIndex: catalogs => { const input = [...catalogs]; record('model:createIndex', { records: input.reduce((sum, c) => sum + c.items.length, 0) }); return model.createIndex(input); },
        graphData: (...args) => { record('model:graphData', { records: (args[1] || args[0].items).length, cached: Boolean(args[0].graph) }); return model.graphData(...args); },
        fetch: path => {
          assert(path === '/ACF/data/index.json' || data.has(path), `Unexpected catalog fetch ${path}`);
          record('fetch:start', { path });
          return new Promise((resolve, reject) => schedule(() => {
            record('fetch:response', { path });
            if (path === networkFailPath) { reject(new Error('Network unavailable')); return; }
            const consume = asJson => new Promise(finish => schedule(() => {
              record('fetch:body', { path });
              if (asJson) record('json:parse', { path });
              finish(asJson ? JSON.parse(body(path)) : body(path));
            }, path.endsWith('/index.json') ? 0 : bodyDelay));
            resolve({ ok: path !== failPath, status: path === failPath ? 503 : 200, json: () => consume(true), text: () => consume(false) });
          }, path.endsWith('/index.json') ? directoryDelay : fetchDelay));
        },
      };
      // Only module import declarations are replaced. Actual app listeners,
      // start/cache/fetch/rebuild/render paths execute, with real public metadata.
      runInNewContext(appSource.replace(/^import[^\n]+\r?\n/gm, ''), moduleGlobals, { filename: 'public/ACF/app.js' });
    },
    async tick() {
      await flush();
      assert(timers.size, 'Expected pending motion');
      const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      timers.delete(id); now = timer.at; task++; timer.callback(); await flush();
    },
    async settle() {
      await flush();
      for (let i = 0; timers.size && i < 240; i++) await this.tick();
      assert.equal(timers.size, 0, 'No orphaned animation/timer'); await flush();
    },
  };
}
function closed(h, expectedEntries = 0) {
  assert.equal(h.enters, expectedEntries);
  assert.equal(h.$('entry-screen').hidden, false);
  assert.equal(h.$('atlas-workspace').hidden, true);
  assert.equal(h.$('atlas-workspace').inert, true);
}
function usable(h, expectedEntries = 1) {
  assert.equal(h.enters, expectedEntries, 'One entry event per successful opening');
  assert.equal(h.$('entry-screen').hidden, true);
  assert.equal(h.$('entry-screen').inert, true);
  assert.equal(h.$('atlas-workspace').hidden, false);
  assert.equal(h.$('atlas-workspace').inert, false);
  assert.equal(h.$('skip-animation').hidden, true);
  assert.equal(h.$('entry-sequence').hidden, true, 'The usable workspace has no visible letter sequence');
  assert.equal(h.document.body.classList.contains('entry-pending'), false);
  assert.equal(h.document.body.classList.contains('entry-revealing'), false);
  assert.equal(h.document.getElementById('entry-transfer'), null, 'Opening removes the temporary mask, copies and tracings');
  assert.equal(h.document.activeElement, h.$(h.document.body.dataset.view === 'list' ? 'results-heading' : 'comparison-picker'), 'Focus enters the visible first action, never the collapsed search tools');
  assert.equal(h.pendingTimers, 0, 'Opening cancels remaining motion');
  assert.equal(h.document.title, 'The Atlas of Contested Futures', 'Successful entry reveals the collection title');
}
let cases = 0;
if (process.argv.includes('--probe-letter-progress')) {
  const h = harness(); h.type('atlas'); h.submit(); await assertLetterProgress(h);
}

for (const value of ['', 'world', 'ATLA', 'ATLASS', 'A TLAS']) {
  const h = harness({ reduced: true }); h.type(value); h.submit(); closed(h);
  assert.equal(h.$('entry-input').getAttribute('aria-invalid'), 'true');
  assert(h.$('entry-feedback').textContent.trim(), 'Helpful feedback is announced');
  assert(!/hint|below/i.test(h.$('entry-feedback').textContent), 'Wrong-answer feedback cannot point to a removed hint');
  assert.equal(h.document.activeElement, h.$('entry-input'));
  assert.equal(h.animations, 0);
  h.type('another path');
  assert.equal(h.$('entry-input').getAttribute('aria-invalid'), null);
  assert.equal(h.$('entry-feedback').textContent, ''); cases++;
}
{
  const h = harness({ reduced: true });
  assert(!/atlas/i.test(h.document.title), 'The browser title does not disclose the riddle answer');
  assert(!/atlas/i.test(h.$('entry-heading').textContent), 'The accessible heading does not disclose the answer');
  for (const id of ['entry-hint', 'hint-copy', 'entry-public-note']) assert.equal(h.document.getElementById(id), null, `${id} is removed from the entrance`);
  assert.equal(h.$('entry-input').getAttribute('aria-describedby'), 'entry-feedback', 'The input references only its existing feedback');
  for (let i = 0; i < 3; i++) { h.type('world'); h.submit(); }
  assert(!/atlas/i.test(h.$('entry-feedback').textContent), 'Wrong-answer feedback does not disclose the answer');
  closed(h); cases++;
}
for (const value of ['ATLAS', 'atlas', 'aTlAs', '  atlas  ', '\tatlas\u00a0']) {
  const h = harness({ reduced: true }); h.type(value); closed(h); h.submit();
  usable(h); // Synchronous: reduced motion does not wait for a timer or animation.
  assert.equal(h.animations, 0, 'Reduced motion creates no Web Animations');
  h.submit(); usable(h); cases++;
}
{
  const h = harness({ animationAPI: false }); h.type('atlas'); h.submit(); usable(h);
  assert.equal(h.animations, 0); cases++;
}
for (const reduced of [false, true]) {
  const h = harness({ reduced });
  for (let entry = 1; entry <= 3; entry++) {
    h.type('  ATLas '); h.submit(); h.submit();
    await h.settle(); usable(h, entry);
    const dialog = h.$('about-dialog'); dialog.open = true;
    h.click('return-entry'); closed(h, entry);
    assert.equal(h.exits, entry);
    assert.equal(dialog.open, false, 'Return closes open dialogs');
    assert.equal(h.$('entry-input').value, '');
    assert.equal(h.$('entry-input').readOnly, false);
    assert.equal(h.$('entry-submit').disabled, false);
    assert.equal(h.$('entry-prompt').inert, false);
    assert.equal(h.$('entry-sequence').hidden, true, 'Return clears the letter sequence');
    assert.equal(h.$('entry-screen').inert, false);
    assert.equal(h.$('entry-feedback').textContent, '');
    assert(!/atlas/i.test(h.document.title), 'Return restores the neutral browser title');
    assert.equal(h.document.activeElement, h.$('entry-input'));
    h.document.dispatchEvent(event('acf:exit-request'));
    assert.equal(h.exits, entry, 'Repeated exit request is harmless');
  }
  cases++;
}
for (const stage of ['start', 'letters']) for (const interruption of ['skip', 'resize', 'hidden', 'reduced-motion']) {
  const h = harness(); h.type('atlas'); h.submit();
  if (stage === 'letters') { await h.tick(); await h.tick(); }
  assert.equal(h.$('skip-animation').hidden, false);
  assert.equal(h.document.activeElement, h.$('skip-animation'));
  assert.equal(h.$('entry-sequence').hidden, false, 'The letter sequence remains visible until completion or interruption');
  assert.equal(h.$('atlas-workspace').hidden, true, 'The application stays hidden during the letter entrance');
  assert.equal(h.$('atlas-workspace').inert, true, 'The transition cannot receive premature input');
  if (interruption === 'skip') h.click('skip-animation');
  else if (interruption === 'resize') h.window.dispatchEvent(event('resize'));
  else if (interruption === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(event('visibilitychange')); }
  else { h.motion.matches = true; h.motion.dispatchEvent(event('change')); }
  usable(h);
  // Return before the cancelled promises resolve. They must not reopen the gate.
  h.click('return-entry'); await h.settle(); closed(h, 1);
  h.type('atlas'); h.submit(); await h.settle(); usable(h, 2); cases++;
}
{
  const h = harness();
  h.window.dispatchEvent(event('resize')); h.document.hidden = true;
  h.document.dispatchEvent(event('visibilitychange'));
  h.motion.matches = true; h.motion.dispatchEvent(event('change')); closed(h);
  const key = event('keydown', { key: 'Enter', isComposing: true });
  h.$('entry-input').dispatchEvent(key);
  assert(key.defaultPrevented, 'IME composition does not submit on Enter'); cases++;
}

function modelMotionOverlap(h) {
  // Later collection changes intentionally reveal their new UI. This guard
  // isolates the entrance tracks whose typing must remain free of model work.
  return h.trace.filter(step => (step.event === 'model:createIndex' || step.event === 'model:graphData') && step.records > 0 && step.entranceAnimations > 0);
}
function assertNoModelMotionOverlap(h) {
  assert.equal(modelMotionOverlap(h).length, 0, 'Catalog indexing/graph preparation must not overlap entrance Web Animations');
}

function assertLetterMotion(h) {
  const animations = h.trace.filter(step => step.event === 'animation:start');
  assert.equal(animations.length, 32, 'Normal opening animates letters/stars, caption, fourteen angular paths and three satellite groups');
  const prompt = animations.find(step => step.target === 'entry-prompt');
  assert(prompt && prompt.duration <= 300, 'Prompt fade clears room for the letters');
  assert.deepEqual(prompt.properties, ['opacity']);
  const letters = Array.from({ length: 5 }, (_, i) => animations.find(step => step.target === `atlas-letter-${i}`));
  assert(letters.every(Boolean), 'All five ATLAS letter targets animate');
  assert.equal(letters.map(letter => h.$(letter.target).textContent).join(''), 'ATLAS', 'The real hidden markup spells the opening word');
  for (const star of animations.filter(step => step.target.startsWith('entry-star-') || ['entry-links', 'entry-field'].includes(step.target))) assert.deepEqual(star.properties, ['opacity'], 'Constellation emergence changes opacity only');
  assert.equal(h.$('entry-sequence').getAttribute('aria-hidden'), 'true', 'Decorative letters do not duplicate the screen-reader announcement');
  for (const [i, letter] of letters.entries()) {
    assert(letter.visible, 'Animated letters must not have a hidden DOM ancestor');
    assert.deepEqual([...letter.properties].sort(), ['opacity', 'transform'], 'Letters use composited transform and opacity only');
    assert.equal(letter.easing, 'linear', 'The letter timeline remains linear so the shared hold uses elapsed time; ease individual keyframe segments instead');
    assert(letter.duration > 0 && letter.duration <= 3000, 'Each letter has a bounded type, hold and constellation sequence');
    assert(i === 0 ? letter.delay >= prompt.duration : letter.delay - letters[i - 1].delay >= 150 && letter.delay - letters[i - 1].delay <= 300, 'Letters type in an ordered readable cadence after the prompt clears');
    assert.equal(letter.keyframes.length, 5, 'Letter motion includes typed appearance, settled hold and star conversion');
    assert.equal(letter.keyframes[0].transform, letter.keyframes[2].transform, 'Typed letters remain aligned instead of tumbling');
    assert.equal(letter.keyframes[0].easing, 'steps(1, end)', 'Characters appear with a discrete typing step');
    assert.equal(letter.keyframes[2].opacity, 1, 'The ATLAS word becomes fully visible');
    assert.equal(letter.keyframes[1].opacity, 1, 'Typed letters immediately reach their readable state');
    assert.equal(letter.keyframes[1].transform, letter.keyframes[2].transform, 'Each letter has a settled hold before its exit');
    assert(letter.keyframes[3].opacity > 0 && letter.keyframes[3].opacity < 1, 'Each shrinking glyph remains visible during its conversion');
    assert.equal(letter.keyframes.at(-1).opacity, 0, 'Letters fade out before the workspace opens');
    assert.notEqual(letter.keyframes[3].transform, letter.keyframes.at(-1).transform, 'Each letter travels into its constellation point');
  }
  const holdStart = Math.max(...letters.map(letter => letter.at + letter.delay + letter.duration * letter.keyframes[1].offset));
  const holdEnd = Math.min(...letters.map(letter => letter.at + letter.delay + letter.duration * letter.keyframes[2].offset));
  assert(holdEnd - holdStart >= 700, 'The complete ATLAS word has a quiet readable hold of at least 700ms');
  assert(Math.max(...letters.map(letter => letter.duration + letter.delay)) <= 3300, 'The letter entrance finishes within its bounded motion budget');
  const cursor = animations.find(step => step.target === 'entry-cursor');
  assert(cursor && cursor.keyframes.some(frame => frame.easing === 'steps(4, end)'), 'The cursor advances four times after the first typed character');
  assert.equal(cursor.keyframes.at(-1).opacity, 0, 'Cursor disappears before the constellation holds');
  const decorative = animations.filter(step => /^(entry-star-|entry-route-|entry-branch-|entry-satellites-)/.test(step.target));
  assert(decorative.every(step => step.delay >= holdEnd), 'The quiet full-word hold is not interrupted by constellation activity');
  assert.equal(h.trace.filter(step => step.event === 'timer:schedule').length, 0, 'Opening creates no custom timers');
  assert.equal(h.trace.filter(step => step.event === 'element:create').length, 0, 'Opening creates no transient wave/overlay nodes');
}
function assertConstellationMotion(h) {
  const animations = h.trace.filter(step => step.event === 'animation:start');
  const anchorCoordinates = Array.from({ length: 5 }, (_, i) => ['cx', 'cy'].map(name => Number(h.$(`entry-star-${i}`).getAttribute(name))).join(','));
  const paths = animations.filter(step => /^entry-(route|branch)-/.test(step.target));
  assert.equal(paths.length, 14, 'All six routes and eight branches actually trace');
  for (const path of paths) {
    assert(path.visible, 'Traced paths have no hidden ancestor');
    assert.deepEqual([...path.properties].sort(), ['opacity', 'strokeDashoffset'], 'Paths reveal their geometry without moving endpoints');
    assert.equal(Number(path.keyframes[0].strokeDashoffset), 1000, 'A route starts fully undrawn');
    assert.equal(Number(path.keyframes.at(-1).strokeDashoffset), 0, 'A route finishes completely drawn');
    assert.equal(path.keyframes.at(-1).opacity, 1, 'A completed route matches its resting opacity');
    const node = h.$(path.target), geometry = node.getAttribute('d');
    assert.equal(node.tagName, 'PATH');
    assert.equal(node.getAttribute('pathLength'), '1000', 'Different path lengths share normalized drawing progress');
    assert(!/[ACQST]/i.test(geometry), 'Constellation routes use angular segments, not curves');
    const coordinates = geometry.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert(coordinates.length >= 6 && coordinates.length % 2 === 0, 'Each path has a start, bend and endpoint');
    assert(anchorCoordinates.includes(coordinates.slice(0, 2).join(',')), 'Branches originate at an actual decorative anchor');
    let bends = 0;
    for (let i = 2; i < coordinates.length - 2; i += 2) {
      const ax = coordinates[i] - coordinates[i - 2], ay = coordinates[i + 1] - coordinates[i - 1];
      const bx = coordinates[i + 2] - coordinates[i], by = coordinates[i + 3] - coordinates[i + 1];
      if (ax * by !== ay * bx) bends++;
    }
    assert(bends > 0, 'An angular route visibly changes direction');
    if (path.target.startsWith('entry-route-')) assert(anchorCoordinates.includes(coordinates.slice(-2).join(',')), 'Core routes terminate at a decorative anchor');
  }
  for (const prefix of ['entry-route-', 'entry-branch-', 'entry-satellites-']) {
    const group = animations.filter(step => step.target.startsWith(prefix));
    for (let i = 1; i < group.length; i++) assert(group[i].delay > group[i - 1].delay, `${prefix} unfolds in distinct stages`);
    assert(group.every(step => step.duration > 0 && step.duration <= 1600), 'Each individual draw remains bounded');
  }
  const satellites = animations.filter(step => step.target.startsWith('entry-satellites-'));
  assert.equal(satellites.length, 3);
  for (const satellite of satellites) {
    assert.deepEqual(satellite.properties, ['opacity']);
    assert.equal(satellite.keyframes[0].opacity, 0);
    assert.equal(satellite.keyframes.at(-1).opacity, 1);
  }
}
async function assertLetterProgress(h) {
  assertLetterMotion(h);
  assertConstellationMotion(h);
  assert.equal(h.$('entry-sequence').hidden, false, 'The letter sequence is displayed during normal opening');
  closed(h);
  // Exercise every actual finished promise before the static loading hold.
  while (!h.enters) {
    await h.tick();
    if (!h.enters) closed(h);
    assert.equal(h.$('entry-sequence').hidden, false, 'Constellation stays visible through the data handoff');
  }
  assert.equal(h.$('atlas-workspace').hidden, false, 'Prepared workspace can lay out beneath the still constellation');
  assert.equal(h.$('atlas-workspace').inert, true, 'The covered workspace remains inert until the reveal completes');
  const formationFinishes = h.trace.filter(step => step.event === 'animation:start' && step.at < h.trace.find(step => step.event === 'acf:enter').at).map(step => step.startTime + step.duration + step.delay);
  assert.equal(h.trace.find(step => step.event === 'acf:enter').at, Math.max(...formationFinishes), 'Data work waits for the complete letter and angular constellation formation');
  const completed = new Set(h.trace.filter(step => step.event === 'animation:finish').map(step => step.target));
  assert(h.trace.filter(step => step.event === 'animation:start' && step.at < h.trace.find(step => step.event === 'acf:enter').at).every(step => completed.has(step.target)), 'Every decorative formation track finishes before entry; none is cut short');
  await h.settle(); usable(h);
  assert.equal(h.$('entry-sequence').hidden, true);

}
{
  const h = harness(); h.type('atlas'); h.submit();
  await assertLetterProgress(h);
  cases++;
}
function graphPreparations(h) { return h.trace.filter(step => step.event === 'model:graphData' && !step.cached); }
const fetchBoundarySequences = [];
async function assertFetchBoundary(kind) {
  const h = harness();
  h.loadApp(kind === 'directory' ? { directoryDelay: 800 } : { bodyDelay: 800 });
  h.type('atlas'); h.submit();
  while (!h.enters) await h.tick();
  if (kind === 'body') while (h.trace.filter(step => step.event === 'fetch:response').length < 10) await h.tick();
  h.click('skip-animation'); h.click('return-entry'); h.type('atlas'); h.submit();
  await h.settle(); usable(h, 2);
  const overlap = h.trace.filter(step => ['fetch:start', 'json:parse'].includes(step.event) && step.activeAnimations > 0);
  assert.equal(overlap.length, 0, `${kind}: delayed response must not start requests or parse JSON during repeated letters`);
  assertNoModelMotionOverlap(h); assertPreparationYields(h);
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10);
  assert.equal(h.trace.filter(step => step.event === 'json:parse').length, 10);
  assert.equal(graphPreparations(h).length, 1);
  assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 1);
  fetchBoundarySequences.push({ kind, trace: h.trace });
}
async function assertLateFailure(kind) {
  const h = harness();
  const options = kind === 'body' ? { bodyDelay: 800, corruptPath: '/ACF/data/ieet.json' }
    : { directoryDelay: 800, [kind === 'http' ? 'failPath' : 'networkFailPath']: '/ACF/data/index.json' };
  h.loadApp(options); h.type('atlas'); h.submit();
  while (!h.enters) await h.tick();
  if (kind === 'body') while (h.trace.filter(step => step.event === 'fetch:response').length < 10) await h.tick();
  h.click('skip-animation'); h.click('return-entry'); h.type('atlas'); h.submit();
  await h.settle(); usable(h, 2);
  const failures = h.trace.filter(step => step.event === 'acf:load-error');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].activeAnimations, 0, `${kind}: late failure cannot dismiss a repeated letter intro`);
  assert(failures[0].at >= h.trace.filter(step => step.event === 'acf:enter')[1].at);
  assert.equal(h.$('dataset-status').textContent, 'Collection unavailable');
  assert.equal(h.document.body.dataset.view, 'list');
  assert(h.$('results').children.some(child => child.textContent === 'Retry loading'));
  assertNoModelMotionOverlap(h);
  fetchBoundarySequences.push({ kind: `${kind}-failure`, trace: h.trace });
}
function assertPreparationYields(h) {
  const index = h.trace.find(step => step.event === 'model:createIndex' && step.records > 0);
  const graph = graphPreparations(h)[0];
  const upload = h.trace.find(step => step.event === 'graph:setData');
  assert(index && graph && upload, 'The actual app completes all three preparation stages');
  assert(index.task < graph.task && graph.task < upload.task, 'Index, cached graph preparation and renderer upload occupy separate scheduled tasks');
}
if (process.argv.includes('--probe-preparation-yields')) {
  const h = harness({ reduced: true }); h.loadApp(); h.type('atlas'); h.submit(); await h.settle();
  assertPreparationYields(h); process.exit(0);
}
if (process.argv.includes('--probe-fetch-boundaries')) {
  await assertFetchBoundary(process.argv.includes('--body-only') ? 'body' : 'directory'); process.exit(0);
}
if (process.argv.includes('--probe-load-errors')) {
  for (const kind of ['http', 'network', 'body']) await assertLateFailure(kind); process.exit(0);
}

for (const completion of ['ready', 'error', 'skip', 'resize', 'hidden', 'reduced-motion']) {
  const h = harness({ autoReady: false }); h.type('atlas'); h.submit(); await h.settle();
  assert.equal(h.enters, 1);
  assert.equal(h.$('entry-screen').hidden, false, 'The static constellation covers the data load');
  assert.equal(h.$('entry-loading').hidden, false, 'Loading has a visible accessible status');
  assert.equal(h.$('atlas-workspace').hidden, false, 'The graph can measure its eventual viewport');
  assert.equal(h.$('atlas-workspace').inert, true);
  assert.equal(h.trace.find(step => step.event === 'acf:enter').activeAnimations, 0, 'No entrance animation runs while indexing starts');
  assert.equal(h.animations, 32, 'The loading hold adds no ambient animations');
  if (completion === 'ready') h.document.dispatchEvent(event('acf:ready'));
  else if (completion === 'error') h.document.dispatchEvent(event('acf:load-error'));
  else if (completion === 'skip') h.click('skip-animation');
  else if (completion === 'resize') h.window.dispatchEvent(event('resize'));
  else if (completion === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(event('visibilitychange')); }
  else { h.motion.matches = true; h.motion.dispatchEvent(event('change')); }
  await h.settle(); usable(h);
  h.click('return-entry');
  h.document.dispatchEvent(event('acf:ready')); h.document.dispatchEvent(event('acf:load-error'));
  await h.settle(); closed(h, 1); cases++;
}
{
  const h = harness({ autoReady: false }); h.type('atlas'); h.submit(); await h.settle();
  h.document.dispatchEvent(event('acf:ready'));
  await h.tick();
  assert.equal(h.animations, 116, 'Five apertures, sixty real-star copies and eighteen tracings bound the handoff');
  h.click('skip-animation'); usable(h);
  h.click('return-entry'); await h.settle(); closed(h, 1); cases++;
}
function translation(frame) {
  const match = frame.transform?.match(/^translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)$/);
  assert(match, 'Transfer transform retains a finite, explicit destination');
  return { x: Number(match[1]), y: Number(match[2]), scale: Number(match[3]) };
}
function assertTransfer(h, reveal, map) {
  assert(!reveal.some(step => ['network', 'atlas-gpu-points', 'entry-screen'].includes(step.target)), 'The field and full screen remain stationary; neither is scaled or faded');
  const transfer = h.document.getElementById('entry-transfer'), mask = h.document.getElementById('entry-apertures');
  assert(transfer && mask && transfer.contains(mask), 'The real map is revealed through a connected SVG aperture mask');
  assert.equal(transfer.getAttribute('hidden'), null, 'The transfer is visible when its synchronized animations begin');
  const covering = transfer.children.find(node => node.tagName === 'RECT');
  assert.equal(covering?.getAttribute('mask'), 'url(#entry-apertures)', 'The mask actually controls the covering surface');
  assert.equal(mask.children[0].getAttribute('fill'), 'white', 'An opaque initial covering has genuine cutout holes');
  const apertures = reveal.filter(step => step.target.startsWith('entry-aperture-'));
  const copies = reveal.filter(step => step.target.startsWith('entry-transfer-star-'));
  const routes = reveal.filter(step => step.target.startsWith('entry-transfer-route-'));
  const expected = h.entranceTargets().slice(0, 60);
  assert.equal(apertures.length, 5, 'Exactly five originating stars open the field');
  assert.equal(mask.children.filter(node => node.tagName === 'CIRCLE').length, 5, 'All animated apertures belong to the covering mask');
  assert.equal(copies.length, expected.length, 'Each bounded target receives one temporary star');
  assert(copies.length <= 60 && routes.length <= 18, 'Copies and tracings stay bounded independently of collection size');
  assert.equal(routes.length, Math.min(18, copies.length));
  const ids = new Set();
  const expectedById = new Map(expected.map(point => [point.id, point]));
  for (const copy of copies) {
    const point = h.document.getElementById(copy.target), id = point?.getAttribute('data-record-id');
    assert(expectedById.has(id) && !ids.has(id), 'Every transferred star identifies a distinct actual record'); ids.add(id);
    const target = expectedById.get(id), destination = translation(copy.keyframes.at(-1));
    assert.equal(destination.x, map.left + target.x, 'Every star lands on the actual screen x coordinate of its record');
    assert.equal(destination.y, map.top + target.y, 'Every star lands on the actual screen y coordinate of its record');
    assert.equal(destination.scale, 1);
    const arrival = copy.keyframes.find(frame => frame.opacity === 1 && frame.transform === copy.keyframes.at(-1).transform);
    assert(arrival && arrival.offset < .9, 'A transferred star reaches its real endpoint before relinquishing its temporary copy');
    const route = h.document.getElementById(copy.target.replace('star-', 'route-'));
    if (route) assert(route.getAttribute('d').endsWith(`L${destination.x} ${destination.y}`), 'Angular tracing ends at the same real star');
  }
  const viewport = h.$('entry-screen').getBoundingClientRect();
  const feather = h.document.getElementById('entry-feather');
  assert(feather && transfer.contains(feather), 'A connected radial gradient softens the growing apertures');
  const opaqueStops = feather.children.filter(node => node.getAttribute('stop-color') === 'black' && Number(node.getAttribute('stop-opacity') ?? 1) === 1);
  assert(opaqueStops.length >= 2 && opaqueStops.some(node => Number(node.getAttribute('offset')) === 0));
  const opaqueRadius = Math.max(...opaqueStops.map(node => Number(node.getAttribute('offset'))));
  const outerStop = feather.children.at(-1);
  assert.equal(Number(outerStop.getAttribute('offset')), 1);
  assert.equal(Number(outerStop.getAttribute('stop-opacity')), 0, 'The outer aperture edge is transparent, not a hard circle');
  for (const aperture of apertures) {
    const node = h.document.getElementById(aperture.target), end = translation(aperture.keyframes.at(-1));
    assert.equal(node.getAttribute('fill'), 'url(#entry-feather)');
    assert(translation(aperture.keyframes[0]).scale < 1, 'Cutouts begin as points, not an already uncovered screen');
    assert([[0, 0], [viewport.width, 0], [0, viewport.height], [viewport.width, viewport.height]].every(([x, y]) => Math.hypot(x - end.x, y - end.y) <= end.scale * opaqueRadius), 'Completed mask fully reveals every viewport corner inside its opaque cutout');
  }
  for (const track of [...apertures, ...copies, ...routes]) {
    assert.equal(track.delay + track.duration, expected.length ? 3200 : 1100, 'Every spatial track ends at the same bounded handoff time');
  }
  const sequence = reveal.find(step => step.target === 'entry-sequence');
  assert(sequence && sequence.duration <= 600 && !sequence.properties.includes('transform'), 'Only the outgoing constellation releases briefly; it never shrinks as a whole');
}
for (const gpuCanvas of [true, false]) for (const [width, height] of [[1280, 900], [390, 844], [320, 700]]) {
  const word = { left: width / 2 - 180, top: height * .46 - 110, width: 360, height: 220 };
  const map = { left: 0, top: height * .35, width: width > 600 ? width - 354 : width, height: height * .55 };
  const h = harness({ autoReady: false, bounds: { 'entry-word': word, network: map, 'entry-screen': { left: 0, top: 0, width, height } }, gpuCanvas });
  h.type('atlas'); h.submit(); await h.settle();
  assert.equal(h.trace.find(step => step.event === 'acf:enter').at, 5000, 'The typing/constellation phase has a fixed 5s budget');
  assert(!h.trace.some(step => step.target === 'network'), 'The actual map does not animate before it is ready');
  const beforeReady = h.trace.length;
  h.document.dispatchEvent(event('acf:ready'));
  await h.tick();
  assert(h.document.body.classList.contains('entry-revealing'), 'Reveal marks the short compositor lifetime');
  const reveal = h.trace.slice(beforeReady).filter(step => step.event === 'animation:start');
  assertTransfer(h, reveal, map);
  assert.equal(h.$('atlas-workspace').inert, true, 'Inputs wait until visual settling finishes');
  await h.settle(); usable(h); cases++;
}
for (const interruption of ['resize', 'hidden', 'reduced-motion', 'error']) {
  const h = harness({ autoReady: false }); h.type('atlas'); h.submit(); await h.settle();
  h.document.dispatchEvent(event('acf:ready'));
  await h.tick();
  if (interruption === 'resize') h.window.dispatchEvent(event('resize'));
  else if (interruption === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(event('visibilitychange')); }
  else if (interruption === 'error') h.document.dispatchEvent(event('acf:load-error'));
  else { h.motion.matches = true; h.motion.dispatchEvent(event('change')); }
  usable(h);
  h.click('return-entry'); await h.settle(); closed(h, 1); cases++;
}
async function assertSharedRevealClock(entrySource = source) {
  // Deliberately offset implicit animation launches. Explicit common startTime
  // must remove that skew instead of merely issuing consecutive animate calls.
  const h = harness({ entrySource, autoReady: false, animationStartSkew: .25, timelineLag: 904, frameTimestampLag: 976, targetPreparationTime: 1350 });
  h.type('atlas'); h.submit(); await h.settle();
  const beforeReady = h.trace.length;
  h.document.dispatchEvent(event('acf:ready'));
  assert.equal(h.$('entry-loading').hidden, false, 'The still loading constellation remains visible while waiting for a fresh frame');
  assert.equal(h.trace.slice(beforeReady).filter(step => step.event === 'animation:start').length, 0, 'No reveal starts from a potentially stale document timeline');
  assert.notEqual(h.document.getElementById('entry-transfer')?.getAttribute('hidden') ?? null, null, 'The prepared transfer stays hidden until a fresh frame can begin it');
  await h.tick();
  const reveal = h.trace.slice(beforeReady).filter(step => step.event === 'animation:start');
  assert.equal(reveal.length, 84);
  assert.equal(new Set(reveal.map(step => step.startTime)).size, 1, 'All reveal layers use one explicit document timeline clock');
  const freshFrame = h.trace.slice(beforeReady).find(step => step.event === 'frame:callback');
  assert(freshFrame && reveal.every(step => step.startTime === freshFrame.currentTime), 'The reveal clock comes from fresh frame execution time even when document.timeline and RAF timestamp are stale');
  assert(reveal.every(step => step.at === freshFrame.currentTime), 'Expensive target preparation cannot consume the fresh frame execution time before launch');
  assertTransfer(h, reveal, h.$('network').getBoundingClientRect());
  await h.settle(); usable(h);
  const finishes = h.trace.slice(beforeReady).filter(step => step.event === 'animation:finish');
  assert.equal(finishes.find(step => step.target === 'entry-sequence').at, freshFrame.currentTime + 560);
  assert(finishes.filter(step => step.target !== 'entry-sequence').every(step => step.at === freshFrame.currentTime + 3200), 'Every spatial track receives its full shared interval after the fresh frame');
}
await assertSharedRevealClock(); cases++;
for (const unavailableClock of [{ frameMode: 'unavailable' }, { frameMode: 'stalled' }, { rejectAnimationClock: true }]) {
  const h = harness({ ...unavailableClock, animationStartSkew: .25 });
  h.type('atlas'); h.submit(); await h.settle(); usable(h);
  assert.equal(h.trace.filter(step => step.event === 'animation:clock').length, 0, 'An unavailable explicit clock uses the safe implicit timeline');
  cases++;
}
{
  const h = harness({ timelineClock: false }); h.type('atlas'); h.submit(); await h.settle(); usable(h);
  assert.equal(h.trace.filter(step => step.event === 'animation:clock').length, 84, 'A fresh frame synchronizes every transfer track without document.timeline');
  cases++;
}
for (const interruption of ['skip', 'resize', 'hidden', 'reduced-motion', 'error']) {
  const h = harness({ autoReady: false }); h.type('atlas'); h.submit(); await h.settle();
  const beforeReady = h.trace.length;
  h.document.dispatchEvent(event('acf:ready'));
  assert(h.trace.slice(beforeReady).some(step => step.event === 'frame:request'), 'A fresh frame is pending');
  if (interruption === 'skip') h.click('skip-animation');
  else if (interruption === 'resize') h.window.dispatchEvent(event('resize'));
  else if (interruption === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(event('visibilitychange')); }
  else if (interruption === 'error') h.document.dispatchEvent(event('acf:load-error'));
  else { h.motion.matches = true; h.motion.dispatchEvent(event('change')); }
  usable(h); h.click('return-entry'); await h.settle(); closed(h, 1);
  assert.equal(h.trace.slice(beforeReady).filter(step => step.event === 'animation:start').length, 0, 'A cancelled frame wait cannot resurrect reveal tracks after returning to the riddle');
  cases++;
}
async function assertRevealScroll({ compact = true, view = 'map', expanded = false, comparison = false, completion = 'animated' } = {}, entrySource = source) {
  let h;
  const mainBox = { left: 0, top: 190, width: compact ? 390 : 1280, height: 620 };
  const guideHeight = 96;
  const surfaceBox = () => ({ left: 0, top: 864 - h.$('main').scrollTop, width: mainBox.width, height: 516 });
  const graphBox = () => ({ left: 0, top: 960 - h.$('main').scrollTop, width: mainBox.width, height: 420 });
  const word = { left: mainBox.width / 2 - 108, top: 280, width: 216, height: 135 };
  h = harness({ entrySource, compact, reduced: completion === 'reduced', autoReady: false, animationStartSkew: .25, bounds: {
    main: mainBox, 'map-surface': surfaceBox, 'entry-word': word, 'graph-stage': graphBox, 'entry-screen': { left: 0, top: 0, width: mainBox.width, height: 1400 },
    network: () => view === 'list' ? { left: 0, top: 0, width: 0, height: 0 } : graphBox(),
    'territory-comparison': () => ({ ...surfaceBox(), height: guideHeight }),
  } });
  h.document.body.dataset.view = view;
  h.document.body.dataset.mapExpanded = String(expanded);
  h.document.body.dataset.comparison = String(comparison);
  const main = h.$('main'); main.clientHeight = mainBox.height; main.scrollHeight = 1900; main.scrollTop = 83;
  h.type('atlas'); h.submit();
  if (completion === 'skip') h.click('skip-animation');
  await h.settle();
  assert.equal(main.scrollTop, 83, 'Typing and static loading do not move the reading position');
  const beforeReady = h.trace.length;
  h.document.dispatchEvent(event('acf:ready'));
  if (completion === 'animated') await h.tick();
  const revealTrace = h.trace.slice(beforeReady), reveal = revealTrace.filter(step => step.event === 'animation:start');
  const scrollIndex = revealTrace.findIndex(step => step.event === 'element:scroll' && step.target === 'main');
  const firstMapMeasure = revealTrace.findIndex(step => step.event === 'geometry:measure' && step.target === 'network');
  const shouldScroll = compact && view === 'map';
  if (shouldScroll) {
    assert(scrollIndex >= 0, 'Mobile map receives the prepared field');
    if (completion === 'animated') assert(scrollIndex < firstMapMeasure, 'Mobile map scroll precedes reveal measurement');
    const box = graphBox();
    assert.equal(surfaceBox().top, mainBox.top, 'The first action remains visible at the top of the phone map');
    assert.equal(box.top, mainBox.top + guideHeight, 'The graph follows the comparison guide without scrolling past it');
    assert(box.top + box.height <= mainBox.top + mainBox.height, 'The mobile target is visible inside the actual scrolling viewport');
  } else {
    assert.equal(scrollIndex, -1, 'Desktop and List layouts preserve scroll position');
    assert.equal(main.scrollTop, 83);
  }
  assert(revealTrace.filter(step => step.event === 'element:scroll').every(step => step.target === 'main'), 'Reveal scroll is confined to the workspace, never the page or reading panels');
  if (completion === 'animated') {
    const box = view === 'list' ? { left: 0, top: 0, width: 0, height: 0 } : graphBox();
    assertTransfer(h, reveal, box);
    assert.equal(new Set(reveal.map(step => step.startTime)).size, 1, 'Scrolling preserves the shared reveal clock');
  } else assert.equal(reveal.length, 0, 'Ready after Skip/reduced motion brings the field into view without restarting motion');
  await h.settle(); usable(h);
}
for (const layout of [{}, { compact: false }, { view: 'list' }, { expanded: true }, { comparison: true }, { completion: 'skip' }, { completion: 'reduced' }, { view: 'list', completion: 'skip' }, { view: 'list', completion: 'reduced' }]) {
  await assertRevealScroll(layout); cases++;
}
for (const { compact = true, view = 'map', smooth = true, reduced = false } of [{}, { smooth: false }, { reduced: true }, { compact: false }, { view: 'list' }]) {
  let h;
  const mainBox = { left: 0, top: 190, width: compact ? 390 : 1280, height: 620 };
  const surfaceBox = () => ({ left: 0, top: 864 - h.$('main').scrollTop, width: mainBox.width, height: 516 });
  const graphBox = () => ({ left: 0, top: 960 - h.$('main').scrollTop, width: mainBox.width, height: 420 });
  h = harness({ compact, reduced, bounds: { main: mainBox, 'map-surface': surfaceBox, 'graph-stage': graphBox, network: graphBox, 'territory-comparison': () => ({ ...surfaceBox(), height: 96 }) } });
  h.document.body.dataset.view = view;
  const main = h.$('main'), smoothCalls = [];
  main.clientHeight = mainBox.height; main.scrollHeight = 1900; main.scrollTop = 83;
  main.scrollTo = options => { smoothCalls.push(options); main.scrollTop = options.top; };
  const revealMap = () => h.document.dispatchEvent(new CustomEvent('acf:reveal-map', { detail: { smooth } }));
  revealMap(); assert.equal(main.scrollTop, 83, 'Reset reveal event cannot scroll the closed riddle');
  h.type('atlas'); h.submit(); await h.settle(); usable(h);
  main.scrollTop = 83; smoothCalls.length = 0;
  const before = h.trace.length;
  revealMap();
  const shouldScroll = compact && view === 'map';
  if (shouldScroll) {
    const box = graphBox();
    assert.equal(surfaceBox().top, mainBox.top, 'Reset restores the visible comparison invitation with the map');
    assert.equal(box.top, mainBox.top + 96, 'Reset preserves the guide above the canvas');
    assert(box.top + box.height <= mainBox.top + mainBox.height, 'Reset map fits inside the phone workspace viewport');
    assert.equal(smoothCalls.length, Number(smooth && !reduced), 'Only allowed motion uses smooth scroll');
    if (smoothCalls.length) assert.equal(smoothCalls[0].behavior, 'smooth');
  } else { assert.equal(main.scrollTop, 83); assert.equal(smoothCalls.length, 0); }
  assert(h.trace.slice(before).filter(step => step.event === 'element:scroll').every(step => step.target === 'main'), 'Reset reveal never scrolls the page or reading panels');
  h.click('return-entry'); main.scrollTop = 83; revealMap();
  assert.equal(main.scrollTop, 83, 'Late reset reveal cannot scroll after leaving the workspace');
  cases++;
}
if (process.argv.includes('--probe-reveal-scroll')) process.exit(0);

const loadSequences = [];
for (const kind of ['directory', 'body']) { await assertFetchBoundary(kind); cases++; }
for (const kind of ['http', 'network', 'body']) { await assertLateFailure(kind); cases++; }
{
  const h = harness(); h.loadApp({ fetchDelay: 800 }); h.type('atlas'); h.submit();
  while (!h.enters) await h.tick();
  h.click('skip-animation'); h.click('return-entry'); h.type('atlas'); h.submit();
  await h.settle(); usable(h, 2);
  assertNoModelMotionOverlap(h);
  assertPreparationYields(h);
  assert.equal(graphPreparations(h).length, 1, 'Interrupted loading resumes its one cached graph preparation');
  assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 1);
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10);
  cases++;
}
{
  const h = harness({ reduced: true }); h.loadApp(); h.type('atlas'); h.submit();
  while (!h.trace.some(step => step.event === 'model:createIndex' && step.records === 33945)) await h.tick();
  h.$('search').value = 'full-map-qa-intentionally-unmatched-query-739128';
  h.$('year-from').dispatchEvent(event('change'));
  assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 0, 'A filter change cannot prematurely upload during staged startup');
  await h.settle(); usable(h);
  assert.equal(h.$('results-count').textContent, '0', 'Final preparation uses the latest filter input');
  assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 1);
  assert.equal(graphPreparations(h).length, 1);
  assertPreparationYields(h); cases++;
}
for (const reduced of [false, true]) for (const fetchDelay of [0, 800]) {
  const h = harness({ reduced }); h.loadApp({ fetchDelay });
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 0, 'Idle riddle does not trigger the catalog listener');
  h.type('atlas'); h.submit(); await h.settle(); usable(h);
  const ready = h.trace.filter(step => step.event === 'acf:ready');
  assert.equal(ready.length, 1, 'Actual application reaches a usable catalog');
  const readingCards = h.$('map-reading-cards').children;
  assert.equal(readingCards.length, 3, 'The actual reading model renders record, territory and junction explanations on first entry');
  assert.equal(readingCards.find(card => card.dataset.readingId === 'field').querySelector('.map-bubble-value').textContent, '33,945 records in this view');
  assert(h.trace.some(step => step.event === 'model:createIndex' && step.records === 33945), 'Every real catalog reaches actual model indexing');
  assert(h.trace.some(step => step.event === 'graph:setData' && step.nodes > 0), 'Actual application renders prepared graph data');
  const transfers = h.trace.filter(step => step.event === 'animation:start' && step.target.startsWith('entry-transfer-star-'));
  assert.equal(transfers.length, reduced ? 0 : 60, 'The actual app supplies prepared record targets to the entrance event');
  const realIds = new Set(h.graph.data.nodes.filter(node => node.kind === 'item').map(node => node.id));
  assert(transfers.every(step => realIds.has(step.recordId)), 'The app bridge passes real canonical record IDs to temporary stars');
  if (process.argv.includes('--profile-motion') && !reduced && fetchDelay === 0) console.log(JSON.stringify({ motionProfile: h.trace.filter(step => step.event === 'animation:start') }));
  assert.equal(graphPreparations(h).length, 1, 'Initial catalog load prepares the graph exactly once');
  assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 1, 'Initial catalog load installs graph data exactly once');
  assertPreparationYields(h);
  assertNoModelMotionOverlap(h);
  const fetches = h.trace.filter(step => step.event === 'fetch:start');
  assert.equal(fetches.length, 10);
  const layersSnapshot = h.trace.find(step => step.event === 'graph:setLayers').layers;
  const regionSnapshot = h.trace.find(step => step.event === 'graph:setRegionSelection').meta;
  assert.equal(Object.getPrototypeOf(layersSnapshot), Object.prototype, 'Retained layer diagnostics cannot keep a complete VM/app realm alive');
  assert.equal(Object.getPrototypeOf(regionSnapshot), Object.prototype, 'Retained region diagnostics must also be detached values');
  loadSequences.push({ reduced, fetchDelay, readyAt: ready[0].at, trace: h.trace.map(step => ({ ...step })) });
  h.click('return-entry'); h.type('atlas'); h.submit(); await h.settle(); usable(h, 2);
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10, 'Reentry uses the actual application cache');
  assert.equal(graphPreparations(h).length, 1, 'Cached reentry does not redundantly prepare graph data');
  // Real collection-change handlers must retain the normal rebuild/refresh path.
  const check = h.$('collection-options').children[0].children[0];
  check.checked = false; check.dispatchEvent(event('change')); await h.settle();
  assert.equal(graphPreparations(h).length, 2, 'Removing a collection still refreshes the graph once');
  assert(h.$('dataset-status').textContent.startsWith('23,478 records'), 'Removing IEET preserves every other loaded collection');
  check.checked = true; check.dispatchEvent(event('change')); await h.settle();
  assert.equal(graphPreparations(h).length, 3, 'Re-adding a cached collection still refreshes the graph once');
  assert(h.$('dataset-status').textContent.startsWith('33,945 records'));
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10, 'Collection re-addition reuses metadata cache');
  assertNoModelMotionOverlap(h);
  cases++;
}

for (const reduced of [false, true]) {
  const h = harness({ reduced }); h.loadApp();
  h.type('atlas'); h.submit(); await h.settle(); usable(h);
  h.click('list-view');
  assert.equal(h.document.body.dataset.view, 'list', 'Actual view handler selects the reading room');
  assert.equal(h.trace.filter(step => step.event === 'graph:setActive').at(-1).active, false, 'List view stops the hidden graph');
  h.click('return-entry'); closed(h, 1);
  const afterExit = h.trace.length;
  h.type('atlas'); h.submit(); await h.settle(); usable(h, 2);
  assert.equal(h.document.body.dataset.view, 'list', 'Cached reentry preserves the selected List view');
  const reentryActivation = h.trace.slice(afterExit).filter(step => step.event === 'graph:setActive');
  assert(reentryActivation.length > 0, 'Cached reentry runs the actual graph-activation branch');
  assert(reentryActivation.every(step => step.active === false), 'Cached List reentry must not activate the hidden graph');
  assert(!h.trace.slice(afterExit).some(step => step.event === 'animation:start' && step.target.startsWith('entry-transfer-star-')), 'List reentry opens its reading view without flying to hidden graph targets');
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10, 'List reentry keeps cached metadata');
  assert.equal(graphPreparations(h).length, 1, 'List reentry does not prepare hidden graph data');
  h.click('map-view');
  assert.equal(h.trace.filter(step => step.event === 'graph:setActive').at(-1).active, true, 'Selecting Map resumes its visible graph');
  h.click('return-entry'); h.type('atlas'); h.submit(); await h.settle(); usable(h, 3);
  assert.equal(h.trace.filter(step => step.event === 'graph:setActive').at(-1).active, true, 'Cached Map reentry still resumes the visible graph');
  cases++;
}

{
  const h = harness(); h.loadApp({ failPath: '/ACF/data/ieet.json' });
  h.type('atlas'); h.submit(); await h.settle(); usable(h);
  assert.equal(h.trace.filter(step => step.event === 'acf:load-error').length, 1, 'Actual fetch failure releases the static entrance');
  assert.equal(h.$('dataset-status').textContent, 'Collection unavailable');
  assert.equal(h.document.body.dataset.view, 'list', 'A failed startup makes the retry control visible on narrow screens');
  assert(h.$('results').children.some(child => child.textContent === 'Retry loading'), 'The released workspace offers retry');
  assert.equal(h.trace.filter(step => step.event === 'acf:ready').length, 0);
  assertNoModelMotionOverlap(h); cases++;
}
{
  const h = harness({ reduced: true }); h.loadApp(); h.type('atlas'); h.submit(); await h.settle(); usable(h);
  for (const row of h.$('collection-options').children) {
    const check = row.children[0]; check.checked = false; check.dispatchEvent(event('change')); await h.settle();
  }
  assert(h.$('dataset-status').textContent.startsWith('0 records'));
  const preparations = graphPreparations(h).length;
  h.click('return-entry'); h.type('atlas'); h.submit(); await h.settle(); usable(h, 2);
  assert(h.$('dataset-status').textContent.startsWith('0 records'), 'An intentionally empty catalog selection survives reentry');
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10);
  assert.equal(graphPreparations(h).length, preparations, 'Empty cached reentry does not rebuild');
  cases++;
}

{
  const h = harness({ reduced: true }); h.loadApp();
  const notice = h.$('graph-fallback-note'), text = notice.textContent;
  assert.equal(notice.hidden, true, 'Fallback notice is absent before a Canvas backend is reported');
  assert.match(text, /full record field.*slower.*List.*faster/i);
  assert.equal(notice.getAttribute('aria-live'), null, 'Static fallback explanation is not a live region');
  assert.equal(h.$('graph-status').getAttribute('aria-live'), 'off', 'Camera status changes do not produce live announcements');
  assert.match(h.$('labels-toggle').parentElement.textContent, /Record\/name labels/);
  let hidden = notice.hidden, writes = 0;
  Object.defineProperty(notice, 'hidden', { get: () => hidden, set: value => { hidden = value; writes++; } });
  const status = { recordCount: 33945, submittedRecords: 33945, nameCount: 7361, submittedNames: 0, inViewRecords: 33945 };
  h.graph.onStatus({ ...status, backend: 'webgl' }); assert.equal(writes, 1); assert.equal(hidden, true);
  h.graph.onStatus({ ...status, backend: 'canvas2d' }); assert.equal(writes, 2); assert.equal(hidden, false);
  for (const inViewRecords of [33000, 20000, 33945]) h.graph.onStatus({ ...status, inViewRecords, backend: 'canvas2d' });
  assert.equal(writes, 2, 'Panning and repeated Canvas frames never rewrite the notice visibility');
  assert.equal(notice.textContent, text, 'The explanatory text stays static');
  h.graph.onStatus({ ...status, backend: 'webgl' }); assert.equal(writes, 3); assert.equal(hidden, true, 'GPU restoration hides the fallback notice');
  h.graph.onStatus({ ...status, backend: 'webgl' }); assert.equal(writes, 3);
  h.graph.onStatus({ ...status, backend: 'canvas2d' }); assert.equal(writes, 4); assert.equal(hidden, false);
  h.graph.onStatus({ ...status, backend: 'unavailable' }); assert.equal(writes, 5); assert.equal(hidden, true, 'An unavailable map does not claim a retained rendered field');
  cases++;
}

// Region controls execute the real app against all nine public catalogs. Check
// actual IDs, history and data-object reuse, not only displayed aggregate text.
{
  const h = harness({ reduced: true }); h.loadApp(); h.type('atlas'); h.submit(); await h.settle(); usable(h);
  const directory = JSON.parse(readFileSync(new URL('../public/ACF/data/index.json', import.meta.url), 'utf8'));
  const oracle = model.createIndex(directory.catalogs.map(entry => JSON.parse(readFileSync(new URL('../public/ACF/data/' + entry.file, import.meta.url), 'utf8'))));
  const originalGraph = h.graph.data;
  const assertField = expected => {
    assert.equal(h.graph.data, originalGraph, 'Region exploration reuses the installed full geometry');
    assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 1, 'Region navigation/facets/history never rebuild point buffers');
    assert.equal(originalGraph.nodes.filter(node => node.kind === 'item').length, 33945);
    assert.deepEqual([...h.graph.regionSelection].sort(), expected.map(item => item.id).sort(), 'Highlight exact source-record membership');
    assert.equal(h.$('region-panel').dataset.selectedCount, String(expected.length));
    assert.equal(h.$('results-count').textContent, expected.length.toLocaleString());
  };
  // Keep this existing suite on single-region facets. Sequential selections are
  // exercised below as the new comparison journey.
  const chooseRegion = id => {
    h.$('breadcrumbs').children[0].dispatchEvent(event('click'));
    const choice = h.$('region-memberships').children.find(button => button.dataset.regionId === id);
    assert(choice, id + ' accessible region button'); choice.dispatchEvent(event('click'));
    assert.equal(h.$('region-panel').hidden, true, 'Choosing a territory keeps its detailed trails folded beneath the map');
    assert.equal(h.document.activeElement, h.$('comparison-picker'), 'Territory selection offers the second subject without opening an evidence panel');
    const bubble = h.$('map-reading-cards').children.find(card => card.dataset.readingId === 'territory');
    assert(bubble, 'The selected territory has an immediate explanation bubble');
    assert.equal(bubble.querySelector('.map-bubble-value').textContent, `${h.graph.regionSelection.size.toLocaleString()} selected records`);
    h.click('comparison-details');
    assert.equal(h.document.activeElement, h.$('map-reading-heading'), 'Read this map focuses the explanation heading');
    assert.equal(h.$('region-panel').hidden, true, 'Reading the explanation does not unfold the evidence trail');
    h.click('map-evidence');
    assert.equal(h.$('map-evidence').getAttribute('aria-expanded'), 'true');
  };
  const descendants = node => node.children.flatMap(child => [child, ...descendants(child)]);
  const openFacets = () => {
    const controls = h.$('region-content').querySelector('.region-filters'); assert(controls);
    if (!controls.open) { controls.open = true; controls.dispatchEvent(event('toggle')); }
    return controls;
  };
  const facet = (key, value) => { openFacets(); h.$('region-facet-' + key).value = value; h.$('region-facet-' + key).dispatchEvent(event('change')); };
  assert.equal(h.$('region-memberships').children.length, 7, 'Six themes and unmatched remain accessible without route lines');
  assert.equal(h.$('regions-toggle').checked, true, 'Soft regions visible on first entry');
  assert.equal(h.$('themes-toggle').checked, false, 'Initial region meaning does not require inferred route lines');
  assert.match(h.$('region-union').textContent, /11,331 unique title-matched · 22,614 unmatched/);
  for (const id of [...model.THEMES.map(([id]) => id), 'unmatched']) {
    chooseRegion(id);
    assertField(oracle.items.filter(item => id === 'unmatched' ? item.themes.length === 0 : item.themes.includes(id)));
    assert.equal(h.document.activeElement, h.$('region-close'), 'Opening source trails moves focus to its fold control');
    assert.equal(h.$('region-panel').hidden, false);
    assert.equal(descendants(h.$('region-content')).filter(node => node.tagName === 'SELECT').length, 1, 'Closed facets create only the sort selector, not all name/term options');
    assert.equal(h.$('region-content').querySelector('.region-filters').open, false);
  }
  chooseRegion('minds');
  const minds = oracle.items.filter(item => item.themes.includes('minds'));
  const people = regions.regionFacets(oracle, 'minds').people;
  assert(people.length > 80, 'Full-data fixture reaches bounded name-picker path');
  openFacets();
  assert.equal(h.$('region-facet-person').options.length, 81, 'Only 80 name choices plus All are initially inserted');
  const latePerson = people.at(-1), personControl = h.$('region-facet-person').parentElement;
  const nameSearch = personControl.children.find(node => node.tagName === 'INPUT'); assert(nameSearch);
  assert(personControl.children.some(node => node.textContent.includes(`all ${people.length.toLocaleString()}`)), 'Name search discloses its complete searchable base');
  nameSearch.value = latePerson.label + ' / ' + latePerson.catalogLabel; nameSearch.dispatchEvent(event('input'));
  assert(h.$('region-facet-person').options.some(option => option.value === latePerson.id), 'A label beyond the first 80 is searchable and selectable');
  facet('person', latePerson.id);
  const credited = minds.filter(item => (oracle.byItem.get(item.id) || []).some(credit => credit.personId === latePerson.id));
  assertField(credited); assert.match(h.location.hash, /theme=minds&person=/);
  h.history.go(-1); assertField(minds);
  h.history.go(1); assertField(credited); assert.equal(h.$('region-panel').hidden, false, 'History treats the person parameter as a region facet');
  const previousPersonSelect = h.$('region-facet-person'); previousPersonSelect.focus();
  h.$('region-panel').scrollTop = 260;
  facet('person', ''); assertField(minds);
  assert.equal(h.$('region-panel').scrollTop, 260, 'Clearing the last facet preserves same-region scroll');
  assert.equal(h.$('region-content').querySelector('.region-filters').open, true, 'Clearing the last facet keeps the current region controls open');
  assert.notEqual(h.$('region-facet-person'), previousPersonSelect, 'The refreshed selector replaces the previous DOM node');
  assert.equal(h.document.activeElement, h.$('region-facet-person'), 'Selecting All restores focus to the refreshed person selector');
  assert(descendants(h.$('region-content')).includes(h.document.activeElement), 'Focus remains on an attached facet control');
  facet('year', 'unknown'); facet('collection', 'ieet');
  h.$('region-panel').scrollTop = 380;
  const previousClear = h.$('region-clear-facets'); previousClear.focus(); h.click('region-clear-facets'); assertField(minds);
  assert.equal(h.$('region-panel').scrollTop, 380, 'Clear all preserves same-region scroll');
  assert.equal(h.$('region-content').querySelector('.region-filters').open, true, 'Clear all retains the open controls');
  assert.notEqual(h.$('region-clear-facets'), previousClear);
  assert.equal(h.document.activeElement, h.$('region-clear-facets'), 'Clear all restores focus to the refreshed Clear button');
  assert(descendants(h.$('region-content')).includes(h.document.activeElement), 'Clear-button focus remains attached');
  assert.equal(h.$('region-facet-year').value, ''); assert.equal(h.$('region-facet-collection').value, '');
  chooseRegion('bodies');
  assert.equal(h.$('region-panel').scrollTop, 0, 'Changing regions resets a scrolled panel to its heading and Close control');
  assert.equal(h.$('region-content').querySelector('.region-filters').open, false, 'An open disclosure does not leak to a different region');
  h.$('region-panel').scrollTop = 530;
  chooseRegion('minds'); assertField(minds);
  assert.equal(h.$('region-panel').scrollTop, 0, 'Switching back also starts the different region at the top');
  facet('year', 'unknown');
  const unknown = minds.filter(item => item.year === null); assert(unknown.length > 0); assertField(unknown);
  assert.match(h.location.hash, /year=unknown/, 'Unknown dates have a history-addressable facet');
  h.history.go(-1); assertField(minds);
  h.history.go(1); assertField(unknown);
  facet('collection', 'ieet');
  const combined = unknown.filter(item => item.catalogId === 'ieet'); assertField(combined);
  assert.equal(h.$('region-facet-year').value, 'unknown', 'Combined facets preserve previous selection');
  for (const id of ['names-toggle','labels-toggle','relationships-toggle','themes-toggle','regions-toggle']) {
    h.$(id).checked = !h.$(id).checked; h.$(id).dispatchEvent(event('change')); assertField(combined);
  }
  h.history.go(-1); assertField(unknown);
  h.history.go(-1); assertField(minds);
  const regionList = h.$('region-records'), rows = regionList.children[0];
  assert.equal(rows.children.length, 20, 'Region starts with a bounded page of real records');
  regionList.children[1].dispatchEvent(event('click'));
  assert.equal(rows.children.length, 40, 'Pagination adds actual records');
  const first = rows.children[0]; assert(oracle.byId.has(first.dataset.recordId)); first.dispatchEvent(event('click'));
  assert.equal(h.$('detail').hidden, false, 'Region record opens source details');
  assert.equal(h.$('region-panel').hidden, true);
  assert.equal(h.graph.data, originalGraph);
  h.history.go(-1); assertField(minds); assert.equal(h.$('region-panel').hidden, false, 'Back restores region drilldown');
  h.$('region-close').focus(); h.document.dispatchEvent(event('keydown', { key: 'Escape' }));
  assert.equal(h.$('region-panel').hidden, true, 'Escape closes region details');
  assert.equal(h.document.activeElement, h.$('map-evidence'), 'Escape restores focus to the source-trails trigger below the map');
  assert.equal(h.$('map-evidence').getAttribute('aria-expanded'), 'false');
  for (let node = h.document.activeElement; node; node = node.parentElement) assert.equal(node.hidden, false, 'Restored focus has no hidden ancestor');
  chooseRegion('minds'); assertField(minds);
  h.$('breadcrumbs').children[0].dispatchEvent(event('click'));
  assert.equal(h.graph.regionSelection, null, 'All connections clears the membership mask');
  assert.equal(h.graph.data, originalGraph);
  assert.equal(h.$('results-count').textContent, '33,945');
  assert.equal(h.$('region-panel').hidden, true);
  chooseRegion('minds'); h.click('return-entry'); h.type('atlas'); h.submit(); await h.settle(); usable(h, 2);
  assertField(minds); assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10, 'Region survives cached reentry without new fetches');
  cases++;
}

// Sequential subject selections, evidence drilldown, history and filtering use
// the real app and all catalogs; the graph unit suite covers the animated layout.
{
  const h = harness({ reduced: true }); h.loadApp(); h.type('atlas'); h.submit(); await h.settle(); usable(h);
  const original = h.graph.data, coordinates = JSON.stringify(original.nodes.map(n => [n.id, n.x, n.y]));
  const choose = id => h.$('region-memberships').children.find(b => b.dataset.regionId === id).dispatchEvent(event('click'));
  const assertComparison = (left, right) => {
    assert(h.graph.comparison); assert.equal(h.graph.comparison.left.id, left); assert.equal(h.graph.comparison.right.id, right);
    assert.equal(h.graph.data, original, 'comparison retains full canonical field');
    assert.equal(JSON.stringify(original.nodes.map(n => [n.id, n.x, n.y])), coordinates);
    assert.equal(h.$('results-count').textContent, h.graph.comparison.memberIds.size.toLocaleString());
    assert.equal(h.$('comparison-selected').children.length, 2);
  };
  choose('minds'); assert.equal(h.graph.comparison, null);
  choose('bodies'); assertComparison('minds', 'bodies');
  assert.match(h.location.hash, /compare=minds%2Cbodies/);
  assert.equal(h.graph.comparison.shared.size, 108); assert.equal(h.graph.comparison.memberIds.size, 4006);
  assert.equal(h.$('region-panel').hidden, true, 'second selection exposes both clusters');
  assert.equal(h.document.activeElement, h.$('comparison-picker'));
  h.click('comparison-details');
  assert.equal(h.document.activeElement, h.$('map-reading-heading'));
  assert.equal(h.$('region-panel').hidden, true, 'Comparison explanations stay separate from the optional source trail');
  assert.deepEqual(h.$('map-reading-cards').children.map(card => card.dataset.readingId), ['left', 'shared', 'right', 'junctions']);
  h.click('map-evidence'); assert.equal(h.$('region-panel').hidden, false);
  assert.equal(h.$('map-evidence').getAttribute('aria-expanded'), 'true');
  assert.equal(h.$('region-panel').dataset.selectedCount, '4006');
  h.click('region-close'); assert.equal(h.$('region-panel').hidden, true);
  assert.equal(h.document.activeElement, h.$('map-evidence'));
  assert.equal(h.$('map-evidence').getAttribute('aria-expanded'), 'false');
  choose('planet'); assertComparison('minds', 'planet');
  h.history.go(-1); assertComparison('minds', 'bodies');
  h.history.go(1); assertComparison('minds', 'planet');
  choose('minds'); assert.equal(h.graph.comparison, null);
  assert.equal(h.graph.regionSelectionMeta.id, 'planet', 'remove one side retains other');
  h.graph.onSelect(original.nodes.find(n => n.id === '@theme:power'), {x:10,y:10});
  assertComparison('planet', 'power');
  h.$('search').value = 'no such comparison record 998877'; h.$('search').dispatchEvent(event('input')); await h.settle();
  assertComparison('planet', 'power'); assert.equal(h.graph.comparison.memberIds.size, 0);
  h.$('search').value = ''; h.$('search').dispatchEvent(event('input')); await h.settle();
  assertComparison('planet', 'power');
  const first = h.$('results').children[0]; first.dispatchEvent(event('click'));
  assert.equal(h.$('detail').hidden, false); assert.match(h.location.hash, /item=.*compare=planet%2Cpower/);
  assertComparison('planet', 'power');
  h.history.go(-1); assertComparison('planet', 'power');
  h.click('return-entry'); h.type('atlas'); h.submit(); await h.settle(); usable(h, 2);
  assertComparison('planet', 'power');
  h.click('comparison-clear'); assert.equal(h.graph.comparison, null);
  assert.equal(h.graph.regionSelection, null); assert.equal(h.$('results-count').textContent, '33,945');
  assert.equal(h.graph.data, original); assert.equal(JSON.stringify(original.nodes.map(n => [n.id, n.x, n.y])), coordinates);
  cases++;
}

// Real controls must make comparison discoverable, preserve its selection while
// clearing filters, and return keyboard focus to a visible surface.
{
  const h = harness({ reduced: true }); h.loadApp(); h.type('atlas'); h.submit(); await h.settle(); usable(h);
  const choose = id => { h.$('comparison-picker').value = id; h.$('comparison-picker').dispatchEvent(event('change')); };
  const toggle = (id, open) => { h.$(id).open = open; h.$(id).dispatchEvent(event('toggle')); };
  assert.equal(h.$('territory-comparison').dataset.phase, 'first');
  assert.equal(h.$('comparison-example').hidden, false);
  assert.equal(h.$('explore-tools').open, false);
  toggle('explore-tools', true); assert.equal(h.document.activeElement, h.$('search'));
  h.document.dispatchEvent(event('keydown', { key: 'Escape' }));
  assert.equal(h.$('explore-tools').open, false);
  assert.equal(h.document.activeElement, h.$('explore-tools-toggle'));
  toggle('map-perspectives', true);
  h.document.dispatchEvent(event('keydown', { key: 'Escape' }));
  assert.equal(h.$('map-perspectives').open, false);
  assert.equal(h.document.activeElement, h.$('map-perspectives-toggle'));
  toggle('explore-tools', true);
  choose('minds');
  assert.equal(h.$('explore-tools').open, false);
  assert.equal(h.document.activeElement, h.$('comparison-picker'));
  assert.equal(h.$('territory-comparison').dataset.phase, 'second');
  assert.equal(h.$('comparison-example').hidden, true);
  choose('planet');
  assert.equal(h.$('territory-comparison').dataset.phase, 'compare');
  assert.equal(h.graph.comparison.left.id, 'minds'); assert.equal(h.graph.comparison.right.id, 'planet');
  h.$('search').value = 'unfindable 998877'; h.$('search').dispatchEvent(event('input')); await h.settle();
  assert.equal(h.graph.comparison.memberIds.size, 0); assert.equal(h.$('filter-count').textContent, '1');
  h.click('clear-search-filters');
  assert(h.graph.comparison.memberIds.size > 0, 'Clearing filters restores the chosen comparison');
  assert.equal(h.graph.comparison.left.id, 'minds'); assert.equal(h.graph.comparison.right.id, 'planet');
  assert.equal(h.$('filter-count').hidden, true);
  h.history.go(-1);
  assert.equal(h.$('search').value, 'unfindable 998877'); assert.equal(h.graph.comparison.memberIds.size, 0);
  h.history.go(1);
  assert.equal(h.$('search').value, ''); assert(h.graph.comparison.memberIds.size > 0);
  assert.equal(h.graph.comparison.left.id, 'minds'); assert.equal(h.graph.comparison.right.id, 'planet');
  h.click('comparison-details'); assert.equal(h.document.activeElement, h.$('map-reading-heading'));
  assert.equal(h.$('region-panel').hidden, true, 'The key does not open detailed evidence');
  h.click('return-map'); assert.equal(h.document.activeElement, h.$('network'));
  h.click('list-view'); h.click('comparison-details'); h.click('return-map');
  assert.equal(h.document.body.dataset.view, 'map');
  assert.equal(h.document.activeElement, h.$('network'), 'Back to map leaves List and focuses the canvas');
  h.graph.available = false; h.click('return-map');
  assert.equal(h.document.body.dataset.view, 'list');
  assert.equal(h.document.activeElement, h.$('results-heading'), 'Unavailable graphics retain a visible List fallback');
  delete h.graph.available;
  h.click('map-view'); h.click('comparison-clear'); h.click('comparison-example');
  assert.equal(h.graph.comparison.left.id, 'minds'); assert.equal(h.graph.comparison.right.id, 'power');
  assert.equal(h.document.activeElement, h.$('comparison-picker'));
  h.$('comparison-selected').children[1].dispatchEvent(event('click'));
  assert.equal(h.graph.comparison, null); assert.equal(h.graph.regionSelectionMeta.id, 'minds');
  assert.equal(h.$('territory-comparison').dataset.phase, 'second');
  assert.equal(h.document.activeElement, h.$('comparison-picker'));
  const fullRegionCount = h.graph.regionSelection.size;
  h.click('map-evidence');
  const facets = h.$('region-content').querySelector('.region-filters'); facets.open = true; facets.dispatchEvent(event('toggle'));
  const term = h.$('region-facet-term'), word = term.options.find(option => option.value).value;
  term.value = word; term.dispatchEvent(event('change'));
  const filteredCount = h.graph.regionSelection.size;
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).get('term'), word);
  h.click('clear-search-filters');
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).get('theme'), 'minds');
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).has('term'), false);
  assert.equal(h.graph.regionSelection.size, fullRegionCount);
  h.history.go(-1); assert.equal(h.graph.regionSelection.size, filteredCount);
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).get('term'), word);
  h.history.go(1); assert.equal(h.graph.regionSelection.size, fullRegionCount);
  // Reparse the shareable route without history state, as a fresh page does.
  h.history.replaceState(null, '', h.location.href); h.window.dispatchEvent(event('popstate'));
  assert.equal(h.graph.regionSelectionMeta.id, 'minds'); assert.equal(h.graph.regionSelection.size, fullRegionCount);
  toggle('explore-tools', true); toggle('map-perspectives', true);
  h.click('reset-atlas'); await h.settle();
  assert.equal(h.graph.comparison, null); assert.equal(h.$('territory-comparison').dataset.phase, 'first');
  assert.equal(h.$('comparison-example').hidden, false); assert.equal(h.$('results-count').textContent, '33,945');
  assert.equal(h.$('explore-tools').open, false); assert.equal(h.$('map-perspectives').open, false);
  assert.equal(h.document.activeElement, h.$('reset-atlas')); assert.equal(h.location.hash, '');
  assert(h.trace.some(step => step.event === 'graph:reset' && step.universe), 'Full reset restores the universe camera');
  cases++;
}

// Execute publication controls and shareable routes against the real app/data.
// Rendering/layout remains covered separately; this checks IDs and state changes.
{
  const h = harness({ reduced: true }); h.loadApp(); h.type('atlas'); h.submit(); await h.settle(); usable(h);
  const selected = () => h.$('publication-filters').children.filter(control => control.getAttribute('aria-pressed') === 'true').map(control => control.id.replace('publication-', '')).sort();
  const sources = () => [...new Set(h.graph.data.nodes.filter(node => node.kind === 'item').map(node => node.catalogId))].sort();
  const text = node => [node.textContent, ...node.children.map(text)].join(' ');
  const select = async id => { h.click('publication-' + id); await h.settle(); };
  const assertComparison = expected => {
    assert.equal(h.graph.comparison?.kind, 'publications');
    assert.deepEqual(Array.from(h.graph.comparison.groups, group => group.id).sort(), [...expected].sort());
    assert.deepEqual(selected(), [...expected].sort());
    assert.deepEqual(sources(), [...expected].sort());
    assert.equal(h.$('publication-compare').getAttribute('aria-pressed'), 'true');
    assert.equal(h.$('publication-compare').disabled, false);
    assert.equal(h.document.body.dataset.comparison, 'true');
    assert.equal(h.graph.comparison.records.length, h.graph.comparison.memberIds.size);
    assert.equal(h.graph.comparison.relationships.length, 0, 'This public snapshot has no cross-catalog endpoint links');
  };
  assert.equal(selected().length, 9);
  assert.equal(h.$('publication-count').textContent, '9/9 on');
  assert.equal(h.$('publication-compare').disabled, false);
  assert.equal(h.$('publication-compare').textContent, 'Compare 9 publications');
  h.click('publications-none');
  assert.deepEqual(selected(), []); assert.deepEqual(sources(), []);
  assert.equal(h.$('results-count').textContent, '0');
  assert.equal(h.$('publication-compare').disabled, true);
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).get('sources'), '');
  assert.match(h.$('publication-status').textContent, /No publications enabled/);
  h.click('publication-compare'); assert.equal(h.graph.comparison, null, 'Disabled comparison action also has a handler guard');
  await select('ieet');
  assert.deepEqual(selected(), ['ieet']); assert.deepEqual(sources(), ['ieet']);
  assert.equal(h.$('results-count').textContent, '10,467');
  assert.equal(h.$('publication-compare').disabled, true);
  await select('c4ss');
  assert.deepEqual(selected(), ['c4ss', 'ieet']);
  assert.equal(h.$('results-count').textContent, '19,151');
  assert.equal(h.$('publication-compare').disabled, false);
  assert.equal(h.document.activeElement, h.$('publication-c4ss'), 'Re-rendered toggle retains keyboard focus');
  h.click('publication-compare'); assertComparison(['ieet', 'c4ss']);
  assert.equal(h.$('territory-guide-title').textContent, 'Comparing 2 publications');
  assert.match(text(h.$('map-reading-cards')), /Grouped by source catalog/);
  assert.match(text(h.$('map-reading-cards')), /no cross-catalog record links/);
  assert.doesNotMatch(text(h.$('map-reading-cards')), /Matches one of this pair|Shared records/);
  h.click('map-evidence');
  assert.equal(h.$('region-panel').hidden, false);
  assert.equal(h.$('region-panel').getAttribute('aria-label'), 'Publication comparison evidence');
  assert.match(text(h.$('region-content')), /0 cross-publication record links/);
  assert.match(text(h.$('region-content')), /source catalogs/);
  assert.match(text(h.$('region-content')), /similar names or titles do not create a connection/);
  cases++;

  await select('network-cultures'); assertComparison(['ieet', 'c4ss', 'network-cultures']);
  assert.equal(h.$('region-panel').hidden, true, 'Changing source selection dismisses stale evidence');
  h.history.go(-1); assertComparison(['ieet', 'c4ss']);
  h.history.go(1); assertComparison(['ieet', 'c4ss', 'network-cultures']);
  await select('ieet'); assertComparison(['c4ss', 'network-cultures']);
  await select('network-cultures');
  assert.equal(h.graph.comparison, null);
  assert.equal(h.document.body.dataset.comparison, 'false');
  assert.equal(h.$('publication-compare').disabled, true);
  assert.equal(h.$('publication-compare').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(selected(), ['c4ss']); assert.deepEqual(sources(), ['c4ss']);
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).get('sources'), 'c4ss');
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).has('publications'), false);
  h.$('comparison-picker').value = 'minds'; h.$('comparison-picker').dispatchEvent(event('change'));
  assert.equal(h.graph.regionSelectionMeta.id, 'minds');
  h.$('comparison-picker').value = 'power'; h.$('comparison-picker').dispatchEvent(event('change'));
  assert.equal(h.graph.comparison.left.id, 'minds'); assert.equal(h.graph.comparison.right.id, 'power');
  assert(h.graph.comparison.records.every(item => item.catalogId === 'c4ss'), 'Subject comparison honors the bottom source filters');
  assert.equal(h.$('publication-compare').getAttribute('aria-pressed'), 'false');
  cases++;

  h.history.replaceState(null, '', '/ACF/#sources=ieet,technophany&compare=minds,planet'); h.window.dispatchEvent(event('popstate'));
  assert.deepEqual(selected(), ['ieet', 'technophany']); assert.deepEqual(sources(), ['ieet', 'technophany']);
  assert.equal(h.graph.comparison.left.id, 'minds'); assert.equal(h.graph.comparison.right.id, 'planet');
  assert(h.graph.comparison.records.every(item => ['ieet', 'technophany'].includes(item.catalogId)));
  h.history.replaceState(null, '', '/ACF/#publications=c4ss,ieet'); h.window.dispatchEvent(event('popstate'));
  assertComparison(['c4ss', 'ieet']);
  assert.equal(h.$('publication-compare').textContent, 'Exit comparison');
  h.click('publication-compare');
  assert.equal(h.graph.comparison, null); assert.deepEqual(selected(), ['c4ss', 'ieet']);
  assert.equal(new URLSearchParams(h.location.hash.slice(1)).get('sources'), 'c4ss,ieet');
  h.history.go(-1); assertComparison(['c4ss', 'ieet']);
  h.history.go(1); assert.equal(h.graph.comparison, null); assert.deepEqual(selected(), ['c4ss', 'ieet']);
  cases++;

  h.click('publications-none');
  h.history.replaceState(null, '', h.location.href); h.window.dispatchEvent(event('popstate'));
  assert.deepEqual(selected(), []); assert.equal(h.$('results-count').textContent, '0');
  h.click('publications-all');
  assert.equal(selected().length, 9); assert.equal(h.$('results-count').textContent, '33,945');
  assert.equal(h.$('publication-compare').disabled, false);
  h.click('publication-compare'); assert.equal(h.graph.comparison.groups.length, 9);
  assert.equal(h.graph.comparison.records.length, 33945);
  h.click('reset-atlas'); await h.settle();
  assert.equal(h.graph.comparison, null); assert.equal(selected().length, 9);
  assert.equal(h.$('results-count').textContent, '33,945'); assert.equal(h.location.hash, '');
  assert.equal(h.$('publication-compare').getAttribute('aria-pressed'), 'false');
  assert.equal(h.$('publication-compare').disabled, false, 'Reset leaves publication comparison usable');
  assert(h.$('publication-filters').children.every(control => !control.disabled), 'Reset re-enables every quick toggle');
  assert(h.$('collection-options').children.every(row => !row.children[0].disabled), 'Reset re-enables the collection dialog too');
  assert.equal(h.$('publications-all').disabled, false); assert.equal(h.$('publications-none').disabled, false);
  h.click('publications-none'); assert.equal(h.$('results-count').textContent, '0');
  h.click('reset-atlas'); await h.settle();
  assert.equal(h.$('results-count').textContent, '33,945'); assert.equal(selected().length, 9);
  assert.equal(h.$('publication-compare').disabled, false);
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 10, 'All/None/toggles/reset reuse loaded public metadata');
  cases++;
}

// Prove the ordering seam is red-capable without editing production: move only
// the entry signal before the letter sequence in an in-memory source copy.
// This is a structural regression, not a simulated frame-rate measurement.
const earlyLoadSource = source.replace('input.blur();', "input.blur();\n    document.dispatchEvent(new CustomEvent('acf:enter'));");
assert.notEqual(earlyLoadSource, source, 'Early-load mutation must reach the real entrance motion sequence');
const early = harness({ entrySource: earlyLoadSource }); early.loadApp(); early.type('atlas'); early.submit(); await early.settle();
assert.throws(() => assertNoModelMotionOverlap(early), /must not overlap entrance Web Animations/, 'The lifecycle guard catches early model work during the actual entrance sequence');
cases++;
if (process.argv.includes('--probe-early-load')) assertNoModelMotionOverlap(early);

const unawaitedSource = source.replace('await Promise.all([fade,', 'Promise.all([fade,');
assert.notEqual(unawaitedSource, source, 'The premature-finish mutation must reach the actual letter await');
const unawaited = harness({ entrySource: unawaitedSource }); unawaited.type('atlas'); unawaited.submit();
await assert.rejects(assertLetterProgress(unawaited), /Normal opening animates|letter sequence is displayed|Expected values to be strictly equal|One entry event|Opening creates no custom timers/, 'The progress guard catches opening without awaiting the letters');
await unawaited.settle();
cases++;
if (process.argv.includes('--probe-unawaited-letters')) await assertLetterProgress(unawaited);

const globalEasingSource = source.replace("duration, delay, easing: 'linear'", "duration, delay, easing: 'cubic-bezier(.22,.7,.26,1)'");
assert.notEqual(globalEasingSource, source, 'The easing mutation must reach the actual letter timeline');
const globalEasing = harness({ entrySource: globalEasingSource }); globalEasing.type('atlas'); globalEasing.submit();
assert.throws(() => assertLetterMotion(globalEasing), /letter timeline remains linear/, 'The motion guard catches global easing that compresses the shared hold');
await globalEasing.settle();
cases++;
if (process.argv.includes('--probe-global-easing')) assertLetterMotion(globalEasing);

const quietHoldSource = source.replace('(2000 - delay)', '(1300 - delay)');
assert.notEqual(quietHoldSource, source, 'Quiet-hold mutation reaches the real letter hold');
const shortHold = harness({ entrySource: quietHoldSource }); shortHold.type('atlas'); shortHold.submit();
assert.throws(() => assertLetterMotion(shortHold), /quiet readable hold/, 'The motion guard rejects a rushed complete-word hold');
await shortHold.settle(); cases++;

const pathJumpSource = source.replace("{ strokeDashoffset: '1000', opacity: .2 }", "{ strokeDashoffset: '0', opacity: .2 }");
assert.notEqual(pathJumpSource, source, 'Path mutation reaches a real route drawing track');
const pathJump = harness({ entrySource: pathJumpSource }); pathJump.type('atlas'); pathJump.submit();
assert.throws(() => assertConstellationMotion(pathJump), /fully undrawn/, 'The route guard rejects an already-drawn path masquerading as a trace');
await pathJump.settle(); cases++;

const omittedFieldSource = source.replace('...tracings, field, ...branching, ...expanding, cursor', '...tracings, cursor');
assert.notEqual(omittedFieldSource, source, 'Formation mutation removes only awaiting the field, branches and satellites');
const omittedField = harness({ entrySource: omittedFieldSource }); omittedField.type('atlas'); omittedField.submit();
await assert.rejects(assertLetterProgress(omittedField), /Data work waits|Every decorative formation/, 'The ordering guard rejects loading while outer branches are still drawing');
await omittedField.settle(); cases++;

const splitClockSource = source.replace('animation.startTime = sharedStart', 'animation.startTime = animation.startTime');
assert.notEqual(splitClockSource, source, 'Clock mutation reaches the explicit synchronization assignment');
await assert.rejects(assertSharedRevealClock(splitClockSource), /one explicit document timeline clock/, 'The synchronization guard rejects separately launched aperture/star/route clocks');
cases++;

const staleClockSource = source.replace('const sharedStart = await freshRevealFrame();', 'const sharedStart = document.timeline.currentTime; await freshRevealFrame();');
assert.notEqual(staleClockSource, source, 'Stale-clock mutation reaches the reveal timestamp acquisition');
await assert.rejects(assertSharedRevealClock(staleClockSource), /fresh frame execution time/, 'The clock guard catches a stale document timestamp that silently shortens the visible reveal');
cases++;

const staleFrameSource = source.replace('requestAnimationFrame(() => complete(performance.now()))', 'requestAnimationFrame(complete)');
assert.notEqual(staleFrameSource, source, 'Stale-frame mutation reaches the frame callback timestamp');
await assert.rejects(assertSharedRevealClock(staleFrameSource), /fresh frame execution time/, 'The clock guard catches a stale RAF timestamp even after awaiting the frame');
cases++;

const offscreenMapSource = source.replace('    revealMapViewport();', '    // Mutant leaves the prepared map below the viewport.');
assert.notEqual(offscreenMapSource, source, 'Scroll mutation reaches the normal reveal preparation');
await assert.rejects(assertRevealScroll({}, offscreenMapSource), /Mobile map receives/, 'The viewport guard rejects a reveal aimed below the visible mobile workspace');
cases++;

async function assertTransferMutation(entrySource, options = {}) {
  const h = harness({ entrySource, autoReady: false, ...options });
  h.type('atlas'); h.submit(); await h.settle();
  const beforeReady = h.trace.length;
  h.document.dispatchEvent(event('acf:ready')); await h.tick();
  try { assertTransfer(h, h.trace.slice(beforeReady).filter(step => step.event === 'animation:start'), h.$('network').getBoundingClientRect()); }
  finally { h.click('skip-animation'); await h.settle(); }
}
const unmaskedSource = source.replace("mask: 'url(#entry-apertures)'", "mask: 'none'");
assert.notEqual(unmaskedSource, source, 'Mask mutation disconnects the actual covering mask');
await assert.rejects(assertTransferMutation(unmaskedSource), /mask actually controls/, 'The mask guard rejects decorative apertures that never reveal the real field'); cases++;
const unboundedSource = source.replace('.slice(0, 60)', '.slice(0, 100)');
assert.notEqual(unboundedSource, source, 'Bound mutation permits too many transfer stars');
await assert.rejects(assertTransferMutation(unboundedSource, { targetCount: 90 }), /bounded target|stay bounded/, 'The transfer guard rejects unbounded copies from a large target provider'); cases++;
const displacedTargetSource = source.replace('x: map.left + point.x', 'x: map.left + point.x + 19');
assert.notEqual(displacedTargetSource, source, 'Endpoint mutation displaces the visible copy from its true record');
await assert.rejects(assertTransferMutation(displacedTargetSource), /actual screen x coordinate/, 'The coordinate guard rejects an attractive flight that lands beside its actual record'); cases++;

const reportFlag = process.argv.indexOf('--load-sequence-report');
if (reportFlag >= 0) {
  assert(process.argv[reportFlag + 1], 'Report path required');
  writeFileSync(process.argv[reportFlag + 1], JSON.stringify({
    kind: 'deterministic lifecycle characterization; not a browser frame-rate result',
    sourcePaths: ['public/ACF/entry.js', 'public/ACF/app.js', 'public/ACF/model.js'],
    loadSequences,
    fetchBoundarySequences,
    earlyLoadMutation: { caught: true, overlaps: modelMotionOverlap(early) },
    unawaitedLettersMutation: { caught: true, trace: unawaited.trace.filter(step => step.event.startsWith('animation:') || step.event === 'acf:enter') },
    globalEasingMutation: { caught: true, animations: globalEasing.trace.filter(step => step.event === 'animation:start') },
  }, null, 2) + '\n');
}
console.log(`Verified ${cases} ACF entrance cases: letter progression, cleanup, actual app/catalog lifecycle ordering and intentional mutations. Virtual-time sequencing only; physical animation smoothness belongs to browser measurements.`);
