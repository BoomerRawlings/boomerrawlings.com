"""Independent full recomputation using UTC-to-local GROUPING, not range slicing.

Does not import acquisition/aggregation helpers. Verifies every published cell.
"""
import csv, datetime as dt, gzip, hashlib, json
from pathlib import Path
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent

def main():
    public=pd.read_csv(HERE/'daily_zip_weather_civil.csv',dtype={'zip_code':str,'precip_representative_zip':str})
    assert len(public)==public.zip_code.nunique()*2741 and not public.duplicated(['zip_code','date']).any()
    expected_dates=pd.date_range('2018-07-01','2025-12-31').strftime('%Y-%m-%d').tolist()
    max_error={}; checks=0; raw_records=[]
    for z,pub in public.groupby('zip_code',sort=True):
        assert pub.date.tolist()==expected_dates
        path=HERE/'raw'/('era5_land_hourly_'+z+'.json.gz');packed=path.read_bytes();raw=gzip.decompress(packed)
        meta=json.loads(path.with_suffix('.request.json').read_text())
        assert hashlib.sha256(raw).hexdigest()==meta['response_sha256']
        assert hashlib.sha256(packed).hexdigest()==meta['compressed_sha256']
        q=json.loads(raw);h=q['hourly'];clock=pd.to_datetime(h['time'],unit='s',utc=True).tz_convert('America/Los_Angeles')
        frame=pd.DataFrame({'date':clock.strftime('%Y-%m-%d'),'temperature':h['temperature_2m'],'rh':h['relative_humidity_2m']})
        grouped=frame.groupby('date').agg(temp_high_f=('temperature','max'),temp_mean_f=('temperature','mean'),temp_low_f=('temperature','min'),
                  relative_humidity_mean_pct=('rh','mean'),relative_humidity_min_pct=('rh','min'),relative_humidity_max_pct=('rh','max'),day_hours=('temperature','size'))
        target=grouped.loc[pub.date]
        for col in target:
            error=float(np.max(np.abs(target[col].to_numpy()-pub[col].to_numpy())))
            assert error<1e-7,(z,col,error)
            max_error[col]=max(max_error.get(col,0),error);checks+=len(pub)
        prior_dates=[(dt.date.fromisoformat(d)-dt.timedelta(days=1)).isoformat() for d in pub.date]
        for col,source in [('prior_day_high_f','temp_high_f'),('prior_day_mean_f','temp_mean_f'),('prior_day_low_f','temp_low_f')]:
            error=float(np.max(np.abs(grouped.loc[prior_dates,source].to_numpy()-pub[col].to_numpy())))
            assert error<1e-7,(z,col,error)
            max_error[col]=max(max_error.get(col,0),error);checks+=len(pub)
        raw_records.append({'file':str(path.relative_to(HERE)),'response_sha256':meta['response_sha256'],'compressed_sha256':meta['compressed_sha256'],'hour_count':len(frame)})
    for z,pub in public.groupby('precip_representative_zip',sort=True):
        path=HERE/'raw'/('era5_precipitation_hourly_'+z+'.json.gz');packed=path.read_bytes();raw=gzip.decompress(packed)
        meta=json.loads(path.with_suffix('.request.json').read_text())
        assert hashlib.sha256(raw).hexdigest()==meta['response_sha256']
        assert hashlib.sha256(packed).hexdigest()==meta['compressed_sha256']
        q=json.loads(raw);h=q['hourly']
        clock=(pd.to_datetime(h['time'],unit='s',utc=True)-pd.Timedelta(nanoseconds=1)).tz_convert('America/Los_Angeles')
        frame=pd.DataFrame({'date':clock.strftime('%Y-%m-%d'),'rain':h['precipitation']})
        grouped=frame.groupby('date').agg(precipitation_mm=('rain','sum'),precipitation_hour_count=('rain','size'))
        target=grouped.loc[pub.date]
        for col in target:
            error=float(np.max(np.abs(target[col].to_numpy()-pub[col].to_numpy())))
            assert error<1e-7,(z,col,error)
            max_error[col]=max(max_error.get(col,0),error);checks+=len(pub)
        raw_records.append({'file':str(path.relative_to(HERE)),'response_sha256':meta['response_sha256'],'compressed_sha256':meta['compressed_sha256'],'hour_count':len(frame)})
    probe=json.loads(gzip.decompress((HERE/'raw'/'era5_precipitation_grid_pilot.json.gz').read_bytes()))
    locations=list(csv.DictReader((HERE.parents[1]/'weather'/'weather_locations.csv').open(encoding='utf-8-sig')))
    for q,m in zip(probe,locations):assert abs(q['elevation']-float(m['downscaled_elevation_m']))<1e-6
    assert (public.day_hours==public.precipitation_hour_count).all()
    assert (public.day_hours==public.temperature_hour_count).all()
    assert (public.day_hours==public.humidity_hour_count).all()
    assert set(public.day_hours)=={23,24,25}
    result={'status':'PASS','independent_method':'UTC hourly timestamps converted and grouped by local date, precipitation end timestamps shifted1ns; no production aggregation import',
            'zip_days':len(public),'numeric_cells_verified':checks,'maximum_absolute_error_by_field':max_error,
            'missing_values':int(public.isna().sum().sum()),'duplicate_zip_dates':int(public.duplicated(['zip_code','date']).sum()),
            'raw_files_verified':len(raw_records),'raw_temperature_hours':sum(r['hour_count'] for r in raw_records if 'land' in r['file']),
            'raw_precipitation_hours':sum(r['hour_count'] for r in raw_records if 'precipitation' in r['file']),
            'final_csv_sha256':hashlib.sha256((HERE/'daily_zip_weather_civil.csv').read_bytes()).hexdigest()}
    (HERE/'verification.json').write_text(json.dumps(result,indent=2))
    (HERE/'raw_manifest.json').write_text(json.dumps(raw_records,indent=2))
    provenance=json.loads((HERE/'weather_revision_provenance.json').read_text());provenance['status']=('complete' if public.zip_code.nunique()==112 else 'partial')+'_verified'
    (HERE/'weather_revision_provenance.json').write_text(json.dumps(provenance,indent=2))
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
