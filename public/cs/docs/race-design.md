# APEX race presentation

The default presentation uses **active 25-map PPI: equal standardized KPR and negative DPR**, reconstructed-Elo-top-30 opposition and both eras. Each game retains its separately calculated windows and reference population. This is a responsive view of observed recent output, not a revised greatest-player model. The 50-map historical-record view remains available. No analytical values, eligibility rules or normalization changed.

PPI is `100 + 10 × (0.5 z_KPR + 0.5 z_negative_DPR)`. Equal component weights avoid the KPR/Net-KPR candidate's direct reuse of kills; they do not establish role fairness, causal contribution or standard deviation 10. Twenty-five maps are more responsive and less sustained than the original 50-map primary specification. Active eligibility still expires 90 days after the last qualifying window.

## Observed animation dynamics

Measured directly from existing `both-elo_top30-25.json.gz` and `both-elo_top30-50.json.gz`, dataset `cb029772bd796bf2`; 171 monthly/end-date snapshots from 2012-09-30 through 2026-11-21. Each list uses its first ten ranked canonical identities. Adjacent pairs count only consecutive snapshots where both lists are nonempty, never pairs bridged across an empty interval. Leader changes compare the first identity; list changes compare ordered identities. These are presentation diagnostics, not independent statistical trials or model-selection evidence for greatness.

| View | Populated snapshots | Adjacent populated pairs | Leader changes | Ordered top-10 changes | Median new top-10 identities per adjacent snapshot |
|---|---:|---:|---:|---:|---:|
| Historical records, 50 maps, KPR | 165 | 164 | 2 | 24 | 0 |
| Active, 25 maps, equal KPR/negative-DPR PPI | 136 | 134 | 70 | 133 | 4 |
| Active, 25 maps, covariance-rescaled PPI | 136 | 134 | 71 | 133 | 4 |

Covariance rescaling provides similar movement with a more complex denominator; the simpler candidate is the presentation default. At least ten players appear in every populated snapshot of all three assessed views. Median leader-to-tenth-place value spread is 0.0812 KPR for the record view and 10.2932 index points for active balanced PPI. Medians average the two central order statistics for even sample sizes. These differently scaled quantities are not commensurable effect sizes. Local diagnostics are retained in `data/exports/ui-dynamics-assessment.json`.

The active relative view first populates on 2013-02-28 and has no qualifying snapshots from 2021-08-31 through 2024-01-31. This combines source absence, inactivity expiry and minimum map/reference-population warm-up. **The actual source gap is 2021-05-31 through 2023-10-24**; the longer analytical gap does not imply no source observations in late 2023. Initial CS2 relative qualification appears in February 2024. Missing periods remain visibly empty. Both-era identities use reviewed mappings; unresolved source IDs are not merged because aliases match.

## Scale and calendar contract

`web/race-model.js` transforms coordinates only. Zoom computes one linear domain from the current visible snapshot, shared by every bar. The displayed baseline and axis ticks identify the truncated scale. Labels retain exact source-derived metric values; bar lengths measure distance from the labeled baseline, not ratios to zero. A zero-baseline switch preserves an absolute-length view. Minimum spans keep near ties from becoming arbitrarily large visual differences. Neither scores nor rank order are interpolated or manufactured. Domains never read future snapshots.

The calendar line uses elapsed UTC calendar days, including leap days and missing periods. Scrubbing selects the nearest existing snapshot (earlier on exact ties), and the UI displays that measured snapshot date. No new analytical point is synthesized. The missing-source interval can be shaded at its true calendar extent; unavailable analytical windows remain distinct from absent raw coverage.

Team colors and licensed marks identify the team observed by that calendar date. Logo/roster changes describe first recorded appearances, not verified signing dates; current marks are not necessarily the exact historical artwork. Visual identity changes do not modify a player's numerical score.
