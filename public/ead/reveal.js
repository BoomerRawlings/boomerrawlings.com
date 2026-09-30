(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const running=new Set();
  let launched=false, atlasAnimated=false;
  function animate(node,frames,options) {
    const a=node.animate(frames,{fill:'both',...options}); running.add(a);
    a.finished.then(()=>{a.cancel();running.delete(a);},()=>running.delete(a));
    return a;
  }
  function revealAtlas() {
    if(!launched || atlasAnimated || reduced.matches) return;
    const root=document.getElementById('atlas-root');
    if(!root.querySelector('svg'))return;
    atlasAnimated=true;
    // Distance from the lion sets the arrival time of each interface element.
    const nodes=root.querySelectorAll('button,aside,header,h2,.atlas-legend');
    nodes.forEach((node,i)=>{
      const box=node.getBoundingClientRect();
      const distance=Math.hypot(box.left+box.width/2-innerWidth/2,box.top+box.height/2-39);
      animate(node,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:700,delay:Math.min(900,distance*.5)+(i%3)*35,easing:'cubic-bezier(.2,.7,.2,1)'});
    });
    root.querySelectorAll('svg path').forEach((path,i)=>{
      if(typeof path.getTotalLength!=='function')return;
      const length=path.getTotalLength();
      if(!length)return;
      animate(path,[{opacity:0,strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{opacity:1,strokeDasharray:`${length} ${length}`,strokeDashoffset:0}],{duration:1500,delay:150+(i%8)*70,easing:'cubic-bezier(.2,.6,.25,1)'});
    });
  }
  document.addEventListener('ead:reveal',()=>{
    if(launched || reduced.matches)return;
    launched=true;
    const workspace=document.getElementById('research-workspace');
    animate(workspace,[{clipPath:'circle(0px at 50% 39px)'},{clipPath:'circle(150vmax at 50% 39px)'}],{duration:1700,easing:'cubic-bezier(.12,.5,.2,1)'});
    const wave=document.createElement('div');wave.className='launch-wave';wave.setAttribute('aria-hidden','true');document.body.append(wave);
    const a=animate(wave,[{transform:'scale(0)',opacity:.45},{transform:'scale(1)',opacity:0}],{duration:1900,easing:'cubic-bezier(.12,.5,.2,1)'});
    a.finished.then(()=>wave.remove(),()=>wave.remove());
    for(const node of document.querySelectorAll('.workspace-bar,.masthead .dateline'))animate(node,[{opacity:0,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],{duration:750,delay:200,easing:'ease-out'});
    revealAtlas();
  },{once:true});
  document.addEventListener('ead:atlas-ready',revealAtlas,{once:true});
  reduced.addEventListener('change',()=>{if(reduced.matches)running.forEach(a=>a.cancel());});
})();
