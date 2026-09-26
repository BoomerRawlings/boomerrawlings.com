import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readerResult} from '../src/lib/campus-reader.js';
import {regionCopy,topicCopy,placeCopy,periodCopy} from '../src/data/campus-reader-copy.js';
const data=JSON.parse(readFileSync('public/data-analysis/campus-safety/current-2026-09-25/dataset.json','utf8'));
const context=JSON.parse(readFileSync('src/data/campus-school-context.json','utf8'));
const evidence=JSON.parse(readFileSync('src/data/campus-resident-evidence.json','utf8')).observations;
const frozenData=JSON.stringify(data);
assert(evidence.length>0,'Qualified evidence must not be silently omitted');
for(const e of evidence){
 assert(data.institutions.some(i=>i.id===String(e.unitid)),'Evidence belongs to this cohort');
 assert(Array.isArray(e.years)&&e.years.length>0&&e.years.every(y=>Number.isInteger(y)&&y>=2022&&y<=2025));
 assert(['partial','approximate','unresolved'].includes(e.status));
 assert(e.period_label&&e.statement&&e.reason_no_rate&&e.source_title&&e.source_page);
 assert(/^https:\/\//.test(e.source_url));
 assert(/^[a-f0-9]{64}$/.test(e.source_sha256));
 assert(e.value===null||(Number.isFinite(e.value)&&e.value>=0));
 assert.equal(e.eligible_for_rate,false,'Qualified observations must be explicitly ineligible as denominators');
}
assert.deepEqual(Object.keys(context).sort(),data.institutions.map(i=>i.id).sort());
assert.equal(Object.keys(topicCopy).length,15);
assert.equal(new Set(Object.values(context).map(c=>c.note)).size,42);
let checked=0;
for(const school of data.institutions){
 assert(regionCopy[context[school.id].region]);assert(context[school.id].note.length>60);assert(context[school.id].sources.some(s=>s.url.startsWith('https://')));
 for(const row of school.years)for(const measure of ['residents','enrollment']){
  const provenance=row.populationSources?.[measure];
  if(row[measure]!==null&&row[measure]!==undefined){
   assert(provenance?.period_label&&provenance?.source_url,'Displayed populations require dated source metadata');
   assert.equal(Number(provenance.value),row[measure],'Displayed provenance must describe the population actually used');
  }
 }
 for(const category of Object.keys(topicCopy))for(const period of Object.keys(periodCopy))for(const place of Object.keys(placeCopy)){
  const r=readerResult(school,{category,period,place},evidence);
  const withoutEvidence=readerResult(school,{category,period,place});
  assert.deepEqual([r.count,r.population,r.rate],[withoutEvidence.count,withoutEvidence.population,withoutEvidence.rate],
    'Qualified evidence must never supply or change a numerator, denominator or rate');
  const selectedYears=period==='pooled'?[2022,2023,2024]:[Number(period)];
  assert.deepEqual(r.residentEvidence,place==='housing'?evidence.filter(e=>String(e.unitid)===school.id&&e.years.some(y=>selectedYears.includes(y))):[],
    'Evidence must match both school and selected period; it does not apply to enrollment/all-area views');
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
  if(period==='2025'&&expectedPop===null)assert.equal(r.rate,null);
  assert.deepEqual(r.populationSources,place==='combined'?[]:years.map(y=>y.populationSources?.[place==='housing'?'residents':'enrollment']).filter(Boolean));
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
const yale=data.institutions.find(i=>i.officialName==='Yale University');
const stanford=data.institutions.find(i=>i.officialName==='Stanford University');
assert.equal(yale.years.find(y=>y.year===2025).residents,6082);
assert.equal(readerResult(yale,{period:'2025'},evidence).population,6082);
assert.equal(readerResult(yale,{period:'2025'},evidence).rate,null,'A 2025 population does not establish a 2025 crime rate');
assert.equal(stanford.years.find(y=>y.year===2023).residents,14137);
assert.equal(data.institutions.filter(i=>readerResult(i).rate!==null).length,14);
const probe={unitid:s.id,years:[2023],value:999999,status:'partial'};
assert.equal(readerResult(s,{period:'2024'},[probe]).residentEvidence.length,0,'Prior-year evidence must not backfill current year');
assert.equal(readerResult(s,{period:'2023'},[probe]).residentEvidence.length,1);
assert.equal(readerResult(s,{period:'pooled'},[probe]).residentEvidence.length,1);
assert.equal(readerResult(s,{period:'2023',place:'campus'},[probe]).residentEvidence.length,0);
assert.equal(JSON.stringify(data),frozenData,'Rendering qualified evidence must not mutate scientific data');
console.log(`Campus reader: ${checked} school/category/year/location explanations and independent counts/populations/rates checked; ${evidence.length} qualified observations isolated by school/year without changing rates; 42 bespoke notes, source provenance, 2025 withholding and SDSU geography pass.`);
