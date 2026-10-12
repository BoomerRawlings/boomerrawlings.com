import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'parse5';
import * as model from '../public/ACF/model.js';
import * as regions from '../public/ACF/regions.js';
import { previewInfo } from '../public/ACF/preview-data.js';

const source = readFileSync(new URL('../public/ACF/entry.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../public/ACF/app.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../src/pages/ACF/index.astro', import.meta.url), 'utf8');
const flush = () => new Promise(setImmediate);
const event = (type, properties = {}) => Object.assign(new Event(type, { cancelable: true }), properties);

// Exercise the real script against the real markup. This deliberately models only
// the DOM APIs used by the entrance; rendered geometry belongs to browser checks.
function harness({ reduced = false, animationAPI = true, entrySource = source, autoReady = true } = {}) {
  let hasApp = false, currentGraph;
  let now = 0, timerId = 0, animations = 0, enters = 0, exits = 0, task = 0;
  const timers = new Map(), ids = new Map(), activeAnimations = new Map(), trace = [];
  const document = new EventTarget(), window = new EventTarget();
  const location = { hash: '', pathname: '/ACF/', href: 'https://atlas.example/ACF/' };
  const historyEntries = [{ state: null, url: location.href }]; let historyPosition = 0;
  const setLocation = url => { const parsed = new URL(url, location.href); location.href = parsed.href; location.hash = parsed.hash; location.pathname = parsed.pathname; };
  const history = {
    get state() { return historyEntries[historyPosition].state; },
    pushState(state, _unused, url) { setLocation(url); historyEntries.splice(++historyPosition); historyEntries.push({ state: structuredClone(state), url: location.href }); },
    replaceState(state, _unused, url) { setLocation(url); historyEntries[historyPosition] = { state: structuredClone(state), url: location.href }; },
    go(delta) { const next = historyPosition + delta; if (next < 0 || next >= historyEntries.length) return; historyPosition = next; setLocation(historyEntries[next].url); window.dispatchEvent(event('popstate')); },
  };
  document.hidden = false;
  document.title = markup.match(/<title>(.*?)<\/title>/)[1];
  const record = (event, detail = {}) => trace.push({ at: now, task, event, activeAnimations: activeAnimations.size, ...detail });
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
      this.value = ''; this.textContent = ''; this.innerHTML = ''; this.scrollTop = 0;
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
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { document.activeElement = this; this.focusCount++; }
    blur() { if (document.activeElement === this) document.activeElement = null; }
    select() { this.selectCount++; }
    get id() { return this.attributes.get('id') || ''; }
    set id(value) { this.attributes.set('id', value); ids.set(value, this); }
    get options() { return this.children; }
    append(...children) { for (const child of children) { this.children.push(child); child.parentElement = this; } }
    prepend(...children) { for (const child of children) child.parentElement = this; this.children.unshift(...children); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    before(child) { const position = this.parentElement.children.indexOf(this); this.parentElement.children.splice(position, 0, child); child.parentElement = this.parentElement; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
    close() { this.open = false; this.removeAttribute('open'); }
    querySelector(selector) {
      const descendants = [...this.children];
      for (let i = 0; i < descendants.length; i++) descendants.push(...descendants[i].children);
      if (selector.startsWith('.')) return descendants.find(n => n.classList.contains(selector.slice(1))) || null;
      const attribute = selector.match(/^\[([^=]+)="([^"]*)"\]$/);
      assert(attribute, `Unexpected selector ${selector}`);
      return descendants.find(n => n.getAttribute(attribute[1]) === attribute[2]) || null;
    }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    animate(frames, options = {}) {
      animations++;
      const animationId = animations, target = this.id || this.className || this.attributes.get('class') || this.tagName;
      activeAnimations.set(animationId, target);
      const properties = [...new Set((Array.isArray(frames) ? frames : [frames]).flatMap(frame => Object.keys(frame)))].filter(key => !['offset', 'easing', 'composite'].includes(key));
      let visible = true;
      for (let node = this; node; node = node.parentElement) if (node.hidden) visible = false;
      record('animation:start', { target, duration: options.duration || 0, delay: options.delay || 0, easing: options.easing || 'linear', properties, visible, keyframes: Array.isArray(frames) ? Array.from(frames, frame => ({ ...frame })) : frames });
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const timer = schedule(() => { activeAnimations.delete(animationId); record('animation:finish', { target }); resolve(); }, (options.duration || 0) + (options.delay || 0));
      return { finished, cancel() { clear(timer); if (activeAnimations.delete(animationId)) record('animation:cancel', { target }); reject(new Error('Animation cancelled')); } };
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
  document.getElementById = id => ids.get(id) || null;
  document.createElement = tag => { record('element:create', { tag }); return new Element(tag); };
  document.createElementNS = (_namespace, tag) => new Element(tag);
  document.querySelectorAll = selector => {
    assert.equal(selector, 'dialog[open]');
    return [...ids.values()].filter(n => n.tagName === 'DIALOG' && n.open);
  };
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  const motion = new EventTarget(); motion.matches = reduced;
  document.addEventListener('acf:enter', () => { enters++; record('acf:enter', { workspaceHidden: $('atlas-workspace').hidden, workspaceInert: $('atlas-workspace').inert }); if (!hasApp && autoReady) document.dispatchEvent(new CustomEvent('acf:ready')); });
  document.addEventListener('acf:exit', () => { exits++; record('acf:exit'); });
  document.addEventListener('acf:ready', () => record('acf:ready'));
  document.addEventListener('acf:load-error', () => record('acf:load-error'));
  const globals = {
    document, window, Event, CustomEvent,
    matchMedia: query => {
      if (query === '(prefers-reduced-motion: reduce)') return motion;
      assert.equal(query, '(max-width: 680px)');
      return { matches: false }; // This lifecycle harness uses the desktop layout.
    },
    setTimeout: (callback, delay) => { record('timer:schedule', { delay: delay || 0 }); return schedule(callback, delay); }, clearTimeout: clear,
  };
  runInNewContext(entrySource, globals, { filename: 'public/ACF/entry.js' });
  return {
    $, document, window, motion, trace, history, location,
    get graph() { return currentGraph; },
    get enters() { return enters; }, get exits() { return exits; },
    get animations() { return animations; }, get pendingTimers() { return timers.size; },
    type(value) { $('entry-input').value = value; $('entry-input').dispatchEvent(event('input')); },
    submit() { const e = event('submit'); $('entry-form').dispatchEvent(e); assert(e.defaultPrevented, 'Submission must not navigate'); },
    click(id) { $(id).dispatchEvent(event('click')); },
    loadApp({ fetchDelay = 0, directoryDelay = fetchDelay, bodyDelay = 0, failPath = null, networkFailPath = null, corruptPath = null } = {}) {
      hasApp = true;
      const directory = JSON.parse(readFileSync(new URL('../public/ACF/data/index.json', import.meta.url), 'utf8'));
      const data = new Map(directory.catalogs.map(entry => ['/ACF/data/' + entry.file, readFileSync(new URL('../public/ACF/data/' + entry.file, import.meta.url), 'utf8')]));
      const body = path => path === corruptPath ? '{invalid json' : path.endsWith('/index.json') ? JSON.stringify(directory) : data.get(path);
      class Graph {
        constructor() { currentGraph = this; this.ctx = {}; record('graph:construct'); }
        setData(graph) { this.data = graph; record('graph:setData', { nodes: graph.nodes.length, records: graph.nodes.filter(node => node.kind === 'item').length }); }
        setRegionSelection(ids, meta) { this.regionSelection = ids; this.regionSelectionMeta = meta; record('graph:setRegionSelection', { selected: ids === null ? null : ids.size, meta }); }
        setActive(active) { record('graph:setActive', { active }); }
        setLayers(layers) { record('graph:setLayers', { layers }); }
        focusRecord(id) { record('graph:focusRecord', { id }); return true; }
      }
      class Preview { constructor() { this.card = new Element(); } close() {} }
      const moduleGlobals = {
        ...globals, ...model, ...regions, AtlasGraph: Graph, NodePreview: Preview, previewInfo,
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
      for (let i = 0; timers.size && i < 80; i++) await this.tick();
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
  assert.equal(h.document.activeElement, h.$('search'), 'Focus enters the usable search control');
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
  return h.trace.filter(step => (step.event === 'model:createIndex' || step.event === 'model:graphData') && step.records > 0 && step.activeAnimations > 0);
}
function assertNoModelMotionOverlap(h) {
  assert.equal(modelMotionOverlap(h).length, 0, 'Catalog indexing/graph preparation must not overlap entrance Web Animations');
}

function assertLetterMotion(h) {
  const animations = h.trace.filter(step => step.event === 'animation:start');
  assert.equal(animations.length, 12, 'Normal opening animates the prompt, five letters, five star opacities and connecting lines');
  const prompt = animations.find(step => step.target === 'entry-prompt');
  assert(prompt && prompt.duration <= 180, 'Prompt fade clears room for the letters');
  assert.deepEqual(prompt.properties, ['opacity']);
  const letters = Array.from({ length: 5 }, (_, i) => animations.find(step => step.target === `atlas-letter-${i}`));
  assert(letters.every(Boolean), 'All five ATLAS letter targets animate');
  assert.equal(letters.map(letter => h.$(letter.target).textContent).join(''), 'ATLAS', 'The real hidden markup spells the opening word');
  for (const star of animations.filter(step => step.target.startsWith('entry-star-') || step.target === 'entry-links')) assert.deepEqual(star.properties, ['opacity'], 'Constellation emergence changes opacity only');
  assert.equal(h.$('entry-sequence').getAttribute('aria-hidden'), 'true', 'Decorative letters do not duplicate the screen-reader announcement');
  for (const [i, letter] of letters.entries()) {
    assert(letter.visible, 'Animated letters must not have a hidden DOM ancestor');
    assert.deepEqual([...letter.properties].sort(), ['opacity', 'transform'], 'Letters use composited transform and opacity only');
    assert.equal(letter.easing, 'linear', 'The letter timeline remains linear so the shared hold uses elapsed time; ease individual keyframe segments instead');
    assert(letter.duration > 0 && letter.duration <= 1500, 'Each letter has a bounded rise, hold and exit sequence');
    assert(i === 0 ? letter.delay === 0 : letter.delay > letters[i - 1].delay && letter.delay - letters[i - 1].delay <= 100, 'Letters enter in a short ordered stagger');
    assert.equal(letter.keyframes.length, 5, 'Letter motion includes departure, rise, settled hold and exit');
    assert.notEqual(letter.keyframes[0].transform, letter.keyframes[2].transform, 'Letters visibly change position/scale before the hold');
    assert.equal(letter.keyframes[2].opacity, 1, 'The ATLAS word becomes fully visible');
    assert.equal(letter.keyframes[3].opacity, 1, 'The assembled letters remain visible during the hold');
    assert.equal(letter.keyframes[2].transform, letter.keyframes[3].transform, 'Each letter has a settled hold before its exit');
    assert.equal(letter.keyframes.at(-1).opacity, 0, 'Letters fade out before the workspace opens');
  }
  const holdStart = Math.max(...letters.map(letter => letter.at + letter.delay + letter.duration * letter.keyframes[2].offset));
  const holdEnd = Math.min(...letters.map(letter => letter.at + letter.delay + letter.duration * letter.keyframes[3].offset));
  assert(holdEnd - holdStart >= 250, 'The complete ATLAS word holds together visibly for at least 250ms');
  assert(Math.max(...letters.map(letter => letter.duration + letter.delay)) <= 1800, 'The letter entrance finishes within its bounded motion budget');
  assert.equal(h.trace.filter(step => step.event === 'timer:schedule').length, 0, 'Opening creates no custom timers');
  assert.equal(h.trace.filter(step => step.event === 'element:create').length, 0, 'Opening creates no transient wave/overlay nodes');
}
async function assertLetterProgress(h) {
  assertLetterMotion(h);
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
  const letterFinishes = h.trace.filter(step => step.event === 'animation:start' && step.target.startsWith('atlas-letter-')).map(step => step.at + step.duration + step.delay);
  assert.equal(h.trace.find(step => step.event === 'acf:enter').at, Math.max(...letterFinishes), 'Data work waits for the final staggered letter');
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
  assert.equal(h.animations, 12, 'The loading hold adds no ambient animations');
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
  assert.equal(h.animations, 14, 'Only two bounded reveal tracks follow preparation');
  h.click('skip-animation'); usable(h);
  h.click('return-entry'); await h.settle(); closed(h, 1); cases++;
}

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
  assert(h.trace.some(step => step.event === 'model:createIndex' && step.records === 33945), 'Every real catalog reaches actual model indexing');
  assert(h.trace.some(step => step.event === 'graph:setData' && step.nodes > 0), 'Actual application renders prepared graph data');
  if (process.argv.includes('--profile-motion') && !reduced && fetchDelay === 0) console.log(JSON.stringify({ motionProfile: h.trace.filter(step => step.event === 'animation:start') }));
  assert.equal(graphPreparations(h).length, 1, 'Initial catalog load prepares the graph exactly once');
  assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 1, 'Initial catalog load installs graph data exactly once');
  assertPreparationYields(h);
  assertNoModelMotionOverlap(h);
  const fetches = h.trace.filter(step => step.event === 'fetch:start');
  assert.equal(fetches.length, 10);
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
  const chooseRegion = id => { const choice = h.$('region-memberships').children.find(button => button.dataset.regionId === id); assert(choice, id + ' accessible region button'); choice.dispatchEvent(event('click')); };
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
    assert.equal(h.document.activeElement, h.$('region-close'), 'Region selection moves focus to its accessible panel');
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
  h.history.go(-1); assertField(minds);
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
  const pressedRegion = h.$('region-memberships').children.find(choice => choice.dataset.regionId === 'minds');
  assert.equal(h.document.activeElement, pressedRegion, 'Escape restores focus to the selected region choice');
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
await assert.rejects(assertLetterProgress(unawaited), /Normal opening animates|letter sequence is displayed|Expected values to be strictly equal|One entry event/, 'The progress guard catches opening without awaiting the letters');
await unawaited.settle();
cases++;
if (process.argv.includes('--probe-unawaited-letters')) await assertLetterProgress(unawaited);

const globalEasingSource = source.replace("delay: i * 60, easing: 'linear'", "delay: i * 60, easing: 'cubic-bezier(.22,.7,.26,1)'");
assert.notEqual(globalEasingSource, source, 'The easing mutation must reach the actual letter timeline');
const globalEasing = harness({ entrySource: globalEasingSource }); globalEasing.type('atlas'); globalEasing.submit();
assert.throws(() => assertLetterMotion(globalEasing), /letter timeline remains linear/, 'The motion guard catches global easing that compresses the shared hold');
await globalEasing.settle();
cases++;
if (process.argv.includes('--probe-global-easing')) assertLetterMotion(globalEasing);

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
