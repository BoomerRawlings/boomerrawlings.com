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
const copy = x => structuredClone(x);
const check = (x,m) => {if(!x)throw Error(m);};
const text = (x,n=1000) => {check(typeof x==='string'&&x.trim()&&x.length<=n&&!/<\/?[a-z!][^>]*>|\b(?:https?:\/\/|javascript:|data:)/i.test(x),'bounded public text required');return x.trim();};
const slug = x => {check(typeof x==='string'&&/^[a-z][a-z0-9-]{0,119}$/.test(x),'invalid office ID');return x;};
const revActions = new Set(['create','expand','revise','revert','organize']);
export function visibleRevisions(events, at) {
  const result=[];
  for(const e of [...events].filter(e=>e.timestamp<=at).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.id.localeCompare(b.id))) {
    if(revActions.has(e.action)&&!e.reviewDraft)result.push(e);
    for(const [i,effect] of (e.articleEffects??[]).entries())result.push({...effect,id:e.id,revisionId:e.id,timestamp:e.timestamp,editorId:e.editorId,action:'organize',sourceEventId:e.id});
  }
  return result;
}
export function officeState(assignments=[],events=[],at='9999') {
  const offices={};
  for(const a of assignments.filter(a=>a.timestamp<=at)) offices[a.office]??={assignment:copy(a),records:[],order:[],rubric:copy(a.rubric??[]),rubricHistory:[],reassignments:[],history:[],enabled:true};
  for(const e of [...events].filter(e=>e.timestamp<=at&&e.officeDecision).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.id.localeCompare(b.id))) {
    const d=e.officeDecision,o=offices[d.office];if(!o)continue;
    const {office,op,actor,timestamp,eventId,reason,references}=d;o.history.push({office,op,actor,timestamp,eventId,reason,references:copy(references)});
    if(d.record){const i=o.records.findIndex(r=>r.id===d.record.id);if(i<0)o.records.push(copy(d.record));else o.records[i]=copy(d.record);}
    if(d.order)o.order=copy(d.order);
    if(d.enabled!==undefined)o.enabled=d.enabled;
    if(d.rubric){o.rubric=copy(d.rubric);o.rubricHistory.push(copy(d));}
    if(d.reassignment)o.reassignments.push(copy(d));
  }
  const current=new Map(visibleRevisions(events,at).map(e=>[e.articleId,e.revisionId]));
  for(const [name,o] of Object.entries(offices)) {
    for(const r of o.records){
      if(name==='exceptions'&&r.status==='approved'&&r.expiresAt<=at)r.status='expired';
      if(name==='admission')r.current=current.get(r.articleId)===r.revisionId;
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
export function officeDecision(assignments,events,raw,actor,timestamp,eventId,articles,knownIds) {
  check(raw&&typeof raw==='object'&&!Array.isArray(raw)&&JSON.stringify(raw).length<=12000,'bounded office action required');
  const allowed=['office','op','id','version','reason','references','changes','ids','articleId','revisionId','passage','sourceEventId','draftId','baseRevisionId','policyId','ambiguity','interpretation','claim','criterion','status','criteria','scope','expiresAt','sponsorId','editorId'];
  check(Object.keys(raw).every(k=>allowed.includes(k)),'unknown office field');
  const a=copy(raw),all=officeState(assignments,events,timestamp),o=all[a.office];check(o,'office not installed');
  const reason=text(a.reason),refs=a.references;
  check(Array.isArray(refs)&&refs.length>0&&refs.length<=8&&new Set(refs).size===refs.length&&refs.every(id=>events.some(e=>e.id===id&&e.timestamp<=timestamp)&&(!knownIds||knownIds.includes(id))),'office references must be observed public events');
  const controller=()=>check(actor===o.assignment.editorId,'assigned office controller required');
  const evidence=id=>check(refs.includes(id),'exact source must be cited in references');
  const article=(id,revisionId)=>{const r=articles.get(id);check(r&&r.revisionId===revisionId,'stale article revision');evidence(revisionId);return r;};
  let r=a.id?o.records.find(r=>r.id===a.id):null;
  const existing=()=>{check(r,'unknown office record');check(Number.isInteger(a.version)&&a.version===r.version,'stale office record version');r=copy(r);};
  const d={office:a.office,op:a.op,actor,timestamp,eventId,reason,references:copy(refs)};
  let effects=[];
  const make=fields=>{check(!a.id,'new record ID is assigned from action event');r={id:eventId,version:0,proposer:actor,status:'proposed',history:[],...fields};};
  const changes=()=>{
    check(Array.isArray(a.changes)&&a.changes.length>0&&a.changes.length<=8,'batch requires 1–8 changes');
    const destinations=a.changes.filter(c=>c.kind==='move').map(c=>c.toArticleId);check(new Set(destinations).size===destinations.length,'duplicate move destination');
    check(new Set(a.changes.map(c=>c.articleId)).size===a.changes.length,'one change per article in batch');
    return a.changes.map(c=>{
      check(c&&Object.keys(c).every(k=>['kind','articleId','revisionId','find','replace','categories','title','toArticleId'].includes(k)),'invalid batch change');
      const before=article(c.articleId,c.revisionId),out={kind:c.kind,articleId:c.articleId,revisionId:c.revisionId};
      if(c.kind==='link'){
        out.find=text(c.find,500);out.replace=text(c.replace,500);passageIn(before.body,out.find);
        check(/^\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]$/.test(out.find)&&/^\[\[[a-z][a-z0-9-]*(?:\|[^\]\n]+)?\]\]$/.test(out.replace),'link repair must replace one exact wikilink');
        check(articles.has(out.replace.slice(2,-2).split('|')[0]),'unknown repair target');
      }else if(c.kind==='category'){check(Array.isArray(c.categories)&&c.categories.length>0&&c.categories.length<=8,'bounded categories required');out.categories=c.categories.map(x=>text(x,60));}
      else if(c.kind==='move'){out.title=text(c.title,100);out.toArticleId=slug(c.toArticleId);check(!articles.has(out.toArticleId)&&!visibleRevisions(events,timestamp).some(e=>e.alias===out.toArticleId),'move destination exists');}
      else throw Error('unsupported maintenance kind');
      return out;
    });
  };
  if(a.office==='maintenance'&&['suspend','resume'].includes(a.op)){controller();d.enabled=a.op==='resume';return {decision:d,effects};}
  check(a.office!=='maintenance'||o.enabled||a.op==='challenge','maintenance queue is suspended');
  if(a.op==='challenge') {existing();if(a.office==='maintenance'&&r.status==='approved')r.approvedVersion=r.version+1;}
  else if(a.op==='reassign') {
    check(['procedure','admission','exceptions'].includes(a.office),'reassignment proposal unavailable');
    d.reassignment={editorId:slug(a.editorId),status:'proposed'};return {decision:d,effects};
  }else if(a.op==='order') {
    controller();check(['maintenance','care','procedure'].includes(a.office),'office has no ordering');
    const ids=o.records.filter(r=>!['closed','declined','refused','executed'].includes(r.status)).map(r=>r.id);
    check(Array.isArray(a.ids)&&a.ids.length===ids.length&&new Set(a.ids).size===ids.length&&ids.every(id=>a.ids.includes(id)),'order must contain every open record exactly once');
    d.order=copy(a.ids);return {decision:d,effects};
  }else if(a.office==='maintenance') {
    if(a.op==='submit')make({changes:changes()});
    else {existing();check(r.status!=='executed','batch already executed');
      if(a.op==='amend'){check(actor===r.proposer||actor===o.assignment.editorId,'batch proposer or coordinator required');r.changes=changes();r.status='proposed';delete r.approvedVersion;}
      else {controller();
        if(a.op==='approve'){for(const c of r.changes)article(c.articleId,c.revisionId);r.status='approved';r.approvedVersion=r.version+1;}
        else if(a.op==='refuse'){r.status='refused';delete r.approvedVersion;}
        else if(a.op==='execute'){
          check(r.status==='approved'&&r.approvedVersion===r.version,'current exact batch needs approval');
          effects=r.changes.map(c=>{const b=article(c.articleId,c.revisionId);return {articleId:b.id,title:c.title??b.title,body:c.kind==='link'?b.body.replace(c.find,c.replace):b.body,categories:c.categories??copy(b.categories),principleIds:copy(b.principleIds),baseRevisionId:b.revisionId,...(c.kind==='move'?{alias:c.toArticleId}:{})};});
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
      if(a.op==='open'){
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
    if(a.op==='file'){evidence(a.policyId);check(events.some(e=>e.id===a.policyId&&e.action==='policy'),'docket source must be policy');make({policyId:a.policyId,ambiguity:text(a.ambiguity),interpretation:text(a.interpretation),status:'open'});}
    else {controller();existing();if(a.op==='dispose'){r.status='operative';r.interpretation=text(a.interpretation);r.coordinator=actor;}else if(a.op==='clarify')r.status='clarification';else throw Error('unknown docket operation');}
  }else if(a.office==='admission') {
    if(a.op==='submit'){
      const b=article(a.articleId,a.revisionId),claim=text(a.claim,1500);passageIn(b.body,claim);check(o.rubric.includes(a.criterion),'criterion is not in current rubric');
      make({articleId:a.articleId,revisionId:a.revisionId,claim,criterion:a.criterion,status:'unreviewed',reviews:[]});
    }else if(a.op==='rubric'){controller();check(Array.isArray(a.criteria)&&a.criteria.length>0&&a.criteria.length<=10,'rubric requires 1–10 criteria');d.rubric=a.criteria.map(x=>text(x,300));return {decision:d,effects};}
    else {controller();existing();check(a.op==='review'&&['admitted','limited','unsupported'].includes(a.status),'invalid admission status');article(r.articleId,r.revisionId);r.status=a.status;r.reviewer=actor;r.reviews.push({...copy(d),status:a.status,rubric:copy(o.rubric)});}
  }else if(a.office==='exceptions') {
    const expiry=()=>{check(typeof a.expiresAt==='string'&&Number.isFinite(Date.parse(a.expiresAt))&&Date.parse(a.expiresAt)>Date.parse(timestamp),'expiry must be future ISO date');return new Date(a.expiresAt).toISOString();};
    if(a.op==='propose'){check(!a.sponsorId||a.sponsorId===actor,'sponsor must be proposing actor');make({scope:text(a.scope),sponsorId:actor,expiresAt:expiry(),reviewer:o.assignment.editorId});}
    else {existing();if(a.op==='renew'){check(actor===r.sponsorId,'sponsor required for renewal');r.expiresAt=expiry();r.status='renewal-requested';}
      else {controller();check(['proposed','renewal-requested'].includes(r.status),'exception needs proposal or renewal');if(a.op==='approve'){check(r.expiresAt>timestamp,'exception already expired');r.status='approved';r.reviewer=actor;}else if(a.op==='reject')r.status='rejected';else throw Error('unknown exception operation');}
    }
  }else throw Error('unknown office');
  r.version++;r.history.push(copy(d));d.record=r;
  return {decision:d,effects};
}
