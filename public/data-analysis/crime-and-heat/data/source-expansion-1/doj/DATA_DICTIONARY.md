# Normalized benchmark data dictionary

All files contain public aggregate counts, not identifiable arrest records. CSV files use UTF-8 with a byte-order mark. Blank numeric cells mean missing/not collected, never a silently imputed zero. Counts are integers. Source URLs and unmodified-file hashes are in `source_metadata.json`.

## DV calls tables

Primary grain: reporting entity × calendar month. The source county is the county of the reporting agency. These are domestic-violence-related calls resulting in a written report by the responding agency; an arrest need not occur. The source is not an enumeration of all incoming telephone calls, unique people, or adjudicated events. See the official DV context, pages 1–4, linked in `DOJ_BENCHMARKS.md`.

| Field | Definition |
|---|---|
| `year`, `month`, `year_month` | Reporting year/month, and derived YYYY-MM label. |
| `county`, `agency_name` | Source county and original reporting-entity label; entity may be a contract jurisdiction rather than an independent police department. |
| `jurisdiction_code` | Exact name match to the current official jurisdiction workbook after trimming workbook whitespace. Blank = no exact match. No inferred historical alias. |
| `total_calls` | Total reported DV-related calls for the period. |
| `weapons_involved` | Calls reported as involving a weapon. Already included in total calls. |
| `sub_firearm`, `sub_knife`, `sub_other`, `sub_personal`, `weapon_not_rpt` | Weapon components; sum reconciles to weapons-involved in downloaded rows. Personal weapons follow the source's aggravated-assault reporting rules. Do not add these to total calls. |
| `total_strang_suffo`, `sub_strangulation`, `sub_suffocation` | Source strangulation/suffocation measures, collected beginning in 2018. Earlier values remain blank. These are not additional calls to add to total calls or weapon totals. |
| `explicit_sheriff_partial_reporting` | 1 only for the named Sheriff entity in Nov–Dec 2024 or Jan–Jun 2025, as expressly identified by the dictionary. 0 does not certify completeness. |
| `documented_sheriff_partial_month` | County-month contains an interval expressly flagged for incomplete Sheriff reporting; does not quantify county missingness. |
| `months_present`, `months_absent` | Annual observed row count and semicolon-separated absent months. No zero-filling. Present months can still be incomplete. |
| `strangulation_months_with_data` | Number of observed monthly values that are non-null for the total strangulation/suffocation field. |
| `known_partial_months` | Named Sheriff months explicitly covered by the source warning; scope over separate contract-city entities is unresolved. |
| `reporting_entities_present`, `agency_month_rows` | Observed entity count and row count, not a verified census of eligible/completely reporting agencies. |
| `coverage_note`, `unit` | Human-readable qualifications. |

Agency-year totals sum observed months. County tables sum all source San Diego reporting entities, including separately labeled cities, universities, CHP and other agencies; never add county totals to their agency components. The Sheriff-named row must not be represented as the total for all jurisdictions served by the Sheriff. No population denominator is supplied.

## Arrests/citations table

`san_diego_arrests_county_year_age_1980_2025.csv` groups county-year cells into three overlapping age scopes: `All ages`, `Adult 18+`, and `Juvenile under 18`. All ages equals adult plus juvenile; do not sum all three. The source groups by county of reporting agency and demographic categories; no reporting-agency field is available. Counts are arrest/citation occasions, not unique people; only the most serious offense is selected for multi-offense arrests. This differs from the study's source-ID unit and nonexclusive charge categories.

| Field | Definition |
|---|---|
| `year`, `county`, `age_scope` | Reporting year, county and derived age scope. |
| `demographic_cells` | Source rows contributing to the aggregate. |
| `violent`, `property`, `f_drugoff`, `f_sexoff`, `f_allother` | Source felony offense groups; definitions follow the DOJ dictionary and cannot reproduce the study's independent charge taxonomy. |
| `f_total` | Sum of the five felony groups. |
| `m_total` | Source misdemeanor total. |
| `s_total` | Source juvenile status-offense total. |
| `total_arrests_and_citations` | Derived `f_total + m_total + s_total`. Includes citations; not a jail-booking total. |

No daily timing, DV-specific field, person identifier, or population denominator is present. Definitions and reporting change historically; see official arrest context, pages 1–7.

## Context comparisons and audit tables

- `annual_context_comparison_2018_2025.csv`: independent DOJ county arrest/citation counts, county DV calls, selected named-entity DV calls, and supplied-export source-ID groups. Units and geographic scopes differ. No ratios or inferred completeness percentages are produced.
- `monthly_context_comparison_2018_2025.csv`: independent DOJ county/Sheriff calls and previously published export group/charge-row aggregates. The export requires unambiguous month; its monthly sum can differ from the annual aggregate. Jan–Jun 2018 export blanks mean no supplied period, not zero arrests.
- `comparison_inputs/by_year.csv` and `by_month.csv`: already-public study aggregates, preserved verbatim. Source-ID groups are scoped by source file; core and broad DV classifications overlap. Charge rows are a different unit. No raw identifiers are included.
- `california_control_totals_2001_2025.csv`: statewide sums used to check extraction. DOJ's latest annual release reproduces the 2024 and 2025 DV totals; this is not a completeness check.
- `statewide_dv_weapon_total_anomalies.csv`: source agency-month rows where weapons-involved exceeds total calls. Preserved unchanged; none are in San Diego. These anomalies preclude unqualified statewide weapon proportions.
- `san_diego_jurisdiction_listing.csv`: original jurisdiction code/name and start/end fields from the current official workbook. Date cells converted to ISO dates; text retained. Not a geographic boundary or export-ID crosswalk.

## Reproduction and scope

Run `python acquire_doj.py`, then `python normalize_doj.py`; requires Python 3.10+ and openpyxl. The acquisition verifies frozen hashes and refuses changed source bytes. It creates `raw/` locally from public official URLs. The ZIP intentionally omits raw bulk sources. Normalization reads only official public files and already-public comparison aggregates. `build_package.py` regenerates the summary and public ZIP from an explicit allowlist. No statistical model is refitted; the acquisition supplement does not change the study estimates.
