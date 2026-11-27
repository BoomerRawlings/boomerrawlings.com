import { getMeta, query, exportCsv } from './api.js';
import { createRaceScale, calendarProgress, nearestSnapshotIndex, calendarTicks } from './race-model.js';
import { getTeamBrand } from './team-branding.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const number = new Intl.NumberFormat('en-US');
const monthFormat = new Intl.DateTimeFormat('en-US', { month:'long', timeZone:'UTC' });
const dateFormat = new Intl.DateTimeFormat('en-GB', { day:'numeric',month:'short',year:'numeric',timeZone:'UTC' });
const metrics = {
  kpr:{label:'Kills per round',unit:'KILLS / ROUND',hint:'Total kills ÷ total rounds in the window.'},
  net_kpr:{label:'Net kills per round',unit:'NET KILLS / ROUND',hint:'Total (kills − deaths) ÷ total rounds in the window.'},
  dpr:{label:'Deaths per round',unit:'DEATHS / ROUND',hint:'Total deaths ÷ total rounds. Lower values indicate fewer deaths.'},
  adr:{label:'Average damage per round',unit:'DAMAGE / ROUND',hint:'Round-weighted published map ADR; rounded source values, not exact damage counts. Incomplete windows excluded.'},
  z_kpr:{label:'KPR · contemporary z-score',unit:'STANDARDIZED KPR',hint:'KPR relative to comparable completed contemporary windows.'},
  z_net_kpr:{label:'Net KPR · contemporary z-score',unit:'STANDARDIZED NET KPR',hint:'Net KPR relative to comparable completed contemporary windows.'},
  ppi:{label:'PPI · KPR + Net KPR',unit:'EXPERIMENTAL INDEX',hint:'100 + 10 × (0.5 z KPR + 0.5 z Net KPR). Correlated components; descriptive only.'},
  ppi_defense:{label:'Balanced performance index',unit:'EXPERIMENTAL INDEX',hint:'Equal standardized kills per round and negative deaths per round. Experimental descriptive index; not estimated round-winning contribution.'},
  ppi_covariance:{label:'PPI · covariance adjusted',unit:'EXPERIMENTAL INDEX',hint:'Composite scaled by its component covariance. Definition follows the published model specification.'}
  ,robust_z_kpr:{label:'KPR · robust standardized score',unit:'ROBUST STANDARDIZED KPR',hint:'Deviation from contemporary median, divided by 1.4826 × median absolute deviation.'}
  ,percentile_kpr:{label:'KPR · contemporary percentile',unit:'CONTEMPORARY PERCENTILE',hint:'Percentile within the prior contemporary reference population. Tied observations use midranks.'}
};
const state = { meta:null,dates:[],index:0,mode:'active',perspective:'relative',metric:'ppi_defense',window:'25',quality:'elo_top30',game:'both',limit:10,q:'',zoom:true,playing:false,timer:null,rows:[],frontier:[],request:0,abort:null,detail:null,lastRanks:new Map(),motionKey:null,motionDate:null };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const fmt = (value, digits=3) => finite(value) ? value.toFixed(digits) : '—';
const count = value => finite(value) ? number.format(value) : '—';
const asDate = value => value ? new Date(`${String(value).slice(0,10)}T12:00:00Z`) : null;
const day = value => value && !Number.isNaN(asDate(value)?.getTime()) ? dateFormat.format(asDate(value)) : 'Unknown date';
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const idOf = row => String(row.player_id ?? row.id ?? '');
const nameOf = row => String(row.display_name ?? row.alias ?? row.name ?? idOf(row));
const gameLabel = game => game==='both'?'BOTH ERAS':game==='cs2'?'CS2':'CS:GO';
const valueOf = row => finite(row.value) ? row.value : row[state.metric];
const params = () => ({date:state.dates[state.index],mode:state.mode,metric:state.metric,window:state.window,quality:state.quality,game:state.game,limit:state.limit,q:state.q});
const normalizeName = value => String(value||'').normalize('NFKC').trim().toLocaleLowerCase();
function mediaFor(kind,key){
  const records=state.meta?.media?.[kind]||{};
  return records[key]||records[normalizeName(key)]||Object.values(records).find(record=>record.aliases?.some(alias=>normalizeName(alias)===normalizeName(key)));
}
function mediaPath(record){
  const path=record?.path||record?.src;
  if(!path)return null;
  try{const url=new URL(path,location.href);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}
}
function renderPlayerMedia(element,row){
  const id=idOf(row),name=nameOf(row),headshot=mediaPath(mediaFor('players',id));
  const avatar=element.querySelector('.bar-avatar');
  if(avatar.dataset.path!==(headshot||'')){
    avatar.dataset.path=headshot||'';avatar.replaceChildren();
    const fallback=document.createElement('span');fallback.className='avatar-fallback';fallback.textContent=name.replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase()||'?';fallback.title=`No licensed headshot available for ${name}`;fallback.setAttribute('aria-label',fallback.title);avatar.append(fallback);
    if(headshot){const image=document.createElement('img');image.src=headshot;image.alt=`${name} headshot`;image.loading='lazy';image.decoding='async';image.addEventListener('load',()=>fallback.hidden=true);image.addEventListener('error',()=>image.remove());avatar.append(image);}
  }
  const initials=avatar.querySelector('.avatar-fallback');
  if(initials){initials.textContent=name.replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase()||'?';initials.title=`No licensed headshot available for ${name}`;initials.setAttribute('aria-label',initials.title);}
  const portrait=avatar.querySelector('img');if(portrait)portrait.alt=`${name} headshot`;
  // Source roster lineages are not transfer events. Compare the observed team name/mark.
  const team=row.team_name||null,logoRecord=team?mediaFor('teams',team):null,logo=mediaPath(logoRecord),unaltered=Boolean(logoRecord?.unaltered_display),brand=getTeamBrand(team,logoRecord);
  for(const [key,value]of Object.entries({primary:brand.primary,secondary:brand.secondary,accent:brand.accent}))element.style.setProperty(`--team-${key}`,value);
  element.dataset.teamBrand=brand.key;
  const teamKey=normalizeName(logoRecord?.name||team).replace(/^team\s+/,'')+'|'+(logo||'');
  const previous=element.dataset.teamKey;
  const changed=Boolean(team&&previous&&previous!=='|'&&previous!==teamKey);
  if(previous!==teamKey){
    element.dataset.teamKey=teamKey;
    const holder=element.querySelector('.bar-team-mark');
    holder.classList.toggle('brand-unaltered',unaltered);
    holder.replaceChildren();holder.dataset.mode=brand.logo.mode;
    if(logo&&brand.logo.mode==='mask'){
      const watermark=document.createElement('span');watermark.className='team-watermark';watermark.style.setProperty('--crest',`url("${logo}")`);holder.append(watermark);
      const source=document.createElement('img');source.className='mask-source';source.src=logo;source.alt='';source.setAttribute('aria-hidden','true');holder.append(source);
    }else if(logo&&brand.logo.mode==='original'){
      const image=document.createElement('img');image.src=logo;image.alt='';image.dataset.unaltered=String(unaltered);image.setAttribute('aria-hidden','true');image.addEventListener('error',()=>image.remove());holder.append(image);
    }else{
      const wordmark=document.createElement('span');wordmark.className='team-wordmark';wordmark.textContent=team?brand.label:'';holder.append(wordmark);
    }
    if(team&&previous&&previous!=='|'){
      element.classList.remove('team-changed');void element.offsetWidth;element.classList.add('team-changed');clearTimeout(element.teamTimer);element.teamTimer=setTimeout(()=>element.classList.remove('team-changed'),1500);
    }
  }
  const label=element.querySelector('.bar-team');label.textContent=team||'Team unavailable';label.title=team?`${team}${row.team_observed_date?` · first recorded with team ${day(row.team_observed_date)}`:''}`:'Contemporary team observation unavailable';
  return changed?`${name} → ${team}${row.team_observed_date?` (${day(row.team_observed_date)})`:''}`:null;
}

