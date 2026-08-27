# Project state

- Mode: continuation
- Objective: restore the full-body portrait to About while retaining the headshot on Academics and in identity metadata.
- Status: portrait swap is locally verified; production push pending.

## Completed

- Restored the approved 1080×1440 full-body covered-walkway portrait on About with accurate alternative text; Academics remains on the smiling headshot.
- Updated portrait regression checks; `npm test` and `git diff --check` pass.
- Replaced four literal video summaries on Horizon, Paperfield, and pocketLLM with shorter editorial captions; detailed alt text remains unchanged.
- Verified the public Research Briefing Assistant repository before writing portfolio copy.
- Added a dedicated August 2026 project page describing the independent ChatGPT/Gemini passes, claim-level reconciliation, Python package validator, and human-review limits.
- Added an explicit `Work in progress` content field and surfaced it on the detail page, Projects and Research indexes, homepage, and All Work.
- Connected Research and Publishing Systems to the new project in Pip's guided sequence.
- Added CreativeWork status metadata and regression checks for page count, project ordering, labels, captions, verified claims, source link, and navigation.
- `npm test` and `git diff --check` pass. Production-build pages were visually reviewed at desktop width; the WIP label and homepage feature render cleanly.
- GitHub Pages run `33028190155` passed. Live checks confirm the new page, homepage/Projects/Research/All Work placement, all four revised captions, and sitemap entry.

## Decisions

- Treat the project as a real public WIP, not a finished application: the repository contains substantial workflow specifications and a working standard-library validator, but no demo, sample run, tests, CI, or release.
- Describe only implemented validation checks. Research execution and substantive evidence judgment remain human-review responsibilities.
- Keep captions interpretive; preserve literal workflow detail in video alternative text.
- GitHub Pages remains the canonical deployment target.

## Next

1. Commit and push the portrait swap to `main`.
2. Confirm the GitHub Pages workflow and live About image.

## Risks

- Do not imply that the documented multi-model workflow is fully automated by the validator.
- Keep private research material and unreviewed briefing outputs outside the public repository.
