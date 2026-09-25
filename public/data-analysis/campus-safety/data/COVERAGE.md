# Coverage and residential applicability

The frozen count source is the 2025 federal collection, reporting calendar years 2022–2024. Count cells are never revised from current API text or campus ASRs. Identifiers are validated for all 42 institutions and 212 listed branches.

## Primary on-campus geography

- 2024: complete numeric criminal-offense cells for all 42 institutional aggregates.
- 2023: 38 complete; Columbia, Florida, NYU and USC have at least one campus-year FILTER=0.
- 2022: 36 complete; the same four plus North Carolina Chapel Hill and Virginia have at least one FILTER=0.
- Three-year strict totals: 36 institutions complete. No absent campus is silently removed from the institutional comparison unit.

The 10 affected branches account for 17 campus-year slots. All their affected count cells are blank. The source codebook describes the filter as `Data_year = YYYY (FILTER)` without classifying the reason. New/nonoperating geography versus missing submissions cannot be established from that label. Institution-level `count` remains blank if a selected branch is unavailable. `observed_sum` is explicitly a partial diagnostic and must not be used as a complete numerator.

## Residential geography: strict and corroborated views

The strict all-branch residential aggregate is complete for 15 institutions in each year; other institutions have blank residential cells at one or more branches. Many blanks reflect campuses without student housing, but absence must be documented separately from a reported zero.

The current official campus API snapshot provides a `SurveyYear` field of 2024 and an explicit housing statement. For 2024, all 212 branches reconcile into 103 with numeric residential counts and 109 with blank residential cells plus an explicit no-housing declaration. Consequently, a separate 2024-only aggregate excludes those 109 absent geographies while retaining all numeric frozen counts. This produces complete residential numerators for all 42 institutions, with no unresolved branch applicability. No raw blank is replaced with zero.

Files:

- `normalized/cohort_campus_residential_applicability_2024.csv`: every category/campus classification, raw value, count, API source and hash.
- `normalized/cohort_institution_residential_2024_applicable_geography.csv`: derived 2024 numerator and counts/IDs of branches excluded for corroborated absence of housing.
- `residential_applicability_2024_verification.json`: all 103 numeric and 109 no-housing campuses accounted for, original cells unchanged.
- `normalized/cohort_campus_context_current.json`: sanitized API metadata, including country and exact housing statement.
- `normalized/cohort_geography_scope_2025.csv`: each institution's U.S./outside-U.S. branch counts and countries.

The derivation uses two source views: frozen-2025 offense cells and a current API declaration explicitly labeled 2024. That source distinction must be visible in methods. The rule does not prove that the Clery residential boundary matches the State Auditor's occupancy boundary. Numerator completeness does not supply a resident denominator for all 42 institutions.

Historical residential blanks remain unavailable. A 2024 declaration must not be applied retrospectively: Georgetown's Villa le Balze and Stanford in Paris have numeric residential cells in 2022 but no housing in the current declaration. This provides a direct counterexample to historical backfilling. The survey guide states screening answers concern the designated calendar year. [2025 guide, printed p. 25 / PDF p. 28](https://surveys.ope.ed.gov/csss2025/wwwroot/documents/Campus_Safety_Users_Guide.pdf#page=28).

## Geography and case-study scope

The cohort's 212 campuses comprise 165 U.S. and 47 outside-U.S. branches. Country is derived from the official explicit `CountryIsUS` flag where the corresponding country-name string is null; this rule is recorded in the geography table. Institution totals include all their frozen branches. They must not be labeled as main-campus totals.

UCSD has one listed federal branch. SDSU has three: the main campus, Imperial Valley and Georgia. The separately verified SDSU main-campus residential rape series of 9, 7 and 1 is a physical-campus case study, not a fabricated institution-wide historical sum. Report main-campus numerator and occupancy-boundary caveat explicitly. ASR comparisons remain a separate source-vintage view.

Housing is already included in on-campus counts. The 11-category `Listed criminal offenses` sum must contain only the 11 criminal-offense fields; never add residential, VAWA, hate, arrest, referral or unallocated-police tables to it. Even that sum measures listed reported offenses, not unique victims/incidents or the probability a resident/student experiences crime.
