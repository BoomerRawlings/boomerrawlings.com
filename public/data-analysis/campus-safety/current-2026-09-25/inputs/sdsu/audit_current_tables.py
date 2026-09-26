"""Independent pdfplumber ruled-table verification of all current source cells."""
from pathlib import Path
from collections import Counter
import csv, hashlib, json
import pdfplumber

HERE=Path(__file__).resolve().parent
rows=list(csv.DictReader((HERE/'current_asr_all_counts.csv').open(encoding='utf-8',newline='')))
expected={(r['campus'],int(r['pdf_page']),r['category_label'],int(r['report_year']),r['geography']):r for r in rows}
checked=[];tables=0
with pdfplumber.open(HERE/'asr_2026_newdraft.pdf') as pdf:
    for page_number in range(7,20):
        page=pdf.pages[page_number-1]
        campus='San Diego' if page_number<12 else 'Imperial Valley' if page_number<16 else 'Georgia'
        previous_bottom=0
        for table in page.find_tables():
            values=[[c.strip() for c in row if c and c.strip()] for row in table.extract()]
            if not values or values[0]!=['Year','Campus Residential','Campus Total','Non-Campus','Public Property']:continue
            title_area=page.crop((0,previous_bottom,page.width,table.bbox[1]))
            title=(title_area.extract_text() or '').splitlines()[-1].strip()
            previous_bottom=table.bbox[3]
            assert len(values)==4 and [int(r[0]) for r in values[1:]]==[2023,2024,2025]
            for row in values[1:]:
                assert len(row)==5
                for geo,token in zip(['residential','oncampus','noncampus','publicproperty'],row[1:]):
                    key=(campus,page_number,title,int(row[0]),geo)
                    assert key in expected,('unmatched source cell',key)
                    output=expected[key]
                    assert token==output['raw_value'],(key,token,output)
                    assert output['status']==('source_NA' if token=='NA' else 'reported_numeric')
                    assert output['count']==('' if token=='NA' else token)
                    checked.append(key)
            tables+=1
assert len(checked)==len(set(checked))==len(rows)==756
assert tables==63
result={'status':'PASS','method':'Independent PDF ruled-table extraction with pdfplumber; no import from primary pypdf extractor.',
    'source_sha256':hashlib.sha256((HERE/'asr_2026_newdraft.pdf').read_bytes()).hexdigest(),
    'output_sha256':hashlib.sha256((HERE/'current_asr_all_counts.csv').read_bytes()).hexdigest(),
    'tables_checked':tables,'cells_checked':len(checked),'printed_category_heading_checks':tables,
    'source_status_counts':dict(Counter(r['status'] for r in rows)),
    'separate_visual_review':'A separate agent visually checked 252 core housing/on-campus cells on nine rendered pages. Extraction agent additionally inspected pages 10, 15 and 19 for NA, referrals and narrative counts.'}
(HERE/'independent_table_audit.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
