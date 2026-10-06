# User-Facing Flow Test

## Objective
Expand models horizontally, retain recognizable axons at distance, and interact with every displayed neuroscience chart.

## Test Environment
Final production build in the in-app browser; 1280×720 desktop, 844×390 landscape, 390×844 phone and 1920×1080 projection. Source documents and screenshots retained outside the public repository.

## Starting Assumptions
Published source figures remain images unless actual numerical samples exist. Teaching-model readouts must be identified as illustrative. Preserve lecture pacing, complete content and private collection cleanup.

## Steps Taken
- Opened all 50 chart/figure instances across 42 lecture and reading-guide slides; activated all 194 panel targets and captured every inspector.
- Tested source zoom/reset, panel selection, A/B selectors, return from comparison, temporary note creation/clearing and Escape.
- Scrubbed voltage, summation and population demonstrations; pinned readouts and changed conditions. Clicked the population timeline directly: inspection moved from 5 to 8 seconds.
- Inspected whole-fiber/cutaway myelin, neuron, dendrites, white-matter pathways, tract axons and spike-timing traces. Checked overview, distant and close views, selected structures and responsive expansion.
- Locked the lecture collection: no source images or figure inspectors remained; password gate returned.

## What Worked
- Desktop expanded views use a broad canvas and adjacent controls; landscape retains this arrangement. Phone controls remain reachable by scrolling without page-wide horizontal overflow.
- Source panels retain original pixels; comparisons explain axes/conditions and distinguish unavailable numerical data.
- Voltage comparison retained the original −10 mV readout at teaching time 5 while Na⁺ block changed the model to −46 mV, displaying a −36 mV difference.
- Trace selection seeks the intended animation phase while preserving paused playback.
- All 50 source views independently reviewed from actual screenshots. No observed production-preview console warnings/errors.

## What Felt Intuitive
Selecting a named panel highlights and explains that exact region. Whole fiber/Cutaway makes internal anatomy an explicit choice. Expanded controls stay alongside the visual.

## What Felt Unintuitive
Personal UX impression · low: full journal pages remain dense at fitted size; panel selection and zoom are necessary for small published labels.

## Visual Cohesion Notes
Existing restrained palette, typography and pointer preserved. Comparison figures receive the main canvas rather than small sidebar thumbnails.

## Broken or Dead Interactions
None remaining in tested flows. Confirmed issues corrected: premature channel clutter, soma–axon attachment, selected timing-trace clipping and neighboring fragments in two comparison crops.

## Missing Feedback
None observed. Selection, pinning, condition changes and temporary-note lifetime have explicit feedback.

## Errors Encountered
No application errors in the final preview. Audit tooling initially resized the newest tab while capturing an older tab; phone evidence was recaptured after verifying actual viewport dimensions.

## Completion Result
Full npm test passed, including build, model geometry/continuity, lecture access/presenter/demos and chart interactions. Private content validator passed 151 pages, 50 figures and 194 panel targets; source image hashes unchanged. Final model and comparison recaptures reviewed before publication.

## Severity Summary
No remaining critical/high/medium issue found. Low: source-resolution limits on dense paper labels.

## Recommended Next Actions
Publish the verified build; confirm live model rendering, lecture unlock and chart interaction. Raw empirical readouts remain contingent on genuine source data.
