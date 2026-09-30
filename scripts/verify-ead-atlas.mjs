import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

// Release-data integrity only. Interaction and responsive checks run in the browser.
const output = fileURLToPath(new URL('../dist/ead/', import.meta.url));
const dist = dirname(output);
const origin = 'https://boomerrawlings.com';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const read = path => readFileSync(resolve(output, path), 'utf8');
const load = path => {
  assert(existsSync(resolve(output, path)), `EAD atlas: ${path} missing; build the site first`);
  return JSON.parse(read(path));
};
const atlas = load('data/china-map.json');
const geography = load('data/china-outline.json');
const items = (value, label) => {
  check(Array.isArray(value) && value.length > 0, `${label}: expected a nonempty array`);
  return Array.isArray(value) ? value : [];
};
function index(value, label) {
  const rows = items(value, label);
  const map = new Map();
  for (const row of rows) {
    check(row && nonempty(row.id), `${label}: missing ID`);
    if (!row) continue;
    check(!map.has(row.id), `${label}: duplicate ID ${row.id}`);
    map.set(row.id, row);
  }
  return map;
}
function source(value, label) {
  try {
    const url = new URL(value);
    check(['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname), `${label}: invalid public source URL`);
  } catch { failures.push(`${label}: missing or invalid public source URL`); }
}
function references(values, targets, label, required = false) {
  check(Array.isArray(values) && (!required || values.length > 0), `${label}: expected ${required ? 'nonempty ' : ''}reference array`);
  if (!Array.isArray(values)) return;
  check(new Set(values).size === values.length, `${label}: duplicate references`);
  for (const id of values) check(targets.has(id), `${label}: unresolved reference ${id}`);
}
let imageCount = 0;
function image(value, label) {
  if (value == null || value === '') return;
  let url;
  try { url = new URL(value, `${origin}/ead/`); }
  catch { failures.push(`${label}: invalid image URL`); return; }
  check(url.origin === origin, `${label}: image must be self-hosted (${value})`);
  if (url.origin !== origin) return;
  let path;
  try { path = resolve(dist, `.${decodeURIComponent(url.pathname)}`); }
  catch { failures.push(`${label}: malformed image path`); return; }
  const local = relative(dist, path);
  const inside = !isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`);
  check(inside && existsSync(path) && statSync(path).isFile(), `${label}: image missing from dist (${value})`);
  imageCount++;
}

const entities = index(atlas.entities, 'atlas entities');
const connections = index(atlas.connections, 'atlas connections');
const locations = index(atlas.locations, 'atlas locations');
const topics = index(atlas.topics, 'atlas topics');
for (const row of locations.values()) {
  check(nonempty(row.name), `location ${row.id}: missing name`);
  check(Number.isFinite(row.lat) && row.lat >= -90 && row.lat <= 90, `location ${row.id}: invalid latitude`);
  check(Number.isFinite(row.lon) && row.lon >= -180 && row.lon <= 180, `location ${row.id}: invalid longitude`);
}
for (const row of topics.values()) check(nonempty(row.label) && nonempty(row.summary), `topic ${row.id}: missing label or summary`);
for (const row of entities.values()) {
  const label = `entity ${row.id}`;
  check(nonempty(row.name) && ['person', 'lab'].includes(row.type), `${label}: missing name or unsupported type`);
  check(nonempty(row.bio) && nonempty(row.reason), `${label}: missing research summary or inclusion basis`);
  source(row.sourceUrl, `${label} source`);
  for (const field of ['providedBioSourceUrl', 'imageSourceUrl']) if (row[field] != null) source(row[field], `${label} ${field}`);
  if (nonempty(row.providedBio)) source(row.providedBioSourceUrl, `${label} quoted description source`);
  references(row.topicIds, topics, `${label} topics`, true);
  if (row.locationId != null) {
    check(locations.has(row.locationId), `${label}: unresolved location ${row.locationId}`);
    check(nonempty(row.locationBasis), `${label}: mapped location lacks its basis`);
    source(row.locationSourceUrl, `${label} location source`);
  } else if (row.locationSourceUrl != null) source(row.locationSourceUrl, `${label} location source`);
  if (row.locationIds != null) {
    references(row.locationIds, locations, `${label} locations`);
    if (row.locationId != null) check(row.locationIds.includes(row.locationId), `${label}: primary location absent from locationIds`);
  }
  if (row.locationScope != null) check(['china', 'external', 'unmapped'].includes(row.locationScope), `${label}: unrecognized location scope`);
  image(row.imageUrl, label);
}
for (const row of connections.values()) {
  const label = `connection ${row.id}`;
  check(entities.has(row.source) && entities.has(row.target), `${label}: missing endpoint ${row.source} / ${row.target}`);
  check(row.source !== row.target, `${label}: self-connection`);
  check(['documented', 'inferred'].includes(row.kind), `${label}: relationship basis must be explicit`);
  check(nonempty(row.label) && nonempty(row.basis), `${label}: missing explanation`);
  source(row.sourceUrl, `${label} evidence`);
}

check(geography.type === 'FeatureCollection', 'geography: expected GeoJSON FeatureCollection');
source(geography.meta?.sourceUrl, 'geography provenance');
source(geography.meta?.licenseUrl, 'geography license');
const featureIds = new Set();
let positions = 0;
for (const feature of items(geography.features, 'geography features')) {
  const id = feature.properties?.id;
  check(nonempty(id) && !featureIds.has(id), `geography: missing or duplicate feature ID ${id}`);
  featureIds.add(id);
  check(feature.type === 'Feature', `geography ${id}: expected Feature`);
  const geometry = feature.geometry;
  check(['Polygon', 'MultiPolygon'].includes(geometry?.type), `geography ${id}: unsupported geometry`);
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.coordinates;
  for (const polygon of items(polygons, `geography ${id} polygons`)) {
    for (const ring of items(polygon, `geography ${id} rings`)) {
      check(Array.isArray(ring) && ring.length >= 4, `geography ${id}: incomplete ring`);
      if (!Array.isArray(ring)) continue;
      for (const point of ring) {
        check(Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90, `geography ${id}: invalid coordinate`);
        positions++;
      }
      check(JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1)), `geography ${id}: open polygon ring`);
    }
  }
}
check(featureIds.has('CHN'), 'geography: central China feature missing');

const tree = parse(read('workspace.html'));
const nodes = [tree];
for (let i = 0; i < nodes.length; i++) nodes.push(...(nodes[i].childNodes ?? []));
const attrs = node => Object.fromEntries((node?.attrs ?? []).map(({name, value}) => [name, value]));
const hasClass = (node, name) => (attrs(node).class ?? '').split(/\s+/).includes(name);
const within = (node, ancestor) => {
  for (let parent = node?.parentNode; parent; parent = parent.parentNode) if (parent === ancestor) return true;
  return false;
};
const text = node => node?.nodeName === '#text' ? node.value : (node?.childNodes ?? []).map(text).join('');
const tabs = nodes.filter(node => node.tagName === 'nav' && hasClass(node, 'tabs'));
check(tabs.length === 1, 'index: expected one primary view selector');
const tabButtons = nodes.filter(node => node.tagName === 'button' && within(node, tabs[0]));
check(JSON.stringify(tabButtons.map(node => attrs(node)['data-view'])) === JSON.stringify(['atlas', 'implementation', 'observations', 'sources']), 'index: expected Atlas, Implementation, Findings, Catalogue tabs in order');
const byId = new Map(nodes.filter(node => attrs(node).id).map(node => [attrs(node).id, node]));
for (const id of ['atlas-view', 'atlas-root', 'implementation-view', 'observations-view', 'sources-view']) check(byId.has(id), `index: missing ${id}`);
check(within(byId.get('atlas-root'), byId.get('atlas-view')), 'index: atlas mount outside its view');
check(!Object.hasOwn(attrs(byId.get('atlas-view')), 'hidden') && attrs(tabButtons[0])['aria-current'] === 'page', 'index: Atlas must be the initial view');
const mastheads = nodes.filter(node => hasClass(node, 'masthead'));
const brands = nodes.filter(node => hasClass(node, 'brand') && within(node, mastheads[0]));
check(mastheads.length === 1 && brands.length === 1 && text(brands[0]).replace(/\s+/g, '') === 'LEO', 'index: masthead brand must contain LEO only');
check(!nodes.some(node => hasClass(node, 'brand-name') && within(node, mastheads[0])), 'index: expanded brand duplicates LEO in masthead');

if (failures.length) throw new Error(`EAD atlas: ${failures.length} integrity failure(s)\n${[...new Set(failures)].slice(0, 40).join('\n')}`);
console.log(`Verified EAD atlas: ${entities.size} profiles, ${connections.size} sourced relationships, ${topics.size} topics, ${locations.size} locations, ${imageCount} local images, ${positions} geographic coordinates, four views and LEO masthead.`);
