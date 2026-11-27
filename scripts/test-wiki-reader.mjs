import test from 'node:test';
import {officeState,officeDecision,visibleRevisions,defaultSelection} from '../public/wiki-assets/offices.js';
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

function screenFixture(file, motion = true, fixtureOverride) {
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
 const fixture=fixtureOverride??{meta:{foundingAt:'2026-01-01T00:00:00Z',latestCompletedAt:'2026-01-02T00:00:00Z'},events:[],editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const context=vm.createContext({
   ...wikiShared,officeState,visibleRevisions,defaultSelection,document,window,URL,URLSearchParams,
   location:{search:'',hash:'',href:'https://example.invalid/wiki/',origin:'https://example.invalid',pathname:'/wiki/'},
   history:{replaceState(){}},ResizeObserver:class{observe(){}},
   requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,
   loadData:async()=>fixture,safeSessionGet:()=> 'yes',safeSessionSet(){},
   installGate:(kind,unlock)=>handlers.set(kind,unlock),
 });
 const source=readFileSync(new URL(`../public/wiki-assets/${file}`,import.meta.url),'utf8');
 vm.runInContext(source.replace(/^import[^\n]+\n/gm,''),context,{filename:file});
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


test('office reader defaults to current admitted claims, complete index survives, historical views hide future offices',async()=>{
 const at='2026-11-27T00:00:00.000Z',decisionAt='2026-11-27T01:00:00.000Z';
 const assignment={office:'admission',editorId:'martin-reed',version:1,requestId:'technical-request',timestamp:decisionAt,installedAt:decisionAt,authority:'Technical request, no community vote',rubric:['Accuracy']};
 const article={id:'first-revision',revisionId:'first-revision',timestamp:at,editorId:'alice',action:'create',articleId:'care',title:'Care',body:'A claim. [[knowledge]]',categories:['Care']};
 const claim={id:'claim-record',version:2,proposer:'alice',articleId:'care',revisionId:'first-revision',claim:'A claim.',criterion:'Accuracy',status:'admitted',history:[]};
 const fixture={meta:{foundingAt:at,latestCompletedAt:'2026-11-27T03:00:00.000Z',officeAssignments:[assignment]},events:[article,{id:'knowledge-revision',revisionId:'knowledge-revision',timestamp:at,editorId:'alice',action:'create',articleId:'knowledge',title:'Knowledge',body:'Related [[care]].'}, {id:'admit',timestamp:decisionAt,editorId:'martin-reed',action:'policy',body:'Review.',officeDecision:{office:'admission',op:'review',actor:'martin-reed',timestamp:decisionAt,eventId:'admit',reason:'Evidence reviewed.',references:['first-revision'],record:claim}}],editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const ui=screenFixture('wiki.js',true,fixture);await ui.unlock(false);
 assert.equal(ui.node('content-heading').textContent,'Admitted claims');assert.match(ui.node('page-content').innerHTML,/A claim/);assert.match(ui.node('page-content').innerHTML,/Complete article index/);
 assert.match(ui.node('page-content').innerHTML,/1 reviewed claims on current revisions/);
 claim.status='unsupported';vm.runInContext("render()",ui.context);
 assert.match(ui.node('page-content').innerHTML,/1 reviewed claims on current revisions · 0 admitted/);
 assert.match(ui.node('page-content').innerHTML,/Unreviewed articles have not thereby been assessed unsupported/);
 assert.ok(!ui.node('page-content').innerHTML.includes('<blockquote>A claim.</blockquote>'));
 claim.status='admitted';
 vm.runInContext("location.search='?view=articles';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Knowledge/);
 vm.runInContext("location.search='?view=offices&at=2026-11-27T00:30:00.000Z';render()",ui.context);assert.ok(!ui.node('page-content').innerHTML.includes('martin-reed'));
 fixture.events.push({...article,id:'new-revision',revisionId:'new-revision',timestamp:'2026-11-27T02:00:00.000Z',action:'revise',body:'Changed claim. [[knowledge]]'});
 vm.runInContext("location.search='';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/No current claims admitted/);
 assert.match(ui.node('page-content').innerHTML,/0 reviewed claims on current revisions · 0 admitted · 2 articles/);
 assert.match(ui.node('page-content').innerHTML,/href="[^"]*view=articles[^\"]*">Complete article index/);
 vm.runInContext("location.search='?article=care';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/This revision is unreviewed/);
});
test('empty admitted entrance counts reviews rather than treating the complete index as unsupported',async()=>{
 const at='2026-11-27T00:00:00.000Z';
 const fixture={meta:{foundingAt:at,latestCompletedAt:at,officeAssignments:[{office:'admission',editorId:'martin-reed',version:1,requestId:'request',timestamp:at,installedAt:at,rubric:['Accuracy']}]},events:Array.from({length:54},(_,i)=>({id:'r'+i,revisionId:'r'+i,timestamp:at,editorId:'alice',action:'create',articleId:'article-'+i,title:'Article '+i,body:'Related [[article-0]].'})),editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const ui=screenFixture('wiki.js',true,fixture);await ui.unlock(false);
 vm.runInContext("location.search='?view=admitted';render()",ui.context);
 const html=ui.node('page-content').innerHTML;
 assert.match(html,/0 reviewed claims on current revisions · 0 admitted · 54 articles/);
 assert.match(html,/Unreviewed articles have not thereby been assessed unsupported/);
 assert.match(html,/No current claims admitted/);
 assert.match(html,/href="[^"]*view=articles[^\"]*">Complete article index/);
 vm.runInContext("location.search='?view=articles';render()",ui.context);
 assert.match(ui.node('page-content').innerHTML,/Article 53/);
});

test('reader exposes derived multi-article history and source event effects without displaying held draft as live',async()=>{
 const at='2026-11-27T00:00:00.000Z',effectAt='2026-11-27T01:00:00.000Z';
 const article={id:'old',revisionId:'old',timestamp:at,editorId:'alice',action:'create',articleId:'care',title:'Care',body:'Live passage. [[knowledge]]',categories:['Care']};
 const effect={articleId:'care',title:'Renamed care',body:'Released passage. [[knowledge]]',categories:['Care'],principleIds:[],baseRevisionId:'old',alias:'new-care'};
 const fixture={meta:{foundingAt:at,latestCompletedAt:'2026-11-27T03:00:00.000Z'},events:[article,{id:'knowledge-old',revisionId:'knowledge-old',timestamp:at,editorId:'alice',action:'create',articleId:'knowledge',title:'Knowledge',body:'Related [[care]].'},{...article,id:'draft',revisionId:'draft',timestamp:'2026-11-27T00:30:00.000Z',action:'revise',baseRevisionId:'old',body:'Held draft. [[knowledge]]',reviewDraft:['case']},{id:'batch',timestamp:effectAt,editorId:'jo-porter',action:'policy',title:'Execute repair',body:'Applied batch.',articleEffects:[effect,{...effect,alias:undefined,articleId:'knowledge',title:'Knowledge',body:'Related [[care]].',baseRevisionId:'knowledge-old'}]}],editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const ui=screenFixture('wiki.js',true,fixture);await ui.unlock(false);
 vm.runInContext("location.search='?article=new-care';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Released passage/);assert.ok(!ui.node('page-content').innerHTML.includes('Held draft.'));
 vm.runInContext("location.search='?article=care&revision=batch';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Released passage/);
 vm.runInContext("location.search='?view=history&article=care';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/batch/);assert.match(ui.node('page-content').innerHTML,/draft/);
 vm.runInContext("location.search='?view=event&event=batch';render()",ui.context);assert.equal((ui.node('page-content').innerHTML.match(/Applied article revision/g)||[]).length,2);
});

test('observer exposes procedural targets/rulings and returned maintenance originals, suppressing future features and live mutation',async()=>{
 const start='2026-11-27T00:00:00.000Z',activated='2026-11-27T01:00:00.000Z',acted='2026-11-27T02:00:00.000Z';
 const article={id:'base',revisionId:'base',timestamp:start,editorId:'alice',action:'create',articleId:'care',title:'Care',body:'Live prose [[knowledge]].',categories:['Care']};
 const target={office:'admission',op:'rubric',rubricVersion:0,criteria:['Criterion'],reason:'Proposed rubric.',references:['mandate']};
 const ruling={office:'procedure',op:'rule',actor:'adrian-keene',timestamp:acted,eventId:'ruling',reason:'Return for amendment.',references:['mandate'],record:{id:'reference',version:2,proposer:'alice',kind:'operation-reference',policyId:'mandate',ambiguity:'Authority unclear.',target,status:'returned',ruling:'return',history:[{op:'rule',actor:'adrian-keene',timestamp:acted,reason:'Return for amendment.',references:['mandate']}]}};
 const intakeDecision={office:'maintenance',op:'intake-return',actor:'alice',timestamp:acted,eventId:'intake',reason:'Returned: inseparable prose/navigation.',references:['base'],record:{id:'intake',version:1,proposer:'alice',status:'returned',sourceEventId:'intake',changes:[],history:[{op:'intake-return',actor:'alice',timestamp:acted,reason:'Returned: inseparable prose/navigation.',references:['base']}]}};
 const fixture={meta:{foundingAt:start,latestCompletedAt:'2026-11-27T03:00:00.000Z',officeAssignments:[{office:'maintenance',editorId:'jo-porter',version:1,requestId:'maintenance-request',timestamp:start,installedAt:start,authority:'Technical request, no vote.'},{office:'procedure',editorId:'adrian-keene',version:1,requestId:'procedure-request',timestamp:start,installedAt:start,authority:'Technical request, no vote.'}],officeFeatures:[{feature:'procedural-clearance',version:1,requestId:'clearance-request',timestamp:activated,installedAt:activated,authority:'Technical request.'},{feature:'mandatory-maintenance-intake',version:1,requestId:'intake-request',timestamp:activated,installedAt:activated,authority:'Technical request.'}]},events:[article,{id:'knowledge',revisionId:'knowledge',timestamp:start,editorId:'alice',action:'create',articleId:'knowledge',title:'Knowledge',body:'Related [[care]].'},{id:'mandate',timestamp:start,editorId:'alice',action:'policy',title:'Mandate',body:'Public mandate.'},{id:'ruling',timestamp:acted,editorId:'adrian-keene',action:'policy',title:'Ruling',body:'Return.',officeDecision:ruling},{...article,id:'intake',revisionId:'intake',timestamp:acted,action:'organize',body:'Changed prose [[knowledge|Knowledge]].',maintenanceDraft:true,maintenanceIntake:{decision:intakeDecision,explanation:intakeDecision.reason,prosePublished:false,submitted:{title:'Proposed care title',body:'Changed prose [[knowledge|Knowledge]].',categories:['Proposed category']}}}],editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const ui=screenFixture('wiki.js',true,fixture);await ui.unlock(false);
 vm.runInContext("location.search='?view=offices&office=procedure';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Exact referenced operation/);assert.match(ui.node('page-content').innerHTML,/rubricVersion/);assert.match(ui.node('page-content').innerHTML,/Return for amendment/);
 vm.runInContext("location.search='?view=offices&office=maintenance';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Mandatory mechanical intake active/);assert.match(ui.node('page-content').innerHTML,/returned/);
 vm.runInContext("location.search='?view=event&event=intake';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Returned: inseparable/);assert.match(ui.node('page-content').innerHTML,/Proposed care title/);assert.match(ui.node('page-content').innerHTML,/jo-porter/);
 vm.runInContext("location.search='?article=care';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Live prose/);assert.ok(!ui.node('page-content').innerHTML.includes('Changed prose'));
 vm.runInContext("location.search='?article=care&revision=intake';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/Maintenance proposal — not live/);
 vm.runInContext("location.search='?view=offices&at=2026-11-27T00:30:00.000Z';render()",ui.context);assert.ok(!ui.node('page-content').innerHTML.includes('Procedural operation clearance active'));assert.ok(!ui.node('page-content').innerHTML.includes('Mandatory mechanical intake active'));assert.ok(!ui.node('page-content').innerHTML.includes('Return for amendment'));
});

test('advisory review reader shows honest finding and bound clerk response, not registrar approval',async()=>{
 const at='2026-11-27T00:00:00.000Z',end='2026-11-27T03:00:00.000Z';
 const assignments=[{office:'procedure',editorId:'adrian-keene'},{office:'admission',editorId:'martin-reed',rubric:['Accuracy']}].map(a=>({...a,version:1,requestId:'request-'+a.office,timestamp:at,installedAt:at,authority:'Technical request.'}));
 const target={office:'admission',op:'rubric',rubricVersion:0,criteria:['New criterion'],reason:'Change rubric.',references:['mandate']};
 const ref={id:'ref',version:2,kind:'operation-reference',proposer:'martin-reed',status:'released',target,history:[],clerkResponse:'I retain the release <with a narrow reason>.',premiseStatusAtRelease:'unsupported',releaseBinding:{premiseId:'premise',binding:'exact',releasedVersion:2,findingVersion:2,advisory:true}};
 const premise={id:'premise',version:2,premiseVersion:1,kind:'release-premise',proposer:'adrian-keene',status:'unsupported',referenceId:'ref',referenceVersion:1,frozenTarget:target,binding:'exact',history:[],reviews:[],rationale:'A narrow mandate.'};
 const decision=(id,office,record)=>({id,timestamp:at,editorId:'adrian-keene',action:'policy',body:'Public ruling.',officeDecision:{office,op:'rule',actor:'adrian-keene',timestamp:at,eventId:id,reason:'Public reason.',references:[],record}});
 const fixture={meta:{foundingAt:at,latestCompletedAt:end,officeAssignments:assignments,officeFeatures:[{feature:'procedural-premise-admission',requestId:'hard',timestamp:at},{feature:'advisory-procedural-premises',requestId:'advisory',timestamp:at}]},events:[decision('ruling','procedure',ref),decision('finding','admission',premise)],editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const ui=screenFixture('wiki.js',true,fixture);await ui.unlock(false);vm.runInContext("location.search='?view=offices&office=procedure';render()",ui.context);
 let html=ui.node('page-content').innerHTML;assert.match(html,/premise reviews are advisory/);assert.match(html,/premiseStatusAtRelease:<\/strong> unsupported/);assert.match(html,/retain the release &lt;with a narrow reason&gt;/);assert.match(html,/Clerk response binding: current finding/);assert.ok(!html.includes('require current registrar admission'));
 fixture.events.push({...decision('later-finding','admission',{...premise,version:3,status:'limited'}),timestamp:'2026-11-27T01:00:00.000Z'});vm.runInContext('render()',ui.context);html=ui.node('page-content').innerHTML;assert.match(html,/historical or changed finding/);assert.match(html,/Status: <strong>released/);
 vm.runInContext("location.search='?view=offices&office=admission';render()",ui.context);assert.match(ui.node('page-content').innerHTML,/reviewRole:<\/strong> advisory/);assert.ok(!ui.node('page-content').innerHTML.includes('require current registrar admission'));
});

test('article and admission reader show genuinely pending care concurrence without applying the requested review',async()=>{
 const at='2026-11-27T00:00:00.000Z',when='2026-11-27T01:00:00.000Z';
 const assignments=[{office:'care',editorId:'beth-vale'},{office:'admission',editorId:'martin-reed',rubric:['Accuracy']}].map(a=>({...a,version:1,requestId:'request-'+a.office,timestamp:at,installedAt:at,authority:'Technical request.'}));
 const care={id:'r-care',revisionId:'r-care',timestamp:at,editorId:'alice',action:'create',articleId:'care',title:'Care',body:'Care passage. [[knowledge]]',categories:['Care']};
 const hold={id:'hold',version:2,proposer:'alice',status:'open',articleId:'care',revisionId:'r-care',passage:'Care passage.',history:[]};
 const claim={id:'claim',version:1,proposer:'alice',status:'unreviewed',articleId:'care',revisionId:'r-care',claim:'Care passage.',criterion:'Accuracy',history:[],reviews:[]};
 const event=(id,office,record)=>({id,timestamp:at,editorId:'alice',action:'policy',body:'Public record.',officeDecision:{office,op:'submit',actor:'alice',timestamp:at,eventId:id,reason:'Public reason.',references:['r-care'],record}});
 const fixture={meta:{foundingAt:at,latestCompletedAt:when,officeAssignments:assignments,officeFeatures:[{feature:'independent-care-admission-concurrence',requestId:'independence',timestamp:at}]},events:[care,{...care,id:'r-knowledge',revisionId:'r-knowledge',articleId:'knowledge',title:'Knowledge',body:'Related [[care]].'},event('hold-event','care',hold),event('claim-event','admission',claim)],editors:[],cycles:[],relationships:[],journals:[],principles:[]};
 const raw={office:'admission',op:'review',id:'claim',version:1,status:'admitted',reason:'Review the claim.',references:['r-care']};const result=officeDecision(assignments,fixture.events,raw,'martin-reed',when,'waiting-review',snapshot(fixture).articles,fixture.events.map(e=>e.id),{features:fixture.meta.officeFeatures});assert.equal(result.decision.record.status,'pending');fixture.events.push({id:'waiting-review',timestamp:when,editorId:'martin-reed',action:'policy',body:'Request review.',officeDecision:result.decision});
 const ui=screenFixture('wiki.js',true,fixture);await ui.unlock(false);vm.runInContext("location.search='?article=care';render()",ui.context);let html=ui.node('page-content').innerHTML;assert.match(html,/Care concurrence for claim review claim: pending/);assert.match(html,/current binding/);assert.match(html,/Care passage\. — unreviewed/);
 vm.runInContext("location.search='?view=offices&office=admission';render()",ui.context);html=ui.node('page-content').innerHTML;assert.match(html,/<h3>Care concurrence<\/h3>/);assert.match(html,/waiting-review/);assert.match(html,/current binding/);
});

test('policy event reader renders dated nested replies and historical cutoffs without visitor writing controls',async()=>{
 const t='2026-11-27T00:00:00.000Z';
 const root={id:'root-policy',timestamp:t,editorId:'alice',action:'policy',articleId:null,title:'A public proposal',body:'Proposed distinction.',references:[]};
 const first={id:'first-reply',timestamp:'2026-11-27T01:00:00.000Z',editorId:'bob',action:'comment',articleId:null,replyTo:root.id,threadId:root.id,title:root.title,body:'An ordinary reply <not executable>.',references:[root.id]};
 const nested={...first,id:'nested-reply',timestamp:'2026-11-27T02:00:00.000Z',editorId:'alice',replyTo:first.id,body:'Nested follow-up.'};
 const other={...first,id:'other-reply',threadId:'other-policy',replyTo:'other-policy',body:'Separate thread.'};
 const fixture={meta:{foundingAt:t,latestCompletedAt:'2026-11-27T04:00:00.000Z'},events:[root,first,nested,{...root,id:'other-policy'},other],editors:[{id:'alice',name:'Alice',joinedAt:t},{id:'bob',name:'Bob',joinedAt:t}],cycles:[],relationships:[],journals:[],principles:[]};
 const ui=screenFixture('wiki.js',true,fixture);await ui.unlock(false);vm.runInContext("location.search='?view=event&event=root-policy';render()",ui.context);let html=ui.node('page-content').innerHTML;assert.match(html,/Open discussion/);assert.match(html,/ordinary reply &lt;not executable&gt;/);assert.match(html,/Nested follow-up/);assert.ok(!html.includes('Separate thread.'));assert.ok(!/<form|<textarea|contenteditable/.test(html));
 vm.runInContext("location.search='?view=event&event=root-policy&at=2026-11-27T01:30:00.000Z';render()",ui.context);html=ui.node('page-content').innerHTML;assert.match(html,/ordinary reply/);assert.ok(!html.includes('Nested follow-up'));
 vm.runInContext("location.search='?view=event&event=nested-reply';render()",ui.context);html=ui.node('page-content').innerHTML;assert.match(html,/event=root-policy[^\"]*">Policy discussion/);assert.match(html,/Nested follow-up/);
});
