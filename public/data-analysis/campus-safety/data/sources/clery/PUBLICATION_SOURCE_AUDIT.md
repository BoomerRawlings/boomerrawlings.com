# Independent federal-source and calculation review

**Result: PASS.** No substantive category, arithmetic, source-unit or missingness error found in the reviewed dataset and website implementation. This is a computational/source review, not external peer review.

`audit_publication_from_raw.py` reads the original national ZIP directly. It does not import the production normalizer, 2024 housing derivation, study builder or website helper. The detailed machine-readable result is `publication_raw_audit.json`.

- Checked 17,808 original campus cells across on-campus/residential criminal and VAWA workbooks.
- Reconstructed and matched all 3,780 published institution/year/geography/category count cells, including missing values and the 11-category combined count.
- Recalculated all 7,560 annual and pooled CSV rows from those reconstructed counts and the independently acquired population extracts. Counts, summed populations, duration, numerator/population pairing and rates match.
- Verified all 212 campus identifiers against original table membership and the frozen API context. Original local API-response hashes and 1,060 critical context fields match.
- Confirmed only 2024 permits the 109 corroborated no-housing exclusions. Earlier blanks stay unavailable; numeric source zeros retain their meaning.
- Verified the combined measure contains exactly the 11 criminal-offense categories. VAWA, hate classifications, arrests, referrals and residential-subset counts are never added to the on-campus combined total.
- Reviewed the page, methodological content, explorer component and rate helper. Institution-wide federal counts are distinguished from the separate UCSD/SDSU main-campus ASR housing illustration; housing-property mismatch, SDSU denominator discrepancy and UCSD oldest-year corrections remain disclosed.

The dataset SHA-256 at review was `5a4ac282c79e3e0a6d6fec478b24b6bae1c47d8350863d582314de39a01ef998`. The audit checks that the dataset does not change during its run.

## Publication privacy check

The package allowlist contains public aggregates, campus identifiers, source metadata, documentation and code. It excludes the raw API responses and their staff-contact sections. Free-text campus descriptions were also removed because some contained contact numbers. The sanitized context retains the country and housing fields needed for this analysis; no counts changed. Source notes are attributed explanatory text, not operational instructions.

## Limits of this check

Population extraction is independently reviewed in the denominator audit; this check verifies use of the supplied population inputs. Correct arithmetic does not establish complete crime reporting, a unique-victim measure, campus-level student presence, or matching Clery/Auditor housing boundaries. The official meaning behind unavailable FILTER=0 years remains unresolved. The 2024 applicability rule uses a separately dated API context and must remain labeled accordingly.
