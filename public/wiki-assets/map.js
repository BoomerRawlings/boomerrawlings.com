import {REVISION_ACTIONS, esc, stamp, number, dateText, dayKey, pacificDayEnd, href, articleLink, userLink, markup, attributedLines, snapshot, stablePositions, safeSessionGet, safeSessionSet, loadData, installGate, titleFromId} from './shared.js';

let data, state, current, earliest, latest, view='articles', selected=null, positions, editorPositions, boundaries=[], growth=[];
let playing=false, frame=0, lastPaint=0, animationStart=0, animationFrom=0, animationTo=0, animationDuration=10000;
let viewport={x:0,y:0,width:1000,height:700}, lastGraphNodes=[], currentCategory='', currentQuery='', growthMetric='words';
const $=id=>document.getElementById(id);
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
const at=()=>new Date(current).toISOString();
const contextHref=query=>href({...query,at:at()});
const eventLink=event=>`<a href="${esc(contextHref({view:'event',event:event.id}))}">${esc(event.summary||event.title||event.id)}</a>`;
const rows=(headers,items,caption='')=>`<div class="table-scroll"><table class="wikitable">${caption?`<caption>${esc(caption)}</caption>`:''}<thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${items.map(cells=>`<tr>${cells.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const selectButton=(id,type,label)=>`<button class="record-link" data-select-id="${esc(id)}" data-select-type="${esc(type)}" type="button">${esc(label)}</button>`;
const short=value=>String(value).length>27?String(value).slice(0,25)+'…':String(value);
function updateAddress() {
  const query=new URLSearchParams();
  if(current<latest)query.set('at',at());
  if(view!=='articles')query.set('view',view);
  if(selected?.type==='article')query.set('article',selected.id);
  if(selected?.type==='editor')query.set('user',selected.id);
  if(selected?.type==='principle')query.set('principle',selected.id);
  history.replaceState(null,'',location.pathname+(query.size?`?${query}`:''));
}
function cycleLabel() {
  const completed=state.cycles.length;
  if(!completed) {
    const firstStart=stamp(data.cycles?.[0]?.startAt);
    return firstStart&&current<firstStart ? (dayKey(current)===dayKey(earliest)?'Founding session':'Before regular cycles') : 'Before the first completed cycle';
  }
  return `${number(completed)} completed ${completed===1?'cycle':'cycles'}`;
}
function renderTimeline() {
  $('timeline-range').value=String(current);
  $('timeline-range').setAttribute('aria-valuetext',`${dateText(current)}. ${cycleLabel()}.`);
  $('timeline-date').textContent=dateText(current);
  $('timeline-period').textContent=cycleLabel();
  $('timeline-day').value=dayKey(current);
  $('previous-cycle').disabled=current<=earliest;
  $('next-cycle').disabled=current>=latest;
  $('timeline-present').disabled=current>=latest&&!playing;
  $('map-statistics').innerHTML=`<span><strong>${number(state.articles.size)}</strong> articles</span><span><strong>${number(state.words)}</strong> words</span><span><strong>${number(state.revisions)}</strong> revisions</span><span><strong>${number(state.editors.length)}</strong> editors</span><span><strong>${number(state.discussions)}</strong> discussion ${state.discussions===1?'entry':'entries'}</span>`;
}
function filteredArticles() {
  const query=currentQuery.toLowerCase();
  return [...state.articles.values()].filter(article=>(!currentCategory||(article.categories||[]).includes(currentCategory))&&(!query||`${article.title} ${article.body}`.toLowerCase().includes(query)));
}
function categoryOptions() {
  const categories=[...new Set([...state.articles.values()].flatMap(article=>article.categories||[]))].sort();
  if(currentCategory&&!categories.includes(currentCategory))currentCategory='';
  const serialized=JSON.stringify(categories);
  if($('map-category').dataset.options!==serialized) {
    $('map-category').innerHTML=`<option value="">All categories</option>${categories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join('')}`;
    $('map-category').dataset.options=serialized;
  }
  $('map-category').value=currentCategory;
  $('map-category').disabled=view==='relationships'||view==='activity';
  $('map-search').disabled=view==='activity';
}
function buildNetwork() {
  let nodes=[],edges=[];
  if(view==='articles') {
    nodes=filteredArticles().map(article=>({id:article.id,type:'article',label:article.title,...positions.get(article.id),radius:Math.max(5,Math.sqrt(article.words/Math.PI)*1.6),words:article.words}));
    const ids=new Set(nodes.map(node=>node.id));
    edges=state.links.filter(link=>ids.has(link.source)&&ids.has(link.target)).map(link=>({...link,id:`${link.source}|${link.target}`}));
    $('map-legend').innerHTML='<span class="legend-node"></span> Article area = word count <span class="legend-line"></span> A link in an article · Positions stay fixed through time.';
  } else if(view==='principles') {
    const articles=filteredArticles();
    const articleIds=new Set(articles.map(article=>article.id));
    const pairs=new Set();
    for(const event of state.events)if(event.articleId&&articleIds.has(event.articleId))for(const principleId of event.principleIds||[])if((data.principles||[]).some(p=>p.id===principleId))pairs.add(`${principleId}\0${event.articleId}`);
    const linkedIds=new Set([...pairs].map(pair=>pair.split('\0')[1]));
    nodes=articles.filter(article=>linkedIds.has(article.id)).map(article=>({id:article.id,type:'article',label:article.title,...positions.get(article.id),radius:Math.max(5,Math.sqrt(article.words/Math.PI)*1.6)}));
    (data.principles||[]).forEach((principle,index)=>nodes.push({id:`principle:${principle.id}`,realId:principle.id,type:'principle',label:principle.title,x:170+index*330,y:-20,radius:15}));
    edges=[...pairs].map(pair=>{const [principleId,articleId]=pair.split('\0');return {source:`principle:${principleId}`,target:articleId};});
    $('map-legend').innerHTML='<span class="legend-node square"></span> Founding principle <span class="legend-node"></span> Article <span class="legend-line"></span> Explicit association in a public record; not inferred agreement.';
  } else if(view==='relationships') {
    nodes=state.editors.filter(editor=>!currentQuery||`${editor.name} ${editor.id} ${(editor.interests||[]).join(' ')}`.toLowerCase().includes(currentQuery.toLowerCase())).map(editor=>({id:editor.id,type:'editor',label:editor.name||editor.id,...editorPositions.get(editor.id),radius:10+Math.sqrt(state.contributions.get(editor.id)||0)*2}));
    const ids=new Set(nodes.map(node=>node.id));
    edges=state.relationships.filter(relationship=>ids.has(relationship.from)&&ids.has(relationship.to)).map(relationship=>({source:relationship.from,target:relationship.to,relationship}));
    $('map-legend').innerHTML='<span class="legend-node"></span> Editor size = public contributions. <strong class="relationship-positive">Positive</strong> solid · <strong class="relationship-neutral">Neutral</strong> dotted · <strong class="relationship-negative">Negative</strong> dashed. Thicker arrows indicate stronger attitudes. Read each arrow from its source to its target.';
  }
  return {nodes,edges};
}
function applyViewport() { $('network').setAttribute('viewBox',`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`); }
function fitNetwork(nodes=lastGraphNodes) {
  if(!nodes.length){viewport={x:0,y:0,width:1000,height:700};applyViewport();return;}
  const rect=$('network').getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return;
  const minX=Math.min(...nodes.map(n=>n.x))-95,maxX=Math.max(...nodes.map(n=>n.x))+95,minY=Math.min(...nodes.map(n=>n.y))-70,maxY=Math.max(...nodes.map(n=>n.y))+75;
  let width=Math.max(450,maxX-minX),height=Math.max(330,maxY-minY);
  const aspect=rect.width/rect.height;
  if(width/height<aspect)width=height*aspect;else height=width/aspect;
  viewport={x:(minX+maxX-width)/2,y:(minY+maxY-height)/2,width,height};applyViewport();
}
const relationshipColors = {positive:'#167052', neutral:'#62676d', negative:'#a62c38'};
function relationshipReading(relationship) {
  const trust = (relationship.trust - 0.5) * 2;
  const score = Math.round(100 * (Math.max(0, trust) - Math.max(0, -trust, relationship.grievance)));
  const tone = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  const magnitude = Math.abs(score);
  const intensity = magnitude === 0 ? 'None' : magnitude <= 20 ? 'Mild' : magnitude <= 50 ? 'Moderate' : magnitude <= 80 ? 'Strong' : 'Extreme';
  return {tone, intensity, magnitude, signed: score > 0 ? '+' + score : String(score)};
}
function relationshipLabel(reading) {
  return '<strong class="relationship-' + reading.tone + '">' + reading.tone[0].toUpperCase() + reading.tone.slice(1) +
    '</strong> · ' + reading.intensity + ' (' + reading.signed + ')';
}
function relationshipSummary(record) {
  const reading = relationshipReading(record);
  const supporting = new Set(record.evidenceIds);
  const latest = state.events.filter(event => supporting.has(event.id)).at(-1);
  const reason = latest?.summary || latest?.title;
  return reading.intensity + ' ' + reading.tone + ' (' + reading.signed + '). Trust ' +
    record.trust + ', grievance ' + record.grievance + '. ' +
    (reason ? 'Latest supporting event: ' + reason : 'No supporting event is recorded.');
}
function relationshipHistory(from, to) {
  const pair = (a,b) => (a === from && b === to) || (a === to && b === from);
  const records = (data.relationships || []).filter(record => pair(record.from, record.to) && stamp(record.timestamp) <= state.time)
    .sort((a,b) => stamp(a.timestamp) - stamp(b.timestamp));
  const evidenceIds = new Set(records.flatMap(record => record.evidenceIds || []));
  const byId = new Map(state.events.flatMap(event => [[event.id,event], ...(event.revisionId ? [[event.revisionId,event]] : [])]));
  const interactions = state.events.filter(event => evidenceIds.has(event.id) ||
    [...(event.references || []), event.baseRevisionId].some(id => {
      const related = byId.get(id);
      return related && pair(event.editorId, related.editorId);
    }));
  const editorName = id => state.editors.find(editor => editor.id === id)?.name || id;
  return '<h3>Attitude history</h3><p>Both directions, through the selected date.</p>' +
    '<ol class="relationship-timeline">' + records.map(record => {
      const links = (record.evidenceIds || []).map(id => byId.get(id)).filter(Boolean).map(eventLink);
      return '<li><strong>' + esc(editorName(record.from)) + ' → ' + esc(editorName(record.to)) +
        '</strong> · ' + esc(dateText(record.timestamp)) + '<br>' + relationshipLabel(relationshipReading(record)) +
        '<br>Trust ' + esc(record.trust) + ' · Grievance ' + esc(record.grievance) +
        (links.length ? '<br>Evidence: ' + links.join(' · ') : '') + '</li>';
    }).join('') + '</ol><h3>Recorded interactions (' + interactions.length + ')</h3>' +
    '<p>Includes evidence, direct references, and edits based on the other editor’s revision.</p>' +
    (interactions.length ? '<ol class="relationship-timeline">' + interactions.map(event =>
      '<li>' + esc(dateText(event.timestamp)) + '<br><strong>' + esc(editorName(event.editorId)) +
      ' · ' + esc(event.action) + '</strong> · ' + eventLink(event) + '</li>').join('') + '</ol>'
      : '<p>No linked public interactions at this moment.</p>');
}
function drawNetwork() {
  const {nodes,edges}=buildNetwork();lastGraphNodes=nodes;
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const focused=document.activeElement?.closest?.('[data-node-id]')?.dataset.nodeId;
  const selectedId=selected?.type==='principle'?`principle:${selected.id}`:selected?.id;
  const directions = new Set(edges.filter(edge => edge.relationship).map(edge => edge.source + '|' + edge.target));
  const edgeHtml = edges.map(edge => {
    const from = byId.get(edge.source), to = byId.get(edge.target);
    if (!from || !to) return '';
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const offset = edge.relationship && directions.has(edge.target + '|' + edge.source) ? 5 : 0;
    const x1 = from.x + dx * (from.radius + 2) - dy * offset;
    const y1 = from.y + dy * (from.radius + 2) + dx * offset;
    const x2 = to.x - dx * (to.radius + 5) - dy * offset;
    const y2 = to.y - dy * (to.radius + 5) + dx * offset;
    const coordinates = ' x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"';
    const label = esc(from.label) + ' → ' + esc(to.label);
    if (!edge.relationship) {
      const highlighted = edge.source === selectedId || edge.target === selectedId;
      return '<line class="network-edge' + (highlighted ? ' highlighted' : '') + '"' + coordinates + '><title>' + label + '</title></line>';
    }
    const reading = relationshipReading(edge.relationship);
    const selectedEdge = selected?.type === 'relationship' && selected.id === edge.source + '|' + edge.target;
    const width = 1.6 + 4 * Math.sqrt(reading.magnitude / 100);
    const summary = label + ' · ' + esc(relationshipSummary(edge.relationship));
    return '<g class="relationship-control" data-node-type="relationship" data-node-id="' + esc(edge.source + '|' + edge.target) + '" tabindex="0" role="button" aria-label="' + summary + '"><title>' + summary + '</title><line class="relationship-hit"' + coordinates + '/><line class="relationship-edge' + (selectedEdge ? ' selected-relationship' : '') + '"' + coordinates +
      ' stroke="' + relationshipColors[reading.tone] + '" stroke-width="' + width +
      '" marker-end="url(#relationship-arrow-' + reading.tone + ')"' +
      (reading.tone === 'negative' ? ' stroke-dasharray="7 4"' : reading.tone === 'neutral' ? ' stroke-dasharray="2 4"' : '') +
      '/></g>';
  }).join('');
  const markers = Object.entries(relationshipColors).map(([tone, color]) =>
    '<marker id="relationship-arrow-' + tone + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="' + color + '"/></marker>'
  ).join('');
  $('network').innerHTML=`<defs>${markers}</defs><g>${edgeHtml}</g><g>${nodes.map(node=>`<g class="node ${node.type}${node.id===selectedId?' selected':''}" transform="translate(${node.x} ${node.y})" data-node-id="${esc(node.realId||node.id)}" data-node-type="${node.type}" tabindex="0" role="button" aria-label="${esc(node.label)}${node.words!==undefined?`, ${number(node.words)} words`:''}. Inspect connections."><title>${esc(node.label)}${node.words!==undefined?` — ${number(node.words)} words`:''}</title>${node.type==='principle'?`<rect x="-${node.radius}" y="-${node.radius}" width="${node.radius*2}" height="${node.radius*2}"/>`:`<circle r="${node.radius}"/>`}<text y="${node.radius+16}" text-anchor="middle">${esc(short(node.label))}</text></g>`).join('')}</g>`;
  $('network').setAttribute('aria-label',`${view==='relationships'?'Editor':view==='principles'?'Principle and article':'Article'} network at ${dateText(current)}. ${nodes.length} visible nodes.`);
  $('network-empty').hidden=nodes.length>0;
  $('network-empty').textContent=currentQuery||currentCategory?'No matches at this moment. Try a different search or category.':'No articles had been written at this moment.';
  if(focused)for(const node of $('network').querySelectorAll('[data-node-id]'))if(node.dataset.nodeId===focused){node.focus({preventScroll:true});break;}
  applyViewport();
}
function evidence(ids=[]) {
  const events=ids.map(id=>state.events.find(event=>event.id===id)).filter(Boolean);
  return events.length?`<ul>${events.slice(-8).map(event=>`<li>${eventLink(event)} <span class="small muted">(${esc(dateText(event.timestamp,true))})</span></li>`).join('')}</ul>`:'<p class="small muted">No supporting public record is available at this moment.</p>';
}
function detailView() {
  const details=$('map-details');
  if(!selected) {details.innerHTML=`<h2>Explore the ${view==='relationships'?'editors':view==='principles'?'principles':'articles'}</h2><p>Select a node or a row below to inspect it.</p><p class="detail-intro">Every count, connection, and record shown here belongs to ${esc(dateText(current))}.</p><p><a href="${esc(contextHref({view:'articles'}))}">Read the encyclopedia at this moment</a></p>`;return;}
  if(selected.type==='article') {
    const article=state.articles.get(selected.id);
    if(!article){details.innerHTML='<h2>Not yet written</h2><p>This article did not exist at the selected moment. Move forward in time to follow its development.</p>';return;}
    const outgoing=state.links.filter(link=>link.source===article.id).map(link=>link.target),incoming=state.backlinks.get(article.id)||[];
    const revisions=state.events.filter(event=>event.articleId===article.id&&REVISION_ACTIONS.has(event.action));
    const editors=[...new Set(revisions.map(event=>event.editorId))];
    details.innerHTML=`<h2>${articleLink(article.id,article.title,at())}</h2><dl class="metadata-list"><dt>Words</dt><dd>${number(article.words)}</dd><dt>Revisions</dt><dd>${number(article.revisions)}</dd><dt>Created</dt><dd>${esc(dateText(article.createdAt,true))}</dd><dt>Last changed</dt><dd>${esc(dateText(article.updatedAt))}</dd></dl><p><a href="${esc(contextHref({article:article.id}))}">Read article</a> · <a href="${esc(contextHref({view:'history',article:article.id}))}">Revision history</a> · <a href="#article-attribution">Who wrote what</a> · <a href="${esc(contextHref({view:'discussion',article:article.id}))}">Discussion</a></p><h3>Links to</h3>${outgoing.length?`<ul>${outgoing.map(id=>`<li>${selectButton(id,'article',state.articles.get(id).title)}</li>`).join('')}</ul>`:'<p class="small muted">No outgoing article links.</p>'}<h3>Linked from</h3>${incoming.length?`<ul>${incoming.map(id=>`<li>${selectButton(id,'article',state.articles.get(id).title)}</li>`).join('')}</ul>`:'<p class="small muted">No incoming links yet.</p>'}<h3>Contributors</h3><p>${editors.map(id=>userLink(id,at())).join(', ')}</p>`;
  } else if(selected.type==='editor') {
    const editor=state.editors.find(e=>e.id===selected.id);
    if(!editor){details.innerHTML='<h2>Not yet joined</h2><p>This editor had not arrived at the selected moment.</p>';return;}
    const events=state.events.filter(e=>e.editorId===editor.id&&e.action!=='join'),revisions=events.filter(e=>REVISION_ACTIONS.has(e.action));
    const relationships=state.relationships.filter(r=>r.from===editor.id||r.to===editor.id);
    details.innerHTML=`<h2>${userLink(editor.id,at())}</h2><p>${esc(editor.description||'An editor of the encyclopedia.')}</p><dl class="metadata-list"><dt>Joined</dt><dd>${esc(dateText(editor.joinedAt,true))}</dd><dt>Contributions</dt><dd>${number(events.length)}</dd><dt>Revisions</dt><dd>${number(revisions.length)}</dd><dt>Released journals</dt><dd>${number(state.journals.filter(j=>j.editorId===editor.id).length)}</dd></dl><p><a href="${esc(contextHref({view:'user',user:editor.id}))}">Contribution history</a> · <a href="${esc(href({view:'journals',user:editor.id,at:at()},'/wiki/map/'))}">Read journals</a></p><h3>Recorded relationships</h3>${relationships.length?`<ul>${relationships.map(r=>`<li>${selectButton(`${r.from}|${r.to}`,'relationship',`${r.from} → ${r.to}`)}</li>`).join('')}</ul>`:'<p class="small muted">No recorded attitudes yet.</p>'}`;
  } else if(selected.type==='principle') {
    const principle=(data.principles||[]).find(p=>p.id===selected.id);
    if(!principle){details.innerHTML='<h2>Principle unavailable</h2>';return;}
    const events=state.events.filter(event=>(event.principleIds||[]).includes(principle.id));
    details.innerHTML=`<h2>${esc(principle.title)}</h2><p>${esc(principle.description)}</p><p>${number(events.length)} public records explicitly associated with this principle.</p><p class="small muted">An association records a subject of concern, not necessarily agreement.</p><h3>Supporting records</h3>${evidence(events.map(event=>event.id))}<p><a href="${esc(contextHref({view:'principles',principle:principle.id}))}">Read the founding principles</a></p>`;
  } else if(selected.type==='relationship') {
    const [from,to]=selected.id.split('|'),relationship=state.relationships.find(r=>r.from===from&&r.to===to);
    if(!relationship){details.innerHTML='<h2>No relationship record</h2><p>This attitude had not been recorded at the selected moment.</p>';return;}
    details.innerHTML=`<h2>${esc(from)} → ${esc(to)}</h2><p>This is ${userLink(from,at())}'s recorded attitude toward ${userLink(to,at())}.</p><p>${relationshipLabel(relationshipReading(relationship))}</p><dl class="metadata-list"><dt>Trust</dt><dd>${esc(relationship.trust)}</dd><dt>Grievance</dt><dd>${esc(relationship.grievance)}</dd><dt>Recorded</dt><dd>${esc(dateText(relationship.timestamp))}</dd></dl><p class="small muted">Scores describe fictional character state. The reverse relationship may differ.</p>${relationshipHistory(from,to)}`;
  }
}
function recordView() {
  const target=$('map-records');
  if(view==='articles') {
    const list=filteredArticles().sort((a,b)=>b.words-a.words||a.title.localeCompare(b.title));
    target.innerHTML=`<h2>Articles at this moment</h2><p class="filter-count">${number(list.length)} of ${number(state.articles.size)} articles shown. Select an article to inspect its connections.</p>${rows(['Article','Words','Revisions','Links out','Links in'],list.map(article=>[selectButton(article.id,'article',article.title),number(article.words),number(article.revisions),number(state.links.filter(link=>link.source===article.id).length),number((state.backlinks.get(article.id)||[]).length)]))}`;
  } else if(view==='relationships') {
    target.innerHTML=`<h2>Directed relationships</h2><p class="small muted">The signed score runs from −100 to +100. Trust above 0.50 adds positive weight. Distrust below 0.50 or grievance adds negative weight, using whichever is stronger. The table lists the strongest attitudes first. Each direction has its own record.</p>${state.relationships.length?rows(['Relationship','Attitude and intensity','Trust','Grievance','Last recorded'],state.relationships.filter(r=>!currentQuery||`${r.from} ${r.to}`.toLowerCase().includes(currentQuery.toLowerCase())).sort((a,b)=>relationshipReading(b).magnitude-relationshipReading(a).magnitude).map(r=>[selectButton(`${r.from}|${r.to}`,'relationship',`${r.from} → ${r.to}`),relationshipLabel(relationshipReading(r)),esc(r.trust),esc(r.grievance),esc(dateText(r.timestamp,true))])):'<p class="empty-state">No relationships had been recorded at this moment.</p>'}<h2>Editors</h2>${rows(['Editor','Joined','Contributions'],state.editors.map(editor=>[selectButton(editor.id,'editor',editor.name||editor.id),esc(dateText(editor.joinedAt,true)),number(state.contributions.get(editor.id)||0)]))}`;
  } else if(view==='principles') {
    target.innerHTML=`<h2>Principles and public records</h2>${rows(['Principle','Meaning','Associated records'],(data.principles||[]).map(principle=>[selectButton(principle.id,'principle',principle.title),esc(principle.description),number(state.events.filter(event=>(event.principleIds||[]).includes(principle.id)).length)]))}`;
  } else target.innerHTML='';
}
function growthChart() {
  const points=growth.filter(point=>point.time<=current);
  if(!points.length||points.at(-1).time!==current)points.push({time:current,words:state.words,articles:state.articles.size});
  const max=Math.max(1,...points.map(point=>point[growthMetric])),width=900,height=220,left=65,right=20,top=22,bottom=36;
  const x=time=>left+(time-earliest)/Math.max(1,current-earliest)*(width-left-right),y=value=>height-bottom-value/max*(height-top-bottom);
  const grid=[0,.25,.5,.75,1].map(fraction=>`<line class="chart-grid" x1="${left}" y1="${y(max*fraction)}" x2="${width-right}" y2="${y(max*fraction)}"/><text x="${left-9}" y="${y(max*fraction)+4}" text-anchor="end">${number(Math.round(max*fraction))}</text>`).join('');
  return `<svg class="growth-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${growthMetric==='words'?'Total word':'Article'} count from founding to ${esc(dateText(current))}, ending at ${number(state[growthMetric==='words'?'words':'articles']?.size??state.words)}"><title>${growthMetric==='words'?'Word':'Article'} growth through ${esc(dateText(current))}</title>${grid}<path d="${points.map((point,index)=>`${index?'L':'M'} ${x(point.time).toFixed(2)} ${y(point[growthMetric]).toFixed(2)}`).join(' ')}"/>${points.map(point=>`<circle cx="${x(point.time)}" cy="${y(point[growthMetric])}" r="2" fill="#36c"><title>${esc(dateText(point.time))}: ${number(point[growthMetric])} ${growthMetric}</title></circle>`).join('')}<text x="${left}" y="${height-10}">${esc(dateText(earliest,true))}</text><text x="${width-right}" y="${height-10}" text-anchor="end">${esc(dateText(current,true))}</text></svg>`;
}
function activityView() {
  const articles=[...state.articles.values()],editors=state.editors.map(editor=>({editor,revisions:state.events.filter(event=>event.editorId===editor.id&&event.articleId&&REVISION_ACTIONS.has(event.action)).length,comments:state.events.filter(event=>event.editorId===editor.id&&['comment','policy'].includes(event.action)).length})).sort((a,b)=>b.revisions-a.revisions);
  const disputes=articles.map(article=>({article,comments:state.events.filter(event=>event.articleId===article.id&&event.action==='comment').length,reverts:state.events.filter(event=>event.articleId===article.id&&event.action==='revert').length})).filter(item=>item.comments||item.reverts).sort((a,b)=>(b.comments+b.reverts)-(a.comments+a.reverts));
  $('activity-view').innerHTML=`<h2>Growth</h2><div class="view-buttons" role="group" aria-label="Growth measure"><button type="button" data-growth="words" aria-pressed="${growthMetric==='words'}">Words</button><button type="button" data-growth="articles" aria-pressed="${growthMetric==='articles'}">Articles</button></div>${growthChart()}<p class="small muted">Recorded history only. Quiet periods remain flat.</p><div class="activity-columns"><section><h2>Longest articles</h2>${rows(['Article','Words','Revisions'],articles.sort((a,b)=>b.words-a.words).slice(0,12).map(article=>[articleLink(article.id,article.title,at()),number(article.words),number(article.revisions)]))}</section><section><h2>Revisions by editor</h2>${rows(['Editor','Revisions','Discussion entries'],editors.map(item=>[userLink(item.editor.id,at()),number(item.revisions),number(item.comments)]))}</section></div><h2>Discussion and reversions</h2><p class="small muted">Activity signals, not a judgment about who was right. A discussion entry is counted separately from an article revision.</p>${disputes.length?rows(['Article','Discussion entries','Reversions'],disputes.slice(0,20).map(item=>[articleLink(item.article.id,item.article.title,at()),number(item.comments),number(item.reverts)])):'<p class="empty-state">No discussion or reversions yet.</p>'}<h2>Recent events at this moment</h2><ul class="change-list">${state.events.slice(-15).reverse().map(event=>`<li><span class="change-date">${esc(dateText(event.timestamp))}</span> · ${userLink(event.editorId,at())} · ${eventLink(event)}</li>`).join('')}</ul>`;
  $('map-legend').textContent='Counts and growth are reconstructed from the public event history at the selected time.';
}
let highlightedEditor = '';
function renderAttribution() {
  const panel = $('article-attribution');
  const article = selected?.type === 'article' && view === 'articles' ? state.articles.get(selected.id) : null;
  panel.hidden = !article;
  if (!article) return;
  const revisions = state.events.filter(event => event.articleId === article.id && REVISION_ACTIONS.has(event.action));
  const name = id => state.editors.find(editor => editor.id === id)?.name ?? id;
  const editors = [...new Set(revisions.map(revision => revision.editorId))];
  const passages = attributedLines(revisions).filter(line => line.text.trim());
  const options = editors.map(id => '<option value="' + esc(id) + '">' + esc(name(id)) + '</option>').join('');
  panel.innerHTML = '<h2>Who wrote what · ' + esc(article.title) + '</h2>' +
    '<p>Each passage credits the editor who last changed that line. Unchanged lines keep their earlier credit. The revision log shows removed text and recorded reasons.</p>' +
    '<label for="attribution-editor">Highlight an editor</label> <select id="attribution-editor"><option value="">All editors</option>' + options + '</select>' +
    passages.map(({text, revision}) => '<div class="attribution-passage" data-credit="' + esc(revision.editorId) + '">' +
      '<small>' + esc(name(revision.editorId)) + ' · ' + esc(dateText(revision.timestamp)) + '</small>' +
      markup(text, state.articles, at()) + '</div>').join('') +
    '<h3>Revision log</h3>' + rows(['Date', 'Editor', 'Action', 'Recorded reason', 'Changes'], revisions.map((event, index) => [
      esc(dateText(event.timestamp)), esc(name(event.editorId)), esc(event.action), esc(event.summary || 'No reason recorded'),
      '<a href="' + esc(contextHref({view:'history', article:article.id, from:revisions[index - 1]?.revisionId || 'empty', to:event.revisionId})) + '">Compare</a>',
    ]).reverse());
  const filter = $('attribution-editor');
  filter.value = editors.includes(highlightedEditor) ? highlightedEditor : '';
  const highlight = () => {
    highlightedEditor = filter.value;
    for (const passage of panel.querySelectorAll('[data-credit]')) {
      passage.classList.toggle('attribution-highlight', Boolean(filter.value) && passage.dataset.credit === filter.value);
    }
  };
  filter.addEventListener('change', highlight);
  highlight();
}
function render() {
  state=snapshot(data,new Date(current).toISOString());
  renderTimeline();categoryOptions();
  const activity = view === 'activity';
  const journals = view === 'journals';
  $('map-explorer').hidden = activity || journals;
  $('activity-view').hidden = !activity;
  $('journal-view').hidden = !journals;
  $('map-records').hidden = journals;
  if (journals) {
    const editor = selected?.type === 'editor' ? selected.id : null;
    const entries = state.journals.filter(entry => !editor || entry.editorId === editor).reverse();
    const journalLink = (label, user) => '<a href="' + esc(href({view:'journals',user,at:at()},'/wiki/map/')) + '">' + esc(label) + '</a>';
    $('journal-view').innerHTML = '<h2>Editor notes</h2><p>Decisions and reasons, including turns when an editor held back. Notes appear after 48 simulated hours.</p><p>' +
      [journalLink('All editors'), ...state.editors.map(person => journalLink(person.name, person.id))].join(' · ') +
      '</p>' + (entries.length ? entries.map(entry => '<article class="journal-entry"><h3>' +
        esc(entry.editorId) + ' · ' + esc(dateText(entry.timestamp)) + '</h3>' +
        (entry.action ? '<p class="journal-meta">Decision: ' + esc(entry.action === 'abstain' ? 'Held back' : entry.action) + '</p>' : '') +
        markup(entry.body,state.articles,at()) + (entry.response?.length ? '<p class="journal-meta">Recorded effect: ' + esc(entry.response.join(' · ')) + '</p>' : '') + (entry.outcome ? '<p class="journal-meta">Outcome: ' + esc(entry.outcome) + '</p>' : '') +
        '</article>').join('') : '<p>No journal entries have been released at this moment.</p>');
  }
  if(activity)activityView();else if(!journals){drawNetwork();detailView();}
  if(!journals)recordView();
  renderAttribution();
  for(const link of document.querySelectorAll('.wiki-sidebar a, .wiki-footer a, .wiki-navigation a')) {
    const url=new URL(link.href,location.href);
    if(url.origin===location.origin&&url.pathname.startsWith('/wiki/')) {
      if(current<latest)url.searchParams.set('at',at());else url.searchParams.delete('at');
      link.href=url.pathname+url.search+url.hash;
    }
  }
}
function setTime(value, save=true) {
  current=Math.max(earliest,Math.min(latest,Number(value)));render();if(save&&!playing)updateAddress();
}
function stopPlayback(message='') {
  playing=false;cancelAnimationFrame(frame);$('timeline-play').textContent='Play';$('timeline-skip').hidden=true;$('timeline-status').textContent=message;updateAddress();
}
function startPlayback(from=earliest,to=latest) {
  if(reduced.matches){setTime(to);stopPlayback('Reduced motion is enabled. Use the timeline to explore individual moments.');return;}
  if(to<=from){setTime(to);return;}
  cancelAnimationFrame(frame);playing=true;animationStart=performance.now();animationFrom=from;animationTo=to;animationDuration=10000;lastPaint=0;
  $('timeline-play').textContent='Pause';$('timeline-skip').hidden=false;$('timeline-status').textContent='Replaying the history in ten seconds…';
  function tick(now) {
    if(!playing)return;
    const progress=Math.min(1,(now-animationStart)/animationDuration);
    if(now-lastPaint>=100||progress===1){setTime(animationFrom+(animationTo-animationFrom)*progress,false);lastPaint=now;}
    if(progress<1)frame=requestAnimationFrame(tick);else{setTime(animationTo,false);stopPlayback('Replay complete. Explore a moment with the timeline.');}
  }
  frame=requestAnimationFrame(tick);
}
function select(id,type) {
  if(playing)stopPlayback('Playback paused to inspect this item.');
  const keyboardRecord=document.activeElement?.closest?.('[data-select-id]');
  selected={id,type};if(view==='activity'){view=type==='editor'||type==='relationship'?'relationships':type==='principle'?'principles':'articles';updateViewButtons();}
  if(!playing){render();updateAddress();if(keyboardRecord)for(const button of document.querySelectorAll('[data-select-id]'))if(button.dataset.selectId===id&&button.dataset.selectType===type){button.focus({preventScroll:true});break;}}
}
function updateViewButtons() {for(const button of document.querySelectorAll('[data-map-view]'))button.setAttribute('aria-pressed',String(button.dataset.mapView===view));}
function switchView(next) {
  view=next;selected=null;currentQuery='';$('map-search').value='';updateViewButtons();render();fitNetwork();updateAddress();
}

$('timeline-range').addEventListener('input',event=>{stopPlayback();setTime(event.target.value);});
$('timeline-range').addEventListener('wheel',event=>{if(document.activeElement!==event.currentTarget)return;event.preventDefault();stopPlayback();stepBoundary(event.deltaY>0?1:-1);},{passive:false});
function stepBoundary(direction) {const target=direction>0?boundaries.find(time=>time>current+1000):[...boundaries].reverse().find(time=>time<current-1000);setTime(target??(direction>0?latest:earliest));}
$('previous-cycle').addEventListener('click',()=>{stopPlayback();stepBoundary(-1);});
$('next-cycle').addEventListener('click',()=>{stopPlayback();stepBoundary(1);});
$('timeline-play').addEventListener('click',()=>{if(playing)stopPlayback('Playback paused.');else startPlayback(current>=latest?earliest:current,latest);});
$('timeline-replay').addEventListener('click',()=>startPlayback(earliest,latest));
$('timeline-present').addEventListener('click',()=>{stopPlayback();setTime(latest);});
$('timeline-skip').addEventListener('click',()=>{const target=animationTo;stopPlayback();setTime(target);});
$('timeline-day').addEventListener('change',event=>{if(event.target.value){stopPlayback();setTime(pacificDayEnd(event.target.value));}});
$('map-search').addEventListener('input',event=>{currentQuery=event.target.value.trim();render();});
$('map-category').addEventListener('change',event=>{currentCategory=event.target.value;render();});
for(const button of document.querySelectorAll('[data-map-view]'))button.addEventListener('click',()=>switchView(button.dataset.mapView));
document.addEventListener('click',event=>{const button=event.target.closest('[data-select-id]');if(button)select(button.dataset.selectId,button.dataset.selectType);const growthButton=event.target.closest('[data-growth]');if(growthButton){growthMetric=growthButton.dataset.growth;activityView();}});
$('network').addEventListener('click',event=>{const node=event.target.closest('[data-node-id]');if(node&&!dragged)inspectNetworkItem(node);});
$('network').addEventListener('keydown',event=>{const node=event.target.closest('[data-node-id]');if(node&&(event.key==='Enter'||event.key===' ')){event.preventDefault();inspectNetworkItem(node);}});
function inspectNetworkItem(node) {
  select(node.dataset.nodeId,node.dataset.nodeType);
  if (node.dataset.nodeType === 'relationship') {
    const details = $('map-details');
    details.tabIndex = -1;
    details.focus();
  }
}
function zoom(factor) {const width=viewport.width*factor,height=viewport.height*factor;if(width<100||width>12000)return;viewport={x:viewport.x+(viewport.width-width)/2,y:viewport.y+(viewport.height-height)/2,width,height};applyViewport();}
$('zoom-in').addEventListener('click',()=>zoom(.75));$('zoom-out').addEventListener('click',()=>zoom(1/.75));$('zoom-fit').addEventListener('click',()=>fitNetwork());
new ResizeObserver(()=>{if(data)fitNetwork();}).observe($('network'));
let drag=null,dragged=false;
$('network').addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.clientX,y:event.clientY,viewport:{...viewport}};dragged=false;});
$('network').addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5){dragged=true;$('network').setPointerCapture(event.pointerId);}if(!dragged)return;const rect=$('network').getBoundingClientRect();viewport={...drag.viewport,x:drag.viewport.x-dx*drag.viewport.width/rect.width,y:drag.viewport.y-dy*drag.viewport.height/rect.height};$('network').classList.add('dragging');applyViewport();});
function endDrag(){drag=null;$('network').classList.remove('dragging');setTimeout(()=>{dragged=false;},0);}
$('network').addEventListener('pointerup',endDrag);$('network').addEventListener('pointercancel',endDrag);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)stopPlayback('Playback paused while this page was hidden.');});
reduced.addEventListener('change',()=>{if(reduced.matches&&playing){stopPlayback();setTime(animationTo);}});

