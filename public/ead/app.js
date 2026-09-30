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
  const state = {view:'atlas',query:'',kind:'all',observation:null,coverage:'all',sort:'year',page:0,catalogueMode:'papers',findingsMode:'research'};
  const viewQueries = new Map();
  const views = new Set(['atlas','implementation','observations','sources','design','poems']);
  let poemsReturn = {view:'atlas',scroll:0}, poemsAnimation;
  let briefing, catalogue, sources, atlas;
  const researchProfiles = new Map();
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
  function setView(view, resetQuery = false) {
    if (!views.has(view)) return;
    viewQueries.set(state.view,state.query);
    state.view = view;
    document.body.dataset.view = view;
    state.query = resetQuery ? '' : viewQueries.get(view) || '';
    $('search').value = state.query;
    document.querySelectorAll('.tabs button[data-view]').forEach(node => {
      const selected = node.dataset.view === (view === 'design' ? 'implementation' : view);
      node.classList.toggle('active', selected);
      if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== `${view}-view`; });
    $('search').closest('.search-wrap').hidden = view === 'implementation' || view === 'poems';
    $('poems-open').setAttribute('aria-expanded',String(view === 'poems'));
    updateSearchLabel();
    renderView();
    document.dispatchEvent(new CustomEvent('ead:view',{detail:view}));
  }
  function updateSearchLabel() {
    const searchLabel = {atlas:'Search profiles, institutions and topics',sources:state.catalogueMode === 'research' ? 'Search research sources and profiles' : 'Search papers, authors and years',observations:state.findingsMode === 'cases' ? 'Search reported cases' : 'Search findings',design:'Search architecture'}[state.view] || 'Search';
    $('search').placeholder = searchLabel;
    $('search').setAttribute('aria-label',searchLabel);
  }
  function renderView() {
    $('search-clear').hidden = !state.query;
    if (state.view === 'atlas') document.dispatchEvent(new CustomEvent('ead:atlas-query',{detail:state.query}));
    if (state.view === 'observations') renderObservations();
    if (state.view === 'sources') renderSources();
    if (state.view === 'design') renderDesign();
  }
  function focusAndScroll(target) {
    if (!target) return;
    const heading = target.matches('h1,h2,h3') ? target : target.querySelector('h1,h2,h3') || target;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({preventScroll:true});
    target.scrollIntoView({block:'start',behavior:'instant'});
  }
  function openPoems() {
    if (state.view !== 'poems') {
      poemsReturn = {view:state.view,scroll:window.scrollY};
      setView('poems');
      window.scrollTo({top:0,behavior:'instant'});
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        poemsAnimation?.cancel();
        poemsAnimation=$('poems-view').querySelector('.poems-intro').animate(
          [{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],
          {duration:480,easing:'cubic-bezier(.2,.7,.3,1)'});
        poemsAnimation.finished.catch(()=>{});
      }
    }
    $('poems-title').focus({preventScroll:true});
  }
  function closePoems() {
    poemsAnimation?.cancel();
    setView(poemsReturn.view);
    window.scrollTo({top:poemsReturn.scroll,behavior:'instant'});
    $('main').focus({preventScroll:true});
  }
  function renderObservations() {
    $('observations-view').querySelector('.view-heading h2').textContent=state.findingsMode==='cases'?'Reported operations & claims':'What changes the design';
    $('observations-view').querySelector('.view-heading > p:last-child').textContent=state.findingsMode==='cases'?'Expand a case for its evidence, attribution and related research profiles.':'Select a finding. Read the result, its implication, and the exact source.';
    $('research-findings').hidden = state.findingsMode !== 'research';
    $('reported-cases').hidden = state.findingsMode !== 'cases';
    if (state.findingsMode === 'cases') { renderCases(); return; }
    const found = briefing.observations.filter(o => (state.kind === 'all' || o.kind === state.kind) && includesQuery([o.title,o.observation,o.implication,o.caveat,...o.tags,...o.source_ids.map(id => sources.get(id)?.title)].join(' ')));
    $('observation-count').textContent = `${found.length} observation${found.length === 1 ? '' : 's'}`;
    const list = $('observation-list'); list.replaceChildren();
    if (!found.some(o => o.id === state.observation)) state.observation = found[0]?.id;
    const picker = $('observation-select'); picker.replaceChildren();
    found.forEach(o => { const option = el('option', o.title); option.value = o.id; picker.append(option); });
    picker.value = state.observation || ''; picker.disabled = !found.length;
    found.forEach(o => {
      const b = button('', () => {
        state.observation = o.id;
        renderObservations();
        if (matchMedia('(max-width:850px)').matches) focusAndScroll($('observation-detail'));
        else $('observation-list').querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
      }, 'observation-item');
      b.setAttribute('aria-pressed', String(o.id === state.observation));
      b.append(el('span', String(briefing.observations.indexOf(o) + 1).padStart(2, '0'), 'item-number'));
      const body = el('span'); body.append(el('span', o.title, 'item-title'));
      const meta = el('span', undefined, 'item-meta'); meta.append(el('span', o.kind === 'design' ? 'PROPOSAL' : o.kind.toUpperCase(), o.kind), el('span', o.tags[0]));
      body.append(meta); b.append(body); list.append(b);
    });
    const detail = $('observation-detail'); detail.replaceChildren();
    const current = found.find(o => o.id === state.observation);
    if (!current) { detail.append(el('p','No findings match this search and filter.','empty'),button('Clear search and filters',()=>{state.query='';$('search').value='';state.kind='all';document.querySelectorAll('[data-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind==='all')));renderView();},'recovery-action')); return; }
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
    detail.append(implication,caveat,evidence,button('Open implementation plans →',()=>{setView('implementation');focusAndScroll($('implementation-plans'));},'recovery-action'));
  }
  function openSource(id) {
    const source = sources.get(id); if (!source) return;
    const content = $('dialog-content'); content.replaceChildren();
    const title = el('h2',source.title); title.id = 'dialog-title';
    content.append(title,el('p',source.authors.join(', '),'dialog-authors'));
    if (flagged(source)) content.append(el('span',statusLabel(source),'badge flagged'));
    content.append(link('Open primary source ↗',source.url,'external'));
    const facts = el('dl',undefined,'record-facts');
    const rows = [['Year',source.year || 'Unspecified'],['Coverage',source.reviewed ? 'Focused review' : 'Indexed record; not fully reviewed'],['Attribution',attributionLabel(source)],['Status',words(source.status)],['Version',source.version],['Authors',source.authorsFormat === 'as_recorded_may_be_abbreviated' ? 'As indexed; may be abbreviated' : null]];
    rows.filter(([,v]) => v).forEach(([k,v]) => facts.append(el('dt',k),el('dd',v)));
    content.append(facts);
    if (source.notes) content.append(el('p',source.notes));
    const linkedIds = new Set(atlas.connections.filter(edge=>edge.sourceUrl===source.url).flatMap(edge=>[edge.source,edge.target]));
    const linkedPeople = atlas.entities.filter(entity=>entity.type==='person' && source.authors.some(name=>normalize(name)===normalize(entity.name)) && (linkedIds.has(entity.id) || entity.paperIds?.includes(source.id) || (entity.id==='r-yue-zhang-westlake' && source.attribution==='verified_yue_coauthor')));
    if(linkedPeople.length){
      const section=el('section',undefined,'evidence-block');section.append(el('h3','EXPLORE AUTHORS IN THE ATLAS'));
      const people=el('div',undefined,'source-people');
      linkedPeople.forEach(entity=>people.append(button(`${entity.name} · View network`,()=>{$('source-dialog').close();setView('atlas');document.dispatchEvent(new CustomEvent('ead:atlas-select',{detail:entity.id}));},'source-link')));
      section.append(people);content.append(section);
    }
    const related = briefing.observations.filter(o => o.source_ids.includes(id));
    if (related.length) {
      const section = el('section',undefined,'evidence-block'); section.append(el('h3','OBSERVATIONS USING THIS SOURCE'));
      related.forEach(o => section.append(button(o.title,() => {
        $('source-dialog').close(); state.kind='all'; state.observation=o.id; selectFindings('research');
        document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.kind === 'all')));
        setView('observations',true); $('observation-detail').tabIndex=-1;$('observation-detail').focus({preventScroll:true});$('observation-detail').scrollIntoView({block:'start'});
      },'source-link'))); content.append(section);
    }
    if (source.sourceRows.length > 1) {
      const section = el('details',undefined,'evidence-block'); section.append(el('summary',`${source.sourceRows.length} merged index records`));
      source.sourceRows.forEach(row => section.append(el('p',`${words(row.kind)} · ${row.year || 'year unspecified'} · ${row.title}`,'evidence-locations'))); content.append(section);
    }
    if (!$('source-dialog').open) $('source-dialog').showModal();
  }
  function renderSources() {
    $('source-filters').hidden = state.catalogueMode !== 'papers';
    if (state.catalogueMode === 'research') { renderResearchSources(); return; }
    document.querySelector('.source-table th:nth-child(3)').textContent = 'Coverage';
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
      const open = el('td'); const details=button('Read record →',() => openSource(source.id),'source-open');details.setAttribute('aria-label',`Read record: ${source.title}`);open.append(details);
      tr.append(el('td',source.year || '—','year'),titleCell,coverage,open); tbody.append(tr);
    });
    if (!matches.length) { const tr=el('tr'),td=el('td',undefined,'empty');td.append(el('p','No records match this search and filter.'),button(state.coverage==='all'?'Clear search':'Search full catalogue',()=>{if(state.coverage==='all'){state.query='';$('search').value='';}state.coverage='all';document.querySelectorAll('[data-coverage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.coverage==='all')));renderView();},'recovery-action')); td.colSpan=4;tr.append(td);tbody.append(tr); }
    $('catalog-note').textContent = state.coverage === 'reviewed' ? '23 focused reviews. Select a title for evidence and related findings.' : state.coverage === 'flagged' ? 'Withdrawal and attribution records. Select a title for its status and source.' : '492 papers from Yue Zhang and collaborators · 23 focused reviews. Search title, author, year or topic; select a title to inspect its source.';
    $('source-results').textContent = matches.length ? `${start+1}–${Math.min(start+pageSize,matches.length)} of ${matches.length} records` : '0 records';
    $('page-number').textContent = `${state.page+1} / ${totalPages}`;
    $('page-prev').disabled = state.page === 0; $('page-next').disabled = state.page >= totalPages-1;
  }
  function selectFindings(mode) {
    state.findingsMode=mode;
    document.querySelectorAll('[data-findings]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.findings===mode)));
  }
  function syncCatalogue() {
    document.querySelectorAll('[data-catalogue]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.catalogue===state.catalogueMode)));
  }
  function atlasProfile(id) {
    if ($('source-dialog').open) $('source-dialog').close();
    setView('atlas',true);
    document.dispatchEvent(new CustomEvent('ead:atlas-select',{detail:id}));
  }
  function urlsIn(value, result = new Set()) {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) result.add(value);
    else if (Array.isArray(value)) value.forEach(item=>urlsIn(item,result));
    else if (value && typeof value === 'object') Object.values(value).forEach(item=>urlsIn(item,result));
    return result;
  }
  function indexResearchProfiles() {
    const add=(url,id)=>{if(!researchProfiles.has(url))researchProfiles.set(url,new Set());researchProfiles.get(url).add(id);};
    atlas.entities.forEach(entity=>urlsIn(entity).forEach(url=>add(url,entity.id)));
    atlas.connections.forEach(edge=>urlsIn(edge).forEach(url=>{add(url,edge.source);add(url,edge.target);}));
  }
  function profilesFor(url) {
    const ids=researchProfiles.get(url);
    return ids ? atlas.entities.filter(entity=>ids.has(entity.id)) : [];
  }
  function renderCases() {
    const matches=atlas.reportedCases.filter(item=>includesQuery(JSON.stringify(item)));
    $('case-count').textContent=`${matches.length} of ${atlas.reportedCases.length} reported cases · attribution, allegations and online claims retain their source status.`;
    const host=$('case-list');host.replaceChildren();
    matches.forEach(item=>{
      const card=el('article',undefined,'case-card');
      const top=el('div',undefined,'case-meta');top.append(el('span',item.claim_type,'badge'),el('span',item.date || 'Undated','locator'));
      card.append(top,el('h3',item.name),el('p',item.status,'case-status'),el('p',item.summary));
      const detail=el('details');detail.append(el('summary','Evidence & related profiles'));
      const facts=el('dl',undefined,'case-facts');
      if(item.verified_connection)facts.append(el('dt','Recorded connection'),el('dd',item.verified_connection));
      if(item.inference)facts.append(el('dt','Inference'),el('dd',item.inference));
      detail.append(facts);
      const evidence=el('div',undefined,'case-evidence');
      (item.evidence || []).forEach(entry=>{const row=el('div');row.append(link(`${entry.label} ↗`,entry.url),el('p',entry.finding));evidence.append(row);});
      if(!(item.evidence || []).some(entry=>entry.url===item.source_url))evidence.append(link('Primary record ↗',item.source_url));
      detail.append(evidence);
      const related=atlas.entities.filter(entity=>(item.related_lab_ids || []).includes(entity.indexRecord?.id || entity.id));
      if(related.length){
        const profiles=el('div',undefined,'source-people');
        profiles.append(el('p','Related research profiles','section-label'));
        related.forEach(entity=>profiles.append(button(`${entity.name} · View network →`,()=>atlasProfile(entity.id),'source-link')));
        detail.append(profiles);
      }
      card.append(detail);host.append(card);
    });
    if(!matches.length)host.append(el('p','No reported cases match.','empty'),button('Clear search',()=>{state.query='';$('search').value='';renderView();},'recovery-action'));
  }
  function openResearchSource(source) {
    const content=$('dialog-content');content.replaceChildren();
    const title=el('h2',source.title || source.url);title.id='dialog-title';
    content.append(title,link('Open source ↗',source.url,'external'));
    const facts=el('dl',undefined,'record-facts');
    [['Type',words(source.type)],['Published',source.date],['Accessed',source.accessed_on || source.accessed_during?.join(' / ')],['Checked',source.checked_date]].filter(([,v])=>v).forEach(([k,v])=>facts.append(el('dt',k),el('dd',v)));
    content.append(facts);
    [['Documented',source.documented],['Inference',source.inference]].filter(([,v])=>v).forEach(([label,value])=>{const section=el('section',undefined,'evidence-block');section.append(el('h3',label.toUpperCase()),el('p',Array.isArray(value)?value.join(' '):value));content.append(section);});
    const profiles=profilesFor(source.url);
    if(profiles.length){
      const section=el('section',undefined,'evidence-block');section.append(el('h3',`LINKED PROFILES · ${profiles.length}`));
      const list=el('div',undefined,'source-people');
      profiles.forEach(entity=>list.append(button(`${entity.name} · View network →`,()=>atlasProfile(entity.id),'source-link')));
      section.append(list);content.append(section);
    }
    const cases=atlas.reportedCases.filter(item=>urlsIn(item).has(source.url));
    if(cases.length){
      const section=el('section',undefined,'evidence-block');section.append(el('h3','REPORTED CASES USING THIS SOURCE'));
      cases.forEach(item=>section.append(button(item.name,()=>{$('source-dialog').close();selectFindings('cases');setView('observations',true);state.query=normalize(item.name);$('search').value=item.name;renderView();focusAndScroll($('reported-cases'));},'source-link')));
      content.append(section);
    }
    if(!$('source-dialog').open)$('source-dialog').showModal();
  }
  function renderResearchSources() {
    document.querySelector('.source-table th:nth-child(3)').textContent='Type';
    const matches=atlas.sourceIndex.filter(source=>includesQuery([source.title,source.url,source.date,words(source.type),...profilesFor(source.url).map(entity=>entity.name)].join(' ')));
    matches.sort(state.sort==='title' ? (a,b)=>(a.title || a.url).localeCompare(b.title || b.url) : (a,b)=>String(b.date || '').localeCompare(String(a.date || '')) || (a.title || a.url).localeCompare(b.title || b.url));
    const pages=Math.max(1,Math.ceil(matches.length/pageSize));state.page=Math.min(state.page,pages-1);const start=state.page*pageSize;
    const tbody=$('source-rows');tbody.replaceChildren();
    matches.slice(start,start+pageSize).forEach(source=>{
      const tr=el('tr'),cell=el('td');cell.append(button(source.title || source.url,()=>openResearchSource(source),'paper-title'));
      let domain;try{domain=new URL(source.url).hostname;}catch{domain=source.url;}
      cell.append(el('p',domain,'authors'));
      const profiles=profilesFor(source.url);
      if(profiles.length)cell.append(el('p',`${profiles.slice(0,4).map(entity=>entity.name).join(' · ')}${profiles.length>4?` · +${profiles.length-4} profiles`:''}`,'authors'));
      const open=el('td');open.append(button('Read record →',()=>openResearchSource(source),'source-open'));
      tr.append(el('td',source.date?.slice(0,4) || '—','year'),cell,el('td',words(source.type),'source-status'),open);tbody.append(tr);
    });
    if(!matches.length){const tr=el('tr'),td=el('td',undefined,'empty');td.colSpan=4;td.append(el('p','No research sources match.'),button('Clear search',()=>{state.query='';$('search').value='';renderView();},'recovery-action'));tr.append(td);tbody.append(tr);}
    $('catalog-note').textContent=`${atlas.sourceIndex.length} research sources from the expanded index · profiles, publications and institutional records. Select a source to inspect provenance and linked profiles.`;
    $('source-results').textContent=matches.length?`${start+1}–${Math.min(start+pageSize,matches.length)} of ${matches.length} sources`:'0 sources';
    $('page-number').textContent=`${state.page+1} / ${pages}`;
    $('page-prev').disabled=state.page===0;$('page-next').disabled=state.page>=pages-1;
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

  function initialize() {
    sources=new Map(catalogue.entries.map(s => [s.id,s]));
    $('source-count').textContent='';
    document.querySelector('.coverage div:nth-child(2) strong').textContent=atlas.entities.length;
    document.querySelector('[data-catalogue="papers"]').textContent=`Papers · ${catalogue.entries.length}`;
    document.querySelector('[data-catalogue="research"]').textContent=`Research sources · ${atlas.sourceIndex.length}`;
    document.querySelector('[data-findings="research"]').textContent=`Research findings · ${briefing.observations.length}`;
    document.querySelector('[data-findings="cases"]').textContent=`Reported cases · ${atlas.reportedCases.length}`;
    indexResearchProfiles();
    $('leo-dock').addEventListener('click',()=>document.dispatchEvent(new Event('ead:close-request')));
    $('poems-open').addEventListener('click',openPoems);
    $('poems-back').addEventListener('click',closePoems);
    document.addEventListener('ead:close',()=>{
      poemsAnimation?.cancel();
      document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    });
    document.addEventListener('ead:closed',()=>{if(state.view==='poems')setView(poemsReturn.view);});
    document.querySelectorAll('[data-catalogue]').forEach(b => b.addEventListener('click',()=>{state.catalogueMode=b.dataset.catalogue;state.page=0;state.query='';$('search').value='';syncCatalogue();updateSearchLabel();renderView();}));
    document.querySelectorAll('[data-findings]').forEach(b => b.addEventListener('click',()=>{selectFindings(b.dataset.findings);state.query='';$('search').value='';updateSearchLabel();renderView();}));
    document.querySelectorAll('button[data-view],button[data-jump]').forEach(b => {
      b.disabled=false;
      b.addEventListener('click',() => {
        if (b.dataset.view) setView(b.dataset.view);
        if (b.dataset.jump) focusAndScroll($(b.dataset.jump));
        else if (b.closest('.tabs')) $(`${state.view}-view`).scrollIntoView({block:'start',behavior:'instant'});
        else if (b.dataset.view) focusAndScroll($(`${state.view}-view`));
      });
    });
    document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click',() => {state.kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(n => n.setAttribute('aria-pressed',String(n===b)));renderObservations();}));
    $('observation-select').addEventListener('change',() => {state.observation=$('observation-select').value;renderObservations();});
    document.querySelectorAll('[data-coverage]').forEach(b => b.addEventListener('click',() => {state.coverage=b.dataset.coverage;state.page=0;document.querySelectorAll('[data-coverage]').forEach(n => n.setAttribute('aria-pressed',String(n===b)));renderSources();}));
    $('search').disabled=false;
    $('search').addEventListener('input',() => {state.query=normalize($('search').value).trim();state.page=0;renderView();});
    $('search-clear').addEventListener('click',()=>{state.query='';$('search').value='';state.page=0;renderView();$('search').focus();});
    $('source-sort').addEventListener('change',() => {state.sort=$('source-sort').value;state.page=0;renderSources();});
    const changePage = delta => {state.page+=delta;renderSources();focusAndScroll($('sources-view'));};
    $('page-prev').addEventListener('click',() => changePage(-1));$('page-next').addEventListener('click',() => changePage(1));
    $('about-button').addEventListener('click',() => $('about-dialog').showModal());
    document.querySelectorAll('.close-dialog').forEach(b => b.addEventListener('click',() => b.closest('dialog').close()));
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click',event => {if(event.target === dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)dialog.close();}}));
    document.addEventListener('keydown',event => {
      if ($('research-workspace').inert || state.view === 'poems') return;
      if(event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        (state.view === 'implementation' && $('implementation-guide').closest('.is-expanded') ? $('implementation-search') : state.view === 'implementation' ? $('implementation-plans').querySelector('button') : $('search'))?.focus();
      }
    });
    document.addEventListener('ead:source',event => openSource(event.detail));
    document.addEventListener('ead:observation',event => {
      if (!briefing.observations.some(item => item.id === event.detail)) return;
      state.kind='all';state.observation=event.detail;selectFindings('research');
      document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.kind==='all')));
      setView('observations',true);$('observation-detail').tabIndex=-1;$('observation-detail').focus({preventScroll:true});$('observation-detail').scrollIntoView({block:'start'});
    });
    document.addEventListener('ead:catalogue',event=>{state.catalogueMode='papers';syncCatalogue();setView('sources');state.query=normalize(event.detail).trim();$('search').value=event.detail;state.page=0;state.coverage='all';document.querySelectorAll('[data-coverage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.coverage==='all')));renderView();focusAndScroll($('sources-view'));});
    document.addEventListener('ead:reset-query',() => {state.query='';$('search').value='';$('search-clear').hidden=true;viewQueries.set(state.view,'');});
    updateSearchLabel();
    document.dispatchEvent(new CustomEvent('ead:ready',{detail:{catalogue,briefing}}));
  }
  document.addEventListener('ead:open', () => {
    Promise.all(['briefing','sources','china-map','implementation','plans'].map(async name => {
      const response=await fetch(`./data/${name}.json`,{credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('Data unavailable');return response.json();
    })).then(([b,s,x,i,p]) => {
      briefing=b;catalogue=s;atlas=x;initialize();
      document.dispatchEvent(new CustomEvent('ead:atlas-data',{detail:x}));
      document.dispatchEvent(new CustomEvent('ead:implementation-data',{detail:i}));
      document.dispatchEvent(new CustomEvent('ead:plans-data',{detail:p}));
    }).catch(() => { $('load-error').hidden=false; $('atlas-root').textContent='Research unavailable. Reload to retry.'; document.dispatchEvent(new Event('ead:load-error')); });
  }, {once:true});
})();
