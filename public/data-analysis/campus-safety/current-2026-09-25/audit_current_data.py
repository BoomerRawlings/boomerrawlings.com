"""Independent offline audit of the current-source calculation products.

Does not import or execute build_current.py. Reconstructs totals directly from
source_cells.csv and populations from the separately preserved federal dataset.
Source transcription is covered by the separate UC/public/private audits.
"""
import collections
import argparse
import csv
import hashlib
import itertools
import json
import math
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PACKAGED = (HERE / 'inputs/frozen_dataset.json').exists()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--data', type=Path, default=HERE if PACKAGED else ROOT / 'publication/current-2026-09-25')
parser.add_argument('--frozen', type=Path, default=HERE / 'inputs/frozen_dataset.json' if PACKAGED else ROOT.parent / 'boomerrawlings.com/public/data-analysis/campus-safety/data/dataset.json')
parser.add_argument('--report', type=Path, default=HERE / ('replay/CURRENT_DATA_AUDIT.json' if PACKAGED else 'CURRENT_DATA_AUDIT.json'))
args = parser.parse_args()
OUT, FROZEN = args.data, args.frozen
GEOS = ('residential', 'oncampus', 'noncampus', 'publicproperty')
UI = dict(zip(GEOS, ('housing', 'on_campus', 'noncampus', 'public_property')))
CRIMES = ('murder', 'negligent_manslaughter', 'rape', 'fondling', 'incest',
          'statutory_rape', 'robbery', 'aggravated_assault', 'burglary',
          'motor_vehicle_theft', 'arson')
CORE = CRIMES + ('domestic_violence', 'dating_violence', 'stalking')
CATEGORIES = CORE + ('criminal_total',)
YEARS = (2022, 2023, 2024, 2025)
APPROVED = {'reported_numeric', 'reported_zero_narrative'}
STRUCTURAL = {'not_applicable_no_geography', 'not_applicable_before_opening',
              'not_applicable_before_separate_reporting'}
UNSAFE_RAW = {'unresolved_source_marker', 'column_not_reported',
              'not_reported_geography', 'missing_source_year',
              'ambiguous_year_labels', 'missing_branch_table',
              'combined_domestic_and_dating_violence', 'source_total_conflict'}
errors = []
checks = collections.Counter()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding='utf8'))


def number(value):
    return None if value is None or value == '' else float(value)


def equal(actual, expected, kind, key):
    checks[kind] += 1
    a, e = number(actual), number(expected)
    ok = (a is None and e is None) or (
        a is not None and e is not None and math.isclose(a, e, rel_tol=1e-12, abs_tol=1e-12))
    if not ok:
        errors.append({'check': kind, 'key': key, 'actual': actual, 'expected': expected})


def require(condition, kind, key, detail=''):
    checks[kind] += 1
    if not condition:
        errors.append({'check': kind, 'key': key, 'detail': detail})


def strict_sum(values):
    values = list(values)
    return sum(values) if values and None not in values else None


data = read_json(OUT / 'dataset.json')
frozen = read_json(FROZEN)
source = list(csv.DictReader((OUT / 'source_cells.csv').open(encoding='utf8', newline='')))
rates = list(csv.DictReader((OUT / 'rates.csv').open(encoding='utf8', newline='')))
geo = read_json(OUT / 'geography.json')['cells']
cases = read_json(OUT / 'case_study.json')
build_inputs = read_json(OUT / 'build_inputs.json')
coverage = read_json(OUT / 'coverage.json')
rules_path = HERE / 'private/structural_geography_rules.json'
rules = read_json(rules_path)
rules_audit = read_json(HERE / 'private/STRUCTURAL_RULES_AUDIT.json')
require(rules_audit['status'] == 'PASS' and rules_audit['rules_sha256'] == sha(rules_path),
        'structural_source_review_current', 'private')
rules_index = {(r['campus_id'], y, r['geography']): r for r in rules for y in r['years']}
institutions = {x['id']: x for x in data['institutions']}
frozen_inst = {x['id']: x for x in frozen['institutions']}
require(len(institutions) == 42 and set(institutions) == set(frozen_inst),
        'institution_cohort', 'all')
require(set(c['id'] for c in data['categories']) == set(CATEGORIES), 'category_scope', 'all')
require(build_inputs['frozen_sha256'] == sha(FROZEN), 'frozen_provenance', 'dataset')
require(build_inputs.get('structural_rules_sha256') == sha(rules_path),
        'structural_rule_build_provenance', 'private')
