import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {vehicleComparison,vehicleGroups} from '../src/lib/campus-vehicle-focus.js';

const snapshot='public/data-analysis/campus-safety/current-2026-09-25';
const evidence='public/data-analysis/campus-safety/vehicle-theft-2026-09-29';
const data=JSON.parse(readFileSync(`${snapshot}/dataset.json`,'utf8'));
const audit=JSON.parse(readFileSync(`${evidence}/numeric_audit.json`,'utf8'));
const provenance=JSON.parse(readFileSync(`${evidence}/provenance.json`,'utf8'));
const original=JSON.stringify(data);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-11,label);

function csv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  assert(!quoted);const header=rows.shift();
  return rows.map(values=>Object.fromEntries(header.map((key,index)=>[key,values[index]])));
}
const numeric=value=>value===''?null:Number(value);
const records=csv(readFileSync(`${evidence}/comparison.csv`,'utf8'));
assert.equal(records.length,42);assert.equal(new Set(records.map(r=>r.unitid)).size,42);
assert.deepEqual(records.map(r=>r.unitid).sort(),data.institutions.map(i=>i.id).sort());
assert.equal(audit.result,'PASS');assert.equal(audit.checks,81);
assert.equal(provenance.institutions.length,42);
for(const input of audit.original_inputs){
  assert(/^[a-f0-9]{64}$/.test(input.sha256));
  if(input.path.startsWith('boomerrawlings.com/'))assert.equal(hash(readFileSync(input.path.slice('boomerrawlings.com/'.length))),input.sha256,input.path);
}
for(const record of records){
  const institution=data.institutions.find(i=>i.id===record.unitid);
  const annual=institution.years.find(y=>y.year===2024);
  const count=annual.counts.oncampus.motor_vehicle_theft;
  assert.equal(record.year,'2024');assert.equal(record.geography,'oncampus');
  assert.equal(record.category,'motor_vehicle_theft');
  assert.equal(numeric(record.oncampus_count),count);
  assert.equal(numeric(record.fall_enrollment),annual.enrollment);
  if(count===null)assert.equal(record.rate_per_1000,'','Missing count must remain missing in the public download');
  else near(numeric(record.rate_per_1000),count/annual.enrollment*1000,record.institution);
  const source=provenance.institutions.find(p=>p.unitid===record.unitid);
  assert.equal(Number(source.enrollment_source.fall_headcount_total),annual.enrollment);
  assert.equal(source.enrollment_source.year,'2024');
  assert.equal(source.enrollment_source.source_variable,'EFTOTLT where EFALEVEL=1');
  assert(source.enrollment_source.source_url.startsWith('https://nces.ed.gov/'));
  assert(/^[a-f0-9]{64}$/.test(source.enrollment_archive_sha256));
  for(const cell of source.source_cells){
    assert.equal(cell.report_year,'2024');assert.equal(cell.geography,'oncampus');
    assert.equal(cell.category,'motor_vehicle_theft');
    assert(cell.source_url.startsWith('https://'));assert(/^[a-f0-9]{64}$/.test(cell.source_sha256));
  }
  if(count!==null){
    assert(source.source_cells.length>0);
    assert(source.source_cells.every(c=>c.analysis_count!==''||c.analysis_status==='not_applicable_before_opening'));
    assert.equal(source.source_cells.reduce((sum,c)=>sum+(c.analysis_count===''?0:Number(c.analysis_count)),0),count);
  }
}

const expectedGroups={
  undergraduate:{total:9,available:9,rank:2,filter:r=>r.group==='uc'&&Number(r.undergraduate_enrollment)>0},
  uc:{total:10,available:10,rank:3,filter:r=>r.group==='uc'},
  all:{total:42,available:39,rank:3,filter:()=>true},
};
let comparisons=0;
for(const [group,expected] of Object.entries(expectedGroups))for(const metric of ['rate','count']){
  const view=vehicleComparison(data,group,metric);
  const independent=records.filter(expected.filter);
  assert.equal(view.total,expected.total);assert.equal(view.available,expected.available);
  assert.equal(view.rank,metric==='rate'?expected.rank:1);
  assert.deepEqual(view.rows.map(r=>r.institution.id).sort(),independent.map(r=>r.unitid).sort());
  let preceding=Infinity;let missingSeen=false;
  for(const row of view.rows){
    const record=independent.find(r=>r.unitid===row.institution.id);
    assert.equal(row.count,numeric(record.oncampus_count));
    assert.equal(row.population,Number(record.fall_enrollment));
    if(record.rate_per_1000==='')assert.equal(row.rate,null);else near(row.rate,Number(record.rate_per_1000));
    const value=row[metric];
    if(value===null)missingSeen=true;
    else{assert(!missingSeen,'Unavailable schools must remain after available schools');assert(value<=preceding);preceding=value;}
    comparisons++;
  }
  assert.equal(view.focus.count,444);assert.equal(view.focus.population,44256);near(view.focus.rate,444000/44256);
}
assert.deepEqual(vehicleComparison(data),vehicleComparison(data,'undergraduate','rate'));
assert.equal(records.find(r=>r.unitid==='110699').undergraduate_enrollment,'0','The nine-school peer definition excludes the graduate-only institution, not its higher rate');
assert.deepEqual(vehicleComparison(data,'all').rows.filter(r=>r.rate===null).map(r=>r.institution.id).sort(),['139755','199120','215062']);
assert(vehicleGroups.undergraduate.note.includes('all enrolled students'),'Undergraduate-serving does not mean undergraduate-only denominator');
assert.throws(()=>vehicleComparison(data,'unsupported'));
assert.throws(()=>vehicleComparison(data,'all','unsupported'));
const missing=structuredClone(data);missing.institutions.find(i=>i.id==='110680').years.find(y=>y.year===2024).counts.oncampus.motor_vehicle_theft=null;
assert.equal(vehicleComparison(missing).rank,null);assert.equal(vehicleComparison(missing).available,8);
const zero=structuredClone(data);zero.institutions.find(i=>i.id==='110680').years.find(y=>y.year===2024).counts.oncampus.motor_vehicle_theft=0;
assert.equal(vehicleComparison(zero).focus.rate,0);assert.equal(vehicleComparison(zero).available,9);
const noPopulation=structuredClone(data);noPopulation.institutions.find(i=>i.id==='110680').years.find(y=>y.year===2024).enrollment=null;
assert.equal(vehicleComparison(noPopulation).rank,null);assert.equal(vehicleComparison(noPopulation,'undergraduate','count').rank,1);
assert.equal(JSON.stringify(data),original,'Comparisons must not mutate scientific data');

