import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { probePage } from '../src/probe-page.mjs';
import { DEFAULT_ROUTE, BOOKING_ROUTES } from '../src/routes.mjs';
import { DIRECT_PREPARATION_NOTES } from '../src/direct-tss.mjs';

test('probe page scripts compile, use owned API and omit booking mutation controls', async () => {
  const response = probePage(); const html = await response.text();
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(script); new vm.Script(script[2]);
  assert.ok(response.headers.get('Content-Security-Policy').includes(`'nonce-${script[1]}'`));
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal((html.match(/<option /g) || []).length, 20);
  assert.equal(/post\(['"]book['"]/.test(html), false);
  assert.equal(/console\.|localStorage|sessionStorage/.test(html), false);
  assert.match(html, /<details><summary>Login test diagnostics<\/summary>/);
  assert.match(script[2], /diagnostics\(data\);if\(!response.ok\)/);
});

test('probe login sends viewer dimensions without issuing another action', async () => {
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(await probePage().text())[2];
  const elements = new Map(), calls = [], urls = [];
  const document = { hidden: true, addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
  const context = vm.createContext({ document, URL, crypto, AbortController, setInterval() {}, setTimeout() {}, clearTimeout() {},
    window: { innerWidth: 509, innerHeight: 1516, open() { return { opener: {}, location: { replace(url) { urls.push(url); } }, close() { assert.fail('Unexpected popup closure'); } }; } },
    async fetch(url, init = {}) { calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
      return { ok: true, async json() { return { state: 'signing_in', csrf: 'synthetic', loginUrl: 'https://live.browser.run/ui/view?mode=tab' }; } }; } });
  vm.runInContext(script, context);
  await elements.get('login').onclick();
  assert.deepEqual(calls.map(call => call.url), ['/0311/api/login', '/0311/api/status']);
  assert.deepEqual(calls[0].body.viewport, { width: 509, height: 1000 });
  assert.deepEqual(urls, ['https://live.browser.run/ui/view?mode=tab']);
});

test('probe page renders bounded Fetch phase diagnostics without arbitrary fields', async () => {
  const html = await probePage().text();
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(html)[2];
  const elements = new Map();
  const document = { hidden: true, addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
  const context = vm.createContext({ document, setInterval() {}, input: { diagnostics: { guard: {
    pendingCount: 1, pending: [{ resourceType: 'Document', phase: 'response_body', ageMs: 2500, url: 'never-log' }],
    lastCompleted: { phase: 'request_continue', ageMs: 3000 }, lastFailure: { phase: 'response_fulfill', ageMs: 5000 },
    body: 'never-log', headers: 'never-log',
  } } } });
  vm.runInContext(script, context); vm.runInContext('diagnostics(input)', context);
  assert.equal(elements.get('diagnostics').textContent,
    'Fetch pending: 1\nFetch phase: Document response_body (2.5s)\nLast Fetch completion: request_continue (3s ago)\nLast Fetch failure: response_fulfill (5s ago)');
  context.input = { diagnostics: { guard: { pendingCount: 1001,
    pending: [{ resourceType: 'Document', phase: 'never-log', ageMs: 0 }, { resourceType: 'never-log', phase: 'request', ageMs: 0 },
      { resourceType: 'Document', phase: 'request', ageMs: Infinity }], lastFailure: { phase: 'never-log', ageMs: 0 } } } };
  vm.runInContext('diagnostics(input)', context);
  assert.equal(elements.get('diagnostics').textContent, 'No blocked requests or forms observed.');
});

test('preflight display allows only known renderer phases', async () => {
  const html = await probePage().text();
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(html)[2];
  const elements = new Map();
  const document = { hidden: true, addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
  const context = vm.createContext({ document, setInterval() {}, input: null });
  vm.runInContext(script, context);
  for (const phase of ['attach', 'page_enable', 'evaluate']) {
    context.input = { authDiagnostics: { stage: 'renderer_preflight', code: 'renderer_timeout', phase } };
    vm.runInContext('diagnostics(input)', context);
    assert.equal(elements.get('diagnostics').textContent,
      'Authentication stage: renderer_preflight\nAuthentication code: renderer_timeout\nAuthentication phase: ' + phase);
  }
  for (const authDiagnostics of [{ stage: 'renderer_preflight', phase: 'private_token' }, { stage: 'authentication', phase: 'evaluate' }]) {
    context.input = { authDiagnostics };
    vm.runInContext('diagnostics(input)', context);
    assert.doesNotMatch(elements.get('diagnostics').textContent, /Authentication phase|private_token/);
  }
});

test('automatic post-login checks run once, read-only, even while the login tab is visible', async () => {
  for (const ready of [true, false]) {
    const html = await probePage().text();
    const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(html)[2];
    const elements = new Map(), queued = [], calls = [], routes = [];
    const document = { hidden: true, addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
    document.getElementById('course').value = DEFAULT_ROUTE;
    const context = vm.createContext({ document, crypto, AbortController, setInterval() {}, clearTimeout() {},
      setTimeout(fn, delay) { if (delay === 0) queued.push(fn); },
      async fetch(url, init) {
        calls.push(url); assert.equal(init.method, 'POST');
        const route=JSON.parse(init.body).route;if(url.endsWith('/resolve-courses'))assert.equal(route,undefined);else{assert.equal(BOOKING_ROUTES.has(route),true);routes.push(route);}
        return { ok: true, async json() { return { state: 'ready', csrf: 'synthetic', loaded: ready, ready, csrfReady: true, equivalent: ready }; } };
      },
    });
    vm.runInContext(script, context);
    vm.runInContext("autoCompare=true;render({state:'ready',csrf:'synthetic'});render({state:'ready',csrf:'synthetic'})", context);
    assert.equal(queued.length, 1);
    queued[0](); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['/0311/api/resolve-courses',...Array(BOOKING_ROUTES.size).fill('/0311/api/verify-direct')]);
    assert.equal(routes[0],DEFAULT_ROUTE);assert.equal(BOOKING_ROUTES.get(routes[1]).courseCode,'ECON-100A');
    assert.equal(new Set(routes).size,BOOKING_ROUTES.size);
    assert.match(elements.get('proof').textContent, /No booking request was sent/);
    assert.equal((elements.get('audit').textContent.match(/No booking request was sent/g)||[]).length,BOOKING_ROUTES.size);
    assert.equal(calls.some(url => /\/(book|confirm|cancel)$/.test(url)), false);
  }
});

test('schema display drops unknown names and raw response content', async () => {
  const html = await probePage().text();
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(html)[2];
  const document = { hidden: true, addEventListener() {}, getElementById() { return {}; } };
  const context = vm.createContext({ document, setInterval() {} });
  vm.runInContext(script, context);
  const lines = vm.runInContext("schemaLines({readStage:'settings',schemaIssue:'not_collection',schemaIssues:[{readStage:'private-value',schemaIssue:'not_collection'}],settingShapes:{SHOW_TEMPLATE:'null',PRIVATE:'private-value'},raw:'private-value'})", context);
  assert.deepEqual(Array.from(lines), ['Read stage: settings', 'Response issue: not_collection', 'Setting format: SHOW_TEMPLATE = null']);
});

test('automatic audit stops before expiry or loss of authentication and never restarts login', async () => {
  for(const mode of ['expiry','authentication']){
    const script=/<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(await probePage().text())[2];
    const elements=new Map(),calls=[];
    const document={hidden:true,addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id)}};
    document.getElementById('course').value=DEFAULT_ROUTE;
    const context=vm.createContext({document,crypto,AbortController,setInterval(){},setTimeout(){},clearTimeout(){},async fetch(url){
      calls.push(url);return{ok:false,async json(){return{state:'signing_in',csrf:'synthetic',reason:'authentication_unavailable'}}};
    }});
    vm.runInContext(script,context);
    vm.runInContext("state='ready';csrf='synthetic';expiresAt=Date.now()+"+(mode==='expiry'?60000:900000),context);
    await vm.runInContext('autoCheck()',context);
    assert.deepEqual(calls,mode==='expiry'?[]:['/0311/api/resolve-courses']);
    assert.match(elements.get('audit').textContent,/Stopped/);
    assert.equal(vm.runInContext('auditing',context),false);
    if(mode==='authentication')assert.equal(vm.runInContext('state',context),'signing_in');
  }
});

test('visible-tab status recovery cannot restart the audit after a check rejects authentication', async () => {
  for (const failure of [{ state: 'signing_in' }, { state: 'expired' }, { csrfReady: false },
    { reason: 'authentication_required' }, { reason: 'authentication_unavailable' }]) {
    const script=/<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(await probePage().text())[2];
    const elements=new Map(),calls=[];
    const document={hidden:true,addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id)}};
    document.getElementById('course').value=DEFAULT_ROUTE;
    const context=vm.createContext({document,crypto,AbortController,setInterval(){},setTimeout(){},clearTimeout(){},async fetch(url){
      calls.push(url);return{ok:true,async json(){return {state:'ready',csrf:'synthetic',csrfReady:true,expiresAt:Date.now()+900000,
        ...(url.endsWith('/verify-direct')?{loaded:false,ready:false,...failure}:{})};}};
    }});
    vm.runInContext(script,context);document.hidden=false;
    vm.runInContext("state='ready';csrf='synthetic';expiresAt=Date.now()+900000",context);
    await vm.runInContext('autoCheck()',context);
    assert.deepEqual(calls,['/0311/api/resolve-courses','/0311/api/verify-direct','/0311/api/status']);
    assert.equal(vm.runInContext('state',context),'ready','later status really did restore ready');
    assert.match(elements.get('audit').textContent,/Stopped: the check could not confirm sign-in/);
    assert.equal((elements.get('audit').textContent.match(/No booking request was sent/g)||[]).length,1);
  }
});

test('resolver failure remains terminal for this audit even if a later status reports ready', async () => {
  for (const failure of [{ state: 'signing_in' }, { csrfReady: false }, { reason: 'authentication_required' },
    { catalog: { failures: [{ courseCode: 'ECON-120A', reason: 'authentication_required' }] } }]) {
    const script=/<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(await probePage().text())[2];
    const elements=new Map(),calls=[];
    const document={hidden:true,addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id)}};
    document.getElementById('course').value=DEFAULT_ROUTE;
    const context=vm.createContext({document,crypto,AbortController,setInterval(){},setTimeout(){},clearTimeout(){},async fetch(url){
      calls.push(url);return{ok:true,async json(){return {state:'ready',csrf:'synthetic',csrfReady:true,expiresAt:Date.now()+900000,
        ...(url.endsWith('/resolve-courses')?failure:{})};}};
    }});
    vm.runInContext(script,context);document.hidden=false;
    // An independent visible-tab status can complete after the resolver response.
    vm.runInContext("const originalResolve=resolveCatalog;resolveCatalog=async()=>{const result=await originalResolve();await status();return result;};state='ready';csrf='synthetic';expiresAt=Date.now()+900000",context);
    await vm.runInContext('autoCheck()',context);
    assert.deepEqual(calls,['/0311/api/resolve-courses','/0311/api/status']);
    assert.equal(vm.runInContext('state',context),'ready');
    assert.match(elements.get('audit').textContent,/Stopped: course lookup could not confirm sign-in/);
  }
});

