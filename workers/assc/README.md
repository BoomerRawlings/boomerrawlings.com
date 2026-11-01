# AntiSnarkerSnarkerClub

An owner-curated research room at `/ASSC`, with a sparse riddle entrance, editorial brief, profiles, evidence-linked relationship map, paired event/evidence timeline, and indexed transcript reader.

## Local use

Node 24 is required. Install with `npm ci`, run `node scripts/configure-local.mjs` to enter the chosen passcode privately, then `npm start`. The preview listens on `127.0.0.1:4317` only. Private research belongs in `.private/corpus.json` and `.private/transcripts.json`; no sample dossiers are checked in. See `docs/transcripts.md` for importing authorized source files without altering originals.

## Checks

`npm test` runs authentication, ingestion, and real workerd/SQLite tests. `npm run check` validates JavaScript syntax and document privacy metadata. `npm run build` packages the owner’s private corpus and an explicit asset allowlist for the protected Worker. The private build is deliberately not a GitHub Pages artifact.

## Deployment

The public portfolio remains on GitHub Pages. A separate Cloudflare Worker intercepts exactly `/ASSC` and `/ASSC/*`. All application content, portraits, originals and indexes require a server-validated session. No nav, sitemap, feed or static portfolio route is added. `workers.dev` and version previews are disabled. See `docs/deployment.md` for the release procedure and security boundary.

The requested riddle answer is a shared passcode, not proof of the owner's identity. The implementation limits guesses, uses opaque HttpOnly sessions, revokes sessions on logout, prevents caching and fails closed. Anyone who knows the passcode can enter. Private files, auth configuration and generated deployment assets must never be committed.

## Editorial contract

Corpus content is separate from the interface. Each edge explains its relationship and points to evidence; observed, reported and hypothetical links have distinct styles. Node size counts directly linked records, not influence. Portraits retain provenance and honest placeholders. Transcripts preserve supplied wording and timestamps, distinguish reading text from originals and annotations, and leave uncertain speakers unattributed. The Brief supports data-driven reading paths from overview to exact passage.

## Motion

The entrance uses original flowing typography. Its wordmark is revealed only after authentication, then dissolves directly into the workspace. Reduced motion keeps the same state changes without the animation. The timeline adapts the paired explanation/artifact behavior from the user's Workflow Display skill.
