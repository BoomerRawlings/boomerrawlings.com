# Separate final source and citation audit

25 September 2026. **Source/content audit passed for the exact versions below.** All seven PDF pages are included. This was a separate source-reading and claim-verification pass after the research review, supported by independent code. It is not external human peer review and does not establish complete campus reporting or personal safety.

## Scope and coverage

The review covers the study page source, methods article, explorer’s static and dynamic text, calculation helper, public dataset descriptions and institution notes, case-study data, annual/pooled tables, and seven-page report. Repeated claims are grouped into **44 claim families** in [citation_claim_ledger.json](citation_claim_ledger.json), with primary evidence, locators, qualifications and verdicts. The source review used the actual regulations, institutional tables and research passages, not citation presence alone.

Independent source-value reconstruction passed **4,387 checks with zero errors**. It reads original federal XLS tables and annual IPEDS ZIPs, independently transcribes the 33 occupancy cells, and does not import the production builder. Coverage includes 3,528 individual-category/geography/institution/year aggregates, 252 combined-category totals, 126 annual enrollment cells, resident availability, all 212 campus identities, documented branch notes and the worked comparison. The precise check categories and source-byte hashes are in [CITATION_VALUE_VERIFICATION.json](CITATION_VALUE_VERIFICATION.json); [verify_public_claim_values.py](verify_public_claim_values.py) provides the independent implementation.

The separate numerical audit verifies all **5,670 annual and 1,890 pooled rate rows**, starting from normalized source cells. That scope is different from this pass’s independent reads of original workbooks and enrollment files. It reports zero arithmetic differences. No source uncertainty is removed by agreement between implementations.

The institutional ASR audit covers **36 rape cells**: three named main campuses, three years, four geographies. **34 agree; two UCSD 2022 cells differ**. Those are source differences, not failed calculations: on-campus rape 14 federal versus 15 ASR, noncampus 4 versus 5. Housing values agree. This does not claim a review of every ASR category or every branch. See [asr_federal_rape_comparison.csv](asr_federal_rape_comparison.csv) and [asr_comparison_verification.json](asr_comparison_verification.json).

## Substantive findings

| Claim | Result and required interpretation |
|---|---|
| 42 institutions, 212 reporting campuses, 15 views, 11 documented occupancy institutions | Reconciled. Purposive cohort; institution-wide numerator, enrollment once. Fifteen views are not mutually exclusive categories. |
| Federal vintage | Official available-year catalog ends at collection 2025 at retrieval; 2022–2024 report years. Preparation date and ASR title do not establish revision chronology. |
| Report year and geography | Regulation (c)(3) supports timing; (c)(5) supports geography/housing subset. Nonstudents and multiple-offense disclosures require the NCES notes and institutional evidence as well. |
| Resident denominator | All 33 occupancy cells match State Auditor Tables A.1/A.2. Actual occupancy, not capacity; property matching remains incomplete. |
| UCSD/SDSU pooled housing example | 43 / 58,719 × 1,000 = 0.7323013; 17 / 24,386 × 1,000 = 0.6971213. Display 0.73 and 0.70. Three fall snapshots, not unique residents; no equivalent-safety inference. |
| UCSC 2024 housing rape | 38 offenses; 21 separate offenses disclosed in one report. Printed p. 11 is PDF p. 12, footnote 6. Neither 38 victims nor 38 report forms. |
| SDSU enrollment | IPEDS 41,137; CDS/State Auditor 39,373. Full scope reconciliation unresolved. The budget source explicitly includes SD and Imperial Valley, so omission of Imperial Valley does not explain it. |
| Missingness | 42 complete selected on-campus totals in 2024, 38 in 2023, 36 in 2022. Six incomplete pooled institutions retained as unavailable. Source-cell coverage is not real-world reporting completeness. |
| Housing applicability | 103 campuses have numeric housing counts; 109 explicitly declare no housing. The current API vintage is disclosed. Its 2024 declarations apply only to that year; historical blanks are not backfilled as zero. |
| NCES comparison | National indicator uses FTE, not enrolled headcount. No direct unmatched national benchmark. |
| BJS comparison | Nine pilot campuses; narrowly aligned completed, on-campus rape reported to authorities. Survey estimate 60 versus Clery 40 rape incidents; not statistically different in that study. Does not establish universal completeness. |
| AAU survey | 33 participating schools, 181,752 respondents, 21.9% response; Table 2, printed p. 6. Survey recall periods and campus-resource contact differ from Clery reporting. |
| Uncertainty | Descriptive administrative ratios. No victimization probability, causal interpretation, correction multiplier or safety ranking is claimed. |

## PDF and link review

