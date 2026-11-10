// Finite lecture illustrations; no patient model or numerical lesion severity.
type ParietalSide='left'|'right';
export function toggleParietalLesion(current:ParietalSide|null,side:ParietalSide):ParietalSide|null{return current===side?null:side;}
export function initParietalAttention(present: (surface: HTMLElement, button: HTMLButtonElement) => Promise<void>) {
  const root=document.querySelector<HTMLElement>('[data-parietal-attention]');if(!root)return;
  const get=<T extends Element=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  const lobes=[...root.querySelectorAll<SVGGElement>('[data-parietal-lobe]')];
  let lesion:ParietalSide|null=null,preview:ParietalSide|null=null;
  const captions={
    none:'Right parietal attention covers both sides, favoring the left. Left parietal attention mainly supports the right.',
    left:'With the left contribution reduced, the right parietal lobe still covers right space as well as left space. Substantial compensation is possible; some deficits can remain.',
    right:'With the right contribution reduced, the remaining left parietal lobe mainly supports right space. Left-side attention is more affected; the environment is still present.'
  };
  const hint=()=>{
    root.dataset.preview=preview||'none';
    get('[data-parietal-hint]').textContent=!preview?'Hover over a lobe to fade it. Click to place a lesion; click it again to remove the lesion.':lesion===preview?'Click this lobe again to remove the lesion marker.':lesion?`Click to move the lesion to the ${preview} parietal lobe.`:`Click to place a lesion in the ${preview} parietal lobe.`;
  };
  const render=()=>{
    root.dataset.lesion=lesion||'none';
    get('[data-parietal-stage]').textContent=lesion?`${lesion.toUpperCase()} PARIETAL LESION`:'BOTH CONTRIBUTIONS AVAILABLE';
    get('[data-parietal-caption]').textContent=captions[lesion||'none'];
    lobes.forEach(lobe=>lobe.setAttribute('aria-pressed',String(lobe.dataset.parietalLobe===lesion)));
    hint();
  };
  for(const lobe of lobes){
    const side=lobe.dataset.parietalLobe as ParietalSide;
    const toggle=()=>{lesion=toggleParietalLesion(lesion,side);render();};
    lobe.addEventListener('click',toggle);
    lobe.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)toggle();}});
    for(const event of ['pointerenter','focus'])lobe.addEventListener(event,()=>{preview=side;hint();});
    for(const event of ['pointerleave','blur'])lobe.addEventListener(event,()=>{if(preview===side){preview=null;hint();}});
  }
  get('[data-parietal-reset]').addEventListener('click',()=>{lesion=null;preview=null;render();});
  get('[data-illustration-fullscreen]').addEventListener('click',event=>{void present(root,event.currentTarget as HTMLButtonElement);});
  render();
}

export function initRepresentationalNeglect(present: (surface: HTMLElement, button: HTMLButtonElement) => Promise<void>) {
  const root=document.querySelector<HTMLElement>('[data-representational-neglect]');if(!root)return;
  const get=<T extends Element=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  type Viewpoint='duomo'|'away'|'compare';let viewpoint:Viewpoint='duomo';let step=0;
  const controls=[...root.querySelectorAll<HTMLButtonElement>('[data-viewpoint]')];
  const captions:Record<Viewpoint,string[]>={
    duomo:['Imagine standing in the square, facing the Duomo. The building symbols mark the spatial knowledge available to describe.','From this imagined viewpoint, patients reported buildings to their right and omitted those to their left. Here, D, E, and F represent the reported group.','The omitted buildings stay in the map. Switch to the opposite viewpoint to see whether that knowledge can enter the report.'],
    away:['Now imagine standing at the Duomo, facing back across the same square. The buildings have not moved.','The imagined right is now the screen’s left: A, B, and C are reported. The new imagined left, D, E, and F, is omitted.','Previously omitted landmarks are now described. What is accessed changes with imagined attention; the spatial knowledge was not erased.'],
    compare:['Compare the two reports from the same remembered square. Each viewpoint supplies a different set of landmarks.','Green marks the report while facing the Duomo; purple marks the report while facing away. Together the reports include both sides.','The patients had access to the spatial knowledge across viewpoints. The finding concerns neglect within imagined space, not simply loss of the stored landmarks.']
  };
  const render=()=>{
    const revealed=step>0;
    root.querySelectorAll<SVGGElement>('[data-landmark]').forEach(building=>{
      const side=building.dataset.worldSide;
      const reported=revealed&&(viewpoint==='compare'||side===(viewpoint==='duomo'?'right':'left'));
      building.classList.toggle('is-unreported',revealed&&!reported);
      building.classList.toggle('report-duomo',reported&&side==='right');
      building.classList.toggle('report-away',reported&&side==='left');
    });
    const observer=get<SVGGElement>('[data-square-observer]');
    observer.style.opacity=viewpoint==='compare'?'.25':'1';
    observer.setAttribute('transform',viewpoint==='away'?'translate(595 220) rotate(180)':'translate(595 555)');
    get('[data-square-facing]').textContent=viewpoint==='compare'?'Both reports':viewpoint==='duomo'?'Facing the Duomo':'Facing away from the Duomo';
    get('[data-square-report]').textContent=!revealed?'Reveal the report':viewpoint==='compare'?'A · B · C + D · E · F':viewpoint==='duomo'?'Reported: D · E · F':'Reported: A · B · C';
    get('[data-square-caption]').textContent=captions[viewpoint][step];
    get('[data-square-stage]').textContent=`${step+1} / 3 · ${['VIEWPOINT','REPORT','INTERPRETATION'][step]}`;
    get<HTMLButtonElement>('[data-square-prev]').disabled=step===0;get<HTMLButtonElement>('[data-square-next]').disabled=step===2;
    controls.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.viewpoint===viewpoint)));
  };
  controls.forEach(button=>button.addEventListener('click',()=>{viewpoint=button.dataset.viewpoint as Viewpoint;step=0;render();}));
  get('[data-square-prev]').addEventListener('click',()=>{step=Math.max(0,step-1);render();});
  get('[data-square-next]').addEventListener('click',()=>{step=Math.min(2,step+1);render();});
  get('[data-square-reset]').addEventListener('click',()=>{viewpoint='duomo';step=0;render();});
  get('[data-illustration-fullscreen]').addEventListener('click',event=>{void present(root,event.currentTarget as HTMLButtonElement);});
  render();
}

