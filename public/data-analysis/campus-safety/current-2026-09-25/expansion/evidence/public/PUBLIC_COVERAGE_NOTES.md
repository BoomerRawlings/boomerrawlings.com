# Public-university population and report expansion

Review date: 2026-09-25 (America/Los_Angeles). Retrieval timestamps are UTC and may fall on September26. Scope: the11 non-California public universities in the42-school cohort. This research changes no website or federal source files.

## Deliverables and decisions

- `population_additions.csv`: header only; no accepted student-population additions from this public-school review. UT Austin's exact **10,018 residents, spring2024** remains a useful contextual candidate because student-only composition is unresolved. `build_adjudications.py` regenerates the additions file and crime-cell recommendations.
- `population_candidates.csv`:49 observations or explicit no-qualifying-count outcomes across all11 schools. Original URL, SHA256, retrieval time, source page/field, population type, period and scope accompany each row. `build_population_candidates.py` regenerates the ledger and checks byte hashes.
- `CRIME_ADJUDICATIONS.json`: nine source-specific decisions. The newly recoverable Michigan2024 residential fondling cell is **7**. Michigan's2024 statutory-rape row remains absent; that prevents a complete combined criminal-offense total. UVA's original2026 PDF has now been recovered and independently verified, resolving its prior original-source access gap.
- `current_core_counts.csv`:1,008 independently verified UVA2023–2025 core geography cells from the original2026 PDF. `extract_uva_verified.py` reproduces them; `UVA_VERIFICATION.json` documents all-cell comparison against the earlier provisional web extraction and visual review of all six tables.
- `retrieved/`: original downloaded sources, token-free metadata, extracted text and selected source-page renders. Population sources supplement the original current-report inventory at `../../freshness_2026_09_25/public/source_inventory.json`.

An exact count from a dated institutional housing population may be used as a disclosed population proxy without asserting an exact Clery parcel match. This does not justify substituting capacity, rounded enrollment percentages, dependent-inclusive populations, residence-hall-only counts for an apartment-inclusive portfolio, or annual participants for a point-in-time population.

## Exact contextual observation, withheld denominator: Texas Austin

