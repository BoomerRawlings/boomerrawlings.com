# BoomerRawlings.com

Public archive for Boomer Rawlings: software and systems work, research, writing, photography, and biographical material.

## Architecture

- Astro static site
- Markdown content in src/content/archive
- Netlify hosting and deploy previews
- GitHub main branch as the canonical source of truth
- boomerrawlings.com as the canonical production URL; www redirects to the apex domain

The unified archive collection carries type, date, tags, status, featured state, and related-entry metadata. This keeps public content separate from templates and supports a future chronological archive across content types.

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

Netlify reads netlify.toml:

- build command: npm run build
- publish directory: dist
- production branch: main

Pushes and merges to main trigger production builds through the GitHub-connected Netlify project. Pull requests receive deploy previews when enabled in Netlify.

No secrets are required to build the public site. Account credentials and private source material must never enter this repository.

## Content

Create Markdown or MDX entries under src/content/archive. Frontmatter is validated by src/content.config.ts. Draft entries are excluded from public routes.

Private archive → deliberate human curation → public website.
