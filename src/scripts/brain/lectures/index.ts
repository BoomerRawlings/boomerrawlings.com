import { unlockLectures, LectureAccessError } from './access';
import { createLecturePresenter } from './presenter';
import type { LectureCourse, Lecture, LectureResource } from './types';

function el<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className=''){
  const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;
}
function button(text:string,action:()=>void,className=''){const node=el('button',text,className);node.type='button';node.addEventListener('click',action);return node;}
function link(text:string,url:string){const node=el('a',text);node.href=url;node.target='_blank';node.rel='noopener noreferrer';return node;}

export function initializeLectures(host:HTMLElement){
  const content=el('div','','lecture-content'),playerHost=el('div');host.append(content,playerHost);
  const status=el('p','','lecture-announcement');status.setAttribute('role','status');host.append(status);
  let course:LectureCourse|null=null,active=false,request:AbortController|null=null,generation=0;
  let opener:HTMLElement|null=null;
  const presenter=createLecturePresenter(playerHost,{onExit:()=>{opener?.focus({preventScroll:true});}});
  const announce=(text:string)=>{status.textContent=text;};

  function gate(){
    content.replaceChildren();
    const shell=el('div','','lecture-gate');
    const illustration=el('div','','lecture-gate-art');illustration.setAttribute('aria-hidden','true');
    illustration.innerHTML='<svg viewBox="0 0 400 360" fill="none"><path d="M84 80C240 80 160 280 316 280M84 80C84 240 316 120 316 280M84 280C240 280 160 80 316 80"/><path d="M84 80L200 180L316 80M84 280L200 180L316 280"/><circle cx="84" cy="80" r="20"/><circle cx="316" cy="80" r="20"/><circle cx="200" cy="180" r="30"/><circle cx="84" cy="280" r="20"/><circle cx="316" cy="280" r="20"/><circle class="lecture-gate-core" cx="200" cy="180" r="7"/></svg>';
    const section=el('section');section.append(el('p','LECTURE COLLECTIONS','lecture-eyebrow'));
    const heading=el('h2','Lectures');heading.id='lectures-heading';section.append(heading);
    section.append(el('p','Enter your password to open your lecture collection.','lecture-lead'));
    const form=el('form');form.noValidate=true;
    const label=el('label','Password');label.htmlFor='lecture-password';
    const input=el('input');input.id='lecture-password';input.name='lecture-password';input.type='password';input.autocomplete='current-password';input.maxLength=256;input.required=true;
    const reveal=button('Show',()=>{const shown=input.type==='password';input.type=shown?'text':'password';reveal.textContent=shown?'Hide':'Show';reveal.setAttribute('aria-label',shown?'Hide password':'Show password');reveal.setAttribute('aria-pressed',String(shown));});reveal.setAttribute('aria-label','Show password');reveal.setAttribute('aria-pressed','false');
    const field=el('div','','lecture-password-field');field.append(input,reveal);
    const error=el('p','','lecture-gate-error');error.id='lecture-access-error';error.setAttribute('role','alert');input.setAttribute('aria-describedby',error.id);
    const submit=el('button','Open lectures →','lecture-primary');submit.type='submit';
    const cancel=button('Cancel',()=>{request?.abort();generation++;request=null;input.disabled=false;submit.disabled=false;cancel.hidden=true;submit.textContent='Open lectures →';error.textContent='';form.removeAttribute('aria-busy');input.focus();},'lecture-text-button');cancel.hidden=true;
    form.append(label,field,error,submit,cancel);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(request)return;if(!input.value){error.textContent='Enter a password.';input.setAttribute('aria-invalid','true');input.focus();return;}
      const password=input.value;input.value='';input.type='password';reveal.textContent='Show';reveal.setAttribute('aria-pressed','false');reveal.setAttribute('aria-label','Show password');
      const current=++generation;request=new AbortController();input.disabled=true;submit.disabled=true;submit.textContent='Opening…';cancel.hidden=false;error.textContent='';input.removeAttribute('aria-invalid');form.setAttribute('aria-busy','true');
      try{
        const next=await unlockLectures(password,request.signal);
        if(current!==generation||!active)return;course=next;renderMap();announce(`${next.title} opened.`);content.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});
      }catch(errorValue){
        if(current!==generation)return;
        if(errorValue instanceof DOMException&&errorValue.name==='AbortError')return;
        error.textContent=errorValue instanceof LectureAccessError&&errorValue.code==='password'?'That password did not open a collection. Try again.':'The lecture collection could not load. Check your connection and try again.';
        input.setAttribute('aria-invalid','true');input.focus();
      }finally{if(current===generation){request=null;input.disabled=false;submit.disabled=false;cancel.hidden=true;submit.textContent='Open lectures →';form.removeAttribute('aria-busy');if(error.textContent&&active)input.focus();}}
    });
    section.append(form,el('p','Your collection stays open in this tab until you lock it or reload.','lecture-gate-footnote'));shell.append(illustration,section);content.append(shell);
  }

  function lock(){request?.abort();request=null;generation++;presenter.close();course=null;opener=null;gate();announce('Lectures locked.');if(active)content.querySelector<HTMLInputElement>('input')?.focus();}
  function present(lecture:Lecture){
    if(!course)return;opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(!lecture.slides.length){showPending(lecture);return;}
    presenter.open({title:`L${lecture.number} · ${lecture.title}`,subtitle:`${course.instructor} · ${course.term}`,slides:lecture.slides});
  }
  function presentResource(resource:LectureResource){
    if(!course||!resource.slides?.length)return;opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
    presenter.open({title:resource.title,subtitle:`${resource.optional?'Optional reading':'Reading guide'} · ${course.title}`,slides:resource.slides});
  }
  function resources(lecture:Lecture){
    const region=el('div','','lecture-resources');
    for(const resource of lecture.resources){
      if(resource.kind==='slides')continue;
      const row=el('div','','lecture-resource');row.append(el('span',`${resource.optional?'Optional ':''}${resource.kind==='paper'?'Reading':'Video'}`,'lecture-eyebrow'),el('strong',resource.title));
      const actions=el('div','','lecture-resource-actions');
      if(resource.slides?.length)actions.append(button('Open reading guide ↗',()=>presentResource(resource)));
      if(resource.url)actions.append(link(resource.kind==='video'?'Watch video ↗':'Source ↗',resource.url));
      row.append(actions);region.append(row);
    }
    return region;
  }
  function showPending(lecture:Lecture){
    if(!course)return;content.replaceChildren();
    const back=button('← Lecture map',()=>{renderMap();content.querySelector<HTMLElement>('h2')?.focus({preventScroll:true});},'lecture-text-button');const section=el('section','','lecture-pending');
    const heading=el('h2',`L${lecture.number} · ${lecture.title}`);heading.id='lectures-heading';heading.tabIndex=-1;
    section.append(el('p',`${lecture.week} · ${course.title}`,'lecture-eyebrow'),heading,el('p',lecture.summary,'lecture-lead'),el('p','The lecture slides have not been supplied yet. The assigned reading is available below.','lecture-pending-note'),resources(lecture));
    content.append(back,section);heading.focus();
  }
  function connector(label:string){
    const edge=el('div','','lecture-connection');
    const line=document.createElementNS('http://www.w3.org/2000/svg','svg');line.setAttribute('viewBox','0 0 40 64');line.setAttribute('aria-hidden','true');line.innerHTML='<path d="M20 0V56M14 49L20 56L26 49"/>';
    edge.append(line,el('span',label));return edge;
  }
  function renderMap(){
    if(!course)return;content.replaceChildren();
    const headingRow=el('div','','lecture-map-heading'),headingText=el('div');
    headingText.append(el('p',`${course.term} · ${course.instructor}`,'lecture-eyebrow'));
    const heading=el('h2',course.title);heading.id='lectures-heading';heading.tabIndex=-1;headingText.append(heading,el('p',course.moduleTitle,'lecture-lead'));
    headingRow.append(headingText,button('Lock / switch collection',lock,'lecture-lock'));
    const description=el('p',course.description,'lecture-map-description');
    const layout=el('div','','lecture-map-layout'),road=el('section','','lecture-roadmap');road.setAttribute('aria-label','Lecture sequence and connections');
    const tools=el('div','','lecture-map-tools');const searchLabel=el('label','Find a lecture or topic');searchLabel.htmlFor='lecture-search';const search=el('input');search.type='search';search.id='lecture-search';search.placeholder='Search lectures…';search.autocomplete='off';tools.append(searchLabel,search);
    const list=el('ol','','lecture-node-list');
    const empty=el('p','No lectures match. Try another topic.','lecture-empty');empty.hidden=true;
    const count=el('p','','lecture-map-count');count.setAttribute('aria-live','polite');
    const renderList=()=>{
      if(!course)return;list.replaceChildren();const query=search.value.trim().toLowerCase();
      const visible=course.lectures.filter(lecture=>[lecture.title,lecture.summary,lecture.week,...lecture.topics.map(t=>t.label)].join(' ').toLowerCase().includes(query));
      count.textContent=`${visible.length} lecture${visible.length===1?'':'s'} · ${visible.reduce((n,l)=>n+l.slides.length,0)} slides`;empty.hidden=visible.length>0;
      visible.forEach((lecture,i)=>{
        const item=el('li','','lecture-node');item.dataset.lectureId=lecture.id;
        if(i){const edge=course!.connections.find(c=>c.from===visible[i-1].id&&c.to===lecture.id&&c.kind==='sequence');if(edge)item.append(connector(edge.label));}
        const card=button('',()=>present(lecture),'lecture-node-button');card.setAttribute('aria-label',`Open lecture ${lecture.number}: ${lecture.title}`);
        const number=el('span',String(lecture.number).padStart(2,'0'),'lecture-node-number');
        const info=el('span','','lecture-node-info');info.append(el('span',lecture.week,'lecture-eyebrow'),el('strong',lecture.title));
        const topics=el('span','','lecture-topic-list');lecture.topics.forEach(topic=>topics.append(el('span',topic.label)));info.append(topics);
        const meta=el('span',lecture.slides.length?`${lecture.slides.length} slides →`:'Reading available →','lecture-node-meta');card.append(number,info,meta);item.append(card,resources(lecture));list.append(item);
      });
    };
    search.addEventListener('input',renderList);road.append(tools,count,list,empty);renderList();
    const aside=el('aside','','lecture-map-aside');aside.setAttribute('aria-label','Using these lectures');
    const guide=el('section');guide.append(el('p','PRESENTING','lecture-eyebrow'),el('h3','Built for the lecture room'),el('p','Open a lecture to present. Reveal points at your pace, interact with the visuals, or compare the original slide.'));
    const keys=el('dl','','lecture-key-list');for(const [key,label] of [['→ / Space','Reveal / next'],['←','Previous step'],['Esc','Leave presentation'],['L','Laser pointer']]){keys.append(el('dt',key),el('dd',label));}guide.append(keys);
    const relations=el('section');relations.append(el('p','CONCEPT CONNECTIONS','lecture-eyebrow'),el('h3','Across the lectures'));
    const conceptual=course.connections.filter(c=>c.kind==='concept');for(const edge of conceptual){const from=course.lectures.find(l=>l.id===edge.from),to=course.lectures.find(l=>l.id===edge.to);if(!from||!to)continue;const row=el('div','','lecture-concept-edge');row.append(button(`L${from.number}`,()=>present(from)),el('span',`— ${edge.label} →`),button(`L${to.number}`,()=>present(to)));relations.append(row);}
    relations.append(el('p','Lines describe study relationships; slide order follows the supplied lectures.','lecture-small'));
    aside.append(guide,relations);if(course.preview.slides.length){aside.append(button('Presenter preview ↗',()=>{if(!course)return;opener=document.activeElement as HTMLElement;presenter.open({title:course.preview.title,subtitle:course.preview.description,slides:course.preview.slides,preview:true});},'lecture-text-button'));}
    layout.append(road,aside);content.append(headingRow,description,layout);
  }
  gate();
  const pagehide=()=>{lock();};window.addEventListener('pagehide',pagehide);
  return{
    setActive(value:boolean){active=value;if(!value){request?.abort();request=null;generation++;presenter.close();if(!course)gate();}else if(!course)queueMicrotask(()=>{if(active)content.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});});},
    lock,
    destroy(){active=false;request?.abort();request=null;generation++;course=null;opener=null;presenter.destroy();content.replaceChildren();playerHost.replaceChildren();status.replaceChildren();window.removeEventListener('pagehide',pagehide);host.replaceChildren();},
  };
}
