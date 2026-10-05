type Lab='spike'|'summation'|'rate-code'|'methods';
const NS='http://www.w3.org/2000/svg';
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''){const n=document.createElement(tag);n.textContent=text;n.className=className;return n;}
function svgNode(tag:string,attrs:Record<string,string|number>={},text=''){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));n.textContent=text;return n;}
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));

// Deliberately schematic traces: illustrative voltage values, not a fitted cell.
export function spikeVoltage(t:number,drive:number,sodiumBlocked=false){
  if(t<2)return -70;
  if(drive<20||sodiumBlocked)return t<5?-70+drive*(t-2)/3:-70+drive*Math.exp(-(t-5)/3);
  const thresholdTime=2+60/drive;
  if(t<thresholdTime)return -70+drive*(t-2)/3;
  const phase=t-thresholdTime;
  if(phase<1)return -50+80*phase;
  if(phase<4)return 30-105*(phase-1)/3;
  return -70-5*Math.exp(-(phase-4)/2);
}
export function postsynapticVoltage(t:number,count:number,spacing:number,inhibition:boolean){
  const kernel=(dt:number)=>dt<0?0:dt*Math.exp(1-dt/2)/2;
  let voltage=-70;for(let i=0;i<count;i++)voltage+=10*kernel(t-(2+i*spacing));
  if(inhibition)voltage-=12*kernel(t-3);return voltage;
}
export function orientationRates(angle:number,width:number){return[0,45,90,135].map(preferred=>{const d=Math.min(Math.abs(angle-preferred),180-Math.abs(angle-preferred));return 3+42*Math.exp(-.5*(d/width)**2);});}

