"""Current retrieved 2025 institutional reports; 2022–24 cells, preserved provenance.
Text tables are parsed with pypdf; multiline grids with pdfplumber. Princeton's
visible table is explicitly transcribed because the PDF has a stale hidden layer.
"""
from pathlib import Path
import csv,json,re,hashlib
import pdfplumber
ROOT=Path(__file__).parent
DATA=json.loads((ROOT/'../../../publication/data/dataset.json').read_text())
META=[json.loads(p.read_text(encoding='utf-8')) for p in ROOT.glob('retrieved/*/*.metadata.json')]
CATS=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence','stalking']
LABELS={c['id']:c['label'] for c in DATA['categories'] if c['id'] in CATS}
GEO=['residential','oncampus','noncampus','publicproperty'];ROWS=[];ISSUES=[];TOTALS=[];GRID={}
PAT={
 'murder':r'Murder\s*(?:&|/|and)?\s*Non[-–\s]*Negligent\s*(?:Manslaughter|Homicide)',
 'negligent_manslaughter':r'(?:Manslaughter\s*by\s*Negligence|Negligent\s+Manslaughter)',
 **{c:c.replace('_',r'\s+') for c in CATS[2:]}}
PAT['motor_vehicle_theft']=r'Motor\s+Vehicle\s+Theft'

def source(key,stem):
 m=next(x for x in META if x['key']==key and Path(x.get('local_pdf','')).stem==stem)
 text=(ROOT/m['local_text']).read_text(encoding='utf-8')
 return m,{int(n):t for n,t in re.findall(r'=== PDF PAGE (\d+) ===\n(.*?)(?==== PDF PAGE|\Z)',text,re.S)}
def branch(unit,suffix,label=None):
 id=unit+suffix if suffix.isdigit() else unit+'-asr2025-'+suffix
 c=next((c for i in DATA['institutions'] if i['id']==unit for c in i['campuses'] if c['id']==id),None)
 return unit,id,label or (c['name'] if c else suffix)
def clean(v):
 v=str(v).strip()
 if re.fullmatch(r'\d+(?:\s+\d+)?[*#¶^†‡]*',v):return v.split()[0].rstrip('*#¶^†‡')
 if re.fullmatch(r'N\s*/?\s*A',v,re.I):return 'N/A'
 return v
def emit(m,b,cat,year,geo,raw,page,line,printed=None,status=None):
 val=clean(raw);num=val.isdigit()
 ROWS.append(dict(report_edition=2025,report_year=year,institution_unitid=b[0],campus_id=b[1],campus=b[2],category=cat,category_label=LABELS[cat],family='vawa' if cat in CATS[-3:] else 'criminal_offenses',geography=geo,count=int(val) if num else '',raw_value=str(raw),status=status or ('reported_numeric' if num else 'reported_not_applicable' if val=='N/A' else 'unresolved_source_cell'),pdf_page=page,printed_page=printed if printed is not None else page,source_line=line,source_url=m['url']+f'#page={page}',source_sha256=m['sha256']))
def check_total(m,b,cat,y,mapped,p):
 if '_total' not in mapped:return
 v={k:clean(x) for k,x in mapped.items()}
 if all(v.get(g,'').isdigit() for g in ['oncampus','noncampus','publicproperty','_total']):
  expected=sum(int(v[g]) for g in ['oncampus','noncampus','publicproperty']);given=int(v['_total'])
  item=dict(campus=b[1],category=cat,year=y,computed=expected,printed=given,pdf_page=p,source=m['url']);TOTALS.append(item)
  if expected!=given:ISSUES.append(dict(type='printed_total_differs_from_components',**item))
def match_cat(s):
 s=re.sub('[^a-z]','',s.lower())
 if s.startswith('murder'):return 'murder'
 if s.startswith(('manslaughter','negligentmanslaughter')):return 'negligent_manslaughter'
 if s.startswith(('theftmotorvehicle','motorvehicletheft')):return 'motor_vehicle_theft'
 for c in sorted(CATS[2:],key=len,reverse=True):
  if s.startswith(c.replace('_','')):return c
 return None
