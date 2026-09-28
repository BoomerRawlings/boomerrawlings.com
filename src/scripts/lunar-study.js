const data = JSON.parse(document.getElementById('lunar-data').textContent);
const byId = id => document.getElementById(id);
const svg = byId('lunar-chart');
const slider = byId('lunar-phase');
const ns = 'http://www.w3.org/2000/svg';
let current = data.models[0];
const fixed = (v, digits=2) => Number(v).toFixed(digits);
const signed = v => `${v>0?'+':''}${fixed(v)}%`;
const pvalue = v => v < .001 ? fixed(v,4) : fixed(v,3);
function phaseName(degrees){
  if(degrees===0 || degrees===360)return 'New Moon';
  if(degrees===90)return 'First quarter';
  if(degrees===180)return 'Full Moon';
  if(degrees===270)return 'Last quarter';
  return degrees<90?'Waxing crescent':degrees<180?'Waxing gibbous':degrees<270?'Waning gibbous':'Waning crescent';
}

function estimate(model, degrees) {
  const theta=degrees*Math.PI/180, c=Math.cos(theta), s=Math.sin(theta);
  const log=model.cos_coefficient*c+model.sin_coefficient*s;
  const variance=c*c*model.cov_cos_cos+2*c*s*model.cov_cos_sin+s*s*model.cov_sin_sin;
  const margin=Math.sqrt(5.991464547107979*Math.max(0,variance));
  return {index:100*Math.exp(log),low:100*Math.exp(log-margin),high:100*Math.exp(log+margin)};
}
function el(tag, attrs={}, text) {
  const node=document.createElementNS(ns,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  if(text!==undefined)node.textContent=text;
  return node;
}
function draw(){
  const width=Math.max(240,Math.round(svg.getBoundingClientRect().width));
  const height=340, left=38, right=width-13, top=34, bottom=281;
  const x=d=>left+(right-left)*d/360, y=v=>bottom-(v-95)/10*(bottom-top);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.replaceChildren(el('title',{id:'lunar-chart-title'},`${current.label}: estimated pattern across the Moon’s cycle`),el('desc',{id:'lunar-chart-desc'},`Percent change from the model’s reference level, not a percentage of people. The line shows the estimate; shading shows its simultaneous 95 percent confidence band. Increase from lowest to highest ${fixed(current.fitted_peak_trough_percent)} percent; Full Moon versus New Moon ${signed(current.full_vs_new_percent)}.`));
  svg.append(el('text',{x:left,y:16},'Change from reference (%)'));
  for(const tick of [96,98,100,102,104]){
    svg.append(el('line',{x1:left,x2:right,y1:y(tick),y2:y(tick),class:tick===100?'chart-baseline':'chart-grid'}));
    svg.append(el('text',{x:left-8,y:y(tick)+4,'text-anchor':'end'},`${tick>100?'+':''}${tick-100}%`));
  }
  for(const [d,label] of [[0,['New','Moon']],[90,['First','quarter']],[180,['Full','Moon']],[270,['Last','quarter']],[360,['New','Moon']]]){
    svg.append(el('line',{x1:x(d),x2:x(d),y1:bottom,y2:bottom+5,class:'chart-grid'}));
    if(width<430 && (d===90 || d===270))continue;
    const text=el('text',{x:x(d),y:bottom+22,'text-anchor':d===0?'start':d===360?'end':'middle'});
    label.forEach((line,i)=>text.append(el('tspan',{x:x(d),dy:i?15:0},line)));
    svg.append(text);
  }
  const points=Array.from({length:181},(_,i)=>({degrees:i*2,...estimate(current,i*2)}));
  const path=(points,key)=>points.map((v,i)=>`${i?'L':'M'}${x(v.degrees).toFixed(3)},${y(v[key]).toFixed(3)}`).join(' ');
  const upper=path(points,'high');
  const lower=path([...points].reverse(),'low').replace(/^M/,'L');
  svg.append(el('path',{d:`${upper} ${lower} Z`,class:'chart-band'}));
  svg.append(el('path',{d:path(points,'index'),class:'chart-line'}));
  const degrees=Number(slider.value), value=estimate(current,degrees);
  svg.append(el('line',{x1:x(degrees),x2:x(degrees),y1:top,y2:bottom,class:'chart-marker'}));
  svg.append(el('circle',{cx:x(degrees),cy:y(value.index),r:4.5,class:'chart-dot'}));
  const difference=value.index-100;
  const reading=Math.abs(difference)<.005?'at the reference level':`${fixed(Math.abs(difference))}% ${difference>0?'above':'below'} the reference level`;
  byId('lunar-phase-output').textContent=`${phaseName(degrees)} · ${reading}`;
  slider.setAttribute('aria-valuetext',`${phaseName(degrees)}, ${degrees} degrees; ${reading}`);
}
function select(modelId, scroll=false){
  const model=data.models.find(m=>m.model===modelId);
  if(!model)return;
  current=model;
  document.querySelectorAll('button[data-model]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.model===modelId)));
  byId('lunar-selection').textContent=model.label;
  byId('lunar-explanation').textContent=model.explanation;
  byId('lunar-adjustment').textContent=model.model==='calendar_unadjusted'?'This comparison leaves out the weekday, seasonal and holiday adjustments. A wider shaded area means more uncertainty.':'The line shows the estimate after allowing for weekdays, seasons and selected holidays. A wider shaded area means more uncertainty.';
  byId('lunar-chart-measure').textContent=model.model==='tracking_fraction_diagnostic'?'This view measures people with any app entry for a date, as a share of users counted as active. It measures recording activity, not sex entries.':model.model==='rolling_active_denominator'?'This view compares sex entries with users who had records on at least two days in the 42-day window ending on that date.':'The chart compares sex-related entries with the number of people who had any app record for that date.';
  byId('lunar-amplitude').textContent=`${fixed(model.fitted_peak_trough_percent)}%`;
  byId('lunar-p').textContent=pvalue(model.joint_p);
  byId('lunar-holm-wrap').hidden=model.regional_holm_p===null;
  byId('lunar-holm').textContent=model.regional_holm_p===null?'':pvalue(model.regional_holm_p);
  const includesZero=model.full_vs_new_ci_low<=0 && model.full_vs_new_ci_high>=0;
  byId('lunar-contrast').textContent=`Full Moon versus New Moon: ${signed(model.full_vs_new_percent)}; 95% interval ${signed(model.full_vs_new_ci_low)} to ${signed(model.full_vs_new_ci_high)}. ${includesZero?'This range includes zero, so the comparison does not give a clear answer.':'This range suggests a difference in this calculation. This particular interval is not adjusted for testing several areas; the whole-cycle tests report that adjustment separately.'}`;
  const region=data.regions.find(r=>r.model===modelId);
  byId('lunar-coverage').textContent=region?`${region.logs.toLocaleString('en-US')} sex-related entries · ${region.dates} dates. These are one area’s records from the same app; entries can come from the same people repeatedly.`:`${model.regions} areas · ${model.dates} dates · each area given equal weight. ${model.model==='tracking_fraction_diagnostic'?'This view concerns all app recording, not sex alone.':'People may leave entries out, so these records are not a complete account of their sex lives.'}`;
  draw();
  if(scroll){byId('explore').scrollIntoView({behavior:'auto',block:'start'});byId('lunar-selection').focus({preventScroll:true});}
}
byId('lunar-selection').setAttribute('tabindex','-1');
document.querySelectorAll('button[data-model]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.model,Boolean(button.closest('table')))));
slider.addEventListener('input',draw);
new ResizeObserver(draw).observe(svg);
draw();

document.querySelectorAll('table[data-sortable]').forEach(table=>{
  table.querySelectorAll('th button[data-sort]').forEach(button=>button.addEventListener('click',()=>{
    const th=button.closest('th'), column=th.cellIndex;
    const ascending=th.getAttribute('aria-sort')!=='ascending';
    table.querySelectorAll('th[aria-sort]').forEach(h=>h.setAttribute('aria-sort','none'));
    th.setAttribute('aria-sort',ascending?'ascending':'descending');
    const rows=[...table.tBodies[0].rows];
    rows.sort((a,b)=>{
      const ac=a.cells[column],bc=b.cells[column];
      if(button.dataset.sort==='number'){
        const av=ac.dataset.value,bv=bc.dataset.value;
        if(av===''||bv==='')return av===''?(bv===''?0:1):-1;
        return (Number(av)-Number(bv))*(ascending?1:-1);
      }
      return ac.textContent.trim().localeCompare(bc.textContent.trim())*(ascending?1:-1);
    });
    table.tBodies[0].append(...rows);
  }));
});

function revealHash(){
  if(!location.hash)return;
  let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
  const target=byId(id);if(!target)return;
  if(target instanceof HTMLDetailsElement)target.open=true;
  for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
  requestAnimationFrame(()=>{target.scrollIntoView({block:'start'});if(target.matches('a,[tabindex]'))target.focus({preventScroll:true});});
}
addEventListener('hashchange',revealHash);
byId('lunar-study').addEventListener('click',event=>{
  const link=event.target instanceof Element?event.target.closest('a[href^="#"]'):null;
  if(link && link.hash===location.hash)requestAnimationFrame(revealHash);
});
revealHash();
