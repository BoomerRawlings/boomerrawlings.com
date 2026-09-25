import {campusTerms,fullTerms,termMarkup} from './campus-terms.js';

/** Recompute first use after filtering, without changing source strings or consuming hidden options. */
export function annotateCampusTerms(root,institutions) {
  const dictionary=campusTerms(institutions);const seen=new Set();
  root.querySelectorAll('[data-campus-term]').forEach(node=>node.replaceWith(document.createTextNode(node.dataset.original)));
  root.querySelectorAll('option').forEach(option=>{
    option.dataset.originalLabel??=option.textContent;
    option.textContent=fullTerms(option.dataset.originalLabel,dictionary);
    option.title=option.textContent;
  });
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes) {
    const parent=node.parentElement;
    if(!node.textContent.trim()||!parent||parent.closest('script,style,textarea,code,pre,math,svg,abbr,select,noscript,[aria-hidden="true"],[data-campus-no-terms],.campus-sr-only'))continue;
    const interactive=!!parent.closest('a,button,summary');
    const verbatim=!!parent.closest('[data-campus-verbatim]');
    const template=document.createElement('template');
    template.innerHTML=termMarkup(node.textContent,dictionary,seen,{interactive,verbatim});
    node.replaceWith(template.content);
  }
}

export function enableCampusTermTooltips(root) {
  const tooltip=document.createElement('div');
  tooltip.id='campus-term-tooltip';tooltip.className='campus-term-tooltip';
  tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.body.append(tooltip);
  let active=null;
  function hide(){if(active)active.removeAttribute('aria-describedby');active=null;tooltip.hidden=true;}
  function show(target){
    const term=target.closest?.('.campus-abbreviation')??(target.matches?.('a,button,summary')?target.querySelector('.campus-abbreviation'):null);
    if(!term)return;
    hide();active=term;tooltip.textContent=term.dataset.definition;tooltip.hidden=false;
    term.setAttribute('aria-describedby',tooltip.id);
    const box=term.getBoundingClientRect();const bounds=tooltip.getBoundingClientRect();
    tooltip.style.left=`${Math.max(12,Math.min(box.left,document.documentElement.clientWidth-bounds.width-12))}px`;
    tooltip.style.top=`${box.bottom+bounds.height+12<innerHeight?box.bottom+8:Math.max(8,box.top-bounds.height-8)}px`;
  }
  root.addEventListener('mouseover',event=>show(event.target));
  root.addEventListener('mouseout',event=>{if(!event.relatedTarget?.closest?.('.campus-abbreviation'))hide();});
  root.addEventListener('focusin',event=>show(event.target));
  root.addEventListener('focusout',hide);
  root.addEventListener('click',event=>{if(event.target.closest?.('.campus-abbreviation')&&!event.target.closest('a,button,summary'))show(event.target);});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest?.('.campus-abbreviation'))hide();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  window.addEventListener('scroll',hide,{passive:true,capture:true});
}
