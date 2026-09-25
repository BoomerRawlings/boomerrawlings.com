# Federal source extracts: 2025 collection

These are public administrative aggregates for a fixed 42-institution cohort. The frozen 2025 federal collection supplies report years 2022–2024. No individual incident or victim records are included. See [definitions](DATA_DICTIONARY.md), [coverage rules](COVERAGE.md) and [official-source citations](CLERY_SOURCES.md).

## Files for analysis

- `normalized/cohort_campus_counts_2022_2024.csv`: 108,756 source-derived campus cells; all five geographies, separate outcome families, missing values and cell references.
- `normalized/cohort_institution_counts_2022_2024.csv`: 21,546 strict institutional aggregates; incomplete totals remain blank.
- `normalized/cohort_institution_residential_2024_applicable_geography.csv`: separate 2024 housing derivation. Numeric frozen counts are retained; 109 branches with blank housing cells and explicit 2024 no-housing declarations are excluded as absent geography. Historical blanks are never backfilled.
- `normalized/cohort_campus_residential_applicability_2024.csv`: category-level evidence for each housing inclusion/exclusion.
- Institutional/campus crosswalks, year availability and geographic scope: exact branch membership and source identifiers.
- `normalized/cohort_campus_context_current.json` and `cohort_context_notes_current.json`: sanitized, separately dated official API context; no staff-contact sections. Current caveats do not overwrite frozen counts.
- `normalized/raw_cohort_*.csv` and `cohort_hate_bias_wide_2025.csv`: cohort-only original aggregate cells, including bias components. These are not individual records.

The [primary source manifest](source_metadata_primary_2025.json) identifies only the 2025 collection ZIP and instructions, with SHA-256 hashes. The original national files remain available upstream. Historical archives acquired during research are not part of this primary release. The sanitized API snapshot has its own [response provenance](context_source_metadata_public.json); full responses contain staff contacts and are excluded.

## Reproduce frozen counts

Requires Python 3.10+, `xlrd==2.0.2` and `openpyxl`. Install libraries in your preferred environment; no bundled machine-specific runtime is needed. Keep the study's `sources/clery/` directory structure and the separately provided `sources/enrollment/institution_crosswalk_verified.csv`.

```text
python acquire_primary_clery.py
python build_crosswalk.py
python normalize_clery.py
python audit_identifiers.py
python derive_residential_2024.py
```

Run from this directory or use each script's full path. Acquisition verifies exact source hashes and stops if the upstream bytes changed. `build_crosswalk.py` safely extracts and verifies archive members. The normalization reads the originals without modifying them. The frozen sanitized API context supplied with this package is an input to identifier/geography checks and the 2024 applicability derivation.

`acquire_context.py` is an optional provenance utility for re-querying the public API. It is **not required** to reproduce this frozen release. Running it can retrieve a later source vintage and writes full local responses under `raw/api/`; do not include those responses in a public package. A newly retrieved snapshot must be reviewed separately before replacing the frozen context.

`audit_publication_from_raw.py` independently reads the four original criminal/VAWA workbooks directly from the ZIP and checks the study dataset, institutional categories, missingness, source geography, and derived annual/pooled arithmetic. It does not import the production normalizer or study builder. The rate calculation uses the published population inputs; independent denominator extraction is documented separately.

## Code and publication boundary

The scripts were written for this study. They are not Department of Education software and are not endorsed by that agency. Federal source values are not instructions. Every count retains its source field and report/collection year. No source text controls execution.

`PUBLIC_FILES.json` is the release allowlist with file hashes. Publish only its listed paths for this source component. Exclude raw national downloads, full campus API responses, locally installed libraries, exploratory web copies and internal historical manifests. The source package may be placed within the wider study archive; preserve relative paths for offline reproduction.
