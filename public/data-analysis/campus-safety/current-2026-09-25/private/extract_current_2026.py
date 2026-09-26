"""Extract the 2026 institutional source layer. No federal data are overwritten.
Counts retain printed geography/year; missing columns and conflicting source years stay null.
"""
from pathlib import Path
import csv,json,re
from html.parser import HTMLParser
ROOT=Path(__file__).parent
DATA=json.loads((ROOT/'../../../publication/data/dataset.json').read_text())
META=[json.loads(p.read_text(encoding='utf-8')) for p in ROOT.glob('retrieved/*/*.metadata.json')]
CATS={
'murder':r'Murder(?:\s*/?\s*(?:and\s+)?Non[-–\s]*Negligent(?:\s+Manslaughter)?)?',
'negligent_manslaughter':r'(?:Manslaughter\s*(?:By|–|-)\s*Negligen(?:ce|t)|Negligent\s+Manslaughter|Manslaughter\s*\(Negligent\)|Manslaughter)',
'rape':r'Rape','fondling':r'Fondling','incest':r'Incest','statutory_rape':r'Statutory\s+Rape',
'robbery':r'Robbery','aggravated_assault':r'Aggravated\s+Assault','burglary':r'Burglary',
'motor_vehicle_theft':r'Motor\s+Vehicle\s+Theft','arson':r'Arson','domestic_violence':r'Domestic\s+Violence','dating_violence':r'Dating\s+Violence','stalking':r'Stalking'}
LABELS={c['id']:c['label'] for c in DATA['categories'] if c['id'] in CATS}
GEO=['residential','oncampus','noncampus','publicproperty'];ROWS=[];ISSUES=[];TOTALS=[]

def source(key,stem):
 m=next(x for x in META if x['key']==key and Path(x.get('local_pdf',x.get('local_html',''))).stem==stem)
 text=(ROOT/m['local_text']).read_text(encoding='utf-8')
 pages={int(n):t for n,t in re.findall(r'=== PDF PAGE (\d+) ===\n(.*?)(?==== PDF PAGE|\Z)',text,re.S)}
 return m,pages

def branch(unit,suffix,label=None):
 id=unit+suffix if suffix.isdigit() else unit+'-asr2026-'+suffix
 c=next((c for i in DATA['institutions'] if i['id']==unit for c in i['campuses'] if c['id']==id),None)
 return unit,id,label or (c['name'] if c else suffix)

def emit(m,b,cat,year,geo,raw,page,line,status=None,printed=None):
 numeric=str(raw).isdigit()
 ROWS.append(dict(report_edition=2026,report_year=year,institution_unitid=b[0],campus_id=b[1],campus=b[2],category=cat,category_label=LABELS.get(cat,cat),family='vawa' if cat in ['domestic_violence','dating_violence','stalking'] else 'criminal_offenses',geography=geo,count=int(raw) if numeric and status not in ['ambiguous_year_labels','not_reported_geography','missing_branch_table'] else '',raw_value=raw,status=status or ('reported_numeric' if numeric else 'reported_not_applicable'),pdf_page=page or '',printed_page=printed if printed is not None else page or '',source_line=line,source_url=m['url']+(f'#page={page}' if page else ''),source_sha256=m['sha256']))

def tokens(text):return re.findall(r'N\s*/\s*A|\d+',text,re.I)
def category_match(body,cat,n):
 # Require enough numeric tokens immediately after label; prevents matching a prose definition.
 pat=r'(?<![A-Za-z])'+CATS[cat]+r'(?:\d{1,2})?\s+((?:(?:N\s*/\s*A|\d+)[ \t\r\n]+){'+str(n-1)+r'}(?:N\s*/\s*A|\d+))(?=\s|$)'
 matches=list(re.finditer(pat,body,re.I))
 if cat=='negligent_manslaughter':matches=[m for m in matches if not re.search(r'(?:non[-–\s]*negligent|non[-–\s]*|murder[/\s-]*)\s*$',body[max(0,m.start()-45):m.start()],re.I)]
 if cat=='rape':matches=[m for m in matches if not re.search('statutory\\s+$',body[max(0,m.start()-12):m.start()],re.I)]
 return matches

def column_table(m,pages,b,selected,geos,years,order='geo',printed_offset=0):
 for cat in CATS:
  found=[]
  for p in selected:
   for hit in category_match(pages[p],cat,len(geos)*len(years)):
    found.append((p,hit))
  if not found:raise ValueError((m['key'],b,cat,'not found',selected))
  p,hit=found[0]; vals=tokens(hit.group(1));assert len(vals)==len(geos)*len(years)
  line=pages[p][:hit.start()].count('\n')+1
  for gi,geo in enumerate(geos):
   if geo.startswith('_'):continue
   for yi,y in enumerate(years):emit(m,b,cat,y,geo,vals[gi*len(years)+yi if order=='geo' else yi*len(geos)+gi],p,line,printed=p+printed_offset)

