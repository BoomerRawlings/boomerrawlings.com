# Project state

- Mode: continuation
- Objective: make Pip a persistent, factual guide through the public portfolio without turning the site into a chat interface
- Status: Pip’s guided tour is live in production from commit `4f4be35`

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
- Uses an original transparent six-frame holographic face in one reusable dialogue interface: prominent on the homepage and compact on section and entry pages.
- Named the curator Pip and gave all 14 public pages a three-step, screen-specific tour with visible progress and an exact next destination.
- Added soft user-triggered Web Audio chirps, synchronized mouth/panel/message response, a persistent sound toggle, per-page session progress, and a shared cross-page face transition.
- Kept a progressive form fallback, live-region announcements, accurate control labels, visible focus, and reduced-motion behavior. The only shipped script is the same-origin `public/scripts/pip.js`; CSP now permits self-hosted scripts only.
- Compared the current production homepage and local build at the same browser viewport, fixed destination, tour-loop, audio-failure, and Back/Forward mute-state issues, checked the longest destination label, and verified the final trail with no browser errors.
- Verified the local 14-page build, metadata, local links, writing dates/groups, project regressions, sitemap route, page copy, desktop visuals, navigation arrival state, and the revised project route.
- Verified Netlify’s ready Git deploy matches `d0c943e`; the live homepage, About, All Work, Writing, Horizon, renamed media project, curator asset, and three legacy redirects pass.
- Verified Netlify’s ready production deploy matches `4f4be35`; the live homepage and Pip script return 200, the guide and sound/persistence code are present, CSP permits only self-hosted scripts, and the ABM tour continues to About.

## Decisions

- Public framing is a developing portfolio, not an archive. Internal collection and CSS names may remain implementation details.
- `/all/` is the cross-disciplinary date-ordered view; `/archive/*` permanently redirects there.
- Empty Research and Photography pages keep concise scope copy without progress or incomplete-state messages.
- Substack is one external writing venue, not the complete writing corpus; every writing item names its venue and evidenced dates.
- Keep the interface flat, typographic, and information-dense. Motion must explain navigation, focus, or clickability and must never delay readable content.
- Pip is a floating digital interface, not a physical mascot or fixed chat widget. Keep the homepage guide prominent and the compact guide attached to page context.
- Sound is on by default but never autoplayed; it runs only after interaction and has a persistent, explicit mute control.
- Tour copy lives with page or entry content, remains conservative, and ends in one internal recommendation rather than open-ended chat.
- Astro static generation and boring platform features remain preferable to a CMS or client runtime; Pip uses a small dependency-free enhancement.
- Production builds cost credits: batch source changes into one verified release and let state-only commits skip the build.
- Keep the financial-literacy and death-penalty essays unpublished until their factual and analytical problems are rebuilt.

## Verified production infrastructure

- GitHub repository: `BoomerRawlings/boomerrawlings.com`; production branch: `main`.
- Netlify project: `boomerrawlings-com`; command `npm run build`; output `dist`.
- Apex is canonical; `www` redirects to apex; TLS and forced HTTPS are active.
- GoDaddy nameservers and all email-related DNS records remain unchanged.

## Next

1. Gather feedback on Pip’s live voice, sound, and route sequence.
2. Add future portfolio material only after source, privacy, and factual review.

## Risks

- Raw journals and course files contain sensitive disclosures, identifiable third parties, or instructor comments; none are safe to publish verbatim.
- Original production dates are unavailable for current Substack posts and must not be inferred.
- DNS changes remain high risk because mail uses existing GoDaddy-zone records.
- Netlify credits are finite; avoid incremental production pushes.
- Sound loudness and tone need a human listening check; automation verified behavior and errors, not taste.
