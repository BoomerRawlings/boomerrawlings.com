# Campus navigation map: sources and scope

Prepared 25 September 2026. This is a navigation addition, not an expansion or revision of the crime analysis. State colors represent four geographic regions, not crime rates, safety or data completeness. The 42 institutional markers locate the institution's home directory record; they do not locate reported crimes, residences or every property in an institution's reporting scope.

## State geography

The static geometry uses the pinned [us-atlas 3.0.1 states-10m.json](https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json), a simplified redistribution of the U.S. Census Bureau's 2017 cartographic state boundaries. The [upstream versioned documentation](https://github.com/topojson/us-atlas/tree/v3.0.1) identifies this source and its limitations. The original topology is retained here as `states-10m.json` (SHA-256 `d76b391ccfa8bff601d51e3e3da5d43a89fa46cd5caca72ce731b383be5596d0`). These outlines provide geographic orientation, not property boundaries or a current legal-boundary survey.

The four-region assignment follows the [U.S. Census Bureau's regions and divisions](https://www2.census.gov/geo/pdfs/maps-data/maps/reference/us_regdiv.pdf). All 50 states and the District of Columbia appear. Alaska and Hawaii belong to the West. The study contains no institutions in Alaska or Hawaii, so the West's focused view uses the contiguous western states; both insets remain visible in the national overview.

## Institutional locations

The coordinates are exact `LONGITUD` and `LATITUDE` values for the 42 study `UNITID` records in the already-frozen [National Center for Education Statistics (NCES), Integrated Postsecondary Education Data System (IPEDS), 2024 institutional directory](https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip). This version was chosen to retain identity agreement with the established study cohort. It is not represented as a new 2026 location survey. Original `HD2024.zip` SHA-256: `d98425c123d7c0e872aec6e83960dfb501884818bf17385c340790f3d1f28345`.

`hd2024_coordinates.json` retains the original institutional name, city, state, Federal Information Processing Standards (FIPS) state code and unrounded longitude/latitude, plus the existing study names and regions. `extract_coordinates.py` documents the extraction from `HD2024.csv`. Every institutional identifier and state is checked against both the current study and its school-context file. All 42 full institutional names also match the published dataset exactly and are retained as `officialName` for accessible map labels. No address was geocoded or coordinate guessed. These public institutional locations contain no incident locations or personal data.

## Projection and presentation

`generate_map.mjs` uses [D3's Albers USA composite projection](https://d3js.org/d3-geo/conic#geoAlbersUsa), scale 1,300 and translation [487.5, 305], based on the standard 975 by 610 coordinate space. Alaska and Hawaii use insets; Alaska is deliberately reduced according to that projection. The national view bounds expand to the full projected state extent, with eight coordinate units of padding, so the western Aleutian islands are not cropped at the standard canvas edge. Screen coordinates and paths are rounded to two decimal places. No school-point offsets are applied in the asset. Region-label anchors are manual presentation positions, not geographic estimates. Region view bounds receive 25 coordinate units of padding.

The stored regional `viewBox` values describe state-boundary extents; the interactive view instead focuses the included home-campus points with padding (`schoolMapBounds`), using surrounding state geography as context, so a focused view need not show every part of a region.

The resulting `campus-map.json` has 51 state paths and 42 school points. Counts by region match the existing cohort: West 15, Midwest 7, Northeast 12, South 8. `MAP_DATA_AUDIT.json` records successful point-in-polygon checks for every school against its declared state, state/region agreement, unique identifiers and valid projected coordinates. The point-in-polygon check uses simplified state boundaries and does not establish exact reporting-property alignment.

## Reproduction and licensing

The published source package retains the topology, coordinate extract, generator, audit, source note, and dependency manifest/lockfile. In this directory:

```sh
npm ci --prefix tooling --ignore-scripts --no-audit --no-fund
node generate_map.mjs campus-map.json
```

The generated map is identical to the website's `src/data/campus-map.json`. `extract_coordinates.py` additionally supports the original study directory layout when the frozen full HD2024 archive is present. Static rendering requires no mapping-service account, remote tile request or browser mapping library. The website's runtime dependencies are unchanged.

Pinned generation packages: us-atlas 3.0.1, d3-geo 3.1.1 and topojson-client 3.1.0. Transitive versions and npm integrity hashes are recorded in `tooling/package-lock.json`. Redistribution and generation-library notices are retained in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt), including the required us-atlas ISC notice.
