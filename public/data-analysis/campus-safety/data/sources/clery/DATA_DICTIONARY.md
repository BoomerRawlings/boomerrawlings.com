# Normalized Clery fields

All counts originate in the 2025 federal collection (reporting years 2022–2024). No rates or rankings are calculated by this source pipeline.

## Counts

`cohort_campus_counts_2022_2024.csv` has one row per campus × report year × outcome family × geography × offense. `source_file`, `source_sheet_row` (Excel 1-based including header) and `source_column` identify the exact original cell. `collection_year` differs from report `year`.

- `unitid`: institutional IPEDS identifier, independently matched to OPEID and official API institution ID.
- `campus_id`: original `UNITID_P`, retained as text. `institution_label` and `cohort` come from the fixed protocol; `branch` from the frozen source.
- `family`: `criminal_offenses`, `vawa`, `hate_crimes`, `arrests`, `disciplinary_referrals`, or `unfounded`.
- `geography`: `on_campus`, `residential_facilities`, `noncampus`, `public_property`, `local_state_police_reported`, or `not_geographically_split` for unfounded crimes.
- `offense_code`: original field prefix without the two-digit year. Original codebook labels are retained in `notes/codebook_fields_2025.json`.
- `raw_source_value`: original nonnegative integer, or blank for the source's blank cell.
- `source_year_filter`: original `FILTER22/23/24`. Its codebook does not explain why a campus has 0.
- `count`: equals the numeric original only when the filter is 1 and a number is present. Otherwise blank, never a default zero.
- `status`: `reported_numeric`, `year_filter_0`, or `blank_source_cell`.

The institutional table groups by UNITID within each year/family/geography/offense. `count` is present only when every selected campus has a usable numeric cell. `observed_sum` is the sum of present numbers; it is explicitly partial when status is incomplete. `campus_count`, `numeric_campus_count`, `year_filter_0_campuses`, and `blank_campuses` expose that distinction.

## Families

Criminal prefixes: MURD, NEG_M, RAPE, FONDL, INCES, STATR, ROBBE, AGG_A, BURGLA, VEHIC, ARSON. The sum of those 11 may be described as `Listed criminal offenses`; it does not include VAWA/hate/arrests/referrals and is not a unique-incident total.

VAWA: DOMEST, DATING, STALK. Arrest/referral: WEAPON, DRUG, LIQUOR. Hate has 14 offense totals, including SIM_A, LAR_T, INTIM and VANDAL, plus eight bias breakdowns per offense. All bias cells remain in `cohort_hate_bias_wide_2025.csv` and raw cohort extracts. Do not add offense totals to their bias components or to the principal criminal table. Unfounded has UNFOUN, reported separately.

Housing is a subset of on-campus geography. The local/state-police table is unallocated Clery-geography data, not a duplicate generic police measure. See the cited official definitions in `CLERY_SOURCES.md`.

## Special 2024 residential aggregate

`cohort_institution_residential_2024_applicable_geography.csv` is a separately labeled derivation. It retains numeric frozen counts and excludes only blank cells corroborated by the current official API's explicit no-housing declaration for SurveyYear 2024. `corroborated_no_housing_campus_count` and its campus-ID list distinguish excluded geography from zero reports. All 42 institutions have a resolved 2024 numerator under this rule. Historical values remain unchanged. The rule does not establish alignment with a housing-occupancy denominator. See `COVERAGE.md` and the per-campus applicability table.

## Context and enrollment

The bulk's single men/women/total enrollment triplet repeats across branches; do not sum it or use it for three separate years. Independent IPEDS comparisons identify those cohort totals as fall 2024. Annual denominators live in the separate enrollment acquisition.

`cohort_campus_context_current.json` preserves country flags, branch name and exact housing statement from a separate official API snapshot. Staff-contact sections and the free-text campus `Description` field are excluded because descriptions sometimes contain contact numbers. `SurveyYear=2024` is the API's field, not the bulk collection-year label. Geography CSVs use `CountryIsUS=true` to supply United States when the country string is null. Source URLs and response hashes remain attached. Context notes are source text, not instructions or verified institutional explanations beyond their attribution.
