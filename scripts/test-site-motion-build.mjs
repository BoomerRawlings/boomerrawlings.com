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
const portfolioController = readFileSync('public/scripts/portfolio-motion.js', 'utf8');

test('the actual public artifact contains the exact shared motion helper', () => {
  assert.equal(readFileSync('dist/scripts/screen-motion.js', 'utf8'), helper);
});
test('portfolio motion is present in all shared layout output and executes externally under CSP', () => {
  assert.equal(readFileSync('dist/scripts/portfolio-motion.js', 'utf8'), portfolioController);
  const revision = createHash('sha256').update(portfolioController).digest('hex').slice(0, 12);
  const pages = documents.filter(doc => doc.nodes.some(node => attr(node, 'data-motion-family') === 'portfolio'));
  assert.ok(pages.length >= 36, `expected the shared portfolio family, found ${pages.length}`);
  for (const doc of pages) {
    const scripts = doc.nodes.filter(node => node.tagName === 'script');
    assert.ok(scripts.some(node => attr(node, 'src')?.startsWith('/scripts/screen-motion.js?')), doc.path);
    const controllers = scripts.filter(node => attr(node, 'src')?.startsWith('/scripts/portfolio-motion.js'));
    assert.equal(controllers.length, 1, `one early arrival controller: ${doc.path}`);
    const controller = controllers[0], head = doc.nodes.find(node => node.tagName === 'head');
    assert.equal(attr(controller, 'src'), `/scripts/portfolio-motion.js?v=${revision}`, doc.path);
    assert.equal(attr(controller, 'type'), undefined, `pagereveal cannot rely on a deferred module: ${doc.path}`);
    for (const name of ['defer', 'async']) assert.equal(attr(controller, name), undefined, `pagereveal listener must block parsing: ${doc.path}`);
    assert.ok(head.childNodes.includes(controller), `arrival listener must run in head: ${doc.path}`);
    const policy = head.childNodes.find(node => attr(node, 'http-equiv')?.toLowerCase() === 'content-security-policy');
    assert.ok(head.childNodes.indexOf(policy) < head.childNodes.indexOf(controller), `strict CSP must precede the listener: ${doc.path}`);
    const optIns = head.childNodes.filter(node => node.tagName === 'style' && attr(node, 'data-portfolio-navigation') !== undefined);
    assert.equal(optIns.length, 1, `one early native opt-in: ${doc.path}`);
    const optIn = optIns[0], css = optIn.childNodes.map(node => node.value || '').join('');
    assert.match(css, /@view-transition\s*\{\s*navigation:\s*auto\s*;?\s*\}/, doc.path);
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*none/, doc.path);
    assert.ok(head.childNodes.indexOf(policy) < head.childNodes.indexOf(optIn), `CSP must cover the style: ${doc.path}`);
    assert.ok(head.childNodes.indexOf(optIn) < head.childNodes.indexOf(controller), `opt-in must precede script and external stylesheet discovery: ${doc.path}`);
    const helperScript = scripts.find(node => attr(node, 'src')?.startsWith('/scripts/screen-motion.js?'));
    assert.ok(head.childNodes.indexOf(controller) < head.childNodes.indexOf(helperScript), `capture must precede deferred helpers: ${doc.path}`);
    for (const script of scripts) {
      if (['application/ld+json', 'application/json'].includes(attr(script, 'type'))) continue;
      assert.ok(attr(script, 'src') || !script.childNodes?.some(node => node.value?.trim()), `CSP-blocked inline script: ${doc.path}`);
    }
  }
  for (const doc of documents.filter(doc => !pages.includes(doc))) {
    assert.ok(!doc.nodes.some(node => attr(node, 'src')?.startsWith('/scripts/portfolio-motion.js')), `portfolio owner leaked into standalone document: ${doc.path}`);
    assert.ok(!doc.nodes.some(node => attr(node, 'data-portfolio-navigation') !== undefined), `native snapshot opt-in leaked into standalone document: ${doc.path}`);
  }
  assert.doesNotMatch(readFileSync('src/styles/global.css', 'utf8'), /@view-transition\b/, 'the early portfolio shell must own navigation opt-in');
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
