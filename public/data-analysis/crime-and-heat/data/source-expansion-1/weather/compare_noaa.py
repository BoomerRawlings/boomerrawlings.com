"""Offline coverage, station assignment and weather-only paired comparisons."""
from pathlib import Path
import argparse,hashlib,json,math,sys
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
sys.path.insert(0,str(PROJECT/'_analysis_deps'))
import numpy as np
import pandas as pd

ORIGINAL_SIX=['USW00023188','USW00003177','USW00053120','USC00040983','USC00040136','USC00042863']

def distance(a,b,c,d):
    a,b,c,d=map(math.radians,(a,b,c,d))
    return 6371*2*math.asin(min(1,math.sqrt(math.sin((a-c)/2)**2+math.cos(a)*math.cos(c)*math.sin((b-d)/2)**2)))

def assign(locations,stations,prefix):
    rows=[]
    for r in locations.itertuples(index=False):
        distances=[distance(r.latitude,r.longitude,s.latitude,s.longitude) for s in stations.itertuples(index=False)]
        position=int(np.argmin(distances));station=stations.iloc[position]
        elevation=abs(float(r.downscaled_elevation_m)-float(station.elevation_m))
        rows.append({'zip_code':r.zip_code,'station':station.station,'station_name':station['name'],'distance_km':distances[position],'absolute_elevation_difference_m':elevation,'eligible_station_match':distances[position]<=25 and elevation<=200,'station_network':prefix})
    return pd.DataFrame(rows)

def stats(pairs,modeled,observed):
    subset=pairs[[modeled,observed]].dropna();diff=subset[modeled]-subset[observed]
    return {'matched_zip_days':len(subset),'mean_modeled_minus_observed_f':float(diff.mean()),'mean_absolute_difference_f':float(diff.abs().mean()),'rmse_f':float(np.sqrt((diff**2).mean())),'correlation':float(subset[modeled].corr(subset[observed]))}

def prepare_inputs(analysis_root):
    target=ROOT/'reproduction_inputs';target.mkdir(exist_ok=True)
    assert not (target/'manifest.json').exists(),'Frozen reproduction inputs already exist; do not overwrite this acquisition version.'
    originals={
        'locations':(analysis_root/'weather/weather_locations.csv',['zip_code','latitude','longitude','downscaled_elevation_m']),
        'original':(analysis_root/'publication/data/downloads/daily_zip_eligible_weather.csv',['zip_code','date','core_count','broad_count','eligible_all_count','temp_high_f','temp_mean_f','temp_low_f']),
        'civil':(analysis_root/'publication/revision_weather/daily_zip_weather_civil.csv',['zip_code','date','temp_high_f','temp_mean_f','temp_low_f']),
        'original_noaa':(analysis_root/'weather/noaa_station_daily.csv',['station','date','temp_high_f','temp_mean_f','temp_low_f']),
    }
    manifest={}
    for key,(source,columns) in originals.items():
        data=pd.read_csv(source,dtype={'zip_code':str},usecols=columns)
        if 'date' in data:data=data[data.date.between('2021-01-01','2024-12-31')]
        filename=target/(key+'.csv.gz')
        data.to_csv(filename,index=False,compression={'method':'gzip','mtime':0})
        manifest[key]={'file':filename.name,'rows':len(data),'columns':list(data),'source_relative_path':str(source.relative_to(analysis_root)).replace('\\','/'),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(filename.read_bytes()).hexdigest()}
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

