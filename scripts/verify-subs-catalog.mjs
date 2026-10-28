import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { catalog, countries, sources } from '../src/data/subs/catalog.mjs';

assert.ok(catalog.length, 'catalog cannot be empty');
for (const row of catalog) {
  assert.equal(typeof row.type, 'string');
  assert.equal(typeof row.country, 'string');
  assert.ok(row.type.trim() && row.country.trim(), 'type and origin required');
  assert.ok(Array.isArray(row.sources) && row.sources.length, `missing evidence: ${row.type}`);
  for (const source of row.sources) {
    const url = new URL(source);
    assert.ok(url.protocol === 'https:' || url.protocol === 'http:');
    assert.ok(!url.username && !url.password);
  }
}
assert.equal(new Set(catalog.map(row => `${row.type.toLowerCase()}|${row.country}`)).size, catalog.length);
const html = readFileSync('dist/subs/index.html', 'utf8');
const root = parse(html);
const elements = [];
function walk(node) { if (node.tagName) elements.push(node); (node.childNodes || []).forEach(walk); }
walk(root);
const attr = (node, name) => node.attrs.find(attribute => attribute.name === name)?.value;
const content = node => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(content).join('');
const rows = elements.filter(node => node.tagName === 'tr' && attr(node, 'data-type'));
assert.equal(rows.length, catalog.length, 'every sourced record is rendered');
rows.forEach((row, index) => {
  const cells = row.childNodes.filter(node => node.tagName === 'td');
  assert.equal(cells.length, 2, 'only type and country columns');
  assert.deepEqual(cells.map(content), [catalog[index].type, catalog[index].country]);
  assert.ok(cells.every(cell => !cell.childNodes.some(node => node.tagName === 'a')), 'no row detail links yet');
});
const dialog = elements.find(node => attr(node, 'id') === 'sources');
assert.equal(dialog?.tagName, 'dialog');
const sourceLinks = [];
function sourceWalk(node) { if (node.tagName === 'a') sourceLinks.push(node); (node.childNodes || []).forEach(sourceWalk); }
sourceWalk(dialog);
assert.equal(sourceLinks.length, sources.length);
sourceLinks.forEach((link, index) => {
  assert.equal(attr(link, 'href'), sources[index]);
  assert.equal(content(link), sources[index], 'sources must display raw hyperlinks');
  assert.equal(attr(link, 'rel'), 'noopener noreferrer');
});
assert.ok(html.includes('noindex,nofollow,noarchive,noimageindex'));
assert.ok(html.includes('id="open-sources"'));
assert.ok(html.includes('/subs/catalog.js?v='));
const map = readFileSync('dist/sitemap-0.xml', 'utf8');
assert.ok(!map.includes('/subs/'));
console.log(`SUBS: ${catalog.length} evidenced designs, ${countries.length} origins, ${sources.length} raw source links; rendering and unlisted boundary verified.`);
