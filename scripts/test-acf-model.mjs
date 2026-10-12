import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIndex, filterItems, graphData, normalizeImport, inferredRelationship, safeUrl } from '../public/ACF/model.js';

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

test('real IEET filters include source labels, preserve missing dates, and keep graph bounded', () => {
  const data = JSON.parse(readFileSync('public/ACF/data/ieet.json','utf8'));
  const index = createIndex([data]);
  assert.equal(index.items.length,10467);
  const credit = data.credits[0], person = index.people.get(credit.personId);
  assert.ok(filterItems(index,{query:person.name}).some(i => i.id === credit.itemId));
  const scoped = filterItems(index,{scope:{kind:'person',id:person.id}});
  assert.ok(scoped.every(i => index.byItem.get(i.id).some(c => c.personId === person.id)));
  assert.ok(filterItems(index,{from:'2020'}).every(i=>i.year>=2020));
  assert.equal(filterItems(index,{from:'2026',to:'2000'}).length,0);
  for (const inferred of [false,true]) {
    const graph = graphData(index,index.items,inferred);
    assert.ok(graph.nodes.length <= 500);
    const ids = new Set(graph.nodes.map(n=>n.id));
    assert.ok(graph.edges.every(e=>ids.has(e.from)&&ids.has(e.to)));
    if (!inferred) assert.ok(graph.edges.every(e=> data.credits.some(c=>c.personId===e.from&&c.itemId===e.to)||data.relationships.some(r=>r.from===e.from&&r.to===e.to)));
    else assert.ok(graph.edges.filter(e=>e.from.startsWith('theme:')).every(e=>e.inferred));
  }
});

test('production shell has exact route, accessible controls and local assets', () => {
  const html = readFileSync('dist/ACF/index.html','utf8');
  assert.ok(html.includes('https://boomerrawlings.com/ACF/'));
  assert.ok(html.includes('id="entry-feedback" role="status"'));
  assert.ok(html.includes('id="atlas-workspace" hidden inert'));
  for (const id of ['entry-input','search','type-filter','year-from','year-to','collections-dialog','results','detail-close','themes-toggle']) assert.ok(html.includes(`id="${id}"`));
  for (const file of ['entry.js','app.js','model.js','graph.js','style.css','import-format.json','coverage.json']) assert.ok(readFileSync(`dist/ACF/${file}`).length>0);
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
});
