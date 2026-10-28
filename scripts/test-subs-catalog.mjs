import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync(new URL('../public/subs/catalog.js', import.meta.url), 'utf8');
function setup(records) {
  let focused = '';
  function element(id) {
    const listeners = new Map();
    return {
      value: '', textContent: '', hidden: false, disabled: false, open: false,
      addEventListener: (type, callback) => listeners.set(type, callback),
      fire(type) { listeners.get(type)?.({ preventDefault() {} }); },
      focus() { focused = id; }, scrollIntoView() {},
      showModal() { this.open = true; }, close() { this.open = false; },
    };
  }
  const ids = ['catalog-search', 'catalog-country', 'catalog-clear', 'catalog-previous', 'catalog-next', 'catalog-results', 'catalog-page', 'catalog-empty', 'sources', 'open-sources', 'close-sources'];
  const nodes = Object.fromEntries(ids.map(id => [id, element(id)]));
  const rows = records.map(record => ({ ...element('row'), dataset: record }));
  runInNewContext(script, { document: { getElementById: id => nodes[id], querySelectorAll: () => rows } });
  return { nodes, rows, visible: () => rows.filter(row => !row.hidden), focus: () => focused };
}
const fixtures = Array.from({ length: 113 }, (_, i) => ({ type: `Design ${i}`, country: i % 2 ? 'United Kingdom' : 'United States' }));

test('pagination exposes every result exactly once, including the final partial page', () => {
  const ui = setup(fixtures);
  assert.equal(ui.visible().length, 50);
  assert.equal(ui.nodes['catalog-previous'].disabled, true);
  const seen = ui.visible().map(row => row.dataset.type);
  ui.nodes['catalog-next'].fire('click');
  seen.push(...ui.visible().map(row => row.dataset.type));
  assert.equal(ui.nodes['catalog-page'].textContent, 'Page 2 of 3');
  ui.nodes['catalog-next'].fire('click');
  seen.push(...ui.visible().map(row => row.dataset.type));
  assert.equal(ui.visible().length, 13);
  assert.equal(ui.nodes['catalog-next'].disabled, true);
  assert.deepEqual(seen, fixtures.map(row => row.type));
  ui.nodes['catalog-previous'].fire('click');
  assert.equal(ui.visible()[0].dataset.type, 'Design 50');
});

test('search and exact country filter combine, reset pagination, and recover from zero matches', () => {
  const ui = setup(fixtures);
  ui.nodes['catalog-next'].fire('click');
  ui.nodes['catalog-country'].value = 'United Kingdom';
  ui.nodes['catalog-country'].fire('change');
  assert.equal(ui.nodes['catalog-page'].textContent, 'Page 1 of 2');
  assert.ok(ui.visible().every(row => row.dataset.country === 'United Kingdom'));
  ui.nodes['catalog-search'].value = 'DESIGN 11';
  ui.nodes['catalog-search'].fire('input');
  assert.deepEqual(ui.visible().map(row => row.dataset.type), ['Design 11', 'Design 111']);
  ui.nodes['catalog-search'].value = 'not a submarine';
  ui.nodes['catalog-search'].fire('input');
  assert.equal(ui.visible().length, 0);
  assert.equal(ui.nodes['catalog-empty'].hidden, false);
  assert.equal(ui.nodes['catalog-next'].disabled, true);
  ui.nodes['catalog-clear'].fire('click');
  assert.equal(ui.visible().length, 50);
  assert.equal(ui.nodes['catalog-country'].value, '');
  assert.equal(ui.nodes['catalog-empty'].hidden, true);
  assert.equal(ui.nodes['catalog-clear'].disabled, true);
  assert.equal(ui.focus(), 'catalog-search');
});

test('joint origins, accents, and unordered search words remain findable', () => {
  const ui = setup([{ type: 'Scorpène class', country: 'France / Spain' }, { type: 'S-class', country: 'United States' }]);
  ui.nodes['catalog-country'].value = 'Spain';
  ui.nodes['catalog-search'].value = '  FRANCE scorpene ';
  ui.nodes['catalog-search'].fire('input');
  assert.equal(ui.visible().length, 1);
  assert.equal(ui.visible()[0].dataset.type, 'Scorpène class');
});

test('Sources opens and closes the raw-link dialog independently of filtering', () => {
  const ui = setup(fixtures);
  ui.nodes['open-sources'].fire('click');
  assert.equal(ui.nodes.sources.open, true);
  ui.nodes['close-sources'].fire('click');
  assert.equal(ui.nodes.sources.open, false);
  assert.equal(ui.visible().length, 50);
});
