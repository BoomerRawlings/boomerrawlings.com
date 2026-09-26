import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readerResult} from '../src/lib/campus-reader.js';
import {regionCopy,topicCopy,placeCopy,periodCopy} from '../src/data/campus-reader-copy.js';
const data=JSON.parse(readFileSync('public/data-analysis/campus-safety/current-2026-09-25/dataset.json','utf8'));
const context=JSON.parse(readFileSync('src/data/campus-school-context.json','utf8'));
assert.deepEqual(Object.keys(context).sort(),data.institutions.map(i=>i.id).sort());
assert.equal(Object.keys(topicCopy).length,15);
assert.equal(new Set(Object.values(context).map(c=>c.note)).size,42);
let checked=0;
for(const school of data.institutions){
 assert(regionCopy[context[school.id].region]);assert(context[school.id].note.length>60);assert(context[school.id].sources.some(s=>s.url.startsWith('https://')));
 for(const category of Object.keys(topicCopy))for(const period of Object.keys(periodCopy))for(const place of Object.keys(placeCopy)){
  const r=readerResult(school,{category,period,place});
  const years=(period==='pooled'?[2022,2023,2024]:[Number(period)]).map(y=>school.years.find(row=>row.year===y));
  const geos=place==='combined'?['oncampus','noncampus','publicproperty']:[place==='housing'?'residential':'oncampus'];
  const counts=years.flatMap(row=>geos.map(g=>row?.counts[g]?.[category]));
  const expectedCount=counts.every(v=>Number.isInteger(v)&&v>=0)?counts.reduce((a,b)=>a+b,0):null;
  assert.equal(r.count,expectedCount);
  const pops=years.map(row=>row?.[place==='housing'?'residents':'enrollment']);
  const expectedPop=place!=='combined'&&pops.every(p=>Number.isFinite(p)&&p>0)?pops.reduce((a,b)=>a+b,0):null;
  assert.equal(r.population,expectedPop);if(expectedCount!==null&&expectedPop!==null)assert(Math.abs(r.rate-expectedCount/expectedPop*1000)<1e-12);else assert.equal(r.rate,null);
  assert(r.headline.length>20&&r.interpretation.length>60&&r.timeExplanation.length>60);
  if(r.count===null)assert(r.headline.includes('unavailable'));
  if(period==='2025')assert.equal(r.rate,null);
  if(place==='combined'&&period==='pooled')assert(r.timeExplanation.includes('three-year count'));
  assert(!/NaN|undefined|\[object Object\]/.test([r.headline,r.interpretation,r.timeExplanation,r.editions.join(',')].join(' ')));
  checked++;
 }
}
const s=data.institutions.find(i=>i.id==='122409');
assert.equal(readerResult(s,{category:'rape',period:'2024',place:'housing'}).count,1);
assert.equal(readerResult(s,{category:'rape',period:'2024',place:'combined'}).count,3);
assert.equal(readerResult(s,{category:'rape',period:'2025',place:'combined'}).count,16);
assert.equal(readerResult(s,{category:'rape',period:'pooled',place:'housing'}).count,18);
assert.throws(()=>readerResult(s,{category:'unsupported'}));
console.log(`Campus reader: ${checked} school/category/year/location explanations and independent counts/populations/rates checked; 42 bespoke notes, region membership, withheld values and SDSU geography pass.`);
