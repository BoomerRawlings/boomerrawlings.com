# TSS booking connection

The `/0311/` Book controls send a selected package to a helper activated by the user inside their logged-in TSS tab. The helper opens a paired copy of the website, navigates to the exact package, validates the loaded context, and invokes the native TSS Book handler once. This uses no extension, backend, stored credentials, or custom enrollment API calls.

## User setup

1. Select **Connect TSS**, or click Book while disconnected.
2. Drag the **Connect TSS** bookmarklet to the browser's bookmarks bar. Copy/manual bookmark editing is also available.
3. Activate that bookmark from a signed-in `https://tss.ucsd.edu/fiori` tab.
4. Use the connected booking page that opens. Booking always uses the account signed in to that TSS tab, regardless of which roommate is selected.

Activation never books anything. The user makes a fresh Book click after connection. Reloading, closing a tab, logging out, or a lost connection requires activation again. Native TSS warnings require manual review.

## Boundaries

- Both sides validate the exact origin, window reference, connection nonce and request ID. The nonce is removed from the website URL and never persisted.
- Only startup-validated package routes can be sent by trusted Book clicks. Student context, cookies, tokens and native payloads stay inside TSS.
- The helper checks the visible native Book control, loaded module/package/term, selected events and full native payload. Existing registrations, cancellation/change items, ambiguous selections and extra assessment actions stop the flow.
- The native CheckRegistration callback and saveCall are guarded against course/selection changes. Official warnings are preserved and never auto-confirmed.
- One request runs at a time. Request IDs stay deduplicated for the connection. Unknown submission outcomes lock further helper actions until TSS is checked and reloaded; no automatic retries.
- A submitted status reports the native response, not independently verified enrollment. Confirm the result in TSS/My Courses.

## Implementation and verification

- `src/scripts/tss-booking-helper.mjs`: self-contained bookmarklet helper and native TSS adapter.
- `src/data/tss-bookmarklet.ts`: serialized production bookmarklet; no external script loader.
- `src/scripts/roomie-tss-bridge.ts`: connection, setup UI and Book command client.
- `scripts/test-tss-booking-helper.mjs`, `scripts/test-roomie-tss-bridge.mjs`, `scripts/test-tss-bookmarklet.mjs`: native-flow fixtures, message/race/failure tests and built bookmarklet checks, included in `npm test`.

The adapter is based on the supplied TSS application bundle, not a supported public integration contract. Authenticated TSS may change its UI/model fields or block bookmarklets/window communication. It must fail closed when those assumptions do not hold. A two-origin browser fixture verifies activation and one native CheckRegistration/SaveChanges flow without contacting UCSD. Live authenticated compatibility and enrollment remain unverified until the user activates and uses it in TSS.
