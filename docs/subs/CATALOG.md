# Catalog scope and audit

User scope: military classes and unique prototypes only. No individual hull inventory, civilian/tourist craft, paper-only proposals, unmanned vehicles, diving bells or human torpedoes. Military rescue and crewed special-purpose designs are included. Begun construction qualifies even when the class was subsequently canceled.

Each record contains a type/design name, design-origin country and evidence URLs. Web rows expose only type and country; the Sources dialog collects raw URLs. Sources are preferred in this order: government/navy, designer/builder, institutional history, specialist historical catalogs, general historical indexes. Historical secondary lists are not presented as official registries.

Origin is not every operator or construction yard. Imported classes remain under the original design origin. Meaningful national redesigns and documented distinctive export designs have separate rows; routine refits/production blocks and renamed transfers are generally grouped. This boundary varies with the historical evidence. Source notes record ambiguity. Historical entities are retained where relevant; Cuba's disputed attribution is visible.

## Cross-region review

- Regional research: `research-europe.md`, `research-major.md`, `research-asia-civil.md` (military scope; no civilian dataset).
- Independent name/alias audit found no confirmed cross-region duplicates. Repeated letter-class labels across countries are distinct designs.
- Review filled early gaps: Fulton Nautilus, Nordenfelt designs, Drebbel prototypes, and the E1/Gür prototype. Hai Lung is a documented Dutch export modification, distinct from the Zwaardvis parent.
- Final supplemental review added [Matros Pyotr Koshka](https://www.navypedia.org/ships/russia/ru_ss_matros_pyotr_koshka.htm), a constructed military experiment which did not commission. Its omission noted in the major-region report is resolved.
- Added Nagapasa / DSME 1400: [Indonesian Navy design lineage](https://tnial.mil.id/assets/majalah/PDF-20240913-153619.pdf), [Defence Ministry construction and modernization account](https://www.kemhan.go.id/itjen/2017/08/03/tni-punya-kapal-selam-canggih-buatan-korsel-kri-nagapasa.html). Classified as the Korean export redesign; German Type 209 parent retained separately.
- Keta excluded as a semi-submersible surface torpedo boat; the [Rubin historical account](https://ckb-rubin.ru/en/media_centre/rubin_in_publications/signle_news/news/detail/News/submersible_destroyers/) explicitly calls it semi-submersible. It is not an unreviewed missing submarine entry.

## Coverage limits

Broad historical inventory, not a certified complete census. Public evidence cannot establish all secret/obscure prototypes. Minor variants, early experimental designs and export-family boundaries may need further separation as evidence improves. Do not replace this qualification with an unsupported “every submarine ever” claim. No invented placeholders fill uncertain gaps.

Maintain regional JSON as the source of truth. `catalog.mjs` merges exact duplicates and sorts names; source notes stay internal. `verify-subs-catalog.mjs` checks all evidence fields, every rendered type/country pair, raw source labels and the unlisted sitemap boundary. Browser and behavior tests cover search/filter composition, pagination and source dialog access.
