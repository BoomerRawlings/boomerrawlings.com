import { courses, courseTopicIds } from '../../../public/brain/courses.js';
import { topics } from '../../../public/brain/curriculum.js';

export type CourseScope={courseId:'all'|'105'|'108';chapterId:string|null;topicIds:string[]|null;label:string};
type Options={onTopic:(id:string)=>void;onPractice:(ids:string[],label:string)=>void;onScopeChange:(scope:CourseScope)=>void};
type Chapter={id:string;number:number;title:string;pages:number[];overview:string;ideas:{title:string;explanation:string}[];misconceptions:{claim:string;correction:string}[];questions:{prompt:string;answer:string}[];topicIds:string[];modelNote:string};
type Course={id:string;code:string;title:string;mappingNote:string;catalogUrl:string;book:{title:string;author:string;edition:number;year:number;url:string};chapters:Chapter[];backgroundTopicIds:string[]};
const catalog=courses as Course[];
const topicById=new Map(topics.map(topic=>[topic.id,topic]));
const make=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const button=(text:string,action:()=>void,className='')=>{const el=make('button',text,className);el.type='button';el.addEventListener('click',action);return el;};
const external=(label:string,url:string)=>{const el=make('a',label);el.href=url;el.target='_blank';el.rel='noopener noreferrer';return el;};

