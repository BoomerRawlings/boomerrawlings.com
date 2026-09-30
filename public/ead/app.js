/* EAD: same-origin data, local search, no remote services or persistence. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (text, action, className) => {
    const node = el('button', text, className);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const link = (label, address, className) => {
    const a = el('a', label, className);
    try {
      const url = new URL(address);
      if (!['https:', 'http:'].includes(url.protocol)) return el('span', label);
      a.href = url.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } catch { return el('span', label); }
    return a;
  };
  const words = (value) => String(value || '').replaceAll('_', ' ');
  const normalize = (value) => String(value || '').normalize('NFKD').toLowerCase();
  const includesQuery = (value) => state.query.split(/\s+/).filter(Boolean).every(term => normalize(value).includes(term));
  const flagged = (source) => ['withdrawn', 'identity_uncertain', 'not_target_author'].includes(source.status);
  const statusLabel = (source) => ({withdrawn:'Withdrawn',identity_uncertain:'Identity uncertain',not_target_author:'Other author'})[source.status];
  const attributionLabel = (source) => ({author_bibliography:'Listed in author bibliography',name_affiliation_checked:'Name and affiliation checked',profile_only:'Scholar profile only',identity_uncertain:'Identity unresolved',verified_yue_coauthor:'Yue Zhang coauthorship verified',verified_network_coauthor:'Collaborator authorship verified',not_target_author:'Different author'})[source.attribution] || words(source.attribution);
  const state = {view:'observations',query:'',kind:'all',observation:null,coverage:'reviewed',sort:'year',page:0,graph:'research',focus:'yue-zhang'};
  let briefing, catalogue, network, sources, nodes;
  let graphScale = 1, graphX = 0, graphY = 0;
  const pageSize = 25;

  function sourceButton(id, mini = false) {
    const source = sources.get(id);
    if (!source) return el('span', 'Source unavailable');
    const b = button('', () => openSource(id), mini ? '' : 'source-link');
    if (!mini) b.append(el('small', source.year || '—'));
    b.append(el('span', source.shortTitle || source.title));
    if (source.status === 'withdrawn') b.append(el('span', 'Withdrawn', 'badge flagged'));
    return b;
  }
  function setView(view, preserveQuery = false) {
    state.view = view;
    if (!preserveQuery) { state.query = ''; $('search').value = ''; }
    document.querySelectorAll('[data-view]').forEach(node => {
      const selected = node.dataset.view === view;
      node.classList.toggle('active', selected);
      if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== `${view}-view`; });
    $('search').placeholder = `Search ${view === 'connections' ? 'people and papers' : view}`;
    renderView();
  }
  function renderView() {
    if (state.view === 'observations') renderObservations();
    if (state.view === 'sources') renderSources();
    if (state.view === 'connections') renderGraph();
    if (state.view === 'design') renderDesign();
  }
  function renderObservations() {
    const found = briefing.observations.filter(o => (state.kind === 'all' || o.kind === state.kind) && includesQuery([o.title,o.observation,o.implication,o.caveat,...o.tags,...o.source_ids.map(id => sources.get(id)?.title)].join(' ')));
    $('observation-count').textContent = `${found.length} observation${found.length === 1 ? '' : 's'}`;
    const list = $('observation-list'); list.replaceChildren();
    if (!found.some(o => o.id === state.observation)) state.observation = found[0]?.id;
    const picker = $('observation-select'); picker.replaceChildren();
    found.forEach(o => { const option = el('option', o.title); option.value = o.id; picker.append(option); });
    picker.value = state.observation || ''; picker.disabled = !found.length;
    found.forEach(o => {
      const b = button('', () => { state.observation = o.id; renderObservations(); if (matchMedia('(max-width:850px)').matches) $('observation-detail').scrollIntoView({block:'start'}); }, 'observation-item');
      b.setAttribute('aria-pressed', String(o.id === state.observation));
      b.append(el('span', String(briefing.observations.indexOf(o) + 1).padStart(2, '0'), 'item-number'));
      const body = el('span'); body.append(el('span', o.title, 'item-title'));
      const meta = el('span', undefined, 'item-meta'); meta.append(el('span', o.kind === 'design' ? 'PROPOSAL' : o.kind.toUpperCase(), o.kind), el('span', o.tags[0]));
      body.append(meta); b.append(body); list.append(b);
    });
    const detail = $('observation-detail'); detail.replaceChildren();
    const current = found.find(o => o.id === state.observation);
    if (!current) { detail.append(el('p','No matching observations. Try a shorter search or another filter.','empty')); return; }
    const top = el('div', undefined, 'detail-top');
    top.append(el('span', current.kind === 'design' ? 'DESIGN PROPOSAL' : current.kind.toUpperCase(), `badge ${current.kind}`), el('span', current.tags.map(words).join(' / '), 'locator'));
    detail.append(top, el('h2', current.title), el('p', current.observation, 'observation-copy'));
    if (current.id === 'reported-versus-observed-personality') {
      const metric = el('div', undefined, 'metric-comparison');
      [['Self-report','78.67 → 85.33','up'],['Observer score','69.00 → 65.50','down']].forEach(([label,value,cls]) => {
        const row = el('div', undefined, 'metric-row'); row.append(el('span', label), el('strong', value, cls)); metric.append(row);
      });
      metric.append(el('p','GPT-4-Turbo · without RAG → with RAG · different rubrics','metric-caption')); detail.append(metric);
    }
    const implication = el('section', undefined, 'evidence-block'); implication.append(el('h3','DESIGN IMPLICATION'),el('p',current.implication));
    const caveat = el('p', undefined, 'caveat'); caveat.append(el('strong','Limit: '),document.createTextNode(current.caveat));
    const evidence = el('section', undefined, 'evidence-block'); evidence.append(el('h3','SOURCE & LOCATION'));
    const sourceList = el('div', undefined, 'source-buttons'); current.source_ids.forEach(id => sourceList.append(sourceButton(id))); evidence.append(sourceList);
    current.evidence_locations.forEach(location => evidence.append(el('p', location, 'evidence-locations')));
    detail.append(implication,caveat,evidence);
  }
  function openSource(id) {
    const source = sources.get(id); if (!source) return;
    const content = $('dialog-content'); content.replaceChildren();
    const title = el('h2',source.title); title.id = 'dialog-title';
    content.append(title,el('p',source.authors.join(', '),'dialog-authors'));
    if (flagged(source)) content.append(el('span',statusLabel(source),'badge flagged'));
    const facts = el('dl',undefined,'record-facts');
    const rows = [['Year',source.year || 'Unspecified'],['Coverage',source.reviewed ? 'Focused review' : 'Indexed record; not fully reviewed'],['Attribution',attributionLabel(source)],['Status',words(source.status)],['Version',source.version],['Authors',source.authorsFormat === 'as_recorded_may_be_abbreviated' ? 'As indexed; may be abbreviated' : null]];
    rows.filter(([,v]) => v).forEach(([k,v]) => facts.append(el('dt',k),el('dd',v)));
    content.append(facts);
    if (source.notes) content.append(el('p',source.notes));
    content.append(link('Open primary source ↗',source.url,'external'));
    const related = briefing.observations.filter(o => o.source_ids.includes(id));
    if (related.length) {
      const section = el('section',undefined,'evidence-block'); section.append(el('h3','OBSERVATIONS USING THIS SOURCE'));
      related.forEach(o => section.append(button(o.title,() => {
        $('source-dialog').close(); state.kind='all'; state.observation=o.id;
        document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.kind === 'all')));
        setView('observations'); $('observation-detail').scrollIntoView({block:'start'});
      },'source-link'))); content.append(section);
    }
    if (source.sourceRows.length > 1) {
      const section = el('details',undefined,'evidence-block'); section.append(el('summary',`${source.sourceRows.length} merged index records`));
      source.sourceRows.forEach(row => section.append(el('p',`${words(row.kind)} · ${row.year || 'year unspecified'} · ${row.title}`,'evidence-locations'))); content.append(section);
    }
    if (!$('source-dialog').open) $('source-dialog').showModal();
  }
  function renderSources() {
    const matches = catalogue.entries.filter(s => (state.coverage === 'all' || (state.coverage === 'reviewed' ? s.reviewed : flagged(s))) && includesQuery([s.title,s.shortTitle,s.year,s.url,s.doi,...s.authors,...s.tags,s.notes,words(s.status),...s.aliases,...s.sourceRows.map(r => r.title)].join(' ')));
    matches.sort(state.sort === 'title' ? (a,b) => a.title.localeCompare(b.title) : (a,b) => (b.year || 0)-(a.year || 0) || a.title.localeCompare(b.title));
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize)); state.page = Math.min(state.page,totalPages-1);
    const start = state.page*pageSize;
    const tbody = $('source-rows'); tbody.replaceChildren();
    matches.slice(start,start+pageSize).forEach(source => {
      const tr = el('tr'); const titleCell = el('td');
      titleCell.append(button(source.title,() => openSource(source.id),'paper-title'));
      titleCell.append(el('p',source.authors.length > 5 ? `${source.authors.slice(0,5).join(', ')} + ${source.authors.length-5} more` : source.authors.join(', '),'authors'));
      if (flagged(source)) titleCell.append(el('span',statusLabel(source),'badge flagged'));
      source.tags.slice(0,4).forEach(tag => titleCell.append(el('span',words(tag),'source-tag')));
      const coverage = el('td',undefined,'source-status'); coverage.append(el('span',source.reviewed ? 'Reviewed' : 'Indexed',source.reviewed ? 'badge' : 'source-tag'));
      const open = el('td'); open.append(button('Details ↗',() => openSource(source.id),'source-open'));
      tr.append(el('td',source.year || '—','year'),titleCell,coverage,open); tbody.append(tr);
    });
    if (!matches.length) { const tr=el('tr'),td=el('td','No matching records. Try another term or the full catalogue.','empty'); td.colSpan=4;tr.append(td);tbody.append(tr); }
    $('catalog-note').textContent = state.coverage === 'reviewed' ? '23 focused reviews, including one withdrawal review. Results and limitations are reported together.' : state.coverage === 'flagged' ? 'Withdrawn work, unresolved identities, and papers attributed to a different author. Retained for provenance; not treated as supporting evidence.' : '492 consolidated records. 23 reviewed; remaining records are indexed. Attribution and version caveats remain attached.';
    $('source-results').textContent = matches.length ? `${start+1}–${Math.min(start+pageSize,matches.length)} of ${matches.length} records` : '0 records';
    $('page-number').textContent = `${state.page+1} / ${totalPages}`;
    $('page-prev').disabled = state.page === 0; $('page-next').disabled = state.page >= totalPages-1;
  }
  function renderDesign() {
    [['principles',briefing.design_principles,'title','principle'],['questions',briefing.open_questions,'question','why_it_matters']].forEach(([id,items,title,body]) => {
      const host=$(id);host.replaceChildren();
      items.filter(item => includesQuery(`${item[title]} ${item[body]}`)).forEach(item => {
        const card=el('article',undefined,'design-card');card.append(el('h3',item[title]),el('p',item[body]));
        const refs=el('div',undefined,'mini-sources');item.source_ids.forEach(id => refs.append(sourceButton(id,true)));card.append(refs);host.append(card);
      });
      if (!host.children.length) host.append(el('p','No matching entries.','empty'));
    });
  }

  const svgNS='http://www.w3.org/2000/svg';
  const svgEl=(tag,attributes={}) => { const node=document.createElementNS(svgNS,tag);Object.entries(attributes).forEach(([key,value]) => node.setAttribute(key,String(value)));return node; };
  function graphData() {
    const edgeFilter = e => state.graph === 'design' ? e.type === 'topic' : state.graph === 'papers' ? e.type === 'authorship' : ['advising','lab_relationship','coauthorship'].includes(e.type);
    const edges=network.edges.filter(edgeFilter);
    const available=network.nodes.filter(n => state.graph === 'research' ? n.type === 'person' : state.graph === 'design' ? n.type !== 'person' : n.type !== 'objective');
    const filtered=available.filter(n => includesQuery(`${n.label} ${n.title || ''} ${n.role || ''} ${n.notes || ''}`));
    return {edges,available,filtered};
  }
  function selectNode(id, restoreFocus = false) { state.focus=id; state.query='';$('search').value='';renderGraph(); if(restoreFocus)document.querySelector('.graph-node.selected')?.focus(); }
  function renderGraph() {
    const {edges,available,filtered}=graphData();
    if (state.focus !== 'all' && !available.some(n => n.id === state.focus)) state.focus=state.graph === 'design' ? 'objective-personality' : state.graph === 'papers' ? 'author-2025-3adde7414731' : 'yue-zhang';
    const select=$('graph-focus');select.replaceChildren();
    const all=el('option',state.query ? `Search results (${filtered.length})` : 'All connections');all.value='all';select.append(all);
    available.forEach(n => { const option=el('option',n.label);option.value=n.id;select.append(option); });
    select.value=state.query ? 'all' : state.focus;
    const focused=!state.query && state.focus !== 'all' ? nodes.get(state.focus) : null;
    const visibleIds=new Set();
    if (focused) {
      visibleIds.add(focused.id);
      edges.filter(e => e.source === focused.id || e.target === focused.id).forEach(e => {visibleIds.add(e.source);visibleIds.add(e.target);});
    } else filtered.forEach(n => visibleIds.add(n.id));
    const visible=available.filter(n => visibleIds.has(n.id));
    const visibleEdges=edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
    $('graph-title').textContent={research:'Researchers & lab relationships',papers:'Papers & documented authors',design:'Research → design objectives'}[state.graph];
    $('graph-caption').textContent=`${visible.length} nodes · ${visibleEdges.length} connections${state.graph === 'design' ? ' · inferred relevance' : ' · documented evidence'}`;
    const list=$('network-list');list.replaceChildren();visible.forEach(n => list.append(button(n.label,() => selectNode(n.id))));
    if (!visible.length) list.append(el('p','No matching nodes.'));
    const group=$('graph-transform');group.replaceChildren();
    const positions=new Map();
    if (focused) {
      positions.set(focused.id,{x:500,y:330});
      const others=visible.filter(n => n.id !== focused.id);
      const half=Math.ceil(others.length/2);
      others.forEach((n,index) => {
        const right=index >= half;const count=right ? others.length-half : half;const row=right ? index-half : index;
        positions.set(n.id,{x:right ? 815 : 185,y:count === 1 ? 330 : 55+row*(550/Math.max(1,count-1))});
      });
    } else {
      const groups=state.graph === 'research' ? [visible.slice(0,6),visible.slice(6,12),visible.slice(12)] : [visible.filter(n => n.type === 'person'),visible.filter(n => n.type === 'paper'),visible.filter(n => n.type === 'objective')].filter(a => a.length);
      groups.forEach((items,column) => items.forEach((n,row) => positions.set(n.id,{x:groups.length === 1 ? 500 : 150+column*(700/(groups.length-1)),y:items.length === 1 ? 330 : 40+row*(580/(items.length-1))})));
    }
    // Overview with many papers uses a wider grid; focus any node for readable detail.
    if (!focused && visible.length > 25) visible.forEach((n,index) => positions.set(n.id,{x:120+(index%5)*190,y:45+Math.floor(index/5)*72}));
    const compact = matchMedia('(max-width:560px)').matches;
    let canvasHeight = 660;
    if (compact) {
      const others = visible.filter(n => n.id !== focused?.id);
      if (focused) positions.set(focused.id,{x:200,y:40});
      others.forEach((n,index) => positions.set(n.id,{x:104+(index%2)*192,y:(focused ? 124 : 50)+Math.floor(index/2)*72}));
      canvasHeight = Math.max(280,(focused ? 165 : 90)+Math.ceil(others.length/2)*72);
    }
    $('network-svg').setAttribute('viewBox',`0 0 ${compact ? 400 : 1000} ${canvasHeight}`);
    visibleEdges.forEach(e => {
      const from=positions.get(e.source),to=positions.get(e.target);
      const line=svgEl('path',{d:`M ${from.x} ${from.y} C ${(from.x+to.x)/2} ${from.y}, ${(from.x+to.x)/2} ${to.y}, ${to.x} ${to.y}`,class:`graph-edge${e.inferred ? ' inferred' : ''}`});
      const title=svgEl('title');title.textContent=e.label;line.append(title);group.append(line);
    });
    visible.forEach(n => {
      const p=positions.get(n.id);const g=svgEl('g',{class:`graph-node ${n.type}${focused?.id === n.id ? ' selected' : ''}`,transform:`translate(${p.x-83} ${p.y-24})`,tabindex:'0',role:'button','aria-label':`${n.label}, ${n.type}. Show connections and evidence.`});
      g.append(svgEl('rect',{width:166,height:48,rx:5}),svgEl('circle',{cx:11,cy:12,r:3,class:'type-indicator'}));
      const label=svgEl('text',{x:83,'text-anchor':'middle'});
      const labelWords=n.label.split(' ');const lines=[''];labelWords.forEach(word => {const last=lines.length-1;if (lines[last].length+word.length>21 && lines[last]) lines.push(word);else lines[last]+=(lines[last] ? ' ' : '')+word;});
      lines.slice(0,2).forEach((line,i) => {const span=svgEl('tspan',{x:83,y:lines.length>1 ? 21+i*15 : 29});span.textContent=line+(i===1 && lines.length>2 ? '…' : '');label.append(span);});g.append(label);
      const title=svgEl('title');title.textContent=n.title || n.label;g.append(title);
      g.addEventListener('click',() => selectNode(n.id));g.addEventListener('keydown',event => {if(['Enter',' '].includes(event.key)){event.preventDefault();selectNode(n.id,true);}});group.append(g);
    });
    resetGraph();renderNodeDetail(focused,edges,visible.length);
  }
  function renderNodeDetail(node,edges,count) {
    const panel=$('node-detail');panel.replaceChildren();
    if (!node) {panel.append(el('p','CONNECTION MAP','node-type'),el('h2',state.query ? 'Search results' : 'Network overview'),el('p',`${count} nodes shown. Select a node to inspect its relationships and primary evidence.`));if(state.graph==='design')panel.append(el('p','Dashed links are synthesis judgments, not author endorsements.','caveat'));return;}
    panel.append(el('p',node.type.toUpperCase(),'node-type'),el('h2',node.label));
    if(node.role)panel.append(el('p',node.role));
    if(node.roleConfidence && node.roleConfidence !== 'high')panel.append(el('p',`Role confidence: ${node.roleConfidence}. Roster status may be historical.`,'caveat'));
    if(node.notes)panel.append(el('p',node.notes,'caveat'));
    if(node.type === 'paper') {
      panel.append(el('p',node.title));const source=sources.get(node.sourceId);if(flagged(source))panel.append(el('span',statusLabel(source),'badge flagged'));
      panel.append(sourceButton(node.sourceId));
    } else if (node.url) panel.append(link('Primary profile ↗',node.url,'read-source'));
    const connected=edges.filter(e => e.source === node.id || e.target === node.id);
    panel.append(el('h3',`${connected.length} CONNECTION${connected.length === 1 ? '' : 'S'}`));
    const neighbors=el('div',undefined,'graph-neighbors');
    connected.forEach(edge => {
      const other=nodes.get(edge.source === node.id ? edge.target : edge.source);
      const row=el('div',undefined,'relationship');const b=button('',() => selectNode(other.id),'graph-neighbor');b.append(el('small',edge.label),document.createTextNode(other.label));row.append(b);
      if(edge.notes)row.append(el('p',edge.notes,'edge-note'));
      if(edge.evidenceUrls?.length) {const evidence=el('div',undefined,'edge-evidence');edge.evidenceUrls.forEach((url,index) => evidence.append(link(`Evidence ${index+1} ↗`,url)));row.append(evidence);}
      neighbors.append(row);
    });panel.append(neighbors);
    if (!connected.length) panel.append(el('p','No documented edge in this view. Switch to Paper links or Design connections.','caveat'));
  }
  function graphTransform() { $('graph-transform').setAttribute('transform',`translate(${graphX} ${graphY}) scale(${graphScale})`); }
  function resetGraph() { graphScale=1;graphX=0;graphY=0;graphTransform(); }
  function zoomGraph(multiplier) {const next=Math.max(.55,Math.min(4,graphScale*multiplier));const box=$('network-svg').viewBox.baseVal,cx=box.width/2,cy=box.height/2;graphX=cx-(cx-graphX)*next/graphScale;graphY=cy-(cy-graphY)*next/graphScale;graphScale=next;graphTransform();}

  function initialize() {
    sources=new Map(catalogue.entries.map(s => [s.id,s]));nodes=new Map(network.nodes.map(n => [n.id,n]));
    $('source-count').textContent=catalogue.stats.catalogEntries;
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click',() => setView(b.dataset.view)));
    document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click',() => {state.kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(n => n.setAttribute('aria-pressed',String(n===b)));renderObservations();}));
    $('observation-select').addEventListener('change',() => {state.observation=$('observation-select').value;renderObservations();});
    document.querySelectorAll('[data-coverage]').forEach(b => b.addEventListener('click',() => {state.coverage=b.dataset.coverage;state.page=0;document.querySelectorAll('[data-coverage]').forEach(n => n.setAttribute('aria-pressed',String(n===b)));renderSources();}));
    document.querySelectorAll('[data-graph]').forEach(b => b.addEventListener('click',() => {state.graph=b.dataset.graph;state.focus=state.graph === 'design' ? 'objective-personality' : state.graph === 'papers' ? 'author-2025-3adde7414731' : 'yue-zhang';document.querySelectorAll('[data-graph]').forEach(n => n.setAttribute('aria-pressed',String(n===b)));renderGraph();}));
    $('search').addEventListener('input',() => {state.query=normalize($('search').value).trim();state.page=0;renderView();});
    $('source-sort').addEventListener('change',() => {state.sort=$('source-sort').value;state.page=0;renderSources();});
    $('page-prev').addEventListener('click',() => {state.page--;renderSources();});$('page-next').addEventListener('click',() => {state.page++;renderSources();});
    $('graph-focus').addEventListener('change',() => selectNode($('graph-focus').value));
    $('zoom-in').addEventListener('click',() => zoomGraph(1.3));$('zoom-out').addEventListener('click',() => zoomGraph(1/1.3));$('zoom-reset').addEventListener('click',resetGraph);
    $('about-button').addEventListener('click',() => $('about-dialog').showModal());
    document.querySelectorAll('.close-dialog').forEach(b => b.addEventListener('click',() => b.closest('dialog').close()));
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click',event => {if(event.target === dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)dialog.close();}}));
    document.addEventListener('keydown',event => {if(event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')){event.preventDefault();$('search').focus();}});
    const svg=$('network-svg');let drag=null;
    const point=event => new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    svg.addEventListener('pointerdown',event => {if(event.target.closest('.graph-node') || event.button !== 0)return;const p=point(event);drag={x:p.x,y:p.y,ox:graphX,oy:graphY};svg.setPointerCapture(event.pointerId);svg.classList.add('dragging');});
    svg.addEventListener('pointermove',event => {if(!drag)return;const p=point(event);graphX=drag.ox+p.x-drag.x;graphY=drag.oy+p.y-drag.y;graphTransform();});
    const stopDrag=()=>{drag=null;svg.classList.remove('dragging');};svg.addEventListener('pointerup',stopDrag);svg.addEventListener('pointercancel',stopDrag);
    matchMedia('(max-width:560px)').addEventListener('change',() => {if(state.view==='connections')renderGraph();});
    renderObservations();
  }
  Promise.all(['briefing','sources','network'].map(async name => {
    const response=await fetch(`./data/${name}.json`,{credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error('Data unavailable');return response.json();
  })).then(([b,s,n]) => {briefing=b;catalogue=s;network=n;initialize();}).catch(() => { $('load-error').hidden=false; });
})();
