# PDF visual and table audit

Reviewed 2026-09-25. Result: **PASS — no required visual or numeric fixes.** This review did not edit or regenerate the PDF.

Artifact: `output/pdf/campus-safety-report.pdf`, 7 pages, 206,075 bytes.

Final SHA-256: `8a0efc6be9634ac85d7fe815c153961e721ac24e714fe66e8cdd5df05eceaa88`.

Every page of the initial artifact (`a6f91361faaf406440baf0256cefd6a9b395117e9f3857ef3936de160979a333`) was inspected at readable resolution using `tmp/pdfs/report-1.png` through `report-7.png`. Pages 2–3 were independently rendered in grayscale at 120 dpi and inspected. No color-dependent meaning is used elsewhere.

Final revision: only page 6 changed, clarifying the BJS comparison as **60 rape incidents** and **40 official Clery rape incidents**. The final page was visually inspected using `tmp/pdfs/report-final-6.png` and its PDF text checked. The additional line fits cleanly; no clipping, overlap or footer collision. Earlier all-page, equation, grayscale and table checks remain applicable. Final page count and hash were verified directly from the PDF.

| Page | Checks | Result |
|---|---|---|
| 1 | Title hierarchy, introductory qualification, four paired UCSD/SDSU rows, table width, source note, footer | Pass |
| 2 | Both equations, fraction bars, subscripts, sum symbols and limits, variable definitions, paragraph boundaries | Pass |
| 3 | First 21 institution rows, wrapping of column heading, long institutional names, footnotes and footer | Pass |
| 4 | Remaining 21 rows, alphabetical continuation, SDSU discrepancy note, footer | Pass |
| 5 | All 11 residential rows, unmatched-boundary warning, clustered-disclosure/source-revision notes | Pass |
| 6 | Dense research/methods prose, headings, line spacing, bottom clearance | Pass |
| 7 | All 12 numbered references, source links, study link, page numbering | Pass |

## Mathematical notation

The PDF agrees with the website source `src/content/archive/campus-safety.md`:

- Annual: `R_it = k × C_it / N_it`.
- Pooled: `R_i,pooled = k × [sum(t=2022..2024) C_it] / [sum(t=2022..2024) N_it]`.
- `it` appears as a true subscript on R, C and N. The pooled label is below the R baseline. Both summations have upper limit 2024 and lower limit t=2022, applying to the entire three-year numerator and denominator.
- Fraction bars are continuous and clear of glyphs. Multiplication by k is conventional implicit multiplication. Variables and the default 1,000/optional 10,000 scale are defined in the adjacent prose.
- No unweighted average or cumulative victimization probability is implied. The text correctly distinguishes summed annual snapshots from unique people or measured person-time.

The formulas are embedded-font vector artwork, visually sharp at zoom. This audit establishes visual and semantic correctness; it does not claim tagged-PDF or PDF/UA mathematical accessibility.

## Numeric and layout cross-checks

All **57 displayed data rows** match the current published aggregate files after the report's two-decimal rate rounding: 42 on-campus institution rows, 11 residential institution rows, and 4 paired ASR-period rows (8 institutional case results). Counts, fall populations, branch counts and rates agree. Checks used `annual_rates.csv`, `dataset.json` and `case_study.json`; they did not import the report builder.

All extracted text boxes remain within the 612×792-point page boundaries. Visual inspection found no clipping, overlapping columns, broken glyphs, orphaned table headings or footer collisions. Table body text is 8.5 pt, footnotes 8.4 pt and body prose 10 pt: compact but readable. Grayscale retains dark header contrast and alternating light rows; interpretation does not rely on hue.

The PDF contains 22 link annotations. This audit checks their presence and visible source labels; the separate citation audit governs whether the linked sources support substantive claims.

No blockers or requested fixes. Re-review if the PDF hash changes.
