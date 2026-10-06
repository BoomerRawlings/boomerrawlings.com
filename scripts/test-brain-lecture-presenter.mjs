import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

// Execute production navigation, event handler and async lifecycle functions.
// The viewer is an injected deferred resource; no WebGL/DOM needed for races.
const source=(await transform(await readFile(new URL('../src/scripts/brain/lectures/presenter.ts',import.meta.url),'utf8'),{loader:'ts',target:'es2022'})).code;
function bodyEnd(text,start){
  let depth=0,quote='',escaped=false;
  for(let i=start;i<text.length;i++){
    const c=text[i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{')depth++;if(c==='}'&&--depth===0)return i;
  }throw Error('Unclosed production function');
}
function actualFunction(name){const at=source.indexOf(`function ${name}(`);assert(at>=0,`Missing ${name}`);const start=source.slice(Math.max(0,at-6),at)==='async '?at-6:at,body=source.indexOf('{',at);return source.slice(start,bodyEnd(source,body)+1);}
const slides=[{bullets:['A','B']},{bullets:[]},{bullets:['C']}];
const keyboardStart=source.indexOf('dialog.addEventListener("keydown",');assert(keyboardStart>=0);
const keyboardBody=source.indexOf('{',keyboardStart),keyboardText=source.slice(keyboardBody+1,bodyEnd(source,keyboardBody));
const keyboard=new Function('event','fixture',`const{overview=false}=fixture,deck={slides:[1,2,3]},laserEnabled=true,blanked=false,figureZoom=fixture.zoom||1;const lectureCanvas=()=>Boolean(fixture.canvas);function hideLaser(){}function move(value){fixture.moves.push(value)}function jump(value){fixture.jumps.push(value)}function setLaser(value){fixture.laser.push(value)}${keyboardText}`);
class Target{
  constructor(tag,parent=null){this.tag=tag;this.parent=parent;}
  closest(selector){return selector.split(',').some(part=>part===this.tag)?this:this.parent?.closest(selector)||null;}
}
function key(key,target=new Target('h2'),extra={}){const fixture={moves:[],jumps:[],laser:[],...extra.fixture},event={key,target,prevented:0,stopped:0,preventDefault(){this.prevented++;},stopPropagation(){this.stopped++;},...extra};keyboard(event,fixture);return{...fixture,prevented:event.prevented,stopped:event.stopped};}
test('Presentation shortcuts never consume model, native control or figure-pan keys',()=>{
  for(const tag of['input','select','textarea','button','a','summary','canvas','[contenteditable]','[role="slider"]','.figure-inspector'])for(const pressed of['ArrowRight','ArrowLeft',' ','PageDown','PageUp','Home','End','l']){
    const result=key(pressed,new Target('span',new Target(tag)));assert.deepEqual(result,{moves:[],jumps:[],laser:[],prevented:0,stopped:0},`${tag}: ${pressed}`);
  }
});
test('Presentation keys advance only once, retain modifiers and handle boundaries',()=>{
  for(const pressed of['ArrowRight','ArrowDown',' ','PageDown'])assert.deepEqual(key(pressed).moves,[1]);
  for(const pressed of['ArrowLeft','ArrowUp','PageUp'])assert.deepEqual(key(pressed).moves,[-1]);
  assert.deepEqual(key('Home').jumps,[0]);assert.deepEqual(key('End').jumps,[2]);assert.deepEqual(key('L').laser,[false]);
  for(const extra of[{altKey:true},{ctrlKey:true},{metaKey:true},{shiftKey:true},{defaultPrevented:true}])assert.equal(key('ArrowRight',undefined,extra).prevented,0);
});
const ensure=actualFunction('ensureViewer').replace('await import("../models")','await moduleLoader()');
assert(!ensure.includes('await import('),'Viewer import must be mocked, not loaded during lifecycle test');
const harness=new Function('moduleLoader',`
 let opened=true,destroyed=false,session=1,slideToken=0,figureVersion=0,viewer=null,viewerPromise=null,drag=null,deck={slides:[1]};
 let blanked=false;const speaker={close(){}};let exits=0,focuses=0,opener={isConnected:true,focus(){focuses++}};const modelHost={},elements=new Map(),document={fullscreenElement:null},dialog={open:true,close(){this.open=false}},figureImage={removeAttribute(){}};
 const control=key=>el(key);const el=key=>{if(!elements.has(key))elements.set(key,{replaceChildren(){},removeAttribute(){},close(){}});return elements.get(key)};
 function hideLaser(){}function closeImage(){}function stopLab(){}function stopFigure(){}function showSelection(){}function showNarrative(){}function renderViews(){}function showPhase(){}function onExit(){exits++}
 let focusedPart=null;
 ${ensure}
 ${actualFunction('close')}
 return{ensure:ensureViewer,close,seedOpener(value){opener=value},state:()=>({opened,viewer,exits,focuses,opener,status:el('model-status').textContent})};
`);
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
test('Close before lazy import completes creates no hidden viewer',async()=>{
 const module=deferred();let created=0;const player=harness(()=>module.promise),pending=player.ensure();player.close();player.close();module.resolve({createBrainViewer:async()=>{created++;return{dispose(){}}}});
 assert.equal(await pending,null);assert.equal(created,0);assert.equal(player.state().exits,1);assert.equal(player.state().focuses,1);
});
test('Close during viewer initialization disposes late result and ignores late status',async()=>{
 const instance=deferred();let disposed=0,options;
 const player=harness(async()=>({createBrainViewer:(_,value)=>{options=value;return instance.promise}})),pending=player.ensure();await Promise.resolve();await Promise.resolve();player.close();options.onStatus('stale');instance.resolve({dispose(){disposed++}});
 assert.equal(await pending,null);assert.equal(disposed,1);assert.equal(player.state().viewer,null);assert.equal(player.state().status,undefined);
});
test('Slides share one initialized viewer; close disposes it exactly once',async()=>{
 let created=0,disposed=0;const model={dispose(){disposed++}},player=harness(async()=>({createBrainViewer:async()=>{created++;return model}}));
 const [a,b]=await Promise.all([player.ensure(),player.ensure()]);assert.equal(a,model);assert.equal(b,model);assert.equal(await player.ensure(),model);assert.equal(created,1);player.close();player.close();assert.equal(disposed,1);assert.equal(player.state().viewer,null);
});
test('Actual close releases opener references after focus restoration and on an already-closed path',()=>{
 const player=harness(async()=>({createBrainViewer:async()=>null}));
 assert(player.state().opener);player.close();assert.equal(player.state().focuses,1,'Exit should restore focus once');assert.equal(player.state().opener,null,'An exited player must not retain the lecture button or its captured plaintext');
 const detached={isConnected:false,focus(){throw Error('Detached opener must not receive focus')}};
 player.seedOpener(detached);player.close();assert.equal(player.state().opener,null,'Repeated close / destroy cleanup must clear a stale opener even when already closed');assert.equal(player.state().exits,1);assert.equal(player.state().focuses,1);
});

const labSource=(await transform(await readFile(new URL('../src/scripts/brain/lectures/labs.ts',import.meta.url),'utf8'),{loader:'ts',target:'es2022'})).code;
function labFunction(name){const at=labSource.indexOf(`function ${name}(`),body=labSource.indexOf('{',at);assert(at>=0);return labSource.slice(at,bodyEnd(labSource,body)+1);}
const labs=new Function(`${['spikeVoltage','postsynapticVoltage','orientationRates'].map(labFunction).join('\n')};return{spikeVoltage,postsynapticVoltage,orientationRates};`)();
test('Spike diagram is continuous, all-or-none and loses its regenerative spike with Na block',()=>{
  for(const drive of[0,10,19,20,24,30]){
    let previous=labs.spikeVoltage(0,drive),peak=-Infinity,blockedPeak=-Infinity;
    for(let i=0;i<=40000;i++){
      const value=labs.spikeVoltage(i/2000,drive),blocked=labs.spikeVoltage(i/2000,drive,true);
      assert(Number.isFinite(value)&&Number.isFinite(blocked));assert(Math.abs(value-previous)<.05,`Discontinuous trace at drive ${drive}, time ${i/2000}`);previous=value;peak=Math.max(peak,value);blockedPeak=Math.max(blockedPeak,blocked);
    }
    assert.equal(labs.spikeVoltage(1,drive),-70);assert(Math.abs(labs.spikeVoltage(50,drive)+70)<.0001,'Recovery must approach rest');
    if(drive>=20)assert(Math.abs(peak-30)<.05,'Suprathreshold drive must not increase peak spike amplitude');else assert(peak<-50,'Subthreshold drive must not generate an action potential');
    assert(blockedPeak<=-40,'Na-blocked diagram must retain only the graded input, not an overshooting spike');
  }
});
test('Graded input timing and inhibition change summation without inventing an action potential',()=>{
  assert.equal(labs.postsynapticVoltage(1,5,0,false),-70,'Input cannot affect voltage before arrival');
  const sample=(count,spacing,inhibition)=>Array.from({length:2001},(_,i)=>labs.postsynapticVoltage(i/100,count,spacing,inhibition));
  const synchronous=sample(3,0,false),spaced=sample(3,4,false),inhibited=sample(3,0,true);
  assert(Math.max(...synchronous)>Math.max(...spaced)+10,'Closer input timing should strengthen the combined depolarization');
  assert(inhibited.every((value,i)=>value<=synchronous[i]),'The drawn inhibitory input must not raise this linear model voltage');
  assert(Math.abs(Math.max(...sample(1,0,false))+60)<.001,'One illustrative EPSP should peak 10mV above rest');
});
test('Orientation tuning respects 180° line symmetry and shared firing-rate scale',()=>{
  for(const width of[10,25,60]){
    assert.deepEqual(labs.orientationRates(0,width),labs.orientationRates(180,width),'0° and 180° describe the same line orientation');
    for(const [index,angle]of[0,45,90,135].entries()){
      const rates=labs.orientationRates(angle,width);assert.equal(rates[index],45);assert(rates.every(rate=>rate>=3&&rate<=45));
    }
  }
});

const presentStep=new Function(`${actualFunction('presentationStep')};return presentationStep;`)();
test('Lecture canvas advances full source pages without mandatory summary reveals',()=>{
 const sourceSlides=[{bullets:['hidden summary','another'],teaching:{steps:[{title:'Note',explanation:'Optional'}]}},{bullets:['full content already visible'],teaching:{steps:[]}}];
 assert.deepEqual(presentStep(sourceSlides,{index:0,revealed:0},1),{index:1,revealed:0});
 assert.equal(presentStep(sourceSlides,{index:1,revealed:0},1),'end');
 assert.deepEqual(presentStep(sourceSlides,{index:1,revealed:0},-1),{index:0,revealed:0});
 assert.deepEqual(presentStep(sourceSlides,{index:0,revealed:0},-1),{index:0,revealed:0});
 assert.deepEqual(presentStep(slides,{index:0,revealed:0},1),{index:1,revealed:0},'Reading guides also advance complete slides');
});


test('Lecture clicker navigation survives focused source canvas and presentation buttons',()=>{
 for(const tag of ['.lp-header','.lp-navigation','.lp-teaching-panel','.lp-footer-tools']){
   assert.deepEqual(key('ArrowRight',new Target('button',new Target(tag))).moves,[1]);
   assert.equal(key(' ',new Target('button',new Target(tag))).prevented,0,'Space keeps native button activation');
 }
 assert.deepEqual(key('ArrowRight',new Target('.figure-inspector'),{fixture:{canvas:true}}).moves,[],'Chart inspection keeps its pan keys at every zoom');
 assert.deepEqual(key('ArrowRight',new Target('.figure-inspector'),{fixture:{canvas:true,zoom:2}}).moves,[],'Zoomed source keeps its pan keys');
});


test('Closing an enlarged private figure disposes interaction data and returns the pointer',()=>{
 let disposed=0,cleared=0;const laser={},modal={closed:false,close(){this.closed=true}},main={focuses:0,focus(){this.focuses++}},children=[],host={replaceChildren(){cleared++}},title={textContent:'Private chart'};
 const fixture={inspector:{destroy(){disposed++}},el:key=>({'image-lightbox':modal,'expanded-figure':host,'image-title':title,laser,main})[key],dialog:{append(node){children.push(node)}},hideLaser(){}};
 const handle=new Function('fixture',`const {el,dialog,hideLaser}=fixture;let nativeInspector=fixture.inspector;${actualFunction('closeImage')};return{closeImage,get:()=>nativeInspector}`)(fixture);
 handle.closeImage(false);assert.equal(disposed,1);assert.equal(cleared,1);assert.equal(handle.get(),null);assert.equal(modal.closed,true);assert.deepEqual(children,[laser]);assert.equal(main.focuses,0);assert.equal(title.textContent,'Inspect figure');
 handle.closeImage();assert.equal(main.focuses,1);assert.equal(disposed,1,'Dispose once, even when exit also closes the lightbox');
});

test('Reopening the same slide preserves its loaded model instead of rebuilding separation and time',async()=>{
 let builds=0,resizes=0;const viewer={resize(){resizes++},setPlaying(){},setLabels(){},setTopic(){builds++}};
 const fn=new Function('viewer',`let loadedModelToken=-1,opened=true,slideToken=7,pendingRepresentation,labels=true;const topics=new Map([['fixture',{id:'fixture'}]]),modelHost={querySelector(){return null}};async function ensureViewer(){return viewer}function applyPlaying(){}${actualFunction('loadModel')};return loadModel`)(viewer);
 const slide={visual:{kind:'model',topicId:'fixture'}};await fn(slide,7);await fn(slide,7);assert.equal(builds,1);assert.equal(resizes,2);
});
