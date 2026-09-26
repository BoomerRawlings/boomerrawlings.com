# Independent current-source calculation audit

**Result: PASS for the recorded calculation snapshot.** Independent reconstruction found no discrepancy in 9,450 annual and pooled rate rows, 10,080 institution/category/year/geography counts, 39,268 displayed geographic cells, or eight worked housing comparisons. It reconciled all 36,652 selected source rows and preserved 1,344 superseded rows separately. Extracted current-source cells now exist for all 42 institutions; this does not establish complete coverage for every institution, year, category or geography.

`CURRENT_DATA_AUDIT.json` records exact input, output, builder and auditor SHA-256 hashes. PASS applies to those versions. Recorded rate file: `efc2bb0693ad2c7a6adbf9413242d199a599a3ff041ecf8f20572496947d31d4`. Recorded source-cell ledger: `451895c85221121d5c00d83d38f2929332e32a1d9a50a78cdbd9370ead26069c`.

## Scope and independence

`audit_current_data.py` does not import or execute `build_current.py`. It reconstructs institution totals from source cells, obtains populations from the preserved federal dataset and separately versioned accepted-population inputs, and recalculates annual and pooled ratios. Eligibility decisions are reviewed separately against source text. Arithmetic agreement alone cannot validate transcription, reporting completeness or a geographic assumption.

The expansion contains 4,536 source cells. Exact branch/year/category/geography matches supersede 1,344 older cells; unmatched source cells retain earlier attribution. Source values, raw markers and original statuses are preserved. The four Michigan cells labeled 2021 remain in the source ledger, outside the displayed 2022–2025 window, and are not relabeled 2024.

| Check | Verified scope |
|---|---:|
| Selected source rows | 36,652 |
| Superseded source rows preserved | 1,344 |
| Original input rows accounted for | 37,996 |
| Original source-field comparisons | 639,548 |
| Institution/category/year/geography values | 10,080 |
| Annual and pooled rate rows | 9,450 |
| Displayed geographic cells | 39,268 |
| Numeric housing/campus pairs satisfying housing ≤ campus | 5,975 |
| Synthetic geographic totals retaining not-applicable status | 370 |
| Population-source ledger entries | 164 |
| Adopted population additions | 5 |
| Worked housing comparisons | 8 |

The 9,450-row grid is 42 institutions × 15 categories × 5 periods × 3 measures. Periods are 2022, 2023, 2024, 2025 and a fixed 2022–2024 pooled period. No 2025 observation enters that pool. All 42 institutions have a recorded current-report listing check; the review date is a cutoff, not assurance about unpublished data.

## Original-source recovery and current editions

The University of Virginia's original 2026 PDF is now independently verified. All 1,008 core cells match the earlier provisional transcription: 672 numeric values and 336 explicitly inapplicable geography cells. All six source tables were visually checked. Original PDF SHA-256: `a8f39155d2dec776fd6690ee92813a47ecac10836169ad7a80f2faff07f34641`. Its 2023–2025 cells are eligible under their source statuses; the former original-PDF exclusion no longer applies. Valmarana was not a separate campus in those years; no historical zero is invented. [Virginia 2026 report](https://cleryact.virginia.edu/sites/cleryact/files/2026-09/UVA_Annual_Fire_Safety_Security_Report_2026_FINAL.pdf).

Princeton's newly linked 2026 report retains obsolete invisible table text. The 336 core cells were checked against the four visible current tables, not the first text-layer occurrence. All 224 overlapping 2023–2024 cells agree with the prior edition; 2022 retains older attribution. PDF SHA-256: `bc5a24834477c9ae9f02fa450e2eb500b676859b384ad20323cd3b39730b5667`. An additional independent integration review checked all 336 visible cells and reproduced ten output files byte-for-byte. [Princeton 2026 report, PDF50](https://publicsafety.princeton.edu/document/4686#page=50).

Recovered Merced, Harvard and Johns Hopkins sources add verified tables with remaining qualifications. Harvard's unexplained omitted housing columns remain unknown. The Johns Hopkins report is titled 2025, tabulates 2023–2025, and prints an October 1, 2026 issue date despite being publicly linked before that date; both labels remain disclosed. Its omitted geographies and Barcelona's 2025 external-agency nonresponse still limit complete comparisons. Stanford's 2026 main report replaces only its supplied cells; separately linked overseas editions retain their own attribution.

## Missingness, conflicts and geography

Observed zero, unknown value, ambiguous source and inapplicable geography remain distinct. Only a literal numeric source value or explicit zero-offense narrative supplies an observed count. Unavailable agency returns, ambiguous years, unexplained omitted columns and unresolved total conflicts do not become observed zeros. Structurally absent geographies may contribute zero to a sum while retaining a separate inapplicable status and no observed analysis count.

The private-geography whitelist remains independently source-reviewed: 48 rules covering 135 geography/year combinations, checked against 33 distinct cited PDF pages. NYU Tulsa and Georgetown Jakarta have documented later openings; Georgetown Dubai's partial 2023 year remains unknown outside its explicitly absent housing geography. NYU Midtown's unexplained 2022 cells remain unknown. No resident population is inferred from housing applicability.

Scoped decisions include:

