import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {summarizeDaily,summarizeCategoryDaily} from '../src/lib/analysis-data.mjs';

const base='dist/data-analysis/crime-and-heat';
const read=(name)=>JSON.parse(readFileSync(join(base,'data',name),'utf8'));
const hash=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const close=(actual,expected,label,tolerance=1e-11)=>{
  assert(Number.isFinite(actual)&&Number.isFinite(expected),`${label}: finite numbers required`);
  assert(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} != ${expected}`);
};
const manifest=JSON.parse(readFileSync(join(base,'publication_manifest.json'),'utf8'));
for(const [relative,entry] of Object.entries(manifest)){
  const filename=resolve(base,relative);
  assert(filename.startsWith(resolve(base)+sep),`Artifact outside publication: ${relative}`);
  const bytes=readFileSync(filename);
  assert.equal(bytes.length,entry.bytes,`Artifact size ${relative}`);
  assert.equal(hash(bytes),entry.sha256,`Artifact hash ${relative}`);
  if(relative.endsWith('.pdf'))assert.equal(bytes.subarray(0,5).toString(),'%PDF-',`PDF header ${relative}`);
}

// The released full-sample inputs and results remain frozen beside the revision.
for(const [filename,expected] of Object.entries({
  'daily.json':'f17d0672bd14fa9445c2e5b4f1905479fa937ec18597806121f1e25a42966b3d',
  'category_daily.json':'76df7f09374e14477dc181291e82b0fe9230f297c650e496d2a6359b6377ad19',
  'crime_model_results.json':'a5ae737324d7cf0a830f9505cf9c6e24eefd26e60a5b1430081ec20db1469497',
  'summary.json':'07c3e1229ac4c56f3786c7eacd7c2f109a6449875f5e9d09bf7434375ad2fced',
}))assert.equal(hash(readFileSync(join(base,'data',filename))),expected,`Archived original changed: ${filename}`);
const summary=read('summary.json'),panel=read('daily.json'),aggregates=read('aggregates.json');
const general=read('crime_model_results.json'),categories=read('categories_summary.json');
const categoryPanel=read('category_daily.json'),categoryAggregates=read('category_aggregates.json');
assert.equal(panel.zips.length,112);
const result=summarizeDaily(panel);
assert.equal(result.totalCount,summary.primary_period.eligible_core_ids);
assert.equal(result.totalCount,6637);
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
assert.equal(general.models.length,6);
const primary=summary.models.find(m=>m.primary),generalPrimary=general.models.find(m=>m.primary);
assert.deepEqual([primary.event_count,primary.n_zips,primary.n_locality_days],[6637,95,138795]);
assert.deepEqual([generalPrimary.event_count,generalPrimary.n_zips,generalPrimary.n_locality_days],[58770,106,154866]);
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

const revision=read('revision-2/revision_results.json'),metadata=read('revision-2/panel_metadata.json');
assert.equal(revision.complete_battery,true);
assert.equal(revision.models.length,22);
assert.equal(revision.tests.length,24);
assert.deepEqual(metadata.period,['2021-01-01','2024-12-31']);
assert.deepEqual([metadata.zips,metadata.rows,metadata.calendar_days,metadata.original_all,metadata.original_core],[64,93504,1461,57903,6501]);
assert.equal(metadata.full_sample_original_core-metadata.full_sample_strict_core,67);
assert.deepEqual(revision.panel_metadata,metadata);
const specs=['R00','R0','R1','R2','R3','R4','R5','R6','R7','R8','R9'];
const expectedTests=['all','core'].flatMap(outcome=>specs.flatMap(spec=>spec==='R6'
  ? [`${outcome}_${spec}_joint_temperature`,`${outcome}_${spec}_nonlinearity`]
  : [`${outcome}_${spec}`]));
assert.deepEqual(revision.tests.map(test=>test.test_id).sort(),expectedTests.sort());
const registeredTests=new Map(revision.tests.map(test=>[test.test_id,test]));
let precedingHolm=0;
for(const [index,test] of [...revision.tests].sort((a,b)=>a.p_raw-b.p_raw).entries()){
  assert(Number.isFinite(test.p_raw)&&test.p_raw>=0&&test.p_raw<=1,`Valid raw p: ${test.test_id}`);
  precedingHolm=Math.max(precedingHolm,Math.min(1,(revision.tests.length-index)*test.p_raw));
  close(test.p_holm_revision_family,precedingHolm,`Independent Holm correction: ${test.test_id}`,1e-12);
}
const modelFor=(outcome,spec)=>{
  const matches=revision.models.filter(model=>model.outcome===outcome&&model.specification===spec);
  assert.equal(matches.length,1,`Exactly one model ${outcome}/${spec}`);
  return matches[0];
};
for(const outcome of ['all','core']){
  for(const spec of specs){
    const model=modelFor(outcome,spec),label=`${outcome}/${spec}`;
    assert.equal(model.status,'ok',label);
    for(const key of ['event_count','zips','zip_days'])assert(Number.isInteger(model[key])&&model[key]>0,`${label} ${key}`);
    assert.equal(model.calendar_span_days,1461,label);
    assert.equal(model.hypothesis_tests.length,spec==='R6'?2:1,label);
    for(const test of model.hypothesis_tests){
      assert.equal(test.outcome,outcome);assert.equal(test.specification,spec);
      assert.deepEqual(test,registeredTests.get(test.test_id),`Model/global test agreement ${test.test_id}`);
    }
    if(spec==='R6'){
      assert.equal(model.count_ratio,undefined,'No single per-10F ratio for nonlinear R6');
      close(model.joint_temperature_p,registeredTests.get(`${outcome}_R6_joint_temperature`).p_raw,`${label} joint p`);
      close(model.nonlinearity_p,registeredTests.get(`${outcome}_R6_nonlinearity`).p_raw,`${label} nonlinear p`);
    }else{
      assert(model.standard_error>0,`${label} positive SE`);
      close(model.count_ratio,Math.exp(model.coefficient_log_count),`${label} exponentiated coefficient`);
      close(model.ci95_low,Math.exp(model.coefficient_log_count-1.959963984540054*model.standard_error),`${label} lower CI`);
      close(model.ci95_high,Math.exp(model.coefficient_log_count+1.959963984540054*model.standard_error),`${label} upper CI`);
      close(model.percent_change,100*(model.count_ratio-1),`${label} percent`);
      close(model.two_sided_p,registeredTests.get(`${outcome}_${spec}`).p_raw,`${label} registered p`);
    }
  }
  for(const key of ['sample_sha256','event_count','zips','zip_days'])assert.equal(modelFor(outcome,'R00')[key],modelFor(outcome,'R0')[key],`${outcome} weather comparison same ${key}`);
  assert.equal(modelFor(outcome,'R7').sample_sha256,modelFor(outcome,'R8').sample_sha256,`${outcome} station comparison same rows`);
}
assert.deepEqual(['event_count','zips','zip_days'].map(key=>modelFor('all','R0')[key]),[57903,64,93504]);
assert.deepEqual(['event_count','zips','zip_days'].map(key=>modelFor('core','R0')[key]),[6501,63,92043]);

const civilPanel=read('revision-2/daily.json'),civilCategories=read('revision-2/category_daily.json');
assert.equal(civilPanel.schema_version,'1.0.0');
assert.equal(civilPanel.timezone,'America/Los_Angeles');
assert.equal(civilPanel.zips.length,64);
assert.equal(new Set(civilPanel.zips).size,64);
assert.equal(civilPanel.dates.length,2741);
assert.deepEqual(civilPanel.dates,panel.dates);
assert.deepEqual(civilCategories.dates,civilPanel.dates);
assert.deepEqual(civilCategories.zips,civilPanel.zips);
assert.deepEqual(civilCategories.columns,categoryPanel.columns);
assert.equal(civilPanel.day_hours_by_date.length,civilPanel.dates.length);
const dayLengths=(primaryOnly)=>civilPanel.day_hours_by_date.reduce((counts,hours,i)=>{
  if(primaryOnly&&(civilPanel.dates[i]<'2021-01-01'||civilPanel.dates[i]>'2024-12-31'))return counts;
  assert([23,24,25].includes(hours));counts[hours]=(counts[hours]??0)+1;return counts;
},{});
assert.deepEqual(dayLengths(false),{23:7,24:2726,25:8});
assert.deepEqual(dayLengths(true),{23:4,24:1453,25:4});
for(const [category,count] of [['all',57903],['core',6501]]){
  const actual=summarizeCategoryDaily(civilPanel,civilCategories,{category,startYear:2021,endYear:2024});
  assert.deepEqual([actual.totalCount,actual.zipDays,actual.dateDays,actual.zipCount],[count,93504,1461,64]);
  assert.equal(actual.bins.reduce((n,bin)=>n+bin.count,0),count);
  assert.equal(actual.bins.reduce((n,bin)=>n+bin.zipDays,0),93504);
}
// Restricting geography and replacing weather must not change outcome counts.
const days=panel.dates.length;
for(const [zipIndex,zip] of civilPanel.zips.entries()){
  const oldIndex=panel.zips.indexOf(zip);assert(oldIndex>=0,`Revision ZIP in original universe: ${zip}`);
  for(let column=0;column<categoryPanel.data.length;column++){
    assert.deepEqual(civilCategories.data[column].slice(zipIndex*days,(zipIndex+1)*days),categoryPanel.data[column].slice(oldIndex*days,(oldIndex+1)*days),`Unchanged category ${column} for ${zip}`);
  }
}

const html=readFileSync('dist/writing/data-analysis/crime-and-heat/index.html','utf8');
const plain=(source)=>source.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const text=plain(html);
for(const required of ['Incident Date_Time','Arrest Date/Time','2025','Holm','Newey','STROBE','58,770','6,637','57,903','6,501'])assert(text.includes(required),`Missing essential method/cohort: ${required}`);
for(const term of [/warrant/i,/co[- ]charge/i,/humidity/i,/precipitation|rainfall/i,/nonexclusive|overlap/i,/retrospective|not preregistered/i])assert(term.test(text),`Missing revised methods: ${term}`);
const revisionSection=html.match(/<section\b[^>]*\bid="revision-estimates"[^>]*>[\s\S]*?<\/section>/)?.[0];
assert(revisionSection,'Visible revision results section');
for(const required of ['Full original reference','R00','R0','Joint:','Nonlinearity:','NUMERICAL_AMENDMENT.md'])assert(revisionSection.includes(required),`Revision section missing ${required}`);
const comparisonTable=revisionSection.match(/<table\b[^>]*class="analysis-revision-comparison"[^>]*>[\s\S]*?<\/table>/)?.[0];
assert(comparisonTable,'Visible same-period three-way comparison');
const rows=[...comparisonTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(match=>plain(match[1]));
const pvalue=(value)=>value<0.00001?'&lt;0.00001':value.toFixed(5);
for(const [outcome,label,original] of [['all','All eligible records',generalPrimary],['core','Core domestic violence',primary]]){
  for(const [rowLabel,model] of [['Full original reference',original],['(R00)',modelFor(outcome,'R00')],['(R0)',modelFor(outcome,'R0')]]){
    const matches=rows.filter(row=>row.includes(label)&&row.includes(rowLabel));
    assert.equal(matches.length,1,`One visible comparison ${outcome}/${rowLabel}`);
    for(const value of [(model.count_ratio??model.rate_ratio).toFixed(5),model.ci95_low.toFixed(5),model.ci95_high.toFixed(5),pvalue(model.two_sided_p),model.event_count.toLocaleString('en-US'),(model.zips??model.n_zips).toLocaleString('en-US')])assert(matches[0].includes(value),`Visible ${outcome}/${rowLabel} estimate ${value}`);
  }
}
assert(!/\bNaN\b|\bundefined\b/.test(revisionSection),'No invalid revision render states');
assert(!html.includes('data-pip-guide'));
assert(html.includes('<noscript>'));
assert(html.includes('katex-display'),'Model equation must be typeset at build time');
const mathCount=(html.match(/<math\b/g)||[]).length;
assert(mathCount>0,'Accessible MathML required');
assert.equal(mathCount,(html.match(/class="katex"/g)||[]).length,'Each typeset expression retains MathML');
assert(!html.includes('katex-error'),'Malformed equations must not reach publication');
assert(!html.includes('Y<sub>zd</sub>'),'Old improvised model notation must be removed');
assert(existsSync('dist/writing/data-analysis/index.html'));
assert(readFileSync('dist/all/index.html','utf8').includes('/writing/data-analysis/crime-and-heat/'));
const writing=readFileSync('dist/writing/index.html','utf8');
assert(writing.includes('/writing/data-analysis/'));
assert(writing.includes('/writing/data-analysis/crime-and-heat/'));
assert(readFileSync(join(base,'index.html'),'utf8').includes('/writing/data-analysis/crime-and-heat/'));

const archivePdf='downloads/domestic-violence-and-heat-original-2026-09-24.pdf';
const currentPdf='downloads/domestic-violence-and-heat-report.pdf';
for(const filename of [archivePdf,currentPdf]){
  assert(manifest[filename],`Manifest includes ${filename}`);
  const bytes=readFileSync(join(base,filename));
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert(bytes.length>50000);
}
const archivedPdfHash=hash(readFileSync(join(base,archivePdf)));
assert.equal(archivedPdfHash,'babe621e7f08aea6d949f3d2f760998e6a4f382af3db2ede0f20da1d16cc3832','Original PDF retained unchanged');
assert.notEqual(hash(readFileSync(join(base,currentPdf))),archivedPdfHash,'Canonical PDF must contain the revision');
for(const name of ['aggregate_downloads.zip','audit-and-reproducibility.zip','general-analysis-and-audit.zip','data_dictionary.md','source_records_audit.json','charge_classification_map.csv','category_mapping.csv','revision-2/revision_results.json','revision-2/panel_metadata.json','revision-2/daily.json','revision-2/category_daily.json','revision-2/analysis_panel.csv.gz']){
  assert(existsSync(join(base,'data',name)),`Missing publication file ${name}`);
  assert(manifest[`data/${name}`],`Unmanifested publication file ${name}`);
}
for(const match of html.matchAll(/href="(\/data-analysis\/crime-and-heat\/[^"#]+)"/g))assert(existsSync(join('dist',decodeURIComponent(match[1]))),`Broken research download: ${match[1]}`);
const verifyAggregateHeaders=(directory)=>{
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    const filename=join(directory,entry.name);
    if(entry.isDirectory()){verifyAggregateHeaders(filename);continue;}
    if(!entry.name.endsWith('.csv'))continue;
    const head=readFileSync(filename,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)[0];
    const columns=head.split(',').map(column=>column.replace(/^"|"$/g,''));
    assert(!columns.some(column=>['event_key','source_id','source_csv_row','recorded_datetime','Street Name','100 Block'].includes(column)),`Individual record fields in ${filename}`);
  }
};
verifyAggregateHeaders(join(base,'data'));
const external=read('source-expansion-1/source_inventory.json');
const externalCheck=read('source-expansion-1/publication_validation.json');
const externalIndependent=read('source-expansion-1/independent_validation.json');
assert.equal(external.new_effect_models,0);
assert.equal(externalCheck.preserved_prior_artifacts,166);
assert.equal(externalCheck.prior_model_results_changed,false);
assert.equal(externalCheck.status,'PASS');
assert.equal(externalIndependent.status,'PASS');
assert.equal(externalCheck.pdf_pages,4);
assert.equal(external.verified_counts.isd_accepted_hours,externalIndependent.checks.isd.unique_quality_accepted_hours);
assert.equal(external.verified_counts.isd_complete_station_days,externalIndependent.checks.isd.complete_station_civil_days);
assert.equal(external.verified_counts.doj_dv_agency_months,externalIndependent.checks.doj.agency_month_rows);
for(const [name,expected] of Object.entries(externalCheck.artifact_hashes)){
  const path=`data/source-expansion-1/${name}`;
  assert.deepEqual(manifest[path],expected,`Supplement nested/global manifest agreement: ${name}`);
}
for(const source of external.sources){
  assert(existsSync(join(base,'data/source-expansion-1',source.documentation)),`Missing external source audit: ${source.name}`);
}
assert(html.includes('id="external-validation"'));
assert(html.includes('November–December 2024'));
assert(html.includes('primary analyses exclude 2025'));
assert(html.includes('source-validation-supplement.pdf'));
assert(html.includes('external-source-data-and-audit.zip'));
console.log('Research publication verified: frozen original/revised models and PDFs; 22 fits / 24 tests; MathML; civil-day explorer; independent source supplement, nested hashes, coverage qualifications and four-page PDF.');
