import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { createIndex, graphData, THEMES } from '../public/ACF/model.js';
import { previewInfo, previewPlacement } from '../public/ACF/preview-data.js';
import { NodePreview } from '../public/ACF/node-preview.js';

const directory = new URL('../public/ACF/data/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('index.json', directory), 'utf8'));
const bundles = manifest.catalogs.map(entry => JSON.parse(fs.readFileSync(new URL(entry.file, directory), 'utf8')));
const ieet = createIndex([bundles.find(bundle => bundle.catalog.id === 'ieet')]);
const all = createIndex(bundles);
const fields = ['actionLabel', 'collection', 'context', 'kind', 'meta', 'title'];

test('actual IEET previews preserve complete titles, date basis, collection and source roles', () => {
  const item = ieet.items.find(record => record.date && record.dateKind && (ieet.byItem.get(record.id) || []).some(credit => credit.role === 'author'));
  const info = previewInfo({ id: item.id, kind: 'item', label: 'Truncated graph label…' }, ieet);
  assert.equal(info.title, item.title);
  assert.equal(info.collection, 'IEET');
  assert.ok(info.meta.includes(item.date));
  assert.match(info.context, / · Author/);
  assert.equal(info.actionLabel, 'Open record and sources');
  const noCredit = ieet.items.find(record => !ieet.byItem.has(record.id));
  assert.match(previewInfo({ id: noCredit.id }, ieet).context, /No usable source credit.*No author has been inferred/);
});

test('all catalog previews distinguish credited labels, publishing roles and unknown metadata', () => {
  for (const bundle of bundles) {
    const index = createIndex([bundle]), graph = graphData(index, index.items);
    for (const node of graph.nodes) {
      const info = previewInfo(node, index);
      assert.deepEqual(Object.keys(info).sort(), fields);
      assert.ok(Object.values(info).every(value => typeof value === 'string' && value.length > 0));
      if (node.scope?.kind === 'theme') {
        assert.equal(info.collection, 'Loaded collections');
        assert.equal(info.kind, 'theme');
        assert.match(info.context, /inferred thematic matches, not source-documented/);
      } else assert.equal(info.collection, bundle.catalog.label);
    }
  }
  for (const role of ['publishing_account', 'publisher_byline', 'cms_author', 'source_author_taxonomy']) {
    const credit = bundles.flatMap(bundle => bundle.credits).find(credit => credit.role === role);
    assert.ok(credit, role);
    const info = previewInfo({ id: credit.personId, kind: 'person' }, all);
    assert.match(info.context, /credited name label.*publishing account/);
    assert.equal(info.title, all.people.get(credit.personId).name);
    assert.equal(info.kind, 'person');
    assert.ok(!info.context.includes('verified person'));
  }
  const missing = all.items.find(item => item.qualityFlags.includes('title_missing_in_source'));
  const unknown = previewInfo({ id: missing.id }, all);
  assert.equal(unknown.title, 'Untitled source record');
  assert.match(unknown.context, /Title unavailable in the source/);
  const undated = all.items.find(item => !item.date && !item.dateRaw);
  assert.match(previewInfo({ id: undated.id }, all).meta, /Date unknown/);
});

test('person counts unique records and retains source role distinctions without name joins', () => {
  const credits = [...all.byPerson.values()].find(rows => rows.length > new Set(rows.map(row => row.itemId)).size);
  const id = credits[0].personId, expected = new Set(credits.map(row => row.itemId)).size;
  const info = previewInfo({ id, kind: 'person', count: 2, scope: { kind: 'person', id } }, all);
  assert.ok(info.meta.startsWith(`${expected.toLocaleString('en-US')} record`));
  if (expected !== 2) assert.match(info.meta, /2 in this view/);
  assert.match(info.context, /matching names in other collections are kept separate/);
});

test('theme previews state title-keyword inference and current-view count', () => {
  for (const [id, title] of THEMES) {
    const info = previewInfo({ id: `theme:${id}`, kind: 'hub', scope: { kind: 'theme', id }, count: 37 }, all);
    assert.equal(info.kind, 'theme'); assert.equal(info.title, title);
    assert.equal(info.collection, 'Loaded collections'); assert.match(info.meta, /37 title records in this view/);
    assert.match(info.context, /title keywords only/); assert.match(info.context, /not source-documented affiliation/);
  }
  const missing = previewInfo({ id: 'unloaded:item' }, all);
  assert.equal(missing.kind, 'unknown'); assert.match(missing.context, /no longer loaded/);
});

test('placement prefers right/below, flips at edges, and stays within the stage', () => {
  const card = { width: 240, height: 160 }, stage = { width: 800, height: 600 };
  assert.deepEqual(previewPlacement({ x: 100, y: 100 }, card, stage), { x: 112, y: 112 });
  assert.deepEqual(previewPlacement({ x: 750, y: 550 }, card, stage), { x: 498, y: 378 });
  for (const x of [-1000, 0, 1, 8, 399.25, 792, 800, 9000]) for (const y of [-9000, 0, 8, 299.75, 592, 600, 1000]) {
    const placement = previewPlacement({ x, y }, card, stage);
    assert.ok(placement.x >= 8 && placement.x + card.width <= stage.width - 8);
    assert.ok(placement.y >= 8 && placement.y + card.height <= stage.height - 8);
  }
});

test('oversize, zoomed fractional and unavailable dimensions produce finite safe positions', () => {
  assert.deepEqual(previewPlacement({ x: 100, y: 100 }, { width: 700, height: 900 }, { width: 320, height: 480 }), { x: 8, y: 8 });
  assert.deepEqual(previewPlacement({ x: 128.125, y: 64.5 }, { width: 180.25, height: 120.75 }, { width: 600.5, height: 400.5 }), { x: 140.125, y: 76.5 });
  assert.deepEqual(previewPlacement({ x: NaN, y: Infinity }, {}, {}), { x: 8, y: 8 });
  const anchor = { x: 50, y: 80 }, card = { width: 200, height: 100 }, stage = { width: 500, height: 400 };
  const before = JSON.stringify({ anchor, card, stage }); previewPlacement(anchor, card, stage);
  assert.equal(JSON.stringify({ anchor, card, stage }), before);
});

// A minimal event/focus DOM, not a controller mock. All card behavior below runs
// through NodePreview's real registered handlers and real metadata projection.
function previewDOM(onOpen = () => {}) {
  const document = { activeElement: null };
  const elements = new Map();
  const make = (id, parent = null, rect = { left: 0, top: 0, width: 0, height: 0 }) => {
    const listeners = new Map();
    const node = {
      id, parentElement: parent, ownerDocument: document, hidden: false, textContent: '', dataset: {}, style: {},
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(callback); },
      emit(type, event = {}) { for (const callback of listeners.get(type) || []) callback({ type, target: node, currentTarget: node, ...event }); },
      contains(child) { for (let current = child; current; current = current.parentElement) if (current === node) return true; return false; },
      getBoundingClientRect() { return { ...rect }; },
      querySelector(selector) { return elements.get(selector.replace(/^#/, '')) || null; },
      focus(options) {
        if (document.activeElement === node) return;
        const previous = document.activeElement; document.activeElement = node;
        for (let current = previous; current; current = current.parentElement) current.emit('focusout', { relatedTarget: node });
        previous?.emit('blur', { relatedTarget: node });
        node.focusOptions = options;
        node.emit('focus', { relatedTarget: previous });
        for (let current = node; current; current = current.parentElement) current.emit('focusin', { relatedTarget: previous });
      },
    };
    elements.set(id, node); return node;
  };
  const stage = make('stage', null, { left: 100, top: 80, width: 800, height: 600 });
  const canvas = make('canvas', stage, { left: 120, top: 110, width: 760, height: 540 });
  const card = make('node-preview', stage, { left: 0, top: 0, width: 280, height: 180 }); card.hidden = true;
  for (const key of ['kind', 'title', 'collection', 'meta', 'context', 'open', 'close']) make('preview-' + key, card);
  const announcement = make('preview-announcement', stage);
  const outside = make('outside');
  const controller = new NodePreview(stage, canvas, () => ieet, onOpen);
  const node = { id: ieet.items[0].id, kind: 'item' }, next = { id: ieet.items[1].id, kind: 'item' };
  return { controller, card, canvas, stage, announcement, outside, elements, document, node, next };
}

test('hover null delays dismissal; crossing into the card and focusing its controls retain it', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ui = previewDOM();
  ui.controller.update(ui.node, { x: 100, y: 80 }, 'hover');
  assert.equal(ui.card.hidden, false);
  assert.equal(ui.announcement.textContent, ''); // Pointer hover must not flood a live region.
  assert.equal(ui.card.style.left, '132px'); // Canvas-to-stage offset retained.
  assert.equal(ui.card.style.top, '122px');
  ui.controller.update(null, null, 'hover');
  t.mock.timers.tick(219); assert.equal(ui.card.hidden, false);
  ui.card.emit('pointerenter');
  t.mock.timers.tick(1000); assert.equal(ui.card.hidden, false);
  ui.card.emit('pointerleave');
  t.mock.timers.tick(100);
  ui.elements.get('preview-open').focus();
  t.mock.timers.tick(1000); assert.equal(ui.card.hidden, false);
  ui.controller.update(null, null, 'hover');
  t.mock.timers.tick(1000); assert.equal(ui.card.hidden, false);
  ui.outside.focus();
  t.mock.timers.tick(219); assert.equal(ui.card.hidden, false);
  t.mock.timers.tick(1); assert.equal(ui.card.hidden, true);
  assert.equal(ui.controller.node, null);
});

test('a selected node remains pinned through hover changes and hover-null dismissal', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ui = previewDOM();
  ui.controller.update(ui.node, { x: 200, y: 100 }, 'select');
  const title = ui.elements.get('preview-title').textContent;
  assert.equal(ui.controller.pinned, true);
  ui.controller.update(ui.next, { x: 250, y: 120 }, 'hover');
  ui.controller.update(null, null, 'hover');
  ui.card.emit('pointerleave');
  t.mock.timers.tick(1000);
  assert.equal(ui.card.hidden, false);
  assert.equal(ui.controller.node, ui.node);
  assert.equal(ui.elements.get('preview-title').textContent, title);
});

test('keyboard previews announce the actual record, while Close restores focus without reopening', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ui = previewDOM();
  ui.controller.update(ui.node, { x: 180, y: 70 }, 'keyboard');
  const info = previewInfo(ui.node, ieet);
  assert.equal(ui.card.dataset.reason, 'keyboard');
  assert.equal(ui.announcement.textContent, [info.title, info.collection, info.meta, info.context].join('. '));
  ui.elements.get('preview-close').focus();
  let graphFocusEvents = 0;
  ui.canvas.addEventListener('focus', () => {
    graphFocusEvents++;
    // AtlasGraph synchronously calls onPreview for its focused node.
    ui.controller.update(ui.node, { x: 180, y: 70 }, 'keyboard');
  });
  ui.elements.get('preview-close').emit('click');
  assert.equal(graphFocusEvents, 1);
  assert.equal(ui.document.activeElement, ui.canvas);
  assert.deepEqual(ui.canvas.focusOptions, { preventScroll: true });
  assert.equal(ui.card.hidden, true);
  assert.equal(ui.controller.node, null);
  assert.equal(ui.controller.pinned, false);
  assert.equal(ui.announcement.textContent, '');
  t.mock.timers.tick(1000); assert.equal(ui.card.hidden, true);
  ui.controller.update(ui.next, { x: 190, y: 70 }, 'keyboard');
  assert.equal(ui.controller.node, ui.next); // Restoration guard does not block future navigation.
  assert.equal(ui.card.hidden, false);
});

