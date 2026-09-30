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
  const peoplePositions=[[21,13],[34,25],[17,37],[31,49],[16,61],[29,73],[17,86],[42,88]];
  const topicPositions=[[74,13],[82,28],[79,43],[83,58],[77,73],[67,89]];
  const positions=new Map();
  const nodeButtons=new Map();
  const topicsFor = person => data.topics.filter(topic=>topic.person_ids.includes(person.id));
  const sourceText = id => {const s=sources.get(id);return s ? `${s.title} ${s.shortTitle} ${s.authors.join(' ')} ${(s.tags||[]).join(' ')}` : '';};
  const matches = item => !query || query.split(/\s+/).filter(Boolean).every(word => normalize(`${item.name||item.label} ${item.role||''} ${item.summary||''} ${item.paper_ids.map(sourceText).join(' ')}`).includes(word));

  function pick(kind,id) {
    expanded=true;selected={kind,id};query='';send('ead:reset-query');
    render();
    const heading=$('explorer-detail').querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
    if(matchMedia('(max-width:1200px)').matches) $('explorer-detail').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  }
  function reset() {
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
    nodeButtons.set(item.id,node);positions.set(item.id,(kind==='person'?peoplePositions:topicPositions)[index]);
    return node;
  }
  function drawLine(from,to,kind,dimmed=false) {
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    const [x1,y1]=from.map(n=>n*10),[x2,y2]=to.map(n=>n*10);
    path.setAttribute('d',`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`);
    path.setAttribute('class',`explorer-link ${kind}${dimmed?' dimmed':''}`);
    $('explorer-lines').append(path);
  }
  function render() {
    if(!data)return;
    $('explorer-layout').classList.toggle('is-expanded',expanded);
    $('explorer-author').setAttribute('aria-expanded',String(expanded));
    $('explorer-author').querySelector('.author-action').firstChild.textContent=expanded?'Collapse network ':'Explore connections ';
    $('explorer-author').querySelector('.author-action > span').textContent=expanded?'−':'+';
    $('explorer-people').hidden=!expanded;$('explorer-topics').hidden=!expanded;
    $('explorer-detail').hidden=!expanded;$('explorer-reset').hidden=!expanded;
    document.querySelectorAll('.map-group-label').forEach(node=>{node.hidden=!expanded;});
    $('explorer-lines').replaceChildren();
    let peopleCount=0,topicCount=0;
    const person=data.people.find(item=>selected.kind==='person'&&item.id===selected.id);
    const topic=data.topics.find(item=>selected.kind==='topic'&&item.id===selected.id);
    for(const [kind,items] of [['person',data.people],['topic',data.topics]])items.forEach(item=>{
      const node=nodeButtons.get(item.id),visible=matches(item);
      node.hidden=!visible;
      if(visible){if(kind==='person')peopleCount++;else topicCount++;}
      const related=selected.kind==='focal'||item.id===selected.id||(kind==='person'&&topic?.person_ids.includes(item.id))||(kind==='topic'&&person&&item.person_ids.includes(person.id));
      node.classList.toggle('is-muted',!related&&!query);
      node.setAttribute('aria-pressed',String(selected.id===item.id));
      if(expanded&&visible)drawLine([50,48],positions.get(item.id),kind==='person'?'person':'topic',!related&&!query);
    });
    if(expanded&&!query&&person)topicsFor(person).forEach(t=>drawLine(positions.get(person.id),positions.get(t.id),'related'));
    if(expanded&&!query&&topic)topic.person_ids.forEach(id=>drawLine(positions.get(id),positions.get(topic.id),'related'));
    $('explorer-empty').hidden=!expanded||peopleCount+topicCount>0;
    $('explorer-status').textContent=expanded?`${peopleCount} collaborator${peopleCount===1?'':'s'} / ${topicCount} topic${topicCount===1?'':'s'}`:'YUE ZHANG / WESTLAKE NLP';
    $('explorer-legend').textContent=expanded?'Solid: documented relationships. Dotted: curated topics. Selected links: shared papers.':'Select the author to open his research network.';
    if(expanded){if(query)renderSearch();else renderDetail(person||topic||data.focal,selected.kind);}
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
    $('explorer-author').addEventListener('click',()=>{if(expanded)reset();else{expanded=true;selected={kind:'focal',id:data.focal.id};render();}});
    $('explorer-reset').addEventListener('click',reset);
    render();
  },{once:true});
  document.addEventListener('ead:explorer-query',event=>{
    query=normalize(event.detail).trim();if(query)expanded=true;render();
  });
})();
