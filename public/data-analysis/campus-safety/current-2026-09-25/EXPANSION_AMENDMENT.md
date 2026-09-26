> HISTORICAL RECORD: The 25 September expansion is superseded by RESIDENT_GAP_AMENDMENT.md for resident coverage, population additions, interface and report version. Its old report checksum identifies the earlier release.

# Campus safety: resident and source-coverage expansion

This scientific revision supersedes the earlier presentation-only amendment. Source acquisition is dated September 25, 2026 Pacific time; retrieval timestamps retain their original Coordinated Universal Time values. It expands the institutional series while preserving the separately labeled federal archive and all Crime and Heat files.

## Verified coverage and adopted changes

| Measure | Before expansion | Current |
|---|---:|---:|
| Institutions with extracted current tables | 39 / 42 | 42 / 42 |
| Usable combined housing counts, 2024 | 29 / 42 | 33 / 42 |
| Adopted resident populations, 2024 | 11 / 42 | 13 / 42 |
| Paired combined housing rates, 2024 | 10 / 42 | 13 / 42 |

Current products contain 36,652 source cells across 217 branches, 39,268 displayed/derived geography cells and 9,450 annual/pooled category-population combinations. Those combinations include unavailable results. Table acquisition does not certify reporting completeness. The comparison counts above apply specifically to the combined eleven-category criminal-offense housing view for 2024.

Five actual student-resident observations were added: Carnegie Mellon 2022 **3,458**, 2023 **3,764**, 2024 **3,988**; Stanford 2024 **14,203** and 2025 **14,042**. Original California resident values and federal enrollment values remain unchanged. The single 2025 resident denominator does not produce a complete current institutional 2025 rate: Stanford's overseas counts lack consistent same-year coverage. No prior population is carried forward.

`population_sources.csv` provides exact source pages, dates, values, hashes and qualifications. Carnegie Mellon counts university and separately listed fraternity/sorority housing; its housing office states that on-campus housing is unavailable to graduate students. The source's Pittsburgh label and university-wide 2024 total remain a scope qualification. Stanford counts actual students in university-provided undergraduate/graduate housing. Its 2024 university-authored factbook came from a publisher mirror because the official original became unavailable; identical original bytes cannot be authenticated. The 2025 source is the current official Stanford page. Neither new nor retained housing denominator is claimed to match every Clery parcel or branch.

Capacity, percentage-derived estimates, partial student subsets and possible student/dependent mixtures remain nonadopted candidates. In particular, Texas's spring 2024 **10,018 residents** are not demonstrably student-only. That source remains documented, without entering a rate denominator. Failure to adopt a candidate is not proof that no usable source exists elsewhere.

## Source recovery and narrower exclusions

Original Merced, Harvard, Johns Hopkins and Virginia reports were recovered. Independent checks covered Merced's 168 cells, Harvard's 1,176 cells and Virginia's 1,008 cells; Hopkins and Stanford also received separate full-grid reviews. Harvard retains 378 unknown absent-column cells before any separately supported structural interpretation. Virginia's original report agrees with the prior transcription. Hopkins retains its printed title **2025**, future printed issue date **October 1, 2026**, and actual **2023-2025** table years; no inferred relabeling resolves that discrepancy.

The newly linked Stanford main-campus and Princeton reports add 2025, with source attribution retained by branch and year. Updates replace exact cell identities only; `superseded_source_cells.csv` preserves displaced records. An explicit adjudication ledger distinguishes genuine zeros, structural absence, combined definitions and unresolved ambiguity. Chicago's no-housing evidence and Michigan's unambiguous residential subset are treated narrowly; inconsistent components elsewhere are not automatically restored. Carnegie Mellon's conflicting 2025 fondling cells remain withheld. Combined domestic/dating categories, missing geographic columns and incomplete external-agency returns remain qualified or unavailable.

Expanded evidence is packaged under `expansion/` as aggregate comma-separated values (CSV), JavaScript Object Notation (JSON), Markdown documentation and Python audit code. Original reports, webpage responses, private records and caches are excluded. Website copy, detailed explorer and relevant tests are preserved under `interface/`; the navigation map adds no scientific measurements.

## Revised report and preservation boundary

The ten-page campus report explains updated coverage, five adopted populations, candidate exclusions and source limitations, and directly cites the added resident sources. Every page was rendered and inspected; both annual and pooled equations retain proper notation. Separate citation review accepted the new source uses. The Portable Document Format (PDF) files below are identified by their Secure Hash Algorithm 256-bit (SHA-256) checksums.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| Campus safety current report, 10 pages | 223,688 | `f8c7deed2cc17897077b48565f62bd2592f89e9d58a232f62a975ec87cadb97b` |
| Preserved Crime and Heat source-refresh PDF, 2 pages | 108,730 | `f6ce724d1450fba85601db40b46e5d59122d4191e254e81b5fe06bd517d2cba3` |

Current campus data products and the campus PDF intentionally change. All original federal assets and every Crime and Heat asset must preserve their preceding-release hashes. The `--campus-only` packaging mode exits before Crime release operations; the report builder also supports `--campus-only` and verifies the existing Crime PDF against its recorded metadata.

## Audit status and reproduction

`CURRENT_DATA_AUDIT`, `CURRENT_CITATION_AUDIT`, `READER_COPY_AUDIT`, `VISUAL_AUDIT` and `PDF_VISUAL_AUDIT` have distinct scopes; their hashes/versions govern their claims. The README gives portable standard-library replay commands and names all **ten** products, including the new population and superseded-cell ledgers.

**Historical evidence:** `PRESENTATION_AMENDMENT.md` describes the prior unchanged-science, 10/42 presentation release. `RELEASE_PACKAGE_CHECK.json` records an earlier eight-output candidate replay. Neither certifies this expansion. The expanded archive passed clean extraction, manifest verification, ten-output byte-identical replay and packaged-text privacy review; see `EXPANSION_REPLAY_AUDIT.json`. Federal and Crime/Heat assets remain byte-identical to the preceding release. The final archive checksum is recorded in the public artifact manifest rather than inside the archive itself.
