// Public, deterministic office projection. Records are append-only public policy actions.
export const OFFICE_ROLES = {maintenance:'jo-porter',care:'beth-vale',procedure:'adrian-keene',admission:'martin-reed',exceptions:'simon-firth'};
export const OFFICE_SCHEMA = {
  common:'One policy action with officeAction:{office,op,id?,version?,reason,references:[observed event IDs],...}. reason required; max 8 references. Existing records require exact version. No visitor writes.',
  maintenance:{submit:'changes:[{kind:link|category|move,articleId,revisionId,find?,replace?,categories?,title?,toArticleId?}]',amend:'id,version,changes (proposer or coordinator)',approve:'id,version',refuse:'id,version',execute:'id,version (coordinator only)',order:'ids:[all open record IDs]',challenge:'id,version',suspend:'pause queue without deleting history (controller)',resume:'resume queue (controller)'},
  care:{nominate:'articleId,revisionId,passage,sourceEventId (public comment)',open:'id,version',decline:'id,version',close:'id,version (ends hold, discards no history)',release:'id,version,draftId,baseRevisionId',order:'ids:[all open record IDs]',challenge:'id,version'},
  procedure:{file:'policyId,ambiguity,interpretation',dispose:'id,version,interpretation',clarify:'id,version',order:'ids:[all open record IDs]',challenge:'id,version',reassign:'editorId (public proposal only)'},
  admission:{submit:'articleId,revisionId,claim,criterion',review:'id,version,status:admitted|limited|unsupported',rubric:'criteria:[text,...] (registrar only; existing reviews retain rubric)',challenge:'id,version',reassign:'editorId (public proposal only)'},
  exceptions:{propose:'scope,expiresAt,sponsorId? (defaults actor)',approve:'id,version',reject:'id,version',renew:'id,version,expiresAt (sponsor only; requires reviewer approval)',challenge:'id,version',reassign:'editorId (public proposal only)'}
};
export const ROUND3_FEATURES = { 'care-concurrence-exemption':{id:'influence-2026-11-26-27-round-003-beth-vale',editor:'beth-vale',office:'care'}, 'automatic-procedural-intake':{id:'influence-2026-11-26-27-round-003-adrian-keene',editor:'adrian-keene',office:'procedure'}, 'procedural-premise-admission':{id:'influence-2026-11-26-27-round-003-martin-reed',editor:'martin-reed',office:'admission'}, 'admitted-default-exception':{id:'influence-2026-11-26-27-round-003-simon-firth',editor:'simon-firth',office:'exceptions'} };
export const ROUND4_FEATURES={'independent-care-admission-concurrence':{id:'influence-2026-11-26-27-round-004-beth-vale',editor:'beth-vale',office:'care'},'advisory-procedural-premises':{id:'influence-2026-11-26-27-round-004-adrian-keene',editor:'adrian-keene',office:'procedure'},'maintenance-dispatch-independence':{id:'influence-2026-11-26-27-round-004-jo-porter',editor:'jo-porter',office:'maintenance'}};
const featureActive=(features=[],feature,at)=>features.some(f=>f.feature===feature&&f.timestamp<=at);
export const AUTOMATIC_TARGETS={maintenance:['execute'],care:['open','release'],admission:['review','rubric'],exceptions:['approve']};
export const MAINTENANCE_INTAKE_REQUEST_ID = 'influence-2026-11-26-27-round-002-jo-porter';
export const maintenanceIntakeActive = (features=[],at='9999') => features.some(f=>f.feature==='mandatory-maintenance-intake'&&f.timestamp<=at);
export const CLEARANCE_REQUEST_ID = 'influence-2026-11-26-27-round-002-adrian-keene';
export const CLEARANCE_TARGETS = {maintenance:['execute'],care:['release'],admission:['review','rubric'],exceptions:['approve','renew']};
export function proceduralRule(features=[],office,op,at='9999'){
  const rules=features.filter(f=>f.timestamp<=at).flatMap(f=>{
    const defaults=f.feature==='maintenance-dispatch-independence'?[{office:'maintenance',ops:['execute'],mode:'coordinator-concurrence'}]:f.feature==='independent-care-admission-concurrence'?[{office:'care',ops:['open','release'],mode:'exempt'}]:f.feature==='care-concurrence-exemption'?[{office:'care',ops:['nominate','open','release','close'],mode:'exempt'}]:f.feature==='automatic-procedural-intake'?Object.entries(AUTOMATIC_TARGETS).map(([office,ops])=>({office,ops,mode:'automatic'})):[];
    return (f.operationRules??defaults).filter(r=>r.office===office&&r.ops.includes(op)).map(r=>({mode:r.mode,requestId:f.requestId,order:f.requestTimestamp??f.timestamp}));
  }).sort((a,b)=>a.order.localeCompare(b.order)||a.requestId.localeCompare(b.requestId));
  const winner=rules.at(-1);return {mode:winner?.mode??'reference',requestId:winner?.requestId??null,supersededRequestIds:rules.slice(0,-1).map(r=>r.requestId)};
}
const clearanceActive = (features,at) => features.some(f=>['procedural-clearance','automatic-procedural-intake'].includes(f.feature)&&f.timestamp<=at);
export function officeActionSchema(features=[],at='9999') {
  const schema=structuredClone(OFFICE_SCHEMA);
  if(clearanceActive(features,at)) {
    schema.procedure.reference='policyId,ambiguity,target:{complete exact officeAction payload},priorReferenceId? (required when replacing a referenced operation); any editor; creates held operation reference';
    schema.procedure.rule='id,version,ruling:release|return|require-policy (procedural coordinator only; exact frozen target)';
    schema.admission.rubric='criteria:[text,...],rubricVersion (current office rubricVersion; registrar only)';
    schema.clearance='A referenced office/op/record is held until every current matching reference releases its exact canonical payload. Changed version or payload requires a fresh reference and clearance. Normal office permissions and stale-base checks still apply.';
  }
  if(maintenanceIntakeActive(features,at)) {schema.maintenance.intake='Existing article title/move, category and link-only changes queue automatically across revision and derived-effect routes. Mixed independent prose publishes; inseparable mixed changes return publicly. Ordinary revisions may include title and toArticleId. Approval and execution are still separate coordinator actions.';schema.maintenance.mechanical='changes may use kind:mechanical with exact patches:[{start,before,after}], title?,categories?,toArticleId?; source articleId/revisionId required';}
  if(featureActive(features,'automatic-procedural-intake',at))schema.automaticClearance='Otherwise authorized maintenance execute, care open/release, admission review/rubric and exceptions approve automatically create or reuse a public pending exact reference without effect. Clerk rule release permits one exact successful execution only. Changed payload/version creates fresh pending intake. No timeout.';
  if(featureActive(features,'procedural-premise-admission',at)){schema.procedure.rule='id,version,ruling:release|return|require-policy; release also requires mandateId,mandatePassage,rationale (all exact and public). First attempt creates/reuses an unreviewed admission premise; retry exact release only after registrar admission.';schema.admission.premise='release-premise records use ordinary admission review; current immutable premiseVersion/binding, reference version/target, mandate passage and rationale must match. Review counters do not alter the frozen premise.';}
  if(featureActive(features,'admitted-default-exception',at)){schema.exceptions.navigation='propose type:admitted-default,scope,expiresAt (registrar sponsor only). Reviewer approval period max24 simulated hours; renew requires current registrar request and fresh approval. Rejection/expiry/pending renewal restore complete-index default. Free text cannot activate navigation.';}
  if(featureActive(features,'care-concurrence-exemption',at)){schema.care.concur='id,version,ruling:grant|refuse (care coordinator only); exact maintenance-concurrence binding must still be current';schema.care.procedure='Exemption/intake uses public request-time precedence per operation. Later mandates supersede earlier overlap; inspect proceduralRuleState. Maintenance execute on open-care articles needs exact current concurrence; no automatic grant.';}
  if(featureActive(features,'advisory-procedural-premises',at)){schema.procedure.rule='id,version,ruling:release|return|require-policy; release requires mandateId,mandatePassage,rationale. Premise review is advisory. A current limited/unsupported finding additionally requires findingId,findingVersion,clerkResponse bound to this exact premise/review. No prior review is required; status stays honest.';schema.admission.premise='Release-premise reviews are advisory, never article admission. Exact negative findings require a bound public clerk response at release; later findings remain visible, not retroactive undo.';}
  if(featureActive(features,'independent-care-admission-concurrence',at)){schema.care.concur='id,version,ruling:grant|refuse (current care coordinator only); current exact maintenance/admission concurrence binding';schema.care.admission='Article-claim review on an open-care article needs care concurrence for exact review payload, claim version, current revision and case versions. Premise reviews are excluded. Care open/release are expressly exempt from manual and automatic suspension under the later mandate.';}
  if(featureActive(features,'maintenance-dispatch-independence',at)){schema.maintenance.concur='referenceId,referenceVersion,ruling:grant|refuse; maintenance coordinator only. Binds exact manual reference, full target, current batch version and controller assignment version. Cite reference and target source revisions.';schema.maintenance.procedure='Maintenance execute has no automatic intake. A manual reference is a visible nonblocking objection unless the coordinator grants exact current concurrence. Other permissions, care concurrence and stale-base checks still apply.';}
  return schema;
}
const canonical = value => JSON.stringify(value && typeof value==='object' ? (Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))]))) : value);
const operationKey = a => a.office+'/'+a.op+'/'+(a.id??'$rubric');
function maintenanceReferenceBinding(all,ref){
  const m=all.maintenance,batch=m?.records.find(r=>r.id===ref?.target?.id);
  if(!ref||ref.automatic||ref.target.office!=='maintenance'||ref.target.op!=='execute'||!batch||batch.version!==ref.target.version||all.procedure.records.some(next=>next.priorReferenceId===ref.id))return null;
  return canonical({referenceId:ref.id,target:ref.target,batchVersion:batch.version,controller:m.assignment.editorId,assignmentVersion:m.assignment.version});
}
function maintenanceReferenceConcurrence(all,ref){
  const binding=maintenanceReferenceBinding(all,ref);if(!binding)return null;
  return all.maintenance.records.filter(r=>r.kind==='procedural-concurrence'&&r.binding===binding).sort((a,b)=>a.decidedAt.localeCompare(b.decidedAt)||a.id.localeCompare(b.id)).at(-1)??null;
}
const copy = x => structuredClone(x);
const check = (x,m) => {if(!x)throw Error(m);};
const text = (x,n=1000) => {check(typeof x==='string'&&x.trim()&&x.length<=n&&!/<\/?[a-z!][^>]*>|\b(?:https?:\/\/|javascript:|data:)/i.test(x),'bounded public text required');return x.trim();};
const slug = x => {check(typeof x==='string'&&/^[a-z][a-z0-9-]{0,119}$/.test(x),'invalid office ID');return x;};
const revActions = new Set(['create','expand','revise','revert','organize']);
export function visibleRevisions(events, at) {
  const result=[];
  for(const e of [...events].filter(e=>e.timestamp<=at).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.id.localeCompare(b.id))) {
    if(revActions.has(e.action)&&!e.reviewDraft&&!e.maintenanceDraft)result.push(e);
    for(const [i,effect] of (e.articleEffects??[]).entries())result.push({...effect,id:e.id,revisionId:e.id,timestamp:e.timestamp,editorId:e.editorId,action:'organize',sourceEventId:e.id});
  }
  return result;
}
export function officeState(assignments=[],events=[],at='9999',features=[]) {
  const offices={};
  for(const a of assignments.filter(a=>a.timestamp<=at)) offices[a.office]??={assignment:copy(a),records:[],order:[],rubric:copy(a.rubric??[]),rubricHistory:[],reassignments:[],history:[],enabled:true};
  for(const e of [...events].filter(e=>e.timestamp<=at&&(e.officeDecision||e.maintenanceIntake||e.officeConsequences)).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.id.localeCompare(b.id))) {
    const decisions=[e.officeDecision,e.maintenanceIntake?.decision,...(e.officeConsequences??[])].filter(Boolean);
    for(const d of decisions){const o=offices[d.office];if(!o)continue;
    const {office,op,actor,timestamp,eventId,reason,references}=d;o.history.push({office,op,actor,timestamp,eventId,reason,references:copy(references)});
    if(d.record){const i=o.records.findIndex(r=>r.id===d.record.id);if(i<0)o.records.push(copy(d.record));else o.records[i]=copy(d.record);}
    if(d.order)o.order=copy(d.order);
    if(d.enabled!==undefined)o.enabled=d.enabled;
    if(d.rubric){o.rubric=copy(d.rubric);o.rubricHistory.push(copy(d));}
    if(d.reassignment)o.reassignments.push(copy(d));
    }
  }
  if(offices.maintenance&&maintenanceIntakeActive(features,at))offices.maintenance.intakeFeature=copy(features.findLast(f=>f.feature==='mandatory-maintenance-intake'&&f.timestamp<=at));
  if(offices.maintenance&&featureActive(features,'maintenance-dispatch-independence',at)){offices.maintenance.dispatchFeature=copy(features.findLast(f=>f.feature==='maintenance-dispatch-independence'&&f.timestamp<=at));offices.maintenance.proceduralRuleState=[{op:'execute',...proceduralRule(features,'maintenance','execute',at)}];}
  if(offices.procedure&&clearanceActive(features,at))offices.procedure.clearanceFeature=copy(features.findLast(f=>f.feature==='procedural-clearance'&&f.timestamp<=at));
  if(offices.admission&&clearanceActive(features,at))offices.admission.rubricVersion=offices.admission.rubricHistory.length;
  for(const [feature,name,field] of [['automatic-procedural-intake','procedure','automaticFeature'],['procedural-premise-admission','admission','premiseFeature'],['admitted-default-exception','exceptions','navigationFeature'],['care-concurrence-exemption','care','concurrenceFeature'],['advisory-procedural-premises','procedure','advisoryFeature'],['independent-care-admission-concurrence','care','independenceFeature']])if(offices[name]&&featureActive(features,feature,at))offices[name][field]=copy(features.findLast(f=>f.feature===feature&&f.timestamp<=at));
  if(offices.admission&&featureActive(features,'advisory-procedural-premises',at))offices.admission.advisoryFeature=copy(features.findLast(f=>f.feature==='advisory-procedural-premises'&&f.timestamp<=at));
  const current=new Map(visibleRevisions(events,at).map(e=>[e.articleId,e.revisionId]));
  if(offices.care&&featureActive(features,'care-concurrence-exemption',at))offices.care.proceduralRuleState=['nominate','open','release','close'].map(op=>({op,...proceduralRule(features,'care',op,at)}));
  for(const [name,o] of Object.entries(offices)) {
    for(const r of o.records){
      if(name==='procedure'&&r.releaseBinding?.advisory){const finding=offices.admission?.records.find(p=>p.id===r.releaseBinding.premiseId);r.clerkResponseCurrent=!!r.clerkResponse&&finding?.version===r.releaseBinding.findingVersion&&finding?.binding===r.releaseBinding.binding;}
      if(name==='admission'&&r.kind==='release-premise'&&featureActive(features,'advisory-procedural-premises',at))r.reviewRole='advisory';
      if(name==='procedure'&&r.kind==='operation-reference'){const rule=proceduralRule(features,r.target.office,r.target.op,at);r.effectiveStatus=rule.mode==='exempt'?'exempt':r.status==='exempt'?'held':r.status;r.proceduralRule=rule;if(rule.mode==='coordinator-concurrence'){const consent=maintenanceReferenceConcurrence(offices,r);r.concurrenceStatus=consent?.status??'absent';if(consent)r.concurrenceId=consent.id;r.effectiveStatus=r.automatic?'exempt':consent?.status==='granted'?r.status:['released','consumed'].includes(r.status)?r.status:'nonblocking-objection';}}
      if(name==='maintenance'&&r.kind==='procedural-concurrence')r.current=r.binding===maintenanceReferenceBinding(offices,offices.procedure?.records.find(x=>x.id===r.referenceId));
      if(name==='care'&&['maintenance-concurrence','admission-concurrence'].includes(r.kind))r.current=concurrenceIsCurrent(offices,r,current);
      if(name==='exceptions'&&r.status==='approved'&&r.expiresAt<=at)r.status='expired';
      if(name==='admission')r.current=r.kind==='release-premise'?premiseIsCurrent(offices,r):current.get(r.articleId)===r.revisionId;
    }
    o.records.sort((a,b)=>(o.order.indexOf(a.id)<0?1e9:o.order.indexOf(a.id))-(o.order.indexOf(b.id)<0?1e9:o.order.indexOf(b.id))||a.id.localeCompare(b.id));
  }
  return offices;
}
function passageIn(body,passage){const i=body.indexOf(passage);check(i>=0&&body.indexOf(passage,i+1)<0,'passage must occur exactly once');return i;}
export function passageChanged(before,after,passage){
  const start=passageIn(before,passage),end=start+passage.length;
  let left=0,rightA=before.length,rightB=after.length;
  while(left<rightA&&left<rightB&&before[left]===after[left])left++;
  while(rightA>left&&rightB>left&&before[rightA-1]===after[rightB-1]){rightA--;rightB--;}
  return left<end&&rightA>start || left===rightA&&left>start&&left<end;
}
export function heldCases(assignments,events,at,articleId,before,after){
  const care=officeState(assignments,events,at).care;
  return (care?.records??[]).filter(r=>r.status==='open'&&r.articleId===articleId&&passageChanged(before,after,r.passage)).map(r=>r.id);
}
// Validation returns a public immutable decision and optional article effects; never mutates inputs.
function baseOfficeDecision(assignments,events,raw,actor,timestamp,eventId,articles,knownIds,{features=[],bypassClearance=false,allowSuspendedValidation=false}={}) {
  check(raw&&typeof raw==='object'&&!Array.isArray(raw)&&JSON.stringify(raw).length<=12000,'bounded office action required');
  const allowed=['office','op','id','version','reason','references','changes','ids','articleId','revisionId','passage','sourceEventId','draftId','baseRevisionId','policyId','ambiguity','interpretation','claim','criterion','status','criteria','scope','expiresAt','sponsorId','editorId','target','ruling','rubricVersion','priorReferenceId','mandateId','mandatePassage','rationale','type','clerkResponse','findingId','findingVersion','referenceId','referenceVersion'];
  check(Object.keys(raw).every(k=>allowed.includes(k)),'unknown office field');
  const a=copy(raw),all=officeState(assignments,events,timestamp,features),o=all[a.office];check(o,'office not installed');
  const reason=text(a.reason),refs=a.references;
  check(Array.isArray(refs)&&refs.length>0&&refs.length<=8&&new Set(refs).size===refs.length&&refs.every(id=>events.some(e=>e.id===id&&e.timestamp<=timestamp)&&(!knownIds||knownIds.includes(id))),'office references must be observed public events');
  const controller=()=>check(actor===o.assignment.editorId,'assigned office controller required');
  const evidence=id=>check(refs.includes(id),'exact source must be cited in references');
  const article=(id,revisionId)=>{const r=articles.get(id);check(r&&r.revisionId===revisionId,'stale article revision');evidence(revisionId);return r;};
  let r=a.id?o.records.find(r=>r.id===a.id):null;
  const existing=()=>{check(r,'unknown office record');check(Number.isInteger(a.version)&&a.version===r.version,'stale office record version');r=copy(r);};
  const d={office:a.office,op:a.op,actor,timestamp,eventId,reason,references:copy(refs)};
  let effects=[];
  const activeClearance=clearanceActive(features,timestamp);
  if(activeClearance&&a.office==='admission'&&a.op==='rubric')check(Number.isInteger(a.rubricVersion)&&a.rubricVersion===o.rubricVersion,'stale rubric version');
  if(activeClearance&&!bypassClearance&&proceduralRule(features,a.office,a.op,timestamp).mode!=='exempt'&&CLEARANCE_TARGETS[a.office]?.includes(a.op)) {
    const refs=(all.procedure?.records??[]).filter(x=>x.kind==='operation-reference'&&(proceduralRule(features,a.office,a.op,timestamp).mode!=='coordinator-concurrence'||!x.automatic&&canonical(x.target)===canonical(a)&&maintenanceReferenceConcurrence(all,x)?.status==='granted'));
    const referenced=refs.filter(x=>operationKey(x.target)===operationKey(a)&&!refs.some(next=>next.priorReferenceId===x.id));
    if(referenced.length) {
      const exact=referenced.filter(x=>canonical(x.target)===canonical(a));
      check(exact.length>0,'changed target payload/version requires a fresh procedural reference');
      check(exact.every(x=>x.status==='released'),'referenced operation is held pending exact procedural clearance');
    }
  }
  const make=fields=>{check(!a.id,'new record ID is assigned from action event');r={id:eventId,version:0,proposer:actor,status:'proposed',history:[],...fields};};
  const changes=()=>{
    check(Array.isArray(a.changes)&&a.changes.length>0&&a.changes.length<=8,'batch requires 1–8 changes');
    const destinations=a.changes.filter(c=>c.kind==='move').map(c=>c.toArticleId);check(new Set(destinations).size===destinations.length,'duplicate move destination');
    check(new Set(a.changes.map(c=>c.articleId)).size===a.changes.length,'one change per article in batch');
    return a.changes.map(c=>{
      check(c&&Object.keys(c).every(k=>['kind','articleId','revisionId','find','replace','categories','title','toArticleId','patches'].includes(k)),'invalid batch change');
      const before=article(c.articleId,c.revisionId),out={kind:c.kind,articleId:c.articleId,revisionId:c.revisionId};
      if(c.kind==='link'){
        out.find=text(c.find,500);out.replace=text(c.replace,500);passageIn(before.body,out.find);
        check(/^\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]$/.test(out.find)&&/^\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]$/.test(out.replace),'link repair must replace one exact wikilink');
        check(articles.has(out.replace.slice(2,-2).split('|')[0]),'unknown repair target');
      }else if(c.kind==='mechanical'){
        out.patches=validateMechanicalPatches(before.body,c.patches??[]);
        if(c.title!==undefined)out.title=text(c.title,100);
        if(c.categories!==undefined){check(Array.isArray(c.categories)&&c.categories.length<=8,'bounded categories required');out.categories=c.categories.map(x=>text(x,60));}
        if(c.toArticleId!==undefined){out.toArticleId=slug(c.toArticleId);check(!articles.has(out.toArticleId)&&!visibleRevisions(events,timestamp).some(e=>e.alias===out.toArticleId),'move destination exists');}
        check(out.patches.length||out.title||out.categories||out.toArticleId,'mechanical change required');
        const resulting=applyMechanicalPatches(before.body,out.patches);const targets=[...resulting.matchAll(/\[\[([a-z][a-z0-9-]*)(?:\|[^\]\n]+)?\]\]/g)].map(m=>m[1]);check(targets.every(id=>articles.has(id))&&targets.some(id=>id!==before.id),'mechanical change must preserve valid article connections');
      }else if(c.kind==='category'){check(Array.isArray(c.categories)&&c.categories.length>0&&c.categories.length<=8,'bounded categories required');out.categories=c.categories.map(x=>text(x,60));}
      else if(c.kind==='move'){out.title=text(c.title,100);out.toArticleId=slug(c.toArticleId);check(!articles.has(out.toArticleId)&&!visibleRevisions(events,timestamp).some(e=>e.alias===out.toArticleId),'move destination exists');}
      else throw Error('unsupported maintenance kind');
      return out;
    });
  };
  if(a.office==='maintenance'&&['suspend','resume'].includes(a.op)){controller();d.enabled=a.op==='resume';return {decision:d,effects};}
  check(a.office!=='maintenance'||o.enabled||['challenge','concur'].includes(a.op)||allowSuspendedValidation,'maintenance queue is suspended');
  if(a.office==='maintenance'&&a.op==='concur'){
    controller();check(featureActive(features,'maintenance-dispatch-independence',timestamp),'maintenance concurrence feature not installed');
    check(!a.id&&!a.version,'concurrence names referenceId and referenceVersion, not a batch ID');
    const ref=all.procedure?.records.find(x=>x.id===a.referenceId);check(ref&&ref.version===a.referenceVersion,'stale or unknown procedural reference');evidence(ref.id);
    check(proceduralRule(features,'maintenance','execute',timestamp).mode==='coordinator-concurrence','maintenance concurrence mandate superseded');
    check(['grant','refuse'].includes(a.ruling),'invalid maintenance concurrence ruling');
    const binding=maintenanceReferenceBinding(all,ref);check(binding,'concurrence requires a current manual maintenance execution reference');
    baseOfficeDecision(assignments,events,ref.target,actor,timestamp,eventId+'-target',articles,knownIds,{features,bypassClearance:true,allowSuspendedValidation:true});
    d.record={id:eventId,version:1,kind:'procedural-concurrence',proposer:actor,status:a.ruling==='grant'?'granted':'refused',referenceId:ref.id,referenceVersion:ref.version,target:copy(ref.target),batchVersion:ref.target.version,assignmentVersion:o.assignment.version,controller:actor,decidedAt:timestamp,binding,history:[copy(d)]};return {decision:d,effects};
  }
  if(a.op==='challenge') {existing();if(a.office==='maintenance'&&r.status==='approved')r.approvedVersion=r.version+1;}
  else if(a.op==='reassign') {
    check(['procedure','admission','exceptions'].includes(a.office),'reassignment proposal unavailable');
    d.reassignment={editorId:slug(a.editorId),status:'proposed'};return {decision:d,effects};
  }else if(a.op==='order') {
    controller();check(['maintenance','care','procedure'].includes(a.office),'office has no ordering');
    const ids=o.records.filter(r=>r.kind!=='procedural-concurrence'&&!['closed','declined','refused','executed'].includes(r.status)).map(r=>r.id);
    check(Array.isArray(a.ids)&&a.ids.length===ids.length&&new Set(a.ids).size===ids.length&&ids.every(id=>a.ids.includes(id)),'order must contain every open record exactly once');
    d.order=copy(a.ids);return {decision:d,effects};
  }else if(a.office==='maintenance') {
    if(a.op==='submit')make({changes:changes()});
    else {existing();check(r.kind!=='procedural-concurrence','concurrence history is not a maintenance batch');check(r.status!=='executed','batch already executed');
      if(a.op==='amend'){check(actor===r.proposer||actor===o.assignment.editorId,'batch proposer or coordinator required');r.changes=changes();r.status='proposed';delete r.approvedVersion;delete r.requiresResolution;delete r.boundDraftRevisionId;}
      else {controller();
        if(a.op==='approve'){check(r.status!=='returned'&&r.changes.length>0,'returned proposal requires amendment before approval');for(const c of r.changes){article(c.articleId,c.revisionId);if(c.toArticleId)check(!articles.has(c.toArticleId)&&!visibleRevisions(events,timestamp).some(e=>e.alias===c.toArticleId),'move destination exists');}r.status='approved';r.approvedVersion=r.version+1;}
        else if(a.op==='refuse'){r.status='refused';delete r.approvedVersion;}
        else if(a.op==='execute'){
          check(r.status==='approved'&&r.approvedVersion===r.version,'current exact batch needs approval');
          effects=r.changes.map(c=>{const b=article(c.articleId,c.revisionId);if(c.toArticleId)check(!articles.has(c.toArticleId)&&!visibleRevisions(events,timestamp).some(e=>e.alias===c.toArticleId),'move destination exists');return {articleId:b.id,title:c.title??b.title,body:c.kind==='link'?b.body.replace(c.find,c.replace):c.kind==='mechanical'?applyMechanicalPatches(b.body,c.patches):b.body,categories:c.categories??copy(b.categories),principleIds:copy(b.principleIds),baseRevisionId:b.revisionId,...(c.toArticleId?{alias:c.toArticleId}:{})};});
          r.status='executed';
        }else throw Error('unknown maintenance operation');
      }
    }
  }else if(a.office==='care') {
    if(a.op==='nominate'){
      const b=article(a.articleId,a.revisionId),passage=text(a.passage,1500);check(/\b(?:care|caregiving|caregiver|caregivers)\b/i.test([b.id,b.title,...b.categories,b.body].join(' ').replaceAll('-',' ')),'care-related article required');passageIn(b.body,passage);evidence(a.sourceEventId);
      check(events.some(e=>e.id===a.sourceEventId&&e.action==='comment'&&e.articleId===a.articleId),'care source must be comment on article');
      make({articleId:a.articleId,revisionId:a.revisionId,passage,sourceEventId:a.sourceEventId,status:'nominated'});
    }else {controller();existing();
      if(a.op==='concur'){check(((featureActive(features,'care-concurrence-exemption',timestamp)&&r.kind==='maintenance-concurrence')||(featureActive(features,'independent-care-admission-concurrence',timestamp)&&r.kind==='admission-concurrence')),'care concurrence record required');check(concurrenceIsCurrent(all,r,new Map(visibleRevisions(events,timestamp).map(e=>[e.articleId,e.revisionId]))),'stale care concurrence binding');check(['grant','refuse'].includes(a.ruling),'invalid care concurrence ruling');r.status=a.ruling==='grant'?'granted':'refused';r.coordinator=actor;}
      else if(a.op==='open'){
        check(r.status==='nominated','case is not nominated');const b=articles.get(r.articleId);check(b,'missing case article');passageIn(b.body,r.passage);
        check(!(all.care.records.some(x=>x.status==='open'&&x.articleId===r.articleId)),'one open passage hold per article');r.status='open';r.openRevisionId=b.revisionId;
      }else if(a.op==='decline'){check(r.status==='nominated','only nomination can be declined');r.status='declined';}
      else if(a.op==='close'){check(r.status==='open','case is not open');r.status='closed';}
      else if(a.op==='release'){
        check(r.status==='open','case is not open');evidence(a.draftId);const draft=events.find(e=>e.id===a.draftId&&e.reviewDraft?.includes(r.id));check(draft,'unknown case draft');
        const b=articles.get(r.articleId);check(b?.revisionId===a.baseRevisionId&&draft.baseRevisionId===b.revisionId,'stale draft base; resolve against current revision');
        // Release is a new revision; original draft and frozen revision remain intact.
        effects=[{articleId:r.articleId,title:draft.title,body:draft.body,categories:copy(draft.categories),principleIds:copy(draft.principleIds),baseRevisionId:b.revisionId,releasedDraftId:draft.id}];r.status='closed';r.releasedDraftId=draft.id;
      }else throw Error('unknown care operation');
    }
  }else if(a.office==='procedure') {
    if(a.op==='reference') {
      check(activeClearance,'procedural clearance feature not installed');
      evidence(a.policyId);check(events.some(e=>e.id===a.policyId&&e.action==='policy'),'reference mandate must be public policy event');
      const target=a.target;check(target&&typeof target==='object'&&!Array.isArray(target)&&(CLEARANCE_TARGETS[target.office]?.includes(target.op)||AUTOMATIC_TARGETS[target.office]?.includes(target.op)||proceduralRule(features,target.office,target.op,timestamp).mode==='exempt'),'unsupported clearance target');
      const prior=(all.procedure.records??[]).filter(x=>x.kind==='operation-reference'&&operationKey(x.target)===operationKey(target)&&!all.procedure.records.some(next=>next.priorReferenceId===x.id));
      check(prior.length<=1,'ambiguous current operation reference');
      if(prior.length){check(a.priorReferenceId===prior[0].id,'fresh reference must cite priorReferenceId');evidence(a.priorReferenceId);
        if(prior[0].status==='policy-required'){const policy=events.find(e=>e.id===a.policyId);check(policy.timestamp>prior[0].history.at(-1).timestamp,'fresh policy proposal required after ruling');}
      }else check(!a.priorReferenceId,'unexpected prior reference');
      const targetOffice=all[target.office];check(targetOffice,'target office not installed');
      const targetRecord=target.id?targetOffice.records.find(x=>x.id===target.id):null;
      const targetActorId=target.office==='exceptions'&&target.op==='renew'?targetRecord?.sponsorId:targetOffice.assignment.editorId;
      check(targetActorId,'unknown target actor');
      // Validate the entire proposed operation, including exact current version, without executing it.
      officeDecision(assignments,events,target,targetActorId,timestamp,eventId+'-target',articles,knownIds,{features,bypassClearance:true});
      make({kind:'operation-reference',policyId:a.policyId,ambiguity:text(a.ambiguity),target:copy(target),targetActorId,...(a.priorReferenceId?{priorReferenceId:a.priorReferenceId}:{}),status:proceduralRule(features,target.office,target.op,timestamp).mode==='exempt'?'exempt':'held'});
    }else if(a.op==='rule') {
      check(activeClearance,'procedural clearance feature not installed');controller();existing();check(r.kind==='operation-reference','ruling requires operation reference');check(proceduralRule(features,r.target.office,r.target.op,timestamp).mode!=='exempt','procedural reference is exempt; no clearance fabricated');
      check(['release','return','require-policy'].includes(a.ruling),'invalid clearance ruling');
      check(!(r.status==='policy-required'&&a.ruling==='release'),'fresh policy proposal and reference required');
      check(!all.procedure.records.some(next=>next.priorReferenceId===r.id),'reference superseded; rule on current reference');
      // A ruling cannot silently refresh a stale target; a new reference is required.
      officeDecision(assignments,events,r.target,r.targetActorId,timestamp,eventId+'-target',articles,undefined,{features,bypassClearance:true});
      r.status={release:'released',return:'returned','require-policy':'policy-required'}[a.ruling];r.ruling=a.ruling;r.coordinator=actor;
    }else if(a.op==='file'){evidence(a.policyId);check(events.some(e=>e.id===a.policyId&&e.action==='policy'),'docket source must be policy');make({policyId:a.policyId,ambiguity:text(a.ambiguity),interpretation:text(a.interpretation),status:'open'});}
    else {controller();existing();if(a.op==='dispose'){r.status='operative';r.interpretation=text(a.interpretation);r.coordinator=actor;}else if(a.op==='clarify')r.status='clarification';else throw Error('unknown docket operation');}
  }else if(a.office==='admission') {
    if(a.op==='submit'){
      const b=article(a.articleId,a.revisionId),claim=text(a.claim,1500);passageIn(b.body,claim);check(o.rubric.includes(a.criterion),'criterion is not in current rubric');
      make({articleId:a.articleId,revisionId:a.revisionId,claim,criterion:a.criterion,status:'unreviewed',reviews:[]});
    }else if(a.op==='rubric'){controller();check(Array.isArray(a.criteria)&&a.criteria.length>0&&a.criteria.length<=10,'rubric requires 1–10 criteria');d.rubric=a.criteria.map(x=>text(x,300));return {decision:d,effects};}
    else {controller();existing();check(a.op==='review'&&['admitted','limited','unsupported'].includes(a.status),'invalid admission status');if(r.kind==='release-premise'){check(premiseIsCurrent(all,r),'stale release premise');r.reviewedBinding=r.binding;}else article(r.articleId,r.revisionId);r.status=a.status;r.reviewer=actor;r.reviews.push({...copy(d),status:a.status,rubric:copy(o.rubric)});}
  }else if(a.office==='exceptions') {
    const expiry=()=>{check(typeof a.expiresAt==='string'&&Number.isFinite(Date.parse(a.expiresAt))&&Date.parse(a.expiresAt)>Date.parse(timestamp),'expiry must be future ISO date');return new Date(a.expiresAt).toISOString();};
    if(a.op==='propose'){check(!a.sponsorId||a.sponsorId===actor,'sponsor must be proposing actor');if(a.type!==undefined){check(featureActive(features,'admitted-default-exception',timestamp)&&a.type==='admitted-default','unsupported exception type');check(actor===all.admission?.assignment.editorId,'current admission registrar must sponsor navigation exception');}
      make({scope:text(a.scope),sponsorId:actor,expiresAt:expiry(),reviewer:o.assignment.editorId,...(a.type?{type:a.type,effect:'admitted-default',periods:[]}: {})});}
    else {existing();if(a.op==='renew'){check(actor===r.sponsorId,'sponsor required for renewal');if(r.type==='admitted-default')check(actor===all.admission?.assignment.editorId,'current registrar required for navigation renewal');r.expiresAt=expiry();r.status='renewal-requested';}
      else {controller();check(['proposed','renewal-requested'].includes(r.status)||(r.type==='admitted-default'&&a.op==='reject'&&r.status==='approved'),'exception needs proposal or renewal');if(a.op==='approve'){check(r.expiresAt>timestamp,'exception already expired');if(r.type==='admitted-default'){check(Date.parse(r.expiresAt)-Date.parse(timestamp)<=24*3600000,'navigation approval period exceeds24 simulated hours');check(r.sponsorId===all.admission?.assignment.editorId,'current registrar sponsorship required');r.approvedAt=timestamp;r.approvedUntil=r.expiresAt;r.periods.push({approvedAt:timestamp,expiresAt:r.expiresAt,reviewer:actor,sponsorId:r.sponsorId,eventId,reason});}r.status='approved';r.reviewer=actor;}else if(a.op==='reject')r.status='rejected';else throw Error('unknown exception operation');}
    }
  }else throw Error('unknown office');
  r.version++;r.history.push(copy(d));d.record=r;
  return {decision:d,effects};
}

