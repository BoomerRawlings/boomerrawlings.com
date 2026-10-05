import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {build} from 'esbuild';

// Run the complete production companion against a small window/DOM adapter.
// No copied lifecycle logic: navigation invalidates the real update/open path.
const compiled=await build({entryPoints:[new URL('../src/scripts/brain/lectures/speaker-console.ts',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,platform:'node',format:'cjs',write:false});const code=compiled.outputFiles[0].text;
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes=new Map();this.events=new Map();this.hidden=false;this.disabled=false;this.textContent='';this.dataset={};this.style={setProperty(){}};}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;this.textContent='';}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  getAttribute(key){return this.attributes.get(key)??null;}
  removeAttribute(key){this.attributes.delete(key);}
  set src(value){this.setAttribute('src',value);}
  get src(){return this.getAttribute('src');}
  get options(){return this.children;}
  addEventListener(key,fn){this.events.set(key,fn);}
  click(){if(!this.disabled)this.events.get('click')?.();}
}
class Document{
  constructor(){this.documentElement=new Element('html');this.head=new Element('head');this.body=new Element('body');}
  createElement(tag){const e=new Element(tag);e.ownerDocument=this;return e;}
  createTextNode(text){return{textContent:text};}
  addEventListener(){}
  getElementById(id){const search=node=>node.id===id?node:(node.children||[]).map(search).find(Boolean);return search(this.body)||null;}
}
function harness(){
  const popups=[],timers=new Map();let nextTimer=0,blocked=false;
  const context={module:{exports:{}},Date,setInterval(fn){timers.set(++nextTimer,fn);return nextTimer;},clearInterval(id){timers.delete(id);},window:{open(){if(blocked)return null;const popup={document:new Document(),closed:false,focuses:0,focus(){this.focuses++;},addEventListener(){},close(){this.closed=true;}};popups.push(popup);return popup;}}};
  vm.runInNewContext(code,context);
  const calls={previous:0,next:0};
  const actions=Object.fromEntries(['previous','next'].map(name=>[name,()=>calls[name]++]));
  Object.assign(actions,{demo(){},blank(){},select(){}});
  const companion=context.module.exports.createSpeakerConsole(actions);
  return{companion,popups,timers,calls,block(){blocked=true;},el(id){return popups.at(-1).document.getElementById(id);}};
}
const slide={title:'Source slide',takeaway:'Teaching summary',bullets:['First point','Second point'],reference:{image:'data:image/webp;base64,private',alt:'Source'},visual:{kind:'figure',image:'data:image/webp;base64,private',alt:'Source'},presentation:{title:'Native complete lesson',layout:'text',groups:[{title:'Related ideas',items:['First point','Second point']}],figures:[]},teaching:{steps:[{title:'Gradient',explanation:'A concentration difference.'},{title:'Flux',explanation:'Movement through a channel.'}]}};
const state={title:'Lecture',index:0,slides:[slide],blanked:false,demo:false};

test('Reopening a navigated companion replaces it instead of focusing null',()=>{
  for(const crossOrigin of[false,true]){
    const h=harness();assert.equal(h.companion.open(state),true);const old=h.popups[0];
    if(crossOrigin)Object.defineProperty(old,'document',{get(){throw Error('SecurityError');}});else old.document.body.replaceChildren();
    assert.equal(h.companion.open(state),true);assert.equal(h.popups.length,2);assert(h.el('currentCanvas'));assert.equal(h.timers.size,1);
    h.companion.close();assert.equal(h.timers.size,0);assert.equal(h.popups[1].closed,true);assert.equal(h.popups[1].document.body.children.length,0);
  }
});
test('Invalid companion plus popup blocking returns false without leaving its timer',()=>{
  const h=harness();h.companion.open(state);h.popups[0].document.body.replaceChildren();h.block();
  assert.equal(h.companion.open(state),false);assert.equal(h.timers.size,0);
});
test('Native companion preview contains every related point and never the original source page',()=>{
 const h=harness();h.companion.open(state);
 const texts=node=>[node.textContent,...(node.children||[]).flatMap(texts)].join(' ');
 assert.match(texts(h.el('currentCanvas')),/Native complete lesson.*Related ideas.*First point.*Second point/);
 const images=node=>[...(node.tagName==='img'?[node.src]:[]),...(node.children||[]).flatMap(images)];
 assert.deepEqual(images(h.el('currentCanvas')),[]);assert.equal(h.el('explanationControls'),null);
 h.companion.close();
});

test('Presenter navigation moves complete slides, including reading guides',()=>{
 const h=harness(),reading={...slide};delete reading.presentation;delete reading.teaching;
 h.companion.open({...state,slides:[reading,slide]});
 assert.equal(h.el('previous').disabled,true);assert.equal(h.el('next').textContent,'Next slide →');
 h.el('next').click();assert.equal(h.calls.next,1);
 h.companion.update({...state,index:1,slides:[reading,slide]});assert.equal(h.el('previous').disabled,false);assert.equal(h.el('next').textContent,'Finish lecture');h.companion.close();
});
