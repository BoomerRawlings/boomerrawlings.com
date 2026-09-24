"""Normalize official DOJ public aggregates; no record-level data, no fitted models."""
from pathlib import Path
import csv,json,hashlib,collections,re,datetime
import openpyxl
HERE=Path(__file__).resolve().parent;RAW=HERE/'raw';OUT=HERE/'aggregates';OUT.mkdir(exist_ok=True)
def read(p):
 with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def write(name,rows):
 assert rows,name
 with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def integer(s):return None if s=='' else int(s)
def cellsum(rows,k):
 vals=[r[k] for r in rows if r[k] is not None]
 return sum(vals) if vals else None
DVNAME='DVRCA_2001-2025.csv';ARNAME='OnlineArrestData1980-2025.csv';COUNTY='San Diego County';SHERIFF="San Diego Co. Sheriff's Department"
dv=read(RAW/DVNAME);ar=read(RAW/ARNAME)
dvm=list(dv[0])[4:];arm=list(ar[0])[5:]
assert len({tuple(r[k]for k in ['YEAR','COUNTY','AGENCY_NAME','MONTH'])for r in dv})==len(dv)
assert len({tuple(r[k]for k in ['YEAR','COUNTY','GENDER','RACE','AGE_GROUP'])for r in ar})==len(ar)
for r in dv:
 r['YEAR']=int(r['YEAR']);r['MONTH']=int(r['MONTH'])
 for k in dvm:r[k]=integer(r[k]);assert r[k] is None or r[k]>=0
 # Preserve official rows even when a component exceeds the published total; audit separately.
 assert r['WEAPONS_INVOLVED']==sum(r[k]for k in ['SUB_FIREARM','SUB_KNIFE','SUB_OTHER','SUB_PERSONAL','WEAPON_NOT_RPT'])
for r in ar:
 r['YEAR']=int(r['YEAR'])
 for k in arm:r[k]=int(r[k]);assert r[k]>=0
 assert r['F_TOTAL']==sum(r[k]for k in ['VIOLENT','PROPERTY','F_DRUGOFF','F_SEXOFF','F_ALLOTHER'])
 r['total_arrests_and_citations']=sum(r[k]for k in ['F_TOTAL','M_TOTAL','S_TOTAL'])
anomalies=[r for r in dv if r['WEAPONS_INVOLVED']>r['TOTAL_CALLS']]
write('statewide_dv_weapon_total_anomalies.csv',anomalies)
sdv=[r for r in dv if r['COUNTY']==COUNTY];assert not any(r['WEAPONS_INVOLVED']>r['TOTAL_CALLS']for r in sdv)
sar=[r for r in ar if r['COUNTY']==COUNTY]
wb=openpyxl.load_workbook(next(RAW.glob('*.xlsx')),read_only=True,data_only=True);names={};jrows=[]
for r in list(wb.active.values)[1:]:
 if r[1]!=COUNTY:continue
 def val(x):return x.isoformat()[:10] if hasattr(x,'isoformat')else str(x or '')
 name=str(r[3]).strip();names[name]=str(r[2]);jrows.append(dict(county=COUNTY,ncic_jurisdiction_code=str(r[2]),reporting_name=name,start_as_supplied=val(r[4]),end_as_supplied=val(r[5])))
write('san_diego_jurisdiction_listing.csv',jrows)
# Explicit source-note flags. Do not propagate Sheriff notes to separately named cities without a crosswalk.
def known_partial(name,y,m):return name==SHERIFF and ((y==2024 and m>=11)or(y==2025 and m<=6))
def note(name,y):
 if name==SHERIFF and y==2024:return 'DOJ: Sheriff did not report all data Nov-Dec; scope across separate contract-city rows unresolved'
 if name==SHERIFF and y==2025:return 'DOJ: Sheriff did not report all data Jan-Jun; scope across separate contract-city rows unresolved'
 if name=='San Diego Harbor'and y==2018:return 'DOJ: Harbor Police did not report Sep-Dec'
 if name=='Mira Costa College'and y==2022:return 'DOJ: began reporting September'
 if name=='San Diego Community College'and y==2023:return 'DOJ: began reporting January'
 if name=='Palomar College'and y==2025:return 'DOJ: began reporting July'
 return 'No completeness guarantee; row presence is not complete reporting'
