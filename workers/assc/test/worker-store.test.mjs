import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createAuthConfig } from '../auth.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(String(value)).digest('hex');
let mf, namespace, authenticatedRuntime, authenticatedStore;
const origin='https://boomerrawlings.com';
const fixturePasscode='worker-test-only-passcode';
const reads=[];
const record={id:'sample',title:'Private transcript',sourceId:'source-one',speakers:['Speaker A'],topics:['topic'],date:'2026-10-01',originalFilename:'sample.txt',turns:[{id:'turn-1',speaker:'Speaker A',startSeconds:5,text:'private transcript text'}]};
const privateFiles={
  '/_protected/client/gate.html':'gate-only',
  '/_protected/client/gate.css':'/* gate style */',
  '/_protected/client/gate.js':'/* gate script */',
  '/_protected/client/app.html':'private-workspace-shell',
  '/_protected/client/app.js':'/* private application module */',
  '/_protected/client/screen-motion.js':'/* generic incoming motion */',
  '/_protected/private/presentation.json':JSON.stringify({fixture:'protected presentation marker'}),
  '/_protected/private/corpus.json':JSON.stringify({meta:{title:'private corpus marker'},people:[],sources:[{id:'source-one',title:'Private source'}],nodes:[],edges:[],events:[]}),
  '/_protected/private/transcripts.json':JSON.stringify({records:[record,{...record,id:'malicious-original',originalFilename:'../../auth.json'},{...record,id:'malicious-document',documentFile:'../../auth.json'}]}),
  '/_protected/private/originals/sample.txt':'private original bytes',
  '/_protected/private/portraits/person.jpg':'private portrait bytes'
};
before(async () => {
  const modulePath = process.env.ASSC_MINIFLARE_MODULE;
  const { Miniflare, convertV4MiniflareOptions } = await import(modulePath ? pathToFileURL(modulePath).href : 'miniflare');
  const harness = `
    import worker, { AuthStore } from './worker.mjs';
    export class TestAuthStore extends AuthStore {
      async expire() {
        this.ctx.storage.sql.exec('UPDATE sessions SET expires = 0');
        this.ctx.storage.sql.exec('UPDATE attempts SET expires = 0');
        await this.alarm();
      }
      async inspect() {
        return {sessions:this.ctx.storage.sql.exec('SELECT token_hash, created, expires FROM sessions').toArray(),
          attempts:this.ctx.storage.sql.exec('SELECT ip_hash, expires FROM attempts').toArray(),alarm:await this.ctx.storage.getAlarm()};
      }
    }
    export default worker;
  `;
  const options = {
    name: 'assc-auth-test',
    modules: [{ type:'ESModule', path:resolve(root,'test-harness.mjs'), contents:harness },
      ...['worker.mjs','auth.mjs','handler.mjs','repository.mjs'].map(name => ({ type:'ESModule', path:resolve(root,name) }))],
    modulesRoot: root, compatibilityDate:'2026-10-30', compatibilityFlags:['nodejs_compat'],
    durableObjects:{ ASSC_AUTH:{className:'TestAuthStore',useSQLite:true} },
    serviceBindings:{ ASSETS:async request => new Response(new URL(request.url).pathname.endsWith('/client/gate.html') ? 'gate-only' : 'PRIVATE', { headers:{'Content-Type':'text/plain'} }) }
  };
  mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
  namespace = await mf.getDurableObjectNamespace('ASSC_AUTH');
  const config=await createAuthConfig(fixturePasscode);
  const authenticatedOptions={...options,name:'assc-authenticated-test',bindings:{AUTH_CONFIG:JSON.stringify(config)},serviceBindings:{ASSETS:async request=>{
    const path=new URL(request.url).pathname;reads.push(path);
    return new Response(privateFiles[path] ?? 'Not found',{status:path in privateFiles?200:404,headers:{'Content-Type':'text/plain','Cache-Control':'public,max-age=31536000','ETag':'fixture-etag'}});
  }}};
  authenticatedRuntime=new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(authenticatedOptions):authenticatedOptions);
  const authenticatedNamespace=await authenticatedRuntime.getDurableObjectNamespace('ASSC_AUTH');
  authenticatedStore=authenticatedNamespace.getByName('private-room-v1');
});
after(async () => { await Promise.all([mf?.dispose(),authenticatedRuntime?.dispose()]); });

