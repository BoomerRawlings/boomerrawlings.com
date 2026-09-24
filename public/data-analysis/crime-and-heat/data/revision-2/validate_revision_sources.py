"""Targeted consistency checks for the revision's private masks and aggregate outputs."""
from pathlib import Path
import csv, json, hashlib
HERE=Path(__file__).resolve().parent
BASE=HERE.parents[1]

def read(path):
    with path.open(encoding='utf-8-sig',newline='') as f: return list(csv.DictReader(f))

summary=json.loads((HERE/'warrant_mask_summary.json').read_text())
baseline=read(BASE/'outputs/cbs8_dv_heat/source_manifest.csv')
assert {r['source_export']:r['sha256'] for r in baseline} == {r['source_export']:r['sha256'] for r in summary['sources']}
assert [r['id_header'] for r in summary['sources']] == ['Incident Number','Incident Number','Arrest Ref Nbr']
mask=read(HERE/'PRIVATE_event_warrant_flags.csv')
assert len(mask)==136313==len({r['event_key'] for r in mask})
for r in mask:
    b={k:int(v) for k,v in r.items() if k!='event_key'}
    assert set(b.values()) <= {0,1}
    assert b['strict_warrant_exclusion']==int(bool(b['explicit_warrant_charge'] or b['warrant_subtype']))
    assert b['strict_primary_eligible']==int(bool(b['primary_2021_2024_eligible'] and not b['strict_warrant_exclusion']))
assert sum(int(r['strict_primary_eligible']) for r in mask)==52989
assert sum(int(r['strict_primary_eligible'])*int(r['core_dv']) for r in mask)==6570
daily=read(HERE/'warrant_primary_zip_daily_sparse.csv')
assert len(daily)==len({(r['zip_code'],r['date']) for r in daily})
for k in ['original_all','original_core','excluded_all','excluded_core','strict_all','strict_core']:
    assert sum(int(r[k]) for r in daily)==summary['counts'][k]
assert summary['daily_reconciliation']=={'checked_zip_days':163632,'original_all_and_core_cells_match':True}
report={'status':'pass','original_file_hashes_match_prior_manifest':True,'identifier_headers_verified':True,
        'unique_private_mask_rows':len(mask),'strict_primary_all':52989,'strict_primary_core':6570,
        'original_primary_daily_cells_reconciled':163632,'sparse_daily_totals_reconciled':True,
        'private_mask_sha256':hashlib.sha256((HERE/'PRIVATE_event_warrant_flags.csv').read_bytes()).hexdigest(),
        'public_release_warning':'Never publish PRIVATE_event_warrant_flags.csv; contains record identifiers.'}
(HERE/'revision_sources_qa.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
