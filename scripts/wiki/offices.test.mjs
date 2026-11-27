import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICE_ROLES,officeState,officeDecision,visibleRevisions,heldCases} from '../../public/wiki-assets/offices.js';
import {articlesAt,installOffice,createState,propose,completeCycle,characterPacket,exportPublic,validatePublic} from './engine.mjs';
import {snapshot} from '../../public/wiki-assets/shared.js';
const t='2026-11-27T00:00:00.000Z',later='2026-11-27T01:00:00.000Z';
const proof={checkedAt:later,result:{ordinaryUsageAllowed:true,rateLimitsByLimitId:{codex:{primary:{usedPercent:2,windowDurationMins:10080}}}}};
const journal='I considered the evidence available in this window before choosing an action. The proposed record should preserve the exact wording and its source so a later reader can challenge the decision. I do not yet know whether this attempt will be published. I will watch the next recorded response before deciding what to do again.';
function fixture(){
 const assignments=Object.entries(OFFICE_ROLES).map(([office,editorId])=>({office,editorId,version:1,requestId:'request-'+office,timestamp:t,installedAt:t,authority:'Owner technical request, no vote',...(office==='admission'?{rubric:['Accuracy']}: {})}));
 const events=[{id:'revision-one',revisionId:'revision-one',timestamp:t,editorId:'alice',action:'create',articleId:'care',title:'Care',body:'Held passage. Unrelated sentence. [[knowledge]]',categories:['Care'],principleIds:['accuracy']},{id:'revision-two',revisionId:'revision-two',timestamp:t,editorId:'alice',action:'create',articleId:'knowledge',title:'Knowledge',body:'Knowledge links [[care]].',categories:['Knowledge'],principleIds:['accuracy']},{id:'cycle-0113-alfie-margin',timestamp:t,editorId:'alfie-margin',action:'comment',articleId:'care',body:'Please examine this passage.'},{id:'policy-one',timestamp:t,editorId:'alice',action:'policy',body:'Adopted text remains unchanged.'}];
 for(const a of assignments)events.push({id:a.requestId,timestamp:t,editorId:a.editorId,action:'policy',body:'Technical request.'});
 let n=0;
 const f={assignments,events,at:later,project:()=>officeState(assignments,events,f.at),articles:()=>articlesAt({events},f.at)};
 f.act=(office,op,extra={},actor='alice')=>{
   const id='decision-'+(++n),timestamp=new Date(Date.parse(later)+n*1000).toISOString();f.at=timestamp;
   const raw={office,op,reason:'Public reason.',references:['revision-one','policy-one','cycle-0113-alfie-margin'],...extra};
   const before=JSON.stringify(events);let result;
   try{result=officeDecision(assignments,events,raw,actor,timestamp,id,f.articles(),events.map(e=>e.id));}catch(e){assert.equal(JSON.stringify(events),before);throw e;}
   const event={id,timestamp,editorId:actor,action:'policy',body:'Office decision.',officeDecision:result.decision,...(result.effects.length?{articleEffects:result.effects}:{})};events.push(event);return result.decision.record??result.decision;
 };
 return f;
}
test('empty offices have attributed assignments, no seeded claims; install is gated, request-bound and idempotent',()=>{
 const f=fixture();assert.equal(Object.values(f.project()).flatMap(o=>o.records).length,0);assert.deepEqual(officeState(f.assignments,f.events,'2026-11-26T23:59:59Z'),{});
 const state=createState();state.latestCompletedAt=t;state.events=f.events;state.backendChanges=Object.entries(OFFICE_ROLES).map(([office,editorId])=>({id:'request-'+office,editorId,status:'queued'}));
 assert.throws(()=>installOffice(state,{office:'care',requestId:'request-maintenance'},{proof,now:later}),/matching/);
 assert.equal(installOffice(state,{office:'care',requestId:'request-care'},{proof,now:later}).assignment.editorId,'beth-vale');
 assert.ok(installOffice(state,{office:'care',requestId:'request-care'},{proof,now:later}).duplicate);assert.equal(state.officeAssignments.length,1);
 assert.equal(installOffice(state,{office:'maintenance',requestId:'request-maintenance'},{proof:{},now:later}).ok,false);
});
test('maintenance exact batch approval, role denial, reasons, amendments, stale revisions and once-only execution',()=>{
 const f=fixture(),changes=[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['Reviewed care']}];
 let r=f.act('maintenance','submit',{changes});const id=r.id;
 assert.throws(()=>f.act('maintenance','approve',{id,version:r.version}),/controller/);
 assert.throws(()=>f.act('maintenance','order',{ids:[id],reason:''},'jo-porter'),/text/);
 f.act('maintenance','order',{ids:[id]},'jo-porter');
 r=f.act('maintenance','approve',{id,version:r.version},'jo-porter');
 assert.throws(()=>f.act('maintenance','execute',{id,version:r.version}),/controller/);
 assert.throws(()=>f.act('maintenance','amend',{id,version:r.version-1,changes}),/stale/);
 r=f.act('maintenance','amend',{id,version:r.version,changes:[{...changes[0],categories:['Other']}]});
 assert.throws(()=>f.act('maintenance','execute',{id,version:r.version},'jo-porter'),/approval/);
 r=f.act('maintenance','approve',{id,version:r.version},'jo-porter');
 r=f.act('maintenance','execute',{id,version:r.version},'jo-porter');assert.deepEqual(f.articles().get('care').categories,['Other']);
 assert.throws(()=>f.act('maintenance','execute',{id,version:r.version},'jo-porter'),/already/);
 assert.equal(r.history.length,5);assert.ok(r.history.every(h=>h.actor&&h.timestamp&&h.reason&&h.references.length));
 const other=fixture();let b=other.act('maintenance','submit',{changes});b=other.act('maintenance','refuse',{id:b.id,version:b.version},'jo-porter');
 b=other.act('maintenance','challenge',{id:b.id,version:b.version});assert.equal(b.status,'refused');
});
test('care nominates authentic comment without endorsement, exclusive hold/release, unrelated text and stale drafts',()=>{
 const f=fixture();let r=f.act('care','nominate',{articleId:'care',revisionId:'revision-one',passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin'}),id=r.id;
 assert.throws(()=>f.act('care','open',{id,version:r.version}),/controller/);
 r=f.act('care','open',{id,version:r.version},'beth-vale');
 assert.deepEqual(heldCases(f.assignments,f.events,f.at,'care',f.articles().get('care').body,'Changed passage. Unrelated sentence. [[knowledge]]'),[id]);
 assert.deepEqual(heldCases(f.assignments,f.events,f.at,'care',f.articles().get('care').body,'Held passage. Different sentence. [[knowledge]]'),[]);
 const draft={...f.events[0],id:'draft-one',revisionId:'draft-one',action:'revise',baseRevisionId:'revision-one',timestamp:f.at,body:'Changed passage. Unrelated sentence. [[knowledge]]',reviewDraft:[id]};f.events.push(draft);
 assert.equal(f.articles().get('care').revisionId,'revision-one');
 r=f.act('care','challenge',{id,version:r.version});assert.equal(r.status,'open');
 assert.throws(()=>f.act('care','release',{id,version:r.version,draftId:'draft-one',baseRevisionId:'revision-one',references:['draft-one']},'alice'),/controller/);
 r=f.act('care','release',{id,version:r.version,draftId:'draft-one',baseRevisionId:'revision-one',references:['draft-one']},'beth-vale');
 assert.equal(f.articles().get('care').body,draft.body);assert.equal(r.status,'closed');assert.ok(f.events.includes(draft));
 const g=fixture();let c=g.act('care','nominate',{articleId:'care',revisionId:'revision-one',passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin'});c=g.act('care','open',{id:c.id,version:c.version},'beth-vale');
 g.events.push({...draft,reviewDraft:[c.id]},{...g.events[0],id:'unrelated',revisionId:'unrelated',timestamp:g.at,action:'revise',body:'Held passage. New sentence. [[knowledge]]'});
 assert.throws(()=>g.act('care','release',{id:c.id,version:c.version,draftId:'draft-one',baseRevisionId:'unrelated',references:['draft-one']},'beth-vale'),/stale draft/);
});
test('procedural docket preserves policy and dissent; malformed sources and rival dispositions fail',()=>{
 const f=fixture(),original=f.events.find(e=>e.id==='policy-one').body;let r=f.act('procedure','file',{policyId:'policy-one',ambiguity:'Which interpretation applies?',interpretation:'Proposed interpretation.'});
 assert.throws(()=>f.act('procedure','dispose',{id:r.id,version:r.version,interpretation:'Rival interpretation.'}),/controller/);
 r=f.act('procedure','dispose',{id:r.id,version:r.version,interpretation:'Operative interpretation.'},'adrian-keene');
 r=f.act('procedure','challenge',{id:r.id,version:r.version});assert.equal(r.status,'operative');assert.equal(r.interpretation,'Operative interpretation.');assert.equal(r.history.at(-1).op,'challenge');
 assert.equal(f.events.find(e=>e.id==='policy-one').body,original);
 assert.throws(()=>f.act('procedure','file',{policyId:'missing',ambiguity:'Question',interpretation:'Answer'}),/cited/);
 f.act('procedure','reassign',{editorId:'alice'});assert.equal(f.project().procedure.assignment.editorId,'adrian-keene');
});
test('admission is unreviewed until registrar action, revision-bound including derived maintenance, rubric exclusive',()=>{
 const f=fixture();let r=f.act('admission','submit',{articleId:'care',revisionId:'revision-one',claim:'Held passage.',criterion:'Accuracy'});assert.equal(r.status,'unreviewed');
 assert.throws(()=>f.act('admission','review',{id:r.id,version:r.version,status:'admitted'}),/controller/);
 assert.throws(()=>f.act('admission','rubric',{criteria:['My criterion']}),/controller/);
 r=f.act('admission','review',{id:r.id,version:r.version,status:'admitted'},'martin-reed');
 r=f.act('admission','challenge',{id:r.id,version:r.version});assert.equal(r.status,'admitted');assert.ok(f.project().admission.records[0].current);
 let b=f.act('maintenance','submit',{changes:[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['Other']}]});b=f.act('maintenance','approve',{id:b.id,version:b.version},'jo-porter');f.act('maintenance','execute',{id:b.id,version:b.version},'jo-porter');
 const historical=f.project().admission.records[0];assert.equal(historical.status,'admitted');assert.equal(historical.current,false);assert.equal(historical.reviews.length,1);
 f.act('admission','rubric',{criteria:['New criterion']},'martin-reed');assert.deepEqual(f.project().admission.rubric,['New criterion']);assert.deepEqual(historical.reviews[0].rubric,['Accuracy']);
});
test('exceptions expire visibly and renewal is sponsor-requested, reviewer-approved, append-only',()=>{
 const f=fixture();let r=f.act('exceptions','propose',{scope:'Fictional category exception',expiresAt:'2026-11-28T00:00:00Z'});assert.equal(r.status,'proposed');
 assert.throws(()=>f.act('exceptions','approve',{id:r.id,version:r.version}),/controller/);
 r=f.act('exceptions','approve',{id:r.id,version:r.version},'simon-firth');f.at='2026-11-29T00:00:00.000Z';assert.equal(f.project().exceptions.records[0].status,'expired');
 // Use an advancing fictional clock, preserving original decision timestamps.
 const raw={office:'exceptions',op:'renew',id:r.id,version:r.version,reason:'Renew proposed.',references:['policy-one'],expiresAt:'2026-12-01T00:00:00Z'};
 const renewed=officeDecision(f.assignments,f.events,raw,'alice',f.at,'renew-later',f.articles(),['policy-one']);
 f.events.push({id:'renew-later',timestamp:f.at,editorId:'alice',action:'policy',body:'Renewal requested.',officeDecision:renewed.decision});r=renewed.decision.record;assert.equal(r.status,'renewal-requested');
 assert.throws(()=>officeDecision(f.assignments,f.events,{...raw,op:'approve',version:r.version},'alice',f.at,'bad',f.articles(),['policy-one']),/controller/);
 const approved=officeDecision(f.assignments,f.events,{...raw,op:'approve',version:r.version},'simon-firth',f.at,'renew-approved',f.articles(),['policy-one']);assert.equal(approved.decision.record.status,'approved');assert.equal(approved.decision.record.history.length,4);
 const g=fixture();let rejected=g.act('exceptions','propose',{scope:'Other exception',expiresAt:'2026-11-28T00:00:00Z'});rejected=g.act('exceptions','reject',{id:rejected.id,version:rejected.version},'simon-firth');assert.equal(rejected.status,'rejected');
});
test('actual one-action engine holds drafts, publishes unrelated edits, conflicts stale bases, exports no private motive',()=>{
 const f=fixture();let r=f.act('care','nominate',{articleId:'care',revisionId:'revision-one',passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin'});r=f.act('care','open',{id:r.id,version:r.version},'beth-vale');
 const state=createState();state.officeAssignments=f.assignments;state.events=f.events;state.foundingComplete=true;state.latestCompletedAt=f.at;
 state.editors=[{id:'alice',name:'Alice',joinedAt:t,interests:['care'],description:'Editor',dispositions:{},temporary:{frustration:0,enthusiasm:.5},memory:[],longTermMemory:[]}];
 const start='2026-11-27T02:00:00.000Z',end='2026-11-27T03:00:00.000Z';
 state.pending={id:'fixture-window',index:120,startAt:start,endAt:end,participants:['alice'],proposals:{},variedReading:true};
 const packet=characterPacket(state,'alice');assert.ok(packet.officeActionSchema);assert.equal(packet.offices.care.records[0].id,r.id);
 const now='2026-11-27T04:00:00.000Z',opts={now,proof:{...proof,checkedAt:now}};
 propose(state,{editorId:'alice',timestamp:'2026-11-27T02:30:00.000Z',action:'revise',articleId:'care',baseRevisionId:'revision-one',body:'Changed passage. Unrelated sentence. [[knowledge]]',summary:'Passage change',principleIds:['accuracy'],journal},opts);
 assert.throws(()=>propose(state,{editorId:'alice',timestamp:'2026-11-27T02:30:00.000Z',action:'abstain',journal},opts),/different proposal/);
 completeCycle(state,opts);assert.equal(state.events.at(-1).reviewDraft[0],r.id);assert.equal(articlesAt(state).get('care').revisionId,'revision-one');
 const data=exportPublic(state,opts);assert.ok(validatePublic(data));assert.equal(snapshot(data).articles.get('care').revisionId,'revision-one');assert.ok(!JSON.stringify(data).includes('strategicContext'));
 const early=snapshot(data,t);assert.equal(early.articles.get('care').body,'Held passage. Unrelated sentence. [[knowledge]]');assert.equal(officeState(data.meta.officeAssignments,data.events,t).care.records.length,0);
});

test('multi-article derived revisions retain article-specific history, provenance, ancestry and normal revert',()=>{
 const f=fixture();const changes=[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['New care']},{kind:'category',articleId:'knowledge',revisionId:'revision-two',categories:['New knowledge']}];
 let r=f.act('maintenance','submit',{changes,references:['revision-one','revision-two']});r=f.act('maintenance','approve',{id:r.id,version:r.version,references:['revision-one','revision-two']},'jo-porter');f.act('maintenance','execute',{id:r.id,version:r.version,references:['revision-one','revision-two']},'jo-porter');
 const execution=f.events.at(-1),projected=visibleRevisions(f.events,f.at).filter(e=>e.sourceEventId===execution.id);assert.equal(projected.length,2);
 assert.deepEqual(projected.map(e=>[e.articleId,e.baseRevisionId,e.revisionId,e.id]),[['care','revision-one',execution.id,execution.id],['knowledge','revision-two',execution.id,execution.id]]);
 assert.equal(f.articles().get('knowledge').id,'knowledge');
 const state=createState();state.officeAssignments=f.assignments;state.events=f.events;state.foundingComplete=true;state.latestCompletedAt=f.at;
 state.editors=[{id:'alice',name:'Alice',joinedAt:t,interests:['care'],description:'Editor',dispositions:{},temporary:{frustration:0,enthusiasm:.5},memory:[],longTermMemory:[]}];
 // Later ordinary edit: the effect remains a valid, observed prior revision for this article.
 state.events.push({...f.events[0],id:'later-ordinary',revisionId:'later-ordinary',baseRevisionId:execution.id,action:'revise',timestamp:'2026-11-27T01:30:00.000Z',body:'Held passage. Later ordinary text. [[knowledge]]',categories:['New care']});
 state.pending={id:'revert-window',index:120,startAt:'2026-11-27T02:00:00.000Z',endAt:'2026-11-27T03:00:00.000Z',participants:['alice'],proposals:{},variedReading:true};
 const packet=characterPacket(state,'alice');assert.ok(packet.knownEventIds.includes(execution.id));assert.equal(packet.officeEvidence.find(e=>e.id===execution.id).articleEffects.length,2);
 const now='2026-11-27T04:00:00.000Z',opts={now,proof:{...proof,checkedAt:now}};
 propose(state,{editorId:'alice',timestamp:'2026-11-27T02:30:00.000Z',action:'revert',articleId:'care',baseRevisionId:'later-ordinary',revertRevisionId:execution.id,summary:'Restore exact derived revision',journal},opts);completeCycle(state,opts);
 assert.equal(articlesAt(state).get('care').body,f.events[0].body);assert.deepEqual(articlesAt(state).get('care').categories,['New care']);assert.deepEqual(articlesAt(state).get('knowledge').categories,['New knowledge']);
 const data=exportPublic(state,opts);assert.equal(snapshot(data).articles.get('knowledge').revisionId,execution.id);assert.ok(validatePublic(data));
});
test('maintenance suspension is reversible and held passage is protected against derived execution',()=>{
 const f=fixture();let batch=f.act('maintenance','submit',{changes:[{kind:'link',articleId:'care',revisionId:'revision-one',find:'[[knowledge]]',replace:'[[knowledge|Knowledge]]'}]});
 f.act('maintenance','suspend',{},'jo-porter');assert.equal(f.project().maintenance.enabled,false);assert.throws(()=>f.act('maintenance','approve',{id:batch.id,version:batch.version},'jo-porter'),/suspended/);
 f.act('maintenance','resume',{},'jo-porter');batch=f.act('maintenance','approve',{id:batch.id,version:batch.version},'jo-porter');assert.equal(batch.status,'approved');
 // Engine-level cross-office enforcement: exact approved batch still cannot override a passage hold.
 let hold=f.act('care','nominate',{articleId:'care',revisionId:'revision-one',passage:'[[knowledge]]',sourceEventId:'cycle-0113-alfie-margin'});hold=f.act('care','open',{id:hold.id,version:hold.version},'beth-vale');
 const state=createState();state.officeAssignments=f.assignments;state.events=f.events;state.foundingComplete=true;state.latestCompletedAt=f.at;
 state.editors=[{id:'jo-porter',name:'Jo',joinedAt:t,interests:['care'],description:'Editor',dispositions:{},temporary:{frustration:0,enthusiasm:.5},memory:[],longTermMemory:[]}];
 state.pending={id:'cross-office',index:120,startAt:'2026-11-27T02:00:00.000Z',endAt:'2026-11-27T03:00:00.000Z',participants:['jo-porter'],proposals:{},variedReading:true};
 const now='2026-11-27T04:00:00.000Z',opts={now,proof:{...proof,checkedAt:now}};
 propose(state,{editorId:'jo-porter',timestamp:'2026-11-27T02:30:00.000Z',action:'policy',title:'Execute batch',body:'Apply approved repair.',summary:'Batch execution',journal,officeAction:{office:'maintenance',op:'execute',id:batch.id,version:batch.version,references:['revision-one'],reason:'Execute approved repair.'}},opts);
 const result=completeCycle(state,opts);assert.equal(result.cycle.outcomes[0].outcome,'conflict');assert.match(result.cycle.outcomes[0].explanation,/held passage/);assert.equal(articlesAt(state).get('care').body,f.events[0].body);
 assert.equal(officeState(state.officeAssignments,state.events,state.latestCompletedAt).maintenance.records[0].status,'approved');
});

test('office attention rotates bounded detail while preserving complete queue IDs and public history',()=>{
 const f=fixture();for(let i=0;i<24;i++)f.act('procedure','file',{policyId:'policy-one',ambiguity:'Question '+i,interpretation:'Interpretation '+i});
 const state=createState();state.officeAssignments=f.assignments;state.events=f.events;state.foundingComplete=true;state.latestCompletedAt=f.at;
 state.editors=[{id:'alice',name:'Alice',joinedAt:t,interests:['authority'],description:'Editor',dispositions:{},temporary:{frustration:0,enthusiasm:.5},memory:[],longTermMemory:[]}];
 const before=JSON.stringify(state.events),observed=new Set();
 for(let i=0;i<12;i++){
   state.pending={id:'attention-'+i,index:122,startAt:'2026-11-27T02:00:00.000Z',endAt:'2026-11-27T03:00:00.000Z',participants:['alice'],proposals:{},variedReading:true};
   const packet=characterPacket(state,'alice'),office=packet.offices.procedure;
   assert.equal(office.recordIndex.length,24);assert.ok(office.records.length<=6);
   assert.ok(office.recordIndex.every(record=>packet.knownEventIds.includes(record.id)));
   for(const record of office.records)observed.add(record.id);
 }
 assert.ok(observed.size>6,'Different turns expose more than the same six records');
 assert.equal(JSON.stringify(state.events),before);assert.equal(f.project().procedure.records.length,24);
});
