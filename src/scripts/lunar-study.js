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
  svg.replaceChildren(el('title',{id:'lunar-chart-title'},`${current.label}: fitted lunar component`),el('desc',{id:'lunar-chart-desc'},`Index 100 is the modeled lunar baseline, not a population probability. Line with simultaneous 95 percent band. Fitted peak-to-trough ${fixed(current.fitted_peak_trough_percent)} percent; full versus new ${signed(current.full_vs_new_percent)}.`));
  const diagnostic=current.model==='tracking_fraction_diagnostic';
  svg.append(el('text',{x:left,y:16},diagnostic?'Any-feature tracking index':'Sex-logging index'));
  for(const tick of [96,98,100,102,104]){
    svg.append(el('line',{x1:left,x2:right,y1:y(tick),y2:y(tick),class:tick===100?'chart-baseline':'chart-grid'}));
    svg.append(el('text',{x:left-8,y:y(tick)+4,'text-anchor':'end'},String(tick)));
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
  byId('lunar-phase-output').textContent=`${phaseName(degrees)} · ${degrees}° · index ${fixed(value.index)}`;
  slider.setAttribute('aria-valuetext',`${phaseName(degrees)}, ${degrees} degrees; fitted index ${fixed(value.index)}`);
}
function select(modelId, scroll=false){
  const model=data.models.find(m=>m.model===modelId);
  if(!model)return;
  current=model;
  document.querySelectorAll('button[data-model]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.model===modelId)));
  byId('lunar-selection').textContent=model.label;
  byId('lunar-explanation').textContent=model.explanation;
  byId('lunar-amplitude').textContent=`${fixed(model.fitted_peak_trough_percent)}%`;
  byId('lunar-p').textContent=pvalue(model.joint_p);
  byId('lunar-holm-wrap').hidden=model.regional_holm_p===null;
  byId('lunar-holm').textContent=model.regional_holm_p===null?'':pvalue(model.regional_holm_p);
  const includesZero=model.full_vs_new_ci_low<=0 && model.full_vs_new_ci_high>=0;
  byId('lunar-contrast').textContent=`Full Moon versus New Moon: ${signed(model.full_vs_new_percent)}; 95% interval ${signed(model.full_vs_new_ci_low)} to ${signed(model.full_vs_new_ci_high)}. ${includesZero?'The interval includes no difference.':'This unadjusted contrast interval excludes zero; regional multiplicity is addressed separately in the whole-cycle tests.'}`;
  const region=data.regions.find(r=>r.model===modelId);
  byId('lunar-coverage').textContent=region?`${region.logs.toLocaleString('en-US')} feature logs · ${region.dates} dates · one regional series. A subgroup of the same app dataset, not independent replication.`:`${model.regions} areas · ${model.dates} distinct dates · equal regional weight. ${model.model==='tracking_fraction_diagnostic'?'Outcome: any-feature tracking divided by rolling active users.':'The observations are calendar-dated logging ratios, not complete sex/no-sex histories.'}`;
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
  for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
  requestAnimationFrame(()=>{target.scrollIntoView({block:'start'});if(target.matches('a,[tabindex]'))target.focus({preventScroll:true});});
}
addEventListener('hashchange',revealHash);
revealHash();
