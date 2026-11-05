import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('public/scripts/swc-pdf-preview.js');

function fixture({motion = true, nativeDialog = true} = {}) {
  const calls = [];
  const node = () => ({
    events: {}, children: [],
    addEventListener(type, listener) { (this.events[type] ??= []).push(listener); },
    emit(type, values = {}) {
      const event = {button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values};
      for (const listener of this.events[type] || []) listener(event);
      return event;
    },
    replaceChildren(...children) { this.children = children; },
    focus() { this.focused = true; },
  });
  const dialog = node(), gallery = node(), heading = node(), original = node(), close = node(), link = node();
  const preview = {kind: 'public-page-image'};
  link.href = '/documents/example.pdf#view=FitH'; link.dataset = {pdfTitle: 'Example document'};
  link.parentElement = {querySelector: () => ({content: {cloneNode: () => preview}})};
  dialog.querySelector = selector => ({'[data-pdf-gallery]': gallery, '#pdf-dialog-title': heading, '[data-pdf-open]': original, '[data-pdf-close]': close})[selector];
  if (nativeDialog) dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.emit('close'); };
  const document = {querySelector: () => dialog, querySelectorAll: () => [link]};
  const window = motion ? {SiteMotion: {
    revealScreen: (element, options) => calls.push({action: 'reveal', element, ...options, open: dialog.open, populated: gallery.children.length > 0}),
    cancelScreen: element => calls.push({action: 'cancel', element, open: dialog.open}),
  }} : {};
  runInNewContext(source, {document, window});
  return {dialog, gallery, heading, original, close, link, calls};
}

test('PDF preview reveals only after native opening and populated content; closing cancels and restores focus', () => {
  const page = fixture();
  assert.equal(page.calls.length, 0);
  assert.equal(page.link.emit('click').defaultPrevented, true);
  assert.equal(page.dialog.open, true); assert.equal(page.heading.textContent, 'Example document');
  assert.equal(page.original.href, page.link.href); assert.equal(page.gallery.scrollTop, 0);
  assert.equal(page.calls[0].element, page.dialog); assert.equal(page.calls[0].kind, 'paper');
  assert.equal(page.calls[0].open, true); assert.equal(page.calls[0].populated, true);
  page.close.emit('click');
  assert.equal(page.calls.at(-1).action, 'cancel'); assert.equal(page.dialog.open, false);
  assert.equal(page.gallery.children.length, 0); assert.equal(page.link.focused, true);
  page.link.emit('click'); page.dialog.close();
  assert.deepEqual(page.calls.map(call => call.action), ['reveal', 'cancel', 'reveal', 'cancel']);
});

test('PDF modified clicks and unsupported dialogs remain native; absent motion never prevents preview', () => {
  for (const event of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}]) {
    const page = fixture();
    assert.equal(page.link.emit('click', event).defaultPrevented, false);
    assert.equal(page.calls.length, 0); assert.equal(page.dialog.open, undefined);
  }
  const native = fixture({nativeDialog: false});
  assert.equal(native.link.emit('click').defaultPrevented, false); assert.equal(native.calls.length, 0);
  const noMotion = fixture({motion: false});
  noMotion.link.emit('click'); assert.equal(noMotion.dialog.open, true);
  noMotion.dialog.close(); assert.equal(noMotion.link.focused, true);
});

test('CBS8 entrances opt in at the document shell without adding animation to live filtering or polling', () => {
  assert.match(read('src/pages/cbs8/index.astro'), /<ScreenMotion kind="terminal" target="main"\s*\/>/);
  assert.match(read('src/data/cbs8/osint.html'), /<script src="\/scripts\/screen-motion\.js" defer data-page-motion="terminal" data-motion-target="main"><\/script>/);
  for (const path of ['public/scripts/cbs8.js', 'public/scripts/cbs8-osint.js']) {
    assert.doesNotMatch(read(path), /SiteMotion|\.animate\(/);
  }
});

test('custom form and PDF shells load the external helper exactly once', () => {
  for (const path of ['src/pages/BoomerKarma/index.astro', 'src/pages/BoomerKarma/Kemberton/index.astro', 'src/pages/swc/index.astro']) {
    const html = read(path);
    assert.equal([...html.matchAll(/import ScreenMotion /g)].length, 1, path);
    assert.equal([...html.matchAll(/<ScreenMotion\b/g)].length, 1, path);
    assert.ok(html.indexOf('<ScreenMotion') < html.indexOf('</head>'), path);
  }
});
