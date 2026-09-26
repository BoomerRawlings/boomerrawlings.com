"""Independent claim/source audit of the resident-gap amendment; no calculation mutations."""
from pathlib import Path
from datetime import datetime, timezone
from pypdf import PdfReader
import hashlib,json,re,subprocess,csv

AUDIT_OUTPUT=Path(__file__).resolve().parent
ANALYSIS=next((p for p in AUDIT_OUTPUT.parents if (p/'research/resident_gap_completion_2026_09_26').is_dir() and (p/'publication').is_dir()),None)
if ANALYSIS is None:
    raise RuntimeError('This source audit requires the original analysis project, retained raw sources, sibling website, Python pypdf and Node.js. The public archive alone does not contain those dependencies.')
ROOT=ANALYSIS/'research/resident_gap_completion_2026_09_26'
FRESHNESS=ANALYSIS/'research/freshness_2026_09_25'
SITE=ANALYSIS.parent/'boomerrawlings.com'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return p.read_text(encoding='utf-8-sig')
def js(p):return json.loads(read(p))
checks=[]
def check(name,passed,detail):
    checks.append(dict(check=name,pass_=bool(passed),detail=detail))
    if not passed:raise AssertionError((name,detail))

public=js(ROOT/'public/qualified_observations.json')
private=js(ROOT/'root_observations.json')
ivy=js(ROOT/'ivy/qualified_observations.json')
check('qualified records',len(public)==25 and len(private)==5 and len(ivy)==7,'25 public +5 coordinator +7 Ivy observations independently reviewed')
check('qualified institution coverage',len({str(x['unitid']) for x in public+private+ivy})==14,'37 qualified observations concern14 other institutions')
for group,base in [(public,ROOT/'public'),(ivy,ROOT/'ivy')]:
    for x in group:
        check(f'source bytes {x.get("observation_id")}',sha(base/x['source_file'])==x['source_sha256'],x['source_url'])
        check(f'no rate authorization {x.get("observation_id")}',x['eligible_for_rate'] is False,'Qualified context is not an adopted denominator')
root_sources={
 'gatech-2024-occupancy':ANALYSIS/'research/coverage_expansion_2026_09_25/public/retrieved/gatech_factbook_2024.pdf',
 'texas-2024-residents':ANALYSIS/'research/coverage_expansion_2026_09_25/public/retrieved/ut_housing_2024.pdf',
 'mit-2024-graduate':ANALYSIS/'research/coverage_expansion_2026_09_25/ivy_northeast/raw/mit_grad_occupancy_2025.pdf',
 'mit-2025-graduate':ANALYSIS/'research/coverage_expansion_2026_09_25/ivy_northeast/raw/mit_grad_occupancy_2025.pdf',
 'penn-2025-college-houses':ANALYSIS/'research/coverage_expansion_2026_09_25/ivy_northeast/raw/penn_asr_report.pdf'}
for x in private:check('source bytes '+x['id'],sha(root_sources[x['id']])==x['source_sha256'],x['source_url'])
expected=[7533,8089,8941,8313,8453,9138,9898,9285,8886,8880,9522,12301,13707,12020,12440,8654,8515,8439,9614,9044,9149,8915,15000,14800,None]
check('public source values',[x['value'] for x in public]==expected,'Manual table/page review; Florida chart visually read separately from capacity')
check('coordinator source values',[x['value'] for x in private]==[9892,10018,2808,2839,5994],'GeorgiaTech PDF35; Texas PDF5; MIT PDF9–10; Penn PDF61')
check('Ivy values',[x['value'] for x in ivy]==[8861,3768,3768,3858,37,36,360],'Cornell PDF21/383/407; Dartmouth rendered Tableau PDF1; Georgetown PDF2–3')
check('fiscal dates retained',all('Fiscal year' in x['period_label'] for x in public[:4]),'Florida chart year labels are fiscal years, not inferred fall dates')
check('Illinois dependent definitions',all('dependents' in x['statement'] and x['status']=='unresolved' for x in public[11:15]),'PDF18 explicitly counts all unique residents including dependents during the fiscal year')
check('lower bounds retained',public[22]['comparator']=='>' and public[23]['comparator']=='>' and 'more than' in public[22]['statement'].lower() and 'more than' in public[23]['statement'].lower(),'Ohio State prospective move-in and Penn State guide are not exact counts')
check('Cornell period and branch qualification','Tech' in ivy[0]['reason_no_rate'] and '2024–25' in ivy[0]['period_label'],'Ithaca scope and FY2024–25 retained; no whole-institution rate')
check('Dartmouth partial and academic labels',all(x['status']=='partial' and 'Academic year' in x['period_label'] and 'Graduate' in x['reason_no_rate'] for x in ivy[1:4]),'Undergraduate-only sums do not become institution populations')

