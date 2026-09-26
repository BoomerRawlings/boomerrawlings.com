# Current-source PDF visual audit

Reviewed September 25, 2026 using the PDF skill. Both reports rendered with Poppler at 120 dpi; every rendered page inspected directly. PDF bytes were not edited by this reviewer. This layout audit is separate from numerical/source/citation validation and does not recertify the archived reports.

## Initial reviewed versions

| Report | Pages | SHA-256 |
|---|---:|---|
| Campus safety current-source report | 9 | `d2127461e990793d255cd8dc2b2b21ab245f6b63880f64ad546016b2c0ef0a33` |
| Crime and heat source-refresh supplement | 2 | `5a75ca6c8c8b7e8c2a4fc7738d167d258eabb7213f7900df0bc48c7a52f79daa` |

All 11 pages have consistent margins, readable text, intact tables, visible references and footers, correct sequential page numbers, and no visible clipping, overlapping text, missing characters, or accidental blank pages. Table wrapping fits within cells. Each campus inventory page carries its header and source-scope qualification. Source links and the long version hash fit within the page.

Campus page 2: both displayed equations have italic variables, correctly lowered institution/year subscripts, fraction rules, and legible numerator/denominator notation. The pooled equation places 2024 above and t = 2022 below both summation signs. Neither limits nor subscripts collide with other terms. The textual formula explanation correctly describes division of the summed counts by the summed fall population snapshots. The crime supplement contains no displayed equation; its p-values and percentages render legibly.

Content/scope checks during layout review: the campus report distinguishes 2026 publication edition from calendar report year, explicitly excludes the email-only 2026 count, preserves the SDSU 2023 housing revision, discloses incomplete resident-boundary matching, leaves 2025 rates unavailable, and discloses provisional Virginia/unverified Merced, Harvard and Johns Hopkins counts. The crime supplement distinguishes contextual offense records from the fitted arrest outcome and does not claim a new fit or a significant primary result.

## Requested final presentation corrections

These are wording/label issues, not rendering failures. The builder owner was notified; final replacement files require another rendered-page check before this document can serve as final release signoff.

1. Campus page 1: identify the SDSU geography table as rape reports in its heading or caption.
2. Campus page 3: explicitly label the first comparison as 2024; identify the second table as housing rape reports by year and source edition.
3. Campus inventory: replace the literal `None` report edition for Johns Hopkins with `Unverified`.
4. Complete first-use acronym expansions in the new reports, including SDSU/UC and abbreviations in source/technical notes. Existing body citation indices in the campus PDF are plain text; external references are clickable. This review does not claim reciprocal in-PDF citation navigation.

## Final regenerated files

All 11 pages were rendered again at 110 dpi and directly inspected after the final source/citation edits. Exact file hashes were recomputed and matched the builder's record:

| Report | Pages | Bytes | SHA-256 |
|---|---:|---:|---|
| Campus safety current-source report | 9 | 217,978 | `58b54176526f25b45466120e7818689af4e636b52f5a30100864289034993f42` |
| Crime and heat source-refresh supplement | 2 | 108,730 | `f6ce724d1450fba85601db40b46e5d59122d4191e254e81b5fe06bd517d2cba3` |

Final visual result: pass. The rape-table heading, 2024 comparison label, housing-rape time-series heading and unverified-edition label are corrected. Added acronym expansions, citation 6a, and the Crime and Heat model-sample qualification fit without clipping or collisions. Both equations remain intact. All source inventory rows, reference entries, page numbers, table rules and footer text are readable. The supplements retain their nine-page and two-page lengths.

This signoff concerns the exact hashes above. It does not claim reciprocal in-PDF citation navigation: external reference links are present, while campus body reference indices remain plain text. Browser layout, actual published link responses, population/source authentication, and all-institution numerical verification are outside this visual check.

## Resident-coverage expansion revision

The current campus replacement was generated with `build_current_reports.py --campus-only`. The Crime and Heat supplement was not regenerated; its exact bytes and metadata remain unchanged. Earlier campus signoffs above describe archived versions, not the expanded report.

