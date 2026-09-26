# Independent current-source calculation audit

**Result: PASS for the recorded calculation snapshot.** The independent reconstruction found no discrepancy in 9,450 annual and pooled rate rows, 10,080 institution/category/year/geography counts, 35,848 displayed geographic cells, or eight worked housing comparisons. The audit also reconciled all 33,460 selected source rows to their original extraction inputs. It does not establish complete crime reporting, exact population exposure, or external human peer review.

The companion `CURRENT_DATA_AUDIT.json` records the exact input, output, production-builder and independent-auditor SHA-256 hashes. A PASS applies to those files, not to subsequently changed versions. The production rate file is SHA-256 `9e5e58e0a6c816e80237ed018209da81c7e705d702d852be50bcc9056c6d57c3`; the source-cell ledger is `d1eb7fb9c7d485ea3378791f76bd42c88b3c764eea1036148d3e3dffd36a133f`.

## Scope and independence

`audit_current_data.py` does not import or execute `build_current.py`. It reconstructs institution totals from source cells, retrieves population values independently from the preserved federal dataset, and recalculates every annual and pooled ratio. The reconstruction uses the documented eligibility decisions; their substantive justification is reviewed separately against source text and the source-extraction audits. Arithmetic agreement alone does not validate a transcription or a geography assumption.

The release contains 42 institutional slots and extracted cells for 39 institutions, including provisional University of Virginia transcription that is excluded from calculations. Three institutions have no verified current counts. The four Michigan source cells labeled 2021 are retained in the source ledger; they are outside the displayed 2022–2025 window and are not reassigned to 2024.

| Check | Verified scope |
|---|---:|
| Original selected source rows retained | 33,460 |
| Original source-field comparisons | 576,716 |
| Institution/category/year/geography values | 10,080 |
| Annual and pooled rate rows | 9,450 |
| Displayed geographic cells | 35,848 |
| Numeric housing/campus pairs satisfying housing ≤ campus | 5,488 |
| Synthetic geographic totals retaining not-applicable status | 319 |
| Worked housing comparisons | 8 |
| Independently reviewed private geography rules | 48 rules; 135 geography/year combinations |

The 9,450-row grid is 42 institutions × 15 categories × five periods × three measures. The five periods are 2022, 2023, 2024, 2025 and a fixed 2022–2024 pooled period. No 2025 observation enters that pooled period.

## Missingness, source conflicts and geography

Observed zero, missing value, ambiguous source and inapplicable geography remain distinct. Only a literal numeric source value or an explicit zero-offense narrative supplies an observed count. An unavailable agency return, ambiguous year label, omitted unexplained column, or unresolved source-total conflict cannot become an observed zero.

Structural exclusion from an institution sum requires source support. The private-institution whitelist was checked against all 33 distinct cited PDF pages; `private/STRUCTURAL_RULES_AUDIT.json` pins its exact version. Carnegie Mellon branch descriptions and Georgetown/NYU footnotes support the named absent housing or noncampus geographies. NYU Tulsa and Georgetown Jakarta have explicit opening dates after the excluded years. Georgetown Dubai's partial 2023 year remains unknown outside its expressly absent housing geography. NYU Midtown's unexplained 2022 on-campus/public-property entries remain unknown. No resident population is inferred from a housing-applicability statement.

Dartmouth's dating-violence N/A means that the category is included within domestic violence; it does not mean that a geographic area is absent. Separate domestic- and dating-violence calculations are withheld for Dartmouth and UCLA. The same conservative approach applies to the specified North Carolina combined/omitted categories. Michigan's conflicting 2024 fondling table and footnote, ambiguous statutory-rape years, private-source total conflicts and Florida's incomplete 2025 agency returns remain excluded where they affect a calculation. Virginia's unverified original PDF is not assigned a fabricated file hash: the web-reader excerpt has its own provenance and remains unusable for current rates.

On-campus housing is a subset of on-campus geography. It is not added to campus totals. Eleven criminal-offense categories form the combined category; domestic violence, dating violence and stalking are separate and may overlap those categories. A missing component prevents a complete sum. Institution enrollment is counted once, regardless of branch count.

