"""Acquire public campus context; public derived files exclude staff contacts.

Official API contains public staff contact details. Original responses stay in raw/api;
only whitelisted campus/geography metadata and explanatory table text are normalized.
"""
from pathlib import Path
import csv,concurrent.futures,datetime,hashlib,html,json,re,urllib.request
HERE=Path(__file__).resolve().parent;RAW=HERE/'raw/api';RAW.mkdir(parents=True,exist_ok=True)
OUT=HERE/'normalized'
with(OUT/'cohort_campus_crosswalk_2025.csv').open(encoding='utf-8-sig',newline='')as f:campuses=list(csv.DictReader(f))

def fetch(c):
 id=c['campus_id'];url='https://ope.ed.gov/campussafety/api/campus/'+id;p=RAW/(id+'.json')
 if p.exists():data=p.read_bytes()
 else:
  with urllib.request.urlopen(url,timeout=60)as r:data=r.read()
  p.write_bytes(data)
 j=json.loads(data);h=j['Header'];a=h['Campus'];i=h['Institution']
 assert str(a['UnitID'])==id and str(i['ID'])==c['unitid']
 # Free-text Description embeds staff phone numbers in some campus responses;
 # omit it entirely along with the dedicated contact sections.
 entry={k:a.get(k)for k in ['UnitID','Name','Addr1','City','StateCode','Zip','CountryIsUS','Country','OnCampusHousingInfo','LocalCrimeInfo','SurveyYear','MatrixString']}
 entry.update(unitid=c['unitid'],label=c['label'],source_url=url,source_sha256=hashlib.sha256(data).hexdigest(),verified_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),interpretation='Current API snapshot; not assumed identical to frozen bulk or historical geography')
 notes=[]
 for g in j['Groups']:
  for s in g.get('Screens',[]):
   for r in s.get('Rows',[]):
    for cell in r.get('Cells',[]):
     raw=cell.get('Html')or'';text=html.unescape(re.sub('<[^>]*>',' ',raw));text=re.sub(r'\s+',' ',text).strip()
     if text and cell.get('CellStyle')=='B' and cell.get('ColSpan',0)>1 and '{{'not in text:
      notes.append({'unitid':c['unitid'],'campus_id':id,'label':c['label'],'group':g.get('Description'),'screen':s.get('ScreenName'),'text':text,'source_url':url})
 return entry,notes,{'file':'raw/api/'+id+'.json','url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
results=[];notes=[];sources=[];errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:
 jobs={pool.submit(fetch,c):c for c in campuses}
 for f in concurrent.futures.as_completed(jobs):
  c=jobs[f]
  try:
   a,b,m=f.result();results.append(a);notes.extend(b);sources.append(m)
  except Exception as e:errors.append({'campus_id':c['campus_id'],'error':str(e)})
  if(len(results)+len(errors))%25==0:print('campus contexts',len(results),'errors',len(errors),flush=True)
results.sort(key=lambda r:r['UnitID']);notes.sort(key=lambda r:(r['campus_id'],r['group'],r['screen'],r['text']))
(OUT/'cohort_campus_context_current.json').write_text(json.dumps(results,indent=2,ensure_ascii=False),encoding='utf-8')
(OUT/'cohort_context_notes_current.json').write_text(json.dumps(notes,indent=2,ensure_ascii=False),encoding='utf-8')
(HERE/'context_source_metadata.json').write_text(json.dumps({'status':'PASS'if not errors else'PARTIAL','files':sorted(sources,key=lambda r:r['file']),'errors':errors,'public_exclusions':'Staff/contact sections are omitted from normalized/public context. Raw API responses should not be packaged.'},indent=2),encoding='utf-8')
print('COMPLETE',len(results),len(notes),'errors',errors,flush=True)
