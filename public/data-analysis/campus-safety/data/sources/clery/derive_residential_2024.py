"""2024-only residential totals with separately corroborated absent geography.

Never changes frozen source cells or earlier-year counts. Blank housing cells can
be excluded from the 2024 geographic sum only when the current official API,
explicitly labeled SurveyYear=2024, says that campus provides no student housing.
"""
from pathlib import Path
import collections,csv,hashlib,json
HERE=Path(__file__).resolve().parent;OUT=HERE/'normalized'
with(OUT/'cohort_campus_counts_2022_2024.csv').open(encoding='utf-8-sig',newline='')as f:rows=[r for r in csv.DictReader(f)if r['year']=='2024'and r['geography']=='residential_facilities']
context=json.loads((OUT/'cohort_campus_context_current.json').read_text());contexts={str(r['UnitID']):r for r in context}
NO_HOUSING='This institution does not provide On-campus Student Housing Facilities.'
classified=[]
for r in rows:
    c=contexts[r['campus_id']];no_housing=c.get('SurveyYear')==2024 and c.get('OnCampusHousingInfo','').strip()==NO_HOUSING
    if r['count']!='':
        count=int(r['count']);status='reported_numeric';assert not(no_housing and count>0), 'Conflict requires review'
    elif r['source_year_filter']=='1'and r['raw_source_value']==''and no_housing:
        count=None;status='excluded_geography_no_housing_corroborated_2024'
    else:count=None;status='unresolved_missing'
    classified.append({**r,'applicability_status':status,'count_for_sum':count,'api_survey_year':c.get('SurveyYear'),'api_no_housing_declaration':no_housing,'api_source_url':c['source_url'],'api_source_sha256':c['source_sha256']})
groups=collections.defaultdict(list)
for r in classified:groups[(r['unitid'],r['family'],r['offense_code'])].append(r)
result=[]
for key,rr in sorted(groups.items()):
    numeric=[r for r in rr if r['applicability_status']=='reported_numeric'];excluded=[r for r in rr if r['applicability_status']=='excluded_geography_no_housing_corroborated_2024'];missing=[r for r in rr if r['applicability_status']=='unresolved_missing']
    result.append(dict(collection_year=2025,year=2024,unitid=key[0],institution_label=rr[0]['institution_label'],cohort=rr[0]['cohort'],family=key[1],geography='residential_facilities',offense_code=key[2],offense_label=rr[0]['offense_label'],count=sum(r['count_for_sum']for r in numeric)if not missing else None,observed_sum=sum(r['count_for_sum']for r in numeric),campus_count=len(rr),numeric_campus_count=len(numeric),corroborated_no_housing_campus_count=len(excluded),unresolved_campus_count=len(missing),corroborated_no_housing_campus_ids=';'.join(r['campus_id']for r in excluded),status='complete_numeric_or_corroborated_no_housing_2024'if not missing else'incomplete_campus_coverage',scope='All frozen-2025 institution branches; only2024 API no-housing declarations allow absent geography to be excluded',source_vintage_caveat='Counts retain frozen2025 bulk values; geography applicability additionally uses official API SurveyYear2024 snapshot checked2026-09-25. Raw blanks stay blank; no historical backfill.'))
def write(name,data):
    with(OUT/name).open('w',encoding='utf-8-sig',newline='')as f:
        w=csv.DictWriter(f,fieldnames=list(data[0]));w.writeheader();w.writerows(data)
write('cohort_campus_residential_applicability_2024.csv',classified)
write('cohort_institution_residential_2024_applicable_geography.csv',result)
report={'status':'PASS'if all(r['unresolved_campus_count']==0 for r in result)else'PARTIAL','year':2024,'campus_rows':len(classified),'institution_rows':len(result),'institutions':len({r['unitid']for r in result}),'numeric_campuses':len({r['campus_id']for r in classified if r['applicability_status']=='reported_numeric'}),'corroborated_no_housing_campuses':len({r['campus_id']for r in classified if r['applicability_status']=='excluded_geography_no_housing_corroborated_2024'}),'unresolved_campuses':len({r['campus_id']for r in classified if r['applicability_status']=='unresolved_missing'}),'historical_counts_changed':False,'original_blank_cells_overwritten':False,'interpretation':'A derived sum over applicable residential geography; corroborated absence of geography is explicitly distinguished from a reportedzero. Does not establish alignment to occupancy denominator.','file_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in [OUT/'cohort_campus_residential_applicability_2024.csv',OUT/'cohort_institution_residential_2024_applicable_geography.csv']}}
(HERE/'residential_applicability_2024_verification.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
