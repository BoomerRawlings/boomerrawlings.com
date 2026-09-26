/** Generate navigation-only SVG geometry. No production/browser dependency added.
 * Reproduce: npm ci --prefix tooling --ignore-scripts; node generate_map.mjs
 * Source coordinates are the documented 42-row extract from frozen NCES HD2024.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { geoAlbersUsa, geoPath, geoContains } from './tooling/node_modules/d3-geo/src/index.js';
import { feature } from './tooling/node_modules/topojson-client/src/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '../../../boomerrawlings.com');
const outputPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(site, 'src/data/campus-map.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = rel => fs.readFileSync(path.join(here, rel));
const topoBytes = read('states-10m.json');
assert.equal(sha(topoBytes), 'd76b391ccfa8bff601d51e3e3da5d43a89fa46cd5caca72ce731b383be5596d0');
const topology = JSON.parse(topoBytes);
const coordinates = JSON.parse(read('hd2024_coordinates.json'));
const regionStates = {
  West: 'AK AZ CA CO HI ID MT NV NM OR UT WA WY'.split(' '),
  Midwest: 'IL IN IA KS MI MN MO NE ND OH SD WI'.split(' '),
  Northeast: 'CT ME MA NH RI VT NJ NY PA'.split(' '),
  South: 'DE DC FL GA MD NC SC VA WV AL KY MS TN AR LA OK TX'.split(' '),
};
const stateCodes = Object.fromEntries([
  ['01','AL'],['02','AK'],['04','AZ'],['05','AR'],['06','CA'],['08','CO'],['09','CT'],['10','DE'],
  ['11','DC'],['12','FL'],['13','GA'],['15','HI'],['16','ID'],['17','IL'],['18','IN'],['19','IA'],
  ['20','KS'],['21','KY'],['22','LA'],['23','ME'],['24','MD'],['25','MA'],['26','MI'],['27','MN'],
  ['28','MS'],['29','MO'],['30','MT'],['31','NE'],['32','NV'],['33','NH'],['34','NJ'],['35','NM'],
  ['36','NY'],['37','NC'],['38','ND'],['39','OH'],['40','OK'],['41','OR'],['42','PA'],['44','RI'],
  ['45','SC'],['46','SD'],['47','TN'],['48','TX'],['49','UT'],['50','VT'],['51','VA'],['53','WA'],
  ['54','WV'],['55','WI'],['56','WY'],
]);
const stateRegion = Object.fromEntries(Object.entries(regionStates).flatMap(([region, states]) => states.map(abbr => [abbr, region])));
const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const draw = geoPath(projection).digits(2);
const round = number => Math.round(number * 100) / 100;
const features = feature(topology, topology.objects.states).features.filter(state => stateCodes[state.id]);
assert.equal(features.length, 51);
const states = features.map(state => ({
  id: state.id, name: state.properties.name, abbr: stateCodes[state.id], region: stateRegion[stateCodes[state.id]],
  path: draw(state), centroid: draw.centroid(state).map(round),
}));
// Composite Alaska extends beyond the conventional 975-wide canvas at the Aleutian islands.
const [[nationalX0,nationalY0],[nationalX1,nationalY1]] = draw.bounds({ type: 'FeatureCollection', features });
const nationalViewBox = [nationalX0-8,nationalY0-8,nationalX1-nationalX0+16,nationalY1-nationalY0+16].map(round);
assert(features.every(state => {
  const [[x0,y0],[x1,y1]] = draw.bounds(state);
  return x0 >= nationalViewBox[0] && y0 >= nationalViewBox[1]
    && x1 <= nationalViewBox[0]+nationalViewBox[2] && y1 <= nationalViewBox[1]+nationalViewBox[3];
}), 'A state geometry lies outside the national viewBox');
const projectedSchools = coordinates.institutions.map(school => {
  const point = [school.longitude, school.latitude];
  const state = features.find(item => item.id === school.stateFips);
  assert(state, `Missing state ${school.name}`);
  assert.equal(stateCodes[state.id], school.state, `State FIPS mismatch ${school.name}`);
  assert.equal(stateRegion[school.state], school.region, `Census region mismatch ${school.name}`);
  assert(geoContains(state, point), `Point outside declared state: ${school.name} ${school.state}`);
  const projected = projection(point);
  assert(projected && projected.every(Number.isFinite), `Unprojectable coordinate ${school.name}`);
  assert(projected[0] > 0 && projected[0] < 975 && projected[1] > 0 && projected[1] < 610);
  return { ...school, x: round(projected[0]), y: round(projected[1]), source: 'nces-hd2024' };
});
assert.equal(projectedSchools.length, 42);
assert.equal(new Set(projectedSchools.map(school => school.id)).size, 42);
// Label anchors are presentation positions, not measured geographic centroids.
const labelAnchors = { West: [238, 243], Midwest: [550, 222], Northeast: [830, 165], South: [626, 398] };
const regions = Object.keys(regionStates).map(region => {
  // West zoom intentionally excludes Alaska/Hawaii insets. Neither has a cohort institution;
  // both remain clickable West states on the national overview.
  const chosen = features.filter(state => stateRegion[stateCodes[state.id]] === region && !['AK','HI'].includes(stateCodes[state.id]));
  const [[x0,y0],[x1,y1]] = draw.bounds({ type: 'FeatureCollection', features: chosen });
  const padding = 25;
  const xmin = Math.max(0,x0-padding), ymin = Math.max(0,y0-padding);
  const xmax = Math.min(975,x1+padding), ymax = Math.min(610,y1+padding);
  return { id: region, name: region, viewBox: [xmin,ymin,xmax-xmin,ymax-ymin].map(round),
    label: labelAnchors[region], schoolCount: projectedSchools.filter(school => school.region === region).length };
});
const sources = [
  { id: 'us-atlas', label: 'Census-derived U.S. state boundaries, us-atlas 3.0.1 (2017 Census cartographic boundaries)',
    url: 'https://github.com/topojson/us-atlas', dataUrl: 'https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json',
    sha256: sha(topoBytes), license: 'ISC', licenseUrl: '/data-analysis/campus-safety/current-2026-09-25/map_navigation/THIRD_PARTY_LICENSES.txt' },
  coordinates.source,
  { id: 'census-regions', label: 'U.S. Census Bureau regions and divisions',
    url: 'https://www2.census.gov/geo/pdfs/maps-data/maps/reference/us_regdiv.pdf' },
];
const output = {
  schemaVersion: 1, width: 975, height: 610, viewBox: nationalViewBox,
  projection: { type: 'Albers USA', scale: 1300, translate: [487.5,305], alaskaHawaiiInsets: true },
  scope: 'Navigation by institutional home location; points do not locate crimes or delineate reporting property. Region colors identify geography, not safety or data availability.',
  states, schools: projectedSchools, regions, sources,
};
const outputBytes = JSON.stringify(output) + '\n';
fs.writeFileSync(outputPath, outputBytes);
const licenseParts = ['us-atlas', 'd3-geo', 'topojson-client', 'd3-array', 'internmap', 'commander'].map(name => {
  const info = JSON.parse(read(`tooling/node_modules/${name}/package.json`));
  return `${name} ${info.version}\n${'='.repeat(name.length + info.version.length + 1)}\n${read(`tooling/node_modules/${name}/LICENSE`).toString('utf8').trim()}\n`;
});
fs.writeFileSync(path.join(here, 'THIRD_PARTY_LICENSES.txt'),
  'The state geometry derives from us-atlas. The remaining packages were used only to generate the static map asset; no mapping library is loaded in the browser.\n\n' + licenseParts.join('\n'));
const report = {
  status: 'PASS', source: 'Frozen NCES IPEDS HD2024 institutional directory and Census-derived us-atlas 3.0.1',
  stateCount: states.length, schoolCount: projectedSchools.length,
  checks: ['42 unique cohort UNITIDs', 'IPEDS state = study state = existing school-context home state',
    '42 full official institutional names matched to the published dataset during extraction',
    '42 points contained within declared simplified Census state polygons',
    '42 home states assigned to matching Census region', '42 finite projected points within national viewBox',
    'Full projected extent of all 51 state/DC geometries inside national viewBox, including Aleutian islands',
    '50 states plus District of Columbia', 'Alaska and Hawaii retained in national West; excluded only from contiguous West zoom'],
  regionCounts: Object.fromEntries(regions.map(region => [region.id, region.schoolCount])),
  coordinatesSha256: sha(read('hd2024_coordinates.json')), topologySha256: sha(topoBytes),
  assetSha256: sha(outputBytes), assetBytes: Buffer.byteLength(outputBytes),
};
fs.writeFileSync(path.join(here, 'MAP_DATA_AUDIT.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