installGate('map',async fresh=>{
  data=await loadData();earliest=stamp(data.meta.foundingAt);latest=stamp(data.meta.latestCompletedAt);
  const query=new URLSearchParams(location.search),requested=stamp(query.get('at'));
  current=requested?Math.max(earliest,Math.min(latest,requested)):latest;
  view=['articles','principles','relationships','activity','journals'].includes(query.get('view'))?query.get('view'):'articles';
  if(query.has('article'))selected={id:query.get('article'),type:'article'};
  else if(query.has('user'))selected={id:query.get('user'),type:'editor'};
  else if(query.has('principle'))selected={id:query.get('principle'),type:'principle'};
  const firstArticles=new Map();
  for(const event of [...data.events].sort((a,b)=>stamp(a.timestamp)-stamp(b.timestamp)))if(event.articleId&&REVISION_ACTIONS.has(event.action)&&!firstArticles.has(event.articleId))firstArticles.set(event.articleId,{id:event.articleId});
  positions=stablePositions([...firstArticles.values()]);editorPositions=stablePositions([...data.editors].sort((a,b)=>stamp(a.joinedAt)-stamp(b.joinedAt)));
  boundaries=[...new Set([earliest,...data.cycles.map(cycle=>stamp(cycle.endAt)),latest])].filter(time=>time>=earliest&&time<=latest).sort((a,b)=>a-b);
  const growthTimes=[...new Set([earliest,...data.events.filter(event=>!event.cycleId||event.cycleId==='founding').map(event=>stamp(event.timestamp)),...boundaries])].filter(time=>time>=earliest&&time<=latest).sort((a,b)=>a-b);
  growth=growthTimes.map(time=>{const point=snapshot(data,new Date(time).toISOString());return {time,words:point.words,articles:point.articles.size};});
  $('timeline-range').min=String(earliest);$('timeline-range').max=String(latest);$('timeline-day').min=dayKey(earliest);$('timeline-day').max=dayKey(latest);
  $('timeline-start').textContent=`Day 1 · ${dateText(earliest,true)}`;$('timeline-end').textContent=`Present · ${dateText(latest,true)}`;
  $('load-status').hidden=true;$('map-controls').hidden=false;updateViewButtons();render();fitNetwork();
  if(fresh)document.querySelector('.map-content').focus({preventScroll:true});
  const replayKey='human-condition.map.replayed.v1';
  if(fresh||safeSessionGet(replayKey)!=='yes'){safeSessionSet(replayKey,'yes');startPlayback(earliest,current);}
  else $('timeline-status').textContent='Drag the timeline, or focus it and scroll, to move through history.';
});
