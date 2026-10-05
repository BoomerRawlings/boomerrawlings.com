# Course study and anatomical inspection

## Objective
Choose a course/chapter, retrieve an explanation, practice its supporting models, inspect a separated anatomical region, and return without losing review progress.

## Test Environment
Production Astro preview; Chromium; desktop1280px, phone390px and320px. Source data: supplied Ward fourth edition and Reisberg eighth edition; official UCSD course catalog. Existing browser study records retained.

## Starting Assumptions
- PSYC105 maps to Reisberg; PSYC108 to Ward. Course titles verified; optional pairing confirmation unanswered.
- No lecture schedule supplied. Only actual textbook chapter order is presented.
- Separated geometry uses rigid illustrative translations. Assembled geometry retains source coordinates; microscopic models remain explicitly separate representations.

## Steps Taken
- Selected105/108, opened chapter browser, inspected chapter headings/pages, filtered supporting anatomy, and opened chapter retrieval answers with keyboard.
- Reloaded a mapped chapter and a notes-only chapter; verified scope persisted and the notes-only chapter did not show an unrelated model.
- Started105 chapter2 flashcards; revealed, rated Again, undid, then changed course. Confirmed review hub returned and compatible unfinished session remained resumable.
- Started an anatomy question round; selected the incorrect brainstem/cortical-neuron option. Verified targeted correction, all three explanations, and Enter on their disclosure without advancing the question.
- Captured14 assembled macro defaults and46 separated representations; independently inspected all60 screenshots. Corrected and recaptured cortical overlap and bilateral tract camera orientation.
- Orbited the model with arrow keys; verified compass positions changed. Selected Superior and verified the S pole faced the camera with A/P/R/L in their expected projected directions.
- At390px, separated thalamic nuclei, searched for dorsal lateral geniculate nucleus, focused its left source region, and returned from the expanded viewer.
- At320px, inspected105 chapter12, zero matching model cards, disabled model-question round, and available chapter retrieval content.
- Verified homepage Selected work includes Brain Study Guide first, correct destination/acronym, and all seven existing highlights.
- Live follow-up reproduced an out-of-scope AMPA model disappearing when switching to108 chapter2. Scoped topic filtering to library buttons; repeated AMPA-to-chapter2, thalamus separation, search and persisted reload successfully. Four actual-filter regressions fail on old code and pass on the fix.

## What Worked
Course scope consistently filters library, question rounds, decks and counts. Notes-only chapters remain useful. Stored ratings/history survive course switching. Native answer disclosure keyboard behavior remains intact. Models and compass respond together; clear Reassemble action restores source relationships.

## What Felt Intuitive
Always-visible course toggles; chapter list instead of a long dropdown; directly named anatomical views; click compass poles to orient; searchable nuclei; misconception-specific correction before optional answer comparison.

## What Felt Unintuitive
Initial exploded cortical offsets left a central cluster. Initial tract separation used a different view direction from the measured view, obscuring bilateral bundles. Both corrected and recaptured.

## Visual Cohesion Notes
Course panels reuse the atlas palette and typography. Chapter ideas, misconception and retrieval sections remain readable at320px without horizontal page overflow. All60 macro views fit; dense labels can be toggled. A selected-region description initially overlapped the compass on phones; final CSS reserves its corner and was rechecked.

## Broken or Dead Interactions
No remaining blockers observed. Chapters without supporting models explicitly say so and retain retrieval questions; model-practice actions are omitted/disabled appropriately.

## Missing Feedback
No remaining issue observed in tested flows. Every model question has choice-specific explanations;100 wrong options have targeted corrections. Flashcard confidence remains self-assessment rather than automatic grading.

## Errors Encountered
A live course-switch check found broad data-topic selectors hiding the viewer and altering card surfaces/counts. All four library operations now target library buttons; actual-filter regression and UI retests pass. Standalone homepage links use local paths and bypass delayed Pip departure. The hidden browser reports a native view-transition abort on arrival; settled controls remain functional. No preview application errors. Homepage test expectations changed from seven highlights/nine projects to eight/ten.

## Completion Result
Pass. Full `npm test`, strict TypeScript and final build pass. Model checks cover50 scenes,6,500 animation/detail frames,267 zoom boundaries,282 separated/nested fits and12 compass projections. Chapter integrity verifies31 chapters,93 ideas,31 misconception corrections and62 retrieval prompts; answer feedback and actual keyboard-handler regressions pass.

## Severity Summary
One blocking course-filter visibility bug and two blocking visual-overlap issues corrected. One phone tooltip/compass collision corrected. No unresolved blocker in audited flows.

## Recommended Next Actions
Map actual lecture dates/order when a syllabus is supplied. Future visual coverage can add method-specific and higher-level cognition models; the current guide distinguishes those gaps from existing supporting anatomy.

Evidence retained outside the repository in `qa/course-navigation` and `qa/courses`; textbook originals are not published.
