import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalog } from '../src/data/subs/catalog.mjs';
const raw = readFileSync('src/data/subs/active.json', 'utf8');
const roster = JSON.parse(raw);
assert.match(roster.snapshot_date, /^\d{4}-\d{2}-\d{2}$/);
assert.ok(roster.classes.length >= 5);
assert.equal(new Set(roster.classes.map(row => row.id)).size, roster.classes.length);
for (const row of roster.classes) {
  assert.match(row.id, /^[a-z0-9][a-z0-9_-]{0,95}$/);
  assert.ok(row.name && row.origin_countries.length && row.operators.length);
  assert.equal(row.service.status, 'commissioned');
  assert.equal(row.service.as_of, roster.snapshot_date);
  assert.ok(row.service.evidence.length, `${row.id}: missing service evidence`);
  for (const value of row.service.evidence) {
    const url = new URL(typeof value === 'string' ? value : value.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(!url.username && !url.password);
  }
  for (const type of row.historical_types) assert.ok(catalog.some(entry => entry.type === type), `${row.id}: broken historical mapping ${type}`);
}
assert.deepEqual(roster.classes.filter(row => row.pilot).map(row => row.id).sort(), ['kilo-877','los-angeles','type-212a','virginia','yuan']);
assert.equal(readFileSync('public/subs/active.json','utf8'), raw);
const html = readFileSync('dist/subs/index.html','utf8');
for (const expected of ['workspace.js','workspace.css','/subs/agent.md','id="owner-open"','id="panel-gallery"','id="panel-releases"','noindex,nofollow,noarchive,noimageindex']) assert.ok(html.includes(expected), `missing ${expected}`);
assert.ok(!/localStorage|sessionStorage/.test(readFileSync('public/subs/workspace.js','utf8')), 'owner key must not be persisted');
const sitemap = readFileSync('dist/sitemap-0.xml','utf8');
assert.ok(!sitemap.includes('/subs/'));
console.log(`SUBS dataset: ${roster.classes.length} dated sourced classes, five pilots, historical mappings, machine snapshot and unlisted workspace verified.`);
