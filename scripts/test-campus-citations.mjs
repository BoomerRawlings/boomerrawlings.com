import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { parseFragment } from 'parse5';
import { addCampusCitations, campusSourceTitles } from '../src/lib/campus-citations.js';

const input = `<div data-campus-study>
  <p><a data-campus-citation href="https://example.org/report.pdf#page=1">First page</a>
  <a data-campus-citation href="https://example.org/report.pdf#page=1">Same evidence again</a>
  <a data-campus-citation href="https://example.org/report.pdf#page=2">Different locator</a></p>
  <section id="methods"><a href="/data-analysis/campus-safety/data/PROTOCOL.md">Protocol</a>
  <a href="#downloads">Browse downloads</a>
  <math xmlns="http://www.w3.org/1998/Math/MathML"><mi>R</mi><msub><mi>C</mi><mi>i</mi></msub></math></section>
  <section id="downloads"><a href="/data-analysis/campus-safety/data/annual_rates.csv">Annual rates</a></section>
  <noscript><a href="/data-analysis/campus-safety/data/annual_rates.csv">Download fallback</a></noscript>
  <script type="application/json">{"label":"<source>","count":0}</script>
</div>`;
const output = addCampusCitations(input);
const nodes = [];
function walk(node) { nodes.push(node); (node.childNodes ?? []).forEach(walk); }
walk(parseFragment(output));
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const ids = nodes.map(node => attr(node, 'id')).filter(Boolean);
assert.equal(new Set(ids).size, ids.length, 'Citation IDs must be unique.');
const citations = nodes.filter(node => attr(node, 'role') === 'doc-noteref');
const backlinks = nodes.filter(node => attr(node, 'role') === 'doc-backlink');
const sources = nodes.filter(node => attr(node, 'class') === 'campus-source-link');
assert.equal(citations.length, 4);
assert.equal(backlinks.length, 4);
assert.equal(sources.length, 3, 'Repeated exact locators merge; different locators remain distinct.');
assert.equal(attr(citations[0], 'href'), attr(citations[1], 'href'));
assert.notEqual(attr(citations[0], 'href'), attr(citations[2], 'href'));
for (const citation of citations) {
  assert.equal(citation.parentNode.tagName, 'sub', 'User requested subscript citations.');
  assert(ids.includes(attr(citation, 'href').slice(1)), 'Citation target exists.');
  assert(backlinks.some(link => attr(link, 'href') === `#${attr(citation, 'id')}`), 'Every occurrence has a return link.');
}
assert(sources.every(node => node.attrs.some(a => a.name === 'data-campus-verbatim')), 'Preserve source titles during abbreviation formatting.');
assert(output.includes('href="/data-analysis/campus-safety/data/annual_rates.csv">Annual rates'));
assert(output.includes('href="/data-analysis/campus-safety/data/annual_rates.csv">Download fallback'));
assert(output.includes('href="#downloads">Browse downloads'));
assert(output.includes('<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>R</mi><msub><mi>C</mi><mi>i</mi></msub></math>'));
assert(output.includes('{"label":"<source>","count":0}'), 'Embedded datasets remain byte-equivalent.');
for (const [href, title] of campusSourceTitles) {
  assert(title.trim());
  if (href.startsWith('/')) assert(existsSync(`public${href}`), `Missing local evidence: ${href}`);
}
console.log('Campus citations: unique IDs, exact source/locator grouping, every return link, subscript semantics, download exclusions, source titles, MathML and embedded data preserved.');