The review corrected an Illini Center branch ID from `145637002` to `145637003`, preserving institution counts while fixing branch joins. It also identified a synthetic-total error that had displayed some before-opening N/A cells as reported zeros. The final display preserves N/A. Texas Brackenridge's pre-2023 condition is labeled **before separate reporting**, not before physical opening: those earlier records belonged to main-campus noncampus geography. Its structural exclusion prevents duplication, without asserting that no crime occurred. Georgia Tech institution-wide comparisons remain withheld because the current branch scope omits Shenzhen, which appears in the frozen inventory.

## Numerators and population denominators

Each annual rate is 1,000 times its eligible count divided by the documented population for the same calendar year. The measures are housing reports/residents, campus reports/enrollment, and housing reports/enrollment. The audit checks the numerator geography explicitly for all three. No enrollment population is represented as a housing-occupant population.

The pooled rate divides the sum of all three required annual counts by the sum of all three annual population snapshots, then multiplies by 1,000. It is not the unweighted average of annual rates. Any unavailable required count or nonpositive/missing population prevents a pooled rate. All 1,890 candidate 2025 rates remain unavailable; neither a 2024 denominator nor an approximate capacity is carried forward.

The original federal dataset remains byte-identical to the pre-revision snapshot, SHA-256 `5a4ac282c79e3e0a6d6fec478b24b6bae1c47d8350863d582314de39a01ef998`. Its same-year historical enrollment and occupancy values are retained as denominators; current institutional counts are not silently filled from federal crime cells.

For the combined criminal-offense category, available current-source rates are:

| Period | Housing/residents | Campus/enrollment |
|---|---:|---:|
| 2022 | 5 | 21 |
| 2023 | 10 | 32 |
| 2024 | 10 | 31 |
| 2025 | 0 | 0 |
| 2022–2024 pooled | 5 | 19 |

These are availability counts, not safety rankings. The housing denominators are fall snapshots whose property boundaries have not been matched fully to Clery housing. Institutional reporting may include medical facilities and international or satellite campuses. Even an arithmetically correct ratio does not identify individual victimization risk.

## Worked housing comparisons

The independently anchored UC San Diego residential rape counts are 12, 11 and 20 for 2022–2024, against occupancy 17,906, 18,906 and 21,907. The pooled value is 43 / 58,719 × 1,000 = 0.7323. SDSU main-campus counts are 9, 8 and 1, against occupancy 7,919, 8,100 and 8,367. Its pooled value is 18 / 24,386 × 1,000 = 0.7381. Both round to the displayed 0.73 and 0.74, respectively. [UC San Diego report, PDF142](https://www.police.ucsd.edu/docs/annualclery.pdf#page=142), [SDSU 2025 report, PDF7](https://police.sdsu.edu/_resources/files/annual-security-reports/2025-annual-security-report-finalized-08-18-25.pdf#page=7), [SDSU 2026 report, PDF7](https://police.sdsu.edu/_resources/files/asr_2026_newdraft.pdf#page=7), [State Auditor occupancy tables, PDF62 onward](https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62).

SDSU's revised 2023 housing count is eight rather than seven. Its 2022 count retains the older report attribution because the 2026 edition begins with 2023. These comparisons use the named main-campus housing tables; they are not an all-geography offense count divided by housing occupants. Source editions are preserved for every year and in the pooled calculation.

## Reproduction and limits

Run `audit_current_data.py` after producing the current output files. Required original extraction files, the structural-rule whitelist and its source-review record must be present; changed input hashes fail the check. The script checks all source-field retention, keys, counts, population values, rate values, editions, display missingness, category scope and coverage statistics. Separate UC, public, private, Duke and SDSU source audits address the transcription layer. The private visual supplement independently verifies all 336 Princeton core cells and the MIT/Dartmouth conflict examples against rendered pages.

In an extracted archive, the auditor detects the packaged frozen dataset. Run `python audit_current_data.py --data replay --report replay/CURRENT_DATA_AUDIT.json` after the documented builder replay. Its report is written into the replay directory, preserving the packaged audit and manifest. The individual PDF extraction/audit scripts still require the exact separately identified original reports and their acquisition metadata; the aggregate replay does not require those PDFs.

The audit does not authenticate agency records, recover unreported crimes, certify inaccessible sources, establish exact property-level denominator alignment, or infer causation. Different report editions and reporting practices remain relevant even when every calculation agrees. The website citation review and formula/layout review are separate records.
