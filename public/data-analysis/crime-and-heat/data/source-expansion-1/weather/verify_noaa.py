"""Independent checks of curated NOAA data; --raw adds full source-byte replay."""
from pathlib import Path
import argparse,calendar,datetime as dt,gzip,hashlib,json,math,sys
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parents[2]/'_analysis_deps'))
import numpy as np
import pandas as pd

def main(raw=False):
    daily=pd.read_csv(ROOT/'ghcn_daily_1991_2025.csv.gz',low_memory=False)
    assert not daily.duplicated(['station','date']).any()
    assert daily.station.nunique()==29
    assert daily.date.between('1991-01-01','2025-12-31').all()
    assert daily.temperature_order_valid.all()
    for key,col in [('tmax','temp_high_f'),('tmin','temp_low_f'),('tavg','reported_tavg_f'),('taxn','reported_taxn_f'),('prcp','precipitation_mm')]:
        assert daily.loc[daily[key+'_quality_flag'].notna(),col].isna().all()
    both=daily[['temp_high_f','temp_low_f']].notna().all(axis=1)
    np.testing.assert_allclose(daily.loc[both,'tmax_tmin_midpoint_f'],daily.loc[both,['temp_high_f','temp_low_f']].mean(axis=1),atol=1e-10)
    thresholds=pd.read_csv(ROOT/'ghcn_baseline_thresholds_1991_2020.csv')
    for row in thresholds.itertuples(index=False):
        values=daily[(daily.station==row.station)&daily.date.between('1991-01-01','2020-12-31')&daily.date.str[5:].between('05-01','09-30')].dropna(subset=['temp_high_f'])
        assert len(values)==row.valid_tmax_days
        eligible=len(values)>=4131 and (values.groupby(values.date.str[:4]).size()>=138).sum()>=25
        assert bool(row.eligible_90pct_days_25years)==bool(eligible)
        if eligible:
            np.testing.assert_allclose([row.tmax_p90_f,row.tmax_p95_f],np.quantile(values.temp_high_f,[.9,.95],method='linear'),atol=1e-10)
    hourly=pd.read_csv(ROOT/'isd_selected_hourly_2021_2024.csv.gz',dtype={'temperature_quality':str,'source_flag':str})
    instant=pd.to_datetime(hourly.observation_utc,utc=True)
    hourly['derived_date']=instant.dt.tz_convert('America/Los_Angeles').dt.strftime('%Y-%m-%d')
    assert hourly.derived_date.eq(hourly.date).all()
    assert pd.to_datetime(hourly.utc_hour,utc=True).eq(instant.dt.floor('h')).all()
    assert not hourly.duplicated(['station','utc_hour']).any()
    assert hourly.temperature_quality.astype(str).isin(['1','5','C']).all()
    observed=hourly.groupby(['station','date']).temp_f.agg(['count','min','mean','max'])
    days=pd.read_csv(ROOT/'isd_civil_daily_2021_2024.csv').set_index(['station','date'])
    assert len(days)==12*1461 and not days.index.duplicated().any()
    derived=days.join(observed)
    assert derived.valid_hourly_samples.eq(derived['count'].fillna(0)).all()
    localdates=pd.date_range('2021-01-01','2025-01-01',tz='America/Los_Angeles',freq='D')
    lengths=pd.Series((localdates[1:]-localdates[:-1]).total_seconds()/3600,index=localdates[:-1].strftime('%Y-%m-%d'))
    np.testing.assert_array_equal(days.day_hours,lengths.loc[days.index.get_level_values('date')])
    assert days.complete_civil_day.eq(days.valid_hourly_samples.eq(days.day_hours)).all()
    complete=derived.complete_civil_day
    for key,col in [('max','temp_high_f'),('mean','temp_mean_f'),('min','temp_low_f')]:
        np.testing.assert_allclose(derived.loc[complete,key],derived.loc[complete,col],atol=1e-10)
        assert derived.loc[~complete,col].isna().all()
    manifest=json.loads((ROOT/'raw_manifest.json').read_text())
    raw_bytes=0;raw_checks=0;source_values=0;hourly_source_checks=0
    if raw:
        for filename,entry in manifest.items():
            source=ROOT/'raw'/filename
            assert source.exists(),filename
            data=source.read_bytes();assert len(data)==entry['bytes'];assert hashlib.sha256(data).hexdigest()==entry['sha256'],filename
            raw_bytes+=len(data);raw_checks+=1
        check_columns=['temp_high_f','temp_low_f','reported_tavg_f','reported_taxn_f','precipitation_mm']
        indexed={(row[0],row[1]):row[2:] for row in daily[['station','date']+check_columns].itertuples(index=False,name=None)}
        for source in (ROOT/'raw').glob('*.dly'):
            for line in source.read_text().splitlines():
                year=int(line[11:15]);month=int(line[15:17]);kind=line[17:21]
                column={'TMAX':'temp_high_f','TMIN':'temp_low_f','TAVG':'reported_tavg_f','TAXN':'reported_taxn_f','PRCP':'precipitation_mm'}.get(kind)
                if not column or not 1991<=year<=2025:continue
                for day in range(1,calendar.monthrange(year,month)[1]+1):
                    pos=21+8*(day-1);value=int(line[pos:pos+5]);flag=line[pos+6]
                    actual=indexed[(source.stem,f'{year:04}-{month:02}-{day:02}')][check_columns.index(column)]
                    if value==-9999 or flag!=' ':assert pd.isna(actual)
                    else:
                        expected=value/10 if kind=='PRCP' else value/10*9/5+32
                        assert abs(actual-expected)<1e-10
                    source_values+=1
        for station,g in hourly.groupby('station'):
            source_records=set()
            for year in range(2021,2026):
                for line in gzip.decompress((ROOT/'raw'/f'{station}-{year}.gz').read_bytes()).decode().splitlines():
                    if len(line)<105:continue
                    source_records.add((line[15:27],int(line[87:92]),line[92],line[41:46].strip(),line[27]))
            for row in g.itertuples(index=False):
                stamp=dt.datetime.fromisoformat(row.observation_utc).strftime('%Y%m%d%H%M')
                value=round((row.temp_f-32)/1.8*10)
                assert (stamp,value,str(row.temperature_quality),row.report_type,str(row.source_flag)) in source_records
                hourly_source_checks+=1
    report={'status':'PASS','ghcn_rows':len(daily),'ghcn_stations':daily.station.nunique(),'baseline_eligible_stations':int(thresholds.eligible_90pct_days_25years.sum()),'isd_hourly_rows':len(hourly),'isd_daily_rows':len(days),'isd_stations':hourly.station.nunique(),'complete_isd_station_days':int(complete.sum()),'raw_replay':raw,'raw_files_hashed':raw_checks,'raw_bytes_hashed':raw_bytes,'ghcn_raw_value_cells_checked':source_values,'isd_selected_observations_found_in_raw':hourly_source_checks,'dst_day_lengths':{str(k):int(v) for k,v in lengths.value_counts().items()},'checks':'Unique keys; flags; daily source units and missingness; exact original ISD timestamps/values; independent pandas IANA day allocation and means/extrema; missing-hour exclusion; 23/25-hour days; independent baseline quantiles.'}
    (ROOT/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--raw',action='store_true');args=parser.parse_args();main(args.raw)
