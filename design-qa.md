# 0311 design QA

final result: passed

## Findings

- No remaining P0/P1/P2 findings.
- Resolved P1, course option density: four ECON 100A choices are explicitly numbered. Shared weekdays combine into two class rows per option; exams are collapsed. Desktop option height is 202.25 CSS px. `.codex/qa/0311/four-options.png` shows all four choices together.
- Resolved P2, unassigned MGT time: importer normalizes TBA values to null; rendered text now says `Day TBA` / `Time TBA`.

## Evidence

- Source visual truth: supplied `codex-clipboard-77f58eea-4068-4888-8bd8-b643cb8c9315.png` (1205 × 1587 including browser chrome) and `codex-clipboard-bf8b689d-f27c-4c20-9bb5-c56501845966.png` (1160 × 573 expanded card).
- Implementation: `.codex/qa/0311/desktop-boomer.png`, `desktop-card.png`; final corrected views `desktop-condensed.png`, `four-options.png`, `mobile-condensed.png`.
- Desktop CSS viewport 1205 × 800, devicePixelRatio 1. Card width 1116 CSS px matches the source expanded card's 1116 px content panel. Compared source and implementation together in one image input; ignored browser chrome and different page positions.
- Final catalog desktop viewport 1205 × 1100; mobile 320 × 800. Earlier 390 × 844 check also passed. DevicePixelRatio 1; zero horizontal overflow in each. Captures contain browser scrollbar and may be display-scaled by the tool; CSS measurements used for geometry, with the source and final capture opened together for comparison.
- Source and implementation intentionally differ in requested names, majors, booking controls, header copy, row count and absence of download controls.

## Fidelity surfaces

- Typography: existing Source Sans 3 and Teko reused; SAP 72 Semibold font loaded for Book. Section hierarchy and compact uppercase department badges retain the reference.
- Spacing: card width, 128 px headers, 84 px compact rows and separators align with the source. New option blocks intentionally add schedule detail within the same panel language; two compact class rows and one exam disclosure prevent excess height.
- Colors: existing dark teal/cyan tokens retained. Book computed background rgb(39,54,123), white label, 26 px inner height.
- Assets: source has no illustrative assets; supplied design-system styling reused. Browser capture softness does not justify changing the font; computed font and card measurements corroborate the visual comparison.
- Copy: latest requested title and all three steps verified in rendered DOM. All eight approved profiles and exact course names retained. Missing facts explicitly unavailable.

## Interaction checks

- Roommate dropdown shows one selected card and opens it.
- Course disclosures and exam disclosures work. Four ECON 100A links use exact saved-page module/package IDs; the other 11 catalog Book controls remain disabled without verified IDs.
- Importer independently verified 22 unique component sections, 15 complete combinations, one TBA and 14 distinct exam meetings against public responses.
- Expand/collapse-all changes all eight cards and updates its label; selecting one roommate opens only that profile. At 320 px, options, long section codes, rooms and buttons fit without horizontal overflow. Exam disclosure exposes sorted dates, times and rooms. Final console has no warnings/errors.
- External TSS session/eligibility and completed booking remain untested; this page only navigates to the verified route, never submits enrollment.

## Comparison history

Initial combined reference/expanded-card review retained matching typography, panel geometry and colors. User feedback identified excessive catalog density (P1). After grouping weekdays, numbering choices and collapsing exams, final `four-options.png` was compared with the source in one image input; all four choices are readable. Narrow-screen recheck confirms wrapping and no clipped controls. TBA text rechecked after normalization.

## Next

No visual fixes required. Finish final repository tests and publish through the existing Pages workflow. Missing course IDs and rooms for the remaining courses require additional authoritative evidence.