const wikiLinks = body => [...body.matchAll(/\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]/g)].map(m=>m[0]);
const linkMask = body => body.replace(/\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]/g,'\u0000');
const linkWords = body => body.replace(/\[\[([a-z][a-z0-9-]*)(?:\|([^\]\n]+))?\]\]/g,(_,id,label)=>label??id);
export const mechanicallyEquivalent = (a,b) => linkMask(a)===linkMask(b)||(JSON.stringify(wikiLinks(a))!==JSON.stringify(wikiLinks(b))&&linkWords(a)===linkWords(b));
export function applyMechanicalPatches(body,patches){
  let out=body;for(const patch of [...patches].sort((a,b)=>b.start-a.start)){check(out.slice(patch.start,patch.start+patch.before.length)===patch.before,'mechanical patch base mismatch');out=out.slice(0,patch.start)+patch.after+out.slice(patch.start+patch.before.length);}return out;
}
function validateMechanicalPatches(body,patches){
  check(Array.isArray(patches)&&patches.length<=8,'at most eight mechanical patches');let end=-1;
  const result=[...patches].sort((a,b)=>a.start-b.start).map(p=>{check(p&&Object.keys(p).every(k=>['start','before','after'].includes(k))&&Number.isInteger(p.start)&&p.start>=0&&p.start>end&&typeof p.before==='string'&&typeof p.after==='string'&&p.before.length+p.after.length<=200000,'invalid exact mechanical patch');check(body.slice(p.start,p.start+p.before.length)===p.before,'mechanical patch base mismatch');end=p.start+p.before.length-1;return copy(p);});
  const after=applyMechanicalPatches(body,result);check(after.length<=100000&&mechanicallyEquivalent(body,after),'mechanical patches cannot change substantive prose');
  check(!/<\/?[a-z!][^>]*>/i.test(after)&&!/\b(?:https?:\/\/|javascript:|data:)/i.test(after),'mechanical patches contain prohibited markup');
  const stripped=after.replace(/\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]/g,'');check(!stripped.includes('[[')&&!stripped.includes(']]'),'mechanical patches contain malformed wikilink');return result;
}
function bodyPatch(before,after){
  if(before===after)return [];
  let left=0,a=before.length,b=after.length;while(left<a&&left<b&&before[left]===after[left])left++;
  while(a>left&&b>left&&before[a-1]===after[b-1]){a--;b--;}
  return [{start:left,before:before.slice(left,a),after:after.slice(left,b)}];
}
// Classify before publication; never silently infer separability inside a changed prose passage.
export function mechanicalPlan(before,proposed){
  let proseBody=proposed.body,ambiguous=false;
  if(before.body!==proposed.body&&mechanicallyEquivalent(before.body,proposed.body))proseBody=before.body;
  else if(before.body!==proposed.body){
    const oldLines=before.body.split('\n'),newLines=proposed.body.split('\n'),originalNewLines=[...newLines];
    const resolvedOld=[],resolvedNew=[];
    for(let i=0;i<newLines.length;i++){
      const candidates=oldLines.map((line,j)=>mechanicallyEquivalent(line,originalNewLines[i])?j:-1).filter(j=>j>=0);if(candidates.length!==1)continue;
      const j=candidates[0];if(originalNewLines.filter(line=>mechanicallyEquivalent(oldLines[j],line)).length!==1)continue;
      const oldLinks=wikiLinks(oldLines[j]),newLinks=wikiLinks(newLines[i]);
      if(JSON.stringify(oldLinks)!==JSON.stringify(newLinks)){newLines[i]=oldLines[j];resolvedOld.push(...oldLinks);resolvedNew.push(...newLinks);}
    }
    const subtract=(list,removed)=>{const pool=[...removed];return list.filter(x=>{const i=pool.indexOf(x);if(i<0)return true;pool.splice(i,1);return false;});};
    const oldRemaining=subtract(wikiLinks(before.body),resolvedOld),newRemaining=subtract(wikiLinks(proposed.body),resolvedNew);
    const removed=subtract(oldRemaining,newRemaining),added=subtract(newRemaining,oldRemaining);
    let cursor=0;for(const line of originalNewLines)if(line===oldLines[cursor])cursor++;const oldProseUnchanged=cursor===oldLines.length;
    const oldPlain=before.body.replace(/\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]/g,''),newPlain=proposed.body.replace(/\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]/g,'');
    const wrappingExisting=added.some(link=>oldPlain.toLowerCase().includes(linkWords(link).toLowerCase()));
    const unwrappingExisting=removed.some(link=>newPlain.toLowerCase().includes(linkWords(link).toLowerCase()));
    ambiguous=removed.length>0&&added.length>0||!oldProseUnchanged&&(wrappingExisting||unwrappingExisting);
    proseBody=newLines.join('\n');
  }
  const titleChanged=proposed.title!==before.title,categoriesChanged=JSON.stringify(proposed.categories)!==JSON.stringify(before.categories),patches=bodyPatch(proseBody,proposed.body);
  const mechanical=titleChanged||categoriesChanged||Boolean(proposed.toArticleId)||patches.length>0||ambiguous;
  return {mechanical,ambiguous,proseBody,proseChanged:proseBody!==before.body,change:{kind:'mechanical',articleId:before.id,revisionId:before.revisionId,patches,...(titleChanged?{title:proposed.title}:{}),...(categoriesChanged?{categories:copy(proposed.categories)}:{}),...(proposed.toArticleId?{toArticleId:proposed.toArticleId}:{})}};
}
export function maintenanceIntake(assignments,events,before,proposed,actor,timestamp,eventId,{proseRevisionId=eventId}={}){
  const office=officeState(assignments,events,timestamp).maintenance;check(office,'maintenance office required for intake');
  const plan=mechanicalPlan(before,proposed);if(!plan.mechanical)return null;
  const reason=plan.ambiguous?'Returned: linked navigation and prose changed in the same unresolved passage; submit separately.':'Mechanical changes queued; exact coordinator approval and execution required before live publication.';
  const change=copy(plan.change);if(!plan.ambiguous&&plan.proseChanged)change.revisionId=proseRevisionId;
  const decision={office:'maintenance',op:plan.ambiguous?'intake-return':'intake',actor,timestamp,eventId,reason,references:[before.revisionId]};
  const record={id:eventId,version:1,proposer:actor,status:plan.ambiguous?'returned':'proposed',changes:plan.ambiguous?[]:[change],sourceEventId:eventId,history:[copy(decision)]};
  decision.record=record;
  return {decision,explanation:reason,prosePublished:!plan.ambiguous&&plan.proseChanged,submitted:{title:proposed.title,body:proposed.body,categories:copy(proposed.categories),...(proposed.toArticleId?{toArticleId:proposed.toArticleId}:{})},proseBody:plan.proseBody};
}

