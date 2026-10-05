# User-Facing Flow Test

## Objective
Start a short flashcard session, rate/undo, reload, resume, and inspect its linked lesson.

## Test Environment
Local Astro dev server, in-app Chromium, desktop viewport. 2026-10-05.

## Starting Assumptions
New review storage; existing atlas and quiz history retained.

## Steps Taken
Selected five cards; revealed answer; rated Again; undid; rated With effort by keyboard; returned to decks; reloaded; selected Brain atlas; resumed original session; opened 3D lesson; returned to Practice; switched to Questions.

## What Worked
Hidden answer inaccessible before reveal. Again queued a retry. Undo restored original card and zero progress. Reload retained four remaining cards and one reviewed today. Lesson link opened the correct glutamate model. Return preserved the revealed card. Questions remained available.

## What Felt Intuitive
Three rating choices, explicit next-review times, Decks and Resume actions.

## What Felt Unintuitive
Confirmed issue, medium: resumed mixed session displayed Brain atlas after changing hub selection. Persist session label independently.

## Visual Cohesion Notes
Dark palette and restrained mint/purple accents match the atlas; card flip and tract sketch render cleanly. Phone and all sketch families pending a separate pass.

## Broken or Dead Interactions
No dead actions encountered in this objective.

## Missing Feedback
None encountered.

## Errors Encountered
No visible errors.

## Completion Result
Core objective completed; misleading resume label requires correction. Pass ended before implementation changes.

Follow-up after fixes: original White matter / All depths session retains its label after selecting Brain atlas / Essentials and reloading. Keyboard focus remains on the selected deck. Five unique cards with one repeated attempt complete with six correctly labeled ratings. Difficult-card retry remains independent of hub filters. All topic citations expand on the answer side. Quiz keyboard, topic lesson return, sequence practice and animation pause work. Production build starts directly in Practice, renders the atlas on return, and resumes a partially rated session after reload.

Final visual checks: eight sketch families, both faces; corrected inhibitory feedback branch; larger callouts. Desktop,390px and320px layouts inspected, including long answers and references. Actual card/control bounds remain inside the phone viewport. No console errors on production preview. Full-page capture can crop the browser scrollbar width; final desktop evidence uses settled viewport captures.

## Severity Summary
One confirmed medium issue. Separate code review identified focus, rapid-transition and source-selection edge cases for follow-up.

All identified issues corrected and rechecked. No unresolved blocking findings.

## Recommended Next Actions
1. Publish verified build and confirm live Practice assets and first-card interaction.
