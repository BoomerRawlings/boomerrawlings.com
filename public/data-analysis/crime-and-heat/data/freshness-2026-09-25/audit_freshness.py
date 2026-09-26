"""Read-only upstream freshness check; frozen source inputs/models stay untouched.

Fetches exact documented public URLs. SDPD record-level CSVs are processed in
memory; only source hashes and date-level counts are retained. Large NOAA and
DOJ inputs are hashed without republishing raw files.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.parse import urlparse, parse_qs
import csv, gzip, hashlib, io, json, re, time

HERE=Path(__file__).resolve().parent
OLD=HERE.parent/'expansion_sources'
OUT=HERE/'responses';OUT.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
def write(name,value): (HERE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def fetch(job):
    url=job['url'];start=datetime.now(timezone.utc).isoformat()
    result={k:v for k,v in job.items() if k not in ['old_path']}
    result['checked_utc']=start
    try:
        with urlopen(Request(url,headers={'User-Agent':'Public-data-source-audit/1.0'}),timeout=90) as response:
            body=response.read();headers={k:v for k,v in response.headers.items() if k.lower() in ['date','last-modified','etag','content-type','content-length','cache-control']}
            result.update(status='retrieved',final_url=response.url,http_status=response.status,response_headers=headers,bytes=len(body),sha256=sha(body))
        result['same_bytes_as_frozen']=sha(body)==job.get('expected_sha256') if job.get('expected_sha256') else None
        name=job['id'];kind=job['kind']
        if kind=='sdpd':
            rows=csv.DictReader(io.StringIO(body.decode('utf-8-sig')));dates=Counter();n=0
            for row in rows:n+=1;dates[row.get('occured_on','')[:10] or 'UNASSIGNED']+=1
            result.update(source_rows=n,first_date=min(d for d in dates if d!='UNASSIGNED'),last_date=max(d for d in dates if d!='UNASSIGNED'),columns=rows.fieldnames)
            year=job['year'];old_counts=Counter()
            for r in csv.DictReader((OLD/f'local/sdpd_nibrs_{year}_daily.csv').open(encoding='utf-8-sig',newline='')):old_counts[r['date']]+=int(r['source_rows'])
            diffs=[{'date':d,'frozen_source_rows':old_counts[d],'current_source_rows':dates[d],'difference':dates[d]-old_counts[d]} for d in sorted(set(old_counts)|set(dates)) if old_counts[d]!=dates[d]]
            result.update(frozen_source_rows=sum(old_counts.values()),row_change=n-sum(old_counts.values()),changed_daily_count_cells=len(diffs))
            write(f'sdpd_{year}_daily_count_changes.json',diffs)
            write(f'sdpd_{year}_current_daily_counts.json',[{'date':d,'source_rows':v} for d,v in sorted(dates.items())])
        elif kind=='sandag_metadata':
            raw=json.loads(body);clean={k:raw.get(k) for k in ['id','name','description','rowsUpdatedAt','viewLastModified','metadata','provenance']}
            clean['columns']=[{k:c.get(k) for k in ['fieldName','name','dataTypeName','description']} for c in raw.get('columns',[]) if not c.get('fieldName','').startswith(':')]
            (OUT/(name+'.json')).write_text(json.dumps(clean,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            result.update(rowsUpdatedAt=raw.get('rowsUpdatedAt'),viewLastModified=raw.get('viewLastModified'))
            result['retained_response']='responses/'+name+'.json'
        elif kind=='sandag_aggregate':
            raw=json.loads(body);write('responses/'+name+'.json',raw);result['retained_response']='responses/'+name+'.json'
            if raw and isinstance(raw,list):
                result['aggregate_rows']=len(raw)
                if 'source_rows' in raw[0]:result['summed_source_rows']=sum(int(r['source_rows']) for r in raw)
                if 'last_recorded_datetime' in raw[0]:result['last_recorded_datetime']=max(r['last_recorded_datetime'] for r in raw)
        elif kind=='weather':
            old=Path(job['old_path']).read_bytes()
            if name.endswith('.dly'):
                def window(data,a,b):return b'\n'.join(line for line in data.splitlines() if len(line)>21 and a<=int(line[11:15])<=b)
                result['same_1991_2025_records']=window(body,1991,2025)==window(old,1991,2025)
                result['same_2021_2024_records']=window(body,2021,2024)==window(old,2021,2024)
            elif name.endswith('.gz'):
                fresh=gzip.decompress(body);prior=gzip.decompress(old)
                result['same_decompressed_bytes']=fresh==prior
                def primary(data):return b'\n'.join(r for r in data.splitlines() if len(r)>27 and b'202101010800'<=r[15:27]<b'202501010800')
                result['same_primary_civil_window_records']=primary(fresh)==primary(prior)
        elif kind=='catalog':
            raw=json.loads(body)
            if '/field_source' in url:
                clean=[{'filename':r['attributes'].get('filename'),'uri':r['attributes'].get('uri'),'created':r['attributes'].get('created'),'changed':r['attributes'].get('changed'),'filesize':r['attributes'].get('filesize')} for r in raw['data']]
            else:clean=[{'id':r['id'],'title':r['attributes']['title'],'changed':r['attributes'].get('changed'),'alias':r['attributes'].get('path',{}).get('alias'),'source_url':r.get('relationships',{}).get('field_source',{}).get('links',{}).get('related',{}).get('href')} for r in raw['data'] if r['attributes']['title'] in ['Arrests','Domestic Violence Related Calls for Assistance']]
            write('responses/'+name+'.json',clean);result['retained_response']='responses/'+name+'.json';result['catalog_summary']=clean
        elif kind in ['documentation','context','dictionary']:
            suffix='.csv' if kind=='dictionary' else '.html.txt'
            (OUT/(name+suffix)).write_bytes(body);result['retained_response']='responses/'+name+suffix
        elif kind=='doj' and job['id'].endswith('.pdf'):
            (OUT/name).write_bytes(body);result['retained_response']='responses/'+name
    except Exception as e:result.update(status='unavailable',error_type=type(e).__name__,error=str(e))
    return result

def jobs():
    out=[]
    for r in read(OLD/'doj/source_metadata.json')['files']:out.append({'id':r['filename'],'kind':'doj','url':r['url'],'expected_sha256':r['sha256']})
    for name,r in read(OLD/'weather/raw_manifest.json').items():out.append({'id':name,'kind':'weather','url':r['url'],'expected_sha256':r['sha256'],'old_path':str(OLD/'weather/raw'/name)})
    for r in read(OLD/'context/source_metadata.json'):out.append({'id':'census_2020_places','kind':'context','url':r['url'],'expected_sha256':r['sha256']})
    local=read(OLD/'local/retrieval_metadata.json')+read(OLD/'local/annual_retrieval_metadata.json');seen=set()
    for n,r in enumerate(local):
        url=r['url']
        if url in seen:continue
        seen.add(url)
        if 'seshat' in url:
            m=re.search(r'nibrs_(202\d)_',url);kind='sdpd' if m else 'dictionary';name='sdpd_'+m[1] if m else 'sdpd_dictionary';extra={'year':int(m[1])} if m else {}
        elif '/api/views/' in url:kind='sandag_metadata';name='sandag_'+url.split('/')[-1].split('.')[0];extra={}
        else:kind='sandag_aggregate';name=r.get('output',f'aggregate_{n}').replace('.csv','');extra={}
        out.append({'id':name,'kind':kind,'url':url,'expected_sha256':r['sha256'],**extra})
    for name,url in [
        ('doj_catalog','https://data-openjustice.doj.ca.gov/jsonapi/node/dataset'),
        ('doj_arrest_latest_files','https://data-openjustice.doj.ca.gov/jsonapi/node/dataset/041eca85-2c60-4f38-a995-805231a75e3c/field_source'),
        ('doj_dv_latest_files','https://data-openjustice.doj.ca.gov/jsonapi/node/dataset/25b28e8b-42d2-42c2-ab28-ebf15669910f/field_source')]:out.append({'id':name,'kind':'catalog','url':url})
    for name,url in [
        ('sheriff_monthly_listing','https://www.sdsheriff.gov/resources/open-data/law-enforcement-monthly-activity'),
        ('sheriff_about','https://www.sdsheriff.gov/bureaus/about-us'),
        ('sdpd_portal','https://data.sandiego.gov/datasets/police-nibrs/'),
        ('openmeteo_historical_docs','https://open-meteo.com/en/docs/historical-weather-api'),
        ('noaa_ghcn_docs','https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt'),
        ('noaa_isd_product','https://www.ncei.noaa.gov/products/land-based-station/integrated-surface-database')]:out.append({'id':name,'kind':'documentation','url':url})
    return out

if __name__=='__main__':
    work=jobs();result=[];write('STATUS.json',{'status':'running','planned_requests':len(work),'started_utc':datetime.now(timezone.utc).isoformat()})
    with ThreadPoolExecutor(max_workers=4) as pool:
        pending={pool.submit(fetch,job):job for job in work}
        for future in as_completed(pending):
            r=future.result();result.append(r)
            write('freshness_results.json',sorted(result,key=lambda x:(x['kind'],x['id'])))
            if len(result)%10==0 or r['kind']=='sdpd':print(len(result),'/',len(work),r['id'],r['status'],'same=',r.get('same_bytes_as_frozen'),flush=True)
    summary={'status':'COMPLETE_WITH_RECORDED_ACCESS_LIMITS' if any(r['status']!='retrieved' for r in result) else 'COMPLETE',
        'checked_utc':datetime.now(timezone.utc).isoformat(),'requests':len(result),'retrieved':sum(r['status']=='retrieved' for r in result),
        'same_bytes':sum(r.get('same_bytes_as_frozen') is True for r in result),'changed_bytes':sum(r.get('same_bytes_as_frozen') is False for r in result),
        'unavailable':[{'id':r['id'],'error':r.get('error')} for r in result if r['status']!='retrieved'],
        'model_refits':0,'frozen_files_modified':False}
    write('STATUS.json',summary);print(json.dumps(summary,indent=2))
