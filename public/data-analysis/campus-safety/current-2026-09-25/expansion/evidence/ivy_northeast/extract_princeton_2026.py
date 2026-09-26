"""Visible-table transcription with independent current-overlay and prior-edition checks.

Princeton's PDF retains obsolete invisible tables. Never parse the first occurrence.
The four rendered source pages were inspected in full before this transcription.
"""
from pathlib import Path
import csv, json, re, hashlib

ROOT=Path(__file__).resolve().parent
meta=json.loads((ROOT/'raw/princeton_asr_2026.metadata.json').read_text(encoding='utf-8'))
pages=json.loads((ROOT/'raw/princeton_asr_2026.pages.json').read_text(encoding='utf-8'))
# Values: oncampus, residential, noncampus, publicproperty, printed total.
# Years:2025,2024,2023. Independently transcribed from rendered PDF50 and52.
data={
 'murder':[[0]*5]*3,'negligent_manslaughter':[[0]*5]*3,
 'rape':[[6,4,0,0,6],[8,3,2,0,10],[6,5,0,0,6]],
 'fondling':[[3,3,0,0,3],[2,1,4,0,6],[0,0,1,0,1]],
 'incest':[[0]*5]*3,'statutory_rape':[[0]*5]*3,
 'robbery':[[2,0,0,0,2],[0,0,0,1,1],[0]*5],
 'aggravated_assault':[[0]*5,[2,0,1,0,3],[1,1,0,0,1]],
 'burglary':[[7,3,0,0,7],[4,3,0,0,4],[8,4,2,0,10]],
 'motor_vehicle_theft':[[37,0,1,0,38],[46,0,1,0,47],[36,0,0,0,36]],
 'arson':[[0]*5]*3,
 'domestic_violence':[[0,0,1,0,1],[0,0,1,0,1],[4,3,0,0,4]],
 'dating_violence':[[2,2,0,0,2],[6,4,0,0,6],[0]*5],
 'stalking':[[7,0,1,0,8],[7,0,0,0,7],[3,0,0,0,3]]
}
labels={'murder':'Murder/nonnegligent manslaughter','negligent_manslaughter':'Negligent manslaughter','rape':'Rape','fondling':'Fondling','incest':'Incest','statutory_rape':'Statutory rape','robbery':'Robbery','aggravated_assault':'Aggravated assault','burglary':'Burglary','motor_vehicle_theft':'Motor vehicle theft','arson':'Arson','domestic_violence':'Domestic violence','dating_violence':'Dating violence','stalking':'Stalking'}
geos=['oncampus','residential','noncampus','publicproperty']
criminal=list(data)[:11]
vawa=['dating_violence','domestic_violence','stalking']
records=[]; controls=[]; overlay_checks=0
for suffix,campus in [('001','Main Campus'),('002','James Forrestal Campus')]:
 for cats,pn,start in [(criminal,50+(suffix=='002'),'Murder/nonnegligent manslaughter 2025'),(vawa,52+(suffix=='002'),'Dating violence 2025')]:
  current=pages[pn-1].split(start,1)[1];current='2025'+current
  printed=re.findall(r'\b(202[345])\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)',current)[:len(cats)*3]
  assert len(printed)==len(cats)*3,(campus,pn,len(printed))
  for ci,cat in enumerate(cats):
   for yi,year in enumerate([2025,2024,2023]):
    expected=data[cat][yi] if suffix=='001' else [0]*5
    extracted=list(map(int,printed[ci*3+yi]));assert extracted==[year]+expected,(cat,year,expected,extracted)
    overlay_checks+=5
    assert expected[0]+expected[2]+expected[3]==expected[4],(cat,year,'total')
    assert expected[1]<=expected[0],(cat,year,'housing subset')
    controls.append({'campus_id':'186131'+suffix,'category':cat,'year':year,'printed_total':expected[4],'computed_total':expected[0]+expected[2]+expected[3],'pdf_page':pn})
    for gi,geo in enumerate(geos):
     records.append(dict(report_edition=2026,report_year=year,institution_unitid='186131',campus_id='186131'+suffix,campus=campus,category=cat,category_label=labels[cat],family='criminal_offenses' if cat in criminal else 'vawa',geography=geo,count=expected[gi],raw_value=str(expected[gi]),status='reported_numeric',pdf_page=pn,printed_page=pn-2,source_line=f'Visible rendered current table: {labels[cat]} {year}; on-campus/residential/noncampus/public/total = '+','.join(map(str,expected)),source_url=meta['url']+f'#page={pn}',source_sha256=meta['sha256']))
records.sort(key=lambda x:(x['campus_id'],x['report_year'],x['category'],x['geography']))
out=ROOT/'princeton_2026_core_counts.csv'
with out.open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=list(records[0]));w.writeheader();w.writerows(records)
old=ROOT.parents[1]/'freshness_2026_09_25/private/current_2025_core_counts.csv'
with old.open(encoding='utf-8-sig') as f:previous={(x['campus_id'],int(x['report_year']),x['category'],x['geography']):x for x in csv.DictReader(f) if x['institution_unitid']=='186131'}
comparisons=[]
for x in records:
 key=(x['campus_id'],x['report_year'],x['category'],x['geography'])
 if key in previous:comparisons.append(dict(campus_id=x['campus_id'],year=x['report_year'],category=x['category'],geography=x['geography'],prior_count=int(previous[key]['count']),current_count=x['count'],changed=int(previous[key]['count'])!=x['count']))
assert len(records)==336 and len(comparisons)==224
audit=dict(status='PASS',source_sha256=meta['sha256'],csv_sha256=hashlib.sha256(out.read_bytes()).hexdigest(),cells=len(records),overlay_numeric_checks=overlay_checks,visible_pages_reviewed=[50,51,52,53],printed_pages=[48,49,50,51],geography_subtotal_controls=len(controls),overlap_comparisons=len(comparisons),overlap_revisions=[x for x in comparisons if x['changed']],notes=['All four visible source tables inspected; stale hidden2021-23 tables excluded.','Hate-crime and newly required hazing tables outside the fixed14-category comparison.','Main2025 motor-vehicle theft38 total includes27 e-bikes,8 golf carts,2 motorized scooters and1 motor vehicle; do not describe all as stolen automobiles.','Forrestal2025 source notes one unfounded motor-vehicle theft; not added to reported offense counts.'])
(ROOT/'princeton_2026_source_audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
(ROOT/'princeton_2026_overlap_comparison.json').write_text(json.dumps(comparisons,indent=2)+'\n',encoding='utf-8')
print(json.dumps(audit,indent=2))
