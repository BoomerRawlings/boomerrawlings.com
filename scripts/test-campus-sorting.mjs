import assert from 'node:assert/strict';
import {selectedRows, nextSort, sortOrders, csvText} from '../src/lib/campus-rates.js';

// Unequal populations, a true zero, tied values and independently missing fields.
const source=[
  ['Zeta',2,100],['Alpha',2,200],['Beta',null,300],
  ['Gamma',0,100],['Delta',3,null],['Eta',1,100],
];
const data={institutions:source.map(([name,count,enrollment],index)=>({
  id:String(index),name,shortName:name,state:'CA',group:index<3?'uc':'ivy',
  years:[{year:2024,enrollment,counts:{oncampus:{criminal_total:count}}}],
}))};
const expected={
  name:['Alpha','Beta','Delta','Eta','Gamma','Zeta'],
  nameDesc:['Zeta','Gamma','Eta','Delta','Beta','Alpha'],
  rateAsc:['Gamma','Alpha','Eta','Zeta','Beta','Delta'],
  rateDesc:['Zeta','Alpha','Eta','Gamma','Beta','Delta'],
  countAsc:['Gamma','Eta','Alpha','Zeta','Delta','Beta'],
  countDesc:['Delta','Alpha','Zeta','Eta','Gamma','Beta'],
  populationAsc:['Eta','Gamma','Zeta','Alpha','Beta','Delta'],
  populationDesc:['Beta','Alpha','Eta','Gamma','Zeta','Delta'],
};
for(const [sort,names] of Object.entries(expected)){
  const rows=selectedRows(data,{sort});
  assert.deepEqual(rows.map(row=>row.institution.name),names,sort);
  // CSV uses the visible selection order, with no secondary reordering.
  assert.equal(csvText(rows.map(row=>[row.institution.name])).trimEnd(),names.join('\r\n'));
  const {column}=sortOrders[sort];
  assert.equal(nextSort(nextSort(sort,column),column),sort);
}
assert.deepEqual(selectedRows(data,{sort:'invalid'}).map(row=>row.institution.name),expected.name);
assert.deepEqual(selectedRows(data,{sort:'countDesc',group:'uc'}).map(row=>row.institution.name),['Alpha','Zeta','Beta']);
assert.deepEqual(selectedRows(data,{sort:'populationDesc',search:'eta'}).map(row=>row.institution.name),['Beta','Eta','Zeta']);
assert.deepEqual(data.institutions.map(inst=>inst.name),source.map(row=>row[0]),'Sorting must not mutate the source cohort');
for(const column of ['rate','count','population'])assert.equal(nextSort('name',column),`${column}Desc`);
assert.equal(nextSort('populationAsc','institution'),'name');
assert.equal(nextSort('name','institution'),'nameDesc');
assert.throws(()=>nextSort('name','unsupported'),/Unknown sort column/);
console.log('Campus sorting: all four columns, both directions, missing values, ties, zero, filtering, legacy keys and CSV order pass.');