yale=ROOT/'ivy/yale_w023_housing.pdf';yp=[p.extract_text() for p in PdfReader(yale).pages]
check('Yale original',sha(yale)=='8d7839f251567871886d0d09393f75825906f0d34b9d2e7f45c3c82197c9e918','Original PDF,3pages')
check('Yale dates','Counts as of fall of each academic year.' in yp[2] and '10-16-2025' in yp[2],'Fall reference date and published update date verified')
stanford=ROOT/'private/sources/stanford/facts2024-archived-0e7d8215.pdf';sp=PdfReader(stanford).pages[47].extract_text()
check('Stanford original',sha(stanford)=='c622530f7b570d190ee2b374e7395aa15ae6b4777fa5649541610043bdb2f2d2','Original university PDF captured by Internet Archive; digest matches acquisition index')
check('Stanford year/portfolio','autumn quarter 2023' in sp and '7,207' in sp and '6,930' in sp,'Values classify students by undergraduate/graduate housing portfolio; degree-level wording requires care')

# Final amendment claims are checked against retained source pages and final products.
data=ANALYSIS/'publication/current-2026-09-25'
dataset=js(data/'dataset.json');geography=js(data/'geography.json');coverage=js(data/'coverage.json')
populations=list(csv.DictReader((data/'population_sources.csv').open(encoding='utf-8-sig',newline='')))
check('adopted population ledger',len(populations)==169 and sum(x['measure']=='enrollment' for x in populations)==126 and sum(x['measure']=='residents' for x in populations)==43,'169 observations:126 enrollment and43 resident observations')
check('2024 final coverage',coverage['housing_count_coverage']['2024']==33 and coverage['population_coverage']['2024']['residents']==14 and coverage['available_rates']['2024']['residents']==14,'2024 combined housing counts33, populations14, paired rates14 of42')
check('2025 final coverage',coverage['population_coverage']['2025']['residents']==2 and coverage['available_rates']['2025']['residents']==0,'Two actual populations; no complete2025 combined housing rate')
for name,year,count,pop,rate in [('Yale',2024,56,6011,9.32),('Stanford',2023,50,14137,3.54)]:
    school=next(x for x in dataset['institutions'] if x['name']==name)
    annual=next(x for x in school['years'] if x['year']==year)
    check(name+' amendment ratio',annual['counts']['residential']['criminal_total']==count and annual['residents']==pop and round(1000*count/pop,2)==rate,'Descriptive reported-offense ratio, not a victimization probability')
