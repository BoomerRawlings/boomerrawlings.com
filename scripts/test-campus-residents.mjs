import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from 'parse5';
import {initialView, viewDefaults, selectedRows} from '../src/lib/campus-rates.js';

const data=JSON.parse(readFileSync('public/data-analysis/campus-safety/data/dataset.json','utf8'));
const opening=selectedRows(data,initialView);
assert.equal(opening.length,11);
assert(opening.every(row=>row.rate!==null));
for(const [id,count,population] of [['110680',52,21907],['122409',7,8367]]) {
  const row=opening.find(row=>row.institution.id===id);
  assert.equal(row.count,count); assert.equal(row.population,population);
  assert.equal(row.rate,1000*count/population);
}
for(const period of ['2022','2023','pooled']) {
  const rows=selectedRows(data,{...initialView,period});
  assert.equal(rows.length,11,'Missing outcomes must not remove institutions from the cohort.');
  assert.equal(rows.filter(row=>row.rate!==null).length,6);
}
const all=selectedRows(data,{...initialView,group:'all'});
assert.equal(all.length,42); assert.equal(all.filter(row=>row.rate!==null).length,11);
const ivy=selectedRows(data,{...initialView,group:'ivy'});
assert.equal(ivy.length,8); assert(ivy.every(row=>row.rate===null));
const enrollment=selectedRows(data,{...initialView,measure:'enrollment',group:'all'});
assert.equal(enrollment.length,42);
assert.equal(enrollment.find(row=>row.institution.id==='110680').rate,528000/44256);
assert.deepEqual(viewDefaults(new URLSearchParams()),initialView);
assert.deepEqual(viewDefaults(new URLSearchParams('utm_source=example')),initialView);
for(const query of ['sort=rateDesc','group=ivy','measure=residents','measure=enrollment','category=rape&period=2023']) {
  const params=new URLSearchParams(query);
  const resolved={...viewDefaults(params),...Object.fromEntries(params)};
  assert.equal(resolved.measure,params.get('measure')??'enrollment');
  assert.equal(resolved.group,params.get('group')??'all');
}
const newLink=new URLSearchParams({measure:initialView.measure,group:initialView.group});
assert.deepEqual({...viewDefaults(newLink),...Object.fromEntries(newLink)},initialView);

const nodes=[];
function walk(node){nodes.push(node);(node.childNodes??[]).forEach(walk);}
walk(parse(readFileSync('dist/writing/data-analysis/campus-safety/index.html','utf8')));
const attr=(node,key)=>node.attrs?.find(a=>a.name===key)?.value;
const byId=id=>nodes.find(n=>attr(n,'id')===id);
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes??[]).map(text).join('');
for(const [id,value] of [['campus-measure','residents'],['campus-group','resident-covered']]) {
  assert.equal(attr(byId(id).childNodes.find(n=>n.tagName==='option'),'value'),value);
}
const table=byId('campus-results');
assert.equal(table.childNodes.find(n=>n.tagName==='tbody').childNodes.filter(n=>n.tagName==='tr').length,11);
assert(text(table).includes('Fall occupancy')); assert(!text(table).includes('Fall enrollment'));
assert(text(byId('campus-results-status')).startsWith('11 institutions'));
assert(text(byId('campus-measure-note')).includes('Housing-property boundaries'));

nodes.length=0; walk(parse(readFileSync('dist/index.html','utf8')));
const ledger=nodes.find(n=>attr(n,'class')==='ledger-list');
const links=ledger.childNodes.filter(n=>n.tagName==='li').map(li=>li.childNodes.find(n=>n.tagName==='a'));
assert.equal(links.length,7);
assert.deepEqual(links.slice(0,2).map(n=>attr(n,'href')),['/writing/data-analysis/crime-and-heat/','/writing/data-analysis/campus-safety/']);
assert(!links.some(n=>/research-briefing-assistant|research-publishing-systems/.test(attr(n,'href'))));
console.log('Resident focus: documented occupancy cohort, missingness, exact numerator/denominator, old/new URL semantics, static defaults and seven homepage highlights verified.');
