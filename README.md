# [BoomerRawlings.com](https://boomerrawlings.com/)

Official portfolio for Boomer Rawlings: psychology, local-first software, research systems, academic writing, visual work, and biographical material.

## Architecture

- Astro static site
- Markdown content in src/content/archive
- GitHub Actions build and GitHub Pages hosting
- GitHub main branch as the canonical source of truth
- boomerrawlings.com as the canonical production URL; www redirects to the apex domain

The unified content collection carries type, date, tags, status, featured state, and related-entry metadata. This keeps public content separate from templates and supports chronological access across content types.

## Local development

Requirements: Node.js 24 and npm.

    npm ci
    npm run dev

The development server is normally available at http://localhost:4321.

## Build and verification

    npm test

This creates the static dist directory, then verifies page metadata and internal links. To inspect the production build locally:

    npm run preview

## Deployment

Pushes and merges to `main` run `.github/workflows/deploy-pages.yml`. The workflow executes `npm test`, uploads the generated `dist` directory, and deploys it to GitHub Pages. `public/CNAME` preserves the custom domain in each build.

- Source: https://github.com/BoomerRawlings/boomerrawlings.com
- Production: https://boomerrawlings.com

No secrets are required to build the public site. Account credentials and private source material must never enter this repository.

To roll back a release, revert the responsible commit on `main` and push. Keep GitHub as the lasting source of production.

## DNS

GoDaddy remains the authoritative DNS provider. The web records point to GitHub Pages, while `public/CNAME` declares the custom domain in the built site.

Do not replace the GoDaddy nameservers or remove existing MX, SPF, DMARC, Microsoft verification, autodiscover, email, or SIP records. Inventory DNS before any future change.

## Content

Create Markdown or MDX entries under src/content/archive. Frontmatter is validated by src/content.config.ts. Draft entries are excluded from public routes.