def text_table(m,pages,b,selected,geos,years,order='geo',offset=0):
 n=len(geos)*len(years)
 for c in CATS:
  found=[]
  for p in selected:
   body=pages[p]
   label=('Murder' if c=='murder' else 'Manslaughter') if m['key']=='yale' and c in CATS[:2] else PAT[c]
   pat=r'(?<![A-Za-z])'+label+r'[*^†‡]*(?:\d{1,2})?\s+((?:(?:N\s*/\s*A|\d+)[*#¶^†‡]*\s+){'+str(n-1)+r'}(?:N\s*/\s*A|\d+)[*#¶^†‡]*)(?=\s|$)'
   for hit in re.finditer(pat,body,re.I):
    prior=body[max(0,hit.start()-40):hit.start()]
    if c=='negligent_manslaughter' and re.search(r'non[-–\s]*$',prior,re.I):continue
    if c=='rape' and re.search(r'statutory\s*$',prior,re.I):continue
    found.append((p,hit))
  if not found:raise ValueError((m['key'],b,c,'text table missing',selected))
  p,hit=found[0];vals=re.findall(r'N\s*/\s*A|\d+[*#¶^†‡]*',hit[1],re.I);assert len(vals)==n
  for yi,y in enumerate(years):
   mapped={g:vals[gi*len(years)+yi if order=='geo' else yi*len(geos)+gi] for gi,g in enumerate(geos)}
   for g,v in mapped.items():
    if not g.startswith('_'):emit(m,b,c,y,g,v,p,pages[p][:hit.start()].count('\n')+1,p+offset)
   check_total(m,b,c,y,mapped,p)

# Six directly labelled text-table formats.
m,p=source('caltech','asr-27300d74')
for y,n in [(2024,84),(2023,85),(2022,86)]:text_table(m,p,branch('110404','001'),[n],['oncampus','residential','noncampus','publicproperty'],[y],offset=-1)
m,p=source('columbia','asr-9a59be08')
for suffix,n in [('001',53),('006',54),('002',55),('007',56),('004',57),('005',58),('008',59)]:text_table(m,p,branch('190150',suffix),[n],['oncampus','residential','noncampus','publicproperty','_total'],[2024,2023,2022],offset=-4)
m,p=source('mit','asr-8895265e');text_table(m,p,branch('166683','001'),[54],['oncampus','residential','noncampus','publicproperty','_total'],[2022,2023,2024],order='year')
m,p=source('yale','asr-008b0522')
for suffix,start in [('001',39),('002',42)]:
 for y,n in [(2024,start),(2023,start+1),(2022,start+2)]:text_table(m,p,branch('130794',suffix),[n],['residential','oncampus','noncampus','publicproperty','_total','_unfounded'],[y])
m,p=source('nyu','asr-b478978b')
for suffix,n,label in [('001',50,None),('019',53,None),('027',55,None),('028',56,None),('029',57,None),('004',58,None),('009',59,None),('026',60,None),('012',61,None),('003',62,None),('005',63,None),('024',64,None),('006',65,None),('007',66,None),('008',67,None),('017',68,None),('014',69,None),('tulsa',70,'New York University - Tulsa'),('018',71,None),('033',72,None),('031',73,None),('034',74,None)]:text_table(m,p,branch('193900',suffix,label),[n],['oncampus','residential','_noncampusresidential','noncampus','publicproperty','_total'],[2022,2023,2024],offset=-3)
for stem,suffix,n in [('asr-7870c798','016',24),('asr-c91a3c0e','013',27),('asr-cd2271cc','002',28),('asr-cd2271cc','025',29),('asr-cd2271cc','023',30)]:
 m,p=source('nyu',stem);text_table(m,p,branch('193900',suffix),[n],['oncampus','residential','_noncampusresidential','noncampus','publicproperty','_total'],[2022,2023,2024],offset=-3 if stem=='asr-cd2271cc' else -2)
# Brown appends a separate three-year residence block after three four-geography year blocks.
m,p=source('brown','asr-db304ea7');b=branch('217156','001');n=42
for c in CATS:
 pat=r'(?<![A-Za-z])'+PAT[c]+r'\s+((?:(?:\d+)[*]*\s+){14}\d+[*]*)(?=\s|$)'
 hits=[h for h in re.finditer(pat,p[n],re.I) if not (c=='rape' and re.search(r'statutory\s*$',p[n][max(0,h.start()-20):h.start()],re.I)) and not (c=='negligent_manslaughter' and re.search(r'non[-\s]*$',p[n][max(0,h.start()-20):h.start()],re.I))]
 assert hits,(c,'Brown');hit=hits[0];v=re.findall(r'\d+[*]*',hit[1])
 for yi,y in enumerate([2024,2023,2022]):
  mapped=dict(zip(['oncampus','noncampus','publicproperty','_total'],v[yi*4:yi*4+4]));mapped['residential']=v[12+yi]
  for g,x in mapped.items():
   if not g.startswith('_'):emit(m,b,c,y,g,x,n,p[n][:hit.start()].count('\n')+1,n-2)
  check_total(m,b,c,y,mapped,n)

