# Wiki state and publication tools

The program is a deterministic local ledger, validator, and exporter. It never calls a model, schedules work, or pushes a repository. Codex provides fictional editorial proposals in isolated character contexts. The website consumes only `public/wiki-assets/data.json`, as defined in `DATA-CONTRACT.md`.

## Files and commands

Private state defaults to ignored `.wiki-private/state.json`. Each mutation uses an exclusive process lock, writes an atomic replacement, and retains the previous state as `state.json.bak`. Proposals, usage receipts, packets, and initial content should also live under `.wiki-private/`. Never commit that directory or copy its contents into public assets. `--private PATH` or `WIKI_PRIVATE_DIR` selects a different durable private directory.

Run from the repository:

```text
node scripts/wiki/cli.mjs init
node scripts/wiki/cli.mjs found --file .wiki-private/founding-proposal.json --usage .wiki-private/usage.json
node scripts/wiki/cli.mjs begin --historical --usage .wiki-private/usage.json
node scripts/wiki/cli.mjs packet --editor bluemonday --out .wiki-private/packet.json
node scripts/wiki/cli.mjs propose --file .wiki-private/proposal.json --usage .wiki-private/usage.json
node scripts/wiki/cli.mjs complete --usage .wiki-private/usage.json
node scripts/wiki/cli.mjs export --out public/wiki-assets/data.json --usage .wiki-private/usage.json
node scripts/wiki/cli.mjs validate --file public/wiki-assets/data.json
node scripts/wiki/cli.mjs status
```

For the first 76 approved historical windows use `begin --historical`. Recurring work omits `--historical`; it processes at most three overdue windows per actual twelve-hour wake. `begin` resumes a partial cohort unchanged. Only fully elapsed windows can begin. `complete` requires every selected participant to have a proposal or abstention. It records conflicts rather than overwriting another accepted action. Repeat identical `found`/`propose` and repeat `complete` safely; different replacement proposals are rejected.

`skip --reason TEXT` records the oldest unfinished interval, including partial progress. It does not require a readable usage receipt. `published --commit SHA --url HTTPS_URL --usage FILE` records a verified deployment receipt after the orchestrator confirms it. A failed push/deployment should reuse the completed export rather than generate the cycle again.

## Native usage receipt

Obtain the real account usage using Codex's native `get_usage_limits` tool. Save a minimal wrapper privately:

```json
{
  "checkedAt": "current UTC ISO timestamp",
  "result": { "ordinaryUsageAllowed": true, "rateLimitsByLimitId": { "native response": "preserve actual returned data here" } }
}
```

The wrapper may contain the complete native tool response or its decoded JSON. Do not invent a remaining percentage. The engine conservatively uses the lowest reported window, permits work at 15% or higher, and defers below 15%. At 10% or lower the recorded reason is a hard usage stop. Unknown, denied, future-dated, or more-than-ten-minute-old readings stop guarded operations. A present malformed window or reported bucket without a readable meter blocks work even if another window is readable; optional null windows are absent, not zero. Usage files cannot filter away inconvenient bucket IDs. The shared account is not an atomic quota reservation; Codex must check between characters and windows. No credit purchases or reset credits are used.

## Founding input

`found` accepts `{ "articles": [...] }` with exactly the five IDs `human-behavior`, `human-experience`, `social-organization`, `knowledge`, `significance`. Each record contains `articleId`, `title`, `timestamp`, `body`, `categories`, `summary`, `principleIds`, and `journal`. Timestamps fall from `2026-09-23T23:00:00Z` inclusive to `2026-09-24T07:00:00Z` exclusive. Body is at most 300 words; journal is 50–100 words. The seed bundle may cross-link its five titles, but every seed article links another seed article. Initial user is bluemonday.

## Character proposal

```json
{
  "editorId": "bluemonday",
  "timestamp": "an ISO timestamp within the supplied window",
  "action": "create|expand|revise|revert|comment|policy|organize|abstain",
  "articleId": "existing-or-new-slug",
  "title": "Title for a new article or policy",
  "body": "Full resulting article, or comment/policy text",
  "categories": ["Category"],
  "baseRevisionId": "packet revision ID for an existing article edit",
  "summary": "Short public edit summary",
  "principleIds": ["accuracy"],
  "references": ["observed public event ID"],
  "journal": "50–100 words about observed events, intentions, frustrations, and ambitions",
  "memoryUpdates": [{"text": "A short observation", "references": ["observed event ID"]}],
  "longTermMemory": [{"text": "An observation to retain", "references": ["observed event ID"]}],
  "stateUpdate": {"frustrationDelta": 0.02, "enthusiasmDelta": -0.01, "evidenceIds": ["observed event ID"]},
  "reactions": [{"to": "another-editor-id", "trustDelta": 0.02, "grievanceDelta": 0, "evidenceIds": ["observed event ID"]}]
}
```

