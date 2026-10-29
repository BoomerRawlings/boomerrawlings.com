# Scaling source discovery

Verified 2026-10-28. Metadata research only: **19 Commons API requests, 74,214 response bytes; zero image downloads, zero approvals, zero paid services.** Browser research requests are separate, not included in those measured API totals. No credentials, login workarounds, or source-media URL guessing used.

## Immediate increase: class → operator → hull queries

The existing `discover_commons` implementation searches one text query, capped at 1,000 results. It follows continuation within that invocation, but returns only `continuation_available`, losing the actual cursor between runs. Broad class searches therefore omit hull-named photographs and restart previously searched ranges.

Live category metadata demonstrates a larger search space:

| Verified Commons category | Immediate contents | Further coverage |
| --- | --- | --- |
| [Virginia class submarines](https://commons.wikimedia.org/wiki/Category:Virginia_class_submarines) | 28 hull categories, 17 files | Hull categories: 760 direct file memberships, 15 nested categories |
| [Los Angeles class submarines](https://commons.wikimedia.org/wiki/Category:Los_Angeles_class_submarines) | 62 hull categories, 49 files | Hull categories: 2,245 direct file memberships, 20 nested categories |
| [Type 212 submarine](https://commons.wikimedia.org/wiki/Category:Type_212_submarine) | Germany, Italy, video categories; one file | Germany: six hull categories/28 direct files; Italy: four hull categories |
| [Kilo class submarines](https://commons.wikimedia.org/wiki/Category:Kilo_class_submarines) | 20 categories, 27 files | Indian branch: six categories/11 files; Iranian branch: four categories/three files |
| [Type 039A submarines](https://commons.wikimedia.org/wiki/Category:Type_039A_submarines) | Five files, no subcategories | Four photographs, one SVG |

These are **file memberships, not unique photographs or qualifying originals**. Categories contain insignia, models, interiors, crops, drawings, video and misidentifications. Historic photographs of retired hulls remain useful when their class is eligible. Kilo category membership does not distinguish Project 877 from 636 reliably; the Type 212 root also contains a Type 212CD illustration.

Local reusable input: `.subs-data/campaign/source-research/extra-queries.json`, mapping class IDs to 136 verified `incategory:"..."` queries: Virginia29, Los Angeles63, Type212A13, Kilo87730, Yuan1. Video-only category branches excluded. All query assignments remain unverified search claims.

The exact category names matter: hyphenated guesses for Virginia/Los Angeles returned empty successful responses. Resolve category names/page IDs before marking a source exhausted.

## Adapter order

1. **Persistent Commons worklist.** Save query/category, actual continuation, request count, next eligible request time and globally seen page IDs. Traverse scoped subcategories with a visited set. Round-robin classes; retain unresolved/zero-yield sources visibly.
2. **Cheap metadata first.** Resolve IDs, original URL, dimensions, MIME, size and SHA-1; request rich rights/source metadata only for shortlisted files. Native SHA-256/pixel/perceptual checks remain necessary after download. [Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo) documents original `url` separately from scaled `iiurlwidth` output and warns that `extmetadata` is expensive. [Categorymembers](https://www.mediawiki.org/wiki/API:Categorymembers) supplies IDs and `cmcontinue`; an empty page with continuation is not exhaustion.
3. **One polite source queue.** Preserve the locally proven 65-second original-download spacing and immediate 429/Retry-After defer. Metadata and pixel budgets stay separate. Parallelize review, not competing requests to the same source host.
4. **DVIDS structured adapter when access is available.** Search hull names/identifiers, preserve VIRIN and event/date fields, resolve full-original metadata, then apply existing acceptance gates. Avoid repeatedly paging the same capped result set.
5. **Targeted official/photographer sources for scarce classes.** Record access/rights blocks explicitly. Escalating search breadth does not increase native resolution or grant permission.

## Original-resolution routes and limits

| Source | Verified capability | Collection decision |
| --- | --- | --- |
| Commons | Unauthenticated `imageinfo` returns source-original URL, dimensions, bytes, MIME and rights metadata. | Ready now. Original URL remains a candidate until downloaded bytes/native detail, rights, subject size and label pass verification. Never use `thumburl`. |
| DVIDS | [Asset API](https://api.dvidshub.net/docs/asset_api) defines `image` as full-resolution image URL and `dimensions` as original dimensions; `thumbnail` is separate. [API introduction](https://api.dvidshub.net/docs) requires obtaining an access key through signup/login. | Documented lawful route; no key obtained or API acquisition tested here. Existing unauthenticated download restriction does not mean the source has no supported original API. |
| DVIDS search | [Search API](https://api.dvidshub.net/docs/search_api): 50/page maximum; pages beyond 1,000 results repeat the last valid page. Hull/date partitions, stable asset IDs and cursor bookkeeping needed. | Discover images only; never count video frame captures. Preserve credit and check the source's [copyright exceptions](https://api.dvidshub.net/docs/copyright). |
| Flickr | [getSizes](https://www.flickr.com/services/api/flickr.photos.getSizes.html) needs an API key but no user authentication for public eligible photos. [URL documentation](https://www.flickr.com/services/api/misc.urls.html) explains that originals require an independently supplied original secret/format. | Use returned `Original` URLs when permitted. Do not invent `_o` URLs from thumbnail secrets. Exact photo license and API access terms are separate; [commercial API use may require arrangement](https://www.flickr.com/services/api/). |
| U.S. Navy/AFPIMS | Search indexed a primary [USS New Mexico article](https://www.nsw.navy.mil/PRESS-ROOM/News/News-Submitter/Article/3266246/submariners-seals-join-forces-on-uss-new-mexico) with a high-resolution download control; opening it returned403. | Metadata lead only. No working anonymous original resolver proved here; do not infer an original path or bypass403. Prefer permitted Commons mirrors or documented DVIDS resolution. |

Existing Iowa DVIDS HTML illustrates the thumbnail trap: `og:image` points to `1000w_q95.jpg`; Twitter metadata points to `2000w_q95.jpg`. A large social preview is still a derivative. The API's distinct full-resolution field is the relevant route.

## Global rights discovery

- **UK MOD:** Only individually OGL-marked images are pre-cleared; other imagery may be editorial-only. Official [copyright policy](https://www.defenceimagery.mod.uk/help/copyright.html) identifies the downloadable high-resolution subset. Current [download UI](https://www.defenceimagery.mod.uk/Home/Search?Type=Advanced) includes CAPTCHA/terms; record a manual-access block, not an automated workaround.
- **Netherlands:** NIMH provides [free downloadable collection files subject to conditions](https://www.nimh.nl/zelf-onderzoek-doen/beeld--en-filmmateriaal). Its [copyright page](https://www.nimh.nl/service/copyright) explicitly excludes photographs from the website's general CC0 declaration. Resolve each object's terms; do not transfer a website/text license to photographs.
- **Australia:** Current [Defence imagery policy](https://www.defence.gov.au/copyright) describes personal/noncommercial unaltered use under BY-NC-ND and separate permission for external uses. This is not a blanket source for training/crop/public-dataset rights. Existing explicit per-image grants must be assessed separately.
- **Allied vessels in U.S. official imagery:** Search exact hull names, pennants, exercises and visits across operating countries. U.S. hosting or a generic public-domain template alone does not resolve a contrary third-party credit. Discover widely; verify individual source authority.

## Yuan: measured scarcity, not a lowered threshold

The four photographs in the exact Commons root resolve to original metadata of 3000×1996, 3000×1996, 442×167 and919×533. Two fail the frame-size requirement before any download. The remaining two still need all other checks. Existing primary-source recovery outside this category already contributes to the collection; these are not four new photos.

Search aliases Type039A/039B/039C, Yuan and historically used Type041, plus documented visits/photographer albums. Treat ambiguous aliases as discovery only. Preserve variants; do not merge Song/Type039, Project636, illustrations or modern unverified designs into Yuan. No evidence here establishes that400 free qualifying originals exist.

## Evidence retained locally

Ignored `.subs-data/campaign/source-research/` contains response JSON and request/byte ledgers: `metadata-probes.json`, `category-search-ledger.json`, `correct-category-ledger.json`, `hull-categoryinfo-ledger.json`, `operator-category-ledger.json`, `original-metadata-ledger.json`, plus `extra-queries.json`. No source-media bytes downloaded. The measured original-metadata probe used page IDs24023767,24023739,20674081,31477318 with `prop=imageinfo&iiprop=url|size|mime|sha1|extmetadata`; all returned200.

Source IDs, category totals and published dimensions remain **discovery evidence**. Only unchanged downloaded originals passing the established rights, native quality, deduplication, identification and independent verification workflow increase approved/400.
