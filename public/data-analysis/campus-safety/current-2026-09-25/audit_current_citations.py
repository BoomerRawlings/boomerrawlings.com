"""Record the bounded editorial/source review and repeat its factual spot checks.

The ledger records a manual citation review; rerunning arithmetic and link checks
does not independently re-review new prose. Review changed artifact hashes before
reissuing the record. This script does not modify publication inputs or PDFs.
"""
from pathlib import Path
from datetime import datetime, timezone
import csv, hashlib, json, logging, re
from pypdf import PdfReader

logging.getLogger('pypdf').setLevel(logging.ERROR)
HERE = Path(__file__).resolve().parent
CAMPUS = HERE.parents[1]
ROOT = CAMPUS.parent
SITE = ROOT / 'boomerrawlings.com'
DATA = CAMPUS / 'publication/current-2026-09-25'
EXPANSION = CAMPUS / 'research/coverage_expansion_2026_09_25'
HEAT = ROOT / 'dv_heat_analysis/publication'
checks = []
def load(path): return json.loads(path.read_text(encoding='utf-8'))
def rows(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))
def check(name, condition):
    checks.append({'check': name, 'pass': bool(condition)})
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def norm(text): return ' '.join(text.split())
def pdf_text(path, page=None):
    reader = PdfReader(path)
    return norm(reader.pages[page-1].extract_text()) if page else norm(' '.join(p.extract_text() for p in reader.pages))

page_path = SITE/'src/pages/writing/data-analysis/campus-safety.astro'
methods_path = SITE/'src/content/archive/campus-safety.md'
context_path = SITE/'src/data/campus-school-context.json'
page = page_path.read_text(encoding='utf-8')
methods = methods_path.read_text(encoding='utf-8')
builder = (HERE/'build_current_reports.py').read_text(encoding='utf-8')
campus_pdf = CAMPUS/'output/pdf/campus-safety-current-report.pdf'
heat_pdf = CAMPUS/'output/pdf/crime-and-heat-source-refresh.pdf'
campus_text, heat_text = pdf_text(campus_pdf), pdf_text(heat_pdf)
dataset, inventory, coverage, cases = [load(DATA/name) for name in ['dataset.json','source_inventory.json','coverage.json','case_study.json']]
check('42 fixed institutional identifiers in inventory and current data', len(inventory)==42 and {x['unitid'] for x in inventory}=={x['id'] for x in dataset['institutions']})
resident_2024=sum(any(y['year']==2024 and y.get('residents') is not None for y in i['years']) for i in dataset['institutions'])
check('42 institutions have extracted original reports; retrieval is not completeness certification', coverage['institutions_with_extracted_cells']==42 and '42 institutions' in campus_text and 'Provisional Virginia tables remain excluded' not in campus_text)
check('2024 report availability matches qualified current populations and calculated rates', resident_2024==13 and f"{coverage['available_rates']['2024']['residents']} combined criminal-offense rates are available among {resident_2024} institutions" in campus_text)
check('2025 population availability is distinguished from rate eligibility', next(y for i in dataset['institutions'] if i['id']=='243744' for y in i['years'] if y['year']==2025)['residents']==14042 and coverage['available_rates']['2025']['enrollment']==0 and 'No verified same-year 2025 population denominator is adopted' not in campus_text)
check('Separate numerical audit passes', load(HERE/'CURRENT_DATA_AUDIT.json')['status']=='PASS')
check('All four federal input refreshes preserve exact previous hashes', len(load(HERE/'federal/bulk_rechecks.json'))==4 and all(x['unchanged'] and x['sha256']==x['original_sha256'] for x in load(HERE/'federal/bulk_rechecks.json')))
check('Latest listed federal bulk collection is 2025', max(load(HERE/'federal/years.json'))==2025)
check('Current processing claim cites current rates and current audit', 'current-2026-09-25/CURRENT_DATA_AUDIT.md' in methods and 'current-2026-09-25/rates.csv' in methods)
check('Historical federal housing applicability expressly limited to archive/year', 'For the archived federal 2024 residential totals only' in methods)
check('No new systematic or external-human-peer-review claim', 'not relabeled as a new systematic review' in campus_text and 'not external human peer review' in campus_text)

sdsu_current = CAMPUS/'research/sdsu_2026/asr_2026_newdraft.pdf'
sdsu_prior = CAMPUS/'research/sdsu_2026/sdsu_2025_asr_comparison_source.pdf'
ucsd = HERE/'uc/san_diego_report.pdf'
ucsc = HERE/'uc/santa_cruz_report.pdf'
occupancy = CAMPUS/'sources/enrollment/raw/2024-111-Report.pdf'
source_new, source_old = pdf_text(sdsu_current,7), pdf_text(sdsu_prior,7)
for year, values in [(2023,'8 11 2 0'),(2024,'1 1 2 0'),(2025,'10 11 5 0')]:
    check(f'SDSU current PDF p7 rape geography {year}', f'{year} {values}' in source_new)
for year, values in [(2022,'9 12 1 1'),(2023,'7 11 2 0'),(2024,'1 1 2 0')]:
    check(f'SDSU prior PDF p7 rape geography {year}', f'{year} {values}' in source_old)
