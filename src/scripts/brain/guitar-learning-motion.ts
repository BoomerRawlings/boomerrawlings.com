import type { Outcome, Strength } from './guitar-learning-model';

export const CYCLE_SECONDS = 30;
export const smooth = (value: number) => { const q=Math.max(0,Math.min(1,value)); return q*q*(3-2*q); };
const rise = (t:number,start:number,end:number) => smooth((t-start)/(end-start));
const pulse = (t:number,start:number,peak:number,fall:number,end:number) => rise(t,start,peak)*(1-rise(t,fall,end));
export function focusAt(t:number) {
  // The cycle clock also drives emphasis: pausing freezes every transition.
  return {cortex:pulse(t,0,1.1,2.2,3.5),gpi:pulse(t,4,5.2,8,9.3),
    thalamus:pulse(t,6,7.2,11,12.3),snc:pulse(t,15,16.4,24.5,26)};
}

// Qualitative teaching sequence, not measured conduction or dopamine timing.
export function activityAt(t:number,outcome:Outcome) {
  const dopamine=pulse(t,15,17,24,26)*(outcome==='good'?1.5:-.8);
  return {
    input:1+1.4*pulse(t,0,2,10,12), go:1+1.6*pulse(t,2,4,10,12), nogo:1,
    gpe:1,stn:1,gpi:1-.8*pulse(t,4,6,10,12),
    thalamus:1+1.5*pulse(t,6,8,10,12), return:1+1.5*pulse(t,8,10,10,12), dopamine:1+dopamine,
  };
}
export type ActivityKey = keyof ReturnType<typeof activityAt>;
export function signalClock(t:number) {
  // Return to an identical baseline picture before stopping, without jumping
  // particles or retaining a dopamine burst in the paused starting trace.
  return {time:t>=29?0:t,opacity:t<28?1:t<29?1-smooth(t-28):smooth(t-29)};
}
export function cycleFrame(t:number,outcome:Outcome,before:Strength,after:Strength) {
  t=Math.max(0,Math.min(CYCLE_SECONDS,t));
  const growth=rise(t,18,24);
  const phase=t<3?0:t<6?1:t<9?2:t<12?3:t<15?4:t<18?5:t<24?6:7;
  return {phase, growth, step:t<12?0:t<15?1:t<18?2:t<26?3:4,
    strength:{go:before.go+(after.go-before.go)*growth,nogo:before.nogo+(after.nogo-before.nogo)*growth},
    rates:activityAt(t,outcome),done:t>=CYCLE_SECONDS};
}

// Persistent emitted events: changing frequency cannot move an existing signal.
export function signalEvents(outcome:Outcome,key:ActivityKey) {
  const result:number[]=[];let phase=0;
  for(let t=-4;t<=CYCLE_SECONDS;t+=.025){
    phase+=activityAt(t,outcome)[key]*2*.025;
    if(phase>=1){result.push(t);phase-=1;}
  }
  return result;
}
