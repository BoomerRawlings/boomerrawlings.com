"""Rebuild weather with UTC hourly data and real IANA civil-day boundaries.

Original released data remain read-only. Only public coordinates/dates go to API.
ERA5-Land temperature/RH and ERA5 precipitation are explicitly separate sources.
"""
from __future__ import annotations
import argparse, concurrent.futures, csv, datetime as dt, gzip, hashlib, json
from pathlib import Path
import statistics, threading, time, urllib.error, urllib.parse, urllib.request
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
BASE = HERE.parents[1]
OLD = BASE / 'weather'
RAW = HERE / 'raw'
UTC = dt.timezone.utc
LOCAL = ZoneInfo('America/Los_Angeles')
START, END = dt.date(2018, 7, 1), dt.date(2025, 12, 31)
PAD_START, PAD_END = '2018-06-29', '2026-01-02'
API = 'https://archive-api.open-meteo.com/v1/archive'
LOCK, LAST = threading.Lock(), 0.0
STOP = threading.Event()

def sha(b): return hashlib.sha256(b).hexdigest()
def read_csv(p):
    with p.open(encoding='utf-8-sig', newline='') as f: return list(csv.DictReader(f))
def dump_csv(p, rows):
    with p.open('w', encoding='utf-8', newline='') as f:
        w=csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
def dump_json(p, value): p.write_text(json.dumps(value, indent=2), encoding='utf-8')
def epoch(d): return int(dt.datetime.combine(d,dt.time(),LOCAL).timestamp())
def boundaries(d): return epoch(d), epoch(d+dt.timedelta(days=1))
def dates(start=START, end=END):
    return [start+dt.timedelta(days=i) for i in range((end-start).days+1)]
def moments(values): return max(values), statistics.fmean(values), min(values)

def download(params, path, delay):
    global LAST
    url=API+'?'+urllib.parse.urlencode(params)
    if path.exists(): return json.loads(gzip.decompress(path.read_bytes())), url
    for attempt in range(5):
        if STOP.is_set(): raise RuntimeError('Stopped after a rate-limit blocker')
        with LOCK:
            time.sleep(max(0, delay-(time.monotonic()-LAST)))
            if STOP.is_set(): raise RuntimeError('Stopped after a rate-limit blocker')
            LAST=time.monotonic()
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'ResearchWeatherRevision/1.0'})
            with urllib.request.urlopen(req, timeout=150) as response: b=response.read()
            data=json.loads(b)
            if data.get('error'): raise RuntimeError(data)
            packed=gzip.compress(b,mtime=0)
            tmp=path.with_suffix(path.suffix+'.tmp'); tmp.write_bytes(packed); tmp.replace(path)
            dump_json(path.with_suffix('.request.json'), {
                'request_url':url, 'retrieved_utc':dt.datetime.now(UTC).isoformat(),
                'response_sha256':sha(b),'compressed_sha256':sha(packed),
                'response_bytes':len(b),'compressed_bytes':len(packed)})
            return data,url
        except urllib.error.HTTPError as e:
            detail=e.read().decode('utf8',errors='replace')
            print('HTTP',e.code,detail[:220],flush=True)
            if e.code==429 and ('Daily' in detail or 'daily' in detail or 'Hourly' in detail or 'hourly' in detail):
                STOP.set(); raise RuntimeError(detail)
            if attempt==4: raise
            time.sleep(min(60,15*(attempt+1)))
        except (urllib.error.URLError,TimeoutError):
            if attempt==4: raise
            time.sleep(min(60,10*(attempt+1)))

def validate_hourly(q, expected, fields):
    assert q['utc_offset_seconds']==0 and q['timezone']=='GMT'
    h=q['hourly']; stamps=h['time']
    assert len(stamps)==expected and all(b-a==3600 for a,b in zip(stamps,stamps[1:]))
    for field in fields:
        assert len(h[field])==expected
        assert all(v is not None for v in h[field]), (field,'missing')
    return h, {stamp:i for i,stamp in enumerate(stamps)}

def instantaneous(h,index,key,start,end):
    return [h[key][index[t]] for t in range(start,end,3600)]
def accumulated(h,index,key,start,end):
    # API precipitation at t is the sum over the PRECEDING hour: (t-1h,t].
    return [h[key][index[t]] for t in range(start+3600,end+1,3600)]

