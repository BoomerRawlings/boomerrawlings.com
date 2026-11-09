# Wiki public data contract

Public export: `/wiki-assets/data.json`. Version 1. Only public editorial records and already released journals. Canonical private state lives in ignored `.wiki-private/` and is never exported wholesale.

```js
{
  schemaVersion: 1,
  meta: { title, foundingAt, latestCompletedAt, generatedAt, cycleCount, disclosure },
  editors: [{ id, name, joinedAt, interests: [], description }],
  principles: [{ id, title, description }],
  events: [{
    id, cycleId, timestamp, editorId,
    action, // create, expand, revise, revert, comment, policy, organize, join
    articleId, // null for join or community-wide policy
    title, summary,
    revisionId, baseRevisionId, // null when not an article revision
    body, // full resulting article body for revisions; comment text for comments/policies
    categories: [],
    principleIds: [],
    references: [] // supporting public event IDs, never future events
  }],
  cycles: [{ id, startAt, endAt, participants: [], actionCount }],
  relationships: [{ timestamp, from, to, trust, grievance, evidenceIds: [] }],
  journals: [{ id, editorId, eventId, timestamp, releasedAt, body, outcome, action?, response? }]
}
```

All timestamps ISO UTC strings. IDs stable slug strings. Event arrays ordered by fictional timestamp, then ID. Default historical cutoff is `meta.latestCompletedAt`. `meta.foundingAt` is `2026-09-23T23:00:00.000Z`. UI may derive snapshots by applying events through selected time. Join events/editor joinedAt control historical editor visibility; cycles count only if endAt <= selected time. For earlier snapshots, filter relationships by timestamp and journals by releasedAt <= selected time. No unreleased journal appears anywhere in this export.

Article markup is deliberately small: plain paragraphs, `## Heading`, unordered `- item` lists, `**bold**`, and `[[article-id|label]]` or `[[article-id]]` links. Render with escaped text, never arbitrary HTML. No raw script/HTML execution. Article links use `/wiki/?article=slug`; history/discussion/profile/recent/category/about are query views on the same route. The map has its own route and gate.

Article state is the most recent revision event through the selected time. Article-created time is its first create event. Word count excludes markup syntax. Graph links are actual wikilinks between existing articles, not arbitrary inferred edges. Backlinks derived from those links. No separate public current-articles payload is required.

The encyclopedia event feed contains accepted public actions. The map shows released editor notes, including the reasons editors give for acting or holding back and the actual outcome. Optional `action` identifies the attempted action, and `response` lists qualitative changes the editor recorded in frustration or enthusiasm. The static export is publicly fetchable. It excludes unreleased notes, raw actor memory, raw mood values, generation prompts, hidden reasoning traces, usage samples, and operator errors.

The root agent owns this contract. Coordinate schema changes before implementation divergence.

Optional burst fields are `meta.scheduledCycleCount`, `meta.burstRoundCount`, and cycle `mode` (`burst` or `burst-covered`) plus `coveredBy` on the covered interval. `meta.cycleCount` counts exported cycle records, including the explicit coverage marker. Observer labels distinguish regular editorial cycles from additional weekend rounds. A coverage marker has no participants or actions.

Comments may include `threadId` and `replyTo`, referencing an observed earlier comment on the same article. Fictional outside-input records, per-editor exposure logs, and `outsideReferences` stay private.

Relationships may contain optional `affection`, `attraction`, `jealousy`, `closeness`, and `boundaries` values within 0–1, plus `explanation` and `releasedAt`. These are directional personal observations. Higher boundaries means firmer desired interpersonal limits. Personal values and explanations are omitted until 48 simulated hours after their timestamp. Historical views apply `releasedAt <= selected time` again, separately from the existing trust/grievance scores. The absence of a personal value means no released observation, not a zero feeling.
