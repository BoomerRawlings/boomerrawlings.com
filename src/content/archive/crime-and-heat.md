---
title: Crime and heat
slug: crime-and-heat
type: data-analysis
date: 2026-09-24
status: published
description: A retrospective study of supplied San Diego-area arrest records and daily temperature, with selected charge categories, computational audits, and a separate domestic-violence report.
tags: [Crime, Temperature, Public records, San Diego County, Domestic violence]
---

## Research question and principal finding

Do the supplied arrest records contain more daily activity during hotter weather? The general analysis includes all charge categories within an explicitly defined eligible sample; domestic violence is one separate category. These administrative records do not measure all crime, victimization, calls for service, unique people, or convictions.

In 2021–2024, each 10°F higher daily maximum temperature was associated with **1.87% more eligible arrest-record groups**: count ratio **1.01873**, 95% confidence interval **0.99952–1.03832**, two-sided p=0.05608. Expressed as percentages, the interval spans **−0.05% to +3.83%**. It includes no association. The evidence is inconclusive; it neither establishes that heat increased recorded activity nor demonstrates an absence of association. [General model results](/data-analysis/crime-and-heat/data/downloads/crime_model_results.csv).

This retrospective ecological study uses ZIP-days, not individuals. Its estimand is the ratio of expected eligible daily record counts associated with temperature, conditional on geographic and calendar controls. It is not a population crime-risk ratio or a causal effect.

## Context and comparability

