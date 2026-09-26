"""Offline checks plus comparison with independently acquired federal cells.

The primary source is raster; the initial transcription and all three source
pages were reviewed visually. The federal comparison is corroboration for
numeric cells, not authority to fill an absent source value.
"""
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
import csv, hashlib, json

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
SOURCE = ROOT / 'retrieved/duke/asr-9b168b96.pdf'
FEDERAL = PROJECT / 'sources/clery/normalized/cohort_campus_counts_2022_2024.csv'
SOURCE_SHA = '311504825d6edaa9509ad4d4bd3b10bb1af584f399191cbbbcc0605a14cf75ed'


def main():
    assert sha(SOURCE) == SOURCE_SHA
    new = list(csv.DictReader((ROOT / 'duke_2025_core_counts.csv').open(encoding='utf-8', newline='')))
    json_rows = json.loads((ROOT / 'duke_2025_core_counts.json').read_text(encoding='utf-8'))
    assert new == [{k:str(v) for k,v in row.items()} for row in json_rows]
    key=lambda r:(r['campus_id'],r['report_year'],r['category'],r['geography'])
    assert len(new)==len({key(r) for r in new})==504
    assert all(r['status']=='reported_numeric' and r['count']==str(int(r['raw_value'].rstrip('*'))) for r in new)
    assert all(r['source_sha256']==SOURCE_SHA and int(r['printed_page'])==int(r['pdf_page'])-2 for r in new)
    old=list(csv.DictReader(FEDERAL.open(encoding='utf-8-sig',newline='')))
    cats=dict(zip(['MURD','NEG_M','RAPE','FONDL','INCES','STATR','ROBBE','AGG_A','BURGLA','VEHIC','ARSON','STALK','DOMEST','DATING'],
                  ['murder','negligent_manslaughter','rape','fondling','incest','statutory_rape','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','stalking','domestic_violence','dating_violence']))
    geos={'on_campus':'oncampus','residential_facilities':'residential','noncampus':'noncampus','public_property':'publicproperty'}
    idx={(r['campus_id'],r['year'],cats[r['offense_code']],geos[r['geography']]):r for r in old
         if r['unitid']=='198419' and r['offense_code'] in cats and r['geography'] in geos and r['family'] in ['criminal_offenses','vawa']}
    comparison=[]
    for row in new:
        prior=idx[key(row)]
        status='numeric_agreement' if prior['count']==row['count'] else 'federal_blank_current_report_explicit_zero' if prior['count']=='' and row['count']=='0' else 'numeric_difference'
        comparison.append({'campus_id':row['campus_id'],'year':row['report_year'],'category':row['category'],'geography':row['geography'],
                           'federal_count':prior['count'],'current_report_count':row['count'],'comparison':status,
                           'current_pdf_page':row['pdf_page'],'federal_source_file':prior['source_file'],'federal_source_row':prior['source_sheet_row'],'federal_source_column':prior['source_column']})
    status_counts=Counter(r['comparison'] for r in comparison)
    assert status_counts=={'numeric_agreement':378,'federal_blank_current_report_explicit_zero':126}
    with (ROOT/'duke_2025_federal_comparison.csv').open('w',encoding='utf-8',newline='') as stream:
        writer=csv.DictWriter(stream,list(comparison[0]));writer.writeheader();writer.writerows(comparison)
    lookup={key(r):r for r in new}
    for row in new:
        if row['geography']=='residential':
            other=lookup[(row['campus_id'],row['report_year'],row['category'],'oncampus')]
            assert int(row['count']) <= int(other['count'])
    totals=Counter()
    for row in new:
        if row['family']=='criminal_offenses':totals[(row['campus_id'],row['report_year'],row['geography'])]+=int(row['count'])
    for year,campus,housing in [(2022,85,16),(2023,72,4),(2024,73,6)]:
        assert totals[('198419001',str(year),'oncampus')]==campus
        assert totals[('198419001',str(year),'residential')]==housing
    record={'status':'PASS','checked_utc':datetime.now(timezone.utc).isoformat(),'source_url':'https://forms.hr.duke.edu/media/oarc/2025-Duke-ASR.pdf',
            'source_sha256':SOURCE_SHA,'report_edition':2025,'report_years':[2022,2023,2024],
            'source_method':'Manual transcription of raster source tables; all 504 source cells visually inspected on rendered pages 41–43, printed 39–41. No OCR extraction claimed.',
            'source_cells':504,'numeric_agreement_with_federal_cells':378,'federal_blank_current_report_explicit_zero_cells':126,'numeric_disagreements':0,
            'federal_input_sha256':sha(FEDERAL),'csv_sha256':sha(ROOT/'duke_2025_core_counts.csv'),'extractor_sha256':sha(ROOT/'extract_duke_2025.py'),
            'render_checks':[{'pdf_page':p,'printed_page':p-2,'path':f'duke_audit_renders/duke-{p}.png','sha256':sha(ROOT/f'duke_audit_renders/duke-{p}.png')} for p in [41,42,43]],
            'footnotes':[
                {'pdf_page':41,'scope':'Main campus includes hospital and medical research areas; not an exclusively student-residential population.'},
                {'pdf_page':41,'scope':'Residential crime figures are already included in on-campus figures; the same statement appears on PDF 42 and 43.'},
                {'pdf_page':41,'scope':'2024 on-campus motor vehicle theft is printed 36*. The footnote identifies 14 of 2024 motor vehicle thefts as electric scooters/bikes; raw marker preserved.'},
                {'pdf_page':43,'scope':'Duke in DC has no on-campus residential property. Its displayed housing zeroes are preserved as printed; they do not establish a housing population or support a housing rate.'}],
            'interpretation_limit':'Counts only. No denominator, per-capita rate, or complete campus-ID crosswalk is certified by this transcription.'}
    (ROOT/'duke_2025_source_audit.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:record[k] for k in ['status','source_cells','numeric_agreement_with_federal_cells','federal_blank_current_report_explicit_zero_cells','numeric_disagreements','csv_sha256']},indent=2))


if __name__=='__main__':main()
