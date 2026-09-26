"""Re-extract ruled tables independently of the sequential-text extractor."""
from pathlib import Path
import csv,hashlib,json
import pdfplumber
HERE=Path(__file__).resolve().parent
source=HERE/'merced_2025_asr.pdf'
ledger=list(csv.DictReader((HERE/'merced_core_counts.csv').open(encoding='utf8',newline='')))
labels={'Murder/ Non- negligent Manslaughter':'murder','Negligent Manslaughter':'negligent_manslaughter','Rape':'rape','Fondling':'fondling','Incest':'incest','Statutory Rape':'statutory_rape','Robbery':'robbery','Aggravated Assault':'aggravated_assault','Burglary':'burglary','Motor Vehicle Theft':'motor_vehicle_theft','Arson':'arson','Domestic Violence':'domestic_violence','Dating Violence':'dating_violence','Stalking':'stalking'}
expected={}
with pdfplumber.open(source) as pdf:
    for page in [156,157]:
        table=pdf.pages[page-1].extract_tables()[0]
        current=None
        for row in table:
            label=' '.join((row[0] or '').split())
            if label in labels: current=labels[label]
            if not row[1] or row[1] not in ['2022','2023','2024']: continue
            if page==157 and len(expected)>=168:break
            if current is None:continue
            values=list(map(int,row[2:]))
            assert values[0]+values[2]+values[3]==values[4]
            for geo,value in zip(['oncampus','residential','noncampus','publicproperty'],values):
                key=(current,row[1],geo)
                assert key not in expected,key
                expected[key]=value
            if page==157 and current=='stalking' and row[1]=='2022':break
assert len(expected)==len(ledger)==168
for row in ledger:
    assert expected[row['category'],row['report_year'],row['geography']]==int(row['count']),row
manual_housing={2022:12,2023:22,2024:14}
for year,value in manual_housing.items():
    actual=sum(int(r['count']) for r in ledger if r['report_year']==str(year) and r['geography']=='residential' and r['family']=='criminal_offenses')
    assert actual==value,(year,actual,value)
report={'status':'PASS','cells':168,'method':'Independent pdfplumber ruled-table extraction; compared against pypdf sequential text extraction. PDF156–157 rendered and visually inspected.','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'ledger_sha256':hashlib.sha256((HERE/'merced_core_counts.csv').read_bytes()).hexdigest(),'manual_combined_housing_controls':manual_housing,'geographic_total_identity':'oncampus + noncampus + publicproperty = printed total; housing is subset','edition':2025,'report_years':[2022,2023,2024]}
(HERE/'MERCED_SOURCE_AUDIT.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps(report))
