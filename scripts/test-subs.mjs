import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/subs/entry.js', import.meta.url), 'utf8');

function setup({ reducedMotion = false } = {}) {
  let focused;
  const timers = new Map();
  let timerId = 0;
  function element(id) {
    const listeners = new Map();
    const attributes = new Map();
    return {
      hidden: false, inert: false, disabled: false, value: '', textContent: '', dataset: {},
      addEventListener(type, listener) {
        const handlers = listeners.get(type) ?? [];
        handlers.push(listener);
        listeners.set(type, handlers);
      },
      dispatch(type, extra = {}) {
        const event = { prevented: false, preventDefault() { this.prevented = true; }, ...extra };
        for (const listener of listeners.get(type) ?? []) listener(event);
        return event;
      },
      setAttribute(name, value) { attributes.set(name, value); },
      removeAttribute(name) { attributes.delete(name); },
      getAttribute(name) { return attributes.get(name); },
      focus() { focused = id; },
    };
  }
  const ids = ['counter', 'entry-form', 'entry-input', 'entry-submit', 'entry-feedback', 'descent', 'skip-dive', 'workspace', 'archive-title', 'return-counter'];
  const nodes = Object.fromEntries(ids.map(id => [id, element(id)]));
  nodes.workspace.hidden = true;
  nodes.workspace.inert = true;
  nodes.descent.hidden = true;
  const theme = { content: '#087442' };
  const document = {
    ...element('document'),
    body: { dataset: { stage: 'counter' } },
    title: 'SUBS — The secret menu',
    getElementById: id => nodes[id],
    querySelector: () => theme,
  };
  const motion = { ...element('motion'), matches: reducedMotion };
  const clearTimeout = id => timers.delete(id);
  const window = {
    matchMedia: () => motion,
    scrollTo() {},
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
  };
  runInNewContext(source, { document, window, clearTimeout });
  return {
    nodes, document, motion, theme, timers,
    get focused() { return focused; },
    submit(value) {
      nodes['entry-input'].value = value;
      return nodes['entry-form'].dispatch('submit');
    },
    finishTimer() {
      const callback = timers.values().next().value;
      assert.ok(callback, 'a descent completion is scheduled');
      callback();
    },
  };
}

function assertArchive(ui) {
  assert.equal(ui.document.body.dataset.stage, 'archive');
  assert.equal(ui.nodes.counter.hidden, true);
  assert.equal(ui.nodes.descent.hidden, true);
  assert.equal(ui.nodes.workspace.hidden, false);
  assert.equal(ui.nodes.workspace.inert, false);
  assert.equal(ui.focused, 'archive-title');
  assert.equal(ui.document.title, 'SUBS — Submarine archive');
  assert.equal(ui.theme.content, '#080f0d');
  assert.equal(ui.timers.size, 0);
}

test('empty and incorrect orders stay at the counter with accessible feedback', () => {
  const ui = setup();
  for (const value of ['', '   ', 'sandwich', 'sub', 'submarines']) {
    assert.equal(ui.submit(value).prevented, true);
    assert.equal(ui.document.body.dataset.stage, 'counter');
    assert.equal(ui.nodes.workspace.hidden, true);
    assert.equal(ui.nodes.workspace.inert, true);
    assert.equal(ui.nodes['entry-input'].getAttribute('aria-invalid'), 'true');
    assert.ok(ui.nodes['entry-feedback'].textContent);
    assert.equal(ui.focused, 'entry-input');
    assert.equal(ui.timers.size, 0);
  }
  ui.nodes['entry-input'].dispatch('input');
  assert.equal(ui.nodes['entry-input'].getAttribute('aria-invalid'), undefined);
  assert.equal(ui.nodes['entry-feedback'].textContent, '');
});

test('accepted answer trims space and ignores case; repeated submission does not restart descent', () => {
  const ui = setup();
  ui.submit('  SuBmArInE  ');
  assert.equal(ui.document.body.dataset.stage, 'diving');
  assert.equal(ui.nodes.counter.inert, true);
  assert.equal(ui.nodes.descent.hidden, false);
  assert.equal(ui.nodes.workspace.hidden, true);
  assert.equal(ui.nodes['entry-submit'].disabled, true);
  assert.equal(ui.focused, 'skip-dive');
  const firstTimer = [...ui.timers.keys()];
  ui.submit('submarine');
  ui.submit('wrong');
  assert.deepEqual([...ui.timers.keys()], firstTimer);
  ui.finishTimer();
  assertArchive(ui);
});

test('skip and Escape finish descent and cancel the pending callback', () => {
  for (const exit of [ui => ui.nodes['skip-dive'].dispatch('click'), ui => ui.document.dispatch('keydown', { key: 'Escape' })]) {
    const ui = setup();
    ui.submit('submarine');
    exit(ui);
    assertArchive(ui);
    exit(ui);
    assertArchive(ui);
  }
});

test('reduced motion skips descent, including a preference change while diving', () => {
  const immediate = setup({ reducedMotion: true });
  immediate.submit('submarine');
  assertArchive(immediate);
  const changed = setup();
  changed.submit('submarine');
  changed.motion.matches = true;
  changed.motion.dispatch('change');
  assertArchive(changed);
});

test('backgrounding finishes an active dive but never opens an unanswered gate', () => {
  const ui = setup();
  ui.document.hidden = true;
  ui.document.dispatch('visibilitychange');
  assert.equal(ui.nodes.workspace.hidden, true);
  ui.document.hidden = false;
  ui.submit('submarine');
  ui.document.hidden = true;
  ui.document.dispatch('visibilitychange');
  assertArchive(ui);
});

test('return to counter clears access and restores an operable gate for another visit', () => {
  const ui = setup();
  ui.submit('submarine');
  ui.finishTimer();
  ui.nodes['return-counter'].dispatch('click');
  assert.equal(ui.document.body.dataset.stage, 'counter');
  assert.equal(ui.nodes.counter.hidden, false);
  assert.equal(ui.nodes.counter.inert, false);
  assert.equal(ui.nodes.workspace.hidden, true);
  assert.equal(ui.nodes.workspace.inert, true);
  assert.equal(ui.nodes.descent.hidden, true);
  assert.equal(ui.nodes['entry-input'].value, '');
  assert.equal(ui.nodes['entry-submit'].disabled, false);
  assert.equal(ui.focused, 'entry-input');
  assert.equal(ui.document.title, 'SUBS — The secret menu');
  assert.equal(ui.theme.content, '#087442');
  ui.submit('');
  assert.equal(ui.nodes.workspace.hidden, true);
  ui.submit('submarine');
  ui.finishTimer();
  assertArchive(ui);
});
