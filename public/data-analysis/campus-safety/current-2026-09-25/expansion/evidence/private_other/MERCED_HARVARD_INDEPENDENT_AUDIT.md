# Independent Merced and Harvard source-grid audit

**PASS: 1,344 cells checked against original source PDFs; no extraction discrepancies.** Independent `pdfplumber` extraction, without reading or importing the producers' extraction scripts. All nine rendered table pages were separately inspected for year/geography order, categories, nonzero cells and footnotes. Source hashes, page locators, years, unique keys, raw values, missingness statuses and category families also checked. The executable auditor and JSON record accompany this note.

| Report | Core cells | Numeric | Explicit unknown | Source pages |
|---|---:|---:|---:|---|
| [UC Merced 2025 ASR](https://clery.ucmerced.edu/sites/g/files/ufvvjh631/f/documents/ucm_2025_asr.pdf#page=156) | 168 | 168 | 0 | PDF 156–157; unnumbered appendix |
| [Harvard 2025 ASR](https://www.hupd.harvard.edu/sites/g/files/omnuum12486/files/2025-10/2025%20ASR%20VF%20Compressed.pdf#page=70) | 1,176 | 798 | 378 | PDF/printed 70–76 |

The 603 arithmetic checks passed: printed geographic totals, housing as a subset of campus, and Harvard's category-column totals. Harvard's printed TOTAL rows combine the eleven criminal-offense categories and the three Violence Against Women Act categories; they must not be labeled the eleven-category criminal total. Merced prints years in descending order; Harvard prints ascending order. Both were checked explicitly.

Harvard's omitted columns remain **unknown**, not zero. Cambridge and Longwood print all four geographies. Harvard Forest prints residential but omits noncampus; Arnold Arboretum, Concord Field Station, Greece and Chile omit residential and noncampus. A printed total that reconciles without an omitted column does not independently establish structural absence. Any subsequent no-housing adjudication needs separate source evidence; this audit preserves all 378 unknown cells.

No scientific data or producer outputs changed. This review covers the source grids and associated provenance, not every policy statement in either report. Rerun `python audit_merced_harvard_independent.py` from this directory or by absolute path; it resolves all inputs relative to the script and emits `MERCED_HARVARD_INDEPENDENT_AUDIT.json`.
