"""Independently extract recovered original UVA PDF and compare every prior web cell."""
from pathlib import Path
import csv, hashlib, json, re
from pypdf import PdfReader
HERE=Path(__file__).resolve().parent
OLD=HERE.parents[1]/'freshness_2026_09_25/public/uva_web'
PDF=HERE/'retrieved/virginia_asr_2026.pdf'
SOURCE='https://cleryact.virginia.edu/sites/cleryact/files/2026-09/UVA_Annual_Fire_Safety_Security_Report_2026_FINAL.pdf'
HASH=hashlib.sha256(PDF.read_bytes()).hexdigest()
assert HASH=='a8f39155d2dec776fd6690ee92813a47ecac10836169ad7a80f2faff07f34641'
reader=PdfReader(PDF)
CATS=['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','dating_violence','domestic_violence','stalking']
GEO=['residential','oncampus','noncampus','publicproperty']
CAMPUSES={113:('234076001','Charlottesville'),123:('234076012','Darden Sands Family Grounds'),131:('234076009','Mountain Lake Biological Station'),140:('234076005','Richmond Center: School of Nursing'),149:('234076013','UVA-Inova Fairfax Campus'),157:('234076014','Morven Sustainability Lab')}
# Explicit notes above each branch table establish these inapplicable geographies.
NA={113:set(),123:{'residential'},131:{'noncampus'},140:{'residential','noncampus'},149:{'residential','noncampus'},157:{'residential','noncampus'}}
rows=[];tablechecks=[]
for page,(cid,campus) in CAMPUSES.items():
    text=reader.pages[page-1].extract_text(extraction_mode='layout')
    (HERE/'retrieved'/f'virginia_asr_2026_page{page}.layout.txt').write_text(text,encoding='utf-8')
    assert re.search(r'2025\s+2024\s+2023',text),(page,'year order')
    matched=[]
    for line_no,line in enumerate(text.splitlines(),1):
        m=re.search(r'((?:(?:\d+|–)\s+){17}(?:\d+|–))\s*$',line)
        if m: matched.append((line_no,m[1].split()))
    assert len(matched)==14,(page,len(matched))
    for cat,(line_no,raw) in zip(CATS,matched):
        for yi,year in enumerate([2025,2024,2023]):
            tokens=raw[6*yi:6*yi+6]
            values=[None if x=='–' else int(x) for x in tokens]
            assert values[4]==sum(x or 0 for x in values[1:4]),(page,cat,year,'total')
            if values[0] is not None: assert values[0]<=values[1]
            for gi,geo in enumerate(GEO):
                assert (values[gi] is None)==(geo in NA[page]),(page,cat,year,geo,'explicit geography note')
                rows.append(dict(report_edition=2026,report_year=year,institution_unitid='234076',campus_id=cid,campus=campus,category=cat,category_label=cat.replace('_',' '),family='vawa' if cat in CATS[-3:] else 'criminal_offenses',geography=geo,count=values[gi],raw_value=tokens[gi],status='source_not_applicable' if values[gi] is None else 'reported_numeric',pdf_page=page,printed_page=page-7,source_line=line_no,source_url=SOURCE+f'#page={page}',source_sha256=HASH,source_reported_total=values[4],source_unfounded=values[5],source_note='Original official PDF independently extracted and visually checked. Explicit branch-geography notes establish dashes as inapplicable, not observed zero.'))
    tablechecks.append(dict(pdf_page=page,printed_page=page-7,campus_id=cid,campus=campus,category_rows=14,year_groups=[2025,2024,2023],visually_checked=True,inapplicable_geographies=sorted(NA[page])))
assert len(rows)==1008
def key(r): return (r['campus_id'],str(r['report_year']),r['category'],r['geography'])
old={key(r):r for r in csv.DictReader((OLD/'current_core_counts.csv').open(encoding='utf-8-sig'))}
assert len(old)==len(rows)
differences=[]
for row in rows:
    prev=old[key(row)]
    for field in ['count','raw_value','status','pdf_page','printed_page','source_reported_total','source_unfounded']:
        now='' if row[field] is None else str(row[field])
        if now!=prev[field]: differences.append(dict(key=key(row),field=field,previous=prev[field],current=now))
assert not differences,differences
with (HERE/'current_core_counts.csv').open('w',encoding='utf-8',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
checks=dict(status='original_pdf_extracted_all_core_cells_match_prior_web_extraction_and_visually_verified',source_url=SOURCE,source_sha256=HASH,pdf_pages=195,core_cells=len(rows),numeric_cells=sum(r['count'] is not None for r in rows),inapplicable_cells=sum(r['count'] is None for r in rows),prior_web_comparison_cells=len(rows),prior_web_differences=differences,table_checks=tablechecks,scope_notes=['Six campuses have2023–2025 statistics. Valmarana is explicitly not a separate campus in those years; no historical zero is created.','2024 Charlottesville fondling includes50 incidents from one report, per PDF115 footnote. Reporting-year counts are not occurrence-year counts.','2022 values remain attributed to earlier sources. Original federal CSV is unchanged.'])
(HERE/'UVA_VERIFICATION.json').write_text(json.dumps(checks,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in checks.items() if k!='table_checks'},indent=2))
