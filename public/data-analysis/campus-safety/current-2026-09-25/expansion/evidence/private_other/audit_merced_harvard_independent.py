"""Independent full-grid audit from PDF bytes; does not import producer extractors.

pdfplumber is deliberately independent of the producers' pypdf text parser.
Page, row and column assignments were separately checked against rendered pages.
Run from any directory; all evidence paths are relative to this file.
"""
import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CATEGORIES = [
    'murder', 'negligent_manslaughter', 'rape', 'fondling', 'incest',
    'statutory_rape', 'robbery', 'aggravated_assault', 'burglary',
    'motor_vehicle_theft', 'arson', 'domestic_violence', 'dating_violence', 'stalking',
]
LABELS = [
    'Murder', 'Manslaughter', 'Rape', 'Fondling', 'Incest', 'Statutory Rape',
    'Robbery', 'Aggravated Assault', 'Burglary', 'Motor Vehicle Theft', 'Arson',
    'Domestic Violence', 'Dating Violence', 'Stalking',
]
GEOS = ['oncampus', 'residential', 'noncampus', 'publicproperty']
EXPECTED_HASHES = {
    'merced': 'f9744041278e58141c35c6397b2c8af1fc07967099fbd00c88ed9c052cdaf3fd',
    'harvard': 'c52024d2154a422a975890555ad0e11fd19790bcfc5d9cf405305edfa6031c3a',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def compare(name, pdf, csv_path, expected, arithmetic_checks, note):
    assert sha(pdf) == EXPECTED_HASHES[name], 'Source bytes changed; review required.'
    actual = load_csv(csv_path)
    keyed = {(r['campus_id'], int(r['report_year']), r['category'], r['geography']): r for r in actual}
    issues = []
    if len(keyed) != len(actual):
        issues.append('Duplicate CSV keys')
    if keyed.keys() != expected.keys():
        issues.append({'missing_keys': sorted(expected.keys() - keyed.keys()), 'extra_keys': sorted(keyed.keys() - expected.keys())})
    for key in keyed.keys() & expected.keys():
        row, want = keyed[key], expected[key]
        value, page = want
        wanted = {
            'count': '' if value is None else str(value),
            'raw_value': '' if value is None else str(value),
            'status': 'not_reported' if value is None else 'reported_numeric',
            'pdf_page': str(page),
            'printed_page': str(page) if name == 'harvard' else 'unnumbered statistics appendix',
            'report_edition': '2025',
            'institution_unitid': key[0][:6],
            'source_sha256': EXPECTED_HASHES[name],
            'family': 'criminal_offenses' if key[2] in CATEGORIES[:11] else 'vawa',
        }
        wrong = {field: {'expected': val, 'actual': row.get(field)} for field, val in wanted.items() if row.get(field) != val}
        expected_url = (
            'https://clery.ucmerced.edu/sites/g/files/ufvvjh631/f/documents/ucm_2025_asr.pdf'
            if name == 'merced' else
            'https://www.hupd.harvard.edu/sites/g/files/omnuum12486/files/2025-10/2025%20ASR%20VF%20Compressed.pdf'
        ) + f'#page={page}'
        if row['source_url'] != expected_url:
            wrong['source_url'] = {'expected': expected_url, 'actual': row['source_url']}
        if wrong:
            issues.append({'key': key, 'differences': wrong})
    return {
        'result': 'PASS' if not issues else 'FAIL',
        'source_pdf': pdf.relative_to(ROOT).as_posix(), 'source_sha256': sha(pdf),
        'csv': csv_path.relative_to(ROOT).as_posix(), 'csv_sha256': sha(csv_path),
        'cells_checked': len(expected), 'numeric_cells': sum(v[0] is not None for v in expected.values()),
        'explicit_unknown_cells': sum(v[0] is None for v in expected.values()),
        'status_counts': dict(Counter(r['status'] for r in actual)),
        'pages': sorted({v[1] for v in expected.values()}),
        'arithmetic_checks': arithmetic_checks, 'issues': issues, 'qualification': note,
    }


def merced():
    pdf = ROOT / 'california/merced_2025_asr.pdf'
    expected = {}
    checks = 0
    with pdfplumber.open(pdf) as document:
        for page, cats in [(156, CATEGORIES[:11]), (157, CATEGORIES[11:])]:
            text = document.pages[page - 1].extract_text()
            # The second page also has arrest/referral tables after the three VAWA rows.
            grid = re.findall(r'\b(202[234])\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$', text, re.M)[:len(cats) * 3]
            assert len(grid) == len(cats) * 3, ('Unexpected Merced row count', page)
            for index, values in enumerate(grid):
                year, campus, housing, noncampus, public, total = map(int, values)
                assert year == [2024, 2023, 2022][index % 3]
                assert campus + noncampus + public == total
                assert housing <= campus
                checks += 2
                cat = cats[index // 3]
                for geo, value in zip(GEOS, [campus, housing, noncampus, public]):
                    expected[('445188001', year, cat, geo)] = value, page
    return compare('merced', pdf, ROOT / 'california/merced_core_counts.csv', expected, checks,
        'All four source geographies are printed. The housing column is a subset of campus and is not added again to the geographic total. Calendar years 2022–2024; appendix pages unnumbered.')


def harvard():
    pdf = ROOT / 'ivy_northeast/raw/harvard_asr_report.pdf'
    # Columns established from visible headers, not inferred from the output CSV.
    schemas = {
        70: ('166027001', ['oncampus', 'noncampus', 'publicproperty', 'total', 'residential', 'unfounded']),
        71: ('166027002', ['oncampus', 'noncampus', 'publicproperty', 'total', 'residential', 'unfounded']),
        72: ('166027004', ['oncampus', 'publicproperty', 'total', 'unfounded']),
        73: ('166027003', ['oncampus', 'publicproperty', 'total', 'unfounded']),
        74: ('166027006', ['oncampus', 'publicproperty', 'total', 'residential', 'unfounded']),
        75: ('166027008', ['oncampus', 'publicproperty', 'total', 'unfounded']),
        76: ('166027009', ['oncampus', 'publicproperty', 'total', 'unfounded']),
    }
    expected = {}
    checks = 0
    with pdfplumber.open(pdf) as document:
        for page, (campus_id, columns) in schemas.items():
            text = document.pages[page - 1].extract_text()
            assert re.search(r'2022\s+2023\s+2024', text)
            grid = []
            for cat, label in zip(CATEGORIES, LABELS):
                match = re.search(r'^' + re.escape(label) + r' ((?:\d+\s+)*\d+)\s*$', text, re.M)
                assert match, (page, label)
                numbers = list(map(int, match[1].split()))
                assert len(numbers) == 3 * len(columns), (page, label, numbers)
                grid.append(numbers)
                for year_index, year in enumerate([2022, 2023, 2024]):
                    values = dict(zip(columns, numbers[year_index * len(columns):(year_index + 1) * len(columns)]))
                    # Reconcile the source's printed total using only its printed components.
                    # This is NOT evidence to replace absent geographies with zero in the dataset.
                    assert sum(values.get(g, 0) for g in ['oncampus', 'noncampus', 'publicproperty']) == values['total']
                    checks += 1
                    if 'residential' in values:
                        assert values['residential'] <= values['oncampus']
                        checks += 1
                    for geo in GEOS:
                        expected[(campus_id, year, cat, geo)] = values.get(geo), page
            # First TOTAL row is the fourteen-category table, including VAWA.
            total = list(map(int, re.search(r'^TOTAL ((?:\d+\s+)*\d+)\s*$', text, re.M)[1].split()))
            assert len(total) == 3 * len(columns)
            for i, value in enumerate(total):
                assert sum(row[i] for row in grid) == value, ('Harvard printed column total', page, i)
                checks += 1
    return compare('harvard', pdf, ROOT / 'ivy_northeast/harvard_2025_core_counts.csv', expected, checks,
        '378 absent-column cells remain unknown, not inferred zero. Cambridge/Longwood print all four geographies; Forest prints housing but omits noncampus; Arboretum, Concord, Greece and Chile omit housing/noncampus. This audit does not adjudicate structural absence from a separate fire report. Printed TOTAL rows sum all fourteen categories, not only the eleven criminal-offense categories.')


if __name__ == '__main__':
    results = [merced(), harvard()]
    report = {
        'result': 'PASS' if all(r['result'] == 'PASS' for r in results) else 'FAIL',
        'audited_at_utc': datetime.now(timezone.utc).isoformat(),
        'method': 'Independent pdfplumber extraction from original PDFs, separately visually verified row/column layouts; no producer extraction code imported or consulted.',
        'visual_review': {'completed': True, 'pages': {'merced': [156, 157], 'harvard': list(range(70, 77))},
                          'scope': 'All nine rendered table pages, geography/year headers, nonzero cells, subset/total footnotes; no report-wide policy audit.'},
        'results': results,
    }
    (HERE / 'MERCED_HARVARD_INDEPENDENT_AUDIT.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'result': report['result'], 'cells': sum(r['cells_checked'] for r in results), 'checks': sum(r['arithmetic_checks'] for r in results), 'results': [{k: r[k] for k in ['result', 'cells_checked', 'numeric_cells', 'explicit_unknown_cells', 'issues']} for r in results]}, indent=2))
    raise SystemExit(0 if report['result'] == 'PASS' else 1)
