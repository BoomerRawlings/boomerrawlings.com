import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';

// Frozen against independently audited MODEL_RESULTS.csv, 28 September 2026.
// Intentional scientific revisions require renewed review of these expectations.
const columns = ['model','rows','dates','regions','parameters','hac_lag_days',
  'cos_coefficient','sin_coefficient','cov_cos_cos','cov_cos_sin','cov_sin_sin',
  'joint_wald_chi2','joint_p','full_vs_new_percent','full_vs_new_ci_low',
  'full_vs_new_ci_high','fitted_peak_trough_percent','peak_trough_ellipse_low',
  'peak_trough_ellipse_high','peak_phase_degrees','peak_not_identified_at_95pct',
  'partial_r_squared','finite_multiplier','design_condition_number','regional_holm_p'];
const route = '/writing/data-analysis/sex-and-the-moon/';
const assetRoot = 'dist/data-analysis/sex-and-the-moon';
const modelData = JSON.parse(readFileSync(join(assetRoot,'results.json'),'utf8'));
const normalize = models => models.map(m => Object.fromEntries(columns.map(c => [c,m[c]])))
  .sort((a,b) => a.model.localeCompare(b.model));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let checks = 0;
function check(condition, message) { assert(condition, message); checks++; }
function close(actual, expected, message, tolerance = 1e-10) {
  check(Number.isFinite(actual) && Math.abs(actual-expected) < tolerance, `${message}: ${actual} versus ${expected}`);
}
check(hash(JSON.stringify(normalize(modelData.models))) === '436dff250f9af94f941fe5819a76d2fbe4c49b152e5aad1501f0ebce4d5d94c7',
  'All 21 scientific model records must match the audited immutable values');
check(modelData.provenance['MODEL_RESULTS.csv'] === '8a38e5ccc96fcd724a7f0ce457422e23e9ba85be6f3afd1d5a1c43fa525dd4b8', 'Audited model-file provenance');
check(modelData.provenance['ANALYSIS_PLAN.md'] === 'f14d120132cb01fdd3de5f5709aa82d1d1a9e1c1dfa0181948578c161770ec57', 'Locked exploratory plan provenance');
check(modelData.provenance['ADJUSTED_CURVE.csv'] === '0772977100f02f4092fb6d7d8e104d62fb09a5d918a25ae23fd5622a11cfdc20', 'Audited main curve provenance');
check(modelData.source_commit === '8ed416e7d4b30bcf73d00e69a78e236396c2b70e', 'Pinned upstream source');
check(modelData.date_start === '2017-07-01' && modelData.date_end === '2019-06-30', 'Observed date range');
check(modelData.source_datasets === 1 && modelData.feature_logs === 1812110 && modelData.distinct_dates === 730 && modelData.region_days === 3650, 'Observation units and totals');
check(modelData.models.length === 21 && new Set(modelData.models.map(m => m.model)).size === 21, '21 distinct planned models');
const expectedRegions = [
  ['Brazil - Central-West',553078],['France',376716],['United Kingdom',515258],
  ['United States - California',157227],['United States - Northeast',209831],
];
check(JSON.stringify(modelData.regions.map(r => [r.key,r.logs])) === JSON.stringify(expectedRegions), 'Five audited areas and counts; no inferred Brazil Northeast');
check(modelData.regions.every(r => r.dates === 730) && modelData.regions.reduce((n,r) => n+r.logs,0) === modelData.feature_logs, 'Regional coverage reconciles');
check(modelData.models.every(m => m.label?.trim() && m.explanation?.trim()), 'Every selectable model has its own explanatory text');
check(new Set(modelData.models.map(m => m.explanation)).size === 21, 'Explanations are model-specific');
check(modelData.posthoc.model === 'posthoc_add_brazil_june12' && !modelData.models.some(m => m.model === modelData.posthoc.model), 'Post hoc check remains separate from planned models');
close(modelData.posthoc.joint_p,0.03187820237810442,'Audited post hoc p-value');
close(modelData.bootstrap.p,(modelData.bootstrap.exceedances+1)/(modelData.bootstrap.replicates+1),'Finite bootstrap correction');
check(modelData.bootstrap.replicates === 1999 && modelData.bootstrap.exceedances === 51, 'Audited bootstrap counts');

