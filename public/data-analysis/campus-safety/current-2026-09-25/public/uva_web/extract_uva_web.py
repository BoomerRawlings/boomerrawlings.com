"""Parse saved official web-reader table excerpts; no PDF-byte hash is claimed."""
import csv,json,pathlib,re,hashlib,datetime
P=pathlib.Path(__file__).parent; ROOT=P.parents[3]
CATS=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','dating_violence','domestic_violence','stalking']
LABELS=['Murder/Nonnegligent Manslaughter','Negligent Manslaughter','Rape','Fondling','Incest','Statutory Rape','Robbery','Aggravated Assault','Burglary','Motor Vehicle Theft','Arson','Dating Violence','Domestic Violence','Stalking']
CODES=dict(zip(CATS,['MURD','NEG_M','RAPE','FONDL','INCES','STATR','ROBBE','AGG_A','BURGLA','VEHIC','ARSON','DATING','DOMEST','STALK']))
GEO=['residential','oncampus','noncampus','publicproperty']
FG=dict(zip(GEO,['residential_facilities','on_campus','noncampus','public_property']))
CAMPUSES={112:('234076001','Charlottesville'),122:('234076012','Darden Sands Family Grounds'),130:('234076009','Mountain Lake Biological Station'),139:('234076005','Richmond Center: School of Nursing'),148:('234076013','UVA-Inova Fairfax Campus'),156:('234076014','Morven Sustainability Lab')}
ROWS=[];SOURCES={}
for filename in ['tables_1.txt','tables_2.txt']:
 f=P/filename;data=f.read_bytes();h=hashlib.sha256(data).hexdigest();SOURCES[filename]=h
 for pg,(cid,campus) in CAMPUSES.items():
  lines=[l for l in data.decode('utf-8').splitlines() if re.match(r'L\d+@P'+str(pg)+':',l)]
  if not lines:continue
  found=[]
  for line in lines:
   txt=re.sub(r'^L\d+@P\d+:\s*','',line)
   m=re.search(r'((?:(?:\d+|–)\s+){17}(?:\d+|–))\s*$',txt)
   if m:found.append((line,m[1].split()))
  assert len(found)==14,(campus,len(found))
  for cat,label,(line,values) in zip(CATS,LABELS,found):
   for yi,year in enumerate([2025,2024,2023]):
    a=values[yi*6:(yi+1)*6];val=[None if x=='–' else int(x) for x in a]
    # Dashes are explicit absence of that geography, documented in table notes.
    assert val[4]==sum(x or 0 for x in val[1:4]),(campus,cat,year,val)
    if val[0] is not None:assert val[0]<=val[1]
    for gi,g in enumerate(GEO):
     ROWS.append(dict(report_edition=2026,report_year=year,institution_unitid='234076',campus_id=cid,campus=campus,category=cat,category_label=label,family='vawa' if cat in CATS[-3:] else 'criminal_offenses',geography=g,count=val[gi],raw_value=a[gi],status='source_not_applicable' if val[gi] is None else 'reported_numeric',pdf_page=pg+1,printed_page=pg-6,source_line=line,source_url='https://cleryact.virginia.edu/report#page='+str(pg+1),source_sha256=None,source_excerpt_file=filename,source_excerpt_sha256=h,source_reported_total=val[4],source_unfounded=val[5],source_note='Official web-reader extraction; no local PDF bytes/hash. Dashes retain source nonapplicability, not reported zero.'))
assert len(ROWS)==1008
keys=[(r['campus_id'],r['report_year'],r['category'],r['geography']) for r in ROWS];assert len(keys)==len(set(keys))
def writecsv(name,rs):
 with (P/name).open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,fieldnames=list(rs[0]));w.writeheader();w.writerows(rs)
writecsv('current_core_counts.csv',ROWS)
(P/'current_core_counts.json').write_text(json.dumps(ROWS,ensure_ascii=False,indent=2),encoding='utf-8')
fed=list(csv.DictReader((ROOT/'sources/clery/normalized/cohort_campus_counts_2022_2024.csv').open(encoding='utf-8-sig')))
fi={(r['campus_id'],int(r['year']),r['family'],r['offense_code'],r['geography']):r for r in fed}
comp=[]
for r in ROWS:
 k=(r['campus_id'],r['report_year'],r['family'],CODES[r['category']],FG[r['geography']])
 if k not in fi:continue
 f=fi[k];v=int(f['count']) if f['count'] else None
 comp.append({k:r[k] for k in ['institution_unitid','campus_id','campus','report_edition','report_year','category','geography']}|dict(federal_count=v,current_asr_count=r['count'],federal_status=f['status'],asr_status=r['status'],difference=r['count']-v if v is not None and r['count'] is not None else None,source_url=r['source_url']))
writecsv('federal_comparison.csv',comp)
diffs=[r for r in comp if r['difference'] not in [None,0]]
checks=dict(status='Text extraction and arithmetic checks complete; visual verification pending',core_cells=len(ROWS),numeric_cells=sum(r['count'] is not None for r in ROWS),campuses=6,years=[2023,2024,2025],overlap_cells=len(comp),numeric_comparisons=sum(r['difference'] is not None for r in comp),numeric_differences=diffs,source_pdf_sha256=None,web_excerpt_sha256=SOURCES)
(P/'extraction_checks.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
print(json.dumps(checks,indent=2))
