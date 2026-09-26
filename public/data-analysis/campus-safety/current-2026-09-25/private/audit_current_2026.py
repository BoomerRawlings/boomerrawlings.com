"""Second extraction uses PDF geometry tables (pdfplumber), separately from pypdf text parser."""
from pathlib import Path
import csv,json,re,hashlib
import pdfplumber
ROOT=Path(__file__).parent
rows=list(csv.DictReader((ROOT/'current_asr_core_counts.csv').open(encoding='utf-8')))
expected={(r['campus_id'],int(r['report_year']),r['category'],r['geography']):r for r in rows}
metadata={r['sha256']:r for p in ROOT.glob('retrieved/*/*.metadata.json') if (r:=json.loads(p.read_text(encoding='utf-8'))).get('kind')=='pdf'}
verified={};errors=[];page_tables={};geo_index={}
def cat(s):
 s=re.sub(r'\d+','',s or '').lower();s=re.sub(r'[^a-z]','',s)
 if s.startswith('murder'):return 'murder'
 if s.startswith('manslaughter') or s.startswith('negligentmanslaughter') or s=='negligent':return 'negligent_manslaughter'
 for label,key in [('statutoryrape','statutory_rape'),('rape','rape'),('fondling','fondling'),('incest','incest'),('robbery','robbery'),('aggravatedassault','aggravated_assault'),('burglary','burglary'),('motorvehicletheft','motor_vehicle_theft'),('arson','arson'),('domesticviolence','domestic_violence'),('datingviolence','dating_violence'),('stalking','stalking')]:
  if s.startswith(label):return key
 return None

def put(b,y,c,g,v,detail):
 k=(b,y,c,g);r=expected.get(k)
 if not r:errors.append(['unexpected',k,v,detail]);return
 if r['status'] not in ['reported_numeric','reported_not_applicable','source_total_conflict']:return
 raw=v.strip().upper().replace(' ','')
 exp=r['count'] if r['count']!='' else r['raw_value'].strip().upper().replace(' ','')
 if raw!=exp:errors.append(['mismatch',k,raw,exp,detail])
 else:verified[k]=detail