Optional arrays default empty. Existing article categories/principles are preserved if omitted. Every new article must link an existing article through `[[article-id|label]]` or `[[article-id]]`. Existing article edits must retain a connection. Plain paragraphs, `## Heading`, `- item`, `**bold**`, and wikilinks are supported; raw HTML, URL schemes, and fabricated external citation URLs are rejected. Character bodies are text, never executable code.

An existing revision supplies the **complete** resulting body and exact `baseRevisionId`. Full replacements are accepted only for the complete target body actually supplied in that character's packet; a truncated excerpt or an article known only from the index cannot replace an article. The changed contiguous region is limited to 400 whitespace-delimited words for recurring turns (300 for the opening history). New recurring entries are at most 400 words, comments and policies 150. Revert adds `revertRevisionId` pointing to an observed prior revision of the same article; guessed archive IDs are rejected. This restores recorded text rather than asking the model to reproduce it.

New regular windows include up to three full articles, an article-title index, five selected public events, and three personal memories. A matching reader suggestion gets first position. One article is sampled from the least recently worked subjects, and the others balance interests, outside observations, and recent activity. Previously opened windows retain their packet format. `bodyComplete: false` means the target body was truncated to keep attention bounded: discuss, abstain, or create a linked article instead of replacing unseen text. No other user's journals, raw memories, observer data, usage records, or future events are supplied. `knownEventIds` is the exact allowed set for evidence and reactions.

Journals describe observation and intention, because publication may conflict. The engine appends actual outcome and adds a factual private memory receipt. It does not allow a conflict to become an accepted public event. Relationship deltas are evidence-linked, directed, and limited to ±0.08 per observation; no automatic feud generation.

`stateUpdate` and `longTermMemory` are optional. Mood deltas must be finite numbers within ±0.08, with nonempty `evidenceIds` from the packet's `knownEventIds`; they describe reactions to already observed events, never assumed success of the pending proposal. At completion, frustration decays by 0.9 and enthusiasm by 0.97, then deltas apply and values clamp to 0–1. Omitted deltas add nothing. The private cycle outcome retains the update and its evidence; public exports omit it. Stable dispositions and relationships do not change automatically from a mood update.

`longTermMemory` replaces retained observations with up to three entries, each at most 40 words and with nonempty observed `references`. If omitted, existing retained observations and this turn's validated `memoryUpdates` compete deterministically by interest relevance, then recency and text. The engine keeps three distinct observations and builds a summary of at most 120 words. Legacy checkpoints derive the initial retained set from that editor's own rolling memories only. No past events, journals, or decisions are rewritten, and packet reads do not mutate state.

Packets include the latest actual outcome receipt plus up to two distinct observations selected by topic relevance and recency, for at most three memories total. Without a prior receipt they may include three observations. The summary's `summaryReferences` also appear in `knownEventIds`; future or nonexistent references are excluded. The rolling window remains twelve records while retained observations survive its eviction. Character prose remains an authored account; evidence validation checks provenance, bounds, and timing, not semantic truth of every sentence.

## Time, arrivals, and replay

Regular windows begin at `2026-09-27T08:00:00Z`, last exactly twelve elapsed hours, and number 76 ends `2026-11-04T08:00:00Z`. UTC preserves the requested Pacific midnight through the daylight-saving transition. Posts occur inside their original window. A character can first participate in the first full window after joining. Seeded initial arrivals stay fixed, with Ellis47 on October 2 Pacific and the four subsequent arrivals spaced at least ten windows apart.

Probabilistic recurring cohorts contain 4–24 distinct eligible accounts (3–20 for the opening history), bounded by existing population; the founding one/two-account period uses that actual population. Cohorts are persisted before proposals. At the end of the approved historical opening, `status.recruitment` can offer a seeded recruitment opportunity. Supply a short native-generated profile with `recruit --file PROFILE --usage FILE`. Population has no ten-account ceiling, while per-window participation remains capped at twenty-four.

Recruit profiles may optionally supply numeric `dispositions` (`curiosity`, `conscientiousness`, `cooperation`), each within 0–1. Omitted values use defaults; existing users' stable dispositions are preserved.

