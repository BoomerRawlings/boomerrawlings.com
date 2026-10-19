/* Shared scan: clock first, then surf and sky, left to right and top to bottom. */
(function(root){
 'use strict';
 root.ScrippsEffects={blue:'#00629B',yellow:'#FFCD00',skyHandoff:650,skyFadeDuration:180,scanEnd:950,sample:function(now,region,x,y){
  var age=((now%30000)+30000)%30000;
  // A faint clock-only charge precedes the release; it never starts the jitter.
  var charge=region==='clock'?Math.max(0,Math.min(1,(age-29100)/900)):0;
  charge*=charge;
  var start=region==='clock'?Math.max(0,Math.min(1,x))*55:
   170+Math.max(0,Math.min(311,y))/311*620+Math.max(0,Math.min(460,x))/460*70;
  var duration=region==='clock'?95:90,elapsed=age-start;
  if(elapsed<0||elapsed>duration)return {strength:0,offset:0,color:null,charge:charge};
  var strength=Math.sin(elapsed/duration*Math.PI);
  return {strength:strength,offset:Math.sin(elapsed*.11)*strength*1.4,color:Math.floor(elapsed/24)%2?'#FFCD00':'#00629B',charge:charge};
 }};
})(window);
