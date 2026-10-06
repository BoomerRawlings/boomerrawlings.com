import type {FigureRegion,LectureFigure} from './types';

export type FigureView={zoom:number;cx:number;cy:number};
type Size={width:number;height:number};
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const finite=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback;
export function fittedFigure(image:Size,viewport:Size){
  const width=Math.max(1,finite(image.width,1)),height=Math.max(1,finite(image.height,1));
  const ratio=Math.min(Math.max(1,viewport.width)/width,Math.max(1,viewport.height)/height);return{width:width*ratio,height:height*ratio};
}
/** Centers are normalized source-image coordinates, never graph measurements. */
export function boundFigureView(view:FigureView,image:Size,viewport:Size):FigureView{
  const fit=fittedFigure(image,viewport),zoom=clamp(finite(view.zoom,1),1,8),hx=Math.min(1,viewport.width/(fit.width*zoom))/2,hy=Math.min(1,viewport.height/(fit.height*zoom))/2;
  return{zoom,cx:clamp(finite(view.cx,.5),hx,1-hx),cy:clamp(finite(view.cy,.5),hy,1-hy)};
}
export function figurePoint(view:FigureView,image:Size,viewport:Size,x:number,y:number){
  const fit=fittedFigure(image,viewport);return{x:view.cx+(x-viewport.width/2)/(fit.width*view.zoom),y:view.cy+(y-viewport.height/2)/(fit.height*view.zoom)};
}
export function zoomFigureAt(view:FigureView,zoom:number,point:{x:number;y:number},image:Size,viewport:Size){
  const next=clamp(finite(zoom,1),1,8);return boundFigureView({zoom:next,cx:point.x-(point.x-view.cx)*view.zoom/next,cy:point.y-(point.y-view.cy)*view.zoom/next},image,viewport);
}
export function viewForRegion(region:FigureRegion,image:Size,viewport:Size):FigureView{
  const fit=fittedFigure(image,viewport);return boundFigureView({zoom:Math.min(viewport.width/(fit.width*region.width),viewport.height/(fit.height*region.height))*.88,cx:region.x+region.width/2,cy:region.y+region.height/2},image,viewport);
}

