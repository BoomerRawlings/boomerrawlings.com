import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'parse5';
import {convert,routes,spectra,NA} from '../public/chem/model.js';
import {flashcards,questions,shuffle} from '../public/chem/retrieval-data.js';

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
const ids=new Set(),refs=[],tags=[];
function walk(n){
  const attr=Object.fromEntries((n.attrs??[]).map(a=>[a.name,a.value]));
  if(attr.id){assert.ok(!ids.has(attr.id),`duplicate id ${attr.id}`);ids.add(attr.id);}
  if(attr.href?.startsWith('#'))refs.push(attr.href.slice(1));
  if(n.tagName)tags.push(n.tagName);
  for(const child of n.childNodes??[])walk(child);
}
walk(parse(file));
for(const id of refs)assert.ok(ids.has(id),`missing anchor ${id}`);
for(const entry of [...flashcards,...questions])assert.ok(ids.has(entry.source),`missing retrieval source ${entry.id}`);
for(const id of ['flashcards','quick-quiz','flash-topic','flash-prompt','flash-answer','qa-score',...questions.map(q=>`qa-${q.id}`)])assert.ok(ids.has(id));
assert.ok(file.includes('/chem/retrieval.js'));
for(const id of ['method','conversions','mass-spec','spectrum','formulas','activity-check','sources',...Array.from({length:6},(_,i)=>`q${i+1}`),...Array.from({length:6},(_,i)=>`a${i+1}`)])assert.ok(ids.has(id));
assert.equal(tags.filter(t=>t==='h1').length,1);
assert.ok(file.includes('type="module" src="/chem/study.js"')||file.includes('src="/chem/study.js" type="module"'));
assert.ok(file.includes('noindex,nofollow,noarchive,noimageindex'));
assert.ok(!/200460190|C:[\\/]|OneDrive|AppData|codex-clipboard/.test(file),'private identifier or machine path');
assert.ok(!readFileSync('dist/sitemap-0.xml','utf8').includes('/chem/'));
console.log('CHEM: 8 unit chains, reverse round trips, invalid inputs, isotope ratios, guide anchors and publication boundary pass.');
