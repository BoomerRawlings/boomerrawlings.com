import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {summarize,selectedRows,initialView} from '../src/lib/campus-rates.js';
const base=resolve('dist/data-analysis/campus-safety/current-2026-09-25');
const read=name=>readFileSync(resolve(base,name),'utf8');
const data=JSON.parse(read('dataset.json')),geo=JSON.parse(read('geography.json')),inventory=JSON.parse(read('source_inventory.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');
function csv(text){let rows=[],row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}assert(!quoted);const fields=rows.shift();return rows.map(r=>Object.fromEntries(fields.map((k,i)=>[k,r[i]])));}
const expected=csv(read('rates.csv'));assert.equal(expected.length,9450);
for(const row of expected){const actual=summarize(data.institutions.find(i=>i.id===row.unitid),row.category,row.period,row.measure,1000);assert.equal(actual.count,row.reported_count===''?null:Number(row.reported_count));assert.equal(actual.population,row.population_sum===''?null:Number(row.population_sum));assert.equal(actual.years,Number(row.years));if(row.rate_per_1000==='')assert.equal(actual.rate,null);else assert(Math.abs(actual.rate-Number(row.rate_per_1000))<1e-12);}
assert.equal(data.institutions.length,42);assert.equal(inventory.length,42);assert.deepEqual(data.years,[2022,2023,2024,2025]);
assert.equal(selectedRows(data,initialView).length,14);assert.equal(selectedRows(data,initialView).filter(r=>r.rate!==null).length,14);
for(const i of data.institutions){const y=i.years.find(y=>y.year===2025);assert.equal(y.residents,({'243744':14042,'130794':6082})[i.id]??null);assert.equal(y.enrollment,null);assert.equal(summarize(i,'criminal_total','2025','residents',1000).rate,null);}
const populationLedger=csv(read('population_sources.csv'));
for(const [id,year,value] of [['243744',2023,14137],['243744',2024,14203],['243744',2025,14042],['211440',2022,3458],['211440',2023,3764],['211440',2024,3988],['130794',2022,6255],['130794',2023,6064],['130794',2024,6011],['130794',2025,6082]]){
 const y=data.institutions.find(i=>i.id===id).years.find(y=>y.year===year);
 assert.equal(y.residents,value);assert(y.populationSources.residents.period_label);assert(y.populationSources.residents.scope_note);
 assert.equal(populationLedger.find(p=>p.unitid===id&&Number(p.year)===year&&p.measure==='residents').value,String(value));
}
for(const id of ['445188','166027','162928','234076'])assert(data.institutions.find(i=>i.id===id).years.some(y=>Number.isInteger(y.counts.oncampus.rape)));
assert.equal(summarize(data.institutions.find(i=>i.id==='445188'),'criminal_total','2024','residents',1000).count,14);
assert(data.institutions.find(i=>i.id==='166027').years.every(y=>y.counts.residential.criminal_total===null),'Omitted Harvard branch housing cells must remain unknown.');
assert(data.institutions.find(i=>i.id==='228778').years.every(y=>y.residents===null),'Mixed-scope Texas resident figures must not become student counts.');
assert(csv(read('superseded_source_cells.csv')).length>0,'Replaced report cells retain their provenance.');
for(const [year,h,c,n,p,total] of [[2023,8,11,2,0,13],[2024,1,1,2,0,3],[2025,10,11,5,0,16]]){
 const rows=geo.cells.filter(r=>r.campus_id==='122409001'&&r.category==='rape'&&r.year===year);
 for(const [g,v] of [['housing',h],['on_campus',c],['noncampus',n],['public_property',p]])assert.equal(rows.find(r=>r.geography===g).count,v);
 assert.equal(c+n+p,total);assert(h<=c);
}
const cases=JSON.parse(read('case_study.json'));const s=cases.find(r=>r.unitid==='122409'&&r.period==='pooled');assert.equal(s.asr_housing_rape_count,18);assert.equal(s.fall_occupancy_sum,24386);assert.equal(s.rate_per_1000,18000/24386);
for(const c of geo.cells){if(c.status.startsWith('not_applicable'))assert.equal(c.count,null);if(c.status==='reported_numeric'||c.status==='reported_zero_narrative')assert(Number.isInteger(c.count)&&c.count>=0);}
const manifest=JSON.parse(read('artifact_manifest.json'));for(const [rel,expected]of Object.entries(manifest)){const p=resolve(base,rel);assert(p.startsWith(base+sep));const bytes=readFileSync(p);assert.equal(bytes.length,expected.bytes,rel);assert.equal(hash(bytes),expected.sha256,rel);}
const html=readFileSync('dist/writing/data-analysis/campus-safety/index.html','utf8');assert(html.includes('campus-source'));assert(html.includes('report-geography'));assert(html.includes('1 + 2 + 0 = 3'));assert(html.includes('0.74'));assert(!html.includes('katex-error'));
assert.equal((html.match(/<math[\s>]/g)||[]).length,7);
const period=html.match(/<select id="campus-period">([\s\S]*?)<\/select>/)[1];assert.deepEqual([...period.matchAll(/value="([^"]+)"/g)].map(m=>m[1]),['2022','2023','2024','2025','pooled']);
const crime=JSON.parse(readFileSync('dist/data-analysis/crime-and-heat/data/freshness-2026-09-25/sdpd_nibrs_2026_daily.json','utf8'));
assert(crime,'Refreshed aggregate is readable.');
console.log(`Current campus publication: ${expected.length} cross-runtime rates; 42 sources, 14 resident rates, ten dated additions and qualified exclusions, exact SDSU geography/revision, ${Object.keys(manifest).length} artifact hashes and seven formulas verified.`);
