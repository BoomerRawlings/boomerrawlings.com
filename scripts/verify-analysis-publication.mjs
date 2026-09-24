import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {summarizeDaily,summarizeCategoryDaily} from '../src/lib/analysis-data.mjs';
const base='dist/data-analysis/crime-and-heat';
const read=(name)=>JSON.parse(readFileSync(join(base,'data',name),'utf8'));
const manifest=JSON.parse(readFileSync(join(base,'publication_manifest.json'),'utf8'));
for(const [relative,entry] of Object.entries(manifest)){
  const bytes=readFileSync(join(base,relative));
  assert.equal(bytes.length,entry.bytes,`Artifact size ${relative}`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,`Artifact hash ${relative}`);
}
const summary=read('summary.json'), panel=read('daily.json'), aggregates=read('aggregates.json');
const general=read('crime_model_results.json'),categories=read('categories_summary.json');
const categoryPanel=read('category_daily.json'),categoryAggregates=read('category_aggregates.json');
const result=summarizeDaily(panel);
assert.equal(result.totalCount,summary.primary_period.eligible_core_ids);
assert.equal(result.zipDays,163632);
assert.equal(result.dateDays,1461);
assert.equal(result.bins.reduce((n,b)=>n+b.count,0),6637);
assert.equal(result.bins.reduce((n,b)=>n+b.zipDays,0),163632);
for(const name of ['by_year','by_city','by_month','by_weekday','by_hour','by_command','by_area','by_race','by_subtype','by_zip']){
  const table=aggregates.tables[name];
  for(const [col,total] of [['all_source_ids',136313],['core_dv_source_ids',12478],['broad_dv_source_ids',15161]]){
    assert.equal(table.rows.reduce((sum,row)=>sum+row[table.columns.indexOf(col)],0),total,`${name} ${col}`);
  }
}
assert.equal(summary.models.length,12);
const primary=summary.models.find(m=>m.primary);
assert(primary.ci95_low<1 && primary.ci95_high>1);
assert(summary.models.filter(m=>!m.primary).every(m=>m.p_holm_secondary_family>=0.05));
assert.equal(general.models.length,6);
const generalPrimary=general.models.find(m=>m.primary);
assert.equal(generalPrimary.event_count,58770);
assert.equal(generalPrimary.n_zips,106);
assert.equal(generalPrimary.n_locality_days,154866);
assert(generalPrimary.ci95_low<1 && generalPrimary.ci95_high>1);
assert(general.models.filter(m=>!m.primary).every(m=>m.p_holm_general_family===1));
for(const category of categories.categories){
  const actual=summarizeCategoryDaily(panel,categoryPanel,{category:category.id,startYear:2021,endYear:2024});
  assert.equal(actual.totalCount,categories.primary_weather_eligible_totals[category.id],`${category.id} eligible total`);
  assert.equal(actual.zipDays,163632);
  assert.equal(actual.dateDays,1461);
  assert.equal(actual.bins.reduce((n,b)=>n+b.count,0),actual.totalCount);
  assert.equal(actual.bins.reduce((n,b)=>n+b.zipDays,0),163632);
  for(const name of ['by_year','by_month','by_city','by_command','by_area','by_zip','by_race','by_subtype']){
    const table=categoryAggregates.tables[name];
    assert.equal(table.rows.reduce((sum,row)=>sum+row[table.columns.indexOf(category.id)],0),categories.all_source_totals[category.id],`${name} ${category.id}`);
  }
}
assert.deepEqual(summarizeCategoryDaily(panel,categoryPanel,{category:'core'}),result);
assert(!JSON.stringify(summary).match(/prespecified|predeclared/i),'Retrospective study must not imply registration');
const html=readFileSync(join(base,'index.html'),'utf8');
for(const required of ['Incident Date_Time','Arrest Date/Time','513','67 primary core-DV','2025','Holm','Newey','STROBE','crime_model_results.csv','source_records_audit.json','category_mapping.csv','58,770','−0.05%','nonexclusive']) assert(html.includes(required),`Missing essential method/attribution: ${required}`);
assert(!html.includes('data-pip-guide'));
assert(html.includes('<noscript>'));
assert(html.includes('katex-display'),'Model equation must be typeset at build time');
assert((html.match(/<math\b/g)||[]).length>=14,'Inline notation must retain accessible MathML');
assert(!html.includes('katex-error'),'Malformed equations must not reach publication');
assert(!html.includes('Y<sub>zd</sub>'),'Old improvised model notation must be removed');
assert(existsSync('dist/data-analysis/index.html'));
assert(readFileSync('dist/all/index.html','utf8').includes('/data-analysis/crime-and-heat/'));
const pdf=readFileSync(join(base,'downloads/domestic-violence-and-heat-report.pdf'));
assert.equal(pdf.subarray(0,5).toString(),'%PDF-'); assert(pdf.length>50000);
assert.equal(createHash('sha256').update(pdf).digest('hex'),'babe621e7f08aea6d949f3d2f760998e6a4f382af3db2ede0f20da1d16cc3832');
for(const name of ['aggregate_downloads.zip','audit-and-reproducibility.zip','general-analysis-and-audit.zip','data_dictionary.md','source_records_audit.json','charge_classification_map.csv','category_mapping.csv']) assert(existsSync(join(base,'data',name)),`Missing publication file ${name}`);
for(const match of html.matchAll(/href="(\/data-analysis\/crime-and-heat\/[^"#]+)"/g)){
  assert(existsSync(join('dist',decodeURIComponent(match[1]))),`Broken research download: ${match[1]}`);
}
for(const name of readdirSync(join(base,'data','downloads'))){
  if(!name.endsWith('.csv'))continue;
  const head=readFileSync(join(base,'data','downloads',name),'utf8').split('\n')[0];
  assert(!/(?:^|,)(?:event_key|source_id|source_csv_row|recorded_datetime|Street Name|100 Block)(?:,|\r?$)/.test(head),`Individual record fields in ${name}`);
}
console.log('Research publication verified: reconciled counts, zero-inclusive denominators, model scope, source citations, aggregate-only downloads, and PDF.');
