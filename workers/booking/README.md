# 0311 managed TSS sessions

Worker route: `https://boomerrawlings.com/0311/api/*`. Static frontend remains on its existing host. This service owns one separate browser per visitor; it cannot inherit a Chrome or in-app-browser login.

Current configuration enables household booking (`PROBE_ONLY=false`). Hosted UCSD/Duo authentication, loaded PHIL010 and ECON100A package details, same-session CSRF availability, and sign-out/browser closure were verified on2026-11-10. Visitor isolation and expiry have automated coverage; earlier live API isolation checks passed. The first human rebooking attempt failed: the loading indicator vanished without confirmed enrollment. No agent enrollment/drop actions were performed. Successful enrollment remains unverified.

Latest2026-11-11 hosted AD/Duo login succeeded. Nine authenticated package inspections completed; availability/eligibility restrictions stopped their original payload comparisons. ECON-120A and MGT-162 module/package identifiers were verified. All twenty exact-package comparisons subsequently passed on auth-proof-5: native standard path, available request token, equivalent payload and no differing fields. Direct submission is enabled only for those proven identities; see [verification evidence](../../docs/0311-direct-booking-proof.md). Actual successful enrollment remains a human validation step.

## Local checks

```sh
npm ci
npm test
npm run check
npx wrangler deploy --dry-run
```

`test/browser-guard.test.mjs` additionally runs real isolated headless Chromium when `BBB_TEST_CHROME` and `BBB_TEST_OPENSSL` point to local executables. It creates a temporary profile and certificate, maps the fixture hostname to loopback, and verifies popup, form-target, iframe, worker and modifying-fetch attempts never reach the fixture server. Without those variables the single test is explicitly skipped. No UCSD account or production endpoint is used.

`test/browser-sso-guard.test.mjs` uses the same variables and a local rejecting proxy. Four fresh contexts compare guarded and baseline synthetic SSO: cookie rotations, 302/303/307 redirects, gzip documents, CSRF fields, cross-site callbacks and SAML auto-submission. All transport observations match. This does not establish UCSD account mapping or explain its observed post-Duo Java exception.

The package pins `@cloudflare/puppeteer` and Wrangler. Cloudflare authorization and an account with Browser Run support are deployment prerequisites. No account credentials belong in this directory. On Windows ARM, Wrangler's optional x64 workerd executable may need an explicit local installation; do not commit machine-specific package changes.

## Probe operation

For future read-only investigations, configure `PROBE_ONLY=true`, `MAX_BROWSER_SESSIONS=1` and a bounded probe budget before deployment. `GET /health` creates no object/browser. Open `/0311/api/test` on the real website origin to issue the protected visitor cookie, sign in through Live View, check a known course and sign out. The read-only test page is available in either mode; it never provides a Book or Drop control. After Sign in, it automatically resolves the requested catalog identifiers and compares all configured package payloads once authentication succeeds, including while the login tab is visible. Comparison alone may inspect ineligible/already-booked courses; fixed notes and bookingEligible distinguish restrictions from payload equivalence. Actual Book retains eligibility guards. Results remain visible after session expiry. Its countdown shows the absolute session deadline. `inspect-direct` reads course data without navigating; `verify-direct` loads the native page only for a payload comparison and returns booleans/field names, never the payload.

Probe limits: one concurrent browser, absolute 15-minute lifetime, 150 reserved browser minutes per UTC month. The configured budget was raised from 90 to 150 for four additional 15-minute login trials; existing reservations are not reset. Probe mode enforces the one-browser/150-minute ceilings even if larger values are configured. Lower configured budgets remain effective; an omitted monthly setting defaults to 90. Each launch reserves its entire window; usage is never refunded, including early sign-out or a failed launch after reservation. `MONTHLY_BROWSER_MINUTES=0` stops allocation; negative or nonfinite values cannot enable usage. The cap covers this application, **not account-wide Cloudflare usage**. Browser/controller loss closes the session; an object restart destroys its previous browser instead of reconnecting without interception.

The checked-in household production configuration is:

| Variable | Production value | Enforced ceiling |
| --- | --- | --- |
| `PROBE_ONLY` | `false` | Only this exact string enables production behavior |
| `DIRECT_BOOKING_ENABLED` | `true` | Direct submission requires this exact string `true` plus production mode |
| `MAX_BROWSER_SESSIONS` | `8` | Eight simultaneous browsers |
| `MAX_SESSION_MINUTES` | `15` | 15 minutes from launch, including sign-in |
| `MONTHLY_BROWSER_MINUTES` | `600` | 600 reserved browser minutes per UTC month |