function call(path='',options={}) {return authenticatedRuntime.dispatchFetch(`${origin}/ASSC/${path}`,options);}
function login(answer=fixturePasscode,headers={}) {return call('login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({answer})});}
function session(response) {return response.headers.get('set-cookie')?.split(';')[0];}

test('persistent sliding limiter atomically enforces five per IP under concurrency', async () => {
  const store = namespace.getByName('per-ip');
  const results = await Promise.all(Array.from({length:12},()=>store.attempt(hash('same-ip'))));
  assert.equal(results.filter(x=>x.allowed).length,5);
  assert.ok(results.filter(x=>!x.allowed).every(x=>x.retryAfter>0 && x.retryAfter<=900));
  const again = namespace.getByName('per-ip');
  assert.equal((await again.attempt(hash('same-ip'))).allowed,false);
  assert.equal((await store.inspect()).attempts.length,5);
});

test('global sliding limit rejects attempts from new IPs without growing storage', async () => {
  const store = namespace.getByName('global');
  const results = await Promise.all(Array.from({length:45},(_,i)=>store.attempt(hash(`ip-${i}`))));
  assert.equal(results.filter(x=>x.allowed).length,30);
  assert.equal((await store.inspect()).attempts.length,30);
  assert.equal((await store.attempt(hash('new-ip'))).allowed,false);
  await store.expire();
  assert.equal((await store.attempt(hash('new-ip'))).allowed,true);
});

test('sessions expire, revoke, retain hashed values only, and cap at 100', async () => {
  const store = namespace.getByName('sessions');
  const token = hash('token-a');
  await store.create(token);
  assert.equal(await namespace.getByName('sessions').get(token),true);
  const first = (await store.inspect()).sessions[0];
  assert.equal(first.expires-first.created,8*60*60*1000);
  await store.create(token);
  assert.equal((await store.inspect()).sessions[0].expires,first.expires);
  await store.revoke(token);
  assert.equal(await store.get(token),false);
  for(let i=0;i<105;i++) await store.create(hash(`token-${i}`));
  assert.equal((await store.inspect()).sessions.length,100);
  await store.expire();
  assert.equal(await store.get(hash('token-104')),false);
  const final = await store.inspect();
  assert.equal(final.sessions.length,0);
  assert.equal(final.alarm,null);
});

test('auth store rejects raw addresses and malformed tokens', async () => {
  const store=namespace.getByName('invalid');
  for(const method of ['attempt','create','get','revoke']) await assert.rejects(store[method]('not-a-hash'));
});

test('missing auth config exposes only gate and never any protected asset path', async () => {
  const gate = await mf.dispatchFetch('https://boomerrawlings.com/ASSC/');
  assert.equal(gate.status,200);assert.equal(await gate.text(),'gate-only');
  for(const path of ['/ASSC/api/corpus','/ASSC/app.js','/ASSC/portraits/person.jpg','/ASSC/.private/corpus.json','/_protected/private/corpus.json','/_protected/client/app.html']) {
    const result = await mf.dispatchFetch(`https://boomerrawlings.com${path}`);
    assert.ok([401,404].includes(result.status),path);
    assert.ok(!(await result.text()).includes('PRIVATE'),path);
    assert.match(result.headers.get('Cache-Control'),/no-store/);
  }
  const login = await mf.dispatchFetch('https://boomerrawlings.com/ASSC/login',{method:'POST',headers:{Origin:'https://boomerrawlings.com','Content-Type':'application/json'},body:JSON.stringify({answer:'fixture'})});
  assert.equal(login.status,503);
});

test('Worker config requires interception of every asset with no alternate public hosts', async () => {
  const config=JSON.parse(await readFile(resolve(root,'wrangler.jsonc'),'utf8'));
  assert.equal(config.assets.run_worker_first,true);
  assert.equal(config.assets.not_found_handling,'none');
  assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
  assert.deepEqual(config.routes.map(x=>x.pattern),['boomerrawlings.com/ASSC','boomerrawlings.com/ASSC/*']);
  assert.ok(!JSON.stringify(config).includes('AUTH_CONFIG'));
});

test('actual Worker login unlocks shell aliases, corpus, transcript, original and portrait only after authentication',async()=>{
  await authenticatedStore.expire();reads.length=0;
  const gate=await call();assert.equal(gate.status,200);assert.equal(await gate.text(),'gate-only');
  for(const path of ['app.js','client/app.js','screen-motion.js','client/screen-motion.js','api/presentation','api/corpus','api/transcripts','api/transcripts/sample','api/transcripts/sample/original','portraits/person.jpg']) {
    const result=await call(path);assert.equal(result.status,401,path);assert.doesNotMatch(await result.text(),/private corpus|private transcript|private portrait|private original|private application/);
  }
  assert.deepEqual(reads,['/_protected/client/gate.html']);
  const wrong=await login('wrong');assert.equal(wrong.status,401);assert.equal(wrong.headers.get('set-cookie'),null);
  const correct=await login(`  ${fixturePasscode.toLowerCase()}  `);assert.equal(correct.status,200);
  const setCookie=correct.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);assert.match(setCookie,/; Secure/);assert.match(setCookie,/Path=\/ASSC/);assert.match(setCookie,/Max-Age=28800/);
  const Cookie=session(correct), headers={Cookie};
  assert.equal(await(await call('',{headers})).text(),'private-workspace-shell');
  for(const path of ['app.js','client/app.js'])assert.equal(await(await call(path,{headers})).text(),'/* private application module */');
  for(const path of ['screen-motion.js','client/screen-motion.js'])assert.equal(await(await call(path,{headers})).text(),'/* generic incoming motion */');
  assert.equal((await(await call('api/presentation',{headers})).json()).fixture,'protected presentation marker');
  const corpus=await call('api/corpus',{headers});assert.equal(corpus.status,200);assert.equal((await corpus.json()).meta.title,'private corpus marker');
  assert.equal((await(await call('api/transcripts/sample',{headers})).json()).turns[0].text,'private transcript text');
  assert.equal(await(await call('api/transcripts/sample/original',{headers})).text(),'private original bytes');
  assert.equal(await(await call('portraits/person.jpg',{headers})).text(),'private portrait bytes');
  const cached=await call('client/app.js',{headers:{Cookie,'If-None-Match':'fixture-etag'}});assert.equal(cached.status,200);assert.match(cached.headers.get('Cache-Control'),/no-store/);assert.match(cached.headers.get('X-Robots-Tag'),/noindex/);
  const head=await call('client/app.js',{method:'HEAD',headers});assert.equal(head.status,200);assert.equal(await head.text(),'');
});

test('actual Worker rotates, revokes copied sessions, enforces expiry, and refuses duplicate or forged cookies',async()=>{
  await authenticatedStore.expire();
  const cookie=session(await login());
  const rotated=session(await login(fixturePasscode,{Cookie:cookie}));assert.notEqual(rotated,cookie);
  assert.equal((await call('api/corpus',{headers:{Cookie:cookie}})).status,401);
  assert.equal((await call('api/corpus',{headers:{Cookie:`${rotated}; ${rotated}`}})).status,401);
  assert.equal((await call('api/corpus',{headers:{Cookie:`assc_session=${hash('forged')}`}})).status,401);
  const logout=await call('logout',{method:'POST',headers:{Origin:origin,Cookie:rotated}});assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await call('api/corpus',{headers:{Cookie:rotated}})).status,401);
  const expiring=session(await login());await authenticatedStore.expire();
  assert.equal((await call('api/corpus',{headers:{Cookie:expiring}})).status,401);
});

