import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

const source=await readFile(new URL('../src/scripts/brain/lectures/labs.ts',import.meta.url),'utf8');
const compiled=(await transform(source,{loader:'ts',target:'es2022',format:'esm'})).code;
const {createDemoClock,mountLectureLab,conductionState,populationSpikeTimes,spikeVoltage,postsynapticVoltage,orientationRates}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
function scheduler(){
  const callbacks=new Map();let next=0,timestamp=0;
  return{request(callback){const id=++next;callbacks.set(id,callback);return id;},cancel(id){callbacks.delete(id);},
    step(ms=50){timestamp+=ms;const current=[...callbacks.values()];callbacks.clear();current.forEach(callback=>callback(timestamp));},
    count:()=>callbacks.size,advance(ms){for(let i=0;i<ms/50;i++)this.step();}};
}
test('One clock advances gradually, suspends without time loss, and never leaves duplicate animation frames',()=>{
  const frames=scheduler(),renders=[],clock=createDemoClock(2,time=>renders.push(time),()=>{},true,frames);clock.start();
  assert.equal(frames.count(),1);frames.advance(500);assert(clock.state().time>.35&&clock.state().time<.55);
  clock.setActive(false);const frozen=clock.state().time;assert.equal(frames.count(),0);frames.advance(6000);assert.equal(clock.state().time,frozen);
  clock.setActive(true);clock.setActive(true);assert.equal(frames.count(),1);frames.step();assert.equal(clock.state().time,frozen,'No elapsed hidden time applied');
  frames.step();assert(clock.state().time>frozen);clock.setVisible(false);assert.equal(frames.count(),0);clock.setVisible(true);assert.equal(frames.count(),1);
  clock.pause();clock.setActive(false);clock.setActive(true);assert.equal(frames.count(),0,'Explicit user pause survives hiding');
  clock.replay();assert.equal(clock.state().time,0);assert.equal(frames.count(),1);frames.advance(3000);assert.equal(clock.state().time,2);assert.equal(clock.state().playing,false);assert.equal(frames.count(),0);
  clock.play();assert.equal(clock.state().time,0);clock.dispose();clock.play();clock.replay();clock.start();assert.equal(frames.count(),0);
});
test('Scrubbing pauses, clamps invalid times, and a reduced-motion start creates no RAF',()=>{
  const frames=scheduler(),rendered=[],clock=createDemoClock(10,time=>rendered.push(time),()=>{},false,frames);clock.start();assert.equal(frames.count(),0);
  clock.seek(6.2);assert.equal(clock.state().time,6.2);assert.equal(clock.state().playing,false);assert.equal(frames.count(),0);
  clock.seek(Infinity);assert.equal(clock.state().time,0);clock.seek(100);assert.equal(clock.state().time,10);clock.seek(-5);assert.equal(clock.state().time,0);
  clock.play();frames.step();frames.step(60000);assert(clock.state().time<=.12,'A throttled frame cannot skip the demonstration');clock.dispose();
});

