"""Final integrity, completeness and frozen-federal reconciliation; no network needed."""
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
import csv,json,hashlib
ROOT=Path(__file__).parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=['current_asr_core_counts.csv','current_2025_core_counts.csv'];rows=[]
for f in files:rows+=list(csv.DictReader((ROOT/f).open(encoding='utf-8')))
key=lambda r:(r['campus_id'],r['report_year'],r['category'],r['geography'])
assert len(rows)==len({key(r) for r in rows})==18648
metas=[json.loads(p.read_text(encoding='utf-8')) for p in ROOT.glob('retrieved/*/*.metadata.json')]
bysha={m['sha256']:m for m in metas if m.get('sha256')};validated={}
for digest in {r['source_sha256'] for r in rows}:
 m=bysha[digest];p=ROOT/m.get('local_pdf',m.get('local_html'));assert sha(p)==digest;assert p.stat().st_size==m['bytes'];validated[digest]=p.relative_to(ROOT).as_posix()
for r in rows:
 m=bysha[r['source_sha256']]
 if r['pdf_page']:assert 1<=int(r['pdf_page'])<=m['pages']
 if r['count']!='':assert int(r['count'])>=0 and r['status'] in ['reported_numeric','reported_zero_narrative','source_total_conflict']
 elif r['status']=='reported_numeric':raise AssertionError(r)
for b,n in Counter(r['campus_id'] for r in rows).items():assert n==168,(b,n)
idx={key(r):r for r in rows};subset=[]
for r in rows:
 if r['geography']=='residential' and r['count']!='':
  other=idx[(r['campus_id'],r['report_year'],r['category'],'oncampus')]
  if other['count']!='' and int(r['count'])>int(other['count']):subset.append(key(r))
assert not subset,subset
inventory=json.loads((ROOT/'source_inventory.json').read_text(encoding='utf-8'));assert len(inventory['institutions'])==20
assert not any(s in json.dumps(inventory) for s in ['M:/','M:\\','C:/','C:\\','access_token='])
federal=ROOT/'../../../sources/clery/normalized/cohort_campus_counts_2022_2024.csv'
cats=dict(zip(['MURD','NEG_M','RAPE','FONDL','INCES','STATR','ROBBE','AGG_A','BURGLA','VEHIC','ARSON','STALK','DOMEST','DATING'],['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','stalking','domestic_violence','dating_violence']))
geos={'on_campus':'oncampus','residential_facilities':'residential','noncampus':'noncampus','public_property':'publicproperty'}
old={(r['campus_id'],r['year'],cats[r['offense_code']],geos[r['geography']]):r for r in csv.DictReader(federal.open(encoding='utf-8-sig')) if r['offense_code'] in cats and r['geography'] in geos and r['family'] in ['criminal_offenses','vawa']}
comparisons=[]
for r in rows:
 prior=old.get(key(r));a=prior['count'] if prior else '';b=r['count']
 comparison='outside_frozen_years' if r['report_year']=='2025' else 'new_branch' if prior is None else 'both_unavailable' if a==b=='' else 'numeric_agreement' if a==b else 'source_or_scope_missing' if a=='' or b=='' else 'numeric_difference'
 comparisons.append(dict(campus_id=r['campus_id'],year=r['report_year'],category=r['category'],geography=r['geography'],federal_count=a,current_report_count=b,current_status=r['status'],comparison=comparison,pdf_page=r['pdf_page'],source_url=r['source_url'],source_sha256=r['source_sha256']))
with (ROOT/'federal_overlap_reconciliation.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,list(comparisons[0]));w.writeheader();w.writerows(comparisons)
audits=[json.loads((ROOT/f).read_text()) for f in ['second_extraction_audit.json','second_2025_extraction_audit.json']]
for f,a in zip(files,audits):assert a['status']=='pass' and a['csv_sha256']==sha(ROOT/f)
result={'status':'PASS','checked_utc':datetime.now(timezone.utc).isoformat(),'institutions_in_inventory':20,'institutions_with_current_source_cells':18,'branches':111,'source_cells':len(rows),'source_files_hashed':len(validated),'explicit_cells_independently_reproduced':sum(a['verified_cells'] for a in audits),'status_counts':dict(Counter(r['status'] for r in rows)),'comparison_counts':dict(Counter(r['comparison'] for r in comparisons)),'source_sha256_to_local_file':validated,'csv_sha256':{f:sha(ROOT/f) for f in files},'limits':['Harvard/JohnsHopkins source bytes unverified; Columbia/Princeton freshness beyond downloaded2025 PDF qualified.','Source conflicts, partial-year reports, incomplete branch tables and category/geography differences remain explicitly status-coded; this pass does not certify them as resolved.','Counts retained; no new resident or enrollment denominators adopted.','N/A is not zero. structural_geography_rules.json separately documents explicit no-geography and before-opening exceptions.']}
(ROOT/'private_input_integrity.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k!='source_sha256_to_local_file'},indent=2))
