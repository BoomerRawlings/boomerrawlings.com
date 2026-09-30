/* Local build guide. Prompts describe behavior; independent software enforces authority. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (text, action, className) => {
    const node = make('button', text, className);
    node.type = 'button'; node.addEventListener('click', action); return node;
  };
  const send = (type, detail) => document.dispatchEvent(new CustomEvent(type, {detail}));
  const normalize = value => String(value || '').normalize('NFKD').toLowerCase();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const cards = new Map(), rows = new Map(), indexes = new Map();
  let data, sources = new Map(), pinned = null, active = null, query = '', frame = 0;

  const key = (side, id) => `${side}:${id}`;
  const targets = step => [step.id, ...step.related_ids];
  function pairsFor(origin) {
    if (!origin || !data) return [];
    const pairs = [];
    data.steps.forEach(step => {
      targets(step).forEach(target => {
        if ((origin.side === 'plain' && origin.id === step.id) || (origin.side === 'artifact' && origin.id === target)) pairs.push([step.id, target]);
      });
    });
    return pairs;
  }
  function drawConnections(animate = false) {
    const svg = $('implementation-lines');
    svg.replaceChildren();
    if (!data || $('implementation-view').hidden || mobile.matches) return;
    const board = $('implementation-board').getBoundingClientRect();
    if (!board.width) return;
    svg.setAttribute('viewBox', `0 0 ${board.width} ${board.height}`);
    const pairs = active ? pairsFor(active) : data.steps.map(s => [s.id, s.id]);
    pairs.forEach(([left, right]) => {
      if (rows.get(left).hidden || rows.get(right).hidden) return;
      const a = cards.get(key('plain', left)).getBoundingClientRect();
      const b = cards.get(key('artifact', right)).getBoundingClientRect();
      const x1 = a.right - board.left, y1 = a.top - board.top + 42;
      const x2 = b.left - board.left, y2 = b.top - board.top + 42;
      const mid = (x1 + x2) / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`);
      path.setAttribute('class', `implementation-wire${active ? ' is-active' : ''}${left !== right ? ' is-dependency' : ''}`);
      svg.append(path);
      for (const [x,y] of [[x1,y1],[x2,y2]]) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', active ? '3' : '2');
        dot.setAttribute('class', active ? 'implementation-port is-active' : 'implementation-port'); svg.append(dot);
      }
      if (animate && active && !reduced.matches) {
        const length = path.getTotalLength();
        path.animate([{strokeDasharray:`${length} ${length}`,strokeDashoffset:active.side === 'plain' ? length : -length},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0}], {duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
      }
    });
  }
  function scheduleDraw() {
    cancelAnimationFrame(frame); frame = requestAnimationFrame(() => drawConnections());
  }
  function trace(origin, announce = false) {
    if (!data) return;
    // A deliberate selection wins over pointer and keyboard previews.
    origin = pinned || origin;
    const changed = active?.id !== origin?.id || active?.side !== origin?.side;
    if (pinned && !changed && !announce) return;
    active = origin;
    const connected = new Set(pairsFor(origin).flatMap(([a,b]) => [key('plain',a),key('artifact',b)]));
    cards.forEach((node, id) => {
      node.classList.toggle('is-connected', connected.has(id));
      node.classList.toggle('is-origin', Boolean(origin && id === key(origin.side, origin.id)));
      node.querySelector('.implementation-title').setAttribute('aria-pressed', String(Boolean(pinned && id === key(pinned.side,pinned.id))));
    });
    indexes.forEach((node,id) => node.classList.toggle('is-traced', origin?.id === id));
    $('implementation-clear').hidden = !pinned;
    drawConnections(changed);
    if (announce && origin) {
      const labels = pairsFor(origin).map(([a,b]) => data.steps.find(s => s.id === (origin.side === 'plain' ? b : a)).number);
      $('implementation-status').textContent = `Step ${data.steps.find(s => s.id === origin.id).number}: linked ${origin.side === 'plain' ? 'implementation' : 'plain-English'} steps ${labels.join(', ')}. Highlights locked. Press Escape or Clear trace to release.`;
    } else if (announce) $('implementation-status').textContent = 'Trace cleared.';
  }
  function hold(side, id) {
    pinned = {side,id};
    trace(pinned, true);
  }
  function bindTrace(card, side, step) {
    card.addEventListener('click', event => {
      if (event.target.closest('button,a,pre,input,textarea,select,summary') || !window.getSelection()?.isCollapsed) return;
      hold(side,step.id);
    });
    card.addEventListener('pointerenter', event => {if (event.pointerType !== 'touch') trace({side,id:step.id});});
    card.addEventListener('pointerleave', () => {
      const focused = document.activeElement?.closest('.implementation-card');
      trace(focused ? {side:focused.dataset.side,id:focused.dataset.step} : pinned);
    });
    card.addEventListener('focusin', () => trace({side,id:step.id}));
    card.addEventListener('focusout', event => {
      if (card.contains(event.relatedTarget)) return;
      const next = event.relatedTarget?.closest('.implementation-card');
      trace(next ? {side:next.dataset.side,id:next.dataset.step} : pinned);
    });
  }
  async function copy(step, control, code) {
    try {
      await navigator.clipboard.writeText(step.code);
      control.textContent = 'Copied';
      $('implementation-status').textContent = `${step.artifact} copied.`;
      setTimeout(() => {control.textContent = 'Copy';}, 1800);
    } catch {
      const range = document.createRange(); range.selectNodeContents(code);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      code.parentElement.focus({preventScroll:true});
      $('implementation-status').textContent = 'Clipboard unavailable. Text selected; use your system copy command.';
    }
  }
  function createCard(step, side) {
    const card = make('article', undefined, `implementation-card ${side}-card`);
    card.id = `build-${side}-${step.id}`; card.dataset.side = side; card.dataset.step = step.id;
    const heading = make('h3');
    const title = button('', () => hold(side,step.id), 'implementation-title');
    title.setAttribute('aria-pressed','false');
    title.append(make('span',String(step.number).padStart(2,'0'),'implementation-number'),make('span',side === 'plain' ? step.title : step.artifact));
    heading.append(title); card.append(heading);
    if (side === 'plain') {
      card.append(make('p',step.plain,'implementation-explanation'));
      const check = make('div',undefined,'implementation-check');
      check.append(make('span','CHECKPOINT'),make('p',step.check)); card.append(check);
      const evidence = make('div',undefined,'implementation-evidence');
      evidence.append(make('span','EVIDENCE'));
      step.source_ids.forEach(id => {
        const source = sources.get(id); if (!source) return;
        evidence.append(button(source.shortTitle || source.title,() => send('ead:source',id)));
      });
      card.append(evidence);
      if (step.id === 'synthetic-practice') {
        const download = make('a','Download 60 practice cases ↓','implementation-fixtures');
        download.href = './data/practice-scenarios.jsonl'; download.download = 'leo-practice-scenarios.jsonl';
        card.append(download,make('p','JSONL fixtures; report references use paths from the research workspace.','implementation-relations'));
      }
    } else {
      const tools = make('div',undefined,'implementation-code-tools');
      const label = step.kind === 'PSEUDOCODE' ? 'ILLUSTRATIVE PSEUDOCODE' : step.kind === 'CONFIG' ? 'PROPOSED CONFIGURATION' : step.kind === 'PROMPT' ? 'PROMPT TEMPLATE' : 'EXPERIMENT PROTOCOL';
      const pre = make('pre'), code = make('code',step.code);
      pre.tabIndex = 0; pre.setAttribute('aria-label',step.artifact); pre.append(code);
      const control = button('Copy',() => copy(step,control,code),'implementation-copy');
      control.setAttribute('aria-label',`Copy ${step.artifact}`);
      tools.append(make('span',label),control); card.append(tools,pre,make('p',step.notes,'implementation-note'));
    }
    const relationIds = side === 'plain' ? targets(step) : data.steps.filter(s=>targets(s).includes(step.id)).map(s=>s.id);
    const relationText = relationIds.map(id=>data.steps.find(s=>s.id===id).number).join(', ');
    const hint = make('p',`Linked ${side === 'plain' ? 'implementation' : 'plain-English'} steps: ${relationText}.`,'implementation-relations');
    card.append(hint); bindTrace(card,side,step); cards.set(key(side,step.id),card); return card;
  }
  function filter() {
    if (!data) return;
    pinned = null;
    let count = 0;
    data.steps.forEach(step => {
      const text = normalize([step.title,step.plain,step.check,step.code,step.notes,step.artifact,...step.source_ids.map(id=>sources.get(id)?.title)].join(' '));
      const shown = query.split(/\s+/).filter(Boolean).every(word=>text.includes(word));
      rows.get(step.id).hidden = !shown; indexes.get(step.id).hidden = !shown;
      if (shown) count++;
    });
    $('implementation-count').textContent = `${count} / ${data.steps.length} steps`;
    $('implementation-empty').hidden = count > 0;
    $('implementation-status').textContent = query ? `${count} matching steps. Clear search to restore all dependencies.` : '';
    trace(null); scheduleDraw();
  }
  function download() {
    if (!data) return;
    const lines = ['# Low Exposure Oracle — Implementation guide','',data.subtitle,'','Proposed guide. Synthetic workflows; no model or security validation.',''];
    data.steps.forEach(step => {
      lines.push(`## ${step.number}. ${step.title}`,'',step.plain,'',`Checkpoint: ${step.check}`,'',`### ${step.artifact} (${step.kind})`,'','```'+(step.kind === 'CONFIG' ? 'json' : 'text'),step.code,'```','',step.notes,'','Evidence:');
      step.source_ids.forEach(id=>{const s=sources.get(id);if(s)lines.push(`- ${s.title}: ${s.url}`);}); lines.push('');
    });
    const url = URL.createObjectURL(new Blob([lines.join('\n')], {type:'text/markdown;charset=utf-8'}));
    const a = make('a'); a.href = url; a.download = 'leo-implementation-guide.md'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  document.addEventListener('ead:ready',event=>{sources=new Map(event.detail.catalogue.entries.map(s=>[s.id,s]));},{once:true});
  document.addEventListener('ead:implementation-data',event=>{
    data=event.detail;
    data.steps.forEach(step=>{
      const row=make('div',undefined,'implementation-row');row.append(createCard(step,'plain'),createCard(step,'artifact'));
      rows.set(step.id,row);$('implementation-rows').append(row);
      const index=button('',()=>{
        pinned={side:'plain',id:step.id};trace(pinned,true);
        const card=cards.get(key('plain',step.id));card.scrollIntoView({block:'start',behavior:reduced.matches?'auto':'smooth'});
        card.querySelector('.implementation-title').focus({preventScroll:true});
      });
      index.append(make('span',String(step.number).padStart(2,'0')),make('span',step.label || step.title));
      index.setAttribute('aria-label',`Step ${step.number}: ${step.title}`);
      indexes.set(step.id,index);$('implementation-index').append(index);
    });
    $('implementation-clear').addEventListener('click',()=>{pinned=null;$('implementation-download').focus({preventScroll:true});trace(null,true);});
    $('implementation-download').addEventListener('click',download);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!$('implementation-view').hidden&&!document.querySelector('dialog[open]')){pinned=null;trace(null,true);}
    });
    new ResizeObserver(scheduleDraw).observe($('implementation-board'));
    filter();
  },{once:true});
  document.addEventListener('ead:implementation-query',event=>{
    const next=normalize(event.detail).trim();if(next===query)return;query=next;filter();
  });
  document.addEventListener('ead:view',event=>{if(event.detail==='implementation')scheduleDraw();});
  mobile.addEventListener('change',scheduleDraw); reduced.addEventListener('change',()=>{ $('implementation-lines').getAnimations({subtree:true}).forEach(a=>a.finish()); });
})();
