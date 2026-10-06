import {mountChartProbe,clientChartPoint,type ChartProbe} from './chart-interactions';
type Lab='spike'|'summation'|'rate-code'|'methods'|'propagation';
export type LectureLabCleanup=(()=>void)&{setActive:(active:boolean)=>void};
const NS='http://www.w3.org/2000/svg';
const colors={mint:'#b5efc9',violet:'#cbb5fa',amber:'#edc590',blue:'#9bcced',muted:'#91adb5'};
function node<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''){const n=document.createElement(tag);n.textContent=text;n.className=className;return n;}
function svgNode(tag:string,attrs:Record<string,string|number>={},text=''){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));n.textContent=text;return n;}
function attr(n:Element,values:Record<string,string|number>){for(const[k,v]of Object.entries(values))n.setAttribute(k,String(v));}
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

type ClockState={time:number;duration:number;playing:boolean;running:boolean};
type FrameScheduler={request:(callback:FrameRequestCallback)=>number;cancel:(id:number)=>void};
/** One cancellable clock per mounted demonstration. Deactivation preserves play intent. */
export function createDemoClock(duration:number,render:(time:number)=>void,onState:(state:ClockState)=>void,autoplay:boolean,
  scheduler:FrameScheduler={request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id)}){
  let time=0,playing=autoplay,active=true,visible=true,disposed=false,frame:number|null=null,last:number|null=null;
  const state=()=>({time,duration,playing,running:!disposed&&playing&&active&&visible});
  function cancel(){if(frame!==null)scheduler.cancel(frame);frame=null;last=null;}
  function schedule(){if(state().running&&frame===null)frame=scheduler.request(tick);}
  function update(){if(disposed)return;render(time);onState(state());schedule();}
  function tick(timestamp:number){
    frame=null;if(!state().running)return;
    const dt=last===null?0:Math.max(0,Math.min(.12,(timestamp-last)/1000));last=timestamp;
    time=Math.min(duration,time+dt);if(time>=duration){playing=false;last=null;}update();
  }
  return{
    start(){update();},
    play(){if(disposed)return;if(time>=duration)time=0;playing=true;last=null;update();},
    pause(){if(disposed)return;playing=false;cancel();onState(state());},
    replay(){if(disposed)return;cancel();time=0;playing=true;update();},
    seek(value:number){if(disposed)return;cancel();playing=false;time=clamp(Number.isFinite(value)?value:0,0,duration);update();},
    setActive(value:boolean){if(disposed)return;active=value;cancel();onState(state());schedule();},
    setVisible(value:boolean){if(disposed)return;visible=value;cancel();onState(state());schedule();},
    state,
    dispose(){disposed=true;playing=false;cancel();},
  };
}

/** Local voltage states along two schematic fibers; distances and speeds are uncalibrated. */
export function conductionState(progress:number){
  const p=clamp(progress,0,1);
  return{continuous:clamp((p-.08)/.84,0,1),saltatory:clamp((p-.08)/.48,0,1),initiated:p>=.08};
}

/** Deterministic marks accumulate from the rate at each instant, not the final stimulus. */
export function populationSpikeTimes(angle:number,width:number,sweep:boolean,duration=12){
  const result:number[][]=[[],[],[],[]],phase=[0,0,0,0],steps=1200,dt=duration/steps;
  for(let j=1;j<=steps;j++){
    const p=j/steps,current=sweep?(angle+180*p)%180:angle;
    orientationRates(current,width).forEach((rate,i)=>{
      phase[i]+=rate*dt*.11; // Visual-time compression, explicitly not calibrated hertz.
      if(phase[i]>=1){result[i].push(p);phase[i]-=1;}
    });
  }
  return result;
}

