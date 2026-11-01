import { COOKIE_NAME, cookieToken, digest, randomToken, sessionCookie, validAnswer } from './auth.mjs';
const CLIENT_FILES = new Set(['app.html','app.js','app.css','graph.js','graph.css','timeline.js','timeline.css']);
const ENTRY_FILES = new Set(['gate.css','gate.js','assc-logo.png']);
const JSON_HEADERS = {'Content-Type':'application/json; charset=utf-8'};
export const securityHeaders = {
  'Cache-Control':'no-store, private, max-age=0', 'Pragma':'no-cache',
  'X-Robots-Tag':'noindex, nofollow, noarchive, noimageindex',
  'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY', 'Cross-Origin-Resource-Policy':'same-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
function response(body,status=200,headers={}) { return new Response(body,{status,headers}); }
function json(value,status=200,headers={}) { return response(JSON.stringify(value),status,{...JSON_HEADERS,...headers}); }
async function boundedBody(request) {
  if (Number(request.headers.get('content-length')) > 1024) throw new Error('body');
  const reader = request.body?.getReader();
  if (!reader) return '';
  let bytes=0, pieces=[];
  while (true) { const {done,value} = await reader.read(); if(done) break; bytes+=value.byteLength; if(bytes>1024){await reader.cancel();throw new Error('body');} pieces.push(value); }
  const data = new Uint8Array(bytes);let offset=0;for(const part of pieces){data.set(part,offset);offset+=part.byteLength;}
  return new TextDecoder().decode(data);
}
export function createHandler({read,repository,store,authConfig,origin,secure=true,clientAddress=()=> 'local',revision='local'}) {
  async function process(request) {
    const url = new URL(request.url);
    if (url.origin !== origin) return json({error:'Invalid host.'},421);
    if (url.pathname !== '/ASSC' && !url.pathname.startsWith('/ASSC/')) return response('Not found',404);
    if (/%2f|%5c|%00/i.test(url.pathname)) return response('Not found',404);
    const path = url.pathname.slice(6);
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'POST') return response('Method not allowed',405,{'Allow':'GET, HEAD, POST'});
    if (request.method === 'POST' && (request.headers.get('origin') !== origin || (request.headers.get('sec-fetch-site') && !['same-origin','none'].includes(request.headers.get('sec-fetch-site'))))) return json({error:'Request refused.'},403);
    if (path === 'login' && request.method === 'POST') {
      if (!authConfig) return json({error:'The room is not configured yet.'},503);
      const limit = await store.attempt(await digest(clientAddress(request)));
      if (!limit.allowed) return json({error:'Please wait before trying again.',retryAfter:limit.retryAfter},429,{'Retry-After':String(limit.retryAfter)});
      let answer;
      try { const body = await boundedBody(request); answer=request.headers.get('content-type')?.startsWith('application/json') ? JSON.parse(body).answer : new URLSearchParams(body).get('answer'); }
      catch { return json({error:'Invalid request.'},400); }
      if (typeof answer !== 'string' || answer.length > 128 || !await validAnswer(answer,authConfig)) return json({error:'Not quite. Try another answer.'},401);
      const prior = cookieToken(request);if(prior) await store.revoke(await digest(prior));
      const token = randomToken();await store.create(await digest(token));
      return json({ok:true,redirect:'/ASSC/'},200,{'Set-Cookie':sessionCookie(token,secure)});
    }
    const token = cookieToken(request);
    const authenticated = token ? await store.get(await digest(token)) : false;
    if (path === 'logout' && request.method === 'POST') {
      if(token) await store.revoke(await digest(token));
      return json({ok:true},200,{'Set-Cookie':sessionCookie('',secure,true),'Clear-Site-Data':'"cache"'});
    }
    if (request.method === 'POST') return response('Not found',404);
    if (path === '' || url.pathname === '/ASSC') return read(authenticated ? 'client/app.html' : 'client/gate.html');
    if (ENTRY_FILES.has(path)) return read(`client/${path}`);
    if (!authenticated) return json({error:'Sign in to continue.'},401,token ? {'Set-Cookie':sessionCookie('',secure,true)} : {});
    if (path === 'api/session') return json({authenticated:true,revision});
    if (path === 'api/corpus') return json(await repository.corpus());
    if (path === 'api/transcripts') return json(await repository.search(url.searchParams));
    const transcript = /^api\/transcripts\/([a-zA-Z0-9_.-]+)(\/original)?$/.exec(path);
    if (transcript) {
      const record = await repository.transcript(transcript[1]);
      if(!record) return json({error:'Transcript not found.'},404);
      if(transcript[2]) {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,160}$/.test(record.originalFilename || '')) return response('Original unavailable',404);
        const file=await read(`.private/originals/${record.originalFilename}`);
        return new Response(file.body,{status:file.status,headers:{'Content-Type':'text/plain; charset=utf-8','Content-Disposition':`attachment; filename="${record.originalFilename}"`}});
      }
      return json(record);
    }
    if (CLIENT_FILES.has(path)) return read(`client/${path}`);
    if (path.startsWith('client/') && CLIENT_FILES.has(path.slice(7))) return read(path);
    if (/^portraits\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(path)) return read(`.private/${path}`);
    return response('Not found',404);
  }
  return async request => {
    let result;
    try { result=await process(request); }
    catch { result=json({error:'The room could not be loaded. Please try again.'},503); }
    const headers=new Headers(result.headers);
    for(const [key,value] of Object.entries(securityHeaders)) headers.set(key,value);
    headers.set('Vary','Cookie');
    if(secure) headers.set('Strict-Transport-Security','max-age=31536000');
    return new Response(request.method === 'HEAD' ? null : result.body,{status:result.status,headers});
  };
}
