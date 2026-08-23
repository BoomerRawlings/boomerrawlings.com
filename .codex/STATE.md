# Project state

- Mode: continuation
- Objective: maintain boomerrawlings.com as a restrained public archive deployed from GitHub main through Netlify
- Status: selected archive-ledger redesign complete; verified publishing pipeline and domain remain in place

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

## Decisions

- Astro static generation: content-oriented, minimal runtime, no shipped client JavaScript.
- One validated archive collection with a type field: simplest cross-type chronological model.
- Apex boomerrawlings.com is canonical; www will redirect to apex.
- Keep GoDaddy nameservers; only @ A and www CNAME point web traffic to Netlify.
- Roll back releases through Git history, not lasting manual Netlify uploads.
- Keep the interface flat, typographic, and artifact-led; derive homepage counts from published content rather than hard-code them.
- Keep Substack as the canonical publisher; store only curated metadata and direct links on this site.

## Verified production state

- GitHub: public repository BoomerRawlings/boomerrawlings.com, default branch main.
- Netlify: boomerrawlings-com; Git-connected production builds from main.
- DNS: @ A 75.2.60.5 (TTL 600); www CNAME boomerrawlings-com.netlify.app (TTL 3600).
- DNS verification: both authoritative GoDaddy nameservers plus Google, Cloudflare, and Quad9 return the new web records.
- Mail/service verification: PPE Hosted MX, SPF, Microsoft verification, DMARC, Outlook/SecureServer, and Lync/SIP records are unchanged.
- Routing: HTTP apex redirects to HTTPS; HTTPS apex returns 200; HTTP/HTTPS www ultimately redirects to HTTPS apex.
- TLS: Netlify certificate issued for apex and www; automatic renewal enabled.

## Next

1. Replace provisional project copy with real artifacts and concrete documentation.
2. Curate and add public entries under src/content/archive.
3. Re-inventory DNS before any future domain or mail change.

## Risks

- Some ISP resolvers may briefly retain the pre-migration records until their cached TTL expires.
- Nameserver replacement or casual email-record edits risk mail disruption and remain out of scope.