monthly=[]
for r in sorted(sdv,key=lambda r:(r['YEAR'],r['MONTH'],r['AGENCY_NAME'])):
 monthly.append(dict(year=r['YEAR'],month=r['MONTH'],year_month=f"{r['YEAR']}-{r['MONTH']:02d}",county=COUNTY,agency_name=r['AGENCY_NAME'],jurisdiction_code=names.get(r['AGENCY_NAME'],''),**{k.lower():r[k]for k in dvm},explicit_sheriff_partial_reporting=int(known_partial(r['AGENCY_NAME'],r['YEAR'],r['MONTH'])),coverage_note=note(r['AGENCY_NAME'],r['YEAR']),unit='DV-related calls resulting in a responding-agency written report; with or without arrest'))
write('san_diego_dv_calls_agency_month_2001_2025.csv',monthly)
agroups=collections.defaultdict(list)
for r in sdv:agroups[(r['YEAR'],r['AGENCY_NAME'])].append(r)
ay=[]
for (year,name),rows in sorted(agroups.items()):
 months=sorted(r['MONTH']for r in rows)
 ay.append(dict(year=year,county=COUNTY,agency_name=name,jurisdiction_code=names.get(name,''),months_present=len(months),months_absent=';'.join(str(m)for m in range(1,13)if m not in months),**{k.lower():cellsum(rows,k)for k in dvm},strangulation_months_with_data=sum(r['TOTAL_STRANG_SUFFO']is not None for r in rows),known_partial_months=';'.join(str(m)for m in months if known_partial(name,year,m)),coverage_note=note(name,year),unit='Reported DV-related calls; no imputation'))
write('san_diego_dv_calls_agency_year_2001_2025.csv',ay)
cy=[];cm=[]
for year in range(2001,2026):
 rows=[r for r in sdv if r['YEAR']==year]
 cy.append(dict(year=year,county=COUNTY,reporting_entities_present=len({r['AGENCY_NAME']for r in rows}),agency_month_rows=len(rows),**{k.lower():cellsum(rows,k)for k in dvm},coverage_note='Contains documented partial Sheriff reporting'if year in[2024,2025]else'Agency reporting and definitions vary; no completeness guarantee'))
 for month in range(1,13):
  rr=[r for r in rows if r['MONTH']==month]
  cm.append(dict(year=year,month=month,year_month=f'{year}-{month:02d}',county=COUNTY,reporting_entities_present=len(rr),**{k.lower():cellsum(rr,k)for k in dvm},documented_sheriff_partial_month=int(known_partial(SHERIFF,year,month))))
write('san_diego_dv_calls_county_year_2001_2025.csv',cy);write('san_diego_dv_calls_county_month_2001_2025.csv',cm)
ary=[]
for year in range(1980,2026):
 for ageband in ['All ages','Adult 18+','Juvenile under 18']:
  rr=[r for r in sar if r['YEAR']==year and (ageband=='All ages'or(r['AGE_GROUP']=='Under 18')==(ageband=='Juvenile under 18'))]
  ary.append(dict(year=year,county=COUNTY,age_scope=ageband,demographic_cells=len(rr),**{k.lower():sum(r[k]for r in rr)for k in arm},total_arrests_and_citations=sum(r['total_arrests_and_citations']for r in rr),unit='DOJ arrest/citation occasions; highest-severity offense; county of reporting agency',coverage_note='Contains documented partial Sheriff reporting'if year in[2024,2025]else'No completeness guarantee; 2021 includes CIBRS transition'))
