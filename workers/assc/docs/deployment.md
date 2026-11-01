# Private ASSC deployment

AntiSnarkerSnarkerClub runs as an isolated Cloudflare Worker on `/ASSC` and `/ASSC/*`. The public portfolio stays on GitHub Pages. Existing repository configuration already proves a same-origin Cloudflare route for a separate project; this app neither modifies nor shares that project's resources. No DNS change is assumed or authorized by this configuration.

Compatibility is pinned to `2026-10-30`, the newest date supported by the locally available workerd runtime; it rejected `2026-11-01`. This two-day difference is deliberate and must be revisited when upgrading the runtime.

## Authentication boundary

`run_worker_first: true` is mandatory. The Worker is invoked before every asset request. Only the sparse gate and its CSS/JS are served without a session. Corpus JSON, transcript indexes/documents/originals, portraits, application HTML, and application modules are available solely through the handler's explicit authenticated routes. Internal `/_protected/` paths are never forwarded from a client request. Unknown paths fail closed. No workers.dev or version-preview URLs are enabled.

The separate `ASSC_AUTH` SQLite Durable Object stores hashed session tokens and hashed client addresses. Sliding login windows permit five attempts per address and thirty globally per fifteen minutes. Session lifetime is eight hours; logout revokes the token persistently. At most one hundred sessions are retained. An alarm deletes expired state. The single room is the coordination unit; content requests do not stream through the object.

The requested short riddle answer is not strong owner identity. This is real server-side access control with throttling, but anyone who learns the answer can enter. Add an independent owner identity factor if protection against knowledgeable visitors is required.

## Private build

`npm run build` copies an explicit file allowlist into ignored `.build/assets`, plus an ignored checksum manifest. It excludes `auth.json`, source maps, development variables, and all arbitrary source files. The generated assets contain private research and must never be committed, attached to a public issue, placed in Pages `public/`, or published as a preview. Preserve private originals separately from corrected reading versions.

The data adapter currently loads JSON catalogs. For a very large transcript corpus, move the catalog/search index to private D1 and originals to private R2 while retaining the same authenticated routes; do not claim the JSON adapter is a production full-text database.

## Release procedure

1. Verify the active account controls `boomerrawlings.com`, inspect existing Worker routes, and confirm the two ASSC routes do not conflict. Preserve every unrelated route and DNS record.
2. Run application tests, Worker tests, asset packaging, generated binding types, and `wrangler deploy --dry-run`. Review the package allowlist and direct unauthenticated-asset tests.
3. Provision only `assc-private-room` and its `ASSC_AUTH` namespace. Set `AUTH_CONFIG` through the secure secret-input workflow. It is JSON containing a random salt and PBKDF2 verifier created by `createAuthConfig`; never put its value in arguments, public source, logs, or this document. The binding must be present before protected content is usable. Missing/malformed configuration rejects login.
4. Keep canonical source in the user's repository, with `.private`, `.build`, `.dev.vars*`, `.wrangler`, and credentials excluded. Deploy the reviewed source with private assets through the authenticated local workflow. Do not expose a separate preview.
5. Verify the deployed revision and exact route, wrong/correct answer, reload, logout/revoked cookie, rate limiting, all direct protected URLs, noindex/no-store headers, and absence from public navigation/sitemaps/feeds. Check the site and unrelated routes still work.

No deployment, account login, route change, secret upload, or DNS operation was performed by the adapter author. Account permissions, actual route state, and live verification remain release-owner tasks. If native approval blocks one of these operations, stop that operation and report its exact target and reason.

## Adapter verification

Ten actual workerd/SQLite tests pass, covering concurrent per-address limits, global limits/storage bounds, eight-hour session expiry/revocation/cap, malformed-key rejection, missing-secret asset denial, mandatory Worker-first/disabled-preview configuration, and authenticated asset/data/original routes with hostile requests. Tests run with Miniflare `5.20261023.1-beta` and required local loopback execution permission. An optional forced-eviction probe was not retained because Miniflare kept active proxy references; process-restart persistence is not claimed as tested.

`node --check` passes for the Worker and asset packager. Wrangler `4.154.0` accepts the configuration and completes `deploy --dry-run`; no remote upload/deployment occurs. The generated package and runtime binding declarations belong in ignored `.build/` only.

References consulted: [Worker-first asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [SQLite Durable Object storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [alarms](https://developers.cloudflare.com/durable-objects/api/alarms/), [Workers practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
