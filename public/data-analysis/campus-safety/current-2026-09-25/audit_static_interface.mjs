/** Bounded, repeatable static-build and pure-function review; no browser claims. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {initialView, selectedRows, sortOrders, nextSort, viewDefaults, csvText} from '../../../boomerrawlings.com/src/lib/campus-rates.js';

const site=new URL('../../../boomerrawlings.com/',import.meta.url);
const require=createRequire(new URL('package.json',site));
const {parse}=require('parse5');
const read=path=>fs.readFileSync(new URL(path,site),'utf8');
const json=path=>JSON.parse(read(path));
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(new URL(path,site))).digest('hex');
const base='dist/data-analysis/campus-safety/current-2026-09-25/';
const htmlPath='dist/writing/data-analysis/campus-safety/index.html';
const html=read(htmlPath), doc=parse(html), nodes=[];
function visit(n){nodes.push(n);for(const child of n.childNodes??[])visit(child);}
visit(doc);
const attr=(n,key)=>n?.attrs?.find(a=>a.name===key)?.value;
const text=n=>n?.nodeName==='#text'?n.value:(n?.childNodes??[]).map(text).join('');
const find=id=>nodes.find(n=>attr(n,'id')===id);
const checks=[];
const check=(name,pass)=>checks.push({name,pass:Boolean(pass)});
const data=json(base+'dataset.json'), coverage=json(base+'coverage.json'), geo=json(base+'geography.json');
const embedded=JSON.parse(text(find('campus-dataset'))), federal=embedded.federal;
check('Embedded current dataset equals published dataset',JSON.stringify(embedded.current)===JSON.stringify(data));
check('Built dataset equals current public source bytes',hash(base+'dataset.json')===hash('public/data-analysis/campus-safety/current-2026-09-25/dataset.json'));
check('All 42 institutions retain extracted report evidence',data.institutions.length===42&&coverage.institutions_with_extracted_cells===42);
const currentDefault=selectedRows(data,initialView), federalDefault=selectedRows(federal,initialView);
check('Current default includes 13 available resident-rate comparisons',currentDefault.length===13&&currentDefault.every(r=>r.rate!==null)&&coverage.available_rates['2024'].residents===13);
check('Archived default remains 11 available resident-rate comparisons',federalDefault.length===11&&federalDefault.every(r=>r.rate!==null));
const table=find('campus-results'), tbody=table.childNodes.find(n=>n.tagName==='tbody');
const mainRows=tbody.childNodes.filter(n=>n.tagName==='tr');
const serverStatus=text(find('campus-results-status'));
const normalizedName=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
check('Server-rendered default table agrees with current pure functions',mainRows.length===currentDefault.length&&mainRows.every((row,index)=>normalizedName(text(row.childNodes.find(n=>n.tagName==='th'))).startsWith(normalizedName(currentDefault[index].institution.officialName??currentDefault[index].institution.name)))&&serverStatus.startsWith('13 institutions · 13 rates available'));

// Independently construct an expected order; null values stay last in both directions.
const sorts={};
for(const [source,sourceData] of Object.entries({current:data,federal}))for(const group of ['resident-covered','all'])for(const [sort,order] of Object.entries(sortOrders)){
  const unsorted=selectedRows(sourceData,{...initialView,group});
  const name=r=>r.institution.officialName??r.institution.name;
  const expected=[...unsorted].sort((a,b)=>{
    const names=name(a).localeCompare(name(b),'en');
    if(order.column==='institution'&&names!==0)return order.direction==='ascending'?names:-names;
    if(order.column!=='institution'){
      const av=a[order.column],bv=b[order.column];
      if(av===null&&bv!==null)return 1;
      if(bv===null&&av!==null)return -1;
      if(av!==null&&bv!==null&&av!==bv)return order.direction==='ascending'?av-bv:bv-av;
    }
    return names||String(a.institution.id).localeCompare(String(b.institution.id),'en');
  });
  const actual=selectedRows(sourceData,{...initialView,group,sort});
  const passed=actual.map(r=>r.institution.id).join('|')===expected.map(r=>r.institution.id).join('|');
  sorts[`${source}_${group}_${sort}`]={first:actual[0]?.institution.name,last:actual.at(-1)?.institution.name,passed};
}
check('All 32 source/group/column-direction orders match independent comparator',Object.keys(sorts).length===32&&Object.values(sorts).every(s=>s.passed));
check('Column toggles retain expected numeric and name defaults',nextSort('name','rate')==='rateDesc'&&nextSort('rateDesc','rate')==='rateAsc'&&nextSort('rateAsc','rate')==='rateDesc'&&nextSort('rateAsc','institution')==='name'&&nextSort('name','institution')==='nameDesc');
const legacy=viewDefaults(new URLSearchParams('sort=rateDesc'));
check('Legacy view defaults preserve enrollment and all-school scope',legacy.measure==='enrollment'&&legacy.group==='all');
check('CSV helper preserves row order, quoted text and blank unknowns',csvText([['institution','value'],['A, B',null],['C',2]])==='institution,value\r\n"A, B",\r\nC,2\r\n');

const geography=[['122409','122409001',2024,'rape'],['122409','122409001',2025,'rape'],['110671','110671002',2024,'rape'],['110662','110662001',2024,'dating_violence'],['234076','234076001',2025,'rape']].map(([unit,campus,year,cat])=>({unit,campus,year,cat,cells:geo.cells.filter(c=>String(c.unitid)===unit&&String(c.campus_id)===campus&&c.year===year&&c.category===cat).map(c=>({geography:c.geography,count:c.count,status:c.status}))}));
const cells=(index)=>Object.fromEntries(geography[index].cells.map(c=>[c.geography,c]));
const s24=cells(0),s25=cells(1),uva=cells(4);
check('SDSU housing remains nested; all-area rape counts retain 2024 and 2025 evidence',s24.housing.count===1&&s24.on_campus.count===1&&s24.noncampus.count===2&&s24.public_property.count===0&&s25.housing.count===10&&s25.on_campus.count===11&&s25.noncampus.count===5&&s25.public_property.count===0);
check('Virginia original-source sample is now verified, not stale unverified values',Object.keys(uva).length===4&&Object.values(uva).every(c=>c.status==='reported_numeric'&&Number.isInteger(c.count)));
check('Riverside missing geography and Berkeley combined categories remain distinguished',cells(2).housing.status==='not_applicable_no_geography'&&cells(2).noncampus.status==='not_reported'&&Object.values(cells(3)).every(c=>c.status==='ambiguous_source'&&c.count===null));
const current2025=selectedRows(data,{...initialView,period:'2025',group:'all'});
const archive2025=selectedRows(federal,{...initialView,period:'2025',group:'all'});
check('2025 Stanford population is retained without inventing complete institution-wide rates',current2025.find(r=>r.institution.id==='243744').population===14042&&current2025.every(r=>r.rate===null));
check('Archived 2025 remains unavailable',archive2025.every(r=>r.count===null&&r.population===null&&r.rate===null));

const ids=nodes.map(n=>attr(n,'id')).filter(Boolean);
const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
const missingInternalLinks=[...new Set(nodes.filter(n=>n.tagName==='a').map(n=>attr(n,'href')).filter(h=>h?.startsWith('#')&&h!=='#').filter(h=>!ids.includes(decodeURIComponent(h.slice(1)))))];
check('Static document IDs are unique',duplicateIds.length===0);
check('Every static same-page anchor resolves',missingInternalLinks.length===0);
const formulas=nodes.filter(n=>n.tagName==='math').length;
check('Seven equations produce MathML without KaTeX error markup',formulas===7&&!html.includes('katex-error'));
const downloads=['population_sources.csv','expansion/population_candidates.csv','EXPANSION_AMENDMENT.md'];
check('New provenance and candidate downloads exist and are linked',downloads.every(path=>fs.existsSync(new URL(base+path,site))&&nodes.some(n=>n.tagName==='a'&&attr(n,'href')?.endsWith('/'+path))));
const source=read('src/components/CampusExplorer.astro');
check('Source retains accessible sort action labels, active sort state and focus restoration',source.includes("th.setAttribute('aria-sort',order.direction)")&&source.includes("button.setAttribute('aria-label',`${label}: sort ${direction}`)")&&source.includes('focus({preventScroll:true})'));
const reader=find('reader-reading');
check('Initial school reading is empty and hidden',reader&&attr(reader,'hidden')!==undefined&&text(find('reader-school-heading'))==='');

const artifactPaths=[htmlPath,base+'dataset.json',base+'geography.json',base+'coverage.json','src/lib/campus-rates.js','src/components/CampusExplorer.astro'];
const result={checked_utc:new Date().toISOString(),status:checks.every(c=>c.pass)?'PASS':'FAIL',scope:'Local built HTML and imported pure functions. No HTTP, browser interaction, responsive layout or rendered-equation visual claim. Those are covered by separate reviews.',checks,default_current_rates:currentDefault.filter(r=>r.rate!==null).length,default_federal_rates:federalDefault.filter(r=>r.rate!==null).length,default_visible_institutions:currentDefault.length,formulas,sorts,geography,duplicate_ids:duplicateIds,missing_internal_links:missingInternalLinks,server_status:serverStatus,server_main_rows:mainRows.length,legacy_view_defaults:legacy,reviewed_artifacts:artifactPaths.map(path=>({path,sha256:hash(path)}))};
fs.writeFileSync(new URL('static_interface_checks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,checks:checks.length,failed:checks.filter(c=>!c.pass),output:fileURLToPath(new URL('static_interface_checks.json',import.meta.url))},null,2));
if(result.status!=='PASS')process.exitCode=1;
