"""Independent primary-input checks for the campus publication's factual claims.

No production model/builder imports. Needs xlrd==2.0.2 and frozen raw files.
This checks numerical/source-dependent claims, not final PDF layout or all prose.
"""
from pathlib import Path
import collections
import csv
import hashlib
import io
import json
import re
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
WORKSPACE = ROOT.parent
DATA = ROOT / 'publication/data'
CLERY = ROOT / 'sources/clery'
ENROLL = ROOT / 'sources/enrollment'
sys.path.insert(0, str(CLERY / '_deps'))
import xlrd

checks = collections.Counter()
errors = []
def check(group, actual, expected, detail):
    checks[group] += 1
    if actual != expected:
        errors.append({'group': group, 'detail': detail, 'actual': actual, 'expected': expected})
def read_json(p):
    return json.loads(p.read_text(encoding='utf-8'))
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def ident(v):
    return str(int(v)) if isinstance(v, (float, int)) else str(v).strip()

dataset = read_json(DATA / 'dataset.json')
ids = {r['id'] for r in dataset['institutions']}
categories = {r['id']: r for r in dataset['categories']}
check('cohort', len(ids), 42, 'Unique institutions')
check('cohort', len(categories), 15, 'Category views')
check('cohort', dataset['years'], [2022, 2023, 2024], 'Report-year window')
check('cohort', dataset['sourceCollection'], 2025, 'Frozen federal collection')
check('cohort', max(r['Year'] for r in read_json(CLERY / 'raw/fileList.json')), 2025, 'Latest acquired official catalog collection')
check('cohort', collections.Counter(i['group'] for i in dataset['institutions']), collections.Counter(uc=10, ivy=8, public=12, private=12), 'Fixed groups')
source_hashes = {'federal_archive': sha(CLERY / 'raw/Crime2025EXCEL.zip')}

# Original, unnormalized workbooks. Retain blank and FILTER distinctions.
books = {}
with zipfile.ZipFile(CLERY / 'raw/Crime2025EXCEL.zip') as z:
    for geography, stem in [('oncampus', 'Oncampus'), ('residential', 'Residencehall')]:
        for family, suffix in [('criminal_offenses', 'crime'), ('vawa', 'vawa')]:
            name = f'{stem}{suffix}222324.xls'
            member = next(n for n in z.namelist() if n.lower() == name.lower())
            b = z.read(member)
            source_hashes[member] = hashlib.sha256(b).hexdigest()
            s = xlrd.open_workbook(file_contents=b).sheet_by_index(0)
            header = [str(v).strip() for v in s.row_values(0)]
            rows = {}
            for j in range(1, s.nrows):
                r = dict(zip(header, s.row_values(j))); cid = ident(r['UNITID_P'])
                if cid[:-3] in ids:
                    assert cid not in rows
                    rows[cid] = r
            books[(geography, family)] = rows
check('cohort', len(books[('oncampus','criminal_offenses')]), 212, 'Original federal branch rows')

# Explicit current API declarations; no staff/contact metadata is published here.
apis = {}
for cid in books[('oncampus','criminal_offenses')]:
    path = CLERY / 'raw/api' / f'{cid}.json'
    r = read_json(path)['Header']['Campus']
    check('api_identity', ident(r['UnitID']), cid, 'API branch identity')
    apis[cid] = r
check('api_geography', sum(a.get('CountryIsUS') is False for a in apis.values()), 47, 'Outside-US branch declarations')

# Independently extract original annual IPEDS total-population cells.
populations = {}
for year in dataset['years']:
    path = ENROLL / 'raw' / f'EF{year}A.zip'
    source_hashes[path.name] = sha(path)
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n.lower().endswith('.csv')]
        member = next((n for n in names if '_rv.' in n.lower()), names[0])
        for r in csv.DictReader(io.StringIO(z.read(member).decode('utf-8-sig'))):
            r = {k.strip().upper(): v.strip() for k,v in r.items()}
            if r['UNITID'] in ids and r['EFALEVEL'] == '1':
                assert (r['UNITID'],year) not in populations
                populations[(r['UNITID'],year)] = int(r['EFTOTLT'])
check('enrollment', len(populations), 126, 'All annual total headcounts')
check('enrollment', populations[('122409', 2024)], 41137, 'SDSU fall 2024 IPEDS')

# Independent transcription of State Auditor A.1/A.2, printed pp. 56-59.
# Values are actual occupancy, in fall 2022/2023/2024 order, not capacity.
occupancy = {
 '110635':[9695,9905,10862], '110644':[13608,14081,15024],
 '110653':[16455,17675,17695], '110662':[22519,23680,24202],
 '445188':[4086,4179,4077], '110671':[8493,8428,8465],
 '110680':[17906,18906,21907], '110699':[738,754,832],
 '110705':[10221,10128,10286], '110714':[9168,9313,8888],
 '122409':[7919,8100,8367],
}
source_hashes['auditor_pdf'] = sha(HERE / 'source_documents/ca_auditor_2024_111.pdf')
check('occupancy', len(occupancy), 11, 'Documented occupancy institutions')

