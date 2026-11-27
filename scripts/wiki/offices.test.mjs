import test from 'node:test';
import assert from 'node:assert/strict';
import {OFFICE_ROLES,ROUND3_FEATURES,defaultSelection,proceduralRule,MAINTENANCE_INTAKE_REQUEST_ID,mechanicalPlan,CLEARANCE_REQUEST_ID,officeActionSchema,officeState,officeDecision,visibleRevisions,heldCases} from '../../public/wiki-assets/offices.js';
import {articlesAt,installOffice,installOfficeFeature,createState,propose,completeCycle,characterPacket,exportPublic,validatePublic} from './engine.mjs';
import {snapshot} from '../../public/wiki-assets/shared.js';
const t='2026-11-27T00:00:00.000Z',later='2026-11-27T01:00:00.000Z';
const proof={checkedAt:later,result:{ordinaryUsageAllowed:true,rateLimitsByLimitId:{codex:{primary:{usedPercent:2,windowDurationMins:10080}}}}};
const journal='I considered the evidence available in this window before choosing an action. The proposed record should preserve the exact wording and its source so a later reader can challenge the decision. I do not yet know whether this attempt will be published. I will watch the next recorded response before deciding what to do again.';
function fixture(){
 const assignments=Object.entries(OFFICE_ROLES).map(([office,editorId])=>({office,editorId,version:1,requestId:'request-'+office,timestamp:t,installedAt:t,authority:'Owner technical request, no vote',...(office==='admission'?{rubric:['Accuracy']}: {})}));
 const events=[{id:'revision-one',revisionId:'revision-one',timestamp:t,editorId:'alice',action:'create',articleId:'care',title:'Care',body:'Held passage. Unrelated sentence. [[knowledge]]',categories:['Care'],principleIds:['accuracy']},{id:'revision-two',revisionId:'revision-two',timestamp:t,editorId:'alice',action:'create',articleId:'knowledge',title:'Knowledge',body:'Knowledge links [[care]].',categories:['Knowledge'],principleIds:['accuracy']},{id:'cycle-0113-alfie-margin',timestamp:t,editorId:'alfie-margin',action:'comment',articleId:'care',body:'Please examine this passage.'},{id:'policy-one',timestamp:t,editorId:'alice',action:'policy',body:'Adopted text remains unchanged.'}];
 for(const a of assignments)events.push({id:a.requestId,timestamp:t,editorId:a.editorId,action:'policy',body:'Technical request.'});
 let n=0;
 const f={assignments,events,features:[],at:later,project:()=>officeState(assignments,events,f.at,f.features),articles:()=>articlesAt({events},f.at)};
 f.act=(office,op,extra={},actor='alice')=>{
   const id='decision-'+(++n),timestamp=new Date(Date.parse(later)+n*1000).toISOString();f.at=timestamp;
   const raw={office,op,reason:'Public reason.',references:['revision-one','policy-one','cycle-0113-alfie-margin'],...extra};
   const before=JSON.stringify(events);let result;
   try{result=officeDecision(assignments,events,raw,actor,timestamp,id,f.articles(),events.map(e=>e.id),{features:f.features});}catch(e){assert.equal(JSON.stringify(events),before);throw e;}
   const event={id,timestamp,editorId:actor,action:'policy',body:'Office decision.',officeDecision:result.decision,...(result.effects.length?{articleEffects:result.effects}:{}),...(result.consequences?.length?{officeConsequences:result.consequences}:{})};events.push(event);return result.decision.record??result.decision;
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
   assert.equal(packet.publicSiteState.entryView,'admitted claims');assert.equal(packet.publicSiteState.entryClaimCount,0);assert.equal(packet.publicSiteState.completeArticleCount,2);
   assert.equal(office.recordIndex.length,24);assert.ok(office.records.length<=6);
   assert.ok(office.recordIndex.every(record=>packet.knownEventIds.includes(record.id)));
   for(const record of office.records)observed.add(record.id);
 }
 assert.ok(observed.size>6,'Different turns expose more than the same six records');
 assert.equal(JSON.stringify(state.events),before);assert.equal(f.project().procedure.records.length,24);
});

test('ordinary editors can counter an observed older office mandate without hidden technical knowledge',()=>{
 const f=fixture(),state=createState();state.officeAssignments=f.assignments;state.events=f.events;state.foundingComplete=true;state.latestCompletedAt=f.at;
 state.editors=[{id:'alice',name:'Alice',joinedAt:t,interests:['care'],description:'Editor',dispositions:{},temporary:{frustration:0,enthusiasm:.5},memory:[],longTermMemory:[]}];
 state.pending={id:'counter-old-office',index:122,startAt:'2026-11-27T02:00:00.000Z',endAt:'2026-11-27T03:00:00.000Z',participants:['alice'],proposals:{},variedReading:true};
 const packet=characterPacket(state,'alice');assert.ok(!packet.publicTechnicalRequests?.length);assert.ok(packet.knownEventIds.includes('request-care'));
 const now='2026-11-27T04:00:00.000Z',opts={now,proof:{...proof,checkedAt:now}};
 propose(state,{editorId:'alice',timestamp:'2026-11-27T02:30:00.000Z',action:'policy',title:'Counterchange',body:'Make release decisions contestable.',summary:'Challenge an observed mandate',journal,references:['request-care'],backendRequest:{goal:'Contest the observed care hold mandate.',change:'Add a bounded public appeal process.',validation:'An editor can file an appeal without granting themselves release authority.'}},opts);
 completeCycle(state,opts);assert.equal(state.backendChanges.length,1);assert.equal(state.backendChanges[0].editorId,'alice');assert.equal(state.backendChanges[0].status,'queued');
});

