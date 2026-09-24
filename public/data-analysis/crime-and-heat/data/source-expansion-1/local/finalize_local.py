"""Audit and prepare the aggregate-only snapshot without re-requesting live data."""
from pathlib import Path
from collections import Counter
import csv,json,hashlib,datetime as dt

P=Path(__file__).resolve().parent
audit={'reviewed_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'individual_records_retained':False,'tables':{}}
for p in sorted(P.glob('*.csv')):
    with p.open(encoding='utf-8-sig',newline='') as f:r=csv.DictReader(f);cols=r.fieldnames;rows=list(r)
    # API coverage initially returns minimum/maximum timestamps; retain dates only.
    for row in rows:
        for k in ['date','month','first_recorded_datetime','last_recorded_datetime']:
            if row.get(k):row[k]=row[k][:7 if k=='month' else 10]
    if 'first_recorded_datetime' in cols:
        for old,new in [('first_recorded_datetime','first_recorded_date'),('last_recorded_datetime','last_recorded_date')]:
            cols[cols.index(old)]=new
            for row in rows:row[new]=row.pop(old)
    if p.name.startswith('sandag_group_b_') and ('_dv.csv' in p.name or '_dv_flag.csv' in p.name) and 'domestic_violence_incident' not in cols:
        cols.insert(2,'domestic_violence_incident')
        for row in rows:row['domestic_violence_incident']=''
    with p.open('w',encoding='utf-8',newline='') as f:w=csv.DictWriter(f,cols);w.writeheader();w.writerows(rows)
    forbidden={'incidentuid','incident_uid','arrest_number','case_number','nibrs_uniq','cibrs_unique_offense_id','block_address','block_addr','latitude','longitude','victim_age','victim_race','victim_sex'}
    assert not forbidden.intersection(cols),(p.name,cols)
    assert not any(str(v).lstrip().startswith(('=','+','@')) for row in rows for v in row.values()),p.name
    audit['tables'][p.name]={'rows':len(rows),'columns':cols}
    dates=[dt.date.fromisoformat(row['date']) for row in rows if row.get('date') and row['date']!='UNASSIGNED']
    if dates:
        expected_min=dt.date(2020 if p.name.startswith('sdpd') else 2021,1,1)
        snapshot_local_date=dt.date(2026,9,24)
        audit['tables'][p.name].update(first_date=str(min(dates)),last_date=str(max(dates)),future_date_cells=sum(d>snapshot_local_date for d in dates),pre_declared_start_cells=sum(d<expected_min for d in dates),latest_date_cells=sum(d==max(dates) for d in dates))
        if p.name.startswith('sdpd'):
            year=int(p.name.split('_')[2]);audit['tables'][p.name]['outside_file_year_cells']=sum(d.year!=year for d in dates)
logs=json.loads((P/'retrieval_metadata.json').read_text())
logs+=json.loads((P/'annual_and_sheriff_retrieval_metadata.json').read_text())
audit['acquisition_start_utc']=min(r['retrieved_utc'] for r in logs)
audit['acquisition_end_utc']=max(r['retrieved_utc'] for r in logs)
audit['recent_date_policy']='Latest observed day is excluded from any continuity inference; all 2026 records are partial-year provisional snapshots, not complete counts. No heat models fitted.'
audit['scope']='Public SANDAG filtered views only; Socrata count-distinct operations occur server-side. SDPD full CSVs processed in memory and not persisted.'
(P/'snapshot_audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
manifest=[{'file':str(p.relative_to(P)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(P.rglob('*')) if p.is_file() and p.name!='manifest.json' and '__pycache__' not in p.parts]
(P/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'files':len(manifest),'bytes':sum(r['bytes'] for r in manifest),'tables':len(audit['tables']),'acquisition_start_utc':audit['acquisition_start_utc'],'acquisition_end_utc':audit['acquisition_end_utc']},indent=2))
