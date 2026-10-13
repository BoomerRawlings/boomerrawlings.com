# User-Facing Flow Test

## Objective
Select two subject territories, inspect connections and evidence, then restore the universe.

## Test Environment
Local Astro development command, followed by a static local server to avoid development reloads. Actual in-app Chromium browser;1280 desktop and390/320 phone viewports. Separate local instrumentation checks GPU inputs and Canvas arcs. Viewport emulation is not physical-device/FPS evidence.

## Starting Assumptions
All nine public catalogs loaded. First territory selects its records; a second distinct territory starts comparison. Metadata remains unchanged.

## Steps Taken
1. Entered through the riddle; chose Minds, then Bodies. Observed800ms movement into two clusters;108 overlapping records displayed once in the bridge; other stars faded.
2. Opened Evidence. Confirmed4006 unique records,223 direct recorded links,18 links through shared records,132 strict credit bridges; expanded actual relationship rows and source URLs, including editorial-card basis.
3. Replaced the second territory with Planet. Confirmed2223 unique records and23 shared; forced Canvas fallback and GPU restoration without losing the view.
4. Returned to the universe. Captured intermediate restoration and original coordinates at completion.
5. At320px selected Power/Culture; verified5147 unique List records,136 shared,30 recorded and1 inferred cross-territory links. Paused motion, opened Evidence, escaped to its trigger, replaced the second subject, and cleared.
6. Enabled inferred routes with territories hidden. Only130 tentative record links remained; no routes to hidden theme hubs.

## What Worked
Reversible clustering; first/second selection; replacement/removal; evidence roles and source basis; List; keyboard dismissal; pause; deep-link entry; Canvas and GPU recovery. App lifecycle harness additionally covers search/empty results, record details, browser history and cached reentry.

## What Felt Intuitive
Persistent selected chips, subject picker, Evidence, and Back to universe. Evidence starts closed so both clusters remain visible.

## What Felt Unintuitive
Resolved confirmed issue: phone perspective controls initially covered the upper cluster. Comparison controls now use one compact row. Normal map controls remain available outside comparison.

## Visual Cohesion Notes
Subject colors, translucent outlines, angular evidence flows and staged metadata reveals retained. Phone clusters stack vertically; labels use orientation-neutral first/second wording.

## Broken or Dead Interactions
None remain in tested flow. Independent review found and verified the fix for a delayed repeated-clear crash. Graph tests cover selecting during movement without a position jump.

## Missing Feedback
None observed. Counts distinguish shared-record membership from credits joining distinct records and from actual record relationships.

## Errors Encountered
No application console errors in final browser samples. Deliberate GPU loss activates the existing Canvas guidance.

## Completion Result
Passed. Independent14-snapshot proof preserves all33945 canonical IDs/coordinates; actual GPU transitions and restoration verified.55184 submitted route endpoints checked with zero mismatches. Canvas point arcs match submissions. All15 subject pairs independently checked against source membership/evidence.

## Severity Summary
No remaining critical/high/medium finding. Existing Canvas fallback remains slower; no physical-device/GPU FPS claim.

## Recommended Next Actions
Publish one verified release; check production asset hashes, cached refresh and a fresh comparison deep link. Detailed evidence stays in the sibling QA directory.
