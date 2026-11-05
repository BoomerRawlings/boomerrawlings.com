# Observatory

A separate password-protected directory at `/observatory/`. Cloudflare intercepts
only that path and its descendants; the portfolio remains on GitHub Pages.

The public repository contains a generic entrance and interface. The real directory
is runtime-only configuration. Existing destinations retain their own access rules;
this application does not issue credentials or cookies for them.

## Local preview

Node.js 24 or later:

```text
npm ci
npm run configure
npm start
```

`configure` reads the riddle answer with hidden input and saves only a salted verifier
to ignored `.private/auth.json`. The answer is one word of 3-40 letters. Version 2
normalization is explicit: Unicode NFKC, surrounding-whitespace trimming, then
locale-independent lowercase. Fullwidth Latin letters are accepted as their ASCII
equivalents. Internal spaces, punctuation, digits, and accented/non-Latin letters
are rejected; they are never silently deleted. The answer itself is not saved by
the configuration helper and must never be placed in public source or screenshots.

Existing version 1 verifiers still use exact, case-sensitive passwords, including
whitespace. `npm run configure -- --exact` can create that legacy format when needed.
Changing the verifier creates a new session scope and invalidates all earlier hub
sessions; it does not affect another destination's credentials or sessions.

Put the approved directory in ignored `.private/catalog.json`. The object has a
`destinations` array of 1–12 records. Each record contains `id`, `title`, `kicker`,
`description`, `href`, and `accent`. IDs are unique lowercase slugs. Links must be
same-origin absolute paths with optional fragments; accents are six-digit hex colors.
Do not commit the real catalog or put it in `public`, `src`, client code, or test fixtures.

The preview binds only `127.0.0.1:8788`. Missing or invalid configuration leaves
access closed. Its in-memory sessions and throttles reset when the process stops.
Only production uses the persistent Durable Object store.

## Visual and entrance contract

The interface follows the actual homepage's palette, typography, and editorial
rules: navy, yellow, turquoise, Source Sans 3, and Teko. Fonts are served locally
with their licenses. The shared theme contains no destination data.

An optional catalog `symbol` selects one of six generic animated illustrations:
`dialogue`, `futures`, `folio`, `atlas`, `vessel`, or `neuron`. These illustrate
conversation, alternatives, a book, a map, a vessel, and a signal respectively;
they are not previews or measurements of private records. The real mapping stays
in the protected catalog. Symbol modules and styles require authentication.
Missing symbols use a neutral directory illustration. Each illustration has an
accessible description, and selection replaces the previous scene.

The homepage doorway uses a 640 ms departure transition. Only a short-lived
`observatory:arrival` timestamp crosses pages through session storage; it never
stores an answer, a destination, or authenticated content and never prefetches
private resources. A parser-blocking external `arrival.js` runs before the gate's
styles and fonts, consumes the marker once, and accepts only timestamps from the
past five seconds. The arrival overlay opens over 480 ms, with a 700 ms release
fallback. Direct visits and blocked storage still open the ordinary gate.

Reduced motion preserves navigation without the departure or arrival effects and
renders static illustrations. The index also offers a motion pause control.
Modified clicks retain native new-tab behavior; Escape, hidden tabs, and a changed
motion preference can cancel a pending departure. History restoration removes
unfinished overlays and revalidates the session before displaying the directory.
Late requests cannot restore content after logout or a newer revalidation.

## Verification

```text
npm test
npm run check
npm run build
npm run types
```

Tests use fictional directory data. They exercise both the local handler and actual
Worker runtime: incorrect/correct passwords, direct assets, forged/duplicate cookies,
rotation, logout, expiry, password changes, cross-site writes, host restrictions,
input bounds, deliberate riddle normalization, legacy compatibility, and concurrent
persistent rate limits. `check` verifies JavaScript
syntax and HTML privacy metadata. `types` generates Cloudflare's binding declarations.

`build` copies an explicit allowlist of generic interface files and local fonts into
ignored `.build/assets`. It never packages private configuration and can run in
public CI without secrets. Only the gate, arrival bootstrap, shared theme, and fonts are public;
application and symbol modules/styles remain behind the authenticated handler.

## Production configuration

This Worker is deployed separately from the static portfolio. It must be deployed
and verified before publishing the homepage doorway. It requires two Worker secrets:

| Secret | Value |
| --- | --- |
| `OBSERVATORY_AUTH_CONFIG` | The JSON verifier generated by `configure`. |
| `OBSERVATORY_CATALOG` | The approved catalog JSON. |

Supply values through hidden stdin or the provider's secret interface, never command
arguments, logs, public workflow variables, or tracked files. `wrangler secret bulk`
can receive a JSON map through stdin. Obtain publication authorization before deploying.
Deployment of the Worker does not require changing DNS, nameservers, or other routes.
Pass `--config wrangler.jsonc` explicitly to every Wrangler command from this directory
so an unrelated ancestor project's generated configuration cannot be selected.
`npx wrangler deploy --dry-run --config wrangler.jsonc --outdir .build/dry-run` validates
the production bundle without deployment.

`wrangler.jsonc` disables workers.dev and preview URLs and runs the Worker before all
assets. The code checks the canonical origin, maps an explicit file allowlist, and
never forwards arbitrary paths to the asset binding. Missing secrets or storage
failures fail closed. Do not publish `.build/assets` to GitHub Pages or another static host.

Authentication uses a salted PBKDF2-SHA-256 verifier and cryptographically random
256-bit opaque tokens. Only token hashes enter storage. The cookie is Secure,
HttpOnly, SameSite=Strict, and scoped to `/observatory/`. Sessions expire after eight
hours and are revoked server-side on logout. Changing the verifier selects a new
session scope, invalidating existing tokens. The persistent limiter accepts at most
five attempts per address and 30 total in a rolling fifteen-minute window; no raw
addresses are stored. Every response is no-store and noindex with a restrictive CSP.

## Client contract

- `GET /observatory/`: generic gate before authentication, application shell after.
- `POST /observatory/api/login`: JSON `{ "password": "…" }`, same-origin only;
  success returns `{ "ok": true, "redirect": "/observatory/" }` and sets the cookie.
- `GET /observatory/api/catalog`: approved directory, authenticated only.
- `GET /observatory/api/session`: authenticated session check.
- `POST /observatory/api/logout`: same-origin only; revokes token and clears cookie.

The client must discard protected content on logout and revalidate a restored browser
history page. Never cache the directory in local storage or a service worker.
