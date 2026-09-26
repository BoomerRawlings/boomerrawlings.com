"""Build the explicitly versioned institutional-report series; never overwrite the federal archive.

Run from this folder or pass --frozen and --output for an offline replay of packaged inputs.
Source values remain in source_cells.csv. Analysis exclusions are separate, reversible decisions.
"""
import argparse
import collections
import copy
import csv
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--frozen', type=Path, default=ROOT.parent/'boomerrawlings.com/public/data-analysis/campus-safety/data/dataset.json')
parser.add_argument('--output', type=Path, default=ROOT/'publication/current-2026-09-25')
args = parser.parse_args()
OUT = args.output
OUT.mkdir(parents=True, exist_ok=True)
frozen = json.loads(args.frozen.read_text(encoding='utf8'))
categories = frozen['categories']
core = [c['id'] for c in categories if c['id'] != 'criminal_total']
criminals = [c['id'] for c in categories if c['family'] == 'criminal_offenses' and c['id'] != 'criminal_total']
GEOS = ['residential','oncampus','noncampus','publicproperty']
UI_GEOS = dict(zip(GEOS,['housing','on_campus','noncampus','public_property']))
YEARS = [2022,2023,2024,2025]
inputs = ['uc/current_core_counts.csv','public/current_core_counts.csv','private/current_asr_core_counts.csv','public/uva_web/current_core_counts.csv']
optional = ['private/current_2025_core_counts.csv','private/duke_core_counts.csv']
inputs.extend(p for p in optional if (HERE/p).exists())
# These fixed paths become inputs/sdsu/ in the portable archive.
sdsu_path = HERE/'inputs/sdsu'
if not sdsu_path.exists():
    sdsu_path = ROOT/'research/sdsu_2026'
rows = []
provenance = []
for name in inputs:
    path = HERE/name
    chunk = list(csv.DictReader(path.open(encoding='utf-8-sig',newline='')))
    for r in chunk:
        r['input_file'] = name
    rows.extend(chunk)
    provenance.append({'path':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'rows':len(chunk)})
for name in ['current_asr_core_counts.csv','prior_asr_all_counts.csv']:
    path = sdsu_path/name
    chunk = list(csv.DictReader(path.open(encoding='utf-8-sig',newline='')))
    chunk = [r for r in chunk if r['category'] in core and (name.startswith('current') or r['report_year']=='2022')]
    for r in chunk:
        r['input_file'] = 'inputs/sdsu/'+name
    rows.extend(chunk)
    provenance.append({'path':'inputs/sdsu/'+name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'selected_rows':len(chunk)})

# Reviewed additions are separate from the preserved original extraction inputs.
# A newer source replaces only the exact branch/year/category/geography cells it supplies.
expansion = HERE/'expansion'
count_additions = expansion/'current_core_counts.csv'
superseded = []
cell_key = lambda r: tuple(r[k] for k in ['institution_unitid','campus_id','report_year','category','geography'])
if count_additions.exists():
    additions=list(csv.DictReader(count_additions.open(encoding='utf-8-sig',newline='')))
    replacement_keys={cell_key(r) for r in additions}
    assert len(replacement_keys)==len(additions), 'Duplicate amendment cell'
    superseded=[r for r in rows if cell_key(r) in replacement_keys]
    old_editions={cell_key(r):int(r['report_edition']) for r in superseded}
    for r in additions:
        assert int(r['report_edition'])>=old_editions.get(cell_key(r),0), 'Older edition cannot replace current cell'
        r['input_file']='expansion/current_core_counts.csv'
    rows=[r for r in rows if cell_key(r) not in replacement_keys]+additions
    provenance.append({'path':'expansion/current_core_counts.csv','sha256':hashlib.sha256(count_additions.read_bytes()).hexdigest(),'rows':len(additions),'superseded_cells':len(superseded)})