type Scale='global'|'local';type Stimulation='pre'|'left'|'right';
export function salienceResult(bias:Scale,target:Scale,condition:Stimulation) {
  const salient=bias===target;
  const impaired=condition==='right'?salient:condition==='left'?!salient:false;
  return {salient,impaired,reference:condition==='pre'};
}
export function initSalienceSelection(present: (surface: HTMLElement, button: HTMLButtonElement) => Promise<void>) {
  const root=document.querySelector<HTMLElement>('[data-salience-selection]');if(!root)return;
  const get=<T extends Element=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
  let revealed=false;
  const render=()=>{
    const bias=get<HTMLSelectElement>('[data-salience-bias]').value as Scale;
    const target=get<HTMLSelectElement>('[data-salience-target]').value as Scale;
    const condition=get<HTMLSelectElement>('[data-salience-condition]').value as Stimulation;
    const result=salienceResult(bias,target,condition);
    const letters=get<SVGGElement>('[data-salience-letters]');letters.classList.toggle('global-bias',bias==='global');letters.classList.toggle('local-bias',bias==='local');
    get('[data-salience-task]').textContent=target==='global'?'Name the global letter: H':'Name the local letter: S';
    get('[data-salience-level]').textContent=result.salient?'More salient':'Less salient';
    get('[data-salience-comparison]').textContent={pre:'Pre-TMS reference',left:'Left PPC TMS vs. pre-TMS',right:'Right PPC TMS vs. pre-TMS'}[condition];
    get('[data-salience-result]').textContent=!revealed?'Reveal after setting the comparison':result.reference?'Reference performance':result.impaired?'Worse performance':'No significant change reported';
    get('[data-salience-stage]').textContent=revealed?'REPORTED STUDY RESULT':'SETUP';
    const setup=bias==='global'?'Blurring the small S letters favors the global H.':'Alternating the small letters’ colors favors local S.';
    get('[data-salience-caption]').textContent=!revealed?`${setup} Naming ${target==='global'?'H':'S'} selects the ${result.salient?'more':'less'} salient information.`:result.reference?'Pre-TMS performance is the reference for the stimulation comparison. Keep the bias and task fixed when comparing stimulation conditions.':result.impaired?`${condition==='right'?'Right':'Left'} PPC TMS impaired selection of the ${result.salient?'more':'less'} salient target in this task.`:`For this target, ${condition==='right'?'right':'left'} PPC TMS produced no significant change. The result does not establish an improvement.`;
    get<HTMLButtonElement>('[data-salience-reveal]').disabled=revealed;
  };
  root.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{revealed=false;render();}));
  get('[data-salience-reveal]').addEventListener('click',()=>{revealed=true;render();});
  get('[data-salience-reset]').addEventListener('click',()=>{get<HTMLSelectElement>('[data-salience-bias]').value='global';get<HTMLSelectElement>('[data-salience-target]').value='global';get<HTMLSelectElement>('[data-salience-condition]').value='pre';revealed=false;render();});
  get('[data-illustration-fullscreen]').addEventListener('click',event=>{void present(root,event.currentTarget as HTMLButtonElement);});
  render();
}
