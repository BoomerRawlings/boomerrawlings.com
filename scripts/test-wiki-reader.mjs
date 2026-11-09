import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as wikiShared from '../public/wiki-assets/shared.js';
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
test('relationship feelings respect release dates and remain directional through later editorial updates',()=>{
 const data={meta:{latestCompletedAt:'2026-11-12T00:00:00Z'},events:[],cycles:[],journals:[],editors:[{id:'a',joinedAt:'2026-11-01T00:00:00Z'},{id:'b',joinedAt:'2026-11-01T00:00:00Z'}],relationships:[
  {from:'a',to:'b',timestamp:'2026-11-07T01:00:00Z',releasedAt:'2026-11-09T01:00:00Z',trust:0.4,grievance:0.1,attraction:0.6,affection:0.4,closeness:0.2,jealousy:0.1,boundaries:0.3,explanation:'I liked the question despite disagreeing.',evidenceIds:[]},
  {from:'b',to:'a',timestamp:'2026-11-07T02:00:00Z',releasedAt:'2026-11-09T02:00:00Z',trust:0.7,grievance:0,attraction:0.05,affection:0.2,explanation:'Friendly, nothing further.',evidenceIds:[]},
  {from:'a',to:'b',timestamp:'2026-11-09T01:30:00Z',releasedAt:'2026-11-11T01:30:00Z',trust:0.35,grievance:0.15,attraction:0.8,explanation:'Later private feeling.',evidenceIds:[]},
 ]};
 const early=snapshot(data,'2026-11-08T00:00:00Z');
 assert.equal(early.relationships[0].trust,0.4);
 assert.equal(early.relationships[0].attraction,undefined);
 assert.equal(early.relationships[0].explanation,undefined);
 const partial=snapshot(data,'2026-11-09T03:00:00Z');
 assert.equal(partial.relationships[0].trust,0.35);
 assert.equal(partial.relationships[0].attraction,0.6,'retain the most recent released personal observation');
 assert.equal(partial.relationships[0].personalRecordedAt,'2026-11-07T01:00:00Z');
 assert.equal(partial.relationships[1].attraction,0.05);
 assert.ok(!JSON.stringify(partial).includes('Later private feeling'));
 const latest=snapshot(data);
 assert.equal(latest.relationships[0].attraction,0.8);
 assert.equal(wikiShared.relationshipAt({...data.relationships[0],releasedAt:undefined},latest.time).attraction,undefined);
 assert.equal(wikiShared.relationshipAt({...data.relationships[0],releasedAt:'invalid'},latest.time).explanation,undefined);
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

function screenFixture(file, motion = true) {
 const nodes = new Map(), reveals = [], cancelled = [], handlers = new Map();
 function node(id) {
   if (!nodes.has(id)) {
     const listeners = new Map(), attributes = new Map();
     nodes.set(id, {
       id, hidden:false, value:'', textContent:'', innerHTML:'', dataset:{}, isConnected:true,
       classList:{add(){},remove(){},toggle(){}},
       addEventListener(type, fn) { const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list); },
       async emit(type, values={}) { for(const fn of listeners.get(type)||[])await fn({target:this,currentTarget:this,preventDefault(){},...values}); },
       setAttribute(name,value){attributes.set(name,value);},getAttribute(name){return attributes.get(name);},
       removeAttribute(name){attributes.delete(name);},querySelectorAll(){return [];},
       focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;},
       getBoundingClientRect(){return {width:1000,height:700};},
     });
   }
   return nodes.get(id);
 }
 const views=['articles','principles','relationships','activity'].map(name=>{const button=node(`view-${name}`);button.dataset.mapView=name;return button;});
 const document={getElementById:node,querySelector:selector=>node(selector),querySelectorAll:selector=>selector==='[data-map-view]'?views:[],addEventListener(){},activeElement:null,hidden:false};
 const window={matchMedia:()=>({matches:false,addEventListener(){}})};
 if(motion)window.SiteMotion={revealScreen(target, options){reveals.push({id:target.id,kind:options.kind,hidden:target.hidden});},cancelScreen(target){cancelled.push(target.id);}};
 const fixture={meta:{foundingAt:'2026-01-01T00:00:00Z',latestCompletedAt:'2026-01-02T00:00:00Z'},events:[],editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const context=vm.createContext({
   ...wikiShared,document,window,URL,URLSearchParams,
   location:{search:'',hash:'',href:'https://example.invalid/wiki/',origin:'https://example.invalid',pathname:'/wiki/'},
   history:{replaceState(){}},ResizeObserver:class{observe(){}},
   requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,
   loadData:async()=>fixture,safeSessionGet:()=> 'yes',safeSessionSet(){},
   installGate:(kind,unlock)=>handlers.set(kind,unlock),
 });
 const source=readFileSync(new URL(`../public/wiki-assets/${file}`,import.meta.url),'utf8');
 vm.runInContext(source.replace(/^import[^\n]+\n/,''),context,{filename:file});
 return {node,views,reveals,cancelled,context,unlock:async fresh=>handlers.get(file==='wiki.js'?'wiki':'map')(fresh)};
}

test('reader reveals the completed page only after unlock and preserves its focus and anchor navigation',async()=>{
 const ui=screenFixture('wiki.js');
 assert.deepEqual(ui.reveals,[]);
 ui.context.location.hash='#fixture-heading';
 await ui.unlock(true);
 assert.deepEqual(ui.reveals,[{id:'wiki-content',kind:'paper',hidden:false}]);
 assert.equal(ui.node('load-status').hidden,true);
 assert.equal(ui.node('wiki-content').focused,true);
 assert.equal(ui.node('fixture-heading').scrolled,true);
 const noMotion=screenFixture('wiki.js',false);
 await noMotion.unlock(true);
 assert.equal(noMotion.node('wiki-content').focused,true,'the reader remains usable when the enhancement is unavailable');
});

test('map reveals entry and intentional view changes without animating filters, time scrubbing or record selection',async()=>{
 const ui=screenFixture('map.js');
 assert.deepEqual(ui.reveals,[]);
 await ui.unlock(false);
 assert.deepEqual(ui.reveals.map(item=>item.id),['map-controls']);
 await ui.node('view-activity').emit('click');
 assert.deepEqual(ui.reveals.map(item=>item.id),['map-controls','activity-view']);
 assert.equal(ui.reveals.at(-1).hidden,false);
 assert.equal(ui.node('view-activity').getAttribute('aria-pressed'),'true');
 assert.ok(ui.cancelled.includes('map-controls'),'switching immediately cancels the parent entrance reveal');
 await ui.node('view-activity').emit('click');
 await ui.node('map-search').emit('input');
 await ui.node('map-category').emit('change');
 vm.runInContext("setTime(earliest); select('fixture-record','article');",ui.context);
 assert.equal(ui.reveals.length,2,'continuous data and selection updates must not restart screen motion');
 await ui.node('view-relationships').emit('click');
 assert.equal(ui.reveals.at(-1).id,'map-explorer');
 assert.equal(ui.reveals.at(-1).kind,'paper');
 const noMotion=screenFixture('map.js',false);
 await noMotion.unlock(false);await noMotion.node('view-activity').emit('click');
 assert.equal(noMotion.node('activity-view').hidden,false);
});
test('relationship detail and hover explain released feelings while historical views exclude private notes',async()=>{
 const ui=screenFixture('map.js');
 await ui.unlock(false);
 vm.runInContext(`
 data={meta:{latestCompletedAt:'2026-11-10T00:00:00Z'},events:[],cycles:[],journals:[],editors:[{id:'a',joinedAt:'2026-11-01T00:00:00Z'},{id:'b',joinedAt:'2026-11-01T00:00:00Z'}],relationships:[{from:'a',to:'b',timestamp:'2026-11-07T01:00:00Z',releasedAt:'2026-11-09T01:00:00Z',trust:0.4,grievance:0.1,attraction:0.6,affection:0.4,boundaries:0.3,explanation:'Private <feeling>',evidenceIds:[]}]};
 current=Date.parse('2026-11-08T00:00:00Z');state=snapshot(data,new Date(current).toISOString());
 `,ui.context);
 assert.ok(!vm.runInContext("relationshipHistory('a','b')",ui.context).includes('Private'));
 assert.ok(!vm.runInContext('relationshipSummary(state.relationships[0])',ui.context).includes('Attraction'));
 vm.runInContext("current=Date.parse('2026-11-10T00:00:00Z');state=snapshot(data);",ui.context);
 const summary=vm.runInContext('relationshipSummary(state.relationships[0])',ui.context);
 assert.match(summary,/Attraction 60\/100/);
 assert.match(summary,/negative/,'intellectual disagreement coexists with attraction');
 const history=vm.runInContext("relationshipHistory('a','b')",ui.context);
 assert.match(history,/Private &lt;feeling&gt;/);
 assert.ok(!history.includes('<feeling>'));
 assert.match(vm.runInContext('personalDetails(state.relationships[0])',ui.context),/firmer desired limits/);
});