The official [Housing and Dining report landing page](https://housing.utexas.edu/spotlights/learning-and-outcomes-report) links the university's public Box report folder. The [2023–2024 Learning and Outcomes Report](https://utexas.app.box.com/v/LearnOutcomeReports/file/1743656171859), PDF5, explicitly gives10,018 residents during spring2024 in its student-employment paragraph. The page was visually checked. The reported419 student employees/10,018 residents also agrees with the displayed4.2% after rounding; this arithmetic is a cross-check, not the derivation of the population.

Use period label **Spring2024**, not fall2024. The original wording establishes residents, not explicitly student residents. No definition specifies whether dependents are included, or which properties contribute. The official [University Apartments page](https://housing.utexas.edu/housing/university-apartments) includes families among eligible residents. That does not prove the10,018count includes nonstudents; it establishes an unresolved distinction which the student-employment percentage cannot resolve. Retain the exact figure as context, but do not adopt it as a student-only denominator. This independent review supersedes the initial accepted_actual proposal. The apartment eligibility page is frozen in `INTEGRATION_REVIEW.ut_apartments.html` with its metadata/hash.

The report also does not reconcile housing properties against Clery geography or remote academic housing. East Campus Graduate Apartments opened July1,2024, after the spring count. The count is neither an annual mean nor person-time exposure.

Original file: `retrieved/ut_housing_2024.pdf`; SHA256 `4f1793c6d7761bb3cbedd1dc986cb6bb4a31f1933473bc74df227884081647a0`.

The2024–2025 and2025–2026 reports give9,948 and9,955 people who lived in their halls and communities during the respective academic years (PDF5 in each, visually checked). Those reports do not state whether the number is a census or cumulative annual residents. The counts remain separate annual-measure candidates; neither is relabeled as a fall census. The spring2023 report's9,500 is round, with no precision explanation, and is also withheld under the exact-count requirement.

## Other population findings

| Institution | Strongest source and observation | Adoption limit |
|---|---|---|
| Georgia Tech | Official [Fact Book listing](https://irp.gatech.edu/fact-book), editions2022–2025, PDF35/printed32: total all-housing occupancy9,909;10,028;9,892;9,786 respectively. Single-student plus married-student plus Greek rows reconcile. The2024 page was visually checked. | Actual occupancy, not capacity. However, Married Student occupancy is not defined as student persons versus occupied family units. Retained as conditional candidates, not accepted person headcounts. Atlanta scope cannot be silently treated as worldwide-institution scope. |
| Illinois Urbana-Champaign | [2024–25 Housing Annual Report](https://recruitment.housing.illinois.edu/sites/default/files/2025-08/FY24-25_Annual-Report_FINAL.pdf), PDF5/printed3: fall10th-day UG/graduate residence-hall counts8,453(2022),9,138(2023),9,898(2024). PDF18/printed16 gives annual unique housing residents12,301;13,707;12,020;12,440 for fiscal2022–2025. | Hall counts omit university apartments. Annual totals expressly include dependents and count unique people during the fiscal year; neither is a complete student-only snapshot. |
| Washington Seattle | [Fiscal2024 Bondholders Report](https://finance.uw.edu/treasury/files/BHReport/University%20of%20Washington%20Bondholders%20Report%20Fiscal%20Year%202024.pdf), PDF94: autumn opening occupancy8,654(2022),8,515(2023),8,439(2024). [Current HFS facts](https://hfs.washington.edu/about-hfs/facts-figures/) gives9,149 at the2025–26 tenth day. | Bond table expressly excludes single-student and family apartments. Current HFS total expressly excludes Commodore Duchess, Radford Court and Stevens Court Family Housing. These are usable partial-scope observations, not complete housing denominators. |
| Michigan Ann Arbor | Official housing directory links2024–25 annual report in a public Canva viewer; original viewer content could not be acquired. State HEIDI reporting and STARS were investigated. | Canva returned unsupported-client content; detailed STARS requires login. Current fact-sheet residential share is rounded. No exact complete count acquired. |
| North Carolina Chapel Hill | Current official2026 security report and current STARS institution summary reviewed. | Detailed STARS population page requires login. Other published counts were rounded or partial. No exact complete count acquired. |
| Ohio State Columbus | Official2024–25 Student Life impact report and FY2025 bondholders annual update acquired. | Bond report says halls can house approximately14,750; that is capacity. Move-in numbers are rounded. No exact complete count acquired. |
| Penn State University Park | Current2025 reissued ASR and2025 Commonwealth Campus Workgroup report acquired; regional planning housing-market report reviewed. | ASR housing column is capacity. Exact Commonwealth occupancy belongs to other campuses. University Park promotional population is rounded; market counts are not the university resident census. |
| Florida | Official2026 investor presentation and state Board of Governors2026 housing financing summary acquired. | No complete student headcount verified in the investor presentation. Financing summary gives approximate beds and99% occupancy. A2025 investor PDF indexed by search now returns404. No complete exact student count adopted. |
| Virginia | Official2025 Student Affairs report and2026 ASR links found; board housing materials reviewed. | Student Affairs report download returned403; indexed occupancy percentages and bed counts do not establish an exact student population. The crime PDF was subsequently recovered and verified; that does not establish a resident denominator. |
| Wisconsin Madison | Official2024 move-in page gives8,915 with explicit approximate-figures note. Housing market study and2025 housing sustainability report acquired. | Rounded/approximate hall population, not a complete student-only apartment-inclusive census. No exact complete count acquired. |

Sources above are source leads and scope findings, not proof that a qualifying public population count does not exist. The retained candidate ledger preserves values without overstating their eligibility.

## Annual-security-report freshness and scope

Official listing pages were checked again during this expansion; downloaded listing metadata is retained. The same-day frozen report hashes and exact report URLs remain in the existing inventory. No later official edition was verified for the following schools:

| Institution | Latest verified edition at review | Report years and qualification |
|---|---|---|
| Georgia Tech |2026|2023–2025, Atlanta/Europe/Savannah. Shenzhen remains a scope gap. Its historical2023 report explicitly documents controlled student housing; missing contemporary Shenzhen must not become zero. Savannah housing is explicitly inapplicable.|
| Florida |2026|2023–2025. Remote-campus agency-response limitations remain; unavailable reporting is not complete zero reporting.|
| Illinois |2025, December2025 reissue|2022–2024. Illini Center housing is explicitly inapplicable.|
| Michigan |2025|2022–2024. Restore unambiguous2024 residential fondling7; retain44/43 on-campus conflict and absent2024 statutory-rape row.|
| UNC Chapel Hill |2026|2023–2025.2024 domestic/dating combination is year-specific. Missing2025 dating row and unqualified remote-campus blanks remain missing.|
| Ohio State |2025|2022–2024. Printed totals include identified historical Richard Strauss reports; reporting year is not occurrence year.|
| Penn State University Park |2025, November2025 reissue|2022–2024.|
| UT Austin |2025|2022–2024. Eight-campus source has gray/blank cells. No explicit general rule permitting zero fill was found; Marine Science Institute and Winedale have housing fire inventories.|
| Virginia |2026, original PDF recovered and verified|2023–2025. All1,008 core geography cells independently re-extracted from original bytes; every value/status matches the prior provisional web extraction.672 numeric values;336 explicit inapplicable geographies. All six source tables visually checked.|
| Washington Seattle |2025, April2026 update|2022–2024.|
| Wisconsin Madison |2025|2022–2024.2025 police operational annual report is a different product, not a newer Clery table.|

See `CRIME_ADJUDICATIONS.json` for the exact source hashes, geographies and decisions. No federal historical CSV is rewritten by this research.

The UVA original PDF is `retrieved/virginia_asr_2026.pdf`, SHA256 `a8f39155d2dec776fd6690ee92813a47ecac10836169ad7a80f2faff07f34641` (6,240,130 bytes;195pages), obtained by ordinary browser download from the official listing's [full report link](https://cleryact.virginia.edu/report), resolving to the [2026 PDF](https://cleryact.virginia.edu/sites/cleryact/files/2026-09/UVA_Annual_Fire_Safety_Security_Report_2026_FINAL.pdf). Table PDF pages113,123,131,140,149,157 correspond to printed106,116,124,133,142,150. Explicit notes establish the inapplicable geographies. Valmarana was not a separate campus in2023–2025, per PDF166; no historical zero is created. Charlottesville2024 fondling includes50 incidents reported by one person, per PDF115. These are source reporting-year counts, not an estimate of when every incident occurred.2022 remains attributed to earlier sources.

## Retrieval and redistribution notes

`acquire.py` saves ordinary public source responses and hashes original bytes. `acquire_public_box.py` follows the institutional public viewer's advertised read-only download route; it does not sign in or bypass account access. Box source PDFs and their token-free metadata are the reproducible evidence. Do **not** put raw Box viewer HTML, `.links.json`, or exploratory output in a published package: it contains ephemeral public-viewer download tokens that are unnecessary to the evidence. The older misnamed `florida_investor_2026.html` is PPTX bytes from an earlier extension guess; use `florida_investor_2026.pptx` instead and omit the misnamed copy. Prefer an explicit package allowlist.

All detailed STARS institutional-demographics URLs attempted redirected to a member login, although public summaries loaded. No membership/login workaround was attempted. Access limits are distinct from unavailable population data.
