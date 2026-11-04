export const REVISION_ACTIONS = new Set(['create', 'expand', 'revise', 'revert', 'organize']);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const titleFromId = id => String(id || '').replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
export const stamp = value => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
export const number = value => Number(value || 0).toLocaleString('en-US');
export function dateText(value, compact = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', month:compact?'short':'long', day:'numeric', year:'numeric', ...(compact?{}:{hour:'numeric', minute:'2-digit', timeZoneName:'short'})}).format(date);
}
export function dayKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(value));
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function pacificDayEnd(value) {
  const desired = Date.parse(`${value}T23:59:59Z`);
  let result = desired + 8 * 3600000;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).formatToParts(new Date(result));
    const get = type => parts.find(part => part.type === type)?.value;
    const represented = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    result += desired - represented;
  }
  return result;
}
export function href(params = {}, route = '/wiki/') {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  return route + (query.size ? `?${query}` : '');
}
export function articleLink(id, label, at) { return `<a href="${esc(href({article:id, at}))}">${esc(label || titleFromId(id))}</a>`; }
export function userLink(id, at) { return `<a href="${esc(href({view:'user', user:id, at}))}">${esc(id || 'Unknown user')}</a>`; }
export function linksIn(body) {
  return [...new Set([...String(body || '').matchAll(/\[\[([^\]|\n]+)(?:\|[^\]\n]*)?\]\]/g)].map(match => match[1].trim()))];
}
export function wordCount(body) {
  return (String(body || '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id, label) => label || titleFromId(id)).replace(/[#*]/g, '').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
}
export function headingsIn(body) {
  return String(body || '').split('\n').filter(line => /^##\s+/.test(line)).map((line, index) => ({text:line.replace(/^##\s+/, '').trim(), id:`section-${index + 1}`}));
}
export function inline(text, articles = new Map(), at, depth = 0) {
  let out = '', position = 0;
  const pattern = /\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]|\*\*([^*]+)\*\*/g;
  for (const match of String(text).matchAll(pattern)) {
    out += esc(String(text).slice(position, match.index));
    if (match[3] !== undefined) out += `<strong>${depth ? esc(match[3]) : inline(match[3], articles, at, 1)}</strong>`;
    else {
      const id = match[1].trim(), article = articles.get(id);
      out += `<a${article ? '' : ' class="missing-link" title="This article did not exist at this point in the history"'} href="${esc(href({article:id, at}))}">${esc(match[2] || article?.title || titleFromId(id))}</a>`;
    }
    position = match.index + match[0].length;
  }
  return out + esc(String(text).slice(position));
}
export function markup(body, articles = new Map(), at) {
  let out = '', paragraph = [], list = [], heading = 0;
  const flushParagraph = () => { if (paragraph.length) out += `<p>${inline(paragraph.join(' '), articles, at)}</p>`; paragraph = []; };
  const flushList = () => { if (list.length) out += `<ul>${list.map(item => `<li>${inline(item, articles, at)}</li>`).join('')}</ul>`; list = []; };
  for (const line of String(body || '').replace(/\r/g, '').split('\n')) {
    if (/^##\s+/.test(line)) { flushParagraph(); flushList(); out += `<h2 id="section-${++heading}">${inline(line.replace(/^##\s+/, ''), articles, at)}</h2>`; }
    else if (/^-\s+/.test(line)) { flushParagraph(); list.push(line.replace(/^-\s+/, '')); }
    else if (!line.trim()) { flushParagraph(); flushList(); }
    else { flushList(); paragraph.push(line.trim()); }
  }
  flushParagraph(); flushList();
  return out;
}
export function snapshot(data, cutoff = data.meta.latestCompletedAt) {
  const time = Math.min(stamp(cutoff), stamp(data.meta.latestCompletedAt));
  const events = (data.events || []).filter(event => stamp(event.timestamp) <= time).sort((a,b) => stamp(a.timestamp)-stamp(b.timestamp) || a.id.localeCompare(b.id));
  const editors = (data.editors || []).filter(editor => stamp(editor.joinedAt) <= time);
  const articles = new Map(), revisionCounts = new Map(), contributions = new Map();
  for (const event of events) {
    if (event.action !== 'join') contributions.set(event.editorId, (contributions.get(event.editorId) || 0) + 1);
    if (event.articleId && REVISION_ACTIONS.has(event.action) && typeof event.body === 'string') {
      const previous = articles.get(event.articleId);
      articles.set(event.articleId, {id:event.articleId, title:event.title || previous?.title || titleFromId(event.articleId), body:event.body, categories:event.categories || previous?.categories || [], principleIds:event.principleIds || previous?.principleIds || [], createdAt:previous?.createdAt || event.timestamp, updatedAt:event.timestamp, editorId:event.editorId, revisionId:event.revisionId || event.id, eventId:event.id});
      revisionCounts.set(event.articleId, (revisionCounts.get(event.articleId) || 0) + 1);
    }
  }
  const links = [], backlinks = new Map();
  for (const article of articles.values()) {
    article.words = wordCount(article.body);
    article.revisions = revisionCounts.get(article.id) || 0;
    for (const target of linksIn(article.body)) if (target !== article.id && articles.has(target)) {
      links.push({source:article.id, target});
      if (!backlinks.has(target)) backlinks.set(target, []);
      backlinks.get(target).push(article.id);
    }
  }
  const relationships = new Map();
  for (const relationship of data.relationships || []) if (stamp(relationship.timestamp) <= time && editors.some(e=>e.id===relationship.from) && editors.some(e=>e.id===relationship.to)) relationships.set(`${relationship.from}\0${relationship.to}`, relationship);
  return {time, events, editors, articles, links, backlinks, revisionCounts, contributions,
    cycles:(data.cycles || []).filter(cycle => stamp(cycle.endAt) <= time),
    relationships:[...relationships.values()],
    journals:(data.journals || []).filter(journal => stamp(journal.releasedAt) <= time),
    words:[...articles.values()].reduce((total, article) => total + article.words, 0),
    revisions:events.filter(event => event.articleId && REVISION_ACTIONS.has(event.action)).length,
    discussions:events.filter(event => event.action === 'comment' || event.action === 'policy').length,
    reversions:events.filter(event => event.action === 'revert').length};
}
export function lineDiff(before, after) {
  const left = String(before || '').split('\n'), right = String(after || '').split('\n');
  const rows = Array.from({length:left.length+1}, () => new Uint16Array(right.length+1));
  for (let i=left.length-1;i>=0;i--) for(let j=right.length-1;j>=0;j--) rows[i][j] = left[i]===right[j] ? rows[i+1][j+1]+1 : Math.max(rows[i+1][j], rows[i][j+1]);
  const result = []; let i=0,j=0;
  while(i<left.length || j<right.length) {
    if(i<left.length && j<right.length && left[i]===right[j]) { result.push({type:'same', text:left[i], oldLine:i+1,newLine:j+1});i++;j++; }
    else if(j<right.length && (i===left.length || rows[i][j+1] >= rows[i+1][j])) {result.push({type:'add',text:right[j],oldLine:null,newLine:j+1});j++;}
    else {result.push({type:'remove',text:left[i],oldLine:i+1,newLine:null});i++;}
  }
  return result;
}
export function attributedLines(revisions) {
  let lines = [];
  for (const revision of revisions) {
    const before = lines.map(line => line.text).join('\n');
    lines = lines.length
      ? lineDiff(before, revision.body).flatMap(line => {
          if (line.type === 'remove') return [];
          if (line.type === 'same') return [lines[line.oldLine - 1]];
          return [{text: line.text, revision}];
        })
      : revision.body.split('\n').map(text => ({text, revision}));
  }
  return lines;
}
export function stablePositions(items) {
  const map = new Map();
  items.forEach((item,index) => { const angle=index*2.399963229728653, radius=index ? 70*Math.sqrt(index) : 0; map.set(item.id,{x:500+Math.cos(angle)*radius,y:350+Math.sin(angle)*radius}); });
  return map;
}
export function safeSessionGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
export function safeSessionSet(key, value) { try { sessionStorage.setItem(key,value); } catch { /* browsing still works without storage */ } }
export async function loadData() {
  const response = await fetch('/wiki-assets/data.json', {cache:'no-cache'});
  if (!response.ok) throw new Error(`The encyclopedia could not be loaded (${response.status}).`);
  const data = await response.json();
  if (data.schemaVersion !== 1 || !data.meta || !Array.isArray(data.events) || !Array.isArray(data.editors)) throw new Error('The encyclopedia data is not available in a supported format.');
  return data;
}
export function installGate(kind, onUnlock) {
  const gate=document.getElementById('entry-gate'), workspace=document.getElementById('wiki-workspace'), form=document.getElementById('entry-form'), input=document.getElementById('entry-answer'), message=document.getElementById('entry-message');
  const key=`human-condition.${kind}.unlocked.v2`;
  let opened=false;
  async function open(fresh) {
    if(opened) return;
    opened=true; gate.hidden=true; workspace.hidden=false; workspace.removeAttribute('inert');
    try { await onUnlock(fresh); }
    catch(error) { const target=document.getElementById('load-status');target.hidden=false;target.setAttribute('role','alert');target.innerHTML=`<p>${esc(error.message)}</p><p><button type="button" id="retry-load">Try again</button></p>`;target.querySelector('button').addEventListener('click',()=>location.reload()); }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if(input.value.trim().toUpperCase() !== (kind==='map'?'LEGEND':'GUTTER')) { message.textContent='Not quite. Try another word.';input.setAttribute('aria-invalid','true');input.focus();input.select();return; }
    input.removeAttribute('aria-invalid');message.textContent='';safeSessionSet(key,'yes');open(true);
  });
  input.addEventListener('input',()=>{input.removeAttribute('aria-invalid');message.textContent='';});
  if(safeSessionGet(key)==='yes') open(false);
}
