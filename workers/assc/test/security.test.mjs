import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../handler.mjs';
import { MemoryAuthStore,createAuthConfig,digest } from '../auth.mjs';
import { Repository } from '../repository.mjs';
const origin='https://boomerrawlings.com';
const config=await createAuthConfig('test-passcode');
const corpus={meta:{title:'private-marker'},people:[{id:'private-person'}],sources:[{id:'source-1',title:'Private publication'}],nodes:[],edges:[],events:[]};
const record={id:'sample',title:'Sample discussion',date:'2026-10-19',speakers:['Speaker A'],topics:['community'],sourceId:'source-1',originalFilename:'sample.txt',turns:[{id:'turn-1',speaker:'Speaker A',startSeconds:22,text:'Only in the private transcript.',readingText:'Only in the private transcript.'}]};
const files={'client/gate.html':'<html>A quiet question</html>','client/gate.css':'body{}','client/gate.js':'// entry only','client/app.html':'<html>private-app-shell</html>','client/app.js':'// private-app','client/app.css':'// private-style','.private/corpus.json':JSON.stringify(corpus),'.private/transcripts.json':JSON.stringify({records:[record]}),'.private/originals/sample.txt':'original-private-text','.private/portraits/person.jpg':'private-image'};
function fixture({store=new MemoryAuthStore(),authConfig=config}={}) {
  const reads=[];
  const read=async name=>{reads.push(name);return new Response(files[name] || 'Not found',{status:name in files?200:404});};
  const handle=createHandler({read,repository:new Repository(read),store,authConfig,origin,clientAddress:r=>r.headers.get('x-test-ip') || '127.0.0.1'});
  const request=(path='',options={})=>handle(new Request(`${origin}/ASSC/${path}`,options));
  const login=async()=>request('login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({answer:'test-passcode'})});
  return {reads,request,handle,login,store};
}
test('unauthenticated HTML and every direct protected path disclose no protected files',async()=>{
  const f=fixture();
  const gate=await f.request();assert.equal(gate.status,200);assert.match(await gate.text(),/quiet question/);
  for(const p of ['api/corpus','api/transcripts','api/transcripts/sample','api/transcripts/sample/original','portraits/person.jpg','app.html','client/app.js','.private/corpus.json','../.private/corpus.json','%2e%2e/.private/corpus.json','client/graph.js.map']) {
    const r=await f.request(p);assert.ok([401,404].includes(r.status),p);assert.doesNotMatch(await r.text(),/private-marker|private-person|private-text|private-image|private-app/);
  }
  assert.deepEqual(f.reads,['client/gate.html']);
});
test('wrong answer never issues cookie; correct answer rotates random HttpOnly secure scoped session',async()=>{
  const f=fixture();const wrong=await f.request('login',{method:'POST',headers:{Origin:origin},body:'answer=incorrect'});
  assert.equal(wrong.status,401);assert.equal(wrong.headers.get('set-cookie'),null);
  const good=await f.login();assert.equal(good.status,200);
  const set=good.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);assert.match(set,/; Secure/);assert.match(set,/Path=\/ASSC/);assert.doesNotMatch(set,/test-passcode/);
  const cookie=set.split(';')[0];const authenticated={headers:{Cookie:cookie}};
  assert.match(await(await f.request('',authenticated)).text(),/private-app-shell/);
  assert.equal((await f.request('api/corpus',authenticated)).status,200);
  assert.equal((await f.request('client/app.js',authenticated)).status,200);
  assert.equal((await f.request('portraits/person.jpg',authenticated)).status,200);
  const bad=await f.request('api/corpus',{headers:{Cookie:cookie+'x'}});assert.equal(bad.status,401);
});
test('logout revokes session server-side, including copied cookie; expiry enforced',async()=>{
  let now=0;const f=fixture({store:new MemoryAuthStore({now:()=>now})});
  const cookie=(await f.login()).headers.get('set-cookie').split(';')[0];
  const out=await f.request('logout',{method:'POST',headers:{Origin:origin,Cookie:cookie}});assert.equal(out.status,200);assert.match(out.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await f.request('api/corpus',{headers:{Cookie:cookie}})).status,401);
  const cookie2=(await f.login()).headers.get('set-cookie').split(';')[0];now=8*3600000+1;
  assert.equal((await f.request('api/corpus',{headers:{Cookie:cookie2}})).status,401);
});
test('cross-site login/logout, host changes and unsupported methods are rejected',async()=>{
  const f=fixture();for(const path of ['login','logout'])for(const headers of [{},{Origin:'https://attacker.example'},{Origin:origin,'Sec-Fetch-Site':'cross-site'}])assert.equal((await f.request(path,{method:'POST',headers,body:'answer=test-passcode'})).status,403);
  assert.equal((await f.handle(new Request('https://attacker.example/ASSC/'))).status,421);
  assert.equal((await f.request('',{method:'PUT'})).status,405);
});
test('rate limits enforce per-client and aggregate attempts with retry-after',async()=>{
  const f=fixture();for(let i=0;i<5;i++)assert.equal((await f.request('login',{method:'POST',headers:{Origin:origin},body:'answer=no'})).status,401);
  const blocked=await f.login();assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
  const other=fixture();for(let i=0;i<30;i++)assert.equal((await other.request('login',{method:'POST',headers:{Origin:origin,'x-test-ip':String(i)},body:'answer=no'})).status,401);
  assert.equal((await other.request('login',{method:'POST',headers:{Origin:origin,'x-test-ip':'new'},body:'answer=no'})).status,429);
});
test('all responses private no-store noindex with CSP, head body empty; unset auth fails closed',async()=>{
  const f=fixture();for(const p of ['', 'gate.js','api/corpus','unknown']) {const r=await f.request(p);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('referrer-policy'),'no-referrer');}
  const h=await f.request('',{method:'HEAD'});assert.equal(await h.text(),'');
  assert.equal((await fixture({authConfig:null}).login()).status,503);
});
test('request size bounded, unknown authenticated paths and traversal never expose repository files',async()=>{
  const f=fixture();const cookie=(await f.login()).headers.get('set-cookie').split(';')[0];
  for(const p of ['.private/auth.json','client/../../auth.mjs','api/transcripts/../../auth.json','portraits/%2fsecret.jpg','server.mjs'])assert.ok([404].includes((await f.request(p,{headers:{Cookie:cookie}})).status),p);
  const big=await f.request('login',{method:'POST',headers:{Origin:origin},body:'answer='+('x'.repeat(2000))});assert.equal(big.status,400);
});
test('transcript full text search, filters, pagination and originals remain authenticated',async()=>{
  const f=fixture();const cookie=(await f.login()).headers.get('set-cookie').split(';')[0];const headers={Cookie:cookie};
  let data=await(await f.request('api/transcripts?query=private%20transcript',{headers})).json();assert.equal(data.total,1);assert.equal(data.items[0].match.turnId,'turn-1');assert.equal(data.items[0].turns,undefined);
  data=await(await f.request('api/transcripts?speaker=Unknown',{headers})).json();assert.equal(data.total,0);
  data=await(await f.request('api/transcripts?from=2026-11-01',{headers})).json();assert.equal(data.total,0);
  data=await(await f.request('api/transcripts?topic=community&page=999&pageSize=1',{headers})).json();assert.equal(data.page,1);assert.equal(data.total,1);
  assert.equal(await(await f.request('api/transcripts/sample/original',{headers})).text(),'original-private-text');
});
