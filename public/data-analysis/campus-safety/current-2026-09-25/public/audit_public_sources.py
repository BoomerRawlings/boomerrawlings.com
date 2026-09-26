"""Independent source-cell audit; never imports or runs extract_public.py.

Florida: lxml DOM + explicit category labels (primary uses HTMLParser/order).
Most PDFs: pdfplumber text/ruled tables (primary uses pypdf layout).
Texas: pypdf layout with inferred text-column centers (primary uses word x/y).
Penn State: pdfplumber text rows (primary uses ruled tables).
"""
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone
import csv, hashlib, json, re
from lxml import html
import pdfplumber
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
GEO = ['oncampus', 'residential', 'noncampus', 'publicproperty']
CATS = ['murder', 'negligent_manslaughter', 'rape', 'fondling', 'incest', 'statutory_rape', 'robbery', 'aggravated_assault', 'burglary', 'motor_vehicle_theft', 'arson']
VAWA = ['domestic_violence', 'dating_violence', 'stalking']
ALIASES = {
    'murder': ['murdernonnegligentmanslaughter', 'murdernonnegligent', 'murderandnonnegligentmanslaughter'],
    'negligent_manslaughter': ['negligentmanslaughter', 'manslaughterbynegligence'],
    'rape': ['rape'], 'fondling': ['fondling', 'forciblefondling'], 'incest': ['incest'],
    'statutory_rape': ['statutoryrape'], 'robbery': ['robbery'], 'aggravated_assault': ['aggravatedassault'],
    'burglary': ['burglary'], 'motor_vehicle_theft': ['motorvehicletheft', 'motorvehiclethefte'], 'arson': ['arson'],
    'domestic_violence': ['domesticviolence'], 'dating_violence': ['datingviolence'], 'stalking': ['stalking']}
norm = lambda s: re.sub('[^a-z]', '', (s or '').lower())
read = lambda p: json.loads(p.read_text(encoding='utf-8'))
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
sources = sum((read(ROOT / f) for f in ['landings.results.json', 'current.results.json', 'documents.results.json', 'additional.results.json']), [])
observed = list(csv.DictReader((ROOT / 'current_core_counts.csv').open(encoding='utf-8', newline='')))
bykey = {(r['institution_unitid'], r['campus_id'], r['category'], r['report_year'], r['geography']): r for r in observed}
checked = set()
errors = []
notes = []
footnotes = []


def source(key, role=None):
    return next(r for r in reversed(sources) if r['key'] == key and r.get('status') == 'retrieved'
                and (r.get('role') == role if role else r.get('kind') == 'pdf'))


def category(label):
    n = norm(label)
    return next((cat for cat, aliases in ALIASES.items() if n in aliases), None)


def compare(uid, cid, cat, year, values, page, src):
    assert len(values) == 4
    for geo, value in zip(GEO, values):
        key = (uid, cid, cat, str(year), geo)
        r = bykey.get(key)
        if not r:
            errors.append({'kind': 'missing_extracted_cell', 'key': key}); continue
        if key in checked:
            errors.append({'kind': 'duplicate_audit_cell', 'key': key})
        checked.add(key)
        raw = str(value)
        if r['raw_value'] != raw:
            errors.append({'kind': 'source_cell_mismatch', 'key': key, 'source': raw, 'extracted': r['raw_value']})
        if r['pdf_page'] != str(page) or r['source_sha256'] != src['sha256']:
            errors.append({'kind': 'source_locator_mismatch', 'key': key, 'source_page': page, 'extracted_page': r['pdf_page']})
        printed = str(page - {'236948':1,'228778':8,'199120':1}.get(uid,0)) if isinstance(page,int) else ''
        if r['printed_page'] != printed:
            errors.append({'kind':'printed_page_mismatch','key':key,'expected':printed,'extracted':r['printed_page']})
        number = re.sub(r'^\*+|[*,A-Z]+$', '', raw)
        expected_count = str(int(number)) if number.isdigit() else ''
        if r['count'] != expected_count:
            errors.append({'kind': 'count_or_missingness_mismatch', 'key': key, 'expected': expected_count, 'extracted': r['count']})