check('SDSU current report exact version hash', sha(sdsu_current)=='8d697b9134573a07dd7d53a0db29c18f8fe3a5b97e026fb8221237766155c80b')
check('SDSU 2024 geography vs 2023 revision distinguished', 'this discrepancy is geographic, not a revision' in campus_text and 'revise 2023 housing rape from seven to eight' in campus_text)
check('SDSU filename qualification and 2026 calendar-count exclusion', 'newdraft' in campus_text and 'email-only 2026 count is excluded' in campus_text)
u = pdf_text(ucsd,142)
check('UCSD p142 housing series and revised geographic counts', all(v in u for v in ['2024 20 28 7 0 35','2023 11* 19* 8* 0 27*','2022 12 15** 5** 1 21**']))
check('UCSD cover reissue date', 'February 26, 2026' in pdf_text(ucsd,1))
sc = pdf_text(ucsc,11)
check('Current UCSC p11 housing rape count and disclosure footnote', '2024 46 38' in sc and 'one report of 21 separate instances' in sc)
check('Website UCSC citations use current May reissue / PDF11', 'Republished-May-6-2026.pdf#page=11' in page and 'Republished-May-6-2026.pdf#page=11' in methods and '2025-UC-Santa-Cruz-ASFSR_online-3.pdf' not in page+methods)
uc_occ, sd_occ = pdf_text(occupancy,62), pdf_text(occupancy,64)
check('State Auditor source carries all six San Diego occupancy values', all(v in uc_occ for v in ['17,906','18,906','21,907']) and all(v in sd_occ for v in ['7,919','8,100','8,367']))
expected = {'110680':[(2022,12,17906),(2023,11,18906),(2024,20,21907),('pooled',43,58719)], '122409':[(2022,9,7919),(2023,8,8100),(2024,1,8367),('pooled',18,24386)]}
for ident, triples in expected.items():
    for year,count,pop in triples:
        row = next(x for x in cases if x['unitid']==ident and x['period']==year)
        check(f'Worked example {ident}/{year}: numerator, population, rate', (row['asr_housing_rape_count'],row['fall_occupancy_sum'])==(count,pop) and abs(row['rate_per_1000']-1000*count/pop)<1e-12)
check('Pooled SDSU mixed-edition attribution is explicit', next(x for x in cases if x['unitid']=='122409' and x['period']==2022)['sources'][0]['edition']=='2025' and next(x for x in cases if x['unitid']=='122409' and x['period']==2023)['sources'][0]['edition']=='2026')
check('Old/new pooled displayed values independently recalculate', f'{17000/24386:.2f}'=='0.70' and f'{18000/24386:.2f}'=='0.74')
check('Population-source citation distinguished from release timing', '[6a] IPEDS complete files and data dictionaries.' in campus_text and 'population_sources.csv' in builder and 'population_sources.csv' in methods)

def links(path):
    found=[]
    for n,p in enumerate(PdfReader(path).pages,1):
        for obj in p.get('/Annots',[]):
            target=obj.get_object().get('/A',{}).get('/URI')
            if target: found.append({'page':n,'url':str(target)})
    return found
campus_links, heat_links = links(campus_pdf),links(heat_pdf)
required = ['asr_2026_newdraft.pdf#page=7','2025-annual-security-report-finalized-08-18-25.pdf#page=7','2024-111-Report.pdf#page=62','annualclery.pdf#page=142','ccsvsftr.pdf#page=131','download-access-database','enrollment_denominators.csv','source_inventory.json','source_cells.csv','population_sources.csv','facts.stanford.edu/campus-life','2025-Stanford-Fact-Book_WEB.pdf','2026-asr-final.pdf#page=81','1743656171859']
for target in required: check('PDF clickable reference target: '+target, any(target in x['url'] for x in campus_links))

fresh=load(HEAT/'freshness_2026_09_25/offline_verification.json')
check('Heat refresh independent reconciliation passes',fresh['status']=='PASS' and fresh['models_refit']==0)
check('Heat supplement totals agree with reconciliation', (fresh['requests_verified'],fresh['sdpd_2026_source_rows'],fresh['sdpd_net_new_rows'],fresh['sdpd_new_day_rows'],fresh['sdpd_prior_date_net_revisions'],fresh['sdpd_daily_cells'],fresh['sdpd_monthly_offense_cells'])==(133,57037,244,95,149,1335,416))
model=[r for r in rows(HEAT/'revision_models/results/revision_models.csv') if r['specification']=='R0']
for outcome,areas,percent,pvalue in [('all',64,'1.91','0.05287'),('core',63,'2.74','0.17903')]:
    m=next(x for x in model if x['outcome']==outcome)
    check('Corrected reference coefficient and sample: '+outcome,int(m['zips'])==areas and f"{float(m['percent_change']):.2f}"==percent and f"{float(m['two_sided_p']):.5f}"==pvalue and percent+'%' in heat_text and pvalue in heat_text)
check('Heat PDF names 64/63 postal-area model scope','64-postal-area reference analysis (63 fitted postal areas for domestic violence)' in heat_text)
tests=rows(HEAT/'revision_models/results/revision_tests.csv')
check('No fixed-battery Holm-adjusted p below .05',len(tests)==24 and min(float(x['p_holm_revision_family']) for x in tests)>.05)
check('Heat supplement excludes reanalysis-wide refresh inference', 'complete reanalysis panel was not downloaded again' in heat_text)