All **seven pages** were rendered and visually inspected, including the equations, every prose paragraph and reference list. The 42 on-campus 2024 rows and 11 resident-normalized 2024 rows were independently matched to source-checked values; the four case-comparison period rows also match. No clipped text, unreadable equations, table overlap or missing glyphs were identified. The corrected final page 6 was re-rendered and reviewed.

The PDF has **22 link annotations to 14 distinct targets**: 12 references plus the study and its downloads section. Multi-line references legitimately create repeated annotations. Institutional PDF page targets are UCSD 142, SDSU 7, UCSC 12, State Auditor 62; BJS 131; SDSU CDS 3. The source titles and locators match their supporting material. BJS’s printed p. 110 corresponds to PDF p. 131. AAU Table 2 is printed p. 6 / PDF p. 36.

The IPEDS landing page timed out during the final web pass; the original annual ZIP bytes and relevant fields were independently available and checked. This is a bounded access limitation, not a finding that the portal is permanently broken. Exact download links and frozen hashes accompany the source manifests. Publisher URLs can subsequently change.

## Corrections verified

- Geography citation corrected from (c)(4) to (c)(5).
- UCSC printed-page/PDF-page distinction corrected to PDF `#page=12`.
- Unsupported ASR-versus-federal chronology removed; both vintages retained.
- Explorer detail column changed from “Reports” to “Offenses.”
- PDF BJS comparison now explicitly says **rape incidents** in both counts.

These corrections concern precision and source use; the published rate data did not change.

## Audit boundary

This clearance concerns source support and content in the hashed versions. Final archive integrity, clean offline reproduction, complete download existence and deployed browser behavior have separate release checks. It does not certify an archive before that check occurs. The reviewed public dataset and PDF contain institutional aggregates and no individual victim records. A separate package review must also exclude raw API contact fields. The source documents cannot resolve unreported offenses, the full SDSU population difference or property-level housing alignment.

## Exact reviewed versions

Paths are project-relative; SHA-256 identifies bytes rather than a mutable URL.

| Artifact | SHA-256 |
|---|---|
| `boomerrawlings.com/src/pages/writing/data-analysis/campus-safety.astro` | `20a4ad11cccffd8acb7fd19081fe95af2d2f8947fa5051321f1d009f290de191` |
| `boomerrawlings.com/src/content/archive/campus-safety.md` | `daf8c0bdd38d4045684e538bb4b52742a0c340043d487bf7a1fc52e80810e640` |
| `boomerrawlings.com/src/components/CampusExplorer.astro` | `5afc03ff329a3621bce58f86bb1db4334d4a78f706773f488214c78cfa38893e` |
| `boomerrawlings.com/src/lib/campus-rates.js` | `1739202c1e252c717e7e74bb72add90081a42d4e0818a206fd48a28954a5c1ce` |
| `campus_safety_analysis/publication/data/dataset.json` | `5a4ac282c79e3e0a6d6fec478b24b6bae1c47d8350863d582314de39a01ef998` |
| `campus_safety_analysis/publication/data/case_study.json` | `5ed64dbca52b2d9768bc52d561cdaaa8640f11cef13b044dcf832e17c6e9da43` |
| `campus_safety_analysis/publication/data/annual_rates.csv` | `fccd2ad62d1af498fe1d619a0550d8a09c11fd871c2a17de125f33c1248084af` |
| `campus_safety_analysis/publication/data/pooled_rates.csv` | `c1b7da4ff6af0cb9cf81c988e3d5fc20fef4a0a8091a97073df91a8b242dea2a` |
| `campus_safety_analysis/output/pdf/campus-safety-report.pdf` | `8a0efc6be9634ac85d7fe815c153961e721ac24e714fe66e8cdd5df05eceaa88` |
| `campus_safety_analysis/PROTOCOL.md` | `74c647e19010ac9a6adacf8eb4d039f9727a8a84e93c3f3ee04c96d2bad7af79` |
| `campus_safety_analysis/research/RESEARCH_REVIEW.md` | `c0d6e3c907508b14654723a338eed3560cea853c57d0fec60f9c631df0eaeed1` |
| `campus_safety_analysis/research/CITATION_VALUE_VERIFICATION.json` | `37c881f52a1e94fced25b58cd48a5da0f9729b5a4e74bf986ac8f33d2b58640e` |
| `campus_safety_analysis/research/asr_comparison_verification.json` | `6d549a482959acfd70011ca452735c5c195435d1f54d6230602d32053542ec82` |
| `campus_safety_analysis/sources/clery/residential_applicability_2024_verification.json` | `31fc6f67301051a585526fa9edd8ad3017a801526acc80d12dbfa2a1e4fddb02` |

The audit plan and earlier draft preserve the review stages; this completed audit supersedes their pending status only for the scope and versions stated here.