def year_rows(page, minimum=4):
    rows = []
    for line in page.extract_text().splitlines():
        m = re.search(r'\b(202[1-5])\s+((?:\*?\*?\*?\d+[A-Z*]*|n/a)(?:\s+(?:\d+[A-Z*]*|n/a)){'+str(minimum-1)+r',})$', line, re.I)
        if m: rows.append((int(m[1]), m[2].split()))
    return rows


def florida():
    s = source('florida', 'current'); doc = html.fromstring((ROOT / s['local_html']).read_text(encoding='utf-8'))
    items = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," accordion-item ")]')
    assert len(items) == 38
    for item in items:
        name = ' '.join(item.xpath('.//button')[0].text_content().split())
        cid = 'source:' + re.sub('[^a-z0-9]+', '-', name.lower()).strip('-')
        for p in item.xpath('.//p'):
            text = ' '.join(p.text_content().split())
            if text.startswith(('+', '*')):
                preceding = p.xpath('preceding::h3[1]')
                footnotes.append({'campus': name, 'preceding_year_heading': ' '.join(preceding[0].text_content().split()) if preceding else '', 'text': text})
        for table in item.xpath('.//table'):
            rows = [[' '.join(c.text_content().split()) for c in tr.xpath('./th|./td')] for tr in table.xpath('.//tr')]
            if not rows or rows[0][0] not in ['Criminal Offenses', 'VAWA (Violence Against Women Act) Crimes']: continue
            year_heading = ' '.join(table.xpath('preceding::h3[1]')[0].text_content().split())
            year = int(year_heading[:4])
            assert [x.rstrip('*') for x in rows[0][1:]] == ['On-Campus', 'Residential', 'Non-Campus', 'Public']
            for row in rows[1:]:
                cat = category(row[0]); assert cat, row[0]
                compare('134130', cid, cat, year, row[1:], '', s)


def basic_pdf(key, uid, configs):
    s = source(key)
    with pdfplumber.open(ROOT / s['local_pdf']) as doc:
        for cid, pages, cats, years, geography in configs:
            values = [(pg, year, row) for pg in pages for year, row in year_rows(doc.pages[pg-1], minimum=2 if key == 'unc' and cid != '199120001' else 4)]
            expected = [(cat, year) for cat in cats for year in years]
            if key == 'michigan' and pages == [16]:
                expected = [(cat, year) for cat in cats for year in ([2023, 2022, 2021] if cat == 'statutory_rape' else years)]
            if key == 'michigan' and pages == [17]: values = values[15:]
            if key == 'unc':
                expected = [(cat, y) for cat in CATS + ['domestic_violence'] for y in years] + [('dating_violence', 2023)] + [('stalking', y) for y in years]
                if cid == 'source:unc-mahec': expected = [(cat, 2025) for cat in CATS+['domestic_violence', 'stalking']]
            assert len(values) >= len(expected), (key, cid, len(values), len(expected))
            for (cat, expected_year), (page, year, row) in zip(expected, values):
                assert expected_year == year, (key, cat, expected_year, year)
                vals = [row[i] if isinstance(i, int) else i for i in geography]
                compare(uid, cid, cat, year, vals, page, s)


def gatech():
    s = source('gatech')
    with pdfplumber.open(ROOT / s['local_pdf']) as doc:
        for page, cid in [(79, '139755001'), (80, '139755003'), (81, '139755002')]:
            tables = doc.pages[page-1].extract_tables()
            for table in [tables[0], tables[3]]:
                current = None
                for row in table:
                    if row[0]: current = category(row[0])
                    if not current or row[1] not in ['2023', '2024', '2025']: continue
                    vals = row[2:6] if page != 81 else [row[2], 'n/a', row[3], row[4]]
                    compare('139755', cid, current, row[1], vals, page, s)


