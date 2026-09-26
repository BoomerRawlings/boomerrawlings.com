# Private and Ivy source freshness inventory

Checked 25 September 2026 UTC. Twenty institutions; eighteen main annual-security-report PDFs retrieved and hashed. Seven institutions currently link a 2026 edition: Cornell, Carnegie Mellon, Chicago, Georgetown, Northwestern, Pennsylvania, Southern California. Eleven retrieved editions remain 2025. Harvard and Johns Hopkins current PDF retrieval remains unverified after direct HTTP 403 responses; these are not refreshed data.

`source_inventory.json` records every institution, official landing and report URL, check time, byte count, SHA-256, local source, report scope and limitations. Saved HTML provides current-link evidence; search snippets were discovery leads only. Mutable filenames can serve a newer edition: Northwestern's unchanged URLs now return 2026 documents. Archived sources and the original federal snapshot remain untouched.

## Current 2026 extraction

`current_asr_core_counts.csv`: 7,728 cells, 46 campus records, 14 categories, three calendar years, four geographies. Geography retains residential (a subset of on-campus), total on-campus, noncampus, public property. Combined counts must add on-campus + noncampus + public property once. Residential counts are never added to the campus total.

`second_extraction_audit.json`: independent PDF geometry/table and native HTML-cell extraction matches all 5,568 explicitly numeric or N/A cells; zero mismatches. Remaining records are explicit report-wide narrative zeros or withheld values with source-specific statuses. `extract_current_2026.py` and `audit_current_2026.py` reproduce acquisition-derived outputs. Rendered source-page checks are saved under `visual-checks/`. Final cross-review by a separate reviewer remains appropriate before publication.

