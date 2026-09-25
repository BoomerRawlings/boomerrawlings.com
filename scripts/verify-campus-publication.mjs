import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {summarize,selectedRows,csvText} from '../src/lib/campus-rates.js';

const base=resolve('dist/data-analysis/campus-safety');
const read=name=>readFileSync(resolve(base,'data',name),'utf8');
const data=JSON.parse(read('dataset.json'));
function csv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  assert(!quoted,'Unterminated CSV quote');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const fields=rows.shift();return rows.map(values=>Object.fromEntries(fields.map((field,i)=>[field,values[i]])));
}

assert.equal(data.institutions.length,42);
assert.equal(new Set(data.institutions.map(i=>i.id)).size,42);
assert.equal(data.institutions.reduce((sum,i)=>sum+i.branchCount,0),212);
assert.deepEqual(data.years,[2022,2023,2024]);
assert.equal(data.categories.length,15);
assert.equal(data.institutions.filter(i=>i.years.every(y=>y.residents>0)).length,11);
assert.equal(selectedRows(data).filter(r=>r.rate!==null).length,42);
assert.equal(selectedRows(data,{period:'pooled'}).filter(r=>r.rate!==null).length,36);
assert.equal(selectedRows(data,{measure:'residents',category:'rape'}).filter(r=>r.rate!==null).length,11);
assert.equal(selectedRows(data,{group:'ivy'}).length,8);
assert.equal(selectedRows(data,{group:'uc'}).length,10);
assert.equal(selectedRows(data,{search:'UCSD'})[0].institution.id,'110680');
assert.equal(selectedRows(data,{search:'zzzz-no-institution'}).length,0);

let verified=0;
for(const file of ['annual_rates.csv','pooled_rates.csv'])for(const row of csv(read(file))){
  const institution=data.institutions.find(i=>i.id===row.unitid);
  const actual=summarize(institution,row.category,row.period,row.measure);
  assert.equal(actual.count,row.reported_count===''?null:Number(row.reported_count));
  assert.equal(actual.population,row.population_sum===''?null:Number(row.population_sum));
  assert.equal(actual.years,Number(row.years));
  if(row.rate_per_1000==='')assert.equal(actual.rate,null);
  else {
    assert(Math.abs(actual.rate-Number(row.rate_per_1000))<1e-12,`${row.unitid}/${row.period}/${row.measure}/${row.category}`);
    assert(Math.abs(summarize(institution,row.category,row.period,row.measure,10000).rate-10*actual.rate)<1e-10);
  }
  verified++;
}
assert.equal(verified,7560);

// Deliberately unequal denominators distinguish pooling from an unweighted mean.
const fixture={years:[2022,2023,2024].map((year,i)=>({year,enrollment:[100,1000,100][i],counts:{oncampus:{rape:[1,10,9][i]}}}))};
assert.equal(summarize(fixture,'rape','pooled').rate,1000*20/1200);
const missing=structuredClone(fixture);missing.years[1].enrollment=null;
assert.equal(summarize(missing,'rape','pooled').rate,null);
assert.equal(summarize(missing,'rape','pooled').count,20);
missing.years[1].enrollment=1000;missing.years[1].counts.oncampus.rape=null;
assert.equal(summarize(missing,'rape','pooled').rate,null);
fixture.years[2].counts.oncampus.rape=0;
assert.equal(summarize(fixture,'rape','2024').rate,0);
assert.equal(csvText([['Name','Count'],['University, "Test"',0],['Missing',null]]),'Name,Count\r\n"University, ""Test""",0\r\nMissing,\r\n');

const criminals=data.categories.filter(c=>c.family==='criminal_offenses'&&c.id!=='criminal_total');
assert.equal(criminals.length,11);
for(const inst of data.institutions)for(const year of inst.years)for(const geo of ['oncampus','residential']){
  const values=criminals.map(c=>year.counts[geo][c.id]);
  assert.equal(year.counts[geo].criminal_total,values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0));
  for(const c of data.categories){const a=year.counts.oncampus[c.id],b=year.counts.residential[c.id];if(a!==null&&b!==null)assert(b<=a,'Housing exceeds parent geography');}
}

const manifest=JSON.parse(read('artifact_manifest.json'));
for(const [relative,entry] of Object.entries(manifest)){
  const path=resolve(base,relative);assert(path.startsWith(base+sep),'Manifest path escaped publication');
  assert(existsSync(path),`Missing artifact: ${relative}`);const bytes=readFileSync(path);
  assert.equal(bytes.length,entry.bytes,relative);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,relative);
  if(relative.endsWith('.md')){const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);assert(!text.includes('\ufffd'),`Replacement glyph in ${relative}`);}
}
assert(JSON.parse(read('INDEPENDENT_NUMERICAL_AUDIT.json')).pass);
assert.equal(JSON.parse(read('sources/clery/publication_raw_audit.json')).status,'PASS');
const html=readFileSync('dist/writing/data-analysis/campus-safety/index.html','utf8');
assert.equal((html.match(/<math[\s>]/g)||[]).length,7,'All inline/display formulas retain MathML');
assert.equal((html.match(/class="katex-display"/g)||[]).length,2);
assert(!html.includes('katex-error'));
assert(html.includes('Housing-property boundaries')||html.includes('property boundaries'));
assert(html.includes('not externally peer reviewed'));
assert(html.includes('<noscript>'));
assert(readFileSync('dist/writing/data-analysis/index.html','utf8').includes('/writing/data-analysis/campus-safety/'));
console.log(`Campus publication: ${verified} rates agree across Python and browser calculations; missingness, pooling, categories, ${Object.keys(manifest).length} artifact hashes and 7 mathematical expressions pass.`);