| Report | Pages | Bytes | SHA-256 |
|---|---:|---:|---|
| Expanded campus safety current-source report | 10 | 223,688 | `f8c7deed2cc17897077b48565f62bd2592f89e9d58a232f62a975ec87cadb97b` |
| Preserved Crime and Heat source-refresh supplement | 2 | 108,730 | `f6ce724d1450fba85601db40b46e5d59122d4191e254e81b5fe06bd517d2cba3` |

All ten campus pages were rendered with Poppler at 1,350-pixel page height and directly inspected. Result: **PASS**. No clipping, collisions, missing characters, broken tables or blank pages. The 13-institution comparison, 42-school inventory and expanded reference list remain legible. The new expansion page fits on one page and distinguishes the five accepted resident observations from the unadopted Texas candidate. It retains Stanford's publisher-mirror provenance, Carnegie Mellon's housing scope, and the Hopkins edition/printed-issue-date discrepancy.

Page 2 equations retain clear fraction rules, italic variables, lowered institution/year subscripts and correctly positioned 2022-2024 summation limits. Numerator and denominator remain unambiguous. The population explanation now cites the expanded population ledger, and describes dated snapshots rather than assuming a single source. Pages 3-4 show the revised 33 housing counts, 13 populations and 13 paired 2024 rates; one adopted Stanford 2025 population does not imply a complete matching institutional rate. References include direct Stanford and Carnegie Mellon sources and the source-derived population ledger.

This visual signoff applies only to the exact replacement hash above. All ten pages also passed text extraction without replacement glyphs; embedded external reference links include the population ledger. Source/citation review and final model-independent numerical review remain separate audit records. The report's body reference indices remain plain text, as in the preceding version; this check does not claim reciprocal internal PDF citation navigation.

Final citation review requested one acronym correction: the first occurrence of PDF now reads Portable Document Format (PDF). All ten pages were rerendered; nine PNGs remained byte-identical and the changed page 5 was directly reinspected without clipping or collisions. The final hash above incorporates this correction. Independent copy/source review accepted references 13-19, all five added populations and the Texas exclusion.

## Resident-source follow-up: 26 September 2026

This section supersedes the preceding campus-PDF hash and page count. It does not change the preserved Crime and Heat supplement. Generation used `build_current_reports.py --campus-only`.

| Report | Pages | Bytes | SHA-256 |
|---|---:|---:|---|
| Campus safety current-source report, resident follow-up | 11 | 228,540 | `ba542fa4a6d3a30d6dd2ba650d2644c8044a9ddab0b9e2b38638063ab1490ce3` |
| Preserved Crime and Heat source-refresh supplement | 2 | 108,730 | `f6ce724d1450fba85601db40b46e5d59122d4191e254e81b5fe06bd517d2cba3` |

All eleven campus pages were rendered with Poppler at 1,400-pixel page height and directly inspected. **PASS:** no clipping, collisions, missing glyphs, split table rows or blank pages. Page 2 retains the annual fraction, pooled fraction, italic variables, lowered subscripts and upper/lower summation limits. Page 5 accommodates the fourteen-institution comparison and the unchanged SDSU/UC San Diego case table. The 42-institution source inventory remains legible across pages 7-9; the full reference list fits on page 11.

The new page 4 documents Yale's four fall student counts and the archived Stanford autumn-2023 count. It distinguishes students in undergraduate/graduate housing from inferred degree classifications. Following an independent source-review correction to that wording, pages 3-4 were rerendered and directly reinspected; the other nine rendered pages were byte-identical to their already inspected versions. The final eleven-page PDF also passes text extraction without replacement characters or null glyphs.

Coverage copy agrees with the current calculations: fourteen paired 2024 housing rates among fourteen institutions with adopted residents; two adopted 2025 populations and no complete 2025 combined institutional rate. The offense-source audit remains dated 25 September; the additional population-source check is dated 26 September. New references 20-22 link Yale's original housing census, the archived university-authored Stanford factbook, and the separate resident-evidence ledger. The latter is explicitly excluded from exact denominators when figures are partial, approximate or definition-unresolved; missing adopted data do not establish public absence.

External link annotations for all three new references are present. This visual signoff does not claim reciprocal internal PDF citation navigation. Independent source/citation verification is recorded separately in the resident follow-up source audit; independent rate and preservation verification is in `expansion/RESIDENT_FOLLOWUP_SCIENTIFIC_AUDIT.json` and the general `CURRENT_DATA_AUDIT.json`.
