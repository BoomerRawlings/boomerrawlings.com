"""Build an aggregate-only revision input; never publish event-level masks."""
from pathlib import Path
import sys, json, math, hashlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / '_analysis_deps'))
import numpy as np
import pandas as pd
from pandas.tseries.holiday import USFederalHolidayCalendar

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def distance(a,b,c,d):
    a,b,c,d = map(math.radians,(a,b,c,d))
    return 6371 * 2 * math.asin(min(1, math.sqrt(math.sin((a-c)/2)**2 + math.cos(a)*math.cos(c)*math.sin((b-d)/2)**2)))

def main():
    original = ROOT/'publication/data/downloads/daily_zip_eligible_weather.csv'
    civil = ROOT/'publication/revision_weather/daily_zip_weather_civil.csv'
    strict = ROOT/'publication/revision_sources/warrant_primary_zip_daily_sparse.csv'
    station_source = ROOT/'weather/noaa_station_daily.csv'
    station_metadata = ROOT/'weather/noaa_provenance.json'
    locations_source = ROOT/'weather/weather_locations.csv'
    old = pd.read_csv(original,dtype={'zip_code':str},parse_dates=['date'])
    old = old[old.date.between('2021-01-01','2024-12-31')].copy()
    full_zips=set(old.zip_code)
    full_counts={'all':int(old.eligible_all_count.sum()),'core':int(old.core_count.sum())}
    old = old.rename(columns={c:'legacy_'+c for c in ['temp_high_f','temp_mean_f','temp_low_f','heatwave_p90_3day']})
    weather = pd.read_csv(civil,dtype={'zip_code':str},parse_dates=['date'])
    fields = ['zip_code','date','temp_high_f','temp_mean_f','temp_low_f','relative_humidity_mean_pct','precipitation_mm','day_hours','prior_day_high_f']
    available_zips=set(weather.zip_code)
    assert available_zips.issubset(full_zips)
    panel = old[old.zip_code.isin(available_zips)].merge(weather[fields],on=['zip_code','date'],how='left',validate='one_to_one')
    required = fields[2:]
    assert panel[required].notna().all().all(), 'Missing revised exposure; do not silently delete days'
    assert len(panel)==len(available_zips)*1461 and panel.groupby('zip_code').size().eq(1461).all()
    assert set(panel.day_hours)=={23,24,25}
    counts = pd.read_csv(strict,dtype={'zip_code':str},parse_dates=['date'])
    assert counts.strict_all.sum()==52989 and counts.strict_core.sum()==6570
    panel = panel.merge(counts,on=['zip_code','date'],how='left',validate='one_to_one')
    ccols=['original_all','original_core','excluded_all','excluded_core','strict_all','strict_core']
    panel[ccols] = panel[ccols].fillna(0).astype(int)
    assert (panel.original_all==panel.eligible_all_count).all()
    assert (panel.original_core==panel.core_count).all()
    assert (panel.strict_all<=panel.eligible_all_count).all() and (panel.strict_core<=panel.core_count).all()
    holidays = USFederalHolidayCalendar().holidays('2021-01-01','2024-12-31')
    panel['federal_holiday_observed'] = panel.date.isin(holidays).astype(int)
    pd.DataFrame({'date':holidays}).to_csv(HERE/'federal_holidays.csv',index=False)
    stations = json.loads(station_metadata.read_text())['stations']
    mappings=[]
    for loc in pd.read_csv(locations_source,dtype={'zip_code':str}).to_dict('records'):
        choices = [(distance(loc['latitude'],loc['longitude'],float(s['latitude']),float(s['longitude'])),s['station'],s) for s in stations]
        km,sid,s = sorted(choices,key=lambda q:(q[0],q[1]))[0]
        elevation_delta = abs(float(loc['downscaled_elevation_m'])-float(s['elevation_m']))
        mappings.append({'zip_code':loc['zip_code'],'station':sid,'distance_km':km,
            'absolute_elevation_difference_m':elevation_delta,'station_eligible':km<=25 and elevation_delta<=200})
    mapping = pd.DataFrame(mappings)
    mapping=mapping[mapping.zip_code.isin(available_zips)].copy()
    mapping.to_csv(HERE/'station_assignment.csv',index=False)
    panel = panel.merge(mapping,on='zip_code',validate='many_to_one')
    noaa = pd.read_csv(station_source,parse_dates=['date'])
    # Source already excluded nonblank NOAA GHCN quality flags. Independently recheck.
    invalid = noaa.tmax_attributes.fillna('').str.split(',').str[1].fillna('').str.strip().ne('')
    assert noaa.loc[invalid,'temp_high_f'].isna().all()
    noaa = noaa[['station','date','temp_high_f']].rename(columns={'temp_high_f':'noaa_high_f'})
    panel = panel.merge(noaa,on=['station','date'],how='left',validate='many_to_one')
    panel['station_paired'] = panel.station_eligible & panel.noaa_high_f.notna()
    panel = panel.sort_values(['zip_code','date']).reset_index(drop=True)
    target = HERE/'analysis_panel.csv.gz'
    panel.to_csv(target,index=False,compression={'method':'gzip','mtime':0})
    # Weather-only quantiles are fixed across all outcomes, masks and specifications.
    knots = np.quantile(panel.temp_high_f.to_numpy(),[.05,.35,.65,.95]).tolist()
    assert len(set(knots))==4
    metadata={'schema_version':'2.0','period':['2021-01-01','2024-12-31'],
        'rows':len(panel),'zips':panel.zip_code.nunique(),'calendar_days':panel.date.nunique(),
        'original_all':int(panel.eligible_all_count.sum()),'original_core':int(panel.core_count.sum()),
        'full_sample_original_all':full_counts['all'],'full_sample_original_core':full_counts['core'],
        'full_sample_strict_all':52989,'full_sample_strict_core':6570,
        'missing_weather_zips':sorted(full_zips-available_zips),
        'restriction_reason':'Hourly API daily quota reached; only complete weather ZIPs used. Acquisition availability is not random. Original full-sample results remain archived; R00 compares original weather on exactly the revised sample.',
        'strict_all':int(panel.strict_all.sum()),'strict_core':int(panel.strict_core.sum()),
        'station_eligible_zips':int(mapping.station_eligible.sum()),
        'station_paired_zip_days':int(panel.station_paired.sum()),
        'station_paired_strict_all':int(panel.loc[panel.station_paired,'strict_all'].sum()),
        'station_paired_strict_core':int(panel.loc[panel.station_paired,'strict_core'].sum()),
        'spline_knots_f':knots,'curve_weather_percentiles_f':np.quantile(panel.temp_high_f,[.01,.99]).tolist(),
        'holiday_dates':len(holidays),'panel_sha256':sha(target),
        'input_sha256':{str(p.relative_to(ROOT)):sha(p) for p in [original,civil,strict,station_source,station_metadata,locations_source]},
        'station_rule':'Nearest of six existing stations by haversine distance, then <=25 km and <=200 m absolute elevation difference; quality-valid TMAX. Paired models share identical rows.',
        'holiday_rule':'Observed US federal holidays from pandas USFederalHolidayCalendar; proxy for calendar disruptions, not all local holidays/events.',
        'warning':'All inputs are public aggregates. Missing source records are not recoverable from a zero panel. Station day conventions differ from civil dates.'}
    (HERE/'panel_metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
    print(json.dumps(metadata,indent=2))

if __name__=='__main__':main()
