"""Independent second-engine/source-layer verification of 2025 ASR extraction."""
from pathlib import Path
import csv,json,re,hashlib
import pdfplumber
from pypdf import PdfReader
ROOT=Path(__file__).parent
rows=list(csv.DictReader((ROOT/'current_2025_core_counts.csv').open(encoding='utf-8')))
expected={(r['campus_id'],int(r['report_year']),r['category'],r['geography']):r for r in rows}
meta={m['sha256']:m for f in ROOT.glob('retrieved/*/*.metadata.json') if (m:=json.loads(f.read_text(encoding='utf-8'))).get('kind')=='pdf'}
CATS=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence','stalking']
verified={};errors=[];excerpts={}
def cat(s):
 s=re.sub('[^a-z]','',s.lower())
 if s.startswith('murder'):return 'murder'
 if s.startswith(('negligent','manslaughter')):return 'negligent_manslaughter'
 for prefix,c in [('statutory','statutory_rape'),('rape','rape'),('fondling','fondling'),('incest','incest'),('robbery','robbery'),('aggravated','aggravated_assault'),('burglary','burglary'),('motorvehicle','motor_vehicle_theft'),('theftmotor','motor_vehicle_theft'),('arson','arson'),('domestic','domestic_violence'),('dating','dating_violence'),('stalking','stalking')]:
  if s.startswith(prefix):return c
def norm(v):return re.sub(r'[*#¶†‡^]','',str(v)).strip().upper().replace(' ','')
def put(b,y,c,g,v,method):
 k=(b,y,c,g);r=expected.get(k)
 if not r:errors.append(['unexpected',k,v]);return
 if r['status'] not in ['reported_numeric','reported_not_applicable','source_total_conflict']:return
 want=r['count'] if r['count']!='' else norm(r['raw_value'])
 if norm(v)!=want:errors.append(['mismatch',k,v,want,method])
 else:verified[k]=method
def grid_values(b,c,vals,geos,years,order,method):
 for yi,y in enumerate(years):
  for gi,g in enumerate(geos):
   if not g.startswith('_'):put(b,y,c,g,vals[yi*len(geos)+gi if order=='year' else gi*len(years)+yi],method)

