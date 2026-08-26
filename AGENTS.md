# Agent guide

## Purpose

BoomerRawlings.com is a developing public portfolio of selected software, research, writing, photography, and biographical material. It is not only a software portfolio.

## Source of truth and deployment

- GitHub is canonical.
- main is the production branch.
- GitHub Actions runs npm test and publishes dist to GitHub Pages.
- Do not deploy an untracked local copy as the lasting production source.
- Batch production changes into one verified push. Use local tests while iterating.

## Structure

- src/content/archive: public Markdown or MDX entries
- src/content.config.ts: shared archive metadata schema
- src/pages: routes and indexes
- src/components: shared presentation
- src/layouts: document shell and metadata
- src/styles: global presentation
- public: static public assets only
- .github/workflows/deploy-pages.yml: verified production build and deployment
- public/CNAME: custom-domain marker; GitHub Pages settings remain authoritative

Keep content out of UI components. Use the unified archive collection and its type field for work, research, writing, and photography. Preserve chronological cross-type access at /all/ and the exact legacy /archive/ redirect.

## Commands

    npm ci
    npm run dev
    npm test
    npm run preview

## Non-negotiable rules

- Private archive → deliberate human curation → public website.
- Finding material in a personal archive is never permission to publish it.
- Never commit credentials, tokens, environment secrets, personal datasets, private archives, or unreviewed media.
- Never invent project capabilities, claims, dates, statistics, or accomplishments. Use conservative placeholders until verified.
- Preserve semantic HTML, accessibility, fast static output, and minimal client JavaScript.
- Prefer Markdown content and boring platform features over a CMS or custom runtime.
- Justify major framework, hosting, content-model, or deployment changes.
- Treat DNS as high risk: inventory all records, especially MX and email-related TXT records, before any change. Never replace nameservers or remove records casually.
