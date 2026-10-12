import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'parse5';
import * as model from '../public/ACF/model.js';
import { previewInfo } from '../public/ACF/preview-data.js';

const source = readFileSync(new URL('../public/ACF/entry.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../public/ACF/app.js', import.meta.url), 'utf8');
const markup = readFileSync(new URL('../src/pages/ACF/index.astro', import.meta.url), 'utf8');
const flush = () => new Promise(setImmediate);
const event = (type, properties = {}) => Object.assign(new Event(type, { cancelable: true }), properties);

// Exercise the real script against the real markup. This deliberately models only
// the DOM APIs used by the entrance; rendered geometry belongs to browser checks.
function harness({ reduced = false, animationAPI = true, entrySource = source } = {}) {
  let now = 0, timerId = 0, animations = 0, enters = 0, exits = 0;
  const timers = new Map(), ids = new Map(), activeAnimations = new Map(), trace = [];
  const document = new EventTarget(), window = new EventTarget();
  document.hidden = false;
  const record = (event, detail = {}) => trace.push({ at: now, event, activeAnimations: activeAnimations.size, ...detail });
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
    replaceChildren(...children) { this.children = []; this.append(...children); }
    before(child) { const position = this.parentElement.children.indexOf(this); this.parentElement.children.splice(position, 0, child); child.parentElement = this.parentElement; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
    close() { this.open = false; this.removeAttribute('open'); }
    querySelector(selector) {
      assert(selector.startsWith('.'), `Unexpected selector ${selector}`);
      const descendants = [...this.children];
      for (let i = 0; i < descendants.length; i++) descendants.push(...descendants[i].children);
      return descendants.find(n => n.classList.contains(selector.slice(1))) || null;
    }
    animate(frames, options = {}) {
      animations++;
      const animationId = animations, target = this.id || this.className || this.attributes.get('class') || this.tagName;
      activeAnimations.set(animationId, target);
      const properties = [...new Set((Array.isArray(frames) ? frames : [frames]).flatMap(frame => Object.keys(frame)))].filter(key => !['offset', 'easing', 'composite'].includes(key));
      record('animation:start', { target, duration: options.duration || 0, delay: options.delay || 0, properties });
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      const timer = schedule(() => { activeAnimations.delete(animationId); record('animation:finish', { target }); resolve(); }, (options.duration || 0) + (options.delay || 0));
      return { finished, cancel() { clear(timer); if (activeAnimations.delete(animationId)) record('animation:cancel', { target }); reject(new Error('Animation cancelled')); } };
    }
  }
  const root = new Element('document');
  function build(node, parent) {
    let next = parent;
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
  document.addEventListener('acf:enter', () => { enters++; record('acf:enter', { workspaceHidden: $('atlas-workspace').hidden, workspaceInert: $('atlas-workspace').inert }); });
  document.addEventListener('acf:exit', () => { exits++; record('acf:exit'); });
  document.addEventListener('acf:ready', () => record('acf:ready'));
  const globals = {
    document, window, Event, CustomEvent,
    matchMedia: query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return motion; },
    setTimeout: (callback, delay) => { record('timer:schedule', { delay: delay || 0 }); return schedule(callback, delay); }, clearTimeout: clear,
  };
  runInNewContext(entrySource, globals, { filename: 'public/ACF/entry.js' });
  return {
    $, document, window, motion, trace,
    get enters() { return enters; }, get exits() { return exits; },
    get animations() { return animations; }, get pendingTimers() { return timers.size; },
    type(value) { $('entry-input').value = value; $('entry-input').dispatchEvent(event('input')); },
    submit() { const e = event('submit'); $('entry-form').dispatchEvent(e); assert(e.defaultPrevented, 'Submission must not navigate'); },
    click(id) { $(id).dispatchEvent(event('click')); },
    loadApp({ fetchDelay = 0 } = {}) {
      const directory = JSON.parse(readFileSync(new URL('../public/ACF/data/index.json', import.meta.url), 'utf8'));
      const data = JSON.parse(readFileSync(new URL('../public/ACF/data/ieet.json', import.meta.url), 'utf8'));
      class Graph {
        constructor() { this.ctx = {}; record('graph:construct'); }
        setData(graph) { record('graph:setData', { nodes: graph.nodes.length }); }
        setActive(active) { record('graph:setActive', { active }); }
      }
      class Preview { close() {} }
      const moduleGlobals = {
        ...globals, ...model, AtlasGraph: Graph, NodePreview: Preview, previewInfo,
        URL, URLSearchParams, location: { hash: '', pathname: '/ACF/' }, history: { pushState() {} },
        addEventListener: window.addEventListener.bind(window), performance: { now: () => now },
        AbortSignal: { timeout: () => undefined },
        createIndex: catalogs => { const input = [...catalogs]; record('model:createIndex', { records: input.reduce((sum, c) => sum + c.items.length, 0) }); return model.createIndex(input); },
        graphData: (...args) => { record('model:graphData', { records: args[1].length }); return model.graphData(...args); },
        fetch: path => {
          assert(['/ACF/data/index.json', '/ACF/data/ieet.json'].includes(path), `Unexpected catalog fetch ${path}`);
          record('fetch:start', { path });
          return new Promise(resolve => schedule(() => { record('fetch:response', { path }); resolve({ ok: true, json: async () => path.endsWith('/index.json') ? directory : data }); }, fetchDelay));
        },
      };
      // Only module import declarations are replaced. Actual app listeners,
      // start/cache/fetch/rebuild/render paths execute, with real public metadata.
      runInNewContext(appSource.replace(/^import[^\n]+\r?\n/gm, ''), moduleGlobals, { filename: 'public/ACF/app.js' });
    },
    async tick() {
      assert(timers.size, 'Expected pending motion');
      const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      timers.delete(id); now = timer.at; timer.callback(); await flush();
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
  assert.equal(h.document.body.classList.contains('entry-pending'), false);
  assert.equal(h.document.body.classList.contains('entry-revealing'), false);
  assert.equal(h.document.activeElement, h.$('search'), 'Focus enters the usable search control');
  assert.equal(h.pendingTimers, 0, 'Opening cancels remaining motion');
}
let cases = 0;

for (const value of ['', 'world', 'ATLA', 'ATLASS', 'A TLAS']) {
  const h = harness({ reduced: true }); h.type(value); h.submit(); closed(h);
  assert.equal(h.$('entry-input').getAttribute('aria-invalid'), 'true');
  assert(h.$('entry-feedback').textContent.trim(), 'Helpful feedback is announced');
  assert.equal(h.document.activeElement, h.$('entry-input'));
  assert.equal(h.animations, 0);
  h.type('another path');
  assert.equal(h.$('entry-input').getAttribute('aria-invalid'), null);
  assert.equal(h.$('entry-feedback').textContent, ''); cases++;
}
{
  const h = harness({ reduced: true });
  assert.equal(h.$('hint-copy').hidden, true);
  h.click('entry-hint');
  assert.equal(h.$('hint-copy').hidden, false);
  assert.equal(h.$('entry-hint').getAttribute('aria-expanded'), 'true'); closed(h);
  h.click('entry-hint');
  assert.equal(h.$('hint-copy').hidden, true);
  assert.equal(h.$('entry-hint').getAttribute('aria-expanded'), 'false');
  for (let i = 0; i < 3; i++) { h.type('world'); h.submit(); }
  assert(h.$('entry-feedback').textContent.includes('Try ATLAS'), 'Repeated misses expose the playful answer');
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
    assert.equal(h.document.getElementById('entry-sequence'), null, 'No separate title/reveal sequence remains');
    assert.equal(h.$('entry-screen').inert, false);
    assert.equal(h.$('hint-copy').hidden, true);
    assert.equal(h.$('entry-feedback').textContent, '');
    assert.equal(h.document.activeElement, h.$('entry-input'));
    h.document.dispatchEvent(event('acf:exit-request'));
    assert.equal(h.exits, entry, 'Repeated exit request is harmless');
  }
  cases++;
}
for (const interruption of ['skip', 'resize', 'hidden', 'reduced-motion']) {
  const h = harness(); h.type('atlas'); h.submit();
  assert.equal(h.$('skip-animation').hidden, false);
  assert.equal(h.document.activeElement, h.$('skip-animation'));
  assert.equal(h.$('atlas-workspace').hidden, true, 'The application stays hidden during the prompt fade');
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

function assertCalmMotionBudget(h) {
  const animations = h.trace.filter(step => step.event === 'animation:start');
  assert.equal(animations.length, 1, 'Normal opening uses one prompt fade');
  assert.equal(animations[0].target, 'entry-prompt', 'Only the prompt animates; no viewport reveal');
  assert.deepEqual(animations[0].properties, ['opacity'], 'Only opacity animates; no transform, clipping or wave');
  assert(animations[0].duration > 0 && animations[0].duration <= 220, 'Opening fade stays within the 220 ms budget');
  assert.equal(animations[0].delay, 0, 'The fade has no artificial delay');
  assert.equal(h.trace.filter(step => step.event === 'timer:schedule').length, 0, 'Opening creates no custom timers');
  assert.equal(h.trace.filter(step => step.event === 'element:create').length, 0, 'Opening creates no transient wave/overlay nodes');
}
{
  const h = harness(); h.type('atlas'); h.submit();
  assertCalmMotionBudget(h);
  await h.settle(); usable(h);
  assert.equal(h.trace.find(step => step.event === 'acf:enter').at, 220, 'The entrance completes when its single fade ends');
  cases++;
}

const loadSequences = [];
for (const reduced of [false, true]) for (const fetchDelay of [0, 800]) {
  const h = harness({ reduced }); h.loadApp({ fetchDelay });
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 0, 'Idle riddle does not trigger the catalog listener');
  h.type('atlas'); h.submit(); await h.settle(); usable(h);
  const ready = h.trace.filter(step => step.event === 'acf:ready');
  assert.equal(ready.length, 1, 'Actual application reaches a usable catalog');
  assert(h.trace.some(step => step.event === 'model:createIndex' && step.records === 10467), 'Real IEET metadata reaches actual model indexing');
  assert(h.trace.some(step => step.event === 'graph:setData' && step.nodes > 0), 'Actual application renders prepared graph data');
  if (process.argv.includes('--profile-motion') && !reduced && fetchDelay === 0) console.log(JSON.stringify({ motionProfile: h.trace.filter(step => step.event === 'animation:start') }));
  assert.equal(h.trace.filter(step => step.event === 'model:graphData').length, 1, 'Initial catalog load prepares the graph exactly once');
  assert.equal(h.trace.filter(step => step.event === 'graph:setData').length, 1, 'Initial catalog load installs graph data exactly once');
  assertNoModelMotionOverlap(h);
  const fetches = h.trace.filter(step => step.event === 'fetch:start');
  assert.equal(fetches.length, 2);
  loadSequences.push({ reduced, fetchDelay, readyAt: ready[0].at, trace: h.trace.map(step => ({ ...step })) });
  h.click('return-entry'); h.type('atlas'); h.submit(); await h.settle(); usable(h, 2);
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 2, 'Reentry uses the actual application cache');
  assert.equal(h.trace.filter(step => step.event === 'model:graphData').length, 1, 'Cached reentry does not redundantly prepare graph data');
  // Real collection-change handlers must retain the normal rebuild/refresh path.
  const check = h.$('collection-options').children[0].children[0];
  check.checked = false; check.dispatchEvent(event('change')); await h.settle();
  assert.equal(h.trace.filter(step => step.event === 'model:graphData').length, 2, 'Removing a collection still refreshes the graph once');
  assert(h.$('dataset-status').textContent.startsWith('0 records'), 'Removing the only collection clears the visible data');
  check.checked = true; check.dispatchEvent(event('change')); await h.settle();
  assert.equal(h.trace.filter(step => step.event === 'model:graphData').length, 3, 'Re-adding a cached collection still refreshes the graph once');
  assert(h.$('dataset-status').textContent.startsWith('10,467 records'));
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 2, 'Collection re-addition reuses metadata cache');
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
  assert.equal(h.trace.filter(step => step.event === 'fetch:start').length, 2, 'List reentry keeps cached metadata');
  assert.equal(h.trace.filter(step => step.event === 'model:graphData').length, 1, 'List reentry does not prepare hidden graph data');
  h.click('map-view');
  assert.equal(h.trace.filter(step => step.event === 'graph:setActive').at(-1).active, true, 'Selecting Map resumes its visible graph');
  h.click('return-entry'); h.type('atlas'); h.submit(); await h.settle(); usable(h, 3);
  assert.equal(h.trace.filter(step => step.event === 'graph:setActive').at(-1).active, true, 'Cached Map reentry still resumes the visible graph');
  cases++;
}