function toast(message) {
  $('#toast').textContent=message;$('#toast').hidden=false;
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,4200);
}
function openDialog(id) { pause(); const dialog=$(id);if(!dialog.open)dialog.showModal(); }
function updateDate(actualDate) {
  const date=actualDate||state.dates[state.index];const parsed=asDate(date);
  $('#date-year').textContent=parsed?.getUTCFullYear()||'—';
  $('#date-month').textContent=parsed?monthFormat.format(parsed).toUpperCase():'NO COVERAGE';
  $('#timeline-date').textContent=date?day(date):'No snapshot available';
  const progress=date&&state.dates.length?calendarProgress(date,state.dates[0],state.dates.at(-1)):0;
  $('#timeline').value=Math.round(progress*10000);
  $('#timeline').setAttribute('aria-valuetext',date?`${day(date)}. Measured monthly snapshot.`:'No snapshot');
  $('#calendar-track').style.setProperty('--calendar-progress',`${progress*100}%`);
  $('#calendar-current').textContent=parsed?`${monthFormat.format(parsed)} ${parsed.getUTCFullYear()}`:'No snapshot';
  $('#calendar-current').style.left=`${progress*100}%`;
  $('#calendar-current').classList.toggle('near-start',progress<.12);$('#calendar-current').classList.toggle('near-end',progress>.88);
  const yearStart=parsed?new Date(Date.UTC(parsed.getUTCFullYear(),0,1)):null;
  const nextYear=parsed?new Date(Date.UTC(parsed.getUTCFullYear()+1,0,1)):null;
  $('#month-name').textContent=parsed?`${parsed.getUTCFullYear()} · THE YEAR`:'—';
  $('#month-day').textContent=parsed?`${monthFormat.format(parsed)} ${parsed.getUTCDate()}`:'—';
  $('#month-progress').style.width=parsed?`${(parsed-yearStart)/(nextYear-yearStart)*100}%`:'0%';
  $$('#year-months span').forEach((label,index)=>label.classList.toggle('current-month',index===parsed?.getUTCMonth()));
}
function renderCalendar(){
  const start=state.dates[0],end=state.dates.at(-1),track=$('#calendar-track');
  if(!start||!end)return;
  const fraction=date=>calendarProgress(date,start,end);
  $('#calendar-years').innerHTML=calendarTicks(start,end,{maxTicks:16}).filter(tick=>tick.kind==='boundary'||tick.fraction>.035&&tick.fraction<.965).map(tick=>`<span class="calendar-year ${tick.kind==='boundary'?'boundary':''}" style="left:${tick.fraction*100}%">${escape(tick.label)}</span>`).join('');
  const months=[];let cursor=new Date(`${start.slice(0,7)}-01T00:00:00Z`),last=new Date(`${end}T00:00:00Z`);
  while(cursor<=last){const date=cursor.toISOString().slice(0,10);if(date>=start)months.push(`<i class="month-tick ${cursor.getUTCMonth()===0?'year-tick':''}" style="left:${fraction(date)*100}%" title="${escape(monthFormat.format(cursor))} ${cursor.getUTCFullYear()}"></i>`);cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1));}
  $('#calendar-months').innerHTML=months.join('');
  const ranges=state.meta?.game_ranges||{},bands=[];
  for(const game of ['csgo','cs2']){const range=ranges[game];if(!range||range.max_date<start||range.min_date>end)continue;const left=fraction(range.min_date),right=fraction(range.max_date);bands.push(`<span class="era-band era-${game}" style="left:${left*100}%;width:${(right-left)*100}%">${gameLabel(game)}</span>`);}
  if(ranges.csgo&&ranges.cs2&&state.game==='both'){const left=fraction(ranges.csgo.max_date),right=fraction(ranges.cs2.min_date);bands.push(`<span class="era-band coverage-gap" style="left:${left*100}%;width:${(right-left)*100}%" title="No acquired observations between ${escape(day(ranges.csgo.max_date))} and ${escape(day(ranges.cs2.min_date))}">DATA GAP</span>`);}
  $('#calendar-eras').innerHTML=bands.join('');
  track.setAttribute('aria-label',`Calendar timeline from ${day(start)} to ${day(end)}. Highlight shows selected player's actual completed window.`);
}
function highlightWindow(row){
  const span=$('#calendar-window'),label=$('#window-span');
  if(!row?.start_date||!row?.end_date){span.hidden=true;label.textContent='No qualifying window at this date';return;}
  const left=calendarProgress(row.start_date,state.dates[0],state.dates.at(-1)),right=calendarProgress(row.end_date,state.dates[0],state.dates.at(-1));
  span.hidden=false;span.style.left=`${left*100}%`;span.style.width=`${Math.max(0,right-left)*100}%`;
  label.textContent=`${nameOf(row)} · ${day(row.start_date)} — ${day(row.end_date)} · ${count(row.maps??row.map_count)} maps`;
}
function updateLabels() {
  $('#explorer-heading').textContent=state.mode==='active'?'Who is setting the pace?':'The evolution of a peak';
  $('#chart-title').textContent=state.metric==='ppi_defense'?`${state.mode==='active'?'Form':'Performance'} index · production + survival`:metrics[state.metric]?.label||state.metric;
  $('#chart-unit').textContent=metrics[state.metric]?.unit||'OBSERVED VALUE';
  $('#metric-hint').textContent=metrics[state.metric]?.hint||'';
  $('#view-label').textContent=`${state.mode==='record'?'HISTORICAL RECORDS':'ACTIVE PERFORMANCE'} / ${gameLabel(state.game)}`;
  const calendar=state.window.endsWith('d');
  $('#chart-spec').textContent=(calendar?`${state.window.slice(0,-1)} calendar days · inspect maps and rounds`:`${state.window} consecutive qualifying maps · maximum 365 days`)+(state.game==='both'?' · separate game windows':'');
  $('#era-warning').hidden=state.game!=='both';
  $('#leader-label').textContent=state.q?'HIGHEST MATCHING PLAYER':state.mode==='record'?'OBSERVED RECORD HOLDER':'CURRENT LEADER IN VIEW';
  const inactivity=state.meta?.inactivity_days??state.meta?.specification?.inactivity_days;
  $('#chart-caption').textContent=(state.mode==='record'?'Records persist after retirement. Click a player for evidence.':`Most recent qualifying window${inactivity?` · inactive after ${inactivity} days`:''}. Click a player for evidence.`)+' Exact ties share ranks; display order uses date and identity.';
  const qualityOption=state.meta?.quality_options?.find?.(option=>option.value===state.quality);
  $('#quality-hint').textContent=qualityOption?.reason||({all:'Coverage-limited recorded competition. Eligibility is source-defined.',elo_top30:'Reconstructed pre-match strength; not published historical rankings.',published_top30:'Requires dated published rankings. Missing ranks are not imputed.'}[state.quality]);
}
function renderEmpty(title,message) {
  $('#bar-chart').replaceChildren();$('#bar-chart').style.height='370px';
  const div=document.createElement('div');div.className='empty-state';
  div.innerHTML=`<span class="empty-mark">△</span><h4>${escape(title)}</h4><p>${escape(message)}</p>`;
  $('#bar-chart').append(div);$('#leader-name').textContent='No qualifying window';$('#leader-value').textContent='—';
  $('#scale-note').textContent='No measured values for this snapshot.';$('#scale-ticks').replaceChildren();highlightWindow(null);
}
function renderRows(rows) {
  const chart=$('#bar-chart');
  $('#roster-annotation').textContent='';
  if(!rows.length){renderEmpty('No qualifying windows','Try a later date, a shorter window, a different game, or broader opposition. Missing history is not a zero performance.');return;}
  chart.querySelector('.empty-state')?.remove();
  const values=rows.map(valueOf).filter(finite);
  const scale=createRaceScale(values,{zoom:state.zoom,metric:state.metric});
  const axisDigits=state.metric.startsWith('ppi')||state.metric==='adr'?0:2;
  $('#scale-note').textContent=state.zoom?`Zoomed common axis · baseline ${fmt(scale.baseline,axisDigits)} · bar lengths show differences from this baseline, not ratios. Axis follows displayed values.`:'Zero baseline · bar lengths show measured values on a common axis.';
  $('#scale-ticks').innerHTML=scale.ticks.map(value=>`<span style="left:${(value-scale.domain[0])/(scale.domain[1]-scale.domain[0])*100}%">${fmt(value,axisDigits)}</span>`).join('');
  const existing=new Map([...chart.querySelectorAll('.bar-row')].map(element=>[element.dataset.id,element]));
  const wanted=new Set(rows.map(idOf));
  for(const [id,element]of existing)if(!wanted.has(id)){element.classList.replace('bar-row','row-exiting');element.setAttribute('aria-hidden','true');element.tabIndex=-1;setTimeout(()=>element.remove(),320);}
  const rowHeight=45;
  chart.style.height=`${Math.max(160,rows.length*rowHeight)}px`;
  const motionKey=[state.mode,state.metric,state.window,state.quality,state.game,state.q].join('|'),date=state.dates[state.index];
  const comparable=state.motionKey===motionKey&&state.motionDate!==date&&date>state.motionDate;
  const teamChanges=[];
  const aliasCounts=new Map();for(const row of rows){const alias=normalizeName(nameOf(row));aliasCounts.set(alias,(aliasCounts.get(alias)||0)+1);}
  rows.forEach((row,index)=>{
    const id=idOf(row);let element=existing.get(id);const fresh=!element;
    if(!element){element=document.createElement('button');element.type='button';element.className='bar-row row-entering';element.dataset.id=id;element.setAttribute('role','listitem');element.innerHTML='<span class="bar-rank"><span class="rank-number"></span><span class="rank-change"></span></span><span class="bar-avatar"></span><span class="bar-identity"><span class="bar-player"><span class="bar-name"></span><span class="era-badge" hidden></span></span><span class="bar-team"></span></span><span class="bar-track"><span class="zero-line"></span><span class="bar-fill"><span class="bar-team-mark"></span></span></span><span class="bar-value"></span>';chart.append(element);element.addEventListener('click',()=>openPlayer(element.dataset.id));element.addEventListener('pointerenter',()=>highlightWindow(element.windowRow));element.addEventListener('pointerleave',()=>highlightWindow(state.rows[0]));element.addEventListener('focus',()=>highlightWindow(element.windowRow));element.addEventListener('blur',()=>highlightWindow(state.rows[0]));}
    const value=valueOf(row);
    const renderVersion=(element.renderVersion||0)+1;element.renderVersion=renderVersion;
    element.windowRow=row;
    element.classList.toggle('is-leader',value===valueOf(rows[0]));
    element.style.transform=`translateY(${index*rowHeight}px)`;
    const rank=row.rank??index+1,previousRank=state.lastRanks.get(id),delta=comparable&&previousRank!=null?previousRank-rank:0;
    element.querySelector('.rank-number').textContent=String(rank).padStart(2,'0');
    const rankChange=element.querySelector('.rank-change');rankChange.textContent=delta?`${delta>0?'↑':'↓'}${Math.abs(delta)}`:comparable&&previousRank==null?'IN':'';rankChange.className=`rank-change ${delta>0?'rank-up':delta<0?'rank-down':'rank-new'}`;rankChange.title=delta?`Moved ${Math.abs(delta)} positions ${delta>0?'up':'down'} since preceding displayed snapshot`:rankChange.textContent?'Entered the displayed selection':'';
    element.classList.toggle('is-rising',delta>0);element.classList.toggle('is-falling',delta<0);
    element.querySelector('.bar-name').textContent=nameOf(row);
    const badge=element.querySelector('.era-badge');badge.hidden=aliasCounts.get(normalizeName(nameOf(row)))<2;badge.textContent=row.game==='csgo'?'GO':row.game==='cs2'?'CS2':'ID';badge.title='Separate unresolved source identities; not assumed different people.';
    const teamChange=renderPlayerMedia(element,row);if(teamChange)teamChanges.push(teamChange);
    element.querySelector('.bar-value').textContent=fmt(value,state.metric.startsWith('ppi')?1:3);
    const geometry=scale.geometry(value),fill=element.querySelector('.bar-fill');
    fill.style.left=`${geometry.left*100}%`;
    if(fresh){fill.style.width='0%';requestAnimationFrame(()=>requestAnimationFrame(()=>{if(element.renderVersion!==renderVersion||!element.isConnected)return;fill.style.width=`${geometry.width*100}%`;element.classList.remove('row-entering');}));}else{fill.style.width=`${geometry.width*100}%`;element.classList.remove('row-entering');}
    element.querySelector('.zero-line').style.left=`${(scale.baseline-scale.domain[0])/(scale.domain[1]-scale.domain[0])*100}%`;
    element.querySelector('.zero-line').style.display='block';
    const title=`${nameOf(row)}: ${fmt(value)}, ${row.maps??row.map_count??'?'} maps, ${row.rounds??'?'} rounds. ${day(row.start_date)} to ${day(row.end_date)}. Inspect performance.`;
    element.title=title;element.setAttribute('aria-label',title);
  });
  state.lastRanks=new Map(rows.map((row,index)=>[idOf(row),row.rank??index+1]));state.motionKey=motionKey;state.motionDate=date;
  highlightWindow(rows[0]);
  $('#leader-name').textContent=nameOf(rows[0]);$('#leader-value').textContent=fmt(valueOf(rows[0]),state.metric.startsWith('ppi')?1:3);
  if(rows.length>1&&valueOf(rows[1])===valueOf(rows[0])){$('#leader-label').textContent=state.q?'SHARED HIGHEST MATCH':'SHARED OBSERVED LEAD';$('#leader-name').textContent=`${nameOf(rows[0])} · tied`;}
  if(teamChanges.length)$('#roster-annotation').textContent=`First observed with team: ${teamChanges.slice(0,3).join(' · ')}. `;
}
async function refresh({frontier=false}={}) {
  const request=++state.request;
  state.abort?.abort();state.abort=new AbortController();
  updateDate();updateLabels();$('#chart-area').setAttribute('aria-busy','true');
  $('#snapshot-status').textContent='Loading measured snapshot…';
  try{
    const response=await query('leaderboard',params(),{signal:state.abort.signal});
    if(request!==state.request)return;
    state.rows=(response.rows||response.leaderboard||[]).filter(row=>finite(valueOf(row)));
    renderRows(state.rows);
    $('#export').disabled=!state.rows.length;
    const date=response.date||state.dates[state.index];
    updateDate(date);
    const scope=response.search_scope||state.meta?.search_scope;
    const limited=scope&&scope!=='all';
    $('#search').placeholder=limited?'Search top 100 players':'Search an alias';
    $('#search-hint').textContent=limited?'Searches the top 100 for this metric and snapshot. Full population remains in the research database.':'Search the published leaderboard population.';
    $('#snapshot-status').textContent=`${state.rows.length} ${state.q?'matching':'displayed'} players · ${date?`snapshot ${date}`:'no snapshot'} · ${state.meta?.dataset_version||'versioned source'}`;
    if(frontier)await refreshFrontier(request);
  }catch(error){
    if(error.name==='AbortError'||request!==state.request)return;
    state.rows=[];renderEmpty('This slice is unavailable',error.message||'The requested dataset could not be loaded.');$('#snapshot-status').textContent='Data unavailable. No substitute values displayed.';$('#export').disabled=true;pause();
  }finally{if(request===state.request)$('#chart-area').setAttribute('aria-busy','false');}
}
async function refreshFrontier(request=state.request){
  try{const response=await query('frontier',params());if(request!==state.request)return;state.frontier=response.records||response.frontier||response.rows||[];renderFrontier();}
  catch{$('#frontier-content').innerHTML='<p class="muted">Exact record events unavailable for this specification.</p>';}
}
function renderFrontier(){
  const records=state.frontier.filter(row=>String(row.date||row.end_date)<=(state.dates[state.index]||'9999-12-31')).slice(-5).reverse();
  if(!records.length){$('#frontier-content').innerHTML='<p class="muted">No completed record window in this period and specification.</p>';return;}
  $('#frontier-content').innerHTML=records.map(row=>`<div class="frontier-event"><time datetime="${escape(row.date||row.end_date)}">${escape(day(row.date||row.end_date))}</time><button data-player="${escape(idOf(row))}">${escape(nameOf(row))}<span class="frontier-sub">${count(row.maps??row.map_count)} maps · ${count(row.rounds)} rounds</span></button><strong>${fmt(valueOf(row),state.metric.startsWith('ppi')?1:3)}</strong></div>`).join('');
  $$('#frontier-content [data-player]').forEach(button=>button.addEventListener('click',()=>openPlayer(button.dataset.player)));
}
function pause(){state.playing=false;clearTimeout(state.timer);$('#play').innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 3 11 7-11 7z"/></svg><span>Play history</span>';$('#play').setAttribute('aria-label','Play historical timeline');}
async function step(){
  if(!state.playing)return;
  if(state.index>=state.dates.length-1){pause();return;}
  state.index++;await refresh({frontier:true});
  if(state.playing)state.timer=setTimeout(step,Number($('#speed').value));
}
async function play(){
  if(!state.dates.length)return;
  if(state.index===state.dates.length-1)state.index=0;
  state.playing=true;$('#play').innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3h4v14H5zm7 0h4v14h-4z"/></svg><span>Pause</span>';$('#play').setAttribute('aria-label','Pause historical timeline');
  // Begin at the first actual qualifying snapshot; never skip internal coverage gaps.
  if(state.index===0){try{for(let index=0;index<state.dates.length&&state.playing;index++){const response=await query('leaderboard',{...params(),date:state.dates[index]});if((response.rows||[]).some(row=>finite(valueOf(row)))){state.index=index;break;}}}catch(error){pause();toast(error.message);return;}}
  if(!state.playing)return;
  await refresh({frontier:true});if(state.playing)state.timer=setTimeout(step,Number($('#speed').value));
}
function selectionChanged(){pause();refresh({frontier:true});}
function setPerspective(value,{initial=false}={}){
  state.perspective=value;
  $$('#perspective-control button').forEach(button=>{const selected=button.dataset.perspective===value;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',selected);});
  let options=value==='absolute'?['kpr','net_kpr','adr']:['z_kpr','z_net_kpr','ppi','ppi_defense','ppi_covariance','robust_z_kpr','percentile_kpr'];
  const available=state.meta?.metrics;
  if(Array.isArray(available)){const keys=available.map(item=>typeof item==='string'?item:item.value||item.id);options=options.filter(option=>keys.includes(option));}
  if(!options.length)options=value==='absolute'?['kpr','net_kpr']:['z_kpr','z_net_kpr','ppi','ppi_defense'];
  $('#metric').innerHTML=options.map(option=>`<option value="${option}">${escape(metrics[option].label)}</option>`).join('');
  state.metric=initial&&options.includes(state.metric)?state.metric:options.includes('ppi_defense')?'ppi_defense':options[0];$('#metric').value=state.metric;if(!initial)selectionChanged();
}
function initializeDates(meta,preserve=false){
  const current=preserve?state.dates[state.index]:null;
  const byGame=meta.game_ranges||meta.coverage?.by_game||{};
  const gameRange=Array.isArray(byGame)?byGame.find(row=>row.game===state.game):byGame[state.game];
  const minDate=gameRange?.min_date||meta.coverage?.min_date,maxDate=gameRange?.max_date||meta.coverage?.max_date;
  let dates=[...(meta.dates||meta.snapshot_dates||[])];
  if(!dates.length&&meta.coverage?.min_date&&meta.coverage?.max_date){
    const start=asDate(meta.coverage.min_date),end=asDate(meta.coverage.max_date);
    let cursor=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0,12));
    while(cursor<end){dates.push(cursor.toISOString().slice(0,10));cursor=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+2,0,12));}
    dates.push(meta.coverage.max_date.slice(0,10));
  }
  state.dates=[...new Set(dates.map(date=>typeof date==='string'?date.slice(0,10):date.date))].filter(date=>date&&(!minDate||date>=minDate)&&(!maxDate||date<=maxDate)).sort();
  if(maxDate&&!state.dates.includes(maxDate.slice(0,10)))state.dates.push(maxDate.slice(0,10));
  state.dates.sort();
  state.index=current?Math.max(0,state.dates.findLastIndex(date=>date<=current)):Math.max(0,state.dates.length-1);
  $('#timeline').max=10000;$('#timeline').disabled=!state.dates.length;$('#play').disabled=!state.dates.length;$('#replay').disabled=!state.dates.length;
  $('#timeline-start').textContent=state.dates[0]?day(state.dates[0]):'—';$('#timeline-end').textContent=state.dates.at(-1)?day(state.dates.at(-1)):'—';
  renderCalendar();
}
function metadataUI(meta){
  // Presentation opens on active form. Research metadata retains its primary 50-map specification.
  for(const key of ['game','quality'])if(meta.default_specification?.[key]!=null)state[key]=String(meta.default_specification[key]);
  const coverage=meta.coverage||{};
  $('#stat-players').textContent=count(coverage.players??meta.players_count);
  $('#stat-maps').textContent=count(coverage.maps);
  $('#stat-performances').textContent=count(coverage.performances??coverage.player_maps);
  let pass=meta.validation?.rate??meta.validation?.pass_rate;
  if(!finite(pass)&&finite(coverage.valid_performances)&&finite(coverage.performances)&&coverage.performances>0)pass=coverage.valid_performances/coverage.performances;
  $('#stat-valid').textContent=finite(pass)?`${(pass<=1?pass*100:pass).toFixed(1)}%`:'—';
  const min=coverage.min_date,max=coverage.max_date;
  $('#coverage-message').textContent=min&&max?`Acquired observations: ${day(min)}–${day(max)}. Historical coverage incomplete.`:'Historical coverage incomplete. View source inventory before interpreting records.';
  if(min&&max){$('#hero-years').innerHTML=`${escape(min.slice(0,4))}—<br><span>${escape(max.slice(0,4))}</span>`;$('#hero-scope').textContent='Acquired data range. Full 2012–present history is the research objective.';}
  $('#dataset-version').textContent=`DATASET / ${meta.dataset_version||'LOCAL BUILD'}`;
  const notes=(meta.notes||meta.limitations||[]).map(note=>typeof note==='string'?note:note.message||JSON.stringify(note));
  $('#methodology-dynamic').textContent=[...notes,meta.inactivity_days?`Active leaderboard inactivity threshold: ${meta.inactivity_days} days.`:''].filter(Boolean).join(' ');
  if(Array.isArray(meta.games)&&meta.games.length){const games=meta.games.map(game=>typeof game==='string'?game:game.value||game.id);$$('#game option').forEach(option=>{option.disabled=!games.includes(option.value);});if(!games.includes(state.game)){state.game=games[0];$('#game').value=state.game;}}
  if(Array.isArray(meta.quality_options))for(const option of meta.quality_options){const element=$(`#quality option[value="${CSS.escape(option.value)}"]`);if(element){if(option.label)element.textContent=option.label;element.disabled=option.available===false;}}
  if($(`#quality option[value="${CSS.escape(state.quality)}"]`)?.disabled)state.quality='all';
  $('#game').value=state.game;$('#quality').value=state.quality;$('#window').value=state.window;setPerspective(state.perspective,{initial:true});
  if(Array.isArray(meta.windows)&&meta.windows.length){const windows=meta.windows.map(String);$$('#window option').forEach(option=>option.disabled=!windows.includes(option.value));}
  renderCoverage(meta);
  renderMedia(meta.media);
}
function safeLink(url,label){try{const parsed=new URL(url);if(['https:','http:'].includes(parsed.protocol))return `<a href="${escape(parsed.href)}" target="_blank" rel="noopener noreferrer">${escape(label||parsed.hostname)} ↗</a>`;}catch{}return escape(label||url);}
function renderMedia(media){
  const workTitle=record=>{if(record.title)return record.title;try{const pathname=decodeURIComponent(new URL(record.source_url||record.source||record.url).pathname);return pathname.includes('/wiki/File:')?pathname.split('/wiki/File:')[1].replaceAll('_',' '):'Original source';}catch{return 'Original source';}};
  const records=[...Object.entries(media?.players||{}),...Object.entries(media?.teams||{})];
  const unique=[...new Map(records.map(([key,record])=>[record.path||key,{key,...record}])).values()];
  $('#media-content').innerHTML=unique.length?unique.map(record=>`<article class="media-credit">${mediaPath(record)?`<img class="${record.unaltered_display?'protected-brand':'source-media'}" src="${escape(mediaPath(record))}" alt="${escape(record.name||record.title||record.key)}" loading="lazy">`:''}<div><strong>${escape(record.name||record.title||record.key)}</strong><p>${escape(record.attribution||record.artist||record.author||'See linked source attribution')}</p><p>${safeLink(record.source_url||record.source||record.url,workTitle(record))} · ${safeLink(record.license_url,record.license||'License')}</p>${record.usage_basis?`<p>${escape(record.usage_basis)}</p>`:''}${record.modifications||record.modification?`<p>${escape(record.modifications||record.modification)}</p>`:''}${record.identity_evidence?`<details><summary>Display identity evidence</summary><p>${escape(typeof record.identity_evidence==='object'?JSON.stringify(record.identity_evidence):record.identity_evidence)}</p></details>`:''}</div></article>`).join(''):'<p class="muted">No licensed image assets available in this build. The application uses initials and team names.</p>';
}
function renderCoverage(meta){
  const c=meta.coverage||{};
  const stats=[['Player identities',c.players],['Team identities',c.teams],['Matches with series IDs',c.matches],['Map/series containers',c.match_containers],['Maps',c.maps],['Player-map rows',c.performances??c.player_maps],['Validated rows',c.valid_performances]];
  const sources=meta.sources||[];
  const sourceHTML=sources.length?`<h3>Acquired sources</h3><ul class="coverage-list">${sources.map(source=>`<li>${safeLink(source.url||source.source_url,source.name||source.id)}${source.license?` · ${escape(source.license)}`:''}${source.date_range?` · ${escape(source.date_range)}`:''}</li>`).join('')}</ul>`:'';
  const years=c.by_year||meta.coverage_by_year;
  let yearHTML='';
  if(years){const entries=Array.isArray(years)?years:Object.entries(years).map(([year,value])=>({year,...(typeof value==='object'?value:{performances:value})}));yearHTML=`<h3>Observed yearly coverage</h3><div class="table-scroll"><table class="detail-table"><thead><tr><th>Year</th><th>Maps</th><th>Player-map rows</th></tr></thead><tbody>${entries.map(row=>`<tr><td>${escape(row.year)}</td><td>${count(row.maps)}</td><td>${count(row.performances??row.player_maps??row.rows)}</td></tr>`).join('')}</tbody></table></div>`;}
  $('#coverage-content').innerHTML=`<p class="dialog-intro">${c.min_date?`${escape(day(c.min_date))}–${escape(day(c.max_date))}. `:''}This is the acquired sample, not a demonstrated census of professional Counter-Strike.</p><div class="coverage-stats">${stats.map(([label,value])=>`<div><strong>${count(value)}</strong><span>${label}</span></div>`).join('')}</div>${sourceHTML}${yearHTML}<div class="notice">${(meta.notes||meta.limitations||['Coverage and source selection can change the apparent historical leader. Uncovered periods and unavailable metrics remain explicitly missing.']).map(item=>escape(typeof item==='string'?item:item.message||JSON.stringify(item))).join('<br>')}</div><p class="footnote">Dataset ${escape(meta.dataset_version||'local build')}. Provenance and acquisition checksums are retained in the research database and raw-data manifests.</p>`;
}