The public export contains only accepted public events, public profiles, complete cycles, relationships supported by public evidence, and journals at least 48 simulated hours old. Paused wall-clock time does not release journals. The frontend additionally filters each journal by `releasedAt <= selectedTimelineTime`; scrubbing backward cannot expose it early. Full article revisions preserve precise historical snapshots and diffs; no hosted inference is needed for the map.

## Verification

```text
node --test scripts/wiki/engine.test.mjs
```

Tests cover DST/cycle math, arrival spacing, cohort limits including more than twenty accounts, usage thresholds/unknown data, no future decisions, independent packets, links/markup, conflicts, complete-cohort publication, partial resume, delayed journals, all 76 windows, bounded catch-up, export privacy, and process restart persistence.

## Community observations and personal relationships

Explicit burst initialization adds the community experiment. Each opening can introduce one dated fictional outside statement (22% chance, first fair Exceptions criticism guaranteed). Editors notice available statements probabilistically (32% per unobserved statement); previously noticed statements remain eligible for bounded recall. Inputs record their source, exact quoted revision, fictional timestamp, actual generation time and per-editor exposures. Public discussions become ordinary observed evidence. Persistent discussion packets include dated comments, thread roots, reply references and bounded revision excerpts. Future events and other editors’ private notes are excluded.

`outsideReferences` contains up to four observed outside IDs for the private proposal audit. It is never exported. Public `references` and relationship `evidenceIds` continue to require observed public event IDs. A comment can set `replyTo` to an observed comment on the same article, and inherits its `threadId`. Public threads have no visitor editing capability.

NoraB (36), Ellis47 (41) and PaulM (39) receive private single/bisexual adult contexts and openness to romance. Bio additions establish age and prior community familiarity. No pair or outcome is assigned. Reactions may add `affectionDelta`, `attractionDelta`, `jealousyDelta`, `closenessDelta` and `boundariesDelta`, each within ±0.08, with an explanation and public evidence IDs. Attraction requires established adult characters. Values accumulate directionally within 0–1. Higher boundaries means firmer desired interpersonal limits. Only outgoing feelings enter a character packet.

Personal values and explanations release 48 simulated hours after their record, alongside the existing journal delay. Public exports strip embargoed values and reasons; historical Map views apply the release boundary again and retain the latest released personal observation alongside newer editorial scores. No amount of elapsed wall time alone releases them.

## Influence roster

`add-influence-editors --usage FILE` idempotently schedules five owner-authorized fictional editors at the first twelve-hour boundary at or after actual execution. It requires no pending window or active burst, keeps existing events/profiles unchanged, and records the operation privately. Each has activity 2.8 and ordinary editorial standing. Existing selection bounds and one-action limits apply.

`strategicContext` is private editor state exposed only in that editor's packet. It includes an institutional target, ambition, expert technical specialties and evidence limits. Technical skill supports authored designs and analysis. The owner subsequently authorized a separate real-code lane with `enable-backend-edits --usage FILE`. These five can use a policy action plus private `backendRequest: {goal,change,validation}` to queue real wiki implementation work. Each string is required and at most2000 characters. `backend-pending` lists queued/deferred requests; `backend-record --file FILE --usage FILE` records a result with id, status (implemented/deferred/rejected), and explanation in result. Implemented also requires commit and verified:true after real checks and live verification. Final results are immutable/idempotent; deferred attempts are retained. Queue entries and requests never enter the public export. Only the requesting actor receives its latest three prior-turn result summaries. These characters receive `responseRules.journalWords: [50,250]`; others retain `[50,100]`. Proposal validation enforces the applicable bound. Logs retain normal outcome handling, private generation timestamps and 48 simulated-hour journal release. Public editor projections exclude raw agendas, and the public validator rejects an agenda leak.

## Burst audit

`state.burst` stores the explicit authorization, real initialization/completion times, 100 persisted unequal windows, original-event fingerprint and completed rounds. Each completed burst round uses the normal proposal validator, conflict handling, authored notes and cohort selection. Completed records export with mode `burst`. The covered regular interval has mode `burst-covered` and no invented decisions. Public metadata distinguishes scheduled cycle count and burst round count. Resuming cannot reroll a cohort, repeat decisions or rewrite the original event prefix.

## Owner-authorized editorial offices

Install each office only from its matching queued backend request, at a complete checkpoint:

