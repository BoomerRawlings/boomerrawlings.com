"""Read-only reconstruction of exact warrant flags; PRIVATE event masks stay local."""
from pathlib import Path
from collections import Counter, defaultdict
import csv, hashlib, json, os, re

HERE = Path(__file__).resolve().parent
BASE = HERE.parents[1]
OUT = BASE / 'outputs' / 'cbs8_dv_heat'
SRC = Path(os.environ.get('DV_SOURCE_DIR', str(Path.home() / 'Downloads')))
FILES = {
    '2018_2023': 'Arrests_Jul_2018-Dec_2023_for_Release(Arrests & Citations).csv',
    '2024': 'Arrests_2024_for_Release(Sheet1).csv',
    '2025': 'Arrests_2025_for_Release(NetRMS Arrests 2025).csv',
}
PC = {'978.5', '827.1', '1551A'}
ZZ = {'OUTWARRANT', 'OW-F', 'OW-M', 'BW-F', 'BW-M'}

def read(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

def truth(value):
    return str(value).lower() in {'true', '1', '1.0', 'yes'}

def norm(code):
    return re.sub(r'[()\s]', '', code.upper())

def explicit_warrant(kind, code):
    return (kind == 'PC' and norm(code) in PC) or (kind == 'ZZ' and norm(code) in ZZ)

def write(name, rows, fields=None):
    with (HERE / name).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=fields or list(rows[0]))
        w.writeheader(); w.writerows(rows)

groups = {r['event_key']: r for r in read(OUT / 'all_source_id_groups.csv')}
flags = {key: {'explicit_warrant_charge': False, 'warrant_subtype': False,
               'detention_or_court': False, 'pc1551_1_without_warrant_charge': False,
               'charges': set()} for key in groups}
manifest = []
agency_counts = {}
charge_counts = defaultdict(Counter)
for export, name in FILES.items():
    path = SRC / name
    rows = read(path)
    headers = list(rows[0])
    agency = Counter()
    for raw in rows:
        row = {k.strip(): v for k, v in raw.items()}
        id_header = 'Arrest Ref Nbr' if 'Arrest Ref Nbr' in row else 'Incident Number'
        key = export + ':' + row[id_header]
        if key not in groups or row['Incident Type'] != 'ARREST':
            continue
        agency[row.get('Agency', '<field absent>')] += 1
        f = flags[key]
        kind, code, desc = row['Violation Type'].strip().upper(), row['Violation Section'], row['Violation Description']
        match = explicit_warrant(kind, code)
        f['explicit_warrant_charge'] |= match
        f['warrant_subtype'] |= 'WARRANT' in row['Incident Sub Type'].upper()
        f['detention_or_court'] |= any(s in (row['Command'] + ' ' + row.get('Area', row.get("Sheriff's Area", ''))).upper() for s in ['DETENTION', 'COURT'])
        f['pc1551_1_without_warrant_charge'] |= kind == 'PC' and norm(code) == '1551.1'
        if match:
            c = (kind, code, desc)
            f['charges'].add(c)
            charge_counts[c]['raw_charge_rows'] += 1
    agency_counts[export] = dict(agency)
    manifest.append({'source_export': export, 'filename': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                     'raw_rows': len(rows), 'exact_headers': headers,
                     'id_header': 'Arrest Ref Nbr' if 'Arrest Ref Nbr' in headers else 'Incident Number',
                     'date_header': next(h for h in headers if h.strip() in {'Incident Date_Time', 'Arrest Date/Time'})})

# Weather panel is the authoritative mapped exposure universe, including all-zero cells.
zips = set()
with (BASE / 'weather' / 'daily_zip_weather.csv').open(encoding='utf-8-sig', newline='') as f:
    for r in csv.DictReader(f): zips.add(r['zip_code'])
assert len(zips) == 112

