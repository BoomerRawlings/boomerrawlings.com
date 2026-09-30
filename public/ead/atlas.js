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
  let networkNodeElements = new Map(), networkPage = 0, browserPage = 0, unlocated = false, entityType = '', relevanceTier = '', pairId = null;
  let relevance = new Map();
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
  const profileOrder = (a,b) => relevance.get(b.id).score-relevance.get(a.id).score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  const relevanceBadge = entity => {const match=relevance.get(entity.id);return make('span',match.label,`atlas-relevance ${match.tier}`);};
  function prepareIndexes() {
    relevance=new Map(data.entities.map(entity=>[entity.id,window.LEORelevance.evaluate(entity)]));
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
    selectedId = id; edgeId = pairId = null; if(cityPreview)cityId=cityPreview; cityPreview = null; networkPage = 0;
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
    relevanceTier='';pairId=null;
    query = ''; topicId = topicPreview = cityId = cityPreview = selectedId = edgeId = null; networkPage = browserPage = 0; unlocated = false; entityType='';
    document.dispatchEvent(new CustomEvent('ead:reset-query'));
    render(); state.overview.focus({preventScroll:true});
  }
  function build() {
    const root = $('atlas-root'); root.replaceChildren();
    const heading = make('div', undefined, 'atlas-heading');
    const intro = make('div'); intro.append(make('h2', 'China research network'));
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
    const headingText=make('div'); headingText.append(state.networkTitle,state.networkContext,make('p','Open a profile for its direct connections. Click a link count to read the evidence.','atlas-helper'));
    state.networkReset=button('← Browse profiles',()=>{selectedId=cityId=cityPreview=edgeId=pairId=null;networkPage=browserPage=0;render();state.networkTitle.focus({preventScroll:true});},'atlas-network-reset');
    networkHeading.append(headingText,state.networkReset); state.networkSection.append(networkHeading);
    const triage=make('div',undefined,'atlas-triage');
    const triageCopy=make('div');triageCopy.append(make('strong','Secure-agent relevance'),make('p','Personality · Memory · Tool use · Process adherence','atlas-helper'));
    state.relevanceSelect=make('select',undefined,'atlas-type-select');state.relevanceSelect.setAttribute('aria-label','Network relevance');
    [{id:'',label:'All relevance levels'},...window.LEORelevance.tiers].forEach(tier=>{const option=make('option',tier.label);option.value=tier.id;state.relevanceSelect.append(option);});
    state.relevanceSelect.addEventListener('change',()=>{relevanceTier=state.relevanceSelect.value;networkPage=0;edgeId=pairId=null;renderNetwork();});
    triage.append(triageCopy,state.relevanceSelect);state.networkSection.append(triage);
    const networkGrid = make('div',undefined,'atlas-network-grid');
    state.networkStage=make('div',undefined,'atlas-network-stage');
    state.network = assignId(svg('svg',{role:'group','aria-label':'Documented and inferred research relationships'}),'atlas-network');
    state.networkCards=make('div',undefined,'atlas-network-cards');
    state.networkStage.append(state.network,state.networkCards);
    state.networkDetail = assignId(make('aside',undefined,'atlas-network-detail'),'atlas-network-detail'); state.networkDetail.setAttribute('aria-label','Relationship evidence');
    networkGrid.append(state.networkStage,state.networkDetail); state.networkSection.append(networkGrid);
    const pager=make('div',undefined,'atlas-network-pager');
    const changeNetworkPage=delta=>{networkPage+=delta;edgeId=pairId=null;renderNetwork();scrollToNetwork();};
    state.pagePrev=button('Previous',()=>changeNetworkPage(-1));
    state.pageNext=button('Next',()=>changeNetworkPage(1));
    state.pageInfo=make('span');state.pageInfo.setAttribute('role','status');pager.append(state.pagePrev,state.pageInfo,state.pageNext);state.networkSection.insertBefore(pager,networkGrid);
    const browse = make('details',undefined,'atlas-network-browse'); browse.append(make('summary','Browse this network page as a list'));
    state.networkList=make('div');browse.append(state.networkList); state.networkSection.append(browse); root.append(state.networkSection);
    new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(initialized&&width>0&&width!==state.networkWidth)renderNetwork();}).observe(state.networkStage);
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
    if(starting)host.append(make('p','Sorted by relevance to secure agents. Search, choose a city, or open a profile.','atlas-helper'));
    else if(city)host.append(make('p',cityId?'City selected. Click another map point to switch.':city.summary||'People, labs and institutions linked to this city.','atlas-helper'));
    const items=make('div',undefined,'atlas-city-members');
    members.slice(browserPage*12,(browserPage+1)*12).forEach(entity=>{
      const control=button('',()=>selectEntity(entity.id),'atlas-entity-button');
      const copy=make('span',undefined,'atlas-entity-copy'),count=connectionCount(entity.id);
      copy.append(make('strong',entity.name),make('span',entity.affiliation||typeLabel(entity.type),'atlas-entity-affiliation'),relevanceBadge(entity),make('small',`${typeLabel(entity.type).toUpperCase()} · ${count} connection${count===1?'':'s'}`));
      control.append(portrait(entity),copy,make('span','→','atlas-entity-arrow'));control.setAttribute('aria-label',`${entity.name}. ${relevance.get(entity.id).label}. ${count} connections. Show profile.`);items.append(control);
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
    const match=relevance.get(entity.id),assessment=make('details',undefined,'atlas-profile-details atlas-assessment');
    const assessmentTitle=make('summary');assessmentTitle.append(relevanceBadge(entity),make('span','Why this priority'));assessment.append(assessmentTitle,make('p',match.reason,'atlas-profile-copy'));
    match.evidence.forEach(evidence=>{const item=make('div',undefined,'atlas-record-item');item.append(make('h4',`${evidence.label} · ${evidence.basis}`),make('p',evidence.excerpt,'atlas-profile-copy'),link('Research source ↗',evidence.url));assessment.append(item);});
    host.append(assessment);
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
    return {visible,edges:selectedId?incident(selectedId):[]};
  }
  function renderNetwork() {
    const result=networkData(),center=selectedId?entities.get(selectedId):null;
    const candidates=center?result.visible:result.visible.filter(entity=>!relevanceTier||relevance.get(entity.id).tier===relevanceTier);
    const width=Math.max(260,Math.round(state.networkStage.getBoundingClientRect().width)||Math.min(1200,innerWidth-48));
    state.networkWidth=width;
    const pagination=window.LEONetworkLayout.page({width,ids:candidates.map(entity=>entity.id),centerId:selectedId,page:networkPage});
    networkPage=pagination.page;
    const visible=pagination.ids.map(id=>entities.get(id)),shownIds=new Set(pagination.ids);
    if(pairId&&!shownIds.has(pairId))pairId=edgeId=null;
    const edges=center?incident(selectedId).filter(edge=>shownIds.has(edge.source)&&shownIds.has(edge.target)):[];
    const geometry=window.LEONetworkLayout.layout({width,ids:pagination.ids,centerId:selectedId});
    state.networkStage.style.height=`${geometry.height}px`;
    state.network.setAttribute('viewBox',`0 0 ${width} ${geometry.height}`);state.network.replaceChildren();
    state.networkCards.replaceChildren();state.networkList.replaceChildren();networkNodeElements=new Map();
    const context=center?center.name:cityId?locations.get(cityId)?.name:topicId?topics.get(topicId)?.label:'All profiles';
    state.networkContext.textContent=center?`${context} · ${candidates.length-1} connected profiles · ${incident(selectedId).length} evidence records`:`${context} · ${candidates.length} profiles · highest research relevance first`;
    state.networkReset.hidden=!selectedId&&!cityId;
    state.relevanceSelect.value=relevanceTier;state.relevanceSelect.disabled=Boolean(center);
    state.relevanceSelect.title=center?'All direct connections are retained while a profile is focused.':'';
    state.pagePrev.disabled=networkPage===0;state.pageNext.disabled=networkPage===pagination.totalPages-1;
    state.pageInfo.textContent=`Page ${networkPage+1} / ${pagination.totalPages} · ${visible.length-(center?1:0)} ${center?'connections':'profiles'} shown${center?' + focus':''}`;
    state.renderedEdges=edges;state.edgeElements=new Map();
    if(!center)pairId=edgeId=null;
    const pathLayer=svg('g',{'aria-hidden':'true'}),badgeLayer=svg('g');state.network.append(pathLayer,badgeLayer);
    geometry.connectors.forEach(connector=>{
      const records=edges.filter(edge=>edge.source===connector.target||edge.target===connector.target);
      const documented=records.filter(edge=>edge.kind==='documented').length,inferred=records.length-documented;
      const kind=documented&&inferred?'mixed':documented?'documented':'inferred';
      const control=svg('g',{class:`atlas-edge-control${pairId===connector.target?' is-selected':''}`,role:'button',tabindex:0,'aria-pressed':String(pairId===connector.target),'aria-label':`${center.name} and ${entities.get(connector.target).name}: ${documented} documented, ${inferred} inferred records. Read evidence.`});
      const badge=connector.badge,label=svg('text',{x:badge.x+badge.width/2,y:badge.y+badge.height/2+4,'text-anchor':'middle',class:'atlas-edge-number'});label.textContent=records.length;
      const title=svg('title');title.textContent=`${documented} documented / ${inferred} inferred · click to inspect`;
      const pathGroup=svg('g',{class:`atlas-edge-control${pairId===connector.target?' is-selected':''}`});
      pathGroup.append(svg('path',{d:connector.path,class:`atlas-network-edge ${kind}`}));pathLayer.append(pathGroup);
      control.append(title,svg('rect',{...badge,rx:22,class:'atlas-edge-badge'}),label);
      control.addEventListener('pointerenter',()=>pathGroup.classList.add('is-hovered'));control.addEventListener('pointerleave',()=>pathGroup.classList.remove('is-hovered'));
      control.addEventListener('click',()=>selectPair(connector.target));control.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();selectPair(connector.target);}});
      badgeLayer.append(control);state.edgeElements.set(connector.target,[control,pathGroup]);
    });
    geometry.nodes.forEach((position,index)=>{
      const entity=entities.get(position.id),match=relevance.get(entity.id),isCenter=entity.id===selectedId;
      const control=button('',()=>{if(isCenter)focusContact();else {selectEntity(entity.id,true);scrollToNetwork();}},`atlas-network-node ${entity.type} ${match.tier}${isCenter?' is-selected':''}`);
      Object.assign(control.style,{left:`${position.x}px`,top:`${position.y}px`,width:`${position.width}px`,height:`${position.height}px`});
      control.dataset.entity=entity.id;
      control.setAttribute('aria-label',`${entity.name}. ${match.label}. ${match.reason} ${isCenter?'Read profile.':'Show profile and connections.'}`);
      control.setAttribute('aria-pressed',String(isCenter));control.title=`${entity.name} — ${match.reason}`;
      const header=make('span',undefined,'atlas-node-heading'),heading=make('span',undefined,'atlas-node-heading-copy');
      heading.append(make('small',isCenter?'FOCUS':typeLabel(entity.type).toUpperCase()),make('strong',entity.name));header.append(portrait(entity),heading);
      const bottom=make('span',undefined,'atlas-node-bottom');bottom.append(relevanceBadge(entity),make('span',isCenter?'Read profile ↑':`${connectionCount(entity.id)} links →`));
      control.append(header,make('span',match.reason,'atlas-node-reason'),bottom);
      state.networkCards.append(control);networkNodeElements.set(entity.id,control);
      if(!motion.matches)control.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:Math.min(index*22,160),easing:'ease-out'});
      state.networkList.append(button(`${entity.name} · ${match.label}`,()=>{selectEntity(entity.id,true);scrollToNetwork();}));
    });
    if(!visible.length)state.networkCards.append(make('p','No profiles match. Choose another relevance level or reset the atlas.','atlas-network-empty'));
    updateNetworkHighlights();renderNetworkDetail(edges);
  }
  function focusNetworkDetail() {
    const heading=state.networkDetail.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});
    state.networkDetail.scrollIntoView({block:'nearest',behavior:motion.matches?'auto':'smooth'});
  }
  function selectPair(id) {
    pairId=id;edgeId=null;
    state.edgeElements.forEach((nodes,key)=>nodes.forEach(node=>{node.classList.toggle('is-selected',key===id);if(node.hasAttribute('role'))node.setAttribute('aria-pressed',String(key===id));}));
    renderNetworkDetail(state.renderedEdges||[]);focusNetworkDetail();
  }
  function selectEdge(id) {
    edgeId=id;renderNetworkDetail(state.renderedEdges||[]);if(id)focusNetworkDetail();
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
    host.append(make('p','RELATIONSHIP EVIDENCE','section-label'),make('h3',pairId&&selectedId?`${entities.get(selectedId).name} / ${entities.get(pairId).name}`:selectedId?entities.get(selectedId).name:'Choose what to explore'));
    host.append(make('p',selectedId?'Each numbered link groups the evidence for one connected profile. Solid: documented. Dashed: inferred. Mixed: both.':'High relevance: specific agent controls. Relevant: broader agent work or a research lead. Context: background and institutional links. Open any profile to see the source behind its priority.','atlas-helper'));
    if(selectedId)host.append(button('Read profile ↑',focusContact,'atlas-network-jump'));
    const shown=pairId&&selectedId?edges.filter(edge=>edge.source===pairId||edge.target===pairId):edges;
    if(pairId&&selectedId){host.append(make('p',`${shown.filter(edge=>edge.kind==='documented').length} documented · ${shown.filter(edge=>edge.kind==='inferred').length} inferred`,'atlas-helper'),button('All connections on this page',()=>selectPair(null),'atlas-network-jump'));}
    const edgeList=make('div',undefined,'atlas-edge-list');
    shown.forEach(edge=>{
      const control=button('',()=>{selectEdge(edge.id);const h=state.networkDetail.querySelector('h3');h.tabIndex=-1;h.focus({preventScroll:true});},'atlas-edge-button');
      control.append(make('small',edgeKind(edge)),make('span',edge.label),make('em',`${entities.get(edge.source)?.name} / ${entities.get(edge.target)?.name}`));edgeList.append(control);
    });
    if(!shown.length){edgeList.append(make('p',selectedId?'No recorded relationships. Explore this profile’s papers or shared topics.':'All profiles remain available through the pages and relevance filter.','atlas-helper'));
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
