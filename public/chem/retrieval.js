import {flashcards,questions,shuffle} from './retrieval-data.js';
import {highlightsForSection,insertHighlights,practiceBadge} from './lecture-highlights.js';

const $=id=>document.getElementById(id);
let deck=[...flashcards],position=0;
function renderCard(){
  const card=deck[position];
  $('flash-category').textContent=card.topic;
  $('flash-progress').textContent=`Card ${position+1} of ${deck.length}`;
  $('flash-prompt').textContent=card.prompt;
  $('flash-response').textContent=card.answer;
  let context=$('flash-lecture-context');
  if(!context){context=document.createElement('div');context.id='flash-lecture-context';$('flash-answer').append(context);}
  context.replaceChildren();insertHighlights(context,highlightsForSection(card.source),{compact:true});
  $('flash-source').setAttribute('href',`#${card.source}`);
  $('flash-answer').hidden=true;
  $('flash-flip').setAttribute('aria-expanded','false');
  $('flash-flip').textContent='Show answer';
}
$('flash-flip').addEventListener('click',()=>{
  const hidden=!$('flash-answer').hidden;
  $('flash-answer').hidden=hidden;
  $('flash-flip').setAttribute('aria-expanded',String(!hidden));
  $('flash-flip').textContent=hidden?'Show answer':'Hide answer';
});
$('flash-next').addEventListener('click',()=>{position=(position+1)%deck.length;renderCard();});
$('flash-prev').addEventListener('click',()=>{position=(position-1+deck.length)%deck.length;renderCard();});
$('flash-topic').addEventListener('change',()=>{
  deck=flashcards.filter(card=>$('flash-topic').value==='all'||card.topic===$('flash-topic').value);
  position=0;renderCard();
});
$('flash-shuffle').addEventListener('click',()=>{deck=shuffle(deck);position=0;renderCard();});

const results=new Map();
function renderScore(){
  $('qa-score').textContent=`Current answers: ${[...results.values()].filter(Boolean).length} correct / ${results.size} checked. ${questions.length} questions available.`;
}
for(const question of questions){
  const article=$(`qa-${question.id}`);
  const badge=practiceBadge(question.source);if(badge)article.querySelector('.qa-solution').append(badge);
  const options=article.querySelector('.qa-options');
  shuffle([...options.children]).forEach(label=>options.append(label));
  article.querySelector('[data-check]').addEventListener('click',()=>{
    const selected=article.querySelector('input:checked');
    const feedback=$(`feedback-${question.id}`);
    feedback.hidden=false;
    if(!selected){feedback.textContent='Choose an answer first.';feedback.dataset.result='pending';return;}
    const correct=Number(selected.value)===question.correct;
    results.set(question.id,correct);
    feedback.dataset.result=correct?'correct':'incorrect';
    feedback.textContent=`${correct?'Correct.':'Not quite.'} ${question.explanation}`;
    renderScore();
  });
  article.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{
    results.delete(question.id);$(`feedback-${question.id}`).hidden=true;renderScore();
  }));
}
renderCard();
$('qa-topic').addEventListener('change',()=>{
  document.querySelectorAll('[data-qa]').forEach(article=>{
    article.hidden=$('qa-topic').value!=='all'&&article.dataset.topic!==$('qa-topic').value;
  });
});
$('qa-reset').addEventListener('click',()=>{
  document.querySelectorAll('[data-qa] input').forEach(input=>input.checked=false);
  document.querySelectorAll('.qa-feedback').forEach(feedback=>feedback.hidden=true);
  document.querySelectorAll('.qa-solution').forEach(detail=>detail.open=false);
  results.clear();renderScore();
});
