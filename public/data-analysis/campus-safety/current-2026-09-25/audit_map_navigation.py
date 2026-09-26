"""Independently join final navigation points to the retained NCES directory.

Uses original project source files. Does not import either map generator or UI.
No scientific/publication input is modified; browser interaction is a separate audit.
"""
from pathlib import Path
from datetime import datetime, timezone
import csv, hashlib, io, json, re, zipfile

HERE = Path(__file__).resolve().parent
STUDY = HERE.parents[1]
SITE = STUDY.parent / 'boomerrawlings.com'
SOURCES = STUDY / 'research/map_navigation_2026_09_25'
RAW = STUDY / 'sources/enrollment/raw/HD2024.zip'
MAP = SITE / 'src/data/campus-map.json'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
load = lambda path: json.loads(path.read_text(encoding='utf8'))
checks = []
def check(name, condition): checks.append({'name': name, 'pass': bool(condition)})

data = load(MAP)
cohort = load(SITE/'public/data-analysis/campus-safety/current-2026-09-25/dataset.json')['institutions']
context = load(SITE/'src/data/campus-school-context.json')
with zipfile.ZipFile(RAW) as archive:
    raw = list(csv.DictReader(io.TextIOWrapper(archive.open('HD2024.csv'), encoding='utf-8-sig')))
raw_index = {row['UNITID']: row for row in raw}
check('NCES source directory has unique institutional identifiers', len(raw_index) == len(raw))
points = data['schools']
check('Exactly the 42 study institutions, each once', len(points) == len({p['id'] for p in points}) == 42 and {p['id'] for p in points} == {s['id'] for s in cohort})
fields = {'officialName':'INSTNM', 'city':'CITY', 'state':'STABBR'}
check('Names, cities and states match original NCES rows', all(all(p[k] == raw_index[p['id']][v] for k,v in fields.items()) for p in points))
check('All 42 longitude/latitude pairs exactly match original NCES values', all(p['longitude'] == float(raw_index[p['id']]['LONGITUD']) and p['latitude'] == float(raw_index[p['id']]['LATITUDE']) for p in points))
check('State FIPS codes match original NCES values', all(p['stateFips'] == raw_index[p['id']]['FIPS'].zfill(2) for p in points))
regions = {'West':'AK AZ CA CO HI ID MT NV NM OR UT WA WY', 'Midwest':'IL IN IA KS MI MN MO NE ND OH SD WI', 'Northeast':'CT ME MA NH RI VT NJ NY PA', 'South':'DE DC FL GA MD NC SC VA WV AL KY MS TN AR LA OK TX'}
state_region = {state:region for region,states in regions.items() for state in states.split()}
check('50 states plus District of Columbia, each once', len(data['states']) == 51 and {s['abbr'] for s in data['states']} == set(state_region))
check('All state and school regional assignments agree with Census region membership', all(state_region[s['abbr']] == s['region'] for s in data['states']) and all(state_region[p['state']] == p['region'] == context[p['id']]['region'] for p in points))
vx, vy, vw, vh = data['viewBox']
inside = lambda x,y: vx <= x <= vx+vw and vy <= y <= vy+vh
check('All projected points inside declared national view', all(inside(p['x'],p['y']) for p in points))
# Independently inspect emitted linear SVG vertices; the original standard canvas
# clipped western Aleutian islands even though every institutional point fitted.
path_checks = []
for state in data['states']:
    path = state['path']
    numbers = [float(n) for n in re.findall(r'-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?',path)]
    path_checks.append(set(re.findall(r'[A-Za-z]',path)) <= {'M','L','Z'} and len(numbers)%2==0 and bool(numbers) and all(inside(x,y) for x,y in zip(numbers[::2],numbers[1::2])))
check('Every emitted state-path vertex fits national view, including western Aleutians', all(path_checks))
check('Regional windows include every institution assigned to that region', all(all(r['viewBox'][0] <= p['x'] <= r['viewBox'][0]+r['viewBox'][2] and r['viewBox'][1] <= p['y'] <= r['viewBox'][1]+r['viewBox'][3] for p in points if p['region'] == r['id']) for r in data['regions']))
check('Region counts count schools, not offenses or people', all(r['schoolCount'] == sum(p['region'] == r['id'] for p in points) for r in data['regions']))
allowed = {'id','name','officialName','city','state','stateFips','region','longitude','latitude','x','y','source'}
check('Point records contain location/identity fields only', all(set(p) == allowed and p['source'] == 'nces-hd2024' for p in points))
source_index = {s['id']:s for s in data['sources']}
check('NCES coordinate provenance pins the exact retained ZIP', source_index['nces-hd2024']['archiveSha256'] == sha(RAW))
check('Census-derived topology provenance pins the packaged input', source_index['us-atlas']['sha256'] == sha(SOURCES/'states-10m.json'))
check('Navigation-only and non-offense scope explicit', 'do not locate crimes' in data['scope'] and 'not safety or data availability' in data['scope'])
source_audit = load(SOURCES/'MAP_DATA_AUDIT.json')
check('Separate source-generation record pins the final asset', source_audit['status'] == 'PASS' and source_audit['assetSha256'] == sha(MAP))
check('Alaska/Hawaii are national West insets without omitted cohort schools', all(next(s for s in data['states'] if s['abbr']==state)['region'] == 'West' for state in ['AK','HI']) and not any(p['state'] in ['AK','HI'] for p in points))
result = {'checked_utc':datetime.now(timezone.utc).isoformat(), 'status':'PASS' if all(c['pass'] for c in checks) else 'FAIL', 'scope':'Independent original-directory joins and geographic/source qualification checks; not a new location survey, projection-engine reimplementation or browser audit.', 'school_count':len(points), 'state_count':len(data['states']), 'checks':checks, 'map_sha256':sha(MAP), 'raw_hd2024_sha256':sha(RAW), 'topology_sha256':sha(SOURCES/'states-10m.json'), 'limitations':['Institutional directory locations are navigation points, not offense locations or Clery property boundaries.', '2017 cartographic boundaries and 2024 directory coordinates are versioned sources, not a 2026 location refresh.', 'Cluster labels count nearby schools; marker rendering and selection behavior require separate UI/browser checks.']}
(HERE/'MAP_NAVIGATION_AUDIT.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps({'status':result['status'],'schools':len(points),'states':len(data['states']),'checks':len(checks),'failed':[c['name'] for c in checks if not c['pass']]},indent=2))
raise SystemExit(result['status'] != 'PASS')
