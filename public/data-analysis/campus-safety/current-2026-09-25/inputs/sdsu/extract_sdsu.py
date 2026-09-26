"""Deterministic source extraction; never modifies the frozen 2025 collection.

Run from any directory. Requires pypdf and the byte-pinned PDFs/subset CSV beside
this script. Current report is the PDF actually linked by SDSU's saved listing.
"""
from pathlib import Path
import csv, hashlib, json, logging, re
from collections import Counter
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
CURRENT_URL = 'https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf'
OLD_URL = 'https://police.sdsu.edu/_resources/files/annual-security-reports/2025-annual-security-report-finalized-08-18-25.pdf'
CURRENT_SHA = '8d697b9134573a07dd7d53a0db29c18f8fe3a5b97e026fb8221237766155c80b'
CAMPUS = {'San Diego': '122409001', 'Imperial Valley': '122409002', 'Georgia': '122409003'}
GEOGRAPHIES = ['residential', 'oncampus', 'noncampus', 'publicproperty']
FED_GEO = {'residential': 'residential_facilities', 'oncampus': 'on_campus', 'noncampus': 'noncampus', 'publicproperty': 'public_property'}
CATEGORIES = [
    ('Murder/Nonnegligent Manslaughter', 'murder', 'criminal_offenses', 'MURD'),
    ('Negligent Manslaughter', 'negligent_manslaughter', 'criminal_offenses', 'NEG_M'),
    ('Rape', 'rape', 'criminal_offenses', 'RAPE'),
    ('Fondling', 'fondling', 'criminal_offenses', 'FONDL'),
    ('Incest', 'incest', 'criminal_offenses', 'INCES'),
    ('Statutory Rape', 'statutory_rape', 'criminal_offenses', 'STATR'),
    ('Robbery', 'robbery', 'criminal_offenses', 'ROBBE'),
    ('Aggravated Assault', 'aggravated_assault', 'criminal_offenses', 'AGG_A'),
    ('Burglary', 'burglary', 'criminal_offenses', 'BURGLA'),
    ('Motor Vehicle Theft', 'motor_vehicle_theft', 'criminal_offenses', 'VEHIC'),
    ('Arson', 'arson', 'criminal_offenses', 'ARSON'),
    ('Domestic Violence', 'domestic_violence', 'vawa', 'DOMEST'),
    ('Dating Violence', 'dating_violence', 'vawa', 'DATING'),
    ('Stalking', 'stalking', 'vawa', 'STALK'),
    ('Arrests for Weapons Law Violations', 'arrests_weapons', 'arrests', 'WEAPON'),
    ('Arrests for Drug Law Violations', 'arrests_drug', 'arrests', 'DRUG'),
    ('Arrests for Liquor Law Violations', 'arrests_liquor', 'arrests', 'LIQUOR'),
    ('Referrals to Disciplinary Action for Weapons Law Violations', 'referrals_weapons', 'disciplinary_referrals', 'WEAPON'),
    ('Referrals to Disciplinary Action for Drug Law Violations', 'referrals_drug', 'disciplinary_referrals', 'DRUG'),
    ('Referrals to Disciplinary Action for Liquor Law Violations', 'referrals_liquor', 'disciplinary_referrals', 'LIQUOR'),
    ('Hazing', 'hazing', 'hazing', ''),
]
BY_LABEL = {c[0]: c for c in CATEGORIES}

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write_json(name, obj): (HERE/name).write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def write_csv(name, rows):
    with (HERE/name).open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)

def extract(path, edition, years, url):
    logging.getLogger('pypdf').setLevel(logging.ERROR)
    reader = PdfReader(path)
    source_hash = digest(path)
    result = []; campus = None; category = None; headers = 0
    for page_number in range(7,20):
        lines = (reader.pages[page_number-1].extract_text(extraction_mode='layout') or '').splitlines()
        for line_number, raw_line in enumerate(lines, 1):
            line = re.sub(r'\s+', ' ', raw_line).strip().replace(' ,', ',')
            for name in CAMPUS:
                if line == f'San Diego State University, {name}': campus = name; category = None
            if line in BY_LABEL: category = BY_LABEL[line]
            if line == 'Year Campus Residential Campus Total Non-Campus Public Property': headers += 1
            match = re.fullmatch(r'(202[2-5]) (NA|\d+) (NA|\d+) (NA|\d+) (NA|\d+)', line)
            if not match: continue
            year = int(match[1]); assert year in years and campus and category, (page_number, line)
            for geography, token in zip(GEOGRAPHIES, match.groups()[1:]):
                result.append({'report_edition':edition,'report_year':year,'institution_unitid':'122409',
                    'campus_id':CAMPUS[campus], 'campus':campus, 'category':category[1], 'category_label':category[0],
                    'family':category[2], 'geography':geography,'count':None if token=='NA' else int(token),
                    'raw_value':token,'status':'source_NA' if token=='NA' else 'reported_numeric',
                    'pdf_page':page_number,'printed_page':page_number,'source_line':line_number,
                    'source_url':url+f'#page={page_number}','source_sha256':source_hash})
    categories = 21 if edition == 2026 else 20
    assert len(result) == 3*categories*3*4, (edition,len(result))
    assert headers == 3*categories, (edition, headers)
    keys = [(r['campus_id'],r['report_year'],r['category'],r['geography']) for r in result]
    assert len(keys)==len(set(keys))
    for campus in CAMPUS:
        for year in years:
            for cat in CATEGORIES[:categories]:
                cells = [r for r in result if r['campus']==campus and r['report_year']==year and r['category']==cat[1]]
                assert len(cells)==4
                values={r['geography']:r['count'] for r in cells}
                if values['residential'] is not None and values['oncampus'] is not None:
                    assert values['residential']<=values['oncampus'], ('housing exceeds parent',cells)
    return result

