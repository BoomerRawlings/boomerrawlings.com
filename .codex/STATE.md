# Project state

- Mode: continuation
- Objective: publish a compact, public-safe `/swc/` student-worker handoff hub
- Status: source-fidelity correction verified locally; publication pending

## Completed

- Kept one-page navigation with tabs and Ctrl+F-friendly headings.
- Identified seven prior local working files as invented substitutes rather than faithful source copies; retired them from the site.
- Rebuilt five YARD roster and two class sign-in workbooks from the original operational layouts, removing student rows only.
- Re-split the supplied 10-page scan into six source-faithful PDFs, dropping two blank pages and correcting orientation without rewriting or flattening.
- Mapped the supplied agreement, Center Log, Launch Checklist, and Resource List PDFs to the requested form labels.
- Marked Event Sign-In as source needed because no verified original is available.
- Linked SWC letterhead plus Bookstore, Laptop, and RJ Backpack Drive lists; existing Drive permissions were preserved.
- Populated verified contacts for Bookstore credit, SWC Cares, HECNC Student Services, Student Employment/Federal Work-Study, and HECNC IT.
- Added Restorative Justice, service-desk, AODS, CADTP SUDRC, Work Experience, and Personal Wellness references. Amber is not listed.

## Decisions

- Manuel Burciaga Tarin is labeled Student Services, not current SWC Cares.
- Karen Sanchez Jimenez is labeled Student Employment/Federal Work-Study, not Payroll.
- Elizabeth uses SWC directory spelling “Sisco Parada.”
- SWC Alcohol and Other Drug Studies is separated from CADTP’s external Registered SUD Counselor resources.
- Source fidelity wins over redesign: preserve supplied PDFs; blank student rows only when publishing operational spreadsheets.
- Do not invent a replacement when an original is missing; show a source-needed status instead.

## Verified

- Six corrected PDFs match the source pages at content-stream, embedded-image, and render levels; launch checklist original wording is restored.
- All 58 sheets across seven YARD workbooks match source headers, layout, print areas, page setup, margins, and view state; no student data or hidden residual strings remain.
- `npm test` and `git diff --check` pass with the corrected assets and source-fidelity assertions.
- Existing production remains at commit `6d3c303` until the correction build is verified and published.

## Next

1. Commit, push, monitor Pages, and verify corrected live downloads.
2. Obtain the original Event Sign-In file; Canva must be reconnected or the file attached.

## Risks

- By-link plus `noindex` is not authentication; restricted Drive content depends on Drive permissions.
- Laptop and RJ Backpack Sheets remain owner-restricted and may require deliberate access grants.
- Working templates should be rechecked against current SWC policy each term.
- The Event Sign-In download remains unavailable until a verified original is supplied.
