import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
import assert from 'node:assert/strict';
import test from 'node:test';

function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? walk(join(path, entry.name)) : [join(path, entry.name)]);
}
function nodes(node) { return [node, ...(node.childNodes || []).flatMap(nodes)]; }
const attr = (node, name) => node.attrs?.find(item => item.name === name)?.value;
const documents = walk('dist').filter(path => path.endsWith('.html')).map(path => ({ path, nodes: nodes(parse(readFileSync(path, 'utf8'))) }));
const helper = readFileSync('public/scripts/screen-motion.js', 'utf8');

test('the actual public artifact contains the exact shared motion helper', () => {
  assert.equal(readFileSync('dist/scripts/screen-motion.js', 'utf8'), helper);
});
test('portfolio motion is present in all shared layout output and executes externally under CSP', () => {
  const pages = documents.filter(doc => doc.nodes.some(node => attr(node, 'data-motion-family') === 'portfolio'));
  assert.ok(pages.length >= 36, `expected the shared portfolio family, found ${pages.length}`);
  for (const doc of pages) {
    const scripts = doc.nodes.filter(node => node.tagName === 'script');
    assert.ok(scripts.some(node => attr(node, 'src')?.startsWith('/scripts/screen-motion.js?')), doc.path);
    assert.ok(scripts.some(node => attr(node, 'src')?.startsWith('/_astro/') &&
      readFileSync(join('dist', new URL(attr(node, 'src'), 'https://local.test').pathname), 'utf8').includes('onpagereveal')), doc.path);
    for (const script of scripts) {
      if (['application/ld+json', 'application/json'].includes(attr(script, 'type'))) continue;
      assert.ok(attr(script, 'src') || !script.childNodes?.some(node => node.value?.trim()), `CSP-blocked inline script: ${doc.path}`);
    }
  }
});
test('standalone opt-ins reference external real assets and DOM surfaces, without a router', () => {
  let standalone = 0;
  const revision = createHash('sha256').update(helper).digest('hex').slice(0, 12);
  for (const doc of documents) {
    const scripts = doc.nodes.filter(node => attr(node, 'src')?.startsWith('/scripts/screen-motion.js'));
    assert.ok(scripts.length <= 1, `duplicate shared owner: ${doc.path}`);
    for (const script of scripts) {
      assert.equal(script.tagName, 'script');
      assert.ok(script.attrs.some(item => item.name === 'defer'), doc.path);
      assert.ok(!script.childNodes?.some(node => node.value?.trim()), doc.path);
      const src = attr(script, 'src');
      if (src.includes('?')) assert.ok(src.endsWith(revision), `stale helper revision: ${doc.path}`);
      const target = attr(script, 'data-motion-target');
      if (target?.startsWith('#')) assert.ok(doc.nodes.some(node => attr(node, 'id') === target.slice(1)), `missing entrance surface ${target}: ${doc.path}`);
      if (!doc.nodes.some(node => attr(node, 'data-motion-family') === 'portfolio')) standalone++;
    }
  }
  assert.ok(standalone >= 8, `standalone adapters missing: ${standalone}`);
  assert.doesNotMatch(helper, /preventDefault|fetch\(|startViewTransition|MutationObserver/);
});
