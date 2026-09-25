"""Download official denominator references; reject changed recorded sources."""
from pathlib import Path
import datetime,hashlib,json,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parent
SOURCES={
 '2024-111-Report.pdf':'https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf',
 'CDS_UCSD_2024-20253.pdf':'https://ir.ucsd.edu/stats/undergrad/CDS_UCSD_2024-20253.pdf',
 'SDSU_CDS_2024-25.pdf':'https://asir.sdsu.edu/Documents/CommonDataSets/CDS_2024-25.pdf',
 'SDSU_2024-25-budget-fact-sheet.pdf':'https://bfa.sdsu.edu/financial/budget/docs/2024-25-budget-fact-sheet.pdf',
}
def main():
    p=ROOT/'housing_source_manifest.json';manifest=json.loads(p.read_text()) if p.exists() else {}
    (ROOT/'raw').mkdir(exist_ok=True)
    for name,url in SOURCES.items():
        path=ROOT/'raw'/name
        try:data=path.read_bytes() if path.exists() else urllib.request.urlopen(url,timeout=60).read()
        except urllib.error.HTTPError as e:
            print(name,'not downloaded: HTTP',e.code,'; web-readable reference retained in methods.');continue
        assert data.startswith(b'%PDF'),name
        sha=hashlib.sha256(data).hexdigest()
        if name in manifest:assert sha==manifest[name]['sha256'],'Changed official PDF; create a new source revision.'
        if not path.exists():path.write_bytes(data)
        if name not in manifest:manifest[name]={'url':url,'sha256':sha,'bytes':len(data),'retrieved_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        p.write_text(json.dumps(manifest,indent=2)+'\n')
        print(name,sha)
if __name__=='__main__':main()