def year_rows(m,pages,b,selected,geos,printed_offset=0,skip_total_check=False):
 for cat in CATS:
  candidates=[]
  for p in selected:
   body=pages[p]
   for match in re.finditer(r'(?<![A-Za-z])'+CATS[cat]+r'(?:\d{1,2})?',body,re.I):
    if cat=='negligent_manslaughter' and re.search(r'(?:non[-–\s]*negligent|non[-–\s]*|murder[/\s-]*)\s*$',body[max(0,match.start()-45):match.start()],re.I):continue
    if cat=='rape' and re.search('statutory\\s+$',body[max(0,match.start()-12):match.start()],re.I):continue
    chunk=body[match.end():match.end()+650]
    yr=list(re.finditer(r'\b(202[2345])\s+([^\n]+)',chunk))[:3]
    if len(yr)==3 and all(len(tokens(q[2]))==len(geos) for q in yr):candidates.append((p,match,yr,chunk))
  if not candidates:raise ValueError((m['key'],b,cat,'year rows not found',selected))
  p,hit,yr,chunk=candidates[0]
  years=[int(q[1]) for q in yr]
  if years!=[2025,2024,2023]:ISSUES.append(dict(type='printed_year_labels_conflict',campus=b[1],category=cat,years=years,pdf_page=p,source=m['url']))
  for missing in set([2023,2024,2025])-set(years):
   for geo in GEO:emit(m,b,cat,missing,geo,'',p,'',status='missing_source_year',printed=p+printed_offset)
  seen=set()
  for ymatch in yr:
   year=int(ymatch[1])
   if year not in [2023,2024,2025] or year in seen:continue
   seen.add(year)
   if years.count(year)>1:
    for geo in GEO:emit(m,b,cat,year,geo,'; '.join(q[2] for q in yr if int(q[1])==year),p,'',status='ambiguous_year_labels',printed=p+printed_offset)
    continue
   vals=tokens(ymatch[2]);year=int(ymatch[1]);line=pages[p][:hit.end()].count('\n')+chunk[:ymatch.start()].count('\n')+1
   mapped=dict(zip(geos,vals))
   for geo in GEO:emit(m,b,cat,year,geo,mapped.get(geo,''),p,line,None if geo in mapped else 'not_reported_geography',p+printed_offset)
   if '_total' in mapped and all(mapped.get(g,'').isdigit() for g in ['oncampus','noncampus','publicproperty']):
    if b[1]=='147767001' and cat=='dating_violence' and year==2025 and mapped['_total']=='303':mapped['_total']='30' # 30 with superscript footnote3, independently rendered
    expected=sum(int(mapped[g]) for g in ['oncampus','noncampus','publicproperty']);given=int(mapped['_total'])
    TOTALS.append(dict(campus=b[1],category=cat,year=year,computed=expected,printed=given,pdf_page=p,source=m['url']))
    if expected!=given and not skip_total_check:ISSUES.append(dict(type='printed_total_differs_from_components',campus=b[1],category=cat,year=year,computed=expected,printed=given,pdf_page=p,source=m['url']))

# Cornell: every campus has a separate current report.
m,p=source('cornell','asr-f3e1b40e');column_table(m,p,branch('190415','001'),[6],['oncampus','residential','publicproperty','noncampus'],[2023,2024,2025])
m,p=source('cornell','tech-asr-fa532fb2');column_table(m,p,branch('190415','002'),[33],['oncampus','residential','publicproperty','noncampus'],[2023,2024,2025])
m,p=source('cornell','asr-eb39f8b4');body=(ROOT/m['local_text']).read_text(encoding='utf-8');column_table(m,{0:body},branch('190415','003'),[0],['oncampus','residential','publicproperty','noncampus'],[2023,2024,2025])
# Carnegie Mellon: six campuses, two pages per campus.
m,p=source('cmu','asr-7c2a7ceb')
for suffix,start in [('001',44),('003',71),('006',73),('004',75),('005',77),('007',79)]:year_rows(m,p,branch('211440',suffix),[start,start+1],['oncampus','residential','noncampus','publicproperty','_total'])
# USC: reported rows use descending year-major order; rotated headings verified independently.
m,p=source('usc','asr-55324790')
for suffix,start in [('001',103),('002',106),('007',110),('009',114),('003',118),('006',122),('005',126),('008',130),('015',134)]:column_table(m,p,branch('123961',suffix),[start,start+1],['residential','oncampus','publicproperty','noncampus'],[2025,2024,2023],order='year',printed_offset=-2)
# Georgetown: housing is a subset; first non-housing block intentionally not added.
m,p=source('georgetown','static-asr-fe95d159')
for suffix,start,label in [('001',48,None),('002',50,None),('007',52,None),('005',54,None),('003',56,None),('006',58,None),('dubai',60,'Georgetown University in Dubai'),('jakarta',62,'Georgetown SFS Asia Pacific, Jakarta')]:
 column_table(m,p,branch('131496',suffix,label),[start,start+1],['_nonhousing','residential','oncampus','noncampus','publicproperty'],[2023,2024,2025],printed_offset=-1)
