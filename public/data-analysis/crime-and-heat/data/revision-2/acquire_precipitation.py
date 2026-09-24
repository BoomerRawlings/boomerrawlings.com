"""Explicit ERA5 precipitation, separate from ERA5-Land temperature/humidity.

A cached 112-point wet-period probe resolves actual selected ERA5 grid cells.
Precipitation is not elevation-correctable in the provider's ERA5 variable code;
one hourly series per returned grid can therefore be reused, unlike temperature.
"""
import argparse, collections, concurrent.futures, datetime as dt, gzip, json
from pathlib import Path
import urllib.parse
from acquire_civil_weather import (HERE, OLD, RAW, API, PAD_START, PAD_END, UTC,
    dates, boundaries, download, read_csv, dump_csv, dump_json, validate_hourly, accumulated)

def mapping(delay):
    locations=read_csv(OLD/'weather_locations.csv')
    params={'latitude':','.join(m['latitude'] for m in locations),
            'longitude':','.join(m['longitude'] for m in locations),
            'elevation':','.join(m['downscaled_elevation_m'] for m in locations),
            'start_date':'2024-02-04','end_date':'2024-02-06',
            'hourly':'precipitation','models':'era5','timezone':'GMT','timeformat':'unixtime',
            'precipitation_unit':'mm','cell_selection':'land'}
    path=RAW/'era5_precipitation_grid_pilot.json.gz'
    # The multi-coordinate response is an array; read its canonical cached probe.
    if path.exists(): data=json.loads(gzip.decompress(path.read_bytes()))
    else:
        import hashlib, urllib.request
        url=API+'?'+urllib.parse.urlencode(params)
        b=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ResearchWeatherRevision/1.0'}),timeout=150).read()
        data=json.loads(b); path.write_bytes(gzip.compress(b,mtime=0))
        dump_json(path.with_suffix('.request.json'),{'url':url,'sha256':hashlib.sha256(b).hexdigest()})
    assert len(data)==len(locations)==112
    grouped=collections.defaultdict(list)
    for m,q in zip(locations,data):
        validate_hourly(q,72,['precipitation'])
        assert q['hourly_units']['precipitation']=='mm'
        grouped[(q['latitude'],q['longitude'])].append((m,q))
    rows,checks=[],[]
    for grid,group in grouped.items():
        series=group[0][1]['hourly']['precipitation']
        identical=all(q['hourly']['precipitation']==series for m,q in group)
        assert identical and sum(series)>0,('Wet-period grid reuse validation failed',grid)
        checks.append({'grid':grid,'zips':len(group),'hourly_precip_identical':identical,'rain_sum_mm':sum(series)})
        for m,q in group:
            rows.append(dict(m,precip_grid_latitude=grid[0],precip_grid_longitude=grid[1],
                             precip_representative_zip=group[0][0]['zip_code'],precip_model='era5'))
    dump_json(HERE/'precipitation_mapping.json',rows)
    dump_json(HERE/'precipitation_grid_pilot_checks.json',checks)
    return rows

def acquire(m,delay):
    z=m['precip_representative_zip'];path=RAW/('era5_precipitation_hourly_'+z+'.json.gz')
    params={'latitude':m['latitude'],'longitude':m['longitude'],'elevation':m['downscaled_elevation_m'],
            'start_date':PAD_START,'end_date':PAD_END,'hourly':'precipitation','models':'era5',
            'timezone':'GMT','timeformat':'unixtime','precipitation_unit':'mm','cell_selection':'land'}
    q,url=download(params,path,delay)
    n=((dt.date.fromisoformat(PAD_END)-dt.date.fromisoformat(PAD_START)).days+1)*24
    h,index=validate_hourly(q,n,['precipitation'])
    assert (q['latitude'],q['longitude'])==(m['precip_grid_latitude'],m['precip_grid_longitude'])
    assert q['hourly_units']['precipitation']=='mm'
    assert all(p>=0 for p in h['precipitation'])
    rows=[]
    for d in dates():
        a,b=boundaries(d);v=accumulated(h,index,'precipitation',a,b)
        rows.append({'precip_representative_zip':z,'date':d.isoformat(),
                     'precipitation_mm':round(sum(v),6),'precipitation_hour_count':len(v),
                     'precip_grid_latitude':q['latitude'],'precip_grid_longitude':q['longitude']})
    dump_csv(HERE/'points'/('precipitation_'+z+'.csv'),rows)
    meta={'precip_representative_zip':z,'model':'era5','grid_latitude':q['latitude'],'grid_longitude':q['longitude'],
          'request_url':url,'raw_file':str(path.relative_to(HERE)),'hourly_count':n,
          'aggregation':'Sum precipitation timestamps in (civil midnight, next civil midnight]; each timestamp ends the preceding hourly accumulation'}
    dump_json(HERE/'points'/('precipitation_'+z+'.metadata.json'),meta)
    return z,len(rows)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--delay',type=float,default=15);args=ap.parse_args()
    RAW.mkdir(exist_ok=True);(HERE/'points').mkdir(exist_ok=True)
    rows=mapping(args.delay);reps={r['precip_representative_zip']:r for r in rows if r['zip_code']==r['precip_representative_zip']}
    done,failures=[],[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        tasks={pool.submit(acquire,m,args.delay):z for z,m in reps.items()}
        for f in concurrent.futures.as_completed(tasks):
            try:result=f.result();done.append(result);print('PRECIP_DONE',len(done),result,flush=True)
            except Exception as e:failures.append({'zip_code':tasks[f],'error':repr(e)});print('PRECIP_FAILED',tasks[f],repr(e),flush=True)
            dump_json(HERE/'precipitation_status.json',{'complete':len(done),'expected':len(reps),'failures':failures})
    if failures:raise SystemExit('Incomplete precipitation')
    all_rows=[];meta=[]
    for z in sorted(reps):
        all_rows.extend(read_csv(HERE/'points'/('precipitation_'+z+'.csv')))
        meta.append(json.loads((HERE/'points'/('precipitation_'+z+'.metadata.json')).read_text()))
    dump_csv(HERE/'daily_civil_precipitation_by_grid.csv',all_rows)
    dump_json(HERE/'precipitation_locations.json',meta)

if __name__=='__main__':main()
