# Campus safety, in proportion

Study snapshot: 25 September 2026. Calendar report years 2022–2024. Fixed purposive cohort: 42 institutions. Public study: https://boomerrawlings.com/writing/data-analysis/campus-safety/

Reported Clery offenses relative to enrollment and, where documented, actual housing occupancy. These are descriptive reporting ratios, not victimization probabilities, causal effects or safety rankings. Read `PROTOCOL.md`, `AMENDMENT.md`, source coverage notes and the separate audits before interpreting values.

## Offline reproduction

Python 3.12 or later; standard library only for the rate builder and independent numerical audit.

```text
python build_study.py
python sources/enrollment/audit_published_rates.py
```

The first command reconstructs `publication/data/dataset.json`, all annual/pooled rates and the explicitly separate ASR housing example from the packaged aggregate input extracts. The second independently reconstructs source-campus sums, joins annual populations once per institution and verifies every published rate without importing the production builder. Compare results to `PACKAGE_MANIFEST.json`. Audit timestamps can change; the numerical study data are deterministic.

Population inputs can also be reproduced offline:

```text
python sources/enrollment/build_denominators.py
python sources/enrollment/build_occupancy.py
```

These use the supplied, hash-verified cohort-only source extracts when nationwide ZIPs are absent. See `sources/enrollment/ENROLLMENT_METHODS.md` for the field definitions and release vintages.

## Original-source extraction

National federal and IPEDS source archives are not duplicated here. Their successful URLs, retrieval metadata and SHA-256 hashes are provided. Clery XLS extraction requires the original 2025 ZIP and `xlrd`; the separate claim-value verification reads original XLS and IPEDS CSV ZIPs directly. Follow `sources/clery/CLERY_SOURCES.md` and the acquisition scripts. Revisions at a mutable source URL must create a new documented source version, not silently overwrite the frozen study.

The public package contains no individual victim records or raw API contact payloads. Its reporting-campus records describe institutions and aggregate administrative measures.

## Files

- `publication/data/`: website dataset, category dictionary, 5,670 annual rates, 1,890 pooled rates, and eight ASR housing-comparison calculations.
- `sources/clery/`: approved federal source extracts, field/row provenance, identifier checks, coverage/applicability rules and extraction code.
- `sources/enrollment/`: 126 annual enrollment and 33 housing-occupancy rows, source-specific flags, cohort extracts and independent calculation audit.
- `research/`: primary-source review, source ledger, institutional ASR cell comparisons and the separate citation audit.
- `website/`: study methods, presentation and interactive calculation code as reviewed for publication.
- `output/pdf/`: report and exact output metadata. PDF regeneration uses ReportLab, pypdf and the documented Windows fonts; these are not required to reproduce the statistical data.
- `PACKAGE_MANIFEST.json`: byte sizes and SHA-256 hashes of packaged files, excluding the manifest itself.

Missing cells are not zero. All-branch scope differs from a named main campus. Current 2024 no-housing declarations are not applied retrospectively. Resident ratios are approximate because housing-property boundaries remain unmatched. SDSU IPEDS versus campus/Auditor enrollment remains unresolved and explicitly disclosed. The completed Crime and Heat study is a separate analysis.

## Presentation revision

The September 2026 interface revision adds sortable headings, full-name/abbreviation definitions and reciprocal numbered source notes. See `research/PRESENTATION_REVISION.md` for the separate review. Numerical inputs, rates and report bytes remain unchanged. The original source-audit hash record is retained within the citation ledger's revision metadata; current presentation files have their own reviewed hashes.

`research/build_citation_audit.py` is a historical audit recorder, not a source-reading or peer-review engine. It refuses to overwrite a ledger containing later presentation revisions. It is not part of the offline numerical reproduction commands above. The selected `website/` modules document the reviewed interface; the full website and build configuration remain in the website repository.
