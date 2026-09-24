"""Acquire official municipal-population and Sheriff-jurisdiction context."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import urlopen, Request
from datetime import datetime, timezone
import csv, hashlib, json

HERE = Path(__file__).resolve().parent
RAW = HERE / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'census_2020_places.html': 'https://tigerweb.geo.census.gov/tigerwebmain/Files/acs26/tigerweb_acs26_incplace_2020_tab20_ca.html',
}

class TableReader(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='tr': self.row=[]
        if tag in ('td','th'): self.cell=[]
    def handle_data(self,data):
        if self.cell is not None: self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split())); self.cell=None
        if tag=='tr' and self.row: self.rows.append(self.row)

metadata=[]
metadata_path=HERE/'source_metadata.json'
expected={r['file']:r for r in json.loads(metadata_path.read_text())} if metadata_path.exists() else {}
for name,url in SOURCES.items():
    path=RAW/name
    cached=path.exists()
    data=path.read_bytes() if cached else urlopen(Request(url,headers={'User-Agent':'Research source validation'}),timeout=60).read()
    if name in expected:
        assert len(data)==expected[name]['bytes'] and hashlib.sha256(data).hexdigest()==expected[name]['sha256'], 'Census source snapshot changed; do not silently substitute revised bytes'
    if not cached:path.write_bytes(data)
    metadata.append({'file':name,'url':url,'retrieved_utc':datetime.fromtimestamp(path.stat().st_mtime,timezone.utc).isoformat(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
if not expected:metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
p=TableReader();p.feed((RAW/'census_2020_places.html').read_text(encoding='utf-8'))
(HERE/'parsed_table.json').write_text(json.dumps(p.rows,indent=2)+'\n')
print(json.dumps({'rows':len(p.rows),'headers':p.rows[:2],'vista':[r for r in p.rows if any(v=='Vista city' for v in r)],'san_marcos':[r for r in p.rows if any(v=='San Marcos city' for v in r)]}))
selected={'Del Mar','Encinitas','Imperial Beach','Lemon Grove','Poway','San Marcos','Santee','Solana Beach','Vista'}
records=[dict(zip(p.rows[0],r)) for r in p.rows[1:] if len(r)==len(p.rows[0])]
output=[{'city':r['BASENAME'],'geoid':r['GEOID'],'census_2020_population':int(r['POP100']),'population_reference':'2020 Census','sheriff_contract_city_current':True} for r in records if r['BASENAME'] in selected]
assert len(output)==9 and len({r['geoid'] for r in output})==9
assert next(r for r in output if r['city']=='Vista')['census_2020_population']==98381
assert next(r for r in output if r['city']=='San Marcos')['census_2020_population']==94833
with (HERE/'contract_city_population_2020.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=list(output[0]));w.writeheader();w.writerows(output)
(HERE/'validation.json').write_text(json.dumps({'status':'PASS','municipalities':len(output),'vista_population':98381,'san_marcos_population':94833,'risk_denominators_created':False},indent=2)+'\n')
