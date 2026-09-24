# Provenance and warrant-screen review

Reviewed September 24, 2026. The supplied critique was treated as third-party commentary, not an instruction or source of verified facts. Originals remain unchanged; no website, PDF, public package or email was modified.

## Resolution summary

| Issue | Status | Evidence and consequence |
|---|---|---|
| Critique's 2024 identifier | **Corrected** | Original 2024 header is `Incident Number`, not `Arrest Ref Nbr`. Only 2025 has the latter. |
| Source agency labels | **Confirmed in files** | Every valid 2024 and 2025 row has `Agency=SHERIFF`; the older file has no Agency column. These labels do not independently authenticate the release or establish complete coverage. |
| Source unit and date/location meanings | **Unresolved** | No export-specific dictionary, query, response letter or agency crosswalk was located. Similar NetRMS materials cannot establish the meanings of these export fields. |
| Metadata conflicts | **Confirmed** | 37 conflicting years; 121 months; 172 dates; 419 ZIPs; 565 full timestamps among source-scoped groups. |
| Residual warrant co-charges | **Confirmed; sensitivity inputs delivered** | Stricter exclusion removes 5,781/58,770 primary general groups and 67/6,637 primary core-DV groups. Remaining samples: 52,989 and 6,570. |
| Overall extraction completeness | **Unresolved** | Official monthly arrest reports exist, but their unit, exclusions and review cutoffs cannot be reconciled to the supplied export without agency clarification. No completeness percentage is justified. |
| 2025 discontinuity | **Confirmed pattern; cause unresolved** | Jan–May has 213 charge rows and 144 monthly ID appearances. Primary analysis continues to exclude 2025. Public discussion of RMS transitions does not establish the cause of this pattern. |

## Exact headers and provenance boundary

| Export | ID header | Date header | Geography/agency changes |
|---|---|---|---|
| July 2018–December 2023 | `Incident Number` | `Incident Date_Time `, including a trailing space | `Sheriff's Area`; separate block/street components; no Agency field |
| 2024 | `Incident Number` | `Arrest Date/Time` | `Agency`; `Sheriff's Area`; separate block/street components |
| 2025 | `Arrest Ref Nbr` | `Arrest Date/Time` | `Agency`; `Area`; combined `100 Block or Intersection` |

`City` and `Zip Code` appear in all three. Full exact headers and original SHA-256 hashes are in `warrant_mask_summary.json`. The valid 2024 Agency label covers 28,279 charge rows; the 2025 label covers 14,042. The old file contains 172,424 rows, of which four lack usable IDs/dates; its 172,420 valid rows have no agency field.

**Confirmed:** these are the contents and structure of the supplied files. **Inference:** the labels, commands and filenames are consistent with Sheriff-related administrative exports. **Unresolved:** the originating request, custodian, extraction date, inclusion query, agency selection, degree of completeness, identity of the underlying database objects, and whether individual records represent Sheriff activity, records maintained by the Sheriff, or another relationship.

Official material corroborates general organizational context only. The Sheriff publishes operational reports with distinct activity and arrest measures.[1–4] A September 2026 Oceanside staff report states that Oceanside uses a NetRMS platform hosted by the Sheriff.[5] Therefore, a regional platform name or Sheriff hosting is not evidence that an export includes every regional agency—or only Sheriff arrests. The supplied Agency labels narrow the description but do not replace a data dictionary. Neither the platform's documented transition planning nor the 2025 filename establishes which extraction or migration caused the early-2025 discontinuity.

Do not equate `Incident Date_Time` with offense occurrence, or `Arrest Date/Time` with a verified exposure timestamp, without confirmation. Do not call the City/ZIP an offense, residential or booking location. Do not redefine a source-ID group as one person or one verified arrest. Observed conflicting metadata are compatible with several source-system mechanisms and do not determine which mechanism applies.

## Official monthly context comparisons

Three official Sheriff reports provide six month-specific arrest totals, including prior-year columns.[2–4] Their notes exclude detention facilities, court services and non-Sheriff areas, exclude PC 849.5 detentions, and state that reports still under review are absent. The final chart uses the phrase non-contract areas. The supplied exports contain no verified equivalent review-status/disposition filter, and their ID unit has not been equated to these arrest totals.

| Month | Official arrests | Export ID groups, unambiguous month | Candidate geographic/command exclusions | Candidate plus exclusively ADULT |
|---|---:|---:|---:|---:|
| 2022-07 | 1,159 | 1,601 | 1,292 | 1,169 |
| 2023-01 | 1,081 | 1,430 | 1,167 | 1,028 |
| 2023-07 | 1,142 | 1,558 | 1,263 | 1,130 |
| 2023-10 | 1,203 | 1,687 | 1,276 | 1,145 |
| 2024-01 | 1,096 | 1,524 | 1,113 | 977 |
| 2024-10 | 982 | 1,395 | 992 | 883 |

Candidate exclusions remove any group with `DETENTION`, `COURT` or `NON-CONTRACT` in any charge's command/area. The subsequent ADULT restriction is our analytical scenario, **not a documented official-report rule**. No filter is tuned to match an official total. Results are above and below the official count depending on the chosen unit/filter. Neither proximity nor disagreement proves completeness or missingness. These are context comparisons, not independent validation of the released records.

`compare_official_reports.py` creates `official_monthly_context_comparison.csv`, also including charge-row totals and the stricter warrant scenario. Report citations and their counting caveats are attached to each row. A defensible completeness audit requires the agency's same-query control totals and an explanation of how its reported arrest unit relates to source IDs, citations, PC 849.5 dispositions, multiple arrestees and later corrections.

