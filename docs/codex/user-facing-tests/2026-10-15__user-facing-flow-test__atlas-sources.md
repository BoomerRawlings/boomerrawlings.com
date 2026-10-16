# Atlas source controls and overview

## Objective
Understand the distant field, reveal individual records by zooming, toggle source catalogs, compare enabled publications, and reach pages despite URL capitalization.

## Environment and result
Baseline f2b2cdf. Browser-control inventory returned no apps or browsers. **Visible-flow test blocked**; no claim of observed animation, layout, or browser navigation. Automated checks exercise production code with controlled DOM/canvas/network boundaries.

## Implemented behavior
- Below 2×, only inferred subjects have labels, pointer selection, or keyboard previews. Other detail fades in between 2× and 3.2×. Comparison views and explicit record location retain detail.
- Bottom source toggles, All/None, and comparison of 2–9 enabled catalogs. Search and filters apply; source removal, history/deep links, and Reset preserve coherent selection.
- Each publication cluster represents its source catalog. Current data contains no cross-catalog record links; the explanation states this. Equal names/titles do not manufacture links.
- Build-generated page lookup and a custom404 document recover mixed-case page addresses, preserving query and fragment. GitHub Pages initially returns404; JavaScript navigates to the canonical200 page. Assets and unknown addresses remain unchanged.

## Automated evidence
Full npm test and47-page build passed; final Atlas rerun:207 groups pass. Entrance/app integration:101 cases; reset/loading:27; graph/distant/identity/layout/comparison:98 focused tests. Final graph/routing rerun:88 groups pass (81 graph,7 routing); final rebuild and HTML/CSS/ID/ARIA/version preflight pass. Coverage includes GPU and Canvas overview gates; empty selection; 2–9-source layouts; source evidence; navigation; stale async success/failure; both Load-all race directions; Reset controls; URL validation, canonicalization and no redirect loops.

## Findings resolved
Reset controls stayed disabled after completion; controls now refresh both at start and completion. Error copy was overwritten during rendering; failures remain visible. Concurrent bulk/individual loading could apply stale choices; latest user intent now wins. Responsive publication captions now use bounded widths and recognizable abbreviations at11px; all nine fit at320×300/360/520/600 and1000×700 without overlapping controls or adjacent clusters. Two-subject captions retain their existing geometry. Short-screen footer status remains accessible; the map can fit its available height.

## Remaining verification
When browser control is available: fresh entry at desktop,390px and320px; distant hover/click/keyboard behavior; smooth zoom into details; footer scrolling/toggles; 2- and9-source comparisons; history/Reset; and actual mixed-case browser navigation. Responsive geometry and automated tests do not establish visual polish or physical animation smoothness.
