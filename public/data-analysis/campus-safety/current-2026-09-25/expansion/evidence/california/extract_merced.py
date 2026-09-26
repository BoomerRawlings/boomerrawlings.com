from pathlib import Path
import csv,json,re
from pypdf import PdfReader
p=Path('california/merced_2025_asr.pdf'); doc=PdfReader(p); metadata=json.loads(p.with_suffix('.browser_metadata.json').read_text())
CATS=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','domestic_violence','dating_violence','stalking']
rows=[]
for pg,cats in [(156,CATS[:11]),(157,CATS[11:])]:
    text=doc.pages[pg-1].extract_text()
    matches=re.findall(r'\b(202[234])\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)',text)[:len(cats)*3]
    assert len(matches)==len(cats)*3
    for i,m in enumerate(matches):
        year=int(m[0]); nums=list(map(int,m[1:])); assert nums[0]+nums[2]+nums[3]==nums[4]; assert nums[1]<=nums[0]
        for geo,value in zip(['oncampus','residential','noncampus','publicproperty'],nums):
            rows.append(dict(report_edition=2025,report_year=year,institution_unitid='445188',campus_id='445188001',campus='University of California, Merced',category=cats[i//3],category_label=cats[i//3].replace('_',' '),family='vawa' if i//3>=11 else 'criminal_offenses',geography=geo,count=value,raw_value=str(value),status='reported_numeric',pdf_page=pg,printed_page='unnumbered statistics appendix',source_line='',source_url=metadata['source_url']+'#page='+str(pg),source_sha256=metadata['sha256'],source_note='Official linked 2025 ASR recovered through ordinary browser download; PDF156–157 visually verified. The source edition covers calendar2022–2024.'))
for r in rows:r['family']='vawa' if r['category'] in CATS[-3:] else 'criminal_offenses'
with Path('california/merced_core_counts.csv').open('w',encoding='utf8',newline='') as f:
    w=csv.DictWriter(f,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
print('Extracted',len(rows),'cells')
