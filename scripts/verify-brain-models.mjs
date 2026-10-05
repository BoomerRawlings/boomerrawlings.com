import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';

const root = new URL('../public/brain/models/', import.meta.url);
const atlas = JSON.parse(readFileSync(new URL('atlas.json', root), 'utf8'));
const receptor = JSON.parse(readFileSync(new URL('gaba-a-6d6t.json', root), 'utf8'));
assert.equal(atlas.metadata.license, 'CC BY 4.0');
assert.deepEqual(atlas.metadata.coordinates.sourceAxisCodes, ['R', 'A', 'S']);
assert.deepEqual(atlas.metadata.sourceSpacingMm, [.5, .5, .5]);
assert.equal(atlas.meshes.length, 31);
const ids = new Set();
for (const mesh of atlas.meshes) {
  assert.ok(!ids.has(mesh.id), `Duplicate model id: ${mesh.id}`);
  ids.add(mesh.id);
  assert.ok(mesh.atlasStructureIds.length && mesh.atlasLabelIds.length, `${mesh.id}: missing source labels`);
  assert.equal(mesh.positions.length % 3, 0);
  assert.equal(mesh.indices.length % 3, 0);
  assert.ok(mesh.positions.every(Number.isFinite), `${mesh.id}: invalid coordinate`);
  assert.ok(mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3), `${mesh.id}: invalid triangle index`);
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
const bytes = ['atlas.json', 'gaba-a-6d6t.json', 'credits.json'].reduce((total, file) => total + statSync(new URL(file, root)).size, 0);
assert.ok(bytes < 4_000_000, 'Model payload exceeds 4 MB');
console.log(`Brain model verification passed: ${atlas.meshes.length} measured atlas meshes, ${points} receptor Cα coordinates, ${bytes.toLocaleString()} bytes.`);
