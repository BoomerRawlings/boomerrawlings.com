# 0311 managed TSS sessions

Worker route: `https://boomerrawlings.com/0311/api/*`. Static frontend remains on its existing host. This service owns one separate browser per visitor; it cannot inherit a Chrome or in-app-browser login.

Current configuration is **a read-only hosted login probe**. The production Book path is implemented behind `PROBE_ONLY=false`, but real UCSD login, provider compatibility and enrollment have not been validated. Do not advertise a working enrollment service based on mocked tests.

## Local checks

```sh
npm ci
npm test
npm run check
npx wrangler deploy --dry-run
```

`test/browser-guard.test.mjs` additionally runs real isolated headless Chromium when `BBB_TEST_CHROME` and `BBB_TEST_OPENSSL` point to local executables. It creates a temporary profile and certificate, maps the fixture hostname to loopback, and verifies popup, form-target, iframe, worker and modifying-fetch attempts never reach the fixture server. Without those variables the single test is explicitly skipped. No UCSD account or production endpoint is used.

The package pins `@cloudflare/puppeteer` and Wrangler. Cloudflare authorization and an account with Browser Run support are deployment prerequisites. No account credentials belong in this directory. On Windows ARM, Wrangler's optional x64 workerd executable may need an explicit local installation; do not commit machine-specific package changes.

## Probe operation

Deploy the unchanged `PROBE_ONLY=true` configuration only after local checks and account usage review. `GET /health` creates no object/browser. Open `/0311/api/test` on the real website origin to issue the protected visitor cookie, sign in through Live View, check a known course and sign out. This probe page is unavailable when `PROBE_ONLY=false`.

Initial limits: one concurrent browser, absolute 15-minute lifetime, 90 reserved browser minutes per UTC month. Each launch reserves its entire window; uncertain usage is never refunded. `MONTHLY_BROWSER_MINUTES=0` stops allocation. The cap covers this application, **not account-wide Cloudflare usage**. Production concurrency can be configured up to eight, but the same usage cap remains. Browser/controller loss closes the session; an object restart destroys its previous browser instead of reconnecting without interception.

Sign-out, expiry and disconnect cleanup close the provider browser. Cleanup must verify provider closure before releasing its concurrency lease. Live View grants last 60 seconds; an already-connected viewer can remain until browser closure. The signed URL is a bearer credential: never copy it into logs, issues, telemetry, screenshots of address bars or project state. Recording is disabled.

The authentication allowlist covers the observed TSS SAML handoffs, the verified `a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO` form with an execution parameter, and `/prompt/` or `/frame/` POSTs on the verified UCSD Duo tenant. Authentication bodies are bounded and never logged. Other write destinations fail closed. Owned-session diagnostics expose method/hostname/path and form-action locations, without query strings, form values, bodies, headers, credentials, tokens or student records. Provider failures use fixed classifications; temporary diagnostic logging has been removed.

Cloudflare defers active Durable Object code updates for up to five minutes by default. For a probe correction, use `wrangler deploy --durable-objects-code-update-mode immediate` and verify the build marker in the existing session response. Immediate updates interrupt existing managed sessions. Provider session records can remain after closure: use a matching session ID and positive finite `endTime`, or verified absence, to recognize closure. A `connectionEndTime` alone is not browser closure.

## API contract

All paths below are relative to `/0311/api`. Responses are non-cacheable. Mutations require the exact configured Origin, the visitor cookie, JSON, an `X-BBB-CSRF` header and a fresh UUIDv4 `requestId`. A supplied `route` must exactly match one of the nine server-owned entries in `src/routes.mjs`; arbitrary destinations are rejected.

| Method/path | Purpose |
| --- | --- |
| `GET /health` | `{ok, probeOnly}` without allocating a browser |
| `GET /status` | Issue/read visitor session; `{state, csrf, probeOnly, expiresAt?, booking?}` |
| `GET /test` | Same-origin read-only probe page, probe configuration only |
| `POST /login` | Launch owned browser or open existing one; return transient `loginUrl` |
| `POST /logout` | Close browser and clear visitor cookie |
| `POST /inspect` | Read known course; return `loaded`, `ready`, `csrfReady`, `courseCode` |
| `POST /book` | Rejected in probe; production requires fresh authentication and explicit route/request ID |

Session states: `signed_out`, `signing_in`, `ready`, `expired`, `busy`, `error`. A ready session requires the authenticated SAP shell plus a successful same-session CSRF-fetch GET, checked at most 30 seconds apart and freshly before Book. CSRF values are never returned to the website or persisted. Request interception handles authentication traffic transiently; it does not store credential values.

Booking status is nested as `booking: {requestId, stage}` in both Book and status responses. Stages: `loading`, `checking`, `submitting`, `review`, `submitted`, `stopped`, `error`. `submitted` means the native save returned without an observed error; verify the outcome in TSS. `review` requires the user to act on the official warning through a fresh `/login` Live View; reconnecting never starts or repeats Book. Request IDs deduplicate calls; unknown/interrupted outcomes must not be retried automatically.

## Enforcement and remaining gates

- Opaque `__Host-` cookie: Secure, HttpOnly, SameSite=Strict. Durable Objects isolate session ownership; roommate cards are course organization, not account identity.
- One mutation at a time. Login during official review preserves the same pending request. Server route/module/package/term checks and the native adapter guard selected event data; no reconstructed enrollment POST or stored credentials.
- Probe network guard allows bodyless read batches only. Production write permission exists only during the explicit matching job: exactly one native CheckRegistration followed by one unchanged SaveChanges, direct or a single-operation changeset. Drop and unrelated writes remain blocked.
- Each HTML document receives an enforced CSP blocking new windows, frames and workers. Explicit response-body fulfillment is required by the tested Chromium behavior. Original documents are held only transiently and never logged. New-target closure is defense in depth, not the primary popup barrier.
- Frames/workers remain disabled until real SSO proves a need and equivalent request enforcement is added. This may affect Duo. Provider domain guardrails alone cannot distinguish GET from POST; Browser Run outbound Workers currently cover HTTP, not TSS HTTPS.
- This is an application guard for the controlled Live View, not an immutable security boundary against its owner gaining separate CDP control. Actual provider behavior and SSO remain live validation gates.
- Before setting `PROBE_ONLY=false`: prove hosted UCSD/Duo login, loaded known-course detail and CSRF availability, separate visitors, expiry and verified logout. Enrollment remains unverified until the user chooses a real booking. Do not press Book or Drop merely to test login.

References: [Live View](https://developers.cloudflare.com/browser-run/features/live-view/), [binding API](https://developers.cloudflare.com/browser-run/reference/browser-binding-api/), [session reuse](https://developers.cloudflare.com/browser-run/features/reuse-sessions/), [outbound Workers limits](https://developers.cloudflare.com/browser-run/features/outbound-workers/), [pricing](https://developers.cloudflare.com/browser-run/pricing/), [CDP Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/).