# Dartmouth geometry cells preserve N/A for dating violence, reported within domestic violence.
m,p=source('dartmouth','asr-d24ab270')
with pdfplumber.open(ROOT/m['local_pdf']) as pdf:
 for suffix,start in [('001',104),('002',110)]:
  b=branch('182670',suffix)
  for n in range(start,start+3):
   tables=pdf.pages[n-1].extract_tables();GRID[f'dartmouth:{n}']=tables;carry=None
   for cells in tables[0]:
    if cells[0]:carry=match_cat(cells[0])
    if not carry or len(cells)!=7 or cells[1] not in ['2022','2023','2024']:continue
    y=int(cells[1]);mapped=dict(zip(['_total','publicproperty','noncampus','oncampus','residential'],cells[2:]))
    for g,v in mapped.items():
     if not g.startswith('_'):emit(m,b,carry,y,g,v,n,'geometry grid row',n-2)
    check_total(m,b,carry,y,mapped,n)
# Notre Dame: fourteen printed categories, three year blocks, five geography columns per year.
m,p=source('notredame','asr-03e3d6ce')
with pdfplumber.open(ROOT/m['local_pdf']) as pdf:
 for suffix,n in [('001',20),('007',21),('003',22),('005',23),('002',24),('004',25),('006',26)]:
  b=branch('152080',suffix);tables=pdf.pages[n-1].extract_tables();GRID[f'notredame:{n}']=tables
  vals=[];geos=['oncampus','noncampus','publicproperty','_total']+(['residential'] if 'Resid' in tables[0][0] else [])
  for cells in tables[0]:
   v=[x.strip() for x in cells[1:] if x is not None and re.fullmatch(r'\d+[*]*',x.strip())]
   if len(v)==len(geos)*3 and not all(x in ['2022','2023','2024'] for x in v):vals.append(v)
  assert len(vals)>=14,(n,len(vals))
  for ci,c in enumerate(CATS):
   for yi,y in enumerate([2022,2023,2024]):
    mapped=dict(zip(geos,vals[ci][yi*len(geos):(yi+1)*len(geos)]))
    for g,v in mapped.items():
     if not g.startswith('_'):emit(m,b,c,y,g,v,n,f'printed category row {ci+1}',n-1)
    if 'residential' not in mapped:emit(m,b,c,y,'residential','',n,'geography column absent',n-1,status='not_reported_geography')
    check_total(m,b,c,y,mapped,n)
# Stanford multiline grid cells, including all eleven separate branch reports.
stanford=[('asr-286cc8cb','001',101),('asr-20a8f5b6','008',56),('asr-2d82a268','004',55),('asr-2ff41a87','013',56),('asr-76bb9723','006',55),('asr-85c3c77c','015',72),('asr-86452e9c','002',70),('asr-9418b63f','009',55),('asr-99ae13f0','010',55),('asr-c7f8c0e9','003',72),('asr-ef2fd94e','014',55),('asr-f26ce135','007',56)]
for stem,suffix,start in stanford:
 m,p=source('stanford',stem);b=branch('243744',suffix);done=set()
 with pdfplumber.open(ROOT/m['local_pdf']) as pdf:
  for n in [start,start+1]:
   tables=pdf.pages[n-1].extract_tables();GRID[f'stanford:{suffix}:{n}']=tables
   for table in tables:
    for cells in table:
     if len(cells)<7 or not cells[0] or not cells[1]:continue
     c=match_cat(cells[0]);years=re.findall(r'202[234]',cells[1])
     if not c or years!=['2022','2023','2024'] or c in done:continue
     v=[x.splitlines() for x in cells[2:7]];assert all(len(x)==3 for x in v),(stem,n,c,v);done.add(c)
     for yi,y in enumerate([2022,2023,2024]):
      mapped={g:v[gi][yi] for gi,g in enumerate(['residential','oncampus','noncampus','publicproperty','_total'])}
      for g,x in mapped.items():
       if not g.startswith('_'):emit(m,b,c,y,g,x,n,'multiline geometry grid',n)
      check_total(m,b,c,y,mapped,n)
 assert done==set(CATS),(stem,'missing',set(CATS)-done)