coverage = {year: [] for year in dataset['years']}
scope_claims = []
for inst in dataset['institutions']:
    iid = inst['id']
    branches = {cid for cid in books[('oncampus','criminal_offenses')] if cid[:-3] == iid}
    check('branch_notes', inst['branchCount'], len(branches), iid)
    check('branch_notes', {c['id'] for c in inst['campuses']}, branches, iid)
    foreign = sum(apis[c].get('CountryIsUS') is False for c in branches)
    for note in inst['notes']:
        match = re.search(r'identifies (\d+) reporting location', note)
        if match: check('branch_notes', int(match.group(1)), foreign, iid+' foreign note')
        if 'medical facility' in note:
            evidence = [str(apis[c].get('Name')) for c in branches if re.search(r'medical|hospital|health', str(apis[c].get('Name')), re.I)]
            check('branch_notes', bool(evidence), True, iid+' medical-location note')
            scope_claims.append({'unitid':iid, 'medical_location_names':evidence})
    for row in inst['years']:
        year = row['year']
        check('enrollment', row['enrollment'], populations[(iid,year)], (iid,year))
        expect_res = occupancy[iid][year-2022] if iid in occupancy else None
        check('occupancy', row['residents'], expect_res, (iid,year))
        for geo in ['oncampus','residential']:
            expected = {}
            for key, category in categories.items():
                if key == 'criminal_total': continue
                book = books[(geo, category['family'])]
                field = category['code'] + str(year)[-2:]
                pieces = []
                for cid in branches:
                    r = book[cid]
                    flag = r['FILTER'+str(year)[-2:]]
                    raw = r[field]
                    if flag != 1:
                        pieces.append(None)
                    elif isinstance(raw,(int,float)) and raw >= 0 and raw == int(raw):
                        pieces.append(int(raw))
                    elif (geo == 'residential' and year == 2024 and apis[cid].get('SurveyYear') == 2024
                          and 'does not provide On-campus Student Housing Facilities' in apis[cid].get('OnCampusHousingInfo','')):
                        # Exclude a corroborated absent geography; do not rewrite its blank raw cell.
                        pass
                    else:
                        pieces.append(None)
                expected[key] = None if None in pieces else sum(pieces)
                check('original_federal_aggregate', row['counts'][geo][key], expected[key], (iid,year,geo,key))
            primary = [expected[k] for k,v in categories.items() if v['family']=='criminal_offenses' and k!='criminal_total']
            total = None if None in primary else sum(primary)
            check('category_total', row['counts'][geo]['criminal_total'], total, (iid,year,geo))
        if row['counts']['oncampus']['criminal_total'] is not None:
            coverage[year].append(iid)
check('coverage', len(coverage[2024]), 42, '2024 complete on-campus totals')
check('coverage', len(coverage[2023]), 38, '2023 complete on-campus totals')
check('coverage', len(coverage[2022]), 36, '2022 complete on-campus totals')
check('coverage', len(ids - set.intersection(*(set(v) for v in coverage.values()))), 6, 'Institutions without complete pooled on-campus totals')

# Main-campus ASR case study uses independently verified ASR cells, not federal substitutions.
asr = {(r['institution'],int(r['report_year'])):int(r['housing']) for r in csv.DictReader((HERE/'verified_asr_rape_counts.csv').open(encoding='utf-8'))}
case = read_json(DATA / 'case_study.json')
for row in case:
    years = [2022,2023,2024] if row['period']=='pooled' else [row['period']]
    count = sum(asr[(row['institution'],y)] for y in years)
    pop = sum(occupancy[row['unitid']][y-2022] for y in years)
    check('case_study', row['asr_housing_rape_count'], count, (row['unitid'],row['period'],'count'))
    check('case_study', row['fall_occupancy_sum'], pop, (row['unitid'],row['period'],'population'))
    check('case_study', row['rate_per_1000'], 1000*count/pop, (row['unitid'],row['period'],'rate'))

reviewed = [DATA/'dataset.json', DATA/'case_study.json', DATA/'annual_rates.csv', DATA/'pooled_rates.csv',
 WORKSPACE/'boomerrawlings.com/src/pages/writing/data-analysis/campus-safety.astro',
 WORKSPACE/'boomerrawlings.com/src/content/archive/campus-safety.md',
 WORKSPACE/'boomerrawlings.com/src/components/CampusExplorer.astro',
 WORKSPACE/'boomerrawlings.com/src/lib/campus-rates.js']
result = {
 'status':'PASS' if not errors else 'FAIL', 'review_date':'2026-09-25',
 'scope':'Source-value checks for public claims. Original federal workbooks and annual IPEDS files independently read; housing occupancy independently transcribed. No production builder imported. Does not replace final prose/PDF audit.',
 'check_counts':dict(checks), 'total_checks':sum(checks.values()), 'errors':errors,
 'coverage': {str(k):len(v) for k,v in coverage.items()},
 'incomplete_pooled_institutions': sorted(ids-set.intersection(*(set(v) for v in coverage.values()))),
 'medical_note_evidence':scope_claims,
 'reviewed_file_hashes':{str(p.relative_to(WORKSPACE)).replace('\\','/'):sha(p) for p in reviewed},
 'primary_input_hashes':source_hashes,
 'case_study':case,
}
(HERE/'CITATION_VALUE_VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':result['status'],'checks':result['total_checks'],'by_group':dict(checks),'errors':errors[:20]},indent=2))
if errors: raise SystemExit(1)