cornell={c['campus_id']:c['count'] for c in geography['cells'] if c['unitid']=='190415' and c['year']==2024 and c['geography']=='housing' and c['category']=='criminal_total'}
check('Cornell all-branch housing total',cornell=={'190415001':45,'190415002':2,'190415003':0},'2024 Ithaca45 +Tech2 +AgriTech0 =47; Ithaca population cannot silently cover omitted Tech offenses')
cornell_sources=FRESHNESS/'private/retrieved/cornell'
ithaca_text=PdfReader(cornell_sources/'asr-f3e1b40e.pdf').pages[5].extract_text()
tech_text=PdfReader(cornell_sources/'tech-asr-fa532fb2.pdf').pages[32].extract_text()
check('Cornell original offense pages','Rape 28 23 6 25 21 5' in ithaca_text and 'Fondling 22 21 7 6 11 1' in ithaca_text and 'Aggravated Assault 0 2 1 0 2 1' in tech_text,'Original2026 Ithaca PDF6 and Tech PDF33 independently read; housing components21+11+1+9+3=45,Tech2')
amendment=read(FRESHNESS/'RESIDENT_GAP_AMENDMENT.md')
readme=read(FRESHNESS/'README.md')
claim_audit=read(FRESHNESS/'audit_current_citations.py')
check('amendment source qualifications',all(x in amendment for x in ['37 observations across 14 other institutions','July 2024–June 2025','two of the institution\'s 47','No narrower Cornell rate','housing classifications','not an annual mean']),'Final amendment preserves source period, excluded branch and housing-portfolio qualifications')
check('current citation definitions',all(x in claim_audit for x in ["('C43','Yale student populations'","('C44','Stanford2023 historical recovery'","('C45','Qualified housing evidence'"]),'C43–45 manually checked against Yale, Stanford and qualified-evidence originals; no unsupported census-year or adoption claim')

# Context evidence cannot alter any calculated count, population or rate.
code="""import fs from 'node:fs';import {readerResult} from './src/lib/campus-reader.js';const d=JSON.parse(fs.readFileSync('../campus_safety_analysis/publication/current-2026-09-25/dataset.json','utf8'));const e=JSON.parse(fs.readFileSync('./src/data/campus-resident-evidence.json','utf8')).observations;let n=0;for(const s of d.institutions)for(const category of d.categories.map(c=>c.id))for(const period of ['2022','2023','2024','2025','pooled'])for(const place of ['housing','campus','combined']){const a=readerResult(s,{category,period,place});const b=readerResult(s,{category,period,place},e.map(x=>({...x,value:999999999})));for(const k of ['count','population','rate'])if(a[k]!==b[k])throw Error(k);n++;}process.stdout.write(String(n));"""
tested=subprocess.run(['node','--input-type=module','-e',code],cwd=SITE,capture_output=True,text=True,check=True).stdout
check('qualified evidence calculation separation',tested=='9450','9,450 selections unchanged after modifying every context-only value')

pdf=ANALYSIS/'output/pdf/campus-safety-current-report.pdf'
report=PdfReader(pdf);pt='\n'.join(p.extract_text() for p in report.pages)
links=[str(a.get_object().get('/A','')) for p in report.pages for a in p.get('/Annots',[])]
check('new report references',all(f'[{i}]' in pt for i in [20,21,22]) and any('sharepoint.com' in s for s in links) and any('web.archive.org' in s for s in links) and any('resident_evidence.json' in s for s in links),'References20–22 target original Yale PDF, archived original Stanford PDF and qualified evidence ledger')
pending=[]
if '7,207 undergraduate + 6,930 graduate students' in pt:pending.append('PDF Stanford row must identify housing portfolios, not student degree levels')
context=js(SITE/'src/data/campus-school-context.json')
stanford_context=next(v for v in context.values() if 'Stanford' in v.get('alias',''))
if 'autumn 2023' not in stanford_context['note']:pending.append('Stanford context must include newly documented autumn2023 population')
if '`EXPANSION_AMENDMENT.md` is the current scientific-change record.' in readme:pending.append('README must identify RESIDENT_GAP_AMENDMENT.md as the current scientific-change record')
if 'actual undergraduate and graduate residents' in readme:pending.append('README Stanford wording must distinguish housing portfolios from student degree levels')
methods=read(SITE/'src/content/archive/campus-safety.md')
if 'Yale' not in methods:pending.append('Methods must explain new Yale resident censuses')
reader=read(SITE/'src/components/CampusReader.astro')
if 'checked 25 September 2026.' in reader:pending.append('Reader check date should explicitly distinguish offense review from26September housing revision')
artifacts={
 'root_observations.json':sha(ROOT/'root_observations.json'),
 'public/qualified_observations.json':sha(ROOT/'public/qualified_observations.json'),
 'ivy/qualified_observations.json':sha(ROOT/'ivy/qualified_observations.json'),
 'campus-safety-current-report.pdf':sha(pdf)}