- Cornell: three current reports, including AgriTech's native HTML report. All three branches covered. [Official listing](https://publicsafety.cornell.edu/reports-statistics/annual-security-report/).
- Georgetown: eight branches in 2026, versus six frozen federal branches. Dubai and Jakarta receive source-specific provisional IDs. Dubai 2023 and Jakarta 2023–24 are explicitly N/A, not zero. [Official listing](https://police.georgetown.edu/policies-reports/crimestats/).
- Chicago: main/Gleacher tables; page 8 explicitly reports no Clery crimes in 2023–25 for six other branches. These retain `reported_zero_narrative` provenance. [Official listing](https://safety-security.uchicago.edu/stay-informed/clery-act-reporting).
- Pennsylvania: three unambiguous main-campus annual tables. Five additional frozen branches cannot support a complete refreshed institution total. [Official publication announcement](https://almanac.upenn.edu/articles/the-university-of-pennsylvania-2026-annual-security-fire-safety-report-statistics-for-2023-2024-and-2025).

## Confirmed source defects and interpretation limits

1. Pennsylvania 2026, PDF pages 74–76: Morris Arboretum, New Bolton and Boathouse headings say 2023–25; column labels say 2024/2023/2022. Rendered pages confirm the conflict. Counts withheld for requested current years; no relabeling by assumption. Separate Wharton San Francisco/Center City tables not found.
2. Northwestern 2026, Chicago table PDF page 42: rape, incest and statutory-rape rows have 2025/2024/2024. Clear 2025 preserved; ambiguous 2024 and missing 2023 withheld. Branch geography columns omitted by the report remain unavailable until an explicit no-property/no-housing statement resolves scope. The Evanston 2025 dating-violence total is 30 with superscript footnote 3, not 303; 22 of 30 reports arose from one report describing events over time. [Official reports page](https://www.northwestern.edu/up/alerts-notices-data/clery-act-security-reports.html).
3. Carnegie Mellon 2026, PDF page 44: Pittsburgh 2025 fondling is on-campus 3, residential 3, noncampus 0, public 0; printed total is 1. Retain the printed component cells and flag the contradictory aggregate. [Official reports page](https://www.cmu.edu/police/reports/).
4. Chicago 2026–27, Gleacher PDF page 12: 2025 aggravated assault has all component cells zero but printed total 2; 2024 burglary has on-campus 6 but printed total 0. These are visible source defects, not text-extraction errors.
5. New York University's retrieved 2025 reports contain 27 table locations, including Tulsa, versus 26 in the frozen federal cohort. Its noncampus-residence column is a subset of noncampus, not an additional geography. [Official current reports page](https://www.nyu.edu/life/safety-health-wellness/campus-safety/clery-act-reporting/annual-security-reports.html).
6. Princeton's retrieved 2025 PDF contains stale hidden text layers. Statistical years/cells require rendered-page or reliable geometry review. Duke's three statistical pages are raster images requiring visual/OCR transcription. These limitations are not grounds for assuming zero.

## Resident denominators

No new exact, all-branch, geographically matched 2025 resident denominator adopted. Beds, capacity, rounded percentages and approximate student counts rejected as substitutes. Searches are saved as research leads; absence from these searches does not prove a denominator does not exist.

- Stanford's freshly retrieved official facts page states **6,727 undergraduate + 7,315 graduate students in university-provided housing, autumn 2025**. Actual headcounts are promising, but university-provided housing also spans adjacent lands and potentially leased off-campus property; Clery residential boundaries and overseas campuses are not yet reconciled. [Student Life](https://facts.stanford.edu/campus-life).
- Pennsylvania 2026 ASR page 61 gives **5,994 undergraduate students in campus housing, 2025–26**. The section focuses on College Houses; Greek/graduate coverage unresolved. It is not automatically the institution-wide residential denominator.
- MIT's AY25 Graduate Housing Advisory Committee update gives **2,549 total occupancy for an AY26 assignment process**, including undergraduates and visiting scholars/postdocs. Partial population and housing-system coverage prevent adoption. [Official update](https://studentlife.mit.edu/app/uploads/2026/03/AY25-GHAC-Annual-Update.pdf).
- Dartmouth's official factbook embeds an undergraduate housing-occupancy dashboard; its public CSV export returned 404. Undergraduate scope alone would not establish the full institutional residential population. [Official factbook page](https://www.dartmouth.edu/oir/data-reporting/factbook/studentlife.html).

## Retrieval limits

Harvard and Johns Hopkins direct official pages and PDFs returned HTTP 403. Web-readable cached listings are retained as leads, not proof of current source bytes. Columbia and Princeton static 2025 PDFs downloaded, while direct current landing retrieval remained blocked; a newer edition cannot be excluded with confidence. Source inventory flags these cases explicitly. No agency messages or access-control bypass performed.

## Completed 2025 extraction and final verification

`current_2025_core_counts.csv`: 10,920 cells, 65 branches, 11 institutions, years 2022–24. Includes the separately audited Duke raster transcription. `second_2025_extraction_audit.json` reproduces all 10,836 numeric, explicit N/A and source-conflict cells with zero mismatches; 84 absent residential-column cells for Notre Dame Chicago/Dublin remain unavailable. All 336 Princeton cells match its visible pages and current text overlay, excluding obsolete hidden tables. A separate reviewer confirmed Princeton and the MIT/Dartmouth source conflicts in `2025_visual_source_review.json`.

Additional source defects are explicitly flagged: MIT 2024 arson campus1/noncampus0/public0 versus printed total2; Dartmouth Lebanon 2024 domestic violence campus25/residential25 versus printed total1; Stanford Madrid 2024 noncampus fondling1 versus printed total-sex-offenses0. Stanford's four sexual-offense noncampus component cells are withheld for the affected year; its campus/residential cells remain unaffected. No printed number was silently repaired.

`private_input_integrity.json`: PASS, 18,648 cells across 111 branches and 18 retrieved institutions; 35 source-file hashes validated; 16,404 explicit numeric/N/A/conflict cells independently reproduced. The remaining cells are explicit source narrative zeros or appropriately unavailable values. `federal_overlap_reconciliation.csv` records 25 numeric differences from overlapping frozen federal cells; a difference is not automatically an error or revision without its source/scope interpretation.

N/A interpretation is separate from extraction. `structural_geography_rules.json` contains 48 evidence-backed rules covering 135 campus/geography/year combinations. Raw N/A remains preserved. Rules distinguish absent geography from before-opening periods. Dartmouth dating violence is included within domestic violence, not a structural zero. Columbia Baker Athletics/Paris 2022–23 are included in Morningside noncampus counts, a geographic reclassification. Dubai 2023 is an unreported partial operating year; Midtown 2022 lacks a verified opening date. Those exceptions remain qualified in `na_scope_interpretations.json`.

Final input SHA-256: 2026 CSV `f230b422f4dab8e06db30e4e0fe613e97118c6ed40b881f20f9175b82d57ce93`; 2025 CSV `f395d3f3a6db3cf63806b9b0fcc30825fd69867089fa4c72c0a91e7cc4b62087`. Website claims, calculations, source mappings and publication PDFs require their separate integration audit.