contexts=load(context_path)
home_regions={s:r for r,ss in {'West':['CA','WA'],'Midwest':['IL','IN','MI','OH','WI'],'Northeast':['RI','PA','NY','NH','MA','NJ','CT'],'South':['NC','FL','DC','GA','MD','TX','VA']}.items() for s in ss}
check('School context keys match all 42 institutions',set(contexts)=={i['id'] for i in dataset['institutions']})
check('Region derives from home state and discloses branch limit',all(contexts[i['id']]['region']==home_regions[i['state']] and contexts[i['id']]['homeState']==i['state'] and 'branches may lie elsewhere' in contexts[i['id']]['regionBasis'] for i in dataset['institutions']))
check('Every school context has primary evidence URLs; recovered sources no longer called inaccessible',all(x['sources'] and any(s['url'].startswith('https://') for s in x['sources']) for x in contexts.values()) and all('could not be retrieved' not in contexts[i]['note'] for i in ['166027','162928','445188']) and '2026 report' in contexts['186131']['note'])
reader_audit=load(HERE/'READER_COPY_AUDIT.json')
check('Independent reader explanation audit passes all9450 selections',reader_audit['status']=='PASS' and reader_audit['selections']==9450)
check('Reader audit artifact hashes match reviewed guide files',all(sha(SITE/a['path'])==a['sha256'] for a in reader_audit['reviewed_artifacts']))
check('Reader population source links name actual supplied files',all((SITE/'public/data-analysis/campus-safety/data'/name).exists() for name in ['housing_occupancy.csv','enrollment_denominators.csv']) and (DATA/'population_sources.csv').is_file() and 'population_sources.csv' in (SITE/'src/components/CampusReaderSources.astro').read_text(encoding='utf-8'))
overview=page.split('<section class="reader-overview"',1)[1].split('</section>',1)[0]
check('Visible overview binds qualified 2024 combined-housing coverage to current data and four citations',all(text in overview for text in ["For 2024, {coverage.available_rates['2024'].residents} of the 42 schools",'rate combining the listed housing offenses','they do not measure a student’s chance','Housing is also included in the wider on-campus total']) and overview.count('data-campus-citation')==4 and all(url in overview for url in ['${revision}/rates.csv','https://bjs.ojp.gov/content/pub/pdf/ccsvsftr.pdf#page=131','${revision}/coverage.json','https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-D/section-668.46']))

# New resident evidence is checked against original source fields, not inferred
# from the fact that a proposal happens to be labeled accepted.
population_records=rows(DATA/'population_sources.csv')
adopted={(p['unitid'],int(p['year'])):p for p in population_records if p['measure']=='residents' and p['status']=='accepted_actual'}
expected_adopted={('243744',2024):14203,('243744',2025):14042,('211440',2022):3458,('211440',2023):3764,('211440',2024):3988}
check('Five new resident records preserve exact independently supported values',set(adopted)==set(expected_adopted) and all(int(adopted[k]['value'])==v for k,v in expected_adopted.items()))
stanford2024=EXPANSION/'private_other/sources/stanford/factbook2025-mirror-f9a4da8a.pdf'
stanford2025=EXPANSION/'private_other/sources/stanford/housing-current-503e49e7.html'
cmu2024=EXPANSION/'private_other/sources/cmu/asr2024-aa294bda.pdf'
cmu2026=EXPANSION/'private_other/sources/cmu/asr-fresh-7c2a7ceb.pdf'
cmu_eligibility=EXPANSION/'private_other/sources/cmu/housing-families-3324c6f1.html'
ut2024=EXPANSION/'public/retrieved/ut_housing_2024.pdf'
stanford_text=pdf_text(stanford2024,48)
check('Stanford2024 actual student housing fields and autumn date',all(v in stanford_text for v in ['autumn quarter 2024','7,108 students','7,095 students']) and 7108+7095==int(adopted[('243744',2024)]['value']) and 'publisher-hosted copy' in methods and 'could not be authenticated' in methods)
stanford_current=norm(re.sub('<[^>]+>',' ',stanford2025.read_text(encoding='utf-8')))
check('Stanford2025 actual student housing fields and autumn date',all(v in stanford_current for v in ['autumn quarter 2025','6,727','7,315']) and 6727+7315==int(adopted[('243744',2025)]['value']))
cmu_text=pdf_text(cmu2026,81)
check('CMU exact disjoint housing classifications;2025 is blank',all(v in cmu_text for v in ['Undergraduates by Housing (Pittsburgh) Fall 2023 Fall 2024 Fall 2025','University Housing 3,515 3,732','Fraternity & Sorority Housing 249 256']) and 3515+249==3764 and 3732+256==3988)
check('CMU2022 historical housing population',all(v in pdf_text(cmu2024,84) for v in ['University Housing 3,375 3,158 3,515','Fraternity & Sorority Housing 241 300 249']) and 3158+300==3458)
check('CMU graduate-housing policy and census-scope qualification retained','On-campus housing is not available to graduate students' in norm(re.sub('<[^>]+>',' ',cmu_eligibility.read_text(encoding='utf-8'))) and '2024 all-location undergraduate total do not fully reconcile' in methods)
ut_text=pdf_text(ut2024,5)
check('Texas spring2024 residents not assumed to be students only','10,018' in ut_text and 'spring 2024' in ut_text.lower() and ('228778',2024) not in adopted and '**spring 2024**' in methods and 'that candidate is not adopted' in methods)
check('Every new population source hash matches the recovered source bytes',all(adopted[k]['source_sha256']==sha(p) for k,p in [(('243744',2024),stanford2024),(('243744',2025),stanford2025),(('211440',2022),cmu2024),(('211440',2023),cmu2026),(('211440',2024),cmu2026)]))
check('Methods do not retain California-only or no2025 population claims',all(s not in methods for s in ['Resident-normalized rates for the other institutions remain unavailable','No qualified 2025 resident denominator was established','corresponding fall population']))
source_cell_rows=rows(DATA/'source_cells.csv')
check('Princeton2026 records retain both branches and newest year source',len([r for r in source_cell_rows if r['institution_unitid']=='186131' and r['report_edition']=='2026'])==336 and all(r['source_sha256']=='bc5a24834477c9ae9f02fa450e2eb500b676859b384ad20323cd3b39730b5667' for r in source_cell_rows if r['institution_unitid']=='186131' and r['report_edition']=='2026'))
check('Princeton overlap audit preserves224 unchanged2023–24 cells',load(EXPANSION/'ivy_northeast/princeton_2026_source_audit.json')['overlap_comparisons']==224 and not load(EXPANSION/'ivy_northeast/princeton_2026_source_audit.json')['overlap_revisions'])
harvard_missing=[r for r in source_cell_rows if r['institution_unitid']=='166027' and r['geography']=='residential' and r['campus_id'] in ['166027003','166027004','166027008','166027009']]
check('Harvard omitted housing columns remain unknown, not inferred zero',len(harvard_missing)==168 and all(r['analysis_count'] in ['',None] for r in harvard_missing))
check('Hopkins unusual report title is separated from count years','titled 2025' in contexts['162928']['note'] and '2023–2025 crime tables' in contexts['162928']['note'])
check('Stanford2025 population does not imply a complete housing offense numerator',next(y for i in dataset['institutions'] if i['id']=='243744' for y in i['years'] if y['year']==2025)['counts']['residential']['criminal_total'] is None and coverage['available_rates']['2025']['residents']==0)
map_path=SITE/'src/data/campus-map.json'
map_data=load(map_path)
map_sources=CAMPUS/'research/map_navigation_2026_09_25'
map_note=(map_sources/'MAP_SOURCES.md').read_text(encoding='utf8')
map_component=(SITE/'src/components/CampusMap.astro').read_text(encoding='utf8')
map_audit=load(HERE/'MAP_NAVIGATION_AUDIT.json')
check('Independent map source audit passes for exact final asset',map_audit['status']=='PASS' and map_audit['school_count']==42 and map_audit['state_count']==51 and map_audit['map_sha256']==sha(map_path))
check('Map cites boundary, directory and region sources beside its geographic qualification',map_component.count('sources.map(source=>')==1 and '<a data-campus-citation href={source.url}>' in map_component and {s['url'] for s in map_data['sources']}=={'https://github.com/topojson/us-atlas','https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip','https://www2.census.gov/geo/pdfs/maps-data/maps/reference/us_regdiv.pdf'} and 'Its crime report may cover other sites' in map_component and 'Marker sizes and colors do not indicate crime levels' in map_component)
check('Map source versions and non-offense scope explicitly qualified',all(s in map_note for s in ['2017 cartographic state boundaries','not represented as a new 2026 location survey','not property boundaries','us-atlas 3.0.1, d3-geo 3.1.1 and topojson-client 3.1.0']) and (map_sources/'THIRD_PARTY_LICENSES.txt').is_file() and load(map_sources/'MAP_DATA_AUDIT.json')['assetSha256']==sha(map_path))

