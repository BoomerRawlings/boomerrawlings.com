import { topics as rawTopics, sources as rawSources } from '../../../../public/brain/curriculum.js';
import type { BrainViewer } from '../models';
import type { BrainTopic, Narrative, PickSpec, RepresentationSpec } from '../scene-types';
import type { LectureSlide } from './types';

type Deck={title:string;subtitle:string;slides:LectureSlide[];startIndex?:number;preview?:boolean};
type Position={index:number;revealed:number};
const topics=new Map((rawTopics as BrainTopic[]).map(topic=>[topic.id,topic]));
const sources=rawSources as Record<string,{title:string;url:string;organization:string}>;

/** Navigation counts actual bullet reveals, never guessed lecture timings. */
export function lectureStep(slides:Pick<LectureSlide,'bullets'>[],position:Position,direction:1|-1):Position|'end'{
  const {index,revealed}=position,slide=slides[index];if(!slide)return'end';
  if(direction===1){if(revealed<slide.bullets.length)return{index,revealed:revealed+1};return index<slides.length-1?{index:index+1,revealed:0}:'end';}
  if(revealed>0)return{index,revealed:revealed-1};
  return index>0?{index:index-1,revealed:slides[index-1].bullets.length}:{index:0,revealed:0};
}

export function createLecturePresenter(host:HTMLElement,{onExit}:{onExit:()=>void}){
  const dialog=document.createElement('dialog');dialog.className='lecture-presenter';
  dialog.setAttribute('aria-label','Lecture presentation');
  dialog.innerHTML=`
    <header class="lp-header">
      <div class="lp-deck-meta"><span class="lp-eyebrow" data-el="provenance"></span><strong data-el="deck-title"></strong><span data-el="deck-subtitle"></span></div>
      <div class="lp-header-tools"><button type="button" data-action="overview" aria-expanded="false">Slides</button><button type="button" data-action="laser" aria-pressed="true" title="Green pointer · L">Pointer</button><button type="button" data-action="fullscreen">Fullscreen</button><button type="button" data-action="exit" aria-label="Exit presentation">Exit <span aria-hidden="true">↗</span></button></div>
    </header>
    <main class="lp-main" data-el="main" tabindex="-1">
      <section class="lp-content" data-el="content"><p class="lp-eyebrow" data-el="kicker"></p><h2 data-el="title"></h2><p class="lp-takeaway" data-el="takeaway"></p><ol class="lp-bullets" data-el="bullets"></ol><p class="lp-reveal-hint" data-el="reveal-hint"></p></section>
      <section class="lp-visual" aria-label="Interactive slide visual">
        <div class="lp-visual-heading"><span data-el="visual-title"></span><button type="button" data-action="source" aria-pressed="false" hidden>Source slide</button></div>
        <div class="lp-model-views" data-el="representations" role="group" aria-label="Model representation"></div>
        <div class="lp-model" data-el="model"></div>
        <div class="lp-figure" data-el="figure" hidden><div class="lp-figure-scroll" data-el="figure-scroll" tabindex="0" aria-label="Figure. Use zoom controls, then drag or scroll to pan."><div class="lp-figure-board" data-el="figure-board"><img data-el="figure-image" draggable="false" alt=""><div data-el="hotspots"></div></div></div><div class="lp-figure-tools"><button type="button" data-action="figure-out" aria-label="Zoom figure out">−</button><output data-el="figure-zoom">100%</output><button type="button" data-action="figure-in" aria-label="Zoom figure in">+</button><button type="button" data-action="figure-reset">Fit figure</button></div><p class="lp-figure-caption" data-el="figure-caption"></p><p class="lp-figure-explanation" data-el="figure-explanation" aria-live="polite" hidden></p></div>
        <div class="lp-comparison" data-el="comparison" hidden><h3 data-el="comparison-prompt"></h3><div class="lp-comparison-choices" data-el="comparison-choices"></div><div class="lp-comparison-answer" data-el="comparison-answer" aria-live="polite" hidden></div></div>
        <div class="lp-lab" data-el="lab" hidden></div>
        <div class="lp-model-tools" data-el="model-tools"><div class="lp-model-buttons"><button type="button" data-action="zoom-out" aria-label="Zoom model out">−</button><button type="button" data-action="zoom-in" aria-label="Zoom model in">+</button><button type="button" data-action="reset">Reset view</button><button type="button" data-action="separate" aria-pressed="false">Separate</button><button type="button" data-action="labels" aria-pressed="true">Labels</button><button type="button" data-action="play" hidden>Play</button><button type="button" data-action="replay" hidden>Replay</button></div><span class="lp-model-hint">Drag to orbit · scroll to zoom · click to focus</span><p class="lp-separation-note" data-el="separation-note" hidden>Illustrative separation · Reassemble restores the model’s original positions.</p></div>
        <div class="lp-timeline" data-el="timeline" hidden><label><span>Animation</span><input type="range" min="0" max="1000" value="0" step="1" data-el="scrub" aria-label="Animation position"></label><strong data-el="phase-title"></strong><p data-el="phase-description"></p></div>
        <div class="lp-selection" data-el="selection" hidden><strong data-el="selection-title"></strong><p data-el="selection-description"></p><button type="button" data-action="clear-selection">Whole model</button></div>
        <p class="lp-model-status" data-el="model-status" role="status"></p>
        <p class="lp-source-page" data-el="source-page"></p>
      </section>
    </main>
    <section class="lp-overview" data-el="overview" hidden aria-label="Slide overview"><div><h2>Choose a slide</h2><button type="button" data-action="overview-close">Return to presentation</button></div><ol data-el="overview-list"></ol></section>
    <footer class="lp-footer"><div class="lp-navigation"><button type="button" data-action="previous" aria-label="Previous point or slide">← Back</button><span class="lp-position" data-el="position" aria-live="polite" aria-atomic="true"></span><button type="button" data-action="next">Next →</button></div><div class="lp-footer-tools"><details class="lp-disclosure" data-el="notes"><summary>Presenter notes</summary><div data-el="notes-body"></div></details><details class="lp-disclosure" data-el="references"><summary>References</summary><div data-el="references-body"></div></details></div><progress data-el="progress" max="1" value="0" aria-label="Slide progress"></progress></footer>
    <span class="lp-laser" data-el="laser" aria-hidden="true" hidden></span>`;
  host.append(dialog);
  const el=<T extends HTMLElement=HTMLElement>(key:string)=>dialog.querySelector<T>(`[data-el="${key}"]`)!;
  const control=(key:string)=>dialog.querySelector<HTMLButtonElement>(`[data-action="${key}"]`)!;
  const modelHost=el('model'),figureScroll=el('figure-scroll'),figureBoard=el('figure-board'),figureImage=el<HTMLImageElement>('figure-image');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),finePointer=matchMedia('(pointer: fine)');
  let deck:Deck={title:'',subtitle:'',slides:[]},position:Position={index:0,revealed:0},opened=false,destroyed=false;
  let opener:HTMLElement|null=null,session=0,slideToken=0,viewer:BrainViewer|null=null,viewerPromise:Promise<BrainViewer|null>|null=null;
  let narrative:Narrative|null=null,playing=!reduced.matches,labels=true,separated=false,laserEnabled=finePointer.matches,overview=false,showSource=false;
  let pendingRepresentation:string|undefined,focusedPart:PickSpec|null=null,figureZoom=1,figureVersion=0;
  let cleanupLab:(()=>void)|null=null,labGeneration=0,labKey='';
  let drag:{pointer:number;x:number;y:number;left:number;top:number}|null=null;
  const abort=new AbortController(),listener={signal:abort.signal};
  const current=()=>deck.slides[position.index];
  const showingModel=()=>opened&&!overview&&!showSource&&current()?.visual.kind==='model';
  function hideLaser(){el('laser').hidden=true;}
  function separate(value:boolean){separated=value;viewer?.setExploded(value);control('separate').textContent=value?'Reassemble':'Separate';control('separate').setAttribute('aria-pressed',String(value));el('separation-note').hidden=!value;}
  function applyPlaying(){viewer?.setPlaying(showingModel()&&!document.hidden&&Boolean(narrative)&&playing);control('play').textContent=playing?'Pause':'Play';control('play').setAttribute('aria-pressed',String(playing));}
  function showSelection(part:PickSpec|null){
    el('selection').hidden=!part;if(!part)return;
    el('selection-title').textContent=part.label;el('selection-description').textContent=part.description||part.kind||'';
  }
  function showPhase(index:number){const step=narrative?.steps[index];el('phase-title').textContent=step?.label||'';el('phase-description').textContent=step?.description||'';}
  function showNarrative(value:Narrative|null){
    narrative=value;el('timeline').hidden=!value||!showingModel();control('play').hidden=!value;control('replay').hidden=!value;
    el<HTMLInputElement>('scrub').value='0';showPhase(0);applyPlaying();
  }
  function renderViews(views:RepresentationSpec[],active:string){
    const parent=el('representations'),existing=new Map(Array.from(parent.querySelectorAll<HTMLButtonElement>('button')).map(button=>[button.dataset.view,button]));
    for(const view of views){let button=existing.get(view.id);if(!button){button=document.createElement('button');button.type='button';button.dataset.view=view.id;button.addEventListener('click',()=>{pendingRepresentation=undefined;viewer?.setRepresentation(view.id);});parent.append(button);}button.textContent=view.label;button.title=view.description;button.setAttribute('aria-pressed',String(active===view.id));existing.delete(view.id);}
    existing.forEach(button=>button.remove());parent.hidden=!showingModel()||views.length<2;
    if(pendingRepresentation&&views.some(view=>view.id===pendingRepresentation)){
      const requested=pendingRepresentation;pendingRepresentation=undefined;
      if(active!==requested){const token=slideToken;queueMicrotask(()=>{if(opened&&token===slideToken)viewer?.setRepresentation(requested);});}
    }
  }
  async function ensureViewer():Promise<BrainViewer|null>{
    if(viewer)return viewer;if(viewerPromise)return viewerPromise;
    const token=session;
    const promise=(async()=>{
      const {createBrainViewer}=await import('../models');
      if(!opened||destroyed||token!==session)return null;
      const result=await createBrainViewer(modelHost,{compass:true,autoRotate:false,
        onStatus(text){if(opened&&token===session)el('model-status').textContent=text;},
        onHover(part){if(opened&&token===session&&!focusedPart)showSelection(part);},
        onFocus(part){if(opened&&token===session){focusedPart=part;showSelection(part);}},
        onNarrative(value){if(opened&&token===session)showNarrative(value);},
        onRepresentations(views,active){if(opened&&token===session)renderViews(views,active);},
        onTime(fraction,step){if(!opened||token!==session)return;if(document.activeElement!==el('scrub'))el<HTMLInputElement>('scrub').value=String(Math.round(fraction*1000));showPhase(step);},
      });
      if(!opened||destroyed||token!==session){result?.dispose();return null;}
      viewer=result;return result;
    })();
    viewerPromise=promise;
    try{return await promise;}catch{if(opened&&token===session)el('model-status').textContent='The 3D model could not load. Slide text and source figures remain available.';return null;}
    finally{if(viewerPromise===promise)viewerPromise=null;}
  }
  async function loadModel(slide:LectureSlide,token:number){
    if(slide.visual.kind!=='model')return;const topic=topics.get(slide.visual.topicId);
    if(!topic){modelHost.hidden=true;el('model-tools').hidden=true;el('model-status').textContent='This slide’s model is unavailable. Use its source slide or notes.';return;}
    const ready=await ensureViewer();if(!ready||!opened||token!==slideToken)return;
    pendingRepresentation=slide.visual.representation;ready.setPlaying(false);ready.setLabels(labels);ready.setTopic(topic);ready.resize();
    const canvas=modelHost.querySelector('canvas');canvas?.setAttribute('aria-label',`${topic.title}. Interactive 3D model. Drag or use arrow keys to orbit, plus and minus to zoom, click to focus. Escape resets the model.`);
  }
  function fitFigure(reset=false){
    if(el('figure').hidden||!figureImage.naturalWidth)return;
    if(reset)figureZoom=1;
    const fit=Math.min(figureScroll.clientWidth/figureImage.naturalWidth,figureScroll.clientHeight/figureImage.naturalHeight);
    figureBoard.style.width=`${Math.max(1,figureImage.naturalWidth*fit*figureZoom)}px`;
    figureBoard.style.height=`${Math.max(1,figureImage.naturalHeight*fit*figureZoom)}px`;
    el('figure-zoom').textContent=`${Math.round(figureZoom*100)}%`;
    control('figure-out').disabled=figureZoom<=1;control('figure-in').disabled=figureZoom>=4;
    if(reset){figureScroll.scrollLeft=0;figureScroll.scrollTop=0;}
  }
  function changeFigureZoom(factor:number){
    const x=(figureScroll.scrollLeft+figureScroll.clientWidth/2)/Math.max(figureBoard.clientWidth,1),y=(figureScroll.scrollTop+figureScroll.clientHeight/2)/Math.max(figureBoard.clientHeight,1);
    figureZoom=Math.max(1,Math.min(4,figureZoom*factor));fitFigure();figureScroll.scrollLeft=x*figureBoard.clientWidth-figureScroll.clientWidth/2;figureScroll.scrollTop=y*figureBoard.clientHeight-figureScroll.clientHeight/2;
  }
  function renderFigure(slide:LectureSlide){
    const data=showSource?slide.reference:slide.visual.kind==='figure'?slide.visual:null;if(!data)return;
    const version=++figureVersion;figureZoom=1;el('hotspots').replaceChildren();el('figure-explanation').hidden=true;
    el('figure-caption').textContent=showSource?'Original source slide · zoom or drag to inspect.':slide.visual.kind==='figure'?slide.visual.caption||'Zoom or drag to inspect the figure.':'';
    figureImage.alt=data.alt;
    figureImage.onload=()=>{if(version===figureVersion&&opened)fitFigure(true);};
    figureImage.onerror=()=>{if(version===figureVersion&&opened)el('figure-caption').textContent='The figure could not be displayed. Slide text and references remain available.';};
    figureImage.src=data.image;
    if(!showSource&&slide.visual.kind==='figure')for(const [index,hotspot]of(slide.visual.hotspots||[]).entries()){
      if(!Number.isFinite(hotspot.x)||!Number.isFinite(hotspot.y))continue;
      const button=document.createElement('button');button.type='button';button.className='lp-hotspot';button.style.left=`${Math.max(0,Math.min(1,hotspot.x))*100}%`;button.style.top=`${Math.max(0,Math.min(1,hotspot.y))*100}%`;button.textContent=String(index+1);button.setAttribute('aria-label',hotspot.label);button.setAttribute('aria-expanded','false');button.title=hotspot.label;
      button.addEventListener('click',()=>{el('hotspots').querySelectorAll('button').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));const explanation=el('figure-explanation');explanation.textContent=`${hotspot.label} — ${hotspot.explanation}`;explanation.hidden=false;});el('hotspots').append(button);
    }
    fitFigure(true);
  }
  function stopLab(){labGeneration++;cleanupLab?.();cleanupLab=null;labKey='';el('lab').replaceChildren();}
  function syncLab(){
    // Labs redraw only on input (no animation clock). Keep their chosen values
    // while comparing the source slide; dispose when the slide itself changes.
    const slide=current();if(!opened||slide?.visual.kind!=='lab'){if(labKey)stopLab();return;}
    const key=`${session}:${slideToken}`;if(key===labKey)return;stopLab();labKey=key;
    const token=labGeneration,lab=slide.visual.lab;
    void import('./labs').then(({mountLectureLab})=>{if(opened&&token===labGeneration)cleanupLab=mountLectureLab(el('lab'),lab);}).catch(()=>{if(opened&&token===labGeneration)el('lab').textContent='This interactive explanation could not load. Use the source slide and notes.';});
  }
  function updateVisualMode(){
    const slide=current();if(!slide)return;
    const model=showingModel(),figure=showSource||slide.visual.kind==='figure';
    modelHost.hidden=!model;el('model-tools').hidden=!model;el('representations').hidden=!model||el('representations').childElementCount<2;el('timeline').hidden=!model||!narrative;el('selection').hidden=!model||!focusedPart;el('model-status').hidden=!model;
    el('figure').hidden=!figure;el('comparison').hidden=showSource||slide.visual.kind!=='comparison';el('lab').hidden=showSource||slide.visual.kind!=='lab';
    el('visual-title').textContent=showSource?'Source slide':slide.visual.kind==='model'?'Explore the model':slide.visual.kind==='figure'?'Inspect the figure':slide.visual.kind==='lab'?'Explore the mechanism':'Compare the explanations';
    control('source').hidden=!slide.reference;control('source').textContent=showSource?'Interactive view':'Source slide';control('source').setAttribute('aria-pressed',String(showSource));
    if(figure)renderFigure(slide);if(model)viewer?.resize();applyPlaying();syncLab();
  }
  function updatePosition(){
    const slide=current();if(!slide)return;const count=slide.bullets.length;
    el('bullets').querySelectorAll<HTMLElement>('li').forEach((item,index)=>{item.hidden=index>=position.revealed;});
    el('reveal-hint').textContent=position.revealed<count?`${count-position.revealed} point${count-position.revealed===1?'':'s'} to reveal · Next or →`:'';
    el('position').textContent=`${position.index+1} / ${deck.slides.length}${count?` · ${position.revealed} of ${count} points`:''}`;
    const next=position.revealed<count?'Reveal next point':position.index<deck.slides.length-1?'Next slide':'Finish';control('next').textContent=`${next} ${next==='Finish'?'✓':'→'}`;
    control('previous').disabled=position.index===0&&position.revealed===0;
    const progress=el<HTMLProgressElement>('progress');progress.max=deck.slides.length;progress.value=position.index+1;progress.setAttribute('aria-valuetext',`Slide ${position.index+1} of ${deck.slides.length}`);
  }
  function renderSlide(){
    const slide=current(),token=++slideToken;viewer?.setPlaying(false);separate(false);stopLab();focusedPart=null;showSelection(null);showSource=false;showNarrative(null);el('representations').replaceChildren();hideLaser();
    el<HTMLDetailsElement>('notes').open=false;el<HTMLDetailsElement>('references').open=false;
    if(!slide){el('title').textContent='Slides are not available yet';el('takeaway').textContent='Return to the lecture map for its reading and resources.';el('bullets').replaceChildren();el('kicker').textContent='Lecture resources';el('reveal-hint').textContent='';el('position').textContent='No slides';dialog.dataset.empty='true';control('next').textContent='Return to lectures';control('previous').disabled=true;return;}
    dialog.dataset.empty='false';el('kicker').textContent=slide.kicker||`Slide ${position.index+1}`;el('title').textContent=slide.title;el('takeaway').textContent=slide.takeaway;
    el('bullets').replaceChildren(...slide.bullets.map(text=>{const item=document.createElement('li');item.textContent=text;return item;}));
    el('notes-body').textContent=slide.notes||'No presenter notes for this slide.';
    el('source-page').textContent=slide.source?`${slide.source.title} · page ${slide.source.page}`:'';
    const refs=el('references-body');refs.replaceChildren();
    for(const id of [...new Set(slide.sourceIds)]){const source=sources[id];if(!source)continue;const link=document.createElement('a');link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`${source.title} · ${source.organization}`;refs.append(link);}
    if(!refs.childElementCount)refs.textContent=slide.source?'Source lecture slide identified above.':'No additional references attached to this slide.';
    if(slide.visual.kind==='comparison'){
      el('comparison-prompt').textContent=slide.visual.prompt;el('comparison-answer').hidden=true;
      el('comparison-choices').replaceChildren(...slide.visual.choices.map((choice,index)=>{const button=document.createElement('button');button.type='button';button.textContent=choice.label;button.dataset.choice=String(index);button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{el('comparison-choices').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));const answer=el('comparison-answer');answer.textContent=choice.explanation;answer.hidden=false;});return button;}));
    }
    el('model-status').textContent='Loading model…';updatePosition();updateVisualMode();if(slide.visual.kind==='model')void loadModel(slide,token);
    el('main').scrollTop=0;el('content')?.scrollTo?.(0,0);
  }
  function move(direction:1|-1){if(!opened)return;const next=lectureStep(deck.slides,position,direction);if(next==='end'){close();return;}const changed=next.index!==position.index;position=next;if(changed)renderSlide();else updatePosition();}
  function jump(index:number){if(!deck.slides.length)return;position={index:Math.max(0,Math.min(deck.slides.length-1,index)),revealed:0};setOverview(false);renderSlide();el('main').focus({preventScroll:true});}
  function setOverview(value:boolean){overview=value;el('overview').hidden=!value;el('main').hidden=value;control('overview').setAttribute('aria-expanded',String(value));hideLaser();applyPlaying();syncLab();if(value){el('overview-list').querySelector<HTMLButtonElement>(`[data-index="${position.index}"]`)?.focus();}else if(opened){el('main').focus({preventScroll:true});viewer?.resize();}}
  function renderOverview(){el('overview-list').replaceChildren(...deck.slides.map((slide,index)=>{const item=document.createElement('li'),button=document.createElement('button'),number=document.createElement('span'),title=document.createElement('strong');button.type='button';button.dataset.index=String(index);number.textContent=String(index+1).padStart(2,'0');title.textContent=slide.title;button.append(number,title);button.addEventListener('click',()=>jump(index));item.append(button);return item;}));}
  function setLaser(value:boolean){laserEnabled=value;control('laser').setAttribute('aria-pressed',String(value));if(!value)hideLaser();}
  async function fullscreen(){
    const token=session;
    try{if(document.fullscreenElement===dialog)await document.exitFullscreen();else{await dialog.requestFullscreen();if((!opened||token!==session)&&document.fullscreenElement===dialog)await document.exitFullscreen();}}catch{if(opened&&token===session)el('position').textContent='Fullscreen unavailable · window presentation active';}
  }
  function close(){
    const restoreFocus=opener;opener=null;
    if(!opened)return;opened=false;session++;slideToken++;figureVersion++;hideLaser();drag=null;stopLab();viewer?.dispose();viewer=null;viewerPromise=null;figureImage.onload=null;figureImage.onerror=null;figureImage.removeAttribute('src');figureImage.alt='';
    if(document.fullscreenElement===dialog)void document.exitFullscreen().catch(()=>{});
    if(dialog.open)dialog.close();
    deck={title:'',subtitle:'',slides:[]};
    for(const name of['deck-title','deck-subtitle','title','takeaway','kicker','bullets','notes-body','references-body','overview-list','comparison-prompt','comparison-choices','comparison-answer','source-page','figure-caption','figure-explanation','hotspots'])el(name).replaceChildren();
    if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});onExit();
  }
  const actions:Record<string,()=>void>={overview:()=>setOverview(!overview),'overview-close':()=>setOverview(false),laser:()=>setLaser(!laserEnabled),fullscreen:()=>void fullscreen(),exit:close,previous:()=>move(-1),next:()=>move(1),source:()=>{showSource=!showSource;updateVisualMode();},'zoom-out':()=>viewer?.zoom(-1),'zoom-in':()=>viewer?.zoom(1),reset:()=>{separate(false);viewer?.reset();},separate:()=>separate(!separated),labels:()=>{labels=!labels;control('labels').setAttribute('aria-pressed',String(labels));viewer?.setLabels(labels);},play:()=>{playing=!playing;applyPlaying();},replay:()=>{viewer?.seek(0);playing=!reduced.matches;applyPlaying();},'clear-selection':()=>{focusedPart=null;showSelection(null);viewer?.back();},'figure-in':()=>changeFigureZoom(1.4),'figure-out':()=>changeFigureZoom(1/1.4),'figure-reset':()=>fitFigure(true)};
  dialog.addEventListener('click',event=>{const target=(event.target as Element).closest<HTMLElement>('[data-action]');if(target)actions[target.dataset.action||'']?.();},listener);
  dialog.addEventListener('keydown',event=>{
    hideLaser();if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if((event.target as Element).closest('input,select,textarea,button,a,summary,canvas,[contenteditable],[role="slider"],[data-el="figure-scroll"]'))return;
    const action=event.key==='ArrowRight'||event.key==='ArrowDown'||event.key===' '||event.key==='PageDown'?()=>move(1):event.key==='ArrowLeft'||event.key==='ArrowUp'||event.key==='PageUp'?()=>move(-1):event.key==='Home'?()=>jump(0):event.key==='End'?()=>jump(deck.slides.length-1):event.key.toLowerCase()==='l'?()=>setLaser(!laserEnabled):null;
    if(action&&!overview){event.preventDefault();event.stopPropagation();action();}
  },listener);
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(overview)setOverview(false);else if(showSource){showSource=false;updateVisualMode();}else close();},listener);
  dialog.addEventListener('close',()=>{if(opened&&!dialog.open)close();},listener);
  for(const name of['notes','references'])el<HTMLDetailsElement>(name).addEventListener('toggle',()=>{if(el<HTMLDetailsElement>(name).open)el<HTMLDetailsElement>(name==='notes'?'references':'notes').open=false;},listener);
  dialog.addEventListener('pointermove',event=>{
    if(!opened||!laserEnabled||!finePointer.matches||event.pointerType!=='mouse'||overview){hideLaser();return;}
    const rect=dialog.getBoundingClientRect(),pointer=el('laser');pointer.hidden=false;pointer.style.transform=`translate(${event.clientX-rect.left}px,${event.clientY-rect.top}px)`;
  },listener);
  dialog.addEventListener('pointerleave',hideLaser,listener);window.addEventListener('blur',hideLaser,listener);
  document.addEventListener('visibilitychange',()=>{hideLaser();applyPlaying();},listener);
  document.addEventListener('fullscreenchange',()=>{control('fullscreen').textContent=document.fullscreenElement===dialog?'Exit fullscreen':'Fullscreen';viewer?.resize();fitFigure();},listener);
  finePointer.addEventListener('change',()=>{if(!finePointer.matches)hideLaser();},listener);
  reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;applyPlaying();}},listener);
  el<HTMLInputElement>('scrub').addEventListener('input',event=>{playing=false;applyPlaying();const value=Number((event.target as HTMLInputElement).value)/1000;viewer?.seek(value);if(narrative){let step=0;narrative.steps.forEach((item,index)=>{if(item.at<=value*narrative!.duration)step=index;});showPhase(step);}},listener);
  figureScroll.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0||figureZoom<=1||(event.target as Element).closest('button'))return;drag={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:figureScroll.scrollLeft,top:figureScroll.scrollTop};figureScroll.setPointerCapture(event.pointerId);event.preventDefault();},listener);
  figureScroll.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointer)return;figureScroll.scrollLeft=drag.left-(event.clientX-drag.x);figureScroll.scrollTop=drag.top-(event.clientY-drag.y);},listener);
  const endDrag=()=>{drag=null;};figureScroll.addEventListener('pointerup',endDrag,listener);figureScroll.addEventListener('pointercancel',endDrag,listener);figureScroll.addEventListener('lostpointercapture',endDrag,listener);
  const resize=new ResizeObserver(()=>fitFigure());resize.observe(figureScroll);
  setLaser(laserEnabled);
  return{
    open(value:Deck){
      if(destroyed)return;if(!opened){opener=document.activeElement instanceof HTMLElement?document.activeElement:null;session++;opened=true;dialog.showModal();}
      deck=value;position={index:Math.max(0,Math.min(value.slides.length-1,Math.floor(value.startIndex||0))),revealed:0};overview=false;el('overview').hidden=true;el('main').hidden=false;control('overview').setAttribute('aria-expanded','false');
      el('deck-title').textContent=value.title;el('deck-subtitle').textContent=value.subtitle;el('provenance').textContent=value.preview?'Original presentation preview · not an instructor slide deck':'Lecture presentation';renderOverview();renderSlide();el('main').focus({preventScroll:true});
    },close,
    destroy(){if(destroyed)return;close();destroyed=true;abort.abort();resize.disconnect();dialog.remove();},
  };
}
