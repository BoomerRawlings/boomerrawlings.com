# Coverage decisions after source inspection

25 September 2026. Amendments made before publication; no institution removed or replaced based on outcomes.

## Display year

The default explorer year is 2024, the latest available year. All 42 institutions have complete on-campus criminal/VAWA counts in that year. Strict all-branch coverage is incomplete for six institutions in 2022 and four in 2023; their affected annual and pooled totals remain unavailable. The full 2022–2024 window stays available, with the same annual/pooled formulas fixed in the protocol.

## Residential applicability

The frozen bulk data leave residential cells blank for many branches. Blank cells alone cannot establish zero offenses. An additional official public API snapshot, whose `SurveyYear` is 2024, explicitly identifies 103 of the 212 selected reporting campuses as providing housing and 109 as not providing it. All 2024 residential blanks agree with explicit no-housing declarations; none is unresolved.

For 2024 only, derive residential sums over applicable housing geography: retain the 103 campuses' numeric source counts and exclude the 109 documented no-housing campuses as an absent geography. Keep original blanks, declarations, campus IDs, URLs/hashes and derived status. This is not imputation of an unknown count. The API snapshot may reflect corrections made after the closed bulk file; both versions are disclosed.

Do not apply current declarations retrospectively. Some campuses now reporting no housing have numeric housing counts in 2022, demonstrating that housing applicability can change. Strict historical missingness remains. The resulting 2024 resident-normalized view has documented occupancy for 11 institutions; complete pooled housing numerators are available for fewer institutions.

## Source-specific population differences

All 30 UC institution/year enrollment values in the State Auditor appendix match the independently acquired IPEDS headcounts. SDSU differs in all three years. For 2024, IPEDS reports 41,137, versus 39,373 in the State Auditor and campus Common Data Set. The difference is not assumed to be error, Imperial Valley omission, distance-only enrollment or nondegree enrollment. Its full explanation remains unresolved. The main enrollment comparison retains IPEDS consistently; actual housing occupancy is a separate sourced measure.

## Source revisions

An independent rape-only comparison of UCSD and UCSC ASRs with federal counts found two differences in 24 checked cells: UCSD 2022 on-campus federal14/ASR15 and noncampus federal4/ASR5. Residential rape counts matched. Preserve both source values; no silent substitution. This check does not authenticate all offense categories or all 42 campus ASRs.
