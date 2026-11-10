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
    root.dataset.preview=lesion?'none':preview||'none';
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
  let viewpoint='duomo';
  const controls=[...root.querySelectorAll<HTMLButtonElement>('[data-viewpoint]')];
  const render=()=>{
    root.querySelectorAll<HTMLImageElement>('[data-square-scene]').forEach(img=>{img.hidden=img.dataset.squareScene!==viewpoint;});
    controls.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.viewpoint===viewpoint)));
  };
  controls.forEach(button=>button.addEventListener('click',()=>{viewpoint=button.dataset.viewpoint!;render();}));
  root.querySelector('[data-square-reset]')!.addEventListener('click',()=>{viewpoint='duomo';render();});
  root.querySelector('[data-illustration-fullscreen]')!.addEventListener('click',event=>{void present(root,event.currentTarget as HTMLButtonElement);});
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
    root.querySelectorAll<SVGImageElement>('[data-salience-stimulus]').forEach(image=>image.setAttribute('visibility',image.dataset.salienceStimulus===bias?'visible':'hidden'));
    get('[data-salience-setup]').setAttribute('display',revealed?'none':'inline');
    get('[data-salience-evidence]').setAttribute('display',revealed?'inline':'none');
    get('[data-salience-heading]').textContent=revealed?'Read the original study result':'Set the task and comparison';
    get('[data-salience-evidence-target]').textContent=result.salient?'More-salient target':'Less-salient target';
    get('[data-salience-evidence-condition]').textContent={pre:'Pre-TMS reference',left:'Left PPC vs. pre-TMS',right:'Right PPC vs. pre-TMS'}[condition];
    get('[data-salience-task]').textContent=target==='global'?'Name the global letter: H':'Name the local letter: S';
    get('[data-salience-level]').textContent=result.salient?'More salient':'Less salient';
    get('[data-salience-comparison]').textContent={pre:'Pre-TMS reference',left:'Left PPC TMS vs. pre-TMS',right:'Right PPC TMS vs. pre-TMS'}[condition];
    get('[data-salience-result]').textContent=!revealed?'Reveal after setting the comparison':result.reference?'Reference performance':result.impaired?'Worse performance':'No significant change';
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
