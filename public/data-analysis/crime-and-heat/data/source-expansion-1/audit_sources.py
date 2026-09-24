"""Independent, offline reconciliation of the derived external-source package."""
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timedelta, time, timezone
from zoneinfo import ZoneInfo
import csv, gzip, json, math, statistics, sys

ROOT=Path(__file__).resolve().parent
# Optional local analysis environment; standard installations can install tzdata.
sys.path.insert(0,str(ROOT.parents[1]/'_analysis_deps'))

def rows(relative):
    p=ROOT/relative
    with (gzip.open(p,'rt',newline='',encoding='utf-8-sig') if p.suffix=='.gz' else p.open(newline='',encoding='utf-8-sig')) as f:
        return list(csv.DictReader(f))

report={'status':'PASS','checks':{}}
for group in ('a','b'):
    prefix=f'local/sandag_group_{group}'
    coverage=rows(prefix+'_agency_coverage.csv')
    expected={r['agency']:int(r['source_rows']) for r in coverage}
    for dimension in ('agency_dv_flag','daily_agency_dv','monthly_agency_dv','monthly_agency_offense'):
        totals=Counter()
        for r in rows(prefix+'_'+dimension+'.csv'):totals[r['agency']]+=int(r['source_rows'])
        assert dict(totals)==expected,(group,dimension)
    flag_rows=rows(prefix+'_agency_dv_flag.csv')
    if group=='a':
        for key in ('distinct_incidents','distinct_offense_ids'):
            totals=Counter()
            for r in rows(prefix+'_daily_agency_dv.csv'):totals[r['agency']]+=int(r[key])
            assert all(totals[r['agency']]==int(r[key]) for r in coverage),(group,key)
    else:assert all(not r.get('domestic_violence_incident') for r in flag_rows)
    report['checks'][f'sandag_{group}']={'source_rows':sum(expected.values()),'agency_totals_match_all_partitions':True,'dv_flag_missing_in_all_rows':group=='b'}

for year in range(2020,2027):
    d=rows(f'local/sdpd_nibrs_{year}_daily.csv');m=rows(f'local/sdpd_nibrs_{year}_monthly_offense.csv')
    assert sum(int(r['source_rows']) for r in d)==sum(int(r['source_rows']) for r in m)
    assert all(int(r['source_rows'])==int(r['distinct_nibrs_offense_ids']) for r in d)
    report['checks'][f'sdpd_{year}']={'source_rows':sum(int(r['source_rows']) for r in d),'daily_monthly_totals_match':True}

county=rows('doj/aggregates/san_diego_dv_calls_county_year_2001_2025.csv')
monthly=rows('doj/aggregates/san_diego_dv_calls_agency_month_2001_2025.csv')
totals=Counter();natural=set();flagged=set()
for r in monthly:
    key=(r['year'],r['month'],r['agency_name']);assert key not in natural;natural.add(key)
    totals[r['year']]+=int(r['total_calls'])
    assert int(r['total_calls'])>=0
    if r['explicit_sheriff_partial_reporting']=='1':flagged.add(r['year_month'])
assert all(totals[r['year']]==int(r['total_calls']) for r in county)
assert flagged=={'2024-11','2024-12','2025-01','2025-02','2025-03','2025-04','2025-05','2025-06'},flagged
arrests=rows('doj/aggregates/san_diego_arrests_county_year_age_1980_2025.csv')
for r in arrests:
    assert int(r['f_total'])==sum(int(r[k]) for k in ['violent','property','f_drugoff','f_sexoff','f_allother'])
    assert int(r['total_arrests_and_citations'])==sum(int(r[k]) for k in ['f_total','m_total','s_total'])
report['checks']['doj']={'agency_month_rows':len(monthly),'county_years':len(county),'county_arrest_years':len({r['year'] for r in arrests}),'monthly_annual_reconciliation':True,'flagged_months':sorted(flagged)}

tz=ZoneInfo('America/Los_Angeles');samples=defaultdict(list);hours=set()
for r in rows('weather/isd_selected_hourly_2021_2024.csv.gz'):
    instant=datetime.fromisoformat(r['observation_utc']);local=instant.astimezone(tz)
    hour=instant.replace(minute=0,second=0,microsecond=0).isoformat()
    assert hour==r['utc_hour'] and local.date().isoformat()==r['date']
    assert r['temperature_quality'] in ('1','5','C')
    key=(r['station'],hour);assert key not in hours;hours.add(key)
    samples[(r['station'],r['date'])].append(float(r['temp_f']))
maxdiff=0.0;complete=0;dst=Counter()
for r in rows('weather/isd_civil_daily_2021_2024.csv'):
    date=datetime.fromisoformat(r['date']).date()
    start=datetime.combine(date,time(),tzinfo=tz).astimezone(timezone.utc)
    end=datetime.combine(date+timedelta(days=1),time(),tzinfo=tz).astimezone(timezone.utc)
    expected_hours=int((end-start).total_seconds()/3600);dst[expected_hours]+=1
    assert r['utc_start']==start.isoformat() and r['utc_end']==end.isoformat()
    assert int(r['day_hours'])==expected_hours
    values=samples[(r['station'],r['date'])]
    assert int(r['valid_hourly_samples'])==len(values)
    is_complete=len(values)==expected_hours
    assert (r['complete_civil_day']=='True')==is_complete
    if is_complete:
        complete+=1
        for field,value in [('temp_high_f',max(values)),('temp_mean_f',statistics.fmean(values)),('temp_low_f',min(values))]:
            delta=abs(float(r[field])-value);maxdiff=max(maxdiff,delta);assert delta<1e-8
    else:assert all(r[k]=='' for k in ('temp_high_f','temp_mean_f','temp_low_f'))
report['checks']['isd']={'unique_quality_accepted_hours':len(hours),'complete_station_civil_days':complete,'day_hours_distribution':dict(dst),'largest_temperature_difference_f':maxdiff,'all_daily_means_and_extrema_recomputed':True}

ghcn=rows('weather/ghcn_daily_2018_2025.csv');seen=set()
for r in ghcn:
    key=(r['station'],r['date']);assert key not in seen;seen.add(key)
    for value,flag in [('temp_high_f','tmax_quality_flag'),('temp_low_f','tmin_quality_flag'),('reported_tavg_f','tavg_quality_flag')]:
        if r[value]:assert not r[flag]
    if r['temp_high_f'] and r['temp_low_f']:
        assert float(r['temp_low_f'])<=float(r['temp_high_f'])
        assert abs(float(r['tmax_tmin_midpoint_f'])-(float(r['temp_high_f'])+float(r['temp_low_f']))/2)<1e-9
report['checks']['ghcn']={'station_days':len(ghcn),'stations':len({r['station'] for r in ghcn}),'unique_keys_and_quality_rules_verified':True}
(ROOT/'independent_validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
