# Private university housing and source refresh

Checked September25,2026 Pacific (retrieval timestamps September26 UTC). No website, original data or publication files edited. Five exact-count proposals are ready for independent adoption review. Missing proposals do not establish that public data do not exist.

## Integration files

- `population_additions.csv`: Stanford2024/2025 and Carnegie Mellon2022/2023/2024. Status `accepted_actual` means a qualified research proposal, not that publication was edited.
- `population_candidates.csv`: component observations and nonadopted candidates, separate from accepted totals. `build_population_candidates.py` reproduces both.
- `new_asr_core_counts.csv`: 1,848 cells, including10 Hopkins campuses and Stanford Main,14 categories,2023–2025,four geography slots. Empty fields remain unknown or explicitly inapplicable; no inferred crime zeroes.
- `count_adjudications.json`: precise new decisions and match conditions; original blanket exclusions are preserved in the prior release.
- `source_inventory_updates.json`: all nine assigned institutions' latest listing and report retrieval evidence. Seven unchanged report hashes; Stanford newly linked2026 main report; Hopkins previously inaccessible report now acquired.
- `NEW_ASR_EXTRACTION_AUDIT.json` and `NEW_ASR_REVIEW.json`: arithmetic, scope, visual review and comparison evidence. Producer checks do not replace the parent's separate audit.

## Accepted population proposals

| Institution | Fall/reference year | Students | Basis |
|---|---:|---:|---|
| Stanford |2024|14,203|7,108 undergraduate-housing students +7,095 graduate-housing students, Stanford Facts2025 printed46/PDF48. |
| Stanford |2025|14,042|6,727 undergraduate-housing students +7,315 graduate-housing students, current official Housing page. |
| Carnegie Mellon |2022|3,458|3,158 University Housing +300 Fraternity & Sorority Housing, ASR2024 p84. |
| Carnegie Mellon |2023|3,764|3,515 +249, ASR2026 p81; corroborated ASR2024 p84. |
| Carnegie Mellon |2024|3,988|3,732 +256, ASR2026 p81. |

