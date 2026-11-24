const $=(s,r=document)=>r.querySelector(s);
const el=(tag,opts={},...kids)=>{
  const out=document.createElement(tag);
  for(const [k,v] of Object.entries(opts)) if(v!==undefined&&v!==null) out.setAttribute(k,v);
  out.append(...kids.filter(x=>x!==undefined&&x!==null));return out;
};
const svg=(tag,opts={})=>{
  const out=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const [k,v] of Object.entries(opts)) out.setAttribute(k,v);
  return out;
};
const bytes=(v)=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const initialHash=location.hash;
let access=window.self===window.top && /^#k=[A-Za-z0-9_-]{43}$/.test(initialHash)?initialHash.slice(3):null;
if(initialHash) { try { history.replaceState(null,'',location.pathname); } catch { access=null; } }
const gate=$('#gate'), work=$('#workspace'), wipe=$('#wipe'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
const feedback=(s)=>{$('#feedback').textContent=s;};
let busy=false, generation=0, current=null;
const tabs=[
  ['map','Atlas'],['direction','Direction'],['mentors','Mentors'],['roadmap','Roadmap'],['library','Reading & PhD']
];
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const move=async(frames,duration)=>{
  try { const a=wipe.animate(frames,{duration,easing:'cubic-bezier(.4,0,.12,1)',fill:'both'}); await Promise.race([a.finished,wait(duration+60)]); return a; } catch {return null;}
};
async function transition(update){
  if(busy) return;
  if(reduced.matches || typeof wipe.animate!=='function'){update();return;}
  busy=true; wipe.hidden=false;
  let cover, reveal;
  try {
    cover=await move([{transform:'translateX(-106%)'},{transform:'translateX(0)'}],225);
    update();
    reveal=await move([{transform:'translateX(0)'},{transform:'translateX(106%)'}],320);
  } finally {
    cover?.cancel();reveal?.cancel();wipe.hidden=true;busy=false;
  }
}
async function open(){
  if(!access){feedback('This door needs your private access link. Solving the riddle alone does not unlock the notes.');return;}
  if(busy)return;
  busy=true;
  const ticket=++generation;
  try {
    const res=await fetch('/hub/notebook.json',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
    if(!res.ok)throw new Error();
    const envelope=await res.json();
    if(envelope.v!==1 || !crypto.subtle) throw new Error();
    const raw=bytes(access);
    access=null;
    let key;
    try {key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);} finally {raw.fill(0);}
    const buffer=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv),additionalData:new TextEncoder().encode('boomer-research-hub-v1')},key,bytes(envelope.data));
    const data=JSON.parse(new TextDecoder().decode(buffer));new Uint8Array(buffer).fill(0);
    if(ticket!==generation)return;
    busy=false;
    await transition(()=>{if(ticket===generation) render(data);});
  } catch { access=null; if(ticket===generation)feedback('This access link could not open the notes. Reopen your current private link.'); }
  finally{if(ticket===generation) busy=false;}
}
function close(){
  generation++;access=null;current=null;busy=false;
  wipe.getAnimations?.().forEach(a=>a.cancel());wipe.hidden=true;
  $('#views').replaceChildren();$('#tabs').replaceChildren();$('#workspace-lede').textContent='';$('#edition').textContent='';
  gate.hidden=false;work.hidden=true;$('#lock').hidden=true;$('#lock-state').hidden=false;
  $('#answer').reset();$('.hint').open=false;
  document.body.classList.remove('open');
  feedback('Hub sealed. Reopen your private link to use it again.');
}
$('#lock').addEventListener('click',()=>{close();$('#guess').focus();});
addEventListener('pagehide',()=>{if(!work.hidden || busy || access)close();});
addEventListener('pageshow',e=>{if(e.persisted)close();});
$('#answer').addEventListener('submit',(e)=>{
  e.preventDefault();
  const answer=$('#guess').value.normalize('NFKC').toLowerCase().replace(/[^a-z ]/g,' ').trim().replace(/\s+/g,' ').replace(/^a |^the /,'');
  if(!['threshold','decision threshold','switching threshold','switch threshold','evidence threshold'].includes(answer)){feedback('Not quite. Think of the point that separates “hold” from “adapt.”');return;}
  feedback('');open();
});
$('#skip').addEventListener('click',open);
function link(label,value){
  try {
    const u=new URL(value);
    if(u.protocol==='https:')return el('a',{href:u.href,target:'_blank',rel:'noopener noreferrer',referrerpolicy:'no-referrer'},label);
  } catch {}
  return null;
}
function head(kicker,title,body){return el('div',{class:'area-head'},el('small',{class:'mono'},kicker),el('h2',{},title),body&&el('p',{},body));}
function card(title,kicker,...body){return el('article',{class:'panel card'},el('small',{class:'mono'},kicker),el('h3',{},title),...body);}
function grid(...kids){return el('div',{class:'cards'},...kids);}
const text=(s)=>s&&el('p',{},s);
function facts(obj){
  const nice=(s)=>s.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');
  return el('dl',{},...Object.entries(obj).filter(([,v])=>typeof v==='string'&&v).flatMap(([k,v])=>[el('dt',{},nice(k)),el('dd',{},v)]));
}
function mentorCard(m){return card(m.name,m.priority,text(m.affiliation),text(m.status),text(m.focus),text(m.fit),el('p',{},el('strong',{},'Ask: '),m.question),link('Faculty or lab ↗',m.url));}
function render(data){
  current='map';
  document.body.classList.add('open');gate.hidden=true;work.hidden=false;$('#lock').hidden=false;$('#lock-state').hidden=true;
  $('#edition').textContent=data.asOf;
  $('#workspace-lede').textContent=data.direction.question;
  const controls=$('#tabs'),views=$('#views');
  const panels={
    map:atlas(data),
    direction:el('section',{},head(data.direction.label,data.direction.headline,data.direction.summary),
       grid(card('The mechanism','Research question',text(data.direction.question),text(data.direction.mechanism),el('ul',{},...data.direction.evolution.map(x=>el('li',{},x)))),
       card(data.direction.pilot.title,'First experiment',...[['Design','design'],['Readout','readout'],['Limits','guardrail'],['Fallback','fallback']].map(([label,k])=>el('p',{},el('strong',{},label+': '),data.direction.pilot[k]))))),
    mentors:directory(data),
    roadmap:el('section',{},head('02 / Time box','Make each quarter count','Use an existing lab task or dataset so spring produces something useful before summer begins.'),
      grid(...data.roadmap.map(r=>card(r.period,'Milestone',text(r.summary))),...data.nextActions.map(r=>card(r.title,'Next action',text(r.summary))))),
    library:el('section',{},head('03 / Evidence','Reading and doctoral programs'),
      grid(...data.literature.map(r=>card(r.title,r.author,text(r.why),link('Read the source ↗',r.url))),
      ...data.programs.map(r=>card(r.school,r.track,text(r.fit),link('Program details ↗',r.url))),
      card('Planning references','Official sources',...data.sources.map(r=>link(r.label+' ↗',r.url)))))
  };
  for(const [id,label] of tabs){
    panels[id].hidden=id!==current;panels[id].id='view-'+id;
    views.append(panels[id]);
    const button=el('button',{type:'button','aria-controls':panels[id].id,'aria-pressed':id===current},label);
    button.addEventListener('click',()=>{if(current===id)return;transition(()=>{
      if(!work.hidden){current=id;for(const [k,v] of Object.entries(panels))v.hidden=k!==id;
      for(const b of controls.children)b.setAttribute('aria-pressed',String(b===button));}
    });});
    controls.append(button);
  }
  $('#workspace-title').focus();
}
function directory(data){
  const search=el('input',{class:'search',type:'search',placeholder:'Search name or research topic','aria-label':'Search mentor directory'});
  const out=grid();
  const status=el('small',{class:'mono',role:'status'});
  const fill=()=>{
    const q=search.value.trim().toLowerCase();
    const matches=data.mentors.filter(m=>[m.name,m.affiliation,m.priority,m.status,m.focus,m.fit].join(' ').toLowerCase().includes(q));
    out.replaceChildren(...matches.map(mentorCard));status.textContent=matches.length+' of '+data.mentors.length+' people';
  };
  search.addEventListener('input',fill);fill();
  return el('section',{},head('01 / People','Mentor field guide','Research fit is not availability. Outreach is marked only when known.'),
    el('div',{class:'bar'},search,status),out);
}
function atlas(data){
  const local=data.mentors.filter(m=>m.priority==='Shortlist');
  const short={'monitoring':'Monitoring','control':'Control','transfer':'Transfer','behavior':'Behavior','modeling':'Modeling','training':'Training','context':'Application'};
  const connections=[
    ['monitoring','control'],['control','transfer'],['behavior','monitoring'],['modeling','control'],['training','transfer'],['transfer','context']
  ].map(([source,target])=>({source,target,relationship:'hypothesis or method link',hypothesis:true}));
  const allNodes=[...data.graph.nodes.map(m=>({...m,name:m.label,kind:m.kind.toLowerCase()==='method'?'method':'mechanism',short:short[m.id]})),
    ...data.mentors.map(m=>({...m,kind:m.id==='baskin'?'external':'mentor',short:m.name.split(' ').slice(-1)[0]}))];
  const allLinks=[...data.graph.links,...connections];
  const selected=el('div',{class:'detail','aria-live':'polite'});
  const canvas=el('div',{class:'canvas'});
  const view=svg('svg',{viewBox:'0 0 760 490',role:'group','aria-label':'Connected research map. Select a node for details.'});
  canvas.append(view);
  const refs=el('div',{class:'noderefs'});
  const list=el('div',{class:'panel detail',hidden:''},el('h3',{},'Choose a node'),refs);
  const graph=el('div',{class:'map panel'},canvas,selected);
  const toggle=el('div',{class:'toolbar panel','aria-label':'Atlas controls'});
  let expanded=false, asList=false, id='monitoring';const lineEls=[],nodeEls=new Map(),refEls=new Map();
  const showNodes=()=>allNodes.filter(n=>expanded || n.kind!=='mentor' || local.some(m=>m.id===n.id));
  const descriptor={
    monitoring:'Separate noisy feedback from a genuine decline in strategy reliability.',
    control:'Decide whether to wait, seek evidence, or switch strategies.',
    transfer:'Ask whether a trained strategy is used independently on a new task.',
    behavior:'Track trial-level outcomes, choices, confidence or switching latency.',
    modeling:'Explain how evidence, expected correctness and uncertainty contribute to a policy change.',
    training:'Use prespecified outcomes and an active comparison. Separate improvement from extra exposure.',
    context:'Design for real needs over time. A low-stakes laboratory result does not establish real-world efficacy.'
  };
  const select=(nodeId)=>{
    id=nodeId;
    const n=allNodes.find(m=>m.id===id);if(!n)return;
    const related=allLinks.filter(l=>l.source===id||l.target===id)
      .map(l=>({data:allNodes.find(m=>m.id===(l.source===id?l.target:l.source)),link:l}));
    const active=new Set([id,...related.map(r=>r.data.id)]);
    for(const [key,btn] of nodeEls){btn.setAttribute('aria-pressed',String(key===id));btn.classList.toggle('dim',!active.has(key));}
    for(const [key,btn] of refEls) btn.setAttribute('aria-pressed',String(key===id));
    for(const [line,e] of lineEls)line.classList.toggle('hot',e.source===id||e.target===id);
    const content=[el('small',{class:'mono'},n.priority??(n.kind==='method'?'METHOD':'RESEARCH THREAD')),el('h3',{},n.name)];
    if(n.focus)content.push(facts({affiliation:n.affiliation,status:n.status,researchFit:n.focus,fitAssessment:n.fit,questionToAsk:n.question}),link('Faculty or lab ↗',n.url));
    else content.push(text(descriptor[id]));
    if(related.length)content.push(el('p',{class:'mono'},'Connected nodes'),el('ul',{},...related.map(r=>el('li',{},r.data.name+' · '+(r.link.hypothesis?'hypothesis or method':'research fit')))));
    selected.replaceChildren(...content.filter(Boolean));
  };
  function make(){
    const nodes=showNodes();
    const mentor=nodes.filter(n=>n.kind==='mentor'||n.kind==='external');
    const topics=nodes.filter(n=>!mentor.includes(n));
    const desktop=[[192,104],[386,85],[566,117],[166,277],[334,262],[514,286],[385,410]];
    const fit=new Map(topics.map((n,i)=>[n.id,desktop[i]]));
    mentor.forEach((n,i)=>{
      const a=(i/mentor.length)*Math.PI*2-Math.PI/2+.16;
      fit.set(n.id,[380+314*Math.cos(a),246+211*Math.sin(a)]);
    });
    view.replaceChildren();refs.replaceChildren();lineEls.length=0;nodeEls.clear();refEls.clear();
    const links=allLinks.filter(l=>fit.has(l.source)&&fit.has(l.target));
    for(const l of links){
      const p=fit.get(l.source),q=fit.get(l.target);
      const line=svg('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:'ln'+(l.hypothesis?' hypothesis':'')});
      view.append(line);lineEls.push([line,l]);
    }
    for(const n of nodes){
      const [x,y]=fit.get(n.id);
      const g=svg('g',{role:'button',tabindex:asList?-1:0,'aria-label':n.name,'aria-pressed':'false','data-kind':n.kind,class:'n'});
      g.append(svg('circle',{cx:x,cy:y,r:24,class:'hit'}),svg('circle',{cx:x,cy:y,r:n.kind==='mentor'?8:11,class:'orb'}),svg('circle',{cx:x,cy:y,r:3,class:'core'}));
      const t=svg('text',{x,y:y+(y>418?-18:23),'text-anchor':'middle'});t.textContent=n.short;g.append(t);
      g.addEventListener('click',()=>select(n.id));g.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select(n.id);}});
      view.append(g);nodeEls.set(n.id,g);
      const b=el('button',{type:'button','aria-pressed':'false'},n.name);b.addEventListener('click',()=>select(n.id));refs.append(b);refEls.set(n.id,b);
    }
    select(fit.has(id)?id:'monitoring');
  }
  const more=el('button',{type:'button','aria-pressed':'false'},'All connections');
  const alternate=el('button',{type:'button','aria-pressed':'false'},'List view');
  more.addEventListener('click',()=>{expanded=!expanded;more.setAttribute('aria-pressed',String(expanded));more.textContent=expanded?'Shortlist only':'All connections';make();});
  alternate.addEventListener('click',()=>{asList=!asList;alternate.setAttribute('aria-pressed',String(asList));alternate.textContent=asList?'Graph view':'List view';list.hidden=!asList;canvas.hidden=asList;graph.classList.toggle('list-mode',asList);make();});
  toggle.append(more,alternate);make();
  return el('section',{},head('00 / Research atlas','Follow the question','Select a node to see a mechanism, method, or person. The map shows research fit, not commitments.'),
    toggle,list,graph,el('div',{class:'legend'},el('strong',{},'■■ Research threads'),el('span',{},'Gold: faculty'),el('span',{},'Violet: methods'),el('span',{},'Copper: external connection'),el('span',{},'Dashed: proposed or methodological link')));
}
