import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'parse5';
import { categories,topics,sources } from '../public/brain/curriculum.js';
import { journeys,makeRound,cleanProgress } from '../public/brain/study.js';

const ids=topics.map(t=>t.id),sceneTypes=['brain','tracts','circuit','neuron','synapse','molecule','channel','plasticity'];
assert.equal(new Set(ids).size,topics.length,'Topic IDs must be unique');
assert.ok(topics.length>=48,'Full eight-scale curriculum retained');
assert.equal(categories.length,8);
assert.deepEqual(new Set(topics.map(t=>t.scene)),new Set(sceneTypes));
for(const category of categories)assert.ok(topics.filter(t=>t.category===category.id).length>=4,`${category.id} has a substantive topic set`);
for(const topic of topics){
  assert.ok(categories.some(c=>c.id===topic.category),`${topic.id}: category`);
  for(const field of ['title','subtitle','scene','scale'])assert.ok(topic[field]?.length,`${topic.id}: ${field}`);
  for(const depth of ['essentials','mechanism','advanced']){
    assert.ok(topic[depth].summary.length>=40,`${topic.id}: ${depth} summary`);
    assert.ok(topic[depth].bullets.length>=2,`${topic.id}: ${depth} supporting details`);
  }
  assert.ok(topic.connections.length>=2,`${topic.id}: cross-scale links`);
  for(const id of topic.connections)assert.ok(ids.includes(id),`${topic.id}: missing connection ${id}`);
  assert.ok(topic.sources.length,`${topic.id}: evidence required`);
  for(const id of topic.sources)assert.ok(sources[id],`${topic.id}: missing source ${id}`);
  assert.ok(topic.question.choices.length>=3&&topic.question.choices.length<=4,`${topic.id}: three or four recall choices`);
  assert.equal(new Set(topic.question.choices).size,topic.question.choices.length,`${topic.id}: distinct choices`);
  assert.ok(Number.isInteger(topic.question.answer)&&topic.question.answer>=0&&topic.question.answer<topic.question.choices.length,`${topic.id}: valid answer`);
  assert.ok(topic.question.explanation.length>=35,`${topic.id}: explanatory feedback`);
}
for(const source of Object.values(sources)){assert.ok(source.title&&source.organization);assert.equal(new URL(source.url).protocol,'https:');}
for(const journey of journeys){assert.ok(journey.ids.length>=5);for(const id of journey.ids)assert.ok(ids.includes(id),`${journey.id}: ${id}`);}
for(const size of [0,1,3,10,50]){
  const pool=ids.slice(0,size),round=makeRound(pool,10,()=>.25);
  assert.equal(round.length,Math.min(size,10));assert.equal(new Set(round).size,round.length);
  assert.deepEqual(pool,ids.slice(0,size),'Round generation preserves the source pool');
}
assert.deepEqual(cleanProgress({understood:[ids[0],ids[0],'bad'],saved:'bad',missed:[null,ids[1]],lastTopic:'bad',depth:'bogus'},ids),{understood:[ids[0]],saved:[],missed:[ids[1]],lastTopic:ids[0],depth:'essentials'});
assert.doesNotThrow(()=>cleanProgress(null,ids));
const html=readFileSync('dist/brain/index.html','utf8');
assert.ok(html.includes('noindex,nofollow,noarchive,noimageindex'));
assert.ok(html.includes('https://boomerrawlings.com/brain/'));
assert.ok(!readFileSync('dist/sitemap-0.xml','utf8').includes('/brain/'));
assert.ok(html.includes('<noscript>'),'Written guide must be available without WebGL/JS');
for(const topic of topics)assert.ok(html.includes(`data-topic="${topic.id}"`),`${topic.id}: library button`);
const doc=parse(html),htmlIds=new Set();
let h1Count=0;
function visit(node){
  const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
  if(attrs.id){assert.ok(!htmlIds.has(attrs.id),`Duplicate DOM id ${attrs.id}`);htmlIds.add(attrs.id);}
  if(node.tagName==='h1')h1Count++;
  if(node.tagName==='script')assert.ok(attrs.src||attrs.type==='application/ld+json','Executable script must be external for CSP');
  for(const child of node.childNodes||[])visit(child);
}
visit(doc);assert.equal(h1Count,1);
console.log(`Brain: ${topics.length} topics, ${Object.keys(sources).length} references, ${journeys.length} journeys; content, recall, persistence and publication checks pass.`);
