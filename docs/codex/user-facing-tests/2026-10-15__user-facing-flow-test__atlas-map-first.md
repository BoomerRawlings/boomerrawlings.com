# User-Facing Flow Test

## Objective
Enter the Atlas, select two subjects, understand the clusters, return to the full field.

## Test Environment
Local Astro dev route `/ACF/`; HTTP 200. Baseline e5648b5. CUA inventory: no available apps or browsers. Both in-app browser and Chrome creation returned unavailable; opening through Codex was queued.

## Starting Assumptions
UI-only change. Public collection/evidence unchanged. Animated entrance, pointer preview and panning should remain available.

## Steps Taken
1. Started the normal development server; route responds.
2. Attempted browser connection and refreshed inventory: unavailable.
3. Stopped the visible-flow test at that boundary. No rendered interaction was observed.

## What Worked
Automated tests are separate evidence: Full npm test and 47-page build passed, including 182 Atlas test groups with 97 entrance cases and 71 graph cases. Pure guide tests use actual region/comparison models. Markup parsing found no duplicate IDs, broken ID references or parser errors.

## What Felt Intuitive
Not assessed in a browser. Design intent: one primary subject picker progresses from first to second; one-click example; map fills the rest of the first viewport.

## What Felt Unintuitive
Not assessed in a browser.

## Visual Cohesion Notes
Not visually verified. Static review found and fixed inherited mobile List minimum height and hidden collection legend. No canvas-height animation was added; drawers leave the map dimensions unchanged.

## Broken or Dead Interactions
None established by visible testing. Review found and fixed filter clearing retaining facet parameters in history, and Back to map retaining List mode.

## Missing Feedback
Not assessed visually. Guide wording follows selection and distinguishes no overlap from zero filtered records. Active search/filter count stays visible with controls folded.

## Errors Encountered
Confirmed test-environment blocker: browser control unavailable. This is not an observed application error.

## Completion Result
**Visible-flow test blocked.** Automated, markup and build verification do not establish physical animation smoothness or rendered layout quality.

## Severity Summary
Medium verification gap: first-entry and responsive visual behavior remain unobserved.

## Recommended Next Actions
1. When browser control is available, test fresh entry and deep-link comparison at 1280×720, 390×844 and 320×568.
2. Check first/second selection, example, Map/List, tools open/close, keyboard Escape/focus and full reset.
3. Check Read this map → source → record → Locate, paused/reduced motion, zoom/pan/hover and expanded view.
