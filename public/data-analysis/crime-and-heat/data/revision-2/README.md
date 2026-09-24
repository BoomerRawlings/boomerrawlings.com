# Arrest records and heat: revision data and audit

This archive contains public aggregates, model estimates, code and computational
audits. It contains no arrest identifiers, individual charge rows, street blocks,
individual timestamps or hourly weather caches. It is not human peer review.

The corrected weather sample is explicitly restricted: 64 of 112 original ZIPs,
2018-07-01 through 2025-12-31. Model estimates use 2021–2024 only. The 64 ZIPs contain
57,903 original eligible general groups and 6,501 core-DV groups; strict warrant
exclusion leaves 52,203 and 6,435. Acquisition availability was not random. The
original full-sample estimates remain historical references. See the frozen plan,
coverage amendment, numerical amendment and issue-resolution document.

## Reproduce all 22 fits offline

**Download and extract `revision-analysis-and-audit.zip` first.** The commands below
require its preserved folder structure; the separate flat webpage downloads are
convenient references, not a standalone reproduction directory.

Python 3.12 was used. In a fresh environment, install the pinned packages, then run
from this extracted archive's root:

```text
python -m pip install -r requirements.txt
python publication/revision_models/fit_revision.py --panel publication/revision_models/analysis_panel.csv.gz --metadata publication/revision_models/panel_metadata.json --out reproduced_results
python publication/revision_review/check_revision.py --panel publication/revision_models/analysis_panel.csv.gz --results reproduced_results --out reproduced_independent_audit
```

The fitting script estimates 22 models and adjusts 24 tests with Holm. The validator independently
refits both corrected reference models and checks all designs/covariances and the
Holm calculation. Neither contacts the weather provider or needs private records.
Normal intervals and spline pointwise intervals are not simultaneous intervals.

The bundle was extracted and all 22 production fits rerun before release. Numerical
comparison is recorded in REPRODUCTION_CHECKS.json. SHA256_MANIFEST.json hashes every
other archive member. The audit establishes reproducibility, not source completeness,
personal exposure or causality.

## Optional aggregate preprocessing

All public dependencies of publication/revision_models/prepare_panel.py are included.
Running it regenerates the zero-inclusive aggregate model input, station assignments,
holiday dates and metadata; it does not require arrest records. The supplied panel
and original results should be preserved if exploring changes. Its metadata hashes
identify the exact daily weather and aggregate inputs used in this release.

## Weather regeneration boundary

The complete 64-ZIP daily temperature/RH and daily ERA5 precipitation inputs are
included, so daily joins and summaries can be inspected offline. The original 112-ZIP
mapping and released daily data are also included. Temperature/RH are ERA5-Land;
precipitation is explicitly ERA5. Local day boundaries use America/Los_Angeles and
include 23/25-hour transition days. NOAA station reporting windows can differ.

Hourly caches are deliberately excluded. Reacquiring those series and rerunning the
hourly grouping verification requires permitted provider access and can encounter
quota limits or later provider revisions. Do not launch acquisition to reproduce
the statistical models: the supplied aggregate panel is sufficient. The archived
weather verification is a completed audit of the source cache, not a claim that
the omitted cache can be checked from this download. See publication/revision_weather/README.md.

The source-classification Python scripts are included for inspection. They require
private original exports and normalized record groups to reconstruct warrant masks;
those inputs and event-level masks are not distributed. Aggregate mask totals,
exact code rules and reconciliation results are included.

The optional build_explorer.py script and explorer verification are provided for
inspection. That site-build script additionally expects the website checkout's
original browser JSON files and matplotlib; it is not needed for the fully portable
statistical reproduction commands above. The statistical package does not install
or modify a website.

## Contents

- publication/revision_models: plans, aggregate input, portable fitter and results.
- publication/revision_review: independent methods review, certified separation
  diagnosis, numerical validator and validation outputs.
- publication/revision_sources: provenance/agency-question draft and aggregate
  warrant/source audits. The clarification draft has not been sent.
- publication/revision_weather: daily weather, source metadata, verification,
  coverage and acquisition/reaggregation scripts; no hourly cache.
- publication/data and weather: public dependencies used by aggregate preparation.

The three nominal p < .05 sensitivities do not survive the 24-test Holm correction;
minimum adjusted p = .39844. Computational agreement does not repair incomplete records,
unknown offense dates/locations, outcome selection or unmeasured confounding.
