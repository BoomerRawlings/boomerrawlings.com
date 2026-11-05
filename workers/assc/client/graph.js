import { presentation } from './presentation.js';
const NS = 'http://www.w3.org/2000/svg';
const TYPE_LABELS = { person: 'People', organization: 'Organizations', channel: 'Channels', source: 'Sources', account: 'Accounts', event: 'Events', publication: 'Publications' };
const EDGE_LABELS = { observed: 'Observed', reported: 'Reported', hypothesis: 'Hypothesis' };
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const svgEl = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text != null) node.textContent = text;
  return node;
};
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const portraitPath = value => typeof value === 'string' && /^\/ASSC\/portraits\/[a-zA-Z0-9._/-]+$/.test(value) && !value.includes('..') ? value : null;
const typeLabelFor = type => TYPE_LABELS[type] || String(type).replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
const portraitAlignment = position => {
  const [x = 50, y = 50] = String(position || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return `x${x < 34 ? 'Min' : x > 66 ? 'Max' : 'Mid'}Y${y < 34 ? 'Min' : y > 66 ? 'Max' : 'Mid'} slice`;
};

/** A self-contained, evidence-linked map. The corpus remains the sole source of relationships. */
export function mountGraph(host, corpus, callbacks = {}) {
  host.replaceChildren();
  const abort = new AbortController();
  const listen = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: abort.signal });
  const alignmentRecords=corpus.alignments||[];let alignmentDate=new Date().toISOString().slice(0,10);
  const allNodes = (corpus.nodes || []).map((node, index) => ({ ...node, index, type: node.type || 'source', label: node.label || node.name || node.id }));
  const byId = new Map(allNodes.map(node => [node.id, node]));
  const allEdges = (corpus.edges || []).filter(edge => byId.has(edge.from) && byId.has(edge.to)).map((edge, index) => ({ ...edge, index, type: EDGE_LABELS[edge.type] ? edge.type : 'hypothesis' }));
  const sources = new Map((corpus.sources || []).map(source => [source.id, source]));
  const people = new Map((corpus.people || []).map(person => [person.id, person]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const state = { type: '', evidence: '', query: '', selected: null, preview: null, paused: reduced.matches, view: 'map', x: 0, y: 0, scale: 1, width: 1000, height: 650, initialized: false };
  state.alignment='';
  let currentNodes = [], currentEdges = [], neighbors = new Map(), nodeElements = new Map(), edgeElements = new Map();
  let previewTimer = 0, observer, destroyed = false, dragDistance = 0;
  const pointers = new Map();
  let gesture = null;

  const root = el('section', 'assc-graph');
  root.setAttribute('aria-label', 'Connections map');
  const toolbar = el('div', 'ag-toolbar');
  const searchWrap = el('label', 'ag-search');
  searchWrap.append(el('span', 'ag-sr-only', 'Find a person, organization or source'));
  const search = el('input'); search.type = 'search'; search.placeholder = 'Find a name or follow a thread…'; search.autocomplete = 'off';
  searchWrap.append(el('span', 'ag-search-icon', '⌕'), search);
  const typeLabel = el('label', 'ag-filter'); typeLabel.append(el('span', '', 'Show'));
  const typeSelect = el('select'); typeSelect.setAttribute('aria-label', 'Filter node type');
  typeSelect.append(new Option('Everyone & everything', ''));
  for (const type of [...new Set(allNodes.map(node => node.type || 'source'))].sort((a, b) => typeLabelFor(a).localeCompare(typeLabelFor(b)))) typeSelect.append(new Option(typeLabelFor(type), type));
  typeLabel.append(typeSelect);
  const evidenceLabel = el('label', 'ag-filter'); evidenceLabel.append(el('span', '', 'Lines'));
  const evidenceSelect = el('select'); evidenceSelect.setAttribute('aria-label', 'Filter relationship evidence');
  evidenceSelect.append(new Option('All evidence', ''));
  for (const [value, label] of Object.entries(EDGE_LABELS)) evidenceSelect.append(new Option(label, value));
  evidenceLabel.append(evidenceSelect);
  const viewButton = el('button', 'ag-view-button', 'List view'); viewButton.type = 'button'; viewButton.setAttribute('aria-pressed', 'false');
  const expandButton = el('button', 'ag-expand-button', 'Expand map'); expandButton.type = 'button'; expandButton.hidden = !root.requestFullscreen; expandButton.setAttribute('aria-label', 'Expand the connections map to full screen');
  toolbar.append(searchWrap, typeLabel, evidenceLabel, expandButton, viewButton);

  const alignmentWrap=el('div','ag-alignments');alignmentWrap.setAttribute('aria-label',presentation.text.text12);
  const alignmentSelect=el('select');alignmentSelect.setAttribute('aria-label',presentation.text.text12);
  for(const [value,label]of [['','All relationships'],['ally','Allies'],['enemy','Enemies'],['mixed','Mixed / changed'],['unclassified','Unclassified']])alignmentSelect.append(new Option(label,value));
  const dateLabel=el('label','ag-alignment-date','As of '),date=el('input');date.type='date';date.value=alignmentDate;date.setAttribute('aria-label','Relationship date');dateLabel.append(date);
  const centerButton=el('button','',presentation.text.text13);centerButton.type='button';
  const alignmentInfo=el('details','ag-alignment-info');alignmentInfo.append(el('summary','','Relationship key'),el('p','',presentation.text.text14));
  const alignmentResult=el('p','ag-alignment-result');alignmentResult.setAttribute('role','status');alignmentResult.hidden=true;alignmentWrap.append(alignmentSelect,dateLabel,centerButton,alignmentInfo,alignmentResult);toolbar.after(alignmentWrap);
  listen(alignmentSelect,'change',()=>{state.alignment=alignmentSelect.value;render();fit();});listen(date,'change',()=>{if(!date.value)return;alignmentDate=date.value;document.dispatchEvent(new CustomEvent('assc-alignment-date',{detail:alignmentDate}));applyLayout();render();fit();});
  listen(centerButton,'click',()=>{state.query='';state.type='';state.evidence='';state.alignment='';search.value='';typeSelect.value='';evidenceSelect.value='';alignmentSelect.value='';render();fit();});
  const stage = el('div', 'ag-stage');
  const svg = svgEl('svg', { class: 'ag-canvas', role: 'group', 'aria-label': 'Interactive relationship map', tabindex: '0' });
  const instructionsId = `ag-help-${Math.random().toString(36).slice(2, 8)}`;
  svg.setAttribute('aria-describedby', instructionsId);
  const defs = svgEl('defs');
  const pattern = svgEl('pattern', { id: `${instructionsId}-grid`, width: 32, height: 32, patternUnits: 'userSpaceOnUse' });
  pattern.append(svgEl('circle', { cx: 1, cy: 1, r: .8, fill: '#ede9df', opacity: .12 })); defs.append(pattern);
  svg.append(defs, svgEl('rect', { width: '100%', height: '100%', fill: `url(#${instructionsId}-grid)`, 'pointer-events': 'none' }));
  const world = svgEl('g', { class: 'ag-world' });
  const edgeLayer = svgEl('g', { class: 'ag-edges' });
  const nodeLayer = svgEl('g', { class: 'ag-nodes' });
  world.append(edgeLayer, nodeLayer); svg.append(world);
  const mapCaption = el('div', 'ag-map-caption');
  mapCaption.append(el('span', 'ag-kicker', 'THE RELATIONSHIP FIELD'), el('span', 'ag-caption-line', 'Relationship network'));
  const status = el('p', 'ag-map-status'); status.setAttribute('aria-live', 'polite');
  const empty = el('div', 'ag-empty'); empty.hidden = true;
  empty.append(el('strong', '', 'No matching paths'), el('p', '', 'Try another name, or clear the filters.'));
  const clearButton = el('button', '', 'Clear filters'); clearButton.type = 'button'; empty.append(clearButton);
  const detail = el('aside', 'ag-detail'); detail.hidden = true; detail.setAttribute('aria-label', 'Connection details');
  const controls = el('div', 'ag-controls'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Map controls');
  const makeControl = (label, symbol) => { const b = el('button', '', symbol); b.type = 'button'; b.title = label; b.setAttribute('aria-label', label); controls.append(b); return b; };
  const zoomIn = makeControl('Zoom in', '+'); const zoomOut = makeControl('Zoom out', '−');
  const scaleOutput = el('output', 'ag-scale', '100%'); scaleOutput.setAttribute('aria-label', 'Map zoom'); controls.append(scaleOutput);
  const resetButton = makeControl('Fit the full map', '↗');
  const motionButton = makeControl('Pause map motion', 'Ⅱ'); motionButton.setAttribute('aria-pressed', String(state.paused));
  const help = el('p', 'ag-help', 'Drag to explore · scroll to zoom · select a portrait or line'); help.id = instructionsId;
  help.append(el('span', 'ag-sr-only', '. Keyboard: arrow keys pan; plus and minus zoom; Home fits the map; Enter or Space pins a focused item; Escape releases the detail. Tab moves through items.'));
  stage.append(svg, mapCaption, status, empty, detail, controls, help);
  const list = el('div', 'ag-list'); list.hidden = true;
  const foot = el('div', 'ag-foot');
  const legend = el('div', 'ag-legend'); legend.setAttribute('aria-label', 'Relationship line styles');
  for (const [type, label] of Object.entries(EDGE_LABELS)) { const item = el('span'); item.append(el('i', `ag-line-key ag-${type}`), document.createTextNode(label)); legend.append(item); }
  const metric = el('p', 'ag-metric', 'Node size = distinct linked records in this view. Position is for reading.');
  foot.append(legend, metric);
  root.append(toolbar, alignmentWrap, stage, list, foot); host.append(root);

  function applyLayout(){const layout=subjectLayout(allNodes,alignmentRecords,corpus.sources||[],alignmentDate);for(const n of layout)Object.assign(byId.get(n.id),n);}
  applyLayout();
  function applyCamera() {
    world.setAttribute('transform', `translate(${state.x} ${state.y}) scale(${state.scale})`);
    // Preserve readable portraits and labels as positions move farther apart or closer together.
    const visualScale = clamp(.92 / state.scale, 1, 1.85);
    for (const [id, group] of nodeElements) {
      const node = byId.get(id);
      group.setAttribute('transform', `translate(${node.x} ${node.y}) scale(${visualScale})`);
    }
    root.classList.toggle('ag-distant-view', state.scale < .5);
    help.firstChild.textContent = state.scale < .5 ? 'Full-field overview · zoom in to read the names' : 'Drag to explore · scroll to zoom · select a portrait or line';
    scaleOutput.value = `${Math.round(state.scale * 100)}%`;
  }
  function fit(readable = false) {
    if (!currentNodes.length) return;
    const minX = Math.min(...currentNodes.map(n => n.x)), maxX = Math.max(...currentNodes.map(n => n.x));
    const minY = Math.min(...currentNodes.map(n => n.y)), maxY = Math.max(...currentNodes.map(n => n.y));
    state.scale = clamp(Math.min((state.width - 160) / Math.max(250, maxX - minX), (state.height - 195) / Math.max(250, maxY - minY)), .18, 1.65);
    // Small screens open at a reading distance; Overview always retains the complete field.
    if (readable && state.width < 650) state.scale = Math.max(.67, state.scale);
    state.x = state.width / 2 - (currentNodes.some(n=>n.id===presentation.subjectId)?byId.get(presentation.subjectId).x:(minX+maxX)/2) * state.scale;
    state.y = state.height / 2 - (currentNodes.some(n=>n.id===presentation.subjectId)?byId.get(presentation.subjectId).y:(minY+maxY)/2) * state.scale;
    applyCamera();
  }
  function zoom(factor, px = state.width / 2, py = state.height / 2) {
    const next = clamp(state.scale * factor, .2, 4);
    const ratio = next / state.scale;
    state.x = px - (px - state.x) * ratio; state.y = py - (py - state.y) * ratio; state.scale = next; applyCamera();
  }
  function localPoint(event) { const rect = svg.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  function radius(node) { if(node.id===presentation.subjectId)return 40;return 25 + Math.min(14, Math.sqrt(neighbors.get(node.id)?.size || 0) * 5); }
  function edgeCurve(edge) {
    const a = byId.get(edge.from), b = byId.get(edge.to);
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const bend = Math.min(95, length * .19) * (edge.index % 2 ? -1 : 1);
    return `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2 - dy / length * bend} ${(a.y + b.y) / 2 + dx / length * bend} ${b.x} ${b.y}`;
  }
  function safeLink(url) { try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; } }
  function sourceButtons(sourceIds, target) {
    if (!sourceIds?.length) return;
    const wrap = el('div', 'ag-evidence-links'); wrap.append(el('span', 'ag-kicker', 'SOURCE TRAIL'));
    for (const id of [...new Set(sourceIds)]) {
      const source = sources.get(id); if (!source) continue;
      if (callbacks.onSource) {
        const button = el('button', 'ag-source-link', source.title || id); button.type = 'button'; listen(button, 'click', () => callbacks.onSource(id)); wrap.append(button);
      } else {
        const url = safeLink(source.url); if (!url) continue;
        const link = el('a', 'ag-source-link', source.title || id); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; wrap.append(link);
      }
    }
    target.append(wrap);
  }
  function select(kind, id, pin = false) {
    clearTimeout(previewTimer);
    if (state.selected && !pin) return;
    if (pin) state.selected = { kind, id };
    state.preview = { kind, id };
    renderDetail(kind, id); highlight(kind, id);
  }
  function clearSelection() { state.selected = null; state.preview = null; detail.hidden = true; highlight(); }
  function leavePreview() { if (!state.selected) previewTimer = window.setTimeout(clearSelection, 300); }
  function highlight(kind, id) {
    const selectedEdge = kind === 'edge' ? allEdges.find(edge => edge.id === id) : null;
    const linked = kind === 'node' ? new Set([id, ...(neighbors.get(id) || [])]) : selectedEdge ? new Set([selectedEdge.from, selectedEdge.to]) : null;
    for (const [nodeId, group] of nodeElements) { group.classList.toggle('is-muted', !!linked && !linked.has(nodeId)); group.classList.toggle('is-selected', kind === 'node' && nodeId === id); }
    for (const [edgeId, group] of edgeElements) {
      const edge = allEdges.find(item => item.id === edgeId);
      const active = kind === 'edge' ? edgeId === id : kind === 'node' ? edge.from === id || edge.to === id : false;
      group.classList.toggle('is-muted', !!kind && !active); group.classList.toggle('is-selected', active);
    }
  }
  function renderDetail(kind, id) {
    detail.replaceChildren();
    const top = el('div', 'ag-detail-top');
    top.append(el('span', 'ag-kicker', state.selected ? 'PINNED DETAIL' : 'A CLOSER LOOK'));
    const close = el('button', 'ag-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close connection detail'); listen(close, 'click', clearSelection); top.append(close); detail.append(top);
    if (kind === 'node') {
      const node = byId.get(id); if (!node) return;
      const person = people.get(id);
      const identity = el('div', 'ag-detail-identity');
      const portrait = portraitPath(node.portrait || person?.portrait);
      if (portrait) { const image = el('img', 'ag-detail-portrait'); image.src = portrait; image.alt = `${node.label} portrait`; image.style.objectPosition = node.portraitPosition || person?.portraitPosition || '50% 50%'; identity.append(image); }
      else { const placeholder = el('span', 'ag-detail-initials', initials(node.label)); placeholder.setAttribute('aria-label', 'Portrait not yet available'); identity.append(placeholder); }
      const title = el('div'); title.append(el('span', 'ag-kicker', node.type || 'Record'), el('h3', '', node.label)); identity.append(title); detail.append(identity);
      if (person?.role) detail.append(el('p', 'ag-detail-role', person.role));
      detail.append(el('p', 'ag-detail-copy', node.bio || person?.bio || 'Follow the source trail for this record.'));
      if(node.type==='person'&&node.id!==presentation.subjectId){const a=node.alignment;detail.append(el('p','ag-alignment-label',alignmentLabels[a.stance]+(a.asOf?' · '+a.asOf:'')));for(const r of a.records){detail.append(el('p','ag-detail-copy',r.statement),el('small','',r.locator));sourceButtons(r.sourceIds,detail);}}
      const degree = neighbors.get(id)?.size || 0;
      detail.append(el('p', 'ag-degree', `${degree} distinct linked ${degree === 1 ? 'record' : 'records'} in this view`));
      const actions = el('div', 'ag-detail-actions');
      const focus = el('button', '', 'Focus this record ↗'); focus.type = 'button'; listen(focus, 'click', () => focusNode(id)); actions.append(focus);
      if (callbacks.onPerson) { const bio = el('button', '', 'Open profile →'); bio.type = 'button'; listen(bio, 'click', () => callbacks.onPerson(id)); actions.append(bio); }
      detail.append(actions); sourceButtons(node.sourceIds || person?.sourceIds, detail);
    } else {
      const edge = allEdges.find(item => item.id === id); if (!edge) return;
      detail.append(el('span', `ag-evidence-badge ag-${edge.type}`, EDGE_LABELS[edge.type]), el('h3', '', edge.label || 'Connection'));
      detail.append(el('p', 'ag-endpoints', `${byId.get(edge.from).label} ↔ ${byId.get(edge.to).label}`));
      detail.append(el('p', 'ag-detail-copy', edge.explanation || 'Read the linked source for this relationship.'));
      sourceButtons(edge.sourceIds, detail);
      for (const ref of edge.transcriptRefs || []) {
        if (!callbacks.onTranscript) continue;
        const button = el('button', 'ag-source-link', 'Read transcript passage →'); button.type = 'button';
        listen(button, 'click', () => callbacks.onTranscript(ref.id || ref.transcriptId, ref.turn || ref.turnId)); detail.append(button);
      }
    }
    if (!state.selected) { const pin = el('button', 'ag-pin', 'Pin detail'); pin.type = 'button'; listen(pin, 'click', () => select(kind, id, true)); detail.append(pin); }
    detail.hidden = false;
  }
  function renderList() {
    list.replaceChildren();
    const heading = el('div', 'ag-list-heading'); heading.append(el('h3', '', 'The people & the paths'), el('p', '', `${currentNodes.length} records · ${currentEdges.length} relationship entries`)); list.append(heading);
    for (const node of currentNodes) {
      const row = el('details', 'ag-list-record');
      const summary = el('summary'); summary.append(el('span', 'ag-list-initials', initials(node.label)), el('strong', '', node.label), el('span', 'ag-list-type', node.type || 'Record')); row.append(summary);
      const body = el('div', 'ag-list-body'); body.append(el('p', '', node.bio || people.get(node.id)?.bio || 'Source record.'));
      const degree = neighbors.get(node.id)?.size || 0; body.append(el('p', 'ag-degree', `${degree} distinct linked ${degree === 1 ? 'record' : 'records'}`));
      const edges = currentEdges.filter(edge => edge.from === node.id || edge.to === node.id);
      if (!edges.length) body.append(el('p', 'ag-empty-copy', 'No relationship entered in the current view.'));
      for (const edge of edges) {
        const item = el('div', 'ag-list-edge'); item.append(el('span', `ag-evidence-badge ag-${edge.type}`, EDGE_LABELS[edge.type]), el('h4', '', edge.label || 'Connection'), el('p', 'ag-endpoints', byId.get(edge.from === node.id ? edge.to : edge.from).label), el('p', '', edge.explanation || ''));
        sourceButtons(edge.sourceIds, item); body.append(item);
      }
      sourceButtons(node.sourceIds, body); row.append(body); list.append(row);
    }
    if (!currentNodes.length) list.append(el('p', 'ag-list-empty', 'No records match the current filters.'));
  }
  function render() {
    alignmentResult.hidden=!state.alignment;const matching=allNodes.filter(n=>n.alignment.stance===state.alignment).length;alignmentResult.textContent=state.alignment?(matching?matching+' '+({ally:'reviewed allies',enemy:'reviewed enemies',mixed:'mixed relationships',unclassified:'unclassified people'})[state.alignment]:'No reviewed '+({ally:'allies',enemy:'enemies',mixed:'mixed relationships',unclassified:'unclassified people'})[state.alignment]+presentation.text.text15):'';
    clearSelection();
    for(const option of alignmentSelect.options){const value=option.value;if(value)option.textContent=({ally:'Allies',enemy:'Enemies',mixed:'Mixed / changed',unclassified:'Unclassified'})[value]+' · '+allNodes.filter(n=>n.alignment.stance===value).length;}
    const query = state.query.trim().toLowerCase();
    currentNodes = allNodes.filter(node => (!state.alignment||node.id===presentation.subjectId||node.alignment.stance===state.alignment) && (!state.type || node.type === state.type) && (!query || [node.label, node.bio, ...(people.get(node.id)?.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(query)));
    const ids = new Set(currentNodes.map(node => node.id));
    currentEdges = allEdges.filter(edge => ids.has(edge.from) && ids.has(edge.to) && (!state.evidence || edge.type === state.evidence));
    neighbors = new Map(currentNodes.map(node => [node.id, new Set()]));
    currentEdges.forEach(edge => { neighbors.get(edge.from).add(edge.to); neighbors.get(edge.to).add(edge.from); });
    edgeLayer.replaceChildren(); nodeLayer.replaceChildren();
    defs.querySelectorAll('clipPath').forEach(node => node.remove());
    nodeElements = new Map(); edgeElements = new Map();
    for (const edge of currentEdges) {
      const path = edgeCurve(edge);
      const group = svgEl('g', { class: `ag-edge ag-${edge.type}`, tabindex: '0', role: 'button', 'aria-label': `${EDGE_LABELS[edge.type]} connection: ${byId.get(edge.from).label} and ${byId.get(edge.to).label}. ${edge.label || ''}` });
      group.append(svgEl('path', { class: 'ag-edge-base', d: path, fill: 'none' }), svgEl('path', { class: 'ag-edge-tracer', d: path, fill: 'none', pathLength: 100, 'aria-hidden': 'true' }), svgEl('path', { class: 'ag-edge-hit', d: path, fill: 'none' }));
      listen(group, 'pointerenter', () => select('edge', edge.id)); listen(group, 'pointerleave', leavePreview);
      listen(group, 'focus', () => select('edge', edge.id)); listen(group, 'blur', leavePreview);
      listen(group, 'click', () => { if (dragDistance < 6) select('edge', edge.id, true); });
      listen(group, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select('edge', edge.id, true); } });
      edgeLayer.append(group); edgeElements.set(edge.id, group);
    }
    for (const node of currentNodes) {
      const r = radius(node); const group = svgEl('g', { class: `ag-node ag-node-${node.type || 'source'} ag-alignment-${node.alignment.stance}`, transform: `translate(${node.x} ${node.y})`, tabindex: '0', role: 'button', 'aria-label': `${node.label}, ${node.type || 'record'}, ${neighbors.get(node.id).size} linked records. Open detail.` });
      const portrait = portraitPath(node.portrait || people.get(node.id)?.portrait);
      group.append(svgEl('circle', { class: 'ag-node-halo', r: r + 9 }), svgEl('circle', { class: 'ag-node-ring', r: r + 3 }), svgEl('circle', { class: 'ag-node-core', r }));
      if (portrait) {
        const clipId = `${instructionsId}-portrait-${node.index}`; const clip = svgEl('clipPath', { id: clipId }); clip.append(svgEl('circle', { r: r - 2 })); defs.append(clip);
        const image = svgEl('image', { href: portrait, x: -r + 2, y: -r + 2, width: (r - 2) * 2, height: (r - 2) * 2, 'clip-path': `url(#${clipId})`, preserveAspectRatio: portraitAlignment(node.portraitPosition || people.get(node.id)?.portraitPosition), 'aria-hidden': 'true' });
        listen(image, 'error', () => { image.remove(); group.insertBefore(svgEl('text', { class: 'ag-node-initials', y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, initials(node.label)), group.querySelector('.ag-node-label')); }); group.append(image);
      } else group.append(svgEl('text', { class: 'ag-node-initials', y: 1, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, initials(node.label)));
      const label = svgEl('text', { class: 'ag-node-label', y: r + 20, 'text-anchor': 'middle' });
      const words = node.label.split(/\s+/); const lines = [''];
      for (const word of words) { const last = lines.length - 1; if (lines[last] && `${lines[last]} ${word}`.length > 19 && lines.length < 2) lines.push(word); else lines[last] += `${lines[last] ? ' ' : ''}${word}`; }
      lines.forEach((line, index) => label.append(svgEl('tspan', { x: 0, dy: index ? 14 : 0 }, line.length > 27 ? `${line.slice(0, 25)}…` : line)));
      group.append(label);
      group.append(svgEl('text', { class: 'ag-node-kind', y: r + 38 + (lines.length - 1) * 14, 'text-anchor': 'middle' }, (node.type || 'record').toUpperCase()));
      listen(group, 'pointerenter', () => select('node', node.id)); listen(group, 'pointerleave', leavePreview);
      listen(group, 'focus', () => select('node', node.id)); listen(group, 'blur', leavePreview);
      listen(group, 'click', () => { if (dragDistance < 6) {select('node', node.id, true);callbacks.onPerson?.(node.id);} });
      listen(group, 'dblclick', event => { event.preventDefault(); focusNode(node.id); });
      listen(group, 'keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select('node', node.id, true);callbacks.onPerson?.(node.id); } });
      nodeLayer.append(group); nodeElements.set(node.id, group);
    }
    status.textContent = `${String(currentNodes.length).padStart(2, '0')} RECORDS / ${String(currentEdges.length).padStart(2, '0')} CONNECTIONS`;
    empty.hidden = currentNodes.length > 0;
    renderList(); fit(true);
  }
  function resize() {
    if (destroyed) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const oldW = state.width, oldH = state.height;
    state.width = rect.width; state.height = rect.height;
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    if (!state.initialized) { fit(true); state.initialized = true; }
    else { state.x += (rect.width-oldW)/2; state.y += (rect.height-oldH)/2; applyCamera(); }
  }
  function focusNode(id) {
    const previous={x:state.x,y:state.y,scale:state.scale};
    const node = byId.get(id); if (!node) return;
    if (!currentNodes.includes(node)) { state.type = ''; state.evidence = ''; state.query = ''; state.alignment='';alignmentSelect.value='';search.value = ''; typeSelect.value = ''; evidenceSelect.value = ''; render(); }
    state.scale = Math.max(1.15, state.scale);
    state.x = state.width * (state.width > 700 ? .38 : .5) - node.x * state.scale;
    state.y = state.height * .46 - node.y * state.scale; applyCamera(); select('node', id, true);
    if(!reduced.matches)world.animate([{transform:`translate(${previous.x}px,${previous.y}px) scale(${previous.scale})`},{transform:`translate(${state.x}px,${state.y}px) scale(${state.scale})`}],{duration:220,easing:'ease-out'});
  }
  function setMotion() { root.classList.toggle('ag-motion-paused', state.paused); motionButton.setAttribute('aria-pressed', String(state.paused)); motionButton.textContent = state.paused ? '▷' : 'Ⅱ'; motionButton.setAttribute('aria-label', state.paused ? 'Resume map motion' : 'Pause map motion'); }
  listen(search, 'input', () => { state.query = search.value; render(); });
  listen(typeSelect, 'change', () => { state.type = typeSelect.value; render(); });
  listen(evidenceSelect, 'change', () => { state.evidence = evidenceSelect.value; render(); });
  listen(clearButton, 'click', () => { state.query = ''; state.type = ''; state.evidence = '';state.alignment='';alignmentSelect.value=''; search.value = ''; typeSelect.value = ''; evidenceSelect.value = ''; render(); });
  listen(viewButton, 'click', () => { state.view = state.view === 'map' ? 'list' : 'map'; stage.hidden = state.view !== 'map'; list.hidden = state.view !== 'list'; viewButton.textContent = state.view === 'map' ? 'List view' : 'Map view'; viewButton.setAttribute('aria-pressed', String(state.view === 'list')); resize(); });
  listen(expandButton, 'click', async () => {
    try { if (document.fullscreenElement === root) await document.exitFullscreen(); else await root.requestFullscreen(); }
    catch { expandButton.textContent = 'Full screen unavailable'; }
  });
  listen(document, 'fullscreenchange', () => { const full = document.fullscreenElement === root; expandButton.textContent = full ? 'Exit full screen' : 'Expand map'; expandButton.setAttribute('aria-label', full ? 'Exit full screen' : 'Expand the connections map to full screen'); resize(); fit(true); });
  listen(zoomIn, 'click', () => zoom(1.25)); listen(zoomOut, 'click', () => zoom(.8)); listen(resetButton, 'click', () => { clearSelection(); fit(); });
  listen(motionButton, 'click', () => { state.paused = !state.paused; setMotion(); });
  listen(reduced, 'change', event => { if (event.matches) state.paused = true; setMotion(); });
  listen(detail, 'pointerenter', () => clearTimeout(previewTimer)); listen(detail, 'pointerleave', leavePreview);
  listen(detail, 'focusin', () => clearTimeout(previewTimer));
  listen(svg, 'wheel', event => { event.preventDefault(); const point = localPoint(event); zoom(Math.exp(-clamp(event.deltaY, -80, 80) * .006), point.x, point.y); }, { passive: false });
  listen(svg, 'keydown', event => {
    const directions = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
    if (directions[event.key]) { event.preventDefault(); const [x, y] = directions[event.key]; state.x += x; state.y += y; applyCamera(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
    else if (event.key === '-' || event.key === '_') { event.preventDefault(); zoom(1 / 1.2); }
    else if (event.key === 'Home') { event.preventDefault(); fit(); }
  });
  listen(root, 'keydown', event => { if (event.key === 'Escape') { clearSelection(); if (detail.contains(document.activeElement)) svg.focus(); } });
  function startGesture() {
    const values = [...pointers.values()];
    if (values.length >= 2) { const [a, b] = values; gesture = { count: 2, distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
    else if (values.length === 1) gesture = { count: 1, x: values[0].x, y: values[0].y };
    else gesture = null;
  }
  listen(svg, 'pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    dragDistance = 0; pointers.set(event.pointerId, localPoint(event)); startGesture();
  });
  listen(svg, 'pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const point = localPoint(event); pointers.set(event.pointerId, point);
    if (!gesture) return;
    const values = [...pointers.values()];
    if (values.length >= 2 && gesture.count === 2) {
      const [a, b] = values, distance = Math.hypot(a.x - b.x, a.y - b.y), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      dragDistance += Math.abs(distance - gesture.distance) + Math.hypot(x - gesture.x, y - gesture.y);
      zoom(distance / Math.max(gesture.distance, 1), gesture.x, gesture.y); state.x += x - gesture.x; state.y += y - gesture.y; applyCamera(); startGesture();
    } else if (values.length === 1 && gesture.count === 1) {
      const dx = point.x - gesture.x, dy = point.y - gesture.y; dragDistance += Math.hypot(dx, dy); state.x += dx; state.y += dy; applyCamera(); startGesture();
    }
    if (dragDistance > 6) {
      if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
      svg.classList.add('is-dragging');
      if (!state.selected) clearSelection();
    }
  });
  const endGesture = event => { pointers.delete(event.pointerId); startGesture(); if (!pointers.size) svg.classList.remove('is-dragging'); };
  listen(svg, 'pointerup', endGesture); listen(svg, 'pointercancel', endGesture); listen(svg, 'lostpointercapture', endGesture);
  listen(window, 'pointerup', endGesture); listen(window, 'pointercancel', endGesture);
  listen(window, 'blur', () => { pointers.clear(); gesture = null; svg.classList.remove('is-dragging'); });
  listen(svg, 'click', event => { if (dragDistance < 6 && !event.target.closest('.ag-node, .ag-edge')) clearSelection(); });
  render(); setMotion(); resize();
  observer = new ResizeObserver(resize); observer.observe(stage);
  return { resize, fit:()=>fit(true), focusNode, destroy() { destroyed = true; abort.abort(); observer?.disconnect(); clearTimeout(previewTimer); host.replaceChildren(); } };
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
