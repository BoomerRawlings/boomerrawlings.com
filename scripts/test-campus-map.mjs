import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitMapView,schoolMapBounds,clusterMapSchools} from '../src/lib/campus-map.js';

const map=JSON.parse(readFileSync('src/data/campus-map.json','utf8'));
const context=JSON.parse(readFileSync('src/data/campus-school-context.json','utf8'));
const data=JSON.parse(readFileSync('public/data-analysis/campus-safety/current-2026-09-25/dataset.json','utf8'));
assert.equal(map.states.length,51);
assert.deepEqual(map.schools.map(s=>s.id).sort(),data.institutions.map(s=>s.id).sort());
assert.equal(new Set(map.schools.map(s=>s.id)).size,42);
for(const school of map.schools){
  assert.equal(school.region,context[school.id].region);
  assert.equal(school.state,context[school.id].homeState);
  assert([school.x,school.y,school.longitude,school.latitude].every(Number.isFinite));
}
for(const region of map.regions){
  const schools=map.schools.filter(s=>s.region===region.id);
  assert.equal(schools.length,region.schoolCount);
  for(const [width,height] of [[1000,625],[600,375],[280,210],[240,180]]){
    const box=fitMapView(schoolMapBounds(schools),width/height);
    assert(Math.abs(box[2]/box[3]-width/height)<1e-10);
    const clusters=clusterMapSchools(schools,box,width,height);
    assert.deepEqual(clusters.flatMap(g=>g.schools.map(s=>s.id)).sort(),schools.map(s=>s.id).sort(),'No school may disappear in clustering.');
    for(const group of clusters){
      assert(group.x>=22&&group.x<=width-22&&group.y>=22&&group.y<=height-22,`${region.id}: marker touch area must fit at ${width}px`);
    }
    for(let i=0;i<clusters.length;i++)for(let j=i+1;j<clusters.length;j++)assert(Math.hypot(clusters[i].x-clusters[j].x,clusters[i].y-clusters[j].y)>=44,'School markers must not overlap.');
  }
}
const coincident=[{id:'a',x:50,y:50},{id:'b',x:50,y:50},{id:'c',x:150,y:150}];
assert.deepEqual(clusterMapSchools(coincident,[0,0,200,200],400,400).map(g=>g.schools.length).sort(),[1,2]);
assert.deepEqual(clusterMapSchools([],[0,0,200,200],400,400),[]);
assert.equal(clusterMapSchools([{id:'a',x:10,y:50},{id:'b',x:40,y:50},{id:'c',x:70,y:50}],[0,0,100,100],100,100).length,2,'A chain must not merge schools more than 44 pixels apart.');
console.log('Campus map: 51 states/DC, 42 exact cohort IDs/regions; every school preserved in desktop/mobile clusters, touch targets contained, coincident points and empty search handled.');