# Princeton: manual transcription from rendered visible pp48–51. Hidden obsolete
# tables are not the current visible source. Values are [on,res,non,pub,total], years24/23/22.
m,p=source('princeton','asr-7771cb32')
manual={
 'murder':[[0]*5]*3,'negligent_manslaughter':[[0]*5]*3,
 'rape':[[8,3,2,0,10],[6,5,0,0,6],[6,6,0,0,6]],
 'fondling':[[2,1,4,0,6],[0,0,1,0,1],[4,3,0,0,4]],
 'incest':[[0]*5]*3,'statutory_rape':[[0]*5]*3,
 'robbery':[[0,0,0,1,1],[0]*5,[0]*5],
 'aggravated_assault':[[2,0,1,0,3],[1,1,0,0,1],[0]*5],
 'burglary':[[4,3,0,0,4],[8,4,2,0,10],[9,9,0,0,9]],
 'motor_vehicle_theft':[[46,0,1,0,47],[36,0,0,0,36],[49,0,1,0,50]],
 'arson':[[0]*5,[0]*5,[1,1,0,0,1]],
 'domestic_violence':[[0,0,1,0,1],[4,3,0,0,4],[0]*5],
 'dating_violence':[[6,4,0,0,6],[0]*5,[4,1,0,0,4]],
 'stalking':[[7,0,0,0,7],[3,0,0,0,3],[4,0,0,0,4]]}
for suffix in ['001','002']:
 b=branch('186131',suffix)
 for c in CATS:
  n=(50 if c in CATS[:11] else 52)+(suffix=='002')
  for yi,y in enumerate([2024,2023,2022]):
   mapped={g:str(v) for g,v in zip(['oncampus','residential','noncampus','publicproperty','_total'],manual[c][yi] if suffix=='001' else [0]*5)}
   for g,v in mapped.items():
    if not g.startswith('_'):emit(m,b,c,y,g,v,n,'visible rendered table; stale hidden layer excluded',n-2)
   check_total(m,b,c,y,mapped,n)

# Duke's independent agent transcribed and audited the three raster-only pages.
for row in csv.DictReader((ROOT/'duke_2025_core_counts.csv').open(encoding='utf-8-sig')):
 row['report_year']=int(row['report_year']);row['report_edition']=int(row['report_edition']);ROWS.append(row)
conflicts={(x['campus'],x['year'],x['category']) for x in ISSUES}
for row in ROWS:
 if (row['campus_id'],row['report_year'],row['category']) in conflicts:row['status']='source_total_conflict'
# Audit Stanford's sex-offense subtotal, separately from geography totals. A
# printed subtotal contradicts its components in Madrid2024 noncampus only.
sex_cats=['rape','fondling','incest','statutory_rape'];subconflicts=set()
idx={(r['campus_id'],r['report_year'],r['category'],r['geography']):r for r in ROWS}
for k,tables in GRID.items():
 if not k.startswith('stanford:'):continue
 _,suffix,pg=k.split(':');b='243744'+suffix
 for table in tables:
  for cells in table:
   if len(cells)<7 or not (cells[0] or '').startswith('Total Sex Offenses'):continue
   for gi,g in enumerate(GEO):
    for yi,y in enumerate([2022,2023,2024]):
     printed=int(cells[2+gi].splitlines()[yi]);computed=sum(int(idx[(b,y,c,g)]['count']) for c in sex_cats)
     if printed!=computed:
      subconflicts.add((b,y,g))
      ISSUES.append(dict(type='printed_category_subtotal_differs_from_components',campus=b,year=y,geography=g,categories=sex_cats,computed=computed,printed=printed,pdf_page=int(pg),source=idx[(b,y,'fondling',g)]['source_url'].split('#')[0]))
for row in ROWS:
 if row['category'] in sex_cats and (row['campus_id'],row['report_year'],row['geography']) in subconflicts:row['status']='source_total_conflict'
ROWS.sort(key=lambda r:(r['institution_unitid'],r['campus_id'],r['report_year'],r['category'],r['geography']))
keys=[(r['campus_id'],r['report_year'],r['category'],r['geography']) for r in ROWS];assert len(keys)==len(set(keys))
for c in {r['campus_id'] for r in ROWS}:assert sum(r['campus_id']==c for r in ROWS)==168,(c,'incomplete')
with (ROOT/'current_2025_core_counts.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=list(ROWS[0]));w.writeheader();w.writerows(ROWS)
(ROOT/'extraction_2025_issues.json').write_text(json.dumps({'issues':ISSUES,'printed_total_checks':TOTALS},indent=2)+'\n')
(ROOT/'2025_geometry_tables.json').write_text(json.dumps(GRID,indent=2)+'\n')
print(json.dumps({'rows':len(ROWS),'branches':len({r['campus_id'] for r in ROWS}),'institutions':len({r['institution_unitid'] for r in ROWS}),'issues':ISSUES,'sha256':hashlib.sha256((ROOT/'current_2025_core_counts.csv').read_bytes()).hexdigest()},indent=2))