require(sha(FROZEN) == '5a4ac282c79e3e0a6d6fec478b24b6bae1c47d8350863d582314de39a01ef998',
        'original_federal_dataset_unchanged', 'dataset')

original_rows = {}
for inp in build_inputs['inputs']:
    p = HERE / inp['path']
    if not p.exists() and inp['path'].startswith('inputs/sdsu/'):
        p = ROOT / 'research/sdsu_2026' / Path(inp['path']).name
    require(p.exists() and sha(p) == inp['sha256'], 'input_snapshot_current', inp['path'])
    if p.exists() and p.suffix == '.csv':
        for r in csv.DictReader(p.open(encoding='utf-8-sig', newline='')):
            if r['category'] not in CORE:
                continue
            if inp['path'].endswith('prior_asr_all_counts.csv') and r['report_year'] != '2022':
                continue
            key = (inp['path'], r['institution_unitid'], r['campus_id'], int(r['report_year']), r['category'], r['geography'])
            require(key not in original_rows, 'unique_original_input_key', key)
            original_rows[key] = r

# Review the distinction between a literal observed zero, a structural absence,
# and an unknown/ambiguous cell before doing arithmetic.
index = {}
branches = collections.defaultdict(dict)
status_counts = collections.Counter()
for r in source:
    key = (r['institution_unitid'], r['campus_id'], int(r['report_year']), r['category'], r['geography'])
    original_key = (r['input_file'], *key)
    original = original_rows.get(original_key)
    require(original is not None, 'source_row_has_original', key)
    if original:
        for field, value in original.items():
            require(r.get(field, '') == value, 'original_source_field_retention', (*key, field))
    require(key not in index, 'unique_source_key', key)
    index[key] = r
    branches[key[0]][key[1]] = r['campus']
    raw, reported, approved = (number(r[k]) for k in ('count', 'reported_count', 'analysis_count'))
    status_counts[r['analysis_status']] += 1
    equal(reported, raw, 'literal_count_retention', key)
    if r['analysis_status'] in APPROVED:
        equal(approved, raw, 'approved_count_retention', key)
        require(raw is not None and raw >= 0 and raw.is_integer(), 'nonnegative_integer', key)
        require(r['status'] in APPROVED, 'approved_source_status', key, r['status'])
    else:
        equal(approved, None, 'unusable_cell_not_numeric', key)
    if r['status'] in UNSAFE_RAW:
        require(r['analysis_status'] not in APPROVED, 'raw_ambiguity_not_approved', key)
    if r['status'] == 'reported_zero_narrative':
        equal(raw, 0, 'zero_narrative_literal', key)
    if r['analysis_status'] in STRUCTURAL:
        require(approved is None, 'structural_not_observed_zero', key)
    if r['institution_unitid'] == '234076':
        require(r['analysis_status'] == 'unverified_source', 'uva_exclusion', key)
    require(r['category'] in CORE and r['geography'] in GEOS, 'source_category_geography', key)
    # UVA is deliberately excluded from calculations; its web-reader transcript
    # has an excerpt hash, explicitly not the unavailable original PDF hash.
    provenance_hash = (r.get('source_excerpt_sha256') if r['analysis_status'] == 'unverified_source'
                       else r.get('source_sha256'))
    require(bool(r.get('source_url')) and bool(provenance_hash),
            'cell_source_provenance', key)
    if r['status'] == 'reported_not_applicable' and r['analysis_status'] in STRUCTURAL:
        rule = rules_index.get((r['campus_id'], int(r['report_year']), r['geography']))
        require(rule is not None and rule['status'] == r['analysis_status'],
                'private_structural_whitelist', key)
    if r['institution_unitid'] in {'182670', '110662'} and r['category'] in {'domestic_violence', 'dating_violence'}:
        require(r['analysis_status'] == 'ambiguous_source', 'combined_category_exclusion', key)
require(len(original_rows) == len(source), 'all_selected_source_rows_retained', 'all')

# This crosswalk had been wrong in the production input; its correction is
# identity-only and does not alter institution counts.
if '145637' in branches:
    require(set(branches['145637']) == {'145637001', '145637003'},
            'illinois_campus_identity', '145637', str(branches['145637']))


def contribution(r):
    if r is None:
        return None
    if r['analysis_status'] in STRUCTURAL:
        return 0
    if r['analysis_status'] in APPROVED:
        return number(r['count'])
    return None


