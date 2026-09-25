# Separate final sourcing and accurate-use audit

Prepared 25 September 2026. **Status: planned, not completed.** This audit is separate from the literature review and arithmetic/pipeline checks. It examines the final claims and their primary evidence. It is an independent automated review, not external human peer review.

## Inputs to freeze

Obtain the final rendered HTML, PDF, browser datasets, downloadable tables, source manifest, protocol and calculation code. Record versions and SHA-256 hashes before reviewing. Include captions, chart axes, tooltips, footnotes, accessibility text, metadata summaries and download descriptions in the claim inventory. A source may support a paragraph but not its headline or tooltip.

## Claim ledger

For every substantive source-dependent claim, record:

- Claim ID, exact final wording and artifact/page/element.
- Numerator, unit, geography, report years, source collection and population scope.
- Denominator definition, year, snapshot date if known and scope match.
- Primary source URL, title, page/table/field, version and frozen hash when available.
- Independently located supporting evidence; calculation if derived.
- Required limitations, discrepancies and whether the final wording preserves them.
- Verdict: verified; verified with qualification; correction required; or unsupported/unverifiable.

Citation presence alone is not verification. Search summaries are insufficient for exact table values when the primary table is available. Resolve a failed link through the official source; record unresolved access failures instead of inventing support.

## Pass A: independent source reading

1. Reopen the cited primary source and read the surrounding passage, table headers, units, notes and exceptions. Check report year versus occurrence year, residential subset versus campus total, offense versus report/victim count, and historical versus current guidance.
2. Verify publication dates, author names, DOI, report edition and exact table/page references. Confirm the current Clery regulation's geographic rule is (c)(5), report-year rule (c)(3), and hierarchy rule (c)(9).
3. Check all institutional explanations against the institution's actual footnotes. UCSD's scooter discussion is not evidence about rape; UCSC's clustered disclosure does not identify 21 different victims.
4. Review research use independently: AAU resource contact is not synonymous with police reporting; since-enrollment prevalence is not annual Clery incidence. BJS's narrowly comparable pilot comparison is not proof of universal completeness. An inaccessible paper cannot support a precise numerical claim.

## Pass B: independent values and transformations

1. Read the raw federal table cells and source dictionaries, not merely a second export of the production output. Verify all included institution IDs, reporting campuses and missingness codes.
2. Verify enrollment and occupancy against the original denominator rows. Match annual numerator and denominator coverage. Prevent repeated use of institution enrollment for several branch rows. Identify combined enrollment units explicitly.
3. Recalculate every annual and pooled ratio. Pooled rates must equal `1,000 × sum(counts) / sum(matched annual populations)` on the same included observations. Recalculate group totals independently; no silent mean of rates.
4. Check housing counts do not exceed corresponding campus counts within the same source/geographic unit. Housing must not be added to campus totals. Keep overlapping VAWA/hate categories separate from primary-offense totals.
5. Check zero, missing, not applicable, withheld and absent records separately. Rates with missing/zero denominators remain unavailable. Preserve excluded observations and reasons.
6. Trace displayed rounding back to exact numbers. Sorting must use unrounded rates without implying materially meaningful precision. No percentages of victims or inverse 'one in N' claims.
7. Verify the complete federal/ASR discrepancy ledger. Neither source is silently overwritten; report title or retrieval time does not establish revision chronology.

## Pass C: interpretation and rendered evidence

1. Ensure the residential view states whether occupancy geography matches Clery properties, and labels unmatched State Auditor occupancy as approximate. Distinguish fall snapshots from resident-years and from unique residents over three years.
2. Ensure the enrollment view does not masquerade as a resident-risk measure or an NCES FTE rate. Include nonstudent/visitor exposure, medical-center, distance-learning and branch caveats where relevant.
3. Ensure the purposive 42-institution sample is not called nationally representative. Avoid safest/dangerous rankings, causal claims, or assertions that low counts establish low victimization or deliberate concealment.
4. Ensure descriptive administrative ratios are not given unexplained binomial/Poisson confidence intervals or significance labels. If a model is added, require a new documented estimand, assumptions and uncertainty review.
5. Open each final source link and relevant PDF page. Render every PDF page; inspect table headings, footnote readability, clipped text, formulas, page references and link targets. Check mobile labels and empty/filter states for omitted qualifiers.
6. Audit privacy: publish aggregate campus/category/year counts and documented denominators only. No victim identities, individual reports, record identifiers or machine-specific private paths. Public PDF institutional footnotes should not be expanded into unsupported personal details.

## Output and release rule

Produce `FINAL_CITATION_AUDIT.md`, a machine-readable claim ledger, a discrepancy/correction log and the exact audited artifact hashes. Report the number of claims checked and any unreviewed scope. Correct every material unsupported, misstated or misleading claim before clearance; independently recheck changes. A clean arithmetic test cannot substitute for this audit, and this plan must not be labeled a completed audit.