adjudication_path=expansion/'adjudications.json'
adjudications=json.loads(adjudication_path.read_text(encoding='utf8')) if adjudication_path.exists() else {}
population_path=expansion/'population_additions.csv'
inventory_updates=expansion/'source_inventory_updates.json'
population_additions=list(csv.DictReader(population_path.open(encoding='utf-8-sig',newline=''))) if population_path.exists() else []
population_index={}
for p in population_additions:
    key=(p['unitid'],int(p['year']),p['measure'])
    assert key not in population_index and p['measure'] in ['residents','enrollment']
    assert p['status']=='accepted_actual' and int(p['value'])>0
    assert p['source_url'].startswith('https://') and len(p['source_sha256'])==64
    population_index[key]=p

NOTES = {
 '122409':'2024 rape: housing 1 is included in campus total 1; adding noncampus 2 and public property 0 gives 3. The 2026 report revises 2023 housing rape from 7 to 8. The 2022 observations retain their older 2025 report edition.',
 '110635':'Main-campus report covers 2022–2024; Washington Center covers 2023–2025. Institution-wide totals require both. Berkeley 2023 campus rape includes 39 incidents disclosed in one report between two unaffiliated parties.',
 '110644':'Current report revises 2024 fondling to 86 housing / 93 campus; footnotes describe one reallocated report and 80 repeated incidents between the same parties.',
 '110662':'The report combines dating violence into domestic violence. Both categories are withheld from separate-category comparisons; source values remain downloadable.',
 '110671':'Palm Desert has no housing, but the omitted noncampus column has not been established as an absent geography. All-geography totals requiring that column remain unavailable.',
 '110680':'The February 2026 reissue of the 2025 report revises several 2022 cells. Counts here use the reissued report; the federal snapshot preserves the earlier values.',
 '110714':'The May 2026 report includes an explicit April 30 correction of 2024 domestic-violence data-entry errors. The 2024 housing rape count includes 21 incidents in one report.',
 '134130':'Everglades and Vicenza 2025 have unusable local-agency returns. Their printed counts are retained in source files, but affected comparisons are withheld. UF Jacksonville opened in August 2026 and is excluded from 2022–2025 totals.',
 '139755':'The current report supplies Atlanta, Europe and Savannah tables; the frozen federal inventory also includes Shenzhen. Institution-wide rates are withheld until that scope difference is resolved; the three current branch tables remain inspectable.',
 '170976':'The statutory-rape table labels years 2023, 2022 and 2021; no 2024 value is inferred. The 2024 campus fondling table gives 44 while its footnote gives 43; affected comparisons are withheld.',
 '199120':'The source combines domestic and dating violence in 2024 and omits separate 2025 dating rows. Incompatible category comparisons are withheld. Satellite tables omit housing/noncampus columns; unknown geography is not zero.',
 '204796':'Rape/fondling use the source TOTAL rows, including separately identified Richard Strauss reports. Reports may concern occurrences many years earlier.',
 '228778':'Blank geographic cells remain unknown. Brackenridge began separate campus reporting in 2023; earlier coverage was within main-campus noncampus geography.',
 '234076':'Current tables are provisionally transcribed through the official web reader. PDF bytes and visual layout could not be independently verified; new comparisons are withheld pending that verification.',
 '147767':'Some Chicago-campus rows repeat a year label. Ambiguous year/category values remain unavailable; missing housing columns do not become zero.',
 '215062':'Several branch headers and year columns conflict; two frozen-inventory branches lack current tables. Ambiguous or missing cells remain unavailable.',
 '211440':'The 2025 Pittsburgh fondling components sum to 3 but the printed total is 1. The conflicting row is withheld from derived comparisons.',
 '144050':'Gleacher Center has conflicting printed totals for 2024 burglary and 2025 aggravated assault. Those rows are withheld; explicit all-zero narrative declarations for other listed branches retain their provenance.',
 '445188':'Current report PDF could not be retrieved for verification. Use the separately labeled federal snapshot for historical values.',
 '166027':'Current report PDF could not be retrieved for verification. Use the separately labeled federal snapshot for historical values.',
 '162928':'Current report PDF could not be retrieved for verification. Use the separately labeled federal snapshot for historical values.',
 '182670':'The source reports dating violence within domestic violence; separate category comparisons are withheld. A Lebanon 2024 domestic-violence row also conflicts with its printed total.',
}
NOTES.update(adjudications.get('institution_notes',{}))

