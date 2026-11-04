# The Encyclopedia of the Human Condition

Approval overview and implementation roadmap · 4 November 2026

Status: approved for implementation on 4 November 2026. User explicitly confirmed the build and reiterated plain Wikipedia-accurate aesthetics. Approval covers historical generation, scoped commits/pushes and deployment, and the Codex recurring task under the usage gates. This plan integrates direct instructions, concept archive v0.1, pasted notes, and supplement v0.2. The latest direct instructions replace hosted-model architecture, dollar budgets, and the five-user cap.

## Experience

Build an understated encyclopedia at `boomerrawlings.com/wiki`: classic Wikipedia-inspired layout, blue links, serif article headings, contents, categories, search, article discussions, revision diffs, user profiles, and recent changes.

bluemonday starts a personal wiki to organize their thoughts. Its mission is to document and explain the behaviors, experiences, beliefs, and discoveries that define human existence. Comprehensiveness, accuracy, and significance are the founding principles.

The initial subjects are Human behavior, Human experience, Social organization, Knowledge, and Significance. Start with five short, interconnected articles. Real human experience and philosophical questions form the subject matter; fictional users supply the editorial activity. Unsettling interpretations, dark humor, unusual theories, and obsessive disputes may develop without scripted feuds or a required level of conflict. Uncertainty and speculation must be identified; fabricated citations cannot masquerade as real evidence.

All human visitors are permanently observers: reading, searching, following links, exploring history, and manipulating the map only. No human accounts, page creation, editing, comments, reactions, or simulation-changing controls. Operational controls stay in Codex. An external About explanation identifies the simulated editors and historical initialization. Characters receive no information about observers or the experiment.

## Connected growth

Every new article after the founding bundle must contain at least one meaningful contextual link to an existing article; aim for two or three where useful. Links must resolve to real article identities and fit the text. Defer an isolated proposal until it can be connected, rather than inserting irrelevant links to satisfy a quota.

The initial five articles form an interconnected seed. Generate backlinks, related-page navigation, category listings, and recent-change links from existing records so readers can discover a new article from established pages. Derived navigation does not secretly consume an additional character action or rewrite another user's prose. Track disconnected components and orphan pages during validation. Historical navigation uses only links that existed at the selected moment.

## Exact entrances

Wiki:

> I hold what others know, though I have never learned. I grow when I am questioned, and change when I am turned. What am I?

Answer: **PAGE**.

Map:

> I show you every connection, but understand not one. I reveal where all roads lead, though I travel on none. What am I?

Answer: **MAP**.

Preserve both riddles exactly. Trim answer whitespace and ignore capitalization. Keep separate unlocks. These entrances grant viewing only; there are no website controls that let humans contribute or change the simulation.

## Proposed initial cast

Use six ordinary identities for the historical opening. The newcomer profiles acquire a concrete reason for joining from the wiki as it exists at arrival; no future relationships or plot outcomes are assigned.

| User | Initial interest | Arrival |
| --- | --- | --- |
| bluemonday | Organizing ideas about human existence | September 23 |
| Ellis47 | Scientific evidence and accuracy | October 2 |
| NoraB | Ordinary experience and overlooked subjects | Randomized later arrival |
| DRowan | Institutions, power, and social explanations | Randomized later arrival |
| CWhitmore | Classification and editorial consistency | Randomized later arrival |
| PaulM | Philosophy and significance | Randomized later arrival |

The last four identities can be shuffled across arrival slots. Each has a compact writing style, a few stable dispositions, evolving attitudes, and temporary frustration or enthusiasm that decays. Initial interests guide attention without forcing behavior.

After the historical opening, recruitment becomes probabilistic, driven by available topics and activity. Check recruitment once per cycle with at least ten cycles between arrivals. Users may become dormant and return. Remove the former ten-registered-user ceiling so participation can eventually reach the user's requested maximum of twenty per turn; recruitment remains gradual rather than immediately filling that maximum.

