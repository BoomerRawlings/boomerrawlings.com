import { presentation } from './presentation.js';
import {summarizeKF,filterKFPosts,metrics} from './kf-model.js';
import {kfDefaults,filterAccount,selectedKFMonth,toggleKFMonth,encodeKFRoute,decodeKFRoute} from './kf-state.js';
const colors=['#d0dd9c','#e8bb84','#91c1cb','#c4a5d6','#e4a3a3','#adb6c6'];
const nf=new Intl.NumberFormat('en'),num=n=>nf.format(n||0),pct=n=>`${(n*100).toFixed(1)}%`;
const e=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs={},text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!=null)n.textContent=text;return n;};
const rank=(rows,key)=>[...rows].sort((a,b)=>b[key]-a[key]||a.id.localeCompare(b.id));
const field=(title,input)=>{const n=e('label');n.append(e('span',title),input);return n;};
function select(values,label){const n=e('select');n.setAttribute('aria-label',label);for(const[v,t]of values)n.add(new Option(t,v));return n;}
function dateInput(label){const n=e('input');n.type='date';n.setAttribute('aria-label',label);return n;}
function sourceLink(post){const a=e('a',`Post #${post.number} · page ${post.page}`);try{const u=new URL(post.source.url);if(!['http:','https:'].includes(u.protocol))throw 0;u.hash=`post-${post.postId}`;a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';}catch{}return a;}

export async function mountKF(host,{api,onProfile}){
  host.replaceChildren(e('p','Opening the captured forum record…','kf-status'));
  let data;try{data=await api('kf');}catch(error){if(error.name==='AbortError')return;host.replaceChildren(e('h2','KF data could not be opened.'),e('p',error.message));return {destroy(){host.replaceChildren();}};}
  const state={...kfDefaults(),...decodeKFRoute(location.hash)};
  const subject=filterAccount(data);if(!subject)state.excludeSubject=false;let lastRoute=location.hash,restoring=false;const routeAbort=new AbortController();
  const listen=(n,event,fn)=>n.addEventListener(event,fn);
  const wrap=e('div',null,'kf-dashboard'),intro=e('div',null,'kf-intro');
  intro.append(e('p',presentation.text.text01,'eyebrow'),e('h1','KF threads','kf-title'),e('p','Posts, people, and the exchanges between them.','kf-deck'));
  const coverage=e('div',null,'kf-coverage');coverage.append(e('strong',num(data.coverage.pages.length)+' captured pages'),e('span',num(data.coverage.reviewedPages)+' source-reviewed · '+data.posts[0].at.slice(0,4)+'–'+data.posts.at(-1).at.slice(0,4)+' · UTC'));
  const controls=e('form',null,'kf-controls'),from=dateInput('From date, UTC'),to=dateInput('Through date, UTC'),threads=select([['','All captured threads'],...data.coverage.namespace.map(x=>[x,x])],'Thread'),reset=e('button','Reset filters');reset.type='button';
  from.min=to.min=data.posts[0]?.at.slice(0,10)||'';from.max=to.max=data.posts.at(-1)?.at.slice(0,10)||'';
  const exclude=e('button',presentation.text.text02,'kf-exclude');exclude.type='button';exclude.title=subject?presentation.text.text03:'The specified forum account is not in this snapshot';exclude.disabled=!subject;
  const scope=e('span',presentation.text.text04,'kf-filter-scope');
  controls.append(exclude,scope);
  controls.append(field('From · UTC',from),field('Through · UTC',to),field('Thread',threads),reset);listen(controls,'submit',ev=>ev.preventDefault());
  const notice=e('p',null,'kf-status');notice.setAttribute('role','status');
  const stats=e('div',null,'kf-stats'),leaderboards=e('section',null,'kf-leaderboards');leaderboards.setAttribute('aria-label','Four contribution leaderboards');
  const limit=select([[10,'Top 10'],[25,'Top 25'],[50,'Top 50']],'Leaderboard size'),leaderHead=e('div',null,'kf-section-head');leaderHead.append(e('h2','Rankings','kf-section-title'),limit);
  const trend=e('section',null,'kf-section'),trendHead=e('div',null,'kf-section-head'),trendMetric=select(Object.entries(metrics),'Metric over time'),trendMode=select([['monthly','Per month'],['cumulative','Cumulative in this period']],'Monthly or cumulative');trendHead.append(e('h2','Contribution over time'),trendMetric,trendMode);const trendBody=e('div');trend.append(trendHead,trendBody);
  const heat=e('section',null,'kf-section'),concentration=e('section',null,'kf-section');
  const account=e('section',null,'kf-account');account.hidden=true;account.setAttribute('aria-label','Selected account detail');
  const tableSection=e('section',null,'kf-section'),tableHeader=e('div',null,'kf-section-head'),search=e('input');search.type='search';search.placeholder='Find a username or account ID';search.setAttribute('aria-label','Search all account rankings');const download=e('button','Download filtered metrics CSV');download.type='button';tableHeader.append(e('h2','Account index'),search,download);const tableBody=e('div');tableSection.append(tableHeader,tableBody);
  const pairs=e('section',null,'kf-section'),method=e('details',null,'kf-method');method.append(e('summary','Methods & source notes'));
  method.append(e('p',data.coverage.coverageLabel),e('p',data.coverage.pages.length+' of '+data.coverage.reportedThreadPages+' reported pages. Reported thread total is not live-verified.'),e('p',presentation.text.text05));
  for(const[key,copy]of Object.entries(data.method)){method.append(e('h3',metrics[key]||'Interpretation'),e('p',copy));}
  method.append(e('p',`Quotes inspected: ${num(data.diagnostics.quoteOccurrences)}. Nested: ${num(data.diagnostics.nestedQuotes)}; unresolved direct targets: ${num(data.diagnostics.unresolvedTargets)}; self-quote occurrences: ${num(data.diagnostics.selfQuotes)}; unknown-account endpoints: ${num(data.diagnostics.unattributedQuoteEndpoints)}. These diagnostic categories count occurrences, not distinct reply posts.`),e('p',`${num(data.diagnostics.emptyOwnText)} posts contain no parsed own text; image-only and quote-only posts are retained.`),e('p',`Snapshot validation SHA-256: ${data.coverage.validationSha256}`,'kf-hash'));
  const notes=e('details',null,'kf-method');notes.append(e('summary','Research notes'),e('h3',presentation.text.text06),e('p',presentation.text.text07),e('h3',presentation.text.text08),e('p',presentation.text.text09));wrap.append(intro,coverage,controls,notice,stats,leaderHead,leaderboards,trend,heat,concentration,account,tableSection,pairs,method,notes);host.replaceChildren(wrap);
  const methodLink=e('button','Methods & source notes','kf-method-link');methodLink.type='button';listen(methodLink,'click',()=>{method.open=!method.open;if(method.open)method.scrollIntoView({behavior:'smooth',block:'center'});});coverage.append(methodLink);
  let summary;
  function filters(){return {from:state.from,to:state.to,thread:state.thread,metric:state.metric,excludedAccountIds:state.excludeSubject&&subject?[subject.id]:[]};}
  function syncControls(){from.value=state.from;to.value=state.to;threads.value=state.thread;limit.value=String(state.top);trendMetric.value=state.metric;trendMode.value=state.trend;search.value=state.query;exclude.setAttribute('aria-pressed',String(state.excludeSubject));exclude.textContent=state.excludeSubject?presentation.text.text10:presentation.text.text02;}
  function saveRoute(){const next=encodeKFRoute(state);for(const nav of document.querySelectorAll('a[data-route="kf"]'))nav.href=next;if(restoring||!decodeKFRoute(location.hash))return;if(next!==lastRoute){history.pushState({...history.state},'',next);lastRoute=next;}}
  function restoreRoute(){const restored=decodeKFRoute(location.hash);if(!restored||location.hash===lastRoute)return;Object.assign(state,restored);lastRoute=location.hash;restoring=true;render();restoring=false;}
  window.addEventListener('hashchange',restoreRoute,{signal:routeAbort.signal});window.addEventListener('popstate',restoreRoute,{signal:routeAbort.signal});
  function name(id){return data.accounts.find(u=>u.id===id)?.name||id;}
  function choose(id){state.account=id;if(onProfile){onProfile(presentation.forumProfileIdPrefix+id.split(':').at(-1));return;}renderAccount();account.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  function render(){
    if(state.from&&state.to&&state.from>state.to){notice.textContent='Choose a start date on or before the end date.';return;}
    syncControls();saveRoute();
    summary=summarizeKF(data,filters());notice.textContent=`${num(summary.totals.posts)} posts · ${summary.window.from?.slice(0,10)||'—'} to ${summary.window.to?.slice(0,10)||'—'} UTC${state.excludeSubject?presentation.text.text11:''}`;
    stats.replaceChildren(...[['posts','Posts'],['characters','Own-text characters'],['activeAccounts','Posting accounts'],['repliesMade','Quote-based reply posts'],['repliesReceived','Reply receipts']].map(([k,label])=>{const n=e('div');n.append(e('strong',num(summary.totals[k])),e('span',label));return n;}));
    leaderboards.replaceChildren();for(const[key,label]of Object.entries(metrics)){
      const panel=e('article',null,`kf-board ${state.metric===key?'is-selected':''}`),button=e('button',label,'kf-board-title');button.type='button';button.setAttribute('aria-pressed',String(state.metric===key));listen(button,'click',()=>{state.metric=key;trendMetric.value=key;state.page=0;render();});panel.append(button);
      const rows=rank(summary.allRows,key),max=rows[0]?.[key]||1;let prior=null,position=0;
      for(const[i,u]of rows.slice(0,state.top).entries()){
        if(u[key]!==prior)position=i+1;prior=u[key];const b=e('button',null,'kf-rank-row');b.type='button';b.setAttribute('aria-label',`${position}. ${u.name}: ${num(u[key])} ${label.toLowerCase()}`);
        const head=e('span',null,'kf-rank-head');head.append(e('span',String(position).padStart(2,'0'),'kf-rank-num'),e('span',u.name,'kf-name'),e('strong',num(u[key])));const bar=e('span',null,'kf-bar');const f=e('i');f.style.width=`${u[key]/max*100}%`;bar.append(f);b.append(head,bar);listen(b,'click',()=>choose(u.id));panel.append(b);
      }
      if(!rows.length)panel.append(e('p','No posts in this period.'));leaderboards.append(panel);
    }
    renderTrend();renderHeat();renderConcentration();renderTable();renderPairs();if(state.account&&!onProfile)renderAccount();
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)leaderboards.animate([{opacity:.5,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
  }
  function renderTrend(){
    trendBody.replaceChildren();const rows=rank(summary.allRows,state.metric).filter(u=>u[state.metric]>0).slice(0,5),months=summary.months;
    if(!months.length){trendBody.append(e('p','No captured activity in this period.'));return;}
    const legend=e('div',null,'kf-legend');const series=rows.map((u,i)=>{let accumulated=0;return {u,color:colors[i],values:months.map(m=>{const n=m.byAccount[u.id]?.[state.metric]||0;accumulated+=n;return state.trend==='cumulative'?accumulated:n;})};});
    const max=Math.max(1,...series.flatMap(s=>s.values)),chart=svg('svg',{viewBox:'0 0 1000 350',role:'img','aria-label':`Top five accounts by ${metrics[state.metric]}, ${state.trend} view`}),left=75,width=880,top=24,height=250;
    for(let i=0;i<=4;i++){const y=top+height-i/4*height;chart.append(svg('line',{x1:left,y1:y,x2:left+width,y2:y,class:'kf-gridline'}),svg('text',{x:left-12,y:y+4,'text-anchor':'end'},num(Math.round(max*i/4))));}
    for(const s of series){const b=e('button',s.u.name);b.type='button';b.style.borderColor=s.color;listen(b,'click',()=>choose(s.u.id));legend.append(b);chart.append(svg('polyline',{points:s.values.map((v,i)=>`${left+(months.length===1?width/2:i/(months.length-1)*width)},${top+height-v/max*height}`).join(' '),fill:'none',stroke:s.color,'stroke-width':2.5}));if(months.length===1)chart.append(svg('circle',{cx:left+width/2,cy:top+height-s.values[0]/max*height,r:5,fill:s.color}));}
    for(const i of [...new Set([0,Math.floor((months.length-1)/3),Math.floor((months.length-1)*2/3),months.length-1])])chart.append(svg('text',{x:left+(months.length===1?width/2:i/(months.length-1)*width),y:310,'text-anchor':'middle'},months[i].month));
    const details=e('details'),table=e('table',null,'kf-table'),thead=e('thead'),header=e('tr');header.append(e('th','Month · UTC'),...rows.map(u=>e('th',u.name)));thead.append(header);const tbody=e('tbody');for(const[i,m]of months.entries()){const tr=e('tr');tr.append(e('th',m.month),...series.map(s=>e('td',num(s.values[i]))));tbody.append(tr);}table.append(thead,tbody);details.append(e('summary','Read the chart as a data table'),table);
    trendBody.append(legend,chart,details);
  }
  function renderHeat(){
    const head=e('div',null,'kf-section-head'),clear=e('button','Clear month');clear.type='button';clear.disabled=!state.from&&!state.to;listen(clear,'click',()=>{state.from=state.to='';state.page=0;render();});head.append(e('h2','Monthly activity'),clear);heat.replaceChildren(head,e('p','Select a month to focus. Select it again to clear.','kf-small'));
    const context=summarizeKF(data,{...filters(),from:'',to:''}),active=selectedKFMonth(state),years=[...new Set(context.months.map(m=>m.month.slice(0,4)))],max=Math.max(1,...context.months.map(m=>m.posts)),byMonth=new Map(context.months.map(m=>[m.month,m]));
    const grid=e('div',null,'kf-heatmap');grid.append(e('span','UTC'),...['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m=>e('span',m)));
    for(const year of years){grid.append(e('strong',year));for(let month=1;month<=12;month++){const key=year+'-'+String(month).padStart(2,'0'),n=byMonth.get(key),cell=e('button',n?num(n.posts):'—');cell.type='button';cell.title=n?key+': '+num(n.posts)+' posts / '+num(n.accounts)+' posting accounts':key+': outside captured range';cell.setAttribute('aria-label',cell.title);cell.setAttribute('aria-pressed',String(key===active));cell.disabled=!n;if(n){cell.style.backgroundColor='rgba(194,175,133,'+(.07+Math.sqrt(n.posts/max)*.7)+')';listen(cell,'click',()=>{Object.assign(state,toggleKFMonth(state,key));render();const replacement=heat.querySelector('[aria-label^="'+key+':"]');replacement?.focus({preventScroll:true});});}grid.append(cell);}}
    const scroll=e('div',null,'kf-scroll');scroll.append(grid);heat.append(scroll);
  }
  function renderConcentration(){
    const rows=rank(summary.allRows,state.metric),total=rows.reduce((n,u)=>n+u[state.metric],0),top=rows.slice(0,10).reduce((n,u)=>n+u[state.metric],0);
    concentration.replaceChildren(e('h2','Share of contribution'),e('p',`The top ten accounts account for ${pct(total?top/total:0)} of attributed ${metrics[state.metric].toLowerCase()} in this period.`));
    const bar=e('div',null,'kf-share');const lead=e('div',`Top 10 · ${num(top)}`);lead.style.flex=String(top||.001);const rest=e('div',`All other accounts · ${num(total-top)}`);rest.style.flex=String(total-top||.001);bar.append(lead,rest);concentration.append(bar,e('p',`Denominator: ${num(total)} attributed ${metrics[state.metric].toLowerCase()}. Unattributed posts are excluded from account-share rankings.`,'kf-small'));
  }
  function renderTable(){
    const needle=state.query.normalize('NFKC').toLowerCase(),rows=summary.allRows.filter(u=>!needle||u.names.some(n=>n.normalize('NFKC').toLowerCase().includes(needle))||u.id.toLowerCase().includes(needle));
    const pages=Math.max(1,Math.ceil(rows.length/50));state.page=Math.min(state.page,pages-1);const table=e('table',null,'kf-table'),thead=e('thead'),tr=e('tr');tr.append(e('th','Rank'),e('th','Account'));
    for(const[k,label]of Object.entries(metrics)){const th=e('th'),b=e('button',label);b.type='button';b.setAttribute('aria-pressed',String(state.metric===k));listen(b,'click',()=>{state.metric=k;trendMetric.value=k;state.page=0;render();});th.append(b);tr.append(th);}tr.append(e('th','Active months'));thead.append(tr);const tbody=e('tbody');
    for(const u of rows.slice(state.page*50,(state.page+1)*50)){const row=e('tr'),who=e('td'),b=e('button',u.name);b.type='button';listen(b,'click',()=>choose(u.id));who.append(b,e('small',u.id));row.append(e('td',String(u.rank)),who,...Object.keys(metrics).map(k=>e('td',num(u[k]))),e('td',num(u.activeMonths)));tbody.append(row);}table.append(thead,tbody);const scroll=e('div',null,'kf-scroll');scroll.append(table);const pager=e('div',null,'kf-pager'),back=e('button','Previous'),next=e('button','Next');back.type=next.type='button';back.disabled=state.page===0;next.disabled=state.page>=pages-1;listen(back,'click',()=>{state.page--;saveRoute();renderTable();});listen(next,'click',()=>{state.page++;saveRoute();renderTable();});pager.append(back,e('span',`${num(rows.length)} accounts · page ${state.page+1} of ${pages}`),next);tableBody.replaceChildren(scroll,pager);if(!rows.length)tableBody.prepend(e('p','No matching accounts.'));
  }
  function renderPairs(){
    pairs.replaceChildren(e('h2','Replies'),e('p','Direct quote replies · 20 most frequent pairs','kf-small'));
    const list=e('ol',null,'kf-pairs');for(const pair of summary.pairs.slice(0,20)){const li=e('li'),a=e('button',name(pair.from)),b=e('button',name(pair.to));a.type=b.type='button';listen(a,'click',()=>choose(pair.from));listen(b,'click',()=>choose(pair.to));li.append(a,e('span','→'),b,e('strong',`${num(pair.count)} reply posts`));list.append(li);}pairs.append(list);if(!summary.pairs.length)pairs.append(e('p','No resolved quote-based replies in this period.'));
  }
  function renderAccount(){
    const u=summary.allRows.find(u=>u.id===state.account);account.hidden=false;account.replaceChildren();if(!u){account.append(e('p','This account has no included activity in the selected period.'));return;}
    const close=e('button','Close account detail');close.type='button';listen(close,'click',()=>{state.account=null;account.hidden=true;});account.append(close,e('p','ACCOUNT DETAIL','eyebrow'),e('h2',u.name),e('p',u.id,'kf-small'),e('p',`Observed names: ${u.names.join(' · ')}. Public join date: ${u.joinedDate||'unknown'}${u.joinDateConflict?' (conflicting dates withheld)':''}.`));
    const stats=e('div',null,'kf-stats');for(const[k,label]of Object.entries(metrics)){const n=e('div');n.append(e('strong',num(u[k])),e('span',label));stats.append(n);}account.append(stats,e('p',`${u.activeMonths} active posting months in this window. First / last authored post: ${u.first?.slice(0,10)||'none'} / ${u.last?.slice(0,10)||'none'}.`));
    const own=filterKFPosts(data,filters()).filter(p=>p.account===u.id),sample=e('details');sample.append(e('summary',`Inspect up to 20 authored posts (${num(own.length)} in this window)`));for(const p of own.slice(0,20)){const n=e('article',null,'kf-post');n.append(sourceLink(p),e('p',p.excerpt||'[No parsed own text; inspect original media or quotation.]'),e('small',`${p.at} · ${num(p.characters)} own-text characters · capture ${p.source.capture}`));sample.append(n);}account.append(sample);
    for(const[direction,title]of [['from','Replies made to'],['to','Replies received from']]){const section=e('div');section.append(e('h3',title));for(const pair of summary.pairs.filter(p=>p[direction]===u.id).slice(0,10)){const other=direction==='from'?pair.to:pair.from,b=e('button',`${name(other)} · ${num(pair.count)}`);b.type='button';listen(b,'click',()=>choose(other));section.append(b);}account.append(section);}
  }
  function exportCSV(){
    const needle=state.query.normalize('NFKC').toLowerCase(),rows=summary.allRows.filter(u=>!needle||u.names.some(n=>n.normalize('NFKC').toLowerCase().includes(needle))||u.id.toLowerCase().includes(needle));
    const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
    const header=['rank','account_key','observed_name','posts','own_text_characters','quote_reply_posts_made','quote_reply_posts_received','active_posting_months','from_utc','through_utc','validation_sha256','excluded_account_keys'];
    const lines=[header,...rows.map(u=>[u.rank,u.id,u.name,u.posts,u.characters,u.repliesMade,u.repliesReceived,u.activeMonths,state.from,state.to,data.coverage.validationSha256,filters().excludedAccountIds.join(';')])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})),a=e('a');a.href=url;a.download='assc-kf-captured-account-metrics.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  listen(from,'change',()=>{state.from=from.value;state.page=0;render();});listen(to,'change',()=>{state.to=to.value;state.page=0;render();});listen(threads,'change',()=>{state.thread=threads.value;state.page=0;render();});listen(reset,'click',()=>{Object.assign(state,kfDefaults());render();});listen(limit,'change',()=>{state.top=Number(limit.value);render();});listen(trendMetric,'change',()=>{state.metric=trendMetric.value;state.page=0;render();});listen(trendMode,'change',()=>{state.trend=trendMode.value;saveRoute();renderTrend();});listen(search,'input',()=>{state.query=search.value;state.page=0;saveRoute();renderTable();});listen(download,'click',exportCSV);listen(exclude,'click',()=>{state.excludeSubject=!state.excludeSubject;state.page=0;render();});
  render();return {resize(){},restore:restoreRoute,destroy(){routeAbort.abort();host.replaceChildren();}};
}
