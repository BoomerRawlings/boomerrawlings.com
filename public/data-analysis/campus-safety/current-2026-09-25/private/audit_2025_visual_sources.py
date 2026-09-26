"""Independent visible-page audit: Princeton core cells, MIT/Dartmouth conflicts.

The literals below were read from six rendered source pages by a separate
reviewer. The production extraction module is never imported or executed.
"""
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CSV = HERE / 'current_2025_core_counts.csv'
rows = list(csv.DictReader(CSV.open(encoding='utf8', newline='')))
index = {(r['campus_id'], int(r['report_year']), r['category'], r['geography']): r for r in rows}
errors = []
geos = ['oncampus', 'residential', 'noncampus', 'publicproperty']
# Each slash-separated group is 2024, then 2023, then 2022; columns are
# campus, residential subset, noncampus, public property. Printed totals are
# deliberately excluded from this mutually overlapping four-column matrix.
main = {
    'murder': '0 0 0 0 / 0 0 0 0 / 0 0 0 0',
    'negligent_manslaughter': '0 0 0 0 / 0 0 0 0 / 0 0 0 0',
    'rape': '8 3 2 0 / 6 5 0 0 / 6 6 0 0',
    'fondling': '2 1 4 0 / 0 0 1 0 / 4 3 0 0',
    'incest': '0 0 0 0 / 0 0 0 0 / 0 0 0 0',
    'statutory_rape': '0 0 0 0 / 0 0 0 0 / 0 0 0 0',
    'robbery': '0 0 0 1 / 0 0 0 0 / 0 0 0 0',
    'aggravated_assault': '2 0 1 0 / 1 1 0 0 / 0 0 0 0',
    'burglary': '4 3 0 0 / 8 4 2 0 / 9 9 0 0',
    'motor_vehicle_theft': '46 0 1 0 / 36 0 0 0 / 49 0 1 0',
    'arson': '0 0 0 0 / 0 0 0 0 / 1 1 0 0',
    'dating_violence': '6 4 0 0 / 0 0 0 0 / 4 1 0 0',
    'domestic_violence': '0 0 1 0 / 4 3 0 0 / 0 0 0 0',
    'stalking': '7 0 0 0 / 3 0 0 0 / 4 0 0 0',
}
checked = 0
for branch in ('186131001', '186131002'):
    for cat, text in main.items():
        for year, group in zip((2024, 2023, 2022), text.split('/')):
            values = list(map(int, group.split())) if branch.endswith('001') else [0] * 4
            for geo, expected in zip(geos, values):
                key = branch, year, cat, geo
                r = index[key]
                if r['count'] != str(expected) or r['status'] != 'reported_numeric':
                    errors.append({'key': key, 'expected': expected, 'actual': r['count'], 'status': r['status']})
                is_vawa = cat in {'domestic_violence', 'dating_violence', 'stalking'}
                page = (52 if is_vawa else 50) + (branch == '186131002')
                if (int(r['pdf_page']), int(r['printed_page'])) != (page, page - 2):
                    errors.append({'key': key, 'error': 'Incorrect page locator'})
                checked += 1

conflict_evidence = [
    {'campus_id': '166683001', 'category': 'arson', 'year': 2024,
     'pdf_page': 54, 'printed_page': 54, 'values': [1, 1, 0, 0], 'printed_total': 2,
     'note': 'Footnote 3 explicitly says total = campus + noncampus + public, and residence already belongs to campus. Visible components sum to 1, not the printed 2.'},
    {'campus_id': '182670002', 'category': 'domestic_violence', 'year': 2024,
     'pdf_page': 112, 'printed_page': 110, 'values': [25, 25, 0, 0], 'printed_total': 1,
     'note': 'Visible campus and residence cells are each 25, followed by separate superscript footnote markers 29 and 30. Footnotes describe repeated offenses in one report. Printed total is 1; do not reconcile silently or substitute that total for geography values. The category also includes dating violence.'},
]
for item in conflict_evidence:
    for geo, value in zip(geos, item['values']):
        key = item['campus_id'], item['year'], item['category'], geo
        r = index[key]
        if r['count'] != str(value) or r['status'] != 'source_total_conflict':
            errors.append({'key': key, 'expected': value, 'actual': r['count'], 'status': r['status']})
        checked += 1

dating_na = 0
for year in (2022, 2023, 2024):
    for geo in geos:
        r = index['182670002', year, 'dating_violence', geo]
        if r['count'] != '' or r['status'] != 'reported_not_applicable':
            errors.append({'year': year, 'geography': geo, 'error': 'Dartmouth combined dating category must retain literal n/a, not zero'})
        dating_na += 1

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

source_pdfs = [HERE / 'retrieved/princeton/asr-7771cb32.pdf',
               HERE / 'retrieved/mit/asr-8895265e.pdf',
               HERE / 'retrieved/dartmouth/asr-d24ab270.pdf']
provenance = []
for path in source_pdfs:
    digest = sha(path)
    matching = [r for r in rows if r['source_sha256'] == digest]
    if not matching:
        errors.append({'file': str(path.relative_to(HERE)), 'error': 'No CSV cell references exact local PDF hash'})
    provenance.append({'path': path.relative_to(HERE).as_posix(), 'sha256': digest,
                       'source_url': matching[0]['source_url'].split('#')[0] if matching else None})
images = ['princeton2025-50.png', 'princeton2025-51.png', 'princeton2025-52.png',
          'princeton2025-53.png', 'mit54.png', 'dartmouth112.png']
report = {
    'checked_utc': datetime.now(timezone.utc).isoformat(),
    'status': 'PASS' if not errors else 'FAIL',
    'scope': 'All 336 Princeton 14-category source cells; eight MIT/Dartmouth conflicting component cells; 12 Dartmouth Lebanon dating-violence n/a cells. Six rendered pages visually inspected.',
    'princeton_cells': 336, 'conflicting_component_cells': 8, 'dating_na_cells': dating_na,
    'csv_sha256': sha(CSV), 'audit_script_sha256': sha(Path(__file__)),
    'source_pdfs': provenance,
    'render_hashes': {n: sha(HERE / 'visual-checks' / n) for n in images},
    'conflict_evidence': conflict_evidence,
    'princeton_notes': [
        'Current visible tables are controlling; the obsolete hidden PDF text layer is not a reliable count source.',
        'Forrestal core counts are explicit printed zeros for all three years and geographies, not imputed zeros.',
        'Hate-crime classifications, hazing, arrests, and disciplinary referrals were excluded from the 14-category check.',
        'Hazing says Not Collected; it must not be interpreted as zero if that category is later added.',
        'Motor-vehicle-theft footnote includes golf carts, motorized scooters, and motorized bicycles; it is not automobile theft alone.',
    ],
    'required_analysis_handling': [
        'Exclude conflicting MIT arson and Dartmouth domestic-violence comparisons while preserving the literal source cells.',
        'Dartmouth dating n/a denotes a combined category, not absent geography; separate domestic and dating rates must both be withheld.',
    ],
    'errors': errors,
}
(HERE / '2025_visual_source_review.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
print(json.dumps({'status': report['status'], 'cells': checked + dating_na, 'errors': errors}, indent=2))