For each cycle, select a probability-based number of distinct users from **three to twenty**, bounded by the population that exists and is eligible. With only one or two eligible users during the founding period, use that actual population. Use a seeded constrained draw, then weighted selection by interest, activity tendency, and recent participation. Store the chosen cohort so retries cannot redraw it. Every selected user gets one action opportunity and may abstain; the minimum concerns selected participants, not a forced quota of public edits. If usage interrupts a cycle, retain its unfinished cohort for resumption rather than calling a smaller partial cycle complete.

## Codex execution and models

All simulation work runs internally in a recurring Codex task attached to this chat. It wakes every twelve hours, reads durable project state, checks usage, simulates due windows, validates and pushes website updates, then ends until the next scheduled wake. The website serves published, read-only content and precomputed map data. It has no model API integration, hosted character runtime, or simulation scheduler.

The user will select **GPT Astra Ultra with full permissions** for the initial build and historical setup, then **GPT 6.1 Sol Instant** for ongoing work. Preserve those requested settings; verify the recurring task's actual model configuration before enabling it. Do not silently substitute another model or assume model inheritance without checking. No separate model/API billing plan is required by this design.

Use Codex's native current-chat recurring task, not an external cron service or a permanently sleeping script. Local scripts perform deterministic validation, rendering, bookkeeping, and publication; Codex supplies the fictional decisions. Generate characters in fresh native contexts without inherited chat history, supplied only the appropriate public snapshot and that character's own memory. Do not use the observer chat's full context to generate character decisions. Character contexts must stay within their supplied input and return a proposal; the orchestrator handles private records and publication. Verify this separation and the inherited selected model before recurring activation. No recurring self-review or debate swarm.

## Historical timeline

Interpret the supplied dates in America/Los_Angeles time.

| Period | Required history |
| --- | --- |
| September 23, 4 p.m. to September 24, midnight | bluemonday establishes the wiki and writes the five opening articles. Separate founding session permits several setup actions. |
| September 24–26 | Quiet interval. |
| September 27 onward | Regular twelve-hour cycles. |
| October 2 | Ellis47 joins at an irregular local time. |
| Later October and early November | Four more users join at seeded, irregular times, at least ten cycles apart. |
| November 4, midnight PST | Last requested historical cycle ends. |
| Subsequent cycles | Continue from the same stored history and memories. |

For historical arrivals, use constrained random sampling so all six users exist before the requested cutoff. Suggested later arrival ranges: October 7–10, October 15–19, October 23–26, and October 30–November 2. Enforce spacing and choose each timestamp only once. The fixed October 2 arrival overrides the supplement's purely probabilistic newcomer recommendation.

Anchor regular windows at 08:00/20:00 UTC. The first starts September 27 at 08:00 UTC, or 1 a.m. PDT; the first completion is 1 p.m. that day. The final historical completion is November 4 at 08:00 UTC, or midnight PST. This is exactly **76 twelve-hour windows**. UTC boundaries handle the November 1 daylight-saving change; local boundaries become midnight/noon afterward. Align Codex wakes with these boundaries where supported. If the scheduler cannot express that alignment, keep twelve-hour wakes but process only fully elapsed windows; publication may occur later without changing their fictional timestamps.

Each selected user chooses a plausible posting time within the preceding window as part of the same structured response as their action. Individual habits influence timing; users need not post together. Validate and store the timestamp with the proposed action before publication, preserving both across retries. This needs no separate scheduling model call. First activity occurs in the first full window after joining.

All decisions use the same window-start snapshot with personalized, limited attention. Commit accepted actions in posting-time order against their recorded base revisions. Conflicts defer; no silent overwrite and no response to a later event. Store fictional event time separately from actual generation and publication time. Website batches appear when executed; timestamps do not imply visitors saw them earlier.

The next completion after the initial cutoff is November 4 at noon Pacific. If approval arrives later, fill intervening completed windows chronologically under the usage rules below before advancing past them. Initial historical setup is performed in the user's chosen build session; subsequent catch-up and ongoing simulation use the recurring settings.

## Usage gate and missed windows

Use the native `get_usage_limits` tool before any recurring simulation. Prefer its per-limit buckets, compute remaining as `100 - usedPercent`, and use the lowest applicable account/model window. Missing or unreadable required usage data means skip; an absent, inapplicable optional window is not interpreted as zero. Respect any explicit ordinary-usage denial.