def temperature(m,delay):
    zipcode=m['zip_code']; path=RAW/('era5_land_hourly_'+zipcode+'.json.gz')
    params={'latitude':m['latitude'],'longitude':m['longitude'],
            'elevation':m['downscaled_elevation_m'], 'start_date':PAD_START,'end_date':PAD_END,
            'hourly':'temperature_2m,relative_humidity_2m','models':'era5_land',
            'temperature_unit':'fahrenheit','timezone':'GMT','timeformat':'unixtime','cell_selection':'land'}
    q,url=download(params,path,delay)
    n=((dt.date.fromisoformat(PAD_END)-dt.date.fromisoformat(PAD_START)).days+1)*24
    h,index=validate_hourly(q,n,['temperature_2m','relative_humidity_2m'])
    assert q['hourly_units']['temperature_2m']=='°F' and q['hourly_units']['relative_humidity_2m']=='%'
    assert abs(q['elevation']-float(m['downscaled_elevation_m']))<1e-6
    assert abs(q['latitude']-float(m['weather_grid_latitude']))<1e-6
    assert abs(q['longitude']-float(m['weather_grid_longitude']))<1e-6
    assert all(0<=v<=100 for v in h['relative_humidity_2m'])
    rows=[]
    for d in dates():
        a,b=boundaries(d); prior_a,prior_b=boundaries(d-dt.timedelta(days=1))
        tv=instantaneous(h,index,'temperature_2m',a,b)
        rh=instantaneous(h,index,'relative_humidity_2m',a,b)
        hi,mean,lo=moments(tv); prior=moments(instantaneous(h,index,'temperature_2m',prior_a,prior_b))
        # Parallel fixed UTC-7 series isolates calendar-window effects from new retrieval/rounding.
        olda=int(dt.datetime.combine(d,dt.time(7),UTC).timestamp())
        fixed=moments(instantaneous(h,index,'temperature_2m',olda,olda+86400))
        row={'zip_code':zipcode,'date':d.isoformat(),'temp_high_f':hi,'temp_mean_f':round(mean,8),'temp_low_f':lo,
             'relative_humidity_mean_pct':round(statistics.fmean(rh),8),'relative_humidity_min_pct':min(rh),'relative_humidity_max_pct':max(rh),
             'daylength_hrs':len(tv),'temperature_hour_count':len(tv),'humidity_hour_count':len(rh),
             'day_start_utc':dt.datetime.fromtimestamp(a,UTC).isoformat(),'day_end_utc':dt.datetime.fromtimestamp(b,UTC).isoformat(),
             'utc_offset_at_start_hrs':int(dt.datetime.fromtimestamp(a,UTC).astimezone(LOCAL).utcoffset().total_seconds()/3600),
             'prior_day_high_f':prior[0],'prior_day_mean_f':round(prior[1],8),'prior_day_low_f':prior[2],
             'fixed_utc7_high_f':fixed[0],'fixed_utc7_mean_f':round(fixed[1],8),'fixed_utc7_low_f':fixed[2]}
        assert lo<=mean<=hi and len(tv) in [23,24,25]
        rows.append(row)
    meta={k:m[k] for k in ['zip_code','latitude','longitude','downscaled_elevation_m','coordinate_source','coordinate_url']}
    meta.update({'model':'era5_land','grid_latitude':q['latitude'],'grid_longitude':q['longitude'],'grid_matches_released':True,
                 'request_url':url,'raw_file':str(path.relative_to(HERE)),'hourly_count':n,'timezone':'GMT'})
    dump_csv(HERE/'points'/('temperature_'+zipcode+'.csv'),rows)
    dump_json(HERE/'points'/('temperature_'+zipcode+'.metadata.json'),meta)
    return zipcode,len(rows)

def combine_temperature(allow_partial=False):
    points=list(csv.DictReader((OLD/'weather_locations.csv').open(encoding='utf-8-sig')))
    rows=[]; metadata=[]
    for m in points:
        z=m['zip_code']; path=HERE/'points'/('temperature_'+z+'.csv')
        if not path.exists() and allow_partial: continue
        assert path.exists(),f'Missing {z}'
        rows.extend(read_csv(path)); metadata.append(json.loads((HERE/'points'/('temperature_'+z+'.metadata.json')).read_text()))
    rows.sort(key=lambda r:(r['zip_code'],r['date']))
    assert len(rows)==len(metadata)*2741
    if not allow_partial: assert len(metadata)==112
    dump_csv(HERE/'daily_civil_temperature_humidity.csv',rows)
    dump_json(HERE/'temperature_locations.json',metadata)
    print('TEMPERATURE_FINAL',len(rows),flush=True)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--delay',type=float,default=6.5);ap.add_argument('--workers',type=int,default=3)
    args=ap.parse_args();RAW.mkdir(exist_ok=True);(HERE/'points').mkdir(exist_ok=True)
    locations=read_csv(OLD/'weather_locations.csv')
    # Largest source-row ZIPs first to make early diagnostics informative; final output is sorted.
    locations.sort(key=lambda m:-int(m['source_rows']))
    failures=[]; done=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        tasks={pool.submit(temperature,m,args.delay):m['zip_code'] for m in locations}
        for future in concurrent.futures.as_completed(tasks):
            try:
                result=future.result();done.append(result);print('DONE',len(done),result,flush=True)
            except Exception as e:
                failures.append({'zip_code':tasks[future],'error':repr(e)});print('FAILED',tasks[future],repr(e),flush=True)
            dump_json(HERE/'acquisition_status.json',{'complete':len(done),'expected':112,'failures':failures})
    if failures: raise SystemExit('Incomplete: inspect acquisition_status.json; rerun uses cache')
    combine_temperature()

if __name__=='__main__':main()
