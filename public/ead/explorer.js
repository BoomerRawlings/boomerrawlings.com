/* Curated, evidence-linked author explorer. All assets and records are same-origin. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = (tag,text,cls) => {
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  const button = (label,action,cls) => {
    const node=el('button',label,cls);node.type='button';node.addEventListener('click',action);return node;
  };
  const external = (label,url) => {
    const node=el('a',label);
    try {const parsed=new URL(url);if(parsed.protocol!=='https:')return el('span',label);node.href=parsed.href;}
    catch{return el('span',label);}
    node.target='_blank';node.rel='noopener noreferrer';return node;
  };
  const send = (type,detail) => document.dispatchEvent(new CustomEvent(type,{detail}));
  const normalize = value => String(value||'').normalize('NFKD').toLowerCase();
  let data, sources, briefing;
  let expanded=false, selected={kind:'focal',id:'yue-zhang'}, query='';
  let hovered=null, focused=null;
  const reduceMotion=matchMedia('(prefers-reduced-motion:reduce)');
  const motion=new Set();
  const peoplePositions=[[21,13],[34,25],[17,37],[31,49],[16,61],[29,73],[17,86],[42,88]];
  const topicPositions=[[74,13],[82,28],[79,43],[83,58],[77,73],[67,89]];
  const positions=new Map();
  const nodeButtons=new Map();
  const links=[];
  const topicsFor = person => data.topics.filter(topic=>topic.person_ids.includes(person.id));
  const sourceText = id => {const s=sources.get(id);return s ? `${s.title} ${s.shortTitle} ${s.authors.join(' ')} ${(s.tags||[]).join(' ')}` : '';};
  const matches = item => !query || query.split(/\s+/).filter(Boolean).every(word => normalize(`${item.name||item.label} ${item.role||''} ${item.summary||''} ${item.paper_ids.map(sourceText).join(' ')}`).includes(word));

  function stopMotion() {
    motion.forEach(animation=>animation.cancel());motion.clear();
  }
  function animate(node,frames,options) {
    if(reduceMotion.matches||!node.animate)return;
    const animation=node.animate(frames,options);motion.add(animation);
    animation.finished.catch(()=>{}).finally(()=>motion.delete(animation));
  }
  function revealNetwork(previousAuthor) {
    if(reduceMotion.matches||document.hidden||document.body.dataset.view!=='explorer')return;
    const mobile=matchMedia('(max-width:700px)').matches;
    const canvas=$('explorer-canvas').getBoundingClientRect();
    const author=$('explorer-author'),current=author.getBoundingClientRect();
    const dx=previousAuthor.left+previousAuthor.width/2-current.left-current.width/2;
    const dy=previousAuthor.top+previousAuthor.height/2-current.top-current.height/2;
    const settled=mobile?'none':'translate(-50%,-50%)';
    const authorFrom=mobile?`translate(${dx}px,${dy}px)`:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
    animate(author,[{transform:authorFrom},{transform:settled}],{duration:560,easing:'cubic-bezier(.2,.7,.2,1)'});
    let index=0;
    nodeButtons.forEach((node,id)=>{
      if(node.hidden)return;
      const [x,y]=positions.get(id),delay=index++*22;
      const from=mobile?'translateY(14px) scale(.97)':`translate(calc(-50% + ${canvas.width*(.5-x/100)}px),calc(-50% + ${canvas.height*(.48-y/100)}px)) scale(.7)`;
      const to=mobile?'none':'translate(-50%,-50%)';
      animate(node,[{transform:from,opacity:0},{transform:to,opacity:1}],{duration:mobile?360:620,delay,fill:'backwards',easing:'cubic-bezier(.18,.75,.24,1)'});
    });
    if(!mobile)animate($('explorer-lines'),[{clipPath:'circle(0% at 50% 48%)',opacity:0},{clipPath:'circle(110% at 50% 48%)',opacity:1}],{duration:800,easing:'cubic-bezier(.2,.6,.2,1)'});
  }
  function clearPreview() {hovered=null;focused=null;}
  function preview(kind,id,input,active) {
    if(!expanded||query||document.body.dataset.view!=='explorer')return;
    if(input==='pointer')hovered=active?{kind,id}:null;
    else focused=active?{kind,id}:null;
    renderConnections();
  }

  function pick(kind,id) {
    stopMotion();clearPreview();
    expanded=true;selected={kind,id};query='';send('ead:reset-query');
    render();
    const heading=$('explorer-detail').querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
    if(matchMedia('(max-width:1200px)').matches) $('explorer-detail').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  }
  function reset() {
    stopMotion();clearPreview();
    expanded=false;selected={kind:'focal',id:data.focal.id};query='';send('ead:reset-query');render();
    $('explorer-author').focus({preventScroll:true});
  }
  function makeNode(item,kind,index) {
    const node=button('',()=>pick(kind,item.id),`explorer-node ${kind==='person'?'person-node person-slot-':'topic-node topic-slot-'}${index}`);
    node.dataset.nodeId=item.id;node.setAttribute('aria-pressed','false');
    if(kind==='person')node.append(el('span',item.name.split(' ').map(word=>word[0]).slice(0,2).join(''),'person-monogram'));
    node.append(el('span',item.name||item.label,'node-name'));
    node.append(el('span',`${item.paper_ids.length} paper${item.paper_ids.length===1?'':'s'}`,'node-note'));
    node.setAttribute('aria-label',`${item.name||item.label}. ${item.paper_ids.length} reviewed papers. Show evidence.`);
    node.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')preview(kind,item.id,'pointer',true);});
    node.addEventListener('pointerleave',()=>preview(kind,item.id,'pointer',false));
    node.addEventListener('focus',()=>preview(kind,item.id,'focus',true));
    node.addEventListener('blur',()=>preview(kind,item.id,'focus',false));
    nodeButtons.set(item.id,node);positions.set(item.id,(kind==='person'?peoplePositions:topicPositions)[index]);
    return node;
  }
  function drawLine(fromId,toId,kind) {
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    const from=fromId===data.focal.id?[50,48]:positions.get(fromId),to=positions.get(toId);
    const [x1,y1]=from.map(n=>n*10),[x2,y2]=to.map(n=>n*10);
    path.setAttribute('d',`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`);
    path.setAttribute('class',`explorer-link ${kind}`);
    if(kind==='related')path.setAttribute('pathLength','1');
    $('explorer-lines').append(path);
    links.push({path,fromId,toId,kind});
  }
  function renderConnections() {
    if(!data)return;
    const transient=expanded&&!query?(hovered||focused):null;
    const active=transient||selected;
    const person=data.people.find(item=>active.kind==='person'&&item.id===active.id);
    const topic=data.topics.find(item=>active.kind==='topic'&&item.id===active.id);
    const relatedIds=new Set([active.id]);
    if(person)topicsFor(person).forEach(t=>relatedIds.add(t.id));
    if(topic)topic.person_ids.forEach(id=>relatedIds.add(id));
    $('explorer-layout').dataset.previewId=transient?.id||'';
    nodeButtons.forEach((node,id)=>{
      const related=active.kind==='focal'||relatedIds.has(id);
      node.classList.toggle('is-muted',!related&&!query);
      node.classList.toggle('is-related',relatedIds.has(id)&&id!==active.id&&!query);
      node.classList.toggle('is-preview',transient?.id===id);
      node.setAttribute('aria-pressed',String(selected.id===id));
    });
    links.forEach(({path,fromId,toId,kind})=>{
      const visible=expanded&&!nodeButtons.get(toId).hidden&&(kind!=='related'||!nodeButtons.get(fromId).hidden);
      const activePair=kind==='related'&&!query&&Boolean((person&&fromId===person.id)||(topic&&toId===topic.id));
      path.classList.toggle('is-visible',visible&&(kind!=='related'||activePair));
      path.classList.toggle('dimmed',kind!=='related'&&active.kind!=='focal'&&!relatedIds.has(toId)&&!query);
    });
    $('explorer-legend').textContent=!expanded?'Select the author to open his research network.':transient?`Preview: ${person?.name||topic?.label}. Highlighted links share reviewed papers; click to select.`:'Solid: documented relationships. Dotted: curated topics. Selected links: shared papers.';
  }
  function render() {
    if(!data)return;
    const opening=expanded&&!$('explorer-layout').classList.contains('is-expanded');
    const previousAuthor=$('explorer-author').getBoundingClientRect();
    $('explorer-layout').classList.toggle('is-expanded',expanded);
    $('explorer-author').setAttribute('aria-expanded',String(expanded));
    $('explorer-author').querySelector('.author-action').firstChild.textContent=expanded?'Collapse network ':'Explore connections ';
    $('explorer-author').querySelector('.author-action > span').textContent=expanded?'−':'+';
    $('explorer-people').hidden=!expanded;$('explorer-topics').hidden=!expanded;
    $('explorer-detail').hidden=!expanded;$('explorer-reset').hidden=!expanded;
    document.querySelectorAll('.map-group-label').forEach(node=>{node.hidden=!expanded;});
    let peopleCount=0,topicCount=0;
    const person=data.people.find(item=>selected.kind==='person'&&item.id===selected.id);
    const topic=data.topics.find(item=>selected.kind==='topic'&&item.id===selected.id);
    for(const [kind,items] of [['person',data.people],['topic',data.topics]])items.forEach(item=>{
      const node=nodeButtons.get(item.id),visible=matches(item);
      node.hidden=!visible;
      if(visible){if(kind==='person')peopleCount++;else topicCount++;}
    });
    renderConnections();
    $('explorer-empty').hidden=!expanded||peopleCount+topicCount>0;
    $('explorer-status').textContent=expanded?`${peopleCount} collaborator${peopleCount===1?'':'s'} / ${topicCount} topic${topicCount===1?'':'s'}`:'YUE ZHANG / WESTLAKE NLP';
    if(expanded){if(query)renderSearch();else renderDetail(person||topic||data.focal,selected.kind);}
    if(opening)revealNetwork(previousAuthor);
  }
  function renderSearch() {
    const host=$('explorer-detail');host.replaceChildren();
    host.append(el('p','NETWORK SEARCH','node-type'),el('h2',query));
    for(const [kind,items,title] of [['person',data.people,'COLLABORATORS'],['topic',data.topics,'TOPICS']]){
      const found=items.filter(matches);if(!found.length)continue;
      host.append(el('h3',title));const chips=el('div',undefined,'detail-chips');
      found.forEach(item=>chips.append(button(item.name||item.label,()=>pick(kind,item.id))));host.append(chips);
    }
    const ids=[...new Set(data.topics.flatMap(t=>t.paper_ids))].filter(id=>query.split(/\s+/).filter(Boolean).every(word=>normalize(sourceText(id)).includes(word)));
    if(ids.length)addPapers(host,ids);
    host.append(el('p','Search covers this selected network. Use Catalogue to search all 492 records.','detail-summary'));
  }
  function addPapers(host,ids) {
    const unique=[...new Set(ids)].filter(id=>sources.has(id));
    host.append(el('h3',`REVIEWED PAPERS / ${String(unique.length).padStart(2,'0')}`));
    const list=el('div',undefined,'paper-list');
    const appendPaper=id=>{
      const source=sources.get(id);
      const b=button('',()=>send('ead:source',id),'explorer-paper');
      b.append(el('small',`${source.year||'UNDATED'}${source.status==='withdrawn'?' / WITHDRAWN':''}`),el('span',source.shortTitle||source.title));
      list.append(b);
    };
    unique.slice(0,4).forEach(appendPaper);host.append(list);
    if(unique.length>4){const more=button(`Show ${unique.length-4} more paper${unique.length===5?'':'s'}`,()=>{unique.slice(4).forEach(appendPaper);more.remove();list.children[4].focus({preventScroll:true});},'more-papers');host.append(more);}
  }
  function renderDetail(item,kind) {
    const host=$('explorer-detail');host.replaceChildren();
    host.append(el('p',kind==='person'?'COLLABORATOR':kind==='topic'?'RESEARCH TOPIC':'FOCAL AUTHOR','node-type'),el('h2',item.name||item.label));
    if(item.role)host.append(el('p',item.role,'detail-role'));
    host.append(el('p',item.summary,'detail-summary'));
    if(kind==='focal'){
      const links=el('div',undefined,'evidence-links');links.append(external('University profile',item.profile_url),external('Portrait source',item.photo_provenance.page_url));host.append(links);
      host.append(el('h3','SELECT A TOPIC'));
      const chips=el('div',undefined,'detail-chips');data.topics.forEach(t=>chips.append(button(t.label,()=>pick('topic',t.id))));host.append(chips);
      host.append(el('p','Eight selected collaborators. Coauthorship does not establish current lab membership. Topic groupings are research synthesis.','caveat'));
      const focalIds=[...new Set(data.topics.flatMap(t=>t.paper_ids))].filter(id=>sources.get(id)?.authors.some(name=>/^yue zhang$/i.test(name.trim())));
      addPapers(host,focalIds);
    } else if(kind==='person'){
      host.append(el('h3','RELATIONSHIP'),el('p',item.relationship,'detail-role'));
      const topics=topicsFor(item);
      if(topics.length){host.append(el('h3','RESEARCH TOPICS'));const chips=el('div',undefined,'detail-chips');topics.forEach(t=>chips.append(button(t.label,()=>pick('topic',t.id))));host.append(chips);}
      addPapers(host,item.paper_ids);
      const links=el('div',undefined,'evidence-links');item.evidence_urls.forEach((url,i)=>links.append(external(`Evidence ${i+1}`,url)));host.append(links);
      if(item.caveat)host.append(el('p',item.caveat,'caveat'));
    } else {
      host.append(el('h3','LINKED COLLABORATORS'));
      const chips=el('div',undefined,'detail-chips');item.person_ids.forEach(id=>{const p=data.people.find(p=>p.id===id);if(p)chips.append(button(p.name,()=>pick('person',id)));});host.append(chips);
      addPapers(host,item.paper_ids);
      const observations=briefing.observations.filter(o=>item.observation_ids.includes(o.id));
      if(observations.length){host.append(el('h3','FINDINGS & CAUTIONS'));observations.forEach(o=>{const b=button('',()=>send('ead:observation',o.id),'explorer-paper');b.append(el('small',o.kind==='anomaly'?'CAUTION':o.kind==='design'?'PROPOSED APPLICATION':'FINDING'),el('span',o.title));host.append(b);});}
      host.append(el('p','Topic links reflect authored papers in this reviewed selection; they do not imply endorsement or current lab affiliation.','caveat'));
    }
  }
  document.addEventListener('ead:ready',event=>{
    sources=new Map(event.detail.catalogue.entries.map(s=>[s.id,s]));briefing=event.detail.briefing;
  },{once:true});
  document.addEventListener('ead:explorer-data',event=>{
    data=event.detail;
    const photo=new URL(data.focal.photo_path,location.href);
    if(photo.origin===location.origin)$('author-photo').src=photo.href;
    $('explorer-author').hidden=false;
    data.people.forEach((p,i)=>$('explorer-people').append(makeNode(p,'person',i)));
    data.topics.forEach((t,i)=>$('explorer-topics').append(makeNode(t,'topic',i)));
    data.people.forEach(p=>drawLine(data.focal.id,p.id,'person'));
    data.topics.forEach(t=>{
      drawLine(data.focal.id,t.id,'topic');
      t.person_ids.forEach(id=>drawLine(id,t.id,'related'));
    });
    $('explorer-author').addEventListener('click',()=>{if(expanded)reset();else{expanded=true;selected={kind:'focal',id:data.focal.id};render();}});
    $('explorer-reset').addEventListener('click',reset);
    render();
  },{once:true});
  document.addEventListener('ead:explorer-query',event=>{
    stopMotion();clearPreview();
    query=normalize(event.detail).trim();if(query)expanded=true;render();
  });
  const leaveView=()=>{stopMotion();clearPreview();if(data)renderConnections();};
  new MutationObserver(()=>{if(document.body.dataset.view!=='explorer')leaveView();}).observe(document.body,{attributes:true,attributeFilter:['data-view']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)leaveView();});
  window.addEventListener('resize',stopMotion,{passive:true});
  reduceMotion.addEventListener?.('change',()=>{if(reduceMotion.matches)stopMotion();});
})();
