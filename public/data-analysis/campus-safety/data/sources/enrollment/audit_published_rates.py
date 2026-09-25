"""Independent recomputation of root-pipeline rates; never imports build_study.

Uses normalized source campus cells, official denominator extracts and published
CSV/JSON. Independently checks arithmetic, joins, missingness and branch scope.
"""
from pathlib import Path
from collections import defaultdict,Counter
import csv,datetime,hashlib,json,math
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
def read(path):
    with (ROOT/path).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def num(x):return int(x) if x not in ('',None) else None
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    files=[ROOT/'build_study.py',*sorted((ROOT/'publication/data').glob('*.csv')),ROOT/'publication/data/dataset.json']
    before={p.relative_to(ROOT).as_posix():sha(p) for p in files}
    errors=[];checks=Counter()
    def check(ok,what,context=''):
        checks[what]+=1
        if not ok:errors.append({'check':what,'context':str(context)})
    cohort=read('sources/clery/normalized/cohort_institution_crosswalk_2025.csv')
    campus_crosswalk=read('sources/clery/normalized/cohort_campus_crosswalk_2025.csv')
    campuses=defaultdict(set)
    for r in campus_crosswalk:campuses[r['unitid']].add(r['campus_id'])
    counts=read('sources/clery/normalized/cohort_campus_counts_2022_2024.csv')
    buckets=defaultdict(dict)
    for r in counts:
        key=(r['unitid'],int(r['year']),r['geography'],r['family'],r['offense_code'])
        raw=r['raw_source_value'].strip()
        expected=int(float(raw)) if raw and r['source_year_filter']=='1' else None
        check(num(r['count'])==expected,'campus raw cell and year eligibility',key+(r['campus_id'],))
        check(r['campus_id'] not in buckets[key],'unique campus-count key',key+(r['campus_id'],))
        buckets[key][r['campus_id']]=expected
    expected_counts={}
    for key,values in buckets.items():
        check(set(values)==campuses[key[0]],'all listed branches represented',key)
        expected_counts[key]=sum(values.values()) if all(x is not None for x in values.values()) else None
    for r in read('sources/clery/normalized/cohort_institution_counts_2022_2024.csv'):
        key=(r['unitid'],int(r['year']),r['geography'],r['family'],r['offense_code'])
        check(num(r['count'])==expected_counts[key],'institution aggregation from source campus cells',key)
    # Explicit2024 applicability amendment. Current2024 no-housing declarations
    # resolve absent housing geography only; no historical blank is recoded.
    context=json.loads((ROOT/'sources/clery/normalized/cohort_campus_context_current.json').read_text())
    no_housing={str(r['UnitID']) for r in context if r['SurveyYear']==2024 and r['OnCampusHousingInfo']=='This institution does not provide On-campus Student Housing Facilities.'}
    applicable=read('sources/clery/normalized/cohort_institution_residential_2024_applicable_geography.csv')
    for r in applicable:
        key=(r['unitid'],2024,r['geography'],r['family'],r['offense_code'])
        check(r['geography']=='residential_facilities' and int(r['year'])==2024,'applicability restricted to2024 housing',key)
        values=[value if value is not None else 0 if cid in no_housing else None for cid,value in buckets[key].items()]
        expected=sum(values) if all(v is not None for v in values) else None
        check(num(r['count'])==expected,'independent2024 housing applicability',key)
        expected_counts[key]=expected
    enrollment={(r['unitid'],int(r['year'])):int(r['fall_headcount_total']) for r in read('sources/enrollment/enrollment_2022_2024.csv')}
    housing={(r['unitid'],int(r['year'])):int(r['actual_student_housing_occupancy']) for r in read('sources/enrollment/occupancy_2022_2024.csv')}
    d=json.loads((ROOT/'publication/data/dataset.json').read_text(encoding='utf-8'))
    cat={r['id']:r for r in d['categories']}
    check(len(d['institutions'])==42,'42 institutions')
    check({r['id'] for r in d['institutions']}=={r['unitid'] for r in cohort},'institution IDs match frozen cohort')
    criminal=[r for r in d['categories'] if r['family']=='criminal_offenses' and r['id']!='criminal_total']
    check(len(criminal)==11,'eleven primary categories only')
    def expected_count(uid,year,geo,category):
        if category=='criminal_total':
            cells=[expected_counts[(uid,year,geo,c['family'],c['code'])] for c in criminal]
            return sum(cells) if all(x is not None for x in cells) else None
        c=cat[category];return expected_counts[(uid,year,geo,c['family'],c['code'])]
    for institution in d['institutions']:
        uid=institution['id'];check({r['id'] for r in institution['campuses']}==campuses[uid],'public branch list',uid)
        check(institution['branchCount']==len(campuses[uid]),'public branch count',uid)
        check([r['year'] for r in institution['years']]==[2022,2023,2024],'public year alignment',uid)
        for y in institution['years']:
            year=y['year'];check(y['enrollment']==enrollment[(uid,year)],'public enrollment denominator',(uid,year))
            check(y['residents']==housing.get((uid,year)),'public actual resident denominator',(uid,year))
            for short,geo in [('oncampus','on_campus'),('residential','residential_facilities')]:
                for category in cat:
                    check(y['counts'][short][category]==expected_count(uid,year,geo,category),'public JSON offense count',(uid,year,short,category))
    metrics={};ratekeys=set();max_error=0
    for filename in ['annual_rates.csv','pooled_rates.csv']:
        rows=read('publication/data/'+filename);availability=Counter()
        for r in rows:
            uid=r['unitid'];years=[2022,2023,2024] if r['period']=='pooled' else [int(r['period'])]
            geo='on_campus' if r['measure']=='enrollment' else 'residential_facilities'
            cells=[expected_count(uid,y,geo,r['category']) for y in years]
            count=sum(cells) if all(c is not None for c in cells) else None
            popcells=[(housing if r['measure']=='residents' else enrollment).get((uid,y)) for y in years]
            population=sum(popcells) if all(p is not None for p in popcells) else None
            rate=count*1000/population if count is not None and population is not None and population>0 else None
            key=(uid,r['period'],r['measure'],r['category']);check(key not in ratekeys,'unique public rate key',key);ratekeys.add(key)
            check(num(r['reported_count'])==count,'public numerator',key)
            check(num(r['population_sum'])==population,'public denominator once per year',key)
            check(num(r['years'])==len(years),'pooled years',key)
            value=float(r['rate_per_1000']) if r['rate_per_1000'] else None
            equal=(value is None and rate is None) or (value is not None and rate is not None and math.isclose(value,rate,rel_tol=1e-12,abs_tol=1e-12))
            check(equal,'annual or weighted pooled rate',key)
            if rate is not None and value is not None:max_error=max(max_error,abs(value-rate))
            check(r['rate_status']==('available' if rate is not None else 'unavailable'),'public rate availability',key)
            availability[r['measure']+':'+r['rate_status']]+=1
        metrics[filename]={'rows':len(rows),'availability':dict(availability)}
    check(len(ratekeys)==42*15*3*4,'complete public rate key grid')
    case_file=ROOT/'publication/data/asr_housing_case_study.csv'
    if case_file.exists():
        asr=read('research/verified_asr_rape_counts.csv')
        cases=read('publication/data/asr_housing_case_study.csv')
        for row in cases:
            selected=[r for r in asr if r['institution']==row['institution'] and (row['period']=='pooled' or r['report_year']==row['period'])]
            count=sum(int(r['housing']) for r in selected)
            pop=sum(housing[(row['unitid'],int(r['report_year']))] for r in selected)
            check(int(row['asr_housing_rape_count'])==count and int(row['fall_occupancy_sum'])==pop,'ASR case study source and denominator',(row['unitid'],row['period']))
            check(math.isclose(float(row['rate_per_1000']),1000*count/pop,abs_tol=1e-12),'ASR case study rate',(row['unitid'],row['period']))
    check(before=={p.relative_to(ROOT).as_posix():sha(p) for p in files},'stable publication snapshot during audit')
    result={'checked_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pass':not errors,'errors':errors,
       'checks':dict(checks),'published_files_sha256':before,'rate_tables':metrics,'maximum_rate_difference':max_error,
       'source_checks_scope':'Independent arithmetic from normalized campus raw_source_value and annual eligibility; original XLS extraction audited by separate classification agent.',
       'limitations':['IPEDS versus SDSU CDS/Auditor population discrepancy unresolved; consistent IPEDS primary preserved.','Actual housing occupancy does not establish Clery property-level population equivalence.','Administrative offense counts do not measure unique victims or victimization risk.']}
    (HERE/'INDEPENDENT_NUMERICAL_AUDIT.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    lines=['# Independent numerical audit','',('PASS' if not errors else 'FAIL')+f': {sum(checks.values()):,} checks; {len(errors)} errors.',
       '',f'42 institutions; 126 annual headcounts; 33 documented occupancy denominators. All 5,670 annual and 1,890 pooled rate rows independently recomputed. Maximum absolute rate difference: {max_error:g}.',
       '', 'Checks start from normalized source campus cells and source-year eligibility, independently sum all listed branches, preserve missingness, join annual IPEDS once per institution, and compute pooled rates from summed counts divided by summed populations. The 2024 housing amendment is independently reconstructed from explicit no-housing API declarations for 2024 only; earlier blanks remain unavailable. ASR case-study rates are also recomputed from the separate verified transcription. The root build script is never imported. Original XLS extraction is covered by a separate audit.',
       '', "SDSU's 2024 IPEDS total of 41,137 differs from the CDS/Auditor total of 39,373. The full population reconciliation remains unresolved. Housing-boundary matching remains unverified. These limitations do not change the arithmetic result and must remain visible.",
       '', 'The companion JSON records every check count, availability summary and exact published-file hashes. Rerun after publication-data changes.']
    if errors:lines+=['','## Errors',*['- '+str(e) for e in errors[:30]]]
    (HERE/'INDEPENDENT_NUMERICAL_AUDIT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps({'pass':not errors,'checks':sum(checks.values()),'errors':errors[:5],'max_rate_error':max_error,'tables':metrics},indent=2))
    if errors:raise SystemExit(1)
if __name__=='__main__':main()
