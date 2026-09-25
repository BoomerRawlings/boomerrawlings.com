"""Compare visually checked ASR rape cells directly with frozen federal workbooks.

Requires xlrd==2.0.2. No network, production normalizer or individual records.
"""
from pathlib import Path
import csv
import hashlib
import json
import sys
import zipfile

HERE = Path(__file__).resolve().parent
CLERY = HERE.parent / 'sources' / 'clery'
sys.path.insert(0, str(CLERY / '_deps'))
import xlrd

archive = CLERY / 'raw' / 'Crime2025EXCEL.zip'
source_ids = {'UC San Diego': '110680001', 'UC Santa Cruz': '110714001', 'San Diego State main campus': '122409001'}
tables = {
    'housing': 'Residencehallcrime222324.xls',
    'on_campus': 'Oncampuscrime222324.xls',
    'noncampus': 'Noncampuscrime222324.xls',
    'public_property': 'Publicpropertycrime222324.xls',
}
rows = list(csv.DictReader((HERE / 'verified_asr_rape_counts.csv').open(encoding='utf-8-sig')))
comparisons, member_hashes = [], {}
with zipfile.ZipFile(archive) as z:
    for geography, name in tables.items():
        member = next(n for n in z.namelist() if n.lower() == name.lower())
        data = z.read(member)
        member_hashes[member] = hashlib.sha256(data).hexdigest()
        sheet = xlrd.open_workbook(file_contents=data).sheet_by_index(0)
        headers = [str(x).strip() for x in sheet.row_values(0)]
        id_col = headers.index('UNITID_P')
        selected = {}
        for i in range(1, sheet.nrows):
            values = sheet.row_values(i)
            raw_id = values[id_col]
            campus_id = str(int(raw_id)) if isinstance(raw_id, (int, float)) else str(raw_id).strip()
            if campus_id in source_ids.values():
                assert campus_id not in selected, (member, campus_id)
                selected[campus_id] = dict(zip(headers, values))
        for r in rows:
            field = 'RAPE' + r['report_year'][-2:]
            raw = selected[source_ids[r['institution']]][field]
            assert isinstance(raw, (int, float)) and raw >= 0 and raw == int(raw), (member, field, raw)
            federal, asr = int(raw), int(r[geography])
            comparisons.append({
                'institution': r['institution'], 'campus_id': source_ids[r['institution']],
                'report_year': int(r['report_year']), 'offense': 'Rape', 'geography': geography,
                'federal_collection': 2025, 'federal_count': federal, 'asr_edition': 2025,
                'asr_count': asr, 'difference_asr_minus_federal': asr - federal,
                'federal_workbook': member, 'federal_field': field,
                'asr_pdf_page': int(r['pdf_page']), 'asr_url': r['source_url'],
                'interpretation': 'Source-specific values retained; revision chronology not established.',
            })
out = HERE / 'asr_federal_rape_comparison.csv'
with out.open('w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=comparisons[0]); w.writeheader(); w.writerows(comparisons)
verification = {
    'status': 'PASS', 'method': 'Independent xlrd read of original archived federal workbooks versus visually verified institutional ASR cells.',
    'scope': 'Rape only, three main reporting campuses, four geographies, 2022-2024; not a full ASR audit. SDSU auxiliary campuses are not in this numeric-cell comparison.',
    'cells_checked': len(comparisons), 'matching_cells': sum(r['difference_asr_minus_federal'] == 0 for r in comparisons),
    'differences': [r for r in comparisons if r['difference_asr_minus_federal']],
    'archive_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'workbook_sha256': member_hashes,
    'asr_values_sha256': hashlib.sha256((HERE / 'verified_asr_rape_counts.csv').read_bytes()).hexdigest(),
    'output_sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'xlrd_version': xlrd.__version__,
}
(HERE / 'asr_comparison_verification.json').write_text(json.dumps(verification, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'cells_checked': verification['cells_checked'], 'matching': verification['matching_cells'], 'differences': verification['differences']}, indent=2))
