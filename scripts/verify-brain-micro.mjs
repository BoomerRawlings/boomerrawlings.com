import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import * as THREE from 'three';
import { topics } from '../public/brain/curriculum.js';

const modelRoot=path.resolve('public/brain/models');
const json=async name=>JSON.parse(await fs.readFile(path.join(modelRoot,`${name}.json`),'utf8'));
const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
const molecules=await json('micro-molecules');
const expected={glutamate:{1:9,6:5,7:1,8:4},gaba:{1:9,6:4,7:1,8:2},dopamine:{1:11,6:8,7:1,8:2},serotonin:{1:12,6:10,7:2,8:1},acetylcholine:{1:16,6:7,7:1,8:2},norepinephrine:{1:11,6:8,7:1,8:3},glycine:{1:5,6:2,7:1,8:2},histamine:{1:9,6:5,7:3}};
for(const[id,formula]of Object.entries(expected)){
  const m=molecules.molecules[id];assert(m,`${id} conformer missing`);assert.match(m.source,/^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\//);assert(Number.isInteger(m.cid));
  const ids=new Set(),counts={},neighbors=new Map(),valence=new Map();
  for(const a of m.atoms){assert(!ids.has(a.id),`${id} duplicate atom`);ids.add(a.id);counts[a.element]=(counts[a.element]||0)+1;assert(finitePoint(a.position),`${id} nonfinite coordinate`);assert(Number.isInteger(a.charge),`${id} invalid charge`);neighbors.set(a.id,[]);valence.set(a.id,0);}
  assert.deepEqual(counts,formula,`${id} atom counts differ from molecular formula`);
  for(const[a,b,order]of m.bonds){assert(ids.has(a)&&ids.has(b)&&a!==b,`${id} invalid bond endpoint`);assert([1,2,3].includes(order),`${id} unexpected bond order`);neighbors.get(a).push(b);neighbors.get(b).push(a);valence.set(a,valence.get(a)+order);valence.set(b,valence.get(b)+order);const pa=m.atoms.find(x=>x.id===a).position,pb=m.atoms.find(x=>x.id===b).position,d=Math.hypot(...pa.map((v,i)=>v-pb[i]));assert(d>.65&&d<2.15,`${id} implausible bonded-atom distance ${d}`);}
  const visited=new Set(),queue=[m.atoms[0].id];while(queue.length){const id=queue.pop();if(visited.has(id))continue;visited.add(id);queue.push(...neighbors.get(id));}assert.equal(visited.size,ids.size,`${id} disconnected molecular graph`);
  for(const a of m.atoms){const v=valence.get(a.id);if(a.element===1)assert.equal(v,1);if(a.element===6)assert.equal(v,4);if(a.element===8)assert.equal(v,2);if(a.element===7)assert.equal(v,a.charge===1?4:3);}
  assert.equal(m.atoms.reduce((n,a)=>n+a.charge,0),id==='acetylcholine'?1:0,`${id} record charge changed`);
}
const proteins=[['micro-sodium',3,1433],['micro-potassium',8,2848],['micro-calcium',3,2598],['micro-ampa',4,3116],['micro-nmda',4,2944],['gaba-a-6d6t',5,1638]];
for(const[name,chainCount,residueCount]of proteins){
  const p=await json(name);assert.equal(p.chains.length,chainCount,`${name} assembly chain count`);assert.match(p.sourcePage||p.metadata?.source,/^https:\/\/www\.rcsb\.org\/structure\//);assert.match(p.license||p.metadata?.license,/CC0/);
  let count=0;for(const c of p.chains){assert(c.segments?.length,`${name} segments required to preserve unresolved gaps`);const flat=c.segments.flat();count+=flat.length;assert.equal((c.residues||c.residueNumbers).length,flat.length,`${name} residue count mismatch`);assert.equal(c.residueNames.length,flat.length,`${name} residue identity count mismatch`);assert(c.residueNames.every(n=>/^[A-Z]{3}$/.test(n)),`${name} invalid residue name`);for(const segment of c.segments){segment.forEach(q=>assert(finitePoint(q),`${name} invalid CA coordinate`));for(let i=1;i<segment.length;i++){const d=Math.hypot(...segment[i].map((n,j)=>n-segment[i-1][j]));assert(d>2.2&&d<5.05,`${name} gap bridged inside a segment: ${d}`);}}}assert.equal(count,residueCount,`${name} experimental CA count`);
}
const morphology=await json('micro-neuron'),ids=new Set(morphology.points.map(p=>p[0]));assert.equal(morphology.specimen,485909730);assert.equal(ids.size,morphology.points.length);assert.equal(ids.size,1925);assert.match(morphology.source,/api\.brain-map\.org/);
for(const p of morphology.points){assert.equal(p.length,7);assert(p.every(Number.isFinite));assert(p[5]>0,'SWC radius must be positive');assert(p[6]===-1||ids.has(p[6]),'SWC parent missing');assert.notEqual(p[0],p[6],'Self-parent SWC node');}
const byNode=new Map(morphology.points.map(p=>[p[0],p]));for(const p of morphology.points){let node=p,seen=new Set();while(node&&node[6]!==-1){assert(!seen.has(node[0]),'SWC contains a cycle');seen.add(node[0]);node=byNode.get(node[6]);}}

// Construct every micro scene headlessly with real Three.js geometry; exercise animation frames and semantic links.
const source=await fs.readFile('src/scripts/brain/scenes-micro.ts','utf8'),compiled=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
const tempDir=path.resolve('node_modules/.cache');await fs.mkdir(tempDir,{recursive:true});const tempFile=path.join(tempDir,'brain-micro-verifier.mjs');await fs.writeFile(tempFile,compiled.code);
const originalFetch=globalThis.fetch;globalThis.fetch=async url=>{assert(String(url).startsWith('/brain/models/'));const value=await json(String(url).split('/').at(-1).replace(/\.json$/,''));return{ok:true,json:async()=>value};};
try{
  const{buildMicroScene,MICRO_VARIANTS}=await import(pathToFileURL(tempFile).href),micro=topics.filter(t=>['circuit','neuron','synapse','molecule','channel','plasticity'].includes(t.scene)),validIds=new Set(topics.map(t=>t.id));
  assert.equal(micro.length,36);assert.deepEqual(Object.keys(MICRO_VARIANTS).sort(),micro.map(t=>t.id).sort(),'Micro variant manifest must cover every curriculum micro topic');
  for(const topic of micro){
    const root=new THREE.Group(),picks=[],pickObjects=[],details=[],representations=[],animations=[],narratives=[],statuses=[];
    const material=(color=0xcbdcdd,opacity=1,emissive=0)=>new THREE.MeshStandardMaterial({color,opacity,transparent:opacity<1,emissive:color,emissiveIntensity:emissive});
    function mesh(geometry,mat,parent=root){const m=new THREE.Mesh(geometry,mat);parent.add(m);return m;}
    function ball(p,r,color,parent=root,opacity=1){const m=mesh(new THREE.SphereGeometry(r,12,8),material(color,opacity),parent);m.position.copy(p);return m;}
    function tube(points,r,color,parent=root,opacity=1,segments=48){const curve=new THREE.CatmullRomCurve3(points);return{mesh:mesh(new THREE.TubeGeometry(curve,segments,r,7,false),material(color,opacity),parent),curve};}
    function link(a,b,r,color,parent=root,opacity=1){const d=b.clone().sub(a),m=mesh(new THREE.CylinderGeometry(r,r,d.length(),8),material(color,opacity),parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
    const ctx={root,material,mesh,ball,tube,link,label(){},pick(o,s){picks.push(s);pickObjects.push({object:o,spec:s});},detail(o,min,max=3){details.push([o,min,max]);},representation(object,spec){object.visible=representations.length===0;representations.push({object,spec});},separable(){},animate(fn){animations.push(fn);},layout(){},status(text){statuses.push(text);},narrative(n){narratives.push(n);},isCurrent(){return true;}};
    await buildMicroScene(topic,ctx);assert(picks.length>2,`${topic.id} missing semantic structures`);for(const p of picks)if(p.childTopic)assert(validIds.has(p.childTopic),`${topic.id}: unknown drilldown ${p.childTopic}`);
    const allNarratives=[...narratives,...representations.map(r=>r.spec.narrative).filter(Boolean)];
    assert(allNarratives.length,`${topic.id} no staged explanation`);const n=allNarratives[0];for(const story of allNarratives){assert(story.duration>0&&story.steps.length>=3);for(let i=0;i<story.steps.length;i++){assert(story.steps[i].at>=0&&story.steps[i].at<story.duration);if(i)assert(story.steps[i].at>story.steps[i-1].at);}}
    const allStatuses=[...statuses,...representations.map(r=>r.spec.status).filter(Boolean)];assert(allStatuses.length&&allStatuses.every(s=>s.length>10));assert(details.length||representations.length,`${topic.id} lacks inspectable detail or representation`);
    if(topic.scene==='channel'){let instances=0;root.traverse(o=>{const list=o.userData.instancePicks;if(!list)return;assert.equal(list.length,o.count,`${topic.id} instance readout count`);for(const p of list){assert(p.level===2&&/Cα/.test(p.description),`${topic.id} missing residue-level C-alpha readout`);assert(!p.id.includes('modeled-'),`${topic.id} must retain true deposited residue numbers`);}instances+=list.length;});assert(instances>1000,`${topic.id} missing fine residue inspection`);}
    if(topic.id==='electrical-synapses'){const connexons=pickObjects.filter(p=>p.spec.id.startsWith('connexon-'));assert.equal(connexons.length,14);for(const p of connexons){const size=new THREE.Box3().setFromObject(p.object).getSize(new THREE.Vector3());assert(size.y<.75,'Connexin height lost its uniform scaling and obscures the paired membranes');}}
    for(const t of[0,n.duration*.23,n.duration*.55,n.duration*.87,n.duration+.01]){animations.forEach(fn=>fn(t,1/60));root.updateMatrixWorld(true);root.traverse(o=>{assert(o.position.toArray().every(Number.isFinite),`${topic.id} invalid animated position`);assert(o.scale.toArray().every(Number.isFinite),`${topic.id} invalid animated scale`);});}
    let meshes=0;const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry){meshes++;geometries.add(o.geometry);const a=o.geometry.attributes.position;if(a)for(let i=0;i<a.array.length;i++)assert(Number.isFinite(a.array[i]),`${topic.id} nonfinite vertex`);const index=o.geometry.index;if(index)assert(Math.max(...index.array.subarray(0,Math.min(index.array.length,10000)))<a.count,`${topic.id} index out of range`);}if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});assert(meshes>10,`${topic.id} unexpectedly empty geometry`);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();
  }
  console.log('Brain micro verification passed: 8 complete conformers; 6 experimental assemblies; measured SWC tree; 36 built/animated scenes with valid semantic drilldowns and narratives.');
}finally{globalThis.fetch=originalFetch;await fs.unlink(tempFile);}
