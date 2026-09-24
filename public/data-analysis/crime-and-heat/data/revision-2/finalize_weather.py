"""Join separate source panels and quantify civil-day / retrieval differences."""
import argparse, csv, datetime as dt, hashlib, importlib.metadata, json, platform
from pathlib import Path
import numpy as np
import pandas as pd
from acquire_civil_weather import HERE, OLD, START, END, dates, boundaries, dump_json

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--allow-partial',action='store_true');args=ap.parse_args()
    t=pd.read_csv(HERE/'daily_civil_temperature_humidity.csv',dtype={'zip_code':str})
    p=pd.read_csv(HERE/'daily_civil_precipitation_by_grid.csv',dtype={'precip_representative_zip':str})
    mapping=pd.DataFrame(json.loads((HERE/'precipitation_mapping.json').read_text()))
    t=t.merge(mapping[['zip_code','precip_representative_zip']],on='zip_code',validate='many_to_one')
    t=t.merge(p,on=['precip_representative_zip','date'],validate='many_to_one')
    t=t.rename(columns={'daylength_hrs':'day_hours'})
    first=['zip_code','date','temp_high_f','temp_mean_f','temp_low_f','relative_humidity_mean_pct','precipitation_mm','day_hours','prior_day_high_f']
    t=t[first+[c for c in t if c not in first]].sort_values(['zip_code','date'])
    acquired_zips=sorted(t.zip_code.unique());complete=len(acquired_zips)==112
    assert complete or args.allow_partial, 'Incomplete112-ZIP acquisition; pass --allow-partial only for an explicitly labeled sensitivity subset'
    assert len(t)==len(acquired_zips)*2741 and not t.duplicated(['zip_code','date']).any() and not t.isna().any().any()
    assert (t.day_hours==t.precipitation_hour_count).all()
    out=HERE/'daily_zip_weather_civil.csv';t.to_csv(out,index=False)
    old=pd.read_csv(OLD/'daily_zip_weather.csv',dtype={'zip_code':str})
    joined=t.merge(old,on=['zip_code','date'],suffixes=('','_released'),validate='one_to_one')
    windows=[]
    for d in dates():
        a,b=boundaries(d)
        fixed=int(dt.datetime.combine(d,dt.time(7),dt.timezone.utc).timestamp())
        windows.append({'date':d.isoformat(),'day_hours':(b-a)//3600,'civil_start_utc':dt.datetime.fromtimestamp(a,dt.timezone.utc).isoformat(),
                        'civil_end_utc':dt.datetime.fromtimestamp(b,dt.timezone.utc).isoformat(),
                        'civil_window_differs_from_fixed_utc7': a!=fixed or b!=fixed+86400})
    day=pd.DataFrame(windows); day.to_csv(HERE/'civil_day_windows.csv',index=False)
    joined=joined.merge(day[['date','civil_window_differs_from_fixed_utc7']],on='date',validate='many_to_one')
    summaries=[];zip_stats=[]
    for period,selector in [('full',np.ones(len(joined),dtype=bool)),('primary_2021_2024',joined.date.between('2021-01-01','2024-12-31'))]:
        frame=joined[selector]
        for kind in ['high','mean','low']:
            field='temp_'+kind+'_f'
            comparisons={
                'civil_minus_released':frame[field]-frame[field+'_released'],
                'civil_minus_new_fixed_utc7':frame[field]-frame['fixed_utc7_'+kind+'_f'],
                'new_fixed_utc7_minus_released':frame['fixed_utc7_'+kind+'_f']-frame[field+'_released']}
            for comparison,v in comparisons.items():
                abs_v=np.abs(v)
                summaries.append({'period':period,'variable':kind,'comparison':comparison,'zip_days':len(v),
                    'changed_more_than_1e_7_f':int((abs_v>1e-7).sum()),'mean_difference_f':float(v.mean()),
                    'mean_absolute_difference_f':float(abs_v.mean()),'p95_absolute_difference_f':float(abs_v.quantile(.95)),
                    'max_absolute_difference_f':float(abs_v.max()),'min_difference_f':float(v.min()),'max_difference_f':float(v.max())})
            for z,g in frame.groupby('zip_code'):
                v=g[field]-g[field+'_released']
                zip_stats.append({'period':period,'zip_code':z,'variable':kind,'n':len(g),
                    'changed_more_than_1e_7_f':int((v.abs()>1e-7).sum()),'bias_f':float(v.mean()),'mae_f':float(v.abs().mean()),'max_abs_f':float(v.abs().max())})
    pd.DataFrame(summaries).to_csv(HERE/'temperature_difference_summary.csv',index=False)
    pd.DataFrame(zip_stats).to_csv(HERE/'temperature_differences_by_zip.csv',index=False)
    flips=[]
    for period,frame in [('full',joined),('primary_2021_2024',joined[joined.date.between('2021-01-01','2024-12-31')])]:
        for threshold in [80,90]:
            a=frame.temp_high_f>=threshold;b=frame.temp_high_f_released>=threshold
            flips.append({'period':period,'threshold_f':threshold,'changed_zip_days':int((a!=b).sum()),
                          'became_hot':int((a&~b).sum()),'became_not_hot':int((~a&b).sum())})
    primary_days=day[day.date.between('2021-01-01','2024-12-31')]
    provenance={'generated_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
        'status':('complete' if complete else 'partial')+'_pending_independent_verification','date_start':str(START),'date_end':str(END),
        'zip_count':len(acquired_zips),'zip_count_required_for_complete_revision':112,'dates':2741,'rows':len(t),'missing_values':int(t.isna().sum().sum()),
        'missing_zips':sorted(set(mapping.zip_code)-set(acquired_zips)),
        'acquisition_blocker':None if complete else 'Provider daily API quota reached; stop requests until reset or authorized higher-capacity access. Do not mix old and corrected exposures silently.',
        'valid_use':('Full112-ZIP replacement weather' if complete else 'Restricted-subset sensitivity: compare old and new exposures using the same acquiredZIPs. Full original112-ZIP reference remains distinct.'),
        'timezone':'America/Los_Angeles','tzdata_version':importlib.metadata.version('tzdata'),
        'temperature_humidity_source':'Open-Meteo ERA5-Land hourly; GMT Unix timestamps converted with IANA historical rules',
        'precipitation_source':'Open-Meteo ERA5 hourly (explicit separate, coarser source; ERA5-Land API precipitation unavailable)',
        'temperature_grids':len(set((m['grid_latitude'],m['grid_longitude']) for m in json.loads((HERE/'temperature_locations.json').read_text()))),
        'precipitation_grids_in_output':int(t[['precip_grid_latitude','precip_grid_longitude']].drop_duplicates().shape[0]),
        'precipitation_grids_acquired':int(p.precip_representative_zip.nunique()),
        'precipitation_grids_required_for_all112zips':int(mapping[['precip_grid_latitude','precip_grid_longitude']].drop_duplicates().shape[0]),
        'temperature_downscaling':'Original representative coordinates and original returned elevation explicitly retained; every returned ERA5-Land cell verified against released mapping',
        'instantaneous_aggregation':'Temperature max/min and arithmetic mean, RH arithmetic mean: hourly timestamps >= local midnight and < next local midnight; all23/24/25 hourly values',
        'precipitation_aggregation':'Sum hourly accumulations whose ending timestamps are > local midnight and <= next local midnight; mm',
        'prior_day_definition':'Previous IANA calendar day; not a fixed24-hour rolling window. First day covered by padded raw requests.',
        'hourly_request_start':'2018-06-29','hourly_request_end':'2026-01-02',
        'full_day_duration_counts':{str(k):int(v) for k,v in day.day_hours.value_counts().sort_index().items()},
        'primary_day_duration_counts':{str(k):int(v) for k,v in primary_days.day_hours.value_counts().sort_index().items()},
        'full_dates_with_changed_windows':int(day.civil_window_differs_from_fixed_utc7.sum()),
        'primary_dates_with_changed_windows':int(primary_days.civil_window_differs_from_fixed_utc7.sum()),
        'temperature_differences':summaries,'high_threshold_changes':flips,
        'input_released_weather_sha256':hashlib.sha256((OLD/'daily_zip_weather.csv').read_bytes()).hexdigest(),
        'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),
        'versions':{'python':platform.python_version(),'numpy':np.__version__,'pandas':pd.__version__},
        'precision':'API hourly temperature0.1F; RH1percentage point; precipitation0.1mm. Additional daily-mean digits are arithmetic, not greater exposure accuracy.',
        'source_links':[
            'https://open-meteo.com/en/docs/historical-weather-api',
            'https://doi.org/10.24381/cds.e2161bac',
            'https://doi.org/10.24381/cds.adbb2d47',
            'https://github.com/open-meteo/open-meteo/blob/main/Sources/App/Era5/Era5Variables.swift',
            'https://docs.python.org/3/library/zoneinfo.html'],
        'remaining_limits':['Modeled representative-point weather is not personal or incident-site exposure.',
                            'Recorded clocks/locations remain unverified incident-time/location proxies.',
                            'Prior-day weather improves temporal ordering relative to recorded date, not necessarily offense date.',
                            'No bias correction or substitution with observed station data was applied.',
                            'A short in-sample heatwave baseline remains exploratory; this acquisition does not establish an independent long-term baseline.']}
    dump_json(HERE/'weather_revision_provenance.json',provenance)
    print(json.dumps({k:provenance[k] for k in ['status','zip_count','rows','missing_values','temperature_grids','precipitation_grids_in_output','full_day_duration_counts','primary_day_duration_counts','high_threshold_changes','output_sha256']},indent=2))

if __name__=='__main__':main()