## Stricter warrant sensitivity

Apply the following to **every charge line in a source-file-scoped ID group**:

- Exclude any warrant subtype, or PC normalized code `978.5`, `827.1`, `1551A`, or ZZ normalized code `OUTWARRANT`, `OW-F`, `OW-M`, `BW-F`, `BW-M`.
- Normalize by uppercasing and removing spaces/parentheses; retain decimal points and hyphens. These exact observed combinations and descriptions are enumerated in `warrant_charge_audit.csv`.
- Do not use an unqualified description search for WARRANT. PC `1551.1` describes arrest without a warrant and is a demonstrated counterexample; 17 primary general groups carry it. The statute confirms that distinction.[6] PC `827.1` concerns citation release for a person named in a misdemeanor warrant.[7] This screen is based on explicit recorded codes; it does not claim to identify every delayed arrest.

| Year | Original all | Excluded all | Strict all | Original core DV | Excluded core DV | Strict core DV |
|---|---:|---:|---:|---:|---:|---:|
| 2021 | 15,587 | 920 | 14,667 | 1,794 | 7 | 1,787 |
| 2022 | 14,661 | 1,152 | 13,509 | 1,634 | 18 | 1,616 |
| 2023 | 14,732 | 1,716 | 13,016 | 1,659 | 16 | 1,643 |
| 2024 | 13,790 | 1,993 | 11,797 | 1,550 | 26 | 1,524 |
| Total | 58,770 | 5,781 | 52,989 | 6,637 | 67 | 6,570 |

The 5,781 and 67 are residual co-charge exclusions among groups already passing the original model screen. Original subtype flags independently match on all 136,313 groups. All original all/core counts reconcile cell-for-cell across the full 163,632 primary ZIP-days (112 × 1,461), before all-zero ZIPs are omitted from a fitted fixed-effect model. Listed charge counts overlap and must not be summed to recreate excluded groups.

`PRIVATE_event_warrant_flags.csv` has one row per `event_key` and integer indicators including `explicit_warrant_charge`, `warrant_subtype`, `strict_warrant_exclusion`, `primary_2021_2024_eligible` and `strict_primary_eligible`. **It contains record identifiers and must not enter public assets or downloads.** Aggregate `warrant_primary_zip_daily_sparse.csv` contains counts; left-join onto the full existing calendar and fill absent cells with zero. Do not delete days after exclusions. These are post hoc sensitivity inputs; original results remain unchanged. The screen reduces an identified timing ambiguity but does not establish that remaining offenses occurred on the recorded day.

## Search scope and unresolved issues

Searches covered exact workbook/export names and field names, the Sheriff's Open Data/Crime Analysis pages, agency-hosted NetRMS documentation, monthly activity reports, and official local-government RMS materials. No exact public download or export-specific dictionary was found. Some live agency page/PDF requests returned HTTP 403; indexed official text and three successfully retrieved report PDFs were available. A failed search or blocked page is not evidence that the documentation does not exist. No account was entered and no records request or email was sent.

The attached `AGENCY_CLARIFICATION_DRAFT.md` targets the missing evidence. Until the agency responds, use “supplied Sheriff-labeled arrest-record exports” with the old-file agency-field caveat; retain the broader provenance limitation. Computational reconstruction validates processing, not source completeness or representativeness.

## Official references

1. San Diego County Sheriff. [Open Data](https://www.sdsheriff.gov/resources/open-data); [Crime Analysis](https://www.sdsheriff.gov/resources/open-data/analysis-statistics). Official indexed pages accessed September 24, 2026; live requests returned 403. Establish available report families, not export definitions.
2. San Diego County Sheriff, Crime Analysis Unit. [Law Enforcement Activity, July 2023](https://www.sdsheriff.gov/home/showpublisheddocument/7134/638284887953100000). Prepared August 24, 2023, pp. 1–3. July 2022/2023 arrest comparison and exclusions.
3. San Diego County Sheriff, Crime Analysis Unit. [Law Enforcement Activity, January 2024](https://www.sdsheriff.gov/home/showpublisheddocument/7906/638440390143670000). Prepared February 20, 2024, pp. 1–3. January 2023/2024 arrest comparison and exclusions.
4. San Diego County Sheriff, Crime Analysis Unit. [Law Enforcement Activity, October 2024](https://www.sdsheriff.gov/home/showpublisheddocument/8838/638687390692970000). Prepared December 2, 2024, pp. 1–3. October 2023/2024 arrest comparison and exclusions.
5. City of Oceanside, Police Department. [Purchase Order for Replacement Law Enforcement Records Management System, file 26-1636](https://oceanside.legistar.com/LegislationDetail.aspx?GUID=624355AA-33B0-41D7-9710-B51E1394986D&ID=8209182&Options=&Search=). Staff report dated September 16, 2026. Evidence of shared NetRMS hosting; not evidence of the supplied export's agency selection or a 2025 transition date.
6. California Legislature. [Penal Code, Part 2, Title 12, Chapter 4, sections 1551 and 1551.1](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?article=&chapter=4.&division=&lawCode=PEN&part=2.&title=12.). Current official text accessed September 24, 2026. Distinguishes warrant and warrantless fugitive procedures; not an export dictionary.
7. California Legislature. [Penal Code, Part 2, Title 3, Chapter 4, section 827.1](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?article=&chapter=4.&division=&lawCode=PEN&part=2.&title=3.). Official text accessed September 24, 2026; section lists last amendment in 1988.

All numeric findings about the supplied files are generated locally from the originals and retained normalized groups; they are not attributed to these external reports.