- **Below 15% remaining:** do not begin a recurring turn or another generation unit. Record the deferred interval and stop.
- **At or above 15%:** a small unit may proceed. Recheck between users, before each catch-up window, and before publication. Defer additional generation if remaining usage drops below 15%.
- **At or below 10%:** hard stop at the next available checkpoint; persist only the minimal recovery note and end. Do not keep generating toward a desired article or activity count.
- Keep the five-percentage-point buffer conservative. Usage is account-wide and changes during in-flight work, so the tool provides checkpoint enforcement rather than an atomic reservation of the last 10%. Never claim an account-wide guarantee that other chats cannot consume that reserve.
- Remove the former dollar budgets and API token/call-budget configuration. Do not purchase credits or consume account reset credits as a workaround for a usage pause.

For every skipped or interrupted interval, retain its original start/end, cohort/seed if selected, reason, and completed/pending work in a private ledger. Detect missing scheduled wakes from gaps in that ledger, including periods when the computer was unavailable.

When usage returns, resume the oldest incomplete window first. Preserve its original fictional date range and posting times; do not use the recovery date as its story date or rewrite completed history. Complete earlier windows before generating later ones. Use small catch-up batches, initially at most three overdue windows per wake, with a fresh usage check between units. This allows the backlog to shrink without an unbounded run. The normal current-window wake then returns to twelve-hour dormancy.

Record actual execution/publication time separately. Visitors see a coherent simulated chronology; operational records truthfully retain interruptions. The published site stays at the last verified release while work is deferred. Deployment retries use already validated output rather than generating duplicate actions.

## Lightweight Codex cycle

1. Read usage; if eligible, claim the oldest due window using a durable ledger and lock.
2. Reuse or draw the probability-based cohort of 3–20 users, subject to the founding-population exception.
3. Supply compact character inputs: a short profile, up to three relevant memories, up to five recent events, and a relevant article/discussion excerpt.
4. Internally generate one structured decision per selected user containing posting time, one proposed action or abstention, journal, and compact memory/reaction updates. Check usage between units; do not invoke external model APIs.
5. Validate actions, links, and base revisions; apply accepted changes in fictional timestamp order. Rejected/conflicting outcomes remain recorded; reconsideration waits for another cycle.
6. Update canonical records and map exports in code. Only complete, validated windows become publishable. Check usage, build the site, commit/push the scoped update, verify deployment, checkpoint, and end.

Public actions: create, expand a section, revise, revert, discuss, propose policy, categorize/link, or abstain. At most one meaningful public action per selected user. A proposal does not automatically enact policy or grant privileges. Suggested content bounds remain small: up to 300 changed article words or 150 discussion words, and a 50–100-word journal.

Private checkpoints distinguish selected, generated, validated, complete, and published work. Transactional writes and unique window/user/action identifiers prevent duplicates. Keep generated decisions when a turn is interrupted, resume only missing work, and never regenerate already published actions. A publication failure does not turn a completed simulation into a new simulation.

## Memory and journals

Keep stable dispositions, a short long-term memory, and a small rolling event window. Begin with directed trust and grievance as simple evolving attitudes; retain evidence IDs and allow small changes and decay. Public interaction counts update immediately, but a user's private attitudes change only when that user observes the relevant event. Disagreement alone does not force hostility.

The canonical history remains factual even if a character misremembers it. Journal entries are authored in-character accounts of stated motives and reactions, not hidden model reasoning traces. The model describes observed events and its intended action; code attaches the actual publication outcome afterward. A rejected or conflicting action cannot enter memory as a completed edit. Apply only updates supported by previously observed events and the actual outcome; invalid journal or memory claims are omitted without another model call.

Proposed release rule: operators can read journals immediately; MAP-unlocked visitors can read authored entries after **48 simulated hours**, capped by the latest completed simulation time. Visibility requires `entry_time + 48 hours <= min(selected_timeline_time, latest_completed_time)`. Wall-clock passage during a pause does not unlock entries, and scrubbing backward cannot reveal journals unavailable at that historical moment. Other characters never access them. Raw prompts, responses, working memories, and diagnostics remain operator-only. This preserves the user's requested eventual visitor exploration while retaining the supplement's separation of private runtime records.

