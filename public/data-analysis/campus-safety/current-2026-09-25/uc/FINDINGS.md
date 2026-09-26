# UC annual-report freshness and geographic-count review

Reviewed September25,2026. This audit preserves the original federal collection and does not change the published analytical data. It establishes a separate, versioned institutional-report series. Sources are official university publications. `inventory.json` records landing/report URLs, retrieval times, exact downloaded hashes, scope and denominator leads; individual `*_metadata.json` files retain HTTP provenance.

## Coverage and verification

All10 UC institutions were searched. Current PDFs were downloaded for9, covering all17 of their federal reporting branches. The extraction contains2,856 cells:14 study categories ×4 geographies ×3 years ×17 branches. Of these,2,660 are numeric;112 explicitly N/A;84 columns not printed. All core-table pages were rendered and visually checked by the extracting reviewer. This is an independent source review relative to the original study; it is not a second-person certification of these new extraction outputs. The deterministic parser checks uniqueness, housing≤campus and printed totals where available; original tokens and footnote corrections are retained. Berkeley’s malformed font mapping required a manual transcription of PDFp126; visual recheck corrected an initial stalking public-property transcription before the final output.

Every downloaded PDF hash was recomputed and matched stored metadata. UCSF’s separate five-page statistics supplement agrees with full ASR PDFpp84–88 in all1,050 numeric core-category and unfounded cells. Unfounded columns and UCLA’s sexual-assault subtotal are excluded from the14-category extraction.

UC Merced: official listing displays the2025 report, but fresh direct requests returned403 and the web reader later timed out on the PDF. No downloaded bytes/hash or current Merced count extraction is claimed. No assertion that an unobserved2026 report cannot exist is warranted. Retain its frozen federal values with explicit source vintage until verification succeeds.

## Current versions

| Institution/reporting scope | Current report edition | Statistic years | Core table PDF pages |
|---|---:|---|---|
| Berkeley main |2025|2022–2024|126|
| Berkeley’s Washington Center |2026|2023–2025|21–22|
| Davis + Davis Health |2026|2023–2025|26–28|
| Irvine + Health Medical Center |2025|2022–2024|196–197;199–200|
| UCLA |2025, revised April2026|2022–2024|162|
| Merced |2025 displayed; PDF unverified|2022–2024 per earlier web retrieval|Not extracted|
| Riverside + Palm Desert |2026|2023–2025|157–159;161–163|
| San Diego |2025, reissued February2026|2022–2024|142–143|
| San Francisco, all5 branches |2026|2023–2025|84–88; supplement1–5|
| Santa Barbara |2026|2023–2025|218–222|
| Santa Cruz |2025, republished May6,2026|2022–2024|10–13|

Berkeley has mixed branch vintages. Its2025 main report cannot provide an institution-wide2025 total merely because Washington Center has2025 statistics. Santa Barbara’s official current report is a Google document; the recorded hash identifies the dated PDF export, not a permanently immutable URL. Fresh HTTP listings superseded stale search-cache2025 labels for several institutions.

## Federal comparison

`federal_comparison.csv` contains2,240 overlapping cells.2,030 have numbers in both sources:2,011 match and19 differ. Remaining210 have at least one missing/nonapplicable cell and are not numerical confirmations. The differences below refer specifically to the frozen2025 federal collection, not necessarily every prior institutional edition.

- Davis2024 fondling: housing85→86, campus92→93. Source footnote2 describes one incident formerly grouped with2025. Footnote1 explains80 incidents between the same parties and retains a stale parenthetical campus92; the table and footnote2 support93.
- Riverside2024 dating violence: housing13→11, campus19→14. Stalking: housing3→2, campus11→10.2023 dating footnote also describes revisions relative to an earlier ASR, but the frozen federal collection already contains the current2023 values.
- San Diego2022: rape campus14→15 and noncampus4→5; fondling noncampus8→12; arson housing1→0; stalking campus14→15. Source table footnotes explain these changes.
- Santa Cruz:2022 motor-vehicle theft campus7→3;2023 motor-vehicle theft campus4→7/noncampus0→1;2024 domestic violence housing14→16/campus18→19;2024 dating violence campus0→1;2023 stalking housing9→8/campus20→19. Its domestic-violence footnote identifies an April30,2026 correction of data-entry errors and also noncampus0→1; the frozen federal noncampus cell is blank, so that is not included among the19 numeric differences. The other observed discrepancies are not explained by the table footnotes and must not be attributed to a guessed mechanism.

Irvine, UCLA, Berkeley, UCSF, UCSB and UCDC have no numeric differences in the compared overlapping cells. This does not convert missing cells into agreement.

## Geography and interpretation

Housing is a subset of campus. Other-campus = campus minus housing only when both are known. All reported Clery geography = campus + noncampus + public property, never housing + campus + noncampus + public. These boundaries exclude much ordinary off-campus community crime; the result is not all crime experienced by students. Source counts include nonstudents and reports received long after occurrence.

N/A is preserved. Irvine Health explicitly has no student housing (PDFpp199–200); Davis Health housing is N/A in2023–24 but opens at ANOVA Aggie Square in June2025, after which the report prints numeric zeros. UCDC explicitly reports no qualifying noncampus properties (PDFp23); its N/A cells can support a separately documented structural-not-applicable total rule, but are not raw reported zeros. Riverside Palm Desert has no housing (PDFpp7,34,165); its noncampus column is omitted without an equally explicit absence statement located in this review. A total involving that omitted column remains incomplete unless additional scope evidence supports exclusion. UCSF prints numeric housing zeros for nonresidential branches; those remain source zeros.

Larger counts can reflect clustered reporting rather than more unique victims: Berkeley2023 includes39 campus rape incidents in one report between two unaffiliated parties; UCLA2023 has36 of61 campus rape and an estimated36 of58 fondling incidents from one report received years later; Santa Cruz2024 housing rape38 includes21 incidents in one report. UCLA also includes dating violence in domestic violence beginning2022, so its printed dating zeros are not a count of no dating-related violence. Category comparisons must retain these institution-specific notes.

## Resident denominators

No exact dated and geographically matched2025 resident count was established by the source search. `inventory.json` records the campus-specific official leads and reasons for rejection: rounded news estimates, bed capacity, projected occupancy, one-complex totals, undergraduate-only coverage, or mixed student/staff/family populations. This is a documented search limitation, not proof the numbers are unavailable anywhere. Do not substitute2024 residents or beds for2025 actual residents. Publish2025 counts where source coverage is complete; leave resident rates unavailable pending an aligned denominator. ASR years are calendar years; a fall census remains a snapshot proxy rather than person-time.

## Outputs

- `inventory.json`:10 institutions and additional branch reports, provenance and denominator leads.
- `current_core_counts.csv/json`:source-specific raw values, status, category, geography, report edition/year, page and hash.
- `federal_comparison.csv`:overlap values/statuses and numeric differences.
- `extraction_checks.json`:verification scope and differences.
- `extract_current_core.py`:repeatable extraction with explicit table mappings and documented footnote/manual exceptions.
- `qa/`:rendered core table pages used in visual verification.

The old2022 values absent from2026 editions are historical observations from an earlier publication; they were not reaffirmed by the newest report. A future unified series needs a per-cell latest-source rule and preserved original-to-current revision ledger. No core website, PDF, frozen input, or original citation audit was changed by this review.