for path in ['RESIDENT_GAP_AMENDMENT.md','README.md','audit_current_citations.py']:
    artifacts['freshness/'+path]=sha(FRESHNESS/path)
for path in ['coverage.json','dataset.json','geography.json','population_sources.csv']:
    artifacts['current-data/'+path]=sha(data/path)
for path in ['src/lib/campus-reader.js','src/components/CampusReader.astro','src/components/CampusReaderSources.astro','src/data/campus-resident-evidence.json','src/data/campus-school-context.json','src/content/archive/campus-safety.md','src/pages/writing/data-analysis/campus-safety.astro']:
    artifacts['website/'+path]=sha(SITE/path)
result=dict(checked_utc=datetime.now(timezone.utc).isoformat(),status='PASS' if not pending else 'SOURCE_PASS_FINAL_COPY_PENDING',scope='37 qualified observations,5 newly adopted source observations, new PDF claims/references20–22, reader population-evidence separation and direct source-link rendering logic. Scientific extraction/rate audit and full visual audit remain separate.',checks=checks,source_review='PASS',qualified_observations=37,new_adopted_source_observations=5,reader_selections=9450,pending=pending,artifacts=artifacts,limitations=['Not a new systematic review or an exhaustive proof of public data absence.','Original source periods and partial/mixed populations preserved; exact property matching remains qualified.','Browser layout and citation navigation are independently tested by the parent; this audit reviews source use and code paths.'])
(AUDIT_OUTPUT/'SOURCE_CITATION_AUDIT.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
(AUDIT_OUTPUT/'SOURCE_CITATION_AUDIT.md').write_text('# Resident-source amendment: independent citation audit\n\n'+f"Status: {result['status']}. Checked {result['checked_utc']}.\n\n"+f"Reviewed 37 qualified observations across 14 institutions and 5 newly adopted source observations. Cited numeric values, source hashes and relevant population/period qualifications pass. Source verification is separate from the scientific integration audit and PDF/browser visual reviews. All 9,450 reader selections preserve count, population and rate when qualified context values change.\n\n"+'Source controls: Florida occupancy/capacity visually separated; Illinois annual dependents preserved; Washington residence-hall exclusions explicit; Ohio/Penn State lower bounds retained; Virginia percentages not converted; Georgia Tech married units unresolved; Texas spring population definition unresolved; MIT graduate-only classification and source discrepancy preserved; Penn College House limitation retained; Cornell Ithaca/period conflict preserved; Dartmouth graduate omissions and academic labels explicit; Georgetown building/term limits retained. Yale student-only fall dates and Stanford autumn 2023 housing portfolios checked against original PDFs.\n\n'+'Final amendment and README reviewed against adopted population ledger and source evidence; claims C43–45 separately checked. Cornell 2024 housing count is 45 Ithaca + 2 Tech + 0 AgriTech = 47. Original Ithaca PDF 6 and Tech PDF 33 confirm the relevant housing counts; Ithaca-only population cannot cover the additional Tech offenses. Final ledger: 169 observations, comprising 126 enrollment and 43 resident observations. For 2024, 33 institutions have usable combined housing counts, 14 have populations and 14 have paired rates; two 2025 populations produce no complete 2025 combined housing rate.\n\n'+'New PDF references 20–22 point to the original Yale PDF, archived Stanford university PDF and the distinct qualified-evidence ledger. Web school-source sections expose observation-specific source URLs/pages with return links. The code does not substitute qualified evidence for adopted denominators.\n\n'+'Reproduction: audit_gap_sources.py requires the original analysis project, retained raw source files, sibling website, Python pypdf and Node.js. The public archive retains this audit record and script, but does not redistribute the original reports/webpages. Paths in the record are project-relative.\n\n'+('Pending final-copy fixes:\n\n'+'\n'.join('- '+s for s in pending) if pending else 'No unresolved findings in this scoped review. Final artifact hashes are recorded in the JSON ledger.')+'\n',encoding='utf-8')
print(json.dumps({'status':result['status'],'checks':len(checks),'pending':pending,'pdf_sha256':sha(pdf)},indent=2))