mask = []
counts = Counter()
year_counts = defaultdict(Counter)
daily = defaultdict(Counter)
for key, g in groups.items():
    f = flags[key]
    assert f['warrant_subtype'] == truth(g['any_warrant']), 'Original subtype flag mismatch'
    date = g['recorded_date']
    period = '2021-01-01' <= date <= '2024-12-31'
    mapped = (truth(g['weather_eligible_base']) and not f['detention_or_court'] and
              g['Incident Sub Type'] == 'ADULT' and g['zip_normalized'] in zips and
              '2018-07-01' <= date <= '2025-12-31')
    primary = mapped and period
    core = truth(g['core_dv'])
    strict_exclude = f['explicit_warrant_charge'] or f['warrant_subtype']
    for c in f['charges']:
        charge_counts[c]['all_source_ids'] += 1
        charge_counts[c]['core_source_ids'] += core
        charge_counts[c]['primary_eligible_all_ids'] += primary
        charge_counts[c]['primary_eligible_core_ids'] += primary and core
    row = {'event_key': key, 'explicit_warrant_charge': int(f['explicit_warrant_charge']),
           'warrant_subtype': int(f['warrant_subtype']), 'strict_warrant_exclusion': int(strict_exclude),
           'detention_or_court': int(f['detention_or_court']),
           'pc1551_1_without_warrant_charge': int(f['pc1551_1_without_warrant_charge']),
           'core_dv': int(core), 'original_model_eligible_mapped': int(mapped),
           'primary_2021_2024_eligible': int(primary),
           'strict_primary_eligible': int(primary and not strict_exclude)}
    mask.append(row)
    counts['all_source_ids'] += 1
    counts['explicit_warrant_charge_ids'] += f['explicit_warrant_charge']
    counts['strict_warrant_exclusion_ids'] += strict_exclude
    if primary:
        assert not f['warrant_subtype']
        for label, yes in [('original_all', True), ('original_core', core),
                           ('excluded_all', strict_exclude), ('excluded_core', strict_exclude and core),
                           ('strict_all', not strict_exclude), ('strict_core', core and not strict_exclude),
                           ('pc1551_1_counterexample_all', f['pc1551_1_without_warrant_charge']),
                           ('pc1551_1_counterexample_core', f['pc1551_1_without_warrant_charge'] and core)]:
            counts[label] += yes
            year_counts[date[:4]][label] += yes
        d = daily[(g['zip_normalized'], date)]
        d['original_all'] += 1; d['original_core'] += core
        d['excluded_all'] += strict_exclude; d['excluded_core'] += strict_exclude and core
        d['strict_all'] += not strict_exclude; d['strict_core'] += core and not strict_exclude

assert counts['original_all'] == 58770 and counts['original_core'] == 6637
assert counts['excluded_core'] == 67
assert counts['strict_all'] + counts['excluded_all'] == counts['original_all']
assert counts['strict_core'] + counts['excluded_core'] == counts['original_core']
assert explicit_warrant('PC','1551(A)') and not explicit_warrant('PC','1551.1')
assert explicit_warrant('ZZ','OUT WARRANT') and not explicit_warrant('HS','978.5')
checked_cells = 0
with (OUT / 'daily_zip_analysis_panel.csv').open(encoding='utf-8-sig', newline='') as f:
    for r in csv.DictReader(f):
        if '2021-01-01' <= r['date'] <= '2024-12-31':
            n = daily.get((r['zip_code'], r['date']), Counter())
            assert n['original_all'] == int(r['eligible_all_count'])
            assert n['original_core'] == int(r['core_count'])
            checked_cells += 1
assert checked_cells == 112 * 1461

write('PRIVATE_event_warrant_flags.csv', mask)
charge_audit = [{'violation_type': c[0], 'violation_section': c[1], 'violation_description': c[2],
                 **{k: n[k] for k in ['raw_charge_rows','all_source_ids','core_source_ids','primary_eligible_all_ids','primary_eligible_core_ids']}}
                for c,n in sorted(charge_counts.items())]
write('warrant_charge_audit.csv', charge_audit)
write('warrant_primary_by_year.csv', [{'year': y, **dict(n)} for y,n in sorted(year_counts.items())])
write('warrant_primary_zip_daily_sparse.csv', [{'zip_code': z, 'date': d, **dict(n)} for (z,d),n in sorted(daily.items())])
summary = {'primary_period':'2021-2024','counts':dict(counts), 'exact_code_rule':{'PC':sorted(PC),'ZZ':sorted(ZZ)},
           'daily_reconciliation':{'checked_zip_days':checked_cells,'original_all_and_core_cells_match':True},
           'normalization':'uppercase; remove spaces/parentheses only, retain decimals/hyphens',
           'exclusion':'Any listed warrant co-charge or any warrant subtype on any line belonging to a source-scoped ID; preserves original files and baseline results.',
           'not_excluded_on_code_alone':'PC1551.1 (arrest without warrant); no free-text WARRANT substring rule.',
           'privacy':'PRIVATE_event_warrant_flags.csv contains event keys. Do not publish or include in public downloads. Sparse ZIP/date table is aggregate.',
           'zero_days':'Sparse counts require left-join onto the existing full112ZIP×1461day primary calendar and zero fill, not row deletion.',
           'agency_field_values_charge_rows':agency_counts,'sources':manifest}
(HERE / 'warrant_mask_summary.json').write_text(json.dumps(summary, indent=2),encoding='utf-8')
print(json.dumps(dict(counts),indent=2))
