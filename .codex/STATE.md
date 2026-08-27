# Project state

- Mode: continuation
- Objective: preview the approved sitewide wordmark-to-navigation glitch sequence, Pip-integrated signal treatment, Continuity Desk project, restored About headshot, and selected personal essay in Writing.
- Status: verified and approved for production; this release is recorded on main.

## Completed

- Removed the standalone full-width signal rail and its component, responsive CSS, and build assertions.
- Moved the short hidden glyph trace into Pip's Next button as the sole right-side affordance, replacing the arrow. It breathes quietly while idle and responds in sequence when Pip advances to a new note.
- Removed the first avatar-side glyph treatment after review because it crowded Pip horizontally.
- Added synchronized, low-motion border/halo breathing to Pip and the guide panel; reduced-motion mode disables it.
- Added a dedicated Continuity Desk project page, direct site links, CreativeWork PDF metadata, and the exact public eight-page fictional/composite sample dossier.
- Removed the duplicated Continuity Desk explanation from Research and Publishing Systems and connected the Pip trail: pocketLLM → Research and Publishing Systems → Continuity Desk → Research Briefing Assistant.
- Restored the headshot on About with matching dimensions and alternative text.
- Added “The Age of Curation” as a selected personal essay, preserving the user's wording and recording its August 27, 2026 publication and production date.
- Expanded Writing into clearly separated Academic writing and Personal essay groups while keeping Substack as a quiet secondary reference.
- Connected the Writing guide to the essay, then from the essay into the existing academic-writing tour.
- Removed visible `boomerrawlings.com` labels from the footer and onsite writing venue rows while preserving canonical URLs, sitemap, CNAME, and structured SEO data.
- Added a server-rendered signal treatment to the Boomer Rawlings wordmark: a stable paper-white name briefly separates into clipped turquoise and gold slices, then reassembles. It uses no runtime JavaScript.
- Extended the wordmark signal into a coordinated left-to-right header scan: the name glitches first, followed by Academics, Writing, Projects, About, and All Work at 250 ms intervals. Each label now has a roughly 430 ms clipped-color pulse plus a tiny base-text displacement so the motion remains calm but visible. The treatment is shared by every page.
- Reordered the primary navigation to Academics, Writing, Projects, About, All Work. Home Contents uses Academics, Writing, Projects, and All Work; About remains header-only.
- Verified desktop, mid-width, 390 px, and 320 px layouts with no horizontal overflow. At 320 px the navigation wraps intentionally as 3 + 2 instead of stranding All Work.
- `npm test` and `git diff --check` pass.

## Decisions

- Continuity Desk has no portfolio date until a launch month is verified.
- The horizontal-slice wordmark treatment is approved. The standalone signal rail is permanently removed.
- Signal glyphs belong only to Pip's text interface, never to the live-region message itself; they are decorative and hidden from assistive technology.
- Pip's localized glyph trace is part of the Next control rather than a detached panel ornament.
- The wordmark keeps the rail's 8.6-second rhythm but replaces the rejected per-letter color wave with one short horizontal-slice glitch, an even smaller echo, and long quiet intervals. Reduced-motion mode renders a static name.
- The five navigation labels inherit the 8.6-second rhythm at 250 ms offsets, preserving the name-to-navigation reading order; reduced-motion mode disables both their base motion and pseudo layers plus all wordmark view-transition images.
- Onsite venue values remain in content metadata to satisfy the writing schema but are not rendered as redundant labels.
- The public PDF is the exact asset used by ContinuityDesk.io, not a recreation.
- The user approved the complete preview batch for production on August 27, 2026; main remains the canonical release branch.

## Next

1. Confirm the GitHub Pages workflow completes and the live site serves the release.
2. Treat subsequent design or content requests as a new preview batch.

## Risks

- Do not publish real Continuity Desk client materials.
- Do not invent a Continuity Desk launch month, client count, or measured outcomes.
