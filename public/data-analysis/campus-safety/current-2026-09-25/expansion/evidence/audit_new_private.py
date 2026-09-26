from pathlib import Path
import csv,json,hashlib,re,pdfplumber,subprocess
ROOT=Path(__file__).resolve().parent
P=ROOT/'private_other'
rows=list(csv.DictReader((P/'new_asr_core_counts.csv').open(encoding='utf8')))
errors=[];checks=0
labels=['Murder & Non-negligent Manslaughter','Manslaughter by Negligence','Rape','Fondling','Incest','Statutory Rape','Robbery','Aggravated Assault','Burglary','Motor Vehicle Theft','Arson','Domestic Violence','Dating Violence','Stalking']
cats=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence','stalking']
idx={(r['institution_unitid'],int(r['pdf_page']),r['category'],int(r['report_year']),r['geography']):r for r in rows}
pages={60:['oncampus','noncampus','publicproperty','total','residential'],70:['oncampus','noncampus','publicproperty','total','residential'],78:['oncampus','noncampus','publicproperty','total','residential'],85:['oncampus','publicproperty','total'],90:['oncampus','publicproperty','total'],95:['oncampus','noncampus','publicproperty','total'],100:['oncampus','publicproperty','total'],105:['oncampus','publicproperty','total','residential'],112:['oncampus','publicproperty','total'],115:['oncampus','publicproperty','total']}
def check(ok,key):
 global checks
 checks+=1
 if not ok:errors.append(key)
with pdfplumber.open(P/'sources/hopkins/asr2025-browser.pdf') as doc:
 for page,columns in pages.items():
  text=doc.pages[page-1].extract_text(layout=True)
  split=next(w['x0'] for w in doc.pages[page-1].extract_words() if w['text']=='Arson')-5
  for position,(cat,label) in enumerate(zip(cats,labels)):
   crop=doc.pages[page-1].crop((0,0,split,doc.pages[page-1].height) if position<10 else (split,0,612,doc.pages[page-1].height))
   lines=[line.strip() for line in crop.extract_text(layout=True).splitlines()]
   start=lines.index(label)
   observations=[s.split() for s in lines[start+1:] if re.fullmatch(r'202[345](?:\s+\d+){'+str(len(columns))+r'}',s)][:3]
   check([o[0] for o in observations]==['2025','2024','2023'],[page,cat,'year_order'])
   for o in observations:
    year=int(o[0]);v=dict(zip(columns,map(int,o[1:])))
    check(v['total']==sum(v.get(g,0) for g in ['oncampus','noncampus','publicproperty']),[page,cat,year,'total'])
    check(v.get('residential',0)<=v['oncampus'],[page,cat,year,'subset'])
    for geo in ['residential','oncampus','noncampus','publicproperty']:
     r=idx['162928',page,cat,year,geo]
     check(r['count']==str(v[geo]) if geo in v else r['count']=='',[page,cat,year,geo,'literal'])
     if geo=='residential' and geo not in v:check('no residence halls' in text,[page,'housing_absence'])
with pdfplumber.open(P/'sources/stanford/asr2026-3d6a6637.pdf') as doc:
 for page in [103,104]:
  text=doc.pages[page-1].extract_text(layout=True)
  lines=text.splitlines()
  aliases={'murder':'Murder / Non-Negligent','negligent_manslaughter':'Negligent Manslaughter','motor_vehicle_theft':'Theft- Motor Vehicles','rape':'Rape (including'}
  for cat,label in zip(cats,labels):
   if (cat in ['rape','fondling','incest','statutory_rape','domestic_violence','dating_violence','stalking'])!=(page==104):continue
   prefix=aliases.get(cat,label);start=next(i for i,l in enumerate(lines) if l.strip().startswith(prefix))
   found=[]
   for l in lines[start:]:
    m=re.search(r'\b(202[345])\s+([\d*#¶]+)\s+([\d*#¶]+)\s+([\d*#¶]+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$',l)
    if m:found.append(m.groups())
    if len(found)==3:break
   check([v[0] for v in found]==['2023','2024','2025'],[page,cat,'year_order'])
   for o in found:
    year=int(o[0]);vals=[int(re.sub(r'\D','',x)) for x in o[1:]]
    for geo,val in zip(['residential','oncampus','noncampus','publicproperty'],vals):check(idx['243744',page,cat,year,geo]['count']==str(val),[page,cat,year,geo,'literal'])
    check(sum(vals[1:4])==vals[4] and vals[0]<=vals[1],[page,cat,year,'geographic_identity'])
result={'status':'PASS' if not errors else 'FAIL','method':'Independent pdfplumber layout extraction, no import or execution of producer extraction script. Every new Hopkins/Stanford literal cell, category/year order and geographic identity independently reconstructed. Omitted columns retained missing unless narrative applicability is explicit. Separate visual checks recorded in root review.','checks':checks,'rows':len(rows),'errors':errors,'csv_sha256':hashlib.sha256((P/'new_asr_core_counts.csv').read_bytes()).hexdigest(),'auditor_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(ROOT/'INDEPENDENT_HOPKINS_STANFORD_AUDIT.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))