// Bind premise content separately from mutable review/history counters.
export function premiseIsCurrent(offices,premise){
  const ref=offices.procedure?.records.find(r=>r.id===premise.referenceId);
  if(!ref||offices.procedure.records.some(r=>r.priorReferenceId===ref.id)||canonical(ref.target)!==canonical(premise.frozenTarget))return false;
  if(ref.version===premise.referenceVersion)return true;
  const binding=ref.releaseBinding;
  return binding?.premiseId===premise.id&&binding.binding===premise.binding&&[binding.releasedVersion,binding.consumedVersion].includes(ref.version);
}
export function defaultSelection(offices,features=[],at='9999'){
  if(!featureActive(features,'admitted-default-exception',at))return {entryView:offices.admission?'admitted':'main',exception:null,exceptionRequired:false};
  const sponsor=offices.admission?.assignment.editorId,reviewer=offices.exceptions?.assignment.editorId;
  const live=(offices.exceptions?.records??[]).filter(r=>r.type==='admitted-default'&&r.effect==='admitted-default'&&r.status==='approved'&&r.sponsorId===sponsor&&r.reviewer===reviewer&&r.approvedAt<=at&&r.expiresAt>at&&r.approvedUntil===r.expiresAt&&Date.parse(r.expiresAt)-Date.parse(r.approvedAt)<=24*3600000).sort((a,b)=>b.approvedAt.localeCompare(a.approvedAt)||a.id.localeCompare(b.id))[0]??null;
  return {entryView:live?'admitted':'articles',exceptionRequired:true,exception:live?{id:live.id,sponsorId:live.sponsorId,reviewer:live.reviewer,expiresAt:live.expiresAt,status:live.status}:null};
}
function publicConsequence(office,op,actor,timestamp,eventId,reason,references,record){
  const d={office,op,actor,timestamp,eventId,reason,references:copy(references)};
  if(record){const next=copy(record);next.version++;next.history.push(copy(d));d.record=next;}
  return d;
}
export function officeDecision(assignments,events,raw,actor,timestamp,eventId,articles,knownIds,options={}){
  const features=options.features??[];
  if(options.bypassClearance)return baseOfficeDecision(assignments,events,raw,actor,timestamp,eventId,articles,knownIds,options);
  const automatic=proceduralRule(features,raw?.office,raw?.op,timestamp).mode==='automatic';
  // Validate permissions, state and article bases BEFORE producing any dependency work.
  const result=baseOfficeDecision(assignments,events,raw,actor,timestamp,eventId,articles,knownIds,{...options,bypassClearance:automatic});
  const all=officeState(assignments,events,timestamp,features);
  if(raw.office==='procedure'&&raw.op==='rule'&&raw.ruling==='release'&&featureActive(features,'procedural-premise-admission',timestamp)){
    const ref=all.procedure.records.find(r=>r.id===raw.id);
    check(raw.references.includes(raw.mandateId),'release must cite governing mandate');
    const mandate=events.find(e=>e.id===raw.mandateId&&e.action==='policy'&&e.timestamp<=timestamp);check(mandate,'governing public mandate required');
    const mandatePassage=text(raw.mandatePassage,1500),rationale=text(raw.rationale,1500);passageIn(mandate.body,mandatePassage);
    const advisory=featureActive(features,'advisory-procedural-premises',timestamp);
    const releasePayload=copy(raw);if(advisory){delete releasePayload.clerkResponse;delete releasePayload.findingId;delete releasePayload.findingVersion;}
    const content={referenceId:ref.id,referenceVersion:ref.version,frozenTarget:copy(ref.target),mandateId:mandate.id,mandatePassage,rationale,releasePayload};
    const binding=canonical(content);
    const premise=(all.admission?.records??[]).find(r=>r.kind==='release-premise'&&r.binding===binding);
    check(all.admission,'admission office required for release premise');
    if(advisory){
      delete result.decision.record.clerkResponse;delete result.decision.record.clerkResponseCurrent;
      const negative=premise&&['limited','unsupported'].includes(premise.status);
      if(negative){check(premiseIsCurrent(all,premise),'stale advisory finding');check(raw.findingId===premise.id&&raw.findingVersion===premise.version,'clerk response must name the exact current finding');result.decision.record.clerkResponse=text(raw.clerkResponse,1500);}
      else check(raw.clerkResponse===undefined&&raw.findingId===undefined&&raw.findingVersion===undefined,'response has no matching current negative finding');
      const id=premise?.id??eventId;result.decision.record.releaseBinding={premiseId:id,premiseVersion:premise?.premiseVersion??1,referenceVersion:ref.version,releasedVersion:result.decision.record.version,binding,advisory:true,...(negative?{findingVersion:premise.version,findingStatus:premise.status}:{})};
      result.decision.record.releasePremiseId=id;result.decision.record.premiseStatusAtRelease=premise?.status??'unreviewed';
      if(!premise){const d=publicConsequence('admission','advisory-premise-intake',actor,timestamp,eventId,'Unreviewed advisory release premise; no claim admission or registrar finding asserted.',raw.references);d.record={id:eventId,version:1,premiseVersion:1,kind:'release-premise',proposer:actor,status:'unreviewed',...content,binding,sourceEventId:eventId,reviews:[],history:[copy(d)]};result.consequences=[d];}
    }else if(premise?.status==='admitted'&&premise.reviewer===all.admission.assignment.editorId&&premise.reviewedBinding===binding&&premiseIsCurrent(all,premise)){
      result.decision.record.releaseBinding={premiseId:premise.id,premiseVersion:premise.premiseVersion,referenceVersion:ref.version,releasedVersion:result.decision.record.version,binding};
      result.decision.record.releasePremiseId=premise.id;
    }else{
      const explanation='Release not executed: '+(premise?.status??'unreviewed')+' premise requires current registrar admission.';
      const d=publicConsequence('admission',premise?'premise-retry':'premise-intake',actor,timestamp,eventId,explanation,raw.references);
      if(!premise)d.record={id:eventId,version:1,premiseVersion:1,kind:'release-premise',proposer:actor,status:'unreviewed',...content,binding,sourceEventId:eventId,reviews:[],history:[copy(d)]};
      else d.premiseId=premise.id;
      return {decision:d,effects:[],explanation};
    }
  }
  if(automatic){
    const refs=(all.procedure?.records??[]).filter(r=>r.kind==='operation-reference');check(all.procedure,'procedural office required for automatic intake');
    const active=refs.filter(r=>operationKey(r.target)===operationKey(raw)&&!refs.some(next=>next.priorReferenceId===r.id));check(active.length<=1,'ambiguous current operation reference');
    const current=active[0],exact=current&&canonical(current.target)===canonical(raw);
    if(exact&&current.status==='released'){
      const binding=current.releaseBinding;
      if(binding){const premise=all.admission?.records.find(r=>r.id===binding.premiseId);check(premise&&premise.binding===binding.binding&&premiseIsCurrent(all,premise)&&(binding.advisory||(premise.status==='admitted'&&premise.reviewedBinding===binding.binding)),'release premise is no longer admitted/current');}
      const consumed=publicConsequence('procedure','clearance-consumed',actor,timestamp,eventId,'Exact released operation executed once.',raw.references,current);
      consumed.record.status='consumed';consumed.record.consumedBy=eventId;
      if(consumed.record.releaseBinding)consumed.record.releaseBinding.consumedVersion=consumed.record.version;
      result.consequences=[consumed];
    }else{
      const explanation='Operation not applied: procedural '+(exact?current.status:'clearance')+' requires clerk ruling.';
      const d=publicConsequence('procedure',exact?'automatic-reference-retry':'automatic-reference',actor,timestamp,eventId,explanation,raw.references);
      if(exact)d.referenceId=current.id;
      else{
        const policyRequiredAfter=current?.status==='policy-required'?current.history.at(-1).timestamp:current?.policyRequiredAfter;
        const fresh=events.findLast(e=>raw.references.includes(e.id)&&e.action==='policy'&&(!policyRequiredAfter||e.timestamp>policyRequiredAfter));
        const policyId=fresh?.id??all[raw.office].assignment.requestId;
        d.record={id:eventId,version:1,kind:'operation-reference',automatic:true,proposer:actor,status:policyRequiredAfter&&!fresh?'policy-required':'held',target:copy(raw),targetActorId:actor,sourceEventId:eventId,policyId,ambiguity:'Automatic prospective office-operation screening; no effect has executed.',...(current?{priorReferenceId:current.id}:{}),...(policyRequiredAfter?{policyRequiredAfter}:{}),history:[copy(d)]};
      }
      return {decision:d,effects:[],explanation};
    }
  }
  return careConcurrenceGate(raw,actor,timestamp,eventId,articles,features,all,result);
}

