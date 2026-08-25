# Project state

- Mode: continuation
- Objective: replace overlapping process graphics with Mermaid, repair Horizon's 1080p single-screen presentation, correct the Academics date span, hide Workline, and add Continuity Desk plus the SWC technology packet.
- Status: implementation and local QA complete; ready for one production push.

## Current implementation

- Static Astro portfolio with 15 generated pages, unified typed content, sitemap, redirects, security headers, and one dependency-free Pip enhancement script.
- Homepage, About, Academics, All Work, Projects, Research, Writing, Photography, seven project or writing detail routes, and a coherent Pip route across the main exhibits.
- Academics records the user-confirmed Psychology for Transfer (AA-T) completion with honors in one year, 2026 Student of Distinction status, four President's List terms, selected SWC coursework, and selected academic work.
- Horizon's launch evidence is a clean 1920 by 1080, 60 fps, six-second capture framed as one complete workspace. Evidence is capped at its declared native width so media no longer stretches across large displays.
- Process diagrams have editable Mermaid sources and committed static SVG output. Runtime Mermaid JavaScript is not shipped.
- Workline is retained as draft content and Mermaid source but has no generated route, listing, link, or Pip stop.
- Research and Publishing Systems now documents Continuity Desk and the July 2026, two-guide, 95-page Southwestern College technology packet.
- pocketLLM is documented conservatively as a local reversible-pseudonymization tool with original-file preservation, matching keys, required human review, and no compliance claim.
- Pip's homepage introduction remains user-authored. Every other tour now interprets the page's current content or evidence, names the important trust boundary, and continues to the next exhibit. Duplicate live-region wording was removed.
- Writing separates academic and personal work, distinguishes venue, publication, and production dates, and treats Substack as one venue rather than the complete corpus.
- Public framing is a developing portfolio, not an archive. The media pipeline remains a supervised project; Photography is reserved for image-led work.

## Decisions

- GitHub `main` is canonical. Netlify must deploy the tracked commit; no manual production deploy.
- One production build for this release. State-only follow-up commits may use the configured Netlify ignore rule.
- Preserve only verified date precision and conservative capability claims.
- Never publish private archives, normal workspaces, transcript detail, credentials, or personal datasets.
- Pip stays cheerful, specific, and concise. No inventory recitals, en or em dashes, or detached navigation copy.
- Videos use native controls, stay paused by default, and never autoplay or loop.
- Large application captures may be recorded above delivery size, cropped only to remove window chrome or unused canvas, then resized to a cohesive 16:9 presentation.

## Verification

- `npm test` passes all 15 pages, metadata, links, media paths, Pip routes, diagram checks, visual-evidence assertions, and accessibility regressions.
- `git diff --check` passes.
- Horizon's startup asset is H.264, yuv420p, silent, fast-start, exactly 1920 by 1080 at 60 fps, with 360 frames across six seconds.
- Browser QA confirms the Horizon video is centered without upscaling, the media Mermaid chart has no label overlap, the Academics range is `SPRING 2025 - SPRING 2026`, the publishing additions render, and Workline returns 404 locally.
- The captured Horizon workspace is synthetic and contains no private user workspace data.

## Next

1. Commit and push the verified release to GitHub `main`.
2. Monitor the single Netlify production build and verify the changed live routes and assets.

## Risks

- Production `main` is unprotected; a push deploys immediately.
- Netlify credits are finite; avoid manual or duplicate production deploys.
- 2026 award, degree, honors, one-year, and four-time recognition are user-supplied facts; linked SWC pages support the criteria and naming, not the 2026 recipient record.
- DNS remains high risk and is out of scope for this release.
