// Keep existing change handlers; replace visible menus with one choice at a time.
export function replaceDropdowns(root){
 for(const select of root.querySelectorAll('select')){
  if(select.dataset.path)continue;select.dataset.path='true';select.hidden=true;select.style.display='none';
  const box=document.createElement('div');box.className='choice-path';
  const previous=document.createElement('button'),next=document.createElement('button'),value=document.createElement('span');
  previous.type=next.type='button';previous.textContent='←';next.textContent='→';
  const label=select.labels?.[0]?.firstChild?.textContent.trim()||select.id;
  previous.setAttribute('aria-label','Previous '+label);next.setAttribute('aria-label','Next '+label);
  value.setAttribute('aria-live','polite');box.append(previous,value,next);select.after(box);
  function sync(){value.textContent=select.selectedOptions[0]?.textContent||'No choices';previous.disabled=select.selectedIndex<=0;next.disabled=select.selectedIndex>=select.options.length-1;}
  function move(delta){select.selectedIndex+=delta;select.dispatchEvent(new Event('change',{bubbles:true}));sync();}
  previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));select.addEventListener('change',sync);select.addEventListener('choice-sync',sync);
  new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true});sync();
 }
}