test('procedural clearance feature is explicitly request-bound, deferred during pending rounds and historical',()=>{
 const f=fixture();assert.equal(officeActionSchema().procedure.reference,undefined);
 assert.throws(()=>f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Authority?',target:{office:'admission',op:'rubric',criteria:['Test'],reason:'Proposed rubric.',references:['policy-one']}}),/not installed/);
 const state=createState();state.latestCompletedAt=t;state.officeAssignments=f.assignments;state.events=[...f.events,{id:CLEARANCE_REQUEST_ID,action:'policy',editorId:'adrian-keene',timestamp:t,body:'Requested mechanism.'}];state.backendChanges=[{id:CLEARANCE_REQUEST_ID,editorId:'adrian-keene',status:'queued'}];
 const args={feature:'procedural-clearance',requestId:CLEARANCE_REQUEST_ID};
 state.pending={};assert.throws(()=>installOfficeFeature(state,args,{proof,now:later}),/complete checkpoint/);assert.equal(state.officeFeatures,undefined);state.pending=null;
 assert.throws(()=>installOfficeFeature(state,{...args,requestId:'other'},{proof,now:later}),/exact authorized/);
 assert.equal(installOfficeFeature(state,args,{proof:{},now:later}).ok,false);
 assert.ok(installOfficeFeature(state,args,{proof,now:later}).ok);assert.ok(installOfficeFeature(state,args,{proof,now:later}).duplicate);assert.equal(state.officeFeatures.length,1);
 assert.equal(officeActionSchema(state.officeFeatures,'2026-11-26T23:59:59Z').procedure.reference,undefined);assert.ok(officeActionSchema(state.officeFeatures,later).procedure.reference);
 assert.equal(officeState(f.assignments,f.events,'2026-11-26T23:59:59Z',state.officeFeatures).procedure,undefined);
});
function activateClearance(f){f.features=[{feature:'procedural-clearance',version:1,requestId:CLEARANCE_REQUEST_ID,timestamp:t,installedAt:t,authority:'Technical request, no vote.'}];return f;}
function rubricTarget(f,extra={}){return {office:'admission',op:'rubric',rubricVersion:f.project().admission.rubricVersion,criteria:['Revised accuracy'],reason:'Change rubric.',references:['policy-one'],...extra};}
test('exact referenced rubric requires coordinator clearance; payload, array and version changes need fresh reference',()=>{
 const f=activateClearance(fixture()),target=rubricTarget(f);let ref=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Registrar mandate ambiguous.',target});
 assert.equal(ref.status,'held');assert.throws(()=>f.act('admission','rubric',target,'martin-reed'),/held/);
 assert.throws(()=>f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'}),/controller/);
 ref=f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'},'adrian-keene');assert.equal(ref.status,'released');
 assert.throws(()=>f.act('admission','rubric',{...target,criteria:['Different rubric']},'martin-reed'),/fresh procedural/);
 assert.throws(()=>f.act('admission','rubric',{...target,reason:'Different reason'},'martin-reed'),/fresh procedural/);
 // Object key order is insignificant; exact ordered array contents and public payload are preserved.
 f.act('admission','rubric',{references:target.references,reason:target.reason,criteria:target.criteria,rubricVersion:target.rubricVersion},'martin-reed');assert.equal(f.project().admission.rubricVersion,1);
 assert.throws(()=>f.act('admission','rubric',target,'martin-reed'),/stale rubric/);
 const changed=rubricTarget(f,{criteria:['Next criterion']});assert.throws(()=>f.act('admission','rubric',changed,'martin-reed'),/fresh procedural/);
 assert.throws(()=>f.act('procedure','reference',{policyId:'policy-one',ambiguity:'New version.',target:changed}),/priorReferenceId/);
 let next=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'New version.',target:changed,priorReferenceId:ref.id,references:['policy-one',ref.id]});
 next=f.act('procedure','rule',{id:next.id,version:next.version,ruling:'release'},'adrian-keene');f.act('admission','rubric',changed,'martin-reed');assert.equal(f.project().admission.rubricVersion,2);
 assert.throws(()=>f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'},'adrian-keene'),/superseded/);
});
test('returned and policy-required targets stay held; fresh policy and linked reference required, dissent/reassignment remain open',()=>{
 const f=activateClearance(fixture()),target=rubricTarget(f);let ref=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Mandate ambiguity.',target},'adrian-keene');
 ref=f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'return'},'adrian-keene');assert.equal(ref.status,'returned');assert.throws(()=>f.act('admission','rubric',target,'martin-reed'),/held/);
 ref=f.act('procedure','challenge',{id:ref.id,version:ref.version});assert.equal(ref.status,'returned');f.act('procedure','reassign',{editorId:'alice'});
 ref=f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'require-policy'},'adrian-keene');assert.equal(ref.status,'policy-required');assert.throws(()=>f.act('admission','rubric',target,'martin-reed'),/held/);
 assert.throws(()=>f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'},'adrian-keene'),/fresh policy/);
 assert.throws(()=>f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Try again.',target,priorReferenceId:ref.id,references:['policy-one',ref.id]}),/fresh policy/);
 const fresh={id:'fresh-policy',timestamp:f.at,editorId:'alice',action:'policy',body:'Fresh mandate proposal.'};f.events.push(fresh);
 let next=f.act('procedure','reference',{policyId:fresh.id,ambiguity:'Fresh proposal requires ruling.',target,priorReferenceId:ref.id,references:[fresh.id,ref.id]});assert.equal(next.status,'held');
 next=f.act('procedure','rule',{id:next.id,version:next.version,ruling:'release'},'adrian-keene');f.act('admission','rubric',target,'martin-reed');
 assert.equal(f.project().procedure.reassignments.length,1);assert.equal(f.project().procedure.records.find(r=>r.id===ref.id).history.some(h=>h.op==='challenge'),true);
});
test('clearance covers exactly maintenance execution, care release, admission review, exception approval and sponsor renewal',()=>{
 const f=activateClearance(fixture());
 const runTarget=(target,actor)=>{
   let ref=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Authority disputed.',target});
   assert.throws(()=>f.act(target.office,target.op,target,actor),/held/);
   ref=f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'},'adrian-keene');
   return f.act(target.office,target.op,target,actor);
 };
 let batch=f.act('maintenance','submit',{changes:[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['Care review']}]});
 batch=f.act('maintenance','approve',{id:batch.id,version:batch.version},'jo-porter');runTarget({office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute exact approved batch.',references:['revision-one']},'jo-porter');
 const live=f.articles().get('care');let hold=f.act('care','nominate',{articleId:'care',revisionId:live.revisionId,passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin',references:[live.revisionId,'cycle-0113-alfie-margin']});hold=f.act('care','open',{id:hold.id,version:hold.version},'beth-vale');
 f.events.push({...f.events[0],id:'held-draft',revisionId:'held-draft',timestamp:f.at,action:'revise',baseRevisionId:live.revisionId,body:'Released care passage. [[knowledge]]',reviewDraft:[hold.id]});
 runTarget({office:'care',op:'release',id:hold.id,version:hold.version,draftId:'held-draft',baseRevisionId:live.revisionId,reason:'Release this draft.',references:['held-draft']},'beth-vale');
 const current=f.articles().get('care');let claim=f.act('admission','submit',{articleId:'care',revisionId:current.revisionId,claim:'Released care passage.',criterion:'Accuracy',references:[current.revisionId]});
 runTarget({office:'admission',op:'review',id:claim.id,version:claim.version,status:'admitted',reason:'Admit exact claim.',references:[current.revisionId]},'martin-reed');
 let exception=f.act('exceptions','propose',{scope:'Category exception',expiresAt:'2026-11-28T00:00:00Z'});
 exception=runTarget({office:'exceptions',op:'approve',id:exception.id,version:exception.version,reason:'Approve exception.',references:['policy-one']},'simon-firth');
 exception=runTarget({office:'exceptions',op:'renew',id:exception.id,version:exception.version,expiresAt:'2026-11-29T00:00:00Z',reason:'Request renewal.',references:['policy-one']},'alice');assert.equal(exception.status,'renewal-requested');
 // Different operation on same record remains untouched; ordinary role and status checks still apply.
 exception=f.act('exceptions','reject',{id:exception.id,version:exception.version},'simon-firth');assert.equal(exception.status,'rejected');
 assert.throws(()=>f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Unsupported target.',target:{office:'maintenance',op:'submit',reason:'No.',references:['policy-one']}}),/unsupported clearance target/);
});
test('target version staleness blocks rulings and execution until a fresh reference; ordinary edits remain available',()=>{
 const f=activateClearance(fixture());let batch=f.act('maintenance','submit',{changes:[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['Care review']}]});batch=f.act('maintenance','approve',{id:batch.id,version:batch.version},'jo-porter');
 const target={office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute.',references:['revision-one']};const ref=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Mandate?',target});
 batch=f.act('maintenance','challenge',{id:batch.id,version:batch.version});assert.equal(batch.status,'approved');
 assert.throws(()=>f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'},'adrian-keene'),/stale office record/);
 assert.throws(()=>f.act('maintenance','execute',{...target,version:batch.version},'jo-porter'),/fresh procedural/);
 const state=createState();state.officeAssignments=f.assignments;state.officeFeatures=f.features;state.events=f.events;state.foundingComplete=true;state.latestCompletedAt=f.at;
 state.editors=[{id:'alice',name:'Alice',joinedAt:t,interests:['care'],description:'Editor',dispositions:{},temporary:{frustration:0,enthusiasm:.5},memory:[],longTermMemory:[]}];
 state.pending={id:'ordinary-under-reference',index:120,startAt:'2026-11-27T02:00:00.000Z',endAt:'2026-11-27T03:00:00.000Z',participants:['alice'],proposals:{},variedReading:true};
 const packet=characterPacket(state,'alice');assert.ok(packet.officeActionSchema.procedure.reference);assert.equal(packet.offices.procedure.records[0].target.version,target.version);
 const now='2026-11-27T04:00:00.000Z',opts={now,proof:{...proof,checkedAt:now}};
 propose(state,{editorId:'alice',timestamp:'2026-11-27T02:30:00.000Z',action:'revise',articleId:'care',baseRevisionId:'revision-one',body:'Held passage. Ordinary new sentence. [[knowledge]]',summary:'Ordinary edit',principleIds:['accuracy'],journal},opts);const result=completeCycle(state,opts);assert.equal(result.cycle.outcomes[0].outcome,'accepted');assert.match(articlesAt(state).get('care').body,/Ordinary new sentence/);
 const data=exportPublic(state,opts);assert.equal(data.meta.officeFeatures[0].feature,'procedural-clearance');assert.ok(validatePublic(data));assert.ok(!JSON.stringify(data).includes('strategicContext'));
});

function engineIntakeFixture({clearance=false}={}){
 const f=fixture(),state=createState();state.officeAssignments=f.assignments;state.officeFeatures=[{feature:'mandatory-maintenance-intake',version:1,requestId:MAINTENANCE_INTAKE_REQUEST_ID,timestamp:t,installedAt:t,authority:'Technical request, no vote.'},...(clearance?[{feature:'procedural-clearance',version:1,requestId:CLEARANCE_REQUEST_ID,timestamp:t,installedAt:t,authority:'Technical request, no vote.'}]:[])];state.events=f.events;state.foundingComplete=true;state.latestCompletedAt='2026-11-27T02:00:00.000Z';
 state.editors=['alice',...Object.values(OFFICE_ROLES)].map(id=>({id,name:id,joinedAt:t,interests:['care'],description:'Editor',dispositions:{},temporary:{frustration:0,enthusiasm:.5},memory:[],longTermMemory:[{text:'Observed policy and care discussion.',references:['policy-one','cycle-0113-alfie-margin'],timestamp:t}]}));
 let n=0;
 const turn=(actor,fields)=>{
   const start=state.latestCompletedAt,end=new Date(Date.parse(start)+3600000).toISOString(),now=new Date(Date.parse(end)+1).toISOString();
   state.pending={id:'intake-window-'+(++n),index:120+n,startAt:start,endAt:end,participants:[actor],proposals:{},variedReading:true};
   const opts={now,proof:{...proof,checkedAt:now}};
   const proposal={editorId:actor,timestamp:new Date(Date.parse(start)+60000).toISOString(),summary:'Fixture action',journal,principleIds:['accuracy'],...fields};
   propose(state,proposal,opts);const result=completeCycle(state,opts);return {result,event:state.events.find(e=>e.id===state.cycles.at(-1).id+'-'+actor),opts};
 };
 return {f,state,turn,project:()=>officeState(state.officeAssignments,state.events,state.latestCompletedAt,state.officeFeatures)};
}
test('mandatory intake activation is separate and idempotent; category, title/move and link-only direct routes do not publish live',()=>{
 const initial=engineIntakeFixture(),s=initial.state;s.officeFeatures=[];s.backendChanges=[{id:MAINTENANCE_INTAKE_REQUEST_ID,editorId:'jo-porter',status:'queued'}];s.events.push({id:MAINTENANCE_INTAKE_REQUEST_ID,editorId:'jo-porter',action:'policy',timestamp:t,body:'Mandatory intake request.'});
 const opts={proof,now:later},args={feature:'mandatory-maintenance-intake',requestId:MAINTENANCE_INTAKE_REQUEST_ID};assert.ok(installOfficeFeature(s,args,opts).ok);assert.ok(installOfficeFeature(s,args,opts).duplicate);assert.equal(s.officeFeatures.length,1);
 for(const change of [{categories:['Replacement']},{title:'Care renamed',toArticleId:'care-renamed'},{body:'Held passage. Unrelated sentence. [[knowledge|Knowledge]]'}]){
   const {state,turn,project}=engineIntakeFixture(),before=articlesAt(state).get('care');const {event}=turn('alice',{action:'organize',articleId:'care',baseRevisionId:before.revisionId,body:before.body,...change});
   assert.equal(event.maintenanceDraft,true);assert.equal(event.maintenanceIntake.decision.record.status,'proposed');const current=articlesAt(state).get('care');assert.equal(current.revisionId,'revision-one');assert.equal(current.title,'Care');assert.deepEqual(current.categories,['Care']);assert.equal(current.body,before.body);
   assert.equal(project().maintenance.records.length,1);assert.equal(project().maintenance.records[0].proposer,'alice');assert.equal(snapshot(exportPublic(state,{...opts,proof:{...proof,checkedAt:later}})).articles.get('care').revisionId,'revision-one');
 }
});
test('intake batches require exact coordinator approval, reject amended approval, execute once and retain move old URLs',()=>{
 const {state,turn,project}=engineIntakeFixture(),before=articlesAt(state).get('care');
 const {event}=turn('alice',{action:'organize',articleId:'care',baseRevisionId:before.revisionId,body:before.body,title:'Renamed care',toArticleId:'renamed-care',categories:['Reorganized']});let batch=project().maintenance.records[0];
 assert.throws(()=>turn('alice',{action:'policy',title:'Unauthorized approval',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Try approval.',references:[before.revisionId]}}),/controller/);state.pending=null;
 turn('jo-porter',{action:'policy',title:'Approve batch',body:'Approve exact batch.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve exact batch.',references:[before.revisionId]}});batch=project().maintenance.records[0];
 const changes=batch.changes.map(c=>({...c,categories:['Amended category']}));turn('alice',{action:'policy',title:'Amend batch',body:'Amend category.',officeAction:{office:'maintenance',op:'amend',id:batch.id,version:batch.version,changes,reason:'Amend exact batch.',references:[before.revisionId]}});batch=project().maintenance.records[0];
 assert.throws(()=>turn('jo-porter',{action:'policy',title:'Execute',body:'Execute.',officeAction:{office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute.',references:[before.revisionId]}}),/approval/);state.pending=null;
 turn('jo-porter',{action:'policy',title:'Fresh approval',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve amended batch.',references:[before.revisionId]}});batch=project().maintenance.records[0];
 const execution=turn('jo-porter',{action:'policy',title:'Execute once',body:'Execute.',officeAction:{office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute approved version.',references:[before.revisionId]}});batch=project().maintenance.records[0];
 assert.equal(batch.status,'executed');const live=articlesAt(state).get('care');assert.equal(live.id,'care');assert.equal(live.title,'Renamed care');assert.deepEqual(live.categories,['Amended category']);assert.ok(visibleRevisions(state.events,state.latestCompletedAt).some(e=>e.alias==='renamed-care'&&e.articleId==='care'));
 assert.ok(state.events.includes(event));assert.equal(execution.event.maintenanceIntake,undefined);assert.throws(()=>turn('jo-porter',{action:'policy',title:'Repeat',body:'Repeat.',officeAction:{office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Repeat.',references:[before.revisionId]}}),/already executed/);
});
test('mixed independent prose and mechanical changes split exactly; ambiguous mix returns visible original and reason',()=>{
 const {state,turn,project}=engineIntakeFixture(),before=articlesAt(state).get('care');
 // A category replacement is independent from substantive writing, even on the same paragraph.
 const body='Held passage. A new substantive explanation. [[knowledge]]';const first=turn('alice',{action:'revise',articleId:'care',baseRevisionId:before.revisionId,body,categories:['Pending category']});let live=articlesAt(state).get('care');assert.equal(live.body,body);assert.deepEqual(live.categories,['Care']);let batch=project().maintenance.records[0];assert.equal(batch.changes[0].revisionId,first.event.id);assert.equal(first.event.maintenanceIntake.submitted.body,body);
 // Link-only changes on a stable separate line can be safely extracted from changed prose.
 const old={...live,body:'Paragraph with [[knowledge]].\n\nAn old explanation.'},proposed={...old,body:'Paragraph with [[knowledge|Knowledge]].\n\nA new explanation.'};const plan=mechanicalPlan(old,proposed);assert.equal(plan.ambiguous,false);assert.equal(plan.proseBody,'Paragraph with [[knowledge]].\n\nA new explanation.');
 // The same prose passage changes both explanation and link identity: preserve whole authored proposal as returned.
 const ambiguousBody='Held passage. A different explanation. [[knowledge|Knowledge]]';const returned=turn('alice',{action:'revise',articleId:'care',baseRevisionId:live.revisionId,body:ambiguousBody,categories:['Another category']});
 assert.equal(returned.event.maintenanceDraft,true);assert.equal(returned.event.maintenanceIntake.decision.record.status,'returned');assert.match(returned.event.maintenanceIntake.explanation,/Returned/);assert.equal(returned.event.maintenanceIntake.submitted.body,ambiguousBody);assert.equal(articlesAt(state).get('care').body,body);
 batch=project().maintenance.records.find(r=>r.id===returned.event.id);assert.equal(batch.changes.length,0);assert.throws(()=>turn('jo-porter',{action:'policy',title:'Approve returned',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve.',references:[live.revisionId]}}),/requires amendment/);
});
test('substantive prose and new connected articles remain ordinary; cleared execution still respects care holds',()=>{
 const {state,turn,project}=engineIntakeFixture({clearance:true}),before=articlesAt(state).get('care');
 turn('alice',{action:'revise',articleId:'care',baseRevisionId:before.revisionId,body:'Held passage. Substantive expansion. [[knowledge]]'});assert.equal(project().maintenance.records.length,0);
 turn('alice',{action:'create',articleId:'care-example',title:'Care example',body:'A new care subject connected to [[care]].',categories:['Care']});assert.ok(articlesAt(state).has('care-example'));assert.equal(project().maintenance.records.length,0);
 let live=articlesAt(state).get('care');turn('alice',{action:'organize',articleId:'care',baseRevisionId:live.revisionId,body:live.body.replace('[[knowledge]]','[[knowledge|Knowledge]]')});let batch=project().maintenance.records[0];
 turn('jo-porter',{action:'policy',title:'Approve repair',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve repair.',references:[live.revisionId]}});batch=project().maintenance.records[0];
 const target={office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute exact repair.',references:[live.revisionId]};turn('alice',{action:'policy',title:'Reference execution',body:'Authority ambiguity.',officeAction:{office:'procedure',op:'reference',policyId:'policy-one',ambiguity:'Exact mandate unclear.',target,reason:'Refer operation.',references:['policy-one']}});let ref=project().procedure.records[0];
 assert.throws(()=>turn('jo-porter',{action:'policy',title:'Held execution',body:'Try.',officeAction:target}),/held/);state.pending=null;
 turn('adrian-keene',{action:'policy',title:'Clear exact execution',body:'Clear.',officeAction:{office:'procedure',op:'rule',id:ref.id,version:ref.version,ruling:'release',reason:'Release exact operation.',references:['policy-one']}});
 turn('alice',{action:'policy',title:'Nominate care passage',body:'Review link.',officeAction:{office:'care',op:'nominate',articleId:'care',revisionId:live.revisionId,passage:'[[knowledge]]',sourceEventId:'cycle-0113-alfie-margin',reason:'Review held passage.',references:[live.revisionId,'cycle-0113-alfie-margin']}});let hold=project().care.records[0];
 turn('beth-vale',{action:'policy',title:'Open care hold',body:'Open.',officeAction:{office:'care',op:'open',id:hold.id,version:hold.version,reason:'Hold passage.',references:['cycle-0113-alfie-margin']}});
 const tried=turn('jo-porter',{action:'policy',title:'Execute cleared repair',body:'Execute.',officeAction:target});assert.equal(tried.result.cycle.outcomes[0].outcome,'conflict');assert.match(tried.result.cycle.outcomes[0].explanation,/held passage/);assert.equal(project().maintenance.records[0].status,'approved');
});

test('care-release technical effects enter mandatory intake rather than bypassing coordinator approval',()=>{
 const {state,turn,project}=engineIntakeFixture();const initial=articlesAt(state).get('care');
 turn('alice',{action:'policy',title:'Nominate held link',body:'Review.',officeAction:{office:'care',op:'nominate',articleId:'care',revisionId:initial.revisionId,passage:'[[knowledge]]',sourceEventId:'cycle-0113-alfie-margin',reason:'Review navigation passage.',references:[initial.revisionId,'cycle-0113-alfie-margin']}});let hold=project().care.records[0];
 turn('beth-vale',{action:'policy',title:'Open hold',body:'Open.',officeAction:{office:'care',op:'open',id:hold.id,version:hold.version,reason:'Open passage hold.',references:['cycle-0113-alfie-margin']}});hold=project().care.records[0];
 // Authentic fixture represents a pre-activation draft already present in public history.
 const draft={...state.events.find(e=>e.id==='revision-one'),id:'historical-held-mechanical-draft',revisionId:'historical-held-mechanical-draft',timestamp:state.latestCompletedAt,action:'revise',baseRevisionId:initial.revisionId,body:initial.body.replace('[[knowledge]]','[[knowledge|Knowledge]]'),categories:['Draft category'],reviewDraft:[hold.id]};state.events.push(draft);
 const released=turn('beth-vale',{action:'policy',title:'Release original draft',body:'Release exact draft.',officeAction:{office:'care',op:'release',id:hold.id,version:hold.version,draftId:draft.id,baseRevisionId:initial.revisionId,reason:'Release reviewed draft.',references:[draft.id]}});
 assert.equal(released.event.articleEffects,undefined);assert.equal(articlesAt(state).get('care').body,initial.body);assert.deepEqual(articlesAt(state).get('care').categories,['Care']);assert.match(project().care.records[0].releasePublication,/pending; live article unchanged/);
 let batch=project().maintenance.records[0];assert.equal(batch.proposer,'beth-vale');assert.equal(batch.id,released.event.id);assert.equal(batch.changes[0].revisionId,initial.revisionId);
 turn('jo-porter',{action:'policy',title:'Approve released maintenance',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve exact released mechanical changes.',references:[initial.revisionId]}});batch=project().maintenance.records[0];
 turn('jo-porter',{action:'policy',title:'Execute released maintenance',body:'Execute.',officeAction:{office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute approved release mechanics.',references:[initial.revisionId]}});
 assert.equal(articlesAt(state).get('care').body,draft.body);assert.deepEqual(articlesAt(state).get('care').categories,['Draft category']);assert.ok(state.events.includes(draft));
});
test('mechanical classification handles duplicate links safely and queues pure wrapping without restricting prose casing',()=>{
 const before={id:'care',revisionId:'r',title:'Care',categories:['Care'],body:'A [[knowledge]].\nOld prose [[knowledge]].'};
 const ambiguous=mechanicalPlan(before,{...before,body:'A [[care]].\nChanged prose [[care]].'});assert.equal(ambiguous.ambiguous,true);
 const wrap=mechanicalPlan({...before,body:'Knowledge connects [[care]].'},{...before,body:'[[knowledge|Knowledge]] connects [[care]].'});assert.equal(wrap.mechanical,true);assert.equal(wrap.proseChanged,false);
 const caseOnly=mechanicalPlan({...before,body:'A paragraph connects [[care]].'},{...before,body:'A Paragraph connects [[care]].'});assert.equal(caseOnly.mechanical,false);assert.equal(caseOnly.proseChanged,true);
});

test('mixed prose held by care is not claimed published; mechanical base stays unresolved through release until explicit amendment',()=>{
 const {state,turn,project}=engineIntakeFixture();let live=articlesAt(state).get('care');
 turn('alice',{action:'policy',title:'Nominate passage',body:'Review.',officeAction:{office:'care',op:'nominate',articleId:'care',revisionId:live.revisionId,passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin',reason:'Review passage.',references:[live.revisionId,'cycle-0113-alfie-margin']}});let hold=project().care.records[0];
 turn('beth-vale',{action:'policy',title:'Open hold',body:'Open.',officeAction:{office:'care',op:'open',id:hold.id,version:hold.version,reason:'Open hold.',references:['cycle-0113-alfie-margin']}});hold=project().care.records[0];
 const changed='Changed held passage. Unrelated sentence. [[knowledge]]';const draft=turn('alice',{action:'revise',articleId:'care',baseRevisionId:live.revisionId,body:changed,categories:['Pending category']});
 assert.equal(draft.event.reviewDraft[0],hold.id);assert.equal(draft.event.maintenanceIntake.prosePublished,false);assert.equal(draft.event.maintenanceIntake.proseHeld,true);assert.equal(draft.event.maintenanceIntake.requiresResolution,true);assert.match(draft.event.maintenanceIntake.explanation,/unpublished prose/);assert.equal(articlesAt(state).get('care').body,live.body);
 let batch=project().maintenance.records[0];assert.equal(batch.status,'awaiting-prose-resolution');assert.equal(batch.changes[0].revisionId,draft.event.id);
 assert.throws(()=>turn('jo-porter',{action:'policy',title:'Premature approval',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve.',references:[draft.event.id]}}),/stale article/);state.pending=null;
 turn('beth-vale',{action:'policy',title:'Release held prose',body:'Release.',officeAction:{office:'care',op:'release',id:hold.id,version:hold.version,draftId:draft.event.id,baseRevisionId:live.revisionId,reason:'Release reviewed prose.',references:[draft.event.id]}});live=articlesAt(state).get('care');assert.equal(live.body,changed);assert.deepEqual(live.categories,['Care']);
 assert.throws(()=>turn('jo-porter',{action:'policy',title:'Still stale approval',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve.',references:[draft.event.id]}}),/stale article/);state.pending=null;
 const changes=batch.changes.map(c=>({...c,revisionId:live.revisionId}));turn('alice',{action:'policy',title:'Rebase held mechanics',body:'Rebase category proposal.',officeAction:{office:'maintenance',op:'amend',id:batch.id,version:batch.version,changes,reason:'Explicitly rebase onto released prose.',references:[live.revisionId]}});batch=project().maintenance.records[0];assert.equal(batch.status,'proposed');assert.equal(batch.requiresResolution,undefined);
 turn('jo-porter',{action:'policy',title:'Approve rebased mechanics',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve rebased exact version.',references:[live.revisionId]}});batch=project().maintenance.records[0];turn('jo-porter',{action:'policy',title:'Execute rebased mechanics',body:'Execute.',officeAction:{office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute rebased approved category.',references:[live.revisionId]}});assert.deepEqual(articlesAt(state).get('care').categories,['Pending category']);
});

test('mixed wrapping cannot evade intake through a prose change; newly added linked prose remains ordinary',()=>{
 const before={id:'care',revisionId:'r',title:'Care',categories:['Care'],body:'Knowledge matters. [[care]]'};
 const mixed=mechanicalPlan(before,{...before,body:'[[knowledge|Knowledge]] really matters. [[care]]'});assert.equal(mixed.ambiguous,true);
 const separate=mechanicalPlan({...before,body:'Knowledge matters.\n\nOther prose [[care]].'},{...before,body:'[[knowledge|Knowledge]] matters.\n\nRevised prose [[care]].'});assert.equal(separate.ambiguous,false);assert.equal(separate.proseBody,'Knowledge matters.\n\nRevised prose [[care]].');assert.equal(separate.mechanical,true);
 const newProse=mechanicalPlan(before,{...before,body:before.body+'\n\nNew prose about [[knowledge|Knowledge]].'});assert.equal(newProse.mechanical,false);assert.equal(newProse.proseChanged,true);
});

test('mechanical technical payloads cannot introduce executable markup or substantive replacement',()=>{
 const f=fixture();const body=f.articles().get('care').body,start=body.indexOf('[[knowledge]]');
 assert.throws(()=>f.act('maintenance','submit',{changes:[{kind:'mechanical',articleId:'care',revisionId:'revision-one',patches:[{start,before:'[[knowledge]]',after:'[[knowledge|<script>]]'}]}]}),/prohibited markup/);
 assert.throws(()=>f.act('maintenance','submit',{changes:[{kind:'mechanical',articleId:'care',revisionId:'revision-one',patches:[{start:0,before:'Held passage.',after:'Unrelated rewritten prose.'}]}]}),/substantive prose/);
 const inactive=engineIntakeFixture();inactive.state.officeFeatures=[];inactive.turn('alice',{action:'organize',articleId:'care',baseRevisionId:'revision-one',body, categories:['Normal preactivation category']});assert.deepEqual(articlesAt(inactive.state).get('care').categories,['Normal preactivation category']);assert.equal(inactive.project().maintenance.records.length,0);
});

function enableFeature(f,name,order='2026-11-26T20:53:00.000Z'){
 const definition=ROUND3_FEATURES[name];f.features.push({feature:name,version:1,requestId:definition.id,timestamp:t,installedAt:t,requestTimestamp:order,authority:'Owner technical request; no vote.'});return f;
}
function prepareAutomaticTarget(kind){
 const f=fixture();let r,target,actor;
 if(kind==='execute'){r=f.act('maintenance','submit',{changes:[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['New care']}]});r=f.act('maintenance','approve',{id:r.id,version:r.version},'jo-porter');target={office:'maintenance',op:'execute',id:r.id,version:r.version,reason:'Execute exact batch.',references:['revision-one']};actor='jo-porter';}
 if(kind==='open'||kind==='release'){r=f.act('care','nominate',{articleId:'care',revisionId:'revision-one',passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin'});if(kind==='release'){r=f.act('care','open',{id:r.id,version:r.version},'beth-vale');f.events.push({...f.events[0],id:'auto-draft',revisionId:'auto-draft',timestamp:f.at,action:'revise',baseRevisionId:'revision-one',body:'Released passage. [[knowledge]]',reviewDraft:[r.id]});}target={office:'care',op:kind,id:r.id,version:r.version,reason:'Exact care action.',references:kind==='release'?['auto-draft']:['revision-one'],...(kind==='release'?{draftId:'auto-draft',baseRevisionId:'revision-one'}:{})};actor='beth-vale';}
 if(kind==='review'){r=f.act('admission','submit',{articleId:'care',revisionId:'revision-one',claim:'Held passage.',criterion:'Accuracy'});target={office:'admission',op:'review',id:r.id,version:r.version,status:'admitted',reason:'Exact review.',references:['revision-one']};actor='martin-reed';}
 if(kind==='rubric'){target={office:'admission',op:'rubric',rubricVersion:0,criteria:['New criterion'],reason:'Exact rubric.',references:['policy-one']};actor='martin-reed';}
 if(kind==='approve'){r=f.act('exceptions','propose',{scope:'Fictional exception',expiresAt:'2026-11-28T00:00:00Z'});target={office:'exceptions',op:'approve',id:r.id,version:r.version,reason:'Exact exception approval.',references:['policy-one']};actor='simon-firth';}
 return {f,target,actor};
}
test('automatic intake holds all six named operations, rejects unauthorized work, reuses retries and consumes exact release once',()=>{
 for(const kind of ['execute','open','release','review','rubric','approve']){
  const {f,target,actor}=prepareAutomaticTarget(kind);enableFeature(f,'automatic-procedural-intake');
  assert.throws(()=>f.act(target.office,target.op,target,'alice'),/controller/);assert.equal(f.project().procedure.records.length,0);
  const ref=f.act(target.office,target.op,target,actor);assert.equal(ref.status,'held');assert.equal(ref.automatic,true);assert.deepEqual(ref.target,target);assert.equal(f.events.at(-1).articleEffects,undefined);
  const retry=f.act(target.office,target.op,target,actor);assert.equal(retry.referenceId,ref.id);assert.equal(f.project().procedure.records.length,1);
  assert.throws(()=>f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'}),/controller/);
  const released=f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'},'adrian-keene');assert.equal(released.status,'released');
  f.act(target.office,target.op,target,actor);const consumed=f.project().procedure.records.find(r=>r.id===ref.id);assert.equal(consumed.status,'consumed');assert.equal(consumed.version,released.version+1);
  if(kind==='execute')assert.deepEqual(f.articles().get('care').categories,['New care']);
  if(kind==='open')assert.equal(f.project().care.records[0].status,'open');
  if(kind==='release')assert.equal(f.articles().get('care').body,'Released passage. [[knowledge]]');
  if(kind==='review')assert.equal(f.project().admission.records[0].status,'admitted');
  if(kind==='rubric')assert.deepEqual(f.project().admission.rubric,['New criterion']);
  if(kind==='approve')assert.equal(f.project().exceptions.records[0].status,'approved');
  assert.throws(()=>f.act(target.office,target.op,target,actor),/stale|already|not nominated|not open/);
 }
});
test('automatic changed payload creates fresh intake; returned and policy-required references remain non-executable',()=>{
 const {f,target,actor}=prepareAutomaticTarget('rubric');enableFeature(f,'automatic-procedural-intake');let ref=f.act(target.office,target.op,target,actor);
 ref=f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'return'},'adrian-keene');f.act(target.office,target.op,target,actor);assert.deepEqual(f.project().admission.rubric,['Accuracy']);
 ref=f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'require-policy'},'adrian-keene');
 const changed={...target,criteria:['Changed criterion']};const next=f.act(changed.office,changed.op,changed,actor);assert.equal(next.status,'policy-required');assert.equal(next.priorReferenceId,ref.id);assert.equal(f.project().procedure.records.length,2);assert.deepEqual(f.project().admission.rubric,['Accuracy']);
});
function premiseFixture(){
 const f=activateClearance(fixture()),target=rubricTarget(f);let ref=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Which mandate?',target});enableFeature(f,'procedural-premise-admission');
 const release={office:'procedure',op:'rule',id:ref.id,version:ref.version,ruling:'release',mandateId:'policy-one',mandatePassage:'Adopted text remains unchanged.',rationale:'This exact mandate governs the frozen rubric operation.',reason:'Release on this premise.',references:['policy-one']};
 return {f,target,ref,release};
}
test('premise review and release counters preserve their approved binding; valid preexisting admission enables one real automatic execution',()=>{
 const {f,target,ref,release}=premiseFixture();let premise=f.act('procedure','rule',release,'adrian-keene');assert.equal(premise.status,'unreviewed');assert.equal(f.project().procedure.records[0].status,'held');
 assert.throws(()=>f.act('admission','review',{id:premise.id,version:premise.version,status:'admitted'},'adrian-keene'),/controller/);
 for(const status of ['limited','unsupported','admitted']){
  premise=f.act('admission','review',{id:premise.id,version:premise.version,status},'martin-reed');assert.equal(premise.premiseVersion,1);assert.equal(f.project().admission.records[0].current,true);
  if(status!=='admitted'){const retry=f.act('procedure','rule',release,'adrian-keene');assert.equal(retry.premiseId,premise.id);assert.equal(f.project().procedure.records[0].status,'held');}
 }
 // Author-valid premise admission predates automatic intake activation; no seeded approval or bypass.
 enableFeature(f,'automatic-procedural-intake');const released=f.act('procedure','rule',release,'adrian-keene');assert.equal(released.version,ref.version+1);assert.equal(released.releasePremiseId,premise.id);assert.equal(f.project().admission.records[0].current,true);
 f.act(target.office,target.op,target,'martin-reed');assert.deepEqual(f.project().admission.rubric,['Revised accuracy']);assert.equal(f.project().procedure.records[0].status,'consumed');assert.equal(f.project().admission.records[0].current,true);
 assert.throws(()=>f.act(target.office,target.op,target,'martin-reed'),/stale rubric/);
 const consumed=f.project().procedure.records[0];f.act('procedure','challenge',{id:consumed.id,version:consumed.version});assert.equal(f.project().admission.records[0].current,false);
});
test('changed rationale, mandate, reference version or frozen target never borrows an earlier admitted premise',()=>{
 for(const change of ['rationale','passage','mandate','reference','target']){
  const {f,target,release}=premiseFixture();let premise=f.act('procedure','rule',release,'adrian-keene');premise=f.act('admission','review',{id:premise.id,version:premise.version,status:'admitted'},'martin-reed');let next={...release};
  if(change==='rationale')next.rationale='A different rationale.';
  if(change==='passage')next.mandatePassage='Adopted text';
  if(change==='mandate'){f.events.push({id:'new-mandate',timestamp:t,editorId:'alice',action:'policy',body:'Another governing mandate.'});next.mandateId='new-mandate';next.mandatePassage='Another governing mandate.';next.references=['new-mandate'];}
  if(change==='reference'){const r=f.project().procedure.records[0];const updated=f.act('procedure','challenge',{id:r.id,version:r.version});next.version=updated.version;assert.equal(f.project().admission.records[0].current,false);}
  if(change==='target'){const r=f.project().procedure.records[0];const fresh=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Changed frozen operation.',target:{...target,criteria:['Other criterion']},priorReferenceId:r.id,references:['policy-one',r.id]});next.id=fresh.id;next.version=fresh.version;assert.equal(f.project().admission.records[0].current,false);}
  const blocked=f.act('procedure','rule',next,'adrian-keene');assert.equal(blocked.status,'unreviewed');assert.notEqual(blocked.id,premise.id);assert.ok(!f.project().procedure.records.some(r=>r.status==='released'));
 }
});
test('combined automatic review and premise release exposes the authored circular dependency without invented clearance',()=>{
 const {f,target,actor}=prepareAutomaticTarget('rubric');enableFeature(f,'automatic-procedural-intake');enableFeature(f,'procedural-premise-admission');
 const ref=f.act(target.office,target.op,target,actor),release={office:'procedure',op:'rule',id:ref.id,version:ref.version,ruling:'release',mandateId:'policy-one',mandatePassage:'Adopted text remains unchanged.',rationale:'Mandate for frozen operation.',reason:'Proposed release.',references:['policy-one']};
 const premise=f.act('procedure','rule',release,'adrian-keene');const reviewRef=f.act('admission','review',{id:premise.id,version:premise.version,status:'admitted'},'martin-reed');assert.equal(reviewRef.status,'held');assert.equal(f.project().admission.records[0].status,'unreviewed');
 const second=f.act('procedure','rule',{...release,id:reviewRef.id,version:reviewRef.version},'adrian-keene');assert.equal(second.status,'unreviewed');assert.equal(f.project().admission.records.length,2);assert.equal(f.project().procedure.records.filter(r=>r.status==='held').length,2);assert.deepEqual(f.project().admission.rubric,['Accuracy']);
 const challenged=f.act('procedure','challenge',{id:ref.id,version:ref.version});assert.equal(challenged.status,'held');f.act('procedure','reassign',{editorId:'alice'});assert.equal(f.project().procedure.reassignments.length,1);
});

test('typed navigation exception defaults to complete index, enforces registrar/reviewer roles and bounded fresh periods',()=>{
 const f=fixture();enableFeature(f,'admitted-default-exception');assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'articles');
 assert.throws(()=>f.act('exceptions','propose',{type:'admitted-default',scope:'Navigation',expiresAt:'2026-11-28T00:00:00Z'}),/registrar/);
 let generic=f.act('exceptions','propose',{scope:'admitted-default',expiresAt:'2026-11-28T00:00:00Z'});generic=f.act('exceptions','approve',{id:generic.id,version:generic.version},'simon-firth');assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'articles');
 let r=f.act('exceptions','propose',{type:'admitted-default',scope:'Default admitted claims',expiresAt:'2026-11-28T00:00:00Z'},'martin-reed');assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'articles');
 assert.throws(()=>f.act('exceptions','approve',{id:r.id,version:r.version},'martin-reed'),/controller/);
 r=f.act('exceptions','approve',{id:r.id,version:r.version},'simon-firth');let entry=defaultSelection(f.project(),f.features,f.at);assert.equal(entry.entryView,'admitted');assert.equal(entry.exception.sponsorId,'martin-reed');assert.equal(r.periods.length,1);assert.ok(Date.parse(r.expiresAt)-Date.parse(r.approvedAt)<=24*3600000);
 const expiredAt='2026-11-28T00:00:00.000Z',expired=officeState(f.assignments,f.events,expiredAt,f.features);assert.equal(defaultSelection(expired,f.features,expiredAt).entryView,'articles');assert.equal(expired.exceptions.records.find(x=>x.id===r.id).status,'expired');
 r=f.act('exceptions','renew',{id:r.id,version:r.version,expiresAt:'2026-11-28T00:30:00Z'},'martin-reed');assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'articles');
 r=f.act('exceptions','approve',{id:r.id,version:r.version},'simon-firth');assert.equal(r.periods.length,2);assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'admitted');
 r=f.act('exceptions','reject',{id:r.id,version:r.version},'simon-firth');assert.equal(r.status,'rejected');assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'articles');
 const g=fixture();enableFeature(g,'admitted-default-exception');const tooLong=g.act('exceptions','propose',{type:'admitted-default',scope:'Too long',expiresAt:'2026-11-29T00:00:00Z'},'martin-reed');assert.throws(()=>g.act('exceptions','approve',{id:tooLong.id,version:tooLong.version},'simon-firth'),/exceeds24/);
});
test('typed navigation approval retains automatic procedural clearance and ordinary packets report shared actual default',()=>{
 const f=fixture();enableFeature(f,'admitted-default-exception');enableFeature(f,'automatic-procedural-intake');let r=f.act('exceptions','propose',{type:'admitted-default',scope:'Navigation',expiresAt:'2026-11-28T00:00:00Z'},'martin-reed');
 const target={office:'exceptions',op:'approve',id:r.id,version:r.version,reason:'Approve bounded navigation.',references:['policy-one']},ref=f.act(target.office,target.op,target,'simon-firth');assert.equal(ref.status,'held');assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'articles');
 f.act('procedure','rule',{id:ref.id,version:ref.version,ruling:'release'},'adrian-keene');f.act(target.office,target.op,target,'simon-firth');assert.equal(defaultSelection(f.project(),f.features,f.at).entryView,'admitted');
 const fixtureState=engineIntakeFixture();fixtureState.state.officeFeatures.push(...f.features);const packet=characterPacket({...fixtureState.state,pending:{id:'navigation-reading',index:125,startAt:fixtureState.state.latestCompletedAt,endAt:'2026-11-27T03:00:00Z',participants:['alice'],proposals:{},variedReading:true}},'alice');assert.equal(packet.publicSiteState.entryView,'complete article index');assert.equal(packet.publicSiteState.completeIndexAvailable,true);
});
function careBatchFixture(){
 const f=fixture();let hold=f.act('care','nominate',{articleId:'care',revisionId:'revision-one',passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin'});hold=f.act('care','open',{id:hold.id,version:hold.version},'beth-vale');let batch=f.act('maintenance','submit',{changes:[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['Care concurrence applied']}]});batch=f.act('maintenance','approve',{id:batch.id,version:batch.version},'jo-porter');enableFeature(f,'care-concurrence-exemption','2026-11-26T20:46:00.000Z');
 const target={office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute with exact concurrence.',references:['revision-one']};return {f,hold,batch,target};
}
test('care concurrence has authorized refusal/challenge/grant, exact binding and a positive otherwise-valid maintenance execution',()=>{
 const {f,target}=careBatchFixture();let concur=f.act(target.office,target.op,target,'jo-porter');assert.equal(concur.kind,'maintenance-concurrence');assert.equal(concur.status,'pending');assert.deepEqual(f.articles().get('care').categories,['Care']);
 assert.throws(()=>f.act('care','concur',{id:concur.id,version:concur.version,ruling:'grant'}),/controller/);
 concur=f.act('care','concur',{id:concur.id,version:concur.version,ruling:'refuse'},'beth-vale');const blocked=f.act(target.office,target.op,target,'jo-porter');assert.equal(blocked.concurrenceId,concur.id);
 concur=f.act('care','challenge',{id:concur.id,version:concur.version});assert.equal(concur.status,'refused');
 concur=f.act('care','concur',{id:concur.id,version:concur.version,ruling:'grant'},'beth-vale');assert.equal(concur.status,'granted');assert.equal(f.project().care.records.find(r=>r.id===concur.id).current,true);
 f.act(target.office,target.op,target,'jo-porter');assert.deepEqual(f.articles().get('care').categories,['Care concurrence applied']);
});
test('care versions, payload and article bases invalidate concurrence; closing affected cases removes only the extra concurrence requirement',()=>{
 for(const change of ['care','payload','base','close']){
  const {f,target,hold}=careBatchFixture();let concur=f.act(target.office,target.op,target,'jo-porter');concur=f.act('care','concur',{id:concur.id,version:concur.version,ruling:'grant'},'beth-vale');let next={...target};
  if(change==='care'){f.act('care','challenge',{id:hold.id,version:hold.version});assert.equal(f.project().care.records.find(r=>r.id===concur.id).current,false);assert.throws(()=>f.act('care','concur',{id:concur.id,version:concur.version,ruling:'grant'},'beth-vale'),/stale care/);}
  if(change==='payload')next.reason='Different exact payload.';
  if(change==='base'){f.events.push({...f.events[0],id:'changed-base',revisionId:'changed-base',timestamp:f.at,action:'revise',body:'Held passage. New prose. [[knowledge]]'});assert.equal(f.project().care.records.find(r=>r.id===concur.id).current,false);assert.throws(()=>f.act(target.office,target.op,target,'jo-porter'),/stale article/);continue;}
  if(change==='close'){f.act('care','close',{id:hold.id,version:hold.version},'beth-vale');f.act(target.office,target.op,target,'jo-porter');assert.deepEqual(f.articles().get('care').categories,['Care concurrence applied']);continue;}
  const fresh=f.act(next.office,next.op,next,'jo-porter');assert.equal(fresh.status,'pending');assert.notEqual(fresh.id,concur.id);
 }
});
test('request-time precedence preserves Beth exemption history but later Adrian intake supersedes only care open/release',()=>{
 const f=activateClearance(fixture());enableFeature(f,'care-concurrence-exemption','2026-11-26T20:46:00.000Z');let hold=f.act('care','nominate',{articleId:'care',revisionId:'revision-one',passage:'Held passage.',sourceEventId:'cycle-0113-alfie-margin'});
 const target={office:'care',op:'open',id:hold.id,version:hold.version,reason:'Open care.',references:['revision-one']};const exempt=f.act('procedure','reference',{policyId:'policy-one',ambiguity:'Attempted procedural hold.',target});assert.equal(exempt.status,'exempt');assert.throws(()=>f.act('procedure','rule',{id:exempt.id,version:exempt.version,ruling:'release'},'adrian-keene'),/exempt/);
 enableFeature(f,'automatic-procedural-intake','2026-11-26T20:53:00.000Z');assert.equal(proceduralRule(f.features,'care','open',f.at).mode,'automatic');assert.equal(proceduralRule(f.features,'care','release',f.at).mode,'automatic');assert.equal(proceduralRule(f.features,'care','nominate',f.at).mode,'exempt');assert.equal(proceduralRule(f.features,'care','close',f.at).mode,'exempt');
 const projected=f.project();assert.equal(projected.procedure.records.find(r=>r.id===exempt.id).effectiveStatus,'held');assert.deepEqual(projected.care.proceduralRuleState.find(r=>r.op==='open').supersededRequestIds,[ROUND3_FEATURES['care-concurrence-exemption'].id]);
 f.act(target.office,target.op,target,'beth-vale');assert.equal(f.project().care.records.find(r=>r.id===hold.id).status,'nominated');
 f.act('procedure','rule',{id:exempt.id,version:exempt.version,ruling:'release'},'adrian-keene');hold=f.act(target.office,target.op,target,'beth-vale');assert.equal(hold.status,'open');f.act('care','close',{id:hold.id,version:hold.version},'beth-vale');assert.equal(f.project().care.records.find(r=>r.id===hold.id).status,'closed');
 const future={feature:'future-explicit-care-rule',requestId:'future-owner-request',timestamp:t,requestTimestamp:'2026-11-26T21:00:00.000Z',operationRules:[{office:'care',ops:['open'],mode:'exempt'}]};assert.equal(proceduralRule([...f.features,future],'care','open',f.at).mode,'exempt');
});
test('all four round3 feature activations are exact-request-bound, checkpoint-only and idempotent without seeding records',()=>{
 for(const [feature,definition] of Object.entries(ROUND3_FEATURES)){
  const f=fixture(),state=createState();state.officeAssignments=f.assignments;state.latestCompletedAt=t;state.events=[...f.events,{id:definition.id,editorId:definition.editor,action:'policy',timestamp:t,body:'Exact technical request.'}];state.backendChanges=[{id:definition.id,editorId:definition.editor,status:'queued',timestamp:'2026-11-26T20:53:00.000Z'}];
  const args={feature,requestId:definition.id};state.pending={};assert.throws(()=>installOfficeFeature(state,args,{proof,now:later}),/complete checkpoint/);state.pending=null;assert.ok(installOfficeFeature(state,args,{proof,now:later}).ok);assert.ok(installOfficeFeature(state,args,{proof,now:later}).duplicate);assert.equal(state.officeFeatures.length,1);assert.equal(state.officeFeatures[0].requestTimestamp,state.backendChanges[0].timestamp);assert.equal(Object.values(officeState(state.officeAssignments,state.events,t,state.officeFeatures)).flatMap(o=>o.records).length,0);
 }
});

test('whole engine publishes automatic intake, exact clerk release and single actual target execution with public consumption receipt',()=>{
 const {state,turn,project}=engineIntakeFixture();
 turn('alice',{action:'policy',title:'Submit category batch',body:'Submit.',officeAction:{office:'maintenance',op:'submit',changes:[{kind:'category',articleId:'care',revisionId:'revision-one',categories:['Engine verified']}],reason:'Exact category batch.',references:['revision-one']}});let batch=project().maintenance.records[0];
 turn('jo-porter',{action:'policy',title:'Approve batch',body:'Approve.',officeAction:{office:'maintenance',op:'approve',id:batch.id,version:batch.version,reason:'Approve exact version.',references:['revision-one']}});batch=project().maintenance.records[0];state.officeFeatures.push({feature:'automatic-procedural-intake',version:1,requestId:ROUND3_FEATURES['automatic-procedural-intake'].id,timestamp:t,installedAt:t,requestTimestamp:'2026-11-26T20:53:00.000Z',authority:'Technical request.'});
 const target={office:'maintenance',op:'execute',id:batch.id,version:batch.version,reason:'Execute exact approved version.',references:['revision-one']};const first=turn('jo-porter',{action:'policy',title:'Attempt execution',body:'Execute.',officeAction:target});assert.equal(first.event.officeDecision.record.status,'held');assert.deepEqual(articlesAt(state).get('care').categories,['Care']);let ref=project().procedure.records[0];
 turn('adrian-keene',{action:'policy',title:'Release exact operation',body:'Release.',officeAction:{office:'procedure',op:'rule',id:ref.id,version:ref.version,ruling:'release',reason:'Release exact payload.',references:['policy-one']}});
 const execution=turn('jo-porter',{action:'policy',title:'Execute released operation',body:'Execute.',officeAction:target});assert.deepEqual(articlesAt(state).get('care').categories,['Engine verified']);assert.equal(execution.event.officeConsequences[0].op,'clearance-consumed');assert.equal(project().procedure.records[0].status,'consumed');
 const data=exportPublic(state,execution.opts);assert.ok(validatePublic(data));assert.deepEqual(snapshot(data).articles.get('care').categories,['Engine verified']);assert.throws(()=>turn('jo-porter',{action:'policy',title:'Duplicate execution',body:'Execute.',officeAction:target}),/stale office record|already executed/);
});
