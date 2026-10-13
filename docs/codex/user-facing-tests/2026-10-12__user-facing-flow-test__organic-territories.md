# User-Facing Flow Test

## Objective

Explore overlapping subject territories and select/filter records through coordinated line and data reveals.

## Test Environment

Local Astro development preview and an unshipped instrumented static preview; Chromium on Windows, 1280×900 and 320×700 viewports. GPU and forced Canvas fallback. Viewport emulation, not physical-phone testing.

## Starting Assumptions

All 33,945 records retain their original positions. Territory shapes illustrate title-keyword clusters; exact masks determine membership.

## Steps Taken

Entered the map; inspected overview and 1.7× territory shapes. Selected Minds, opened facets, chose 2026 then All, switched to Planet. Opened About with motion paused and enabled. Expanded the map, interrupted a star flight by dragging, selected a credited name, and observed its route/metadata reveal. Checked List, phone selection/dismissal, Canvas fallback and complete List access.

## What Worked

Six overlapping translucent territories, irregular outlines and boundary mesh. Minds counts 1,584 → 67 → 1,584; Planet 662. All 33,945 record points retained. Facet focus and 116px same-region scroll preserved; switching regions reset scroll to zero. Camera interruption left no stale preview. Pause stopped traces and graph reveals. Canvas List exposed all 33,945 records.

## What Felt Intuitive

Selection arrives at the star before metadata reveals. The full title remains present while its opacity rises; controls remain clickable. Growing boundaries connect subject choices to the map.

## What Felt Unintuitive

Personal UX impression · low: the dense all-connections view remains busy. Defaults keep routes off; selected emphasis is bounded and brighter.

## Visual Cohesion Notes

Cyan/copper traces match the entrance and route palette. Territory fills remain translucent, allowing overlapping stars to remain visible. Phone width stays within 320px.

## Broken or Dead Interactions

None observed in the tested flow.

## Missing Feedback

None observed. Full text exists immediately; reveal motion does not postpone access.

## Errors Encountered

No application errors captured. The explicit GPU-loss test activates the existing fallback guidance.

## Completion Result

Passed. 25 browser samples show camera arrival followed by route growth and metadata opacity 0.18 → 1; the trace disappears on completion. Automated ACF checks 105/105, including 61 entrance cases, 49 graph cases and 10 UI-motion lifecycle cases. Build and static verification passed.

## Severity Summary

No critical/high/medium findings. Existing Canvas performance remains slower: one 320px fallback frame observed at115.8ms CPU submission; this is not an FPS benchmark.

## Recommended Next Actions

Publish the verified scope once; confirm live asset hashes, cached refresh and fresh phone interactions. Detailed browser/geometry proof remains in the external QA directory.