test('comparison UI preserves seven known notes and only boolean eligibility without starting enrollment', async () => {
  const script=/<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(await probePage().text())[2];
  const elements=new Map(),calls=[];
  const document={hidden:true,addEventListener(){},getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id)}};
  document.getElementById('course').value=DEFAULT_ROUTE;
  let input;
  const context=vm.createContext({document,crypto,AbortController,setInterval(){},setTimeout(){},clearTimeout(){},async fetch(url){
    calls.push(url);return{ok:true,async json(){return input;}};
  }});
  vm.runInContext(script,context);
  for (const bookingEligible of [true,false,'true','private-token',1,null,{private:'student'}]) {
    input={state:'ready',csrf:'synthetic',loaded:true,ready:true,equivalent:true,csrfReady:true,bookingEligible,
      preparationNotes:[...DIRECT_PREPARATION_NOTES,'private-note',{private:'response'}],rawPayload:'private-student-data'};
    vm.runInContext("state='ready';csrf='synthetic'",context);
    await vm.runInContext("check('verify-direct')",context);
    const output=elements.get('proof').textContent;
    assert.match(output,/Matches TSS booking details: yes/);
    if(typeof bookingEligible==='boolean')assert.ok(output.includes('Local booking prechecks passed: '+(bookingEligible?'yes':'no')));
    else assert.doesNotMatch(output,/Enrollment checks passed/);
    for(const note of DIRECT_PREPARATION_NOTES)assert.ok(output.includes('Preparation note: '+note));
    assert.equal((output.match(/Preparation note:/g)||[]).length,7);
    assert.doesNotMatch(output,/private/);
  }
  assert.equal(calls.length,7);assert.ok(calls.every(url=>url==='/0311/api/verify-direct'));
});