export function initCourses(host:HTMLElement,options:Options){
  let courseId:CourseScope['courseId']='all',chapterId:string|null=null,open=false;
  try{const saved=JSON.parse(localStorage.getItem('brain-course-v1')||'{}');if(catalog.some(c=>c.id===saved.courseId)){courseId=saved.courseId;chapterId=catalog.find(c=>c.id===courseId)!.chapters.some(c=>c.id===saved.chapterId)?saved.chapterId:null;}open=Boolean(saved.open);}catch{}
  const bar=make('div','','course-bar'),label=make('span','Study','eyebrow'),tabs=make('div','','course-tabs'),toggle=button('Chapters & notes',()=>{open=!open;sync();save();},'course-toggle'),status=make('span','','course-scope');
  tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Course');
  const courseButtons=[{id:'all',label:'All topics'},...catalog.map(c=>({id:c.id,label:c.code}))].map(item=>{const el=button(item.label,()=>selectCourse(item.id as CourseScope['courseId']));el.dataset.course=item.id;tabs.append(el);return el;});
  const panel=make('div','','course-panel');panel.id='course-materials';toggle.setAttribute('aria-controls',panel.id);bar.append(label,tabs,status,toggle);host.replaceChildren(bar,panel);
  function getScope():CourseScope{const course=catalog.find(c=>c.id===courseId),chapter=course?.chapters.find(c=>c.id===chapterId);return{courseId,chapterId,topicIds:course?(chapter?[...chapter.topicIds]:courseTopicIds(courseId)):null,label:course?`${course.code}${chapter?` · Ch. ${chapter.number}`:''}`:'All topics'};}
  function save(){try{localStorage.setItem('brain-course-v1',JSON.stringify({courseId,chapterId,open}));}catch{}}
  function sync(){const scope=getScope();courseButtons.forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.course===courseId)));toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Close chapter notes':'Chapters & notes';panel.hidden=!open;status.textContent=chapterId?scope.label:catalog.find(c=>c.id===courseId)?.title||'Anatomy & mechanisms';}
  function selectCourse(id:CourseScope['courseId']){if(id!=='all'&&!catalog.some(c=>c.id===id))return;courseId=id;chapterId=null;render();save();options.onScopeChange(getScope());}
  function selectChapter(id:string|null){const course=catalog.find(c=>c.id===courseId);if(!course||id!==null&&!course.chapters.some(c=>c.id===id))return;chapterId=id;open=true;render();save();options.onScopeChange(getScope());panel.querySelector<HTMLElement>('.course-notes h2')?.focus({preventScroll:true});}
  function modelLinks(ids:string[],note:string){
    const section=make('section','','chapter-models');section.append(make('h3','Supporting 3D foundations'));
    if(note)section.append(make('p',note));
    const links=make('div','','chapter-topic-links');ids.forEach(id=>{const topic=topicById.get(id);if(topic)links.append(button(`${topic.title} ↗`,()=>options.onTopic(id)));});section.append(links);
    if(ids.length)section.append(button('Practice these models →',()=>options.onPractice(ids,getScope().label),'course-practice'));
    else section.append(make('p','No matching 3D lesson yet. Use the chapter explanations and retrieval questions above.','course-coverage'));
    return section;
  }
  function render(){
    const scroll=panel.querySelector('.chapter-list')?.scrollTop||0;sync();panel.replaceChildren();const course=catalog.find(c=>c.id===courseId);
    if(!course){const chooser=make('div','','course-chooser');for(const item of catalog){const card=make('article');card.append(make('h2',`${item.code} · ${item.title}`),make('p',`${item.book.author} · ${item.book.title} · ${item.book.edition}th edition`),button(`${item.chapters.length} chapters →`,()=>{open=true;selectCourse(item.id as CourseScope['courseId']);}));chooser.append(card);}panel.append(chooser);return;}
    const sidebar=make('nav','','chapter-list');sidebar.setAttribute('aria-label',`${course.code} chapters`);
    const allChapters=button('Course overview',()=>selectChapter(null));allChapters.setAttribute('aria-current',String(!chapterId));sidebar.append(allChapters);
    course.chapters.forEach(chapter=>{const el=button('',()=>selectChapter(chapter.id));el.dataset.chapter=chapter.id;el.setAttribute('aria-current',String(chapterId===chapter.id));el.append(make('span',String(chapter.number).padStart(2,'0')),make('span',chapter.title));sidebar.append(el);});
    const notes=make('article','','course-notes'),chapter=course.chapters.find(c=>c.id===chapterId),heading=make('h2',chapter?`${chapter.number}. ${chapter.title}`:course.title);heading.tabIndex=-1;notes.append(make('span',`${course.code} · ${chapter?`pp. ${chapter.pages[0]}–${chapter.pages[1]}`:`${course.chapters.length} chapters`}`,'eyebrow'),heading);
    if(chapter){
      notes.append(make('p',chapter.overview,'chapter-overview'));
      const ideas=make('div','','chapter-ideas');for(const idea of chapter.ideas){const item=make('section');item.append(make('h3',idea.title),make('p',idea.explanation));ideas.append(item);}notes.append(ideas);
      for(const misconception of chapter.misconceptions){const box=make('section','','chapter-correction');box.append(make('h3','Common misconception'),make('p',misconception.claim,'chapter-claim'),make('p',misconception.correction));notes.append(box);}
      const retrieval=make('section','','chapter-retrieval');retrieval.append(make('h3','Retrieval practice'),make('p','Explain it before revealing the answer.'));
      chapter.questions.forEach((question,index)=>{const detail=make('details'),summary=make('summary',`${index+1}. ${question.prompt}`);detail.append(summary,make('p',question.answer));retrieval.append(detail);});notes.append(retrieval,modelLinks(chapter.topicIds,chapter.modelNote));
    }else{
      notes.append(make('p',`${course.book.author} · ${course.book.title} · ${course.book.edition}th edition (${course.book.year}).`),make('p','Choose a chapter for key ideas, common misconceptions, and retrieval questions. Course selection filters the topic library, flashcards and question rounds.'),make('p',course.mappingNote,'course-coverage'));
      const count=courseTopicIds(course.id).length;notes.append(make('p',`${course.chapters.length} chapter guides · ${count} supporting 3D topics. The models are foundations, not complete visual coverage of every chapter.`));
      notes.append(button('Practice course models →',()=>options.onPractice(courseTopicIds(course.id),course.code),'course-practice'));
      if(course.backgroundTopicIds.length){const detail=make('details','','course-background');detail.append(make('summary',`Supplemental neurobiology · ${course.backgroundTopicIds.length} topics`),make('p','Additional cell, transmitter and channel mechanisms. Included in the course-wide model pool; not assigned to an unverified textbook chapter.'),modelLinks(course.backgroundTopicIds,''));notes.append(detail);}
    }
    const source=make('p','','chapter-source');source.append(external(`${course.book.author}, ${course.book.edition}th ed. ↗`,course.book.url),document.createTextNode(' · '),external('Course catalog ↗',course.catalogUrl));notes.append(source);
    if(chapter)notes.append(make('p','Original study notes aligned with the supplied edition. Chapters are not a verified lecture schedule.','course-coverage'));
    panel.append(sidebar,notes);sidebar.scrollTop=scroll;
  }
  render();options.onScopeChange(getScope());
  return{selectCourse,selectChapter,getScope,destroy(){host.replaceChildren();}};
}
