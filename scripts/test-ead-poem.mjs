import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';

// Independently derived from the original opening/body in web/qa/poem/original.txt,
// excluding --- separators and normalizing whitespace. Only the ending changed.
const originalPrefixHash = 'cdfe765bde0fd1c74fe92948150a3892d92cf566de7b2068aeb5b5254fd7804d';
const approvedEnding = [
  "How foolish,\nFor we know that's not true.",
  'A lie said to the other,\nBut really for me.',
  "Whatever we do,\nWhatever may be,\nThere's only one of you,\nAnd only one of me."
];
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
const sectionParagraphs = name => {
  const section = contents.find(node => attr(node, 'class') === `poem-${name}`);
  assert(section, `The ${name} is present`);
  return descendants(section).filter(node => node.tagName === 'p');
};
const prefix = [...sectionParagraphs('opening'), ...sectionParagraphs('body')]
  .map(text).join(' ').replace(/\s+/g, ' ').trim();
assert.equal(createHash('sha256').update(prefix).digest('hex'), originalPrefixHash,
  'Original opening/body wording, spelling, casing and punctuation remain unchanged');
const stanza = node => text(node).trim().split(/\n+/).map(line => line.trim()).join('\n');
assert.deepEqual(sectionParagraphs('ending').map(stanza), approvedEnding,
  'Only the exact user-approved ending replaces the original ending');
assert.equal(paragraphs.length, 39, 'Thirty-nine complete paragraphs/stanzas are present');
assert.equal(contents.filter(node => node.tagName === 'br').length, 19, 'Fifty-eight lines retain their internal breaks');
assert.equal(contents.filter(node => node.tagName === 'hr').length, 2, 'Both original separators become thematic breaks');
for (const [name, count] of [['opening', 2], ['body', 34], ['ending', 3]]) {
  assert.equal(sectionParagraphs(name).length, count);
}
assert.equal(text(paragraphs[0]).replace(/\s+/g, ' ').trim(),
  "don't feed my ego you know - I am a leo she said with a smirk and a grin.");
assert.deepEqual(stanza(paragraphs.at(-1)).split('\n').slice(-2),
  ["There's only one of you,", 'And only one of me.']);
assert(!contents.some(node => ['button', 'details', 'dialog', 'iframe', 'script'].includes(node.tagName)),
  'Reading the poem requires no paging, expansion or further interaction');
assert(!contents.some(node => node.attrs?.some(item => ['hidden', 'inert'].includes(item.name) ||
  (item.name === 'aria-hidden' && item.value === 'true'))), 'No part of the poem is hidden');
assert(!html.includes('Poems to come.'), 'The placeholder is gone');
console.log('Verified Emily Anne poem: unchanged original opening/body hash, exact approved ending, 39 paragraphs, 58 lines, two breaks; one continuous article.');