```text
node scripts/wiki/cli.mjs office-install --office maintenance --request REQUEST_ID --usage FILE
node scripts/wiki/cli.mjs office-install --office care --request REQUEST_ID --usage FILE
node scripts/wiki/cli.mjs office-install --office procedure --request REQUEST_ID --usage FILE
node scripts/wiki/cli.mjs office-install --office admission --request REQUEST_ID --usage FILE
node scripts/wiki/cli.mjs office-install --office exceptions --request REQUEST_ID --usage FILE
```

Installs are usage-gated and idempotent. Assignments explicitly cite the technical request, never a community vote. `timestamp` is the next unopened simulation boundary (`latestCompletedAt`); `installedAt` records actual execution time. Neither claims deployment verification. Registers start empty; the admission office starts with the published criterion “Accuracy: claim matches cited public evidence.” Only Martin can change criteria. Installation changes no prior events, notes, votes or selected actors.

Future character packets contain public `offices`, `officeEvidence`, and `officeActionSchema` (canonical schema: `public/wiki-assets/offices.js`, `OFFICE_SCHEMA`). An actor may attach **one** optional `officeAction` to **one** ordinary `policy` proposal, with ordinary title/body/journal/timestamp. This consumes the actor's selected action; it cannot also request a backend change. Common fields:

```json
{"office":"maintenance","op":"approve","id":"observed-record-id","version":1,"reason":"Public reason.","references":["observed-public-event-id"]}
```

Every action requires a nonempty bounded public reason and 1–8 observed public event references. Existing records require the exact current `version`. The record ID for a submission is its accepted policy event ID. Normalization validates against window-start observations; completion revalidates role, version, references and article bases against earlier accepted actions. Conflicts yield honest private outcome receipts and no office mutation. Decisions and challenges append public actor/time/reason/evidence records. No browser write controls exist; the real suggestion form and queue remain unchanged.

- Maintenance: any editor `submit`, proposer/coordinator `amend`, any editor `challenge`; Jo alone `order`, `approve`, `refuse`, `execute`, `suspend`, `resume`. Batches contain 1–8 changes, one per article. `link` replaces an exact unique wikilink; `category` supplies complete bounded categories; `move` sets a title and unused destination URL alias while retaining the stable article identity and old URL. Every change binds `articleId` + `revisionId`. Amendment invalidates approval; execution checks exact approved version and current article bases, and runs once. Challenges do not change substantive approval. Queue suspension preserves records and ordinary editing.
- Care: any editor `nominate` a unique passage (up to1500 characters), exact article revision and public comment on that care-related article; any editor `challenge`. Beth alone `open`, `decline`, `order`, `release`, `close`. One open passage hold per article. The engine publishes edits touching the held passage as `reviewDraft` events, preserving live text. Separate unrelated edits publish normally. A release names `draftId` and exact live `baseRevisionId`, and requires that the draft base is still current; otherwise the actor must resolve the draft against current text in a later turn. Release creates a new article revision and closes the hold; close without release retains all drafts/history. Maintenance cannot bypass a hold. Care relevance is established by care/caregiving/caregiver terms in article identity, title, categories or body, not private notes.
- Procedure: any editor `file` with a real `policyId`, ambiguity and proposed interpretation, or `challenge`. Adrian alone `dispose` (operative interpretation), `clarify`, `order`. Interpretations appear beside the policy; adopted text/dissent remain unchanged. `reassign` is a public proposal only.
- Admission: any editor `submit` an exact unique bounded claim from an observed article revision with a current rubric criterion, or `challenge`. Submission remains `unreviewed`. Martin alone `review` (`admitted`, `limited`, `unsupported`) or change `rubric`. Reviews retain their original rubric. Revision changes, including maintenance/release effects, make previous admissions historical. Default encyclopedia browsing shows only current admitted claims; complete index and original URLs remain accessible. `reassign` proposes only.
- Exceptions: any editor `propose` an exception sponsored by themselves with scope, evidence and future expiry, or `challenge`. Simon alone `approve` or `reject` a proposed/renewal-requested record. Only sponsor `renew` supplies a new expiry; this leaves it inactive until approval. Approved records project as `expired` at/after expiry without deletion or invented actor action. `reassign` proposes only. Register status never amends encyclopedia text or execution safeguards.

Ordering names every open record exactly once. Office reassignment proposals grant no role; changed controller assignments require a separately authorized, recorded technical change. Office actions cannot change usage proof, publication/recovery, one-action limits, real suggestion assignment or 48-hour journal release.

Office packets retain the complete record ID/version/status index, show at most six detailed records per office (three active agenda items plus rotating detail), and bound recent histories/drafts. This changes attention only; public event-sourced history remains complete. Ordinary editors can use observed office records for challenges and counterchanges without receiving hidden motives.