def main():
    current_path=HERE/'asr_2026_newdraft.pdf'; old_path=HERE/'sdsu_2025_asr_comparison_source.pdf'
    assert digest(current_path)==CURRENT_SHA, 'Current source version changed; review before updating pin.'
    manifest=json.loads((HERE/'comparison_input_manifest.json').read_text(encoding='utf-8'))
    for name,expected in manifest.items(): assert digest(HERE/name)==expected
    listing=(HERE/'official_listing_current.html').read_text(encoding='utf-8')
    assert 'href="/_resources/files/asr_2026_newdraft.pdf"' in listing
    current=extract(current_path,2026,[2023,2024,2025],CURRENT_URL)
    old=extract(old_path,2025,[2022,2023,2024],OLD_URL)
    write_csv('current_asr_all_counts.csv',current); write_json('current_asr_all_counts.json',current)
    core=[r for r in current if r['family'] in ['criminal_offenses','vawa']]
    write_csv('current_asr_core_counts.csv',core); write_json('current_asr_core_counts.json',core)
    write_csv('prior_asr_all_counts.csv',old)
    old_index={(r['campus_id'],r['report_year'],r['category'],r['geography']):r for r in old}
    comparison=[]
    for r in current:
        key=(r['campus_id'],r['report_year'],r['category'],r['geography'])
        if key not in old_index:continue
        p=old_index[key]
        comparison.append({k:r[k] for k in ['campus_id','campus','report_year','category','family','geography']} | {
            'asr_2025_count':p['count'],'asr_2026_count':r['count'],'difference':r['count']-p['count'] if r['count'] is not None and p['count'] is not None else None,
            'same_numeric_value':r['count']==p['count'],'asr_2025_url':p['source_url'],'asr_2026_url':r['source_url']})
    write_csv('asr_2025_vs_2026_comparison.csv',comparison)
    federal=list(csv.DictReader((HERE/'frozen_federal_sdsu_counts.csv').open(encoding='utf-8-sig',newline='')))
    fi={(r['campus_id'],int(r['year']),r['family'],r['offense_code'],r['geography']):r for r in federal}
    fc=[]
    for r in current:
        if r['report_year']==2025 or r['category']=='hazing':continue
        code=next(c[3] for c in CATEGORIES if c[1]==r['category'])
        p=fi[(r['campus_id'],r['report_year'],r['family'],code,FED_GEO[r['geography']])]
        old_count=int(p['count']) if p['count'] else None
        fc.append({k:r[k] for k in ['campus_id','campus','report_year','category','family','geography']} | {
            'federal_2025_count':old_count,'federal_raw_value':p['raw_source_value'],'federal_status':p['status'],
            'asr_2026_count':r['count'],'asr_raw_value':r['raw_value'],'asr_status':r['status'],
            'difference':r['count']-old_count if old_count is not None and r['count'] is not None else None,
            'numeric_comparable':old_count is not None and r['count'] is not None,
            'federal_source_file':p['source_file'],'federal_source_row':p['source_sheet_row'],'federal_source_column':p['source_column'],
            'asr_2026_url':r['source_url']})
    write_csv('federal_2025_vs_asr_2026_comparison.csv',fc)
    totals=[]
    for campus in [*CAMPUS,'All three reporting campuses']:
        for year in [2023,2024,2025]:
            for geography in GEOGRAPHIES:
                selected=[r for r in current if r['family']=='criminal_offenses' and r['report_year']==year and r['geography']==geography and (campus=='All three reporting campuses' or r['campus']==campus)]
                assert len(selected)==(33 if campus=='All three reporting campuses' else 11)
                totals.append({'campus':campus,'report_year':year,'geography':geography,'category':'criminal_total',
                    'count':sum(r['count'] for r in selected),'component_count':len(selected),'source_edition':2026,
                    'interpretation':'Sum of eleven criminal-offense categories; excludes VAWA, arrests, referrals, hate classifications and hazing. Housing is a subset, not added to on-campus.'})
    write_csv('current_criminal_totals.csv',totals)
    geographic_totals=[]
    for campus in [*CAMPUS,'All three reporting campuses']:
        for year in [2023,2024,2025]:
            for category in [c[1] for c in CATEGORIES]+['criminal_total']:
                cells=([r for r in totals if r['campus']==campus and r['report_year']==year] if category=='criminal_total'
                    else [r for r in current if r['report_year']==year and r['category']==category and (campus=='All three reporting campuses' or r['campus']==campus)])
                values={}
                for geo in GEOGRAPHIES:
                    counts=[r['count'] for r in cells if r['geography']==geo]
                    values[geo]=None if any(v is None for v in counts) else sum(counts)
                nonoverlapping=[values[g] for g in ['oncampus','noncampus','publicproperty']]
                geographic_totals.append({'campus':campus,'report_year':year,'category':category,
                    'all_geographies_count':None if any(v is None for v in nonoverlapping) else sum(nonoverlapping),
                    'oncampus_count':values['oncampus'],'noncampus_count':values['noncampus'],'public_property_count':values['publicproperty'],
                    'housing_subset_count':values['residential'],
                    'formula':'oncampus + noncampus + publicproperty; housing is already included in oncampus',
                    'source_edition':2026})
    write_csv('current_nonoverlapping_geography_totals.csv',geographic_totals)
    # Source narrative totals have a different unit from the category tables.
    # Preserve separately; never add these classifications to criminal_total.
    narratives=[]
    reader=PdfReader(current_path)
    for campus,page_number in [('San Diego',10),('Imperial Valley',15),('Georgia',19)]:
        page_text=re.sub(r'\s+',' ',reader.pages[page_number-1].extract_text() or '')
        assert 'Unfounded Crimes' in page_text and 'Hate Crimes' in page_text
        for year in [2023,2024,2025]:
            for family in ['unfounded','hate_crimes']:
                value=(1 if year==2023 else 0) if campus=='San Diego' and family=='unfounded' else ({2023:0,2024:4,2025:8}[year] if campus=='San Diego' else 0)
                if value and family=='hate_crimes': assert f'There were {value} reported hate crimes' in page_text
                if value and family=='unfounded': assert 'There was one unfounded crime' in page_text
                narratives.append({'report_edition':2026,'report_year':year,'campus_id':CAMPUS[campus],'campus':campus,
                    'family':family,'geography':'not_geographically_split','count':value,'status':'reported_narrative_total',
                    'source_url':CURRENT_URL+f'#page={page_number}','pdf_pages':'10-11' if campus=='San Diego' and family=='hate_crimes' else str(page_number),
                    'note':'Source narrative total retained separately; hate classification may overlap crime categories; no addition to criminal_total.'})
    write_csv('current_narrative_totals.csv',narratives);write_json('current_narrative_totals.json',narratives)
    differences=[r for r in comparison if not r['same_numeric_value']]
    fed_differences=[r for r in fc if r['difference'] not in [0,None]]
    checks={'status':'PASS','selected_report_url':CURRENT_URL,'selected_report_sha256':CURRENT_SHA,
        'core_cells':len(core),'all_table_cells':len(current),'source_numeric_cells':sum(r['count'] is not None for r in current),
        'source_NA_cells':sum(r['count'] is None for r in current),'prior_asr_cells':len(old),
        'overlapping_asr_cells':len(comparison),'asr_changed_cells':differences,'federal_comparison_cells':len(fc),
        'federal_comparable_numeric_cells':sum(r['numeric_comparable'] for r in fc),'federal_noncomparable_cells':sum(not r['numeric_comparable'] for r in fc),
        'federal_numeric_differences':fed_differences,'housing_subset_checks':'All numerical residential cells are <= campus total in direct-linked current report.',
        'not_done':['No enrollment or occupancy values inferred for 2025.','No source revision explanation inferred.','No reinterpretation of printed zero as absence of housing.']}
    write_json('extraction_verification.json',checks)
    print(json.dumps({k:v for k,v in checks.items() if k not in ['asr_changed_cells','federal_numeric_differences']},indent=2))
    print('ASR_CHANGED',json.dumps(differences))
    print('FEDERAL_CHANGED',json.dumps(fed_differences))

if __name__=='__main__':main()