for sha in {r['source_sha256'] for r in rows if r['status'] in ['reported_numeric','reported_not_applicable','source_total_conflict'] and r['pdf_page']}:
 m=metadata[sha]; key=m['key'];page_numbers=sorted({int(r['pdf_page']) for r in rows if r['source_sha256']==sha and r['pdf_page'] and r['status'] in ['reported_numeric','reported_not_applicable','source_total_conflict']})
 with pdfplumber.open(ROOT/m['local_pdf']) as pdf:
  for n in page_numbers:
   rs=[r for r in rows if r['source_sha256']==sha and r['pdf_page']==str(n)];b=rs[0]['campus_id'];page=pdf.pages[n-1];ts=page.extract_tables();page_tables[f'{key}:{sha[:8]}:{n}']=ts
   if key=='cmu':
    text=page.extract_text();is_vawa='Violence Against Women Act Offenses' in text
    if is_vawa:
     text=text.split('Violence Against Women Act Offenses')[1].split('Hate Crimes')[0];cats=['dating_violence','domestic_violence','stalking']
    else:cats=['murder','negligent_manslaughter','robbery','aggravated_assault','motor_vehicle_theft','arson','burglary','rape','fondling','incest','statutory_rape']
    vals=[]
    for line in text.splitlines():
     tokens=re.findall(r'(?<![\w])(?:n/a|\d+)(?![\w])',line,re.I)
     tokens=[v for v in tokens if v not in ['2023','2024','2025']]
     if len(tokens)==5:vals.append(tokens)
    assert len(vals)>=len(cats)*3,(key,n,len(vals),len(cats))
    for ci,c in enumerate(cats):
     for yi,y in enumerate([2025,2024,2023]):
      for gi,g in enumerate(['oncampus','residential','noncampus','publicproperty']):put(b,y,c,g,vals[ci*3+yi][gi],f'pdfplumber numeric row order p{n}')
    continue
   for table in ts:
    carry=None;pending=''
    for cells in table:
     if not cells:continue
     if key=='georgetown':
      vals=[(v or '').strip() for v in cells[1:] if re.fullmatch(r'\d+|N/?A|n/?a',(v or '').strip())]
      if len(vals)!=15 or all(v in ['2023','2024','2025'] for v in vals):continue
      ci=geo_index.get(b,0);geo_index[b]=ci+1
      cats=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence','stalking']
      if ci>=14:continue
      for gi,g in enumerate(['residential','oncampus','noncampus','publicproperty']):
       for yi,y in enumerate([2023,2024,2025]):put(b,y,cats[ci],g,vals[3+gi*3+yi],f'pdfplumber independent grid row sequence p{n}')
      continue
     label=cells[0] or ''
     if key in ['northwestern','chicago']:
      if label:carry=cat(label)
      if len(cells)<3 or (cells[1] or '').strip() not in ['2023','2024','2025'] or not carry:continue
      y=int(cells[1]);geos=(['oncampus','residential','noncampus','publicproperty'] if b=='147767001' else ['oncampus','noncampus','publicproperty'] if key=='northwestern' and b not in ['147767004','147767006'] else ['oncampus','publicproperty'] if key=='northwestern' else ['residential','oncampus','noncampus','publicproperty'])
      for gi,g in enumerate(geos):put(b,y,carry,g,cells[2+gi],f'pdfplumber grid p{n}')
     else:
      vals=[(v or '').strip() for v in cells[1:] if re.fullmatch(r'\d+|N/?A|n/?a',(v or '').strip())]
      if not vals:
       if label and re.search(r'Murder|Negligent|Manslaughter|Aggravated|Motor Vehicle|Domestic|Dating',label,re.I):pending+=' '+label
       continue
      c=cat((pending+' '+label).strip());pending=''
      if not c:continue
      if key=='cornell':geos=['oncampus','residential','publicproperty','noncampus'];years=[2023,2024,2025];offset=0;order='geo'
      elif key=='usc':geos=['residential','oncampus','publicproperty','noncampus'];years=[2025,2024,2023];offset=0;order='year'
      elif key=='georgetown':geos=['residential','oncampus','noncampus','publicproperty'];years=[2023,2024,2025];offset=3;order='geo'
      elif key=='penn':geos=['residential','oncampus','noncampus','publicproperty'];years=[2025 if n==70 else 2024 if n==71 else 2023];offset=0;order='geo'
      else:continue
      if len(vals)<offset+len(geos)*len(years):continue
      for gi,g in enumerate(geos):
       for yi,y in enumerate(years):put(b,y,c,g,vals[offset+(yi*len(geos)+gi if order=='year' else gi*len(years)+yi)],f'pdfplumber grid p{n}')
# Cornell AgriTech is native HTML. DOM table cells preserve an independent extraction boundary.
from html.parser import HTMLParser
class Tables(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=='tr':self.row=[]
  if tag in ['td','th']:self.cell=''
 def handle_data(self,data):
  if self.cell is not None:self.cell+=data
 def handle_endtag(self,tag):
  if tag in ['td','th'] and self.row is not None and self.cell is not None:self.row.append(self.cell.strip());self.cell=None
  if tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None
m=next(json.loads(p.read_text()) for p in ROOT.glob('retrieved/cornell/*.metadata.json') if json.loads(p.read_text()).get('url')=='https://cals.cornell.edu/2026-agritech-annual-security-report')
soup=Tables();soup.feed((ROOT/m['local_html']).read_text(encoding='utf-8'))
for cells in soup.rows:
 if len(cells)!=13:continue
 c=cat(cells[0])
 if not c:continue
 for gi,g in enumerate(['oncampus','residential','publicproperty','noncampus']):
  for yi,y in enumerate([2023,2024,2025]):put('190415003',y,c,g,cells[1+gi*3+yi],'HTMLParser DOM table cell')
selected=[k for k,r in expected.items() if r['status'] in ['reported_numeric','reported_not_applicable','source_total_conflict']]
miss=[dict(zip(['campus','year','category','geography'],k)) for k in selected if k not in verified]
result={'method':'independent pdfplumber geometry tables and CMU numeric row ordering; native HTML DOM tables','verified_cells':len(verified),'expected_verifiable_cells':len(selected),'missing_cells':miss,'errors':errors,'csv_sha256':hashlib.sha256((ROOT/'current_asr_core_counts.csv').read_bytes()).hexdigest(),'status':'pass' if not miss and not errors else 'review_required'}
(ROOT/'second_extraction_audit.json').write_text(json.dumps(result,indent=2)+'\n')
(ROOT/'pdfplumber_tables.json').write_text(json.dumps(page_tables,indent=2)+'\n')
print(json.dumps({**result,'missing_cells':miss[:18],'errors':errors[:18]},indent=2))