// Prove the ordering seam is red-capable without editing production: move only
// the entry signal before the prompt fade in an in-memory source copy.
// This is a structural regression, not a simulated frame-rate measurement.
const earlyLoadSource = source.replace('input.blur();', "input.blur();\n    document.dispatchEvent(new CustomEvent('acf:enter'));");
assert.notEqual(earlyLoadSource, source, 'Early-load mutation must reach the real entrance motion sequence');
const early = harness({ entrySource: earlyLoadSource }); early.loadApp(); early.type('atlas'); early.submit(); await early.settle();
assert.throws(() => assertNoModelMotionOverlap(early), /must not overlap entrance Web Animations/, 'The lifecycle guard catches early model work during the actual entrance sequence');
cases++;
if (process.argv.includes('--probe-early-load')) assertNoModelMotionOverlap(early);

const slowMotionSource = source.replace(/duration:\s*220\b/, 'duration: 2200');
assert.notEqual(slowMotionSource, source, 'The duration mutation must reach the actual entrance fade');
const slowMotion = harness({ entrySource: slowMotionSource }); slowMotion.type('atlas'); slowMotion.submit(); await slowMotion.settle();
assert.throws(() => assertCalmMotionBudget(slowMotion), /220 ms budget/, 'The motion budget catches an unbounded entrance delay');
cases++;
if (process.argv.includes('--probe-slow-motion')) assertCalmMotionBudget(slowMotion);

const reportFlag = process.argv.indexOf('--load-sequence-report');
if (reportFlag >= 0) {
  assert(process.argv[reportFlag + 1], 'Report path required');
  writeFileSync(process.argv[reportFlag + 1], JSON.stringify({
    kind: 'deterministic lifecycle characterization; not a browser frame-rate result',
    sourcePaths: ['public/ACF/entry.js', 'public/ACF/app.js', 'public/ACF/model.js'],
    loadSequences,
    earlyLoadMutation: { caught: true, overlaps: modelMotionOverlap(early) },
    slowMotionMutation: { caught: true, animations: slowMotion.trace.filter(step => step.event === 'animation:start') },
  }, null, 2) + '\n');
}
console.log(`Verified ${cases} ACF entrance cases: existing behavior plus actual app/catalog lifecycle ordering and an early-load mutation. Virtual-time sequencing only; physical animation smoothness belongs to browser measurements.`);
