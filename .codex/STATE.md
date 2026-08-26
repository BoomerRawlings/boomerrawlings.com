# Project state

- Mode: continuation
- Objective: finish the pending footer revision and repair the Horizon and Paperfield demo media.
- Status: release `94e69cc` is live through GitHub Pages; source, deployment, public routes, and replacement media are verified.

## Completed

- GitHub Pages remains canonical; `main` deploys through `.github/workflows/deploy-pages.yml`.
- Removed the obsolete domain email; Gmail remains site-wide and the UCSD address appears only on Academics.
- Placed the full-length portrait on About and the headshot on Academics.
- Updated Academics with the one-year honors AA-T, recognition, selected SWC coursework, incoming UCSD section, and selected academic work.
- Added embedded and downloadable PDFs for financial literacy, death-penalty rhetoric, and the unrun ABM proposal.
- Added Pip Back controls, a non-looping terminal state, refined exhibit copy, and a terminal arrow that disappears.
- Rebuilt the media-pipeline Mermaid diagram with deeper supervised transfer, validation, preservation, and frame-level indexing stages while avoiding unsupported implementation claims.
- Rebuilt the Horizon startup as a genuine 1920×1080 60 fps capture: 570 frames over 9.5 seconds, no cursor or desktop edges, the complete intro and settled interface, and an audible normalized startup track. Versioned the public URL to bypass stale caches.
- Removed Paperfield's first 8.33 seconds of dead time while retaining about half a second of visual context before the first paper moves. The replacement remains 1920×1080 at 60 fps and uses a versioned URL.
- Replaced pocketLLM media with a clean 1080×1440, 60 fps fresh-launch capture showing synthetic file drag-in, local encoding, the face interaction, restart, matching-key recognition, and restoration.
- Updated README deployment documentation for GitHub Pages and ignored local `tmp/` capture material.
- `npm test` and `git diff --check` pass; the replacement Horizon and Paperfield videos fully decode. Desktop and mobile browser audits show no horizontal overflow. Pip Next, Back, and terminal behavior were exercised locally.
- The prior cohesive release was deployed from commit `2c5c760` and verified live through GitHub Pages.
- Reframed the media project around verified engineering evidence: 612.9 GiB, 31,550 cataloged files, immutable originals, streamed SHA-256 identity, deterministic static-image preparation, strict schema gates, transactional provenance, crash recovery, SQLite full-text search, and a read-only localhost viewer.
- Corrected the unsupported claim that the implemented system analyzes every video frame. The source snapshot supports static images and ordered MPO image frames; videos retain catalog coverage.
- Rebuilt the Mermaid chart as a numbered signal rail with one-word stages, a gold integrity checkpoint, a readable mobile pan surface, and a compact evidence strip.
- Renamed the case study to `iCloud Media Migration and Catalog`, removed its full-size-diagram link, and added a compact evidence line beneath the rail.
- Rewrote the case study as the chronological development of eight concrete stages, beginning with iCloud's 1,000-item web-selection limit and ending with a local read-only viewer.
- Archived eight personal-writing entries without deleting their source; Writing now publishes only the three academic papers and links to Substack once.
- Updated Academics with the four-semester President's List wording, Fall 2026-2028 UCSD dates, and Experimental Psychology B.S. program label.
- Added August 2026 to pocketLLM and May 2026 to Research and Publishing Systems.
- Changed the academic document heading to `PDF` and removed redundant embedded-reader instructions.
- Reordered the header to Academics, Writing, Projects, All Work, About; added accessible LinkedIn and GitHub icon links beneath Gmail.
- Deployed release `d74179a` successfully through GitHub Pages and verified the changed live routes.
- Replaced the visible Gmail address in the footer with an accessible envelope icon and `Email` label while preserving the Gmail mailto target.
- Added the supplied ORCID profile beside LinkedIn and GitHub with a compact identifier icon.
- Published the footer and media repair in `94e69cc`. GitHub Pages run `32986289740` passed; the live Horizon file reports 570 frames at 60 fps with an audible AAC track, and the live Paperfield file reports 3,959 frames at 60 fps with the shortened opening.

## Decisions

- Academic writing uses production dates in All Work; detail pages retain both production and publication dates.
- The UCSD program and date labels follow the user's supplied academic plan; the explanatory sentence remains conservative about intended cognition and behavioral-research focus.
- Demo captures use clean client-only framing and actual 60 fps capture. Raw capture material stays outside version control.
- Production changes will be delivered in one verified push.
- The supplied ZIP is evidence only and must not be published. Its redaction leaves Codex thread UUIDs, run/attempt IDs, derived-media fingerprints, event hashes, timing, usage, and runtime details.
- Public copy must distinguish completed catalog/preparation work from the full inference run that stopped at a pre-model integrity gate.

## Next

1. No remaining action for the current release.

## Risks

- Do not stage `tmp/` or isolated application profiles.
- Keep raw and failed capture material under ignored `tmp/`; only the reviewed production media belongs in Git.
- Keep the supplied redacted ZIP and both ignored inspection directories out of Git and off the public site.
- Scale/checkpoint numbers are reported by the redacted overview and user-supplied context; the snapshot does not include raw media, Phase 1 implementation, databases, logs, or receipts for independent operational verification.
- 2026 award, degree, honors, one-year completion, and four-time recognition remain user-supplied facts.
