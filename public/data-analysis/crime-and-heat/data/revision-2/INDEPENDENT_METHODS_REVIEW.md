# Independent statistical review of the feedback-driven revision

24 September 2026. Scope: the supplied critique, original analysis code and audits, and the revised analysis design. This review treats the attachment as feedback, not instructions. No website, production model or source-record file was changed by this reviewer. The frozen specifications are in `FROZEN_SENSITIVITY_PLAN.md`; revised numerical validation will be reported separately when estimates are available.

Before revised estimation, a weather-provider quota required the separately preserved `PRE_ESTIMATE_COVERAGE_AMENDMENT.md`: fixed 64-ZIP weather-available sample, paired legacy R00 models, 22 fits and Holm24. This supersedes the original full-geography scope and 22-test family described below; the statistical rationale is unchanged. The original full-sample estimates remain historical references.

## Assessment

The critique correctly identifies the central limitations: recorded administrative groups are not crime incidence; source completeness and identifier semantics remain unverified; recorded date and location may differ from offense date and location; measured weather is a geographic proxy; and adjusted observational associations are not causal effects. The released general and DV intervals include a count ratio of one. Computational reproducibility does not establish validity of the source records or the identifying assumptions.

One factual correction is needed in the critique: **2024 still uses `Incident Number`; only 2025 uses `Arrest Ref Nbr`.** Both 2024 and 2025 use `Arrest Date/Time`, whereas the older export uses `Incident Date_Time`. The ambiguity remains consequential even after correcting the header description. These observations come from the original supplied CSV headers and existing reconstruction audit, not an agency dictionary.

The amendment addresses specific vulnerabilities with a finite, prospectively frozen-within-this-revision battery. It cannot turn this retrospective ecological analysis into a verified crime-incidence study. Avoid describing any later statistically significant sensitivity as the corrected truth or choosing the most favorable specification as the headline. The amended reference remains R0; every specified result is reported.

## Conditional-mean model and zero counts