test('reading another node starts at its title and same-node updates preserve scrolling', () => {
  const ui = previewDOM();
  ui.controller.update(ui.node, { x: 180, y: 70 }, 'keyboard');
  ui.card.scrollTop = 120;
  ui.controller.update(ui.node, { x: 180, y: 70 }, 'keyboard');
  assert.equal(ui.card.scrollTop, 120);
  ui.controller.update(ui.next, { x: 200, y: 70 }, 'keyboard');
  assert.equal(ui.card.scrollTop, 0);
});

test('Escape and layout invalidation clear the preview immediately and cancel stale timers', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const reason of ['dismiss', 'layout']) {
    const ui = previewDOM();
    ui.controller.update(ui.node, { x: 80, y: 80 }, 'hover');
    ui.controller.update(null, null, 'hover'); // A pending pointer timeout exists.
    ui.controller.update(null, null, reason);
    assert.equal(ui.card.hidden, true); assert.equal(ui.controller.node, null);
    assert.equal(ui.announcement.textContent, '');
    ui.controller.update(ui.next, { x: 200, y: 100 }, 'select');
    t.mock.timers.tick(1000);
    assert.equal(ui.card.hidden, false); assert.equal(ui.controller.node, ui.next);
    ui.controller.update(null, null, reason);
    assert.equal(ui.card.hidden, true); assert.equal(ui.controller.pinned, false);
  }
});

test('Open preserves the selected node and hides its preview before navigation', () => {
  let ui;
  const opened = [];
  ui = previewDOM(node => {
    assert.equal(ui.card.hidden, true);
    assert.equal(ui.controller.node, null);
    assert.equal(ui.announcement.textContent, '');
    opened.push(node);
  });
  ui.controller.update(ui.node, { x: 50, y: 50 }, 'select');
  ui.controller.update(ui.next, { x: 70, y: 50 }, 'hover');
  ui.elements.get('preview-open').emit('click');
  assert.deepEqual(opened, [ui.node]);
  assert.equal(ui.controller.pinned, false);
  ui.elements.get('preview-open').emit('click');
  assert.equal(opened.length, 1); // A stale click never opens a cleared node.
});
