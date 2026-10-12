import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIndex, filterItems, graphData, normalizeImport, inferredRelationship, safeUrl, THEMES, GRAPH_BOUNDS } from '../public/ACF/model.js';

test('imports drop private/free-text fields and reject unprovenanced relations', () => {
  const raw = { catalog: { label: 'Test', secret: 'private' }, items: [{id:'a',title:'AI and climate',url:'https://example.org/a',abstract:'private',email:'private',date:'2020'}], people:[{id:'p',name:'A Label',email:'private'}], credits:[{itemId:'a',personId:'p',role:'editor',sourceUrls:['https://example.org/a']}] };
  const data = normalizeImport(raw, 'local-1');
  assert.equal(JSON.stringify(data).includes('private'), false);
  assert.equal(data.credits[0].role, 'editor');
  assert.notEqual(data.people[0].id, normalizeImport(raw,'local-2').people[0].id);
  assert.throws(() => normalizeImport({...raw,credits:[{...raw.credits[0],personId:'missing'}]},'local-1'),/unknown/);
  assert.throws(() => normalizeImport({...raw,relationships:[{from:'a',to:'a'}]},'local-1'),/sourceUrls/);
  assert.throws(() => normalizeImport([{title:'No source'}],'local-1'),/URL/);
  for (const url of ['javascript:alert(1)','file:///x','http://127.0.0.1/','https://user:secret@example.org','http://localhost']) assert.equal(safeUrl(url),'');
});

