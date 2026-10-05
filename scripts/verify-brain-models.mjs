import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';

const root = new URL('../public/brain/models/', import.meta.url);
const atlas = JSON.parse(readFileSync(new URL('atlas.json', root), 'utf8'));
const receptor = JSON.parse(readFileSync(new URL('gaba-a-6d6t.json', root), 'utf8'));
assert.equal(atlas.metadata.license, 'CC BY 4.0');
assert.deepEqual(atlas.metadata.coordinates.sourceAxisCodes, ['R', 'A', 'S']);
assert.deepEqual(atlas.metadata.sourceSpacingMm, [.5, .5, .5]);
assert.equal(atlas.meshes.length, 19);
function closedEdges(mesh) {
  const edges=new Map();
  const parent=Array.from({length:mesh.positions.length/3},(_,i)=>i),used=new Set();
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<mesh.indices.length;i+=3){
    const triangle=mesh.indices.slice(i,i+3);
    assert.equal(new Set(triangle).size,3,`${mesh.id}: degenerate triangle`);
    for(let c=0;c<3;c++){
      const a=triangle[c],b=triangle[(c+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
      edges.set(key,(edges.get(key)||0)+1);
      used.add(a);used.add(b);parent[find(a)]=find(b);
    }
  }
  assert.ok([...edges.values()].every(count=>count===2),`${mesh.id}: nonmanifold/open exported surface`);
  if(mesh.kind==='shell'||mesh.kind==='cerebellum')assert.equal(new Set([...used].map(find)).size,1,`${mesh.id}: disconnected interior pockets in continuous exterior`);
}
const ids = new Set();
for (const mesh of atlas.meshes) {
  assert.ok(!ids.has(mesh.id), `Duplicate model id: ${mesh.id}`);
  ids.add(mesh.id);
  assert.ok(mesh.atlasStructureIds.length && mesh.atlasLabelIds.length, `${mesh.id}: missing source labels`);
  assert.equal(mesh.positions.length % 3, 0);
  assert.equal(mesh.indices.length % 3, 0);
  assert.ok(mesh.positions.every(Number.isFinite), `${mesh.id}: invalid coordinate`);
  assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3), `${mesh.id}: invalid triangle index`);
  assert.equal(mesh.quality.watertight,true,`${mesh.id}: topology metadata says open`);
  assert.equal(mesh.quality.boundaryEdges,0);
  assert.equal(mesh.quality.nonmanifoldEdges,0);
  closedEdges(mesh);
  if(mesh.kind==='shell'){
    assert.ok(mesh.indices.length/3>=28_000,`${mesh.id}: cortex detail budget regressed`);
    assert.equal(mesh.faceRegions.length,mesh.indices.length/3);
    assert.equal(mesh.regions.length,6);
    assert.ok(mesh.faceRegions.every(index=>Number.isInteger(index)&&index>=0&&index<mesh.regions.length));
    for(const region of mesh.regions)assert.ok(region.id.endsWith(mesh.hemisphere)&&region.atlasStructureIds.length);
  }
  if(mesh.kind==='cerebellum'){
    assert.ok(mesh.atlasLabelIds.includes(10668),'Cerebellar envelope lost its source white matter');
    assert.ok(mesh.assignedWhiteMatterSourceVoxels>200_000);
    assert.ok(mesh.indices.length/3>=28_000,'Cerebellar folia detail budget regressed');
    const lengths=[];
    for(let i=0;i<mesh.indices.length;i+=3)for(let c=0;c<3;c++){
      const a=mesh.indices[i+c]*3,b=mesh.indices[i+(c+1)%3]*3;
      lengths.push(Math.hypot(...[0,1,2].map(axis=>mesh.positions[a+axis]-mesh.positions[b+axis])));
    }
    lengths.sort((a,b)=>a-b);
    assert.ok(lengths[Math.floor(lengths.length*.99)]<6,'Cerebellar surface has broad collapsed polygon folds');
  }
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(mesh.positions[i + axis] >= mesh.bounds[0][axis] && mesh.positions[i + axis] <= mesh.bounds[1][axis]);
    }
  }
  // Surface sampling can overlap the midsagittal plane by half a voxel.
  if (mesh.hemisphere === 'left') assert.ok(mesh.bounds[1][0] <= .6, `${mesh.id}: hemisphere is flipped`);
  if (mesh.hemisphere === 'right') assert.ok(mesh.bounds[0][0] >= -.6, `${mesh.id}: hemisphere is flipped`);
}
for (const id of ['hippocampus', 'amygdala', 'thalamus', 'hypothalamus', 'corpus-callosum', 'fornix', 'cerebellum', 'midbrain', 'pons', 'medulla']) assert.ok(ids.has(id));
assert.equal(receptor.metadata.pdbId, '6D6T');
assert.equal(receptor.metadata.license, 'CC0 1.0');
assert.deepEqual(receptor.chains.map(chain => chain.id), ['A', 'B', 'C', 'D', 'E']);
let points = 0;
for (const chain of receptor.chains) {
  assert.equal(chain.points.length, chain.residueNumbers.length);
  assert.equal(chain.points.length, chain.residueNames.length);
  assert.equal(chain.points.length, chain.segments.reduce((total, segment) => total + segment.length, 0));
  for (const segment of chain.segments) {
    assert.ok(segment.length);
    for (let i = 0; i < segment.length; i++) {
      assert.equal(segment[i].length, 3);
      assert.ok(segment[i].every(Number.isFinite));
      if (i) assert.ok(Math.hypot(...segment[i].map((v, axis) => v - segment[i - 1][axis])) <= 5.001, `${chain.id}: trace bridges unresolved residues`);
    }
  }
  points += chain.points.length;
}
assert.equal(points, receptor.metadata.alphaCarbonCount);
assert.equal(points, 1638);
const manifest=JSON.parse(readFileSync(new URL('tracts/manifest.json',root),'utf8'));
assert.equal(manifest.metadata.license,'CC BY-SA 4.0');
assert.deepEqual(manifest.metadata.coordinates.centerSourceRAS,atlas.metadata.coordinates.centerSourceRAS);
assert.deepEqual(['x','y','z'].map(axis=>manifest.metadata.coordinates[axis]),['right','superior','anterior']);
assert.ok(manifest.metadata.acknowledgment.includes('Human Connectome Project'));
assert.ok(manifest.metadata.limitations.includes('not directly observed axons'));
assert.equal(manifest.bundles.length,25);
let streamlines=0,tractBytes=0;
const bundleIds=new Set();
for(const info of manifest.bundles){
  assert.ok(!bundleIds.has(info.id));bundleIds.add(info.id);
  assert.equal(info.file,`/brain/models/tracts/${info.id}.json`);
  const file=new URL(`tracts/${info.id}.json`,root),bundle=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(bundle.id,info.id);assert.equal(bundle.hemisphere,info.hemisphere);
  assert.ok(bundle.metadata.sourceMember.endsWith('.trk.gz')&&/^[a-f\d]{64}$/.test(bundle.metadata.sourceSha256));
  assert.ok(bundle.metadata.sourceStreamlineCount>=info.streamlineCount);
  assert.ok(info.streamlineCount>=200,`${info.id}: fiber density regressed`);
  assert.equal(bundle.positions.length,info.pointCount*3);
  assert.ok(bundle.positions.every(value=>Number.isFinite(value)&&Math.abs(value)<120),`${info.id}: invalid MNI transform`);
  assert.equal(bundle.offsets.length,info.streamlineCount+1);
  assert.equal(bundle.offsets[0],0);assert.equal(bundle.offsets.at(-1),info.pointCount);
  for(let s=0;s<bundle.offsets.length-1;s++)assert.equal(bundle.offsets[s+1]-bundle.offsets[s],40);
  const xs=[];
  for(let i=0;i<bundle.positions.length;i+=3){
    xs.push(bundle.positions[i]);
    for(let axis=0;axis<3;axis++)assert.ok(bundle.positions[i+axis]>=info.bounds[0][axis]&&bundle.positions[i+axis]<=info.bounds[1][axis]);
  }
  xs.sort((a,b)=>a-b);const median=xs[Math.floor(xs.length/2)];
  if(info.hemisphere==='left')assert.ok(median<0,`${info.id}: left/right affine reversed`);
  if(info.hemisphere==='right')assert.ok(median>0,`${info.id}: left/right affine reversed`);
  const size=statSync(file).size;assert.equal(size,info.byteLength);tractBytes+=size;streamlines+=info.streamlineCount;
}
for(const id of ['corpus-callosum','corticospinal-left','corticospinal-right','medial-lemniscus-left','optic-radiation-left','arcuate-left','uncinate-right','fornix-left','middle-cerebellar-peduncle'])assert.ok(bundleIds.has(id));
assert.equal(streamlines,manifest.streamlineCount);assert.ok(streamlines>=8_000);assert.equal(tractBytes,manifest.totalBytes);
const bytes = ['atlas.json', 'gaba-a-6d6t.json', 'credits.json'].reduce((total, file) => total + statSync(new URL(file, root)).size, 0)+tractBytes+statSync(new URL('tracts/manifest.json',root)).size;
assert.ok(bytes < 15_000_000, 'Anatomy/tract model payload exceeds 15 MB');
console.log(`Brain model verification passed: ${atlas.meshes.length} closed atlas meshes, 25 named bundles/${streamlines} measured streamlines, ${points} receptor Cα coordinates, ${bytes.toLocaleString()} lazy bytes.`);