async function openPlayer(id){
  const selected=state.rows.find(row=>idOf(row)===String(id))||state.frontier.find(row=>idOf(row)===String(id));
  $('#player-content').innerHTML=`<h2 id="player-title">${escape(selected?nameOf(selected):id)}</h2><p class="muted">Loading measured trajectory…</p>`;openDialog('#player-dialog');
  try{const response=await query('player',{...params(),id,name:selected?nameOf(selected):undefined});state.detail={response,selected,id};renderPlayer();}
  catch(error){$('#player-content').innerHTML=`<h2 id="player-title">${escape(selected?nameOf(selected):id)}</h2><p class="muted">${escape(error.message)}</p>${selected?windowEvidence(selected):''}`;}
}
function provenanceHTML(provenance){
  if(!provenance)return '<p class="provenance-list">See canonical player-map rows and record-level provenance in the database.</p>';
  const entries=Array.isArray(provenance)?provenance:[provenance];
  return `<div class="provenance-list">${entries.map(entry=>typeof entry==='string'?(/^https?:/.test(entry)?safeLink(entry,entry):escape(entry)):entry.url?safeLink(entry.url,entry.source_id||entry.name||entry.url):escape(JSON.stringify(entry))).join('<br>')}</div>`;
}
function windowEvidence(row){return `<h3>Selected window</h3><p class="detail-spec">${escape(day(row.start_date))} → ${escape(day(row.end_date))}<br>${count(row.maps??row.map_count)} maps · ${count(row.rounds)} rounds · ${escape(row.game||state.game)} · ${escape(state.quality.replaceAll('_',' '))}</p><div class="detail-stats"><div><strong>${fmt(row.kpr)}</strong><span>kills per round</span></div><div><strong>${fmt(row.dpr)}</strong><span>deaths per round</span></div><div><strong>${fmt(row.net_kpr)}</strong><span>net kills per round</span></div><div><strong>${fmt(valueOf(row),state.metric.startsWith('ppi')?1:3)}</strong><span>${escape(metrics[state.metric]?.label||state.metric)}</span></div></div><details class="evidence-details"><summary>Source evidence & quality notes</summary>${row.quality_flags?.length?`<p class="notice">${escape((Array.isArray(row.quality_flags)?row.quality_flags.join(' · '):row.quality_flags).replaceAll('_',' '))}</p>`:''}${provenanceHTML(row.provenance||row.source_refs)}</details>`;}
function renderPlayer(){
  const {response,selected,id}=state.detail;
  const player=response.player||response;
  const windows=response.windows||response.trajectory||[];
  const usable=windows.filter(row=>finite(valueOf(row))).sort((a,b)=>String(a.end_date).localeCompare(String(b.end_date)));
  const peak=selected||usable.reduce((best,row)=>!best||valueOf(row)>valueOf(best)?row:best,null);
  const name=player.display_name||player.alias||selected&&nameOf(selected)||id;
  $('#player-content').innerHTML=`<h2 id="player-title">${escape(name)}</h2><p class="detail-spec">${escape(metrics[state.metric]?.label||state.metric)} · ${escape(state.window.endsWith('d')?`${state.window.slice(0,-1)} days`:`${state.window} maps`)} · ${escape(gameLabel(state.game))}${state.game==='both'?' · each window stays within its game':''}${player.debut_date?`<br>First recorded appearance ${escape(day(player.debut_date))}`:''}</p>${peak?windowEvidence(peak):'<p class="notice">No selected qualifying window is available in this export.</p>'}<div class="detail-axis-control"><label for="career-axis">Career trajectory</label><select id="career-axis"><option value="calendar">Calendar time</option><option value="debut"${player.debut_date?'':' disabled'}>Time since recorded debut</option><option value="age"${player.birth_date?'':' disabled'}>Verified player age</option></select></div><div class="detail-chart" id="detail-chart"></div><p class="footnote">Measured window endpoints only. Connecting lines are visual guides, broken between games and gaps over one year; no intermediate performance is estimated.${!player.birth_date?' Verified birth date unavailable; age view disabled.':''}</p>${response.summary?renderLongevity(response.summary):''}${response.notes?.length?`<div class="notice">${response.notes.map(note=>escape(note)).join('<br>')}</div>`:''}<h3 style="margin-top:26px">Recent measured windows</h3><div class="table-scroll"><table class="detail-table"><thead><tr><th>Window end</th><th>Game</th><th>Maps</th><th>Rounds</th><th>Value</th></tr></thead><tbody>${usable.slice(-30).reverse().map(row=>`<tr><td>${escape(day(row.end_date))}</td><td>${escape(gameLabel(row.game||state.game))}</td><td>${count(row.maps??row.map_count)}</td><td>${count(row.rounds)}</td><td>${fmt(valueOf(row),state.metric.startsWith('ppi')?1:3)}</td></tr>`).join('')}</tbody></table></div>`;
  drawTrajectory(usable,player,'calendar');$('#career-axis').addEventListener('change',event=>drawTrajectory(usable,player,event.target.value));
  installPersistence(usable,peak);
}
function installPersistence(rows,selected){
  const defaults={kpr:.9,net_kpr:.15,adr:95,z_kpr:2,z_net_kpr:2,robust_z_kpr:2,percentile_kpr:97.5};
  const threshold=defaults[state.metric]??110;
  const unique=[...new Map(rows.map(row=>[`${row.game}|${row.end_date}`,row])).values()];
  const peakValues=[...unique.map(valueOf),selected?valueOf(selected):null].filter(finite);
  const details=document.createElement('details');details.className='persistence-panel';
  details.innerHTML=`<summary>Peak versus observed persistence</summary><p class="detail-spec">Highest shown window: <strong>${peakValues.length?fmt(Math.max(...peakValues),state.metric.startsWith('ppi')?1:3):'—'}</strong></p><div class="persistence-control"><label for="elite-threshold">Elite threshold</label><input type="number" id="elite-threshold" value="${threshold}" step="${state.metric.startsWith('ppi')||state.metric==='adr'?'1':'0.01'}"><span id="persistence-result" aria-live="polite"></span></div><p class="footnote">Counts distinct measured window endpoints present in published monthly snapshots. Sparse and limited to published leaders; not continuous elite days, complete career exposure, or independent achievements.</p>`;
  $('#detail-chart').nextElementSibling.after(details);
  const update=()=>{const raw=$('#elite-threshold').value,cutoff=raw===''?null:Number(raw);$('#persistence-result').textContent=finite(cutoff)?`${unique.filter(row=>valueOf(row)>=cutoff).length} of ${unique.length} observed endpoints ≥ ${cutoff}`:'Enter a numeric threshold.';};
  $('#elite-threshold').addEventListener('input',update);update();
}
function renderLongevity(summary){
  const parts=[];
  if(finite(summary.elite_days))parts.push(`${count(summary.elite_days)} observed days above the configured elite threshold`);
  if(finite(summary.elite_maps))parts.push(`${count(summary.elite_maps)} qualifying maps above the threshold`);
  if(finite(summary.qualifying_windows))parts.push(`${count(summary.qualifying_windows)} completed qualifying windows`);
  if(!parts.length)return '';
  return `<h3 style="margin-top:24px">Peak versus longevity</h3><p class="detail-spec">${parts.map(escape).join('<br>')}${summary.threshold!=null?`<br>Threshold: ${escape(summary.threshold)}`:''}</p><p class="footnote">Overlapping windows are dependent; counts are descriptive exposure, not independent achievements.</p>`;
}
function drawTrajectory(rows,player,axis){
  const holder=$('#detail-chart');
  if(rows.length<2){holder.innerHTML='<p class="muted">At least two measured endpoints are needed to show a trajectory. No points are invented.</p>';return;}
  const points=rows.filter(row=>asDate(row.end_date)&&!Number.isNaN(asDate(row.end_date).getTime()));
  if(points.length<2)return;
  const width=650,height=220,pad={left:38,right:15,top:15,bottom:32};
  const times=points.map(row=>asDate(row.end_date).getTime()),values=points.map(valueOf);
  const lo=Math.min(...values),hi=Math.max(...values),delta=hi-lo||.1;
  const start=Math.min(...times),end=Math.max(...times),span=end-start||1;
  const x=time=>pad.left+(time-start)/span*(width-pad.left-pad.right);
  const y=value=>height-pad.bottom-(value-lo+delta*.1)/(delta*1.2)*(height-pad.top-pad.bottom);
  const label=time=>axis==='calendar'?new Date(time).toISOString().slice(0,7):`${((time-asDate(axis==='age'?player.birth_date:player.debut_date).getTime())/(365.25*86400000)).toFixed(1)} ${axis==='age'?'years old':'years'}`;
  const path=points.map((row,index)=>`${index&&row.game===points[index-1].game&&times[index]-times[index-1]<=365.25*86400000?'L':'M'}${x(times[index]).toFixed(1)},${y(valueOf(row)).toFixed(1)}`).join(' ');
  const yTicks=[lo,lo+delta/2,hi].map(value=>`<line x1="${pad.left}" y1="${y(value)}" x2="${width-pad.right}" y2="${y(value)}" stroke="#303a28"/><text x="${pad.left-8}" y="${y(value)+3}" text-anchor="end" class="plot-label">${value.toFixed(2)}</text>`).join('');
  holder.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Measured performance windows from ${escape(label(start))} to ${escape(label(end))}">${yTicks}<path d="${path}" class="plot-line"/>${points.map((row,index)=>`<circle cx="${x(times[index])}" cy="${y(valueOf(row))}" r="2"><title>${escape(day(row.end_date))}: ${fmt(valueOf(row))}, ${count(row.maps??row.map_count)} maps</title></circle>`).join('')}<text x="${pad.left}" y="${height-5}" class="plot-label">${escape(label(start))}</text><text x="${width-pad.right}" y="${height-5}" text-anchor="end" class="plot-label">${escape(label(end))}</text></svg>`;
}

