# Project state

- Mode: continuation
- Objective: maintain a restrained, factual public portfolio of selected projects, ideas, writing, and images
- Status: portfolio-language, motion, and homepage curator release validated locally; visual approval and one production push pending

## Completed

- Built a static Astro site with one typed Markdown content collection, shared indexes and entry layouts, sitemap, redirects, security headers, and no shipped client JavaScript.
- Connected GitHub `main` to Netlify production and configured the apex and `www` domains while preserving GoDaddy mail and service records.
- Added verified project pages, nine writing entries, publication metadata, the two requested footer email addresses, and live homepage counts.
- Consolidated project material into Horizon, Paperfield, Workline, Research and Publishing Systems, Organizing 31,550 Photos and Videos, and Interactive Systems.
- Published the ABM/aggression paper only as a student proposal whose study was not conducted, with provenance, sources, and limitations.
- Applied a UCSD-inspired navy/gold/blue/turquoise/paper visual system using Teko and Source Sans 3 without university marks or affiliation claims.
- Reframed every public page as a portfolio: masthead says `Portfolio`; About uses the requested developing-public-portfolio sentence; `All Work` replaces `Archive`; generic record/chronology/curation language is gone.
- Renamed the iCloud project and public route to `Organizing 31,550 Photos and Videos` at `/work/organizing-icloud-media/`; legacy project URLs permanently redirect.
- Replaced delayed page and row reveals with a single 180 ms navigation fade-through, a moving active-navigation indicator, and short hover/focus feedback; reduced-motion disables all animation.
- Added an original six-frame holographic curator as a reusable dialogue interface: a prominent factual welcome on the homepage, compact orientation on the six section pages, and one authored “what to notice” note on every internal project/writing page. Distinct arrival and interaction animations make the face speak reliably without client JavaScript.
- Verified the local 14-page build, metadata, local links, writing dates/groups, project regressions, sitemap route, page copy, desktop visuals, navigation arrival state, and the revised project route.

## Decisions

- Public framing is a developing portfolio, not an archive. Internal collection and CSS names may remain implementation details.
- `/all/` is the cross-disciplinary date-ordered view; `/archive/*` permanently redirects there.
- Empty Research and Photography pages keep concise scope copy without progress or incomplete-state messages.
- Substack is one external writing venue, not the complete writing corpus; every writing item names its venue and evidenced dates.
- Keep the interface flat, typographic, and information-dense. Motion must explain navigation, focus, or clickability and must never delay readable content.
- The curator is a floating digital interface, not a physical mascot or fixed chat widget. Keep the homepage guide prominent and use compact contextual guidance only on orientation pages where it adds real navigation or interpretation.
- Astro static generation and boring platform features remain preferable to a CMS or client runtime.
- Production builds cost credits: batch source changes into one verified release and let state-only commits skip the build.
- Keep the financial-literacy and death-penalty essays unpublished until their factual and analytical problems are rebuilt.

## Verified production infrastructure

- GitHub repository: `BoomerRawlings/boomerrawlings.com`; production branch: `main`.
- Netlify project: `boomerrawlings-com`; command `npm run build`; output `dist`.
- Apex is canonical; `www` redirects to apex; TLS and forced HTTPS are active.
- GoDaddy nameservers and all email-related DNS records remain unchanged.

## Next

1. Obtain visual approval for the curator dialogue treatment.
2. Commit and push the validated portfolio release once.
3. Verify Netlify reports a ready Git deploy matching that commit and check the key live routes and legacy redirects.
4. Reconsider held writing only after source and privacy review.

## Risks

- Raw journals and course files contain sensitive disclosures, identifiable third parties, or instructor comments; none are safe to publish verbatim.
- Original production dates are unavailable for current Substack posts and must not be inferred.
- DNS changes remain high risk because mail uses existing GoDaddy-zone records.
- Netlify credits are finite; avoid incremental production pushes.