rules_path=HERE/'private/structural_geography_rules.json'
structural_rules=json.loads(rules_path.read_text(encoding='utf8')) if rules_path.exists() else []

def decision(r):
    uid, branch, cat, geo, yr = r['institution_unitid'],r['campus_id'],r['category'],r['geography'],int(r['report_year'])
    raw = r['count'].strip()
    value = int(raw) if raw else None
    status = r['status']
    note = r.get('source_note','')
    analysis_status = 'reported_numeric' if value is not None and status == 'reported_numeric' else 'not_reported'
    if status == 'reported_zero_narrative': analysis_status = status
    if status in ['not_applicable_no_corresponding_geography','not_applicable','source_not_applicable']:
        analysis_status='not_applicable_no_geography'
    if status == 'source_NA' and ((uid=='110635' and geo=='noncampus') or (uid in ['110644','110653'] and geo=='residential')):
        analysis_status='not_applicable_no_geography'
    if uid=='110671' and r['campus']=='Palm Desert Center' and geo=='residential':
        analysis_status='not_applicable_no_geography'
        note+=' Palm Desert has no student housing; report PDF pp7,34,165. Omitted housing is structurally absent; omitted noncampus remains unknown.'
    if status=='source_NA' and analysis_status=='not_applicable_no_geography':
        note+=' Explicit no-geography scope verified: UCDC noncampus PDFp23; Irvine Health housing pp199–200; Davis Health housing absent before June2025 opening (2026 report tables/footnotes).'
    if status=='reported_not_applicable':
        note+=' Raw N/A does not alone establish absent geography; withheld unless separately documented.'
        for rule in structural_rules:
            if rule['campus_id']==branch and rule['geography']==geo and yr in rule['years']:
                analysis_status=rule['status'];note=rule['reason']+' Source: '+rule['source_url']+'; PDF p.'+str(rule['pdf_page']);break
    if status=='not_applicable_campus_opened_2026': analysis_status='not_applicable_before_opening'
    if status in ['ambiguous_year_labels','combined_domestic_and_dating_violence','source_total_conflict']:
        analysis_status='ambiguous_source'
    if uid=='234076' and not r.get('source_sha256'): analysis_status='unverified_source'
    if status=='reported_combined_dating_domestic_scope':
        analysis_status='ambiguous_source';note='Source combines domestic and dating violence; the dating footnote also conflicts with the marked year. Separate category comparisons are withheld.'
    if branch=='243744001' and cat in ['domestic_violence','dating_violence']:
        analysis_status='ambiguous_source';note='California dating violence is included under domestic violence in the source definition. Separate-category counts are withheld; no split or footnote-year correction is inferred.'
    if status=='reported_numeric_external_response_incomplete':
        analysis_status='incomplete_coverage';note='Printed value retained; source states that local security/police did not respond to the statistics request. It cannot establish complete reporting.'
    if uid=='110662' and cat in ['domestic_violence','dating_violence']:
        analysis_status='ambiguous_source';note='Domestic and dating violence are combined; not a separable category count.'
    if uid=='182670' and cat in ['domestic_violence','dating_violence']:
        analysis_status='ambiguous_source';note='Dating violence is reported within domestic violence; not separable category counts.'
    if uid=='199120' and yr>=2024 and cat in ['domestic_violence','dating_violence']:
        analysis_status='ambiguous_source';note='Combined category or omitted separate dating row; comparison withheld.'
    if uid=='170976' and yr==2024 and cat=='fondling':
        analysis_status='ambiguous_source';note='Table and footnote disagree: 44 versus 43 campus fondling reports.'
    if (branch,yr,cat) in [('211440001',2025,'fondling'),('144050002',2025,'aggravated_assault'),('144050002',2024,'burglary')]:
        analysis_status='ambiguous_source';note='Printed total conflicts with component counts. Source row preserved; derived comparisons withheld.'
    if uid=='134130' and yr==2025 and r['campus'] in ['Everglades Research and Education Center','Vicenza Institute of Architecture'] and analysis_status!='not_applicable_no_geography':
        analysis_status='incomplete_coverage';note='Source states local-agency data unavailable in usable form for 2025.'
    if uid=='228778' and r['campus']=='Brackenridge Field Laboratory' and yr==2022:
        analysis_status='not_applicable_before_separate_reporting';note='Separate campus reporting began 2023; earlier coverage was main-campus noncampus. This is not a statement about when the property physically opened.'
    for review in adjudications.get('cell_decisions',[]):
        if all(str(r.get(k,''))==str(v) for k,v in review['match'].items()):
            analysis_status=review['analysis_status'];note=review['reason']
    approved = value if analysis_status in ['reported_numeric','reported_zero_narrative'] else None
    return value, approved, analysis_status, note