test('trace display retains only fixed diagnostic classes and bounded timestamps', async () => {
  const script=/<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(await probePage().text())[2];
  const document={hidden:true,addEventListener(){},getElementById(){return{}}};
  const context=vm.createContext({document,setInterval(){},events:[
    {kind:'document_response',destination:'ucsd_idp',resourceType:'Document',method:'POST',route:'ucsd_saml_redirect',status:500,atMs:12000,count:1,body:'private-token'},
    {kind:'guard_failure',destination:'tss',resourceType:'Document',phase:'response_fulfill',issue:'timeout',atMs:12100,count:1,url:'private-token'},
    {kind:'auth_page',page:'ucsd_error',atMs:12200,count:1},
    {kind:'private-token',atMs:12300,count:1},
  ]});
  vm.runInContext(script,context);
  const lines=Array.from(vm.runInContext('traceLines(events)',context));
  assert.equal(lines.length,3);assert.match(lines[0],/ucsd_idp Document POST ucsd_saml_redirect HTTP 500/);
  assert.match(lines[1],/response_fulfill timeout/);assert.doesNotMatch(lines.join(''),/private-token/);
});

test('authentication errors replace pending Duo copy without retrying login', async () => {
  const script = /<script nonce="([a-f0-9]+)">([\s\S]*?)<\/script>/.exec(await probePage().text())[2];
  const elements = new Map(), calls = [];
  const document = { hidden: true, addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } };
  const context = vm.createContext({ document, setInterval() {}, fetch(url) { calls.push(url); throw Error('No request expected'); }, input: null });
  vm.runInContext(script, context);
  const show = (authentication, extra = {}) => {
    context.input = { state: 'signing_in', csrf: 'synthetic', authDiagnostics: { ...extra, authentication } };
    vm.runInContext('render(input)', context);
    return elements.get('status').textContent;
  };
  assert.match(show({ page: 'duo' }), /Complete Duo/);
  assert.equal(show({ page: 'ucsd_error', issue: 'ucsd_login_exception', message: 'private-login-data' }), 'UCSD sign-in returned an error. Check the sign-in tab.');
  assert.equal(show({ page: 'tss_proxy_error', issue: 'sso_handoff_failed', message: 'private-login-data' }), 'TSS could not finish sign-in. Check the sign-in tab.');
  assert.match(show({ page: 'tss', issue: 'service_unavailable' }), /temporarily unavailable.*sign-in stays open; checking again/);
  assert.match(show({ page: 'tss', issue: 'missing_csrf' }, { code: 'authentication_unavailable' }), /could not confirm sign-in/);
  assert.equal(elements.get('inspect').disabled, true);
  show({ page: 'private-login-data', issue: 'private-login-data' });
  assert.doesNotMatch(elements.get('diagnostics').textContent + elements.get('status').textContent, /private-login-data/);
  context.input = { state: 'ready', csrf: 'synthetic' }; vm.runInContext('render(input)', context);
  assert.equal(elements.get('status').textContent, 'TSS session is ready');
  assert.deepEqual(calls, []);
});