const html=readFileSync('dist/writing/data-analysis/campus-safety/index.html','utf8');
const allNodes=[];function walk(node){allNodes.push(node);(node.childNodes??[]).forEach(walk);}walk(parse(html));
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
const byId=id=>allNodes.find(node=>attr(node,'id')===id);
for(const script of allNodes.filter(n=>n.tagName==='script')){
  const type=attr(script,'type')??'';
  if(!['application/json','application/ld+json'].includes(type))assert(attr(script,'src'),'Executable campus scripts must remain external under script-src self');
}
assert(allNodes.some(n=>n.tagName==='script'&&attr(n,'src')==='/scripts/campus-study-navigation.js'),'Citation disclosure navigation must survive bundling');
function descendants(node){const out=[];function visit(n){out.push(n);(n.childNodes??[]).forEach(visit);}visit(node);return out;}
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes??[]).map(text).join('');
const focus=byId('vehicle-theft');assert(focus,'The published opening must contain the comparison without JavaScript');
assert(allNodes.indexOf(focus)<allNodes.indexOf(byId('school-guide')),'Comparison must precede school finder');
assert(allNodes.indexOf(focus)<allNodes.indexOf(byId('campus-technical')),'Comparison must be visible before advanced disclosure');
const serverRows=byId('vehicle-bars').childNodes.filter(node=>node.tagName==='li');
assert.equal(serverRows.length,9);
const expectedDefault=vehicleComparison(data);
for(const [index,node]of serverRows.entries()){
  const nodes=descendants(node);const link=nodes.find(n=>n.tagName==='a');
  const query=new URL(attr(link,'href'),'https://boomerrawlings.com');
  const row=expectedDefault.rows[index];
  assert.equal(query.searchParams.get('school'),row.institution.id);
  assert.equal(query.searchParams.get('guideTopic'),'motor_vehicle_theft');
  assert.equal(query.searchParams.get('guidePlace'),'campus');
  assert.equal(query.searchParams.get('guideYear'),'2024');
  assert.equal(query.hash,'#reader-reading');
  assert.equal(text(nodes.find(n=>n.tagName==='strong')),row.rate.toFixed(2));
  const detail=text(nodes.find(n=>n.tagName==='p'));
  assert(detail.includes(row.count.toLocaleString('en-US')));assert(detail.includes(row.population.toLocaleString('en-US')));
  assert.equal((attr(node,'class')??'').includes('vehicle-selected'),row.institution.id==='110680');
}
assert(text(byId('vehicle-position')).includes('2nd-highest of 9'));
const focusNodes=descendants(focus);
assert.equal(focusNodes.find(n=>attr(n,'data-vehicle-group')==='undergraduate').attrs.find(a=>a.name==='aria-pressed').value,'true');
assert.equal(focusNodes.find(n=>attr(n,'data-vehicle-metric')==='rate').attrs.find(a=>a.name==='aria-pressed').value,'true');
const embedded=JSON.parse(text(byId('vehicle-data')));
assert.deepEqual(embedded.institutions.map(i=>i.id).sort(),data.institutions.map(i=>i.id).sort());
assert(embedded.institutions.every(i=>i.years.length===1&&i.years[0].year===2024));
const numericView=source=>{
  const result=vehicleComparison(source,'all');
  return {rank:result.rank,available:result.available,total:result.total,maximum:result.maximum,
    rows:result.rows.map(r=>({id:r.institution.id,count:r.count,population:r.population,rate:r.rate}))};
};
assert.deepEqual(numericView(embedded),numericView(data));
for(const filename of ['comparison.csv','numeric_audit.json','NUMERIC_AUDIT.md','provenance.json']){
  const bytes=readFileSync(`${evidence}/${filename}`);
  assert.equal(hash(readFileSync(`dist/data-analysis/campus-safety/vehicle-theft-2026-09-29/${filename}`)),hash(bytes));
  assert(!/[A-Za-z]:[\\/](?:Users|projects)|boomerrawlings@gmail\.com|api[_-]?key\s*[:=]/i.test(bytes.toString()),'Public audit contains no local machine paths, email address or credentials');
}
console.log(`Campus vehicle focus: ${comparisons} independently checked group/metric rows, 42 public source records, 39 complete counts, explicit 9/10/42-school groups, raw/rate ranks, missingness and nine-school server-rendered opening pass.`);
