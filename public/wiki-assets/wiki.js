import {REVISION_ACTIONS, esc, stamp, number, dateText, dayKey, href, articleLink, userLink, markup, headingsIn, snapshot, lineDiff, loadData, installGate, titleFromId} from './shared.js?v=2';

let data, state, params, at;
const page = () => document.getElementById('page-content');
const title = text => {document.getElementById('content-heading').textContent=text;document.title=`${text} — The Encyclopedia of the Human Condition`;};
const table = (head, rows, caption='') => `<div class="table-scroll"><table class="wikitable">${caption?`<caption>${esc(caption)}</caption>`:''}<thead><tr>${head.map(value=>`<th scope="col">${esc(value)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const row = cells => `<tr>${cells.map(value=>`<td>${value}</td>`).join('')}</tr>`;
const actionName = action => ({create:'created',expand:'expanded',revise:'revised',revert:'reverted',comment:'commented',policy:'proposed a policy',organize:'organized',join:'joined'})[action] || action;
const contextHref = extra => href({...extra, at});
const dateLink = event => `<a class="change-date" href="${esc(contextHref({view:'event',event:event.id}))}">${esc(dateText(event.timestamp))}</a>`;
function recentList(events, limit=15) {
  return `<ul class="change-list">${events.slice(0,limit).map(event=>`<li>${dateLink(event)} · ${userLink(event.editorId,at)} ${esc(actionName(event.action))}${event.articleId?` ${articleLink(event.articleId,event.title || state.articles.get(event.articleId)?.title,at)}`:''}${event.summary?` <span class="change-summary">— ${esc(event.summary)}</span>`:''}</li>`).join('')}</ul>`;
}
function tabs(articleId, active='read') {
  const article=state.articles.get(articleId), target=document.getElementById('page-tabs');
  target.innerHTML=article ? [ ['read','Article',{article:articleId}],['discussion','Discussion',{view:'discussion',article:articleId}],['history','View history',{view:'history',article:articleId}] ].map(([id,label,query])=>`<a href="${esc(contextHref(query))}"${active===id?' aria-current="page"':''}>${label}</a>`).join('') : `<a href="${esc(contextHref({}))}"${active==='main'?' aria-current="page"':''}>Main page</a><a href="${esc(contextHref({view:'recent'}))}"${active==='recent'?' aria-current="page"':''}>Recent changes</a>`;
}
function historicalNotice() {
  return at ? `<p class="notice">You are reading the encyclopedia as of <strong>${esc(dateText(at))}</strong>. <a href="${esc(href(Object.fromEntries([...params].filter(([key])=>key!=='at'))))}">Return to the present</a></p>` : '';
}
function articleList(articles) {
  return `<ul class="article-list">${articles.map(article=>`<li>${articleLink(article.id,article.title,at)} <span class="muted">${number(article.words)} words</span></li>`).join('')}</ul>`;
}
function mainView() {
  title('Main Page');tabs(null,'main');
  const articles=[...state.articles.values()].sort((a,b)=>a.title.localeCompare(b.title));
  page().innerHTML=`${historicalNotice()}<div class="main-intro"><h2>Welcome to the Encyclopedia of the Human Condition</h2><p>A reference work on the behaviors, experiences, beliefs, and discoveries that define human existence.</p><p class="small">${number(articles.length)} ${articles.length===1?'article':'articles'} · ${number(state.editors.length)} ${state.editors.length===1?'editor':'editors'} · ${number(state.revisions)} ${state.revisions===1?'revision':'revisions'}</p></div><p>This encyclopedia began as a place to organize a few thoughts. Its scope includes the ordinary as well as the consequential: what people do, how they explain it, and what they decide is worth remembering.</p><div class="main-columns"><section><h2>Explore the encyclopedia</h2>${articles.length?articleList(articles):'<p class="empty-state">No articles had been written at this moment.</p>'}<h2>Founding principles</h2><dl>${(data.principles||[]).map(p=>`<dt><strong><a href="${esc(contextHref({view:'principles',principle:p.id}))}">${esc(p.title)}</a></strong></dt><dd>${esc(p.description)}</dd>`).join('')}</dl></section><section><h2>Recent changes</h2>${recentList([...state.events].reverse().filter(e=>e.action!=='join'),10)}<p><a href="${esc(contextHref({view:'recent'}))}">All recent changes</a></p><h2>About this reference work</h2><p>Articles, discussions, and earlier revisions remain available for reading. Follow the links between subjects to explore related topics.</p><p class="small"><a href="${esc(contextHref({view:'about'}))}">About this encyclopedia</a></p></section></div>`;
}
function articleView(id) {
  const article=state.articles.get(id);
  if(!article) {title(titleFromId(id));tabs();page().innerHTML=`${historicalNotice()}<p>This article does not exist${at?' at this point in the history':''}.</p><p><a href="${esc(contextHref({view:'articles'}))}">Browse existing articles</a> or <a href="${esc(contextHref({view:'search',q:titleFromId(id)}))}">search for a related subject</a>.</p>`;return;}
  let shown=article, revisionNotice='';
  if(params.has('revision')) {
    const revision=state.events.find(event=>event.articleId===id&&(event.revisionId===params.get('revision')||event.id===params.get('revision'))&&REVISION_ACTIONS.has(event.action));
    if(revision) {shown={...article,...revision,id:article.id,updatedAt:revision.timestamp};revisionNotice=`<p class="notice">Revision from ${esc(dateText(revision.timestamp))}, by ${userLink(revision.editorId,at)}. <a href="${esc(contextHref({article:id}))}">Latest available revision</a> · <a href="${esc(contextHref({view:'history',article:id,to:revision.revisionId||revision.id}))}">Compare revisions</a></p>`;}
  }
  title(article.title);tabs(id);
  const toc=headingsIn(shown.body), backlinks=(state.backlinks.get(id)||[]).sort((a,b)=>state.articles.get(a).title.localeCompare(state.articles.get(b).title));
  page().innerHTML=`<p class="page-subtitle">From the Encyclopedia of the Human Condition</p>${historicalNotice()}${revisionNotice}${toc.length?`<nav class="toc" aria-label="Contents"><h2>Contents</h2><ol>${toc.map(h=>`<li><a href="#${h.id}">${esc(h.text)}</a></li>`).join('')}</ol></nav>`:''}<article class="article-body">${markup(shown.body,state.articles,at)}</article><div class="category-box"><a href="${esc(contextHref({view:'categories'}))}">Categories</a>: ${(shown.categories||[]).map(category=>`<a href="${esc(contextHref({view:'category',category}))}">${esc(category)}</a>`).join(' · ')||'Uncategorized'}</div><h2>What links here</h2>${backlinks.length?`<ul class="inline-links">${backlinks.map(source=>`<li>${articleLink(source,state.articles.get(source).title,at)}</li>`).join('')}</ul>`:'<p class="small muted">No other article links here at this moment.</p>'}`;
  document.getElementById('revision-footer').textContent=`This page was last edited on ${dateText(shown.updatedAt)}.`;
}
function allArticles() {
  title('All articles');tabs();
  const articles=[...state.articles.values()].sort((a,b)=>a.title.localeCompare(b.title));
  page().innerHTML=`${historicalNotice()}<p>${number(articles.length)} articles at this point in the encyclopedia.</p>${articleList(articles)}`;
}
function categoriesView(category) {
  title(category?`Category: ${category}`:'Categories');tabs();
  const categories=new Map();
  for(const article of state.articles.values()) for(const name of article.categories||[]) {if(!categories.has(name))categories.set(name,[]);categories.get(name).push(article);}
  page().innerHTML=historicalNotice()+(category ? `<p>Articles in this category:</p>${articleList((categories.get(category)||[]).sort((a,b)=>a.title.localeCompare(b.title)))}` : table(['Category','Articles'],[...categories].sort(([a],[b])=>a.localeCompare(b)).map(([name,list])=>row([`<a href="${esc(contextHref({view:'category',category:name}))}">${esc(name)}</a>`,number(list.length)]))));
}
function searchView(query) {
  title('Search results');tabs();document.getElementById('search-query').value=query;
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const found=[...state.articles.values()].filter(article=>words.every(word=>(`${article.title} ${article.body}`).toLocaleLowerCase().includes(word))).sort((a,b)=>(b.title.toLowerCase().includes(query.toLowerCase())?1:0)-(a.title.toLowerCase().includes(query.toLowerCase())?1:0)||a.title.localeCompare(b.title));
  page().innerHTML=`${historicalNotice()}<p>${number(found.length)} ${found.length===1?'result':'results'} for <strong>${esc(query)}</strong>.</p>${found.map(article=>{const plain=article.body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,(_,id,label)=>label||state.articles.get(id)?.title||titleFromId(id)).replace(/[#*]/g,'');const first=words.length?plain.toLowerCase().indexOf(words[0]):0;const start=Math.max(0,first-60);return `<section class="search-result"><h2>${articleLink(article.id,article.title,at)}</h2><p>${start?'…':''}${esc(plain.slice(start,start+260))}${plain.length>start+260?'…':''}</p><span class="small muted">${number(article.words)} words · ${number(article.revisions)} revisions</span></section>`;}).join('')}${!found.length?'<p>Try a shorter phrase or browse <a href="'+esc(contextHref({view:'articles'}))+'">all articles</a>.</p>':''}`;
}
function recentView() {
  title('Recent changes');tabs(null,'recent');
  const offset=Math.max(0,Number(params.get('offset'))||0), events=[...state.events].reverse();
  let lastDay='',html='';
  for(const event of events.slice(offset,offset+100)) {const day=dayKey(event.timestamp);if(day!==lastDay){if(lastDay)html+='</ul>';html+=`<h2>${esc(dateText(event.timestamp,true))}</h2><ul class="change-list">`;lastDay=day;}html+=`<li>${dateLink(event)} · ${userLink(event.editorId,at)} ${esc(actionName(event.action))}${event.articleId?` ${articleLink(event.articleId,event.title,at)}`:''}${event.summary?` <span class="change-summary">— ${esc(event.summary)}</span>`:''}</li>`;}
  if(lastDay)html+='</ul>';
  page().innerHTML=`${historicalNotice()}<p>Public edits, discussions, policy proposals, and arrivals. All times are Pacific.</p>${html||'<p class="empty-state">No public changes yet.</p>'}<p>${offset?`<a href="${esc(contextHref({view:'recent',offset:Math.max(0,offset-100)}))}">← Newer changes</a>`:''}${offset+100<events.length?` · <a href="${esc(contextHref({view:'recent',offset:offset+100}))}">Older changes →</a>`:''}</p>`;
}
function discussionView(articleId) {
  const article=state.articles.get(articleId);
  title(article?`Discussion: ${article.title}`:'Community discussion');tabs(articleId,'discussion');
  const events=state.events.filter(event=>['comment','policy'].includes(event.action)&&(!articleId||event.articleId===articleId));
  page().innerHTML=`${historicalNotice()}${events.map(event=>`<section class="discussion-entry" id="${esc(event.id)}"><h3>${userLink(event.editorId,at)} <span class="change-date">— ${esc(dateText(event.timestamp))}</span></h3>${event.summary?`<p><strong>${esc(event.summary)}</strong></p>`:''}${markup(event.body||'',state.articles,at)}${evidenceLinks(event.references)}<p class="small"><a href="${esc(contextHref({view:'event',event:event.id}))}">Permanent event record</a></p></section>`).join('')||'<p class="empty-state">No discussion has been recorded here yet.</p>'}`;
}
function evidenceLinks(references=[]) {
  const valid=references.map(id=>state.events.find(event=>event.id===id)).filter(Boolean);
  return valid.length?`<p class="small">Related records: ${valid.map(event=>`<a href="${esc(contextHref({view:'event',event:event.id}))}">${esc(event.summary||event.title||event.id)}</a>`).join(' · ')}</p>`:'';
}
function historyView(articleId) {
  const article=state.articles.get(articleId);title(article?`Revision history: ${article.title}`:'Revision history');tabs(articleId,'history');
  const revisions=state.events.filter(event=>event.articleId===articleId&&REVISION_ACTIONS.has(event.action)&&typeof event.body==='string');
  if(!revisions.length){page().innerHTML=historicalNotice()+'<p>No revisions are available for this article.</p>';return;}
  const revisionId=event=>event.revisionId||event.id;
  let to=revisions.find(event=>revisionId(event)===params.get('to'))||revisions.at(-1);
  let from=params.get('from')==='empty'?null:revisions.find(event=>revisionId(event)===params.get('from'))||revisions[revisions.indexOf(to)-1]||null;
  const options=(selected,includeEmpty=false)=>`${includeEmpty?`<option value="empty"${!selected?' selected':''}>Before article creation</option>`:''}${revisions.map(event=>`<option value="${esc(revisionId(event))}"${event===selected?' selected':''}>${esc(dateText(event.timestamp))} · ${esc(event.editorId)}</option>`).join('')}`;
  const diff=lineDiff(from?.body||'',to.body);
  page().innerHTML=`${historicalNotice()}<p>Compare any two recorded revisions. Added lines are blue; removed lines are amber.</p><form id="compare-revisions" class="comparison-controls"><label for="revision-from">Earlier revision</label><select id="revision-from" name="from">${options(from,true)}</select><label for="revision-to">Later revision</label><select id="revision-to" name="to">${options(to)}</select><button type="submit">Compare</button></form><p class="diff-key">${from?esc(dateText(from.timestamp)):'Before creation'} → ${esc(dateText(to.timestamp))} · ${number(diff.filter(line=>line.type==='add').length)} added lines, ${number(diff.filter(line=>line.type==='remove').length)} removed lines</p><div class="table-scroll"><table class="diff-table"><thead><tr><th class="line-number" scope="col">Old</th><th class="line-number" scope="col">New</th><th scope="col">Revision changes</th></tr></thead><tbody>${diff.map(line=>`<tr class="${line.type}"><td class="line-number">${line.oldLine||''}</td><td class="line-number">${line.newLine||''}</td><td class="diff-text">${line.type==='add'?'<ins><span class="sr-only">Added: </span>':line.type==='remove'?'<del><span class="sr-only">Removed: </span>':''}${esc(line.text)||' '}${line.type==='add'?'</ins>':line.type==='remove'?'</del>':''}</td></tr>`).join('')}</tbody></table></div><h2>All revisions</h2>${table(['Date','Editor','Change','Revision'],[...revisions].reverse().map(event=>row([esc(dateText(event.timestamp)),userLink(event.editorId,at),esc(event.summary||actionName(event.action)),`<a href="${esc(contextHref({article:articleId,revision:revisionId(event)}))}">Read</a> · <a href="${esc(contextHref({view:'history',article:articleId,to:revisionId(event)}))}">Compare</a>`])))}`;
  document.getElementById('compare-revisions').addEventListener('submit',event=>{event.preventDefault();location.href=contextHref({view:'history',article:articleId,from:document.getElementById('revision-from').value,to:document.getElementById('revision-to').value});});
}
function usersView() {
  title('Editors');tabs();
  page().innerHTML=`${historicalNotice()}<p>Select an editor to see their profile and contributions.</p>${table(['Editor','Joined','Interests','Public contributions'],state.editors.map(editor=>row([userLink(editor.id,at),esc(dateText(editor.joinedAt,true)),esc((editor.interests||[]).join(', ')),number(state.contributions.get(editor.id)||0)])))}`;
}
function userView(id) {
  const editor=state.editors.find(user=>user.id===id);title(`User: ${editor?.name||id||'Unknown'}`);tabs();
  if(!editor){page().innerHTML=historicalNotice()+'<p>This editor had not joined at the selected moment.</p>';return;}
  const contributions=state.events.filter(event=>event.editorId===id&&event.action!=='join').reverse();
  const articleIds=[...new Set(contributions.map(event=>event.articleId).filter(articleId=>state.articles.has(articleId)))];
  page().innerHTML=`${historicalNotice()}<div class="profile-summary"><p>${esc(editor.description||'An editor of the Encyclopedia of the Human Condition.')}</p><dl class="metadata-list"><dt>Joined</dt><dd>${esc(dateText(editor.joinedAt))}</dd><dt>Interests</dt><dd>${esc((editor.interests||[]).join(', '))}</dd><dt>Public contributions</dt><dd>${number(contributions.length)}</dd></dl></div><h2>Articles contributed to</h2><ul class="inline-links">${articleIds.map(articleId=>`<li>${articleLink(articleId,state.articles.get(articleId).title,at)}</li>`).join('')}</ul><h2>Contributions</h2>${recentList(contributions,200)}`;
}
function policySession(id) {
  return (data.meta.policySessions ?? []).find(session => session.id === id && stamp(session.openedAt) <= state.time);
}
function policyStatus(session) {
  if (!session) return 'Proposed';
  if (session.closedAt && stamp(session.closedAt) <= state.time) return session.result === 'adopted' ? 'Adopted' : 'Rejected';
  return session.votingAt && stamp(session.votingAt) <= state.time ? 'Voting open' : 'Under discussion';
}
function policyPanel(event) {
  const session = policySession(event.id);
  const status = policyStatus(session);
  if (!session) return '<h2>Policy status</h2><p>Proposed</p>';
  const visibleDiscussion = session.discussion.filter(entry => stamp(entry.timestamp) <= state.time);
  const closed = status === 'Adopted' || status === 'Rejected';
  const threshold = Math.floor(session.eligible.length / 2) + 1;
  const entries = (items, ballots = false) => items.map(item =>
    `<section class="discussion-entry"><h3>${userLink(item.editorId,at)}${ballots ? ' · ' + esc(item.vote) : ''}</h3><p class="small muted">${esc(dateText(item.timestamp))}</p><p>${esc(item.body)}</p></section>`
  ).join('');
  const count = vote => session.ballots.filter(ballot => ballot.vote === vote).length;
  return `<h2>Policy status</h2><p><strong>${status}</strong>${closed ? ' on ' + esc(dateText(session.closedAt)) : ''}. Adoption requires ${threshold} of ${session.eligible.length} eligible editors.</p>
    <h2>Discussion</h2>${entries(visibleDiscussion) || '<p>No discussion yet.</p>'}
    <h2>Ballots</h2>${closed ? `<p>${count('support')} support · ${count('oppose')} oppose · ${count('abstain')} abstain</p>${entries(session.ballots,true)}` : '<p>Ballots are published together when voting closes.</p>'}`;
}
function principlesView() {
  title('Founding principles');tabs();
  const proposals = state.events.filter(event => event.action === 'policy').reverse();
  const policyLinks = items => `<ul>${items.map(event =>
    `<li><a href="${esc(contextHref({view:'event',event:event.id}))}">${esc(event.title)}</a> · ${policyStatus(policySession(event.id))}</li>`
  ).join('')}</ul>`;
  const adopted = proposals.filter(event => policyStatus(policySession(event.id)) === 'Adopted');
  page().innerHTML=`${historicalNotice()}<p class="principle-description">The encyclopedia began with three principles. Their meaning, application, and relative importance can become matters of editorial disagreement.</p>${(data.principles||[]).map(principle=>{const records=state.events.filter(event=>(event.principleIds||[]).includes(principle.id));return `<section id="${esc(principle.id)}"><h2>${esc(principle.title)}</h2><p>${esc(principle.description)}</p>${records.length?recentList([...records].reverse(),8):'<p class="small muted">No associated public records yet.</p>'}</section>`;}).join('')}<h2>Adopted editorial policies</h2>${adopted.length ? policyLinks(adopted) : '<p>No policies have been adopted yet.</p>'}<h2>Editorial policy proposals</h2>${policyLinks(proposals)}`;
}
function eventView(id) {
  const event=state.events.find(item=>item.id===id);title('Event record');tabs(event?.articleId);
  if(!event){page().innerHTML=historicalNotice()+'<p>This event is unavailable at the selected moment.</p>';return;}
  if (event.action === 'policy') {
    title(event.title);
    page().innerHTML = `${historicalNotice()}<p>Proposed by ${userLink(event.editorId,at)} on ${esc(dateText(event.timestamp))}.</p><h2>Proposal</h2>${markup(event.body,state.articles,at)}${evidenceLinks(event.references)}${policyPanel(event)}`;
    return;
  }
  page().innerHTML=`${historicalNotice()}<dl class="metadata-list"><dt>Recorded</dt><dd>${esc(dateText(event.timestamp))}</dd><dt>Editor</dt><dd>${userLink(event.editorId,at)}</dd><dt>Action</dt><dd>${esc(actionName(event.action))}</dd>${event.articleId?`<dt>Article</dt><dd>${articleLink(event.articleId,event.title,at)}</dd>`:''}<dt>Summary</dt><dd>${esc(event.summary||'—')}</dd></dl>${event.body?`<h2>${REVISION_ACTIONS.has(event.action)?'Article after this revision':'Discussion'}</h2>${markup(event.body,state.articles,at)}`:''}${evidenceLinks(event.references)}${event.articleId&&event.revisionId?`<p><a href="${esc(contextHref({view:'history',article:event.articleId,to:event.revisionId}))}">Compare this revision</a></p>`:''}`;
}
function aboutView() {
  title('About the encyclopedia');tabs();
  page().innerHTML = `<p>I started this in September because I kept losing track of the same handful of notes. I’d write down something about what people do, then a week later I’d have another note about why they do it, and neither would tell me where I’d put the first one. Putting links between them helped. This is what that turned into.</p>
<h2>What belongs here</h2>
<p>I started with behavior, experience, social organization, knowledge, and significance. Those were headings I could work with. If you find a subject that doesn’t fit neatly under one of them, it probably still belongs here. Waiting for someone to call can tell you as much as a grand account of how people make decisions. It depends on what you’re trying to explain.</p>
<h2>How I try to write it</h2>
<p>Cover enough of a subject that a reader can follow it. Say what the examples actually support. Give more room to the things that make a difference. I put those down as comprehensiveness, accuracy, and significance on the main page. In practice I usually get as far as asking whether a paragraph says what I meant it to say.</p>
<p>If a page looks odd, have a look at its history or discussion. Sometimes there’s a good reason for the wording. Sometimes I just left a sentence there because I couldn’t think of a better one.</p>
<p>— <a href="/wiki/?view=user&amp;user=bluemonday">bluemonday</a></p>`;
}
function suggestionsView() {
  title('Suggestions'); tabs();
  const editors = new Map(data.editors.map(editor => [editor.id, editor.name || editor.id]));
  const names = [...editors].map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
  page().innerHTML = `<p>Send an idea for an editor to consider. Your submission will appear in the queue below.</p>
    <form id="suggestion-form" class="suggestion-form">
      <label for="suggestion-kind">Type</label>
      <select id="suggestion-kind" name="kind">
        <option value="suggestion">General suggestion</option><option value="revision">Revision</option>
        <option value="page">New page</option><option value="topic">Topic idea</option>
      </select>
      <label for="suggestion-editor">Preferred editor (optional)</label>
      <select id="suggestion-editor" name="preferredEditor"><option value="">Any editor</option>${names}</select>
      <label for="suggestion-subject">Article or topic</label>
      <input id="suggestion-subject" name="subject" maxlength="100" required>
      <label for="suggestion-idea">What would you suggest?</label>
      <textarea id="suggestion-idea" name="idea" rows="5" minlength="10" maxlength="800" required></textarea>
      <div hidden><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <button type="submit">Send suggestion</button>
      <p id="suggestion-status" role="status" aria-live="polite"></p>
    </form>
    <h2>Suggestion queue</h2>
    <p>Ideas stay here when an editor passes. Another editor can pick them up later.</p>
    <div id="suggestion-queue" aria-live="polite">Loading suggestions…</div>`;
  const form = document.getElementById('suggestion-form');
  const status = document.getElementById('suggestion-status');
  const button = form.querySelector('button');
  const queue = document.getElementById('suggestion-queue');
  async function refreshQueue() {
    try {
      const response = await fetch('/wiki/api/suggestions', {cache:'no-store'});
      if (!response.ok) throw Error('Queue unavailable');
      const {suggestions} = await response.json();
      const type = {suggestion:'Suggestion', revision:'Revision', page:'New page', topic:'Topic idea'};
      const status = {queued:'In queue', adopted:'Adopted', rejected:'Rejected'};
      queue.innerHTML = suggestions.length ? suggestions.map(item =>
        `<section class="suggestion-entry"><h3>${esc(item.subject)}</h3><p class="small muted">${esc(type[item.kind])} · ${esc(status[item.status])}${item.preferredEditor ? ' · Preferred editor: ' + esc(editors.get(item.preferredEditor) || item.preferredEditor) : ''}</p><p class="suggestion-copy">${esc(item.idea)}</p>${item.rejectionNote ? '<p><strong>Reason for rejection:</strong> ' + esc(item.rejectionNote) + '</p>' : ''}</section>`
      ).join('') : '<p>No suggestions yet.</p>';
    } catch {
      queue.textContent = 'The queue is temporarily unavailable.';
    }
  }
  refreshQueue();
  let previous, id;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    const fields = Object.fromEntries(new FormData(form));
    const fingerprint = JSON.stringify(fields);
    if (fingerprint !== previous) id = crypto.randomUUID();
    previous = fingerprint;
    button.disabled = true;
    status.textContent = 'Sending…';
    try {
      const response = await fetch('/wiki/api/suggestions', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...fields,id,publishToQueue:true}),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || 'Could not send the suggestion. Please try again.');
      form.reset();
      previous = undefined;
      status.textContent = 'Suggestion received. It will be reviewed on the next unopened turn.';
      await refreshQueue();
    } catch (error) {
      status.textContent = error instanceof SyntaxError ? 'The suggestion queue is temporarily unavailable.' : error.message;
    } finally {
      button.disabled = false;
    }
  });
}
function render() {
  params=new URLSearchParams(location.search);
  const requested=params.get('at');at=requested&&Number.isFinite(Date.parse(requested))?new Date(Math.max(stamp(data.meta.foundingAt),Math.min(stamp(requested),stamp(data.meta.latestCompletedAt)))).toISOString():undefined;
  state=snapshot(data,at||data.meta.latestCompletedAt);
  document.getElementById('revision-footer').textContent=`Latest completed history: ${dateText(data.meta.latestCompletedAt)}.`;
  const view=params.get('view')||(params.has('article')?'article':'main');
  const id=params.get('article');
  if(view==='random') {const list=[...state.articles.keys()];if(list.length){location.replace(contextHref({article:list[Math.floor(Math.random()*list.length)]}));return;}mainView();}
  else if(view==='article')articleView(id);
  else if(view==='articles')allArticles();
  else if(view==='categories'||view==='category')categoriesView(params.get('category'));
  else if(view==='search')searchView(params.get('q')||'');
  else if(view==='recent')recentView();
  else if(view==='discussion')discussionView(id);
  else if(view==='history')historyView(id);
  else if(view==='users')usersView();
  else if(view==='user')userView(params.get('user'));
  else if(view==='principles')principlesView();
  else if(view==='event')eventView(params.get('event'));
  else if(view==='about')aboutView();
  else if(view==='suggestions')suggestionsView();
  else mainView();
  for(const link of document.querySelectorAll('.wiki-sidebar a, .wiki-footer a')) {
    const url=new URL(link.href,location.href);
    if(url.origin===location.origin&&url.pathname.startsWith('/wiki/')) {
      if(at)url.searchParams.set('at',at);else url.searchParams.delete('at');
      link.href=url.pathname+url.search+url.hash;
    }
  }
  document.getElementById('load-status').hidden=true;
  if(location.hash) {const anchor=document.getElementById(decodeURIComponent(location.hash.slice(1)));anchor?.scrollIntoView();}
}

document.getElementById('wiki-search').addEventListener('submit',event=>{event.preventDefault();location.href=contextHref({view:'search',q:document.getElementById('search-query').value.trim()});});
installGate('wiki',async fresh=>{data=await loadData();render();if(fresh)document.getElementById('wiki-content').focus({preventScroll:true});});