test('real IEET filters include source labels and graph retains every record, name and source edge', () => {
  const data = JSON.parse(readFileSync('public/ACF/data/ieet.json','utf8'));
  const index = createIndex([data]);
  assert.equal(index.items.length,10467);
  const credit = data.credits[0], person = index.people.get(credit.personId);
  assert.ok(filterItems(index,{query:person.name}).some(i => i.id === credit.itemId));
  const scoped = filterItems(index,{scope:{kind:'person',id:person.id}});
  assert.ok(scoped.every(i => index.byItem.get(i.id).some(c => c.personId === person.id)));
  assert.ok(filterItems(index,{from:'2020'}).every(i=>i.year>=2020));
  assert.equal(filterItems(index,{from:'2026',to:'2000'}).length,0);
  const graph = graphData(index,index.items);
  assert.equal(graph.nodes.filter(n=>n.kind==='item').length,data.items.length);
  assert.equal(graph.nodes.filter(n=>n.kind==='person').length,data.people.length);
  assert.equal(graph.nodes.filter(n=>n.kind==='hub').length,THEMES.length);
  const ids = new Set(graph.nodes.map(n=>n.id));
  assert.equal(ids.size,graph.nodes.length);
  assert.ok(graph.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
  const credits = graph.edges.filter(e=>e.type==='credit');
  const sourceCredits = new Map(data.credits.map(c=>[JSON.stringify([c.personId,c.itemId,c.role]),c]));
  assert.equal(credits.length,data.credits.length);
  for (const edge of credits) {
    const source = sourceCredits.get(JSON.stringify([edge.from,edge.to,edge.role]));
    assert.ok(source); assert.deepEqual(edge.sourceUrls,source.sourceUrls); assert.equal(edge.inferred,false);
  }
  assert.equal(graph.edges.filter(e=>e.type==='relationship').length,data.relationships.length);
  assert.ok(graph.edges.filter(e=>e.type==='theme').every(e=>e.inferred&&e.from.startsWith('@theme:')));
  assert.equal(graphData(index,index.items,false),graph,'Rendering layers do not regenerate or remove graph data');
  assert.equal(graphData(index,[...index.items].reverse()),graph,'A full view reuses the index graph regardless of order');
});

test('production shell has exact route, accessible controls and local assets', () => {
  const html = readFileSync('dist/ACF/index.html','utf8');
  assert.ok(html.includes('https://boomerrawlings.com/ACF/'));
  assert.ok(html.includes('id="entry-feedback" role="status"'));
  assert.ok(html.includes('id="atlas-workspace" hidden inert'));
  for (const id of ['entry-input','search','type-filter','year-from','year-to','collections-dialog','results','detail-close','themes-toggle']) assert.ok(html.includes(`id="${id}"`));
  for (const file of ['entry.js','app.js','model.js','graph.js','style.css','import-format.json','coverage.json']) assert.ok(readFileSync(`dist/ACF/${file}`).length>0);
});

test('updated Atlas markup loads one version of its changed assets for returning visitors', () => {
  const html = readFileSync('dist/ACF/index.html','utf8');
  const css = new URL(html.match(/href="(\/ACF\/style\.css[^\"]*)"/)[1], 'https://boomerrawlings.com');
  const app = new URL(html.match(/src="(\/ACF\/app\.js[^\"]*)"/)[1], 'https://boomerrawlings.com');
  const entry = new URL(html.match(/src="(\/ACF\/entry\.js[^"]*)"/)[1], 'https://boomerrawlings.com');
  const version = css.searchParams.get('v');
  assert.ok(version, 'changed CSS must bypass a previous release cached under its plain URL');
  assert.equal(app.searchParams.get('v'), version);
  assert.equal(entry.searchParams.get('v'), version, 'entrance markup must not execute a cached previous entrance script');
  for (const [file, dependencies] of [['app.js', ['graph.js', 'node-preview.js', 'model.js']], ['node-preview.js', ['preview-data.js']], ['preview-data.js', ['model.js']]]) {
    const source = readFileSync('dist/ACF/' + file, 'utf8');
    for (const dependency of dependencies) assert.ok(source.includes(`'./${dependency}?v=${version}'`), `${file} must load the same release of ${dependency}`);
  }
});

test('all catalogs preserve unknown titles and distinguish uncertain relationships from explicit links', () => {
  const directory = JSON.parse(readFileSync('public/ACF/data/index.json','utf8'));
  const data = directory.catalogs.map(e => JSON.parse(readFileSync('public/ACF/data/'+e.file,'utf8')));
  const index = createIndex(data);
  assert.equal(index.items.length,33945);
  assert.equal(index.people.size,7361);
  assert.equal(index.relationships.filter(inferredRelationship).length,130);
  assert.equal(inferredRelationship({kind:'links_to',basis:'explicit_source_link: no identity inference'}),false);
  const missing = index.byId.get('c4ss:item:07e5bdc771a765a9999c');
  assert.equal(missing.title,'Untitled source record');
  assert.doesNotThrow(() => graphData(index,[missing]));
  const graph = graphData(index,index.items);
  assert.equal(graph.nodes.length,33945+7361+6);
  assert.equal(graph.counts.items,33945);
  assert.equal(graph.counts.people,7361);
  assert.equal(graph.counts.orphanPeople,[...index.people.keys()].filter(id=>!index.byPerson.has(id)).length);
  assert.equal(graph.edges.filter(e=>e.type==='credit').length,43213);
  assert.equal(graph.edges.filter(e=>e.type==='relationship').length,17348);
  assert.equal(graph.edges.filter(e=>e.type==='relationship'&&e.inferred).length,130);
  assert.equal(graph.edges.filter(e=>e.type==='theme').length,index.items.reduce((sum,item)=>sum+item.themes.length,0));
  assert.equal(graph.byId.size,graph.nodes.length);
  assert.equal(graph.adjacency.size,graph.nodes.length);
  assert.deepEqual(graph.bounds,GRAPH_BOUNDS);
  for (const node of graph.nodes) {
    assert(Number.isFinite(node.x)&&Number.isFinite(node.y));
    assert(node.x>=graph.bounds.left&&node.x<=graph.bounds.right&&node.y>=graph.bounds.top&&node.y<=graph.bounds.bottom);
  }
  const edgeSet=new Set(graph.edges),adjacencyCounts=new Map();
  for (const [id,edges] of graph.adjacency) for (const edge of edges) {
    assert(edgeSet.has(edge)&&(edge.from===id||edge.to===id));
    adjacencyCounts.set(edge,(adjacencyCounts.get(edge)||0)+1);
  }
  for(const edge of graph.edges) assert.equal(adjacencyCounts.get(edge),edge.from===edge.to?1:2);
  const sourceRelations=new Set(index.relationships),relationCounts=new Map();
  for(const [id,relations] of index.relationshipsByItem) for(const relation of relations) {
    assert(sourceRelations.has(relation)&&(relation.from===id||relation.to===id));
    relationCounts.set(relation,(relationCounts.get(relation)||0)+1);
  }
  for(const relation of index.relationships) assert.equal(relationCounts.get(relation),relation.from===relation.to?1:2);
  const ieet = data.find(c=>c.catalog.id==='ieet'), single = createIndex([ieet]);
  for (const node of graphData(single).nodes) {
    const original=graph.byId.get(node.id);
    assert.equal(node.x,original.x); assert.equal(node.y,original.y);
  }
  const selected = filterItems(index,{query:'climate',from:'2010'}), filtered = graphData(index,selected);
  assert.equal(filtered.counts.items,selected.length);
  assert.equal(filtered.nodes.filter(n=>n.kind==='item').length,selected.length);
  assert.equal(filtered.bounds,graph.bounds);
  for (const node of filtered.nodes) {
    const original=graph.byId.get(node.id);
    assert.equal(node.x,original.x); assert.equal(node.y,original.y);
  }
  for (const edge of filtered.edges) assert(edgeSet.has(edge),'Filtering retains cached source edge objects');
  assert.equal(index.graph,graph,'Filtering does not replace the full cached graph');
});

test('overlapping theme membership has literal title evidence and does not invent source links', () => {
  const data=normalizeImport({items:[{id:'minds',title:'AI and transhuman rights on Earth: digital futures',url:'https://example.org/work',sourceUrls:['https://example.org/evidence']},{id:'plain',title:'Unclassified record',url:'https://example.org/plain'}],people:[{id:'p',name:'Uncredited label'}]},'theme');
  const index=createIndex([data]),graph=graphData(index),item=index.byId.get('theme:minds');
  assert.equal(item.themes.length,6,'One record may belong to all six inferred title groups');
  assert.equal(graph.counts.orphanPeople,1,'Uncredited catalog name labels remain represented in the complete graph');
  assert.equal(graph.nodes.filter(n=>n.kind==='person').length,1);
  assert(graph.byId.has('theme:minds')&&graph.byId.has('@theme:minds'),'Virtual theme IDs cannot collide with imported namespaced IDs');
  assert.equal(graph.edges.length,6);
  for (const edge of graph.edges) {
    assert.equal(edge.type,'theme'); assert.equal(edge.inferred,true);
    assert.equal(edge.evidence.field,'title'); assert.deepEqual(edge.sourceUrls,['https://example.org/evidence']);
    assert(edge.evidence.terms.length>0);
    for(const term of edge.evidence.terms) assert(item.title.includes(term));
    const region=graph.regions.find(region=>region.id===edge.from);
    assert.deepEqual(region.memberIds,[item.id]); assert.equal(region.count,1);
    assert.match(region.basis,/not documented affiliation/);
  }
  const filtered=graphData(index,[index.byId.get('theme:plain')]);
  assert.equal(filtered.nodes.length,1); assert.equal(filtered.edges.length,0);
  assert(filtered.regions.every(region=>region.count===0));
  assert.deepEqual(filtered.regions.map(({id,x,y,radiusX,radiusY})=>({id,x,y,radiusX,radiusY})),graph.regions.map(({id,x,y,radiusX,radiusY})=>({id,x,y,radiusX,radiusY})));
  assert.deepEqual(graphData(index,[]).nodes,[]);
});

test('catalog-local IDs remain distinct and source relationships cannot disappear through invalid endpoints', () => {
  const make=namespace=>normalizeImport({items:[{id:'a',title:'Same title',url:'https://example.org/a'}],people:[{id:'p',name:'Same name'}],credits:[{itemId:'a',personId:'p',role:'editor',sourceUrls:['https://example.org/a']}]},namespace);
  const left=make('left'),right=make('right'),index=createIndex([left,right]);
  assert.equal(graphData(index).counts.items,2); assert.equal(graphData(index).counts.people,2);
  assert.throws(()=>createIndex([left,left]),/Duplicate catalog/);
  assert.throws(()=>createIndex([left,{...right,items:left.items}]),/Duplicate.*item/);
  const broken=createIndex([{...left,relationships:[{from:'left:a',to:'missing',kind:'links_to',sourceUrls:['https://example.org/a']}]}]);
  assert.throws(()=>graphData(broken),/unknown endpoint/);
});