# Separate ledger of institution/year/category/location values, calculated
# without consulting production dataset counts or exported rates.
totals = {}
populations = {}
for uid, inst in institutions.items():
    raw_branches = branches[uid]
    active = [bid for bid, name in raw_branches.items() if name != 'UF Jacksonville']
    old_years = {y['year']: y for y in frozen_inst[uid]['years']}
    present_years = {y['year']: y for y in inst['years']}
    require(set(present_years) == set(YEARS), 'year_scope', uid)
    for yr in YEARS:
        for pop in ('enrollment', 'residents', 'fte', 'distanceOnly'):
            expected_pop = old_years.get(yr, {}).get(pop)
            populations[uid, yr, pop] = expected_pop
            equal(present_years[yr][pop], expected_pop, 'same_year_frozen_population', (uid, yr, pop))
        for location in GEOS:
            for category in CORE:
                parts = [index.get((uid, bid, yr, category, location)) for bid in active]
                value = strict_sum(contribution(r) for r in parts)
                # An explicit missing Shenzhen campus makes the narrower current
                # Georgia Tech numerator unsuitable for institution denominators.
                if uid == '139755':
                    value = None
                totals[uid, yr, category, location] = value
            totals[uid, yr, 'criminal_total', location] = strict_sum(
                totals[uid, yr, cat, location] for cat in CRIMES)
            for category in CATEGORIES:
                equal(present_years[yr]['counts'][location][category],
                      totals[uid, yr, category, location], 'institution_count',
                      (uid, yr, category, location))

measure_scopes = {
    'residents': ('residential', 'residents'),
    'enrollment': ('oncampus', 'enrollment'),
    'housingEnrollment': ('residential', 'enrollment'),
}
expected_keys = set(itertools.product(institutions, map(str, (*YEARS, 'pooled')),
                                      CATEGORIES, measure_scopes))
rate_keys = set()
edition_by_period = {}
for uid in institutions:
    for period in map(str, (*YEARS, 'pooled')):
        chosen = (2022, 2023, 2024) if period == 'pooled' else (int(period),)
        edition_by_period[uid, period] = {s['report_edition'] for s in source
                                         if s['institution_unitid'] == uid and int(s['report_year']) in chosen}
for r in rates:
    key = r['unitid'], r['period'], r['category'], r['measure']
    require(key not in rate_keys, 'unique_rate_key', key)
    rate_keys.add(key)
    uid, period, cat, measure = key
    chosen = (2022, 2023, 2024) if period == 'pooled' else (int(period),)
    location, pop_key = measure_scopes[measure]
    require(r['geography'] == location, 'rate_numerator_geography', key)
    expected_count = strict_sum(totals[uid, y, cat, location] for y in chosen)
    pop = [populations[uid, y, pop_key] for y in chosen]
    expected_population = strict_sum(v if v is not None and v > 0 else None for v in pop)
    expected_rate = (1000 * expected_count / expected_population
                     if expected_count is not None and expected_population is not None else None)
    equal(r['reported_count'], expected_count, 'rate_numerator', key)
    equal(r['population_sum'], expected_population, 'rate_population', key)
    equal(r['rate_per_1000'], expected_rate, 'rate_value', key)
    equal(r['years'], len(chosen), 'rate_year_count', key)
    if period == '2025':
        equal(r['rate_per_1000'], None, 'no_2025_denominator_substitution', key)
    actual_editions = set(r['source_editions'].split(';')) - {''}
    expected_editions = edition_by_period[uid, period]
    require(actual_editions == expected_editions, 'rate_edition_disclosure', key)
require(rate_keys == expected_keys and len(rates) == 9450, 'complete_rate_grid', 'all')

# Check the user-facing geographic cells independently. Structural non-existence
# is displayed as N/A; it must not become a reported zero in a synthetic total.
geo_index = {}
for r in geo:
    key = r['unitid'], r['campus_id'], r['year'], r['category'], r['geography']
    require(key not in geo_index, 'unique_geography_key', key)
    geo_index[key] = r
    source_geo = next(k for k, v in UI.items() if v == r['geography'])
    if r['category'] != 'criminal_total':
        src = index[(r['unitid'], r['campus_id'], r['year'], r['category'], source_geo)]
        equal(r['count'], number(src['analysis_count']), 'display_source_count', key)
        require(r['status'] == src['analysis_status'], 'display_source_status', key)
    else:
        parts = [index.get((r['unitid'], r['campus_id'], r['year'], cat, source_geo)) for cat in CRIMES]
        all_structural = all(x is not None and x['analysis_status'] in STRUCTURAL for x in parts)
        expected = None if all_structural else strict_sum(contribution(x) for x in parts)
        equal(r['count'], expected, 'display_criminal_total', key)
        if all_structural:
            require(r['status'] in STRUCTURAL, 'display_na_total_not_zero', key)

