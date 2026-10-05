const thresholds=[Infinity,.84,.62,.42];
const smoothstep=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};

/** Small wheel and trackpad deltas accumulate into one camera destination. */
export function wheelZoomFactor(deltaY:number,deltaMode=0,pageHeight=800){
  const pixels=deltaY*(deltaMode===1?16:deltaMode===2?pageHeight:1);
  return Math.exp(Math.max(-120,Math.min(120,pixels))*.0018);
}
export function zoomDetailLevel(ratio:number){return ratio>.84?0:ratio>.62?1:ratio>.42?2:3;}
export function detailOpacity(ratio:number,min:number,max=3){
  const reveal=min===0?1:1-smoothstep((ratio-thresholds[min]+.055)/.11);
  const conceal=max===3?1:smoothstep((ratio-thresholds[max+1]+.055)/.11);
  return reveal*conceal;
}
export function cameraBlend(dt:number){return 1-Math.exp(-Math.min(Math.max(dt,0),.05)*12);}