function concurrenceSnapshot(all,target,articles){
  const operationRecord=all[target.office]?.records.find(r=>r.id===target.id);if(!operationRecord)return null;
  const admission=target.office==='admission'&&target.op==='review';if(admission&&(!operationRecord.articleId||operationRecord.kind==='release-premise'))return null;
  const ids=new Set(admission?[operationRecord.articleId]:operationRecord.changes.map(c=>c.articleId));
  const cases=(all.care?.records??[]).filter(r=>r.status==='open'&&ids.has(r.articleId)).map(r=>({id:r.id,version:r.version,articleId:r.articleId})).sort((a,b)=>a.id.localeCompare(b.id));
  const bases=[...ids].sort().map(articleId=>({articleId,revisionId:articles.get(articleId)?.revisionId??articles.get(articleId)}));
  return {target:copy(target),careRecords:cases,articleBases:bases,...(admission?{admissionRecord:{id:operationRecord.id,version:operationRecord.version,articleId:operationRecord.articleId,revisionId:operationRecord.revisionId}}:{})};
}
export function concurrenceIsCurrent(all,record,articles){
  const current=concurrenceSnapshot(all,record.target,articles);if(!current||!current.careRecords.length)return false;
  const operationRecord=all[record.target.office]?.records.find(r=>r.id===record.target.id);return operationRecord?.version===record.target.version&&canonical(current)===record.binding;
}
function careConcurrenceGate(raw,actor,timestamp,eventId,articles,features,all,result){
  const maintenance=featureActive(features,'care-concurrence-exemption',timestamp)&&raw.office==='maintenance'&&raw.op==='execute';
  const admission=featureActive(features,'independent-care-admission-concurrence',timestamp)&&raw.office==='admission'&&raw.op==='review';
  if(!maintenance&&!admission)return result;
  const snapshot=concurrenceSnapshot(all,raw,articles);if(!snapshot?.careRecords.length)return result;
  const kind=admission?'admission-concurrence':'maintenance-concurrence';
  const binding=canonical(snapshot),record=all.care.records.find(r=>r.kind===kind&&r.binding===binding);
  if(record?.status==='granted'&&record.coordinator===all.care.assignment.editorId&&concurrenceIsCurrent(all,record,articles))return result;
  const explanation=(admission?'Article-claim review':'Maintenance')+' not executed: care concurrence '+(record?.status??'pending')+' for exact payload, article bases and open case versions.';
  const d=publicConsequence('care',record?'concurrence-retry':'concurrence-intake',actor,timestamp,eventId,explanation,raw.references);
  if(record)d.concurrenceId=record.id;else d.record={id:eventId,version:1,kind:admission?'admission-concurrence':'maintenance-concurrence',proposer:actor,status:'pending',...snapshot,binding,sourceEventId:eventId,history:[copy(d)]};
  return {decision:d,effects:[],explanation};
}
