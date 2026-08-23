# Project state

- Mode: continuation
- Objective: maintain a restrained, factual public archive with concrete project evidence
- Status: Writing headings and six consolidated project records are live; the 14-page production release is verified

## Completed

- Built a static Astro site with a unified Markdown archive collection, initial homepage, section placeholders, archive index, project pages, metadata, sitemap, security headers, and agent/deployment documentation.
- Verified npm installation, production build, 10 generated pages, internal links, metadata, desktop layout, and 390 px mobile layout.
- Created the public GitHub repository BoomerRawlings/boomerrawlings.com on main.
- Created the Netlify project boomerrawlings-com and connected main with npm run build and dist as production settings.
- Proved Git-triggered production deployment with a controlled push; the recorded deployment was non-manual and matched its Git commit.
- Assigned boomerrawlings.com and www.boomerrawlings.com, issued TLS for both, and enabled forced HTTPS.
- Replaced only the GoDaddy web records; GoDaddy nameservers and all mail/service records remain unchanged.
- Disabled Netlify's default public badge injection; production HTML contains no script tags.
- Verified all 10 HTML routes, sitemap, robots, redirects, security headers, desktop semantics, and mobile layout.
- Replaced the portfolio-style homepage with a compact archive ledger: factual introduction, live published-project counts, and three verified records.
- Removed the “The Finding Aid” framing, oversized manifesto, BR mark, faux-external arrows, and private-archive/curation slogan.
- Added both public email contact links to the site footer.
- Indexed all eight public Substack posts under Writing as external records.
- Reframed Writing as the umbrella for personal and academic work; grouped records by publication venue and exposed labeled publication dates.
- Added validated writing metadata for kind, venue, publication date, and optional original production date.
- Deployed the writing model from Git commit `ff19ca3`; Netlify reported a ready, non-manual production deploy and the live pages returned the expected venue and dates.
- Screened the prior portfolio and original Drive manuscripts; separated viable Boomer-authored candidates from other authors' work, raw/private material, course scaffolding, and AI-generated research notes.
- Reframed the former Personal Archive record as “Archiving 31,550 Photos and Videos,” describing the actual iCloud collection, local download, sorting, parsing, and structuring work.
- Added the ABM/aggression student research proposal as the first onsite academic-writing entry, with produced/published dates, source links, study-status disclosure, and an editorial limitations note.
- Grouped Writing by Academic and Personal category while retaining a venue label on every record; Substack remains an external venue.
- Added a Netlify ignore rule for documentation/state-only commits and a release rule to batch production changes instead of pushing incrementally.
- Verified the current build: 11 HTML pages, 9 writing records, metadata/local links, and 390 px and desktop layouts; no horizontal overflow.
- Deployed release `a56c778` through the Git-connected production path; Netlify reported ready and both new live routes returned 200 with the expected groups, dates, and study disclosures.
- Replaced provisional project copy with six consolidated records: Horizon, Paperfield, Workline, Research and Publishing Systems, the iCloud media archive, and Interactive Systems.
- Removed redundant project status labels from the homepage; five primary projects are featured while Interactive Systems remains in the full Projects index.
- Released and verified the 14-page consolidated build: internal links, project-copy regressions, desktop/390 px layouts, and live routes pass with no horizontal overflow.

## Decisions

- Astro static generation: content-oriented, minimal runtime, no shipped client JavaScript.
- One validated archive collection with a type field: simplest cross-type chronological model.
- Apex boomerrawlings.com is canonical; www will redirect to apex.
- Keep GoDaddy nameservers; only @ A and www CNAME point web traffic to Netlify.
- Roll back releases through Git history, not lasting manual Netlify uploads.
- Keep the interface flat, typographic, and artifact-led; derive homepage counts from published content rather than hard-code them.
- Treat Substack as one external publication venue, not the complete writing archive; keep its posts as metadata records with direct links.
- Require every public writing record to identify personal/academic kind, venue, and verified publication date; add a production date only when evidenced.
- Gate every local manuscript on authorship, standalone readability, source accuracy, third-party privacy, and deliberate consent for sensitive disclosure before publishing.
- Treat the prior portfolio as a source index only; its promotional claims and chronology are not reliable publication copy.
- Put verified project facts in archive content so they propagate across the site; avoid a generic homepage statistics dashboard until several independent metrics are available.
- Use Academic and Personal as the primary writing groups; show form, venue, publication date, and a separately evidenced production date per record.
- Publish the ABM proposal only as student work whose study was not conducted; preserve its methodological gaps in an explicit editorial note.
- Hold the financial-literacy and death-penalty essays until their factual and analytical errors are rebuilt; do not silently polish them into publication.
- A production deploy costs credits; batch releases, test locally or in free previews, and skip builds when only project notes change.
- Consolidate related artifacts into durable project records rather than publishing every prototype or task as a separate project.
- Public project pages describe observable behavior and outputs; they omit internal progress reporting without claiming capabilities that were not built.

## Verified production state

- GitHub: public repository BoomerRawlings/boomerrawlings.com, default branch main.
- Netlify: boomerrawlings-com; Git-connected production builds from main.
- DNS: @ A 75.2.60.5 (TTL 600); www CNAME boomerrawlings-com.netlify.app (TTL 3600).
- DNS verification: both authoritative GoDaddy nameservers plus Google, Cloudflare, and Quad9 return the new web records.
- Mail/service verification: PPE Hosted MX, SPF, Microsoft verification, DMARC, Outlook/SecureServer, and Lync/SIP records are unchanged.
- Routing: HTTP apex redirects to HTTPS; HTTPS apex returns 200; HTTP/HTTPS www ultimately redirects to HTTPS apex.
- TLS: Netlify certificate issued for apex and www; automatic renewal enabled.

## Next

1. Rebuild the financial-literacy essay's history, citations, and causal claims before reconsidering publication.
2. Reframe the death-penalty essay around its actual sources before reconsidering publication.
3. Review autobiographical personal-writing candidates with Boomer before publishing sensitive disclosure.

## Risks

- Some ISP resolvers may briefly retain the pre-migration records until their cached TTL expires.
- Nameserver replacement or casual email-record edits risk mail disruption and remain out of scope.
- Raw journals and course files contain sensitive disclosures, identifiable third parties, or instructor comments; none are safe to publish verbatim.
- Original production dates are not available for the current Substack records; none should be inferred from publication dates.
- Free-plan credits can pause the site until the billing cycle resets; production pushes must remain deliberately batched.
- Exact metrics from private/offline artifacts remain excluded until their manifests or QA reports can be re-opened and checked.