export function mountLectureLab(host:HTMLElement,lab:Lab){
  const shell=node('section','','lecture-lab');shell.setAttribute('aria-label','Interactive teaching diagram');
  const title=node('h3'),description=node('p','','lecture-lab-description'),controls=node('div','','lecture-lab-controls');
  const svg=svgNode('svg',{viewBox:'0 0 700 380',role:'img','aria-label':'Interactive graph'});
  const output=node('p','','lecture-lab-output');output.setAttribute('aria-live','polite');
  const note=node('p','','lecture-lab-note');shell.append(title,description,svg,controls,output,note);host.replaceChildren(shell);
  let disposed=false;
  function range(labelText:string,min:number,max:number,value:number,change:(n:number)=>void){
    const label=node('label'),caption=node('span',labelText),readout=node('output',String(value));const input=node('input');input.type='range';input.min=String(min);input.max=String(max);input.step='1';input.value=String(value);input.setAttribute('aria-label',labelText);
    input.addEventListener('input',()=>{readout.value=input.value;change(Number(input.value));});label.append(caption,readout,input);controls.append(label);return input;
  }
  function check(labelText:string,change:(value:boolean)=>void){const label=node('label','','lecture-lab-check'),input=node('input');input.type='checkbox';input.addEventListener('change',()=>change(input.checked));label.append(input,node('span',labelText));controls.append(label);}
  function chart(yLabel:string,min=-90,max=40){
    svg.replaceChildren();const x=(t:number)=>65+t/20*600,y=(v:number)=>310-(v-min)/(max-min)*270;
    svg.append(svgNode('path',{d:'M65 32V310H670',fill:'none',stroke:'#658995','stroke-width':1.2}));
    for(const value of [-70,-50,0,30].filter(v=>v>=min&&v<=max)){svg.append(svgNode('line',{x1:65,y1:y(value),x2:670,y2:y(value),stroke:value===-50?'#d4b574':'#213d48','stroke-dasharray':value===-50?'5 5':'0'}),svgNode('text',{x:53,y:y(value)+4,'text-anchor':'end',fill:'#9bb9c1','font-size':14},String(value)));}
    svg.append(svgNode('text',{x:68,y:22,fill:'#bad5d9','font-size':14},yLabel),svgNode('text',{x:365,y:350,fill:'#96b9c0','font-size':14,'text-anchor':'middle'},'Time → (schematic)'));
    return{x,y};
  }
  function trace(sample:(t:number)=>number,x:(t:number)=>number,y:(v:number)=>number){let d='';for(let i=0;i<=240;i++){const t=i/12;d+=`${i?'L':'M'}${x(t).toFixed(2)},${y(sample(t)).toFixed(2)} `;}svg.append(svgNode('path',{d,fill:'none',stroke:'#b5efc9','stroke-width':3.5,'stroke-linejoin':'round'}));}

  if(lab==='spike'){
    title.textContent='From depolarization to a spike';description.textContent='Change the stimulus, then inspect the voltage sequence.';let drive=24,time=6,blocked=false;
    const draw=()=>{if(disposed)return;const{x,y}=chart('Membrane potential · mV');trace(t=>spikeVoltage(t,drive,blocked),x,y);const value=spikeVoltage(time,drive,blocked);svg.append(svgNode('line',{x1:x(time),y1:35,x2:x(time),y2:310,stroke:'#d9dec6','stroke-dasharray':'3 4'}),svgNode('circle',{cx:x(time),cy:y(value),r:6,fill:'#efff9a'}));
      const spike=drive>=20&&!blocked,onset=spike?2+60/drive:5;const phase=time<2?'Rest':time<onset?'Depolarizing input':!spike?'Graded return toward rest':time<onset+1?'Na⁺-driven upstroke':time<onset+4?'Repolarization':'Afterhyperpolarization and recovery';
      output.textContent=`${phase} · ${Math.round(value)} mV. ${spike?'Threshold crossed: increasing this stimulus does not increase spike amplitude.':blocked?'With voltage-gated Na⁺ current blocked, this model produces no regenerative spike.':'Below threshold: a graded response, without a regenerative spike.'}`;
    };
    range('Depolarizing drive (mV)',0,30,drive,n=>{drive=n;draw();});range('Inspect time',0,20,time,n=>{time=n;draw();});check('Block voltage-gated Na⁺ current',v=>{blocked=v;draw();});
    note.textContent='Illustrative trace, not recorded data. −70 mV resting and about −50 mV threshold follow the lecture example; values and waveforms vary across neurons. Channel conductances shape the spike; pumps maintain gradients over time.';draw();
  }else if(lab==='summation'){
    title.textContent='Inputs combine over time';description.textContent='Bring excitatory inputs closer together, or add an inhibitory input.';let count=3,spacing=4,inhibition=false;
    const draw=()=>{if(disposed)return;const{x,y}=chart('Membrane potential · illustrative mV',-90,-20);trace(t=>postsynapticVoltage(t,count,spacing,inhibition),x,y);for(let i=0;i<count;i++)svg.append(svgNode('path',{d:`M${x(2+i*spacing)} 318v12`,stroke:'#a1e7bd','stroke-width':3}));const peak=Math.max(...Array.from({length:241},(_,i)=>postsynapticVoltage(i/12,count,spacing,inhibition)));output.textContent=`Peak ${peak.toFixed(1)} mV · ${peak>=-50?'The summed depolarization reaches the illustrative threshold.':'The summed response stays below the illustrative threshold.'} Timing and sign change the combined response.`;};
    range('Excitatory inputs',1,5,count,n=>{count=n;draw();});range('Spacing between inputs',0,4,spacing,n=>{spacing=n;draw();});check('Add an inhibitory input',v=>{inhibition=v;draw();});
    note.textContent='Linear teaching model of graded postsynaptic potentials, not a biophysical simulation. Real integration depends on conductances, dendritic location and timing. Inhibition can also shunt excitation without a large hyperpolarization.';draw();
  }else if(lab==='rate-code'){
    title.textContent='A population response';description.textContent='Rotate the stimulus. Compare the pattern across four illustrative neurons.';let angle=45,width=25;
    const draw=()=>{if(disposed)return;svg.replaceChildren();const rates=orientationRates(angle,width),colors=['#b5ecc9','#c8bbef','#edc590','#9bcced'];svg.append(svgNode('circle',{cx:103,cy:95,r:55,fill:'#0f2730',stroke:'#365460'}),svgNode('line',{x1:103-43*Math.cos(angle*Math.PI/180),y1:95+43*Math.sin(angle*Math.PI/180),x2:103+43*Math.cos(angle*Math.PI/180),y2:95-43*Math.sin(angle*Math.PI/180),stroke:'#e8f7e5','stroke-width':5}),svgNode('text',{x:103,y:172,'text-anchor':'middle',fill:'#dcefeb','font-size':16},`${angle}° stimulus`));
      rates.forEach((rate,i)=>{const row=56+i*68;svg.append(svgNode('text',{x:210,y:row+4,fill:colors[i],'font-size':14},`${[0,45,90,135][i]}° pref.`),svgNode('rect',{x:290,y:row-13,width:rate/45*145,height:18,rx:3,fill:colors[i]}));const n=Math.round(rate);for(let k=0;k<n;k++)svg.append(svgNode('line',{x1:475+(k+.5)/Math.max(n,1)*185,y1:row-12,x2:475+(k+.5)/Math.max(n,1)*185,y2:row+9,stroke:colors[i],'stroke-width':1.6}));});
      svg.append(svgNode('text',{x:290,y:347,fill:'#9bb9c0','font-size':13},'Relative firing rate'),svgNode('text',{x:475,y:347,fill:'#9bb9c0','font-size':13},'Illustrative spike train →'));output.textContent=`Response pattern: ${rates.map(n=>Math.round(n)).join(' · ')}. The pattern changes with orientation; individual spikes keep the same drawn size.`;
    };
    range('Stimulus orientation (degrees)',0,180,angle,n=>{angle=n;draw();});range('Tuning width (degrees)',10,60,width,n=>{width=n;draw();});note.textContent='Synthetic orientation tuning and deterministic spike marks, not experimental recordings. A selective response alone does not establish that a neuron is necessary, sufficient, or the only carrier of information.';draw();
  }else{
    title.textContent='Choose a method for the question';description.textContent='Compare what a method measures with the evidence your question needs.';
    const methods=[{name:'EEG / ERP',x:520,y:88,text:'Electrical activity recorded at the scalp. Excellent timing; locating the underlying generators requires an inverse model and is less direct.'},{name:'fMRI',x:165,y:228,text:'BOLD reflects a hemodynamic response associated with neural activity. More spatially localized than scalp EEG, with a slower temporal response.'},{name:'Single-unit recording',x:115,y:75,text:'Spikes recorded from individual neurons with high temporal precision. Invasive, with a limited sample of cells; selectivity alone does not establish necessity.'},{name:'TMS',x:330,y:145,text:'Stimulation perturbs cortical processing. Effects can support causal inference under appropriate controls, but a perturbation is not a recording of information content.'}];let selected=0;
    const buttons:HTMLButtonElement[]=[];const draw=()=>{if(disposed)return;svg.replaceChildren();svg.append(svgNode('path',{d:'M65 45V305H660',stroke:'#537c85',fill:'none'}),svgNode('text',{x:70,y:24,fill:'#c0dbda','font-size':14},'Faster temporal evidence ↑'),svgNode('text',{x:365,y:345,fill:'#c0dbda','font-size':14,'text-anchor':'middle'},'More spatially distributed measurement →'));
      methods.forEach((m,i)=>{svg.append(svgNode('circle',{cx:m.x,cy:m.y,r:i===selected?19:10,fill:i===selected?'#b2f0c4':'#375a65',stroke:'#b2f0c4','stroke-width':i===selected?2:0}),svgNode('text',{x:m.x+25,y:m.y+5,fill:i===selected?'#ddefe6':'#769ba6','font-size':14},m.name));buttons[i]?.setAttribute('aria-pressed',String(i===selected));});output.textContent=methods[selected].text;};
    methods.forEach((m,i)=>{const b=node('button',m.name);b.type='button';b.addEventListener('click',()=>{selected=i;draw();});buttons.push(b);controls.append(b);});note.textContent='Qualitative comparison, not a calibrated resolution chart. TMS is a perturbation method; its marker is a teaching reference, not a measurement-resolution estimate. Task, analysis and experimental design affect every method.';draw();
  }
  return()=>{disposed=true;host.replaceChildren();};
}