# Northwestern: absent geography columns remain null until a separate scope statement verifies N/A.
m,p=source('northwestern','asr-c886c005')
for suffix,selected,geos in [('001',[38,39,40],['oncampus','residential','noncampus','publicproperty','_total']),('002',[42,43,44],['oncampus','noncampus','publicproperty','_total']),('003',[64,65,66],['oncampus','noncampus','publicproperty','_total']),('006',[71,72,73],['oncampus','publicproperty','_total']),('004',[79,80,81],['oncampus','publicproperty','_total'])]:year_rows(m,p,branch('147767',suffix),selected,geos,printed_offset=-2)
m,p=source('northwestern','asr-4713d28d');year_rows(m,p,branch('147767','005'),[43,44,45],['oncampus','noncampus','publicproperty','_total'],printed_offset=-2)
# Penn main-campus annual tables are unambiguous. Three branch tables have conflicting years.
m,p=source('penn','asr-16115b8c')
for y,page in [(2025,70),(2024,71),(2023,72)]:column_table(m,p,branch('215062','001'),[page],['residential','oncampus','noncampus','publicproperty','_total','_unfounded'],[y],printed_offset=-3)
for suffix,page in [('005',74),('004',75),('003',76)]:
 for cat in CATS:
  for y in [2023,2024,2025]:
   for geo in GEO:emit(m,branch('215062',suffix),cat,y,geo,'0',page,'',status='ambiguous_year_labels',printed=page-3)
for suffix in ['006','007']:
 for cat in CATS:
  for y in [2023,2024,2025]:
   for geo in GEO:emit(m,branch('215062',suffix),cat,y,geo,'',None,'',status='missing_branch_table')
# Chicago: per-table geographic cells; printed totals retained in separate source-issue ledger.
m,p=source('chicago','asr-4da72d79')
for suffix,pages in [('001',[9,10]),('002',[12,13])]:year_rows(m,p,branch('144050',suffix),pages,['residential','oncampus','noncampus','publicproperty','_total'],printed_offset=-2)
# This is an explicit report-wide zero statement, not a blank/missing-cell zero imputation.
for suffix in ['003','005','006','008','009','010']:
 for cat in CATS:
  for y in [2023,2024,2025]:
   for geo in GEO:emit(m,branch('144050',suffix),cat,y,geo,'0',8,'explicit no reported Clery crimes for2023,2024,2025',status='reported_zero_narrative',printed=6)

# Keep the printed component value, but explicitly withhold calculations where the
# source's own combined total conflicts. The reviewer cannot identify which cell is wrong.
conflicts={(x['campus'],x['year'],x['category']) for x in ISSUES if x['type']=='printed_total_differs_from_components'}
for row in ROWS:
 if (row['campus_id'],row['report_year'],row['category']) in conflicts:
  row['status']='source_total_conflict'
rowsort=lambda r:(r['institution_unitid'],r['campus_id'],r['report_year'],r['category'],r['geography'])
ROWS.sort(key=rowsort)
keys=[(r['campus_id'],r['report_year'],r['category'],r['geography']) for r in ROWS]
assert len(keys)==len(set(keys))
for c in {r['campus_id'] for r in ROWS}:assert sum(r['campus_id']==c for r in ROWS)==168,(c,'incomplete')
with (ROOT/'current_asr_core_counts.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=list(ROWS[0]));w.writeheader();w.writerows(ROWS)
(ROOT/'extraction_issues.json').write_text(json.dumps({'status':'first_extraction_pending_independent_review','issues':ISSUES,'printed_total_checks':TOTALS},indent=2)+'\n')
print(json.dumps({'rows':len(ROWS),'branches':len({r['campus_id'] for r in ROWS}),'institutions':len({r['institution_unitid'] for r in ROWS}),'issues':ISSUES},indent=2))

