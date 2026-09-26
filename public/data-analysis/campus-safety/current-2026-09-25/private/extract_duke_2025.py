"""Reproduce Duke raster-table transcription after full visual cell inspection.

The three source tables are raster images. The matrices below are a manual,
source-derived transcription, not an OCR or inferred-zero reconstruction.
Columns: campus 2022/23/24; housing 2022/23/24; noncampus 2022/23/24;
public property 2022/23/24. Literal zeroes were printed in each source cell.
"""
from pathlib import Path
import csv, hashlib, json

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'retrieved/duke/asr-9b168b96.pdf'
DIGEST = '311504825d6edaa9509ad4d4bd3b10bb1af584f399191cbbbcc0605a14cf75ed'
URL = 'https://forms.hr.duke.edu/media/oarc/2025-Duke-ASR.pdf'
FIELDS = ['report_edition','report_year','institution_unitid','campus_id','campus','category','category_label','family','geography','count','raw_value','status','pdf_page','printed_page','source_line','source_url','source_sha256']
CATEGORIES = [
    ('murder','Murder/Non-Negligent Manslaughter'),
    ('negligent_manslaughter','Manslaughter by Negligence'),
    ('rape','RAPE'), ('fondling','FONDLING'), ('incest','INCEST'),
    ('statutory_rape','STATUTORY RAPE'), ('robbery','ROBBERY'),
    ('aggravated_assault','AGGRAVATED ASSAULT'), ('burglary','BURGLARY'),
    ('motor_vehicle_theft','MOTOR VEHICLE THEFT'), ('arson','ARSON'),
    ('stalking','STALKING (includes CYBERSTALKING)'),
    ('domestic_violence','DOMESTIC VIOLENCE'), ('dating_violence','DATING VIOLENCE')]

# Each source row is entered independently in its printed left-to-right order.
MATRICES = {
    '198419001': {
        'campus':'Main Campus (includes hospital and medical research areas)', 'pdf_page':41,
        'rows': [
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '8 3 2 | 7 3 1 | 2 3 0 | 0 0 0',
            '12 5 11 | 2 0 1 | 2 1 0 | 0 1 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '1 1 1 | 0 0 0 | 1 1 0 | 2 0 0',
            '9 4 2 | 0 0 0 | 4 1 1 | 1 1 1',
            '38 23 20 | 5 1 3 | 5 2 1 | 0 0 0',
            '14 36 36* | 0 0 1 | 5 3 4 | 0 0 2',
            '3 0 1 | 2 0 0 | 0 0 0 | 0 0 0',
            '34 42 44 | 11 15 15 | 6 8 3 | 0 0 0',
            '26 13 20 | 7 3 2 | 5 7 1 | 0 2 1',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
        ]},
    '198419002': {
        'campus':'Marine Lab at Beaufort, NC', 'pdf_page':42,
        'rows': [
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
        ]},
    '198419003': {
        'campus':'Duke in DC Program, Washington, DC', 'pdf_page':43,
        'rows': [
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 1 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
            '0 0 0 | 0 0 0 | 0 0 0 | 0 0 0',
        ]},
}


def main():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == DIGEST
    records=[]
    for cid, campus in MATRICES.items():
        assert len(campus['rows']) == len(CATEGORIES) == 14
        for index, ((category,label), row) in enumerate(zip(CATEGORIES,campus['rows']),1):
            blocks=[block.split() for block in row.split('|')]
            assert len(blocks)==4 and all(len(block)==3 for block in blocks)
            for geo, values in zip(['oncampus','residential','noncampus','publicproperty'],blocks):
                for year, value in zip([2022,2023,2024],values):
                    records.append(dict(report_edition=2025,report_year=year,institution_unitid='198419',campus_id=cid,
                        campus=campus['campus'],category=category,category_label=label,
                        family='vawa' if category in ['stalking','domestic_violence','dating_violence'] else 'criminal_offenses',
                        geography=geo,count=int(value.rstrip('*')),raw_value=value,status='reported_numeric',
                        pdf_page=campus['pdf_page'],printed_page=campus['pdf_page']-2,
                        source_line=f'raster primary/VAWA table; offense row {index}',
                        source_url=URL+f'#page={campus["pdf_page"]}',source_sha256=DIGEST))
    assert len(records)==len({(r['campus_id'],r['category'],r['report_year'],r['geography']) for r in records})==504
    with (ROOT/'duke_2025_core_counts.csv').open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,FIELDS);writer.writeheader();writer.writerows(records)
    (ROOT/'duke_2025_core_counts.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
    print('Duke:',len(records),'source-derived cells')


if __name__=='__main__':main()
