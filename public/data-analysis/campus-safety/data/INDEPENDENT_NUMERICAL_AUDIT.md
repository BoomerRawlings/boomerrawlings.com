# Independent numerical audit

PASS: 312,999 checks; 0 errors.

42 institutions; 126 annual headcounts; 33 documented occupancy denominators. All 5,670 annual and 1,890 pooled rate rows independently recomputed. Maximum absolute rate difference: 0.

Checks start from normalized source campus cells and source-year eligibility, independently sum all listed branches, preserve missingness, join annual IPEDS once per institution, and compute pooled rates from summed counts divided by summed populations. The 2024 housing amendment is independently reconstructed from explicit no-housing API declarations for 2024 only; earlier blanks remain unavailable. ASR case-study rates are also recomputed from the separate verified transcription. The root build script is never imported. Original XLS extraction is covered by a separate audit.

SDSU's 2024 IPEDS total of 41,137 differs from the CDS/Auditor total of 39,373. The full population reconciliation remains unresolved. Housing-boundary matching remains unverified. These limitations do not change the arithmetic result and must remain visible.

The companion JSON records every check count, availability summary and exact published-file hashes. Rerun after publication-data changes.
