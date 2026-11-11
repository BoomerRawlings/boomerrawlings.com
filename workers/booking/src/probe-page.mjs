import { BOOKING_ROUTES } from './routes.mjs';
import { DIRECT_READ_STAGES, DIRECT_SCHEMA_ISSUES, DIRECT_SETTING_FLAGS, DIRECT_SETTING_SHAPES, DIRECT_PREPARATION_NOTES } from './direct-tss.mjs';
import { AUTHENTICATION_PAGES, AUTHENTICATION_ISSUES } from './authentication.mjs';
import { AUTH_TRACE_KINDS, AUTH_TRACE_DESTINATIONS, AUTH_TRACE_RESOURCES, AUTH_TRACE_UPSTREAM_REASONS, AUTH_TRACE_PHASES, AUTH_TRACE_GUARD_ISSUES, AUTH_TRACE_METHODS, AUTH_TRACE_ROUTES } from './auth-trace.mjs';
import { RESOLVE_COURSE_REASONS } from './resolve-courses.mjs';

export function probePage() {
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const options = [...BOOKING_ROUTES].map(([route, item]) => `<option value="${route}">${item.courseCode} · package ${item.packageId}</option>`).join('');
  const html = String.raw`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>0311 · TSS login test</title>
<style nonce="${nonce}">:root{color-scheme:dark;font-family:system-ui;background:#07151d;color:#e7f3f7}body{max-width:680px;margin:8vh auto;padding:24px}h1{font-size:2rem}p{line-height:1.6;color:#afcbd5}button,select{padding:12px;margin:6px 8px 6px 0;border:1px solid #486674;border-radius:4px;background:#122e3c;color:inherit;font:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}select{max-width:100%}output{display:block;min-height:50px;padding:18px 0;white-space:pre-wrap}small{letter-spacing:.12em}</style>
<small>0311 / WINTER 2027</small><h1>TSS login test</h1><p>Sign in through the real UCSD and Duo pages in a separate tab. This page then checks all verified booking options automatically, starting with the selected course. Booking is disabled.</p>
<output id="status" aria-live="polite">Checking session…</output><button id="login" disabled>Sign in to TSS</button><button id="logout" disabled>Sign out</button>
<p id="lifetime"></p>
<p><label for="course">Course to check</label><br><select id="course">${options}</select></p><button id="inspect" disabled>Check direct course data</button><button id="verify" disabled>Compare booking details</button><output id="catalog" aria-live="polite"></output><output id="proof" aria-live="polite"></output><output id="audit" aria-live="polite"></output>
<details><summary>Login test diagnostics</summary><pre id="diagnostics">No diagnostics yet.</pre></details>
<script nonce="${nonce}">
const $=id=>document.getElementById(id);let csrf='',state='signed_out',pending=false,diagnosticState={},expiresAt=0,autoCompare=false,auditing=false;
const checkOptions=${JSON.stringify([...BOOKING_ROUTES].map(([route,item])=>({route,code:item.courseCode,label:item.courseCode+' · package '+item.packageId})))};
const readStages=new Set(${JSON.stringify(DIRECT_READ_STAGES)}),schemaIssues=new Set(${JSON.stringify(DIRECT_SCHEMA_ISSUES)}),settingFlags=new Set(${JSON.stringify(DIRECT_SETTING_FLAGS)}),settingShapes=new Set(${JSON.stringify(DIRECT_SETTING_SHAPES)});
const preparationNotes=new Set(${JSON.stringify(DIRECT_PREPARATION_NOTES)});
const catalogReasons=new Set(${JSON.stringify(RESOLVE_COURSE_REASONS)});
function catalogLines(catalog){const lines=[];for(const item of (Array.isArray(catalog?.courses)?catalog.courses:[]).slice(0,2))if(['ECON-120A','MGT-162'].includes(item.courseCode)&&/^[1-9][0-9]{0,7}$/.test(item.moduleId||'')&&Array.isArray(item.packageIds)&&item.packageIds.length<=8&&item.packageIds.every(id=>/^[1-9][0-9]{0,7}$/.test(id)))lines.push(item.courseCode+': module '+item.moduleId+'; packages '+item.packageIds.join(', '));for(const item of (Array.isArray(catalog?.failures)?catalog.failures:[]).slice(0,2))if(['ECON-120A','MGT-162'].includes(item.courseCode)&&catalogReasons.has(item.reason))lines.push(item.courseCode+': '+item.reason);return lines.length?lines:['Missing course IDs not resolved.'];}
const authenticationPages=new Set(${JSON.stringify(AUTHENTICATION_PAGES)}),authenticationIssues=new Set(${JSON.stringify(AUTHENTICATION_ISSUES)});
const traceAllowed=${JSON.stringify({kind:AUTH_TRACE_KINDS,destination:AUTH_TRACE_DESTINATIONS,resourceType:AUTH_TRACE_RESOURCES,reason:AUTH_TRACE_UPSTREAM_REASONS,phase:AUTH_TRACE_PHASES,issue:AUTH_TRACE_GUARD_ISSUES,page:AUTHENTICATION_PAGES,method:AUTH_TRACE_METHODS,route:AUTH_TRACE_ROUTES})};
function traceLines(events){const lines=[];for(const item of (Array.isArray(events)?events:[]).slice(-40)){if(!traceAllowed.kind.includes(item?.kind)||!Number.isInteger(item.atMs)||item.atMs<0||item.atMs>900000||!Number.isInteger(item.count)||item.count<1||item.count>1000)continue;const fields=[];for(const key of ['kind','destination','resourceType','method','route','page','reason','phase','issue'])if(traceAllowed[key].includes(item[key]))fields.push(item[key]);if(item.kind==='document_response'&&Number.isInteger(item.status)&&item.status>=100&&item.status<=599)fields.push('HTTP '+item.status);lines.push('+'+(item.atMs/1000).toFixed(1)+'s '+fields.join(' ')+' ×'+item.count);}return lines;}
const names={signed_out:'Signed out',signing_in:'Complete UCSD / Duo sign-in in the other tab',ready:'TSS session is ready',expired:'Session expired — sign in again',busy:'Checking TSS…',error:'Session unavailable'};
function authenticationMessage(auth){
  const snapshot=auth?.authentication,page=authenticationPages.has(snapshot?.page)?snapshot.page:'',issue=page&&authenticationIssues.has(snapshot?.issue)?snapshot.issue:'';
  if(page==='ucsd_error'||issue==='ucsd_login_exception')return 'UCSD sign-in returned an error. Check the sign-in tab.';
  if(issue==='service_unavailable')return 'TSS is temporarily unavailable. Your sign-in stays open; checking again.';
  if(['network_error','request_timeout','missing_csrf','unexpected_response'].includes(issue)||auth?.code==='authentication_unavailable')return 'TSS could not confirm sign-in. Your sign-in stays open; checking again.';
  if(page==='tss_loading')return 'TSS is loading. Your sign-in stays open; checking again.';
  if(page==='duo')return 'Complete Duo in the sign-in tab.';
  if(page==='tss_proxy_error')return 'TSS could not finish sign-in. Check the sign-in tab.';
  if(page==='login_choice')return 'Choose your UCSD sign-in option in the other tab.';
  return names.signing_in;
}
function guardLines(guard){if(!guard||typeof guard!=='object')return [];const lines=[],phases=new Set(['request','response_abort','response_body','response_fulfill','request_continue','request_block','failure_abort']),resources=new Set(['Document','XHR','Fetch','Script','Stylesheet','Image','Font','Other']);const valid=item=>item&&phases.has(item.phase)&&Number.isFinite(item.ageMs)&&item.ageMs>=0&&item.ageMs<=900000;const age=item=>(Math.round(item.ageMs/100)/10)+'s';if(Number.isInteger(guard.pendingCount)&&guard.pendingCount>=0&&guard.pendingCount<=1000)lines.push('Fetch pending: '+guard.pendingCount);for(const item of (Array.isArray(guard.pending)?guard.pending:[]).slice(0,12))if(valid(item)&&resources.has(item.resourceType))lines.push('Fetch phase: '+item.resourceType+' '+item.phase+' ('+age(item)+')');for(const [key,label] of [['lastCompleted','Last Fetch completion'],['lastFailure','Last Fetch failure']])if(valid(guard[key]))lines.push(label+': '+guard[key].phase+' ('+age(guard[key])+' ago)');return lines;}
function diagnostics(data){
  for(const key of ['diagnostics','authDiagnostics','failureStage','failure','build'])if(data[key])diagnosticState[key]=data[key];
  data=diagnosticState;const lines=[];
  if(/^[a-z0-9-]{1,50}$/.test(data.build||''))lines.push('Build: '+data.build);
  if(/^[a-z_]{1,40}$/.test(data.failureStage||''))lines.push('Failure stage: '+data.failureStage);
  if(data.failure){for(const key of ['name','code','source','reason'])if(/^[A-Za-z_]{1,50}$/.test(data.failure[key]||''))lines.push('Failure '+key+': '+data.failure[key]);}
  lines.push(...guardLines(data.diagnostics?.guard));
  const auth=data.authDiagnostics;
  if(auth){for(const key of ['stage','code'])if(/^[a-z_]{1,50}$/.test(auth[key]||''))lines.push('Authentication '+key+': '+auth[key]);
    if(auth.stage==='renderer_preflight'&&['attach','page_enable','evaluate'].includes(auth.phase))lines.push('Authentication phase: '+auth.phase);
    if(authenticationPages.has(auth.authentication?.page)){lines.push('Authentication page: '+auth.authentication.page);if(authenticationIssues.has(auth.authentication.issue))lines.push('Authentication issue: '+auth.authentication.issue);}
    lines.push(...traceLines(auth.trace));
    const hosts=new Set(['tss.ucsd.edu','tssproxy.ucsd.edu','a5.ucsd.edu','api-ce13a1a7.duosecurity.com','[other-host]']);
    for(const item of (Array.isArray(auth.blocked)?auth.blocked:[]).slice(0,30))if(hosts.has(item.hostname)&&/^(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE|OTHER)$/.test(item.method)&&typeof item.pathname==='string'&&item.pathname.length<350&&!/[?&#]/.test(item.pathname))lines.push('Blocked: '+item.method+' '+item.hostname+item.pathname);
    for(const item of (Array.isArray(auth.csp)?auth.csp:[]).slice(0,12))if(/^[a-z-]{1,30}$/.test(item.directive||'')&&Number.isInteger(item.count)&&item.count>0&&item.count<=1000)lines.push('Browser policy: '+item.directive+' ('+item.count+')');
    for(const item of (Array.isArray(auth.requestFailures)?auth.requestFailures:[]).slice(0,16))if(/^(ERR_[A-Z_]+|OTHER)$/.test(item.code||'')&&Number.isInteger(item.count)&&item.count>0&&item.count<=1000)lines.push('Request failure: '+item.code+' ('+item.count+')');
  }
  $('diagnostics').textContent=lines.join('\n')||'No blocked requests or forms observed.';
}
function lifetime(){const seconds=Math.max(0,Math.ceil((expiresAt-Date.now())/1000));$('lifetime').textContent=expiresAt?'Session time remaining: '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'';}
function schemaLines(data){const lines=[];for(const note of (Array.isArray(data.preparationNotes)?data.preparationNotes:[]).slice(0,preparationNotes.size))if(preparationNotes.has(note))lines.push('Preparation note: '+note);if(readStages.has(data.readStage))lines.push('Read stage: '+data.readStage);if(schemaIssues.has(data.schemaIssue))lines.push('Response issue: '+data.schemaIssue);for(const item of (Array.isArray(data.schemaIssues)?data.schemaIssues:[]).slice(0,24))if(readStages.has(item?.readStage)&&schemaIssues.has(item?.schemaIssue))lines.push('Schema: '+item.readStage+' / '+item.schemaIssue);for(const [flag,shape] of Object.entries(data.settingShapes||{}))if(settingFlags.has(flag)&&settingShapes.has(shape))lines.push('Setting format: '+flag+' = '+shape);return lines;}
function render(data){csrf=data.csrf||csrf;state=data.state;if(Number.isFinite(data.expiresAt))expiresAt=data.expiresAt;else if(['signed_out','expired'].includes(state))expiresAt=0;lifetime();$('status').textContent=state==='signing_in'?authenticationMessage(data.authDiagnostics):names[state]||'Session unavailable';$('login').disabled=pending||!csrf||state==='ready';$('logout').disabled=pending||!csrf||state==='signed_out';for(const id of ['inspect','verify'])$(id).disabled=pending||auditing||state!=='ready';diagnostics(data);if(autoCompare&&!pending&&state==='ready'){autoCompare=false;setTimeout(()=>void autoCheck(),0);}}
async function status(){if(pending||(document.hidden&&!autoCompare))return;try{const response=await fetch('/0311/api/status',{credentials:'same-origin',cache:'no-store'});const data=await response.json();render(data);if(!response.ok)throw Error();}catch{$('status').textContent='Session service unavailable';}}
async function post(action,extra={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);try{const response=await fetch('/0311/api/'+action,{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','X-BBB-CSRF':csrf},body:JSON.stringify({requestId:crypto.randomUUID(),...extra})});const data=await response.json();diagnostics(data);if(!response.ok)throw Object.assign(Error(),{data});return data;}finally{clearTimeout(timer)}}
function loginViewport(){const width=Number.isFinite(window.innerWidth)?window.innerWidth:800,height=Number.isFinite(window.innerHeight)?window.innerHeight:664;return{width:Math.max(320,Math.min(1440,Math.floor(width))),height:Math.max(240,Math.min(1000,Math.floor(height)-64))};}
$('login').onclick=async()=>{if(pending)return;diagnosticState={};autoCompare=true;const view=window.open('about:blank','_blank');if(!view){$('status').textContent='Allow the sign-in tab, then click Sign in again';return;}view.opener=null;pending=true;render({state:'busy',csrf});try{const data=await post('login',{viewport:loginViewport()});const url=new URL(data.loginUrl);if(url.origin!=='https://live.browser.run'||url.username||url.password||url.pathname!=='/ui/view'||url.searchParams.get('mode')!=='tab')throw Error();view.location.replace(url.href);render(data)}catch{view.close();$('status').textContent='Could not start sign-in. Check session or usage limit.'}finally{pending=false;await status()}};
async function check(action,route=$('course').value){if(pending||state!=='ready')return;pending=true;$('proof').textContent='Checking…';render({state:'busy',csrf});try{const data=await post(action,{route});const lines=['Course detail loaded: '+(data.loaded?'yes':'no'),'Authenticated request token available: '+(data.csrfReady?'yes':'no')];if(typeof data.equivalent==='boolean')lines.push('Matches TSS booking details: '+(data.equivalent?'yes':'no'));if(typeof data.bookingEligible==='boolean')lines.push('Local booking prechecks passed: '+(data.bookingEligible?'yes':'no'));if(['standard','top_module','unknown'].includes(data.nativeBookingPath))lines.push('Native booking path: '+data.nativeBookingPath);if(typeof data.dataTopModuleEnabled==='boolean')lines.push('Top-module data flag: '+data.dataTopModuleEnabled);if(/^[a-z_]{1,50}$/.test(data.reason||''))lines.push('Result: '+data.reason);for(const name of data.mismatchFields||[])if(/^[A-Za-z.]{1,60}$/.test(name))lines.push('Difference: '+name);lines.push(...schemaLines(data),'No booking request was sent.');$('proof').textContent=lines.join('\n');render(data);return data}catch(error){if(error?.data&&names[error.data.state])render(error.data);else state='signing_in';$('proof').textContent='Check did not complete. No booking was attempted.'}finally{pending=false;await status()}}
async function resolveCatalog(){
  pending=true;$('catalog').textContent='Resolving ECON-120A and MGT-162 links…';render({state:'busy',csrf});
  try{const data=await post('resolve-courses');$('catalog').textContent=catalogLines(data.catalog).join('\n');render(data);return data;}
  catch(error){if(error?.data&&names[error.data.state])render(error.data);else state='signing_in';$('catalog').textContent='Course link lookup did not complete. No booking was attempted.';}
  finally{pending=false;}
}
function canContinueAudit(data){return data?.state==='ready'&&data.csrfReady!==false&&!['authentication_required','authentication_unavailable'].includes(data.reason)&&!(Array.isArray(data.catalog?.failures)&&data.catalog.failures.some(item=>item?.reason==='authentication_required'));}
async function autoCheck(){
  if(auditing)return;auditing=true;const reports=[],seen=new Set(),diverse=[];
  for(const option of checkOptions)if(!seen.has(option.code)){seen.add(option.code);diverse.push(option);}
  diverse.sort((a,b)=>Number(!a.code.startsWith('ECON'))-Number(!b.code.startsWith('ECON')));
  const selected=checkOptions.find(option=>option.route===$('course').value);
  const queue=[...new Map([...(selected?[selected]:[]),...diverse,...checkOptions].map(option=>[option.route,option])).values()];
  try{if(state==='ready'&&(!expiresAt||expiresAt-Date.now()>=90000)){
    const catalog=await resolveCatalog();
    if(!canContinueAudit(catalog)){reports.push('Stopped: course lookup could not confirm sign-in. No booking was attempted.');return;}
  }for(const option of queue){
    if(state!=='ready'){reports.push('Stopped: sign-in is not ready.');break;}
    if(expiresAt&&expiresAt-Date.now()<90000){reports.push('Stopped before session expiry. Completed results are retained.');break;}
    $('audit').textContent=reports.join('\n\n')+'\n\nChecking '+option.label+'…';
    const data=await check('verify-direct',option.route);
    reports.push(option.label+'\n'+$('proof').textContent);
    $('audit').textContent=reports.join('\n\n');
    if(!data){reports.push('Stopped after an incomplete check. No booking was attempted.');break;}
    if(!canContinueAudit(data)){reports.push('Stopped: the check could not confirm sign-in. Completed results are retained.');break;}
  }}finally{auditing=false;$('audit').textContent=reports.join('\n\n');render({state,csrf,authDiagnostics:diagnosticState.authDiagnostics});}
}
$('inspect').onclick=()=>{if(!auditing)return check('inspect-direct')};$('verify').onclick=()=>{if(!auditing)return check('verify-direct')};
$('logout').onclick=async()=>{if(pending)return;pending=true;render({state:'busy',csrf});try{await post('logout');csrf='';$('proof').textContent='';}catch{$('status').textContent='Session closure pending';}finally{pending=false;await status()}};
status();setInterval(status,5000);setInterval(lifetime,1000);document.addEventListener('visibilitychange',status);
</script></html>`;
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  } });
}
