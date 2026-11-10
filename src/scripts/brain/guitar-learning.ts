import { beginTrial, initialLearningState, markerScale, MAX_TRIALS, moveTrial, type Outcome } from './guitar-learning-model';
import { cycleFrame, CYCLE_SECONDS, signalClock, signalEvents, type ActivityKey } from './guitar-learning-motion';

export function initGuitarLearning(present:(surface:HTMLElement,button:HTMLButtonElement)=>Promise<void>) {
  const root=document.querySelector<HTMLElement>('[data-guitar-learning]');if(!root)return;
  const get=<T extends Element=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const ns='http://www.w3.org/2000/svg';
  let state=initialLearningState(),time=0,playing=false,active=false,frameId=0,last=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const strums=[...root.querySelectorAll<HTMLButtonElement>('[data-strum]')];
  const play=get<HTMLButtonElement>('[data-learning-play]');
  const layer=get<SVGGElement>('[data-signal-layer]');
  const flows=[...root.querySelectorAll<SVGPathElement>('[data-flow]')].map(path=>{
    const key=path.dataset.flow as ActivityKey;
    const particles=Array.from({length:30},()=>{
      const particle=document.createElementNS(ns,key==='dopamine'?'circle':key==='input'||key==='stn'||key==='thalamus'?'path':'rect');
      if(particle.tagName==='circle')particle.setAttribute('r','4');
      else if(particle.tagName==='path')particle.setAttribute('d','M-5-5L6 0L-5 5Z');
      else {particle.setAttribute('x','-4');particle.setAttribute('y','-4');particle.setAttribute('width','8');particle.setAttribute('height','8');}
      particle.setAttribute('fill',path.getAttribute('stroke')!);layer.append(particle);return particle;
    });
    return {path,key,particles,length:path.getTotalLength(),events:{good:signalEvents('good',key),poor:signalEvents('poor',key)}};
  });
  const tracePositions:[ActivityKey,number,number,number][]=[['input',421,172,170],['return',741,172,170],['dopamine',76,307,158],['nogo',373,413,145],['go',578,413,145],['gpe',377,508,143],['stn',234,603,145],['gpi',613,607,145],['thalamus',1003,422,194]];
  const traces=tracePositions.map(([key,x,y,width])=>{
    const path=document.createElementNS(ns,'path');path.setAttribute('fill','none');path.setAttribute('stroke','#1d3552');path.setAttribute('stroke-width','1.5');get('[data-rate-layer]').append(path);
    return {key,x,y,width,path,events:{good:signalEvents('good',key),poor:signalEvents('poor',key)}};
  });
  const names=['CORTICAL INPUT','GO PATHWAY','RELEASING THE BRAKE','RETURN TO CORTEX','MOVEMENT OUTCOME','DOPAMINE FEEDBACK','LEARNING','LEARNED BIAS'];
  const captions=(outcome:Outcome)=>[
    'Cortical input activates the Go pathway for the guitar movement.',
    'Go neurons increase their inhibitory output to GPi.',
    'GPi fires less, reducing its ongoing inhibition of the thalamus.',
    'The thalamus sends more excitation back to cortex, supporting the movement.',
    outcome==='good'?'The strum goes well. Its outcome provides feedback for learning.':'The strum goes poorly. Its outcome provides feedback for learning.',
    outcome==='good'?'SNc dopamine briefly increases at the striatum.':'SNc dopamine briefly falls below its usual level.',
    outcome==='good'?'Cortical input to Go strengthens through LTP; input to No-Go weakens.':'Go weakens through LTD; No-Go strengthens through LTP.',
    outcome==='good'?'Dopamine returns to baseline. Stronger Go input makes this movement easier to select.':'Dopamine returns to baseline. Stronger No-Go input makes this movement less likely.'
  ];
  let lastCaption='';
  function render(){
    const trial=state.trial,outcome=trial?.outcome||'good';
    const sample=cycleFrame(trial?time:0,outcome,trial?.before||state.strength,trial?.after||state.strength);
    if(trial)while(state.trial!.step<sample.step)state=moveTrial(state,1);
    const strength=trial?sample.strength:state.strength;
    get<SVGCircleElement>('[data-go-marker]').style.transform=`scale(${markerScale(strength.go)})`;
    get<SVGCircleElement>('[data-nogo-marker]').style.transform=`scale(${markerScale(strength.nogo)})`;
    const caption=trial?captions(outcome)[sample.phase]:'Choose a strum to watch the movement and its learning feedback.';
    if(caption!==lastCaption){get('[data-learning-caption]').textContent=caption;get('[data-learning-step-label]').textContent=trial?names[sample.phase]:'READY';lastCaption=caption;}
    const dopamine=trial&&time>=15&&time<26;
    get('[data-dopamine-label]').textContent=dopamine?(outcome==='good'?'Dopamine burst':'Dopamine dip'):'Dopamine baseline';
    get('[data-learning-summary]').textContent=trial&&time>=18?'Learned input strength persists after dopamine returns to baseline.':'GPi provides the ongoing inhibitory brake on the thalamus.';
    for(const [selector,on] of [['[data-cortex]',!!trial&&time<3],['[data-gpi]',!!trial&&time>=4&&time<9],['[data-thalamus]',!!trial&&time>=6&&time<12],['[data-snc]',!!trial&&dopamine]] as const)get(selector).classList.toggle('node-focused',on);
    const signal=signalClock(trial?time:0),clock=signal.time;
    layer.style.opacity=String(signal.opacity);get<SVGGElement>('[data-rate-layer]').style.opacity=String(signal.opacity);
    for(const flow of flows){
      const visible=flow.events[outcome].filter(emitted=>emitted<=clock&&(clock-emitted)*160<flow.length);
      flow.particles.forEach((particle,i)=>{
        const emitted=visible[i];particle.style.display=emitted===undefined||reduced.matches?'none':'';
        if(emitted===undefined)return;
        const distance=(clock-emitted)*160,point=flow.path.getPointAtLength(distance),ahead=flow.path.getPointAtLength(Math.min(flow.length,distance+1));
        particle.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(${Math.atan2(ahead.y-point.y,ahead.x-point.x)*180/Math.PI})`);
      });
    }
    for(const trace of traces){
      let d=`M${trace.x} ${trace.y}`;
      for(const emitted of trace.events[outcome]){
        const age=clock-emitted;if(age<0||age>2.8)continue;
        const x=trace.x+trace.width*(1-age/2.8);
        if(x<trace.x+4||x>trace.x+trace.width-6)continue;
        d+=`L${x-4} ${trace.y}L${x-1} ${trace.y-10}L${x+2} ${trace.y+2}L${x+6} ${trace.y}`;
      }
      trace.path.setAttribute('d',`${d}L${trace.x+trace.width} ${trace.y}`);
    }
    root.dataset.cycleTime=time.toFixed(2);root.dataset.cycleState=active?(playing?'playing':'paused'):'rest';
    root.querySelectorAll<HTMLElement>('[data-learning-step]').forEach(node=>node.classList.toggle('step-current',!!trial&&Number(node.dataset.learningStep)===sample.step));
    play.disabled=!active;play.textContent=active?(playing?'Ⅱ Pause cycle':'▶ Resume cycle'):(trial?'Cycle complete':'Ⅱ Pause cycle');
    strums.forEach(button=>button.disabled=active||state.completed>=MAX_TRIALS);
    get('[data-learning-count]').textContent=`${state.completed} / ${MAX_TRIALS} strums${state.completed===MAX_TRIALS?' · Reset to begin again':''}`;
  }
  function tick(now:number){
    if(!playing)return;
    time=Math.min(CYCLE_SECONDS,time+Math.min(.1,(now-last)/1000));last=now;
    if(time===CYCLE_SECONDS){playing=false;active=false;}
    render();if(playing)frameId=requestAnimationFrame(tick);
  }
  function pause(){playing=false;cancelAnimationFrame(frameId);render();}
  function start(){playing=true;last=performance.now();render();frameId=requestAnimationFrame(tick);}
  strums.forEach(button=>button.addEventListener('click',()=>{
    if(active||state.completed>=MAX_TRIALS)return;
    state=beginTrial(state,button.dataset.strum as Outcome);time=0;active=true;start();
  }));
  play.addEventListener('click',()=>playing?pause():start());
  get('[data-learning-reset]').addEventListener('click',()=>{playing=false;active=false;cancelAnimationFrame(frameId);time=0;state=initialLearningState();render();});
  get('[data-learning-fullscreen]').addEventListener('click',event=>void present(root,event.currentTarget as HTMLButtonElement));
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
  window.addEventListener('pagehide',pause);
  reduced.addEventListener('change',render);
  render();
}
