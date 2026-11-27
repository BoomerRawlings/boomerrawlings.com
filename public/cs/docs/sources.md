# Source provenance and reuse

Reviewed 2026-11-27. Machine-readable [inventory](source-inventory.json) records 30 candidates, access results, licensing, selection and gaps. A public file is not automatically reusable. Uploader license declarations are preserved; they do not independently prove upstream database rights. No authentication, paywall, anti-bot or other access controls were bypassed. No direct automated HLTV collection was performed.

## Canonical bulk sources

| Source | Acquired version | Observed range | Source size before validation | Declared license |
|---|---:|---|---|---|
| [Filipe Chaves de Macedo](https://www.kaggle.com/datasets/filipechavesdemacedo/counter-strike-competitive-data) | 1 | 2012-09-13–2021-05-30 | 945,865 player-map rows; 94,591 map result rows; 14,593 source players | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Ektarr](https://www.kaggle.com/datasets/ektarr/counter-strike-pro-matches) | 12 | 2023-10-25–2026-11-21 | 12,738 non-total map rows; 6,122 source series IDs | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

Each source is downloaded through its public Kaggle versioned endpoint. `data/raw/<source>/v<version>/manifest.json` records URLs, acquisition time, sizes and SHA-256 checksums. Raw archives remain immutable. Row-level source filenames, CSV row numbers and source URLs propagate into canonical provenance. Public analytical derivatives retain source attribution and the applicable ShareAlike notice; software licensing is separate.

Filipe reports HLTV as its source and includes verifiable HLTV profile/map paths. Its `match_id` is a **mapstats identifier**, not a recovered match-series identifier. A map encounter therefore must not be counted as a known independent series. Its `kdratio` field actually contains KAST percentages. Published rating formula versions are unavailable. The player-profile snapshot is not historical biography evidence. Ninety-four thousand five hundred twenty-one distinct map IDs have player rows; result-only maps remain visible to coverage accounting.

Ektarr's original upstream provider is not established. Its source player IDs are not asserted to be HLTV IDs. Team IDs change across encounters; reconstructed team lineages are explicitly inferred from roster evidence. All-tiers files contain the tier subsets, so only the all-tiers non-total rows supply canonical maps. Series-total rows and known exhibitions are excluded. Player participation rounds are unavailable in both sources: scoreboard rounds are an explicit assumption, not an observed individual field.

No acquired source proves a professional census. The main gaps are before 2012-09-13, 2021-05-31–2023-10-24, and after 2026-11-21. Regions, lower tiers, retired players and obscure events have unknown missingness. Validity and analytical-eligibility counts are generated separately by the executed pipeline.

## Cross-source verification

The Ektarr IEM Katowice 2024 final has source match `861529`: Nuke `116915` 13–9, Mirage `116916` 13–11, Overpass `116918` 13–3; donk K/D 32/14, 24/18, 26/8, total 82/40. The [HLTV final page](https://www.hltv.org/matches/2369507/faze-vs-spirit-iem-katowice-2024) confirms maps, scores and total. The [official ESL release](https://eslfaceitgroup.com/press/intel-extreme-masters-katowice-2024-team-spirit-and-serral-crowned-new-champions-following-two-electrifying-grand-finals/) independently confirms Spirit's 3–0 final win and event date. This is a representative reconciliation, not certification of all rows.

The current HLTV final page may show recalculated Rating 3.0; the [contemporaneous article](https://www.hltv.org/news/38185/donk-stars-as-spirit-sweep-faze-to-win-iem-katowice/) reports 1.93 under the then-current system. Historical rating values and formula versions must not be silently conflated.

`data/raw/source-discovery/identity-evidence.json` contains the initial eight independently checked player crosswalks based on full legal name, alias and country. A separate review of 14 additional full-name/profile links in `config/identity-upgrade-reviewed.json` was applied through an atomic migration; `config/identity-anchors.json` now contains 22 anchors. Protected performance values and observation counts were unchanged. NiKo/Nikola Kovač and niko/Nikolaj Kristensen remain distinct. These validation anchors do not limit the collected player population. Unresolved source identities are preserved separately; matching names alone never justify a merge.

## Rejected and deferred acquisitions

- [Machado](https://www.kaggle.com/datasets/mateusdmachado/csgo-professional-matches): CC BY-NC-SA 4.0, acquired for local overlap checks only. Excluded from public canonical derivatives. Shares HLTV upstream, so agreement is not fully independent corroboration.
- [Ted Tay](https://github.com/tedtay/CS-GO-Pro-Matches-Comprehensive-Dataset): 126,872 real-looking map rows through July 2023 acquired into quarantine. Final CSV lacks player IDs; observed team/box-score alignment problems; license file belongs to a README template. Neither alias propagation nor public publication is defensible without further evidence.
- [Griffin Desroches](https://www.kaggle.com/datasets/griffindesroches/cs2-hltv-professional-match-statistics-dataset): current profile statistics attached to historical matches; rejected for future-data leakage.
- [Sergio Nefedov](https://www.kaggle.com/datasets/sergionefedov/counter-strike-competitive-scene-2012-2026): generated/interpolated, preselected player summaries; rejected as observations.
- Raymond Toh and Major summary datasets aggregate periods/events; they cannot be expanded into invented player-map histories.
- Nafis 2020–2022 could fill part of the gap but has unknown licensing. Other GitHub mirrors have unverified licensing or unavailable payloads.
- [HLTV terms](https://www.hltv.org/terms), effective 2025-01-27, section 2.2 restrict scraping/mining and similar/competitive websites. Direct bulk acquisition is not selected. Targeted public-page validation is limited and cited. A direct commercial HLTV integration would require appropriate permission.
- [Liquipedia API terms](https://liquipedia.net/api-terms-of-use) require API use, attribution, rate limits, caching and project/contact identification; LPDB requires approval. It remains a future biography/roster supplement, not a substitute for map counts.
- [Valve standings](https://github.com/ValveSoftware/counter-strike_regional_standings) are useful but distinct from HLTV top 30; historical snapshots and permissions require auditing. No published historical top-30 archive was acquired.
- [FACEIT](https://docs.faceit.com/docs/data-api/) needs authorized API credentials and a professional-competition whitelist. [PandaScore](https://developers.pandascore.co/docs/introduction) historical statistics require a paid plan. [GRID](https://grid.gg/plans/) current access is contractual. No costs were incurred.
- CounterQuant's public dataset API returned 401. Zhang's roughly 134 GB demo collection is research-use-only and contains preprocessing issues. PureSkill data is anonymized, noncommercial and prohibits reidentification. None supplies public canonical player histories here.

## Continuing acquisition

Priorities: obtain reusable stable-ID data for June 2021–October 2023; clarify Ektarr upstream provenance; acquire dated published rankings or properly licensed Valve snapshots; verify additional identity crosswalks; acquire licensed demos for participation-round validation and missing advanced fields. [Awpy](https://github.com/pnxenopoulos/awpy), [demoparser2](https://github.com/LaihoE/demoparser) and [demoinfocs](https://github.com/markus-wa/demoinfocs-golang) are MIT parser options, not licenses for input demos. Archived pages do not override source restrictions.
