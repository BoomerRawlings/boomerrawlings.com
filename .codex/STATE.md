# Project state

- Mode: continuation
- Objective: release the verified portfolio expansion, visual evidence, pocketLLM page, and revised Pip tour through the canonical GitHub-to-Netlify path.
- Status: source and media are locally verified; release staging and production push remain.

## Current implementation

- Static Astro portfolio with 16 generated pages, unified typed content, sitemap, redirects, security headers, and one dependency-free Pip enhancement script.
- Homepage, About, Academics, All Work, Projects, Research, Writing, Photography, eight project or writing detail routes, and a coherent Pip route across the main exhibits.
- Academics records the user-confirmed Psychology for Transfer (AA-T) completion with honors in one year, 2026 Student of Distinction status, four President's List terms, selected SWC coursework, and selected academic work.
- Project evidence includes 60 fps videos for Horizon, Paperfield, and pocketLLM; process diagrams for Workline and the media pipeline; and a verified image from The Unrendered World.
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

## Verification

- `npm test` passes all 16 pages, metadata, links, media paths, Pip routes, visual-evidence assertions, and accessibility regressions.
- `git diff --check` passes.
- Release audit found no credentials, private paths, EXIF, unintended PII, or unreviewed personal data.
- All four MP4 assets are H.264, yuv420p, silent, fast-start, and 60 fps.
- Netlify is authenticated and linked to `boomerrawlings-com`; production currently follows GitHub `main`.

## Next

1. Explicitly stage the intended release files and inspect the staged diff.
2. Commit once and push `main` once.
3. Monitor the Git-triggered Netlify deploy and verify the live routes and assets.
4. Remove disposable pocketLLM capture workspaces from system temp when recursive cleanup is permitted.

## Risks

- Production `main` is unprotected; a push deploys immediately.
- Netlify credits are finite; avoid manual or duplicate production deploys.
- 2026 award, degree, honors, one-year, and four-time recognition are user-supplied facts; linked SWC pages support the criteria and naming, not the 2026 recipient record.
- DNS remains high risk and is out of scope for this release.
