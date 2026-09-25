# Enrollment and actual housing occupancy

Frozen source acquisition: 2026-09-25. Primary years: 2022–2024. Cohort: 42 institutions, selected before rates. Separate denominators answer separate descriptive questions; they are not interchangeable population estimates.

## Headcount and annual alignment

The primary enrollment denominator is IPEDS EF2022A/EF2023A/EF2024A, `EFTOTLT` where `EFALEVEL=1`. It includes undergraduate and graduate students, full-time and part-time, in the institution's fall reporting population. Traditional-calendar reporters use their official fall census or October 15. These are snapshots, not annual person-time or a census of people physically present on Clery properties. Pair calendar report-year y counts with fall-y enrollment; pooled normalization is `1000 × sum(annual counts) / sum(annual headcounts)`. Do not average annual rates without denominator weighting. [IPEDS Fall Enrollment survey](https://nces.ed.gov/ipeds/survey-components/8), [official 2024 instructions](https://nces.ed.gov/ipeds/use-the-data/download-survey-material/2024/fall%20enrollment/package_6_74.pdf).

The 2022 and 2023 final revised CSV members (`_rv`) are used. Fall 2024 is the latest EF year available in the queried official inventory and is provisional, released January 6, 2026 in the Spring 2024–25 collection. A newer Fall *collection* release is not necessarily newer Fall *Enrollment*: EF is collected in spring. [NCES release schedule](https://nces.ed.gov/ipeds/survey-components/data-release-schedule), [NCES available-data inventory](https://nces.ed.gov/ipeds/datacenter/selectVariables.aspx?stepId=1).

All 126 total-headcount cells carry `R` (reported) flags. Totals independently agree with `DRVEF.ENRTOT` and `EF_A_DIST.EFDETOT`, undergraduate+graduate, and full-time+part-time. Blank graduate/undergraduate derived cells are set to zero only when the directory explicitly says that level is not offered. All source flag codes remain documented in the dictionary exports.

`fall_fte` is retained for context, not used as the per-student denominator. DRVEF FTE combines full-time enrollment with weighted part-time enrollment; the weights depend on institutional control and student level. It is neither a headcount nor a campus-resident count. [NCES DRVEF2024 dictionary](https://nces.ed.gov/ipeds/complete-data-files/DRVEF2024_Dict.zip), variable `FTE`.

## Institution and geography matching

All 42 UNITIDs and eight-character OPEIDs match their annual 2022–2024 official HD directory rows. The Clery institution key is checked against those records, not guessed from a similar name. Retain leading zeros in OPEIDs. OPEID alone is not a unique IPEDS-unit join: Penn State World Campus and University Park share an OPEID, as do University of Florida and its online reporting unit. These additional units were not silently added. [NCES 2024 directory](https://nces.ed.gov/ipeds/complete-data-files/HD2024.zip).

The primary institutional offense numerator aggregates the specified federal reporting campuses. Enrollment appears once per institution-year, never once per branch. Some reporting campuses are out of state, overseas, or medical facilities. Institution-wide enrollment is a practical common comparator, not proof that every person or property matches. Counts may involve patients, visitors, staff, nonstudent victims, and repeated offenses. A headcount-normalized reporting rate is not the probability that an enrolled student is victimized. Branch and medical context must remain visible beside rates.

All 42 enrollment totals in the 2025 Clery bulk file equal the IPEDS fall 2024 totals numerically. This is a cross-check, not authorization to reuse that undated single field for 2022/2023. The annual IPEDS series supplies all denominators.

`distance_exclusive_headcount` comes from `EFDEEXC` at `EFDELEV=1`; `some` and `none` use `EFDESOM`/`EFDENON`. Exclusive distance enrollment is reported separately. Subtracting it does not establish an on-site population: distance students may visit campus, and other students may study at additional locations. The default rates retain total enrollment. Caltech and Princeton have not-applicable (`A`) cells for exclusive/some distance in all three years while reported no-distance enrollment equals total. Their zero distance counts are explicitly derived from that equality, not blank-to-zero imputation. [NCES distance dictionary](https://nces.ed.gov/ipeds/complete-data-files/EF2024A_DIST_Dict.zip).

## Actual residents, not beds

The California State Auditor's October 2025 report provides actual enrolled-student housing occupancy for all 10 UCs and SDSU in 2019–20 through 2024–25. The primary 33 rows use academic years starting 2022–2024. Table A.1, printed pp. 56–57 (PDF pp. 62–63), contains the UC rows; Table A.2, pp. 58–59 (PDF pp. 64–65), contains SDSU. All six UC system enrollment and occupancy totals reconcile to the transcribed campus rows. Capacity in Appendix B is a different quantity. [State Auditor report 2024-111](https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62).

UCSD 2024 actual occupancy is 21,907; SDSU is 8,367. Their 2022/2023 values are 17,906/18,906 and 7,919/8,100. These are fall/academic-year snapshots, not annual resident person-years. No property-by-property match to Clery student-housing boundaries or branch campuses was established in this source pass. Therefore every resident-normalized rate must say **approximate; housing boundaries unmatched**. Housing offenses are a subset of on-campus offenses; never add the two.

Actual resident denominators for the remaining 31 institutions are not sourced here. Blank is not zero. UCSD's 2024–25 Common Data Set F1 reports 48% of degree-seeking undergraduates in college-owned/operated/affiliated housing. That rounded undergraduate percentage cannot supply an exact all-student resident count or establish a Clery property match. [UCSD CDS, p. 16](https://ir.ucsd.edu/stats/undergrad/CDS_UCSD_2024-20253.pdf#page=16).

## SDSU discrepancy: unresolved population reconciliation

| Fall year | IPEDS total | Auditor enrollment | Difference |
|---|---:|---:|---:|
|2022|37,402|36,637|765|
|2023|39,241|37,538|1,703|
|2024|41,137|39,373|1,764|

The 2024 CDS B1 also reports 39,373: 34,637 undergraduates + 4,736 graduate students. IPEDS reports 35,782 + 5,355. The discrepancy is 1,145 undergraduates + 619 graduate students. IPEDS lists 405 nondegree undergraduates; that alone cannot explain the gap. Exclusive distance enrollment is 2,454, so it also does not numerically identify the 1,764 difference. The SDSU budget fact sheet labels 39,373 as San Diego + Imperial Valley; an Imperial Valley omission is not supported. These sources establish the disagreement, not its full cause. Do not attribute it to extension, Global Campus, census dates, online students, or nondegree enrollment without a documented reconciliation. [SDSU 2024–25 CDS B1, p. 3](https://asir.sdsu.edu/Documents/CommonDataSets/CDS_2024-25.pdf#page=3), [SDSU budget fact sheet, pp. 2, 4](https://bfa.sdsu.edu/financial/budget/docs/2024-25-budget-fact-sheet.pdf#page=2), [SDSU CDS definitions note](https://asir.sdsu.edu/common-data-set/).

The primary enrollment comparison consistently uses IPEDS across all 42 institutions; it does not switch SDSU alone to the smaller figure. Auditor actual occupancy is retained independently. `auditor_ipeds_enrollment_comparison.csv` preserves all 33 comparisons; only SDSU differs. A separate sensitivity analysis could use a separately justified common alternative population, but none is silently applied here.

## Reproduction

`python build_denominators.py` and `python build_occupancy.py` reproduce the curated CSVs. With original bulk ZIPs absent, the first script uses the 12 small hash-verified cohort-only CSVs in `reproduction_inputs/`; they contain only necessary public institution aggregates. No person records are included. Dictionary JSONs are supplied; reading original dictionary XLSX requires `openpyxl`. The occupancy transcription is embedded in its script with system-total assertions and the archived PDF hash.

Fresh acquisition: `acquire_ipeds.py` accepts official ZIP filenames; `acquire_references.py` downloads the source PDFs where the publisher permits access. Scripts reject changed known hashes; source revisions require a new version. Current NCES filenames may live at `/ipeds/complete-data-files/`, with legacy files at `/ipeds/datacenter/data/`. Exact successful URLs, retrieval times, members and SHA256 hashes are in `raw_manifest.json`. Publisher availability is not guaranteed. The SDSU budget PDF was readable in the web tool but direct archival download returned HTTP 403; it is cited and not represented as locally preserved.

`artifact_manifest.json` lists curated public files; nationwide raw ZIPs, screenshots and raw PDF contents are not required in the public reproducibility package.