$$('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$$('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{const bounds=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))dialog.close();}));
['#methodology-open','#methodology-open-bottom'].forEach(id=>$(id).addEventListener('click',()=>openDialog('#methodology-dialog')));
$('#coverage-open').addEventListener('click',()=>openDialog('#coverage-dialog'));
$('#media-open').addEventListener('click',()=>openDialog('#media-dialog'));
$('#filter-toggle').addEventListener('click',()=>{const open=$('.explorer-layout').classList.toggle('filters-open');$('#filter-toggle').setAttribute('aria-expanded',String(open));});
$$('#mode-control button').forEach(button=>button.addEventListener('click',()=>{state.mode=button.dataset.mode;$$('#mode-control button').forEach(item=>{const selected=item===button;item.classList.toggle('selected',selected);item.setAttribute('aria-pressed',selected);});selectionChanged();}));
$$('#perspective-control button').forEach(button=>button.addEventListener('click',()=>setPerspective(button.dataset.perspective)));
['metric','window','quality','game','limit'].forEach(key=>$(`#${key}`).addEventListener('change',event=>{state[key]=key==='limit'?Number(event.target.value):event.target.value;if(key==='game')initializeDates(state.meta,true);selectionChanged();}));
$('#search').addEventListener('input',event=>{clearTimeout(state.searchTimer);state.searchTimer=setTimeout(()=>{state.q=event.target.value.trim();selectionChanged();},250);});
$('#timeline').addEventListener('input',event=>{pause();state.index=nearestSnapshotIndex(state.dates,Number(event.target.value)/10000);refresh({frontier:true});});
$('#timeline').addEventListener('keydown',event=>{
  const delta={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-12,PageUp:12}[event.key];
  if(delta==null&&!['Home','End'].includes(event.key))return;
  event.preventDefault();pause();state.index=event.key==='Home'?0:event.key==='End'?state.dates.length-1:Math.max(0,Math.min(state.dates.length-1,state.index+delta));refresh({frontier:true});
});
$('#scale-zoom').addEventListener('change',event=>{state.zoom=event.target.checked;renderRows(state.rows);});
$('#play').addEventListener('click',()=>state.playing?pause():play());
$('#replay').addEventListener('click',()=>{pause();state.index=0;play();});
$('#export').addEventListener('click',async()=>{try{const blob=await exportCsv(params(),state.rows),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`apex-${state.game}-${state.metric}-${state.window}-${state.mode}-${state.dates[state.index]}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Exported the displayed analytical specification.');}catch(error){toast(error.message);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});

try{state.meta=await getMeta();metadataUI(state.meta);initializeDates(state.meta);await refresh({frontier:true});}
catch(error){$('#coverage-message').textContent='Research data could not be loaded. No demonstration values are shown.';renderEmpty('The dataset is unavailable','Run the documented acquisition, validation and export commands, then start the APEX server.');$('#chart-area').setAttribute('aria-busy','false');$('#snapshot-status').textContent=error.message;}
