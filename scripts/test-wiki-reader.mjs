import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, markup, linksIn, pacificDayEnd, lineDiff, attributedLines, stablePositions } from '../public/wiki-assets/shared.js';

test('attribution preserves unchanged lines and credits the revision that replaces a line', () => {
 const first = {editorId:'a', body:'Keep this.\nReplace this.\nRemove this.'};
 const second = {editorId:'b', body:'Keep this.\nNew wording.'};
 const third = {editorId:'c', body:second.body};
 assert.deepEqual(attributedLines([first, second, third]), [
   {text:'Keep this.', revision:first},
   {text:'New wording.', revision:second},
 ]);
});

test('historical reader excludes future revisions, users, cycles, attitudes and journals',()=>{
 const data={meta:{latestCompletedAt:'2026-11-04T08:00:00Z'},editors:[{id:'a',joinedAt:'2026-09-23T23:00:00Z'},{id:'b',joinedAt:'2026-10-02T19:00:00Z'}],events:[{id:'e1',timestamp:'2026-09-23T23:10:00Z',editorId:'a',action:'create',articleId:'x',body:'Original [[y|Other]].',revisionId:'r1'},{id:'e2',timestamp:'2026-10-02T20:00:00Z',editorId:'b',action:'revise',articleId:'x',body:'Changed.',revisionId:'r2'}],cycles:[{id:'c1',endAt:'2026-09-27T20:00:00Z'},{id:'c2',endAt:'2026-10-03T08:00:00Z'}],relationships:[{timestamp:'2026-10-02T22:00:00Z',from:'a',to:'b',trust:0.5}],journals:[{timestamp:'2026-09-23T23:10:00Z',releasedAt:'2026-09-25T23:10:00Z',body:'Reflection'}]};
 const before=snapshot(data,'2026-09-24T07:00:00Z');
 assert.equal(before.articles.get('x').body,'Original [[y|Other]].');assert.equal(before.editors.length,1);assert.equal(before.cycles.length,0);assert.equal(before.relationships.length,0);assert.equal(before.journals.length,0);assert.equal(before.links.length,0);
 const later=snapshot(data);assert.equal(later.articles.get('x').body,'Changed.');assert.equal(later.journals.length,1);assert.equal(later.relationships.length,1);
});
test('markup escapes executable content and link attribute injection',()=>{
 const html=markup('## <script>alert(1)</script>\n\n<img src=x onerror=alert(1)> [[x\" onclick=\"evil|<b>unsafe</b>]] **bold**');
 assert.ok(!html.includes('<script>')&&!html.includes('<img')&&!html.includes('<b>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!/href="[^"]*" onclick=/.test(html));assert.ok(html.includes('<strong>bold</strong>'));
 assert.deepEqual(linksIn('[[one|One]] [[one]] [[two]]'),['one','two']);
});
test('Pacific day scrubber handles fallback without losing an hour',()=>{
 assert.equal(new Date(pacificDayEnd('2026-10-31')).toISOString(),'2026-11-01T06:59:59.000Z');
 assert.equal(new Date(pacificDayEnd('2026-11-01')).toISOString(),'2026-11-02T07:59:59.000Z');
});
test('layout positions remain stable as articles arrive',()=>{
 const a=stablePositions([{id:'one'},{id:'two'}]);const b=stablePositions([{id:'one'},{id:'two'},{id:'three'}]);
 assert.deepEqual(a.get('one'),b.get('one'));assert.deepEqual(a.get('two'),b.get('two'));
});
test('revision diff includes actual additions and removals with escaped markup',()=>{
 const diff=lineDiff('Old sentence.\nKeep.','New sentence <script>.\nKeep.');
 assert.ok(JSON.stringify(diff).includes('Old sentence'));assert.ok(JSON.stringify(diff).includes('New sentence'));
});
