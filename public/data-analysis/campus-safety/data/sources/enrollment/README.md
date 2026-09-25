# Campus denominator source package

Ready: 126 institution-year enrollment denominators; 33 primary actual-occupancy denominators; identity validation for 42 institutions. Primary period: 2022–2024. Auditor 2019–2024 occupancy retained as context.

- Read `ENROLLMENT_METHODS.md` before joining populations to offenses.
- `DATA_DICTIONARY.md` defines curated fields; provenance files retain versions, URLs, hashes and pages.
- `python build_denominators.py` and `python build_occupancy.py` reproduce CSVs offline from the small aggregate inputs. Download helpers are separate.
- `python audit_published_rates.py` independently audits published rates; requires the companion Clery and publication directories.
- `INDEPENDENT_NUMERICAL_AUDIT.json` records audited publication hashes; rerun after those files change.

Enrollment is not an on-site or resident population. Housing occupancy counts actual students, but Clery property boundaries are unmatched. SDSU's 2024 IPEDS total is 41,137 versus CDS/Auditor 39,373; the full population reconciliation remains unresolved. Primary rates consistently use IPEDS.

`artifact_manifest.json` is the curated public allowlist. Nationwide raw ZIPs, full PDFs, rendered images and temporary replay directories are excluded. Source URLs permit independent retrieval; publisher access and revisions can change.
