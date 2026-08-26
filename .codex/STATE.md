# Project state

- Mode: continuation
- Objective: publish one cohesive portfolio release with corrected contact and academic presentation, stronger evidence, refined Pip behavior, clean application demos, and downloadable academic papers.
- Status: implementation and local verification complete; one production push and live verification remain.

## Completed

- GitHub Pages remains canonical; `main` deploys through `.github/workflows/deploy-pages.yml`.
- Removed the obsolete domain email; Gmail remains site-wide and the UCSD address appears only on Academics.
- Placed the full-length portrait on About and the headshot on Academics.
- Updated Academics with the one-year honors AA-T, recognition, selected SWC coursework, incoming UCSD section, and selected academic work.
- Added embedded and downloadable PDFs for financial literacy, death-penalty rhetoric, and the unrun ABM proposal.
- Added Pip Back controls, a non-looping terminal state, refined exhibit copy, and a terminal arrow that disappears.
- Rebuilt the media-pipeline Mermaid diagram with deeper supervised transfer, validation, preservation, and frame-level indexing stages while avoiding unsupported implementation claims.
- Replaced Horizon startup media with a complete 1920×1080, 60 fps capture with sound and no cursor.
- Replaced Paperfield media with a clean 1920×1080, 60 fps application-only capture showing search, smooth bundle movement, fanning, a connection, PDF reading, and DOI import.
- Replaced pocketLLM media with a clean 1080×1440, 60 fps fresh-launch capture showing synthetic file drag-in, local encoding, the face interaction, restart, matching-key recognition, and restoration.
- Updated README deployment documentation for GitHub Pages and ignored local `tmp/` capture material.
- `npm test` passes; all three final demo videos fully decode; desktop and mobile browser audits show no horizontal overflow. Pip Next, Back, and terminal behavior were exercised locally.

## Decisions

- Academic writing uses production dates in All Work; detail pages retain both production and publication dates.
- The UCSD entry describes an intended cognition and behavioral-research focus, not a formal specialization that is not listed in the current catalog.
- Demo captures use clean client-only framing and actual 60 fps capture. Raw capture material stays outside version control.
- Production changes will be delivered in one verified push.

## Next

1. Review and stage only intended public/source changes.
2. Commit and push once.
3. Verify the GitHub Pages workflow and live domain.

## Risks

- Do not stage `tmp/` or isolated application profiles.
- Keep raw and failed capture material under ignored `tmp/`; only the reviewed production media belongs in Git.
- 2026 award, degree, honors, one-year completion, and four-time recognition remain user-supplied facts.
