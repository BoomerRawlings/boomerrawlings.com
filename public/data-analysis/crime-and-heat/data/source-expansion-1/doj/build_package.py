"""Build a public-safe supplement from an explicit file allowlist (no raw sources)."""
from pathlib import Path
import csv, hashlib, json, re, zipfile
HERE=Path(__file__).resolve().parent

def read(name):
    with (HERE/name).open(encoding='utf-8-sig',newline='') as f:
        return list(csv.DictReader(f))

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

qa=json.loads((HERE/'normalization_verification.json').read_text())
annual=read('aggregates/annual_context_comparison_2018_2025.csv')
for row in annual:
    for key in row:
        if key=='year' or key.startswith(('doj_county_','doj_sheriff_named_entity_','doj_vista_named_entity_','doj_san_marcos_named_entity_','supplied_export_')):
            row[key]=int(row[key])
summary={
 'status':'VERIFIED_WITH_DOCUMENTED_SOURCE_LIMITATIONS',
 'snapshot_date':'2026-09-24',
 'release_date':'2026-07-01',
 'years':{'county_arrests_citations':[1980,2025],'dv_calls_agency_month':[2001,2025]},
 'observations':{key:qa[key]for key in ['statewide_dv_source_rows','statewide_arrest_source_rows','san_diego_dv_agency_month_rows','san_diego_dv_agency_year_rows','san_diego_distinct_reporting_names','san_diego_arrest_demographic_rows']},
 'important_finding':{
  'claim':'Official DOJ context documents identify incomplete San Diego County Sheriff submissions in November–December 2024 and January–June 2025.',
  'confirmed_scope':'DOJ submissions; exact overlap with supplied arrest exports and separately labeled contract jurisdictions unresolved',
  'not_established':['precise missing export records','complete earlier months','RMS migration causation','completeness percentage'],
  'sources':[
   {'title':'Arrests/Arrest Dispositions context, revised June 2026','page':7,'section':'Agency-Specific Data Characteristics and Limitations','url':'https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Arrests%20Context_0615026.pdf#page=7'},
   {'title':'Domestic Violence Related Calls for Service context, revised June 2026','page':5,'section':'Agency-Specific Data Characteristics and Limitations','url':'https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Domestic%20Violence%20Related%20Calls%20for%20Service%20Context_06222026.pdf#page=5'}]},
 'unit_definitions':{
  'dv_calls':'Reported DV-related calls resulting in a written responding-agency report, with or without arrest; not all incoming calls or unique victims.',
  'arrests_citations':'County-of-reporting-agency arrest/citation occasions; highest-severity offense selected; not unique people.',
  'supplied_export':'Previously published source-file-scoped ID groups; distinct unit and incomplete agency/date coverage.'},
 'scope_limits':[
  'No population denominators.',
  'Arrest bulk download has no agency field or DV flag; no Sheriff arrest total derived.',
  'County DV sums include separate reporting entities; Sheriff-named row is not certified as all Sheriff-service-area calls.',
  'Agency-month presence is not complete reporting; missing rows are not zero-filled.',
  'Strangulation/suffocation before 2018 remains missing.',
  '2021 San Diego arrest/citation total 33363 is reproduced from the bulk file; sharp decline is unexplained, not established as real.',
  '225 statewide weapon>total-call rows preserved, none San Diego.'],
 'annual_context':annual,
 'models_refitted':False,
 'model_caveat':'Existing published models still include the documented late-2024 interval; this acquisition update does not revise fitted estimates.',
 'public_data_contains_individual_records':False,
 'public_package_omits_raw_bulk_sources':True,
 'official_release_url':'https://oag.ca.gov/node/625792',
 'csv_outputs':[{'path':p.relative_to(HERE).as_posix(),'rows':len(read(p.relative_to(HERE))),'bytes':p.stat().st_size,'sha256':digest(p)}for p in sorted((HERE/'aggregates').glob('*.csv'))]
}
(HERE/'benchmark_summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
files=[HERE/name for name in ['DOJ_BENCHMARKS.md','DATA_DICTIONARY.md','source_metadata.json','benchmark_summary.json','normalization_verification.json','acquisition_verification.json','acquire_doj.py','normalize_doj.py','build_package.py']]
files+=sorted((HERE/'aggregates').glob('*.csv'))
files+=sorted((HERE/'comparison_inputs').glob('*.csv'))
assert len(files)==21
for p in files:
    content=p.read_text(encoding='utf-8-sig')
    assert not re.search(r'[A-Z]:[\\/]',content),f'Machine path in {p.name}'
    if p.suffix=='.csv':
        fields=next(csv.reader(content.splitlines()))
        assert not any(re.search(r'^(event_key|source_id|incident_number|arrest_ref|dob|date_of_birth|address|name)$',x,re.I)for x in fields),f'Private key in {p.name}'
manifest={'scope':'Public normalized aggregates, documentation and reproducible scripts only; original official bulk files fetched upstream, no private source records.','files':[{'path':p.relative_to(HERE).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)}for p in files]}
(HERE/'public_package_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
files.append(HERE/'public_package_manifest.json')
archive=HERE/'doj-san-diego-benchmarks.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
    for p in files:z.write(p,p.relative_to(HERE).as_posix())
with zipfile.ZipFile(archive)as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(files)
    for p in files:assert hashlib.sha256(z.read(p.relative_to(HERE).as_posix())).hexdigest()==digest(p)
verification={'status':'PASS','file_count':len(files),'archive_bytes':archive.stat().st_size,'archive_sha256':digest(archive),'raw_bulk_included':False,'machine_paths_found':False,'private_identifiers_found':False,'zip_entries_match_sources':True}
(HERE/'package_verification.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
print(json.dumps(verification,indent=2))