# Editorial review ledger: grouped factual claims, rather than mechanically
# asserting that a citation appearing beside text establishes its truth.
ledger=[
('C01','Cohort and selection','42 institutions: 10 UC, 8 Ivy and 24 others including SDSU; purposive rather than representative.','PROTOCOL.md; fixed cohort and dataset institutional identifiers.','PASS'),
('C02','Source currency','Audit cutoff is25 September2026 Pacific; original annual reports are now recovered for all42 institutions. Retrieved editions and table years vary, and access does not certify completeness.','Fresh42-school source inventory; recovered Harvard/Merced/Hopkins/Virginia files; new Princeton2026 and Stanford main2026; source-specific original hashes and retained exclusions.','PASS_WITH_QUALIFICATION'),
('C03','Federal archive','2025 bulk is the latest catalog entry checked; calendar years 2022–2024 remain a separate archived option.','federal/years.json; fileList.json; bulk_rechecks.json exact original/current hashes.','PASS'),
('C04','Report year','An offense is assigned to the year reported to police or a campus security authority, not necessarily occurrence year.','34 CFR 668.46(c)(3), freshly opened current eCFR, current through 24 September 2026.','PASS'),
('C05','Geographic scope','Housing is a campus subset; combined geography is campus plus noncampus plus public property. Ordinary off-campus community crime is outside these boundaries.','34 CFR 668.46(a),(c)(5), freshly opened current eCFR; source-table headings.','PASS'),
('C06','Nonadditive counts','Offenses are neither unique people nor report forms; VAWA classifications can overlap core criminal categories.','Federal survey instructions; regulation counting rules; UCSC current p11 multiple-offense disclosure.','PASS'),
('C07','Categories','Eleven specified criminal categories; domestic violence, dating violence and stalking separate. No claim that this includes every newly reportable category.','Archived category dictionary and 2025 survey instructions; current category mappings.','PASS'),
('C08','Branch aggregation','Institution population counted once, branch source scope explicit, ambiguous missing branches withhold relevant comparisons.','Current source-cell decisions and separate numerical audit; original survey campus/UNITID instructions.','PASS'),
('C09','Resident denominators','State Auditor documents actual2022–2024 fall occupancy for ten UCs and SDSU; five added Stanford/CMU observations extend the reviewed population series. Housing properties are not fully matched to Clery geography.','State Auditor PDF62–65; Stanford Facts2025 PDF48 and current housing page; CMU2024 PDF84 and2026 PDF81; exact source fields and sums reread.','PASS_WITH_QUALIFICATION'),
('C10','2025 populations versus rates','Stanford has an adopted autumn2025 student housing population14,042. Its overseas crime years stop2024, so this does not establish a complete institution-wide2025 rate. No2025 enrollment population is adopted.','Exact2025 housing fields6,727+7,315; current population_sources.csv; branch-year coverage and independent current numerical audit.','PASS_WITH_QUALIFICATION'),
('C11','Enrollment','Optional fall headcount includes undergraduate/graduate, full/part-time and distance-only enrollment; snapshots are not person-time.','IPEDS frozen annual files/dictionaries and source-derived denominator records; unchanged file rechecks. PDF6a now links count sources separately from release schedule.','PASS'),
('C12','Annual and pooled formulas','kC/N; pooled is sum counts / sum same-year population snapshots for exactly 2022–2024, not an unweighted mean or cumulative victimization probability.','Algebra; independent numerical audit; eight worked rows recalculated without production builder.','PASS'),
('C13','Missingness','Unknown cells are not zero; source N/A is preserved and contributes structural zero only with explicit scope evidence.','Current normalization decisions, 48 private structural rules, public/UC scope review, independent numerical audit.','PASS'),
('C14','Historical housing applicability','103 numeric and 109 absent-housing campuses apply specifically to archived 2024 federal housing, not earlier/current years.','Retained applicability verification and amendment; website explicitly limits claim to that archive.','PASS'),
('C15','SDSU 2024 geography','Housing1 is within campus1; campus1+noncampus2+public0=3. Both 2025 and 2026 editions agree.','Both original PDFs p7, table headings and rape rows re-read.','PASS'),
('C16','SDSU 2023 revision','Current housing rape8 versus prior7; 2022 older-edition9 explicitly retained; pooled17→18 and 0.70→0.74.','2026 and 2025 SDSU PDF7; current case source-edition attribution; independent arithmetic.','PASS'),
('C17','SDSU 2025 / email','Current 2026-edition table gives 2025 housing10/campus11/noncampus5/public0, combined16; it does not provide complete 2026 calendar figures.','2026 PDF7 and exact listing-linked hash; newdraft filename caveat; email-only figure excluded.','PASS'),
('C18','UC San Diego','Reissued February2026 report supports annual housing rape12/11/20 and pooled43/58,719=0.73; 2022 campus/noncampus counts revised.','Current UCSD cover and PDF142; prior frozen discrepancy audit retained as historical.','PASS'),
('C19','UC Santa Cruz','2024 housing rape38 includes 21 offenses in one disclosure; May2026 reissue is cited at PDF11, not the older PDF12.','Current UCSC PDF11 footnote6 and table; current PDF12 correction statement.','PASS'),
('C20','SDSU population discrepancy','IPEDS41,137 versus CDS/State Auditor39,373 remains unresolved, with one consistent optional enrollment source.','Retained denominator reconciliation; SDSU CDS PDF3 undergraduate34,637+graduate4,736; State Auditor PDF64.','PASS_WITH_QUALIFICATION'),
('C21','Descriptive interpretation','No campus significance test, safety ranking, causal effect or individual victimization probability inferred from these ratios.','Study design; incomplete report/population alignment; regulation and repeated-disclosure examples.','PASS'),
('C22','NCES precedent','National indicator uses FTE and scale10,000; not interchangeable with headcount/residents.','Original retained targeted research review and citation audit. Current indicator web retrieval failed; this claim is retained evidence, not freshly recertified.','PASS_RETAINED_EVIDENCE'),
('C23','BJS comparison','Nine-campus pilot illustrates need to align reporting, recall period, geography and population; no universal underreporting correction inferred.','Fresh BJS report review, printed110/PDF131 comparison box. No new numerical claim about national prevalence.','PASS'),
('C24','Audit limitations','Source/citation, numeric and visual checks are distinct; no external human peer review or agency certification claimed.','Explicit website/report qualification and separate dated audit records.','PASS'),
('C25','42-school notes and regions','Bespoke reporting-scope notes reflect retrieved sources and specific limitations; home-region labels do not describe every branch or relative safety.','School context JSON checked against current source inventory/dataset, source-cell exceptions, private extraction findings, UC/public audit evidence.','PASS'),
('C26','Reader category explanations','All15 selections correspond to the documented category keys:11 criminal offenses, their combined total, and three separate violence/stalking classifications. Descriptions are reading guidance, not exhaustive legal definitions.','Federal survey instructions and category dictionary; no category is relabeled as unique people or every form of crime.','PASS'),
('C27','Reader regions','Four home-region groups plus All regions partition42 schools:West15,Midwest7,Northeast12,South8. Availability statements concern this selected dataset, not regional risk; resident records now include Carnegie Mellon in the Northeast as well as California institutions.','Institution home states and explicit regional assignment; population ledger; updated regionCopy removes California-only limitation. No regional count/rate ranking.','PASS'),
('C28','Reader calculations and narrative','All9450 school/category/year/location selections preserve counts, matching-year populations, rates, missingness and zero distinctions. Combined areas never add housing twice and show no population rate.',f"Independent audit_reader_copy.mjs reconstructs selected values from current dataset; READER_COPY_AUDIT.json records {len(reader_audit['checks'])} checks. This verifies explanations against verified aggregates, not source re-extraction.",'PASS'),
('C29','Reader pooled interpretation','Housing/enrollment pooling uses summed annual populations; combined-area pooling is explicitly a three-year count, not a rate. An ambiguous partial sum is not asserted to be a known lower bound.','Reader conditional copy inspected; independent all-selection checks; mathematical meaning reconciled with methods.','PASS'),
('C30','Reader citations','School markers derive from the same official-name order as42 source entries after a school is selected. R1/R2 avoid geographyG1 collision. Population links distinguish new exact source/period/scope records from retained state-audit and enrollment inputs.','Reader components and source targets inspected, including current population_sources.csv and selected-year populationSources. Jump/return behavior remains a separate browser check.','PASS'),
('C31','Opening summary','The visible overview distinguishes reported counts and population-adjusted rates from personal risk or safety rankings. Its current13of42 finding is explicitly2024 combined listed housing offenses and reads directly from verified coverage. Housing is a campus subset; missing rates are unavailable, not zero.','Four adjacent citations: current rates.csv; BJS PDF131 reporting-versus-survey comparison; coverage.json plus independent reader arithmetic;34CFR668.46 geography. No national coverage estimate or empirical safety claim.','PASS'),
('C32','Map source identity','The navigation asset contains the42 cohort home-directory locations and50 states plus District of Columbia. It uses retained2024 NCES directory coordinates, Census-derived2017 state outlines and Census regions, not a2026 location survey.','Independent original HD2024 ZIP join confirms every identifier, full institutional name, state and coordinate. Pinned us-atlas3.0.1 topology and generation audit identify state geometry; MAP_SOURCES.md retains versions, source links, limitations and licenses. National view bounds include the western Aleutians.','PASS_WITH_QUALIFICATION'),
('C33','Map interpretation','Map points navigate to institutions; they do not locate crimes, residential properties or every reporting branch. State colors identify regions, uniform markers are not crime or safety encodings, and cluster numerals count nearby schools.','Explicit note with three source citations, navigation-only asset fields, region membership and reader source checks. Selected/hover styling denotes interface state. Actual pointer, keyboard, search, resize and focus behavior is reviewed separately in browser tests. Counts, denominators and rates unchanged.','PASS'),
('C34','Stanford housing provenance','Student-only autumn2024 housing counts7,108+7,095 yield14,203; autumn2025 counts6,727+7,315 yield14,042. The2024 university-authored factbook was recovered from a publisher mirror; original official bytes could not be authenticated.','Reread printed46/PDF48 and current official Student Life/Housing page; metadata hashes match adopted records; mirror qualification appears in methods and source note.','PASS_WITH_QUALIFICATION'),
('C35','Carnegie Mellon housing','Fall2022/23/24 resident proxies sum disjoint University Housing and Fraternity/Sorority Housing rows:3,458/3,764/3,988. Current official policy says on-campus housing unavailable to graduate students; Pittsburgh2024 table total equals all-location undergraduate count, an unresolved scope caveat.','Reread2024 ASR84 and2026 ASR81; current housing-family policy; every component and label verified. No exact parcel match or2025 housing count claimed.','PASS_WITH_QUALIFICATION'),
('C36','Texas housing candidate','Spring2024 report says10,018 residents; it does not expressly establish a students-only count or exclude nonstudent occupants. Candidate remains withheld and is not relabeled fall occupancy.','University Housing and Dining2023–2024 report PDF5 reread; no Texas adopted population; methods and school note expressly explain withholding.','PASS_WITH_QUALIFICATION'),
('C37','Recovered Harvard source','Current2025 report tables supply2022–2024 cells for seven locations. Four omitted residential columns remain unknown; a geographically limited fire appendix cannot establish absent housing elsewhere.','Original ASR PDF70–76 and separate fire PDF2/18–34 reviewed;1,176 cells with378 omitted-geography cells; explicit missing residential records retained.','PASS_WITH_QUALIFICATION'),
('C38','Recovered Hopkins source','Source title2025, issueOctober2026 and statistics2023–2025 remain distinct. Missing columns and unanswered Barcelona police request are not converted to complete university coverage.','Recovered original and independent Hopkins/Stanford source audit; title/date/year scope note copied accurately, without renaming the edition.','PASS_WITH_QUALIFICATION'),
('C39','Princeton current2026 edition','Fresh official listing revealed2026 report at/document/4686. Four visible tables provide336 core cells for Main and Forrestal2023–2025;224 overlapping2023–2024 cells unchanged. Obsolete hidden text ignored.','PDF50–53 visually reread;420 overlay numeric checks;84 geography controls; exact hash and overlap comparison. Root independently reviewed all four rendered pages.','PASS'),
('C40','Recovered Merced and Virginia','Original Merced2025 and Virginia2026 reports now support verified source cells. Virginia6-branch original agrees with1,008 prior web-extracted cells; Charlottesville2024 fondling includes50 incidents in one disclosure.','Merced source audit and original PDF; UVA original-file1008-cell and six-table visual verification; specific Charlottesville footnote. Retrieval fixes do not certify complete underlying reporting.','PASS_WITH_QUALIFICATION'),
('C41','Narrow conflict adjudications','Michigan2024 housing fondling7 is usable independently of the conflicting campus total; missing2024 statutory rape still withholds combined figures. Chicago Gleacher2024 housing burglary0 is independently corroborated absent housing; campus-total conflict remains.','Public CRIME_ADJUDICATIONS.json and original Michigan PDF16–17; private count_adjudications.json and exact-year federal housing declaration. No blanket zero fill or undocumented correction.','PASS_WITH_QUALIFICATION'),
('C42','Expanded source search limits','The resident search distinguished actual students, nonstudent occupants, capacity, rounded percentages, partial populations and mismatched dates. Unsuccessful adoption does not prove no public count exists.','Dated acquisition manifests and candidate ledgers across assigned cohorts. Ivy/Northeast63 source attempts preserve17 candidate rows and no forced whole-institution adoption.','PASS_WITH_QUALIFICATION'),
('H01','Heat refresh counts','56,793→57,037, net244: 95 newly added-date rows plus149 net earlier-date revisions; mutable rather than append-only.','Freshness audit, source diff and independent offline verification; no arrest/DV substitution.','PASS'),
('H02','Heat upstream scope','133 requests;131 responses/two failures; specified unchanged DOJ/SANDAG/SDPD/historical weather/Census inputs distinguished from changing whole weather files.','Dated freshness_results and source-by-source audit;97 frozen raw hashes verified,29 historical daily station windows,60 hourly files.','PASS_WITH_QUALIFICATION'),
('H03','Heat outcome distinction','SDPD offense rows are not Sheriff arrests, unique victims or verified domestic-violence cases; partial2026 excluded from fitted models.','SDPD dictionary/source reconciliation and explicit supplement methods.','PASS'),
('H04','Heat reference estimates','Corrected R0 sample64 postal areas/63 fitted DV; +1.91%,p.05287 and +2.74%,p.17903; neither primary p<.05.','revision_models/results/revision_models.csv exact R0 rows. Original wider-sample estimates are not substituted.','PASS'),
('H05','Heat multiplicity / inference','None of24 fixed sensitivity tests has Holm-adjusted p<.05; non-significance is not no association or causation.','revision_tests.csv; separate prior numerical audit; no model refit in freshness supplement.','PASS'),
('H06','Heat geographic/weather gaps','Historical NOAA checks do not prove Open-Meteo panel unchanged; full reanalysis not reacquired and Sheriff latest contents unverified.','Freshness record blocked requests and documentation-only scope; explicit report wording.','PASS_WITH_QUALIFICATION'),
('H07','Heat public aggregates','1,335 daily and416 monthly cells separately sum to57,037; per-cell distinct cases not additive unique people; source identifiers excluded from released outputs.','offline_verification.json; PUBLIC_FILES.json; aggregate privacy and reconciliation audit.','PASS'),
('H08','Heat source version','Supplement gives exact response SHA and official SDPD source URL; future retrieval may differ.','Freshness request/hash ledger and matching second retrieval documented in offline audit.','PASS'),
]
claims=[dict(id=i,topic=t,claim=c,evidence=e,status=s) for i,t,c,e,s in ledger]
reviewed=[page_path,methods_path,context_path,SITE/'src/components/CampusReader.astro',SITE/'src/components/CampusReaderSources.astro',SITE/'src/lib/campus-reader.js',SITE/'src/lib/campus-citations.js',SITE/'src/data/campus-reader-copy.js',HERE/'READER_COPY_AUDIT.json',HERE/'build_current_reports.py',campus_pdf,heat_pdf,DATA/'dataset.json',DATA/'case_study.json',DATA/'coverage.json',DATA/'source_inventory.json',DATA/'source_cells.csv',DATA/'rates.csv',HERE/'CURRENT_DATA_AUDIT.json',HERE/'README.md',HERE/'PRESENTATION_AMENDMENT.md',CAMPUS/'research/RESEARCH_REVIEW.md',HEAT/'freshness_2026_09_25/FRESHNESS_AUDIT.md',HEAT/'freshness_2026_09_25/offline_verification.json',HEAT/'revision_models/results/revision_models.csv',HEAT/'revision_models/results/revision_tests.csv']
reviewed += [DATA/'population_sources.csv',EXPANSION/'ivy_northeast/asr_recheck.json',EXPANSION/'ivy_northeast/population_candidates.csv',EXPANSION/'ivy_northeast/princeton_2026_source_audit.json',EXPANSION/'private_other/POPULATION_PROPOSALS.json',EXPANSION/'public/CRIME_ADJUDICATIONS.json',EXPANSION/'public/UVA_VERIFICATION.json',EXPANSION/'california/MERCED_SOURCE_AUDIT.json']
reviewed += [map_path,SITE/'src/components/CampusMap.astro',SITE/'src/lib/campus-map.js',SITE/'src/styles/campus-map.css',SITE/'scripts/test-campus-map.mjs',HERE/'MAP_NAVIGATION_AUDIT.json',map_sources/'MAP_SOURCES.md',map_sources/'MAP_DATA_AUDIT.json',map_sources/'hd2024_coordinates.json',map_sources/'states-10m.json',map_sources/'THIRD_PARTY_LICENSES.txt']
source_versions=[sdsu_current,sdsu_prior,ucsd,ucsc,occupancy,stanford2024,stanford2025,cmu2024,cmu2026,cmu_eligibility,ut2024,EXPANSION/'ivy_northeast/raw/princeton_asr_2026.pdf',EXPANSION/'ivy_northeast/raw/harvard_asr_report.pdf',EXPANSION/'ivy_northeast/raw/harvard_fire_2025.pdf']
artifacts=[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in reviewed]
sources=[{'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in source_versions]
limits=[
 'PASS applies only to reviewed factual/citation claims and recorded artifact versions. It is not certification of complete crime reporting, true victimization risk, matched property-level populations, or agency approval.',
 'The original related-research review is retained. eCFR geography/report-year provisions and BJS PDF131 were freshly checked; the NCES indicator could not be freshly opened and is supported by the identified prior review rather than relabeled current verification.',
 'All42 institutional report files are now recovered, including original Virginia. Missing branch/year/geography cells and contradictory values remain withheld. Stanford main2026 and overseas2025 editions differ; Hopkins printed title and table years differ. An official latest listing does not certify unpublished updates.',
 'This audit reads report text and reference destinations; final rendered mathematical notation, responsive behavior, reference jump/return interaction, deployment, archive manifests and offline reproduction are separate checks.',
 'Underlying source-cell extraction is covered by separate numerical/source audits. This review directly rereads the principal SDSU, UCSD, UCSC, State Auditor, new Stanford/CMU population and Texas candidate passages, and Princeton/Harvard tables. It does not claim to re-extract every cell at all42 institutions.',
 'Web addresses are mutable. Institutional originals are identified by saved hashes; an official linked report is not evidence of unpublished updates or final certification.',
 'The map reuses the retained2024 directory for institutional home navigation. Simplified2017 Census-derived outlines and point-in-state checks do not establish crime location, housing scope, current legal boundaries or property-level population alignment.',
]
corrections=[
 'Current normalization paragraph now cites current audit/rates rather than archived count outputs.',
 'UCSC citations now target the May2026 reissue at PDF11; the historical research review remains identified as historical.',
 'PDF6 describes the IPEDS release schedule accurately;6a supplies complete files/dictionaries and source-derived population records. Formula population citations use6a.',
 'SDSU PDF1 is labeled as the actual linked document rather than a listing page;2022 older-edition use and newdraft filename are explicit.',
 'Crime/Heat reference estimates explicitly identify the corrected64-postal-area analysis and63 fitted domestic-violence areas.',
 'School guide population links point to actual housing/enrollment files; the selected school source marker is computed. Combined-area pooled copy describes a count rather than division by populations, and ambiguous partial sums are not asserted to be lower bounds.',
 'All42 school notes use plain language for populations, locations covered and earlier federal data. Full state names are searchable alongside school names and abbreviations; region labels describe home location only.',
 'The opening-view amendment removes automatic school selection and San Diego opening highlights. Region browsing does not choose a school. School-specific links, detailed examples, source qualifications, scientific outputs and reviewed PDFs are preserved.',
 'The opening coverage finding now reads from the current audited2024 combined-housing-rate count:13of42. It retains four direct citations and does not imply a national coverage estimate or safety ranking.',
 'Five qualified student-housing observations added for Stanford/Carnegie Mellon; Texas spring residents withheld because student-only scope is not established. Previously blocked report files recovered, Princeton2026 added, and exact sources/periods exposed per selection.',
 'The geographic navigation addition preserves all42 institutional identities and adds versioned directory/boundary/region sources. Independent extent review caught and corrected western Aleutian clipping without changing state paths, school coordinates or scientific measurements.',
]
result={'checked_utc':datetime.now(timezone.utc).isoformat(),'status':'PASS' if all(c['pass'] for c in checks) else 'FAIL','scope':'Independent editorial claim/citation review; final report text and reference annotations; focused primary-source spot checks; distinct from numeric and visual audits.','claim_groups':len(claims),'checks':checks,'claims':claims,'corrections_verified':corrections,'limitations':limits,'reviewed_artifacts':artifacts,'directly_reread_source_versions':sources,'pdf_reference_targets':{'campus':campus_links,'crime_heat':heat_links}}
(HERE/'CURRENT_CITATION_AUDIT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# Current claim and citation audit','',f"**{result['status']} — bounded source-support review.** Checked {result['checked_utc']}. {len(claims)} grouped claims; {sum(c['pass'] for c in checks)}/{len(checks)} repeatable factual/link checks pass.",'','Reviewed current campus webpage/methods,42-school scope notes, report builder, final current campus report and two-page Crime/Heat supplement. This is separate from numerical reconciliation and formula/layout inspection. It does not certify the institutions\' reporting completeness.','','## Claim ledger','','| ID | Claim family | Support and accurate use | Result |','|---|---|---|---|']
for c in claims: lines.append(f"| {c['id']} | {c['topic']}: {c['claim']} | {c['evidence']} | {c['status']} |")
lines+=['','## Corrections verified','']+['- '+s for s in corrections]+['','## Source and review limits','']+['- '+s for s in limits]
lines+=['','## Exact reviewed artifacts','','Paths are relative to the shared project root. Changes to these bytes require a scoped recheck. Source/PDF page locators and clickable link annotations are recorded in the JSON sidecar.','','| Artifact | SHA-256 |','|---|---|']
lines += [f"| `{a['path']}` | `{a['sha256']}` |" for a in artifacts]
lines+=['','## Primary case-source versions','','| Saved original | SHA-256 |','|---|---|']+[f"| `{a['path']}` | `{a['sha256']}` |" for a in sources]
lines+=['','## Audit boundary','','The linked current numerical audit verifies joins, sums and withholding decisions. The visual audit checks rendered equations and pages. Release checks separately verify public-file manifests, complete download targets, replayed outputs and deployed interaction. Neither this citation pass nor a successful official-source download substitutes for those checks.','']
(HERE/'CURRENT_CITATION_AUDIT.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'status':result['status'],'claim_groups':len(claims),'checks':len(checks),'failed':[c['check'] for c in checks if not c['pass']],'campus_pdf_sha256':sha(campus_pdf),'crime_pdf_sha256':sha(heat_pdf)},indent=2))