The direct-submission gate is enabled for the twenty individually verified routes only. A600-minute allowance permits40 full15-minute browser launches per month, about five per roommate. This is a shared limit, not a per-person allocation; multiple bookings can use one session. Reopening Live View for the same session does not reserve another window. Previous probe reservations remain counted in the same UTC month. The ceiling limits reserved application browser time, not dollar charges or other Cloudflare services. Larger configured budgets are clamped to600 in production and150 in probe mode; lower configured budgets remain effective.

Sign-out, expiry and disconnect cleanup close the provider browser. Cleanup must verify provider closure before releasing its concurrency lease. The provider idle timeout matches the absolute session window (15 minutes), so hiding the launcher during human sign-in does not impose a separate one-minute cutoff. Puppeteer's public connection options enforce a20-second CDP timeout; renderer readiness is checked before each Live View handoff. Live View grants last60 seconds to start connecting; an already-connected viewer can remain until browser closure. The signed URL is a bearer credential: never copy it into logs, issues, telemetry, screenshots of address bars or project state. Recording is disabled.

The authentication allowlist covers the observed TSS SAML handoffs, the verified `a5.ucsd.edu/tritON/profile/SAML2/Redirect/SSO` form with an execution parameter, and `/prompt/` or `/frame/` POSTs on the verified UCSD Duo tenant. Authentication bodies are bounded and never logged. Other write destinations fail closed. Owned-session diagnostics expose method/hostname/path and form-action locations, without query strings, form values, bodies, headers, credentials, tokens or student records. Provider failures use fixed classifications; temporary diagnostic logging has been removed.

