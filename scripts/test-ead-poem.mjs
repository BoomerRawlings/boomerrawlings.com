import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';

// SHA-256 of the user's original text after removing standalone --- separators
// and normalizing whitespace. No duplicate copy of the poem is published.
const expectedHash = 'b2e80634bb4db37a9715c48772c93b2049e63cddfc845b19d0a3542d1ad64015';
const html = readFileSync(process.argv[2] || new URL('../public/ead/workspace.html', import.meta.url), 'utf8');
const root = parse(html);
const descendants = node => [node, ...(node.childNodes ?? []).flatMap(descendants)];
const nodes = descendants(root);
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const article = nodes.find(node => attr(node, 'id') === 'emily-anne-poem');
assert.equal(article?.tagName, 'article', 'The entire poem occupies one continuous article');
const contents = descendants(article);
const paragraphs = contents.filter(node => node.tagName === 'p');
const text = node => node.nodeName === '#text' ? node.value : node.tagName === 'br' ? '\n' :
  (node.childNodes ?? []).map(text).join('');
const normalized = paragraphs.map(text).join(' ').replace(/\s+/g, ' ').trim();
assert.equal(createHash('sha256').update(normalized).digest('hex'), expectedHash,
  'All original words, spelling, casing and punctuation must remain intact');
assert.equal(paragraphs.length, 40, 'All forty paragraphs/stanzas are present');
assert.equal(contents.filter(node => node.tagName === 'br').length, 17, 'Original internal line breaks are preserved');
assert.equal(contents.filter(node => node.tagName === 'hr').length, 2, 'Both original separators become thematic breaks');
for (const [name, count] of [['opening', 2], ['body', 34], ['ending', 4]]) {
  const section = contents.find(node => attr(node, 'class') === `poem-${name}`);
  assert(section, `The ${name} is present`);
  assert.equal(descendants(section).filter(node => node.tagName === 'p').length, count);
}
assert.equal(text(paragraphs[0]).replace(/\s+/g, ' ').trim(),
  "don't feed my ego you know - I am a leo she said with a smirk and a grin.");
assert.equal(text(paragraphs.at(-1)).trim(), "It's just you and me.");
assert(!contents.some(node => ['button', 'details', 'dialog', 'iframe', 'script'].includes(node.tagName)),
  'Reading the poem requires no paging, expansion or further interaction');
assert(!contents.some(node => node.attrs?.some(item => ['hidden', 'inert'].includes(item.name) ||
  (item.name === 'aria-hidden' && item.value === 'true'))), 'No part of the poem is hidden');
assert(!html.includes('Poems to come.'), 'The placeholder is gone');
console.log('Verified complete Emily Anne poem: exact text hash, 40 paragraphs, 57 lines, two thematic breaks; one continuous article.');
