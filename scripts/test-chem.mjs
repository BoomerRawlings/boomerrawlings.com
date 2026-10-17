import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'parse5';
import {convert,routes,spectra,NA} from '../public/chem/model.js';
import {flashcards,questions,shuffle} from '../public/chem/retrieval-data.js';
import {generatePractice} from '../public/chem/random-practice.js';
import {fundamentals,foundationPlan,randomPlans,quizPlans,problemPlan,practiceConcepts,practiceDependencies} from '../public/chem/workflow-data.js';
import {lectureHighlights,annotateGuide,highlightHTML} from '../public/chem/lecture-highlights.js';

const {makeLessons,number}=await import('../public/chem/simple-lessons.js');
const {stepVisual,notationHelp}=await import('../public/chem/step-visuals.js');
for(const random of [()=>0,()=>.5,()=>.999]){
 const lessons=makeLessons(random);assert.equal(lessons.length,10);assert.equal(new Set(lessons.map(l=>l.id)).size,10);
 for(const lesson of lessons){assert.ok(lesson.steps.length>=4&&lesson.steps.length<=5);assert.ok(lectureHighlights.some(h=>h.id===lesson.signal));assert.equal(lesson.quiz.options.length,3);assert.ok(lesson.quiz.options[lesson.quiz.correct]);for(const [i,s] of lesson.steps.entries()){assert.ok(s.title&&s.why&&s.work&&!/NaN|undefined/.test(s.work));const visual=stepVisual(lesson,i);assert.ok(visual.includes('role="img"')&&!/NaN|undefined/.test(visual));}}
 const mass=Number(lessons[1].given.split(' ')[0]);assert.ok(lessons[1].steps[3].work.includes(number(mass/32*NA*2)));assert.ok(lessons[2].steps[2].work.includes(mass+' g O₂'));
}
assert.equal(lectureHighlights.length,10);
assert.equal(lectureHighlights.filter(h=>h.kind==='quote').length,4);
const annotated=annotateGuide(readFileSync('src/data/chem-content.html','utf8'));
assert.equal((annotated.match(/id="lecture-/g)||[]).length,10);
assert.equal((annotated.match(/<blockquote>/g)||[]).length,4,'only verified excerpts become quotations');
for(const item of lectureHighlights){assert.ok(item.lines[0]<=item.lines[1]&&item.lines[0]>0);assert.ok(item.text&&item.source&&item.concepts.length);}
assert.ok(!highlightHTML(lectureHighlights,{compact:true}).includes('id="lecture-'),'repeated cards must not duplicate source anchors');
const escapedQuote=highlightHTML([{...lectureHighlights[0],text:'<script>alert("test")</script> & quoted text'}]);
assert.ok(!escapedQuote.includes('<script>')&&escapedQuote.includes('&lt;script&gt;'));

function checkPlan(plan){
  const ids=new Set(plan.steps.map(s=>s.id));
  assert.equal(ids.size,plan.steps.length);
  for(const step of plan.steps){
    assert.ok(step.title&&step.description&&step.artifact.code&&step.checkpoint);
    for(const dependency of step.related??[]){assert.ok(ids.has(dependency),`missing ${dependency} in ${plan.id}`);assert.notEqual(dependency,step.id);}
  }
}
checkPlan(foundationPlan);
assert.equal(fundamentals.length,18);
for(const plan of quizPlans(questions))checkPlan(plan);
for(const random of [()=>0,()=>.49,()=>.99]){
  const rows=generatePractice(random),plans=randomPlans(rows);
  assert.equal(plans.length,13);
  for(const [i,plan] of plans.entries()){
    checkPlan(plan);
    assert.equal(plan.summary,rows[i].prompt);
    assert.deepEqual(plan.steps.filter(s=>s.id.startsWith('solve-')).map(s=>s.artifact.code),rows[i].steps,'workflow must use exact current values/solutions');
  }
}
for(let i=0;i<6;i++){
  const deps=practiceDependencies[i];
  const plan=problemPlan({id:`test-${i}`,title:'Practice',prompt:'Given and wanted',answers:deps.map((_,j)=>`Worked part${j}`),concepts:practiceConcepts[i],decisions:deps.map(()=> 'Explain the requested part'),dependencies:deps.map(d=>['read-problem',...d]),source:`q${i+1}`});
  checkPlan(plan);
}
assert.ok(!practiceDependencies[0][4].includes('solve-4'),'speed comparison does not require pressure result');
assert.ok(practiceDependencies[5][3].includes('solve-2'),'gas calculation reuses inferred amount');

let seed=271828;
const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const generatedSources=new Set();
const diatomics=new Set();
for(let trial=0;trial<300;trial++){
  const batch=generatePractice(rng);
  assert.equal(batch.length,13);
  assert.equal(new Set(batch.map(q=>q.topic)).size,13);
  for(const q of batch){
    assert.ok(q.prompt.length>30&&q.steps.length>=2&&q.steps.every(s=>s.length>20));
    assert.ok(!/NaN|Infinity|undefined/.test([q.prompt,...q.steps].join(' ')));
    generatedSources.add(q.source);
  }
  const d=batch.find(q=>q.topic==='Diatomic molecules'),symbol=d.prompt.match(/(H|N|O|F|Cl|Br|I)₂/)[1];diatomics.add(symbol);
  const reverse=d.prompt.includes('(not molecules)');
  const count=Number(d.prompt.match(reverse?/contains ([\de.+-]+) /:/For ([\de.+-]+) g/)[1]);
  const atomic={H:1.008,N:14.01,O:16,F:19,Cl:35.45,Br:79.90,I:126.90}[symbol];
  const expected=reverse?count/2/NA*(2*atomic):count/(2*atomic)*NA*2;
  const answer=Number(d.steps[reverse?0:2].match(/= ([\de.+-]+) /)[1]);
  assert.ok(Math.abs(answer-expected)/expected<.001,'diatomic answer mismatch');
}
assert.equal(diatomics.size,7);
assert.notDeepEqual(generatePractice(()=>0),generatePractice(()=>.99));
const zeroBatch=generatePractice(()=>0);
const answerFor=topic=>zeroBatch.find(q=>q.topic===topic).steps.join(' ');
assert.match(answerFor('Gas laws'),/= 2\.64 L/);
assert.match(answerFor('Isotopes & graph heights'),/=20\.18 u/);
assert.match(answerFor('Diatomic isotope spectrum'),/42\.25%.*45\.5%.*12\.25%/);
assert.match(answerFor('Composition → formulas'),/C2H4O2/);

assert.equal(flashcards.length,37);
assert.equal(questions.length,18);
assert.equal(new Set(flashcards.map(card=>card.id)).size,flashcards.length);
assert.equal(new Set(questions.map(question=>question.id)).size,questions.length);
for(const card of flashcards)assert.ok(card.prompt&&card.answer&&card.topic&&card.source);
for(const q of questions){
  assert.equal(q.options.length,4);
  assert.equal(new Set(q.options).size,4);
  assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4&&q.explanation.length>30);
}
const initial=flashcards.map(card=>card.id);
const shuffled=shuffle(flashcards,()=>0);
assert.deepEqual(flashcards.map(card=>card.id),initial,'shuffle mutated source cards');
assert.deepEqual(shuffled.map(card=>card.id).sort(),[...initial].sort());
assert.notDeepEqual(shuffled.map(card=>card.id),initial);

const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
near(convert('ethanol-forward',11.5).value,11.5/46.07*NA*6);
near(convert('ethanol-reverse',11.5/46.07*NA).value,11.5);
near(convert('water-forward',2).value,2000/18.02*NA);
near(convert('water-reverse',convert('water-forward',2).value).value,2);
near(convert('oxygen-reverse',5e21).value,5e21/NA*32);
near(convert('oxygen-atoms',5e21).value,5e21/2/NA*32);
near(convert('gas-reverse',convert('gas-forward',11.2).value).value,11.2);
for(const [id,r] of Object.entries(routes)){
  let unit=r.unit;
  for(const [,den,to,from] of r.steps){assert.equal(from,unit,`broken unit chain in ${id}`);assert.ok(den>0);unit=to;}
  assert.equal(convert(id,0).value,0);
  for(const bad of [-1,NaN,Infinity])assert.throws(()=>convert(id,bad));
}
assert.throws(()=>convert('not-a-route',1));
near(spectra.chlorine.peaks[1][1],2*.76*.24/(.76*.76)*100);
near(spectra.chlorine.peaks[2][1],.24*.24/(.76*.76)*100);

const file=readFileSync('dist/chem/index.html','utf8');
assert.match(file,/<details id="full-study-guide">/,'long reference stays closed on first visit');
assert.match(file,/CHEM 004 study notes/);
assert.match(file,/simple-study.js/);
assert.ok(!file.includes('id="simple-lecture-detail"'),'lecture note has no collapse control');
assert.ok(!file.includes('id="simple-topic"'),'beginner view has no topic dropdown');
assert.ok(notationHelp('O₂ 10²³ CH₃O⁺').includes('electric charge'));
assert.ok(stepVisual(makeLessons()[1],1).includes('<del>g O₂</del>'));
assert.ok(stepVisual(makeLessons()[2],0).includes(number(makeLessons()[2].values.atoms)));

const ids=new Set(),refs=[],tags=[];
function walk(n){
  const attr=Object.fromEntries((n.attrs??[]).map(a=>[a.name,a.value]));
  if(attr.id){assert.ok(!ids.has(attr.id),`duplicate id ${attr.id}`);ids.add(attr.id);}
  if(attr.href?.startsWith('#'))refs.push(attr.href.slice(1));
  if(n.tagName)tags.push(n.tagName);
  for(const child of n.childNodes??[])walk(child);
}
walk(parse(file));
for(const h of lectureHighlights){assert.ok(ids.has(`lecture-${h.id}`));assert.ok(ids.has(h.source));}
for(const id of ['workflow-toggle','chem-workflow-panel','chem-workflow-host','chem-workflow-template'])assert.ok(ids.has(id));
for(const step of foundationPlan.steps){for(const resource of step.resources??[])assert.ok(ids.has(new URL(resource.url).hash.slice(1)));}
for(const source of generatedSources)assert.ok(ids.has(source),`missing generated source ${source}`);
for(const id of ['random-practice','random-new','random-status','random-problems'])assert.ok(ids.has(id));
for(const id of refs)assert.ok(ids.has(id),`missing anchor ${id}`);
for(const entry of [...flashcards,...questions])assert.ok(ids.has(entry.source),`missing retrieval source ${entry.id}`);
for(const id of ['flashcards','quick-quiz','flash-topic','flash-prompt','flash-answer','qa-score',...questions.map(q=>`qa-${q.id}`)])assert.ok(ids.has(id));
assert.ok(file.includes('/chem/retrieval.js'));
for(const id of ['method','conversions','mass-spec','spectrum','formulas','activity-check','sources',...Array.from({length:6},(_,i)=>`q${i+1}`),...Array.from({length:6},(_,i)=>`a${i+1}`)])assert.ok(ids.has(id));
assert.equal(tags.filter(t=>t==='h1').length,1);
assert.ok(file.includes('type="module" src="/chem/study.js"')||file.includes('src="/chem/study.js" type="module"'));
assert.ok(file.includes('noindex,nofollow,noarchive,noimageindex'));
assert.ok(!/C:[\\/]|OneDrive|AppData|codex-clipboard/.test(file),'private identifier or machine path');
assert.ok(!/student\s*(?:id|number)\s*[:#]?\s*\d{6,}/i.test(file),'student identifier must not appear in the page');
assert.ok(!readFileSync('dist/sitemap-0.xml','utf8').includes('/chem/'));
console.log('CHEM: 8 unit chains, reverse round trips, invalid inputs, isotope ratios, guide anchors and publication boundary pass.');
