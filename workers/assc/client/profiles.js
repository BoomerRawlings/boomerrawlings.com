import { presentation } from './presentation.js';
const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const num=n=>Number(n||0).toLocaleString();
const idPart=id=>encodeURIComponent(id);
function outbound(url,label){const a=e('a',label);try{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw 0;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{}return a;}
function routeLink(href,label){const a=e('a',label);a.href=href;return a;}
export function createProfileController({api}){
  const dialog=e('dialog',null,'assc-profile'),body=e('div',null,'ap-body');dialog.setAttribute('aria-label','Unified record profile');dialog.append(body);document.body.append(dialog);
  let origin={hash:'#bios',scroll:0,focus:null},request=0,activeId=null,destroyed=false,focusFrame=0;
  const cache=new Map();let corpusPromise,profileAlignmentDate=new Date().toISOString().slice(0,10);
  const linkAbort=new AbortController();
  function cancelFocus(){cancelAnimationFrame(focusFrame);focusFrame=0;}
  function cancelMotion(){window.SiteMotion?.cancelScreen?.(body);for(const animation of dialog.getAnimations?.({subtree:true})||[])animation.cancel();}
  document.addEventListener('assc-alignment-date',event=>{profileAlignmentDate=event.detail;},{signal:linkAbort.signal});
  document.addEventListener('click',event=>{const link=event.target.closest?.('a[href^="#profile/"]');if(!link||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(decodeURIComponent(link.getAttribute('href').slice('#profile/'.length).split('?')[0]),link.closest('.console-results')?document.querySelector('.console-search input'):link);},{signal:linkAbort.signal});
  function navigate(id,returnFocus=document.activeElement){
    if(destroyed)return;cancelFocus();
    if(!location.hash.startsWith('#profile/'))origin={hash:location.hash||'#brief',scroll:scrollY,focus:returnFocus};
    const depth=location.hash.startsWith('#profile/')?(history.state?.asscProfileDepth||1)+1:1;
    history.pushState({...history.state,asscProfileDepth:depth},'',`#profile/${idPart(id)}?back=${encodeURIComponent(origin.hash.slice(1))}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  function dismiss(){
    if(destroyed)return;
    cancelMotion();
    dialog.close();
    if(history.state?.asscProfileDepth)history.go(-history.state.asscProfileDepth);
    else{history.replaceState(null,'',origin.hash);window.dispatchEvent(new HashChangeEvent('hashchange'));}
  }
  dialog.addEventListener('cancel',ev=>{ev.preventDefault();dismiss();});
  dialog.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dismiss();}});
  function closeForRoute(){
    if(destroyed)return false;
    const token=++request;cancelFocus();cancelMotion();const wasOpen=activeId!==null;if(dialog.open)dialog.close();if(wasOpen)focusFrame=requestAnimationFrame(()=>{focusFrame=0;if(destroyed||token!==request)return;window.scrollTo({top:origin.scroll,behavior:'instant'});let target=origin.focus;if(!target?.isConnected&&target?.getAttribute?.('href'))target=[...document.querySelectorAll('a[href]')].find(a=>a.getAttribute('href')===origin.focus.getAttribute('href'));if(target&&!target.getClientRects().length)target=document.querySelector('.console-search input');target?.focus({preventScroll:true});});
    activeId=null;return wasOpen;
  }
  async function open(id){
    if(destroyed||dialog.open&&activeId===id)return;cancelFocus();activeId=id;
    const token=++request,params=new URLSearchParams(location.hash.split('?')[1]||'');
    if(!origin.focus&&params.get('back'))origin.hash='#'+params.get('back');
    if(!dialog.open)dialog.showModal();
    body.replaceChildren(e('p','Opening record…','ap-status'));
    let data;try{data=cache.get(id)||await api(`profiles/${idPart(id)}`);if(destroyed||token!==request)return;cache.set(id,data);}catch(error){if(destroyed||token!==request)return;body.replaceChildren(e('h2','This record is not indexed yet.'),e('p',error.message));const b=e('button','Back to the record');b.addEventListener('click',dismiss);body.append(b);return;}
    if(destroyed||token!==request)return;
    const toolbar=e('div',null,'ap-toolbar'),back=e('button','Back to the record'),close=e('button','Close');back.type=close.type='button';back.addEventListener('click',()=>{if(!destroyed)history.state?.asscProfileDepth>1?history.back():dismiss();});close.addEventListener('click',dismiss);toolbar.append(back,close);
    const heading=e('header',null,'ap-heading');if(/^\/ASSC\/portraits\/[a-zA-Z0-9._/-]+$/.test(data.portrait||'')&&!data.portrait.includes('..')){const portrait=e('img',null,'ap-portrait');portrait.src=data.portrait;portrait.alt='';portrait.width=portrait.height=72;heading.append(portrait);}heading.append(e('p',data.kind.replaceAll('_',' '),'ap-kicker'),e('h2',data.label),e('p',data.accountKey||data.id,'ap-record-id'));
    if(data.bio)heading.append(e('p',data.bio,'ap-bio'));
    if(data.researchPriority===1)heading.append(e('span','Priority research lead','ap-type'));
    body.replaceChildren(toolbar,heading);
    if(data.graphPresent&&data.id!==presentation.subjectId){try{const corpus=await(corpusPromise||=api('corpus'));if(token!==request)return;if(corpus.nodes.some(n=>n.id===data.id&&n.type==='person')){const a=reviewedAlignment(data.id,corpus.alignments||[],corpus.sources,profileAlignmentDate),relationship=e('section');relationship.append(e('h3',presentation.text.text12),e('p',alignmentLabels[a.stance]+(a.asOf?' · '+a.asOf:'')));for(const record of a.records){relationship.append(e('p',record.statement),e('small',record.locator));for(const source of record.sourceIds){const s=corpus.sources.find(s=>s.id===source);if(s)relationship.append(routeLink('#sources/index/'+idPart(s.id),s.title));}}body.append(relationship);}}catch{/* Existing profile evidence remains available if the relationship index cannot load. */}}
    if(destroyed||token!==request)return;
    if(data.observedNames.length)body.append(e('p',`Observed handles: ${data.observedNames.join(' · ')}`,'ap-small'));
    if(data.joinDate)body.append(e('p',`Account joined ${data.joinDate}`,'ap-small'));
    function section(title){const s=e('section');s.append(e('h3',title));body.append(s);return s;}
    if(data.forumMetrics){const m=data.forumMetrics,s=section('Forum activity'),stats=e('div',null,'ap-stats');for(const[k,label]of [['posts','Posts'],['characters','Own-text characters'],['repliesMade','Replies made'],['repliesReceived','Replies received']]){const n=e('div');n.append(e('strong',num(m[k])),e('span',label));stats.append(n);}s.append(stats,e('p',`${data.forumCoverage.pages} captured pages · ${data.forumCoverage.from.slice(0,10)} to ${data.forumCoverage.to.slice(0,10)}`,'ap-small'),routeLink('#kf','Explore KF activity'));}
    if(data.relationships.length){const s=section('Connections');for(const r of data.relationships){const article=e('article'),button=e('button',r.otherLabel||r.otherId,'ap-profile-link');button.type='button';button.addEventListener('click',()=>navigate(r.otherId));article.append(e('span',r.label,'ap-type'),button,e('p',r.statement));const details=e('details');details.append(e('summary',`Evidence · ${r.status}`));if(r.notes)details.append(e('p',r.notes));for(const source of r.evidence||[]){const p=e('p');p.append(outbound(source.url,source.title||source.url));if(source.locator)p.append(e('small',source.locator));details.append(p);}article.append(details);s.append(article);}}
    if(data.replyPairs.length){const s=section('Forum exchanges');for(const pair of data.replyPairs){const other=pair.from===data.accountKey?pair.to:pair.from,label=pair.from===data.accountKey?'Replied to':'Replies from',p=e('p'),button=e('button',(pair.from===data.accountKey?pair.toLabel:pair.fromLabel)||other);button.addEventListener('click',()=>navigate(presentation.forumProfileIdPrefix+other.split(':').at(-1)));p.append(e('span',label+' '),button,e('strong',' · '+num(pair.count)));s.append(p);}}
    if(data.events.length){const s=section('Source-linked timeline');for(const event of data.events)s.append(routeLink(`#timeline/${idPart(event.id)}`,`${event.date} · ${event.title}`));}
    if(data.passages.length){const s=section('Source passages');for(const p of new Map(data.passages.map(p=>[(p.localHref||p.url||'')+'|'+p.segmentId+'|'+p.text,p])).values()){const a=e('article');a.append(e('span',p.kind==='source_context'?'Discussion context':'Mention','ap-type'),e('p',p.text));if(p.localHref)a.append(routeLink(p.localHref,p.title));else a.append(outbound(p.url,p.title));const time=p.startSeconds==null?'Time unknown':Math.floor(p.startSeconds/60)+':'+String(Math.floor(p.startSeconds%60)).padStart(2,'0');a.append(e('small',`${time} · ${p.segmentId}`));s.append(a);}}
    if(data.posts.length){const s=section('Forum posts');for(const p of data.posts){const article=e('article');article.append(e('span',p.at.slice(0,10),'ap-type'),e('p',p.excerpt||'Quoted or media-only post.'),outbound((p.source.url||'').split('#')[0]+'#post-'+p.postId,`Post #${p.number} · page ${p.page}`));const details=e('details');details.append(e('summary','Source record'),e('small',`${p.source.file} · ${p.source.locator} · ${p.source.capture}`));article.append(details);s.append(article);}}
    if(data.sources.length){const s=section('Source library');for(const source of data.sources)s.append(routeLink(`#sources/index/${idPart(source.id)}`,source.title));}
    if(data.notes){const notes=e('details');notes.append(e('summary','Record notes'),e('p',data.notes));body.append(notes);}
    const footer=e('footer');if(data.graphPresent)footer.append(routeLink(`#connections/${idPart(id)}`,'Locate in the atlas'));footer.append(e('p',data.id,'ap-record-id'));body.append(footer);body.scrollTop=0;back.focus({preventScroll:true});
  }
  return {navigate,open,closeForRoute,isOpen:()=>!destroyed&&(dialog.open||activeId!==null),destroy(){if(destroyed)return;destroyed=true;request++;activeId=null;cancelFocus();cancelMotion();linkAbort.abort();cache.clear();corpusPromise=null;origin.focus=null;body.replaceChildren();if(dialog.open)dialog.close();dialog.remove();}};
}

const alignmentLabels={ally:'Ally',enemy:'Enemy',mixed:'Mixed / changed',unclassified:'Unclassified',context:'Context record',subject:'Central subject'};
function validAlignmentDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function reviewedAlignment(id,records,sources,asOf='9999-12-31'){
  if(id===presentation.subjectId)return {stance:'subject',records:[]};
  const sourceIds=new Set(sources.map(s=>s.id));
  const valid=(records||[]).filter(r=>r.subjectId===presentation.subjectId&&r.personId===id&&['ally','enemy','mixed'].includes(r.stance)&&r.status==='reviewed'&&validAlignmentDate(r.asOf)&&r.asOf<=asOf&&r.statement?.trim()&&r.sourceIds?.length&&r.sourceIds.every(s=>sourceIds.has(s))&&r.locator?.trim());
  if(!valid.length)return {stance:'unclassified',records:[]};
  const date=valid.map(r=>r.asOf).sort().at(-1),latest=valid.filter(r=>r.asOf===date);
  return {stance:new Set(latest.map(r=>r.stance)).size===1?latest[0].stance:'mixed',asOf:date,records:latest};
}
function subjectLayout(nodes,records=[],sources=[],asOf){
  const center={x:600,y:450};
  const groups={ally:[],enemy:[],mixed:[],unclassified:[],context:[]};
  const result=nodes.map(n=>({...n,alignment:n.id===presentation.subjectId?{stance:'subject',records:[]}:n.type==='person'?reviewedAlignment(n.id,records,sources,asOf):{stance:'context',records:[]}}));
  for(const n of result)if(n.id===presentation.subjectId)Object.assign(n,center);else groups[n.alignment.stance].push(n);
  for(const [stance,list]of Object.entries(groups)){
    list.sort((a,b)=>a.id.localeCompare(b.id));
    list.forEach((n,i)=>{const ring=Math.floor(i/10),slot=i%10,count=Math.min(10,list.length-ring*10),radius=stance==='context'?540+ring*170:300+ring*150;
      const start=stance==='ally'?Math.PI*.62:stance==='enemy'?-Math.PI*.38:stance==='mixed'?Math.PI*.15:-Math.PI/2;
      const sweep=['ally','enemy','mixed'].includes(stance)?Math.PI*.65:Math.PI*2;
      const angle=start+(i%10+.5)/count*sweep;n.x=center.x+Math.cos(angle)*radius;n.y=center.y+Math.sin(angle)*radius;
    });
  }
  return result;
}