housing_pairs = 0
negative_other_campus = []
for key, r in geo_index.items():
    if key[-1] != 'housing' or r['count'] is None:
        continue
    campus = geo_index.get((*key[:-1], 'on_campus'))
    if campus and campus['count'] is not None:
        housing_pairs += 1
        if r['count'] > campus['count']:
            negative_other_campus.append({'key': key, 'housing': r['count'], 'campus': campus['count']})
require(not negative_other_campus, 'housing_subset', 'all', str(negative_other_campus[:8]))

# Anchored manual source controls: these values were separately verified from
# the SDSU and UC San Diego source pages and the frozen Auditor populations.
case_controls = {
    '110680': {'branch': '110680001', 'counts': [12, 11, 20], 'population': [17906, 18906, 21907]},
    '122409': {'branch': '122409001', 'counts': [9, 8, 1], 'population': [7919, 8100, 8367]},
}
case_keys = set()
for r in cases:
    uid, period = r['unitid'], str(r['period'])
    key = uid, period
    require(key not in case_keys, 'unique_case_key', key)
    case_keys.add(key)
    ctrl = case_controls[uid]
    positions = range(3) if period == 'pooled' else [int(period) - 2022]
    expected_count = sum(ctrl['counts'][i] for i in positions)
    expected_pop = sum(ctrl['population'][i] for i in positions)
    equal(r['asr_housing_rape_count'], expected_count, 'case_numerator', key)
    equal(r['fall_occupancy_sum'], expected_pop, 'case_population', key)
    equal(r['rate_per_1000'], expected_count * 1000 / expected_pop, 'case_rate', key)
    require('incompletely matched' in r['scope'], 'case_scope_caveat', key)
require(len(case_keys) == 8, 'case_grid', 'all')

equal(coverage['source_cells'], len(source), 'coverage_source_count', 'all')
equal(coverage['ui_cells'], len(geo), 'coverage_display_count', 'all')
equal(coverage['rates'], len(rates), 'coverage_rate_count', 'all')
require(coverage['analysis_statuses'] == dict(status_counts), 'coverage_status_count', 'all')
for period, measures in coverage['available_rates'].items():
    for measure, value in measures.items():
        observed = sum(r['period'] == period and r['category'] == 'criminal_total'
                       and r['measure'] == measure and r['rate_per_1000'] != '' for r in rates)
        equal(value, observed, 'coverage_available_rate', (period, measure))

report = {
    'checked_utc': datetime.now(timezone.utc).isoformat(),
    'status': 'PASS' if not errors else 'FAIL',
    'method': 'Independent offline calculation; no import or execution of production builder. Source transcription is separately audited.',
    'source_cells': len(source), 'rate_rows': len(rates), 'display_cells': len(geo),
    'institutions_with_source_cells': sum(bool(x) for x in branches.values()), 'housing_campus_pairs': housing_pairs,
    'checks': dict(checks), 'errors': errors,
    'files': {name: sha(OUT / name) for name in ('source_cells.csv', 'dataset.json', 'rates.csv', 'geography.json', 'case_study.json', 'coverage.json', 'build_inputs.json', 'source_inventory.json')},
    'builder_sha256': sha(HERE / 'build_current.py'),
    'auditor_sha256': sha(Path(__file__)),
    'frozen_sha256': sha(FROZEN),
    'structural_rules_sha256': sha(rules_path),
    'structural_rules_source_audit_sha256': sha(HERE / 'private/STRUCTURAL_RULES_AUDIT.json'),
    'analysis_statuses': dict(status_counts),
    'limits': [
        'Calculation audit does not certify every raw PDF transcription; see independent source audits.',
        'Reused denominators remain same-year historical populations, not exposure time or exact victim populations.',
        'Property-boundary matching is qualified; institution rates are reporting ratios, not individual victimization probabilities.',
        'No 2025 denominator is inferred from 2024. Partial pooled coverage is never annualized.',
        'Current report editions differ between institutions and sometimes between branches or years.',
        'A source N/A permits structural exclusion only where the reviewed source establishes inapplicability; unexplained blank cells remain unavailable.',
    ],
}
args.report.parent.mkdir(parents=True, exist_ok=True)
args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
print(json.dumps({k: report[k] for k in ('status', 'source_cells', 'rate_rows', 'display_cells', 'institutions_with_source_cells')}, indent=2))
print('Errors:', len(errors))
print(json.dumps(errors[:20], indent=2))
