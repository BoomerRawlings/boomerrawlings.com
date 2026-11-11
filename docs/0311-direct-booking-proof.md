# Direct booking verification — 2026-11-11

Authenticated, read-only comparisons completed through the hosted `auth-proof-5` service. Each package below loaded its native TSS booking page and compared the native `_prepareSaveData(false)` payload with the direct adapter's independently derived payload. All twenty returned `csrfReady=true`, `equivalent=true`, `nativeBookingPath=standard`, and no differing fields.

Academic year `2026`, session `3` (Winter 2027). No enrollment or drop request was sent. This proves payload and native path equivalence; it does not prove a completed enrollment or waive current eligibility, availability, duplicate-registration, or confirmation checks.

| Course | Module | Individually compared packages |
| --- | --- | --- |
| PHIL-010 | 13043 | 166528 |
| PSYC-106 | 5379 | 164082 |
| PSYC-110 | 5417 | 164087 |
| PSYC-111A | 5441 | 164089 |
| PSYC-125 | 5647 | 164113 |
| ECON-100A | 14499 | 167237, 167238, 167239, 167240 |
| ECON-120A | 14794 | 167365, 167366, 167367, 167368, 167369, 167370, 167371, 167372 |
| MGT-162 | 6359 | 164325, 164326, 164327 |

`workers/booking/src/routes.mjs` stores these proof identities separately from the catalog allowlist. Adding another catalog route must not implicitly trust it. Each new package needs the same live comparison before adding its exact module/package/year/session to the trusted set.

The native handlers use their standard submission branch despite `ENABLE_TOP_MODULE_BOOKING=X` in the backing data. The trusted-route flag bypasses only that mismatched data flag. User identity, payload structure, current header eligibility, existing registration, native Book availability, and server `CheckRegistration` remain required. Enrollment warnings require an explicit response; Save is never retried automatically.

Actual direct Book performs authoritative reads, `CheckRegistration`, and one `SaveChanges` call without navigating through the catalog or native booking page. After Save, fresh exact header/event reads distinguish booked, waitlisted, and submitted but unconfirmed. The native page navigation above belongs only to this one-time read-only comparison.
