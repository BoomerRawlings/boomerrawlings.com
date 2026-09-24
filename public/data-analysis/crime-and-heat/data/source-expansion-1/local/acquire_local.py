"""Official local data supplement; writes aggregates/dictionaries only, no event records.

Python standard library. Run from any directory. Live sources may revise history.
Socrata queries return only aggregate counts; SDPD CSV bytes remain memory-only.
"""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
import csv, io, json, hashlib, datetime as dt, time

OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
LOG = []
QA = {}

def fetch(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent':'PublicAggregateResearch/1.0'}), timeout=180) as r:
                b=r.read()
                meta={'url':url,'final_url':r.url,'retrieved_utc':dt.datetime.now(dt.timezone.utc).isoformat(),
                      'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),
                      'last_modified':r.headers.get('Last-Modified'),'etag':r.headers.get('ETag')}
            return b,meta
        except Exception:
            if attempt==2: raise
            time.sleep(2*(attempt+1))

def write_csv(name, rows, fields=None):
    rows=list(rows)
    for r in rows:
        for k in ('date','month','first_recorded_datetime','last_recorded_datetime'):
            if k in r and r[k]: r[k]=str(r[k])[:7 if k=='month' else 10]
    fields=fields or list(dict.fromkeys(k for r in rows for k in r))
    with (OUT/name).open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    return len(rows)

def meta(dataset):
    b,m=fetch(f'https://opendata.sandag.org/api/views/{dataset}.json');LOG.append(m)
    x=json.loads(b)
    # Cached column contents contain example identifiers: never retain them.
    clean={k:x.get(k) for k in ['id','name','description','rowsUpdatedAt','viewLastModified','metadata','provenance']}
    clean['columns']=[{k:c.get(k) for k in ['fieldName','name','dataTypeName','description']} for c in x['columns'] if not c['fieldName'].startswith(':')]
    (OUT/f'{dataset}_metadata.json').write_text(json.dumps(clean,indent=2),encoding='utf-8')
    return x

def query(dataset, name, select, group=None, where=None, order=None):
    params={'$select':select,'$limit':50000}
    if group: params['$group']=group
    if where: params['$where']=where
    if order: params['$order']=order
    rows=[]
    while True:
        params['$offset']=len(rows)
        url=f'https://opendata.sandag.org/resource/{dataset}.json?'+urlencode(params)
        b,m=fetch(url);chunk=json.loads(b);m.update(dataset=dataset,output=name,query=params.copy());LOG.append(m)
        rows.extend(chunk)
        if len(chunk)<50000:break
    write_csv(name, rows)
    return rows

def sandag():
    for dataset,group,agency,date,incident,offense in [
        ('pr74-d3tr','a','agency','incident_date','incidentuid','cibrs_offense_code'),
        ('huzf-mi2z','b','arrest_agency','arrest_date','incident_uid','offense_code')]:
        meta(dataset)
        counts=f'count(*) as source_rows,count(distinct {incident}) as distinct_incidents,count(distinct cibrs_unique_offense_id) as distinct_offense_ids'
        if group=='b': counts+=',count(distinct arrest_number) as distinct_arrest_numbers'
        prefix=f'sandag_group_{group}'
        cov=query(dataset,f'{prefix}_agency_coverage.csv',f'{agency} as agency,{counts},min({date}) as first_recorded_datetime,max({date}) as last_recorded_datetime',agency,order=agency)
        flags=query(dataset,f'{prefix}_agency_dv_flag.csv',f'{agency} as agency,domestic_violence_incident,{counts}',f'{agency},domestic_violence_incident',order=f'{agency},domestic_violence_incident')
        daily=query(dataset,f'{prefix}_daily_agency_dv.csv',f'date_trunc_ymd({date}) as date,{agency} as agency,domestic_violence_incident,{counts}',f'date_trunc_ymd({date}),{agency},domestic_violence_incident',order=f'date_trunc_ymd({date}),{agency},domestic_violence_incident')
        monthly=query(dataset,f'{prefix}_monthly_agency_dv.csv',f'date_trunc_ym({date}) as month,{agency} as agency,domestic_violence_incident,{counts}',f'date_trunc_ym({date}),{agency},domestic_violence_incident',order=f'date_trunc_ym({date}),{agency},domestic_violence_incident')
        offenses=query(dataset,f'{prefix}_monthly_agency_offense.csv',f'date_trunc_ym({date}) as month,{agency} as agency,{offense} as offense_code,{counts}',f'date_trunc_ym({date}),{agency},{offense}',order=f'date_trunc_ym({date}),{agency},{offense}')
        status=query(dataset,f'{prefix}_status_counts.csv',f'cibrs_status,count(*) as source_rows','cibrs_status',order='cibrs_status')
        expected=sum(int(r['source_rows']) for r in cov)
        totals={n:sum(int(r['source_rows']) for r in v) for n,v in [('coverage',cov),('flags',flags),('daily',daily),('monthly',monthly),('offenses',offenses),('status',status)]}
        assert set(totals.values())=={expected},totals
        byagency={r['agency']:r for r in cov}
        flag_incidents=Counter()
        day_incidents=Counter()
        for r in flags:flag_incidents[r['agency']]+=int(r['distinct_incidents'])
        for r in daily:day_incidents[r['agency']]+=int(r['distinct_incidents'])
        QA[prefix]={'source_rows':expected,'reconciled_totals':totals,'agencies':len(cov),
                    'flag_partition_incident_overlap_by_agency':{a:flag_incidents[a]-int(r['distinct_incidents']) for a,r in byagency.items()},
                    'daily_flag_cell_incident_sum_minus_full_agency_distinct':{a:day_incidents[a]-int(r['distinct_incidents']) for a,r in byagency.items()},
                    'daily_rows':len(daily),'monthly_rows':len(monthly)}
        print(prefix,expected,'daily_cells',len(daily),flush=True)
    # Public offense definitions, no record-level values.
    meta('knre-fqwi')
    query('knre-fqwi','sandag_offense_dictionary.csv','*',order='nibrs_code')

def sdpd_year(year):
    url=f'https://seshat.datasd.org/police_nibrs/pd_nibrs_{year}_datasd.csv'
    b,m=fetch(url)
    reader=csv.DictReader(io.StringIO(b.decode('utf-8-sig')))
    daily=defaultdict(lambda:[0,set(),set()]);monthly=Counter();dates=Counter();uids=set();n=0;empty_date=0;dv_named=Counter()
    for r in reader:
        r={k.lower():v for k,v in r.items()}
        n+=1
        date=r.get('occured_on','')[:10]
        if not date:empty_date+=1;date='UNASSIGNED'
        dates[date]+=1
        grp=r.get('group_type','UNKNOWN');cat=r.get('crime_against','UNKNOWN')
        key=(date,grp,cat);a=daily[key];a[0]+=1
        if r.get('nibrs_uniq'):a[1].add(r['nibrs_uniq']);uids.add(r['nibrs_uniq'])
        if r.get('case_number'):a[2].add(r['case_number'])
        monthly[(date[:7],grp,r.get('ibr_offense',''),r.get('ibr_offense_description',''))]+=1
    out=[{'date':k[0],'group_type':k[1],'crime_against':k[2],'source_rows':v[0],'distinct_nibrs_offense_ids':len(v[1]),'distinct_case_numbers':len(v[2])} for k,v in sorted(daily.items())]
    om=[{'month':k[0],'group_type':k[1],'offense_code':k[2],'offense_description':k[3],'source_rows':v} for k,v in sorted(monthly.items())]
    write_csv(f'sdpd_nibrs_{year}_daily.csv',out);write_csv(f'sdpd_nibrs_{year}_monthly_offense.csv',om)
    valid=sorted(d for d in dates if d!='UNASSIGNED')
    qa={'year':year,'source_rows':n,'distinct_nibrs_offense_ids':len(uids),'rows_minus_distinct_ids':n-len(uids),'missing_occurrence_date_rows':empty_date,'first_date':min(valid),'last_date':max(valid),'days_with_rows':len(valid),'columns':reader.fieldnames,'row_reconciliation':sum(v[0] for v in daily.values())==n}
    print('sdpd',year,n,qa['first_date'],qa['last_date'],flush=True)
    return m,qa

def main():
    sandag()
    meta('2cpk-3bww')
    meta('qbrv-e75t')
    query('qbrv-e75t','sandag_annual_domestic_violence.csv','year,domestic_violence',order='year')
    b,m=fetch('https://seshat.datasd.org/police_nibrs/pd_nibrs_dictionary.csv');LOG.append(m)
    (OUT/'sdpd_nibrs_dictionary.csv').write_bytes(b)
    with ThreadPoolExecutor(max_workers=3) as pool:
        for m,q in pool.map(sdpd_year,range(2020,2027)):
            LOG.append(m);QA[f'sdpd_{q["year"]}']=q
    # Only source metadata URLs, hashes and aggregate schema are retained.
    (OUT/'retrieval_metadata.json').write_text(json.dumps(LOG,indent=2),encoding='utf-8')
    (OUT/'reconciliation.json').write_text(json.dumps(QA,indent=2),encoding='utf-8')
    manifest=[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.iterdir()) if p.is_file() and p.name!='manifest.json']
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')

if __name__=='__main__':main()
