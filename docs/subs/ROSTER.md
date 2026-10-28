# Initial fleet snapshot

Snapshot: **2026-10-27**. Coverage: **in review**, 67 class/design records. This is an evidence-backed starting roster, not a certified exhaustive global inventory. No automatic service-status refresh.

`src/data/subs/active.json` is canonical; `public/subs/active.json` is its identical public copy. Stable IDs survive display-name changes. Every `historical_types` value maps exactly to the retained historical catalog. Project 877 and Project 636 remain separate; Yuan variants remain tags. The five pilot IDs are `virginia`, `los-angeles`, `type-212a`, `kilo-877`, `yuan`.

## Eligibility and interpretation

- At least one commissioned boat, including boats under refit. Military rescue and special-purpose crewed submersibles use operational induction into a military service as the corresponding criterion; they do not always have warship commissioning ceremonies.
- Operator arrays contain only operators supported in the present pass, not every operator of a design. Design-origin countries are separate. A class can qualify through one verified operator while other operator claims remain unresolved.
- `service.as_of` is the snapshot decision date, not the publication date of every cited source. Evidence includes official fleet pages, recent service announcements, and published specialist inventories where official inventories are unavailable. A source URL does not by itself establish current readiness, photograph identity or image permissions.
- No deployment, position or readiness tracking. A commissioned class under refit is not claimed to be ready for use.
- Launch, delivery, trials, orders and projected service dates do not independently establish commissioning. No civilian research/tourist craft, paper designs, uncrewed vehicles or rescue motherships.
- Recognition families can contain visibly distinct variants. Kawasaki's DSRV family follows the retained historical grouping; individual generations require variant identification before training. Export design families also need variant review before balancing classes.

## Additional evidence checked in this pass

| Class | Basis for inclusion or strengthened evidence |
| --- | --- |
| Ming / Type 035 | Bangladesh Navy's current recruiting inventory explicitly lists two Ming-class craft: https://joinnavy.navy.mil.bd/ and https://joinnavy.navy.mil.bd/Platforms/ . Other operator assertions remain outside this record until separately reviewed. |
| URF | Swedish Defence Materiel Administration reports return to service after refit, 20 February 2026: https://www.fmv.se/aktuellt--press/aktuella-handelser/urf-ater-i-beredskap-efter-omfattande-modifieringar/ |
| JFD Indian DSRV | India's defence ministry records the rescue unit in the September 2025 exercise: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2173604&lang=2&reg=48 . Design supplier established by https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1551790&lang=2&reg=48 . |
| Kawasaki DSRV | Current JMSDF equipment inventory: https://www.mod.go.jp/msdf/equipment/ships/asr/chiyoda/ ; manufacturer family: https://www.khi.co.jp/mobility/marine/ships/submarine.html ; September 2025 exercise corroborated by the Indian ministry above. |
| DSAR 500 | Singapore defence ministry identifies DSAR 6 in September 2025: https://www.mindef.gov.sg/news-and-events/latest-releases/22sep25-nr/ . Builder's class relationship and continuing support: https://www.james-fisher.com/media/wpso1ms3/singapore_subrescue_capability_rv-1.pdf . South Korean DSAR 5 operator/variant requires a separate current-status check. |
| LR5 | Current provider case study identifies the Australian Navy rescue system: https://content.james-fisher.com/news-and-insights/case-studies/submarine-rescue-services-for-the-royal-australian-navy-ran/ . Official exercise corroboration: https://www.defence.gov.au/news-events/news/2023-03-07/teamwork-key-submarine-rescue-exercise . |
| Dry Combat Submersible | US government FY2025 report records initial operational capability and delivered craft: https://www.dote.osd.mil/Portals/97/pub/reports/FY2025/ussocom/2025dcs.pdf?ver=Yt68BQfcDlqoSpQIxpHCMw%3D%3D . 2026 acquisition review: https://files.gao.gov/reports/GAO-26-108036/index.html . |
| Rubis | July 2026 government command decree and September 2026 Navy article support continued service of Amethyste: https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054441250 and https://www.colsbleus.defense.gouv.fr/fr/chesapeake-catherine-vautrin-prend-la-parole . |
| Suffren / Triomphant | June 2026 procurement announcement explicitly distinguishes delivery from earlier boats' admission to active service: https://www.defense.gouv.fr/dga/actualites/dga-livre-marin-nucleaire-dattaque-grasse-marine-nationale-0 . September 2026 Senate report confirms the Triomphant class: https://www.senat.fr/rap/r25-950/r25-95013.html . |
| Japanese attack classes | Current official subordinate-force inventory complements equipment pages: https://www.mod.go.jp/msdf/sbf/subordinate/index.html . |
| Hangor | Government report of first commissioned-class boat joining the fleet, June 2026: https://www.radio.gov.pk/11-06-2026/first-hangor-class-submarine-pnsm-hangor-arrives-in-karachi . |

Full evidence URLs for all records are in `classes[].service.evidence`; historical design sources remain in the historical catalog. None of these links grants an image license by association.

## Unresolved queue and exclusions

These entries are not silently counted as retired, and are not yet promoted into the active roster. The queue is deliberately incomplete: finish country-by-country reconciliation before calling coverage complete.

| Candidate | Required resolution |
| --- | --- |
| Iran: Ghadir, Fateh, Nahang; Iranian Kilo operator | Reconcile surviving commissioned inventory against 2026 losses/refits using dated evidence. Older commissioning articles alone are insufficient for this snapshot. |
| Pakistan MG-110 / Cosmos | Confirm at least one still commissioned craft. The official submarine-force summary describes historical types without resolving current MG-110 status: https://www.paknavy.gov.pk/subsurface_force . |
| China Type 091 Han, Type 092 Xia, Type 032 Qing | Distinguish commissioned training/test boats from retirement, reserve and trials. No assumption that non-combat service equals decommissioned. |
| China LR7 | Obtain a current official or builder service record. Historical builder delivery/training evidence establishes existence, not present eligibility. |
| Russia Projects 1855 Priz, 18270 Bester, 18271 Bester-1 | Reconcile rescue craft service records and variants. Spanish Navy's October 2024 journal provides a useful Priz lead: https://armada.defensa.gob.es/archivo/rgm/2024/10/rgmoct2024_Parte04.pdf . Current class status needs a focused check. |
| Russia Projects 1851, 18511, 1910, 10831, 20120, 09786, 09787 | Resolve commissioned roll versus repair, reserve or retirement; avoid guessing from readiness. The 2026 specialist inventory discusses uncertainty: https://www.naval-review.com/news-views/russian-navy-submarine-force-in-2026/ . |
| Myanmar/China Ming; additional Project 877 and Type 209 operators | Expand operator metadata only with supported current evidence. Missing operators do not remove a class already qualifying elsewhere. |
| Taiwan Haikun; Russia Khabarovsk; future designs | Remain outside active scope until commissioning evidence is established. Trials or launch alone do not qualify. |
| Wet swimmer-delivery vehicles and tethered rescue modules | Resolve taxonomy consistently before expansion. Existing DCS, crewed rescue submersibles and historical entries remain; this pass does not imply all military underwater devices are submarine classes. |

Before global collection, strengthen remaining older NTI/general fleet references, reconcile all historical modern designs against the active roster, record explicit exclusion decisions, and independently review class/variant boundaries. Snapshot updates are deliberate new versions; they must not relabel previously frozen releases silently.
