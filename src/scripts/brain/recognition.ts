import { recognition } from '../../../public/brain/recognition.js';
import { chemistry } from '../../../public/brain/chemistry.js';

type Recognition={title:string;view:string;landmarks:string[];caveat?:string;sources:string[];reading?:string[]};
export const recognitionById=recognition as Record<string,Recognition>;
export const chemistryById=chemistry as Record<string,{name:string;image:string;formula:string;sourcePage:string;representation:string}>;
const elements=[['C','Carbon','#50555b'],['H','Hydrogen','#f4f4f4'],['N','Nitrogen','#3058df'],['O','Oxygen','#e63832'],['S','Sulfur','#f2cb31']];

export function elementKey(includeSulfur=false){
  const key=document.createElement('div');key.className='element-key';key.setAttribute('aria-label','Atom color key');
  for(const[symbol,name,color]of elements){if(symbol==='S'&&!includeSulfur)continue;const item=document.createElement('span');const dot=document.createElement('i');dot.style.backgroundColor=color;dot.setAttribute('aria-hidden','true');item.append(dot,`${symbol} ${name}`);key.append(item);}
  return key;
}

export function renderRecognition(id:string){
  const host=document.getElementById('visual-recognition')!,data=recognitionById[id],molecule=chemistryById[id];
  host.replaceChildren();host.hidden=!data;if(!data)return;
  if(molecule){
    const figure=document.createElement('figure');figure.className='chemical-reference';
    const link=document.createElement('a');link.href=molecule.image;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label',`Open ${molecule.name} structural formula`);
    const image=document.createElement('img');image.src=molecule.image;image.alt=`${molecule.name}: skeletal formula with heteroatoms, bond orders and stereochemistry`;image.width=640;image.height=300;link.append(image);
    const caption=document.createElement('figcaption');const label=document.createElement('span');label.textContent='Structural formula';const formula=document.createElement('span');formula.textContent=molecule.formula;caption.append(label,formula);figure.append(link,caption);host.append(figure,elementKey(id==='neuropeptides'));
  }
  const details=document.createElement('details');details.className='recognition-landmarks';details.open=Boolean(molecule);
  const summary=document.createElement('summary');summary.textContent='Visual landmarks';
  const view=document.createElement('p');view.className='recognition-view';view.textContent=data.view;
  const list=document.createElement('ul');for(const landmark of data.landmarks){const li=document.createElement('li');li.textContent=landmark;list.append(li);}
  details.append(summary,view,list);
  if(data.caveat){const caveat=document.createElement('p');caveat.className='recognition-note';caveat.textContent=data.caveat;details.append(caveat);}
  if(data.reading){const reading=document.createElement('div');reading.className='recognition-reading';const label=document.createElement('strong');label.textContent='In your textbooks';reading.append(label);for(const citation of data.reading){const p=document.createElement('p');p.textContent=citation;reading.append(p);}details.append(reading);}
  const references=document.createElement('div');references.className='recognition-sources';data.sources.forEach((url,index)=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`Reference${data.sources.length>1?' '+(index+1):''} ↗`;references.append(a);});details.append(references);host.append(details);
}
