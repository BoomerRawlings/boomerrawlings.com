# California DOJ benchmarks for San Diego

Acquired and checked 24 September 2026. Official public data; no account, API key, individual record data, statistical refit or existing publication change.

## Most consequential new evidence

The June 2026 DOJ documentation identifies **incomplete San Diego County Sheriff reporting for November–December 2024 and January–June 2025**. This appears in both the **Arrests/Arrest Dispositions context, page 7**, and the **Domestic Violence Related Calls for Service context, page 5**, under “Agency-Specific Data Characteristics and Limitations.” Both pages were text-extracted and visually checked. [Arrests context, p. 7](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Arrests%20Context_0615026.pdf#page=7); [DV context, p. 5](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Domestic%20Violence%20Related%20Calls%20for%20Service%20Context_06222026.pdf#page=5).

This establishes a gap in **DOJ submissions**, including months within the study's 2021–2024 period. It does not identify which supplied export records are missing, prove an RMS migration caused the gap, or validate an exact completeness percentage. The same agency and overlapping dates strengthen the concern; the undocumented export-to-DOJ crosswalk remains unresolved. A sensitivity omitting the documented late-2024 interval could test dependence on that interval, but cannot repair missing records or establish complete earlier reporting. No such new model is fitted here.

The Sheriff-named DV series contains a row for every month of 2025 despite the warning: January–May show **8, 8, 10, 6 and 12** reported calls; June has 65. A present row is therefore not evidence of a complete month. The official note names the Sheriff; whether its scope also covers each separately reported contract-city entity is not established by the dataset. Flags are applied to the named Sheriff entity only, with this limitation explicit.

## Acquired datasets and units

| Dataset | Acquired coverage | Geography / grain | Meaning and limitations |
|---|---|---|---|
| OnlineArrestData1980-2025.csv | 1980–2025; 111,882 statewide rows, 2,206 San Diego rows | Year × county of reporting agency × gender × race group × age group | Counts arrest/citation occasions, with the highest-severity offense selected when multiple offenses apply. Repeated arrests of a person can appear repeatedly. No agency field, offense date, DV flag, individual identifiers or population denominator. |
| DVRCA_2001-2025.csv | 2001–2025; 208,175 statewide rows; 8,038 San Diego agency-month rows | Reporting entity × month; 32 historical San Diego reporting names, 686 agency-year combinations | DV-related calls resulting in a written responding-agency report, including situations with and without arrest. Not every incoming telephone call, unique victim, substantiated incident or arrest. |
| NCIC Code Jurisdiction List_06182026.xlsx | Current published jurisdiction list with historical start/end fields | County, reporting name, jurisdiction code, start/end | Context for entity names. It is not an export-ID crosswalk, comprehensive boundary history or population table. |

These are the files linked by the official portal's publicly readable dataset API, revised July 1, 2026. The [2025 DOJ release](https://oag.ca.gov/node/625792) confirms the annual reporting release and warns that some agencies did not provide full-year data. Actual bytes, URLs, lengths and SHA-256 values are retained in `source_metadata.json`; dictionaries are downloaded unmodified.

The arrest definition comes from the [June 2026 arrest context, pp. 1–3 and 5–6](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Arrests%20Context_0615026.pdf): citations are included; only the most serious offense is counted for a multi-offense arrest. Since 2021, summary and incident-based reports are combined. Classification changes, incomplete submissions and gender reporting limitations affect comparisons. These broad felony categories cannot reproduce the study's nonexclusive charge categories or identify DV arrests.

The [DV context, pp. 1–4](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Domestic%20Violence%20Related%20Calls%20for%20Service%20Context_06222026.pdf) defines the measure under Penal Code 13700/13730 and notes agency variation in interpretation. Strangulation/suffocation fields begin in 2018; earlier blanks are retained as missing, not zero. Personal weapons include hands/feet/fists under stated aggravated-assault reporting rules. Weapon subcategories are not separate counts to add to total calls.

## Annual context — different populations and units

| Year | DOJ county arrests/citations | DOJ county DV calls | DOJ Sheriff-named entity DV calls | Supplied all source IDs | Supplied core-DV IDs |
|---|---:|---:|---:|---:|---:|
| 2018 | 84,693 | 17,511 | 2,503 | 12,092 | 988 |
| 2019 | 85,251 | 17,436 | 2,522 | 24,760 | 1,947 |
| 2020 | 69,453 | 17,683 | 2,487 | 18,589 | 1,838 |
| 2021 | 33,363 | 18,366 | 2,517 | 19,018 | 1,875 |
| 2022 | 55,321 | 17,501 | 2,397 | 18,317 | 1,674 |
| 2023 | 60,268 | 16,666 | 2,158 | 18,096 | 1,682 |
| 2024 | 59,461 | 15,682 | 1,717 | 17,121 | 1,574 |
| 2025 | 57,114 | 14,979 | 1,078 | 8,283 | 900 |

DOJ county totals aggregate reporting entities across San Diego County. The Sheriff-named DV row is only that named reporting entity. **Vista, San Marcos and other jurisdictions appear as separate DOJ entities**; do not label the Sheriff row as all calls handled throughout the Sheriff's service area. A reporting entity label is not proof of a separate municipal police department. The official jurisdiction workbook distinguishes these names/codes; it does not establish the exact operational overlap. Never add the county total to its agency components.

The supplied source-ID columns preserve the original grouping, with 2018 starting in July and 2025 incomplete. They are not countywide arrest counts. Monthly comparisons use only source IDs with an unambiguous month; monthly totals can differ from annual totals because conflict screens differ. `monthly_context_comparison_2018_2025.csv` has these measures in separate columns; blank export values before July 2018 mean no supplied period. **No call-to-arrest conversion, match rate, completeness ratio or combined count is calculated.**

The current arrest bulk file reports 33,363 San Diego county arrests/citations for 2021, materially lower than adjacent years. That value is reproduced directly from the downloaded cells, not independently explained or validated as a real decline. The official interactive all-offense query returned HTTP 500; a separate duplicate cross-check was not available. Treat the historical trajectory as reported administrative totals with unresolved reporting variation, not a heat or enforcement conclusion.

## Validation and source cautions

- All five downloads match the official byte lengths. Source hashes recorded; no original bytes edited.
- Both CSV natural keys are unique. Numeric reported values are nonnegative; felony and weapon-component sums reconcile.
- San Diego monthly, agency-year and county-year DV totals reconcile exactly. Missing agency-months are listed, never silently zero-filled; 12 present months do not guarantee completeness.
- Statewide DV totals reproduce the official July 2026 release: **163,024 in 2024; 157,416 in 2025**. This checks extraction, not case ascertainment.
- The statewide DV file has **225 agency-month rows where weapons-involved exceeds total calls**, all outside San Diego (2022–2024). They are preserved and exported to an anomaly audit. No San Diego row has that inconsistency. Do not generalize unqualified statewide weapon proportions from this file.
- The latest statewide 2023 DV total is 160,467. Earlier published totals may differ; the current dictionary describes a retrospective Oakland correction. Versioned downloads must not be mixed silently.
- Historical name `Colorado DPR` lacks an exact match in the current jurisdiction workbook. It is retained without forced aliasing; no counts dropped.
- **No population denominators are present.** No municipal rate, resident risk or geographic ranking is constructed. Agency-level arrest aggregates are absent from the acquired arrest bulk file and current arrest explorer's county-only interface; no Sheriff arrest total is inferred from it.

`normalization_verification.json` records completed checks and source warnings. Source definitions and reporting caveats take precedence over apparent numerical precision.

## Deliverables and reproduction

- `aggregates/san_diego_dv_calls_agency_month_2001_2025.csv`: all supplied San Diego monthly DV cells, nullable pre-2018 fields, original entity labels, matching jurisdiction codes and reporting notes.
- `aggregates/san_diego_dv_calls_agency_year_2001_2025.csv`: annual sums of observed months, counts of months, missing-month lists and explicit warnings.
- County DV year/month tables; county arrest year × all/adult/juvenile scope tables; jurisdiction listing; statewide control totals.
- Separate annual/monthly comparisons with the study's previously published aggregate tables, included as `comparison_inputs/` for reproducibility.
- `acquire_doj.py`: read-only official download acquisition using the frozen URL/hash manifest; fails if downloaded bytes differ. `normalize_doj.py`: standard CSV aggregation plus openpyxl for the jurisdiction workbook. No API key, fitting, private arrest file or account access required.
- `DATA_DICTIONARY.md`: field definitions and non-additivity rules. `source_metadata.json`: URL/hash manifest. `public_package_manifest.json`: packaged-file hashes.

Use Python 3.10 or newer with `openpyxl` installed; run `python acquire_doj.py`, then `python normalize_doj.py`. The acquisition script verifies existing files or downloads missing files, and stops on any changed hash. `doj-san-diego-benchmarks.zip` includes normalized aggregate CSVs, scripts, documentation, source hashes, validation records and already-public comparison inputs. Raw bulk sources and dictionaries remain available at their official URLs and are downloaded locally by the script; they are not duplicated in the package. Exploratory site-JavaScript copies, individual source records and private flags are excluded. No model is refitted: published models still include the documented late-2024 interval, whose relationship to the supplied export remains unverified.

## Direct official source links

1. [Arrest dataset portal](https://openjustice.doj.ca.gov/data/arrests) and [1980–2025 CSV](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/OnlineArrestData1980-2025.csv).
2. [DV calls dataset portal](https://openjustice.doj.ca.gov/data/domestic-violence-related-calls-assistance) and [2001–2025 CSV](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/DVRCA_2001-2025.csv).
3. [Agency/jurisdiction portal](https://openjustice.doj.ca.gov/data/agency-name-jurisdiction-listing) and [June 2026 workbook](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/NCIC%20Code%20Jurisdiction%20List_06182026.xlsx).
4. [Arrest dictionary/context](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Arrests%20Context_0615026.pdf); [DV dictionary/context](https://data-openjustice.doj.ca.gov/sites/default/files/dataset/2026-07/Domestic%20Violence%20Related%20Calls%20for%20Service%20Context_06222026.pdf).
5. [DOJ 2025 annual statistical release, July 1, 2026](https://oag.ca.gov/node/625792).
