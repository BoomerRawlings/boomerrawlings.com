/* Geographic context and evidence-linked research network. No external runtime requests. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ns = 'http://www.w3.org/2000/svg';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 700px)');
  const normalize = value => String(value || '').normalize('NFKD').toLowerCase();
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  };
  const button = (label, action, cls) => {
    const node = make('button', label, cls); node.type = 'button';
    node.addEventListener('click', action); return node;
  };
  const link = (label, address) => {
    try {
      const url = new URL(address);
      if (!['https:', 'http:'].includes(url.protocol)) return make('span', label);
      const node = make('a', label); node.href = url.href;
      node.target = '_blank'; node.rel = 'noopener noreferrer'; return node;
    } catch { return make('span', label); }
  };
  const list = value => Array.isArray(value) ? value : [];
  const text = value => Array.isArray(value) ? value.join(' · ') : String(value || '');
  const assignId = (node, id) => { node.id = id; return node; };
  let data, outline, entities, locations, topics, initialized = false;
  let query = '', topicId = null, topicPreview = null, cityId = null, cityPreview = null, selectedId = null, edgeId = null;
  let previousPositions = new Map(), networkNodeElements = new Map(), networkPage = 0, showAll = false, unlocated = false;
  const cityMarkers = new Map(), cityButtons = new Map(), topicButtons = new Map();
  const state = {};

  function project(lon, lat) {
    // Equirectangular, standard parallel 35°N. Both geometry and POIs use this projection.
    const scale = Math.min(904 / (66 * Math.cos(35 * Math.PI / 180)), 560 / 38);
    return {x: 500 + (lon - 104) * Math.cos(35 * Math.PI / 180) * scale, y: 320 - (lat - 35) * scale};
  }
  function geometryPath(geometry) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    return polygons.flatMap(polygon => polygon.map(ring => ring.map(([lon, lat], index) => {
      const p = project(lon, lat); return `${index ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ') + 'Z')).join(' ');
  }
  function entityMatches(entity) {
    const terms = `${entity.name} ${entity.affiliation || ''} ${entity.bio || ''} ${text(entity.providedBio)} ${text(entity.work)} ${text(entity.reason)} ${entityCities(entity).map(id=>locations.get(id)?.name).join(' ')} ${list(entity.topicIds).map(id => topics.get(id)?.label || '').join(' ')}`;
    return query.split(/\s+/).filter(Boolean).every(word => normalize(terms).includes(word));
  }
  const entityCities = entity => [...new Set([entity.locationId,...list(entity.locationIds)].filter(id=>locations.has(id)))];
  const eligibleEntities = () => data.entities.filter(entity => entityMatches(entity) && (!topicId || list(entity.topicIds).includes(topicId)) && (!unlocated || !entityCities(entity).length));
  const curatedOverview = () => !showAll && !unlocated && !query && !topicId && !cityId && !selectedId && data.entities.some(entity=>entity.curated);
  const baseEntities = () => eligibleEntities().filter(entity => !curatedOverview() || entity.curated);
  const incident = id => data.connections.filter(edge => edge.source === id || edge.target === id);
  const edgeKind = edge => edge.kind === 'documented' ? 'Documented' : 'Inferred';
  function scrollToNetwork() {
    state.networkTitle.focus({preventScroll:true});
    state.networkSection.scrollIntoView({block:'start',behavior:motion.matches ? 'auto' : 'smooth'});
  }
  function selectEntity(id, restoreNetworkFocus = false) {
    if (!entities.has(id)) return;
    selectedId = id; edgeId = null; cityId = entityCities(entities.get(id))[0] || null; cityPreview = null; networkPage = 0;
    render();
    if (restoreNetworkFocus) networkNodeElements.get(id)?.focus();
    else focusContact();
  }
  function focusContact() {
    const heading=state.contact.querySelector('h3');if(!heading)return;
    state.contact.scrollTop=0;heading.tabIndex=-1;heading.focus({preventScroll:true});
    state.contact.scrollIntoView({block:matchMedia('(max-width:1200px)').matches?'start':'nearest',behavior:motion.matches?'auto':'smooth'});
  }
  function selectCity(id) {
    cityId = id; cityPreview = null; selectedId = null; edgeId = null; networkPage = 0; unlocated = false;
    render();
  }
  function previewCity(id) {
    cityPreview = id; renderMap(); renderCityList();
  }
  function selectTopic(id) {
    topicId = id; topicPreview = null; selectedId = null; edgeId = null; cityId = cityPreview = null; networkPage = 0;
    render();
    topicButtons.get(id)?.focus({preventScroll:true});
  }
  function reset() {
    query = ''; topicId = topicPreview = cityId = cityPreview = selectedId = edgeId = null; networkPage = 0; showAll = unlocated = false;
    document.dispatchEvent(new CustomEvent('ead:reset-query'));
    render(); state.overview.focus({preventScroll:true});
  }
  function build() {
    const root = $('atlas-root'); root.replaceChildren();
    const heading = make('div', undefined, 'atlas-heading');
    const intro = make('div'); intro.append(make('p', 'CHINA / RESEARCH ATLAS', 'section-label'), make('h2', 'China research network'), make('p', 'Explore a city, follow a researcher, or trace a shared research topic.', 'atlas-intro'));
    state.overview = button('Reset overview', reset, 'atlas-reset'); heading.append(intro, state.overview);
    state.status = assignId(make('p', '', 'atlas-status'), 'atlas-status'); state.status.setAttribute('role', 'status');
    const scope=make('div',undefined,'atlas-scope-controls');
    state.allProfiles=button(`Browse all ${data.entities.length} profiles`,()=>{showAll=true;unlocated=false;selectedId=cityId=cityPreview=edgeId=null;networkPage=0;render();},'atlas-scope');
    state.outsideMap=button('Unmapped / international',()=>{showAll=true;unlocated=true;selectedId=cityId=cityPreview=edgeId=null;networkPage=0;render();},'atlas-scope');
    scope.append(state.allProfiles,state.outsideMap);root.append(heading,state.status,scope);
    const grid = make('div', undefined, 'atlas-grid');
    state.mapPanel = make('section', undefined, 'atlas-map-panel'); state.mapPanel.setAttribute('aria-label', 'Cities and their researchers');
    state.map = assignId(svg('svg', {viewBox:'0 0 1000 640',role:'group','aria-label':'China geographic context with selectable research cities'}), 'atlas-map');
    const defs = svg('defs'), clip = svg('clipPath',{id:'atlas-map-clip'}); clip.append(svg('rect',{x:0,y:0,width:1000,height:640})); defs.append(clip); state.map.append(defs);
    const geography = svg('g',{'clip-path':'url(#atlas-map-clip)'});
    for (let lon = 80; lon <= 130; lon += 10) {
      const a = project(lon,17), b = project(lon,55); geography.append(svg('path',{d:`M${a.x},${a.y}L${b.x},${b.y}`,class:'atlas-graticule'}));
    }
    for (let lat = 20; lat <= 50; lat += 10) {
      const a = project(71,lat), b = project(137,lat); geography.append(svg('path',{d:`M${a.x},${a.y}L${b.x},${b.y}`,class:'atlas-graticule'}));
    }
    outline.features.forEach(feature => geography.append(svg('path',{d:geometryPath(feature.geometry),class:`atlas-land${feature.properties.id === 'CHN' ? ' is-central' : ''}`})));
    state.map.append(geography);
    state.mapEdges = svg('g',{class:'atlas-map-edges','aria-hidden':'true'}); state.map.append(state.mapEdges);
    const markerLayer = svg('g'); state.map.append(markerLayer);
    state.cityIndex = make('div',undefined,'atlas-city-index'); state.cityIndex.setAttribute('aria-label','Browse research cities');
    const placed=[];
    [...data.locations].sort((a,b)=>b.lat-a.lat||a.id.localeCompare(b.id)).forEach(location => {
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return;
      const anchor = project(location.lon, location.lat);
      let p=anchor;
      const candidates=[anchor];
      for(const radius of [54,78,106])for(let angle=0;angle<8;angle++)candidates.push({x:anchor.x+Math.cos(angle*Math.PI/4)*radius,y:anchor.y+Math.sin(angle*Math.PI/4)*radius});
      p=candidates.find(point=>point.x>25&&point.x<975&&point.y>25&&point.y<615&&placed.every(other=>Math.hypot(other.x-point.x,other.y-point.y)>49))||anchor;
      placed.push(p);
      if(p!==anchor){markerLayer.append(svg('path',{d:`M${anchor.x},${anchor.y}L${p.x},${p.y}`,class:'atlas-city-leader','aria-hidden':'true'}),svg('circle',{cx:anchor.x,cy:anchor.y,r:2,class:'atlas-city-anchor','aria-hidden':'true'}));}
      const marker = svg('g',{transform:`translate(${p.x},${p.y})`,class:'atlas-city',tabindex:0,role:'button','aria-label':location.name,'aria-pressed':'false'});
      const title = svg('title'); title.textContent = location.name;
      marker.append(title,svg('circle',{r:23,class:'atlas-city-hit'}),svg('circle',{r:12,class:'atlas-city-halo'}),svg('circle',{r:5,class:'atlas-city-dot'}));
      const label = svg('text',{x:p.x>800?-13:13,y:-13,'text-anchor':p.x>800?'end':'start',class:'atlas-city-label'}); label.textContent = location.name; marker.append(label);
      marker.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')previewCity(location.id);});
      marker.addEventListener('focus',()=>previewCity(location.id));
      marker.addEventListener('click',()=>selectCity(location.id));
      marker.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectCity(location.id);}});
      cityMarkers.set(location.id,marker); markerLayer.append(marker);
      const control = button(location.name,()=>selectCity(location.id),'atlas-city-chip');
      control.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')previewCity(location.id);});
      control.addEventListener('focus',()=>previewCity(location.id));
      cityButtons.set(location.id,control); state.cityIndex.append(control);
    });
    state.cityList = assignId(make('div',undefined,'atlas-city-results'),'atlas-city-results');
    const mapCredit = make('p',undefined,'atlas-map-credit'); mapCredit.append(link('Natural Earth · public-domain geometry',outline.meta.licenseUrl),make('span','Leader lines connect separated markers to their city anchors. Boundaries follow the source.'));
    state.mapPanel.append(state.map,state.cityIndex,state.cityList,mapCredit);
    state.mapPanel.addEventListener('pointerleave',()=>{if(!state.mapPanel.contains(document.activeElement)){cityPreview=null;renderMap();renderCityList();}});
    state.mapPanel.addEventListener('focusout',event=>{if(!state.mapPanel.contains(event.relatedTarget)){cityPreview=null;renderMap();renderCityList();}});
    state.topicPanel = make('aside',undefined,'atlas-topic-panel'); state.topicPanel.setAttribute('aria-label','Research topics');
    state.topicPanel.append(make('p','TOPICS','section-label'),make('p','Preview a topic. Select to hold its filter.','atlas-helper'));
    data.topics.forEach(topic => {
      const control = button('',()=>selectTopic(topic.id),'atlas-topic'); control.append(make('span',topic.label),make('small',''));
      control.setAttribute('aria-pressed','false'); control.title = topic.summary || topic.label;
      const preview = () => { topicPreview=topic.id;renderMap();updateNetworkHighlights(); };
      control.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')preview();});
      control.addEventListener('focus',preview);
      topicButtons.set(topic.id,control); state.topicPanel.append(control);
    });
    const clearPreview = () => {topicPreview=null;renderMap();updateNetworkHighlights();};
    state.topicPanel.addEventListener('pointerleave',()=>{if(!state.topicPanel.contains(document.activeElement))clearPreview();});
    state.topicPanel.addEventListener('focusout',event=>{if(!state.topicPanel.contains(event.relatedTarget))clearPreview();});
    state.clearTopic = button('Clear topic',()=>{topicId=topicPreview=null;networkPage=0;render();state.overview.focus({preventScroll:true});},'atlas-clear-topic');
    state.topicPanel.append(state.clearTopic,button('View network ↓',scrollToNetwork,'atlas-network-jump'));
    state.contact = assignId(make('aside',undefined,'atlas-contact'),'atlas-contact'); state.contact.setAttribute('aria-label','Selected research profile');
    grid.append(state.mapPanel,state.topicPanel,state.contact); root.append(grid);
    const legend = make('div',undefined,'atlas-legend');
    legend.append(make('span','Solid / documented relationship','documented'),make('span','Dashed / inferred relationship','inferred'),make('span','Location indicates the sourced institution, not a personal address.'));
    root.append(legend);
    state.networkSection = assignId(make('section',undefined,'atlas-network-section'),'atlas-network-section');
    const networkHeading = make('div',undefined,'atlas-network-heading');
    state.networkTitle = make('h2','Network'); state.networkTitle.tabIndex=-1;
    state.networkContext = make('p','','atlas-network-context');
    const headingText=make('div'); headingText.append(state.networkTitle,state.networkContext);
    state.networkReset=button('All filtered nodes',()=>{selectedId=cityId=edgeId=null;networkPage=0;render();state.networkTitle.focus({preventScroll:true});},'atlas-network-reset');
    networkHeading.append(headingText,state.networkReset); state.networkSection.append(networkHeading);
    const networkGrid = make('div',undefined,'atlas-network-grid');
    state.network = assignId(svg('svg',{role:'group','aria-label':'Documented and inferred research relationships'}),'atlas-network');
    state.networkDetail = assignId(make('aside',undefined,'atlas-network-detail'),'atlas-network-detail'); state.networkDetail.setAttribute('aria-label','Relationship evidence');
    networkGrid.append(state.network,state.networkDetail); state.networkSection.append(networkGrid);
    const pager=make('div',undefined,'atlas-network-pager');
    state.pagePrev=button('Previous',()=>{networkPage--;edgeId=null;renderNetwork();if(state.pagePrev.disabled)state.pageNext.focus({preventScroll:true});});
    state.pageNext=button('Next',()=>{networkPage++;edgeId=null;renderNetwork();if(state.pageNext.disabled)state.pagePrev.focus({preventScroll:true});});
    state.pageInfo=make('span');state.pageInfo.setAttribute('role','status');pager.append(state.pagePrev,state.pageInfo,state.pageNext);state.networkSection.append(pager);
    const browse = make('details',undefined,'atlas-network-browse'); browse.append(make('summary','Browse this network page as a list'));
    state.networkList=make('div');browse.append(state.networkList); state.networkSection.append(browse); root.append(state.networkSection);
  }

  function renderMap() {
    const base = eligibleEntities();
    const selectedEdges = selectedId ? incident(selectedId) : [];
    const connectedIds = new Set(selectedId ? [selectedId] : []);
    selectedEdges.forEach(edge=>{connectedIds.add(edge.source);connectedIds.add(edge.target);});
    const connectedCities = new Set([...connectedIds].flatMap(id=>entityCities(entities.get(id))));
    const highlightTopic = topicId || topicPreview;
    const activeCity = cityPreview || cityId;
    data.locations.forEach(location => {
      const members = base.filter(entity=>entityCities(entity).includes(location.id));
      const relevant = !highlightTopic || members.some(entity=>list(entity.topicIds).includes(highlightTopic));
      const connected = connectedCities.has(location.id);
      const marker=cityMarkers.get(location.id),control=cityButtons.get(location.id); if(!marker)return;
      marker.classList.toggle('is-empty',!members.length&&!connected); marker.classList.toggle('is-muted',!relevant&&!connected);
      marker.classList.toggle('is-active',activeCity===location.id||connected);
      marker.setAttribute('aria-pressed',String(cityId===location.id)); marker.setAttribute('aria-label',`${location.name}: ${members.length} matching profiles.${connected?' Includes the selected profile or a recorded connection.':''} Show city.`);
      control.textContent=`${location.name} · ${members.length}`;control.classList.toggle('is-muted',(!members.length||!relevant)&&!connected);
      control.setAttribute('aria-pressed',String(cityId===location.id));
    });
    state.mapEdges.replaceChildren();
    selectedEdges.forEach(edge=>{
      const a=locations.get(entityCities(entities.get(edge.source))[0]),b=locations.get(entityCities(entities.get(edge.target))[0]);
      if(!a||!b||a.id===b.id)return;
      const p=project(a.lon,a.lat),q=project(b.lon,b.lat);
      const path=svg('path',{d:`M${p.x},${p.y}Q${(p.x+q.x)/2+30},${(p.y+q.y)/2-55} ${q.x},${q.y}`,class:`atlas-map-link ${edge.kind==='documented'?'documented':'inferred'}`});
      state.mapEdges.append(path);
    });
  }
  function renderCityList() {
    const host=state.cityList;host.replaceChildren();
    const location=locations.get(cityPreview||cityId);
    if(!location){host.append(make('h3','Select a city'),make('p','Hover, focus, or select a city to see its labs and researchers.','atlas-helper'));return;}
    const members=eligibleEntities().filter(entity=>entityCities(entity).includes(location.id));
    host.append(make('h3',location.name),make('p',location.summary||`${members.length} profiles in this selection.`,'atlas-helper'));
    const items=make('div',undefined,'atlas-city-members');
    members.forEach(entity=>{
      const control=button('',()=>selectEntity(entity.id),'atlas-entity-button');
      control.append(make('small',entity.type==='lab'?'LAB':'RESEARCHER'),make('span',entity.name));control.setAttribute('aria-pressed',String(selectedId===entity.id));items.append(control);
    });
    if(!members.length)items.append(make('p','No profiles match the current search and topic.','atlas-helper'));host.append(items);
  }
  function renderContact() {
    const host=state.contact;host.replaceChildren();
    const entity=entities.get(selectedId);
    if(!entity){
      host.append(make('p','RESEARCH PROFILE','section-label'),make('h3',topicId?topics.get(topicId)?.label:'Follow the evidence'),make('p',topicId?topics.get(topicId)?.summary:'Choose a profile from a city or network node. Its work, source, and relationship evidence appear here.','atlas-profile-copy'));
      const count=baseEntities().length;host.append(make('p',`${count} matching profiles · ${data.topics.length} curated topics`,'atlas-helper'));
      if(cityId)host.append(make('p',`City selected: ${locations.get(cityId)?.name || cityId}`,'atlas-helper'));
      return;
    }
    host.append(make('p',entity.type==='lab'?'LAB / RESEARCH GROUP':'RESEARCHER','section-label'));
    const badge=make('div',entity.name.split(/\s+/).map(word=>word[0]).slice(0,2).join(''),'atlas-profile-monogram');
    if(entity.imageUrl){
      try {
        const url=new URL(entity.imageUrl,location.href);
        if(url.origin===location.origin){const image=make('img');image.src=url.href;image.alt=entity.name;image.loading='lazy';image.addEventListener('error',()=>image.replaceWith(badge),{once:true});host.append(image);}
        else host.append(badge);
      } catch {host.append(badge);}
    } else host.append(badge);
    host.append(make('h3',entity.name),make('p',entity.affiliation||locations.get(entity.locationId)?.name||'','atlas-affiliation'));
    if(entity.locationBasis)host.append(make('p',`Location basis: ${entity.locationBasis}`,'atlas-helper'));
    if(entity.locationSourceUrl)host.append(link('Location source ↗',entity.locationSourceUrl));
    const provided=typeof entity.providedBio==='string'?entity.providedBio.trim():'';
    if(provided){host.append(make('h4','Provided description'),make('p',provided,'atlas-profile-copy'));if(entity.providedBioSourceUrl)host.append(link('Description source ↗',entity.providedBioSourceUrl));}
    if(entity.bio)host.append(make('h4',entity.providedBio===true?'Provided biography':'Research summary'),make('p',entity.bio,'atlas-profile-copy'));
    if(entity.work)host.append(make('h4','Work'),make('p',text(entity.work),'atlas-profile-copy'));
    if(entity.reason)host.append(make('h4','Why included'),make('p',entity.reason,'atlas-profile-copy'));
    const topicList=make('div',undefined,'atlas-profile-topics');list(entity.topicIds).forEach(id=>{const topic=topics.get(id);if(topic)topicList.append(button(topic.label,()=>selectTopic(id)));});host.append(topicList);
    if(entity.sourceUrl)host.append(link('Open primary profile ↗',entity.sourceUrl));
    host.append(button('Trace in network ↓',scrollToNetwork,'atlas-network-jump'));
  }
  function networkData() {
    const base=baseEntities(),baseIds=new Set(base.map(e=>e.id));
    let visibleIds=baseIds;
    if(selectedId){
      visibleIds=new Set([selectedId]);incident(selectedId).forEach(edge=>{visibleIds.add(edge.source);visibleIds.add(edge.target);});
    }else if(cityId){
      const local=new Set(base.filter(e=>entityCities(e).includes(cityId)).map(e=>e.id));visibleIds=new Set(local);
      data.connections.forEach(edge=>{if(baseIds.has(edge.source)&&baseIds.has(edge.target)&&(local.has(edge.source)||local.has(edge.target))){visibleIds.add(edge.source);visibleIds.add(edge.target);}});
    }
    const visible=(selectedId?data.entities:base).filter(e=>visibleIds.has(e.id)).sort((a,b)=>Number(Boolean(b.curated))-Number(Boolean(a.curated))||(locations.get(a.locationId)?.name||'').localeCompare(locations.get(b.locationId)?.name||'')||a.type.localeCompare(b.type)||a.name.localeCompare(b.name));
    return {visible,edges:data.connections.filter(edge=>visibleIds.has(edge.source)&&visibleIds.has(edge.target))};
  }
  function renderNetwork() {
    const result=networkData(),allEdges=result.edges;
    const center=selectedId?entities.get(selectedId):null;
    const candidates=center?result.visible.filter(entity=>entity.id!==selectedId):result.visible;
    const pageSize=center?12:24,totalPages=Math.max(1,Math.ceil(candidates.length/pageSize));
    networkPage=Math.max(0,Math.min(networkPage,totalPages-1));
    const page=candidates.slice(networkPage*pageSize,(networkPage+1)*pageSize);
    const visible=center?[center,...page]:page,shownIds=new Set(visible.map(entity=>entity.id));
    const edges=allEdges.filter(edge=>shownIds.has(edge.source)&&shownIds.has(edge.target));
    const width=compact.matches?480:1000,columns=compact.matches?2:visible.length<=6?2:4;
    let height=Math.max(260,Math.ceil(visible.length/columns)*100+70);
    const positions=new Map();
    if(center){
      height=compact.matches?Math.max(320,190+Math.ceil(page.length/2)*126):740;
      positions.set(center.id,{x:width/2,y:compact.matches?64:350});
      page.forEach((entity,index)=>{
        const angle=-Math.PI/2+index*Math.PI*2/Math.max(1,page.length);
        positions.set(entity.id,compact.matches?{x:120+(index%2)*240,y:198+Math.floor(index/2)*126}:{x:500+Math.cos(angle)*365,y:350+Math.sin(angle)*255});
      });
    } else visible.forEach((entity,index)=>positions.set(entity.id,{x:(index%columns+.5)*width/columns,y:70+Math.floor(index/columns)*100}));
    state.network.setAttribute('viewBox',`0 0 ${width} ${height}`);state.network.replaceChildren();networkNodeElements=new Map();
    state.networkList.replaceChildren();
    const context=selectedId?entities.get(selectedId).name:cityId?locations.get(cityId)?.name:topicId?topics.get(topicId)?.label:'Overview';
    state.networkContext.textContent=`${context}${selectedId?' · full recorded connections':''} · ${result.visible.length} profiles / ${allEdges.length} relationships · ${visible.length} profiles on this page`;
    state.networkReset.hidden=!selectedId&&!cityId;
    state.pagePrev.disabled=networkPage===0;state.pageNext.disabled=networkPage===totalPages-1;
    state.pageInfo.textContent=`Page ${networkPage+1} / ${totalPages}${center?' · focused profile retained':''}`;
    const edgeLayer=svg('g',{'aria-hidden':'true'});state.network.append(edgeLayer);
    edges.forEach(edge=>{
      const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)return;
      const dx=Math.max(30,Math.abs(b.x-a.x)*.42),direction=b.x>=a.x?1:-1;
      const path=svg('path',{d:`M${a.x},${a.y}C${a.x+dx*direction},${a.y-30} ${b.x-dx*direction},${b.y-30} ${b.x},${b.y}`,class:`atlas-network-edge ${edge.kind==='documented'?'documented':'inferred'}${edgeId===edge.id?' is-selected':''}`});
      edgeLayer.append(path);
    });
    visible.forEach(entity=>{
      const p=positions.get(entity.id),isCenter=entity.id===selectedId;
      const g=svg('g',{transform:`translate(${p.x},${p.y})`,class:`atlas-network-node ${entity.type==='lab'?'lab':'person'}${center?' bubble':''}${isCenter?' is-selected':''}`,tabindex:0,role:'button','aria-label':`${entity.name}, ${entity.type}. Show profile and relationships.`,'aria-pressed':String(isCenter)});
      const title=svg('title');title.textContent=entity.name;g.append(title);
      if(center){
        const radius=isCenter?42:29;
        g.append(svg('circle',{r:radius,class:'atlas-node-bubble'}));
        let imageShown=false;
        if(entity.imageUrl){try{
          const imageUrl=new URL(entity.imageUrl,location.href);
          if(imageUrl.origin===location.origin){
            const clipId=`atlas-portrait-${visible.indexOf(entity)}`;
            const defs=svg('defs'),clip=svg('clipPath',{id:clipId});clip.append(svg('circle',{r:radius-3}));defs.append(clip);g.append(defs);
            g.append(svg('image',{href:imageUrl.href,x:-radius,y:-radius,width:radius*2,height:radius*2,preserveAspectRatio:'xMidYMid slice','clip-path':`url(#${clipId})`}));imageShown=true;
          }
        }catch{}}
        if(!imageShown){const initials=svg('text',{x:0,y:5,'text-anchor':'middle',class:'atlas-bubble-initials'});initials.textContent=entity.name.split(/\s+/).map(word=>word[0]).slice(0,2).join('');g.append(initials);}
      } else g.append(svg('rect',{x:-103,y:-31,width:206,height:62,rx:entity.type==='lab'?3:15}),svg('circle',{cx:-87,cy:-13,r:3,class:'atlas-node-dot'}));
      const label=svg('text',{'text-anchor':'middle',class:'atlas-node-label'}),names=[];
      for(const word of entity.name.split(/\s+/)){if(!names.length||names.at(-1).length+word.length>(center?21:24))names.push(word);else names[names.length-1]+=` ${word}`;}
      names.slice(0,2).forEach((line,index)=>{const span=svg('tspan',{x:0,y:center?(isCenter?63:49)+index*16:names.length>1?-4+index*16:3});span.textContent=line+(index===1&&names.length>2?'…':'');label.append(span);});g.append(label);
      if(!center){const type=svg('text',{x:0,y:24,'text-anchor':'middle',class:'atlas-node-type'});type.textContent=`${entity.type==='lab'?'LAB':'RESEARCHER'} · ${locations.get(entity.locationId)?.name||(entity.locationScope==='external'?'OUTSIDE MAP':'LOCATION UNVERIFIED')}`;g.append(type);}
      g.addEventListener('click',()=>selectEntity(entity.id,true));
      g.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectEntity(entity.id,true);}});
      state.network.append(g);networkNodeElements.set(entity.id,g);
      const before=previousPositions.get(entity.id);
      if(!motion.matches&&before&&(before.x!==p.x||before.y!==p.y))g.animate([{transform:`translate(${before.x}px,${before.y}px)`},{transform:`translate(${p.x}px,${p.y}px)`}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});
      state.networkList.append(button(entity.name,()=>selectEntity(entity.id)));
    });
    previousPositions=positions;
    if(!visible.length){const empty=svg('text',{x:width/2,y:110,'text-anchor':'middle',class:'atlas-network-empty'});empty.textContent='No profiles match these filters.';state.network.append(empty);}
    updateNetworkHighlights();renderNetworkDetail(edges);
  }
  function updateNetworkHighlights() {
    const topic=topicId||topicPreview;
    networkNodeElements.forEach((node,id)=>node.classList.toggle('is-muted',Boolean(topic&&!list(entities.get(id)?.topicIds).includes(topic))));
  }
  function renderNetworkDetail(edges) {
    const host=state.networkDetail;host.replaceChildren();
    const chosen=edges.find(edge=>edge.id===edgeId);
    if(chosen){
      host.append(make('p',`${edgeKind(chosen).toUpperCase()} RELATIONSHIP`,'section-label'),make('h3',chosen.label),make('p',`${entities.get(chosen.source)?.name} → ${entities.get(chosen.target)?.name}`,'atlas-helper'),make('p',chosen.basis,'atlas-profile-copy'));
      if(chosen.sourceUrl)host.append(link('Open relationship evidence ↗',chosen.sourceUrl));
      host.append(button('Back to relationships',()=>{edgeId=null;renderNetwork();const h=state.networkDetail.querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});},'atlas-network-jump'));return;
    }
    host.append(make('p','RELATIONSHIP EVIDENCE','section-label'),make('h3',selectedId?entities.get(selectedId).name:'Inspect a connection'));
    host.append(make('p',selectedId?'Select a relationship on this page to read its basis.':'Select a profile to focus its direct links. Topic similarity is shown separately from documented relationships.','atlas-helper'));
    if(selectedId)host.append(button('Read profile ↑',focusContact,'atlas-network-jump'));
    const shown=selectedId?edges.filter(edge=>edge.source===selectedId||edge.target===selectedId):edges;
    const edgeList=make('div',undefined,'atlas-edge-list');
    shown.forEach(edge=>{
      const control=button('',()=>{edgeId=edge.id;renderNetwork();const h=state.networkDetail.querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});},'atlas-edge-button');
      control.append(make('small',edgeKind(edge)),make('span',edge.label),make('em',`${entities.get(edge.source)?.name} / ${entities.get(edge.target)?.name}`));edgeList.append(control);
    });
    if(!shown.length)edgeList.append(make('p',selectedId?'No relationship recorded for this profile.':'No relationship recorded in this filtered selection.','atlas-helper'));host.append(edgeList);
  }
  function render() {
    if(!initialized)return;
    const base=baseEntities();
    if(selectedId&&!entities.has(selectedId)){selectedId=null;edgeId=null;}
    topicButtons.forEach((control,id)=>{
      control.setAttribute('aria-pressed',String(topicId===id));
      control.querySelector('small').textContent=`${data.entities.filter(entity=>entityMatches(entity)&&list(entity.topicIds).includes(id)).length} profiles`;
    });
    state.clearTopic.hidden=!topicId;
    state.allProfiles.setAttribute('aria-pressed',String(showAll&&!unlocated));state.outsideMap.setAttribute('aria-pressed',String(unlocated));
    const eligible=eligibleEntities();
    state.status.textContent=`${eligible.length} searchable profiles · ${new Set(eligible.flatMap(entityCities)).size} sourced cities${curatedOverview()?` · network opens with ${base.length} curated profiles`:''}${topicId?` · ${topics.get(topicId)?.label} selected`:''}${query?` · search: ${query}`:''}${unlocated?' · without a verified map anchor':''}`;
    renderMap();renderCityList();renderContact();renderNetwork();
  }
  async function initialize(input) {
    if(initialized)return;
    const root=$('atlas-root');if(!root)return;
    try {
      const response=await fetch('./data/china-outline.json',{credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('Map geometry unavailable');outline=await response.json();
      data={...input,locations:list(input.locations),topics:list(input.topics),entities:list(input.entities),connections:list(input.connections)};
      entities=new Map(data.entities.map(entity=>[entity.id,entity]));locations=new Map(data.locations.map(location=>[location.id,location]));topics=new Map(data.topics.map(topic=>[topic.id,topic]));
      data.connections=data.connections.filter(edge=>entities.has(edge.source)&&entities.has(edge.target));
      build();initialized=true;render();
      document.dispatchEvent(new CustomEvent('ead:atlas-ready'));
    } catch {
      root.replaceChildren(make('p','The research atlas could not load. Reload to retry.','atlas-load-error'));
    }
  }
  document.addEventListener('ead:atlas-data',event=>initialize(event.detail),{once:true});
  document.addEventListener('ead:atlas-query',event=>{
    const next=normalize(typeof event.detail==='string'?event.detail:event.detail?.query).trim();
    if(next===query)return;
    query=next;selectedId=edgeId=cityId=cityPreview=null;networkPage=0;render();
  });
  document.addEventListener('ead:view',event=>{if(event.detail==='atlas'&&initialized)renderNetwork();});
  compact.addEventListener('change',()=>{if(initialized)renderNetwork();});
  motion.addEventListener('change',()=>{if(motion.matches)$('atlas-root')?.getAnimations({subtree:true}).forEach(animation=>animation.finish());});
})();
