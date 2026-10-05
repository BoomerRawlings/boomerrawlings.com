import type { PickSpec } from './scene-types';

/** Small disclosure with native search/buttons; the viewer owns selection and eligibility. */
export function createStructurePicker(onChoose:(id:string)=>void){
  const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
  const root=get<HTMLDivElement>('structure-picker'),trigger=get<HTMLButtonElement>('model-part');
  const panel=get<HTMLElement>('structure-panel'),search=get<HTMLInputElement>('structure-search');
  const results=get<HTMLDivElement>('structure-results'),status=get<HTMLSpanElement>('structure-status');
  let parts:PickSpec[]=[],focusedId:string|undefined;
  const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rows=()=>Array.from(results.querySelectorAll<HTMLButtonElement>('button'));

  function close(restoreFocus=false){
    panel.hidden=true;trigger.setAttribute('aria-expanded','false');
    if(restoreFocus)trigger.focus({preventScroll:true});
  }
  function render(){
    const active=document.activeElement as HTMLElement|null,activeId=active?.dataset.structureId;
    const tokens=normalize(search.value).trim().split(/\s+/).filter(Boolean);
    const matches=parts.filter(part=>tokens.every(token=>normalize(`${part.label} ${part.parentLabel||''}`).includes(token)));
    const scroll=results.scrollTop;
    results.replaceChildren();
    const groups=[matches.filter(part=>(part.level??0)===0),matches.filter(part=>(part.level??0)>0)];
    const grouped=groups.every(group=>group.length>0);
    for(const [index,group] of groups.entries()){
      if(!group.length)continue;
      if(grouped){const heading=document.createElement('p');heading.className='structure-group';heading.textContent=index?'Fine details':'Structures';results.append(heading);}
      for(const part of group){
        const row=document.createElement('button');row.type='button';row.dataset.structureId=part.id;
        row.tabIndex=results.querySelector('button')?-1:0;
        row.setAttribute('aria-pressed',String(part.id===focusedId));
        const label=document.createElement('span');label.textContent=part.label;
        if(part.parentLabel){const context=document.createElement('small');context.textContent=part.parentLabel;label.append(context);}
        const icon=document.createElement('span');icon.className='structure-result-icon';icon.setAttribute('aria-hidden','true');icon.textContent=part.id===focusedId?'✓':'↗';
        row.append(label,icon);
        row.addEventListener('focus',()=>{for(const item of rows())item.tabIndex=item===row?0:-1;});
        row.addEventListener('click',()=>{close(true);if(part.id!==focusedId)onChoose(part.id);});
        results.append(row);
      }
    }
    get('structure-empty').hidden=matches.length>0;
    status.textContent=tokens.length?`${matches.length} of ${parts.length} structures`:`${parts.length} at this zoom`;
    results.scrollTop=scroll;
    if(activeId){const replacement=rows().find(row=>row.dataset.structureId===activeId);(replacement||search).focus({preventScroll:true});replacement?.scrollIntoView({block:'nearest'});}
  }
  function open(){
    if(!parts.length)return;
    search.value='';render();results.scrollTop=0;
    // Keep the panel above its trigger and within the visible viewer on short screens.
    const top=trigger.getBoundingClientRect().top;
    panel.style.maxHeight=`${Math.max(180,Math.min(370,top-20))}px`;
    panel.hidden=false;trigger.setAttribute('aria-expanded','true');search.focus({preventScroll:true});
  }
  trigger.addEventListener('click',()=>panel.hidden?open():close());
  get('structure-close').addEventListener('click',()=>close(true));
  search.addEventListener('input',()=>{results.scrollTop=0;render();});
  root.addEventListener('keydown',event=>{
    if(panel.hidden)return;
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);return;}
    const buttons=rows(),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(event.target===search){
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();(event.key==='ArrowDown'?buttons[0]:buttons.at(-1))?.focus();}
      else if(event.key==='Enter'&&buttons.length){event.preventDefault();buttons[0].click();}
    }else if(index>=0){
      if(event.key==='ArrowDown'){event.preventDefault();buttons[Math.min(index+1,buttons.length-1)].focus();}
      if(event.key==='ArrowUp'){event.preventDefault();(buttons[index-1]||search).focus();}
      if(event.key==='Home'||event.key==='End'){event.preventDefault();(event.key==='Home'?buttons[0]:buttons.at(-1))?.focus();}
    }
  });
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target as Node))close();});
  root.addEventListener('focusout',event=>{if(event.relatedTarget&&!root.contains(event.relatedTarget as Node))close();});
  return {
    close,
    reset(){close();search.value='';focusedId=undefined;},
    setParts(value:PickSpec[]){
      parts=value;trigger.disabled=!parts.length;
      get('structure-count').textContent=parts.length?String(parts.length):'';
      if(!parts.length){close();search.value='';results.replaceChildren();}
      else if(!panel.hidden)render();
    },
    setFocus(part:PickSpec|null){
      focusedId=part?.id;
      for(const row of rows()){const selected=row.dataset.structureId===focusedId;row.setAttribute('aria-pressed',String(selected));row.querySelector('.structure-result-icon')!.textContent=selected?'✓':'↗';}
    }
  };
}
