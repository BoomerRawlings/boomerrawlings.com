"""Write the explicit, contact-free source-component publication allowlist.

No copy or publication is performed. Only listed study-owned files are approved;
raw API responses, national archives, local libraries and history are excluded.
"""
from pathlib import Path
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
names = [
    'README.md', 'CLERY_SOURCES.md', 'COVERAGE.md', 'DATA_DICTIONARY.md',
    'PUBLICATION_SOURCE_AUDIT.md', 'cohort_manifest.json',
    'source_metadata_primary_2025.json', 'context_source_metadata_public.json',
    'normalization_verification.json', 'identifier_validation.json',
    'residential_applicability_2024_verification.json', 'publication_raw_audit.json',
    'acquire_primary_clery.py', 'build_crosswalk.py', 'normalize_clery.py',
    'acquire_context.py', 'audit_identifiers.py', 'derive_residential_2024.py',
    'audit_publication_from_raw.py', 'build_public_manifest.py',
    'notes/codebook_fields_2025.json',
]
names += [p.relative_to(HERE).as_posix() for p in sorted((HERE / 'normalized').glob('*.csv'))]
names += ['normalized/cohort_campus_context_current.json', 'normalized/cohort_context_notes_current.json']
assert len(names) == len(set(names))
contexts = json.loads((HERE / 'normalized/cohort_campus_context_current.json').read_text(encoding='utf-8'))
allowed_context = {'UnitID','Name','Addr1','City','StateCode','Zip','CountryIsUS','Country','OnCampusHousingInfo','LocalCrimeInfo','SurveyYear','MatrixString','unitid','label','source_url','source_sha256','verified_utc','interpretation'}
assert all(set(r) == allowed_context for r in contexts)
records = []
for name in sorted(names):
    path = HERE / name
    data = path.read_bytes()
    text = data.decode('utf-8-sig')
    assert not re.search(r'[A-Za-z]:[\\/](?:Users|projects)[\\/]', text), 'Machine path: ' + name
    assert not re.search(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', text, re.I), 'Email-like string requires review: ' + name
    records.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
manifest = {
    'status': 'APPROVED_SOURCE_COMPONENT',
    'collection_year': 2025,
    'report_years': [2022, 2023, 2024],
    'relative_root': 'sources/clery',
    'file_count': len(records),
    'total_bytes': sum(r['bytes'] for r in records),
    'code_provenance': 'Study-authored Python extraction/verification scripts; no agency endorsement. Primary files verified with original source SHA-256 hashes. API context uses an explicit whitelist and excludes descriptions/contact sections.',
    'exclusions': ['raw/', 'extracted/', '_deps/', 'source_metadata.json', 'context_source_metadata.json', 'acquire_clery.py', 'source_summary.json', 'Exploratory source copies and internal historical archives'],
    'external_dependencies': ['The fixed cohort protocol at ../../PROTOCOL.md', 'The separately published IPEDS/occupancy source extracts under ../enrollment/', 'Original 2025 national archive and instructions obtainable using acquire_primary_clery.py'],
    'privacy_checks': ['No machine-specific absolute paths', 'No email-like strings', 'Exact context key whitelist', 'Raw API contacts and Description field excluded'],
    'files': records,
}
(HERE / 'PUBLIC_FILES.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': manifest['status'], 'files': len(records), 'bytes': manifest['total_bytes']}, indent=2))
