# CHEM study desk verification

- Scope: single unlisted `/chem/` page for Learning Check 2, October 22. Original explanation and practice derived from supplied lectures, student notes and activities. No raw course documents, marked exam scans or student identifiers published.
- Source review: independent audit checked calculations, conversion entities, instrument sequence, spectrum normalization and formula derivations. Corrected reverse water default and distinction between a nominal molecular-ion peak and average molar mass. Exact official exam scope remains unconfirmed; October 20 lecture and Activities 7–8 were not supplied.
- Browser: default desktop, 390 and 320 widths. All eight conversion routes display connected chains. Edited input, negative-input error and reset verified. All five stage controls update selection/explanation. All three spectra and peak explanations verified. Phone plots scroll within their containers; selected stage/peak is brought into view. No page-wide overflow or console warnings/errors observed.
- Practice: six original multipart problems, 45 suggested points, independently located worked answers. Show all opens six keys; Hide all closes them; question-to-answer link opens its disclosure. Entity, isotope and gas/formula reasoning tested alongside arithmetic. Practice is not an official exam prediction.
- Automated: full `npm test` passed. Final content/layout changes additionally passed rebuild, publication verifier and CHEM checks: route-factor continuity, reverse round trips, invalid inputs, isotope ratios, unique IDs/anchors, no private identifier/path and sitemap exclusion. Existing unrelated suites unchanged.
- Print: dedicated print stylesheet and native print button expand disclosures for printing and restore their prior state afterward. Physical printing and an exported PDF were not tested.
- Publication: preserve existing GitHub Pages workflow and site navigation; no DNS or hosting-provider changes. This page is publicly accessible by URL, not authenticated.

## Same-page retrieval update

- Added 37 original flashcards and 18 multiple-choice Q&A items, all within `/chem/`. Existing guide, conversion workbench and multipart practice retained. Independent source/answer review corrected one atomic-mass versus molar-mass wording issue; all answer indices and arithmetic pass.
- Browser: reveal/hide, next, previous wrapping, topic change and shuffle tested. Navigation hides the preceding answer. Quiz empty selection, wrong choice, correction, repeated checks, topic filter and reset pass. All 18 correct choices produce 18/18; changing a checked choice removes its old result until rechecked. Score explicitly reflects latest choices rather than first attempts.
- Default desktop, 390 and 320 widths inspected; no horizontal page overflow or console warnings/errors. Keyboard-accessible native radios, buttons and disclosures; all card content and Q&A solutions server-rendered for browse/print fallback. No new routes, dependencies, accounts or storage.
- Regression checks validate card/question uniqueness, option/answer schema, source anchors and nonmutating shuffle/permutation. Full-site tests and final-build checks recorded in task state.

### Randomized practice
13 source-linked generated multipart prompts per set, same /chem/ route. Fresh values/scenarios; native worked-answer disclosures reset on regeneration. Independently audited science,300 seeded sets and seven diatomic answer branches. Local browser set1→set2,13articles, opened answer then zero open on refresh;320px layout no page overflow, no errors/warnings.

### Workflow Display integration
- Reused packaged workflow-display skill renderer/schema, MIT license preserved. Same-page shadow-root mount; top Show workflow and37per-problem launchers.
- Four collections:19foundation/integration pairs;13current randomized workflows;6multipart practice workflows;18Q&A workflows. Original answers reused; numerical values track regeneration.
- Independent source audit verified examples and original-answer grouping; corrected false serial prerequisites. Explicit dependency tests cover independent speed comparison and amount reused by gas computation.
- Browser: all37problem plans render; six fixed a–f groups retain complete continuation paragraphs; exact random prompt matches before/after regeneration. Search empty/clear, collapse/reopen, locked traces, Escape and Enter, same-page source anchors pass. Desktop and320/390 pairing/no-overflow checks pass; no warnings/errors.
- Rapid jump during unfolding now finishes prior layout animation before navigation; settled destination verified. Reduced-motion CSS/runtime branches retained from skill; OS reduced-motion visual emulation unavailable in browser tools, so that mode was not visually simulated.
- Full npm test passes; final rebuilt output/publication/CHEM checks pass. Production release pending.
- Production verified:8f391f3, Pages39072539368 succeeded. Live top Show workflow,19foundation/integration pairs, current-random-value synchronization and four-path molar-mass dependency trace pass; no console warnings/errors. Packaged skill baseline32tests pass. Same /chem/ path retained.

### Lecture provenance highlighting
- Four verbatim quotes verified locally against their exact retained transcript-line ranges; independent source audit passes all six emphasis/worked-method paraphrases. Ten source-specific guide callouts. Original study prompts explicitly labeled paraphrases; generated practice never marked as a direct quote.
- Purple quote blocks and gold emphasis/worked-method blocks use thick borders, text labels/icons and citation links. Same registry inside workflow foundation cards and flashcard answer context; related-practice badges link to the highlighted source topic. Static guide highlights work without JavaScript; workflow cards avoid duplicate IDs.
- Desktop/320/390: prominent colors/readable wrapped text, no page-wide overflow. Flashcard reveal/navigation hides answers correctly; Q&A solution badge and regenerated practice badges work; source link stays /chem/. Workflow highlighting preserves dependency tracing and console remains clear. Removed decorative rail note that overlapped sticky navigation after longer content.
- Exact quote labeling, safe text escaping, unique anchors and citation-target checks added to CHEM suite. Print rules retain text labels and colors; physical/printed output not visually verified.