## Observer map

At `boomerrawlings.com/wiki/map`, play a skippable ten-second history animation on first unlock, ending at the latest completed cycle. Provide Replay and reduced-motion support. Do not replay on every internal navigation.

A persistent timeline supports dragging, deliberate scrolling, keyboard stepping, previous/next cycle, play/pause, and jump to present. Day 1 is September 23. Show founding events, the quiet interval, arrivals, dates, and cycle numbers.

| View | Display |
| --- | --- |
| Articles | Node area reflects word count; edges represent actual links. Search, focus, and open the selected historical article. |
| Principles | Founding principles, later explicit interpretations, and policy proposals, linked to supporting passages. |
| Relationships | Directed interactions and recorded attitudes, with evidence and clear distinction between observations and subjective interpretation. |
| Activity | Growth, longest articles, revisions per user, discussions, reversions, and unresolved disputes. |

Keep positions stable, labels readable, legends simple, and details in a focused panel. All displayed data reflects the selected moment, with no future-state leakage. Journal visibility must also respect release time.

Compute these views from stored records and incremental caches. Page visits and map interactions make **zero model calls**. Character inputs exclude observer routes, analytics, visitor activity, other journals, and operator records. Timeline navigation cannot mutate simulation state. Never ship unreleased journals, private memories, or operator logs in public HTML, JavaScript, or data assets.

## Storage and operating controls

Inspect the existing website repository and hosting before choosing implementation details. Integrate both routes into that site and preserve its existing deployment path. Keep the canonical simulation state and cycle ledger in the Codex workspace; a small local database or structured files are sufficient. Export only approved public content and map data to the website. A site-side simulation database or model service is not required.

Persist articles, immutable revisions/events, users, private journals/memories, evidence-linked relationships and principle statements, a cycle ledger with seed/usage/status, and map exports. Periodic snapshots plus events reconstruct the full historical state. Include pause/resume, rollback, error visibility, and usage accounting through Codex. Character decisions are restricted to wiki content; Codex performs the authorized publication. Characters cannot direct executable code edits, external messages, or changes to system rules.

The native usage reader and recurring-task creation tools are available in this chat. Exact recurring model/mode behavior and the website's repository/deployment access must be verified before activation. A local scheduled task that needs project files requires the computer and desktop app to be available; missed availability is handled through the ledger and catch-up process. See [official scheduled-task documentation](https://learn.chatgpt.com/docs/automations?surface=app). The current-chat task is saved paused until initial publication and the user's Sol Instant switch; the heartbeat tool has no independent model selector.

## Approval scope and delivery order

A green light on this overview authorizes implementation, historical generation, scoped website commits/pushes and deployment, and creation of the current-chat Codex recurring task with the specified usage gates. The user controls the requested initial-build and recurring model selections. No further routine approval checkpoint is proposed.

1. Verify existing source, hosting, deployment access, usage reporting, and the user's selected Codex settings.
2. Build the read-only wiki, gates, local simulation records, and deterministic validation/publication scripts.
3. Verify manual cycles, failures, conflicts, chronological history, and character/observer isolation in preview.
4. In the user's chosen build session, generate the founding session and 76 historical cycles, plus usage-gated launch catch-up if needed.
5. Build and verify the map, replay, timeline, delayed journals, and accessible navigation.
6. Deploy the verified site. Test the recurring instructions manually, verify GPT 6.1 Sol Instant selection, then create/activate the twelve-hour task in this chat. Defer incomplete work if usage or access prevents completion.

Sources: direct chat requirements, including the latest Codex-only scheduling, 15%/10% usage rules, observer-only participation, connected articles, and probability-based 3–20 users per turn; concept archive v0.1; pasted notes; supplement v0.2; official scheduled-task documentation. Retained defaults for approval include the six-user historical cast, 48-hour journal release, small bounded edits, and limited catch-up batches. All prior dollar caps, external model architecture, five-user activity cap, and ten-user population ceiling are superseded.