// Recompute statistical identities rather than trusting rendered summaries.
for (const m of [...modelData.models,modelData.posthoc]) {
  const a=m.cos_coefficient, b=m.sin_coefficient;
  const v=m.cov_cos_cos, c=m.cov_cos_sin, w=m.cov_sin_sin;
  const determinant=v*w-c*c;
  check(v>0 && w>0 && determinant>0, `${m.model}: positive-definite covariance`);
  const wald=(w*a*a-2*c*a*b+v*b*b)/determinant;
  close(m.joint_wald_chi2,wald,`${m.model}: joint Wald statistic`);
  close(m.joint_p,Math.exp(-wald/2),`${m.model}: two-degree-of-freedom p-value`);
  close(m.full_vs_new_percent,100*Math.expm1(-2*a),`${m.model}: Full versus New`);
  const se=2*Math.sqrt(v), z=1.959963984540054;
  close(m.full_vs_new_ci_low,100*Math.expm1(-2*a-z*se),`${m.model}: Full/New lower CI`);
  close(m.full_vs_new_ci_high,100*Math.expm1(-2*a+z*se),`${m.model}: Full/New upper CI`);
  close(m.fitted_peak_trough_percent,100*Math.expm1(2*Math.hypot(a,b)),`${m.model}: fitted peak/trough`);
  close(m.peak_phase_degrees,(Math.atan2(b,a)*180/Math.PI+360)%360,`${m.model}: phase direction`);
  check(m.peak_trough_ellipse_low <= m.fitted_peak_trough_percent && m.peak_trough_ellipse_high >= m.fitted_peak_trough_percent, `${m.model}: projected interval brackets estimate`);
}
const regional=modelData.models.filter(m=>m.model.startsWith('region:')).sort((a,b)=>a.joint_p-b.joint_p);
let previous=0;
for (const [i,m] of regional.entries()) {
  previous=Math.min(1,Math.max(previous,(regional.length-i)*m.joint_p));
  close(m.regional_holm_p,previous,`${m.model}: independent Holm calculation`);
}
const main=modelData.models.find(m=>m.model==='main_adjusted');
const curveFixtures=[
  [0,99.4916367019671,98.56817089955531,100.42375427381359],
  [90,99.4082152317582,98.72252776461139,100.09866521170984],
  [180,100.51096083538734,99.57803382588327,101.45262825451411],
  [270,100.59530770858538,99.901432040576,101.29400276139053],
  [360,99.4916367019671,98.56817089955531,100.42375427381359],
];
for (const [degrees,index,low,high] of curveFixtures) {
  const theta=degrees*Math.PI/180, cs=Math.cos(theta), sn=Math.sin(theta);
  const fit=main.cos_coefficient*cs+main.sin_coefficient*sn;
  const radius=Math.sqrt(5.991464547107979*(main.cov_cos_cos*cs*cs+2*main.cov_cos_sin*cs*sn+main.cov_sin_sin*sn*sn));
  close(100*Math.exp(fit),index,`${degrees}°: audited main curve`);
  close(100*Math.exp(fit-radius),low,`${degrees}°: simultaneous lower band`);
  close(100*Math.exp(fit+radius),high,`${degrees}°: simultaneous upper band`);
}

const htmlFile=join('dist',route,'index.html');
const html=readFileSync(htmlFile,'utf8');
const nodes=[];
function walk(node) { nodes.push(node); (node.childNodes??[]).forEach(walk); }
walk(parse(html));
const attr=(n,key)=>n?.attrs?.find(a=>a.name===key)?.value;
const content=n=>n.nodeName==='#text'?n.value:(n.childNodes??[]).map(content).join('');
const byId=id=>nodes.find(n=>attr(n,'id')===id);
const ids=nodes.map(n=>attr(n,'id')).filter(Boolean);
check(ids.length===new Set(ids).size,'No duplicate HTML IDs');
const robots=nodes.find(n=>n.tagName==='meta'&&attr(n,'name')==='robots');
check(attr(robots,'content')?.split(',').map(s=>s.trim()).includes('noindex'),'Unlisted page has explicit noindex');
check(byId('lunar-study') && byId('lunar-chart'),'Study and accessible chart rendered');
const chart=byId('lunar-chart');
check(attr(chart,'role')==='img' && (attr(chart,'aria-label') || attr(chart,'aria-labelledby')),
  'Chart exposes its purpose to assistive technology');
