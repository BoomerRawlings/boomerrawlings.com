"""Independent NOAA station expansion; never modifies released weather panels.

Run with the project Python runtime. All downloads are direct NOAA/NCEI public
archives. Raw response bytes and URLs are recorded for offline reproduction.
"""
from pathlib import Path
import argparse, calendar, csv, datetime as dt, gzip, hashlib, io, json, math
import statistics, time, urllib.request, urllib.error
from collections import defaultdict, Counter
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parent
RAW=ROOT/'raw'
PROJECT=ROOT.parents[2]
UTC=dt.timezone.utc
LOCAL=ZoneInfo('America/Los_Angeles')
BBOX=(32.5,33.55,-117.6,-116.05)
START=dt.date(2018,7,1)
END=dt.date(2025,12,31)
MANIFEST=ROOT/'raw_manifest.json'

def dump(path, data):
    path.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def csvout(path, rows):
    if not rows:return
    with path.open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(dict.fromkeys(key for row in rows for key in row)));writer.writeheader();writer.writerows(rows)

def fetch(url,name):
    RAW.mkdir(parents=True,exist_ok=True)
    target=RAW/name
    manifest=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    if target.exists():
        data=target.read_bytes()
        assert name in manifest and manifest[name]['sha256']==hashlib.sha256(data).hexdigest(),name
        return data
    request=urllib.request.Request(url,headers={'User-Agent':'NOAA-academic-observational-weather-audit/1.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request,timeout=90) as response:
                data=response.read();headers=dict(response.headers)
            break
        except urllib.error.HTTPError as error:
            if error.code in (403,404,429):raise
            if attempt==2:raise
            time.sleep(3*(attempt+1))
        except (TimeoutError,urllib.error.URLError):
            if attempt==2:raise
            time.sleep(3*(attempt+1))
    if name in manifest:
        assert manifest[name]['sha256']==hashlib.sha256(data).hexdigest(),f'NOAA source changed: {name}; freeze a new acquisition version rather than replace the archived source.'
    target.write_bytes(data)
    manifest[name]={'url':url,'retrieved_utc':dt.datetime.now(UTC).isoformat(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'last_modified':headers.get('Last-Modified')}
    dump(MANIFEST,manifest)
    time.sleep(.35)
    return data

def in_region(lat,lon):return BBOX[0]<=lat<=BBOX[1] and BBOX[2]<=lon<=BBOX[3]

def inventories():
    stations=fetch('https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt','ghcnd-stations.txt').decode()
    inventory=fetch('https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt','ghcnd-inventory.txt').decode()
    local={}
    for line in stations.splitlines():
        lat,lon=float(line[12:20]),float(line[21:30])
        if line[0:2]=='US' and in_region(lat,lon):
            local[line[:11]]={'station':line[:11],'name':line[41:71].strip(),'latitude':lat,'longitude':lon,'elevation_m':float(line[31:37]),'state':line[38:40]}
    active={}
    for line in inventory.splitlines():
        sid=line[:11];element=line[31:35];first=int(line[36:40]);last=int(line[41:45])
        if sid in local and element in ('TMAX','TMIN','TAVG','PRCP'):
            local[sid][element+'_first']=first;local[sid][element+'_last']=last
            if element=='TMAX' and first<=2021 and last>=2024:active[sid]=local[sid]
    dump(ROOT/'ghcn_inventory_region.json',list(local.values()))
    dump(ROOT/'ghcn_selected_stations.json',list(active.values()))
    history=fetch('https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv','isd-history.csv').decode('utf-8-sig')
    isd=[]
    for row in csv.DictReader(io.StringIO(history)):
        if not row['LAT'] or not row['LON']:continue
        if row['CTRY']=='US' and in_region(float(row['LAT']),float(row['LON'])) and row['BEGIN']<='20210101' and row['END']>='20241231':
            isd.append(row)
    dump(ROOT/'isd_inventory_region.json',isd)
    print(json.dumps({'ghcn_selected':list(active.values()),'isd_candidates':isd},indent=2),flush=True)

def ghcn():
    stations=json.loads((ROOT/'ghcn_selected_stations.json').read_text())
    allrows=[];coverage=[];thresholds=[];quality=Counter()
    for station in stations:
        sid=station['station'];data=fetch(f'https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/{sid}.dly',sid+'.dly').decode()
        byday=defaultdict(dict)
        for line in data.splitlines():
            year,month=int(line[11:15]),int(line[15:17]);element=line[17:21]
            if not 1991<=year<=2025 or element not in ('TMAX','TMIN','TAVG','TAXN','PRCP'):continue
            for day in range(1,calendar.monthrange(year,month)[1]+1):
                chunk=line[21+(day-1)*8:29+(day-1)*8]
                value=int(chunk[:5]);mflag,qflag,sflag=chunk[5:8]
                date=dt.date(year,month,day).isoformat()
                byday[date][element]=(value,mflag.strip(),qflag.strip(),sflag.strip())
        daily=[]
        for date,values in sorted(byday.items()):
            r={'station':sid,'date':date}
            for element,col in [('TMAX','temp_high_f'),('TMIN','temp_low_f'),('TAVG','reported_tavg_f'),('TAXN','reported_taxn_f'),('PRCP','precipitation_mm')]:
                value,m,q,s=values.get(element,(-9999,'','',''))
                good=value!=-9999 and not q
                r[col]=round(value/10*(1.8 if element!='PRCP' else 1)+(32 if element!='PRCP' else 0),5) if good else None
                r[element.lower()+'_measurement_flag']=m;r[element.lower()+'_quality_flag']=q;r[element.lower()+'_source_flag']=s
                if value!=-9999:quality[element+':'+(q or 'PASS')]+=1
            r['tmax_tmin_midpoint_f']=(r['temp_high_f']+r['temp_low_f'])/2 if r['temp_high_f'] is not None and r['temp_low_f'] is not None else None
            r['temperature_order_valid']=not(r['temp_high_f'] is not None and r['temp_low_f'] is not None and r['temp_low_f']>r['temp_high_f'])
            daily.append(r)
        allrows.extend(daily)
        cov={**station,'new_station_beyond_original_six':sid not in ['USW00023188','USW00003177','USW00053120','USC00040983','USC00040136','USC00042863']}
        for label,start,end in [('baseline','1991-01-01','2020-12-31'),('primary','2021-01-01','2024-12-31'),('export','2018-07-01','2025-12-31')]:
            subset=[r for r in daily if start<=r['date']<=end]
            for col in ['temp_high_f','temp_low_f','reported_tavg_f','precipitation_mm']:
                cov[label+'_'+col+'_days']=sum(r[col] is not None for r in subset)
        coverage.append(cov)
        warm=[r for r in daily if '1991-01-01'<=r['date']<='2020-12-31' and '05-01'<=r['date'][5:]<='09-30' and r['temp_high_f'] is not None]
        annual=Counter(r['date'][:4] for r in warm)
        eligible=len(warm)>=.90*(153*30) and sum(n>=.90*153 for n in annual.values())>=25
        values=sorted(r['temp_high_f'] for r in warm)
        def quantile(q):
            if not values:return None
            p=(len(values)-1)*q;lo=math.floor(p);hi=math.ceil(p)
            return values[lo]+(values[hi]-values[lo])*(p-lo)
        thresholds.append({'station':sid,'name':station['name'],'baseline_start':'1991-01-01','baseline_end':'2020-12-31','season':'May-September','valid_tmax_days':len(warm),'expected_days':153*30,'coverage_fraction':len(warm)/(153*30),'years_with_90pct_coverage':sum(n>=.90*153 for n in annual.values()),'eligible_90pct_days_25years':eligible,'tmax_p90_f':quantile(.90) if eligible else None,'tmax_p95_f':quantile(.95) if eligible else None,'quantile_method':'linear (type 7)','interpretation':'station-specific warm-season threshold; not a calendar-day percentile or official warning criterion'})
        print('GHCN',sid,station['name'],'primary high days',cov['primary_temp_high_f_days'],flush=True)
    csvout(ROOT/'ghcn_station_coverage.csv',coverage)
    csvout(ROOT/'ghcn_baseline_thresholds_1991_2020.csv',thresholds)
    with gzip.open(ROOT/'ghcn_daily_1991_2025.csv.gz','wt',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(allrows[0]));writer.writeheader();writer.writerows(allrows)
    csvout(ROOT/'ghcn_daily_2018_2025.csv',[r for r in allrows if START.isoformat()<=r['date']<=END.isoformat()])
    dump(ROOT/'ghcn_quality_summary.json',dict(quality))
    print('GHCN complete',len(stations),'stations',len(allrows),'rows',flush=True)

def isd_pilot():
    name='722900-23188-2024.gz'
    raw=fetch('https://www.ncei.noaa.gov/pub/data/noaa/2024/'+name,name)
    lines=gzip.decompress(raw).decode().splitlines()
    counts=Counter(line[92:93] for line in lines if len(line)>=105)
    dump(ROOT/'isd_pilot.json',{'raw_bytes':len(raw),'rows':len(lines),'temperature_quality_counts':dict(counts),'first_records':[{'date_utc':line[15:23],'time_utc':line[23:27],'report_type':line[41:46],'temp':line[87:92],'quality':line[92:93]} for line in lines[:8]]})
    print((ROOT/'isd_pilot.json').read_text(),flush=True)

def isd():
    stations=[row for row in json.loads((ROOT/'isd_inventory_region.json').read_text()) if row['ICAO'].startswith('K')]
    dump(ROOT/'isd_selected_stations.json',stations)
    dailies=[];hourlies=[];coverage=[];quality=[]
    start,end=dt.date(2021,1,1),dt.date(2024,12,31)
    allowed_reports={'FM-12','FM-15','FM-16','SAO','SAOSP','S-S-A','SA-AU','SY-MT','SY-SA','SY-AU','AUTO'}
    for station in stations:
        sid=station['USAF']+'-'+station['WBAN'];hour_candidates=defaultdict(list);counts=Counter();all_bydate=defaultdict(list)
        for year in range(2021,2026):
            name=f'{sid}-{year}.gz'
            raw=fetch(f'https://www.ncei.noaa.gov/pub/data/noaa/{year}/{name}',name)
            for line in gzip.decompress(raw).decode().splitlines():
                if len(line)<105:counts['short_line']+=1;continue
                instant=dt.datetime.strptime(line[15:27],'%Y%m%d%H%M').replace(tzinfo=UTC)
                local=instant.astimezone(LOCAL);date=local.date()
                if not start<=date<=end:continue
                value=int(line[87:92]);flag=line[92];report=line[41:46].strip()
                counts['quality_'+flag]+=1
                if value==9999:counts['missing_temperature']+=1;continue
                if flag not in ('1','5','C'):counts['excluded_quality']+=1;continue
                if report not in allowed_reports:counts['excluded_report_type_'+report]+=1;continue
                hour=instant.replace(minute=0,second=0,microsecond=0)
                item={'station':sid,'icao':station['ICAO'],'utc_hour':hour.isoformat(),'observation_utc':instant.isoformat(),'observation_local':local.isoformat(),'date':date.isoformat(),'temp_f':round(value*.18+32,5),'temperature_quality':flag,'report_type':report,'source_flag':line[27]}
                hour_candidates[hour].append(item);all_bydate[date.isoformat()].append(item['temp_f'])
        bydate=defaultdict(list)
        for hour,values in sorted(hour_candidates.items()):
            # One retained original timestamp per clock hour, selected solely by
            # proximity to mid-hour; ties by timestamp, routine before special,
            # then complete lexical tuple (never temperature-based selection).
            values.sort(key=lambda v:(abs(dt.datetime.fromisoformat(v['observation_utc']).minute-30),v['observation_utc'],v['report_type']!='FM-15',v['temperature_quality'],v['source_flag']))
            selected=values[0];selected['valid_reports_in_hour']=len(values)
            hourlies.append(selected);bydate[selected['date']].append(selected)
        day=start;stationdays=[]
        while day<=end:
            local_start=dt.datetime.combine(day,dt.time(),LOCAL);local_end=dt.datetime.combine(day+dt.timedelta(days=1),dt.time(),LOCAL)
            expected=int((local_end.astimezone(UTC)-local_start.astimezone(UTC)).total_seconds()/3600)
            values=bydate.get(day.isoformat(),[]);temps=[r['temp_f'] for r in values];complete=len(temps)==expected
            r={'station':sid,'icao':station['ICAO'],'date':day.isoformat(),'day_hours':expected,'valid_hourly_samples':len(temps),'complete_civil_day':complete,
               'whole_degree_awos_C_samples':sum(v['temperature_quality']=='C' for v in values),
               'temp_high_f':max(temps) if complete else None,'temp_mean_f':statistics.mean(temps) if complete else None,'temp_low_f':min(temps) if complete else None,
               'available_sample_high_f':max(temps) if temps else None,'available_sample_mean_f':statistics.mean(temps) if temps else None,'available_sample_low_f':min(temps) if temps else None,
               'all_valid_reports_high_f':max(all_bydate[day.isoformat()]) if temps else None,'all_valid_reports_low_f':min(all_bydate[day.isoformat()]) if temps else None,
               'utc_start':local_start.astimezone(UTC).isoformat(),'utc_end':local_end.astimezone(UTC).isoformat()}
            stationdays.append(r);day+=dt.timedelta(days=1)
        dailies.extend(stationdays)
        coverage.append({'station':sid,'icao':station['ICAO'],'name':station['STATION NAME'],'latitude':float(station['LAT']),'longitude':float(station['LON']),'elevation_m':float(station['ELEV(M)']),
                         'calendar_days':len(stationdays),'complete_civil_days':sum(r['complete_civil_day'] for r in stationdays),'days_at_least_90pct_hours':sum(r['valid_hourly_samples']>=math.ceil(.9*r['day_hours']) for r in stationdays),
                         'valid_hourly_samples':sum(r['valid_hourly_samples'] for r in stationdays),'expected_hours':sum(r['day_hours'] for r in stationdays)})
        quality.append({'station':sid,**dict(counts)})
        print('ISD',sid,station['ICAO'],coverage[-1]['complete_civil_days'],'complete days',flush=True)
    csvout(ROOT/'isd_civil_daily_2021_2024.csv',dailies)
    csvout(ROOT/'isd_station_coverage.csv',coverage)
    csvout(ROOT/'isd_quality_summary.csv',quality)
    with gzip.open(ROOT/'isd_selected_hourly_2021_2024.csv.gz','wt',encoding='utf-8',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(hourlies[0]));writer.writeheader();writer.writerows(hourlies)
    print('ISD complete',len(stations),'stations',len(dailies),'daily rows',len(hourlies),'hourly rows',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('stage',choices=['inventory','ghcn','isd-pilot','isd'])
    args=parser.parse_args()
    if args.stage=='inventory':inventories()
    elif args.stage=='ghcn':ghcn()
    elif args.stage=='isd-pilot':isd_pilot()
    elif args.stage=='isd':isd()
