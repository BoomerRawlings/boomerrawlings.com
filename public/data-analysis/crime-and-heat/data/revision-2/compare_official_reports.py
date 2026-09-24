"""Context comparisons only: units/filters are not agency-verified equivalents."""
from pathlib import Path
from collections import defaultdict
import csv

HERE = Path(__file__).resolve().parent
BASE = HERE.parents[1]
OUT = BASE / 'outputs' / 'cbs8_dv_heat'

def read(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

official = [
    ('2022-07',1159,'https://www.sdsheriff.gov/home/showpublisheddocument/7134/638284887953100000'),
    ('2023-07',1142,'https://www.sdsheriff.gov/home/showpublisheddocument/7134/638284887953100000'),
    ('2023-01',1081,'https://www.sdsheriff.gov/home/showpublisheddocument/7906/638440390143670000'),
    ('2024-01',1096,'https://www.sdsheriff.gov/home/showpublisheddocument/7906/638440390143670000'),
    ('2023-10',1203,'https://www.sdsheriff.gov/home/showpublisheddocument/8838/638687390692970000'),
    ('2024-10',982,'https://www.sdsheriff.gov/home/showpublisheddocument/8838/638687390692970000'),
]
charges = read(OUT / 'all_charge_rows_normalized.csv')
groups = read(OUT / 'all_source_id_groups.csv')
flags = {r['event_key']: r for r in read(HERE / 'PRIVATE_event_warrant_flags.csv')}
excluded = set()
for c in charges:
    labels = (c['Command'] + ' ' + c['area_normalized']).upper()
    if any(v in labels for v in ['DETENTION','COURT','NON-CONTRACT']): excluded.add(c['event_key'])

rows=[]
for month,n,url in sorted(official):
    period = [g for g in groups if g['month'] == month]
    candidate = [g for g in period if g['event_key'] not in excluded]
    adult = [g for g in candidate if g['Incident Sub Type'] == 'ADULT']
    rows.append({'month':month,'official_report_arrests':n,
                 'export_charge_rows':sum(c['recorded_date'].startswith(month) for c in charges),
                 'export_unambiguous_month_source_ids':len(period),
                 'candidate_no_noncontract_detention_court_source_ids':len(candidate),
                 'candidate_exclusively_adult_source_ids':len(adult),
                 'candidate_adult_without_warrant_cocharge_ids':sum(flags[g['event_key']]['strict_warrant_exclusion']=='0' for g in adult),
                 'official_report_url':url,
                 'interpretation':'Not a completeness denominator: report counts arrests, excludes PC849.5 detentions and cases under review; export units and extraction definitions unverified. Candidate filters are analytical approximations, not an agency crosswalk.'})
with (HERE / 'official_monthly_context_comparison.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
for r in rows: print({k:v for k,v in r.items() if k not in {'official_report_url','interpretation'}})
