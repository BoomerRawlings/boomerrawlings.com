# UC San Diego vehicle-theft comparison: independent numeric audit

Audited 2026-09-29. Result: PASS, 81 independent input checks. Research-only audit; website and original scientific inputs unchanged by this audit.

## Conclusion

For calendar 2024, University of California San Diego (UCSD) has 444 reported on-campus motor vehicle theft offenses and 44,256 enrolled students in the fall snapshot: **10.03254 reports per 1,000 enrolled students**. This is a descriptive population adjustment, not a probability of victimization.

| Comparison | Available | UCSD raw-count position | UCSD rate position |
| --- | ---: | ---: | ---: |
| Nine undergraduate-serving University of California institutions | 9 of 9 | 1st | 2nd |
| All ten University of California institutions | 10 of 10 | 1st | 3rd |
| Existing study's selected 42 institutions, current institutional-source snapshot | 39 of 42 | 1st | 3rd |

Riverside: 389 reports / 26,384 students = 14.74378 per 1,000. San Francisco: 39 / 3,007 = 12.96974 per 1,000. San Francisco has zero undergraduate enrollment in the same federal enrollment source. Its exclusion must therefore be described explicitly as a peer-group definition; it cannot be called all University of California campuses. The nine-school comparison still uses total enrollment, including graduate students, at each institution.

The adjustment does not support a blanket claim that UCSD has low theft. It changes UCSD from the largest raw total in these groups to a lower position by enrollment-adjusted rate, which remains high among the selected peers. These groups do not establish a national rank or the safest/worst campus.

## Input and geography reconciliation

- UCSD's 2024 count is unchanged between the current institutional report and the original federal snapshot: 444 on campus, including 8 in campus residential locations. The housing subset must not be added to the campus total.
- UCSD's noncampus count is 3 and adjacent public-property count 10. All geography combined is 457, or 10.32628 per 1,000 enrolled students. This differs from the on-campus comparison by geographic scope, not a revision.
- Only 34 of 42 schools have complete all-geography motor vehicle theft totals. Riverside is missing an adopted noncampus value. Do not switch the comparison silently to all geography or treat missing values as zero.
- The current on-campus comparison has missing offense counts for Georgia Tech, North Carolina Chapel Hill and Pennsylvania. Their enrollment is available, but no current rate is calculated. Original federal values remain in the historical snapshot.
- Among the 39 schools with current numeric on-campus counts, Georgetown changes from zero in the federal snapshot to one in the current source. Other 38 adopted numeric counts match the federal snapshot, including all ten University of California institutions.

## Independent checks

`audit_numbers.py` independently reads the original `EF2024A.zip` CSV, requiring `EFALEVEL=1` and using `EFTOTLT`. It checks all 42 denominator values against the published JSON and the enrollment ledger. It separately sums the current source-cell ledger's on-campus motor vehicle theft cells for all 39 schools with an adopted count. Three explicitly not-yet-opened branch rows are inapplicable for 2024 and omitted; all other applicable count cells must be numeric. No unknown cell is converted to zero.

`numeric_audit.json` contains exact rates, group-specific ranks, missingness, differences and five input SHA-256 hashes. `provenance.json` contains every underlying on-campus source cell with page, URL and original report hash, plus each exact enrollment source row and the raw federal archive hash. `comparison.csv` is a 42-row aggregate download with count, population, exact rate, geography breakdown and source URLs. Empty cells mean unavailable.

## Source references

- UCSD, 2025 Annual Security and Fire Safety Report, February 2026 reissue, printed/PDF p.142: https://www.police.ucsd.edu/docs/annualclery.pdf#page=142. Original source SHA-256: `d4d01766e4f4e7de813a320a5484c8a91d7d41b8862a3a15f85d88b0d3a3a0bb`.
- National Center for Education Statistics, Integrated Postsecondary Education Data System, Fall 2024 enrollment: https://nces.ed.gov/ipeds/complete-data-files/EF2024A.zip. `ef2024a.csv`, `EFALEVEL=1`, `EFTOTLT`. Original archive SHA-256: `bb3256a68a1ffcbf2fcc85faf80ac14f055ccd75454d3a440dfff80a63671567`.
- Remaining institutional report locators are retained row by row in `provenance.json`; aggregate source snapshots are the current study's `dataset.json` and `source_cells.csv`, hashed in the audit.

This audit checks the preserved source snapshot and raw denominator files. The separate [source review](SOURCE_REVIEW.md) verifies UC San Diego's new 2026 edition on September 29 and confirms the same 2024 vehicle-theft figures. The changing annual-report URL above now serves that 2026 edition; the captured 2025 source is identified by its hash and retained source-cell records. No national data acquisition or nationwide ranking is claimed.
