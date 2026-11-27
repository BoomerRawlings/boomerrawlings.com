import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observe, classify } from './pages-health.mjs';

const marker = '123:1:' + 'a'.repeat(40);
const pages = {
  '/pages-release.txt': marker + '\n',
  '/': '<section data-pip-guide>',
  '/do-i-understand/': '<a href="./SKILL.md" download>',
  '/do-i-understand/SKILL.md': '---\nname: do-i-understand\ndescription: Demo\n---',
};
const probe = (overrides = {}) => observe(async path => ({ ...pages, ...overrides })[path]);
test('recognizes the exact healthy release', async () => {
  assert.equal(classify(await probe(), marker), 'healthy');
});
test('detects a broken download even if it returns a homepage', async () => {
  assert.equal(classify(await probe({ '/do-i-understand/SKILL.md': '<html>homepage fallback</html>' }), marker), 'unhealthy');
});
test('does not attribute an old cached release to a new deploy', async () => {
  assert.equal(classify(await probe(), '124:1:' + 'b'.repeat(40)), 'unconfirmed');
});
test('does not attribute a missing or invalid marker to a deploy', async () => {
  for (const value of ['marker=garbage', null]) {
    assert.equal(classify(await probe({ '/pages-release.txt': value }), marker), 'unconfirmed');
  }
});