def ohio():
    s = source('ohio'); current = None
    with pdfplumber.open(ROOT / s['local_pdf']) as doc:
        for page in [61, 62]:
            for line in doc.pages[page-1].extract_text().splitlines():
                label = re.split(r'\b202[234]\b', line)[0]
                found = category(label)
                if found: current = found
                if label.startswith('Murder and Non-Negligent'): current = 'murder'
                m = re.search(r'\b(202[234])\s+(Total\s+)?((?:\d+\s+){4}\d+)$', line)
                if not m or not current: continue
                if not found and not (current == 'murder' and not label.strip()): continue
                if current in ['rape', 'fondling'] and not m[2]: continue
                v = m[3].split()
                if current not in CATS+VAWA: continue
                compare('204796', '204796001', current, m[1], [v[2], v[1], v[3], v[4]], page, s)


def wisconsin():
    s = source('wisconsin')
    with pdfplumber.open(ROOT / s['local_pdf']) as doc:
        for page, year in [(13,2024), (15,2023), (17,2022)]:
            cats = ['murder','negligent_manslaughter','robbery','aggravated_assault','burglary','motor_vehicle_theft','arson','rape','fondling','incest','statutory_rape'] + VAWA
            nums = []
            lines = doc.pages[page-1].extract_text().splitlines(); start = lines.index('Criminal Offenses')
            for line in lines[start:]:
                m = re.search(r'(?:^|\s)((?:\d+\s+){3}\d+)$', line)
                if m: nums.append((page, m[1].split()))
            if len(nums) < 14:
                for line in doc.pages[page].extract_text().splitlines():
                    m = re.search(r'^(?:Domestic Violence|Dating Violence|Stalking) ((?:\d+\s+){3}\d+)$', line)
                    if m: nums.append((page+1, m[1].split()))
            assert len(nums) == 14
            for cat, (pg, v) in zip(cats, nums): compare('240444','240444001',cat,year,[v[0],v[1],v[3],v[2]],pg,s)


def texas():
    s = source('ut'); doc = PdfReader(ROOT / s['local_pdf'])
    campuses = [(74,'228778001'),(77,'228778002'),(79,'source:ut-brackenridge'),(81,'228778003'),(83,'228778005'),(85,'228778010'),(87,'228778011'),(89,'228778007')]
    for first, cid in campuses:
        for page, cats in [(first,CATS), (first+1,['dating_violence','domestic_violence','stalking'])]:
            rows = []
            for line in doc.pages[page-1].extract_text(extraction_mode='layout').splitlines():
                m = re.search(r'\b(202[234])(?:\s|$)', line)
                if not m or m.start() < 25: continue
                if re.search(r'[A-Za-z]', line[m.end():]): continue
                rows.append((int(m[1]), line, m.end()))
            assert len(rows) >= len(cats)*3, (page, len(rows))
            tokens = list(re.finditer(r'\d+', rows[0][1][rows[0][2]:]))
            centers = [x.end()+rows[0][2] for x in tokens]
            assert len(centers) >= 2
            step = (centers[-1] - centers[0])/3
            centers = [centers[0]+step*j for j in range(4)]
            for i, cat in enumerate(cats):
                block = rows[i*3:i*3+3]
                label = norm(' '.join(line[:end-4] for _,line,end in block))
                assert any(alias in label for alias in ALIASES[cat]), (page, cat, label)
                for year, line, end in block:
                    vals = ['']*4
                    for value in re.finditer(r'\d+',line[end:]):
                        pos = value.end()+end
                        col = min(range(4), key=lambda c:abs(centers[c]-pos))
                        assert abs(centers[col]-pos)<6,(page,year,pos,centers)
                        vals[col] = value[0]
                    compare('228778',cid,cat,year,vals,page,s)


def pennstate():
    for key,cid,page in [('pennstate','214777001',60),('pennstate-law','214777002',55),('pennstate-med','214777003',57)]:
        s=source(key); current=None
        with pdfplumber.open(ROOT/s['local_pdf']) as doc:
            for line in doc.pages[page-1].extract_text().splitlines():
                label=re.sub(r'\s+\d.*$', '',line); found=category(label)
                if found:current=found
                if label.startswith('Murder/ Non-negligent'):current='murder'
                if line in ['ARRESTS','REFERRALS']:current=None
                m=re.search(r'(?:^|\s)((?:\d+\s+){11}\d+)$',line)
                if not m or not current:continue
                v=m[1].split()
                for i,year in enumerate([2022,2023,2024]):
                    part=v[4*i:4*i+4]
                    compare('214777',cid,current,year,[part[1],part[0],part[3],part[2]],page,s)


