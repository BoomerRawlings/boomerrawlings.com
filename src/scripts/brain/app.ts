import { categories, topics as rawTopics, sources as rawSources } from '../../../public/brain/curriculum.js';
import { journeys, makeRound, cleanProgress } from '../../../public/brain/study.js';
import type { createBrainViewer } from './models';
import type { Narrative, PickSpec } from './scene-types';

type Depth='essentials'|'mechanism'|'advanced';
type Lesson={summary:string;bullets:string[]};
type Topic={id:string;category:string;title:string;subtitle:string;scene:string;modelTarget:string;scale:string;essentials:Lesson;mechanism:Lesson;advanced:Lesson;connections:string[];sources:string[];question:{prompt:string;choices:string[];answer:number;explanation:string}};
const topics=rawTopics as Topic[];
const sources=rawSources as Record<string,{title:string;url:string;organization:string}>;

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const all=<T extends Element=HTMLElement>(selector:string)=>Array.from(document.querySelectorAll<T>(selector));
const byId=new Map(topics.map(topic=>[topic.id,topic]));
const storageKey='brain-study-v1';
let stored:any={};
try{stored=JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{}
let progress=cleanProgress(stored,topics.map(t=>t.id));
let selected=byId.get(progress.lastTopic)||topics[0];
let depth=progress.depth as Depth;
let mode='explore';
let savedOnly=false;
let activeJourney:typeof journeys[number]|null=null;
let viewer:Awaited<ReturnType<typeof createBrainViewer>>=null;
let separated=false;
let labels=true;
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
let expanded=false;
let round:typeof topics=[];
let roundIndex=0;
let roundCorrect=0;
let answered=false;
let roundMissed:string[]=[];
let choiceOrder:number[]=[];
let explorationTrail:string[]=[];
let focusedPart:PickSpec|null=null;
let animation:Narrative|null=null;
const backgroundSelector='.site-header,.intro,#paths-panel,#recall-panel,#active-journey,.library,.reader,.scale-journey,.source-ledger,.site-footer';

function save(){try{localStorage.setItem(storageKey,JSON.stringify(progress));}catch{}}
function announce(message:string){$('announcement').textContent=message;}
function button(text:string,action:()=>void,className=''){const element=document.createElement('button');element.type='button';element.textContent=text;element.className=className;element.addEventListener('click',action);return element;}
function externalLink(text:string,url:string){const element=document.createElement('a');element.textContent=text;element.href=url;element.target='_blank';element.rel='noopener noreferrer';return element;}

function renderProgress(){
  $('study-progress-label').textContent=`Study progress · ${progress.understood.length}/${topics.length}`;
  $<HTMLProgressElement>('study-progress').value=progress.understood.length;
  all<HTMLButtonElement>('[data-topic]').forEach(el=>{el.dataset.complete=String(progress.understood.includes(el.dataset.topic!));const icon=el.querySelector('.topic-indicator');if(icon)icon.textContent=progress.understood.includes(el.dataset.topic!)?'✓':'↗';});
  const understood=progress.understood.includes(selected.id);
  const mark=$<HTMLButtonElement>('mark-understood');mark.setAttribute('aria-pressed',String(understood));mark.replaceChildren();const icon=document.createElement('span');icon.textContent=understood?'✓':'○';mark.append(icon,understood?'Marked understood':'Mark understood');
  const saved=progress.saved.includes(selected.id);
  $('bookmark-topic').textContent=saved?'★':'☆';$('bookmark-topic').setAttribute('aria-pressed',String(saved));$('bookmark-topic').setAttribute('aria-label',saved?'Remove saved topic':'Save this topic');
  $('review-missed').hidden=!progress.missed.length;$('review-missed').textContent=`Review missed (${progress.missed.length})`;
}

function renderDepth(){
  const content=selected[depth];
  const label=document.createElement('p');label.className='depth-label';label.textContent=depth==='essentials'?'01 / Essentials':depth==='mechanism'?'02 / Mechanism':'03 / Advanced';
  const summary=document.createElement('p');summary.textContent=content.summary;
  const list=document.createElement('ul');content.bullets.forEach(text=>{const item=document.createElement('li');item.textContent=text;list.append(item);});
  $('topic-content').replaceChildren(label,summary,list);
  all<HTMLButtonElement>('[data-depth]').forEach(tab=>{const active=tab.dataset.depth===depth;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
  $('topic-content').setAttribute('aria-labelledby',`depth-${depth}`);
  document.querySelector('.reader-scroll')!.scrollTop=0;
  progress.depth=depth;save();
}

function renderJourney(){
  $('active-journey').hidden=!activeJourney;
  const end=Boolean(activeJourney&&activeJourney.ids.indexOf(selected.id)===activeJourney.ids.length-1);
  $('next-topic').setAttribute('aria-label',end?'Finish sequence':'Next topic');$('next-topic').title=end?'Finish sequence':'Next topic';$('next-topic').textContent=end?'✓':'→';
  if(!activeJourney)return;
  const index=activeJourney.ids.indexOf(selected.id);
  $('journey-label').textContent=activeJourney.title;
  $('journey-step').textContent=index>=0?`${index+1} / ${activeJourney.ids.length}`:'Related concept';
  $<HTMLButtonElement>('journey-prev').disabled=index<=0;
  $<HTMLButtonElement>('journey-next').disabled=index===activeJourney.ids.length-1;
}

function setTopic(id:string,updateHash=true,focus=false){
  const next=byId.get(id);if(!next)return;
  const trailIndex=explorationTrail.indexOf(id);
  explorationTrail=trailIndex>=0?explorationTrail.slice(0,trailIndex+1):[...explorationTrail,id].slice(-5);
  $('model-trail').replaceChildren(...explorationTrail.flatMap((topicId,index)=>{
    const crumb=button(byId.get(topicId)!.title,()=>setTopic(topicId));
    if(index===explorationTrail.length-1)crumb.setAttribute('aria-current','page');
    const divider=document.createElement('span');divider.textContent='›';return index?[divider,crumb]:[crumb];
  }));
  selected=next;progress.lastTopic=id;save();
  $<HTMLSelectElement>('mobile-topic').value=id;
  const category=categories.find(c=>c.id===selected.category)!;
  const number=topics.findIndex(t=>t.id===id)+1;
  $('scene-category').textContent=`${String(categories.indexOf(category)+1).padStart(2,'0')} / ${category.title}`;
  $('scene-title').textContent=selected.title;
  $('scale-badge').textContent=selected.scale;
  $('topic-number').textContent=`Topic ${String(number).padStart(3,'0')} / ${topics.length}`;
  $('topic-title').textContent=selected.title;
  $('topic-subtitle').textContent=selected.subtitle;
  $('brain-viewer').setAttribute('aria-label',`Interactive 3D model for ${selected.title}. Drag to orbit; scroll or pinch to zoom. Use the model controls below.`);
  all<HTMLButtonElement>('[data-topic]').forEach(el=>{if(el.dataset.topic===id)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');});
  const group=document.querySelector<HTMLDetailsElement>(`.topic-group[data-category="${selected.category}"]`);if(group)group.open=true;
  $('topic-connections').replaceChildren(...selected.connections.filter(id=>byId.has(id)).map(id=>button(`${byId.get(id)!.title} ↗`,()=>setTopic(id,true,true))));
  $('topic-sources').replaceChildren(...selected.sources.map(id=>{const source=sources[id];const item=document.createElement('li');if(source)item.append(externalLink(`${source.title} ↗`,source.url));return item;}));
  renderDepth();renderProgress();renderJourney();
  $<HTMLSelectElement>('model-view').value='perspective';
  if(viewer){viewer.setTopic(selected);viewer.setDetail(depth==='essentials'?0:depth==='mechanism'?2:3);}
  if(updateHash)history.replaceState(null,'',`#topic=${encodeURIComponent(id)}&depth=${depth}`);
  if(focus){$('topic-title').focus({preventScroll:true});if(innerWidth<=620)document.querySelector('.viewer-column')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
  announce(`${selected.title}. ${depth} explanation.`);
}

function filterTopics(){
  const query=$<HTMLInputElement>('topic-search').value.trim().toLowerCase();let count=0;
  const matches=new Set(topics.filter(t=>(!savedOnly||progress.saved.includes(t.id))&&(!query||[t.title,t.subtitle,t.essentials.summary,...t.essentials.bullets,t.mechanism.summary,...t.mechanism.bullets,t.advanced.summary,...t.advanced.bullets].join(' ').toLowerCase().includes(query))).map(t=>t.id));
  all<HTMLButtonElement>('[data-topic]').forEach(el=>{const show=matches.has(el.dataset.topic!);el.hidden=!show;if(show)count++;});
  all<HTMLDetailsElement>('.topic-group').forEach(group=>{group.hidden=!group.querySelector('[data-topic]:not([hidden])');if((query||savedOnly)&&!group.hidden)group.open=true;});
  $('empty-library').hidden=count>0;
  $('empty-library').textContent=savedOnly?'No saved topics match. Use the star beside a topic to save it.':'No matching concepts. Try “dopamine,” “myelin,” or “memory.”';
  $('library-count').textContent=`${count} ${savedOnly?'saved ':''}topic${count===1?'':'s'}`;
  const mobile=$<HTMLSelectElement>('mobile-topic');mobile.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Choose a topic';mobile.append(placeholder);
  for(const category of categories){const group=document.createElement('optgroup');group.label=category.title;for(const topic of topics.filter(t=>t.category===category.id&&matches.has(t.id))){const option=document.createElement('option');option.value=topic.id;option.textContent=topic.title;group.append(option);}if(group.children.length)mobile.append(group);}
  mobile.value=matches.has(selected.id)?selected.id:'';
}

function setMode(nextMode:string){
  mode=nextMode;
  all<HTMLButtonElement>('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===mode)));
  $('paths-panel').hidden=mode!=='paths';$('recall-panel').hidden=mode!=='recall';
  document.body.classList.toggle('recall-mode',mode==='recall');
  $('active-journey').hidden=mode==='recall'||!activeJourney;
  if(mode!=='recall')requestAnimationFrame(()=>viewer?.resize());
}

all<HTMLButtonElement>('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(el.dataset.mode!)));
all<HTMLButtonElement>('[data-topic]').forEach(el=>el.addEventListener('click',()=>setTopic(el.dataset.topic!,true,true)));
all<HTMLButtonElement>('[data-scale]').forEach(el=>el.addEventListener('click',()=>{setMode('explore');savedOnly=false;$('bookmarks-filter').setAttribute('aria-pressed','false');$<HTMLInputElement>('topic-search').value='';filterTopics();setTopic(topics.find(t=>t.category===el.dataset.scale)!.id,true,true);$('workspace').scrollIntoView({behavior:'smooth',block:'start'});}));
$('topic-search').addEventListener('input',filterTopics);
$('mobile-topic').addEventListener('change',()=>setTopic($<HTMLSelectElement>('mobile-topic').value,true,true));
$('bookmarks-filter').addEventListener('click',()=>{savedOnly=!savedOnly;$('bookmarks-filter').setAttribute('aria-pressed',String(savedOnly));$('bookmarks-filter').textContent=savedOnly?'★':'☆';filterTopics();});
$('bookmark-topic').addEventListener('click',()=>{progress.saved=progress.saved.includes(selected.id)?progress.saved.filter(id=>id!==selected.id):[...progress.saved,selected.id];save();renderProgress();if(savedOnly)filterTopics();announce(progress.saved.includes(selected.id)?'Topic saved.':'Topic removed from saved.');});
$('mark-understood').addEventListener('click',()=>{progress.understood=progress.understood.includes(selected.id)?progress.understood.filter(id=>id!==selected.id):[...progress.understood,selected.id];save();renderProgress();});
all<HTMLButtonElement>('[data-depth]').forEach(tab=>{tab.addEventListener('click',()=>{depth=tab.dataset.depth! as Depth;renderDepth();viewer?.setDetail(depth==='essentials'?0:depth==='mechanism'?2:3);history.replaceState(null,'',`#topic=${selected.id}&depth=${depth}`);});tab.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;event.preventDefault();const tabs=all<HTMLButtonElement>('[data-depth]');const index=tabs.indexOf(tab);const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;tabs[next].focus();tabs[next].click();});});
$('next-topic').addEventListener('click',()=>{if(activeJourney){const index=activeJourney.ids.indexOf(selected.id);if(index<activeJourney.ids.length-1){setTopic(activeJourney.ids[index+1],true,true);return;}activeJourney=null;renderJourney();setMode('paths');$('paths-heading').tabIndex=-1;$('paths-heading').focus();announce('Sequence complete. Select another sequence or practice questions.');return;}const index=topics.indexOf(selected);setTopic(topics[(index+1)%topics.length].id,true,true);});

$('journey-cards').replaceChildren(...journeys.map((journey,index)=>{const card=button('',()=>{activeJourney=journey;setMode('explore');setTopic(journey.ids[0],true,true);$('active-journey').scrollIntoView({behavior:'smooth',block:'start'});},'journey-card');const number=document.createElement('span');number.className='path-index';number.textContent=`SEQUENCE ${String(index+1).padStart(2,'0')}`;const title=document.createElement('h3');title.textContent=journey.title;const desc=document.createElement('p');desc.textContent=journey.description;const trail=document.createElement('span');trail.textContent=`${journey.ids.length} topics →`;card.append(number,title,desc,trail);return card;}));
$('journey-prev').addEventListener('click',()=>{if(activeJourney){const index=activeJourney.ids.indexOf(selected.id);if(index>0)setTopic(activeJourney.ids[index-1],true,true);}});
$('journey-next').addEventListener('click',()=>{if(activeJourney){const index=activeJourney.ids.indexOf(selected.id);if(index<activeJourney.ids.length-1)setTopic(activeJourney.ids[index+1],true,true);}});
$('journey-exit').addEventListener('click',()=>{activeJourney=null;renderJourney();});

function startRound(pool=topics){
  if(!pool.length){announce('No questions in this selection.');return;}
  round=makeRound(pool);roundIndex=0;roundCorrect=0;roundMissed=[];answered=false;
  $('recall-start').hidden=true;$('recall-result').hidden=true;$('recall-quiz').hidden=false;
  $<HTMLProgressElement>('recall-progress').max=round.length;
  renderQuestion();
}
function renderQuestion(){
  const topic=round[roundIndex];answered=false;
  $('recall-counter').textContent=`QUESTION ${String(roundIndex+1).padStart(2,'0')} / ${round.length}`;
  $('recall-score').textContent=`${roundCorrect} correct`;
  $<HTMLProgressElement>('recall-progress').value=roundIndex;
  $('recall-question').textContent=topic.question.prompt;
  $('recall-feedback').hidden=true;$('recall-next').hidden=true;$('recall-explore').hidden=true;
  choiceOrder=makeRound(topic.question.choices.map((_,i)=>i),topic.question.choices.length);
  $('recall-answers').replaceChildren(...choiceOrder.map((choiceIndex,index)=>{const answer=button('',()=>answerQuestion(choiceIndex));const key=document.createElement('b');key.textContent=String(index+1);const text=document.createElement('span');text.textContent=topic.question.choices[choiceIndex];answer.append(key,text);return answer;}));
  $('recall-question').focus({preventScroll:true});
}
function answerQuestion(index:number){
  if(answered||!round.length||!Number.isInteger(index)||index<0||index>=round[roundIndex].question.choices.length)return;answered=true;
  const topic=round[roundIndex],correct=index===topic.question.answer;
  if(correct){roundCorrect++;progress.missed=progress.missed.filter(id=>id!==topic.id);}else{roundMissed.push(topic.id);if(!progress.missed.includes(topic.id))progress.missed.push(topic.id);}
  save();renderProgress();
  all<HTMLButtonElement>('#recall-answers button').forEach((el,i)=>{el.disabled=true;if(choiceOrder[i]===topic.question.answer)el.classList.add('correct');if(choiceOrder[i]===index&&!correct)el.classList.add('incorrect');});
  const verdict=document.createElement('strong');verdict.textContent=correct?'Correct.':'Incorrect.';
  const explanation=document.createElement('p');explanation.textContent=topic.question.explanation;
  $('recall-feedback').replaceChildren(verdict,explanation);$('recall-feedback').hidden=false;
  $('recall-score').textContent=`${roundCorrect} correct`;
  $<HTMLProgressElement>('recall-progress').value=roundIndex+1;
  $('recall-next').hidden=false;$('recall-next').textContent=roundIndex===round.length-1?'See your results →':'Next question →';
  $('recall-explore').hidden=false;
}
function finishRound(){
  $('recall-quiz').hidden=true;$('recall-result').hidden=false;
  const title=document.createElement('h3');title.textContent=`${roundCorrect} / ${round.length} correct`;
  const message=document.createElement('p');message.textContent=roundMissed.length?`${roundMissed.length} incorrect answer${roundMissed.length===1?'':'s'}. Review the explanations or retry these questions.`:'All answers correct. Select another subject or start a new round.';
  const again=button('New round ↗',()=>startRound(scopedTopics()),'primary');
  $('recall-result').replaceChildren(title,message,again);
  if(roundMissed.length)$('recall-result').append(button('Retry this round’s misses',()=>startRound(roundMissed.map(id=>byId.get(id)!)),'subtle'));
  title.tabIndex=-1;title.focus({preventScroll:true});announce(title.textContent||'Round complete.');
}
function scopedTopics(){const scope=$<HTMLSelectElement>('recall-scope').value;return topics.filter(t=>scope==='all'||t.category===scope);}
$('start-recall').addEventListener('click',()=>startRound(scopedTopics()));
$('review-missed').addEventListener('click',()=>startRound(progress.missed.map(id=>byId.get(id)!)));
$('recall-next').addEventListener('click',()=>{if(!answered)return;if(roundIndex<round.length-1){roundIndex++;renderQuestion();}else finishRound();});
$('recall-explore').addEventListener('click',()=>{setMode('explore');setTopic(round[roundIndex].id,true,true);});
$('recall-scope').addEventListener('change',()=>{round=[];$('recall-quiz').hidden=true;$('recall-result').hidden=true;$('recall-start').hidden=false;});

$('model-reset').addEventListener('click',()=>{viewer?.reset();separated=false;viewer?.setExploded(false);$('model-explode').setAttribute('aria-pressed','false');$<HTMLSelectElement>('model-view').value='perspective';});
$('model-view').addEventListener('change',()=>{const view=$<HTMLSelectElement>('model-view').value;if(view==='perspective')$('model-reset').click();else viewer?.setView(view as 'lateral'|'superior'|'anterior');});
$('model-explode').addEventListener('click',()=>{separated=!separated;viewer?.setExploded(separated);$('model-explode').setAttribute('aria-pressed',String(separated));});
$('model-labels').addEventListener('click',()=>{labels=!labels;viewer?.setLabels(labels);$('model-labels').setAttribute('aria-pressed',String(labels));});
$('model-motion').setAttribute('aria-pressed',String(playing));
$('model-motion').addEventListener('click',()=>{playing=!playing;viewer?.setPlaying(playing);$('model-motion').setAttribute('aria-pressed',String(playing));});
$('model-zoom-in').addEventListener('click',()=>viewer?.zoom(1));
$('model-zoom-out').addEventListener('click',()=>viewer?.zoom(-1));
$('model-part').addEventListener('change',()=>viewer?.focusPart($<HTMLSelectElement>('model-part').value));
$('model-enter').addEventListener('click',()=>viewer?.enter());
$('model-unfocus').addEventListener('click',()=>viewer?.back());
$('animation-scrub').addEventListener('input',()=>{playing=false;viewer?.setPlaying(false);$('model-motion').setAttribute('aria-pressed','false');viewer?.seek(Number($<HTMLInputElement>('animation-scrub').value)/1000);});
function showPart(part:PickSpec|null){
  const shown=part||focusedPart;$('model-selection').hidden=!shown;
  $('selection-name').textContent=shown?.label||'';
  $('selection-description').textContent=shown?.description||(shown?'Click to focus this structure.':'');
}
function setNarrative(value:Narrative|null){
  animation=value;$('model-timeline').hidden=!value;$('animation-steps').replaceChildren();if(!value)return;
  $('animation-steps').replaceChildren(...value.steps.map((step,index)=>{
    const control=button(`${String(index+1).padStart(2,'0')} ${step.label}`,()=>{playing=false;viewer?.setPlaying(false);$('model-motion').setAttribute('aria-pressed','false');viewer?.seek(step.at/value.duration);});
    control.title=step.description;return control;
  }));
}
function setExpanded(value:boolean){expanded=value;const panel=document.querySelector<HTMLElement>('.viewer-column')!;panel.classList.toggle('is-expanded',expanded);if(expanded){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Expanded neuroscience model');}else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-label');}all<HTMLElement>(backgroundSelector).forEach(el=>el.inert=expanded);$('model-fullscreen').setAttribute('aria-label',expanded?'Close expanded model':'Expand model');document.body.style.overflow=expanded?'hidden':'';requestAnimationFrame(()=>viewer?.resize());$('model-fullscreen').focus();}
$('model-fullscreen').addEventListener('click',()=>setExpanded(!expanded));
document.addEventListener('keydown',event=>{const editable=(event.target as HTMLElement).matches('input,textarea,select,[contenteditable]');if(event.key==='Escape'){if(expanded)setExpanded(false);else if(editable){$<HTMLInputElement>('topic-search').value='';filterTopics();}}if(expanded){if(event.key==='Tab'){const controls=all<HTMLElement>('.viewer-column button:not(:disabled):not([hidden]),.viewer-column select:not(:disabled),.viewer-column input:not(:disabled),.viewer-column canvas').filter(el=>el.getClientRects().length>0);if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}}return;}if(editable)return;if(event.key==='/'){event.preventDefault();setMode('explore');$('topic-search').focus();}if(mode==='recall'&&!$('recall-quiz').hidden){const digit=Number(event.key);if(digit>=1&&digit<=4&&!answered)answerQuestion(choiceOrder[digit-1]);if(event.key==='Enter'&&answered&&(event.target as HTMLElement).tagName!=='BUTTON')$('recall-next').click();}});

function readLocation(){const params=new URLSearchParams(location.hash.slice(1));const topic=params.get('topic');const nextDepth=params.get('depth');if(nextDepth&&['essentials','mechanism','advanced'].includes(nextDepth))depth=nextDepth as Depth;if(topic&&byId.has(topic))setTopic(topic,false);else setTopic(selected.id,false);}
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#topic='))readLocation();});
readLocation();

async function initializeViewer(){
  try{
    const {createBrainViewer}=await import('./models');
    viewer=await createBrainViewer($('brain-viewer'),{
      onSelect:id=>{if(byId.has(id))setTopic(id,true);},
      onStatus:text=>{$('model-provenance').textContent=text;$('viewer-loading').hidden=!/^Loading/.test(text);$('model-kind').textContent=/^Model could not load|3D unavailable/i.test(text)?'Model unavailable':/^Loading/.test(text)?'Assembling model':selected.scene==='channel'?'Gating schematic + protein structure':selected.scene==='molecule'?(selected.id==='neuropeptides'?'Peptide connectivity schematic':'Computed molecular conformer'):selected.scene==='tracts'?'Population tractography':selected.scene==='brain'?'Measured anatomy + study layers':selected.id==='dendrites'?'Measured arbor + study overlays':'Custom mechanism model';},
      onHover:showPart,
      onFocus:part=>{focusedPart=part;showPart(part);const child=part?.childTopic||part?.topicId;$('model-enter').hidden=!child||child===selected.id||!byId.has(child);$('model-enter').textContent=child&&byId.has(child)?`${byId.get(child)!.title} ↗`:'Open related topic ↗';$('model-unfocus').hidden=!part;},
      onDetail:level=>{$('detail-name').textContent=['Overview','Structures','Mechanism','Fine detail'][level];$('detail-dots').textContent=Array.from({length:4},(_,i)=>i<=level?'●':'○').join(' ');},
      onParts:parts=>{const select=$<HTMLSelectElement>('model-part'),value=select.value;select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=parts.length?'Choose a structure…':'Zoom to reveal structures';select.append(empty);for(const part of parts){const option=document.createElement('option');option.value=part.id;option.textContent=part.label;select.append(option);}if(parts.some(part=>part.id===value))select.value=value;},
      onNarrative:setNarrative,
      onTime:(fraction,step)=>{if(!animation)return;$<HTMLInputElement>('animation-scrub').value=String(Math.round(fraction*1000));const currentStep=animation.steps[step];$('animation-step').textContent=currentStep?.label||'';$('animation-description').textContent=currentStep?.description||'';$('animation-time').textContent=`${Math.round(fraction*100)}%`;all('#animation-steps button').forEach((el,i)=>el.setAttribute('aria-current',String(i===step)));}
    });
    if(!viewer)throw new Error('3D unavailable');
    viewer.setPlaying(playing);viewer.setLabels(labels);viewer.setTopic(selected);viewer.setDetail(depth==='essentials'?0:depth==='mechanism'?2:3);
  }catch{ $('model-fallback').hidden=false;$('model-provenance').textContent='Written guide available. 3D rendering could not initialize.';all<HTMLButtonElement|HTMLSelectElement>('.viewer-controls button,.viewer-controls select').forEach(el=>el.disabled=true); }
  finally{if(!viewer)$('viewer-loading').hidden=true;}
}
initializeViewer();
window.addEventListener('pagehide',event=>{if(!event.persisted)viewer?.dispose();});
