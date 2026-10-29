# Continuous collection runbook

Goal: 400 independently approved camera originals for **each eligible class in the frozen roster**, not just the five pilots. Current scope is 67 classes /26,800 originals; the roster remains provisional. Never reduce quality or fill a deficit with duplicates, derivatives, unverified labels or unclear permissions.

## Codex usage gate

The user authorized continuing collection with **Codex interface usage** as the work limit. Use `get_usage_limits` at the start, before each bounded collection/review batch, and at least every ten minutes during active work. Use `rateLimitsByLimitId` when available; inspect the applicable Codex primary/secondary windows. Remaining percentage is `100 - usedPercent`. Null windows are unavailable, not zero usage; at least one applicable window must be readable.

- If any applicable window has **less than20% remaining**, or ordinary usage is disallowed: start no new work, stop collection workers and subagents, checkpoint, and pause this chat's SUBS heartbeat. Notify the user once with remaining usage and the reported reset time. Do not restart after reset without the user's instruction.
- If usage cannot be read: do not start collection; pause the heartbeat and report the unavailable meter. Never invent a token balance.
- Check again before dispatching another agent or batch. Keep source-download batches to eight originals or ten minutes, whichever occurs first; smaller batches near the threshold.

This is a tool-checked account usage guard, not an exact token counter or provider-enforced hard cap. Python cannot read Codex account limits. Do not add a paid model API or purchase credits. Existing infrastructure limits remain in place independently of the Codex work budget.

## Resume instead of restarting

1. Read `.codex/STATE.md`; compare repository, live API counts and the last private batch checkpoint. Never re-import the same photograph as a new record.
2. Refresh collection counts/known original URLs from the authenticated API into ignored local storage. Keep the fleet/service snapshot frozen. Resolve roster additions separately.
3. Resume the shared campaign. Give unstarted classes a first source probe before repeating large pilot searches. Supplement class/alias searches with exact hull/category queries and legitimately independent providers.
4. Export new candidates. **Metadata leads are not approvals.** Review exact author/license/permission evidence before permitting original downloads. Reject interiors, models, wrong classes and known undersized files early. Preserve uncertain cases as holds.
5. Run paced, resumable original acquisition. Respect shared provider cooldowns and `Retry-After`; no multiple workers or alternate URLs to evade throttling. Multiple providers may proceed independently when their permissions and limits allow it.
6. Inspect native pixels, annotate the actual target, and record longitudinal subject length. Frame≥1200px, subject≥400px, no upscaling. Check bytes, decode/orientation, sharpness, source-native detail and class features. Preserve originals; derived crops/previews never count.
7. A separate agent verifies class, rights and native quality. Source captions alone do not prove useful class features. Use shared event groups, conservative unknown dates/variants, and global byte/pixel/whole/target duplicate comparisons.
8. Sync only verified qualifying records using scoped collector/verifier credentials. Keep pending/restricted assets private. Verify new public-original hashes/dimensions and access controls; repeat sync must add zero counts/assets.
9. Publish a provisional balanced release only after at least two classes each have100 eligible camera originals in the same rights tier. Maintain separate camera/satellite and commercial/research exports. Required audit follows release publication.
10. Close bounded jobs and save per-class approved/400, candidate counts, failures, source yields, usage checkpoint and the next work item. Notify only on meaningful approved progress, a release, a failure or required user action; stay quiet on unchanged/non-actionable runs.

Do not let a large candidate backlog consume all work. Every pass should prioritize ready native reviews/independent verifications alongside discovery. First reach useful verified coverage across all classes, then expand toward400; keep scarce-class deficits visible. Candidate queues alone are not success.

## Portable campaign commands

From the project root, using the toolkit's Python environment:

```sh
python tools/subs/subs.py campaign-plan --classes public/subs/active.json --existing .subs-data/campaign/live-images.json --campaign .subs-data/campaign/global-20261027-v2 --extra-queries .subs-data/campaign/source-research/extra-queries.json
python tools/subs/subs.py campaign-discover --campaign .subs-data/campaign/global-20261027-v2 --max-requests 25 --max-candidates 1000 --interval-seconds 10
python tools/subs/subs.py campaign-status --campaign .subs-data/campaign/global-20261027-v2
python tools/subs/subs.py campaign-export --campaign .subs-data/campaign/global-20261027-v2 --output .subs-data/campaign/candidates.jsonl
```

The campaign saves source cursors and deduplicates existing/previously discovered original URLs. A repeated hit for another class is an unverified class claim, not a new photograph. All permission flags stay false until exact-source review. Campaign discovery downloads metadata only; it does not approve images or inflate the live dashboard. Keep SQLite, downloaded media, source evidence and private manifests out of Git.

Private candidate metadata may be synced to the review API in bounded, idempotent passes, with all permission flags false. These records affect candidate totals only; no media or approvals accompany them. Refresh known IDs/source URLs first, preserving already reviewed records. Keep full class-claim/discovery evidence in the private checkpoint.

Inspect source file history and embedded capture dimensions during selection. A largest-available download may still be a source crop or resized export. Recover the camera original or hold unresolved provenance. Source-page previews can cheaply reject unsuitable framing, but never establish native quality or count toward the quota.
