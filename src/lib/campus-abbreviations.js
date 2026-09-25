import {parseFragment,serialize} from 'parse5';
import {campusTerms,fullTerms,termMarkup} from './campus-terms.js';

export function addCampusAbbreviations(html,institutions) {
  const tree=parseFragment(html);const dictionary=campusTerms(institutions);const seen=new Set();
  const skipped=new Set(['script','style','textarea','code','pre','math','svg','abbr','noscript']);
  function walk(node,context={interactive:false,verbatim:false}) {
    if(skipped.has(node.tagName))return;
    const attr=name=>node.attrs?.find(a=>a.name===name)?.value;
    if(attr('aria-hidden')==='true'||attr('data-campus-no-terms')!==undefined||(attr('class')??'').includes('campus-sr-only'))return;
    const next={interactive:context.interactive||['a','button','summary'].includes(node.tagName),verbatim:context.verbatim||attr('data-campus-verbatim')!==undefined};
    if(node.tagName==='option') {
      for(const child of node.childNodes??[])if(child.nodeName==='#text')child.value=fullTerms(child.value,dictionary);
      return;
    }
    for(const child of [...node.childNodes??[]]) {
      if(child.nodeName==='#text'&&child.value.trim()) {
        const fragment=parseFragment(termMarkup(child.value,dictionary,seen,next));
        const index=node.childNodes.indexOf(child);
        fragment.childNodes.forEach(n=>n.parentNode=node);
        node.childNodes.splice(index,1,...fragment.childNodes);
      } else walk(child,next);
    }
  }
  walk(tree);return serialize(tree);
}
