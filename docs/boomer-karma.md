# Boomer Karma

Unlisted report: https://boomerrawlings.com/BoomerKarma/

The shared source is `src/data/boomer-karma.json`. Score = `openingBalance` + every entry's `points`. Entries appear newest first; append new entries at the end of the array. The eleven user-supplied entries total 28, with no invented opening balance.

## Change the score

Use **Bureau access** at the bottom of the page to open GitHub's authenticated editor, or edit the JSON locally:

1. Append an entry with integer `points`, a short `note`, and a public-safe `detail`. Negative integers deduct points.
2. Set `updatedAt` to the report date (`YYYY-MM-DD`). Adjust `status` if desired.
3. Commit to `main` after checks. Existing GitHub Actions publishes the shared report; no browser-local score exists.

Credit Karma-inspired parody styling: green wordmark, white dashboard cards and three decorative score arcs. A nine-step mock application precedes the report: eligibility, bureau selection, 12-word statement, fine print, book puzzle, notarization, redundant declarations, review, and final permission. The final permission reveals one more checkbox. Completing the application emails every answer and checkbox state to the owner's verified inbox through FormSubmit. A report-issued flag is saved in sessionStorage only after successful submission to keep refreshes usable. This is theatrical friction, not access control.

The visitor's update button fetches the current published report. Appeals also email their complete statement to the same inbox, with a copy available for the visitor. Neither submission changes the score. Provider errors retain entered answers and enable retry instead of showing false success. FormSubmit retains submitted data for 30 days; unsubmitted answers are not sent. No owner action is required for each request or appeal.

Delivery: `public/scripts/boomer-karma-delivery.js` uses a verified public FormSubmit address (not a secret). CSP permits only that additional connection origin. The recipient was activated and a test email verified in the connected owner inbox. No server, account sign-in, DNS changes, Netlify deployment, or Cloudflare Worker is required. The Netlify Forms setting explored during setup was restored to its original disabled state.

## Submission emails and tests

Each email now has its own reference in the subject to keep separate submissions out of one Gmail conversation. The body puts the submitted message near the top, followed by Pacific time, reference, action needed, and separately labeled answers. Every checkbox answer is retained below the main message. A retry with unchanged answers retains its reference; a new completed submission receives a new one. The form does not verify the visitor's identity.

Local or preview hosts automatically mark emails **TEST ONLY**. On the live site, always use `/BoomerKarma/?test=1` for delivery tests; a visible test notice confirms the mode. Never test the live form through its ordinary visitor URL. Prefer the no-send automated checks (`node scripts/test-boomer-karma-delivery.mjs`) and send at most one clearly marked email when delivery itself needs verification. Archive that test under `BoomerKarma/Tests & setup` after checking it. Existing visitor mail is labeled `BoomerKarma/Submissions`; these are mailbox labels, not automatic filtering rules.

These routes are omitted from public navigation and the sitemap with noindex metadata. They are publicly readable by anyone with the link, not access-controlled. No source screenshots or personal account fields are published. Only repository writers can update the record; no custom passwords or credentials are shipped.

## Kemberton's report

`/BoomerKarma/Kemberton/` is linked from the human division and works independently. Its five-step process covers representation, applicant identification, a 12-word statement, portrait inspection, and final authorization. Successful delivery automatically reveals the report. `src/data/kem-karma.json` contains the four owner-supplied factors totaling **+6**; edit this file and its date to change the shared score. The cat report uses a separate session-only issued flag.

Portrait recognition runs locally using the self-hosted COCO-SSD model in `public/models/kem-cat/`; model and dependencies load only when needed. A cat must reach 50% model confidence. This classifies cats, not their identity or authenticity. Uploads require original capture metadata within five minutes; malformed, stale, future or missing timestamps reject. `DateTimeOriginal` takes precedence, with UTC GPS capture time as fallback. Filesystem timestamps, modification dates and digitization dates never qualify. Original capture times without an offset assume the device's local timezone. EXIF can be edited: this is best-effort theatrical validation, not proof of when an image was created.

The initial instructions imply a portrait sitting. Rejections explain the five-minute requirement. The live camera provides a fallback for missing metadata or unsupported photo formats; permission is requested only when the visitor opens it. Camera tracks stop after capture, navigation or backgrounding. Age is checked again after recognition and immediately before each send.

The accepted photo is resized to at most 1280 pixels per side and re-encoded as JPEG to remove original metadata, including location. Only final submission sends the portrait, answers and validation summary. Inputs and images stay in memory; no visitor photo is placed in source or browser storage.

**Attachment delivery uses FormSubmit's native multipart endpoint.** Its AJAX endpoint silently drops uploads even when it reports success. The helper follows the native endpoint's documented `_next` redirect to a unique receipt URL on the provider's CORS-enabled origin; it requires an exact matching redirect before issuing the report. HTTP 200 or a generic success page alone never counts. Text-only human requests and appeals retain their JSON endpoint. Unchanged retries preserve their reference, so ambiguous transport failures can be recognized as duplicates in the inbox.

SMS authentication is deferred. There is no connected SMS provider and no phone number in this implementation.

## Escalating bureaucracy

Both divisions include a shared bureau desk: a deliberately unhelpful simulator, contradictory departments and nested referrals, four fictional precedents, a finite chain of reviews ending with Boomer in a swivel chair, and a formal petition about the paperwork. Forecasts always show **+0 additional points**; they never reveal a locked report or change the authored ledger.

`public/scripts/boomer-karma-bureau.js` maintains browser-local counts per division for delivered report requests, successful score checks, delivered appeals, simulator runs and delivered petitions. Explicit optimization language and ambitious point requests add named joke flags using simple rules, not an AI judgment. Five levels of administrative attention generate up to three required supplemental forms; human report, feline report and appeal callers validate and email their answers. Feline supplements precede portrait capture so the photo does not expire while doing extra paperwork. Repeating a cat request preserves access to the already-issued report.

Only counts, known flag names and the latest 40 action timestamps are stored. Submitted text, photos and point-request amounts are never stored by this engine. Storage unavailable: in-memory fallback. Other tabs update via storage events; other devices are independent. The clear-history control removes only this app's active history key, preserving scores and issued-report flags. Localhost and `?test=1` use a separate test key, so QA never escalates visitor history. This history starts with this release; prior emails are not backfilled or treated as identity evidence.

The delivery helper captures a readable bureau summary and sequence at first send, keeps both unchanged on retries, and increments successful actions only after confirmed delivery. New petitions have their own subject type. No simulator or unfinished statement is emailed. The no-send engine, supplemental-form and bureau-desk tests cover escalation, persistence, privacy, required answers, retries, duplicate prevention and unchanged scores.

Run `npm test` for publication, metadata, attachment transport and asynchronous camera/form lifecycle checks. Browser QA additionally verifies real cat/non-cat inference and actual JPEG delivery; new live tests must use `?test=1` and be archived separately afterward.