def main():
    assert len(observed)==len(bykey)==10276
    hashes={r['source_sha256'] for r in observed}
    for digest in hashes:
        s=next(x for x in sources if x.get('sha256')==digest)
        assert sha(ROOT/s.get('local_pdf',s.get('local_html')))==digest
    florida();gatech()
    basic_pdf('washington','236948',[('236948001',[13],CATS,[2024,2023,2022],[0,1,2,3]),('236948001',[14],VAWA,[2024,2023,2022],[0,1,2,3])])
    basic_pdf('michigan','170976',[('170976001',[16],CATS[:8]+['arson','burglary','motor_vehicle_theft'],[2024,2023,2022],[0,1,2,3]),('170976001',[17],['stalking','domestic_violence','dating_violence'],[2024,2023,2022],[0,1,2,3])])
    basic_pdf('illinois','145637',[('145637001',[7,8],CATS,[2024,2023,2022],[0,1,2,3]),('145637003',[127,128,129],CATS,[2024,2023,2022],[0,1,2,3])])
    s=source('illinois')
    with pdfplumber.open(ROOT/s['local_pdf']) as doc:
        for page,cid in [(10,'145637001'),(130,'145637003')]:
            rows=year_rows(doc.pages[page-1])[-9:]
            for cat,block in zip(VAWA,[rows[i:i+3] for i in range(0,9,3)]):
                for year,v in block:compare('145637',cid,cat,year,v[:4],page,s)
    ohio();wisconsin();texas();pennstate()
    basic_pdf('unc','199120',[('199120001',[21,22,23],[],[2025,2024,2023],[0,1,2,3]),('199120003',[26,27,28],[],[2025,2024,2023],[0,'','',1]),('199120002',[29,30,31],[],[2025,2024,2023],[0,'','',1]),('source:unc-mahec',[32,33],[],[2025],[0,'','',1])])
    missing=[key for key in bykey if key not in checked]
    result={'checked_utc':datetime.now(timezone.utc).isoformat(),'status':'PASS' if not errors and not missing else 'FAIL',
            'extracted_csv_sha256':sha(ROOT/'current_core_counts.csv'),'extractor_sha256':sha(ROOT/'extract_public.py'),
            'source_cell_count':len(observed),'independently_compared_cells':len(checked),'source_body_hashes_verified':len(hashes),
            'errors':errors,'unchecked_cells':missing,'institutions':dict(Counter(r['institution_unitid'] for r in observed)),
            'method':'Independent implementations; Florida labeled DOM rows, PDF alternate text/table extraction and Texas pypdf text-column recovery. No import of production extractor.',
            'visual_review_pdf_pages':{'gatech':[79],'washington':[13],'michigan':[16,17],'illinois':[10],'ohio':[61],'wisconsin':[13],'ut':[79,90],'pennstate':[60],'unc':[23,24]},
            'visual_review_scope':'Twelve rendered source pages checked for labels, numerical alignment, geography headers, pagination, and cited footnotes; not a visual check of every page.',
            'normalized_grid_note':'Output cells include explicitly absent geographies represented as null; not every output cell is a literal printed source cell. Savannah housing is documented absent by the PDF81 footnote; its n/a raw_value is a normalization.',
            'scope_limit':'Does not certify denominator selection, federal campus ID crosswalk, latest-unavailable reports, or full incident ascertainment.'}
    (ROOT/'PUBLIC_SOURCE_AUDIT.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    (ROOT/'florida_footnotes_audit.json').write_text(json.dumps(footnotes,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k not in ['errors','unchecked_cells']},indent=2))
    print('Errors',len(errors),'unchecked',len(missing));print(errors[:10]);print(missing[:10])


if __name__=='__main__':main()
