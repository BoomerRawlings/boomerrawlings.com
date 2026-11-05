export const metrics={posts:'Posts written',characters:'Characters written',repliesMade:'Reply posts made',repliesReceived:'Reply posts received'};
export function buildKFModel(posts,users,coverage){
  const byId=new Map(posts.map(p=>[`${p.thread_key}:${p.post_id}`,p]));
  const accountMap=new Map(users.map(u=>[u.account_key,{id:u.account_key,name:u.observed_usernames[0],names:u.observed_usernames,joinedDate:u.joined_date,joinDateConflict:u.join_date_conflict}]));
  const diagnostics={quoteOccurrences:0,nestedQuotes:0,unresolvedTargets:0,selfQuotes:0,unattributedQuoteEndpoints:0,duplicateDirectTargets:0,unattributedPosts:0,emptyOwnText:0};
  const records=posts.map(p=>{
    const targets=new Set(),resolvedPosts=new Set();
    for(const q of p.quotes||[]){
      diagnostics.quoteOccurrences++;
      if(q.parent_quote_index!=null){diagnostics.nestedQuotes++;continue;}
      const target=q.post_id&&byId.get(`${p.thread_key}:${q.post_id}`);
      if(!target){diagnostics.unresolvedTargets++;continue;}
      if(resolvedPosts.has(target.post_key)){diagnostics.duplicateDirectTargets++;continue;}resolvedPosts.add(target.post_key);
      if(!p.account_key||!target.account_key){diagnostics.unattributedQuoteEndpoints++;continue;}
      if(p.account_key===target.account_key){diagnostics.selfQuotes++;continue;}
      targets.add(target.account_key);
    }
    if(!p.account_key)diagnostics.unattributedPosts++;if(!p.text)diagnostics.emptyOwnText++;
    const date=new Date(p.timestamp);if(!Number.isFinite(date.valueOf()))throw new Error(`Invalid timestamp: ${p.post_key}`);
    return {id:p.post_key,postId:p.post_id,number:p.post_number,page:p.page,thread:p.thread_key,account:p.account_key,
      at:date.toISOString(),month:date.toISOString().slice(0,7),characters:Array.from(p.text||'').length,targets:[...targets],excerpt:(p.text||'').slice(0,260),
      source:{file:p.source_file,url:p.source_url,capture:p.capture_id,locator:p.locator,bodyHash:p.body_version_sha256}};
  }).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  return {schemaVersion:1,coverage,accounts:[...accountMap.values()],posts:records,diagnostics,
    method:{posts:'Unique selected post IDs; repeated saves and revisions do not add posts.',characters:'Unicode code points in parsed own text, including whitespace. Quotes, HTML wrappers and media are excluded.',
      repliesMade:'Distinct authored posts that directly quote a captured post by a different identified account. Multiple targets in one post count once here.',
      repliesReceived:'Distinct other-account posts directly quoting any captured post by this account. Multiple quotations to the same recipient in one post count once.',
      limits:'Quote-based replies are a measurable proxy, not a complete reply-parent graph. Nested quotes, self-quotes, unresolved targets and unknown account endpoints are excluded. Received totals may exceed reply-post totals when one post addresses multiple accounts.'}};
}
export function filterKFPosts(data,{from='',to='',thread='',excludedAccountIds=[]}={}){
  const excluded=new Set(excludedAccountIds);
  return data.posts.filter(p=>(!from||p.at.slice(0,10)>=from)&&(!to||p.at.slice(0,10)<=to)&&(!thread||p.thread===thread)&&!excluded.has(p.account))
    .map(p=>({...p,targets:p.targets.filter(id=>!excluded.has(id))}));
}
export function summarizeKF(data,{from='',to='',thread='',q='',metric='posts',excludedAccountIds=[]}={}){
  if(!metrics[metric])metric='posts';
  const users=new Map(data.accounts.map(u=>[u.id,{...u,posts:0,characters:0,repliesMade:0,repliesReceived:0,activeMonths:new Set(),first:null,last:null}]));
  const selected=filterKFPosts(data,{from,to,thread,excludedAccountIds});
  const monthly=new Map(),pairs=new Map();let unattributedPosts=0,totalCharacters=0,replyPosts=0,replyReceipts=0;
  for(const p of selected){
    totalCharacters+=p.characters;const u=users.get(p.account),m=monthly.get(p.month)||{month:p.month,posts:0,characters:0,repliesMade:0,repliesReceived:0,accounts:new Set(),byAccount:{}};
    m.posts++;m.characters+=p.characters;
    if(u){u.posts++;u.characters+=p.characters;u.activeMonths.add(p.month);u.first=u.first||p.at;u.last=p.at;m.accounts.add(u.id);const a=m.byAccount[u.id]||{posts:0,characters:0,repliesMade:0,repliesReceived:0};a.posts++;a.characters+=p.characters;m.byAccount[u.id]=a;}else unattributedPosts++;
    if(p.targets.length){replyPosts++;m.repliesMade++;if(u){u.repliesMade++;m.byAccount[u.id].repliesMade++;}}
    for(const target of p.targets){const recipient=users.get(target);if(!recipient)continue;recipient.repliesReceived++;replyReceipts++;m.repliesReceived++;const a=m.byAccount[target]||{posts:0,characters:0,repliesMade:0,repliesReceived:0};a.repliesReceived++;m.byAccount[target]=a;
      const key=JSON.stringify([p.account,target]),pair=pairs.get(key)||{from:p.account,to:target,count:0};pair.count++;pairs.set(key,pair);}
    monthly.set(p.month,m);
  }
  const rows=[...users.values()].filter(u=>u.posts||u.repliesReceived).map(u=>({...u,activeMonths:u.activeMonths.size}));
  const sort=(a,b)=>b[metric]-a[metric]||a.id.localeCompare(b.id);
  const ranked=[...rows].sort(sort),total=ranked.reduce((n,u)=>n+u[metric],0);
  let previous=null,rank=0;for(const [i,u]of ranked.entries()){if(previous!==u[metric])rank=i+1;u.rank=rank;previous=u[metric];}
  const needle=q.normalize('NFKC').toLowerCase();
  const filtered=ranked.filter(u=>!needle||u.names.some(n=>n.normalize('NFKC').toLowerCase().includes(needle))||u.id.includes(needle));
  // Fill absent months so gaps never look like continuous observed activity.
  const months=[];if(selected.length){let date=new Date(selected[0].month+'-01T00:00:00Z'),end=selected.at(-1).month;for(let guard=0;date.toISOString().slice(0,7)<=end&&guard<2400;guard++){const key=date.toISOString().slice(0,7),m=monthly.get(key)||{month:key,posts:0,characters:0,repliesMade:0,repliesReceived:0,accounts:new Set(),byAccount:{}};months.push({...m,accounts:m.accounts.size});date.setUTCMonth(date.getUTCMonth()+1);}}
  return {metric,rows:filtered,allRows:ranked,months,pairs:[...pairs.values()].sort((a,b)=>b.count-a.count||a.from.localeCompare(b.from)||a.to.localeCompare(b.to)),totals:{posts:selected.length,characters:totalCharacters,repliesMade:replyPosts,repliesReceived:replyReceipts,activeAccounts:rows.filter(u=>u.posts).length,unattributedPosts},concentration:{total,top10:ranked.slice(0,10).reduce((n,u)=>n+u[metric],0)},window:{from:selected[0]?.at||null,to:selected.at(-1)?.at||null}};
}
