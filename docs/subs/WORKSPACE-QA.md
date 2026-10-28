# Workspace verification

2026-10-27 local checks. No test images or credentials published.

- Ten Node behavior tests pass: composed class filters, encoded gallery filters including unknown/historical operators, native crop bounds, memory-only authorization, unsafe API destinations, optimistic batch conflicts, canceled-session batches, unavailable API responses, protected original bytes and pending-rights labels.
- Browser entry riddle, automatic descent, tab keyboard semantics, class/pilot search, historical search, owner-key failure, modal Escape/focus and 320px layout checked. Historical table retains 659 records and 337 initial raw sources.
- Real Worker/D1/R2 fixture served behind a same-origin local gateway. Its 200 synthetic records and two classes are explicitly marked test-only; they are not submarine data and do not count toward any collection target.
- Public dashboard showed 200 accepted originals, 100/class, with 300/class deficit. Class gallery filter returned 100; paging starts at 24. Original viewer decoded 1600×1000 and displayed exactly 1600×1000 with Actual pixels enabled. Downloaded original SHA-256 matched the record.
- Provisional release manifest downloaded. Audit queue contained 40 samples, 20/class. Owner key enabled session writes and was immediately removed from the input.
- Crop beyond native bounds was blocked. Valid crop correction advanced revision, demoted the image and required crop regeneration/reverification. Its frozen release became withdrawn.
- Two-record batch with a concurrent external edit produced one successful correction and one untouched conflict. No silent retry or overwrite.
- Audit pass required a note and updated unique sample progress. A subsequent deliberate test failure replaced the displayed result, quarantined the sample and removed release downloads.
- Owner gallery rendered candidate previews through authorized Blob URLs. Clearing the key left zero Blob-backed images, zero candidate cards, empty inspector metadata and a disabled review-status control. Public count fell to 196 after the four test exclusions. Public candidate metadata/original endpoints returned 404; withdrawn release file returned 410.
- Crop editor at 320px: document width305px, dialog267px, no horizontal page overflow. Browser viewport override reset afterward.

The development preview logged Astro toolbar audit fetch failures through the temporary gateway; no SUBS application failure was observed. Built production preview/live verification remains part of parent integration. Unknown-filter mapping is unit-tested; the backend added matching SQL semantics after this fixture started.
