"""Second computational extraction: pdfplumber/pdfminer table grids and glyph sizes.

Does not import the first extraction, its regexes, values, or text intermediates.
Reads its CSV only after constructing the alternate complete cell set. Table
orders/geography headers and Berkeley's broken character map were checked against
rendered official PDF pages. This is a second method by the same source reviewer,
not a second-person review or external peer review.
"""
from collections import Counter
from datetime import datetime, timezone
import csv
import hashlib
import json
from pathlib import Path
import re

import pdfplumber

P = Path(__file__).parent
CATEGORIES = ['murder', 'negligent_manslaughter', 'rape', 'fondling', 'incest',
              'statutory_rape', 'robbery', 'aggravated_assault', 'burglary',
              'motor_vehicle_theft', 'arson', 'domestic_violence',
              'dating_violence', 'stalking']
GEO = ['residential', 'oncampus', 'noncampus', 'publicproperty']
ROWS = []
PDFS = {}
EXCLUDED_SUPERSCRIPTS = []


def pdf(key):
    if key not in PDFS:
        PDFS[key] = pdfplumber.open(P / (key + '_report.pdf'))
    return PDFS[key]


def number(page, bbox, raw, key, pageno):
    if raw.strip() == 'N/A':
        return None
    x0, y0, x1, y1 = bbox
    chars = [c for c in page.chars
             if x0 < (c['x0'] + c['x1']) / 2 < x1
             and y0 < (c['top'] + c['bottom']) / 2 < y1
             and c['text'].strip()]
    # Footnote digits have smaller type than the count. Determine this from the
    # original PDF glyphs rather than a keyed list of expected count corrections.
    base_size = max(c['size'] for c in chars)
    count_chars = [c for c in chars if c['size'] > base_size * .85]
    count_text = ''.join(c['text'] for c in count_chars).strip().replace('*', '').replace('^', '')
    skipped = ''.join(c['text'] for c in chars if c['size'] <= base_size * .85)
    if skipped:
        EXCLUDED_SUPERSCRIPTS.append({'pdf': key, 'page': pageno, 'raw': raw,
                                     'count_text': count_text, 'excluded': skipped})
    assert re.fullmatch(r'\d+', count_text), (key, pageno, raw, count_text)
    return int(count_text)


def year_rows(key, pageno, n_geos, table_index=None):
    page = pdf(key).pages[pageno - 1]
    tables = page.find_tables()
    if table_index is not None:
        tables = [tables[table_index]]
    for table in tables:
        for ri, cells in enumerate(table.extract()):
            years = [(i, int(t)) for i, t in enumerate(cells)
                     if t and re.fullmatch(r'202[2-5]', t.strip())]
            if len(years) != 1:
                continue
            yi, year = years[0]
            count_cells = [(i, t) for i, t in enumerate(cells) if i > yi and t and t.strip()]
            if len(count_cells) != n_geos:
                continue
            if any(not re.fullmatch(r'(?:N/A|[\d,*^]+)', t.strip()) for _, t in count_cells):
                continue
            values = [number(page, table.rows[ri].cells[i], t, key, pageno)
                      for i, t in count_cells]
            yield year, values


def add(campus, year, category, geos, values, key, pageno):
    if category not in CATEGORIES:
        return
    record = dict(zip(geos, values))
    for g in GEO:
        ROWS.append(dict(campus_id=campus, report_year=year, category=category,
                         geography=g, count=record.get(g),
                         status=('column_not_reported' if g not in record else
                                 'source_NA' if record[g] is None else 'reported_numeric'),
                         pdf=key, pdf_page=pageno))


