# Reviewed cross-source identity upgrades

Source identifiers remain authoritative within their namespace. Display-name equality is insufficient for a canonical merge. The separately reviewed links in `config/identity-upgrade-reviewed.json` combine an exact Ektarr player ID and raw CSV row, full public professional name, alias, source country, and manually checked numeric HLTV profile identity. Country is source-CSV evidence; no independent country verification is claimed. The Igor/Ihor spelling difference for w0nderful is explicitly documented.

The proposed 14 links cover ropz, XANTARES, FalleN, dupreeh, Twistzz, EliGE, rain, Snax, flusha, b1t, sh1ro, KSCERATO, degster and w0nderful. Their public profile references and source-row checks are in the review file. These are identity-validation targets, not a population sampling filter. Other unresolved source identities remain separate.

`config/media-display-identities.json` controls media associations only. Promoting separately reviewed evidence into canonical identity is an explicit database migration and anchor update, not an implicit consequence of selecting a portrait.

## Preconditions

- All 36 populated game/quality/window cohorts have committed checkpoints.
- Crosswalk is bijective within the Ektarr source.
- Existing source mapping agrees with the reviewed source ID.
- Source and target histories have no shared game cohort; overlap requires analytical recalculation instead of this migration.
- No player-map, roster or conflicting birth-date collision.
- Unknown player foreign-key dependencies stop the migration.

## Execution and audit

Read-only inspection:

```powershell
node src/identity-upgrade.mjs
```

After analysis has finished:

```powershell
node src/identity-upgrade.mjs --apply --write-anchors
```

The database migration is one transaction. It updates canonical player references, aliases, rosters, performances, rolling windows, peak records and identity mappings; preserves observations, eligibility keys and provenance; and deletes only the superseded player entity after foreign-key enforcement permits it. Observation IDs remain immutable opaque keys even if their historical text contains an earlier identity namespace.

Before/after audit protects every affected performance, rolling window, peak and roster row with SHA-256, plus exact count and kill/death/round sum checks. Identity fields are excluded or normalized to the intended target when hashing. Smaller global table counts are checked directly. Global rolling-window count uses the atomically committed cohort insertion counts, checked against row-ID bounds: the analytical builder is append-only and the migration issues no window deletion. This avoids repeating a large disk scan unrelated to identity changes. Every changed reference is checked by SQLite foreign-key enforcement; unknown dependencies are rejected.

Hashes must agree or the transaction rolls back. Tests inject an unwanted numeric change to prove rollback. Audit is stored in `identity_upgrade_runs` and exported to `data/processed/identity-upgrade-audit.json`. Repeating a successfully recorded migration is idempotent.

The anchor-file replacement occurs separately after the database commit and is atomic within the filesystem. If that write fails, rerunning `--apply --write-anchors` reuses the successful database audit and completes the anchor update. No raw source file is rewritten.

## Required follow-up

The migration leaves `identity_upgrade_pending_rebaseline` in build metadata. Validate the audit, update the dataset version, explicitly adopt the changed input/code fingerprints with the audit rationale, and restamp existing analytical checkpoints while retaining their previous fingerprints and migration reference. Rebuild reports and browser exports. These steps must be explicit; ordinary resume guards correctly reject changed identity anchors.

Games retain their own windows and reference populations. Since each approved link unifies disjoint games only, stored per-game numerical results remain identical. A fresh calculation can differ at insignificant floating-point roundoff if renamed identities change summation order; this is distinct from changing observations, population membership or methodology. A combined historical display still must label each winning window's game and must not construct mixed-game primary windows.
