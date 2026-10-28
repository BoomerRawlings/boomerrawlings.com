# Initial source pilot — 2026-10-27

Five independently reviewed camera originals, one per pilot class. Each meets the native-image and subject-size floors. This validates collection and review, not classifier accuracy or class completeness. No balanced training release is yet eligible; every pilot class still needs 399 approved originals.

## Bounded discovery

First Wikimedia Commons query per class; at most 100 returned files. Counts are search results, including possible wrong subjects, drawings, interiors and duplicate representations. Preliminary size/license filtering does not establish approval.

| Class | Candidate files | Original size ≥1200px and preliminary open-license metadata | Accepted pilot originals |
|---|---:|---:|---:|
| Virginia | 100 | 92 | 1 |
| Los Angeles | 100 | 85 | 1 |
| Type 212A | 78 | 68 | 1 |
| Project 877 Kilo | 100 | 49 | 1 |
| Yuan | 25 | 3 | 1 |

Search totals are bounded query yields, not estimates of all available imagery. A replacement Virginia original was separately selected after a rights conflict. Unreviewed discovery records remain local; only reviewed source evidence and approved pixels may be public.

## Verified originals

| Class | Native dimensions | Visible subject length | Source / constraints |
|---|---|---:|---|
| Virginia | 2100 × 1500 | 1200px | [USS New Hampshire, Navy Jeremy Lambert, 2008-10-19](https://commons.wikimedia.org/wiki/File:US_Navy_081019-N-6553L-174_The_Virginia-class_attack_submarine_USS_New_Hampshire_(SSN_778)_is_turned_by_tug_boats.jpg); public domain; tug obstruction |
| Los Angeles | 2100 × 1378 | 2000px | [USS Columbia, Navy John Watts, 2003-06-06](https://commons.wikimedia.org/wiki/File:US_Navy_030606-N-3707W-001_The_crew_of_the_Los_Angeles-class_attack_submarine_USS_Columbia_(SSN_771)_moor_the_submarine_to_a_Pearl_Harbor_pier.jpg); public domain; partial bow/sail |
| Type 212A | 2009 × 825 | 1800px | [Stahlkocher, HDW](https://commons.wikimedia.org/wiki/File:U_Boot_212_HDW_1.jpg); CC BY-SA 3.0; drydock crane obstruction, date unknown |
| Project 877 Kilo | 3000 × 2400 | 2750px | [U.S. Navy source, 1987-03-10](https://commons.wikimedia.org/wiki/File:Submarine_Kilo_class.jpg); public domain; photographer unknown; date predates Project 636 construction |
| Yuan | 3000 × 1996 | 1350px | [Joint Staff visit, 2011-07-13](https://commons.wikimedia.org/wiki/File:Chinese_Type_041_submarine.jpg); CC BY 2.0; partial sail, variant unknown |

Original bytes are preserved; crops/previews are separately identified derivatives with license attribution. Older historical configurations are allowed for a currently eligible class. Partial views are explicitly tagged; these five examples do not establish sufficient viewpoint diversity.

The first Virginia candidate remains held: its Navy-style public-domain tag conflicts with General Dynamics Electric Boat authorship. It is excluded from upload, acceptance and release until permissions are resolved. A source tag alone is insufficient rights evidence.

## Observed limitations

- Yuan's narrow query returned only three preliminary large/open candidates. No promise of 400; broaden source discovery and deduplicate before estimating feasible yield.
- Frame dimensions alone miss small subjects, blur, enlargements and irrelevant images. Automated decoding/crop/sharpness checks plus separate visual/evidence review are required.
- Source dates, hull identity and variants remain unknown unless supported. The Kilo photograph's date supports 877 rather than 636; Yuan's historical “Type 041” filename is not a modern Zhou-class label.
- No satellite image has qualified. Free Sentinel-2 optical bands are 10–60m, exceeding the agreed ≤0.5m/pixel floor; resampling cannot repair this. [Official mission documentation](https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html). Eligible free high-resolution acquisitions and their permissions remain a separate research task.
- Human release audit starts after an eligible provisional release exists. No threshold was lowered to publish these five images as a balanced release.

## Reproduction and next batch

Use `tools/subs` discovery, ingestion, scoped sync and independent verification. Keep local originals/manifests outside Git. Record query bounds, rejected reasons, rights evidence, capture events and duplicates. Expand the five pilot classes before broader collection; only release when two or more classes independently reach 100 eligible originals in the same rights tier.