for (const target of (attr(chart,'aria-labelledby')??'').split(/\s+/).filter(Boolean)) {
  check(!!byId(target),`Chart accessible-label target exists: ${target}`);
}
check(byId('lunar-data') && attr(byId('lunar-data'),'type')==='application/json','Embedded data is nonexecuting JSON');
check(JSON.stringify(JSON.parse(content(byId('lunar-data'))))===JSON.stringify(modelData),'Embedded and downloadable estimates agree exactly');
check(content(byId('lunar-amplitude')).trim()===`${main.fitted_peak_trough_percent.toFixed(2)}%`,'Static amplitude matches audited main model');
check(content(byId('lunar-p')).trim()===main.joint_p.toFixed(3),'Static p-value matches audited main model');
const contrastText=content(byId('lunar-contrast')).replaceAll('−','-');
for (const value of [main.full_vs_new_percent,main.full_vs_new_ci_low,main.full_vs_new_ci_high]) {
  check(contrastText.includes(`${value.toFixed(2)}%`),'Static Full/New estimate and interval match main model');
}
check(nodes.some(n=>n.tagName==='noscript'),'Usable no-JavaScript fallback present');
check(!html.includes('katex-error') && !html.includes('\ufffd'),'No formula parser errors or replacement glyphs');
check(nodes.filter(n=>n.tagName==='math').length>=3,'At least three formulas retain accessible MathML');
const controlNodes=nodes.filter(n=>attr(n,'data-model')!==undefined);
check(controlNodes.length>=6,'Overall and five region controls present');
for (const node of controlNodes) {
  const id=attr(node,'data-model');
  check(node.tagName==='button' && content(node).trim(),`${id}: native, named keyboard control`);
  if (attr(node,'aria-pressed')!==undefined) check(['true','false'].includes(attr(node,'aria-pressed')),`${id}: valid selection state`);
  check(modelData.models.some(m=>m.model===id),`${id}: control targets a qualified model`);
}
for (const region of modelData.regions) check(controlNodes.some(n=>attr(n,'data-model')===region.model && attr(n,'aria-pressed')==='false'),`${region.key}: selectable region with initial selection state`);
check(controlNodes.filter(n=>attr(n,'aria-pressed')==='true').length===1,'Exactly one default selection');
const citations=nodes.filter(n=>attr(n,'role')==='doc-noteref');
const backlinks=nodes.filter(n=>attr(n,'role')==='doc-backlink');
check(citations.length>0 && backlinks.length===citations.length,'Source and return links exist for every citation occurrence');
for (const cite of citations) {
  const target=attr(cite,'href');
  check(target?.startsWith('#') && byId(target.slice(1)),`${attr(cite,'id')}: source target exists`);
  check(cite.parentNode.tagName==='sub',`${attr(cite,'id')}: subscript citation`);
  check(backlinks.some(link=>attr(link,'href')===`#${attr(cite,'id')}`),`${attr(cite,'id')}: source-to-body return exists`);
}
for (const a of nodes.filter(n=>n.tagName==='a')) {
  const href=attr(a,'href');
  if (href?.startsWith('#')) check(!!byId(decodeURIComponent(href.slice(1))),`Local anchor exists: ${href}`);
  if (href?.startsWith('/data-analysis/sex-and-the-moon/')) {
    const local=resolve('dist',href.split(/[?#]/)[0].slice(1));
    check(existsSync(local),`Local publication artifact exists: ${href}`);
  }
}
for (const [published,original] of [['model-results.csv','MODEL_RESULTS.csv'],['adjusted-curve.csv','ADJUSTED_CURVE.csv'],['analysis-plan.md','ANALYSIS_PLAN.md']]) {
  check(hash(readFileSync(join(assetRoot,published)))===modelData.provenance[original],`Published ${published} retains audited bytes`);
}
const pdf=readFileSync(join(assetRoot,'sex-and-the-moon-report.pdf'));
check(pdf.subarray(0,5).toString()==='%PDF-' && pdf.subarray(-1024).toString().includes('%%EOF'),'Report is a complete PDF container; rendered-page QA is separate');
function allFiles(path) {
  return readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?allFiles(join(path,entry.name)):[join(path,entry.name)]);
}
for (const file of allFiles('dist')) {
  if (/sitemap.*\.xml$/.test(file)) check(!readFileSync(file,'utf8').includes(route),`Unlisted page excluded from ${file}`);
  if (!file.endsWith('.html') || resolve(file)===resolve(htmlFile)) continue;
  const other=readFileSync(file,'utf8');
  check(!other.includes(route),'No inbound lunar-page link or discovery metadata in '+file);
}
console.log(`Lunar publication: ${checks} checks pass; audited 21-model values, statistical identities, curve bands, controls, source returns and unlisted discovery protections.`);
