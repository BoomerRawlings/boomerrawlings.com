# Ivy and Northeast resident-population acquisition

Checked 25–26 September 2026 UTC. Eleven institutions; sources are official institutional or government publications. `population_candidates.csv` preserves exact evidence and withholding reasons. `population_additions.csv` deliberately has no accepted whole-institution rows: this search did not establish a complete, dated resident population for any of these eleven institutions. This is a search result, not a claim that the data do not exist.

## Concrete population evidence

| Institution | Recovered evidence | Decision |
|---|---|---|
| Cornell | Official institutional mirror of the 2026 STARS report, PDF21: 8,861 student residents, separate from 40 employees and 451 other residents. PDF23 explicitly excludes Cornell Tech and Weill Cornell Medicine and gives Fall2025 demographic context. | Potential Ithaca-specific denominator only. Resource-credit sections reuse the count for FY2024–25; the resident field itself does not separately state a census date. Do not convert it to a whole-institution or Fall2024 total. |
| MIT | October15 census in AY25 Graduate Housing Advisory Committee report, PDF9–10: 2025 graduate housing holds 2,839 graduate students plus105 undergraduates; excludes263 nonstudent occupants. Historical on-campus graduate-building student counts also recovered. | Partial facility inventory, not all undergraduate halls. 2024 combined table has149 undergraduates, versus148 in the component tables; retain the conflict. |
| MIT | Boston's current 2025 official Student Housing Report, PDF14: 3,512 full-time undergraduates in on-campus housing plus705 in university-managed housing. | Exact undergraduate component, but graduates and any part-time students absent. Do not add all graduate-building occupants because that would double-count undergraduate occupants. |
| Harvard | Cambridge Town Gown 2025, PDF16: Fall2024 undergraduate residents6,852; Spring2025 graduate residents2,629. Prior column combines Fall2023 undergraduate6,914 with Spring2024 graduate2,545. | Cambridge only; other housing locations and mixed census seasons prevent a university-wide same-year total. |
| Pennsylvania | Current 2026 Annual Security Report, PDF61/printed58: 5,994 undergraduate students in campus housing for2025–26. | Section excludes fraternity/sorority housing; no complete graduate/branch population. |
| Georgetown | Signed Fall2024/Fall2023 and Spring2025 Enrollment and Housing Reports recovered from public links embedded in official compliance PDFs. Inventory totals5,346/5,341/etc explicitly describe assignable beds, not actual residents (Spring2025 PDF9). | Capacity, excluded. The municipal compliance synopsis alone could easily be misread as occupancy. |
| Yale | OIR's current Students data page still links the housing series ending2020–21; total2,507 then. Current fact sheet has rounded undergraduate housing percentages. | Outside2022–25 window; no carry-forward or percentage-derived count. |
| Brown | Current housing policy and graduate housing materials describe undergraduate residence requirements and a limited auxiliary portfolio. No complete dated resident census established. | Unavailable after this search; capacity/rounded estimates not adopted. |
| Columbia | Facilities annual-report and housing sources separate undergraduate housing, Columbia Residential and medical-center housing. Current full Annual Security Report recovered. | No complete same-year student-only resident census established. |
| Dartmouth | Current factbook, housing expansion and security report searched; planning additions are beds, not dated occupancy. | No complete dated student-resident total established. |
| Princeton | Current security report and Common Data Set/graduate housing materials searched; housing percentage and apartment/bed capacities are not exact full-population headcounts. | No complete dated student-resident total established. |
| NYU | Current annual-security-report listing and student-life/housing leads reviewed. New York, global sites and health-sciences housing require separate coverage. | No complete dated institution-wide student-only total established. |

## Source access and freshness

`asr_recheck.json` records every current report PDF hash, observed official listing status, and comparison with the prior publication inventory. Fresh current MIT v3 and Dartmouth variable-path reports retain the same bytes and unresolved source contradictions. Princeton’s fresh official listing revealed a new2026 report;336 current core cells were extracted and all four visible tables checked. All224 overlapping2023–2024 cells match the previous2025 edition. An unchanged hash is not a corrected table.

Harvard's current official 2025 Annual Security Report was recovered by ordinary browser download after origin HTTP403. Main raw PDF SHA256: `c52024d2154a422a975890555ad0e11fd19790bcfc5d9cf405305edfa6031c3a`. Seven branch tables,2022–24,14 categories and4 geographies yield1,176 cells:798 printed numeric cells and378 omitted-geography cells retained as unknown. All98 extracted category rows satisfy the printed on-campus+noncampus+public subtotal controls. `extract_harvard_2025.py` preserves reproducibility; root independently rendered all seven tables.

Harvard's fire report was also recovered by ordinary browser download, SHA256 `3ee524fed159cb1a42a827c20becc289320e618db6f43a52235975fd951addbb`. It has36 PDF pages:16 main pages plus appendices. PDF2 explicitly limits coverage to Allston, Cambridge, Harvard Forest and Longwood. Thus its inventory does not establish no housing at the four other annual-security-report branches. No structural-zero rules are proposed from omission alone. Concord Field Station's current official research description mentions an apartment for visiting faculty/fellows; that also cannot establish student occupancy or its absence. Current Arboretum internship FAQs say no housing for interns, which is narrower than all campus student housing and lacks a2022–24 reference date.

The AASHE detailed report site now requires a free account. No account or access-control workaround used. Cornell's own official site supplies an unrestricted full-PDF Box mirror, which was downloaded normally. Public Box download redirects are ephemeral; metadata retains stable official share/download references rather than signed redirect URLs.

## Limits and next primary-source targets

- Cornell: obtain explicit census date for8,861 and a separately dated Cornell Tech student-resident count; seek full2024/2025 STARS report mirrors.
- MIT: acquire a complete October15 undergraduate-residence/Greek-housing census and graduate advisers in undergraduate halls, then reconcile one-student2024 graduate-table discrepancy before summing components.
- Harvard: university-wide student-only housing census across Cambridge, Allston, Longwood and other locations; separate student residents from faculty, staff and dependents. Seek explicit2022–24 housing/noncampus-geography absence statements for omitted branch columns.
- Georgetown: actual occupied student census, including graduate residences and other reporting branches; assignable beds cannot substitute.
- Other institutions: official housing operations census or institutional-research resident tables; rounded Common Data Set percentages remain insufficient.

No people contacted, email sent, publication output changed, or data gap forced to zero during this acquisition.
