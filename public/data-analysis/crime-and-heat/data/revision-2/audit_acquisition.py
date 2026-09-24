"""Offline acquisition coverage, exact cache-reuse and source-integrity audit."""
import csv, json, hashlib
from pathlib import Path
from collections import Counter

HERE=Path(__file__).resolve().parent
BASE=HERE.parents[1]

def main():
    locations=list(csv.DictReader((BASE/'weather'/'weather_locations.csv').open(encoding='utf-8-sig')))
    completed={p.name[len('temperature_'):-4] for p in (HERE/'points').glob('temperature_*.csv')}
    grid=lambda r:(float(r['weather_grid_latitude']),float(r['weather_grid_longitude']))
    complete_grids={grid(r) for r in locations if r['zip_code'] in completed}
    exact={(grid(r),float(r['downscaled_elevation_m'])) for r in locations if r['zip_code'] in completed}
    panel=json.loads((BASE/'publication'/'data'/'daily.json').read_text());n=len(panel['dates']);counts=dict(zip(panel['columns'],panel['data']))
    primary=[i for i,d in enumerate(panel['dates']) if '2021-01-01'<=d<='2024-12-31']
    lookup={z:{category:sum(counts[category][j*n+i] for i in primary) for category in ['all','core']} for j,z in enumerate(panel['zips'])}
    pmap={r['zip_code']:r for r in json.loads((HERE/'precipitation_mapping.json').read_text())}
    rain={p.name[len('precipitation_'):-4] for p in (HERE/'points').glob('precipitation_*.csv')}
    rows=[]
    for r in locations:
        z=r['zip_code'];mapped=pmap[z]
        rows.append({'zip_code':z,'temperature_humidity_complete':z in completed,
             'precipitation_complete':mapped['precip_representative_zip'] in rain,
             'temperature_grid_latitude':grid(r)[0],'temperature_grid_longitude':grid(r)[1],
             'target_elevation_m':r['downscaled_elevation_m'],
             'same_grid_cached':grid(r) in complete_grids,
             'same_grid_and_elevation_cached':(grid(r),float(r['downscaled_elevation_m'])) in exact,
             'primary_all_groups':lookup[z]['all'],'primary_core_groups':lookup[z]['core']})
    with (HERE/'acquisition_coverage_by_zip.csv').open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    coverage={category:{'available_groups':sum(lookup[z][category] for z in completed),
                       'full_groups':sum(r[category] for r in lookup.values()),
                       'percent_available':100*sum(lookup[z][category] for z in completed)/sum(r[category] for r in lookup.values())} for category in ['all','core']}
    missing=[r for r in rows if not r['temperature_humidity_complete']]
    audit={'status':'partial_download_stopped_at_provider_daily_quota','complete_zip_count':len(completed),'expected_zip_count':112,
        'missing_zips':[r['zip_code'] for r in missing],
        'complete_temperature_grids':len(complete_grids),'all_temperature_grids':len({grid(r) for r in locations}),
        'missing_unique_temperature_grids':len({grid(r) for r in locations if r['zip_code'] not in completed}-complete_grids),
        'missing_zip_same_grid_and_elevation_matches':[r['zip_code'] for r in missing if r['same_grid_and_elevation_cached']],
        'exact_reuse_result':'No missingZIP has an acquiredgrid+targetelevation pair. No synthetic lapse-rate correction, rounding reconstruction or cross-point RH substitution was performed.',
        'rainfall_grids_acquired':len(rain),'rainfall_grids_required':19,
        'rainfall_available_for_every_completed_temperature_zip':all(r['precipitation_complete'] for r in rows if r['temperature_humidity_complete']),
        'primary_record_coverage':coverage,'day_dates_per_completed_zip':2741,'primary_dates_per_completed_zip':1461,
        'primary_zip_days':len(completed)*1461,'full_zip_days':len(completed)*2741,
        'quota_reset_time':'unknown; provider error says try again tomorrow, but exact reset timestamp is not known',
        'new_acquisition_runs_after_observed_quota_failure':0,
        'quota_stop_note':'No new acquisition runs or manual weather requests after the quota failure was observed. Concurrent requests already in flight finished or returned429; subsequent work is offline.',
        'original_daily_weather_sha256':hashlib.sha256((BASE/'weather'/'daily_zip_weather.csv').read_bytes()).hexdigest(),
        'remaining_action':'After permitted access resumes, rerun acquire_civil_weather.py and acquire_precipitation.py; cached requests are reused. Finalize and independently verify the complete112-ZIP panel before calling this a full correction.'}
    (HERE/'acquisition_audit.json').write_text(json.dumps(audit,indent=2))
    print(json.dumps(audit,indent=2))

if __name__=='__main__':main()
