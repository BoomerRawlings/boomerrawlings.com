# Campus housing population review — 26 September 2026

This revision adds five verified population observations and makes qualified housing evidence visible in the school guide. It does not change any offense counts, reporting-geography decisions, federal archive or Crime and Heat artifact. The crime-report review remains dated 25 September; the additional housing-source review is dated 26 September. Retrieval is not a certification that an institution has released every record or that all possible sources have been exhausted.

## Adopted additions

| Institution | Reference period | Student residents | Source |
|---|---|---:|---|
| Yale | Fall 2022 | 6,255 | Office of Institutional Research W023, table and notes |
| Yale | Fall 2023 | 6,064 | Same source |
| Yale | Fall 2024 | 6,011 | Same source |
| Yale | Fall 2025 | 6,082 | Same source |
| Stanford | Autumn 2023 | 14,137 | Stanford Facts 2024, printed p. 46 / PDF p. 48 |

The [Yale housing dashboard](https://oir.yale.edu/data-browser/student-data/housing/housing-university-wide-summary-w023) links the recovered official report. It states that counts are taken in the fall and was updated 16 October 2025. Its student categories include students living with partners or dependents, without adding those family members as students. Current Yale crime sources cover the main and West campuses; West's residential core-offense counts are zero in 2022–2024. The population has not been independently matched property by property to Clery residential geography, consistent with the qualification applied to existing institutional proxies.

The [Stanford fact book](https://web.archive.org/web/20240414165344id_/https://facts.stanford.edu/wp-content/uploads/sites/20/2024/01/Stanford-FactBook2024_WEB.pdf#page=48) was recovered from a 14 April 2024 archive capture of the original university file. Its file digest matches the archive index. The population is 7,207 students in undergraduate housing plus 6,930 in graduate housing; these are housing classifications, not a new classification by students' degree levels. The original live URL is no longer available. University-provided housing remains a qualified institutional proxy, not an annual mean or parcel-matched population.

Source hashes, locators, census dates and scope are recorded in [population_sources.csv](population_sources.csv).

- Yale PDF: `8d7839f251567871886d0d09393f75825906f0d34b9d2e7f45c3c82197c9e918`.
- Archived Stanford PDF: `c622530f7b570d190ee2b374e7395aa15ae6b4777fa5649541610043bdb2f2d2`.

## Coverage and interpretation

Usable combined housing counts remain 33 of 42 institutions for 2024. Adopted populations and paired rates increase from 13 to **14 of 42**. The adopted-population ledger contains 169 observations: 126 enrollment and 43 resident observations. Five additions in this revision supplement the five added previously.

Yale's 2024 combined housing count of 56 divided by 6,011 residents gives **9.32 reports per 1,000 residents**. Stanford's 2023 count of 50 divided by 14,137 gives **3.54**. These are descriptive reporting ratios, not victimization percentages or safety rankings. Two institutions now have adopted 2025 housing populations, but neither has a complete 2025 combined housing numerator; 2025 rates remain unavailable. No earlier population is carried forward.

## Qualified evidence and remaining gaps

[resident_evidence.json](resident_evidence.json) retains **37 observations across 14 other institutions**: Cornell, Dartmouth, Florida, Georgetown, Georgia Tech, Illinois Urbana-Champaign, Massachusetts Institute of Technology, Ohio State, Penn State University Park, Pennsylvania, Texas Austin, Virginia, Washington and Wisconsin. Observations include exact partial counts, approximate or lower-bound figures, and unresolved definitions. Each has its source, locator, reference period and reason it cannot currently support the institution-wide rate. Fiscal and academic spans do not silently become fall censuses.

Examples include Florida occupancy embedded in a chart image, Dartmouth's undergraduate housing dashboard, Illinois residence-hall contracts, Washington's residence-hall subset and Cornell's Ithaca population. Cornell's 8,861 student residents appear in the July 2024–June 2025 performance-year tables; the source excludes Cornell Tech, which contributes two of the institution's 47 housing offenses in 2024. Neither a whole-institution rate nor an exact fall 2024 rate follows from that combination. No narrower Cornell rate is published in this revision.

The school guide now distinguishes partial evidence, approximate figures, definitions needing clarification and totals not yet verified. Its disclosure shows the documented observation and the specific limitation. These observations never enter the rate calculation. An institution absent from this qualified ledger may still have useful public data; unsuccessful retrieval or a bounded search does not prove otherwise.

The Washington Treasury listing points to a newer 2025 bondholder disclosure, but that document was not acquired. Its destination required affirmative acceptance of an agreement; no agreement was accepted. Existing 2024 evidence is labeled by its actual source and period. No institution was contacted and no new records were requested.

## Audit and reproduction

Independent checks cover the recovered Yale and Stanford source pages, source/period/geography interpretation, all 9,450 calculation combinations and all 9,450 school-guide selections. The reader tests verify that qualified evidence never changes a count, denominator or rate; evidence is restricted to the selected institution, housing view and stated year/span. Repeated source links retain all relevant page locators. Source and citation review is separate from numerical and visual checks; these are not external human peer review.

The current report, interface and audit versions are identified in the artifact manifest and visual/source audit records. The old report checksum and coverage in EXPANSION_AMENDMENT.md identify the preceding release only. The README supplies a ten-product scientific replay plus a separate qualified-evidence replay. Original source PDFs and downloaded webpages are retained locally for audit rather than redistributed in the public archive.