Prior research provides a reason to investigate the question, not an effect size transferable to this release. Ranson studied monthly crime rates and weather across 2,997 US counties during 1980–2009 using FBI Uniform Crime Reporting and historical weather data. Those reported-offense measures, geographic units, timescales and modeling assumptions differ from the present arrest-record analysis. An inconclusive result here does not refute findings elsewhere. [Ranson (2014)](https://www.sciencedirect.com/science/article/pii/S0095069613001289).

## Records, units and classification

Three supplied CSVs contain 214,745 rows covering July 2018–December 2025. Removing four invalid rows leaves 214,741 valid charge lines, including 926 exact duplicate lines. Grouping identifiers within their originating export produces **136,313 source-ID groups**. These conservative administrative units are not verified distinct arrests, incidents or people. Multiple charges may belong to one group. No agency dictionary, verified download source or completeness statement accompanied the files. [Independent source reconstruction and hashes](/data-analysis/crime-and-heat/data/source_records_audit.json).

Identifiers change from “Incident Number” to “Arrest Ref Nbr” in 2025. Timestamp headers change from “Incident Date_Time” in 2018–2023 to “Arrest Date/Time” in 2024–2025. Their equivalence and offense-to-arrest delays remain unverified. The join therefore concerns the **recorded date**, not a confirmed offense date. Timestamps lack explicit timezones; interpreting their calendar dates as San Diego local dates is an unverified assumption.

Groups with conflicting metadata remain visible in descriptive summaries: 37 span conflicting years, 121 conflicting months, 172 conflicting dates and 419 conflicting ZIPs. Conflict counts overlap. Such groups are not arbitrarily assigned to a single conflicting category. “SHERIFF” becomes much more common as a locality label in 2024; it is an administrative label, not a city or evidence of geographic displacement. Unverified locality text is pooled in public tables.

The explorer offers selected, **nonexclusive** charge families: drug/paraphernalia, property-related, other assault/battery/threats, weapons-related, driving-related and core domestic violence. Each uses explicit observed-code rules. These are neither exhaustive offense classifications nor FBI violent/property-crime categories. One group may enter several families; their counts must not be summed as unique records. “Other assault” does not establish a non-domestic relationship, and a group can contain both a core-DV charge and another qualifying assault charge. Charges remain allegations. [Exact category mapping and statutory sources](/data-analysis/crime-and-heat/data/category_mapping.csv).

## Coverage and analytic sample

The release begins July 1, 2018; no 2026 data were supplied. In 2025, 79 dates have no source charge rows, and January–May contains only 144 monthly identifier appearances. These omissions cannot be interpreted as zero arrests or a falling crime rate. All years have unverified completeness; 2025 is excluded from the main models.

The general model requires a unique recorded date and ZIP, exclusively adult subtype, no warrant subtype, no detention/court command or area classification, and matched weather. This is a **subtype screen**, not removal of every warrant-related co-charge. Its restricted population differs from all-source descriptive totals.

The 2021–2024 weather panel contains all 112 mapped ZIPs and 1,461 calendar dates, including zero counts: 163,632 ZIP-days. Six ZIPs have no eligible general records throughout this period and contribute no information to the fitted temperature coefficient. The regression includes **58,770 groups, 106 ZIPs and 154,866 ZIP-days**, with 125,369 zero-count rows. Zero-only ZIPs remain in descriptive denominators. The separate all-source daily table contains 72,496 groups with unique dates in this period. [Coverage and reproducibility files](/data-analysis/crime-and-heat/data/general-analysis-and-audit.zip).

## Temperature assignment

Daily high, mean and low temperatures come from Open-Meteo's historical ERA5-Land archive at Census ZIP Code Tabulation Area representative points. The 112 ZIPs share 50 underlying weather grid cells on a 0.1° distributed grid; native model resolution is approximately 9 km. ZIP selection uses postal-prefix and ZCTA matches, not a county polygon, and does not establish countywide jurisdictional coverage. These are modeled outdoor conditions, not measurements at incident locations or of personal exposure. Daily means derive from hourly values, not the midpoint of high and low. [Open-Meteo documentation](https://open-meteo.com/en/docs/historical-weather-api), [ERA5-Land dataset](https://doi.org/10.24381/cds.e2161bac), [ECMWF model documentation](https://www.ecmwf.int/en/era5-land), [Census Gazetteer](https://www.census.gov/geographies/reference-files/2024/geo/gazetter-file.html).

All 306,992 ZIP-days have weather values. Daily windows use fixed UTC−7; in standard time they begin at 23:00 on the preceding local civil date. This mismatch affects **513 of 1,461 primary-period dates**, with none during May–September. It is exposure misalignment, not missing data. Same-day maximum temperature can also occur after an early-morning record. [Provider time-window explanation](https://github.com/open-meteo/open-meteo/discussions/801).

A six-station NOAA comparison found daily-maximum mean absolute errors of 2.6–5.9°F. At Ramona, modeled minima averaged 6.8°F above observations, with 7.2°F mean absolute error. These same-site comparisons assess agreement; they do not validate every ZIP's exposure or supply complete observed daily means. [NOAA service documentation](https://www.ncei.noaa.gov/access/search/documentation/data-service/), [comparison results](/data-analysis/crime-and-heat/data/downloads/weather_noaa_crosscheck.csv).

Heatwave days belong to runs of at least three consecutive May–September days at or above a ZIP's 90th percentile of warm-season maxima during available 2018–2024. Every qualifying run day is flagged. This sample-derived definition uses a limited reference period, including partial 2018; it is neither an official alert nor an independent long-term climate normal. [Thresholds](/data-analysis/crime-and-heat/data/downloads/heatwave_thresholds.csv).

## Statistical specification and multiplicity

The Poisson mean model is

$$
\begin{aligned}
\log \mu_{zd}
  &= \alpha_z + \gamma_{m(d)} \\
  &\quad + \delta_{w(d)} + \beta\,\frac{T_{zd}}{10}, \\
\mu_{zd}
  &= \operatorname{E}\!\left[Y_{zd}\mid\mathbf{x}_{zd}\right].
\end{aligned}
$$

Here, $Y_{zd}$ is the eligible all-category record count in ZIP $z$ on date $d$; $\mu_{zd}$ is its conditional expected count; and $T_{zd}$ is daily maximum temperature in °F. The functions $m(d)$ and $w(d)$ identify the year-month and weekday. The covariates $\mathbf{x}_{zd}$ comprise temperature and the ZIP, year-month, and weekday indicators. The reported count ratio for a 10°F increase is $\exp(\beta)$. ZIP effects absorb stable local differences; year-month and weekday effects absorb shared calendar patterns. No population or total-arrest offset is used. A common coefficient assumes a constant proportional association across the modeled range.

Uncertainty uses full-model scores summed across ZIPs within each date, followed by Bartlett Newey–West covariance with seven calendar-day lags. This incorporates same-day spatial dependence and short serial dependence, rather than treating ZIP-days as independent. The covariance estimate receives the finite-sample correction $n/(n-k)$, with $n=154{,}866$ fitted ZIP-days and $k=160$ parameters; confidence intervals use a normal approximation. Such covariance requires suitable dependence conditions and does not repair a misspecified mean model. [Newey and West (1987)](https://doi.org/10.2307/1913610), [Driscoll and Kraay (1998)](https://doi.org/10.1162/003465398557825).

The general family was introduced **after the earlier DV analysis**. “Primary” means designated main specification, not preregistration. Five nonprimary comparisons—mean temperature, minimum temperature, maximum ≥90°F, heatwave days and previous-day maximum—receive Holm adjustment together. All five adjusted p-values equal 1.0. Their individual 95% intervals are not simultaneous intervals. This correction covers those five comparisons, not every website hypothesis, filter or earlier DV test. [Holm (1979)](https://www.jstor.org/stable/4615733).

<div class="analysis-table-scroll" tabindex="0" role="region" aria-label="General-arrest model estimates">

| General-arrest exposure | Count ratio | Individual 95% CI |
|---|---:|---:|
| Maximum temperature, +10°F; primary | 1.01873 | 0.99952–1.03832 |
| Mean temperature, +10°F | 1.01498 | 0.98890–1.04175 |
| Minimum temperature, +10°F | 1.00008 | 0.97348–1.02742 |
| Maximum ≥90°F versus <90°F | 0.97059 | 0.91006–1.03514 |
| Heatwave day versus other days | 0.99333 | 0.89575–1.10153 |
| Previous-day maximum, +10°F | 1.00982 | 0.99096–1.02904 |

</div>

## Verification and descriptive patterns

Four audit passes checked source reconstruction, classification, weather assignment and statistics. These are computational and source audits, not external human peer review. All six general fits converged. The primary Pearson dispersion was 1.365; reported sandwich uncertainty allows variability beyond a strict Poisson variance assumption.

An independent conditional-Poisson implementation, using public aggregates and a different optimizer, reproduced the general primary coefficient and standard error within $10^{-13}$. Separate post-hoc HAC14 and HAC28 checks gave intervals of 0.99887–1.03899 and 0.99854–1.03933, respectively. Both retain the inconclusive interpretation. Numerical replication does not mean an independent sample, and these checks do not establish linearity or exclude nonlinear and heterogeneous associations. [Code, versions, hashes and complete audit results](/data-analysis/crime-and-heat/data/general-analysis-and-audit.zip).

Eligible general records averaged **35.26 per weekend day versus 42.21 per weekday**, 16.47% lower without adjustment. Selected-category differences are descriptive; no between-category interaction was tested. All-source timing summaries and eligible weather summaries have different populations. Filtered chart rates retain zero ZIP-days, remain unadjusted, and do not refit the static regression estimates.

## Domestic violence as a separate case study

The reviewed core-DV definition identifies 12,478 groups across the release; a broader domestic-labeled order definition contains 15,161, including the core. Generic assault, threat or stalking charges are not automatically identified as DV. The primary eligible core sample contains 6,637 groups across 95 ZIPs. Its maximum-temperature estimate is **+2.9% per 10°F**, ratio 1.02888 (95% CI 0.98952–1.06981), also inconclusive. None of its eleven nonprimary tests survives that separate Holm correction.

The classification audit found 67 primary core-DV groups with explicit warrant co-charges despite passing the subtype screen. This reinforces that recorded-date counts are not verified contemporaneous violence. The broader definition and historical statutory changes introduce additional classification limits. The [standalone DV report](/data-analysis/crime-and-heat/downloads/domestic-violence-and-heat-report.pdf) retains that analysis independently of the general website scope.

## Interpretation and use

Reporting, police response, enforcement, coding changes and source-ID semantics affect these counts. ZIP/calendar controls do not eliminate holidays, local seasonal changes, humidity or other time-varying influences. Population denominators and complete jurisdictional coverage are absent; city or demographic counts cannot establish differences in underlying offending risk. Confidence intervals exclude uncertainty from coverage, classification, date semantics and weather assignment.

Public downloads contain aggregates, not record identifiers, individual demographic records, street labels or exact event timestamps. Use their population definitions and denominators when quoting results. Transparent reporting follows relevant STROBE and SAMPL principles without claiming certification or a registered protocol. [von Elm et al. (2007)](https://journals.plos.org/plosmedicine/article?id=10.1371/journal.pmed.0040296), [Lang and Altman, SAMPL](https://www.equator-network.org/wp-content/uploads/2013/07/SAMPL-Guidelines-6-27-13.pdf).

## References

- Ranson, M. (2014). Crime, weather, and climate change. *Journal of Environmental Economics and Management, 67*(3), 274–302. [doi:10.1016/j.jeem.2013.11.008](https://doi.org/10.1016/j.jeem.2013.11.008).
- Newey, W. K., & West, K. D. (1987). A simple, positive semi-definite, heteroskedasticity and autocorrelation consistent covariance matrix. *Econometrica, 55*(3), 703–708. [doi:10.2307/1913610](https://doi.org/10.2307/1913610).
- Driscoll, J. C., & Kraay, A. C. (1998). Consistent covariance matrix estimation with spatially dependent panel data. *Review of Economics and Statistics, 80*(4), 549–560. [doi:10.1162/003465398557825](https://doi.org/10.1162/003465398557825).
- Holm, S. (1979). A simple sequentially rejective multiple test procedure. *Scandinavian Journal of Statistics, 6*(2), 65–70. [Original article](https://www.jstor.org/stable/4615733).
- von Elm, E., Altman, D. G., Egger, M., et al. (2007). The STROBE statement: Guidelines for reporting observational studies. *PLoS Medicine, 4*(10), e296. [doi:10.1371/journal.pmed.0040296](https://doi.org/10.1371/journal.pmed.0040296).
- Lang, T. A., & Altman, D. G. (2015). Basic statistical reporting for articles published in biomedical journals: The SAMPL guidelines. *International Journal of Nursing Studies, 52*(1), 5–9. [doi:10.1016/j.ijnurstu.2014.09.006](https://doi.org/10.1016/j.ijnurstu.2014.09.006); [guideline record and earlier public version](https://resources.equator-network.org/reporting-guidelines/sampl/).

Dataset and statutory documentation is linked alongside its relevant claim. Online sources were checked September 24, 2026; source filenames and hashes identify the supplied release without establishing agency completeness.
