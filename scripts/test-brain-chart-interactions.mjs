import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

async function module(name){const output=await build({entryPoints:[fileURLToPath(new URL(`../src/scripts/brain/lectures/${name}.ts`,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));}
const {boundFigureView,fittedFigure,figurePoint,zoomFigureAt,viewForRegion,mountFigureInspector}=await module('figure-interactions');
const {clientChartPoint,probePosition,mountChartProbe}=await module('chart-interactions');
const {validateLectureCourse,LectureAccessError}=await module('access');
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1cAAAAASUVORK5CYII=';
const inspection={kind:'source-plot',dataAvailability:'image-only',source:{citation:'Synthetic source figure',page:2,figure:'Figure 1'},panels:[{id:'before',label:'Before',region:{x:.05,y:.1,width:.4,height:.8},interpretation:'Inspect the first source condition.',xAxis:'Reported time axis',yAxis:'Reported response axis'},{id:'after',label:'After',region:{x:.55,y:.1,width:.4,height:.8},interpretation:'Inspect the second source condition.'}]};

class Target{
  events=new Map();
  addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);}
  removeEventListener(type,fn){this.events.get(type)?.delete(fn);}
  fire(type,values={}){const event={type,target:this,button:0,pointerId:1,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};for(const fn of [...this.events.get(type)||[]])fn(event);return event;}
  listenerCount(){return[...this.events.values()].reduce((n,v)=>n+v.size,0);}
}
class Element extends Target{
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.className='';this._text='';this.value='';this.clientWidth=600;this.clientHeight=400;this.naturalWidth=1000;this.naturalHeight=500;this.captures=new Set();}
  set textContent(value){this._text=value;this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join(' ');}
  append(...children){for(const child of children){child.remove();child.parent=this;this.children.push(child);}}
  replaceChildren(...children){this.children.forEach(child=>child.parent=null);this.children=[];this._text='';this.append(...children);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  removeAttribute(k){delete this.attributes[k];if(k==='src')this.src='';}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  focus(){this.ownerDocument.activeElement=this;}
  getBoundingClientRect(){return this.rect||{left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);}
  querySelectorAll(selector){return all(this).filter(el=>selector.startsWith('.')?el.className.split(' ').includes(selector.slice(1)):el.tagName===selector);}
}
function all(root){return root.children.flatMap(child=>[child,...all(child)]);}
function find(root,predicate){return all(root).find(predicate);}
function environment(){const win=new Target(),doc={defaultView:win,createElement:tag=>new Element(tag,doc),createElementNS:(_,tag)=>new Element(tag,doc)},host=new Element('div',doc);return{win,doc,host};}
function button(host,text){const b=find(host,n=>n.tagName==='button'&&n.textContent===text);assert(b,`Missing button ${text}`);return b;}

test('Pan/zoom clamps at source boundaries, resets letterboxing, and zoom preserves a pointed source location',()=>{
  const image={width:1000,height:500},area={width:600,height:400};assert.deepEqual(fittedFigure(image,area),{width:600,height:300});
  const base={zoom:2,cx:.5,cy:.5},point=figurePoint(base,image,area,360,230),zoomed=zoomFigureAt(base,4,point,image,area);
  const next=figurePoint(zoomed,image,area,360,230);assert(Math.abs(next.x-point.x)<1e-12);assert(Math.abs(next.y-point.y)<1e-12);
  assert.deepEqual(boundFigureView({zoom:NaN,cx:Infinity,cy:-Infinity},image,area),{zoom:1,cx:.5,cy:.5});
  for(let i=0;i<500;i++){const view=boundFigureView({zoom:i/20,cx:Math.sin(i)*5,cy:Math.cos(i)*5},image,area),left=figurePoint(view,image,area,0,200).x,right=figurePoint(view,image,area,600,200).x;if(view.zoom>1){assert(left>=-1e-12);assert(right<=1+1e-12);}assert(view.zoom>=1&&view.zoom<=8);}
  const focus=viewForRegion({x:.55,y:.1,width:.4,height:.8},image,area);assert(focus.zoom>1&&focus.zoom<=8);assert(focus.cx>.5);
});
test('Actual source inspector selects verified panels and compares unmodified source crops with their axes',()=>{
  const env=environment(),figure={image:png,alt:'Two synthetic source panels',caption:'Original synthetic pixels',inspection:structuredClone(inspection)},api=mountFigureInspector(env.host,figure),image=find(env.host,n=>n.tagName==='img');image.fire('load');
  const viewport=find(env.host,n=>n.className==='figure-viewport');button(env.host,'After').fire('click');assert(Number(viewport.dataset.zoom)>1);assert.equal(button(env.host,'After').attributes['aria-pressed'],'true');assert(env.host.textContent.includes('Inspect the second source condition.'));
  const selects=all(env.host).filter(n=>n.tagName==='select');assert.equal(selects.length,2);selects[1].value='before';selects[1].fire('change');
  const crops=all(env.host).filter(n=>n.className==='figure-crop');assert.equal(crops.length,2);assert.equal(crops[0].children[0].style.width,'250%');assert.equal(crops[0].style.aspectRatio,'1');
  const comparison=find(env.host,n=>n.className==='figure-comparison'),disclosure=find(env.host,n=>n.className==='figure-compare');disclosure.open=true;disclosure.fire('toggle');assert(viewport.hidden&&!comparison.hidden);assert.equal(comparison.parent,viewport.parent,'Comparison must use the broad main canvas');for(const frame of all(env.host).filter(n=>n.className==='figure-crop')){assert(Number.parseFloat(frame.style.width)<=frame.parent.clientWidth);assert(Number.parseFloat(frame.style.height)<=frame.parent.clientHeight);assert.equal(Number.parseFloat(frame.style.width)/Number.parseFloat(frame.style.height),Number(frame.style.aspectRatio),'Crop must fit both dimensions without changing true aspect');}button(env.host,'Inspect this panel').fire('click');assert(!viewport.hidden&&comparison.hidden);assert.equal(env.doc.activeElement,viewport);
  assert(all(env.host).filter(n=>n.tagName==='img').every(n=>n.src===png));assert.equal(figure.image,png);assert(!env.host.textContent.includes('mV'),'A raster inspector must not invent axis measurements');
  const before=viewport.dataset.zoom;api.setActive(false);button(env.host,'+').fire('click');assert.equal(viewport.dataset.zoom,before);api.setActive(true);
  button(env.host,'Reset view').fire('click');assert.equal(viewport.dataset.zoom,'1');
  const key=viewport.fire('keydown',{key:'+'});assert(key.prevented&&key.stopped);assert(Number(viewport.dataset.zoom)>1);
  viewport.fire('keydown',{key:'Home'});assert.equal(viewport.dataset.zoom,'1');image.fire('error');assert(env.host.textContent.includes('could not be displayed'));
  const nodes=all(env.host);api.destroy();api.destroy();assert.equal(env.host.children.length,0);assert.equal(env.win.listenerCount(),0);assert(nodes.every(n=>n.listenerCount()===0));assert(nodes.filter(n=>n.tagName==='img').every(n=>!n.src&&!n.alt));
});
test('Temporary notes support pointer and keyboard placement, enforce eight-note bounds, and never persist',()=>{
  const env=environment(),api=mountFigureInspector(env.host,{image:png,alt:'Synthetic pixels'}),input=find(env.host,n=>n.tagName==='input'),viewport=find(env.host,n=>n.className==='figure-viewport'),image=find(env.host,n=>n.tagName==='img');image.fire('load');
  button(env.host,'Place note').fire('click');assert.equal(env.doc.activeElement,input);
  input.value='<script>text remains an observation</script>';button(env.host,'Place note').fire('click');viewport.fire('pointerdown',{clientX:300,clientY:200});viewport.fire('pointerup',{clientX:300,clientY:200});assert.equal(all(env.host).filter(n=>n.className==='figure-pin').length,1);assert(!all(env.host).some(n=>n.tagName==='script'));
  for(let i=0;i<10;i++){input.value=`Note ${i}`;button(env.host,'Note at view center').fire('click');}assert.equal(all(env.host).filter(n=>n.className==='figure-pin').length,8);assert(env.host.textContent.includes('Eight notes maximum'));
  button(env.host,'Clear notes').fire('click');assert.equal(all(env.host).filter(n=>n.className==='figure-pin').length,0);api.destroy();assert.equal(env.host.children.length,0);
});
test('Native chart mapping accounts for letterboxing, rejects malformed positions and keeps a keyboard-ready slider',()=>{
  assert.deepEqual(clientChartPoint({x:100,y:100},{left:0,top:0,width:200,height:200},{width:200,height:100}),{x:100,y:50});
  assert.equal(clientChartPoint({x:0,y:0},{left:0,top:0,width:0,height:0},{width:900,height:410}),null);assert.equal(probePosition(NaN,[0,20],.05),0);assert.equal(probePosition(99,[0,20],.05),20);
  const env=environment(),svg=new Element('svg',env.doc);svg.setAttribute('viewBox','0 0 900 410');svg.rect={left:0,top:0,width:900,height:410};let gain=2;const seeks=[];
  const api=mountChartProbe(env.host,svg,{label:'Inspect model response',bounds:{x:100,y:50,width:700,height:250},domain:[0,20],step:.05,xLabel:'Teaching time',sample:t=>[{label:'Voltage',value:t*gain,unit:'illustrative mV'}],context:()=>`Gain ${gain}`,onSeek:t=>seeks.push(t)});
  const slider=find(env.host,n=>n.tagName==='input'),output=find(env.host,n=>n.tagName==='output');svg.fire('pointermove',{clientX:450,clientY:100});assert.equal(slider.value,'10');assert(output.value.includes('20.0 illustrative mV'));assert.equal(seeks.length,0,'Hover does not unexpectedly pause playback');svg.fire('click',{clientX:450,clientY:100});assert.deepEqual(seeks,[10]);
  button(env.host,'Pin readout').fire('click');gain=3;api.refresh();assert(env.host.textContent.includes('Voltage change: 10.0 illustrative mV'));assert(env.host.textContent.includes('Gain 2'));
  slider.value='12';slider.fire('input');assert(output.value.includes('36.0'));button(env.host,'Go to this point').fire('click');assert.deepEqual(seeks,[10,12]);assert(slider.attributes['aria-valuetext'].includes('36.0'));
  api.setActive(false);slider.value='19';slider.fire('input');svg.fire('click',{clientX:100,clientY:100});assert.deepEqual(seeks,[10,12]);api.setActive(true);api.refresh();assert.equal(slider.value,'12');
  const nodes=[svg,...all(svg),...all(env.host)];api.destroy();api.destroy();assert.equal(env.host.children.length,0);assert.equal(svg.children.length,0);assert(nodes.every(n=>n.listenerCount()===0));
});
test('Encrypted-course validation preserves inspection on all figure routes, copies metadata and rejects fabricated data fields',()=>{
  const figure={image:png,alt:'Synthetic figure',inspection:structuredClone(inspection)},slide={id:'source-page',title:'Synthetic source',takeaway:'Synthetic takeaway.',bullets:[],sourceIds:[],reference:figure,visual:{kind:'figure',...figure},presentation:{title:'Synthetic title',layout:'gallery',groups:[],figures:[figure]}};
  const course={version:1,id:'synthetic-course',title:'Test course',instructor:'Teacher',term:'Test',moduleTitle:'Module',description:'Synthetic test material.',lectures:[{id:'lecture-one',number:1,title:'Lecture',week:'Week',summary:'Summary.',status:'ready',topics:[],resources:[],slides:[slide]}],connections:[],preview:{title:'Preview',description:'No private content.',slides:[]}};
  const valid=validateLectureCourse(course);assert.deepEqual(valid.lectures[0].slides[0].reference,figure);assert.deepEqual(valid.lectures[0].slides[0].visual.inspection,inspection);assert.deepEqual(valid.lectures[0].slides[0].presentation.figures[0].inspection,inspection);
  valid.lectures[0].slides[0].reference.inspection.panels[0].region.x=.2;assert.equal(course.lectures[0].slides[0].reference.inspection.panels[0].region.x,.05);
  for(const mutate of [i=>i.panels[0].region.width=1,i=>i.panels[0].region.y=NaN,i=>i.panels[0].region.height=0,i=>i.panels.push(structuredClone(i.panels[0])),i=>i.dataAvailability='tabular',i=>i.dataset=[[0,100]],i=>i.panels[0].rawValue=100,i=>i.source.url='javascript:alert(1)',i=>i.panels=Array.from({length:17},(_,n)=>({...i.panels[0],id:`panel-${n}`}))]){const bad=structuredClone(course);mutate(bad.lectures[0].slides[0].reference.inspection);assert.throws(()=>validateLectureCourse(bad),error=>error instanceof LectureAccessError&&error.code==='unavailable');}
});
