# Project state

- Mode: new project
- Objective: make GitHub main the source for an automatically deployed Netlify site at boomerrawlings.com
- Status: GitHub and Netlify CI/CD connected; automatic deploy verification and domain connection pending

## Completed

- Confirmed the starting repository was empty.
- Confirmed no BoomerRawlings/boomerrawlings.com GitHub repository exists.
- Confirmed the Netlify account has no related project.
- Inventoried public DNS and current redirect before changes.
- Built a static Astro site with a unified Markdown archive collection, initial homepage, section placeholders, archive index, project pages, metadata, sitemap, security headers, and agent/deployment documentation.
- Verified npm installation, production build, 10 generated pages, internal links, metadata, desktop layout, and 390 px mobile layout.
- Created and pushed the public GitHub repository on main.
- Created the Netlify project boomerrawlings-com and verified its first Netlify-hosted build at boomerrawlings-com.netlify.app.
- Connected Netlify to the GitHub repository with main, npm run build, and dist recorded as production settings.

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

1. Push this checkpoint and verify that GitHub triggers a new production deployment.
2. Attach both custom hostnames, change only the required GoDaddy web records, and verify DNS, HTTPS, and redirects.
3. Run final remote desktop/mobile, headers, links, and secret checks.

## Risks

- DNS changes can interrupt the current redirect. Do not make them until the Netlify URL is proven.
- Nameserver replacement risks mail disruption and is out of scope.