class Target{
  events=new Map();
  addEventListener(type,callback){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(callback);}
  removeEventListener(type,callback){this.events.get(type)?.delete(callback);}
  dispatch(type){for(const callback of this.events.get(type)||[])callback({target:this,type});}
  listenerCount(){return[...this.events.values()].reduce((sum,list)=>sum+list.size,0);}
}
class Element extends Target{
  constructor(tag){super();this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.textContent='';this.className='';this.value='';}
  setAttribute(key,value){this.attributes[key]=String(value);}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
}
function find(element,predicate){if(predicate(element))return element;for(const child of element.children){const result=find(child,predicate);if(result)return result;}return null;}
function serialized(element){return JSON.stringify([element.tagName,element.textContent,element.attributes,element.children.map(serialized)]);}
function environment(reduce=false){
  const frames=scheduler(),document=new Target(),media=new Target();document.hidden=false;document.createElement=tag=>new Element(tag);document.createElementNS=(_,tag)=>new Element(tag);media.matches=reduce;
  const values={document,window:{matchMedia:()=>media},requestAnimationFrame:callback=>frames.request(callback),cancelAnimationFrame:id=>frames.cancel(id)},old={};
  for(const[key,value]of Object.entries(values)){old[key]=globalThis[key];globalThis[key]=value;}
  return{frames,document,media,host:new Element('div'),restore(){for(const[key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}};
}
for(const lab of['spike','summation','rate-code','propagation'])test(`${lab}: actual mounted diagram animates, scrubs, suspends and completely cleans up`,()=>{
  const env=environment();try{
    const cleanup=mountLectureLab(env.host,lab),svg=find(env.host,e=>e.tagName==='svg'),timeline=find(env.host,e=>e.attributes['aria-label']==='Demonstration time'),play=find(env.host,e=>e.dataset.action==='play');
    const initial=serialized(svg);assert.equal(env.frames.count(),1);env.frames.advance(2000);assert.notEqual(serialized(svg),initial,'Visible geometry must progress without changing a slider');
    cleanup.setActive(false);const frozen=serialized(svg),time=timeline.value;assert.equal(env.frames.count(),0);env.frames.advance(5000);assert.equal(serialized(svg),frozen);
    cleanup.setActive(true);env.frames.step();assert.equal(timeline.value,time,'Reactivation preserves the exact position');assert.equal(env.frames.count(),1);
    timeline.value='500';timeline.dispatch('input');assert.equal(env.frames.count(),0);assert.equal(play.textContent,'Play');assert.equal(timeline.value,'500');assert.notEqual(serialized(svg),initial);
    play.dispatch('click');assert.equal(env.frames.count(),1);env.document.hidden=true;env.document.dispatch('visibilitychange');assert.equal(env.frames.count(),0);
    env.document.hidden=false;env.document.dispatch('visibilitychange');assert.equal(env.frames.count(),1);
    env.media.matches=true;env.media.dispatch('change');assert.equal(env.frames.count(),0);assert.equal(play.textContent,'Play');
    cleanup();cleanup();cleanup.setActive(true);assert.equal(env.host.children.length,0);assert.equal(env.frames.count(),0);assert.equal(env.document.listenerCount(),0);assert.equal(env.media.listenerCount(),0);
  }finally{env.restore();}
});
test('Reduced-motion mounting stays paused; changing conditions resets and pauses while preserving chosen values',()=>{
  const env=environment(true);try{
    const cleanup=mountLectureLab(env.host,'spike'),drive=find(env.host,e=>e.attributes['aria-label']==='Depolarizing drive (mV)'),play=find(env.host,e=>e.dataset.action==='play'),timeline=find(env.host,e=>e.attributes['aria-label']==='Demonstration time');
    assert.equal(env.frames.count(),0);play.dispatch('click');env.frames.advance(500);drive.value='12';drive.dispatch('input');assert.equal(drive.value,'12');assert.equal(timeline.value,'0');assert.equal(env.frames.count(),0);cleanup.setActive(false);cleanup.setActive(true);assert.equal(drive.value,'12');assert.equal(env.frames.count(),0);cleanup();
  }finally{env.restore();}
});
test('Methods remains a deliberate static comparison with no animation loop',()=>{
  const env=environment();try{const cleanup=mountLectureLab(env.host,'methods');assert.equal(env.frames.count(),0);cleanup.setActive(false);cleanup.setActive(true);assert.equal(env.frames.count(),0);cleanup();}finally{env.restore();}
});
test('Conduction progresses monotonically, starts together and reaches the myelinated end first',()=>{
  let previous={continuous:0,saltatory:0};
  for(let i=0;i<=1000;i++){const state=conductionState(i/1000);for(const key of['continuous','saltatory']){assert(state[key]>=previous[key]&&state[key]>=0&&state[key]<=1);}
    assert(state.saltatory>=state.continuous);previous=state;}
  assert.equal(conductionState(0).initiated,false);assert.equal(conductionState(.07).continuous,0);assert.equal(conductionState(.6).saltatory,1);assert(conductionState(.6).continuous<1);assert.equal(conductionState(1).continuous,1);
});
test('Population spike histories retain past stimulus timing and remain ordered for replay/scrubbing',()=>{
  const sweep=populationSpikeTimes(0,25,true),fixed=populationSpikeTimes(0,25,false);
  for(const events of sweep){assert(events.length>0);events.forEach((value,i)=>{assert(value>0&&value<=1);if(i)assert(value>events[i-1]);});}
  assert.deepEqual(sweep,populationSpikeTimes(0,25,true),'Replay is deterministic');
  assert(fixed[0].length>fixed[2].length*5,'A preferred fixed stimulus has a greater rate');
  assert(sweep[0].filter(t=>t<.15).length>sweep[2].filter(t=>t<.15).length);
  assert(sweep[2].filter(t=>t>.4&&t<.6).length>sweep[0].filter(t=>t>.4&&t<.6).length,'History reflects instantaneous orientation, not the final angle');
});
test('Existing voltage and rate semantics remain continuous, all-or-none and correctly summed',()=>{
  for(const drive of[0,10,19,20,24,30]){let previous=spikeVoltage(0,drive),peak=-Infinity;for(let i=0;i<=40000;i++){const value=spikeVoltage(i/2000,drive);assert(Math.abs(value-previous)<.05);previous=value;peak=Math.max(peak,value);}assert(drive>=20?Math.abs(peak-30)<.05:peak<-50);assert(spikeVoltage(6,drive,true)<-40);}
  const peak=(spacing,inhib)=>Math.max(...Array.from({length:401},(_,i)=>postsynapticVoltage(i/20,3,spacing,inhib)));
  assert(peak(1,false)>peak(4,false));assert(peak(1,true)<peak(1,false));assert.equal(postsynapticVoltage(4,1,0,false),-60);
  assert.deepEqual(orientationRates(0,25),orientationRates(180,25));assert.equal(orientationRates(45,25)[1],45);
});
