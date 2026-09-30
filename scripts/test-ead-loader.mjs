import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/ead/loader.js', import.meta.url), 'utf8');
const flush = () => new Promise(setImmediate);

// Exercise the real loader with controllable network, asset and readiness boundaries.
// DOM rendering and actual request isolation are checked separately in the browser.
function harness() {
  const requests = [], assets = [], timers = new Map();
  let sequence = 0, opens = 0, replacements = 0, outcome = 'not-started';
  let resolveFetch, rejectFetch;
  const workspace = {hidden:true,inert:true,replaceChildren() { replacements++; }};
  const document = new EventTarget();
  document.head = {append(node) { assets.push(node); }};
  document.getElementById = id => { assert.equal(id,'research-workspace');return workspace; };
  document.createElement = tag => {
    if (tag === 'template') {
      const template = {innerHTML:''};
      template.content = {querySelector(selector) { assert.equal(selector,'#main');return /id=["']main["']/.test(template.innerHTML) ? {} : null; }};
      return template;
    }
    assert(['link','script'].includes(tag));
    return {tag,removed:false,remove() { this.removed=true; }};
  };
  document.addEventListener('ead:open',()=>opens++);
  const context = {
    document,Event,AbortController,
    setTimeout(callback,delay) { const id=++sequence;timers.set(id,{callback,delay});return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url,options) {
      requests.push({url,options});
      return new Promise((resolve,reject)=>{
        resolveFetch=resolve;rejectFetch=reject;
        options.signal.addEventListener('abort',()=>reject(new Error('Request aborted')),{once:true});
      });
    },
  };
  runInNewContext(source,context,{filename:'public/ead/loader.js'});
  return {
    requests,assets,timers,workspace,document,
    get opens() { return opens; },get replacements() { return replacements; },get outcome() { return outcome; },
    load() {
      const promise=context.loadLEOWorkspace();outcome='pending';
      promise.then(()=>{outcome='fulfilled';},()=>{outcome='rejected';});
      return promise;
    },
    again() { return context.loadLEOWorkspace(); },
    async respond({ok=true,markup='<main id="main"></main>'}={}) { resolveFetch({ok,text:async()=>markup});await flush(); },
    async networkFailure() { rejectFetch(new Error('Network failed'));await flush(); },
    async finishAssets(tag) { for(const node of assets.filter(asset=>asset.tag===tag && asset.onload))node.onload();await flush(); },
    async failAsset(tag) { const node=assets.find(asset=>asset.tag===tag && asset.onerror);assert(node);node.onerror();await flush(); },
    async emit(type) { document.dispatchEvent(new Event(type));await flush(); },
    async timeout() { const timer=timers.values().next().value;assert(timer,'Expected pending timeout');timer.callback();await flush(); },
  };
}
function hidden(h) {
  assert(h.workspace.hidden&&h.workspace.inert,'The loader must not reveal the workspace');
}
async function assetsReady(h) {
  await h.respond();await h.finishAssets('link');await h.finishAssets('script');
  assert.equal(h.opens,1);assert.equal(h.outcome,'pending');hidden(h);
}

let cases=0;
{
  const h=harness();assert.equal(h.requests.length,0);assert.equal(h.assets.length,0);assert.equal(h.timers.size,0);assert.equal(h.replacements,0);hidden(h);cases++;
}
{
  const h=harness(),promise=h.load();assert.strictEqual(h.again(),promise,'Concurrent loads share the same promise');
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].url,'./workspace.html');
  assert.equal(h.requests[0].options.credentials,'omit');assert.equal(h.requests[0].options.referrerPolicy,'no-referrer');
  assert.equal(h.assets.length,0);assert.equal(h.opens,0);hidden(h);
  await h.respond();assert.equal(h.replacements,1);assert.equal(h.assets.length,6);
  assert(h.assets.every(asset=>asset.tag==='link'),'Scripts wait for stylesheet readiness');
  await h.emit('ead:atlas-ready');assert.equal(h.outcome,'pending','An early readiness event cannot bypass asset loading');
  h.assets[0].onload();await flush();assert.equal(h.assets.length,6);assert.equal(h.opens,0);
  await h.finishAssets('link');assert.equal(h.assets.filter(asset=>asset.tag==='script').length,5);
  const scripts=h.assets.filter(asset=>asset.tag==='script');
  for(const asset of scripts.slice(0,-1))asset.onload();await flush();assert.equal(h.opens,0,'Initialization waits for every script');
  scripts.at(-1).onload();await flush();assert.equal(h.opens,1);assert.equal(h.outcome,'pending','Initialization is not readiness');
  await h.emit('ead:atlas-ready');await promise;assert.equal(h.outcome,'fulfilled');assert.equal(h.timers.size,0);
  assert.strictEqual(h.again(),promise,'Successful loads stay cached');assert.equal(h.requests.length,1);assert.equal(h.opens,1);hidden(h);cases++;
}
for(const failure of ['http','network','incomplete-markup']) {
  const h=harness(),promise=h.load();
  if(failure==='http')await h.respond({ok:false});
  else if(failure==='network')await h.networkFailure();
  else await h.respond({markup:'<p>Incomplete response</p>'});
  await assert.rejects(promise);assert.equal(h.outcome,'rejected');assert.equal(h.assets.length,0);assert.equal(h.replacements,0);
  assert.equal(h.opens,0);assert.strictEqual(h.again(),promise,'Failures remain cached until explicit page reload');hidden(h);cases++;
}
for(const tag of ['link','script']) {
  const h=harness(),promise=h.load();await h.respond();if(tag==='script')await h.finishAssets('link');
  await h.failAsset(tag);await assert.rejects(promise);assert.equal(h.opens,0,'Failed assets must not initialize research');hidden(h);cases++;
}
{
  const h=harness(),promise=h.load();await assetsReady(h);await h.emit('ead:load-error');
  await assert.rejects(promise);assert.equal(h.outcome,'rejected');assert.equal(h.timers.size,0);
  await h.emit('ead:atlas-ready');assert.equal(h.outcome,'rejected','Late readiness cannot turn failure into success');hidden(h);cases++;
}
for(const stage of ['fetch','asset','readiness']) {
  const h=harness(),promise=h.load();
  if(stage==='asset')await h.respond();
  if(stage==='readiness')await assetsReady(h);
  await h.timeout();await assert.rejects(promise);assert.equal(h.outcome,'rejected');hidden(h);cases++;
}
console.log(`Verified ${cases} deferred EAD loader cases: idle isolation, shared promise, asset/readiness ordering, rejected loads and timeouts.`);
