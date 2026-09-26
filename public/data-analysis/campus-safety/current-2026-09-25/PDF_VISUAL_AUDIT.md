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