test('actual authenticated Worker rejects alternate hosts, cross-site writes and internal/traversal asset paths',async()=>{
  await authenticatedStore.expire();const Cookie=session(await login());reads.length=0;
  for(const path of ['.private/auth.json','_protected/private/corpus.json','client/../../auth.mjs','portraits/%2fsecret.jpg','api/transcripts/malicious-original/original','api/transcripts/%2e%2e/auth.json','client/graph.js.map','server.mjs']) {
    const result=await call(path,{headers:{Cookie}});assert.equal(result.status,404,path);
  }
  assert.equal((await call('api/transcripts/malicious-document',{headers:{Cookie}})).status,503);
  assert.ok(reads.every(path=>path==='/_protected/private/transcripts.json'));
  for(const url of ['https://assc-private-room.example.workers.dev/ASSC/api/corpus','https://preview.example/ASSC/client/app.js','https://boomerrawlings.com/_protected/private/corpus.json']) {
    const response=await authenticatedRuntime.dispatchFetch(url,{headers:{Cookie}});assert.ok([404,421].includes(response.status));assert.doesNotMatch(await response.text(),/private corpus marker|private application/);
  }
  for(const path of ['login','logout'])for(const headers of [{},{Origin:'https://attacker.example'},{Origin:origin,'Sec-Fetch-Site':'cross-site'}])assert.equal((await call(path,{method:'POST',headers:{Cookie,...headers},body:'answer=anything'})).status,403);
  assert.equal((await call('api/corpus',{headers:{Cookie}})).status,200);
});

test('actual Worker login rate limit is persisted before password verification',async()=>{
  await authenticatedStore.expire();
  for(let i=0;i<5;i++)assert.equal((await login('wrong')).status,401);
  const blocked=await login();assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);assert.equal(blocked.headers.get('set-cookie'),null);
});
