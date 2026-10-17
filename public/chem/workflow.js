import {mountWorkflow} from './workflow-renderer.js?v=20261017-simple';
import {foundationPlan,randomPlans,quizPlans,problemPlan,practiceConcepts,practiceDependencies} from './workflow-data.js';
import {questions} from './retrieval-data.js';
import {currentProblems} from './random-practice.js?v=20261017-highlights';

const $=id=>document.getElementById(id);
const host=$('chem-workflow-host');
const root=host.attachShadow({mode:'open'});
root.append($('chem-workflow-template').content.cloneNode(true));
const collections={foundations:[foundationPlan],random:randomPlans(currentProblems),quiz:quizPlans(questions),practice:[]};
const text=node=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent;
  if(node.nodeName==='BR')return '\n';
  return [...node.childNodes].map(text).join('');
};
for(let i=1;i<=6;i++){
  const question=$(`q${i}`),answer=$(`a${i}`).querySelector('div');
  const requests=[...question.querySelectorAll('ol>li')].map(li=>li.textContent.replace(/^\(\d+\)\s*/,''));
  const groups=[];
  for(const node of answer.children){
    if(node.tagName==='A')continue;
    const content=text(node).trim();
    if(/^[a-f]\./.test(content))groups.push(content);
    else if(groups.length)groups[groups.length-1]+='\n\n'+content;
    else groups.push(content);
  }
  collections.practice.push(problemPlan({id:`practice-${i}`,title:`Q${i}. ${question.querySelector('h3').textContent}`,
    prompt:[question.querySelector('p:not(.eyebrow)').textContent,...requests.map((request,j)=>`${String.fromCharCode(97+j)}. ${request}`)].join('\n'),
    answers:groups,concepts:practiceConcepts[i-1],decisions:requests,source:`q${i}`,dependencies:practiceDependencies[i-1].map(ids=>['read-problem',...ids])}));
}
const display=mountWorkflow(root,{title:'Work through one step',description:'Choose a problem. Follow one pair at a time. Open a prerequisite only when you need it.',eyebrow:'CHEM / WORKFLOW DISPLAY',footer:'Based on supplied Lectures1–7, notes1–4 and Activities3–6. Exact exam scope unconfirmed; missing October20 lecture and Activities7–8 are excluded.',plans:collections.foundations});
const collection=root.getElementById('workflow-collection');
let activeCollection='foundations',activeId='foundations';
function choose(group,id,focus=true){
  activeCollection=group;collection.value=group;
  display.setPlans(collections[group]);
  activeId=id??collections[group][0].id;
  display.open(activeId,{focus});
}
function reveal(group,id){
  $('chem-workflow-panel').hidden=false;
  $('workflow-toggle').setAttribute('aria-expanded','true');
  $('workflow-toggle').textContent='Hide workflow';
  choose(group,id);
}
$('workflow-toggle').addEventListener('click',()=>{
  const open=$('chem-workflow-panel').hidden;
  $('chem-workflow-panel').hidden=!open;
  $('workflow-toggle').setAttribute('aria-expanded',String(open));
  $('workflow-toggle').textContent=open?'Hide workflow':'Show workflow';
  if(open)choose(activeCollection,activeId);
  else display.collapse();
});
collection.addEventListener('change',()=>choose(collection.value));
root.getElementById('workflow-problem').addEventListener('change',event=>{activeId=event.target.value;});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-workflow-random],[data-workflow-practice],[data-workflow-quiz]');
  if(!button)return;
  if(button.dataset.workflowRandom)reveal('random',`random-${button.dataset.workflowRandom}`);
  else if(button.dataset.workflowPractice)reveal('practice',`practice-${button.dataset.workflowPractice}`);
  else reveal('quiz',`quiz-${button.dataset.workflowQuiz}`);
});
document.addEventListener('chem-practice-generated',event=>{
  collections.random=randomPlans(event.detail);
  if(activeCollection==='random'){
    if(!$('chem-workflow-panel').hidden)choose('random',activeId,false);
    else display.setPlans(collections.random);
    root.getElementById('workflow-status').textContent='Fresh practice set: workflow values and worked answers updated.';
  }
});
for(let i=1;i<=6;i++){
  const button=document.createElement('button');button.type='button';button.textContent='Show workflow';button.dataset.workflowPractice=String(i);$(`q${i}`).append(button);
}
for(const question of questions){
  const button=document.createElement('button');button.type='button';button.textContent='Show workflow';button.dataset.workflowQuiz=question.id;$(`qa-${question.id}`).append(button);
}