seen=set()
for r in rows:
    key=tuple(r[k] for k in ['institution_unitid','campus_id','report_year','category','geography'])
    if key in seen: raise ValueError(f'Duplicate source key {key}')
    seen.add(key)
    assert r['category'] in core and r['geography'] in GEOS
    raw,count,status,note=decision(r)
    r.update(reported_count=raw,analysis_count=count,analysis_status=status,analysis_note=note)

def write_csv(path, values):
    keys=list(dict.fromkeys(k for row in values for k in row))
    with path.open('w',encoding='utf8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=keys);w.writeheader();w.writerows(values)

def write_json(name,obj):
    (OUT/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')

write_csv(OUT/'source_cells.csv',rows)
if superseded: write_csv(OUT/'superseded_source_cells.csv',superseded)
write_json('build_inputs.json',{'frozen_sha256':hashlib.sha256(args.frozen.read_bytes()).hexdigest(),'structural_rules_sha256':hashlib.sha256(rules_path.read_bytes()).hexdigest() if rules_path.exists() else None,'inputs':provenance,'population_additions_sha256':hashlib.sha256(population_path.read_bytes()).hexdigest() if population_path.exists() else None,'adjudications_sha256':hashlib.sha256(adjudication_path.read_bytes()).hexdigest() if adjudication_path.exists() else None,'inventory_updates_sha256':hashlib.sha256(inventory_updates.read_bytes()).hexdigest() if inventory_updates.exists() else None})
by_inst=collections.defaultdict(list)
index={}
for r in rows:
    by_inst[r['institution_unitid']].append(r)
    index[(r['institution_unitid'],r['campus_id'],int(r['report_year']),r['category'],r['geography'])]=r

def numeric(r):
    if not r: return None
    if r['analysis_status'] in ['not_applicable_no_geography','not_applicable_before_opening','not_applicable_before_separate_reporting']: return 0
    return r['analysis_count']

current=copy.deepcopy(frozen)
current.update(schemaVersion=2,title='Current institutional annual reports: dated source revision',retrievalDate='2026-09-25',sourceCollection='Institutional reports checked 2026-09-25; cell-specific editions',years=YEARS)
current.pop('coverage',None);current.pop('knownDiscrepancies',None)
for c in current['categories']: c['description']=c['description'].replace('federal criminal-offense table','institutional criminal-offense tables').replace('federal VAWA table','institutional VAWA tables')
geo_cells=[]
population_sources=[]
for inst in current['institutions']:
    uid=inst['id']; rs=by_inst[uid]
    branches={r['campus_id']:r['campus'] for r in rs}
    if not branches: branches={b['id']:b['name'] for b in inst['campuses']}
    inst['campuses']=[{'id':k,'name':v} for k,v in branches.items()]
    inst['branchCount']=len(branches)
    inst['notes']=[NOTES[uid]] if uid in NOTES else []
    inst['notes'].append('Only verified counts in the named institutional source editions are used. Unavailable years or ambiguous cells are not filled from the federal archive. See geographic breakdown and source inventory.')
    old_years={y['year']:y for y in inst['years']}
    inst['years']=[]
    for yr in YEARS:
        year={k:old_years.get(yr,{}).get(k) for k in ['enrollment','residents','fte','distanceOnly']}
        year['populationSources']={}
        for measure in ['residents','enrollment']:
            added=population_index.get((uid,yr,measure))
            if added:
                if year[measure] is not None and year[measure]!=int(added['value']):
                    assert added.get('supersession_reason'), 'Replacing an existing population requires documented reason'
                year[measure]=int(added['value'])
                source=dict(added)
            elif year[measure] is not None:
                source={'source_id':f'frozen-{uid}-{yr}-{measure}','unitid':uid,'year':str(yr),'measure':measure,'value':str(year[measure]),'status':'retained_actual','period_label':f'Fall {yr}','source_url':'https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62' if measure=='residents' else 'https://nces.ed.gov/ipeds/use-the-data/download-access-database','source_title':'California State Auditor, Report 2024-111, Tables A.1–A.2' if measure=='residents' else 'Integrated Postsecondary Education Data System fall enrollment','source_sha256':hashlib.sha256(args.frozen.read_bytes()).hexdigest(),'hash_basis':'Preserved original dataset; raw population-source hashes and rows are in the original archive.','scope_note':inst.get('residentNote','') if measure=='residents' else 'Institution-wide fall enrollment; not a housing population.'}
            else: continue
            population_sources.append(source)
            year['populationSources'][measure]=source
        year.update(year=yr,counts={},countStatus={},sourceEditions=sorted(set(str(r['report_edition']) for r in rs if int(r['report_year'])==yr)))
        for geo in GEOS:
            counts={};statuses={}
            for cat in core:
                relevant=[index.get((uid,bid,yr,cat,geo)) for bid in branches]
                # New UF Jacksonville has no reportable geography until 2026.
                relevant=[r for r in relevant if not (r and r['campus']=='UF Jacksonville')]
                values=[numeric(r) for r in relevant]
                value=sum(values) if values and all(v is not None for v in values) else None
                if uid=='139755': value=None
                counts[cat]=value
                statuses[cat]='complete_current_source_scope' if value is not None else 'unavailable_missing_ambiguous_or_scope_unresolved'
            vals=[counts[c] for c in criminals]
            counts['criminal_total']=sum(vals) if all(v is not None for v in vals) else None
            statuses['criminal_total']='complete' if counts['criminal_total'] is not None else 'unavailable_component'
            year['counts'][geo]=counts;year['countStatus'][geo]=statuses
        inst['years'].append(year)
    if any((uid,yr,'residents') in population_index for yr in YEARS):
        inst['residentNote']='Dated actual student-housing populations are documented in the population-source ledger. Source dates and housing-property scope vary; the resulting ratios are approximate reporting comparisons, not individual victimization probabilities.'
    for r in rs:
        if int(r['report_year']) not in YEARS: continue
        geo_cells.append({'unitid':uid,'campus_id':r['campus_id'],'campus_name':r['campus'],'year':int(r['report_year']),'category':r['category'],'geography':UI_GEOS[r['geography']],'count':r['analysis_count'],'status':r['analysis_status'],'source_url':r['source_url'],'report_edition':r['report_edition'],'source_pdf_page':r['pdf_page'],'notes':r['analysis_note']})
    for bid,bname in branches.items():
        for yr in YEARS:
            for geo in GEOS:
                parts=[index.get((uid,bid,yr,cat,geo)) for cat in criminals]
                existing=[p for p in parts if p]
                if not existing: continue
                vals=[numeric(p) for p in parts]
                valid=all(v is not None for v in vals)
                value=sum(vals) if valid else None
                source=existing[0]
                is_na=valid and all(p['analysis_status'] in ['not_applicable_no_geography','not_applicable_before_opening','not_applicable_before_separate_reporting'] for p in parts)
                na_status='not_applicable_before_separate_reporting' if is_na and any(p['analysis_status']=='not_applicable_before_separate_reporting' for p in parts) else 'not_applicable_before_opening' if is_na and any(p['analysis_status']=='not_applicable_before_opening' for p in parts) else 'not_applicable_no_geography'
                geo_cells.append({'unitid':uid,'campus_id':bid,'campus_name':bname,'year':yr,'category':'criminal_total','geography':UI_GEOS[geo],'count':None if is_na else value,'status':na_status if is_na else 'reported_numeric' if valid else 'not_reported','source_url':source['source_url'],'report_edition':source['report_edition'],'source_pdf_page':source['pdf_page'],'notes':'Calculated sum of 11 criminal-offense categories; all component locators and decisions are in source_cells.csv. '+(NOTES.get(uid,'') if not valid else '')})

write_json('dataset.json',current)
write_csv(OUT/'population_sources.csv',population_sources)
write_json('geography.json',{'checked':'2026-09-25','institutions':[{'unitid':i['id'],'name':i.get('officialName',i['name']),'short_name':i['shortName']} for i in current['institutions']],'categories':[{'key':c['id'],'label':c['label']} for c in categories],'cells':geo_cells})

# Exact same three-year pooling rule as the archived study, with new source coverage.
rates=[]
for inst in current['institutions']:
    for cat in categories:
        for period in [*YEARS,'pooled']:
            selected=[y for y in inst['years'] if y['year'] in ([2022,2023,2024] if period=='pooled' else [period])]
            for measure,geo,pop in [('residents','residential','residents'),('enrollment','oncampus','enrollment'),('housingEnrollment','residential','enrollment')]:
                c=[y['counts'][geo][cat['id']] for y in selected];p=[y[pop] for y in selected]
                count=sum(c) if all(x is not None for x in c) else None
                population=sum(p) if all(x is not None and x>0 for x in p) else None
                rates.append({'unitid':inst['id'],'institution':inst['name'],'period':period,'category':cat['id'],'measure':measure,'geography':geo,'reported_count':count,'population_sum':population,'years':len(selected),'rate_per_1000':1000*count/population if count is not None and population else None,'source_editions':';'.join(sorted(set(e for y in selected for e in y['sourceEditions']))),'source_basis':current['sourceCollection']})
write_csv(OUT/'rates.csv',rates)

cases=[]
for uid,bid,label in [('110680','110680001','UC San Diego'),('122409','122409001','San Diego State main campus')]:
    inst=next(i for i in current['institutions'] if i['id']==uid)
    for period in [2022,2023,2024,'pooled']:
        wanted=[2022,2023,2024] if period=='pooled' else [period]
        src=[index[(uid,bid,y,'rape','residential')] for y in wanted]
        count=sum(numeric(r) for r in src)
        pop=sum(next(y['residents'] for y in inst['years'] if y['year']==yr) for yr in wanted)
        cases.append({'institution':label,'unitid':uid,'period':period,'asr_housing_rape_count':count,'fall_occupancy_sum':pop,'rate_per_1000':1000*count/pop,'sources':[{'url':r['source_url'],'edition':r['report_edition'],'year':r['report_year']} for r in src],'scope':'Named main-campus housing / State Auditor fall occupancy; property boundaries incompletely matched.'})
write_json('case_study.json',cases)
coverage={'checked':'2026-09-25','source_cells':len(rows),'ui_cells':len(geo_cells),'institutions':42,'institutions_with_extracted_cells':len([u for u in by_inst if by_inst[u]]),'branches_with_extracted_cells':len(set((r['institution_unitid'],r['campus_id']) for r in rows)),'raw_statuses':dict(collections.Counter(r['status'] for r in rows)),'analysis_statuses':dict(collections.Counter(r['analysis_status'] for r in rows)),'rates':len(rates),'available_rates':{str(yr):{m:sum(r['rate_per_1000'] is not None for r in rates if r['period']==yr and r['measure']==m and r['category']=='criminal_total') for m in ['residents','enrollment']} for yr in [*YEARS,'pooled']},'population_coverage':{str(yr):{m:sum(any(y['year']==yr and y[m] is not None for y in i['years']) for i in current['institutions']) for m in ['residents','enrollment']} for yr in YEARS},'housing_count_coverage':{str(yr):sum(any(y['year']==yr and y['counts']['residential']['criminal_total'] is not None for y in i['years']) for i in current['institutions']) for yr in YEARS},'limitations':['Retrieval date is an audit cutoff, not certification of unpublished data or reporting completeness.','Populations require a dated actual student headcount; capacity, rounded percentages and incomplete subsets are not substituted. See the population-source ledger for dates and scope.','UVA counts remain provisional until PDF/visual verification.','Not-applicable geography is distinct from a reported zero; its structural contribution is zero only under an explicit source status.']}
if not any(r['institution_unitid']=='234076' and r['analysis_status']=='unverified_source' for r in rows):
    coverage['limitations'].remove('UVA counts remain provisional until PDF/visual verification.')
write_json('coverage.json',coverage)

inventories={}
for folder,name in [('uc','inventory.json'),('public','source_inventory.json'),('private','source_inventory.json')]:
    for entry in json.loads((HERE/folder/name).read_text(encoding='utf8'))['institutions']:
        inventories[str(entry['unitid'])]=entry
sdsu_inventory=json.loads((sdsu_path/'source_inventory.json').read_text(encoding='utf8'))
sdsu_source=sdsu_inventory['selected_count_source']
inventories['122409']={'unitid':'122409','landing_url':sdsu_inventory['listing']['requested_url'],'report_url':sdsu_source['final_url'],'report_edition':2026,'report_years':[2023,2024,2025],'checked_utc':sdsu_source['retrieved_utc'],'sha256':sdsu_source['sha256'],'limitations':[sdsu_source['publication_status_note']]}
if inventory_updates.exists():
    for entry in json.loads(inventory_updates.read_text(encoding='utf8')):
        inventories[str(entry['unitid'])].update(entry)
inventory=[]
for inst in current['institutions']:
    uid=inst['id'];original=inventories[uid];rs=by_inst[uid]
    urls=sorted(set(r['source_url'].split('#')[0] for r in rs))
    qualifications=list(original.get('limitations',[]))
    if NOTES.get(uid): qualifications.insert(0,NOTES[uid])
    inventory.append({'unitid':uid,'institution':inst.get('officialName',inst['name']),'landing_url':original['landing_url'],'report_url':original.get('report_url'),'editions':sorted(set(r['report_edition'] for r in rs)) or [str(original.get('report_edition') or 'Unverified')],'report_years':sorted(set(int(r['report_year']) for r in rs)),'checked_utc':original.get('checked_utc'),'source_files':[{'url':url,'sha256':sorted(set(r.get('source_sha256','') for r in rs if r['source_url'].split('#')[0]==url))} for url in urls],'source_cells':len(rs),'branch_count':inst['branchCount'],'verification':'provisional web-text extraction; current calculations withheld' if any(r['analysis_status']=='unverified_source' for r in rs) else 'current source cells extracted; ambiguous cells excluded' if rs else 'current source counts not verified; current rates withheld','qualifications':qualifications,'denominator_sources':original.get('denominator_sources',[]),'adopted_populations':[p for p in population_sources if p['unitid']==uid and p['measure']=='residents'],'latest_report_check':original.get('latest_report_check')})
write_json('source_inventory.json',inventory)
print(json.dumps(coverage,indent=2))
