import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parse } from 'parse5';

const source = readFileSync(new URL('../public/ead/entry.js', import.meta.url), 'utf8');
const flush = () => new Promise(setImmediate);
const event = (type, properties = {}) => Object.assign(new Event(type, { cancelable: true }), properties);

// Only the DOM interfaces entry.js uses. Geometry and rendered motion belong to browser tests.
function harness({ reduced = false } = {}) {
  let now = 0, nextTimer = 0, opens = 0;
  const timers = new Map();
  const classChanges = [];
  const schedule = (callback, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { callback, at: now + delay });
    return id;
  };
  const clear = (id) => timers.delete(id);
  class Element extends EventTarget {
    constructor(traceLabel = '') {
      super();
      this.dataset = {}; this.attributes = new Map(); this.hidden = false; this.inert = false;
      this.readOnly = false; this.focusCount = 0; this.selectionStart = 0; this.selectionEnd = 0;
      this.valueText = ''; this.textContent = ''; this.selectors = new Map();
      const classes = new Set();
      const changeClass = (name, enabled) => {
        if (classes.has(name) !== enabled) {
          if (enabled) classes.add(name); else classes.delete(name);
          if (traceLabel) classChanges.push({ id: traceLabel, name, enabled, at: now });
        }
        return enabled;
      };
      this.classList = {
        add: (...names) => names.forEach((name) => changeClass(name, true)),
        remove: (...names) => names.forEach((name) => changeClass(name, false)),
        contains: (name) => classes.has(name),
        toggle: (name, on = !classes.has(name)) => changeClass(name, on),
      };
    }
    // A text input removes CR/LF from its value; the application must retain raw pasted text separately.
    set value(value) { this.valueText = String(value).replace(/[\r\n]/g, ''); }
    get value() { return this.valueText; }
    setSelectionRange(start, end) { this.selectionStart = Math.min(start, this.value.length); this.selectionEnd = Math.min(end, this.value.length); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() { this.focusCount++; }
    blur() {}
    select() { this.setSelectionRange(0, this.value.length); }
    getBoundingClientRect() { return { left: 20, top: 20, width: 100, height: 30 }; }
    querySelectorAll(selector) { assert(this.selectors.has(selector), `Unexpected selector: ${selector}`); return this.selectors.get(selector); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    animate(_frames, options) {
      let resolve, reject;
      const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
      finished.catch(() => {}); // Cancellation is expected; awaited promises still reject normally.
      const animation = new EventTarget();
      const timer = schedule(() => { resolve(); animation.dispatchEvent(event('finish')); }, (options.duration ?? 0) + (options.delay ?? 0));
      return Object.assign(animation, { finished, cancel() { clear(timer); reject(new Error('Animation cancelled')); } });
    }
  }
  const ids = ['entry-screen', 'entry-form', 'entry-input', 'entry-copy', 'entry-sequence', 'research-workspace', 'entry-feedback', 'main'];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  const document = new EventTarget();
  document.hidden = false; document.body = new Element(); document.body.classList.add('entry-pending');
  document.documentElement = { clientHeight: 800 };
  document.getElementById = (id) => { assert(elements[id], `Unexpected element: ${id}`); return elements[id]; };
  const initials = Array.from({ length: 3 }, () => new Element());
  const rows = initials.map((initial, index) => {
    const row = new Element(`row:${index}`);
    row.selectors.set('.entry-initial', [initial]);
    row.selectors.set('.entry-tail > span', [...['ow', 'xposure', 'perator'][index]].map((character, position) => {
      const letter = new Element(`row:${index}:tail:${position}:${character}`);
      letter.textContent = character;
      return letter;
    }));
    return row;
  });
  elements['entry-sequence'].selectors.set('.entry-initial', initials);
  elements['entry-sequence'].selectors.set('.entry-row', rows);
  document.querySelectorAll = (selector) => { assert.equal(selector, '#leo-dock > span'); return initials.map(() => new Element()); };
  const workspace = elements['research-workspace']; workspace.hidden = true; workspace.inert = true;
  elements['entry-sequence'].hidden = true;
  const window = new EventTarget();
  const motion = new EventTarget(); motion.matches = reduced;
  document.addEventListener('ead:open', () => opens++);
  runInNewContext(source, {
    document, Event, AbortController,
    matchMedia: (query) => query === '(prefers-reduced-motion: reduce)' ? motion : { matches: false },
    addEventListener: window.addEventListener.bind(window), setTimeout: schedule, clearTimeout: clear,
  }, { filename: 'public/ead/entry.js' });
  const input = elements['entry-input'], form = elements['entry-form'], screen = elements['entry-screen'];
  return {
    input, form, screen, workspace, document, motion, window, elements, classChanges,
    get opens() { return opens; }, get pendingTimers() { return timers.size; },
    type(value) { input.value = value; input.setSelectionRange(value.length, value.length); input.dispatchEvent(event('input')); },
    paste(value, kind = 'paste') {
      const transfer = { getData: () => value };
      const e = event(kind, kind === 'paste' ? { clipboardData: transfer } : { dataTransfer: transfer });
      input.dispatchEvent(e); assert(e.defaultPrevented, `${kind} must preserve the full raw input`);
    },
    submit() { const e = event('submit'); form.dispatchEvent(e); assert(e.defaultPrevented, 'Submit must not reload the page'); },
    async tick() {
      assert(timers.size, 'Expected a pending animation/wait');
      const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      timers.delete(id); now = timer.at; timer.callback(); await flush();
    },
    async settle() { for (let i = 0; timers.size && i < 100; i++) await this.tick(); assert.equal(timers.size, 0, 'Animation must settle'); await flush(); },
  };
}
function stillClosed(h) {
  assert.equal(h.opens, 0); assert.equal(h.screen.hidden, false);
  assert.equal(h.workspace.hidden, true); assert.equal(h.workspace.inert, true);
}
function usable(h) {
  assert.equal(h.opens, 1, 'Lazy initialization event fires once');
  assert.equal(h.screen.hidden, true); assert.equal(h.workspace.hidden, false); assert.equal(h.workspace.inert, false);
  assert.equal(h.document.body.classList.contains('entry-pending'), false);
  assert.equal(h.document.body.classList.contains('entry-docking'), false);
  assert.equal(h.elements.main.focusCount, 1, 'Focus transfers once');
}

let cases = 0;
{
  // Verify source markup too: a single-line input must not truncate an invalid longer entry into LEO.
  const nodes = [parse(readFileSync(new URL('../src/pages/ead/index.astro', import.meta.url), 'utf8'))];
  for (let i = 0; i < nodes.length; i++) nodes.push(...(nodes[i].childNodes ?? []));
  const input = nodes.find(node => node.tagName === 'input' && node.attrs.some(attr => attr.name === 'id' && attr.value === 'entry-input'));
  assert(input, 'Entry input exists');
  const attributes = new Map(input.attrs.map(attr => [attr.name, attr.value]));
  assert.equal(attributes.has('placeholder'), false, 'Entry has no placeholder cue');
  assert.equal(attributes.has('maxlength'), false, 'Entry accepts the full value before comparison');
  cases++;
}
const invalid = ['', 'L', 'LE', 'LEOX', 'XLEO', ' LEO', 'LEO ', 'L EO', 'LEO\t', '\tLEO', 'LEO\r\n', '\nLEO', 'L\nEO', 'LEO\u00a0', 'LEO\u200b', 'ＬＥＯ', 'LEО'];
for (const value of invalid) {
  const h = harness({ reduced: true }); h.paste(value); h.submit(); stillClosed(h);
  assert.equal(h.input.attributes.get('aria-invalid'), 'true', `Rejected ${JSON.stringify(value)}`);
  cases++;
}
for (const method of ['type', 'paste']) for (const value of ['LEO', 'leo', 'lEo']) {
  const h = harness({ reduced: true }); h[method](value);
  assert.equal(h.input.value, 'LEO'); stillClosed(h); // Entry never auto-submits at the third character.
  h.submit(); usable(h); h.submit(); h.paste('LEO'); h.submit(); usable(h);
  assert.equal(h.pendingTimers, 0, 'Reduced motion finishes immediately'); cases++;
}
for (const value of ['LEOX', ' LEO', 'LEO\n']) {
  const h = harness({ reduced: true }); h.paste(value, 'drop'); h.submit(); stillClosed(h); cases++;
}
{
  const h = harness({ reduced: true }); h.type('LEOX'); h.submit(); stillClosed(h);
  h.input.setSelectionRange(3, 4); h.paste(''); h.submit(); usable(h); cases++;
}
{
  const h = harness({ reduced: true }); h.type('LEO');
  h.input.dispatchEvent(event('compositionstart')); h.type('leo'); h.submit(); stillClosed(h);
  const enter = event('keydown', { key: 'Enter', isComposing: true }); h.input.dispatchEvent(enter); assert(enter.defaultPrevented);
  h.input.dispatchEvent(event('compositionend')); assert.equal(h.input.value, 'LEO'); stillClosed(h);
  h.submit(); usable(h); cases++;
}
{
  const h = harness(); h.window.dispatchEvent(event('resize')); h.document.hidden = true;
  h.document.dispatchEvent(event('visibilitychange')); stillClosed(h); cases++;
}
{
  const h = harness(); h.type('LEO'); h.submit();
  assert.equal(h.opens, 1, 'Only accepted submission starts data loading, before animation finishes');
  assert(h.workspace.hidden && h.workspace.inert, 'Loading must not reveal the workspace early');
  h.submit(); assert.equal(h.opens, 1); await h.settle(); usable(h); cases++;
}
{
  const h = harness(); h.type('LEOX'); h.submit(); stillClosed(h);
  await h.settle(); stillClosed(h); // Invalid-input feedback animation must not reveal anything.
  h.type('LEO'); h.submit(); await h.settle(); usable(h); cases++;
}
{
  const h = harness(); h.type('LEO'); h.submit();
  const expected = ['ow', 'xposure', 'perator'].flatMap((word, row) => [...word].map((character, position) => `row:${row}:tail:${position}:${character}`));
  for (let i = 0; h.screen.dataset.phase !== 'expanded' && i < 100; i++) await h.tick();
  assert.equal(h.screen.dataset.phase, 'expanded');
  const printed = h.classChanges.filter(change => change.name === 'is-printed');
  assert.deepEqual(printed.map(change => change.id), expected, 'Suffixes type in Low, Exposure, Operator order');
  assert(printed.every(change => change.enabled), 'Expanded words retain every printed character');
  assert(printed.every((change, index) => !index || change.at > printed[index - 1].at), 'Characters print on separate timer turns');
  await h.settle(); usable(h);
  const erased = h.classChanges.filter(change => change.name === 'is-printed' && !change.enabled);
  assert.deepEqual(erased.map(change => change.id), [...expected].reverse(), 'Backspace reverses both row and character order');
  assert(erased.every((change, index) => !index || change.at > erased[index - 1].at), 'Characters erase on separate timer turns');
  const cursors = new Set();
  const cursorChanges = h.classChanges.filter(change => change.name === 'is-typing');
  assert(cursorChanges.some(change => change.enabled), 'Typing uses a row cursor');
  for (const change of cursorChanges) {
    if (change.enabled) cursors.add(change.id); else cursors.delete(change.id);
    assert(cursors.size <= 1, 'Only one row has the typing cursor');
  }
  assert.equal(cursors.size, 0, 'Typing cursor clears after the sequence');
  cases++;
}
for (const phase of ['stacking', 'stacked', 'printing', 'expanded', 'collapsing', 'regrouping', 'docking']) for (const interruption of ['resize', 'hidden', 'reduced-motion']) {
  const h = harness(); h.type('LEO'); h.submit();
  for (let i = 0; h.screen.dataset.phase !== phase && i < 100; i++) await h.tick();
  assert.equal(h.screen.dataset.phase, phase); assert.equal(h.workspace.inert, true);
  if (interruption === 'resize') h.window.dispatchEvent(event('resize'));
  else if (interruption === 'hidden') { h.document.hidden = true; h.document.dispatchEvent(event('visibilitychange')); }
  else { h.motion.matches = true; h.motion.dispatchEvent(event('change')); }
  const lettersAtInterruption = h.classChanges.filter(change => change.name === 'is-printed').length;
  await h.settle(); usable(h);
  assert.equal(h.classChanges.filter(change => change.name === 'is-printed').length, lettersAtInterruption, 'Interrupted typing/deleting does not continue in the background');
  h.window.dispatchEvent(event('resize')); h.document.dispatchEvent(event('visibilitychange')); h.submit(); usable(h);
  cases++;
}
console.log(`Verified ${cases} EAD entry behavior cases against public/ead/entry.js. Visual sequence and server authentication are not tested here.`);
