# Boomer Karma

Unlisted report: https://boomerrawlings.com/BoomerKarma/

The shared source is `src/data/boomer-karma.json`. Score = `openingBalance` + every entry's `points`. Entries appear newest first; append new entries at the end of the array. The six user-supplied entries total 20, with no invented opening balance.

## Change the score

Use **Bureau access** at the bottom of the page to open GitHub's authenticated editor, or edit the JSON locally:

1. Append an entry with integer `points`, a short `note`, and a public-safe `detail`. Negative integers deduct points.
2. Set `updatedAt` to the report date (`YYYY-MM-DD`). Adjust `status` if desired.
3. Commit to `main` after checks. Existing GitHub Actions publishes the shared report; no browser-local score exists.

Credit Karma-inspired parody styling: green wordmark, white dashboard cards and three decorative score arcs. A nine-step mock application precedes the report: eligibility, bureau selection, 12-word statement, fine print, book puzzle, notarization, redundant declarations, review, and final permission. The final permission reveals one more checkbox. Completing the application emails every answer and checkbox state to the owner's verified inbox through FormSubmit. A report-issued flag is saved in sessionStorage only after successful submission to keep refreshes usable. This is theatrical friction, not access control.

The visitor's update button fetches the current published report. Appeals also email their complete statement to the same inbox, with a copy available for the visitor. Neither submission changes the score. Provider errors retain entered answers and enable retry instead of showing false success. FormSubmit retains submitted data for 30 days; unsubmitted answers are not sent. No owner action is required for each request or appeal.

Delivery: `public/scripts/boomer-karma-delivery.js` uses a verified public FormSubmit address (not a secret). CSP permits only that additional connection origin. The recipient was activated and a test email verified in the connected owner inbox. No server, account sign-in, DNS changes, Netlify deployment, or Cloudflare Worker is required. The Netlify Forms setting explored during setup was restored to its original disabled state.

This route is omitted from navigation and the sitemap with noindex metadata. It is publicly readable by anyone with the link, not access-controlled. No names or source screenshots are published. Only repository writers can update the record; no custom passwords or credentials are shipped.