The observed final authentication POST to exact `https://tss.ucsd.edu/fiori` is permitted only for a document form containing one `SAMLResponse` and optional single `RelayState`, within the existing SAML body limit, without query or fragment. SAP documents authentication POSTs to the protected resource in [Protecting Web Applications with SAML](https://help.sap.com/docs/SAP_NETWEAVER_AS_ABAP_FOR_SOH_740/f118a8960caf41808bd374e28a834f58/4ab5ef3222526d6de10000000a42189c.html). This exception does not authorize OData actions or arbitrary application forms.

Cloudflare defers active Durable Object code updates for up to five minutes by default. For a probe correction, use `wrangler deploy --durable-objects-code-update-mode immediate` and verify the build marker in the existing session response. Immediate updates interrupt existing managed sessions. Provider session records can remain after closure: use a matching session ID and positive finite `endTime`, or verified absence, to recognize closure. A `connectionEndTime` alone is not browser closure.

## API contract

All paths below are relative to `/0311/api`. Responses are non-cacheable. Mutations require the exact configured Origin, the visitor cookie, JSON, an `X-BBB-CSRF` header and a fresh UUIDv4 `requestId`. A supplied `route` must exactly match one of the twenty server-owned entries in `src/routes.mjs`; arbitrary destinations are rejected. The eleven ECON-120A/MGT-162 additions were verified by authenticated, read-only Schedule of Classes queries on 2026-11-11; adding routes does not enable direct submission.

| Method/path | Purpose |
| --- | --- |
| `GET /health` | `{ok, probeOnly}` without allocating a browser |
| `GET /status` | Issue/read visitor session; `{state, csrf, probeOnly, expiresAt?, booking?}` |
| `GET /test` | Same-origin read-only login/direct comparison page |
| `POST /login` | Launch owned browser or open existing one; return transient `loginUrl`; optional bounded viewport applies only to a new blank page |
| `POST /resolve-courses` | Fixed read-only module/package verification for ECON-120A and MGT-162 |
| `POST /logout` | Close browser and clear visitor cookie |
| `POST /inspect` | Read known course; return `loaded`, `ready`, `csrfReady`, `courseCode` |
| `POST /inspect-direct` | Authoritative read-only course data without navigation |
| `POST /verify-direct` | Read-only native/direct payload comparison; field names and booleans only |
| `POST /book` | Rejected in probe; production requires fresh authentication and explicit route/request ID |
| `POST /confirm`, `/cancel` | Explicit resolution of the current direct warning, with a new request ID plus matching bookingRequestId/confirmationId |

Session states: `signed_out`, `signing_in`, `ready`, `expired`, `busy`, `error`. A ready session requires the authenticated SAP shell plus a successful same-session CSRF-fetch GET, checked at most 30 seconds apart and freshly before Book. CSRF values are never returned to the website or persisted. Request interception handles authentication traffic transiently; it does not store credential values.

Authentication checks distinguish authenticated, unauthenticated and temporarily unavailable. Failed reads revoke booking readiness while preserving the guarded browser until explicit sign-out, disconnect or the original deadline. A mutation revision prevents old polls/timeouts from replacing newer proofs; main-frame navigation invalidates the browser proof cache. A pre-dispatch `503 authentication_unavailable` means no booking action started. It is never used for uncertain submission results. The website does not automatically retry Book. Fixed page/issue classifications distinguish UCSD's observed login exception, Duo, login choice and TSS loading without exposing document text or credentials.

Booking status is nested as `booking: {requestId, stage}` in both Book and status responses. Stages: `loading`, `checking`, `submitting`, `review`, `submitted`, `stopped`, `error`. `submitted` means Save returned without an observed error. Direct mode then performs one bounded exact header/event read and returns outcome booked, waitlisted, or unconfirmed. Missing/contradictory data or timeout stays unconfirmed; it never resubmits. A late Save warning remains ephemeral plain text. Native mode still requires checking TSS. `review` requires the user to act on the official warning through a fresh `/login` Live View; reconnecting never starts or repeats Book. Direct-mode warnings instead return ephemeral plain text and a one-use confirmation ID; the user must explicitly confirm or cancel on the website. Confirmation re-reads and compares the payload before SaveChanges. Request IDs deduplicate calls; unknown/interrupted outcomes must not be retried automatically.

## Direct-service validation gate

`DIRECT_BOOKING_ENABLED=true` uses the direct path only for exact entries in `VERIFIED_STANDARD_ROUTES`. The twenty Winter 2027 routes passed live native payload/path comparisons on2026-11-11; see the linked verification evidence. New catalog entries remain untrusted until independently compared. Read-only comparison cannot grant runtime write permission. Settings retain native last-value-wins and null/non-X semantics. Direct Book uses authoritative reads → CheckRegistration → SaveChanges without booking-page navigation. Fresh booking ModregId remains the all-zero GUID exactly as in native source. Existing booking flags still block duplicate registration.

## Enforcement and remaining gates

- Opaque `__Host-` cookie: Secure, HttpOnly, SameSite=Strict. Durable Objects isolate session ownership; roommate cards are course organization, not account identity.
- One mutation at a time. Login during official review preserves the same pending request. Server route/module/package/term checks and the native adapter guard selected event data; the direct adapter reconstructs the source-matched enrollment POST using authoritative current context, with no stored credentials.
- Probe network guard allows bodyless read batches only. Production write permission exists only during the explicit matching job: exactly one native CheckRegistration followed by one unchanged SaveChanges, direct or a single-operation changeset. Drop and unrelated writes remain blocked.
- Each HTML document receives an enforced CSP blocking new windows, frames and workers. Explicit response-body fulfillment is required by the tested Chromium behavior. Original documents are held only transiently and never logged. New-target closure is defense in depth, not the primary popup barrier.
- Frames/workers remain disabled until real SSO proves a need and equivalent request enforcement is added. This may affect Duo. Provider domain guardrails alone cannot distinguish GET from POST; Browser Run outbound Workers currently cover HTTP, not TSS HTTPS.
- This is an application guard for the controlled Live View, not an immutable security boundary against its owner gaining separate CDP control. Actual provider behavior and SSO remain live validation gates.
- Before setting `PROBE_ONLY=false`: prove hosted UCSD/Duo login, loaded known-course detail and CSRF availability, separate visitors, expiry and verified logout. Enrollment remains unverified until the user chooses a real booking. Do not press Book or Drop merely to test login.

References: [Live View](https://developers.cloudflare.com/browser-run/features/live-view/), [binding API](https://developers.cloudflare.com/browser-run/reference/browser-binding-api/), [session reuse](https://developers.cloudflare.com/browser-run/features/reuse-sessions/), [outbound Workers limits](https://developers.cloudflare.com/browser-run/features/outbound-workers/), [pricing](https://developers.cloudflare.com/browser-run/pricing/), [CDP Fetch](https://chromedevtools.github.io/devtools-protocol/tot/Fetch/).
