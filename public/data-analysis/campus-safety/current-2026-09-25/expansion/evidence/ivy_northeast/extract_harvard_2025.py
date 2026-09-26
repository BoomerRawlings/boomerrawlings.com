"""Extract 14 core categories; preserve unprinted geographies as unknown."""
from pathlib import Path
import csv, json, re, hashlib

ROOT = Path(__file__).resolve().parent
META = json.loads((ROOT/'raw/harvard_asr_report.metadata.json').read_text(encoding='utf-8'))
PAGES = json.loads((ROOT/'raw/harvard_asr_report.pages.json').read_text(encoding='utf-8'))
CATS = [('Murder','murder','Murder/Nonnegligent Manslaughter'),('Manslaughter','negligent_manslaughter','Negligent Manslaughter'),('Rape','rape','Rape'),('Fondling','fondling','Fondling'),('Incest','incest','Incest'),('Statutory Rape','statutory_rape','Statutory Rape'),('Robbery','robbery','Robbery'),('Aggravated Assault','aggravated_assault','Aggravated Assault'),('Burglary','burglary','Burglary'),('Motor Vehicle Theft','motor_vehicle_theft','Motor Vehicle Theft'),('Arson','arson','Arson'),('Domestic Violence','domestic_violence','Domestic Violence'),('Dating Violence','dating_violence','Dating Violence'),('Stalking','stalking','Stalking')]
# Exact name/address match against frozen federal crosswalk. No invented IDs.
CAMPUSES = [(70,'166027001','Cambridge Campus',6,{'oncampus':0,'noncampus':1,'publicproperty':2,'residential':4}), (71,'166027002','Longwood Campus',6,{'oncampus':0,'noncampus':1,'publicproperty':2,'residential':4}), (72,'166027004','Arnold Arboretum',4,{'oncampus':0,'publicproperty':1}), (73,'166027003','Concord Field Station',4,{'oncampus':0,'publicproperty':1}), (74,'166027006','Harvard Forest',5,{'oncampus':0,'publicproperty':1,'residential':3}), (75,'166027008','Center for Hellenic Studies - Nafplion, Greece',4,{'oncampus':0,'publicproperty':1}), (76,'166027009','DRCLAS - Chile',4,{'oncampus':0,'publicproperty':1})]
rows=[]; checks=[]
for page,cid,campus,width,cols in CAMPUSES:
    lines=PAGES[page-1].splitlines()
    rawrows=[]
    for i,(label,cat,canonical) in enumerate(CATS):
        found=[(n+1,t) for n,t in enumerate(lines) if re.match(r'^'+re.escape(label)+r'\s+\d',t)]
        assert len(found)==1,(page,label,found)
        line,text=found[0]; values=list(map(int,re.findall(r'\d+',text[len(label):])))
        assert len(values)==3*width,(page,label,values)
        rawrows.append(values)
        for y,year in enumerate([2022,2023,2024]):
            sub=values[y*width:(y+1)*width]
            assert sub[cols['oncampus']]+sub[cols['publicproperty']]+(sub[cols['noncampus']] if 'noncampus' in cols else 0)==sub[3 if width==6 else 2],(page,label,year,'source total')
            for geo in ['residential','oncampus','noncampus','publicproperty']:
                v=sub[cols[geo]] if geo in cols else ''
                rows.append(dict(report_edition=2025,report_year=year,institution_unitid=166027,campus_id=cid,campus=campus,category=cat,category_label=canonical,family='criminal_offenses' if i<11 else 'vawa',geography=geo,count=v,raw_value=v,status='reported_numeric' if geo in cols else 'not_reported',pdf_page=page,printed_page=page,source_line=line,source_url=META['url']+'#page='+str(page),source_sha256=META['sha256']))
    totals=[t for t in lines if re.match(r'^TOTAL\s+\d',t)][0]
    nums=list(map(int,re.findall(r'\d+',totals)))
    assert len(nums)==3*width
    assert [sum(v[j] for v in rawrows) for j in range(3*width)]==nums,(page,'column totals')
    checks.append({'pdf_page':page,'campus_id':cid,'source_row_and_column_totals':'PASS','unprinted_geographies':[g for g in ['residential','noncampus'] if g not in cols]})
out=ROOT/'harvard_2025_core_counts.csv'
with out.open('w',encoding='utf-8',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
audit={'status':'EXTRACTION_CHECKS_PASS_AWAITING_INDEPENDENT_VISUAL_REVIEW','rows':len(rows),'numeric_cells':sum(r['status']=='reported_numeric' for r in rows),'unprinted_cells':sum(r['status']=='not_reported' for r in rows),'source_sha256':META['sha256'],'csv_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'checks':checks,'limitations':['Missing geography columns are unknown, not inferred zero. No residential denominator adopted. Report edition 2025 covers statistics 2022–2024; latest listing checked by parent using browser.']}
(ROOT/'harvard_2025_extraction_check.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
print(json.dumps(audit))