export type FigureInspector={destroy:()=>void;setActive:(active:boolean)=>void};
/** All observations are temporary memory. The original image remains untouched. */
export function mountFigureInspector(host:HTMLElement,figure:LectureFigure):FigureInspector{
  const doc=host.ownerDocument,win=doc.defaultView;
  const make=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const n=doc.createElement(tag);n.textContent=text;n.className=className;return n;};
  const shell=make('section','','figure-inspector'),toolbar=make('div','','figure-tools'),viewport=make('div','','figure-viewport'),layer=make('div','','figure-layer'),image=make('img'),overlay=make('div','','figure-overlays'),sidebar=make('div','','figure-sidebar');
  shell.setAttribute('aria-label',figure.inspection?'Source chart inspector':'Figure inspector');viewport.tabIndex=0;viewport.setAttribute('role','group');viewport.setAttribute('aria-label','Figure. Plus and minus zoom; arrow keys pan; Home resets. Drag to pan.');
  image.src=figure.image;image.alt=figure.alt;image.draggable=false;layer.append(image,overlay);viewport.append(layer);
  const readout=make('output','100%'),status=make('p','','figure-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const listeners:(()=>void)[]=[];
  function listen(target:EventTarget,type:string,fn:EventListener,options?:AddEventListenerOptions){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
  function button(label:string,action:()=>void){const b=make('button',label);b.type='button';listen(b,'click',()=>{if(active&&!disposed)action();});return b;}
  let disposed=false,active=true,view:FigureView={zoom:1,cx:.5,cy:.5},dimensions:Size={width:1,height:1},drag:{id:number;x:number;y:number;view:FigureView;moved:boolean}|null=null;
  let selected:string|null=null,placing=false;const pins:{x:number;y:number;text:string}[]=[];
  const panelButtons=new Map<string,HTMLButtonElement>(),inspection=figure.inspection,panels=inspection?.panels||[];
  function size(){return{width:Math.max(1,viewport.clientWidth),height:Math.max(1,viewport.clientHeight)};}
  function paint(){
    if(disposed||viewport.hidden||!viewport.clientWidth||!viewport.clientHeight)return;const area=size(),fit=fittedFigure(dimensions,area);view=boundFigureView(view,dimensions,area);
    layer.style.width=`${fit.width}px`;layer.style.height=`${fit.height}px`;layer.style.transform=`translate(-50%, -50%) translate(${(.5-view.cx)*fit.width*view.zoom}px, ${(.5-view.cy)*fit.height*view.zoom}px) scale(${view.zoom})`;
    readout.value=`${Math.round(view.zoom*100)}%`;viewport.dataset.zoom=String(view.zoom);overlay.style.setProperty('--figure-zoom',String(view.zoom));
  }
  function zoom(factor:number,point={x:view.cx,y:view.cy}){view=zoomFigureAt(view,view.zoom*factor,point,dimensions,size());paint();}
  const reset=button('Reset view',()=>{view={zoom:1,cx:.5,cy:.5};paint();});
  toolbar.append(button('−',()=>zoom(1/1.4)),readout,button('+',()=>zoom(1.4)),reset);
  (toolbar.children[0] as HTMLElement).setAttribute('aria-label','Zoom out');(toolbar.children[2] as HTMLElement).setAttribute('aria-label','Zoom in');
  const help=make('p','Drag to pan · + / − zoom · arrows pan · Home resets','figure-help');
  const panelList=make('div','','figure-panels'),interpretation=make('div','','figure-interpretation');
  const selection=make('div','','figure-region');selection.hidden=true;overlay.append(selection);
  function selectPanel(id:string,exitComparison=true){
    const panel=panels.find(p=>p.id===id);if(!panel)return;if(exitComparison)showComparison(false);selected=id;view=viewForRegion(panel.region,dimensions,size());paint();
    const r=panel.region;selection.hidden=false;Object.assign(selection.style,{left:`${r.x*100}%`,top:`${r.y*100}%`,width:`${r.width*100}%`,height:`${r.height*100}%`});
    panelButtons.forEach((button,key)=>button.setAttribute('aria-pressed',String(key===id)));
    interpretation.replaceChildren(make('h4',panel.label),make('p',panel.interpretation));
    if(panel.xAxis)interpretation.append(make('p',`Horizontal axis: ${panel.xAxis}`));if(panel.yAxis)interpretation.append(make('p',`Vertical axis: ${panel.yAxis}`));status.textContent=`Inspecting ${panel.label}.`;
  }
  if(inspection){
    for(const panel of panels){const b=button(panel.label,()=>selectPanel(panel.id));b.setAttribute('aria-pressed','false');panelButtons.set(panel.id,b);panelList.append(b);}
    const kind=inspection.kind==='source-plot'?'Source plot':inspection.kind==='simulation'?'Simulation figure':'Illustrative diagram';
    sidebar.append(make('p',`${kind} · ${inspection.dataAvailability==='image-only'?'Image only; numerical data unavailable':'Reported summary; no raw measurements loaded'}`,'figure-provenance'));
  }
  const compare=make('details','','figure-compare'),compareTitle=make('summary','Compare source panels'),selectors=make('div','','figure-compare-selectors'),comparison=make('div','','figure-comparison');comparison.hidden=true;
  const comparisonFrames:{slot:HTMLElement;frame:HTMLElement;aspect:number}[]=[];let cropObserver:ResizeObserver|null=null;
  function fitComparison(){if(disposed||comparison.hidden)return;for(const {slot,frame,aspect}of comparisonFrames){if(!slot.clientWidth||!slot.clientHeight)continue;const fit=fittedFigure({width:aspect,height:1},{width:slot.clientWidth,height:slot.clientHeight});frame.style.width=`${fit.width}px`;frame.style.height=`${fit.height}px`;}}
  const back=button('Back to source',()=>showComparison(false));back.hidden=true;toolbar.append(back);
  function showComparison(open:boolean){compare.open=open;viewport.hidden=open;comparison.hidden=!open;for(const control of Array.from(toolbar.children))if(control!==back)(control as HTMLElement).hidden=open;back.hidden=!open;help.textContent=open?'Compare source-labeled axes and conditions. Inspect a panel to pan and zoom it.':'Drag to pan · + / − zoom · arrows pan · Home resets';if(open)comparePanels();else paint();}
  function crop(panel:typeof panels[number]){
    const f=make('figure'),slot=make('div','','figure-crop-slot'),frame=make('div','','figure-crop'),img=make('img'),r=panel.region,aspect=dimensions.width*r.width/(dimensions.height*r.height);
    frame.style.aspectRatio=String(aspect);comparisonFrames.push({slot,frame,aspect});img.src=figure.image;img.alt=`${panel.label}: ${figure.alt}`;img.draggable=false;
    Object.assign(img.style,{width:`${100/r.width}%`,height:`${100/r.height}%`,left:`${-r.x/r.width*100}%`,top:`${-r.y/r.height*100}%`});
    const inspect=make('button','Inspect this panel');inspect.type='button';const choose=()=>{if(!active||disposed)return;selectPanel(panel.id);viewport.focus();};inspect.addEventListener('click',choose);compareListeners.push(()=>inspect.removeEventListener('click',choose));
    frame.append(img);slot.append(frame);f.append(slot,make('figcaption',panel.label),make('p',panel.interpretation),inspect);return f;
  }
  const selects:HTMLSelectElement[]=[],compareListeners:(()=>void)[]=[];
  function comparePanels(){if(disposed||selects.length<2)return;compareListeners.forEach(remove=>remove());compareListeners.length=0;cropObserver?.disconnect();comparisonFrames.length=0;comparison.replaceChildren(...selects.map(s=>panels.find(p=>p.id===s.value)).filter((p):p is typeof panels[number]=>Boolean(p)).map(crop));comparisonFrames.forEach(({slot})=>cropObserver?.observe(slot));fitComparison();}
  if(panels.length>1){
    for(const [index,labelText]of ['Panel A','Panel B'].entries()){
      const label=make('label',labelText),select=make('select');select.setAttribute('aria-label',labelText);
      panels.forEach(panel=>{const option=make('option',panel.label);option.value=panel.id;select.append(option);});select.value=panels[index].id;selects.push(select);listen(select,'change',()=>{if(active)comparePanels();});label.append(select);selectors.append(label);
    }
    compare.append(compareTitle,selectors,make('p','Panels are enlarged independently. Compare their labeled axes and conditions; pixel sizes are not measurement units.'));comparePanels();
    listen(compare,'toggle',()=>showComparison(compare.open));
  }
  const notes=make('details','','figure-notes'),noteTitle=make('summary','Make a temporary observation'),noteLabel=make('label','Observation'),noteInput=make('input'),noteList=make('ul');
  noteInput.type='text';noteInput.maxLength=240;noteInput.placeholder='Your observation, not source data';noteLabel.append(noteInput);
  const place=button('Place note',()=>{if(!noteInput.value.trim()){status.textContent='Write an observation before placing it.';noteInput.focus();return;}if(pins.length>=8){status.textContent='Eight notes maximum. Clear notes to start again.';return;}placing=!placing;place.setAttribute('aria-pressed',String(placing));viewport.dataset.placing=String(placing);status.textContent=placing?'Click the figure to place your observation.':'Placement canceled.';});place.setAttribute('aria-pressed','false');
  function paintPins(){
    for(const marker of Array.from(overlay.querySelectorAll('.figure-pin')))marker.remove();noteList.replaceChildren();
    pins.forEach((pin,index)=>{const marker=make('span',String(index+1),'figure-pin');marker.setAttribute('aria-hidden','true');Object.assign(marker.style,{left:`${pin.x*100}%`,top:`${pin.y*100}%`});overlay.append(marker);noteList.append(make('li',`${index+1}. ${pin.text}`));});
  }
  function addPin(point:{x:number;y:number}){const text=noteInput.value.trim().slice(0,240);if(!text||pins.length>=8){status.textContent=!text?'Write an observation first.':'Eight notes maximum. Clear notes to start again.';return;}pins.push({...point,text});noteInput.value='';placing=false;place.setAttribute('aria-pressed','false');viewport.dataset.placing='false';paintPins();status.textContent='Observation placed. It will disappear when this view closes.';}
  notes.append(noteTitle,noteLabel,place,button('Note at view center',()=>addPin({x:view.cx,y:view.cy})),button('Clear notes',()=>{pins.length=0;placing=false;place.setAttribute('aria-pressed','false');viewport.dataset.placing='false';paintPins();status.textContent='Temporary notes cleared.';}),make('p','Notes stay in this view only and disappear when it closes. They do not alter the source.'),noteList);
  sidebar.append(panelList,interpretation,status);if(panels.length>1)sidebar.append(compare);sidebar.append(notes);
  if(figure.caption)sidebar.append(make('p',figure.caption,'figure-caption'));
  if(inspection){const source=inspection.source;sidebar.append(make('p',`Source: ${source.citation}${source.figure?` · ${source.figure}`:''}${source.page?` · page ${source.page}`:''}`,'figure-source'));}
  shell.append(toolbar,help,viewport,comparison,sidebar);
  host.replaceChildren(shell);
  function local(event:PointerEvent|WheelEvent){const r=viewport.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
  listen(viewport,'wheel',((event:WheelEvent)=>{if(!active)return;event.preventDefault();const p=local(event);zoom(Math.exp(-clamp(event.deltaY,-100,100)*.005),figurePoint(view,dimensions,size(),p.x,p.y));}) as EventListener,{passive:false});
  listen(viewport,'pointerdown',((event:PointerEvent)=>{if(!active||event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,view:{...view},moved:false};viewport.setPointerCapture?.(event.pointerId);}) as EventListener);
  listen(viewport,'pointermove',((event:PointerEvent)=>{if(!active||!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.moved ||= Math.hypot(dx,dy)>4;if(placing)return;const fit=fittedFigure(dimensions,size());view=boundFigureView({...drag.view,cx:drag.view.cx-dx/(fit.width*view.zoom),cy:drag.view.cy-dy/(fit.height*view.zoom)},dimensions,size());paint();}) as EventListener);
  function release(event:PointerEvent){
    if(!drag||drag.id!==event.pointerId)return;const moved=drag.moved;drag=null;if(viewport.hasPointerCapture?.(event.pointerId))viewport.releasePointerCapture(event.pointerId);
    if(!active||!placing||moved||event.type==='pointercancel')return;const p=local(event),point=figurePoint(view,dimensions,size(),p.x,p.y);
    if(point.x<0||point.x>1||point.y<0||point.y>1){status.textContent='Choose a point inside the source image.';return;}
    addPin(point);
  }
  listen(viewport,'pointerup',release as EventListener);listen(viewport,'pointercancel',release as EventListener);
  listen(viewport,'keydown',((event:KeyboardEvent)=>{if(!active)return;const step=event.shiftKey?.16:.06;let handled=true;
    if(event.key==='+'||event.key==='=')zoom(1.4);else if(event.key==='-')zoom(1/1.4);else if(event.key==='Home'){view={zoom:1,cx:.5,cy:.5};paint();}
    else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){view.cx+=(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/view.zoom;view.cy+=(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/view.zoom;paint();}else handled=false;
    if(handled){event.preventDefault();event.stopPropagation();}}) as EventListener);
  listen(image,'load',()=>{if(disposed)return;dimensions={width:image.naturalWidth||1,height:image.naturalHeight||1};if(selected)selectPanel(selected,false);else paint();comparePanels();});
  listen(image,'error',()=>{if(!disposed)status.textContent='The source figure could not be displayed. Its explanation and source information remain available.';});
  const resize=()=>{paint();fitComparison();};win?.addEventListener('resize',resize);const observer=win&&typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;observer?.observe(viewport);cropObserver=win&&typeof ResizeObserver!=='undefined'?new ResizeObserver(fitComparison):null;comparisonFrames.forEach(({slot})=>cropObserver?.observe(slot));paint();
  function cancelDrag(){if(drag&&viewport.hasPointerCapture?.(drag.id))viewport.releasePointerCapture(drag.id);drag=null;}
  return{setActive(value){if(disposed)return;active=value;if(!active)cancelDrag();else{paint();fitComparison();}},destroy(){if(disposed)return;disposed=true;active=false;cancelDrag();listeners.forEach(remove=>remove());compareListeners.forEach(remove=>remove());win?.removeEventListener('resize',resize);observer?.disconnect();cropObserver?.disconnect();comparisonFrames.length=0;pins.length=0;image.removeAttribute('src');image.alt='';shell.querySelectorAll('img').forEach(img=>{img.removeAttribute('src');img.alt='';});host.replaceChildren();}};
}
