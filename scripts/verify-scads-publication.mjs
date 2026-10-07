import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'parse5';

const slugs = ['01-sensemaking', '02-311-analytics', '03-semantic-discovery', '04-org-knowledge-graphs', '05-graphrag-discovery', '06-agentic-retrieval', '07-efficient-agentic-rag', '08-capability-benchmarks', '09-core-to-edge'];
const source = 'https://github.com/BoomerRawlings/scads-2026-problems';
const read = path => readFileSync(join('dist', path, 'index.html'), 'utf8');
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
function nodes(root, predicate) {
  return [...(predicate(root) ? [root] : []), ...(root.childNodes ?? []).flatMap(n => nodes(n, predicate))];
}
const hasClass = (node, name) => (attr(node, 'class') ?? '').split(/\s+/).includes(name);
const hrefs = html => nodes(parse(html), n => n.tagName === 'a').map(n => attr(n, 'href'));
const overview = read('work/scads-2026');
assert(overview.includes('data-scads-workflow') && overview.includes('href="#workflow"'), 'The collection must expose its single chronological workflow');
assert(overview.includes('/scripts/scads-workflow.js'), 'Workflow behavior must use the same-origin script');
const workflow = JSON.parse(readFileSync('dist/data/scads/workflow.json', 'utf8'));
assert.equal(workflow.plans.length, 1, 'Projects share one interleaved workflow');
assert.equal(workflow.plans[0].steps.length, 43);
assert(workflow.description.includes('not hours worked'));
assert(workflow.footer.includes('P06–P09') && workflow.footer.includes('implementation had not begun'));
const standalone = readFileSync('dist/documents/scads-2026/workflow.html', 'utf8');
const embedded = standalone.match(/<script type="application\/json" id="workflow-data">([\s\S]*?)<\/script>/)?.[1];
assert(embedded, 'The downloadable HTML must include its offline data');
assert.deepEqual(JSON.parse(embedded), workflow, 'Website and downloadable workflow must preserve the same prompts and timing');
assert.equal(nodes(parse(overview), n => hasClass(n, 'scads-project-copy')).length, 9);
assert.equal(nodes(parse(overview), n => n.tagName === 'form' && attr(n, 'data-pip-form') !== undefined).map(n => attr(n, 'action')).join(), '/work/horizon/');
for (const path of ['cv', 'work']) assert(read(path).includes('action="/work/scads-2026/"'), `${path}: main tour must visit the overview`);
assert(hrefs(read('work')).includes(source), 'Projects index must link collection source');

for (const [index, slug] of slugs.entries()) {
  const html = read(`work/scads-2026/${slug}`);
  const doc = parse(html);
  const links = hrefs(html);
  const file = `/documents/scads-2026/${slug}.pdf`;
  const pdf = readFileSync(join('dist', file));
  assert(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')), `${slug}: actual PDF required`);
  assert(pdf.length > 15000, `${slug}: paper must contain content`);
  assert(hrefs(overview).includes(file) && links.includes(file));
  assert(links.includes(`${source}/tree/main/projects/${slug}`));
  assert.equal(nodes(doc, n => n.tagName === 'h1').length, 1);
  assert(html.includes('action="/work/scads-2026/"'), `${slug}: branch tour must return to overview`);
  const demos = nodes(doc, n => attr(n, 'data-scads-demo') !== undefined);
  assert.equal(demos.length, index < 5 ? 1 : 0, `${slug}: only implemented projects have demos`);
  if (index < 5) {
    assert.equal(attr(demos[0], 'data-scads-demo'), slug);
    assert(existsSync(join('dist/data/scads', slug + '.json')));
    assert(html.includes('In progress'));
  } else {
    assert(html.includes('Not started') && html.includes('Implementation has not begun; this project is not completed.'));
    assert(html.includes('Implementation roadmap') && !html.includes('Try the browser demo'));
  }
}

const home = parse(read(''));
const ledger = nodes(home, n => hasClass(n, 'ledger-list'))[0];
const rows = nodes(ledger, n => n.tagName === 'a');
assert.equal(rows.length, 8);
assert.equal(attr(rows[0], 'href'), '/work/scads-2026/');
assert(!rows.some(n => attr(n, 'href') === '/work/triton-tidepool/'));
assert(hrefs(read('work')).includes('/work/triton-tidepool/'), 'Triton remains in the project archive');
const months = ['2026-10', '2026-10', '2026-09', '2026-09', '2026-08', '2026-08', '2026-08', '2026-08'];
rows.forEach((row, i) => {
  const date = nodes(row, n => n.tagName === 'time' && hasClass(n, 'ledger-date'));
  assert.equal(date.length, 1, 'Every selected item needs a publication date');
  assert.equal(attr(date[0], 'datetime'), months[i]);
});
console.log('SCADS publication: nine papers/pages, five demos, four proposals, tour routing, source links, homepage order and dates verified.');