def main():
    inputs=ROOT/'reproduction_inputs'
    manifest=json.loads((inputs/'manifest.json').read_text())
    sources={key:inputs/value['file'] for key,value in manifest.items()}
    for key,path in sources.items():
        assert hashlib.sha256(path.read_bytes()).hexdigest()==manifest[key]['sha256'],f'Frozen reproduction input changed: {key}'
    sources.update({'ghcn':ROOT/'ghcn_daily_2018_2025.csv','isd':ROOT/'isd_civil_daily_2021_2024.csv'})
    locations=pd.read_csv(sources['locations'],dtype={'zip_code':str})
    original=pd.read_csv(sources['original'],dtype={'zip_code':str});original=original[original.date.between('2021-01-01','2024-12-31')]
    assert len(original)==112*1461
    old_cols={'temp_high_f':'legacy_high_f','temp_mean_f':'legacy_mean_f','temp_low_f':'legacy_low_f'}
    original=original.rename(columns=old_cols)
    civil=pd.read_csv(sources['civil'],dtype={'zip_code':str});civil=civil[civil.date.between('2021-01-01','2024-12-31')]
    civil=civil[['zip_code','date','temp_high_f','temp_mean_f','temp_low_f']].rename(columns={c:c.replace('temp_','civil_') for c in ['temp_high_f','temp_mean_f','temp_low_f']})
    panel=original.merge(civil,on=['zip_code','date'],how='left',validate='one_to_one')
    ghcn=pd.read_csv(sources['ghcn'],low_memory=False);ghcn=ghcn[ghcn.date.between('2021-01-01','2024-12-31')]
    coverage=pd.read_csv(ROOT/'ghcn_station_coverage.csv')
    suitable=coverage[coverage.primary_temp_high_f_days>=.9*1461]
    summaries=[];metrics=[];assignments=[]
    for network,stations in [('original_six_current_archive',suitable[suitable.station.isin(ORIGINAL_SIX)]),('expanded_ghcn',suitable)]:
        mapping=assign(locations,stations,network);assignments.append(mapping)
        pairs=panel.merge(mapping,on='zip_code',validate='many_to_one')
        pairs=pairs[pairs.eligible_station_match].merge(ghcn[['station','date','temp_high_f','temp_low_f','reported_tavg_f','tmax_measurement_flag','tmax_source_flag','tmin_measurement_flag','tmin_source_flag']],on=['station','date'],how='left',validate='many_to_one')
        pairgood=pairs[pairs.temp_high_f.notna()]
        summaries.append({'network':network,'candidate_stations':len(stations),'mapped_zips':mapping.eligible_station_match.sum(),'paired_high_zip_days':len(pairgood),'paired_all_groups':pairgood.eligible_all_count.sum(),'paired_core_groups':pairgood.core_count.sum(),'paired_civil_zips':pairgood[pairgood.civil_high_f.notna()].zip_code.nunique(),'paired_civil_zip_days':(pairgood.civil_high_f.notna()).sum()})
        for modeled,observed in [('legacy_high_f','temp_high_f'),('legacy_low_f','temp_low_f'),('civil_high_f','temp_high_f'),('civil_low_f','temp_low_f'),('civil_mean_f','reported_tavg_f')]:
            if pairs[[modeled,observed]].dropna().empty:continue
            metrics.append({'network':network,'scope':'all_matched_zip_days','modeled':modeled,'observed':observed,**stats(pairs,modeled,observed)})
        if network=='expanded_ghcn':
            pairs.to_csv(ROOT/'ghcn_zip_pairs_2021_2024.csv.gz',index=False,compression='gzip')
            byzip=[]
            for zip_code,g in pairs.groupby('zip_code'):
                for modeled,observed in [('legacy_high_f','temp_high_f'),('civil_high_f','temp_high_f')]:
                    if g[[modeled,observed]].dropna().empty:continue
                    byzip.append({'zip_code':zip_code,'station':g.station.iloc[0],'station_name':g.station_name.iloc[0],'distance_km':g.distance_km.iloc[0],'absolute_elevation_difference_m':g.absolute_elevation_difference_m.iloc[0],'modeled':modeled,**stats(g,modeled,observed)})
            pd.DataFrame(byzip).to_csv(ROOT/'ghcn_zip_paired_metrics.csv',index=False)
    pd.concat(assignments).to_csv(ROOT/'ghcn_zip_station_assignment.csv',index=False)
    # Reuse the original six-station cache to quantify archive/API differences.
    oldnoaa=pd.read_csv(sources['original_noaa']);oldnoaa=oldnoaa[oldnoaa.date.between('2021-01-01','2024-12-31')]
    refreshed=oldnoaa.merge(ghcn,on=['station','date'],suffixes=('_cached','_archive'),validate='one_to_one')
    reuse=[]
    for sid,g in refreshed.groupby('station'):
        for key in ['temp_high_f','temp_low_f']:
            matched=g[[key+'_cached',key+'_archive']].dropna();diff=matched[key+'_archive']-matched[key+'_cached']
            reuse.append({'station':sid,'variable':key,'matched_days':len(matched),'changed_above_0_051f_days':int((diff.abs()>.051).sum()),'mismatch_after_round_to_whole_f':int((matched[key+'_archive'].round()!=matched[key+'_cached']).sum()),'max_absolute_difference_f':float(diff.abs().max()),'mean_absolute_difference_f':float(diff.abs().mean()),'note':'The cached API values are whole F in this sample; the direct archive stores 0.1 C. Differences must be assessed against source precision, not silently corrected.'})
    pd.DataFrame(reuse).to_csv(ROOT/'original_six_cache_reconciliation.csv',index=False)
    isd=pd.read_csv(sources['isd']);icov=pd.read_csv(ROOT/'isd_station_coverage.csv')
    station_pairs=isd.copy();station_pairs['ghcn_station']='USW000'+station_pairs.station.str[-5:]
    station_pairs=station_pairs.merge(ghcn,left_on=['ghcn_station','date'],right_on=['station','date'],suffixes=('_hourly','_daily'),validate='many_to_one')
    same_station=[]
    for sid,g in station_pairs.groupby('station_hourly'):
        for key in ['temp_high_f','temp_low_f']:
            if g[[key+'_daily',key+'_hourly']].dropna().empty:continue
            s=stats(g,key+'_daily',key+'_hourly')
            same_station.append({'station':sid,'variable':key,'matched_station_days':s['matched_zip_days'],'mean_ghcn_minus_hourly_sample_f':s['mean_modeled_minus_observed_f'],'mae_f':s['mean_absolute_difference_f'],'rmse_f':s['rmse_f'],'correlation':s['correlation'],'note':'WBAN-linked station comparison; GHCN observing-day convention and continuous/sampled extrema may differ.'})
    pd.DataFrame(same_station).to_csv(ROOT/'ghcn_vs_isd_same_station.csv',index=False)
    ista=icov[icov.complete_civil_days>=.90*1461]
    imap=assign(locations,ista,'isd_strict_complete_civil')
    imap.to_csv(ROOT/'isd_zip_station_assignment.csv',index=False)
    ipairs=panel.merge(imap,on='zip_code',validate='many_to_one');ipairs=ipairs[ipairs.eligible_station_match].merge(isd[['station','date','day_hours','valid_hourly_samples','complete_civil_day','temp_high_f','temp_mean_f','temp_low_f']],on=['station','date'],how='left',validate='many_to_one')
    ipairs.to_csv(ROOT/'isd_zip_pairs_2021_2024.csv.gz',index=False,compression='gzip')
    igood=ipairs[ipairs.temp_high_f.notna()]
    summaries.append({'network':'isd_strict_complete_civil','candidate_stations':len(ista),'mapped_zips':imap.eligible_station_match.sum(),'paired_high_zip_days':len(igood),'paired_all_groups':igood.eligible_all_count.sum(),'paired_core_groups':igood.core_count.sum(),'paired_civil_zips':igood[igood.civil_high_f.notna()].zip_code.nunique(),'paired_civil_zip_days':igood.civil_high_f.notna().sum()})
    for modeled,observed in [('legacy_high_f','temp_high_f'),('legacy_low_f','temp_low_f'),('civil_high_f','temp_high_f'),('civil_low_f','temp_low_f'),('civil_mean_f','temp_mean_f')]:
        metrics.append({'network':'isd_strict_complete_civil','scope':'all_matched_zip_days','modeled':modeled,'observed':observed,**stats(ipairs,modeled,observed)})
    pd.DataFrame(summaries).to_csv(ROOT/'network_coverage_comparison.csv',index=False)
    pd.DataFrame(metrics).to_csv(ROOT/'weather_paired_metrics.csv',index=False)
    thresholds=pd.read_csv(ROOT/'ghcn_baseline_thresholds_1991_2020.csv');eligible=thresholds[thresholds.eligible_90pct_days_25years]
    heat=[]
    for t in eligible.itertuples(index=False):
        g=ghcn[ghcn.station==t.station].set_index('date').reindex(pd.date_range('2021-01-01','2024-12-31').strftime('%Y-%m-%d'))
        temps=g.temp_high_f
        out=pd.DataFrame({'station':t.station,'date':g.index,'temp_high_f':temps.values,'baseline_p90_f':t.tmax_p90_f,'baseline_p95_f':t.tmax_p95_f})
        warm=out.date.str[5:].between('05-01','09-30')
        for suffix,threshold in [('p90',t.tmax_p90_f),('p95',t.tmax_p95_f)]:
            above=(out.temp_high_f>threshold)&warm
            out['exceeds_'+suffix]=np.where(warm&out.temp_high_f.notna(),above.astype(int),np.nan)
            flags=[]
            for i in range(len(out)):
                if not warm.iloc[i] or pd.isna(out.temp_high_f.iloc[i]):flags.append(np.nan);continue
                if not above.iloc[i]:flags.append(0);continue
                confirmed=False;uncertain=False
                for left in range(max(0,i-2),min(i,len(out)-3)+1):
                    window=out.iloc[left:left+3];season=warm.iloc[left:left+3]
                    if not season.all():continue
                    if (window.temp_high_f>threshold).all():confirmed=True
                    elif window.temp_high_f.isna().any() and ((window.temp_high_f>threshold)|window.temp_high_f.isna()).all():uncertain=True
                flags.append(1 if confirmed else np.nan if uncertain else 0)
            out['three_consecutive_days_'+suffix]=flags
        heat.append(out)
    pd.concat(heat).to_csv(ROOT/'ghcn_heat_exceedance_2021_2024.csv',index=False)
    findings={'ghcn_downloaded_stations':len(coverage),'ghcn_90pct_primary_tmax_stations':len(suitable),'isd_downloaded_stations':len(icov),'isd_90pct_complete_civil_stations':len(ista),'baseline_eligible_stations':len(eligible),'coverage':pd.DataFrame(summaries).to_dict('records'),'paired_metrics':metrics,
      'assignment_rule':'Before considering outcomes: stations with >=90% primary-period valid Tmax (GHCN) or fully observed civil days (ISD); nearest horizontal station among those candidates, then <=25 km and <=200 m elevation difference. Do not select a second station if nearest fails elevation.',
      'comparison_limits':'ZIP-representative modeled weather versus nearby station observations, not identical site exposure. GHCN source observing-day conventions differ. ISD is exactly civil-day allocated but hourly sampled, not continuous extrema. Pooled metrics repeat stations across ZIPs and are descriptive, not independent validation observations.',
      'inputs':{k:{'relative_path':str(v.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(v.read_bytes()).hexdigest()} for k,v in sources.items()}}
    (ROOT/'comparison_summary.json').write_text(json.dumps(findings,indent=2)+'\n')
    print(json.dumps({k:v for k,v in findings.items() if k not in ['inputs','paired_metrics']},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--prepare-inputs',type=Path,help='Explicit analysis root for one-time export of public aggregate reproduction inputs.')
    args=parser.parse_args()
    if args.prepare_inputs:prepare_inputs(args.prepare_inputs)
    main()
