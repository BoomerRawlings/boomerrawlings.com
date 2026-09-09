const FEED = 'https://raw.githubusercontent.com/BoomerRawlings/boomerrawlings.com/cbs8-data/public/cbs8';
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
let rows = [], sortKey = 'request', direction = -1, csvUrl, lastStamp, timer;
const body = document.querySelector('#rows');
const progress = document.querySelector('#progress');
const label = document.querySelector('#progress-label');
const connection = document.querySelector('#connection');
function ordered() { return [...rows].sort((a,b) => direction * collator.compare(a[sortKey]||'', b[sortKey]||'') || collator.compare(a.filename,b.filename)); }
function safeLink(value) { const u = new URL(value); if (u.origin !== 'https://sandiego.nextrequest.com' || !/^\/(requests|documents)\//.test(u.pathname)) throw Error('Invalid link'); return u.href; }
function csvCell(value) { let s=String(value); if (/^[=+\-@\t\r]/.test(s)) s="'"+s; return '"'+s.replaceAll('"','""')+'"'; }
function render() {
  const sorted=ordered(), fragment=document.createDocumentFragment();
  for (const row of sorted) {
    const tr=document.createElement('tr');
    for (const [key,url] of [['request',row.requestUrl],['filename',row.fileUrl],['type',null],['requestDate',null],['uploadDate',null]]) {
      const td=document.createElement('td');
      if(url) {const a=document.createElement('a');a.textContent=row[key];a.href=safeLink(url);a.target='_blank';a.rel='noopener noreferrer';td.append(a);} else td.textContent=row[key]||'—';
      tr.append(td);
    }
    fragment.append(tr);
  }
  body.replaceChildren(fragment);
  for(const button of document.querySelectorAll('[data-sort]')) {const active=button.dataset.sort===sortKey;button.parentElement.setAttribute('aria-sort',active?(direction===1?'ascending':'descending'):'none');button.querySelector('.arrow').textContent=active?(direction===1?'↑':'↓'):'';}
  const csv=[['Request','Audio file','Type','Request date','Uploaded','Request URL','File URL'],...sorted.map(r=>[r.request,r.filename,r.type,r.requestDate||'',r.uploadDate||'',r.requestUrl,r.fileUrl])].map(r=>r.map(csvCell).join(',')).join('\r\n');
  if(csvUrl) URL.revokeObjectURL(csvUrl);
  csvUrl=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));document.querySelector('#csv').href=csvUrl;
}
function apply(data) {
  if (!Number.isInteger(data.processed)||!Number.isInteger(data.total)||data.total<1||data.processed<0||data.processed>data.total||!Array.isArray(data.rows)) throw Error('Invalid snapshot');
  for(const r of data.rows) { for(const k of ['request','filename','type']) if(typeof r[k]!=='string') throw Error('Invalid row');safeLink(r.requestUrl);safeLink(r.fileUrl); }
  if(data.processed<Number(progress.value)) return;
  progress.max=data.total;progress.value=data.processed;
  label.textContent=`${data.processed.toLocaleString('en-US')} / ${data.total.toLocaleString('en-US')} processed`;
  label.title=`Updated ${new Date(data.updatedAt).toLocaleString()}`;
  connection.textContent=data.complete?'Complete':(Date.now()-Date.parse(data.updatedAt)>120000?'Waiting for updates':'');
  if(data.updatedAt!==lastStamp) {rows=data.rows;lastStamp=data.updatedAt;render();}
}
async function refresh() {
  try {
    // Immutable time-slot URLs avoid GitHub's five-minute cache for a mutable raw URL.
    const slot=Math.floor(Date.now()/10000);let data;
    for(const age of [1,2,3,4]) {const response=await fetch(`${FEED}/live/${slot-age}.json`,{cache:'no-store'});if(response.ok){data=await response.json();break;}}
    if(!data){const response=await fetch(`${FEED}/progress.json`,{cache:'no-store'});if(response.ok)data=await response.json();}
    if(!data)throw Error('Update unavailable');apply(data);
  }
  catch {connection.textContent='Updates unavailable';}
  finally {timer=setTimeout(refresh,10000);}
}
for(const button of document.querySelectorAll('[data-sort]'))button.addEventListener('click',()=>{if(sortKey===button.dataset.sort)direction*=-1;else{sortKey=button.dataset.sort;direction=1;}render();});
// Sorting and CSV work immediately, even if the live feed is temporarily unavailable.
rows=[...body.querySelectorAll('tr')].map(tr=>({request:tr.cells[0].textContent,requestUrl:tr.cells[0].querySelector('a').href,filename:tr.cells[1].textContent,fileUrl:tr.cells[1].querySelector('a').href,type:tr.cells[2].textContent,requestDate:tr.cells[3].dataset.date||'',uploadDate:tr.cells[4].dataset.date||''}));render();refresh();
window.addEventListener('pagehide',()=>{clearTimeout(timer);if(csvUrl)URL.revokeObjectURL(csvUrl);});
window.addEventListener('pageshow',event=>{if(event.persisted){render();refresh();}});