write('san_diego_arrests_county_year_age_1980_2025.csv',ary)
# Preserve original supplied-file grouping definitions in independent comparison columns.
export=HERE/'comparison_inputs'
assert export.exists(), 'Missing already-public comparison_inputs folder'
em={r['month']:r for r in read(export/'by_month.csv')if re.fullmatch(r'\d{4}-\d{2}',r['month'])}
ey={r['year']:r for r in read(export/'by_year.csv')if r['year'].isdigit()}
byagency={(r['year'],r['agency_name']):r for r in ay};bycounty={r['year']:r for r in cy};byar={r['year']:r for r in ary if r['age_scope']=='All ages'}
comparison=[]
for y in range(2018,2026):
 comparison.append(dict(year=y,doj_county_arrests_citations=byar[y]['total_arrests_and_citations'],doj_county_dv_calls=bycounty[y]['total_calls'],doj_sheriff_named_entity_dv_calls=byagency[(y,SHERIFF)]['total_calls'],doj_vista_named_entity_dv_calls=byagency[(y,'Vista')]['total_calls'],doj_san_marcos_named_entity_dv_calls=byagency[(y,'San Marcos')]['total_calls'],supplied_export_all_source_ids=int(ey[str(y)]['all_source_ids']),supplied_export_core_dv_source_ids=int(ey[str(y)]['core_dv_source_ids']),supplied_export_broad_dv_source_ids=int(ey[str(y)]['broad_dv_source_ids']),comparison_scope='Different units and populations; no equality or completeness percentage; supplied 2018 starts July; 2025 incomplete',doj_known_sheriff_reporting_issue='Nov-Dec partial'if y==2024 else'Jan-Jun partial'if y==2025 else''))
write('annual_context_comparison_2018_2025.csv',comparison)
sheriffmonth={(r['year_month']):r for r in monthly if r['agency_name']==SHERIFF}
mc=[]
for r in cm:
 if r['year']<2018:continue
 key=r['year_month'];e=em.get(key);s=sheriffmonth.get(key)
 mc.append(dict(year_month=key,doj_county_dv_calls=r['total_calls'],doj_sheriff_named_entity_dv_calls=s['total_calls']if s else None,doj_known_sheriff_partial_reporting=r['documented_sheriff_partial_month'],supplied_export_all_source_ids=int(e['all_source_ids'])if e else None,supplied_export_core_dv_source_ids=int(e['core_dv_source_ids'])if e else None,supplied_export_charge_rows=int(e['source_charge_rows'])if e else None,unit_warning='Separate agency/county DV calls and source-ID group counts; not equivalent',export_month_assignment='Unambiguous month only; conflicting-month IDs omitted; blanks mean no supplied period'))
write('monthly_context_comparison_2018_2025.csv',mc)
state=[]
for year in range(2001,2026):
 dr=[r for r in dv if r['YEAR']==year];arows=[r for r in ar if r['YEAR']==year]
 state.append(dict(year=year,state_dv_calls=sum(r['TOTAL_CALLS']for r in dr),state_arrests_citations=sum(r['total_arrests_and_citations']for r in arows)))
write('california_control_totals_2001_2025.csv',state)
assert next(r['state_dv_calls']for r in state if r['year']==2025)==157416
assert next(r['state_dv_calls']for r in state if r['year']==2024)==163024
assert sum(r['total_calls']for r in ay)==sum(r['TOTAL_CALLS']for r in sdv)==sum(r['total_calls']for r in cy)
assert sum(r['total_calls']for r in monthly)==sum(r['total_calls']for r in cm)
qa=dict(status='PASS_WITH_SOURCE_WARNINGS',statewide_weapon_count_exceeds_total_call_rows=len(anomalies),san_diego_weapon_count_exceeds_total_call_rows=0,statewide_dv_source_rows=len(dv),statewide_arrest_source_rows=len(ar),san_diego_dv_agency_month_rows=len(sdv),san_diego_dv_agency_year_rows=len(ay),san_diego_distinct_reporting_names=len({r['AGENCY_NAME']for r in sdv}),san_diego_arrest_demographic_rows=len(sar),duplicate_natural_keys=0,nonnegative_counts=True,felony_component_sums_match=True,weapon_component_sums_match=True,dv_annual_monthly_agency_county_totals_reconcile=True,latest_statewide_dv_totals_match_official_release=True,population_denominators_present=False,arrest_agency_field_available=False,unmatched_historical_dv_names=sorted({r['AGENCY_NAME']for r in sdv if r['AGENCY_NAME']not in names}),scope='Reported counts only; absent months are not zero-filled; pre-2018 strangulation fields remain null',aggregate_hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in sorted(OUT.glob('*.csv'))})
(HERE/'normalization_verification.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in qa.items()if k!='aggregate_hashes'},indent=2))

