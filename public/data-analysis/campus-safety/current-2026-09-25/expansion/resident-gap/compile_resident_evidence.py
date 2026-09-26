"""Compile qualified housing observations without changing rate denominators."""
from pathlib import Path
import argparse, hashlib, json, re

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--interface', type=Path)
args = parser.parse_args()
observations, inputs = [], []
fields = ['unitid','years','period_label','value','status','statement','reason_no_rate',
          'source_url','source_title','source_page','source_sha256']
for name in ['root_observations.json','public_observations.json','ivy_observations.json']:
    path = HERE / name
    source = json.loads(path.read_text(encoding='utf-8'))
    inputs.append({'path': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'rows': len(source)})
    for row in source:
        record = {key: row[key] for key in fields}
        record['id'] = row.get('id', row.get('observation_id'))
        record['unitid'] = str(record['unitid'])
        assert record['id'] and record['years'] and set(record['years']) <= {2022,2023,2024,2025}
        assert record['status'] in {'partial','approximate','unresolved'}
        assert record['value'] is None or isinstance(record['value'],(int,float)) and record['value'] > 0
        assert record['source_url'].startswith('https://') and re.fullmatch('[a-f0-9]{64}',record['source_sha256'])
        assert row.get('eligible_for_rate', False) is False
        record['eligible_for_rate'] = False
        observations.append(record)
assert len({r['id'] for r in observations}) == len(observations)
observations.sort(key=lambda r:(r['unitid'], min(r['years']), r['id']))
result = {'checked':'2026-09-26',
          'scope':'Qualified source observations. Display years indicate relevant calendar or academic/fiscal spans, not acceptance as fall denominators. These observations never feed the rate calculations. A missing observation does not establish absence of public data.',
          'inputs':inputs, 'observations':observations}
serialized = json.dumps(result,ensure_ascii=False,indent=2)+'\n'
args.output.mkdir(parents=True,exist_ok=True)
(args.output/'resident_evidence.json').write_text(serialized,encoding='utf-8',newline='\n')
if args.interface:
    args.interface.write_text(serialized,encoding='utf-8',newline='\n')
print(json.dumps({'observations':len(observations),'institutions':len({r['unitid'] for r in observations}),'denominators_adopted':0}))
