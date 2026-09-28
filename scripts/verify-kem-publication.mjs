import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {parse} from 'parse5';

const route = '/BoomerKarma/Kemberton/';
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const cat = json('src/data/kem-karma.json');
const human = json('src/data/boomer-karma.json');
const catDocument = parse(readFileSync(`dist${route}index.html`, 'utf8'));
const humanDocument = parse(readFileSync('dist/BoomerKarma/index.html', 'utf8'));
const attr = (node, name) => node?.attrs?.find(attribute => attribute.name === name)?.value;
const has = (node, name) => attr(node, name) !== undefined;
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const find = (root, predicate) => nodes(root).find(predicate);
const byId = (root, id) => find(root, node => attr(node, 'id') === id);
const text = node => (node?.nodeName === '#text' ? node.value : (node?.childNodes || []).map(text).join('')).trim();
const total = ledger => ledger.openingBalance + ledger.entries.reduce((sum, entry) => sum + entry.points, 0);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
let checks = 0;
function check(description, verify) {
  try {verify(); checks += 1;}
  catch (error) {error.message = `${description}: ${error.message}`; throw error;}
}

check('cat score is the four owner-supplied factors totaling +6', () => {
  assert.equal(total(cat), 6);
  assert.deepEqual(cat.entries.map(({points, note}) => [points, note]), [
    [2, 'Lazy posture on sofa'], [2, 'Bow tie'], [4, 'Sweater picture'], [-2, 'Reported biting'],
  ]);
  assert.equal(text(byId(catDocument, 'kem-score')), '+6');
  const ledger = find(byId(catDocument, 'kem-report'), node => node.tagName === 'ul' && attr(node, 'class')?.split(' ').includes('ledger'));
  const entries = nodes(ledger).filter(node => node.tagName === 'li');
  assert.equal(entries.length, cat.entries.length);
  for (const [index, entry] of cat.entries.entries()) {
    assert.equal(text(find(entries[index], node => node.tagName === 'h3')), entry.note);
    assert.equal(text(find(entries[index], node => attr(node, 'class')?.split(' ').includes('points'))), `${entry.points > 0 ? '+' : ''}${entry.points}`);
    assert.ok(text(entries[index]).includes(entry.detail));
  }
});

check('human score remains 20 in source and publication', () => {
  assert.equal(total(human), 20);
  assert.equal(text(byId(humanDocument, 'karma-score')), '20');
});

check('cat route is canonical, unindexed, and omitted from every sitemap', () => {
  const robots = find(catDocument, node => node.tagName === 'meta' && attr(node, 'name') === 'robots');
  assert.ok(attr(robots, 'content')?.split(',').includes('noindex'));
  const canonical = find(catDocument, node => node.tagName === 'link' && attr(node, 'rel') === 'canonical');
  assert.equal(attr(canonical, 'href'), `https://boomerrawlings.com${route}`);
  const sitemaps = readdirSync('dist').filter(name => /^sitemap.*\.xml$/.test(name));
  assert.ok(sitemaps.length > 0, 'sitemap files must exist');
  for (const sitemap of sitemaps) assert.ok(!readFileSync(join('dist', sitemap), 'utf8').includes(route), `${sitemap} must omit feline route`);
});

check('human and feline divisions link to each other', () => {
  assert.ok(find(humanDocument, node => node.tagName === 'a' && attr(node, 'href') === route));
  assert.ok(find(catDocument, node => node.tagName === 'a' && attr(node, 'href') === '/BoomerKarma/'));
});

check('new visitors see the application; report stays hidden until delivery', () => {
  const gate = byId(catDocument, 'kem-gate');
  const report = byId(catDocument, 'kem-report');
  assert.ok(gate && report);
  assert.equal(has(gate, 'hidden'), false);
  assert.equal(has(report, 'hidden'), true);
  assert.ok(byId(gate, 'kem-form'));
  assert.ok(byId(report, 'kem-score'));
  const steps = nodes(gate).filter(node => node.tagName === 'fieldset' && has(node, 'data-step'));
  assert.equal(steps.length, 5);
  for (const [index, step] of steps.entries()) {
    assert.equal(attr(step, 'data-step'), String(index));
    assert.equal(has(step, 'hidden'), index > 0);
    assert.equal(has(step, 'disabled'), index > 0);
  }
  assert.ok(!/last (?:5|five) minutes|within (?:5|five) minutes/i.test(text(gate)), 'portrait recency requirement is revealed only after rejection');
});

check('cat application loads the current email helper and local application bundle', () => {
  const scripts = nodes(catDocument).filter(node => node.tagName === 'script' && has(node, 'src'));
  assert.ok(scripts.some(node => attr(node, 'src') === `/scripts/boomer-karma-delivery.js?v=${hash('public/scripts/boomer-karma-delivery.js').slice(0, 12)}`));
  assert.ok(scripts.some(node => attr(node, 'type') === 'module' && attr(node, 'src').startsWith('/_astro/')));
  for (const script of scripts) assert.ok(statSync(join('dist', attr(script, 'src').split('?')[0])).size > 0);
});

check('published cat detector manifest and every local .bin shard are complete', () => {
  const modelDirectory = 'models/kem-cat';
  const sourceManifest = `public/${modelDirectory}/model.json`;
  const outputManifest = `dist/${modelDirectory}/model.json`;
  assert.equal(hash(outputManifest), hash(sourceManifest));
  const groups = json(outputManifest).weightsManifest;
  assert.ok(Array.isArray(groups) && groups.length > 0);
  const paths = groups.flatMap(group => group.paths);
  assert.ok(paths.length > 0);
  assert.equal(new Set(paths).size, paths.length, 'weight shards must be distinct');
  for (const path of paths) {
    assert.match(path, /^[\w-]+\.bin$/, 'model paths must be local binary filenames');
    const source = join('public', modelDirectory, path);
    const output = join('dist', modelDirectory, path);
    assert.ok(statSync(source).size > 0, `${path} source is empty`);
    assert.ok(statSync(output).size > 0, `${path} publication is empty`);
    assert.equal(hash(output), hash(source), `${path} publication must match source`);
  }
  const bytesPerValue = {float32:4, int32:4, bool:1, complex64:8, uint8:1, uint16:2, float16:2};
  for (const group of groups) {
    const expectedBytes = group.weights.reduce((sum, weight) => {
      const size = bytesPerValue[weight.quantization?.dtype || weight.dtype];
      assert.ok(size, `unsupported weight encoding: ${weight.dtype}`);
      return sum + weight.shape.reduce((count, dimension) => count * dimension, 1) * size;
    }, 0);
    const actualBytes = group.paths.reduce((sum, path) => sum + statSync(join('dist', modelDirectory, path)).size, 0);
    assert.equal(actualBytes, expectedBytes, 'shard byte count must match declared tensors');
  }
});

console.log(`Kemberton publication: ${checks} check groups passed.`);
