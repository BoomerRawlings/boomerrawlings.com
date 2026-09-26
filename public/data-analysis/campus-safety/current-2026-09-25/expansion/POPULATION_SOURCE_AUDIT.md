# Independent population-source audit

**PASS — 31 checks, zero failures; checked September 26, 2026, 03:58 UTC.** All 164 published population observations agree with their reviewed source values and the displayed dataset. Acceptance retains the scope qualifications below; PASS does not establish exact correspondence between housing populations and every Clery property.

The audited `population_sources.csv` SHA-256 is `1cfde5693c35dffd15f7f05d4e1abe3847a356dc7147ffcbd2ee498783e6ed68`. The accepted-additions input SHA-256 is `7a9065a18fcdfea52fe25204d31c893f937b9b2b5a9da3586f9d60ab9c9dc814`. [POPULATION_SOURCE_AUDIT.json](POPULATION_SOURCE_AUDIT.json) records all source hashes, URLs, retrieval timestamps, pages, period labels, components and qualifications. The independent verifier is `../../coverage_expansion_2026_09_25/public/INTEGRATION_REVIEW.population.py`.

## Existing observations

The 126 enrollment observations were independently reread from the original Integrated Postsecondary Education Data System ZIP files: total-level `EFTOTLT` where `EFALEVEL=1`, for all 42 institutions in each of 2022–2024. The 2022 and 2023 files are final revised releases; 2024 is provisional. Original ZIP hashes match recorded enrollment provenance.

All 33 retained housing populations were compared with the visible tables in the [California State Auditor report](https://www.auditor.ca.gov/wp-content/uploads/2025/10/2024-111-Report.pdf#page=62), PDF pages 62–65, printed pages 56–59. The tables explicitly count enrolled students living in campus housing by academic year, rather than available beds. Raw PDF SHA-256: `4057db7b14e1b85bb6980ad19455f873b474358d9f10fd0725e0ac68a24504b6`. The ledger explicitly identifies its retained hash as the preserved dataset hash; it does not misrepresent that hash as the original PDF hash.

## Five accepted additions

| Institution | Population period | Components | Total | Source location |
|---|---|---:|---:|---|
| Carnegie Mellon | Fall 2022 | 3,158 + 300 | 3,458 | [2024 annual report](https://www.cmu.edu/police/reports/fire-safety/2024asr.pdf#page=84), PDF/printed page 84 |
| Carnegie Mellon | Fall 2023 | 3,515 + 249 | 3,764 | [2026 annual report](https://www.cmu.edu/police/reports/fire-safety/2026-asr-final.pdf#page=81), PDF/printed page 81 |
| Carnegie Mellon | Fall 2024 | 3,732 + 256 | 3,988 | Same report and page |
| Stanford | Autumn quarter 2024 | 7,108 + 7,095 | 14,203 | [Facts 2025, mirrored copy](https://studyinternational.com/wp-content/uploads/2026/03/2025-Stanford-Fact-Book_WEB.pdf#page=48), PDF page 48 / printed page 46 |
| Stanford | Autumn quarter 2025 | 6,727 + 7,315 | 14,042 | [Institutional facts, Housing section](https://facts.stanford.edu/campus-life) |

PDF pages were visually checked; source text, saved bytes and metadata were separately rechecked. Retrieval occurred September 26, 2026 UTC: Carnegie Mellon 2024 report at 03:19:21, Carnegie Mellon 2026 report at 03:23:58, Stanford fact book at 03:19:21 and Stanford institutional HTML at 03:05:31. Source publication or retrieval year does not replace the explicitly stated population period.

Carnegie Mellon adds disjoint university-housing and fraternity/sorority student classifications. The table is labeled Pittsburgh undergraduates, but its 2024 classification total equals all-location undergraduate enrollment. This unresolved scope qualification is preserved, without inventing an adjustment. Current housing-office guidance excludes graduate students from on-campus housing; that corroboration is not a retrospective property-by-property census. Fall 2025 housing cells are blank and are not carried forward.

Stanford explicitly identifies undergraduate and graduate **students**. Its 2024 university-authored fact book survives at a publisher-hosted mirror after the original institutional URL became unavailable. Visible title, page, year and values were checked, but identity with the original site's bytes cannot be authenticated. The 2025 observation comes directly from Stanford's saved institutional HTML and explicitly refers to autumn quarter 2025. Both institutions' housing footprints remain incompletely matched to Clery parcels and overseas branches.

## Texas exclusion and 2025 rates

The [Texas housing report](https://utexas.app.box.com/v/LearnOutcomeReports/file/1743656171859), PDF page 5, reports **10,018 residents in spring 2024**. Raw PDF SHA-256: `4f1793c6d7761bb3cbedd1dc986cb6bb4a31f1933473bc74df227884081647a0`. It does not explicitly define a student-only population or exclude dependents. Family-housing eligibility does not prove their inclusion; the definition remains unresolved. The exact count is retained as context under `qualified_resident_total_student_basis_unresolved` and is absent from adopted student denominators.

Stanford is the sole adopted 2025 population observation. It does not create a complete eligible crime numerator: **all 2025 rates remain unavailable**, including the combined criminal-offense rate. No prior-year population is substituted. Dated population snapshots are neither annual person-time nor individual victimization probabilities.
