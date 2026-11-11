import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, runInNewContext } from 'node:vm';
import { parse } from 'parse5';

const html = await readFile(new URL('../dist/0311/index.html', import.meta.url), 'utf8');
const document = parse(html);
const elements = [];
function walk(node) {
  if (node.tagName) elements.push(node);
  for (const child of node.childNodes || []) walk(child);
}
walk(document);
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const bookmark = elements.find(node => attr(node, 'data-tss-bookmarklet') !== undefined);
const href = attr(bookmark, 'href');

test('published bookmarklet is self-contained executable code with production origins', () => {
  assert.ok(href?.startsWith('javascript:'), 'setup must contain a real bookmarklet URL');
  const code = decodeURIComponent(href.slice('javascript:'.length));
  assert.doesNotThrow(() => new Script(code));
  assert.ok(code.includes('https://tss.ucsd.edu'));
  assert.ok(code.includes('https://boomerrawlings.com'));
  assert.ok(!code.includes('localhost') && !code.includes('127.0.0.1'));
  assert.ok(!code.includes('__vite_ssr_import'), 'serialized function cannot depend on build bindings');
  assert.ok(Buffer.byteLength(href) < 65536, 'keep bookmarklet below 64 KiB');
});

test('serialized bookmarklet refuses execution from another origin without opening a window', () => {
  let opens = 0;
  const notices = [];
  const location = { origin: 'https://example.com', href: 'https://example.com/' };
  const window = { location, open: () => { opens++; }, alert: message => notices.push(message) };
  const code = decodeURIComponent(href.slice('javascript:'.length));
  runInNewContext(code, { window, document: {}, location, alert: window.alert, URL, console });
  assert.equal(opens, 0);
  assert.ok(notices.length > 0, 'wrong origin must receive activation guidance');
});

test('Book controls invoke the connection flow and retain verified routes as data only', () => {
  const controls = elements.filter(node => attr(node, 'data-tss-book') !== undefined);
  assert.equal(controls.length, 9);
  assert.ok(controls.every(node => node.tagName === 'button' && attr(node, 'type') === 'button'));
  assert.ok(controls.every(node => attr(node, 'data-book-route')?.startsWith('https://tss.ucsd.edu/fiori#ZUSModule-display?')));
  assert.equal(elements.filter(node => node.tagName === 'a' && /\btss-book\b/.test(attr(node, 'class') || '')).length, 0);
});
