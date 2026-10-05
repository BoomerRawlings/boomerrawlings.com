import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import * as THREE from 'three';
import { topics } from '../public/brain/curriculum.js';

const publicRoot=new URL('../public/',import.meta.url);
const atlas=JSON.parse(await readFile(new URL('brain/models/atlas.json',publicRoot),'utf8'));
const details=JSON.parse(await readFile(new URL('brain/models/atlas-details.json',publicRoot),'utf8'));
const mri=JSON.parse(await readFile(new URL('brain/models/tracts/reference-mri.json',publicRoot),'utf8'));
const landmarks=JSON.parse(await readFile(new URL('brain/models/atlas-landmarks.json',publicRoot),'utf8'));
assert.deepEqual(landmarks.metadata.coordinates,atlas.metadata.coordinates);
assert.deepEqual(landmarks.metadata.sha256,atlas.metadata.sha256);
assert.deepEqual(landmarks.meshes.map(m=>[m.id,m.atlasStructureIds[0]]),[['third-ventricle',10602],['inferior-ventricular-horn',10600],['cerebral-aqueduct',12369],['fourth-ventricle',12805]]);
for(const m of landmarks.meshes){
 assert.equal(m.kind,'csf-space');assert(m.sourceVoxelCount>0&&m.quality.watertight);
 assert(m.positions.every(Number.isFinite)&&m.indices.every(i=>Number.isInteger(i)&&i>=0&&i<m.positions.length/3));
 const edges=new Map();for(let i=0;i<m.indices.length;i+=3)for(let j=0;j<3;j++){const a=m.indices[i+j],b=m.indices[i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;edges.set(key,(edges.get(key)||0)+1);}
 assert([...edges.values()].every(n=>n===2),`${m.id}: torn landmark surface`);
}
assert.equal(mri.metadata.template,'ICBM 2009a Nonlinear Asymmetric');
assert.equal(mri.metadata.samplingMm,2);
assert.deepEqual(mri.metadata.coordinates.centerSourceRAS,atlas.metadata.coordinates.centerSourceRAS);
assert(mri.metadata.copyright.includes('Permission to use, copy, modify, and distribute'));
assert.deepEqual(mri.planes.map(p=>p.id),['sagittal','coronal','axial']);
for(const plane of mri.planes){
 assert.equal(plane.positions.length,plane.intensities.length*3);
 assert(plane.positions.every(Number.isFinite));assert(plane.intensities.every(i=>Number.isInteger(i)&&i>=0&&i<=255));
 assert(plane.indices.length>1000&&plane.indices.every(i=>Number.isInteger(i)&&i>=0&&i<plane.intensities.length));
 const coordinate=plane.id==='sagittal'?0:plane.id==='coronal'?2:1;
 const rasAxis=plane.id==='sagittal'?0:plane.id==='coronal'?1:2;
 const expectedLevel=plane.sourceLevelMm-mri.metadata.coordinates.centerSourceRAS[rasAxis];
 for(let i=coordinate;i<plane.positions.length;i+=3)assert.equal(plane.positions[i],expectedLevel,`${plane.id}: arbitrary relocation of MRI reference`);
 assert(new Set(plane.intensities).size>100,'MRI must contain actual source intensity detail, not a solid plane');
}
assert.equal(details.metadata.license,'CC BY 4.0');
assert.deepEqual(details.metadata.coordinates,atlas.metadata.coordinates,'Regional mesh coordinate frame must remain identical to the base atlas');
assert.deepEqual(details.metadata.sha256,atlas.metadata.sha256,'Regional models must use the same verified source volume and ontology');
assert.equal(details.meshes.length,108);
const byId=new Map(),shapes=new Set();
const expected={
 'hippocampal-head':12171,'hippocampal-body':12173,'hippocampal-tail':12174,
 'thalamus-vpl':10424,'thalamus-lgn':10430,'hypothalamus-supraoptic-region':10473,
 'cerebellar-deep-nuclei':10660,'medulla-pyramidal':12535,'optic-radiation-volume':266441621,
};
for(const mesh of details.meshes){
 assert(!byId.has(mesh.id));byId.set(mesh.id,mesh);
 assert.equal(mesh.positions.length%3,0);assert.equal(mesh.indices.length%3,0);
 assert(mesh.positions.every(Number.isFinite));assert(mesh.indices.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.positions.length/3));
 assert(mesh.sourceVoxelCount>0&&mesh.sourceLabelName&&mesh.topicIds.length);
 assert(mesh.centroid.every(Number.isFinite));
 assert.equal(mesh.quality.watertight,true);
 if(expected[mesh.regionId])assert.deepEqual(mesh.atlasStructureIds,[expected[mesh.regionId]],`${mesh.id}: wrong source label`);
 const edges=new Map();
 for(let i=0;i<mesh.indices.length;i+=3)for(let j=0;j<3;j++){
  const a=mesh.indices[i+j],b=mesh.indices[i+(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
  edges.set(key,(edges.get(key)||0)+1);
 }
 assert([...edges.values()].every(n=>n===2),`${mesh.id}: torn/nonmanifold surface`);
 for(let i=0;i<mesh.positions.length;i++)assert(mesh.positions[i]>=mesh.bounds[0][i%3]&&mesh.positions[i]<=mesh.bounds[1][i%3]);
 assert(mesh.hemisphere==='left'?mesh.centroid[0]<0:mesh.centroid[0]>0,`${mesh.id}: mirrored anatomy`);
 const hash=createHash('sha256').update(JSON.stringify(mesh.positions)).digest('hex');
 assert(!shapes.has(hash),`${mesh.id}: recycled generic geometry`);shapes.add(hash);
}
for(const h of ['left','right']){
 const p=id=>byId.get(`${id}-${h}`).centroid;
 assert(p('hippocampal-head')[2]>p('hippocampal-body')[2]&&p('hippocampal-body')[2]>p('hippocampal-tail')[2],'Hippocampal head/body/tail anterior-posterior order');
 assert(p('cuneus')[1]>p('lingual-gyrus')[1],'Cuneus must be superior to lingual gyrus');
 assert(p('precentral-gyrus')[2]>p('postcentral-gyrus')[2],'Precentral must be anterior to postcentral gyrus');
 assert(p('midbrain-tegmentum')[1]>p('pons-tegmentum')[1]&&p('pons-tegmentum')[1]>p('medulla-tegmentum')[1],'Rostrocaudal brainstem order');
 assert(p('hypothalamus-mammillary')[1]<p('thalamus-mediodorsal')[1],'Hypothalamus inferior to thalamus');
}
// Exercise actual scene registration so valid assets cannot be silently replaced
// by a generic sphere, misnamed source target, or disconnected fake relay graph.
await mkdir(new URL('../.astro/',import.meta.url),{recursive:true});
const output=new URL('../.astro/brain-regions-check.mjs',import.meta.url);
await build({entryPoints:[new URL('../src/scripts/brain/scenes-macro.ts',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],outfile:output.pathname.replace(/^\/([A-Za-z]:)/,'$1'),bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
const {buildMacroScene}=await import(output.href);
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>new Response(await readFile(new URL(String(url).replace(/^\//,''),publicRoot)),{status:200});
let count=0;
try{
 for(const topic of topics.filter(t=>['brain','tracts'].includes(t.scene))){
  const root=new THREE.Group(),picks=[],views=[],details=[],labels=[];
  const material=(color=0xffffff,opacity=1)=>new THREE.MeshStandardMaterial({color,opacity,transparent:opacity<1});
  const mesh=(geometry,mat,parent=root)=>{const m=new THREE.Mesh(geometry,mat);parent.add(m);return m;};
  const ctx={root,material,mesh,
   ball(p,r,c,parent=root,o=1){const m=mesh(new THREE.SphereGeometry(r,8,6),material(c,o),parent);m.position.copy(p);return m;},
   link(a,b,r,c,parent=root,o=1){const m=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),8),material(c,o),parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;},
   label(text,object,point,options){labels.push({text,object,point,options});},pick(object,spec){picks.push({object,spec});},detail(object,min,max=3){details.push({object,min,max});},
   representation(object,spec){views.push({object,spec});},separable(){},animate(){},layout(){},status(){},narrative(){},isCurrent(){return true;},
  };
  await buildMacroScene(topic,ctx);
  const hasContext=!['brain-overview','cerebral-cortex'].includes(topic.id);
  assert.deepEqual(views.map(v=>v.spec.id),topic.id==='dorsal-column'?['context','regions','measured','axon']:hasContext?['context','measured','regions','axon']:['measured','regions','axon']);
  const context=views.find(v=>v.spec.id==='context');
  if(context){
   assert(context.spec.viewDirection?.length===3,'Context needs a consistent anatomical view');
   if(topic.scene==='tracts'&&topic.id!=='dorsal-column'){
    let references=0;context.object.traverse(o=>{if(o.isMesh){assert(o.userData.mriReference,'Only source-matched MRI may accompany HCP streamlines');assert.equal(o.userData.mriReference.template,mri.metadata.template);references++;}});
    assert.equal(references,1);
   }else{
    let hemispheres=0;context.object.traverse(o=>{if(o.userData.anatomicalContext?.sourceId==='hemisphere-left'){hemispheres++;assert.equal(o.material.opacity,1,'Cutaway must not reintroduce a noisy transparent shell');}});
    assert.equal(hemispheres,1);
    for(const landmark of landmarks.meshes.filter(m=>m.topicIds.includes(topic.id)))assert(picks.some(p=>p.spec.id===`context-${landmark.id}`&&p.spec.label.endsWith('CSF space')),`${topic.id}: missing source CSF-space landmark`);
   }
  }
  const regions=views.find(v=>v.spec.id==='regions').object;
  assert(regions.children.length,`${topic.id}: empty anatomy detail`);
  regions.traverse(o=>{if(o.isMesh){assert(o.userData.atlasRegion,`${topic.id}: arbitrary regional node`);assert.equal(o.geometry.type,'BufferGeometry');}});
  if(topic.id==='white-matter')regions.traverse(o=>{if(o.isMesh)assert(!o.userData.atlasRegion.id.startsWith('white-matter-'),'Opaque regional tracts must not be obscured by a faceted transparent bulk envelope');});
  if(topic.id==='cerebellum'){
   const hemisphereLabels=labels.filter(l=>l.object.userData.atlasRegion?.id.startsWith('cerebellar-hemisphere-'));
   assert.equal(hemisphereLabels.length,2);assert(hemisphereLabels.every(l=>l.options.minDetail===0),'Exterior hemisphere labels must be eligible when vermis/paravermis labels are occluded');
  }
  for(const {object,spec}of picks){
   if(spec.id.includes('-node-'))assert.equal(object.geometry.type,'CylinderGeometry','Node of Ranvier is membrane, not a ball');
   if(spec.kind==='measured atlas region')assert(object.userData.atlasRegion,`${spec.id}: ungrounded regional label`);
  }
  if(topic.scene==='tracts')views.find(v=>v.spec.id==='measured').object.traverse(o=>assert(!o.isMesh,'HCP streamlines must not imply an exact overlay with different-template Allen anatomy'));
  if(topic.id==='dorsal-column'){
   assert.equal(views[0].spec.label,'Relay in context','An anatomically composite ML reconstruction must not be the default anatomy');
   assert.equal(views.find(v=>v.spec.id==='measured').spec.label,'Composite tract estimate');
   assert(picks.filter(p=>p.spec.id.startsWith('medial-lemniscus-')).every(p=>p.spec.label.startsWith('Composite ascending somatosensory estimate')));
  }
  root.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});count++;
 }
}finally{globalThis.fetch=originalFetch;}
console.log(`Brain regional accuracy passed: ${details.meshes.length} unique source-derived surfaces, 4 ventricular landmarks, 3 source-matched MRI reference planes, hemisphere/orientation landmarks, ${count} macro topics, no generic anatomy nodes or mixed-template overlays.`);
