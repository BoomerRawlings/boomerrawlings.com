# SDSU current official listing: source extraction and reconciliation

Retrieved 25 September 2026. Status: extraction and source-cell verification passed; this folder does not authorize or certify publication of a revised comparison.

## Selected source

The [official annual-reports listing](https://police.sdsu.edu/public-information/clery-act-compliance/annual-reports) directly links the [2026 Annual Security Report](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf). It covers report years 2023–2025 and three reporting campuses: San Diego, Imperial Valley and Georgia. The selected file is 145 pages, 1,562,094 bytes, SHA-256 `8d697b9134573a07dd7d53a0db29c18f8fe3a5b97e026fb8221237766155c80b`. Its HTTP last-modified value is 25 September 2026, 18:51:38 GMT; the saved listing identifies an update that day.

The URL contains `newdraft`, while the listing and document cover identify it as the 2026 report. This review establishes what the official listing supplied at retrieval; it does not independently certify final publication status. A previously surfaced `2026_asr.pdf` is not the currently linked file. Its different hash and excluded status remain in the discovery record. It is not an input to this extraction.

## What was extracted

- `current_asr_core_counts.csv` / `.json`: 504 cells, comprising 14 categories (eleven criminal categories plus domestic violence, dating violence and stalking), three campuses, three years and four geographies.
- `current_asr_all_counts.csv` / `.json`: 756 cells, adding weapons/drug/liquor arrests, the three corresponding disciplinary-referral categories, and hazing. All 63 table headings, source page/line locators, raw values and status codes are retained.
- `current_criminal_totals.csv`: sums of the eleven criminal categories by campus/year/geography, plus an explicitly identified three-campus sum. Housing remains a subset of the on-campus total; those two columns must not be added.
- `current_nonoverlapping_geography_totals.csv`: each category's on-campus + noncampus + public-property sum, with the housing subset shown separately. This is an offense-count view, not a resident-normalized rate.
- `current_narrative_totals.csv` / `.json`: separately retained hate-crime and unfounded-crime narrative totals. They are not added to criminal offenses, arrests or referrals.
- `prior_asr_all_counts.csv`: the preceding 2025 report's 720 table cells for 2022–2024, retained as a separately versioned comparison source.
- `asr_2025_vs_2026_comparison.csv`: 480 overlapping cells for 2023–2024 across the 20 categories common to both reports.
- `federal_2025_vs_asr_2026_comparison.csv`: 480 matching campus/category/year/geography cells from the frozen federal collection, retaining its original blanks and statuses.

The source prints 732 numeric values and 24 `NA` cells in the current tables. Every `NA` occurs in 2023 or 2024 hazing. `NA` stays null, never zero. Printed zeros stay zero; a printed housing zero is not independently interpreted as a declaration that housing does not exist. No occupancy or enrollment denominator for 2025 was inferred.

## Findings that affect the existing study

The one changed cell among the 480 overlapping institutional-report cells is **San Diego main-campus residential rape in 2023: 7 in the 2025 report, 8 in the 2026 report**. The 2023 on-campus rape total remains 11. Both values have direct [2025 page 7](https://police.sdsu.edu/_resources/files/annual-security-reports/2025-annual-security-report-finalized-08-18-25.pdf#page=7) and [2026 page 7](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=7) locators. No explanation for the revision was established, so no cause or correction chronology is inferred.

The same cell is the only numeric difference from the frozen federal collection among 320 comparable numeric cells. Another 160 federal cells are blank and cannot support a numeric difference calculation. The current institutional report supplies explicit values for these cells; this is a source-version/coverage change, not justification for overwriting the frozen federal blank with a guessed zero.

| Three-campus criminal-offense sum | 2023 | 2024 | 2025 |
|---|---:|---:|---:|
| Campus housing | 16 | 7 | 24 |
| On campus, including housing | 51 | 46 | 55 |
| Noncampus | 11 | 17 | 9 |
| Public property | 5 | 6 | 10 |

These are sums of reported offenses, not unique people or deduplicated incidents. The 2025 on-campus total includes three Imperial Valley burglaries; the San Diego main-campus total is 52. Georgia's 2023–2025 criminal/VAWA cells are all zero. Campus tables: [San Diego pp. 7–10](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=7), [Imperial Valley pp. 12–15](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=12), [Georgia pp. 16–19](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=16).

### Geographic reconciliation with the user's SDSU email

The user supplied an SDSU email reporting rape totals of 13 for 2023, 3 for 2024, 16 for 2025, and 1 for 2026. The first three agree with the current report when nonoverlapping geographies are added: **2023: 11 + 2 + 0 = 13; 2024: 1 + 2 + 0 = 3; 2025: 11 + 5 + 0 = 16** (on campus + noncampus + public property). The 2025 housing value 10 is already inside the on-campus 11. An email expression of 10 + 1 + 5 + 0 is consistent with separating housing from the other on-campus offense; the published table itself supplies 11 as the inclusive campus total. [Current report, p. 7](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=7).

The 2026 value is user-supplied correspondence, not a count published in this 2026-edition report, which covers 2023–2025. Its observation cutoff, geographic scope, reporting status and denominator were not established. It is not included as an annual count or rate. The source email was not independently retrieved during this extraction. For resident comparisons, use only housing counts over documented residents; do not divide the all-geographies total by the resident population.

The selected report's housing counts do not exceed their on-campus parent counts. The separate unlisted `2026_asr.pdf` fails that relationship in three 2025 categories and is excluded. This check is an internal consistency test, not proof of complete reporting.

## Other documents linked by the listing

All four report links and exact retrieval hashes are in `source_inventory.json`.

- [2026 Fire Safety Report](https://police.sdsu.edu/_resources/files/2026_fsp.pdf): seven pages, fire statistics for 2023–2025 and facility/fire-safety information. Its measures are separate from Clery criminal counts. It does not establish a documented 2025 occupant denominator for this extraction.
- [2027 Campus Safety Plan](https://police.sdsu.edu/_resources/files/2027_csp.pdf): five pages of safety planning and procedures. Its edition year is not evidence of 2027 crime observations; no counts are merged from this document.
- [Systemwide hate-incidents report](https://police.sdsu.edu/_resources/files/annual_swreport_hatecrimes_2024.pdf): a four-page California State University committee document dated November 2024 that discusses calendar 2023. Its statewide/systemwide scope and separate hate-incident measures are not additions to the campus criminal-offense total. The listing's 2023 label and filename's 2024 year refer to different dates.

## Reproduction and checks

Run `python extract_sdsu.py`, then `python audit_current_tables.py`. The first script requires `pypdf`; the second requires `pdfplumber`. The extractor accepts only the pinned current report hash and verifies pinned comparison inputs. It does not read or overwrite a published website dataset. `PUBLIC_FILES.json` is the explicit redistribution allowlist; discovery-only sources and temporary page renders are excluded.

The primary extraction checks 63 tables, 756 unique source cells, complete campus/year/category/geography keys, raw `NA` handling, and the housing/subset relationship. A separate script independently reads PDF ruled tables using pdfplumber, checks each printed heading and all 756 cell values/statuses against the pypdf output. A separate agent visually checked 252 core housing/on-campus cells on nine rendered pages and 168 corresponding prior-report cells. This extraction agent additionally viewed current pages 10, 15 and 19 for referrals, hazing and narrative totals. These distinct scopes are recorded without describing them as a new audit of the entire 42-institution study.

Existing federal files, analysis outputs, original PDF and earlier audits were not modified. Publication changes and any denominator extension remain decisions for the parent study's separate integration and audit.