- **Michigan 2024 fondling:** residential 7 is unambiguous and approved. The on-campus 44-versus-43 table/footnote conflict remains unresolved. No 2024 statutory-rape value is inferred from the 2023/2022/2021 rows, so a complete 2024 combined criminal-offense total remains unavailable.
- **Chicago Gleacher 2024 burglary:** literal housing 0 is preserved, but its analytic contribution is structural absence, corroborated by the same-year federal declaration of no campus housing. This does not repair the on-campus 6/printed-total 0 conflict. The source- and cell-specific override cannot apply to other rows.
- **Stanford main campus 2022–2025:** all 32 domestic/dating geography cells remain excluded from separate-category calculations because main-campus definitions combine those categories; the current dating footnote also has a conflicting year. This decision is scoped to campus 243744001 and these two categories. Overseas cells retain their own statuses; the exclusion does not affect the eleven-category criminal total.
- Dartmouth and UCLA domestic/dating categories, specified UNC combined or omitted categories, Carnegie Mellon 2025 fondling and other source-total conflicts remain excluded where they prevent a valid comparison. Florida's incomplete 2025 agency returns remain flagged.
- Texas Brackenridge before 2023 is **before separate reporting**, not before physical opening; earlier records belonged to main-campus noncampus geography. Georgia Tech institution-wide comparisons remain withheld because current scope omits the frozen inventory's Shenzhen branch.

Housing is a subset of campus total and is never added again. Eleven criminal-offense categories form the combined category. Domestic violence, dating violence and stalking remain separate and may overlap those offenses. A missing required component prevents a complete sum. Institution enrollment is counted once regardless of branch count. The corrected Illini Center ID `145637003` preserves counts while fixing joins.

## Populations and rates

Five new dated student-population observations are adopted, in addition to preserved historical populations:

| Institution | Period | Student housing population |
|---|---|---:|
| Carnegie Mellon | Fall 2022 | 3,458 |
| Carnegie Mellon | Fall 2023 | 3,764 |
| Carnegie Mellon | Fall 2024 | 3,988 |
| Stanford | Autumn quarter 2024 | 14,203 |
| Stanford | Autumn quarter 2025 | 14,042 |

Carnegie Mellon totals add separately listed university and fraternity/sorority student housing. The source's Pittsburgh label and institutional-total qualification are retained; the housing office states graduate students cannot use on-campus housing. Stanford explicitly reports undergraduate and graduate students. Its 2024 university-authored fact book was recovered from a publisher-hosted mirror after the original URL became unavailable; identical original-site bytes cannot be authenticated, and that limitation is disclosed. Both institutions' footprints remain incompletely matched to Clery parcels and remote campuses.

Texas's exact 10,018 **residents in spring 2024** remains a contextual candidate. The report does not establish a student-only population or exclude dependents; student employment statistics cannot resolve that definition. Its count is not adopted as a student denominator. Capacity, rounded residential percentages, incomplete subsets and annual measures with unresolved census definitions are likewise not substituted.

Each annual rate is 1,000 times the eligible location-specific count divided by its documented same-year population. Measures are housing reports/residents, campus reports/enrollment and housing reports/enrollment. The population ledger preserves source URL, hash, date/period and scope. Enrollment is never represented as housing occupants.

The pooled rate divides all three required 2022–2024 counts by the sum of those three population snapshots, then multiplies by 1,000. It is not the unweighted average of annual rates. Missing counts or missing/nonpositive populations prevent a result. One actual 2025 housing population is now documented, but all 1,890 candidate 2025 rates remain unavailable because complete eligible numerator/denominator coverage is still absent. No 2024 population is carried forward.

| Period | Combined housing/resident rates | Combined campus/enrollment rates |
|---|---:|---:|
| 2022 | 6 | 23 |
| 2023 | 12 | 36 |
| 2024 | 13 | 35 |
| 2025 | 0 | 0 |
| 2022–2024 pooled | 6 | 21 |

These are availability counts, not safety rankings. In 2024, housing crime totals are available for 33 institutions and adopted resident populations for 13; all 13 have an eligible combined housing ratio. The original federal dataset remains byte-identical, SHA-256 `5a4ac282c79e3e0a6d6fec478b24b6bae1c47d8350863d582314de39a01ef998`. Current crime gaps are not silently filled from federal crime cells.

## Worked comparisons and reproduction

UC San Diego's independently anchored main-campus residential rape counts are 12, 11, 20 for 2022–2024, with residents 17,906; 18,906; 21,907. The pool is 43 / 58,719 × 1,000 = 0.7323. SDSU main-campus counts are 9, 8, 1 with residents 7,919; 8,100; 8,367; the pool is 18 / 24,386 × 1,000 = 0.7381. These round to 0.73 and 0.74. SDSU's 2023 housing count was revised from 7 to 8; 2022 retains the older report edition. [UC San Diego, PDF142](https://www.police.ucsd.edu/docs/annualclery.pdf#page=142), [SDSU 2025, PDF7](https://police.sdsu.edu/_resources/files/annual-security-reports/2025-annual-security-report-finalized-08-18-25.pdf#page=7), [SDSU 2026, PDF7](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=7), [State Auditor populations, PDF62 onward](https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62).

Run `audit_current_data.py` after the builder. The input ledger pins source extractions, structural rules, population additions, cell adjudications and source-inventory updates. Independent checks cover retention and supersession, keys, literal values, scoped exclusions, populations and period provenance, rates, editions, displayed missingness and coverage. In an extracted archive, use `python audit_current_data.py --data replay --report replay/CURRENT_DATA_AUDIT.json` after the documented replay, preserving the packaged audit and manifest.

Separate UC, public, private, Duke, SDSU and expansion source audits address transcription. The integration review is `expansion/evidence/public/INTEGRATION_REVIEW.json`: 41 checks, zero failures, and the isolated ten-file replay. Website citations and mathematical/layout rendering have separate reviews.

These checks do not authenticate agency case records, recover unreported offenses, establish exact population exposure or property alignment, infer causation, or constitute external human peer review. Counts concern reporting years and may include earlier occurrences. Even a correctly calculated ratio is not an individual victimization probability.
