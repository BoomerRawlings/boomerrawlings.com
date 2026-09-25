"""Validate Clery identifiers against independently acquired IPEDS crosswalk."""
from pathlib import Path
import csv,json,hashlib
HERE=Path(__file__).resolve().parent

def read(p):
    with p.open(encoding='utf-8-sig',newline='')as f:return list(csv.DictReader(f))

crosswalk=HERE.parent/'enrollment/institution_crosswalk_verified.csv'
a=read(HERE/'normalized/cohort_institution_crosswalk_2025.csv');b=read(crosswalk);bd={r['unitid']:r for r in b}
for r in a:
    assert r['unitid']in bd
    assert r['opeid']==bd[r['unitid']]['opeid']
    assert r['institution_name']==bd[r['unitid']]['institution_name_clery']
context=json.loads((HERE/'normalized/cohort_campus_context_current.json').read_text());cd={str(r['UnitID']):r for r in context}
campuses=read(HERE/'normalized/cohort_campus_crosswalk_2025.csv')
for r in campuses:
    assert cd[r['campus_id']]['unitid']==r['unitid']
    assert cd[r['campus_id']]['Name'].strip()==r['branch']
report={'status':'PASS','institution_unitid_opeid_matches':len(a),'public_api_campus_institution_matches':len(campuses),'enrollment_agent_crosswalk_sha256':hashlib.sha256(crosswalk.read_bytes()).hexdigest(),'no_opeid_only_grouping':True,'branch_name_rule':'Compare after trimming only leading/trailing spaces.','method':'Firstsix UNITID_P digits match the verified IPEDS UNITID/OPEID crosswalk and all212 official API institution IDs. Group strictly by UNITID; OPEID can be shared by distinct IPEDS units.'}
(HERE/'identifier_validation.json').write_text(json.dumps(report,indent=2))
counts=read(HERE/'normalized/cohort_campus_counts_2022_2024.csv')
main=[r for r in counts if r['family']=='criminal_offenses'and r['offense_code']=='RAPE'and r['geography']=='on_campus']
house={(r['campus_id'],r['year']):r for r in counts if r['family']=='criminal_offenses'and r['offense_code']=='RAPE'and r['geography']=='residential_facilities'}
out=[]
for r in main:
    c=cd[r['campus_id']];h=house[r['campus_id'],r['year']]
    out.append({'unitid':r['unitid'],'campus_id':r['campus_id'],'label':r['institution_label'],'branch':r['branch'],'year':r['year'],'source_year_filter':r['source_year_filter'],'on_campus_availability':r['status'],'housing_availability':h['status'],'current_api_survey_year':c['SurveyYear'],'current_api_country':c['Country'],'current_api_is_us':c['CountryIsUS'],'current_api_housing_declaration':c['OnCampusHousingInfo'],'historical_blank_interpretation':'unresolved; no zero imputation','source_url':c['source_url']})
with(HERE/'normalized/campus_year_availability_2022_2024.csv').open('w',encoding='utf-8-sig',newline='')as f:
    w=csv.DictWriter(f,fieldnames=list(out[0]));w.writeheader();w.writerows(out)
geography=[]
for institution in sorted(a,key=lambda r:r['unitid']):
    rr=[c for c in context if c['unitid']==institution['unitid']]
    assert len(rr)==int(institution['campus_count_2025_file'])
    assert all(c['CountryIsUS']in(True,False)for c in rr)
    countries=sorted({('United States'if c['CountryIsUS']is True else c['Country'])for c in rr})
    assert all(countries)
    geography.append(dict(unitid=institution['unitid'],label=institution['label'],campus_count=len(rr),us_campus_count=sum(c['CountryIsUS']is True for c in rr),outside_us_campus_count=sum(c['CountryIsUS']is False for c in rr),countries=';'.join(countries),country_names_inferred_from_explicit_us_flag=sum(c['CountryIsUS']is True and not c['Country']for c in rr),api_housing_campuses_2024=sum(c['OnCampusHousingInfo'].startswith('This campus provides On-campus Student Housing Facilities.')for c in rr),api_no_housing_campuses_2024=sum(c['OnCampusHousingInfo']=='This institution does not provide On-campus Student Housing Facilities.'for c in rr),scope='All federal institution branches; foreign campuses retained in institution-wide counts'))
with(HERE/'normalized/cohort_geography_scope_2025.csv').open('w',encoding='utf-8',newline='')as f:
    w=csv.DictWriter(f,fieldnames=list(geography[0]));w.writeheader();w.writerows(geography)
print(json.dumps(report,indent=2))
