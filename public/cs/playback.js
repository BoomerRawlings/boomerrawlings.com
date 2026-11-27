/** Presentation time only. This clock never creates or interpolates observations. */
export function intervalDuration(previousDate,nextDate,monthDuration=1500){
  const days=(Date.parse(nextDate+'T00:00:00Z')-Date.parse(previousDate+'T00:00:00Z'))/86400000;
  if(!Number.isFinite(days)||days<0)throw new RangeError('Playback dates must be chronological ISO dates.');
  const speed=monthDuration/1500;
  return Math.max(30,Math.min(monthDuration,Math.max(85*speed,days/30*monthDuration)));
}

/** One interval, one measured-state advance. Async loading cannot cause catch-up jumps. */
export function createPlaybackClock({onStep,duration=1500,now=()=>performance.now(),requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id)}){
  let running=false,elapsed=0,last=0,frame=null,pending=false,period=duration;
  const schedule=()=>{if(running&&!pending&&frame===null)frame=requestFrame(tick);};
  const tick=time=>{
    frame=null;if(!running)return;
    elapsed+=Math.max(0,time-last);last=time;
    if(elapsed<period){schedule();return;}
    elapsed=0;pending=true;
    Promise.resolve().then(onStep).catch(()=>{running=false;}).finally(()=>{pending=false;last=now();schedule();});
  };
  return {
    start({restart=false}={}){if(restart)elapsed=0;if(running)return;running=true;last=now();schedule();},
    pause(){if(running&&!pending)elapsed=Math.min(period,elapsed+Math.max(0,now()-last));running=false;if(frame!==null)cancelFrame(frame);frame=null;},
    reset(){this.pause();elapsed=0;},
    setDuration(value){if(!Number.isFinite(value)||value<=0)throw new RangeError('Positive finite playback duration required.');const time=now();if(running&&!pending)elapsed=Math.min(period,elapsed+Math.max(0,time-last));const fraction=period?elapsed/period:0;period=value;elapsed=Math.min(period,fraction*period);last=time;},
    get running(){return running;},get duration(){return period;},get remaining(){return Math.max(0,period-elapsed);},get pending(){return pending;}
  };
}
