import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createIndex, graphData, normalizeImport, THEMES } from '../public/ACF/model.js';
import { compareTerritories } from '../public/ACF/comparison.js';

const url = 'https://example.org/source';
const ids = values => [...values].sort();
function fixture() {
  return createIndex([normalizeImport({catalog:{label:'One'},
    items:[
      {id:'a',title:'AI',date:'2024',type:'article',url},
      {id:'b',title:'Climate',date:'2025',type:'event',url},
      {id:'c',title:'AI and climate',date:'2025',type:'article',url},
      {id:'d',title:'Other words',date:'2024',type:'article',url},
    ],
    people:[{id:'one',name:'Same Name'},{id:'two',name:'Shared record only'}],
    credits:[
      {itemId:'a',personId:'one',role:'author',sourceUrls:[url]},
      {itemId:'a',personId:'one',role:'editor',sourceUrls:[url]},
      {itemId:'b',personId:'one',role:'speaker',sourceUrls:[url]},
      {itemId:'c',personId:'two',role:'author',sourceUrls:[url]},
    ],
    relationships:[
      {from:'a',to:'b',kind:'related_article',basis:'Editorial card, not citation',sourceUrls:[url]},
      {from:'c',to:'b',kind:'possibly_same_event',basis:'Possible match',sourceUrls:[url]},
      {from:'a',to:'d',kind:'links_to',basis:'Source link',sourceUrls:[url]},
      {from:'c',to:'c',kind:'links_to',basis:'Self reference',sourceUrls:[url]},
    ]},'one'), normalizeImport({catalog:{label:'Two'},
      items:[{id:'a',title:'AI',url}],people:[{id:'one',name:'Same Name'}],
      credits:[{itemId:'a',personId:'one',role:'author',sourceUrls:[url]}]},'two')]);
}

test('two selected territories partition exact IDs once, including overlap and unmatched',()=>{
  const index=fixture(), result=compareTerritories(index,'minds','planet');
  assert.deepEqual(ids(result.leftOnly),['one:a','two:a']);
  assert.deepEqual(ids(result.rightOnly),['one:b']);
  assert.deepEqual(ids(result.shared),['one:c']);
  assert.equal(result.records.length,4);
  assert.equal(result.memberIds.size,result.leftOnly.size+result.rightOnly.size+result.shared.size);
  assert.equal(compareTerritories(index,'minds','minds'),null);
  assert.equal(compareTerritories(index,'missing','minds'),null);
  assert.deepEqual(ids(compareTerritories(index,'minds','unmatched').rightOnly),['one:d']);
});

test('shared credit evidence never merges equal names or invents a record relationship',()=>{
  const result=compareTerritories(fixture(),'minds','planet');
  assert.equal(result.sharedPeople.length,2);
  const person=result.sharedPeople.find(p=>p.id==='one:person:one');
  assert.equal(person.leftCount,1,'roles count unique records');
  assert.equal(person.leftCredits.length,2,'both roles retain source evidence');
  assert.equal(person.rightCount,1);
  assert.equal(result.counts.creditBridges,1);
  assert.deepEqual(ids(result.bridgePersonIds),['one:person:one'],'an overlapping record alone is not a bridge between distinct records');
  assert(!result.bridgePersonIds.has('two:person:one'),'same label in another catalog is not merged');
  const sharedOnly=result.sharedPeople.find(p=>p.id==='one:person:two');
  assert.equal(sharedOnly.sharedCount,1);
  assert.equal(sharedOnly.leftExclusiveCount,0); assert.equal(sharedOnly.rightExclusiveCount,0);
  assert.equal(result.relationships.length,2);
  assert.deepEqual(result.relationships.map(r=>[r.kind,r.inferred,r.bridgeType]),[
    ['related_article',false,'direct'],['possibly_same_event',true,'via_shared']]);
  assert.equal(result.relationships[0].basis,'Editorial card, not citation');
  assert.deepEqual(result.relationships[0].sourceUrls,[url]);
});

test('comparison reuses real graph edges and preserves canonical nodes through cache and filtering',()=>{
  const index=fixture(), graph=graphData(index), before=JSON.stringify(graph.nodes);
  const result=compareTerritories(index,'minds','planet');
  assert(result.edges.every(edge=>graph.edges.includes(edge)));
  assert(!result.edges.some(edge=>edge.to==='one:d'));
  assert(result.edges.every(edge=>graph.byId.has(edge.from)&&graph.byId.has(edge.to)));
  assert.equal(result,compareTerritories(index,'minds','planet'));
  assert.notEqual(result,compareTerritories(index,'planet','minds'));
  assert.deepEqual(ids(compareTerritories(index,'minds','planet',{from:'2025',type:'article'}).memberIds),['one:c']);
  assert.equal(compareTerritories(index,'minds','planet',{query:'no matching record'}).edges.length,0);
  assert.equal(JSON.stringify(graph.nodes),before);
});

test('all public subject pairs preserve the union, source edges and endpoint provenance',()=>{
  const root=new URL('../public/ACF/data/',import.meta.url);
  const read=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
  const index=createIndex(read('index.json').catalogs.map(c=>read(c.file))), graph=graphData(index);
  const before=JSON.stringify(graph.nodes.map(n=>[n.id,n.x,n.y]));
  const edgeSet=new Set(graph.edges);
  for(let i=0;i<THEMES.length;i++) for(let j=i+1;j<THEMES.length;j++) {
    const result=compareTerritories(index,THEMES[i][0],THEMES[j][0]);
    const expected=index.items.filter(item=>item.themes.includes(THEMES[i][0])||item.themes.includes(THEMES[j][0]));
    assert.deepEqual(ids(result.memberIds),expected.map(item=>item.id).sort());
    assert.equal(result.records.length,result.memberIds.size);
    for(const edge of result.edges) {
      assert(edgeSet.has(edge),'no synthetic edge');
      assert(edge.sourceUrls?.length,'edge keeps evidence');
      assert(graph.byId.has(edge.from)&&graph.byId.has(edge.to));
    }
    for(const person of result.sharedPeople) {
      assert(person.leftCredits.every(c=>c.personId===person.id&&result.left.memberIds.has(c.itemId)));
      assert(person.rightCredits.every(c=>c.personId===person.id&&result.right.memberIds.has(c.itemId)));
    }
  }
  assert.equal(JSON.stringify(graph.nodes.map(n=>[n.id,n.x,n.y])),before);
});
