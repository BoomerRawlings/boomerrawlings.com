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
  let previousPositions = new Map(), networkNodeElements = new Map(), networkPage = 0, browserPage = 0, unlocated = false, entityType = '';
  let adjacency = new Map(), neighborCounts = new Map(), searchIndex = new Map(), entityLocations = new Map(), eligibleCache = {key:null,items:[]};
  const cityMarkers = new Map(), cityLabels = new Map(), cityButtons = new Map(), topicButtons = new Map();
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
  const entityCities = entity => entityLocations.get(entity.id) || [];
  const typeLabel = type => ({person:'Researcher',lab:'Lab / team',institution:'Institution'})[type] || 'Profile';
  const readable = value => String(value || '').replaceAll('_',' ');
  const entityMatches = entity => query.split(/\s+/).filter(Boolean).every(word => (searchIndex.get(entity.id)||'').includes(word));
  function eligibleEntities() {
    const key=JSON.stringify([query,topicId,unlocated,entityType]);
    if(key!==eligibleCache.key)eligibleCache={key,items:data.entities.filter(entity=>entityMatches(entity)&&(!topicId||list(entity.topicIds).includes(topicId))&&(!unlocated||!entityCities(entity).length)&&(!entityType||entity.type===entityType)).sort(profileOrder)};
    return eligibleCache.items;
  }
  const baseEntities = eligibleEntities;
  const incident = id => adjacency.get(id) || [];
  const edgeKind = edge => edge.kind === 'documented' ? 'Documented' : 'Inferred';
  const connectionCount = id => neighborCounts.get(id) || 0;
  const profileOrder = (a,b) => Number(b.id==='r-yue-zhang-westlake')-Number(a.id==='r-yue-zhang-westlake') || Number(Boolean(b.curated))-Number(Boolean(a.curated)) || Number(b.type==='person')-Number(a.type==='person') || connectionCount(b.id)-connectionCount(a.id) || a.name.localeCompare(b.name);
  function prepareIndexes() {
    adjacency=new Map(data.entities.map(entity=>[entity.id,[]]));
    data.connections.forEach(edge=>{adjacency.get(edge.source).push(edge);if(edge.target!==edge.source)adjacency.get(edge.target).push(edge);});
    neighborCounts=new Map(data.entities.map(entity=>[entity.id,new Set(incident(entity.id).map(edge=>edge.source===entity.id?edge.target:edge.source).filter(id=>id!==entity.id)).size]));
    entityLocations=new Map(data.entities.map(entity=>[entity.id,[...new Set([entity.locationId,...list(entity.locationIds)].filter(id=>locations.has(id)))]]));
    searchIndex=new Map(data.entities.map(entity=>[entity.id,normalize([entity.name,entity.type,typeLabel(entity.type),entity.affiliation,entity.bio,text(entity.providedBio),text(entity.work),text(entity.reason),entityCities(entity).map(id=>locations.get(id)?.name).join(' '),list(entity.topicIds).map(id=>topics.get(id)?.label||'').join(' '),entity.indexRecord?.search_text,entity.indexRecord?.native_name,entity.indexRecord?.role,list(entity.indexRecord?.works).map(work=>[work.title,work.year].filter(Boolean).join(' ')).join(' ')].filter(Boolean).join(' '))]));
    eligibleCache={key:null,items:[]};
    state.totalTypes=data.entities.reduce((counts,entity)=>{counts[entity.type]=(counts[entity.type]||0)+1;return counts;},{person:0,lab:0,institution:0});
  }
  function portrait(entity, cls='atlas-avatar') {
    const badge=make('span',entity.name.split(/\s+/).map(word=>word[0]).slice(0,2).join(''),cls);
    if(entity.imageUrl)try{const url=new URL(entity.imageUrl,location.href);if(url.origin===location.origin){const image=make('img',undefined,cls);image.src=url.href;image.alt='';image.loading='lazy';image.addEventListener('error',()=>image.replaceWith(badge),{once:true});return image;}}catch{}
    return badge;
  }
  function scrollToNetwork() {
    state.networkTitle.focus({preventScroll:true});
    state.networkSection.scrollIntoView({block:'start',behavior:motion.matches ? 'auto' : 'smooth'});
  }
  function selectEntity(id, restoreNetworkFocus = false) {
    if (!entities.has(id)) return;
    selectedId = id; edgeId = null; if(cityPreview)cityId=cityPreview; cityPreview = null; networkPage = 0;
    render();
    if (restoreNetworkFocus) networkNodeElements.get(id)?.focus({preventScroll:true});
    else {const heading=state.contact.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  function focusContact() {
    const heading=state.contact.querySelector('h3');if(!heading)return;
    state.contact.scrollTop=0;heading.tabIndex=-1;heading.focus({preventScroll:true});
    state.browserPanel.scrollIntoView({block:'nearest',behavior:motion.matches?'auto':'smooth'});
  }
  function selectCity(id) {
    cityId = id || null; cityPreview = null; selectedId = null; edgeId = null; networkPage = browserPage = 0; unlocated = false;
    render();
    if(id&&matchMedia('(max-width:800px)').matches){const heading=state.cityList.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});state.browserPanel.scrollIntoView({block:'start',behavior:motion.matches?'auto':'smooth'});}
  }
  function previewCity(id) {
    if(cityId || selectedId || cityPreview===id)return;
    cityPreview = id;browserPage=0;renderMap();if(!selectedId)renderCityList();
  }
  function selectTopic(id) {
    topicId = id; topicPreview = null; selectedId = null; edgeId = null; cityId = cityPreview = null; networkPage = browserPage = 0;
    render();
    topicButtons.get(id)?.focus({preventScroll:true});
  }
  function exploreTopic(id) {
    query='';unlocated=false;entityType='';
    document.dispatchEvent(new CustomEvent('ead:reset-query'));
    selectTopic(id);
    if(matchMedia('(max-width:800px)').matches)state.browserPanel.scrollIntoView({block:'start',behavior:motion.matches?'auto':'smooth'});
  }
  function reset() {
    query = ''; topicId = topicPreview = cityId = cityPreview = selectedId = edgeId = null; networkPage = browserPage = 0; unlocated = false; entityType='';
    document.dispatchEvent(new CustomEvent('ead:reset-query'));
    render(); state.overview.focus({preventScroll:true});
  }
  function build() {
    const root = $('atlas-root'); root.replaceChildren();
    const heading = make('div', undefined, 'atlas-heading');
    const intro = make('div'); intro.append(make('h2', 'China research network'));
    if(entities.has('r-yue-zhang-westlake'))intro.append(button('Start with Yue Zhang →',()=>{selectEntity('r-yue-zhang-westlake');focusContact();},'atlas-start'));
    state.overview = button('Reset atlas', reset, 'atlas-reset');
    state.status = assignId(make('p', '', 'atlas-status'), 'atlas-status'); state.status.setAttribute('role', 'status');
    const scope=make('div',undefined,'atlas-scope-controls');
    state.allProfiles=button(`All ${data.entities.length} profiles`,()=>{unlocated=false;entityType='';selectedId=cityId=cityPreview=edgeId=null;networkPage=browserPage=0;render();},'atlas-scope');
    state.outsideMap=button('Outside map',()=>{unlocated=true;selectedId=cityId=cityPreview=edgeId=null;networkPage=browserPage=0;render();},'atlas-scope');
    state.typeSelect=make('select',undefined,'atlas-type-select');state.typeSelect.setAttribute('aria-label','Profile type');
    [['','All types'],['person','People'],['lab','Labs / teams'],['institution','Institutions']].forEach(([value,label])=>{const option=make('option',label);option.value=value;state.typeSelect.append(option);});
    state.typeSelect.addEventListener('change',()=>{entityType=state.typeSelect.value;selectedId=cityId=cityPreview=edgeId=null;networkPage=browserPage=0;render();});
    scope.append(state.allProfiles,state.outsideMap,state.typeSelect,state.overview);heading.append(intro,scope);root.append(heading,state.status);
    state.topicPanel = make('div',undefined,'atlas-topic-panel'); state.topicPanel.setAttribute('aria-label','Filter profiles by research topic');
    state.topicPanel.append(make('span','Topics','atlas-topic-label'));
    data.topics.forEach(topic => {
      const control = button('',()=>selectTopic(topic.id),'atlas-topic'); control.append(make('span',topic.label),make('small',''));
      control.setAttribute('aria-pressed','false'); control.title = topic.summary || topic.label;
      const preview = () => { topicPreview=topic.id;renderMap();updateNetworkHighlights(); };
      control.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')preview();});control.addEventListener('focus',preview);
      topicButtons.set(topic.id,control); state.topicPanel.append(control);
    });
    const clearPreview = () => {topicPreview=null;renderMap();updateNetworkHighlights();};
    state.topicPanel.addEventListener('pointerleave',()=>{if(!state.topicPanel.contains(document.activeElement))clearPreview();});
    state.topicPanel.addEventListener('focusout',event=>{if(!state.topicPanel.contains(event.relatedTarget))clearPreview();});
    state.clearTopic = button('Clear topic',()=>{topicId=topicPreview=null;networkPage=browserPage=0;render();state.overview.focus({preventScroll:true});},'atlas-clear-topic');
    state.topicPanel.append(state.clearTopic);root.append(state.topicPanel);
    const grid = make('div', undefined, 'atlas-grid');
    state.mapPanel = make('section', undefined, 'atlas-map-panel'); state.mapPanel.setAttribute('aria-label', 'Cities and their researchers');
    const mapToolbar=make('div',undefined,'atlas-map-toolbar');
    const cityLabel=make('label','Browse city');cityLabel.htmlFor='atlas-city-select';state.citySelect=assignId(make('select'),'atlas-city-select');
    const allCities=make('option','All cities');allCities.value='';state.citySelect.append(allCities);
    data.locations.forEach(city=>{const option=make('option',city.name);option.value=city.id;state.citySelect.append(option);});
    state.citySelect.addEventListener('change',()=>selectCity(state.citySelect.value));
    mapToolbar.append(cityLabel,state.citySelect,button('Network ↓',scrollToNetwork,'atlas-map-network'));state.mapPanel.append(mapToolbar);
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
    const markerLayer = svg('g'),labelLayer=svg('g',{'aria-hidden':'true',class:'atlas-city-labels'}); state.map.append(markerLayer,labelLayer);
    const placed=[],anchors=data.locations.filter(city=>Number.isFinite(city.lat)&&Number.isFinite(city.lon)).map(city=>({...project(city.lon,city.lat),id:city.id}));
    [...data.locations].sort((a,b)=>b.lat-a.lat||a.id.localeCompare(b.id)).forEach(location => {
      if (!Number.isFinite(location.lat) || !Number.isFinite(location.lon)) return;
      const anchor = project(location.lon, location.lat);
      // The point never moves. Only its nearby label may choose another side;
      // crowded labels appear on hover/focus/selection instead of crossing the map.
      const width=location.name.length*10+16,height=28;
      const candidates=[{x:anchor.x+12,y:anchor.y-height-6},{x:anchor.x+12,y:anchor.y+6},{x:anchor.x-width-12,y:anchor.y-height-6},{x:anchor.x-width-12,y:anchor.y+6},{x:anchor.x-width/2,y:anchor.y-height-18},{x:anchor.x-width/2,y:anchor.y+18}];
      const clear=box=>box.x>=4&&box.x+width<=996&&box.y>=4&&box.y+height<=636&&placed.every(other=>box.x+width+5<other.x||box.x>other.x+other.width+5||box.y+height+5<other.y||box.y>other.y+other.height+5)&&anchors.every(point=>point.id===location.id||point.x<box.x-8||point.x>box.x+width+8||point.y<box.y-8||point.y>box.y+height+8);
      const available=candidates.find(clear),box=available||candidates[0];
      if(available)placed.push({...box,width,height});
      const marker = svg('g',{transform:`translate(${anchor.x},${anchor.y})`,class:'atlas-city',tabindex:0,role:'button','aria-label':location.name,'aria-pressed':'false'});
      const title = svg('title'); title.textContent = location.name;
      marker.append(title,svg('circle',{r:14,class:'atlas-city-hit'}),svg('circle',{r:9,class:'atlas-city-halo'}),svg('circle',{r:4.5,class:'atlas-city-dot'}));
      const label=svg('g',{class:`atlas-city-caption${available?'':' is-dense'}`});
      const nearX=Math.max(box.x,Math.min(anchor.x,box.x+width)),nearY=Math.max(box.y,Math.min(anchor.y,box.y+height));
      label.append(svg('path',{d:`M${anchor.x},${anchor.y}L${nearX},${nearY}`,class:'atlas-city-leader'}),svg('rect',{x:box.x,y:box.y,width,height,rx:3,class:'atlas-city-label-bg'}));
      const caption=svg('text',{x:box.x+8,y:box.y+19,class:'atlas-city-label'});caption.textContent=location.name;label.append(caption);labelLayer.append(label);cityLabels.set(location.id,label);
      let hovered=false,focused=false;const showLabel=()=>{label.classList.toggle('is-peek',hovered||focused);if(hovered||focused)labelLayer.append(label);};
      marker.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'){hovered=true;showLabel();previewCity(location.id);}});
      marker.addEventListener('pointerleave',()=>{hovered=false;showLabel();});
      marker.addEventListener('focus',()=>{focused=true;showLabel();previewCity(location.id);});
      marker.addEventListener('blur',()=>{focused=false;showLabel();});
      marker.addEventListener('click',()=>selectCity(location.id));
      marker.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectCity(location.id);}});
      cityMarkers.set(location.id,marker); markerLayer.append(marker);
      cityButtons.set(location.id,state.citySelect.querySelector(`option[value="${location.id}"]`));
    });
    state.cityList = assignId(make('div',undefined,'atlas-city-results'),'atlas-city-results');
    const mapCredit = make('p',undefined,'atlas-map-credit'); mapCredit.append(link('Natural Earth',outline.meta.licenseUrl),make('span','Points mark city anchors. Hover a point or choose a city above.'));
    state.mapPanel.append(state.map,mapCredit);
    state.contact = assignId(make('aside',undefined,'atlas-contact'),'atlas-contact'); state.contact.setAttribute('aria-label','Selected research profile');
    state.browserPanel=make('section',undefined,'atlas-browser-panel');state.browserPanel.setAttribute('aria-label','Browse research profiles');state.browserPanel.append(state.cityList,state.contact);
    grid.append(state.mapPanel,state.browserPanel); root.append(grid);
    const legend = make('div',undefined,'atlas-legend');
    legend.append(make('span','Solid: documented','documented'),make('span','Dashed: inferred','inferred'),make('span','Topic filters indicate shared research, not relationships.'));
    root.append(legend);
    state.networkSection = assignId(make('section',undefined,'atlas-network-section'),'atlas-network-section');
    const networkHeading = make('div',undefined,'atlas-network-heading');
    state.networkTitle = make('h2','Network'); state.networkTitle.tabIndex=-1;
    state.networkContext = make('p','','atlas-network-context');
    const headingText=make('div'); headingText.append(state.networkTitle,state.networkContext,make('p','Click a profile to follow it. Click a numbered link to inspect its evidence.','atlas-helper'));
    state.networkReset=button('All filtered nodes',()=>{selectedId=cityId=cityPreview=edgeId=null;networkPage=browserPage=0;render();state.networkTitle.focus({preventScroll:true});},'atlas-network-reset');
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
    state.citySelect.value=cityId||'';
    data.locations.forEach(location => {
      const members = base.filter(entity=>entityCities(entity).includes(location.id));
      const relevant = !highlightTopic || members.some(entity=>list(entity.topicIds).includes(highlightTopic));
      const connected = connectedCities.has(location.id);
      const marker=cityMarkers.get(location.id),control=cityButtons.get(location.id); if(!marker)return;
      marker.classList.toggle('is-empty',!members.length&&!connected); marker.classList.toggle('is-muted',!relevant&&!connected);
      marker.classList.toggle('is-active',activeCity===location.id||connected);
      const caption=cityLabels.get(location.id);caption.classList.toggle('is-active',activeCity===location.id);caption.classList.toggle('is-muted',(!members.length||!relevant)&&!connected);
      if(activeCity===location.id)caption.parentNode.append(caption);
      marker.setAttribute('aria-pressed',String(cityId===location.id)); marker.setAttribute('aria-label',`${location.name}: ${members.length} matching profiles.${connected?' Includes the selected profile or a recorded connection.':''} Show city.`);
      control.textContent=`${location.name} · ${members.length}`;
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
    const host=state.cityList;host.hidden=Boolean(selectedId);
    const city=locations.get(cityPreview||cityId);
    const starting=!query&&!topicId&&!city&&!unlocated&&!entityType;
    const members=eligibleEntities().filter(entity=>!city||entityCities(entity).includes(city.id));
    const totalPages=Math.max(1,Math.ceil(members.length/12));browserPage=Math.max(0,Math.min(browserPage,totalPages-1));
    const key=JSON.stringify([city?.id,cityId,query,topicId,entityType,unlocated,browserPage,members.map(e=>e.id)]);
    if(key===state.browserKey)return;state.browserKey=key;host.replaceChildren();
    const title=city?.name || (query?'Search results':topicId?topics.get(topicId)?.label:unlocated?'Outside the map':entityType?({person:'People',lab:'Labs / teams',institution:'Institutions'})[entityType]:'All profiles');
    const header=make('div',undefined,'atlas-browser-heading');
    header.append(make('h3',title),make('span',`${members.length} profiles`,'atlas-result-count'));host.append(header);
    if(starting)host.append(make('p','The full directory. Begin with Yue Zhang, search, or choose a city or profile type.','atlas-helper'));
    else if(city)host.append(make('p',cityId?'City selected. Click another map point to switch.':city.summary||'People, labs and institutions linked to this city.','atlas-helper'));
    const items=make('div',undefined,'atlas-city-members');
    members.slice(browserPage*12,(browserPage+1)*12).forEach(entity=>{
      const control=button('',()=>selectEntity(entity.id),'atlas-entity-button');
      const copy=make('span',undefined,'atlas-entity-copy'),count=connectionCount(entity.id);
      copy.append(make('strong',starting&&entity.id==='r-yue-zhang-westlake'?'Start with Yue Zhang':entity.name),make('span',entity.affiliation||typeLabel(entity.type),'atlas-entity-affiliation'),make('small',`${typeLabel(entity.type).toUpperCase()} · ${count} connection${count===1?'':'s'}`));
      control.append(portrait(entity),copy,make('span','→','atlas-entity-arrow'));control.setAttribute('aria-label',`${starting&&entity.id==='r-yue-zhang-westlake'?'Start with ':''}${entity.name}. ${count} connections. Show profile.`);items.append(control);
    });
    if(!members.length)items.append(make('p','No matching profiles. Clear a topic or reset the atlas to broaden the search.','atlas-helper'));host.append(items);
    if(totalPages>1){const pager=make('div',undefined,'atlas-browser-pager');
      const changePage=delta=>{browserPage+=delta;renderCityList();const buttons=host.querySelectorAll('.atlas-browser-pager button');const target=delta>0?buttons[1]:buttons[0];(target.disabled?(delta>0?buttons[0]:buttons[1]):target).focus({preventScroll:true});};
      const previous=button('Previous',()=>changePage(-1)),next=button('Next',()=>changePage(1));previous.disabled=browserPage===0;next.disabled=browserPage===totalPages-1;
      pager.append(previous,make('span',`${browserPage+1} / ${totalPages}`),next);host.append(pager);}
  }
  function renderContact() {
    const host=state.contact;host.hidden=!selectedId;
    const entity=entities.get(selectedId);if(!entity)return;
    if(state.contactKey===entity.id)return;state.contactKey=entity.id;host.replaceChildren();host.scrollTop=0;
    host.append(button('← Back to profiles',()=>{selectedId=edgeId=null;render();const h=state.cityList.querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});},'atlas-back'));
    const header=make('div',undefined,'atlas-profile-heading'),headingText=make('div');
    headingText.append(make('p',typeLabel(entity.type).toUpperCase(),'section-label'),make('h3',entity.name),make('p',entity.affiliation||locations.get(entity.locationId)?.name||'','atlas-affiliation'));
    header.append(portrait(entity,'atlas-avatar atlas-profile-avatar'),headingText);host.append(header);
    const count=connectionCount(entity.id),actions=make('div',undefined,'atlas-profile-actions');
    if(count)actions.append(button(`View ${count} connection${count===1?'':'s'} ↓`,scrollToNetwork,'atlas-primary'));
    actions.append(button('Find papers',()=>document.dispatchEvent(new CustomEvent('ead:catalogue',{detail:entity.name})),'atlas-papers'));
    if(entity.sourceUrl)actions.append(link('Source ↗',entity.sourceUrl));host.append(actions);
    if(!count)host.append(make('p','No recorded connections. Explore this profile’s papers or shared topics below.','atlas-helper'));
    if(entity.work||entity.bio)host.append(make('p',text(entity.work||entity.bio),'atlas-profile-copy atlas-profile-summary'));
    const topicList=make('div',undefined,'atlas-profile-topics');list(entity.topicIds).forEach(id=>{const topic=topics.get(id);if(topic)topicList.append(button(topic.label,()=>exploreTopic(id)));});host.append(topicList);
    renderIndexDetails(host,entity);
    const detail=make('details',undefined,'atlas-profile-details');detail.append(make('summary','Biography, work & provenance'));
    if(entity.bio)detail.append(make('h4','Research summary'),make('p',entity.bio,'atlas-profile-copy'));
    if(entity.work)detail.append(make('h4','Work'),make('p',text(entity.work),'atlas-profile-copy'));
    if(entity.reason)detail.append(make('h4','Why included'),make('p',text(entity.reason),'atlas-profile-copy'));
    const provided=typeof entity.providedBio==='string'?entity.providedBio.trim():'';
    const record=entity.indexRecord||{},translated=record.bio_translated||record.bio_is_translation;
    if(record.native_name)detail.append(make('h4','Name as published'),make('p',record.native_name,'atlas-profile-copy'));
    if(list(record.topics).length)detail.append(make('h4','Research topics'),make('p',record.topics.join(' · '),'atlas-profile-copy'));
    if(provided){detail.append(make('h4',translated?'Provided description · translated':'Provided description'),make('p',provided,'atlas-profile-copy'));if(entity.providedBioSourceUrl)detail.append(link('Description source ↗',entity.providedBioSourceUrl));}
    const original=record.bio_original_excerpt||record.bio_original;
    if(original&&original!==provided){detail.append(make('h4',`Original excerpt${record.bio_language?` · ${record.bio_language}`:''}`),make('p',text(original),'atlas-profile-copy'));}
    if(entity.locationBasis)detail.append(make('h4','Location basis'),make('p',entity.locationBasis,'atlas-helper'));
    if(entity.locationSourceUrl)detail.append(link('Location source ↗',entity.locationSourceUrl));
    if(record.image_source_url&&entity.imageUrl)detail.append(link('Image source ↗',record.image_source_url));
    if(list(entity.affiliationRecords).length){detail.append(make('h4','Affiliations & history'));list(entity.affiliationRecords).forEach(record=>{detail.append(make('p',[record.name,record.relationship,record.role,record.date].filter(Boolean).join(' · '),'atlas-helper'));if(record.sourceUrl)detail.append(link('Affiliation source ↗',record.sourceUrl));});}
    host.append(detail);
  }
  function renderIndexDetails(host,entity) {
    const record=entity.indexRecord;if(!record||typeof record!=='object')return;
    const disclosure=(title)=>{const node=make('details',undefined,'atlas-profile-details');node.append(make('summary',title));return node;};
    const works=list(record.works);
    if(works.length){const section=disclosure(`Linked works · ${works.length}`);
      works.forEach(work=>{const item=make('article',undefined,'atlas-record-item');item.append(work.url?link(work.title||'Open work ↗',work.url):make('p',work.title||'Indexed work','atlas-profile-copy'));
        const meta=[work.year||work.date,work.type,work.version,readable(work.relationship)].filter(Boolean);if(meta.length)item.append(make('p',meta.join(' · '),'atlas-helper'));
        if(work.authorship_source_url)item.append(link('Authorship source ↗',work.authorship_source_url));section.append(item);});host.append(section);}
    if(record.role||record.profile_role||record.current_status||record.profile_role_status||list(record.role_history).length){const section=disclosure('Role & history');
      const fields=[['Indexed role',record.role],['Institution',record.affiliation||record.institution],['Role basis',readable(record.role_basis)],['Role date',record.role_date],['Record status',readable(record.current_status)],['Profile role status',readable(record.profile_role_status)]];
      if(record.profile_role&&record.profile_role!==record.role)fields.push(['Profile role',record.profile_role],['Profile institution',record.profile_affiliation],['Profile role basis',readable(record.profile_role_basis)]);
      const facts=make('dl',undefined,'atlas-record-facts');fields.filter(([,value])=>value).forEach(([label,value])=>facts.append(make('dt',label),make('dd',text(value))));section.append(facts);
      const source=record.profile_role_source_url||record.profile_source_url||record.source_url;if(source)section.append(link('Role source ↗',source));
      list(record.role_history).forEach(role=>{const item=make('article',undefined,'atlas-record-item');item.append(make('p',[role.role,role.institution,role.start_date?`from ${role.start_date}`:null,role.end_date?`to ${role.end_date}`:null].filter(Boolean).join(' · '),'atlas-profile-copy'));if(role.source_url)item.append(link('History source ↗',role.source_url));section.append(item);});host.append(section);}
    const evidenceGroups=[['Application evidence',record.application_evidence||record.documented_application],['Inferred application',record.application_inference||record.inferred_application||record.potential_application],['Funding evidence',record.funding_evidence],['Additional research evidence',record.additional_research_evidence]];
    evidenceGroups.forEach(([title,value])=>{if(!value||Array.isArray(value)&&!value.length)return;const section=disclosure(title);
      (Array.isArray(value)?value:[value]).forEach(evidence=>{const item=make('article',undefined,'atlas-record-item');
        if(typeof evidence==='string')item.append(make('p',evidence,'atlas-profile-copy'));
        else if(evidence&&typeof evidence==='object'){
          if(evidence.title||evidence.source_title)item.append(make('h4',evidence.title||evidence.source_title));
          if(evidence.description||evidence.explanation)item.append(make('p',evidence.description||evidence.explanation,'atlas-profile-copy'));
          const meta=[readable(evidence.basis||evidence.relation_basis),evidence.date,readable(evidence.verification_level),evidence.page?`page ${evidence.page}`:null,evidence.source_date_basis?`date basis: ${readable(evidence.source_date_basis)}`:null,evidence.project_start?`project start: ${evidence.project_start}`:null,evidence.planned_end?`planned end: ${evidence.planned_end}`:null].filter(Boolean);
          if(meta.length)item.append(make('p',meta.join(' · '),'atlas-helper'));
          if(evidence.source_url)item.append(link('Evidence source ↗',evidence.source_url));
        }section.append(item);});host.append(section);});
    if(list(record.author_affiliations).length){const section=disclosure('Paper authors & affiliations');
      list(record.author_affiliations).forEach(author=>{const item=make('article',undefined,'atlas-record-item');item.append(entities.has(author.researcher_id)?button(author.name,()=>selectEntity(author.researcher_id),'atlas-author-link'):make('strong',author.name));item.append(make('p',[author.affiliation,author.role_in_work,author.affiliation_status].filter(Boolean).join(' · '),'atlas-helper'));section.append(item);});if(record.source_url)section.append(link('Paper source ↗',record.source_url));host.append(section);}
    const additional=[...new Set([...list(record.additional_source_urls),...list(record.identity_source_urls)])];
    if(additional.length){const section=disclosure('Additional sources');additional.forEach((url,index)=>section.append(link(`Source ${index+1} ↗`,url)));host.append(section);}
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
    const visible=(selectedId?data.entities:base).filter(e=>visibleIds.has(e.id)).sort(profileOrder);
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
      height=compact.matches?Math.max(320,190+Math.ceil(page.length/2)*126):650;
      positions.set(center.id,{x:width/2,y:compact.matches?64:300});
      page.forEach((entity,index)=>{
        const angle=-Math.PI/2+index*Math.PI*2/Math.max(1,page.length);
        positions.set(entity.id,compact.matches?{x:120+(index%2)*240,y:198+Math.floor(index/2)*126}:{x:500+Math.cos(angle)*365,y:300+Math.sin(angle)*215});
      });
    } else visible.forEach((entity,index)=>positions.set(entity.id,{x:(index%columns+.5)*width/columns,y:70+Math.floor(index/columns)*100}));
    state.network.setAttribute('viewBox',`0 0 ${width} ${height}`);state.network.replaceChildren();networkNodeElements=new Map();
    state.networkList.replaceChildren();
    const context=selectedId?entities.get(selectedId).name:cityId?locations.get(cityId)?.name:topicId?topics.get(topicId)?.label:'Overview';
    state.networkContext.textContent=`${context}${selectedId?' · full recorded connections':''} · ${result.visible.length} profiles / ${allEdges.length} relationships · ${visible.length} profiles on this page`;
    state.networkReset.hidden=!selectedId&&!cityId;
    state.pagePrev.disabled=networkPage===0;state.pageNext.disabled=networkPage===totalPages-1;
    state.pageInfo.textContent=`Page ${networkPage+1} / ${totalPages}${center?' · focused profile retained':''}`;
    state.renderedEdges=edges;state.edgeElements=new Map();
    const edgeLayer=svg('g'),badgeLayer=svg('g');state.network.append(edgeLayer,badgeLayer);
    const parallel=new Map();edges.forEach(edge=>{const key=[edge.source,edge.target].sort().join('|');if(!parallel.has(key))parallel.set(key,[]);parallel.get(key).push(edge.id);});
    edges.forEach((edge,index)=>{
      const a=positions.get(edge.source),b=positions.get(edge.target);if(!a||!b)return;
      const dx=Math.max(30,Math.abs(b.x-a.x)*.42),direction=b.x>=a.x?1:-1;
      const pair=parallel.get([edge.source,edge.target].sort().join('|')),offset=(pair.indexOf(edge.id)-(pair.length-1)/2)*96;
      const orientation=edge.source<edge.target?1:-1,length=Math.hypot(b.x-a.x,b.y-a.y)||1;
      const ox=-(b.y-a.y)/length*offset*orientation,oy=(b.x-a.x)/length*offset*orientation;
      const d=`M${a.x},${a.y}C${a.x+dx*direction+ox},${a.y-30+oy} ${b.x-dx*direction+ox},${b.y-30+oy} ${b.x},${b.y}`;
      const edgeControl=svg('g',{class:`atlas-edge-control${edgeId===edge.id?' is-selected':''}`});
      const badgeControl=svg('g',{class:`atlas-edge-control${edgeId===edge.id?' is-selected':''}`,role:'button',tabindex:0,'aria-pressed':String(edgeId===edge.id),'aria-label':`${edgeKind(edge)} relationship: ${entities.get(edge.source)?.name} and ${entities.get(edge.target)?.name}. ${edge.label}`});
      if(edges.filter(other=>other.source===edge.source&&other.target===edge.target&&other.kind===edge.kind&&other.label===edge.label).length>1)badgeControl.setAttribute('aria-label',`${badgeControl.getAttribute('aria-label')}. Connection ${index+1}`);
      const mid={x:(a.x+b.x)/2+ox*.75,y:(a.y+b.y)/2-22.5+oy*.75},hit=compact.matches?32:22;
      const path=svg('path',{d,class:`atlas-network-edge ${edge.kind==='documented'?'documented':'inferred'}`});
      const label=svg('text',{x:mid.x,y:mid.y+4,'text-anchor':'middle',class:'atlas-edge-number'});label.textContent=String(index+1);
      edgeControl.append(svg('path',{d,class:'atlas-edge-hit'}),path);
      badgeControl.append(svg('rect',{x:mid.x-hit,y:mid.y-hit,width:hit*2,height:hit*2,rx:hit,class:'atlas-edge-badge-hit'}),svg('circle',{cx:mid.x,cy:mid.y,r:compact.matches?16:11,class:'atlas-edge-badge'}),label);
      edgeControl.addEventListener('click',()=>selectEdge(edge.id));badgeControl.addEventListener('click',()=>selectEdge(edge.id));badgeControl.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectEdge(edge.id);}});
      edgeLayer.append(edgeControl);badgeLayer.append(badgeControl);state.edgeElements.set(edge.id,[edgeControl,badgeControl]);
    });
    visible.forEach(entity=>{
      const p=positions.get(entity.id),isCenter=entity.id===selectedId;
      const g=svg('g',{transform:`translate(${p.x},${p.y})`,class:`atlas-network-node ${['person','lab','institution'].includes(entity.type)?entity.type:'person'}${center?' bubble':''}${isCenter?' is-selected':''}`,tabindex:0,role:'button','aria-label':`${entity.name}, ${typeLabel(entity.type)}. Show profile and relationships.`,'aria-pressed':String(isCenter)});
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
      } else g.append(svg('rect',{x:-103,y:-31,width:206,height:62,rx:entity.type==='person'?15:entity.type==='lab'?3:0}),svg('circle',{cx:-87,cy:-13,r:3,class:'atlas-node-dot'}));
      const label=svg('text',{'text-anchor':'middle',class:'atlas-node-label'}),names=[];
      for(const word of entity.name.split(/\s+/)){if(!names.length||names.at(-1).length+word.length>(center?21:24))names.push(word);else names[names.length-1]+=` ${word}`;}
      names.slice(0,2).forEach((line,index)=>{const span=svg('tspan',{x:0,y:center?(isCenter?63:49)+index*16:names.length>1?-4+index*16:3});span.textContent=line+(index===1&&names.length>2?'…':'');label.append(span);});g.append(label);
      if(!center){const type=svg('text',{x:0,y:24,'text-anchor':'middle',class:'atlas-node-type'});type.textContent=`${typeLabel(entity.type).toUpperCase()} · ${locations.get(entity.locationId)?.name||(entity.locationScope==='external'?'OUTSIDE MAP':'LOCATION UNVERIFIED')}`;g.append(type);}
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
  function selectEdge(id) {
    edgeId=id;
    state.edgeElements?.forEach((nodes,key)=>nodes.forEach(node=>{node.classList.toggle('is-selected',key===id);if(node.hasAttribute('role'))node.setAttribute('aria-pressed',String(key===id));}));
    renderNetworkDetail(state.renderedEdges||[]);
    if(id){state.networkDetail.scrollTop=0;if(matchMedia('(max-width:800px)').matches){const heading=state.networkDetail.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});state.networkDetail.scrollIntoView({block:'start',behavior:motion.matches?'auto':'smooth'});}}
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
      const record=chosen.indexRecord||chosen,mechanism=chosen.mechanism||record.mechanism,date=chosen.date||record.date;
      if(mechanism||date)host.append(make('p',[mechanism?`Mechanism: ${readable(mechanism)}`:null,date?`Evidence date: ${date}`:null].filter(Boolean).join(' · '),'atlas-helper'));
      if(chosen.sourceUrl)host.append(link('Open relationship evidence ↗',chosen.sourceUrl));
      const support=[...new Set([...list(chosen.additional_source_urls),...list(record.additional_source_urls),...list(chosen.evidenceUrls),chosen.supporting_source_url,record.supporting_source_url].filter(url=>typeof url==='string'&&url!==chosen.sourceUrl))];
      support.forEach((url,index)=>host.append(link(`Supporting source ${index+1} ↗`,url)));
      host.append(button('Back to relationships',()=>{selectEdge(null);const h=state.networkDetail.querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});},'atlas-network-jump'));return;
    }
    host.append(make('p','RELATIONSHIP EVIDENCE','section-label'),make('h3',selectedId?entities.get(selectedId).name:'Inspect a connection'));
    host.append(make('p',selectedId?'Select a relationship on this page to read its basis.':'Select a profile to focus its direct links. Topic similarity is shown separately from documented relationships.','atlas-helper'));
    if(selectedId)host.append(button('Read profile ↑',focusContact,'atlas-network-jump'));
    const shown=selectedId?edges.filter(edge=>edge.source===selectedId||edge.target===selectedId):edges;
    const edgeList=make('div',undefined,'atlas-edge-list');
    shown.forEach(edge=>{
      const control=button('',()=>{selectEdge(edge.id);const h=state.networkDetail.querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});},'atlas-edge-button');
      control.append(make('small',`${edges.indexOf(edge)+1} · ${edgeKind(edge)}`),make('span',edge.label),make('em',`${entities.get(edge.source)?.name} / ${entities.get(edge.target)?.name}`));edgeList.append(control);
    });
    if(!shown.length){edgeList.append(make('p',selectedId?'No recorded relationships. Explore this profile’s papers or shared topics.':'No relationships on this page. Select a profile to see every recorded connection.','atlas-helper'));
      const entity=entities.get(selectedId);if(entity){edgeList.append(button('Find papers',()=>document.dispatchEvent(new CustomEvent('ead:catalogue',{detail:entity.name}))));list(entity.topicIds).forEach(id=>{const topic=topics.get(id);if(topic)edgeList.append(button(`Explore ${topic.label}`,()=>exploreTopic(id)));});}}
    host.append(edgeList);
  }
  function render() {
    if(!initialized)return;
    if(selectedId&&!entities.has(selectedId)){selectedId=null;edgeId=null;}
    topicButtons.forEach((control,id)=>{
      control.setAttribute('aria-pressed',String(topicId===id));
      control.querySelector('small').textContent=String(data.entities.filter(entity=>entityMatches(entity)&&list(entity.topicIds).includes(id)).length);
    });
    state.clearTopic.hidden=!topicId;
    state.allProfiles.setAttribute('aria-pressed',String(!unlocated&&!entityType));state.outsideMap.setAttribute('aria-pressed',String(unlocated));state.typeSelect.value=entityType;
    const eligible=eligibleEntities();
    const counts=state.totalTypes;
    state.status.textContent=`${counts.person} people · ${counts.lab} labs / teams · ${counts.institution} institutions · ${data.connections.length} relationships${eligible.length!==data.entities.length?` · ${eligible.length} matching profiles`:''}${query?` · search: ${query}`:''}${unlocated?' · outside mapped cities':''}`;
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
      prepareIndexes();
      build();initialized=true;render();
      document.dispatchEvent(new CustomEvent('ead:atlas-ready'));
    } catch {
      root.replaceChildren(make('p','The research atlas could not load. Reload to retry.','atlas-load-error'));
      document.dispatchEvent(new Event('ead:load-error'));
    }
  }
  document.addEventListener('ead:atlas-data',event=>initialize(event.detail),{once:true});
  document.addEventListener('ead:atlas-query',event=>{
    const next=normalize(typeof event.detail==='string'?event.detail:event.detail?.query).trim();
    if(next===query)return;
    query=next;selectedId=edgeId=cityId=cityPreview=null;networkPage=browserPage=0;render();
  });
  document.addEventListener('ead:atlas-select',event=>{if(initialized&&entities.has(event.detail)){selectEntity(event.detail);scrollToNetwork();}});
  document.addEventListener('ead:view',event=>{if(event.detail==='atlas'&&initialized)renderNetwork();});
  compact.addEventListener('change',()=>{if(initialized)renderNetwork();});
  motion.addEventListener('change',()=>{if(motion.matches)$('atlas-root')?.getAnimations({subtree:true}).forEach(animation=>animation.finish());});
})();