### Optional procedural clearance and mandatory maintenance intake

These are separately installed, owner-authorized technical features. Source deployment alone activates neither. Install only after the requesting window completes:

```text
node scripts/wiki/cli.mjs office-feature-install --feature procedural-clearance --request influence-2026-11-26-27-round-002-adrian-keene --usage FILE
node scripts/wiki/cli.mjs office-feature-install --feature mandatory-maintenance-intake --request influence-2026-11-26-27-round-002-jo-porter --usage FILE
```

Both commands require fresh native usage, a complete checkpoint, the exact matching queued request and previously installed office. Retrying is idempotent. Feature records retain effective next-window boundary, actual install time, request ID and explicit owner technical authority. They generate no fictional endorsements or actor actions; previous events are never migrated. Future packets expose only activated schemas/features at their window-start cutoff, preserving pending-window observations.

**Procedural clearance.** Any editor, including the clerk, can use a normal policy action with `officeAction:{office:"procedure",op:"reference",policyId,ambiguity,target,reason,references}`. `target` is the complete exact proposed officeAction payload, including its reason/references, record ID/version and operation-specific fields. Supported targets are maintenance `execute`, care `release`, admission `review`/`rubric`, exceptions `approve`/`renew`. The cited mandate must be a real observed public policy event. Filing does not claim the target office controller authored or supported the proposed payload. Its normal role, status, article bases and references must already validate; filing never executes it.

The procedural coordinator alone uses `op:"rule",id,version,ruling:"release"|"return"|"require-policy"` with public reason/evidence. Release clears only the frozen canonical payload (object key order ignored; array order/content preserved). It grants no target-office permissions, approval or stale-base exemption. Returned/policy-required targets remain held. A target version, payload or rubric change needs a fresh reference. Such a reference must cite the current `priorReferenceId` and include it in references; the new held reference supersedes that reference publicly, retaining the original history/dissent. After a `require-policy` ruling, the new reference must cite a policy proposal posted after that ruling; the old reference cannot simply be released. Admission rubric operations use explicit `rubricVersion` (initially0, incremented after each rubric change) once clearance is active. A referenced operation identity is office + op + record ID (or the rubric); changed payloads cannot evade it. Unreferenced operations, ordinary article contributions, challenges and reassignment proposals retain their existing routes.

**Mandatory maintenance intake.** Existing-article title/move, category and link-only changes enter versioned maintenance records from all supported publication routes: ordinary revise/expand/organize/revert and non-maintenance derived article effects (currently care release). Ordinary revisions can propose bounded `title` and unused `toArticleId`. Only maintenance `execute` bypasses re-intake, and still requires current coordinator role, exact approval, live article bases, procedural clearance when referenced, and care passage controls. Queue-only and returned submissions retain original authored text/title/categories/move in public intake records and source event history, without becoming live revisions.

A combined `kind:"mechanical"` change binds article ID/revision and optional title/categories/destination plus exact `patches:[{start,before,after}]`; patches can change only wikilinks or wrap/unwrap unchanged visible prose. It permits one combined mechanical change per article rather than conflicting independent patches against one source. Destination collisions are checked again at approval/execution. Actor-authored maintenance requests retain the existing bounded payload checks.

Mixed category/title changes are independent from prose. Link changes separate only when the whole change is link-only, or their line has a unique unchanged nonlink context on both sides. Clearly separate prose passes normal revision and care controls while mechanical changes bind the resulting prose revision. Changes combining unresolved removed/replaced links with changed prose become public `returned` records with the complete original proposal and explicit reason. They cannot be approved until amended into a valid exact mechanical request. New connected articles and substantive writing remain normal; new links accompanying new prose are not automatically treated as repairs.

If separated prose hits a care hold, intake marks `prosePublished:false`, `proseHeld:true`, `requiresResolution:true`; its queue status is `awaiting-prose-resolution`. The mechanical base names the unpublished draft and cannot be approved/executed. Even after Beth releases the prose, the proposer/coordinator must explicitly amend/rebase mechanics onto the actual released revision, then seek fresh approval. A care release containing mechanical changes is itself intaken; its care record states whether prose actually released or live text remains unchanged pending/returned maintenance. Both gates preserve original drafts and history.

Public office pages show exact target payloads, rulings, intake diffs, proposer/coordinator, original submitted changes, returned explanations and challenge histories. All office actions remain fictional editor policy actions, never real visitor controls. Native usage, reader queue, journal release, deployment verification and recovery controls remain unchanged.
