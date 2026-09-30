import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// Run the shipped geometry helper, using every actual profile and its direct
// neighborhood. Browser QA separately checks text metrics and real hit targets.
const sourceArg = process.argv.find(value => value.startsWith('--root='));
const root = sourceArg ? resolve(sourceArg.slice(7)) : fileURLToPath(new URL('../public/ead/', import.meta.url));
const reportArg = process.argv.find(value => value.startsWith('--report='));
const atlas = JSON.parse(readFileSync(resolve(root, 'data/china-map.json'), 'utf8'));
const context = {};
context.window = context;
runInNewContext(readFileSync(resolve(root, 'network-layout.js'), 'utf8'), context, {filename:'network-layout.js'});
const layoutApi = context.LEONetworkLayout;
assert(layoutApi && typeof layoutApi.layout === 'function' && typeof layoutApi.capacity === 'function' && typeof layoutApi.page === 'function', 'Missing network geometry/paging API');
const allIds = atlas.entities.map(entity => entity.id);
const neighbors = new Map(allIds.map(id => [id, new Set()]));
const incident = new Map(allIds.map(id => [id, []]));
for (const edge of atlas.connections) {
  neighbors.get(edge.source).add(edge.target);
  neighbors.get(edge.target).add(edge.source);
  incident.get(edge.source).push(edge);
  incident.get(edge.target).push(edge);
}
const widths = [280, 320, 390, 480, 699, 700, 800, 1000, 1099, 1100, 1440];
const stats = {profiles:allIds.length, relationships:atlas.connections.length, widths, layouts:0, cards:0, connectors:0, overviewPages:0, focusedPages:0, cases:[]};
const tolerance = 0.001;
const intersects = (a, b, gap = 0) => a.x + a.width + gap > b.x + tolerance && b.x + b.width + gap > a.x + tolerance && a.y + a.height + gap > b.y + tolerance && b.y + b.height + gap > a.y + tolerance;
function validateRect(rect, outer, label) {
  for (const key of ['x','y','width','height']) assert(Number.isFinite(rect[key]), `${label}: ${key} is not finite`);
  assert(rect.width > 0 && rect.height > 0, `${label}: empty bounds`);
  assert(rect.x >= -tolerance && rect.y >= -tolerance && rect.x + rect.width <= outer.width + tolerance && rect.y + rect.height <= outer.height + tolerance, `${label}: outside ${outer.width}x${outer.height}: ${JSON.stringify(rect)}`);
}
function pathPoints(path) {
  assert.equal(typeof path, 'string', 'Connector path missing');
  const tokens = path.match(/[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  const points = [];
  let i = 0, current = {x:0,y:0}, command;
  const number = () => {
    const n = Number(tokens[i++]);
    assert(Number.isFinite(n), `Invalid SVG coordinate in ${path}`);
    return n;
  };
  while (i < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[i])) command = tokens[i++];
    assert(['M','L','H','V','C','Q'].includes(command), `Add verifier support for SVG command ${command}`);
    if (command === 'M' || command === 'L') current = {x:number(),y:number()};
    else if (command === 'H') current = {x:number(),y:current.y};
    else if (command === 'V') current = {x:current.x,y:number()};
    else {
      const a = current, b = {x:number(),y:number()}, c = {x:number(),y:number()};
      const d = command === 'C' ? {x:number(),y:number()} : c;
      for (let step = 1; step <= 32; step++) {
        const t = step / 32, u = 1 - t;
        points.push(command === 'C'
          ? {x:u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x,y:u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y}
          : {x:u*u*a.x + 2*u*t*b.x + t*t*c.x,y:u*u*a.y + 2*u*t*b.y + t*t*c.y});
      }
      current = d;
    }
    points.push(current);
  }
  assert(points.length >= 2, `Connector has no line: ${path}`);
  return points;
}
function segmentCrossesInterior(a, b, rect) {
  // Liang–Barsky clipping against the rectangle's interior; touching its border
  // is allowed, but crossing another profile's card is not.
  const x0 = rect.x + 0.1, x1 = rect.x + rect.width - 0.1;
  const y0 = rect.y + 0.1, y1 = rect.y + rect.height - 0.1;
  let lo = 0, hi = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p,q] of [[-dx,a.x-x0],[dx,x1-a.x],[-dy,a.y-y0],[dy,y1-a.y]]) {
    if (p === 0) { if (q < 0) return false; }
    else {
      const t = q / p;
      if (p < 0) lo = Math.max(lo,t); else hi = Math.min(hi,t);
      if (lo > hi) return false;
    }
  }
  return true;
}
function verify(ids, centerId, width, description) {
  const input = {width,ids,centerId};
  const result = layoutApi.layout(input);
  assert.equal(result.width, width, `${description}: preserve container width`);
  assert(Number.isFinite(result.height) && result.height > 0, `${description}: height`);
  assert(Array.isArray(result.nodes) && Array.isArray(result.connectors), `${description}: missing node/connector arrays`);
  assert.deepEqual(Array.from(result.nodes, node => node.id).sort(), [...ids].sort(), `${description}: every input profile appears once`);
  assert.equal(new Set(result.nodes.map(node => node.id)).size, ids.length, `${description}: duplicate node`);
  for (const node of result.nodes) {
    validateRect(node,result,`${description}/${node.id}`);
    assert(node.width >= 160 && node.height >= 44, `${description}: usable card dimensions`);
  }
  for (let a = 0; a < result.nodes.length; a++) for (let b = a + 1; b < result.nodes.length; b++) assert(!intersects(result.nodes[a],result.nodes[b],2), `${description}: overlapping cards ${result.nodes[a].id} / ${result.nodes[b].id}`);
  const expectedNeighbors = new Set(ids.filter(id => id !== centerId));
  assert.equal(result.connectors.length, centerId ? expectedNeighbors.size : 0, `${description}: one visual connection per neighbor; discovery grid contains no hairball`);
  const connected = new Set();
  for (const connector of result.connectors) {
    assert(centerId && (connector.source === centerId || connector.target === centerId), `${description}: connection must involve focused profile`);
    const neighborId = connector.source === centerId ? connector.target : connector.source;
    assert(expectedNeighbors.has(neighborId) && !connected.has(neighborId), `${description}: duplicate/unknown visual neighbor`);
    connected.add(neighborId);
    validateRect(connector.badge,result,`${description}/badge/${neighborId}`);
    for (const node of result.nodes) assert(!intersects(connector.badge,node), `${description}: relationship badge overlaps ${node.id}`);
    const points = pathPoints(connector.path);
    for (const point of points) assert(Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= -tolerance && point.y >= -tolerance && point.x <= result.width + tolerance && point.y <= result.height + tolerance, `${description}: connector leaves canvas`);
    for (const node of result.nodes.filter(node => node.id !== connector.source && node.id !== connector.target)) {
      for (let index = 1; index < points.length; index++) assert(!segmentCrossesInterior(points[index-1],points[index],node), `${description}: connector to ${neighborId} crosses ${node.id}`);
    }
  }
  for (let a = 0; a < result.connectors.length; a++) for (let b = a + 1; b < result.connectors.length; b++) assert(!intersects(result.connectors[a].badge,result.connectors[b].badge), `${description}: relationship badges overlap`);
  stats.layouts++;
  stats.cards += result.nodes.length;
  stats.connectors += result.connectors.length;
  return result;
}
for (const width of widths) {
  for (const focused of [false,true]) {
    const capacity = layoutApi.capacity(width,focused);
    assert(Number.isInteger(capacity) && capacity > 0 && capacity <= 24, `${width}: bounded positive capacity`);
  }
  const capacity = layoutApi.capacity(width,false), discovered = new Set();
  const overview = layoutApi.page({ids:allIds,width,page:0});
  assert.equal(overview.totalPages,Math.ceil(allIds.length/capacity),`${width}: discovery page count`);
  for (let page = 0; page < overview.totalPages; page++) {
    const result = layoutApi.page({ids:allIds,width,page});
    const ids = Array.from(result.ids);
    assert.equal(result.page,page,`${width}: requested discovery page`);
    assert(ids.length <= capacity && ids.length > 0,`${width}: bounded nonempty discovery page`);
    verify(ids,null,width,`${width}/overview/${page}`);
    ids.forEach(id => { assert(!discovered.has(id),'Overview duplicate');discovered.add(id); });
    stats.overviewPages++;
  }
  assert.equal(discovered.size,allIds.length,`${width}: every profile reachable in discovery pages`);
  for (const centerId of allIds) {
    const candidateIds = [...neighbors.get(centerId)], retained = new Set(), records = new Set();
    const pageSize = layoutApi.capacity(width,true);
    const ids = [centerId,...candidateIds];
    const focused = layoutApi.page({ids,centerId,width,page:0});
    assert.equal(focused.totalPages,Math.max(1,Math.ceil(candidateIds.length/pageSize)),`${centerId}: focused page count`);
    for (let page = 0; page < focused.totalPages; page++) {
      const result = layoutApi.page({ids,centerId,width,page});
      assert.equal(result.page,page,`${centerId}: requested focused page`);
      assert.equal(result.ids.filter(id=>id===centerId).length,1,`${centerId}: focus retained exactly once`);
      const pageIds = Array.from(result.ids).filter(id=>id!==centerId);
      assert(pageIds.length <= pageSize,`${centerId}: bounded neighbor count`);
      verify(Array.from(result.ids),centerId,width,`${width}/${centerId}/${page}`);
      for (const id of pageIds) {
        assert(!retained.has(id), `${centerId}: repeated neighbor`);
        retained.add(id);
        for (const edge of incident.get(centerId)) if (edge.source === id || edge.target === id) records.add(edge.id);
      }
      stats.focusedPages++;
    }
    assert.equal(retained.size,candidateIds.length,`${centerId}: every direct neighbor retained`);
    assert.equal(records.size,incident.get(centerId).length,`${centerId}: all parallel relationship records retained by complete neighbor pages`);
  }
  verify([],null,width,`${width}/empty`);
  verify(['isolated'],'isolated',width,`${width}/isolated`);
  assert.deepEqual(JSON.parse(JSON.stringify(layoutApi.page({ids:[],width,page:-5}))),{ids:[],page:0,totalPages:1},`${width}: empty page recovery`);
  assert.deepEqual(JSON.parse(JSON.stringify(layoutApi.page({ids:['isolated','isolated'],centerId:'isolated',width,page:99}))),{ids:['isolated'],page:0,totalPages:1},`${width}: isolated and duplicate focus recovery`);
  assert.equal(layoutApi.page({ids:allIds,width,page:-1}).page,0,`${width}: previous page clamp`);
  assert.equal(layoutApi.page({ids:allIds,width,page:999}).page,overview.totalPages-1,`${width}: next page clamp`);
}
for (const id of ['lab-tongyi-deepresearch','org-dd7c056cfc26','org-88293fa677ea']) stats.cases.push({id,name:atlas.entities.find(entity=>entity.id===id).name,neighbors:neighbors.get(id).size,relationshipRecords:incident.get(id).length});
const longest = atlas.entities.reduce((a,b)=>a.name.length > b.name.length ? a : b);
stats.cases.push({id:longest.id,name:longest.name,nameLength:longest.name.length});
const sample = {width:1100,ids:['focus','a','b','c','d','e','f'],centerId:'focus'};
assert.equal(JSON.stringify(layoutApi.layout(sample)),JSON.stringify(layoutApi.layout(sample)),'Layout must be deterministic');
assert.deepEqual(sample.ids,['focus','a','b','c','d','e','f'],'Layout must not mutate its input');
const atlasSource = readFileSync(resolve(root,'atlas.js'),'utf8');
assert(!/Start with Yue Zhang/i.test(atlasSource),'Remove the special Yue onramp');
assert(!/Number\([^)]*\.id\s*===?\s*['"]r-yue-zhang-westlake['"]/.test(atlasSource),'Remove the special Yue sorting preference');
if (reportArg) {
  const reportPath = resolve(reportArg.slice(9));
  mkdirSync(dirname(reportPath),{recursive:true});
  writeFileSync(reportPath,`${JSON.stringify({...stats,status:'passed'},null,2)}\n`);
}
console.log(`Verified EAD network geometry: ${stats.layouts} layouts across ${widths.length} widths, ${allIds.length} profiles, ${stats.connectors} clear visual connections; all direct-neighbor and parallel-record pages preserved.`);