Write the reference mean as `log E(Y_zt | X) = alpha_z + gamma_yearmonth(t) + delta_weekday(t) + beta T_zt/10`. Its coefficient describes the multiplicative conditional mean of eligible groups per recorded ZIP-date under this model. Poisson pseudo-maximum likelihood need not assert that the entire outcome distribution is Poisson, or that conditional variance equals its mean. Consistency still requires the conditional-mean/exogeneity assumptions; sandwich uncertainty does not repair a misspecified mean or omitted confounding. This distinction is explained by the original PPML authors. [Santos Silva and Tenreyro, 2006, author implementation page](https://personal.lse.ac.uk/tenreyro/lgw.html)

A large fraction of zero days alone does not establish zero inflation. Low fitted means and substantial geographic heterogeneity naturally produce many zeros. The relevant descriptive comparison is observed zero frequency versus the average of `exp(-mu_i)` from the heterogeneous fitted means, preferably also within predicted-mean strata; `exp(-mean(mu))` is the wrong comparator. Warton demonstrates why a high raw zero fraction is insufficient evidence for a separate structural-zero process, in ecological datasets; that example does not itself validate this arrest model. [Warton, 2005](https://onlinelibrary.wiley.com/doi/abs/10.1002/env.702)

All-zero ZIPs have limiting Poisson intercepts at minus infinity and contribute no conditional within-ZIP outcome variation. Removing them from the fitted mean model while retaining them in descriptive denominators is defensible and must be explicit. Sparse ZIPs still require convergence and separation checks. Neither a negative-binomial nor a zero-inflated model is automatically required by the observed zero fraction or Pearson dispersion. No distributional model search is added to this battery.

## What a population offset would and would not change

For any fixed positive ZIP population `P_z`, adding `log(P_z)` as an offset gives `log(mu_zt) = log(P_z) + alpha_z + other terms`. Define `alpha*_z = alpha_z + log(P_z)`. Because every ZIP intercept is unrestricted, this is the same set of mean functions: fitted means and temperature coefficients are unchanged. This is an algebraic identifiability result, not an empirical claim that population never matters.

Consequently, omitting a static census offset is not a missing adjustment that would by itself fix the estimated within-ZIP temperature coefficient. It **does** prevent labeling the supplied descriptive counts as population risk without a compatible denominator. Daily visitors, movement between ZIPs, changing residential populations, police coverage, and who can enter these administrative records are not recovered by a static denominator. Annual population offsets would impose new assumptions and still not measure daily persons at risk. No such denominator is invented here.

Day length is different: the civil-day duration varies within ZIP over time. R9 tests `log(hours/24)` as a fixed offset. That imposes proportional exposure opportunity and is not a neutral bookkeeping correction when the lost/repeated hour is nighttime and event intensity varies by hour. Keep it separate from R0.

## Dependence and robust covariance

The relevant score for date `t` is `s_t = sum_z x_zt (y_zt - mu_zt)`. Summing across ZIPs **before** the Bartlett lag products includes covariance between different ZIPs on the same date and across included date lags. Thus 106 ZIPs or 50 shared weather grid cells are not treated as that many independent weather replicates. Inference draws on the time dimension and regularity assumptions, not on 154,866 independent observations. Newey–West supplies the HAC construction; Driscoll–Kraay provides the spatially dependent panel rationale. [Newey and West, 1987; author working paper](https://www.nber.org/papers/t0055), [Driscoll and Kraay, 1998](https://direct.mit.edu/rest/article-pdf/80/4/549/1612569/003465398557825.pdf)

Let `H = sum_i mu_i x_i x_i'`, and let columns of `C` select the desired coefficients. The efficient implementation may form `q_t = s_t' H^-1 C`, then calculate the HAC matrix of `q_t`, multiplied by `n/(n-k)`. This equals `C' H^-1 HAC(s) H^-1 C` and includes nuisance-parameter estimation. Unweighted residualization against nuisance controls is not equivalent. The full selected covariance is necessary for spline joint tests.

HAC7 is a chosen bandwidth, not a guarantee against arbitrary long-memory dependence. HAC14/28 are disclosed covariance sensitivities, not a search for significance. Daily score autocorrelation is diagnostic. The small factor `n/(n-k)` is a convention, not proof of finite-sample coverage. Actual calendar gaps must remain empty score dates; treating separated observed dates as adjacent mislabels lag distances. The package documentation likewise requires equally spaced time indices. [statsmodels panel HAC documentation](https://www.statsmodels.org/stable/generated/statsmodels.stats.sandwich_covariance.cov_nw_groupsum.html)

## Exposure, temporal order and nonlinear response

Correcting modeled hourly weather to America/Los_Angeles civil dates repairs a known day-boundary mismatch, conditional on the unverified assumption that source timestamps use that timezone. The correction cannot establish the time or place of the underlying offense. R1 ensures the exposure day precedes the recorded outcome date, but delayed enforcement, autocorrelated weather and uncertain offense dates remain. Nonlinear and delayed exposure associations are distinct modeling questions; R1 and R6 are bounded sensitivities, not a comprehensive distributed-lag analysis. [Gasparrini, Armstrong and Kenward, 2010](https://doi.org/10.1002/sim.3940)

The four fixed spline knots yield one linear and two nonlinear exposure columns, with linear tails. The selected quantiles and normalization follow established restricted-cubic-spline conventions. Evaluate overall association and curvature separately, with full robust covariance. Do not interpret a nonsignificant curvature test as evidence proving linearity, or infer a threshold from the most favorable segment of a pointwise band. [Hmisc restricted-cubic-spline documentation](https://search.r-project.org/CRAN/refmans/Hmisc/html/rcspline.eval.html)

Station disagreement quantifies disagreement between two measurements, not the causal coefficient's bias. A fixed additive temperature bias for each ZIP is absorbed by the ZIP intercept in a linear temperature model; time-varying error, differing daily windows and nonlinear exposure error are not. Mixed classical/Berkson error in ecological exposures need not imply simple attenuation toward zero. The six-station comparison is not a representative personal-exposure validation dataset. [Zeger et al., 2000](https://pmc.ncbi.nlm.nih.gov/articles/PMC1638034/)

R7/R8 hold the outcome sample and covariates fixed while changing the maximum-temperature measurement. Their difference therefore probes sensitivity to that substitution on the selected sample. The nearest-station distance/elevation screens, NOAA quality flags, reporting-day differences and excluded coverage remain visible. This pair neither proves that NOAA is superior nor justifies bias-correcting every ZIP from six average discrepancies.

## Added controls and outcome selection

Observed federal holidays are a finite calendar proxy; their definition does not encompass local events, school calendars or actual police schedules. The federal calendar's weekend-observance rule is documented by OPM. Rainfall and humidity controls address measured daily conditions; ZIP-specific annual harmonics allow a smooth local seasonal cycle. These choices reduce specified vulnerabilities without claiming to eliminate all confounding. [US Office of Personnel Management, Federal Holidays](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/)

Relative humidity is related to temperature, and the combined model estimates a differently conditioned association, not necessarily the same causal estimand with bias removed. Weather controls and local harmonics cannot recover unmeasured reporting, enforcement, outdoor activity or tourist exposure. The strict warrant mask also changes which groups count as outcomes. The 67 original primary core-DV groups carrying reviewed warrant co-charges motivate a transparent selection sensitivity; excluding them does not verify that remaining arrests occurred immediately after an offense.

## Multiplicity and reproducibility

Holm correction covers all 22 planned revision hypotheses across both outcomes. It allows dependence among valid marginal tests; it does not correct invalid p-values, selectively chosen hypotheses or the full history of exploratory analyses. Report original results as historical and revision results as a new retrospective family. Pointwise spline bands and HAC14/28 comparisons are audit displays, not additional discovery tests. [Holm, 1979](https://www.jstor.org/stable/4615733)

Preserve the plan and code/input hashes, full results including failures, coverage changes, NOAA pairing, coefficient covariance, convergence diagnostics and source limitations. A failure must not silently reduce the planned testing family. The finite battery is useful because its outcomes can be assessed together; adding specifications until one crosses a threshold would defeat that purpose.

## Code-review findings

Original `model_heat.py` has two latent hazards that did **not** affect the previously independently replicated, consecutive-calendar fits:

1. A collapsed backtracking step can satisfy the old small-step convergence criterion without a successfully improving trial or a small unscaled implied coefficient step. The revision runner requires an accepted line search and verifies the final implied step.
2. Categorizing only observed dates compresses whole-date gaps in HAC. The revision runner uses the full 1,461-day calendar, including empty station-score dates.

The old `se_hac7` labels are also fixed strings; revised lag sensitivities must state their actual bandwidth. The reviewed new code uses explicit lag metadata. The new restricted-cubic-spline basis, three- and two-degree-of-freedom Wald tests, full-Hessian contrast projection, strict masks, calendar grid, annual harmonics and duration offset match the frozen specification on inspection. Numerical checks against an independent implementation remain necessary before interpreting amended estimates.

This note is a statistical design/code review. It does not assert that revised data or numerical results have already passed validation.

## Subsequent validation

After this design review, the full amended battery was fitted, the diagnosed seasonal separation was resolved with a certified extended-MLE computation, and independent numerical validation passed. See `ANNUAL_SEPARATION_DIAGNOSIS.md`, `numerical-audit.md` and `numerical_validation/audit.json`. Both corrected R0 models were independently optimized; all 22 design/covariance calculations and all 24 Holm tests were checked. This later completion does not change the earlier frozen plan or conceal the documented fitting failure. No human peer review is claimed.
