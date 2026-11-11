import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { BOOKING_ROUTES } from '../workers/booking/src/routes.mjs';

const html = await readFile(new URL('../dist/0311/index.html', import.meta.url), 'utf8');
const document = parse(html);
const elements = [];
function walk(node) {
  if (node.tagName) elements.push(node);
  for (const child of node.childNodes || []) walk(child);
}
walk(document);
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
test('page provides UCSD sign-in without executable bookmarks or credential fields', () => {
  const login = elements.filter(node => attr(node, 'data-tss-login') !== undefined);
  assert.equal(login.length, 1);
  assert.equal(login[0].tagName, 'button');
  assert.equal(attr(login[0], 'type'), 'button');
  assert.match(html, /Sign in with UCSD/);
  assert.doesNotMatch(html, /javascript:|data-tss-bookmarklet|data-tss-dialog|data-tss-copy-code|Connect TSS|live\.browser\.run\/ui\/view/i);
  assert.equal(elements.filter(node => node.tagName === 'input' && attr(node, 'type') === 'password').length, 0);
  assert.ok(elements.some(node => attr(node, 'data-tss-session-status') !== undefined));
  assert.ok(elements.some(node => attr(node, 'data-tss-probe-note') !== undefined));
});

test('Book controls use the session API and retain nine verified routes as data only', () => {
  const controls = elements.filter(node => attr(node, 'data-tss-book') !== undefined);
  assert.equal(controls.length, 9);
  assert.ok(controls.every(node => node.tagName === 'button' && attr(node, 'type') === 'button'));
  assert.ok(controls.every(node => attr(node, 'data-book-route')?.startsWith('https://tss.ucsd.edu/fiori#ZUSModule-display?')));
  assert.deepEqual(new Set(controls.map(node => attr(node, 'data-book-route'))), new Set(BOOKING_ROUTES.keys()), 'frontend routes must match the backend allowlist exactly');
  assert.equal(elements.filter(node => node.tagName === 'a' && /\btss-book\b/.test(attr(node, 'class') || '')).length, 0);
});

test('every verified Book route also has an independent direct booking link', () => {
  const controls = elements.filter(node => attr(node, 'data-tss-book') !== undefined);
  const links = elements.filter(node => node.tagName === 'a' && (attr(node, 'class') || '').split(' ').includes('tss-direct-booking'));
  assert.equal(links.length, controls.length);
  for (const control of controls) {
    const link = links.find(node => node.parentNode === control.parentNode);
    assert.ok(link, 'each Book action has a direct alternative beside it');
    assert.equal(attr(link, 'href'), attr(control, 'data-book-route'));
    assert.equal(attr(link, 'target'), '_blank');
    assert.equal(attr(link, 'rel'), 'noopener noreferrer');
    assert.equal(attr(link, 'data-tss-book'), undefined, 'navigation must not trigger the API Book action');
    assert.equal(attr(link, 'onclick'), undefined);
    assert.ok(attr(link, 'aria-label')?.includes('opens in a new tab'));
  }
});
