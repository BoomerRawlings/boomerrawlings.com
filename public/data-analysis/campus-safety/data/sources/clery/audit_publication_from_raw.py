"""Independent raw-ZIP audit of source counts and published descriptive rates.

Does not import the normalizer, applicability builder, study builder, or UI code.
Reads original national XLS bytes with xlrd. Population inputs are independently
acquired aggregate extracts; this audit checks their use, not their extraction.
"""
from pathlib import Path
from collections import defaultdict, Counter
import csv
import hashlib
import json
import math
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE / '_deps'))
import xlrd

def read(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def optional(value):
    return None if value in ('', None) else int(value)

errors = []
checks = Counter()
def check(condition, label, detail=None):
    checks[label] += 1
    if not condition:
        errors.append({'check': label, 'detail': detail})

dataset_path = ROOT / 'publication/data/dataset.json'
initial_hash = sha(dataset_path)
data = json.loads(dataset_path.read_text(encoding='utf-8'))
manifest = json.loads((HERE / 'cohort_manifest.json').read_text(encoding='utf-8'))
units = {r['unitid'] for r in manifest['institutions']}
check(len(units) == 42, 'fixed_cohort_count')
check({r['id'] for r in data['institutions']} == units, 'dataset_cohort_matches_protocol')
categories = {
    'murder': ('MURD', 'criminal_offenses'),
    'negligent_manslaughter': ('NEG_M', 'criminal_offenses'),
    'rape': ('RAPE', 'criminal_offenses'),
    'fondling': ('FONDL', 'criminal_offenses'),
    'incest': ('INCES', 'criminal_offenses'),
    'statutory_rape': ('STATR', 'criminal_offenses'),
    'robbery': ('ROBBE', 'criminal_offenses'),
    'aggravated_assault': ('AGG_A', 'criminal_offenses'),
    'burglary': ('BURGLA', 'criminal_offenses'),
    'motor_vehicle_theft': ('VEHIC', 'criminal_offenses'),
    'arson': ('ARSON', 'criminal_offenses'),
    'domestic_violence': ('DOMEST', 'vawa'),
    'dating_violence': ('DATING', 'vawa'),
    'stalking': ('STALK', 'vawa'),
}
check(len(data['categories']) == 15, 'category_count')
for category in data['categories']:
    expected = ('SUM_11', 'criminal_offenses') if category['id'] == 'criminal_total' else categories.get(category['id'])
    check((category['code'], category['family']) == expected, 'category_code_and_family', category['id'])

context = json.loads((HERE / 'normalized/cohort_campus_context_current.json').read_text(encoding='utf-8'))
ctx = {str(r['UnitID']): r for r in context}
check(len(ctx) == 212, 'unique_context_campuses')
private_context_verified = 0
for campus_id, row in ctx.items():
    check('Description' not in row, 'no_free_text_contact_description', campus_id)
    check(not any(k in row for k in ['Contact', 'Contacts', 'Phone', 'Email']), 'no_contact_section', campus_id)
    original = HERE / 'raw/api' / (campus_id + '.json')
    if original.exists():
        check(sha(original) == row['source_sha256'], 'original_context_response_hash', campus_id)
        raw = json.loads(original.read_text(encoding='utf-8'))['Header']['Campus']
        for key in ['UnitID', 'CountryIsUS', 'Country', 'SurveyYear', 'OnCampusHousingInfo']:
            check(raw.get(key) == row.get(key), 'context_critical_field_matches_original', [campus_id, key])
        private_context_verified += 1

source_rows = {}
campus_sets = {}
archive_path = HERE / 'raw/Crime2025EXCEL.zip'
check(sha(archive_path) == '28143ab29f9f9d43235800a3f1f4061b8f2928a7d11bce0e8327d2889ab6f007', 'frozen_national_archive_hash')
with zipfile.ZipFile(archive_path) as archive:
    for prefix, geo in [('Oncampus', 'oncampus'), ('Residencehall', 'residential')]:
        for suffix, family in [('crime', 'criminal_offenses'), ('vawa', 'vawa')]:
            name = prefix + suffix + '222324.xls'
            sheet = xlrd.open_workbook(file_contents=archive.read(name)).sheet_by_index(0)
            headers = sheet.row_values(0)
            selected = set()
            for index in range(1, sheet.nrows):
                row = dict(zip(headers, sheet.row_values(index)))
                campus = str(int(row['UNITID_P']))
                unit = campus[:-3]
                if unit not in units:
                    continue
                check(campus not in selected, 'unique_raw_campus_row', [name, campus])
                selected.add(campus)
                for year in [2022, 2023, 2024]:
                    yy = str(year)[-2:]
                    flag = optional(row['FILTER' + yy])
                    for key, (code, category_family) in categories.items():
                        if category_family != family:
                            continue
                        raw = optional(row[code + yy])
                        check(raw is None or raw >= 0, 'nonnegative_raw_integer', [campus, year, code])
                        source_rows[campus, year, geo, key] = (raw, flag)
            check(len(selected) == 212, 'source_table_campus_count', name)
            campus_sets[name] = selected
check(all(s == set(ctx) for s in campus_sets.values()), 'exact_campus_sets_all_four_source_tables')
branches = defaultdict(list)
for campus in sorted(ctx):
    branches[campus[:-3]].append(campus)

expected_counts = {}
geography_classes = Counter()
for unit in sorted(units):
    for year in [2022, 2023, 2024]:
        for geo in ['oncampus', 'residential']:
            for category in categories:
                values = []
                unknown = False
                for campus in branches[unit]:
                    raw, flag = source_rows[campus, year, geo, category]
                    if flag == 1 and raw is not None:
                        values.append(raw)
                    elif year == 2024 and geo == 'residential' and flag == 1 and raw is None and ctx[campus]['SurveyYear'] == 2024 and ctx[campus]['OnCampusHousingInfo'] == 'This institution does not provide On-campus Student Housing Facilities.':
                        # Absence of geography: leave the raw cell missing; do not
                        # append a manufactured observed zero to the source data.
                        if category == 'rape':
                            geography_classes['excluded_no_housing_2024'] += 1
                    else:
                        unknown = True
                expected_counts[unit, year, geo, category] = None if unknown else sum(values)
            criminal = [expected_counts[unit, year, geo, cat] for cat, (code, family) in categories.items() if family == 'criminal_offenses']
            check(len(criminal) == 11, 'combined_has_exactly_11_criminal_categories')
            expected_counts[unit, year, geo, 'criminal_total'] = sum(criminal) if all(v is not None for v in criminal) else None

enrollment = {(r['unitid'], int(r['year'])): r for r in read(ROOT / 'sources/enrollment/enrollment_2022_2024.csv')}
occupancy = {(r['unitid'], int(r['year'])): r for r in read(ROOT / 'sources/enrollment/occupancy_2022_2024.csv')}
populations = {}
for unit in units:
    for year in [2022, 2023, 2024]:
        populations[unit, year, 'enrollment'] = int(enrollment[unit, year]['fall_headcount_total'])
        populations[unit, year, 'residents'] = int(occupancy[unit, year]['actual_student_housing_occupancy']) if (unit, year) in occupancy else None

for inst in data['institutions']:
    unit = inst['id']
    check({r['id'] for r in inst['campuses']} == set(branches[unit]), 'dataset_exact_branch_inventory', unit)
    check(inst['branchCount'] == len(branches[unit]), 'dataset_branch_count', unit)
    check(sorted(r['year'] for r in inst['years']) == [2022, 2023, 2024], 'dataset_exact_report_years', unit)
    for row in inst['years']:
        year = row['year']
        for pop in ['enrollment', 'residents']:
            check(row[pop] == populations[unit, year, pop], 'dataset_population_matches_source_extract', [unit, year, pop])
        for geo in ['oncampus', 'residential']:
            check(set(row['counts'][geo]) == set(categories) | {'criminal_total'}, 'dataset_exact_category_inventory')
            for category in list(categories) + ['criminal_total']:
                expected = expected_counts[unit, year, geo, category]
                actual = row['counts'][geo][category]
                check(actual == expected, 'dataset_count_direct_from_raw', [unit, year, geo, category, expected, actual])

measures = {'enrollment': ('oncampus', 'enrollment'), 'housingEnrollment': ('residential', 'enrollment'), 'residents': ('residential', 'residents')}
for filename, pooled in [('annual_rates.csv', False), ('pooled_rates.csv', True)]:
    records = read(ROOT / 'publication/data' / filename)
    check(len(records) == (1890 if pooled else 5670), 'rate_csv_row_count', filename)
    seen = set()
    for row in records:
        unit, category, measure = row['unitid'], row['category'], row['measure']
        period = row['period']
        key = (unit, category, measure, period)
        check(key not in seen, 'unique_rate_csv_key', key)
        seen.add(key)
        years = [2022, 2023, 2024] if pooled else [int(period)]
        geo, population = measures[measure]
        vv = [expected_counts[unit, y, geo, category] for y in years]
        pp = [populations[unit, y, population] for y in years]
        count = sum(vv) if all(v is not None for v in vv) else None
        denominator = sum(pp) if all(p is not None for p in pp) else None
        rate = 1000 * count / denominator if count is not None and denominator is not None and denominator > 0 else None
        check(optional(row['reported_count']) == count, 'csv_count_direct_from_raw', key)
        check(optional(row['population_sum']) == denominator, 'csv_population_sum', key)
        actual = None if row['rate_per_1000'] == '' else float(row['rate_per_1000'])
        check(actual is None if rate is None else actual is not None and math.isclose(actual, rate, rel_tol=1e-13, abs_tol=1e-13), 'csv_rate_arithmetic', key)
        check(row['geography'] == geo and row['denominator_basis'] == population, 'csv_numerator_denominator_pair', key)
        check(int(row['years']) == len(years), 'csv_period_duration', key)

check(initial_hash == sha(dataset_path), 'dataset_unchanged_during_audit')
report = {
    'status': 'PASS' if not errors else 'FAIL',
    'method': 'Independent original ZIP/XLS read. No production normalization, applicability, study-build or UI module imported.',
    'source_archive_sha256': sha(archive_path),
    'dataset_sha256': initial_hash,
    'original_source_campus_cells_examined': len(source_rows),
    'published_count_cells_checked': checks['dataset_count_direct_from_raw'],
    'annual_and_pooled_rows_checked': checks['csv_rate_arithmetic'],
    'original_api_response_hashes_verified_locally': private_context_verified,
    'frozen_sanitized_context_sha256': sha(HERE / 'normalized/cohort_campus_context_current.json'),
    'corroborated_absent_housing_branches_2024': geography_classes['excluded_no_housing_2024'],
    'checks': dict(checks),
    'errors': errors,
    'limits': ['Verifies the population extracts are used correctly; independent IPEDS/occupancy source extraction is audited separately.', 'A successful arithmetic check does not establish reporting completeness, unique victims, or resident-property boundary equivalence.', 'When full API responses are absent from a portable copy, the supplied sanitized context is the frozen input; locally retained originals permit the additional source-hash check.'],
}
(HERE / 'publication_raw_audit.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
if errors:
    raise SystemExit(1)
