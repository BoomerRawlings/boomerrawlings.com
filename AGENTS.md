# Agent guide

## Purpose

BoomerRawlings.com is a durable public archive of selected software, research, writing, photography, and biographical material. It is not only a software portfolio.

## Source of truth and deployment

- GitHub is canonical.
- main is the production branch.
- Netlify builds main with npm run build and publishes dist.
- Do not deploy an untracked local copy as the lasting production source.

## Structure

- src/content/archive: public Markdown or MDX entries
- src/content.config.ts: shared archive metadata schema
- src/pages: routes and indexes
- src/components: shared presentation
- src/layouts: document shell and metadata
- src/styles: global presentation
- public: static public assets only
- netlify.toml: build, redirect, and response-header policy

Keep content out of UI components. Use the unified archive collection and its type field for work, research, writing, and photography. Preserve support for chronological cross-type access at /archive/.

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