export function mountLectureLab(host:HTMLElement,lab:Lab):LectureLabCleanup{
  const shell=node('section','','lecture-lab lecture-demo');shell.dataset.lab=lab;shell.setAttribute('aria-label','Interactive teaching demonstration');
  const heading=node('header','','lecture-demo-heading'),title=node('h3'),description=node('p','','lecture-lab-description');heading.append(title,description);
  const stage=node('div','','lecture-demo-stage'),svg=svgNode('svg',{viewBox:'0 0 900 410',role:'img','aria-label':'Animated teaching diagram'});stage.append(svg);
  const phase=node('p','','lecture-demo-phase');phase.setAttribute('aria-live','polite');phase.setAttribute('aria-atomic','true');
  const transport=node('div','','lecture-demo-transport'),play=node('button','Pause'),replay=node('button','Replay'),timelineLabel=node('label','','lecture-demo-timeline'),timeline=node('input'),timeReadout=node('output','0:00');
  play.type=replay.type='button';play.dataset.action='play';replay.dataset.action='replay';timeline.type='range';timeline.min='0';timeline.max='1000';timeline.step='1';timeline.value='0';timeline.setAttribute('aria-label','Demonstration time');
  timelineLabel.append(node('span','Time','lecture-demo-sr'),timeline,timeReadout);transport.append(play,replay,timelineLabel);
  const settings=node('details','','lecture-demo-settings'),settingsSummary=node('summary','Change the conditions'),controls=node('div','','lecture-lab-controls');settings.append(settingsSummary,controls);
  const note=node('p','','lecture-lab-note'),aside=node('div','','lecture-demo-aside');aside.append(heading,phase,settings,note);shell.append(aside,stage,transport);host.replaceChildren(shell);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed=false,render:(time:number)=>void=()=>{},clock:ReturnType<typeof createDemoClock>|null=null,probe:ChartProbe|null=null,active=true;
  const extraCleanup:(()=>void)[]=[];
  function extraListener(type:string,handler:EventListener){svg.addEventListener(type,handler);extraCleanup.push(()=>svg.removeEventListener(type,handler));}
  let phaseText='';
  function explain(text:string){if(text!==phaseText){phaseText=text;phase.textContent=text;}}
  function range(labelText:string,min:number,max:number,value:number,change:(n:number)=>void){
    const label=node('label'),caption=node('span',labelText),readout=node('output',String(value)),input=node('input');input.type='range';input.min=String(min);input.max=String(max);input.step='1';input.value=String(value);input.setAttribute('aria-label',labelText);
    input.addEventListener('input',()=>{if(disposed)return;readout.value=input.value;change(Number(input.value));clock?.seek(0);});label.append(caption,readout,input);controls.append(label);return input;
  }
  function check(labelText:string,value:boolean,change:(value:boolean)=>void){const label=node('label','','lecture-lab-check'),input=node('input');input.type='checkbox';input.checked=value;input.addEventListener('change',()=>{if(disposed)return;change(input.checked);clock?.seek(0);});label.append(input,node('span',labelText));controls.append(label);}
  function line(d:string,color=colors.mint,width=3,opacity=1){const n=svgNode('path',{d,fill:'none',stroke:color,'stroke-width':width,opacity,'stroke-linecap':'round','stroke-linejoin':'round'});svg.append(n);return n;}
  function text(x:number,y:number,value:string,color=colors.muted,size=22,anchor='start'){const n=svgNode('text',{x,y,fill:color,'font-size':size,'text-anchor':anchor},value);svg.append(n);return n;}
  function chart(min=-90,max=40){
    const x=(t:number)=>82+t/20*758,y=(v:number)=>310-(v-min)/(max-min)*246;
    line('M82 52V310H850','#66848e',1.3);
    for(const value of[-70,-50,0,30].filter(v=>v>=min&&v<=max)){
      const grid=line(`M82 ${y(value)}H850`,value===-50?colors.amber:'#294550',1);if(value===-50)grid.setAttribute('stroke-dasharray','7 7');
      text(67,y(value)+7,String(value),colors.muted,20,'end');
    }
    text(82,30,'Membrane potential · illustrative mV');text(465,392,'Time → (schematic)',colors.muted,21,'middle');
    text(846,y(-50)-10,'threshold',colors.amber,18,'end');
    return{x,y};
  }
  function trace(sample:(t:number)=>number,x:(t:number)=>number,y:(v:number)=>number,time=20){
    let d='';const steps=Math.max(1,Math.ceil(time*16));for(let i=0;i<=steps;i++){const t=time*i/steps;d+=`${i?'L':'M'}${x(t).toFixed(2)},${y(sample(t)).toFixed(2)} `;}return d;
  }
  function cursor(){const beam=line('M0 52V310','#e0eed4',1.4,.7);beam.setAttribute('stroke-dasharray','3 5');const dot=svgNode('circle',{r:7,fill:'#efff9a',stroke:'#142827','stroke-width':2});svg.append(dot);return{beam,dot};}
  function start(duration:number){
    clock=createDemoClock(duration,t=>{if(!disposed)render(t);},state=>{
      play.textContent=state.playing?'Pause':state.time>=duration?'Play again':'Play';play.setAttribute('aria-label',`${state.playing?'Pause':'Play'} demonstration`);
      timeline.value=String(Math.round(state.time/duration*1000));timeline.setAttribute('aria-valuetext',`${state.time.toFixed(1)} of ${duration} seconds`);
      timeReadout.value=`${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;shell.dataset.playing=String(state.running);
    },!reduced.matches);
    clock.setVisible(!document.hidden);clock.start();
  }
  play.addEventListener('click',()=>{if(clock?.state().playing)clock.pause();else clock?.play();});replay.addEventListener('click',()=>clock?.replay());
  timeline.addEventListener('input',()=>{if(clock)clock.seek(Number(timeline.value)/1000*clock.state().duration);});

  if(lab==='spike'){
    title.textContent='A spike unfolds';description.textContent='Watch voltage and channel behavior together. Pause anywhere, or change the stimulus.';
    svg.setAttribute('aria-label','Membrane voltage trace progressively shows depolarization, an action potential, repolarization and recovery.');
    let drive=24,blocked=false;const{x,y}=chart(),ghost=line('',colors.mint,3,.18),progress=line('',colors.mint,4.5),marker=cursor(),voltage=text(82,351,'',colors.mint,24),channel=text(846,351,'',colors.violet,21,'end');
    function parameters(){ghost.setAttribute('d',trace(t=>spikeVoltage(t,drive,blocked),x,y));probe?.refresh();}
    render=time=>{
      const value=spikeVoltage(time,drive,blocked),spike=drive>=20&&!blocked,onset=spike?2+60/drive:5,p=time-onset;
      progress.setAttribute('d',trace(t=>spikeVoltage(t,drive,blocked),x,y,time));marker.beam.setAttribute('transform',`translate(${x(time)} 0)`);attr(marker.dot,{cx:x(time),cy:y(value)});voltage.textContent=`${Math.round(value)} mV`;
      if(time<2){channel.textContent='Voltage-gated channels at rest';explain('Rest · Ion gradients and resting conductances support the membrane potential.');}
      else if(time<onset){channel.textContent=blocked?'Na⁺ current blocked':'Depolarizing input';explain('Input · Depolarization brings the membrane toward threshold. Subthreshold responses are graded.');}
      else if(!spike){channel.textContent=blocked?'No regenerative Na⁺ current':'Below spike threshold';explain(blocked?'Na⁺ block · This response decays without a regenerative action potential.':'Subthreshold · The graded response returns toward rest without generating a spike.');}
      else if(p<1){channel.textContent='Na⁺ entry → rapid upstroke';explain('Upstroke · Voltage-gated Na⁺ conductance increases. Regenerative depolarization produces the spike.');}
      else if(p<4){channel.textContent='Na⁺ inactivation + K⁺ exit';explain('Repolarization · Na⁺ channels inactivate while delayed K⁺ conductance brings voltage back down.');}
      else if(p<8){channel.textContent='K⁺ conductance declines';explain('Afterhyperpolarization · Persisting K⁺ conductance takes voltage below rest before recovery.');}
      else{channel.textContent='Ready for another response';explain('Recovery · The membrane approaches rest. Stronger suprathreshold input changes onset here, not spike amplitude.');}
    };
    range('Depolarizing drive (mV)',0,30,drive,value=>{drive=value;parameters();});check('Block voltage-gated Na⁺ current',blocked,value=>{blocked=value;parameters();});
    note.textContent='Schematic voltage, not recorded data. −70 mV rest and about −50 mV threshold follow the lecture example; values vary. Channels shape the spike; pumps maintain gradients over time. Changing a condition pauses at the start.';
    parameters();start(20);
    probe=mountChartProbe(aside,svg,{label:'Inspect membrane voltage',bounds:{x:82,y:52,width:758,height:258},domain:[0,20],step:.05,xLabel:'Teaching time',sample:t=>[{label:'Voltage',value:spikeVoltage(t,drive,blocked),unit:'illustrative mV'}],context:()=>`Drive ${drive} mV · Na⁺ current ${blocked?'blocked':'available'}`,onSeek:t=>clock?.seek(t)});
  }else if(lab==='summation'){
    title.textContent='Timing changes the sum';description.textContent='Inputs arrive one by one. Their graded effects overlap—or fade before the next input.';
    svg.setAttribute('aria-label','Excitatory postsynaptic potentials accumulate over time. Their combined voltage is compared with an illustrative threshold.');
    let count=3,spacing=4,inhibition=false;const{x,y}=chart(-90,-20),components=svgNode('g'),events=svgNode('g');svg.append(components,events);
    const ghost=line('',colors.mint,3,.14),progress=line('',colors.mint,4.5),marker=cursor(),voltage=text(82,357,'',colors.mint,23),eventLabel=text(846,357,'',colors.violet,20,'end');
    const inputDots:SVGElement[]=[];
    function parameters(){
      components.replaceChildren();events.replaceChildren();inputDots.length=0;
      for(let i=0;i<count;i++){
        components.append(svgNode('path',{d:trace(t=>postsynapticVoltage(t-i*spacing,1,0,false),x,y),fill:'none',stroke:colors.mint,'stroke-width':1.5,opacity:.24}));
        const dot=svgNode('circle',{cx:x(2+i*spacing),cy:328,r:5,fill:colors.mint,opacity:.35});events.append(dot);inputDots.push(dot);
      }
      if(inhibition){const kernel=(dt:number)=>dt<0?0:dt*Math.exp(1-dt/2)/2;components.append(svgNode('path',{d:trace(t=>-70-12*kernel(t-3),x,y),fill:'none',stroke:colors.violet,'stroke-width':2,opacity:.65}));}
      ghost.setAttribute('d',trace(t=>postsynapticVoltage(t,count,spacing,inhibition),x,y));
      probe?.refresh();
    }
    render=time=>{
      const value=postsynapticVoltage(time,count,spacing,inhibition),received=Array.from({length:count},(_,i)=>2+i*spacing).filter(t=>t<=time).length;
      progress.setAttribute('d',trace(t=>postsynapticVoltage(t,count,spacing,inhibition),x,y,time));marker.beam.setAttribute('transform',`translate(${x(time)} 0)`);attr(marker.dot,{cx:x(time),cy:y(value)});voltage.textContent=`${value.toFixed(1)} mV`;eventLabel.textContent=`${received} / ${count} excitatory inputs${inhibition?' · inhibition at t = 3':''}`;
      inputDots.forEach((dot,i)=>{const age=time-(2+i*spacing);attr(dot,{r:age>=0&&age<.7?9:5,opacity:age>=0?1:.35});});
      if(time<2)explain('Before input · Each faint curve is one EPSP. The bright trace will show their combined effect.');
      else if(value>=-50)explain('Threshold reached · Overlapping EPSPs bring the summed voltage to the illustrative threshold. A spike is not simulated in this graded-potential model.');
      else if(inhibition&&time>=3&&time<8)explain('Opposing inputs · The inhibitory response reduces the combined depolarization in this example. Inhibition can also work by shunting.');
      else if(received<count||time<2+(count-1)*spacing+3)explain(spacing<=2?'Temporal summation · Another EPSP arrives while earlier depolarization remains, increasing the combined response.':'Separated inputs · Earlier EPSPs decay between inputs, limiting their overlap. Try a spacing of 1.');
      else explain('Recovery · With no new inputs, the graded response decays. Input timing and sign determine the combined response.');
    };
    range('Excitatory inputs',1,5,count,value=>{count=value;parameters();});range('Spacing between inputs',0,4,spacing,value=>{spacing=value;parameters();});check('Add an inhibitory input',inhibition,value=>{inhibition=value;parameters();});
    note.textContent='Linear teaching model, not a biophysical simulation. Real integration depends on conductances, dendritic location and timing. Inhibition need not produce a large hyperpolarization. Faint curves are individual responses; bright curve is their sum.';
    parameters();start(20);
    probe=mountChartProbe(aside,svg,{label:'Inspect the summed response',bounds:{x:82,y:52,width:758,height:258},domain:[0,20],step:.05,xLabel:'Teaching time',sample:t=>[{label:'Summed voltage',value:postsynapticVoltage(t,count,spacing,inhibition),unit:'illustrative mV'}],context:()=>`${count} excitatory inputs · spacing ${spacing}${inhibition?' · inhibition at 3':''}`,onSeek:t=>clock?.seek(t)});
  }else if(lab==='rate-code'){
    title.textContent='A changing population response';description.textContent='Follow the stimulus, firing-rate pattern, and accumulating spike marks together.';
    svg.setAttribute('aria-label','A rotating bar stimulus changes the relative firing rates of four differently tuned neurons. Equal-sized spike marks accumulate in time.');
    let angle=0,width=25,sweep=true,events=populationSpikeTimes(angle,width,sweep);const rows=[85,157,229,301],palette=[colors.mint,colors.violet,colors.amber,colors.blue];
    svg.append(svgNode('circle',{cx:112,cy:164,r:76,fill:'#132a32',stroke:'#42606c','stroke-width':1.5}));
    const stimulus=svgNode('line',{x1:52,y1:164,x2:172,y2:164,stroke:'#eff5e8','stroke-width':7,'stroke-linecap':'round'});svg.append(stimulus);const stimulusLabel=text(112,276,'',colors.mint,25,'middle');text(112,307,'bar orientation',colors.muted,20,'middle');
    text(267,36,'Preferred');text(390,36,'Current rate');text(594,36,'Spike history →');
    const bars:SVGElement[]=[],trains:SVGElement[]=[],rates:SVGElement[]=[];
    rows.forEach((y,i)=>{text(287,y+7,`${[0,45,90,135][i]}°`,palette[i],23,'middle');svg.append(svgNode('rect',{x:382,y:y-16,width:152,height:27,rx:3,fill:'#1d3540'}));const bar=svgNode('rect',{x:382,y:y-16,width:0,height:27,rx:3,fill:palette[i]});svg.append(bar);bars.push(bar);rates.push(text(562,y+7,'',palette[i],21,'end'));line(`M594 ${y}H865`,'#36505b',1);trains.push(line('',palette[i],2));});
    const beam=line('M594 54V327','#eef2cc',1.2,.65);text(460,364,'Relative response',colors.muted,20,'middle');text(730,364,'Same mark size · changing frequency',colors.muted,19,'middle');
    render=time=>{
      const p=time/12,current=sweep?(angle+180*p)%180:angle,values=orientationRates(current,width);
      stimulus.setAttribute('transform',`rotate(${-current} 112 164)`);stimulusLabel.textContent=`${Math.round(current)}°`;
      values.forEach((rate,i)=>{bars[i].setAttribute('width',String(rate/45*152));rates[i].textContent=String(Math.round(rate));trains[i].setAttribute('d',events[i].filter(t=>t<=p).map(t=>`M${594+t*271} ${rows[i]-14}v27`).join(' '));});beam.setAttribute('transform',`translate(${p*271} 0)`);
      if(!sweep)explain('Fixed stimulus · Different neurons respond at different rates. Spike marks retain their size as the history accumulates.');
      else if(p<.2)explain('Start · Near a neuron’s preferred orientation, its response is stronger. Compare the pattern across all four neurons.');
      else if(p<.55)explain('Stimulus turns · The strongest responses shift across the population. Earlier spike history stays in place.');
      else if(p<.95)explain('Rate changes · More frequent marks show a stronger response; the size of each action potential is unchanged.');
      else explain('One full orientation cycle · The population pattern changes continuously. Selectivity alone does not establish necessity or sufficiency.');
    };
    const rebuild=()=>{events=populationSpikeTimes(angle,width,sweep);probe?.refresh();};range('Starting orientation (degrees)',0,180,angle,value=>{angle=value;rebuild();});range('Tuning width (degrees)',10,60,width,value=>{width=value;rebuild();});check('Rotate the stimulus during playback',sweep,value=>{sweep=value;rebuild();});
    note.textContent='Synthetic tuning and deterministic spike marks, not recordings. Rates and demonstration time are uncalibrated. The spike history uses the stimulus present when each mark appeared; individual marks do not grow in amplitude.';start(12);
    probe=mountChartProbe(aside,svg,{label:'Inspect population response',bounds:{x:594,y:54,width:271,height:273},domain:[0,12],step:.05,xLabel:'Teaching time',sample:t=>orientationRates(sweep?(angle+180*t/12)%180:angle,width).map((value,i)=>({label:`${[0,45,90,135][i]}° neuron`,value,unit:'relative units'})),context:()=>`Start ${angle}° · tuning width ${width}° · ${sweep?'rotating':'fixed'} stimulus`,onSeek:t=>clock?.seek(t)});
  }else if(lab==='propagation'){
    title.textContent='One signal, two conduction patterns';description.textContent='Compare continuous regeneration with regeneration at nodes between myelin segments.';
    svg.setAttribute('aria-label','Unmyelinated and myelinated axons show local membrane voltage changes spreading from left to right. Myelinated conduction regenerates spikes at nodes.');
    settings.hidden=true;const begin=88,length=732,nodeXs=Array.from({length:8},(_,i)=>begin+i*length/7),topY=123,bottomY=277;
    text(88,36,'Unmyelinated',colors.mint,26);text(88,202,'Myelinated',colors.violet,26);
    for(const y of[topY,bottomY]){line(`M${begin} ${y-16}H${begin+length}`,'#557a80',2);line(`M${begin} ${y+16}H${begin+length}`,'#557a80',2);}
    const sleeves:SVGElement[]=[];for(let i=0;i<7;i++){
      const sleeve=svgNode('rect',{x:nodeXs[i]+13,y:bottomY-28,width:nodeXs[i+1]-nodeXs[i]-26,height:56,rx:18,fill:'#303553',stroke:'#b8abdd','stroke-width':2});svg.append(sleeve);sleeves.push(sleeve);
      for(const offset of[-18,-9,9,18])line(`M${nodeXs[i]+24} ${bottomY+offset}H${nodeXs[i+1]-24}`,'#706e99',1,.75);
    }
    const passive=line('',colors.amber,5,.9),topRefractory=line('',colors.amber,8,.45),topVoltage=line('',colors.mint,11),nodes=nodeXs.map(x=>{
      const group=svgNode('g');for(const sign of[-1,1])group.append(svgNode('rect',{x:x-6,y:bottomY+sign*16-5,width:12,height:10,rx:2,fill:'#72888f'}));svg.append(group);return group;
    });
    const currents=svgNode('g');svg.append(currents);const upperArrival=text(847,88,'',colors.mint,18,'end'),lowerArrival=text(847,240,'',colors.violet,18,'end');
    text(88,166,'Neighboring membrane regenerates the spike',colors.muted,20);text(88,331,'Nodes: spike regeneration',colors.violet,20);text(444,331,'Myelin: insulated internode',colors.muted,20);
    text(450,391,'Color shows local electrical state—not a traveling ion',colors.amber,22,'middle');
    render=time=>{
      const p=time/14,state=conductionState(p),front=begin+state.continuous*length,salt=state.saltatory*7,index=Math.min(7,Math.floor(salt)),fraction=salt-index;
      topVoltage.setAttribute('d',state.initiated&&state.continuous<1?`M${Math.max(begin,front-12)} ${topY}H${Math.min(begin+length,front+12)}`:'');
      topRefractory.setAttribute('d',state.initiated?`M${Math.max(begin,front-90)} ${topY}H${Math.max(begin,front-17)}`:'');
      const localPosition=(p-.08)/.48*7,localAge=localPosition-index,localExcitation=state.initiated&&localAge>=0&&localAge<.33;
      passive.setAttribute('d',state.initiated&&state.saltatory<1?`M${nodeXs[index]} ${bottomY}H${nodeXs[index]+fraction*length/7}`:'');
      nodes.forEach((group,i)=>{const age=localPosition-i,excitation=state.initiated&&age>=0&&age<.33,recent=age>=.33&&age<1.4;for(const n of Array.from(group.children))attr(n,{fill:excitation?colors.mint:recent?colors.amber:'#72888f',opacity:recent?.7:1});});
      currents.replaceChildren();
      if(localExcitation){const x=nodeXs[index];currents.append(svgNode('path',{d:`M${x} ${bottomY-53}v25m-5-6 5 6 5-6`,stroke:colors.mint,'stroke-width':3,fill:'none'}));}
      upperArrival.textContent=state.continuous>=1?'arrived':'';lowerArrival.textContent=state.saltatory>=1?'arrived':'';
      if(!state.initiated)explain('Initiation · Both fibers start at the left. This comparison uses illustrative speeds and distances.');
      else if(state.saltatory>=1&&state.continuous<1)explain('Earlier distal arrival · The myelinated fiber reaches the end sooner here. The unmyelinated fiber continues regenerating the spike along its membrane.');
      else if(state.continuous>=1)explain('Both arrive · Conduction transmits a change in voltage. Individual ions move locally; they do not traverse the length of the axon.');
      else if(fraction<.33)explain(`Node ${index+1} · Local voltage-gated channels regenerate the action potential. The small arrow shows local inward current across this node’s membrane.`);
      else explain(`Between nodes ${index+1} and ${index+2} · Local current spreads under myelin and depolarizes the next node. This internodal spread is passive.`);
    };
    note.textContent='Teaching comparison, not a scale model or measured speed ratio. Myelin reduces current loss and membrane capacitance; action potentials regenerate at nodes of Ranvier. Color indicates active voltage, recent activity, or local current—not individual ions.';start(14);
  }else{
    title.textContent='Choose a method for the question';description.textContent='Select a plotted method or use the buttons to compare its evidence and assumptions.';transport.hidden=true;settings.open=true;settingsSummary.textContent='Select a method';
    const methods=[{name:'EEG / ERP',x:540,y:92,text:'Electrical activity recorded at the scalp. Excellent timing; locating underlying generators requires an inverse model and is less direct.'},{name:'fMRI',x:190,y:262,text:'BOLD reflects a hemodynamic response associated with neural activity. More spatially localized than scalp EEG, with a slower temporal response.'},{name:'Single-unit recording',x:110,y:86,text:'Spikes from individual neurons with high temporal precision. Invasive, with a limited cell sample; selectivity alone does not establish necessity.'},{name:'TMS',x:365,y:179,text:'Stimulation perturbs cortical processing. Effects can support causal inference with appropriate controls; perturbation is not a recording of information content.'}];let selected=0;
    const buttons:HTMLButtonElement[]=[];render=()=>{
      svg.replaceChildren();line('M82 59V337H850','#66848e',1.5);text(82,30,'Faster temporal evidence ↑');text(465,391,'More spatially distributed measurement →',colors.muted,21,'middle');
      methods.forEach((m,i)=>{svg.append(svgNode('circle',{cx:m.x,cy:m.y,r:i===selected?16:9,fill:i===selected?colors.mint:'#426371',stroke:colors.mint,'stroke-width':i===selected?2:0}));text(m.x+25,m.y+7,m.name,i===selected?'#edf7e9':colors.muted,22);buttons[i]?.setAttribute('aria-pressed',String(i===selected));});explain(methods[selected].text);
    };
    methods.forEach((m,i)=>{const button=node('button',m.name);button.type='button';button.addEventListener('click',()=>{if(!disposed){selected=i;render(0);}});buttons.push(button);controls.append(button);});
    svg.setAttribute('tabindex','0');svg.setAttribute('role','group');svg.setAttribute('aria-label','Qualitative methods comparison. Hover or click a method; arrow keys select methods. Positions are qualitative, not numeric resolution measurements.');
    function methodAt(event:PointerEvent){const p=clientChartPoint({x:event.clientX,y:event.clientY},svg.getBoundingClientRect(),{width:900,height:410});if(!p)return-1;return methods.findIndex(m=>Math.hypot(p.x-m.x,p.y-m.y)<35);}
    extraListener('pointermove',((event:PointerEvent)=>{if(!active||disposed)return;const i=methodAt(event);if(i>=0)explain(methods[i].text);}) as EventListener);
    extraListener('pointerleave',()=>{if(!disposed)explain(methods[selected].text);});
    extraListener('click',((event:PointerEvent)=>{if(!active||disposed)return;const i=methodAt(event);if(i>=0){selected=i;render(0);}}) as EventListener);
    extraListener('keydown',((event:KeyboardEvent)=>{if(!active||disposed)return;let next=selected;if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(selected+1)%methods.length;else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(selected+methods.length-1)%methods.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=methods.length-1;else return;event.preventDefault();event.stopPropagation();selected=next;render(0);}) as EventListener);
    note.textContent='Qualitative comparison, not calibrated resolution. Hover or select a method to read its evidence and assumptions. Arrow keys work in the chart. TMS is a perturbation method; its marker is a teaching reference, not a measurement-resolution estimate. Task, analysis and experimental design affect every method.';render(0);
  }
  const visibility=()=>clock?.setVisible(!document.hidden),motion=()=>{if(reduced.matches)clock?.pause();};
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motion);
  const cleanup:LectureLabCleanup=Object.assign(()=>{if(disposed)return;disposed=true;clock?.dispose();probe?.destroy();extraCleanup.forEach(remove=>remove());document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);host.replaceChildren();},{setActive:(value:boolean)=>{if(!disposed){active=value;clock?.setActive(value);probe?.setActive(value);}}});
  return cleanup;
}