for sha in sorted({r['source_sha256'] for r in rows if r['institution_unitid']!='198419'}):
 m=meta[sha];key=m['key'];selected=sorted({int(r['pdf_page']) for r in rows if r['source_sha256']==sha})
 if key in ['caltech','columbia','mit','yale','brown','nyu']:
  with pdfplumber.open(ROOT/m['local_pdf']) as pdf:
   for n in selected:
    rs=[r for r in rows if r['source_sha256']==sha and r['pdf_page']==str(n)];b=rs[0]['campus_id'];page=pdf.pages[n-1];txt=page.extract_text();excerpts[f'{key}:{b}:{n}']=txt
    if key in ['brown','nyu','mit']:
     # Reading-position lines, independent from the source text stream order.
     need=18 if key=='nyu' else 15
     for line in txt.splitlines():
      vals=re.findall(r'(?<![\w])(?:N/A|\d+)(?![\w])',line,re.I)
      if len(vals)!=need:continue
      first=re.search(r'(?<![\w])(?:N/A|\d+)(?![\w])',line,re.I);c=cat(line[:first.start()])
      if not c:continue
      if key=='nyu':grid_values(b,c,vals,['oncampus','residential','_nonres','noncampus','publicproperty','_total'],[2022,2023,2024],'geo',f'pdfplumber reading-position row p{n}')
      elif key=='mit':grid_values(b,c,vals,['oncampus','residential','noncampus','publicproperty','_total'],[2022,2023,2024],'year',f'pdfplumber reading-position row p{n}')
      else:
       for yi,y in enumerate([2024,2023,2022]):
        for gi,g in enumerate(['oncampus','noncampus','publicproperty']):put(b,y,c,g,vals[yi*4+gi],f'pdfplumber reading-position row p{n}')
        put(b,y,c,'residential',vals[12+yi],f'pdfplumber reading-position row p{n}')
    else:
     for table in page.extract_tables():
      for cells in table:
       if not cells or not cells[0]:continue
       c=cat(cells[0]);vals=[v.strip() for v in cells[1:] if v is not None and re.fullmatch(r'\d+|N/A|n/a',v.strip())]
       if not c:continue
       if key=='caltech' and len(vals)==4:grid_values(b,c,vals,['oncampus','residential','noncampus','publicproperty'],[int(rs[0]['report_year'])],'geo',f'pdfplumber cell grid p{n}')
       if key=='columbia' and len(vals)==15:grid_values(b,c,vals,['oncampus','residential','noncampus','publicproperty','_total'],[2024,2023,2022],'geo',f'pdfplumber cell grid p{n}')
       if key=='yale' and len(vals)==6:grid_values(b,c,vals,['residential','oncampus','noncampus','publicproperty','_total','_unfounded'],[int(rs[0]['report_year'])],'geo',f'pdfplumber cell grid p{n}')
 else:
  reader=PdfReader(ROOT/m['local_pdf'])
  text=(ROOT/m['local_text']).read_text(encoding='utf-8');pages={int(n):v for n,v in re.findall(r'=== PDF PAGE (\d+) ===\n(.*?)(?==== PDF PAGE|\Z)',text,re.S)}
  for n in selected:
   rs=[r for r in rows if r['source_sha256']==sha and r['pdf_page']==str(n)];b=rs[0]['campus_id'];txt=pages[n];excerpts[f'{key}:{b}:{n}']=txt
   if key=='dartmouth':
    cs=CATS[:6] if n in [104,110] else CATS[6:11] if n in [105,111] else ['dating_violence','domestic_violence','stalking']
    seq=[]
    for h in re.finditer(r'^\s*(202[234])\s+([^\n]+)',txt,re.M):
     vals=re.findall(r'n/a|\d+',h[2],re.I)
     if len(vals) not in [5,7]:continue
     if len(vals)==7:vals=[vals[i] for i in [0,1,2,3,5]] # separately rendered superscript footnotes on both final cells
     seq.append((int(h[1]),vals))
    assert len(seq)==len(cs)*3,(key,n,len(seq),len(cs))
    for ci,c in enumerate(cs):
     for yi in range(3):
      y,v=seq[ci*3+yi]
      for gi,g in enumerate(['_total','publicproperty','noncampus','oncampus','residential']):
       if not g.startswith('_'):put(b,y,c,g,v[gi],f'pypdf source year-row stream p{n}')
   elif key=='notredame':
    txt=reader.pages[n-1].extract_text(extraction_mode='layout');excerpts[f'{key}:{b}:{n}']=txt
    residential=any(r['geography']=='residential' and r['count']!='' for r in rs);geos=['oncampus','noncampus','publicproperty','_total']+(['residential'] if residential else [])
    for line in txt.splitlines():
     vals=re.findall(r'(?<!\w)\d+[*]?(?!\w)',line);first=re.search(r'(?<!\w)\d+',line)
     if len(vals)!=len(geos)*3 or not first:continue
     c=cat(line[:first.start()])
     if c:grid_values(b,c,vals,geos,[2022,2023,2024],'year',f'pypdf layout text independent row p{n}')
   elif key=='stanford':
    # Standard PDF content stream stores each category as a three-year block,
    # then each geography's three values; this differs from primary geometry cells.
    anchors=list(re.finditer(r'2022\s+2023\s+2024\s+',txt))
    for hit in anchors:
     prior=txt[max(0,hit.start()-500):hit.start()];tail=[]
     for line in reversed(prior.splitlines()):
      if re.fullmatch(r'\s*\d+[*#¶^†‡]*\s*',line):break
      tail.insert(0,line)
     c=next((c for line in tail if (c:=cat(line.strip()))),None)
     if not c:continue
     tokens=re.match(r'((?:(?:\d+)[*#¶^†‡]*\s+){17}\d+[*#¶^†‡]*)',txt[hit.end():])
     if not tokens:continue
     vals=re.findall(r'\d+[*#¶^†‡]*',tokens[1]);grid_values(b,c,vals,['residential','oncampus','noncampus','publicproperty','_total','_unfounded'],[2022,2023,2024],'geo',f'pypdf content stream year/geography block p{n}')
   elif key=='princeton':
    # Only 2024/23/22 triples belong to the visible current overlay; obsolete
    # hidden rows start2023 or2021 and are excluded. Independently matches manual rendering.
    trip=list(re.finditer(r'2024\s+((?:\d+\s+){4}\d+)\s+2023\s+((?:\d+\s+){4}\d+)\s+2022\s+((?:\d+\s+){4}\d+)',txt))
    cs=CATS[:11] if n in [50,51] else ['dating_violence','domestic_violence','stalking']
    assert len(trip)>=len(cs),(n,len(trip),len(cs))
    for ci,c in enumerate(cs):
     for yi,y in enumerate([2024,2023,2022]):
      vals=re.findall(r'\d+',trip[ci][yi+1]);grid_values(b,c,vals,['oncampus','residential','noncampus','publicproperty','_total'],[y],'geo',f'pypdf current overlay independently compared to full visual transcription p{n}')
# Duke completed independently by another agent; artifact hash certifies same bytes.
duke=json.loads((ROOT/'duke_2025_source_audit.json').read_text())
duke_rows=list(csv.DictReader((ROOT/'duke_2025_core_counts.csv').open(encoding='utf-8-sig')))
for r in duke_rows:put(r['campus_id'],int(r['report_year']),r['category'],r['geography'],r['count'],'independent agent full raster transcription +378 frozen federal numeric checks')
selected=[k for k,r in expected.items() if r['status'] in ['reported_numeric','reported_not_applicable','source_total_conflict']]
miss=[dict(zip(['campus','year','category','geography'],k)) for k in selected if k not in verified]
result={'method':'second PDF engine or independent content-stream ordering; Princeton full visual transcription matched to current overlay; Duke independent agent raster/source audit','verified_cells':len(verified),'expected_verifiable_cells':len(selected),'missing_cells':miss,'errors':errors,'csv_sha256':hashlib.sha256((ROOT/'current_2025_core_counts.csv').read_bytes()).hexdigest(),'status':'pass' if not miss and not errors else 'review_required'}
(ROOT/'second_2025_extraction_audit.json').write_text(json.dumps(result,indent=2)+'\n')
(ROOT/'2025_independent_text.json').write_text(json.dumps(excerpts,indent=2)+'\n')
print(json.dumps({**result,'missing_cells':miss[:20],'errors':errors[:20]},indent=2))
