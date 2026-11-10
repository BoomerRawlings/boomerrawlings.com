interface IllustrationStep {title:string;caption:string;poster:string}
interface IllustrationMode {id:string;title:string;steps:IllustrationStep[]}
export function initStepIllustrations(present:(surface:HTMLElement,button:HTMLButtonElement)=>Promise<void>){
  for(const root of document.querySelectorAll<HTMLElement>('[data-step-illustration]')){
    const modes=JSON.parse(root.dataset.stepConfig||'[]') as IllustrationMode[];
    if(!modes.length)continue;
    const get=<T extends Element=HTMLElement>(selector:string)=>root.querySelector<T>(selector)!;
    let mode=modes[0],step=0;
    const image=get<HTMLImageElement>('[data-illustration-image]');
    const screen=get<HTMLElement>('.finite-screen');
    image.addEventListener('load',()=>screen.setAttribute('aria-busy','false'));
    image.addEventListener('error',()=>{screen.setAttribute('aria-busy','false');get('[data-illustration-stage]').textContent='Image unavailable · Replay to retry';get('[data-illustration-caption]').textContent='This step could not load. Select Replay steps to try again.';});
    const render=()=>{
      const current=mode.steps[step];
      if(image.getAttribute('src')!==current.poster){screen.setAttribute('aria-busy','true');image.src=current.poster;}
      image.alt=current.caption;
      get('[data-illustration-stage]').textContent=`${step+1} / ${mode.steps.length} · ${mode.title} · ${current.title}`;
      get('[data-illustration-caption]').textContent=current.caption;
      get<HTMLButtonElement>('[data-illustration-prev]').disabled=step===0;
      get<HTMLButtonElement>('[data-illustration-next]').disabled=step===mode.steps.length-1;
      root.querySelector<HTMLButtonElement>('[data-circuit-mode]')?.setAttribute('aria-pressed',String(modes.indexOf(mode)<3));
    };
    const select=(id:string)=>{const next=modes.find(item=>item.id===id);if(next){mode=next;step=0;render();}};
    root.querySelector<HTMLSelectElement>('[data-illustration-mode]')?.addEventListener('change',event=>select((event.target as HTMLSelectElement).value));
    const slider=root.querySelector<HTMLInputElement>('[data-dopamine-setting]');
    const treatment=root.querySelector<HTMLSelectElement>('[data-treatment-mode]');
    const showCircuit=()=>{if(!slider)return;const next=modes[Number(slider.value)];slider.setAttribute('aria-valuetext',next.title);if(treatment)treatment.value='';select(next.id);};
    slider?.addEventListener('input',showCircuit);
    treatment?.addEventListener('change',()=>{if(treatment.value)select(treatment.value);else showCircuit();});
    root.querySelector('[data-circuit-mode]')?.addEventListener('click',showCircuit);
    get('[data-illustration-prev]').addEventListener('click',()=>{step=Math.max(0,step-1);render();});
    get('[data-illustration-next]').addEventListener('click',()=>{step=Math.min(mode.steps.length-1,step+1);render();});
    get('[data-illustration-replay]').addEventListener('click',()=>{step=0;image.removeAttribute('src');render();});
    get('[data-illustration-reset]').addEventListener('click',()=>{if(slider){slider.value='0';slider.setAttribute('aria-valuetext',modes[0].title);}if(treatment)treatment.value='';const modeChoice=root.querySelector<HTMLSelectElement>('[data-illustration-mode]');if(modeChoice)modeChoice.value=modes[0].id;select(modes[0].id);});
    get('[data-illustration-fullscreen]').addEventListener('click',event=>{void present(root,event.currentTarget as HTMLButtonElement);});
    render();
  }
}
