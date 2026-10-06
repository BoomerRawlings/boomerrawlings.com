export type ChartValue={label:string;value:number;unit?:string;digits?:number};
export type ChartProbeSpec={
  label:string;bounds:{x:number;y:number;width:number;height:number};domain:[number,number];step:number;
  xLabel:string;sample:(position:number)=>ChartValue[];context?:()=>string;onSeek?:(position:number)=>void;
};
export type ChartProbe={refresh:()=>void;destroy:()=>void;setActive:(active:boolean)=>void};
const NS='http://www.w3.org/2000/svg';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function probePosition(value:number,domain:[number,number],step:number){
  if(!Number.isFinite(value))return domain[0];return clamp(domain[0]+Math.round((value-domain[0])/step)*step,domain[0],domain[1]);
}
/** SVG x after its default xMidYMid meet fit, including letterbox margins. */
export function clientChartPoint(client:{x:number;y:number},rect:{left:number;top:number;width:number;height:number},view:{width:number;height:number}){
  const scale=Math.min(rect.width/view.width,rect.height/view.height);if(!Number.isFinite(scale)||scale<=0)return null;
  return{x:(client.x-rect.left-(rect.width-view.width*scale)/2)/scale,y:(client.y-rect.top-(rect.height-view.height*scale)/2)/scale};
}
export function formatChartValue(value:ChartValue){return`${value.label}: ${value.value.toFixed(value.digits??1)}${value.unit?` ${value.unit}`:''}`;}

/** Values come from the native model, never from inspecting raster pixels. */
export function mountChartProbe(host:HTMLElement,svg:SVGElement,spec:ChartProbeSpec):ChartProbe{
  const doc=host.ownerDocument||document;
  const make=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const n=doc.createElement(tag);n.textContent=text;n.className=className;return n;};
  const shell=make('section','','native-chart-probe'),label=make('label',spec.label),position=make('input'),readout=make('output'),context=make('p','','chart-probe-context'),comparison=make('p','','chart-probe-comparison'),controls=make('div','','chart-probe-controls');
  position.type='range';position.min=String(spec.domain[0]);position.max=String(spec.domain[1]);position.step=String(spec.step);position.value=String(spec.domain[0]);position.setAttribute('aria-label',`Inspect ${spec.xLabel}`);label.append(position);
  const group=doc.createElementNS(NS,'g'),beam=doc.createElementNS(NS,'line');group.setAttribute('class','chart-probe-marker');group.setAttribute('pointer-events','none');group.setAttribute('aria-hidden','true');beam.setAttribute('stroke','#f0de8c');beam.setAttribute('stroke-width','1.5');beam.setAttribute('stroke-dasharray','4 4');group.append(beam);svg.append(group);
  let disposed=false,active=true,current=spec.domain[0],pinned:{position:number;values:ChartValue[];context:string}|null=null;
  const listeners:(()=>void)[]=[];
  function listen(target:EventTarget,type:string,fn:EventListener){target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));}
  function button(text:string,action:()=>void){const n=make('button',text);n.type='button';listen(n,'click',()=>{if(active&&!disposed)action();});controls.append(n);return n;}
  const clear=button('Clear comparison',()=>{pinned=null;refresh();});
  button('Pin readout',()=>{pinned={position:current,values:spec.sample(current).map(v=>({...v})),context:spec.context?.()||''};refresh();});
  if(spec.onSeek)button('Go to this point',()=>spec.onSeek?.(current));
  function refresh(){
    if(disposed)return;const values=spec.sample(current).filter(v=>Number.isFinite(v.value)),x=spec.bounds.x+(current-spec.domain[0])/(spec.domain[1]-spec.domain[0])*spec.bounds.width;
    beam.setAttribute('x1',String(x));beam.setAttribute('x2',String(x));beam.setAttribute('y1',String(spec.bounds.y));beam.setAttribute('y2',String(spec.bounds.y+spec.bounds.height));
    position.value=String(current);position.setAttribute('aria-valuetext',`${spec.xLabel}: ${current.toFixed(2)}; ${values.map(formatChartValue).join('; ')}`);
    readout.value=`${spec.xLabel}: ${current.toFixed(2)} · ${values.map(formatChartValue).join(' · ')}`;context.textContent=spec.context?.()||'';clear.disabled=!pinned;
    if(pinned){
      const deltas=values.flatMap(value=>{const before=pinned!.values.find(v=>v.label===value.label&&v.unit===value.unit);return before?[`${value.label} change: ${(value.value-before.value).toFixed(value.digits??1)}${value.unit?` ${value.unit}`:''}`]:[];});
      comparison.textContent=`Pinned ${spec.xLabel}: ${pinned.position.toFixed(2)}${pinned.context?` · ${pinned.context}`:''}. ${pinned.values.map(formatChartValue).join(' · ')}. ${deltas.join(' · ')}`;
    }else comparison.textContent='Pin a readout, then inspect another point or change a condition to compare model values.';
  }
  function set(value:number){if(!active||disposed)return;current=probePosition(value,spec.domain,spec.step);refresh();}
  function point(event:PointerEvent){
    const box=svg.getAttribute('viewBox')?.split(/[ ,]+/).map(Number)||[0,0,900,410],p=clientChartPoint({x:event.clientX,y:event.clientY},svg.getBoundingClientRect(),{width:box[2],height:box[3]});
    if(!p||p.x<spec.bounds.x||p.x>spec.bounds.x+spec.bounds.width||p.y<spec.bounds.y||p.y>spec.bounds.y+spec.bounds.height)return null;
    return spec.domain[0]+(p.x-spec.bounds.x)/spec.bounds.width*(spec.domain[1]-spec.domain[0]);
  }
  listen(position,'input',()=>set(Number(position.value)));
  listen(svg,'pointermove',((event:PointerEvent)=>{const value=point(event);if(value!==null)set(value);}) as EventListener);
  listen(svg,'click',((event:PointerEvent)=>{const value=point(event);if(value!==null){set(value);if(active)spec.onSeek?.(current);}}) as EventListener);
  shell.append(label,readout,context,controls,comparison,make('p','Teaching-model values, not empirical recordings. Hover to inspect; click or choose Go to this point to pause and scrub. The inspection slider works with arrow keys.','chart-probe-note'));host.append(shell);refresh();
  return{refresh,setActive(value){active=value;},destroy(){if(disposed)return;disposed=true;active=false;pinned=null;listeners.forEach(remove=>remove());group.remove();shell.remove();}};
}
