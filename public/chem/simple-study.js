import {stepVisual,notationHelp} from './step-visuals.js';
import {replaceDropdowns} from './choice-path.js';
import {makeLessons} from './simple-lessons.js';
import {lectureHighlights,highlightHTML} from './lecture-highlights.js';
const $=id=>document.getElementById(id);
let lessons=makeLessons(),lessonIndex=0,position=0;
const make=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
function render(follow=true){
  const lesson=lessons[lessonIndex],isQuiz=position===lesson.steps.length;
  $('lesson-count').textContent=`Lesson ${lessonIndex+1} of ${lessons.length}`;
  $('lesson-back').disabled=lessonIndex===0;
  $('lesson-forward').disabled=lessonIndex===lessons.length-1;
  $('simple-title').textContent=lesson.title.replace(/^\d+\. /,'');
  $('simple-given').textContent=lesson.given;$('simple-wanted').textContent=lesson.wanted;
  $('simple-progress').textContent=isQuiz?'Your turn':`Step ${position+1} of ${lesson.steps.length}`;
  $('simple-step').hidden=isQuiz;$('simple-quiz').hidden=!isQuiz;
  $('simple-prev').disabled=position===0;
  $('simple-next').hidden=isQuiz;
  $('simple-next').textContent=position===lesson.steps.length-1?'Try one question →':'Next step →';
  $('simple-terms').textContent=lesson.terms;
  $('simple-terms-detail').open=false;$('simple-lecture-detail').open=false;
  $('simple-new-example').hidden=!['mass-count','count-mass','liquid','gas','formula'].includes(lesson.id);
  $('simple-reference').href=`#${lesson.source}`;
  const note=lectureHighlights.find(h=>h.id===lesson.signal);
  $('simple-lecture-content').innerHTML=highlightHTML([note],{compact:true});
  $('simple-lecture-label').textContent=note.kind==='quote'?'Purple · instructor’s exact words':'Gold · lecture emphasis / method';
  $('simple-lecture-detail').className=note.kind==='quote'?'simple-note-quote':'simple-note-emphasis';
  const sketch=$('simple-sketch');sketch.replaceChildren();sketch.hidden=true;
  if(!isQuiz){
    const current=lesson.steps[position];
    $('simple-step-title').textContent=current.title;
    $('simple-why').textContent=current.why;
    $('simple-work').textContent=current.work;
    sketch.hidden=false;sketch.innerHTML=stepVisual(lesson,position);
    const hint=notationHelp([lesson.given,current.work,lesson.id==='instrument'?'⁺⁻':''].join(' '));
    $('simple-notation').textContent=hint;$('simple-notation').hidden=!hint;
    $('simple-work').hidden=!!sketch.querySelector('.unit-picture')&&!sketch.querySelector('.gas-units');
  }else{
    $('simple-question').textContent=lesson.quiz.prompt;
    $('simple-options').replaceChildren(...lesson.quiz.options.map((option,i)=>{
      const label=make('label');const radio=make('input');radio.type='radio';radio.name='simple-answer';radio.value=String(i);
      radio.addEventListener('change',()=>{$('simple-feedback').hidden=true;});
      label.append(radio,make('span',option));return label;
    }));
    $('simple-feedback').hidden=true;
    $('simple-next-topic').textContent=lessonIndex===lessons.length-1?'Back to the first topic':'Next topic →';
  }
  const heading=$(isQuiz?'simple-question':'simple-step-title');heading.focus({preventScroll:true});if(follow)heading.scrollIntoView({block:'start',behavior:'instant'});
}
function changeLesson(index){lessonIndex=index;position=0;render();history.replaceState(null,'',`#learn-${lessons[lessonIndex].id}`);}
$('lesson-back').addEventListener('click',()=>changeLesson(Math.max(0,lessonIndex-1)));
$('lesson-forward').addEventListener('click',()=>changeLesson(Math.min(lessons.length-1,lessonIndex+1)));
$('simple-prev').addEventListener('click',()=>{if(position>0){position--;render();}});
$('simple-next').addEventListener('click',()=>{position++;render();});
$('simple-check').addEventListener('click',()=>{
  const selected=document.querySelector('input[name="simple-answer"]:checked');
  const feedback=$('simple-feedback');feedback.hidden=false;
  if(!selected){feedback.textContent='Choose an answer first.';return;}
  const q=lessons[lessonIndex].quiz,correct=Number(selected.value)===q.correct;
  feedback.dataset.correct=String(correct);
  feedback.textContent=`${correct?'Yes.':'Let’s check it.'} ${q.why}`;
});
$('simple-next-topic').addEventListener('click',()=>changeLesson((lessonIndex+1)%lessons.length));
$('simple-restart').addEventListener('click',()=>{position=0;render();});
$('simple-new-example').addEventListener('click',()=>{const previous=lessons[lessonIndex].given;for(let tries=0;tries<10;tries++){lessons=makeLessons(Math.random);if(lessons[lessonIndex].given!==previous)break;}position=0;render();});
function revealReference(target){
  if(!target)return;
  for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
}
function hashTarget(){
  if(location.hash.startsWith('#learn-')){
    const index=lessons.findIndex(l=>l.id===location.hash.slice(7));if(index>=0)changeLesson(index);
  }else{
    const target=$(location.hash.slice(1));revealReference(target);
    if(target?.closest('#full-study-guide'))requestAnimationFrame(()=>target.scrollIntoView());
  }
}
document.addEventListener('click',event=>{
  const link=event.composedPath().find(el=>el instanceof HTMLAnchorElement&&el.hash&&el.origin===location.origin&&el.pathname===location.pathname);
  if(link)revealReference($(link.hash.slice(1)));
});
window.addEventListener('hashchange',hashTarget);
render(false);hashTarget();replaceDropdowns(document);