def sequence(key, campus, pages, categories, geos, limit=None, table_index=None):
    found = [(pageno, year, values) for pageno in pages
             for year, values in year_rows(key, pageno, len(geos), table_index)]
    if limit is not None:
        found = found[:limit]
    assert len(found) == len(categories) * 3, (key, campus, len(found), len(categories) * 3)
    for i, (pageno, year, values) in enumerate(found):
        add(campus, year, categories[i // 3], geos, values, key, pageno)


# Source headings independently inspected; physical table-grid extraction is
# distinct from the first parser's text-line expressions and keyed suffix fixes.
for campus, pg in [('110644001', 26), ('110644002', 27)]:
    sequence('davis', campus, [pg], CATEGORIES[:11],
             ['residential', 'oncampus', 'publicproperty', 'noncampus', 'total'])
for ti, campus in enumerate(['110644001', '110644002']):
    sequence('davis', campus, [28], CATEGORIES[-3:],
             ['residential', 'oncampus', 'publicproperty', 'noncampus', 'total'], table_index=ti)

sequence('riverside', '110671001', [157, 158, 159], CATEGORIES,
         ['oncampus', 'residential', 'noncampus', 'publicproperty'], limit=42)
sequence('riverside', '110671002', [161, 162, 163], CATEGORIES,
         ['oncampus', 'publicproperty'], limit=42)

sequence('santa_barbara', '110705001', [218, 219, 220, 221, 222],
         CATEGORIES[:9] + ['arson', 'hazing', 'motor_vehicle_theft'] + CATEGORIES[-3:],
         ['oncampus', 'residential', 'noncampus', 'publicproperty', 'total'], limit=45)
sequence('ucdc', '110635003', [21, 22], CATEGORIES,
         ['oncampus', 'noncampus', 'publicproperty', 'total', 'residential'], limit=42)
sequence('san_diego', '110680001', [142], CATEGORIES[:11],
         ['residential', 'oncampus', 'noncampus', 'publicproperty', 'total'])
sequence('san_diego', '110680001', [143], CATEGORIES[-3:],
         ['residential', 'oncampus', 'noncampus', 'publicproperty', 'total'], limit=9)
for campus, pages in [('110653001', [196, 197]), ('110653002', [199, 200])]:
    sequence('irvine', campus, pages, CATEGORIES,
             ['oncampus', 'residential', 'noncampus', 'publicproperty', 'total'])
for pageno, cats in [(10, ['murder']), (11, CATEGORIES[1:7]),
                     (12, CATEGORIES[7:13]), (13, ['stalking'])]:
    sequence('santa_cruz', '110714001', [pageno], cats,
             ['oncampus', 'residential', 'noncampus', 'publicproperty'], limit=len(cats) * 3)

# UCLA's separate Sexual Assault aggregate must not be included alongside its
# constituent offense categories. Dating is a printed zero but is combined with
# domestic violence in the report's definition; extraction is not interpretation.
page = pdf('los_angeles').pages[161]
table = page.find_tables()[0]
la_categories = CATEGORIES[:2] + ['sexual_assault_subtotal', 'rape', 'fondling',
                  'statutory_rape', 'incest'] + CATEGORIES[6:]
la_rows = []
for ri, row in enumerate(table.extract()):
    vals = [(i, t) for i, t in enumerate(row) if t and re.fullmatch(r'\d+\*?', t.strip())]
    if len(vals) != 12:
        continue
    la_rows.append([number(page, table.rows[ri].cells[i], t, 'los_angeles', 162) for i, t in vals])
assert len(la_rows) >= 15
for cat, vals in zip(la_categories, la_rows[:15]):
    for yi, yr in enumerate([2022, 2023, 2024]):
        add('110662001', yr, cat, ['residential', 'oncampus', 'publicproperty', 'noncampus'],
            vals[yi * 4:(yi + 1) * 4], 'los_angeles', 162)

# UCSF: compare both independently rendered publication locations, then compare
# four-geography core cells to the original extraction.
sf_cats = CATEGORIES[:2] + CATEGORIES[6:11] + CATEGORIES[2:6] + ['dating_violence', 'domestic_violence', 'stalking']
sf_supplement_full_report_matches = 0
for branch in range(1, 6):
    editions = []
    for key, pageno in [('san_francisco_stats', branch), ('san_francisco', 83 + branch)]:
        page = pdf(key).pages[pageno - 1]
        table = page.find_tables()[0]
        wide = []
        for ri, row in enumerate(table.extract()):
            nums = [(i, t) for i, t in enumerate(row) if t and re.fullmatch(r'\d+', t.strip())]
            if len(nums) == 15:
                wide.append([number(page, table.rows[ri].cells[i], t, key, pageno) for i, t in nums])
        assert len(wide) >= 14, (key, pageno, len(wide))
        editions.append(wide[:14])
    assert editions[0] == editions[1], ('UCSF publication mismatch', branch)
    sf_supplement_full_report_matches += 14 * 15
    for cat, values in zip(sf_cats, editions[0]):
        for yi, yr in enumerate([2023, 2024, 2025]):
            add('11069900' + str(branch), yr, cat,
                ['residential', 'oncampus', 'publicproperty', 'noncampus', 'unfounded'],
                values[yi * 5:(yi + 1) * 5], 'san_francisco_stats', branch)

# Berkeley's broken ToUnicode map prevents ordinary numeric extraction. Recover
# digit glyphs inside each physical cell in original content-stream order. The
# character map is visually verified; superscript letters are not digit glyphs.
# Sorting by x would reverse the overlapping fondling 17 glyphs, so preserve order.
berkeley_digit_map = {'(cid:1)': '0', ':': '1', '(cid:25)': '2', '(cid:26)': '3',
                     '(cid:27)': '4', 'C': '5', '<': '6', ';': '7', '>': '8', '@': '9'}
page = pdf('berkeley').pages[125]
table = page.find_tables()[0]
berkeley_rows = dict(zip([7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 19, 21, 22, 23],
                        CATEGORIES[:11] + ['dating_violence', 'domestic_violence', 'stalking']))
for ri, cat in berkeley_rows.items():
    numbers = []
    for x0, y0, x1, y1 in table.rows[ri].cells[1:13]:
        glyphs = [c for c in page.chars
                  if x0 < (c['x0'] + c['x1']) / 2 < x1
                  and y0 < (c['top'] + c['bottom']) / 2 < y1
                  and c['text'] in berkeley_digit_map]
        decoded = ''.join(berkeley_digit_map[c['text']] for c in glyphs)
        assert re.fullmatch(r'\d+', decoded), (ri, decoded)
        numbers.append(int(decoded))
    for yi, yr in enumerate([2022, 2023, 2024]):
        add('110635001', yr, cat, ['oncampus', 'residential', 'noncampus', 'publicproperty'],
            [numbers[j * 3 + yi] for j in range(4)], 'berkeley', 126)


def key(row):
    return row['campus_id'], int(row['report_year']), row['category'], row['geography']


original = list(csv.DictReader((P / 'current_core_counts.csv').open(encoding='utf-8-sig')))
reference = {key(r): r for r in original}
alternate = {key(r): r for r in ROWS}
assert len(reference) == len(original), 'Duplicate primary cells'
assert len(alternate) == len(ROWS), 'Duplicate alternate cells'
assert len(alternate) == 2856, len(alternate)
missing = sorted(reference.keys() - alternate.keys())
extra = sorted(alternate.keys() - reference.keys())
differences = []
for k in reference.keys() & alternate.keys():
    a, b = reference[k], alternate[k]
    original_count = int(a['count']) if a['count'] else None
    if original_count != b['count'] or a['status'] != b['status']:
        differences.append(dict(key=k, original_count=original_count,
                                alternate_count=b['count'], original_status=a['status'],
                                alternate_status=b['status'], page=b['pdf_page'], pdf=b['pdf']))

hashes = {key: hashlib.sha256((P / (key + '_report.pdf')).read_bytes()).hexdigest()
          for key in PDFS}
out = dict(
    status='pass' if not missing and not extra and not differences else 'fail',
    checked_utc=datetime.now(timezone.utc).isoformat(),
    scope='Second computational extraction by the same source reviewer; not second-person or external peer review.',
    engine='pdfplumber ' + pdfplumber.__version__ + ' / pdfminer.six; physical table grids and character-size filtering',
    primary_engine='pypdf text expressions plus manual Berkeley transcription',
    expected_cells=len(original), alternate_cells=len(ROWS),
    institutions=len({r['institution_unitid'] for r in original}),
    campuses=len({r['campus_id'] for r in ROWS}),
    status_counts=dict(Counter(r['status'] for r in ROWS)),
    missing_keys=missing, extra_keys=extra, count_or_status_differences=differences,
    ucsf_full_report_vs_supplement_core_and_unfounded_cells=sf_supplement_full_report_matches,
    removed_superscript_glyphs=EXCLUDED_SUPERSCRIPTS,
    source_pdf_sha256=hashes,
    primary_csv_sha256=hashlib.sha256((P / 'current_core_counts.csv').read_bytes()).hexdigest(),
    method_limitations=[
        'Fixed category order and geography headers are visually specified per report; the check is not independent source authentication.',
        'Berkeley digits require a visually verified PDF character map because ToUnicode is defective.',
        'Source N/A and omitted columns stay distinct from numeric zero; this check does not authorize later structural-zero normalization.',
        'Merced is excluded: no verified current report PDF was obtained.',
        'This check validates extraction, not compatibility of different report editions, population denominators, or crime definitions.'
    ])
(P / 'second_extraction_audit.json').write_text(json.dumps(out, indent=2), encoding='utf-8')
(P / 'second_extraction_cells.json').write_text(json.dumps(ROWS, indent=2), encoding='utf-8')
for doc in PDFS.values():
    doc.close()
print(json.dumps({k: out[k] for k in ['status', 'expected_cells', 'alternate_cells', 'status_counts',
                                    'missing_keys', 'extra_keys', 'count_or_status_differences']}, indent=2))
assert out['status'] == 'pass'
