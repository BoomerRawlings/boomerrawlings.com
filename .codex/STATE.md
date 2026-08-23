# Project state

- Mode: new project
- Objective: make GitHub main the source for an automatically deployed Netlify site at boomerrawlings.com
- Status: local site built and verified; GitHub, Netlify, and domain connection pending

## Completed

- Confirmed the starting repository was empty.
- Confirmed no BoomerRawlings/boomerrawlings.com GitHub repository exists.
- Confirmed the Netlify account has no related project.
- Inventoried public DNS and current redirect before changes.
- Built a static Astro site with a unified Markdown archive collection, initial homepage, section placeholders, archive index, project pages, metadata, sitemap, security headers, and agent/deployment documentation.
- Verified npm installation, production build, 10 generated pages, internal links, metadata, desktop layout, and 390 px mobile layout.

## Decisions

- Astro static generation: content-oriented, minimal runtime, no shipped client JavaScript.
- One validated archive collection with a type field: simplest cross-type chronological model.
- Apex boomerrawlings.com is canonical; www will redirect to apex.
- Keep GoDaddy nameservers. Change only web A/CNAME records after Netlify is verified.

## Verified external state

- GitHub CLI is authenticated as BoomerRawlings.
- Netlify team slug is boomerrawlings; its sole existing project is unrelated.
- Apex currently redirects to continuitydesk.io/about through two GoDaddy-managed A records.
- Email depends on existing PPE Hosted MX, SPF, DMARC, Microsoft verification, Outlook/SecureServer, and SIP records. Preserve them.

## Next

1. Commit and push main to a new BoomerRawlings/boomerrawlings.com repository.
2. Create and connect a Netlify project; verify a Git-triggered production deployment.
3. Attach both custom hostnames, change only the required GoDaddy web records, and verify DNS, HTTPS, and redirects.
4. Run final remote desktop/mobile, headers, links, and secret checks.

## Risks

- DNS changes can interrupt the current redirect. Do not make them until the Netlify URL is proven.
- Nameserver replacement risks mail disruption and is out of scope.
