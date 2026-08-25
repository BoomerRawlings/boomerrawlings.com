# Project state

- Mode: continuation
- Objective: migrate the verified static portfolio from credit-limited Netlify to GitHub Pages without disrupting GoDaddy-hosted email.
- Status: GitHub Pages is deployed and verified at its origin; GoDaddy requires a fresh SMS identity check before the web-only DNS cutover can be saved.

## Completed

- GitHub `main` contains the complete portfolio release at `c091018`; Netlify skipped it because the account credit allowance is exhausted.
- Added a pinned GitHub Pages Actions workflow, apex-domain marker, four static legacy redirects, and portable CSP/referrer metadata.
- Enabled Pages in workflow mode, registered `boomerrawlings.com`, and deployed commit `0e0c7bb`; the GitHub origin returns the new homepage and Continuity Desk page with HTTP 200.
- Inventoried all 20 GoDaddy DNS records across both dashboard pages and confirmed the public authoritative zone.
- `npm test` verifies 15 content pages and four redirects, including metadata, links, assets, Pip behavior, and project-specific evidence.
- `git diff --check` passes.

## Decisions

- GitHub remains canonical; GitHub Pages will publish `main` with one verified workflow.
- Configure the Pages custom domain before changing DNS.
- Change only web routing: replace apex `A @ -> 75.2.60.5` with GitHub's four apex addresses, and change `www` from Netlify to `BoomerRawlings.github.io`.
- Keep GoDaddy nameservers, all MX records, SPF, DMARC, Microsoft verification, autodiscover, SIP, and every other service record unchanged.
- Keep the existing Netlify site as a rollback until apex, `www`, HTTPS, key routes, and email DNS are verified; then disable Netlify continuous deployment.
- GitHub Pages cannot reproduce Netlify's response headers or true server-side 301s. Meta CSP/referrer and static redirect pages provide portable partial equivalents.

## Next

1. Enter the fresh GoDaddy SMS code; the first apex value is staged but not saved.
2. Cut over the two GoDaddy web record sets only; verify authoritative/public DNS and email records.
3. Enforce HTTPS, test live routes/assets/redirects, and disable Netlify automatic builds.

## Risks

- GitHub Pages has soft service limits, but the roughly 4 MB static portfolio is far below practical thresholds.
- DNS and certificate propagation may be asynchronous; do not remove the Netlify rollback before verification.
- 2026 award, degree, honors, one-year, and four-time recognition remain user-supplied facts.
