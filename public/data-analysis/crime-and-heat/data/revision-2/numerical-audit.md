# Numerical audit of the methodological revision

24 September 2026. **All 22 revised fits and all 24 planned hypothesis tests passed computational validation.** This is automated numerical review, not human peer review or independent verification of the agency's underlying records.

## Scope and methods

The analysis plan was frozen before revised estimation. A separately documented provider-quota amendment restricted the revision to 64 ZIPs with complete corrected weather, encompassing 57,903 eligible all-record groups and 6,501 core-DV groups during 2021–2024. Acquisition availability was not random. Original full-sample results remain available; the restricted revision does not establish representativeness of the missing geography. Core-DV reference fitting excludes one all-zero ZIP, leaving 63 fitted ZIPs.

The validator imports no production fitting or preparation code. It:

- Independently refits both corrected reference models using `statsmodels` conditional Poisson likelihood, with ZIP intercepts conditioned out, BFGS optimization from zero and separate MINPACK score-equation polishing. Final implied coefficient steps are below 1.7×10⁻¹⁵. BFGS initially reported objective precision loss; the polished score solution, rather than that optimizer flag, establishes numerical convergence.
- Independently reconstructs all 22 designs with pandas indicators and evaluates the natural-spline functions using SciPy cubic interpolation with linear tails.
- Recalculates full information matrices, scores and full Bartlett sandwich covariance, comparing them with the production engine's projected-score implementation. All 1,461 calendar dates remain in the score sequence, including missing station dates as empty score days.
- Verifies the paired legacy/corrected samples, the paired modeled/station samples, strict-count totals, spline knots, certified separation support and the manual Holm step-down correction across all 24 tests.

Both independently optimized reference coefficients agree within 1.2×10⁻¹⁶, and standard errors within 8.1×10⁻¹⁶. Across all models, maximum covariance discrepancy is 1.26×10⁻¹¹; maximum discrepancy in reconstructed daily predicted counts is 1.43×10⁻¹⁴. Saved hashes identify the tested panel, results and validator. Machine-readable checks accompany this note in `numerical_validation/`.

## Diagnosed estimation boundary

The first core-DV model with ZIP-specific annual seasonality encountered separation: two ZIPs each contained a positive outcome at only one annual phase. Their seasonal nuisance coefficients can diverge while the exposure coefficient remains estimable. The failure and its diagnosis are retained.

A certified extended-MLE calculation removes only zero-count rows whose limiting fitted means are zero, retains every positive count and matching-phase zero, and removes redundant seasonal columns. This removes 2,918 zero rows from the nonstation core-DV seasonal fits and 2,893 from the paired-station core-DV fits. The independent audit confirms the exact phase support, finite reduced scores and covariance. The complete descriptive panel is unchanged. This resolves a numerical boundary of the planned model; no event-count threshold, penalty, alternative temperature formula or extra hypothesis was introduced.

## Statistical interpretation

The corrected restricted-sample reference estimates remain inconclusive:

| Outcome | Change per 10°F | Individual 95% interval | Nominal p |
|---|---:|---:|---:|
| All eligible record groups | +1.91% | −0.02% to +3.88% | 0.05287 |
| Core DV groups | +2.74% | −1.23% to +6.87% | 0.17903 |

Corrected versus legacy temperature produces nearly identical reference estimates on the same sample. HAC14/28 intervals also include a count ratio of one. These checks do not prove absence of an association.

Three sensitivity tests have nominal p<0.05: general ZIP-seasonality, general warrant exclusion, and previous-day temperature for core DV. **None of the 24 tests survives Holm correction; the smallest adjusted p is 0.39844.** All results are disclosed. Spline bands are pointwise, not simultaneous; bandwidth comparisons are audit sensitivities. The amendment remains retrospective, with prior published estimates already known.

Numerical agreement cannot repair unknown record completeness, identifier/date semantics, geographic selection, enforcement/reporting mechanisms, uncertain personal exposure or uncontrolled confounding. NOAA substitution is an alternate-source sensitivity, not proof of superior exposure measurement. The defensible outcome remains recorded administrative groups, not crime incidence or a causal effect of heat.
