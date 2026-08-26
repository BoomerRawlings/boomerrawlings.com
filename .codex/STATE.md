# Project state

- Mode: continuation
- Objective: strengthen branded search visibility and make boomerrawlings.com the clearest canonical result for Boomer Rawlings.
- Status: SEO implementation is complete and verified; production push authorized and pending.

## Completed

- Audited the live crawl surface: robots, sitemap, canonicals, redirects, unique titles/descriptions, and 17 public routes are healthy.
- Confirmed current search backends do not yet surface boomerrawlings.com for exact-name or domain searches; the primary gap is discovery and identity consolidation.
- Added site-wide author, robots preview, favicon, canonical, Open Graph, and large-card social metadata.
- Added a reviewed 1200x630 branded social preview using the approved headshot.
- Added stable Schema.org `WebSite`, `Person`, `WebPage`, and `ProfilePage` identity graphs with LinkedIn, GitHub, ORCID, and Substack references.
- Added descriptive search titles plus `Article`/`ScholarlyArticle`, `CreativeWork`, and `BreadcrumbList` data to published detail pages.
- Added a visible linked author byline to each academic paper.
- Improved homepage, Academics, Writing, and All Work descriptions without keyword stuffing.
- Marked the empty Photography page `noindex,follow` and excluded it from the sitemap until it contains published work.
- Added a prominent canonical-site link to the repository README.
- Corrected all three public PDFs' embedded title, author, subject, keywords, and `en-US` language metadata. Every page retained an exact rendered/text/link/annotation match; first pages were visually reviewed.
- Expanded build verification to enforce unique metadata, complete social cards, real image dimensions/MIME types, valid structured-data relationships, PDF metadata, and exact parity between indexable canonicals and the sitemap.
- `npm test` and `git diff --check` pass.

## Decisions

- No implementation can guarantee first place for every query. Optimize exact-name/entity searches first, then build authority through verified external profiles.
- Keep the homepage title exactly `Boomer Rawlings`; use concise descriptive titles on deeper pages.
- Do not add `meta keywords`, fabricated affiliations, unsupported dates, ratings, or keyword-heavy copy.
- Use representative project imagery when available; keep article schema images unset until paper-specific imagery exists. The branded card remains the social fallback.
- Production changes remain batched into one verified push.

## Next

1. Commit, push, and verify the authorized production release.
2. Verify Google Search Console and Bing Webmaster Tools, submit `https://boomerrawlings.com/sitemap-index.xml`, and request indexing for `/` and `/about/`.
3. Add reciprocal portfolio links to the GitHub profile, ORCID record, Substack profile, and LinkedIn profile; correct the public GitHub repository homepage/description.
4. Re-enable Photography indexing when the page contains published image work.

## Risks

- Search indexing and ranking are controlled externally, can take days or weeks, and are never guaranteed.
- Search engines currently have weak reciprocal identity evidence because major external profiles do not link back to the portfolio.
- Search Console/Bing ownership tokens must come from the user's accounts; do not invent verification files or alter DNS casually.
- Preserve GitHub Pages as canonical hosting and keep raw/private media outside the repository.
