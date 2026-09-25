"""Acquire official NCES IPEDS bulk files and preserve exact source hashes."""
from pathlib import Path
import argparse,csv,datetime as dt,hashlib,io,json,time,urllib.request,urllib.error,zipfile,http.cookiejar,re
ROOT=Path(__file__).resolve().parent
RAW=ROOT/'raw'
BASE='https://nces.ed.gov/ipeds/complete-data-files/'
OPENER=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def fetch(name):
    RAW.mkdir(parents=True,exist_ok=True)
    path=RAW/name;manifest_path=ROOT/'raw_manifest.json'
    manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    if path.exists():
        data=path.read_bytes();assert hashlib.sha256(data).hexdigest()==manifest[name]['sha256'];return data
    url=BASE+name
    for candidate in [url,'https://nces.ed.gov/ipeds/datacenter/data/'+name]:
        request=urllib.request.Request(candidate,headers={'User-Agent':'University-campus-statistics-research/1.0'})
        try:
            with OPENER.open(request,timeout=60) as response:
                data=response.read();final_url=response.url;headers=dict(response.headers);url=candidate
            break
        except urllib.error.HTTPError as error:
            if error.code!=404 or candidate.endswith('/datacenter/data/'+name):raise
    with zipfile.ZipFile(io.BytesIO(data)) as z:members=z.namelist();assert z.testzip() is None
    if name in manifest:assert hashlib.sha256(data).hexdigest()==manifest[name]['sha256'],'Source revised; use new version.'
    path.write_bytes(data)
    manifest[name]={'requested_url':url,'final_url':final_url,'retrieved_utc':dt.datetime.now(dt.timezone.utc).isoformat(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'members':members,'last_modified':headers.get('Last-Modified')}
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    print(name,len(data),members,flush=True);time.sleep(.3);return data

def inspect(name):
    data=fetch(name)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for member in z.namelist():
            if member.lower().endswith('.csv'):
                text=z.read(member).decode('utf-8-sig',errors='replace')
                print(member, '\n'.join(text.splitlines()[:3]),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('files',nargs='+');parser.add_argument('--inspect',action='store_true');args=parser.parse_args()
    for name in args.files:(inspect if args.inspect else fetch)(name)