These are autumn/fall snapshots, not annual averages. The Stanford figures describe university-provided housing, which can include subsidized off-campus apartments. The Pittsburgh undergraduate census is supported by [CMU Housing's explicit no-graduate-on-campus-housing statement](https://www.cmu.edu/housing/about-us/for-our-families.html), and the ASR includes fraternity/sorority houses in residential facilities. Five other CMU branches have independently documented no-university-housing rules in the prior audit. No parcel-perfect Clery match is claimed. The 2024 CMU housing-table total equals the all-location undergraduate total despite its Pittsburgh label; preserve this source-scope qualification.

The [Stanford2025 Facts PDF](https://studyinternational.com/wp-content/uploads/2026/03/2025-Stanford-Fact-Book_WEB.pdf) is a university-authored publication recovered from StudyInternational's public mirror. Its original Stanford URL now404s in HTTP and browser after site migration. Visible page46, document title, typography and exact counts agree with the indexed official document; identical original bytes cannot be authenticated. This host limitation remains attached to the denominator. The [current Stanford Housing page](https://facts.stanford.edu/campus-life) independently supplies2025 counts. Original mirror and official page bytes, hashes, metadata and rendered source page retained.

## Sources that do not supply a comparable exact total

- **Stanford2022/2023:** indexed official factbooks give component totals14,015 and14,137; original URLs404. They remain candidates, not adopted. The official [StanfordNext resources page](https://next.stanford.edu/resources) links GUP AnnualReport24, which was acquired successfully; its housing allocation/capacity discussion is not occupancy.
- **Carnegie Mellon2025:** ASR81 visibly leaves every housing classification blank. No backfill from2024. Sustainability review and master-plan source paths were also checked.
- **Northwestern:** [City of Evanston Housing4All](https://www.cityofevanston.org/Documents/Departments/Community%20Development/Housing%20and%20Grants/Strategic%20Housing%20Plan/Previous%20Plan%20Versions/Housing4All%20Plan%20Update%201_14_26.pdf?t=202606021508530), PDF19–20/printed17–18, reports5,140 undergraduate and645 graduate housing **capacity**. These are planning estimates from a September11,2025 university communication, not actual occupants. Chicago/Qatar scope also needs consideration. Do not sum capacity into a resident denominator.
- **Notre Dame:** [institution-commissioned2024 regional impact report](https://publicaffairs.nd.edu/assets/584558/notre_dame_2024_regional_impact_final.pdf), p29, gives approximately7,200 on-campus residents in fall2023 among rounded population groups. Retained as a rounded population summary, not an exact census. STARS2025 public summary links detailed characteristics behind login.
- **USC:** official FY22–FY25 sustainability reports and emissions reports acquired. No exact whole-student occupancy observation identified in those documents. Common Data Set rounded undergraduate housing shares do not supply a complete exact resident count. Latest2026 ASR reacquired unchanged.
- **Caltech:** official2023–2025 sustainability reports, institutional housing information and latest2025 ASR acquired/reviewed. Housing catalogs describe facilities, room/bed capacity and eligibility, not a dated whole-student occupancy total. No denominator adopted.
- **Chicago:** official housing and student facts sources checked; undergraduate housing percentages are not complete actual populations. ASR explicitly discusses graduate housing, making an undergraduate-only total insufficient. Latest2026 ASR reacquired unchanged.
- **Duke:** official facts/housing sources and latest2025 ASR checked. Hall/quad capacity, incoming-class counts and rounded housing percentages do not establish actual full resident census. No denominator adopted.
- **Johns Hopkins:** latest ASR now recovered, but housing population must cover Homewood, Peabody, East Baltimore's contracted929Apartments and Nanjing, not just first-/second-year Homewood undergraduates. No complete actual resident count adopted.

Public [AASHE report directory](https://reports.aashe.org/institutions/participants-and-reports/) and institutional summaries were acquired. Detailed dated Institutional Characteristics links for Stanford,CMU,Notre Dame andUSC redirect to authentication; HTTP200 login HTML is not report data. Incidental directory matches for unrelated Chicago institutions were excluded. No login bypass attempted and no AASHE figures adopted.

## Crime-source qualifications

[Stanford's current official listing](https://police.stanford.edu/safety-report.html) now links the2026 main report and its statistical extract; overseas reports remain2025. Main2026 SHA256 `79c9ef09b519b33b11da5b571ec491ced0b2ea87fb014904ad91e3f3627be5bc`. PDF pages103–104 equal printed pages103–104. Sex-offense subtotals reconcile. Dating/DV categories require combined-definition handling; the dating footnote mentions2022 beside a marked2023 row. Neither the year nor category scope was silently corrected.

[Hopkins's official listing](https://publicsafety.jhu.edu/clery-crime-data/) rendered in the parent's browser and supplied the download after HTTP403. The cover reads **2025 Annual Security & Fire Safety Report**, issued **October1,2026**; table years **2023–2025**. Retrieved before printed issuance. Preserve nominal edition2025 and both dates. SHA256 `e88b93f8130ac64df9a307a31841e46ca93a7f7372a0e816bf879f2209ba0735`. All ten branch tables were rendered/read. Six tables explicitly state no housing; three explicitly also state no noncampus property. Nanjing,Bayview andBarcelona missing noncampus columns remain unknown. Barcelona's printed2025 zeros carry an unanswered-police-request qualification.

Chicago Gleacher2024 burglary housing0 is independently corroborated by its same-year federal no-housing declaration and can be restored alone. Campus6 versus total0 remains unresolved. CMU2025 fondling housing3/campus3 exceed total1; those counts remain ambiguous. Precise decisions in the adjudication ledger prevent a general override of source-conflict status.

## Reproduction

Run `python build_population_candidates.py`, `python extract_new_asrs.py`, then `python finalize_research.py` in a checkout containing the prior source data. Acquisition manifests list URLs; `acquire.py manifest.json` reacquires official/public documents and records failures separately. Reacquisition is not required to reproduce the frozen extraction. Source files and metadata use paths relative to this folder; PDFs retain authorship and original content.
