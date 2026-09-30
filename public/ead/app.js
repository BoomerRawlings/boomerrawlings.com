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
  const state = {view:'explorer',query:'',kind:'all',observation:null,coverage:'reviewed',sort:'year',page:0};
  const views = new Set(['explorer','observations','sources','design']);
  let briefing, catalogue, sources;
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
    if (!views.has(view)) return;
    state.view = view;
    document.body.dataset.view = view;
    if (!preserveQuery) { state.query = ''; $('search').value = ''; }
    document.querySelectorAll('.tabs button[data-view]').forEach(node => {
      const selected = node.dataset.view === (view === 'design' ? 'explorer' : view);
      node.classList.toggle('active', selected);
      if (selected) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view').forEach(node => { node.hidden = node.id !== `${view}-view`; });
    $('search').placeholder = view === 'explorer' ? 'Find a person or topic' : `Search ${view}`;
    renderView();
    document.dispatchEvent(new CustomEvent('ead:view',{detail:view}));
  }
  function renderView() {
    if (state.view === 'explorer') document.dispatchEvent(new CustomEvent('ead:explorer-query',{detail:state.query}));
    if (state.view === 'observations') renderObservations();
    if (state.view === 'sources') renderSources();
    if (state.view === 'design') renderDesign();
  }
  function focusAndScroll(target) {
    if (!target) return;
    const heading = target.matches('h1,h2,h3') ? target : target.querySelector('h1,h2,h3') || target;
    if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    heading.focus({preventScroll:true});
    target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
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
        setView('observations'); $('observation-detail').tabIndex=-1;$('observation-detail').focus({preventScroll:true});$('observation-detail').scrollIntoView({block:'start'});
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

  function initialize() {
    sources=new Map(catalogue.entries.map(s => [s.id,s]));
    $('source-count').textContent=catalogue.stats.catalogEntries;
    document.querySelectorAll('button[data-view],button[data-jump]').forEach(b => {
      b.disabled=false;
      b.addEventListener('click',() => {
        if (b.dataset.view) setView(b.dataset.view);
        if (b.dataset.jump) focusAndScroll($(b.dataset.jump));
        else if (b.closest('.tabs')) document.querySelector('.workspace-bar').scrollIntoView({block:'start'});
        else if (b.dataset.view) focusAndScroll($(`${state.view}-view`));
      });
    });
    document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click',() => {state.kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(n => n.setAttribute('aria-pressed',String(n===b)));renderObservations();}));
    $('observation-select').addEventListener('change',() => {state.observation=$('observation-select').value;renderObservations();});
    document.querySelectorAll('[data-coverage]').forEach(b => b.addEventListener('click',() => {state.coverage=b.dataset.coverage;state.page=0;document.querySelectorAll('[data-coverage]').forEach(n => n.setAttribute('aria-pressed',String(n===b)));renderSources();}));
    $('search').disabled=false;
    $('search').addEventListener('input',() => {state.query=normalize($('search').value).trim();state.page=0;renderView();});
    $('source-sort').addEventListener('change',() => {state.sort=$('source-sort').value;state.page=0;renderSources();});
    $('page-prev').addEventListener('click',() => {state.page--;renderSources();});$('page-next').addEventListener('click',() => {state.page++;renderSources();});
    $('about-button').addEventListener('click',() => $('about-dialog').showModal());
    document.querySelectorAll('.close-dialog').forEach(b => b.addEventListener('click',() => b.closest('dialog').close()));
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click',event => {if(event.target === dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)dialog.close();}}));
    document.addEventListener('keydown',event => {
      if(event.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        (document.activeElement.closest('#implementation-view') ? $('implementation-search') : $('search')).focus();
      }
    });
    document.addEventListener('ead:source',event => openSource(event.detail));
    document.addEventListener('ead:observation',event => {
      if (!briefing.observations.some(item => item.id === event.detail)) return;
      state.kind='all';state.observation=event.detail;
      document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.kind==='all')));
      setView('observations');$('observation-detail').tabIndex=-1;$('observation-detail').focus({preventScroll:true});$('observation-detail').scrollIntoView({block:'start'});
    });
    document.addEventListener('ead:reset-query',() => {state.query='';$('search').value='';});
    document.dispatchEvent(new CustomEvent('ead:ready',{detail:{catalogue,briefing}}));
  }
  document.addEventListener('ead:open', () => {
    Promise.all(['briefing','sources','explorer','implementation'].map(async name => {
      const response=await fetch(`./data/${name}.json`,{credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('Data unavailable');return response.json();
    })).then(([b,s,x,i]) => {
      briefing=b;catalogue=s;initialize();
      document.dispatchEvent(new CustomEvent('ead:explorer-data',{detail:x}));
      document.dispatchEvent(new CustomEvent('ead:implementation-data',{detail:i}));
    }).catch(() => { $('load-error').hidden=false; $('explorer-status').textContent='Research unavailable'; });
  }, {once:true});
})();
