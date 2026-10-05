import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as THREE from 'three';
import { topics } from '../public/brain/curriculum.js';

// Run the production scene builders without a browser or WebGL. This verifies
// generated geometry and animation, not camera composition or visual fidelity.
const project = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(project, 'public');
const output = path.join(project, '.astro', 'brain-scene-check.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({
  stdin: {
    contents: "export { buildMicroScene } from './src/scripts/brain/scenes-micro.ts'; export { buildMacroScene } from './src/scripts/brain/scenes-macro.ts';",
    resolveDir: project,
    sourcefile: 'brain-scene-entry.ts',
  },
  outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent',
});
const { buildMicroScene, buildMacroScene } = await import(pathToFileURL(output));
const topicIds = new Set(topics.map(topic => topic.id));
assert.equal(topicIds.size, topics.length, 'Topic IDs must be unique');
const fetched = new Set(), fetchFailures = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href, 'http://brain-scene-check.local');
  assert.equal(url.origin, 'http://brain-scene-check.local', `Unexpected network dependency: ${url}`);
  const filename = path.resolve(publicRoot, `.${decodeURIComponent(url.pathname)}`);
  assert(filename.startsWith(publicRoot + path.sep), `Asset outside public/: ${filename}`);
  fetched.add(url.pathname);
  try { return new Response(await readFile(filename), { status: 200, headers: { 'content-type': 'application/json' } }); }
  catch (error) { fetchFailures.push(`${url.pathname}: ${error.message}`); return new Response('Missing local asset', { status: 404 }); }
};

const vector = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function instrument() {
  const root = new THREE.Group();
  const registry = { labels: [], picks: [], details: [], representations: [], parts: [], animations: [], layouts: [], statuses: [], narratives: [], materials: new Set() };
  const material = (color = 0xdbe9ed, opacity = 1, emissive = 0) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .65, metalness: .04, transparent: opacity < 1, opacity, depthWrite: opacity >= .85, emissive: color, emissiveIntensity: emissive });
    registry.materials.add(value); return value;
  };
  const mesh = (geometry, mat, parent = root) => { const value = new THREE.Mesh(geometry, mat); parent.add(value); return value; };
  const ctx = {
    root, material, mesh,
    ball(position, radius, color, parent = root, opacity = 1) {
      const value = mesh(new THREE.SphereGeometry(radius, 16, 12), material(color, opacity, .04), parent);
      value.position.copy(position); return value;
    },
    tube(points, radius, color, parent = root, opacity = 1, segments = 48) {
      const curve = new THREE.CatmullRomCurve3(points);
      return { mesh: mesh(new THREE.TubeGeometry(curve, segments, radius, 7, false), material(color, opacity, .06), parent), curve };
    },
    link(a, b, radius, color, parent = root, opacity = 1) {
      const delta = b.clone().sub(a), value = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material(color, opacity), parent);
      value.position.copy(a).add(b).multiplyScalar(.5);
      value.quaternion.setFromUnitVectors(vector(0, 1, 0), delta.normalize()); return value;
    },
    label(text, object, point = vector(), options = {}) { registry.labels.push({ text, object, point, options }); },
    pick(object, spec) { registry.picks.push({ object, spec }); },
    detail(object, min, max = 3) { object.visible = min === 0; registry.details.push({ object, min, max }); },
    representation(object, spec) { object.visible = registry.representations.length === 0; registry.representations.push({ object, spec }); },
    separable(object, offset) { registry.parts.push({ object, base: object.position.clone(), offset }); },
    animate(fn) { registry.animations.push(fn); },
    layout(fn) { registry.layouts.push(fn); },
    status(text) { registry.statuses.push(text); },
    narrative(value) { registry.narratives.push(value); },
    isCurrent() { return true; },
  };
  return { ctx, registry };
}

function finite(values, location) {
  for (let i = 0; i < values.length; i++) assert(Number.isFinite(values[i]), `${location}[${i}] is ${values[i]}`);
}
function nonempty(value, location) { assert(typeof value === 'string' && value.trim(), `${location} must be nonempty text`); }
function attributeArray(attribute) { return attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array; }
function hashArray(hash, array) { hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)); }
function belongsTo(object, root) {
  for (let ancestor = object; ancestor; ancestor = ancestor.parent) if (ancestor === root) return true;
  return false;
}
function inspectGeometry(root) {
  const geometries = new Set();
  root.traverse(object => { if (object.geometry) geometries.add(object.geometry); });
  assert(geometries.size > 0, 'Scene has no geometry');
  const hash = createHash('sha256');
  let vertices = 0, triangles = 0, bytes = 0;
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position');
    assert(position?.count > 0 && position.itemSize === 3, 'Geometry needs nonempty 3D positions');
    vertices += position.count;
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const array = attributeArray(attribute); finite(array, `${geometry.type}.${name}`);
      bytes += array.byteLength; hash.update(name); hashArray(hash, array);
    }
    for (const [name, attributes] of Object.entries(geometry.morphAttributes)) {
      for (const attribute of attributes) finite(attributeArray(attribute), `${geometry.type}.morph.${name}`);
    }
    const index = geometry.getIndex();
    if (index) {
      for (const value of index.array) assert(Number.isInteger(value) && value >= 0 && value < position.count, `Invalid vertex index ${value}/${position.count}`);
      bytes += index.array.byteLength; hashArray(hash, index.array);
    }
    // Lines and points share BufferGeometry, so report triangles only on meshes.
    let isMesh = false;
    root.traverse(object => { if (object.geometry === geometry && object.isMesh) isMesh = true; });
    if (isMesh) triangles += (index?.count ?? position.count) / 3;
  }
  return { geometries: geometries.size, vertices, triangles, bytes, geometryFingerprint: hash.digest('hex').slice(0, 16) };
}
function inspectFrame(root, location) {
  root.updateMatrixWorld(true);
  let objects = 0, instances = 0, visibleRenderables = 0;
  root.traverse(object => {
    objects++;
    finite(object.position.toArray(), `${location}:position`);
    finite(object.quaternion.toArray(), `${location}:quaternion`);
    finite(object.scale.toArray(), `${location}:scale`);
    finite(object.matrix.elements, `${location}:matrix`);
    finite(object.matrixWorld.elements, `${location}:matrixWorld`);
    if (object.isInstancedMesh) {
      assert(Number.isInteger(object.count) && object.count >= 0 && object.count <= object.instanceMatrix.count, 'Invalid instance count');
      finite(object.instanceMatrix.array, `${location}:instanceMatrix`);
      if (object.instanceColor) finite(object.instanceColor.array, `${location}:instanceColor`);
      instances += object.count;
    }
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      finite([material.opacity], `${location}:material.opacity`);
      if (material.color) finite(material.color.toArray(), `${location}:material.color`);
      if (material.emissive) finite([...material.emissive.toArray(), material.emissiveIntensity], `${location}:material.emissive`);
    }
  });
  root.traverseVisible(object => { if (object.geometry && (object.isMesh || object.isLine || object.isPoints)) visibleRenderables++; });
  assert(visibleRenderables > 0, `${location}: no visible renderable geometry`);
  return { objects, instances, visibleRenderables };
}
function inspectNarrative(narrative) {
  assert(Number.isFinite(narrative.duration) && narrative.duration > 0, 'Narrative duration must be positive');
  assert(narrative.steps.length > 0, 'Narrative needs steps');
  let previous = -1;
  for (const step of narrative.steps) {
    assert(Number.isFinite(step.at) && step.at >= 0 && step.at < narrative.duration && step.at > previous, `Invalid narrative step time ${step.at}`);
    nonempty(step.label, 'Narrative step label'); nonempty(step.description, 'Narrative step description'); previous = step.at;
  }
}
function inspectRegistry(root, registry, requireNarrative) {
  assert(registry.picks.length > 0, 'Scene has no inspectable structures');
  for (const { object, spec } of registry.picks) {
    assert(belongsTo(object, root), `Detached pick object: ${spec.id}`);
    nonempty(spec.id, 'Pick id'); nonempty(spec.label, `Pick ${spec.id} label`);
    for (const key of ['childTopic', 'topicId']) if (spec[key] !== undefined) assert(topicIds.has(spec[key]), `Pick ${spec.id} links to unknown ${key} ${spec[key]}`);
    for (const key of ['level', 'maxLevel']) if (spec[key] !== undefined) assert(Number.isInteger(spec[key]) && spec[key] >= 0 && spec[key] <= 3, `Pick ${spec.id} invalid ${key}`);
  }
  for (const { object, text, point, options } of registry.labels) {
    assert(belongsTo(object, root), `Detached label object: ${text}`); nonempty(text, 'Label'); finite(point.toArray(), 'Label position');
    if(options.normal){finite(options.normal.toArray(),'Label surface normal');assert(Math.abs(options.normal.length()-1)<.001,`Label ${text} needs a unit surface normal`);}
  }
  for (const { object, min, max } of registry.details) {
    assert(belongsTo(object, root), 'Detached detail object');
    assert(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && min <= max && max <= 3, `Invalid detail interval ${min}..${max}`);
  }
  for (const { object, base, offset } of registry.parts) {
    assert(belongsTo(object, root), 'Detached separable object'); finite(base.toArray(), 'Separation base'); finite(offset.toArray(), 'Separation offset');
  }
  const representationIds = new Set();
  for (const { object, spec } of registry.representations) {
    assert(belongsTo(object, root), `Detached representation: ${spec.id}`);
    nonempty(spec.id, 'Representation id'); nonempty(spec.label, 'Representation label'); nonempty(spec.description, 'Representation description');
    assert(!representationIds.has(spec.id), `Duplicate representation: ${spec.id}`); representationIds.add(spec.id);
    if(spec.scale!==undefined)nonempty(spec.scale,'Representation scale');
    if(['circuit','axon'].includes(spec.id))assert.equal(spec.scale,'Schematic','Macro schematic must not inherit anatomical centimeter units');
    if (spec.narrative) inspectNarrative(spec.narrative);
  }
  assert(registry.narratives.length <= 1, 'A scene cannot define conflicting default animation narratives');
  if (requireNarrative) assert(registry.narratives.length || registry.representations.some(r => r.spec.narrative), 'Each microscopic scene must define an animation narrative');
  // Anatomy and tractography do not imply measured temporal activity. Exercise
  // their illustrative detail animations without requiring a biological story.
  if (!registry.narratives.length) return { duration: 18, steps: [] };
  const narrative = registry.narratives[0];
  inspectNarrative(narrative);
  return narrative;
}
function dispose(root, registry) {
  const geometries = new Set(), materials = registry.materials;
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.clear();
}

const report = [], failures = [];
try {
  for (const topic of topics) {
    const { ctx, registry } = instrument();
    try {
      await (['brain', 'tracts'].includes(topic.scene) ? buildMacroScene : buildMicroScene)(topic, ctx);
      const defaultNarrative = inspectRegistry(ctx.root, registry, !['brain', 'tracts'].includes(topic.scene));
      if(['brain-overview','cerebral-cortex'].includes(topic.id)){
        const measured=registry.representations.find(r=>r.spec.id==='measured');assert(measured,'Opaque cortex needs its measured representation');
        const measuredLabels=registry.labels.filter(label=>belongsTo(label.object,measured.object));
        const orientation=new Set(['Anterior','Posterior','Superior']);
        assert.deepEqual(measuredLabels.filter(label=>orientation.has(label.text)).map(label=>label.text).sort(),[...orientation].sort(),'Standard lateral view needs its source-axis orientation landmarks');
        const labels=measuredLabels.filter(label=>!orientation.has(label.text));
        assert.equal(labels.length,8,'Opaque exterior should label the four outer lobes in each hemisphere');
        for(const label of labels){assert(!/insular|limbic|midbrain|cerebellum/i.test(label.text),`Occluded anatomy must not label the opaque exterior: ${label.text}`);assert(label.options.normal,'Exterior labels need surface orientation');}
      }
      if(topic.id==='synaptic-integration'){
        ctx.root.updateMatrixWorld(true);
        const branch=registry.picks.find(p=>p.spec.id==='integrating-branch')?.object;assert(branch?.geometry,'Integration needs its dendritic shaft');
        let soma;ctx.root.traverse(object=>{if(object.geometry?.type==='SphereGeometry'&&(!soma||object.geometry.parameters.radius>soma.geometry.parameters.radius))soma=object;});assert(soma,'Integration needs a cell body');
        const center=soma.getWorldPosition(vector()),radius=soma.geometry.parameters.radius*soma.getWorldScale(vector()).x;
        const positions=branch.geometry.attributes.position;let enclosed=0;
        for(let i=0;i<positions.count;i++){const vertex=vector().fromBufferAttribute(positions,i).applyMatrix4(branch.matrixWorld);if(vertex.distanceTo(center)<radius)enclosed++;}
        assert(enclosed>=6,'A patch of dendritic surface must overlap the soma, not just the centerline');
      }
      const geometry = inspectGeometry(ctx.root);
      const representations = registry.representations.length ? registry.representations : [{ spec: { id: 'default' } }];
      const frames = [], lodCounts = [], viewCounts = {};
      for (const representation of representations) {
        const narrative = representation.spec.narrative === null ? { duration: 18, steps: [] } : representation.spec.narrative ?? defaultNarrative;
        // Include event boundaries, both sides of transitions, and the loop seam.
        const times = [...new Set([0, .001, narrative.duration / 4, narrative.duration / 2, narrative.duration * .75, narrative.duration - .001, narrative.duration, narrative.duration + .001,
          ...narrative.steps.flatMap(step => [Math.max(0, step.at - .001), step.at, step.at + .001])])].sort((a, b) => a - b);
        viewCounts[representation.spec.id] = [];
        for (let level = 0; level <= 3; level++) {
          for (const detail of registry.details) detail.object.visible = level >= detail.min && level <= detail.max;
          for (const view of registry.representations) view.object.visible = view === representation;
          for (const separation of registry.parts.length ? [0, 1] : [0]) {
            for (const time of times) {
              for (const part of registry.parts) part.object.position.copy(part.base).addScaledVector(part.offset, separation);
              for (const animate of registry.animations) animate(time, 1 / 60);
              for (const layout of registry.layouts) layout();
              const frame = inspectFrame(ctx.root, `${topic.id}:${representation.spec.id}:LOD${level},t=${time},separation=${separation}`);
              frames.push(frame);
            }
          }
          viewCounts[representation.spec.id].push(frames.at(-1).visibleRenderables);
        }
      }
      lodCounts.push(...viewCounts[representations[0].spec.id]);
      inspectGeometry(ctx.root); // Catch mutations to geometry during animation.
      const semanticFingerprint = createHash('sha256').update(JSON.stringify({ geometry: geometry.geometryFingerprint, picks: registry.picks.map(({ spec }) => spec), defaultNarrative, representations: registry.representations.map(r => r.spec) })).digest('hex').slice(0, 16);
      const row = { id: topic.id, scene: topic.scene, ...geometry, objects: frames[0].objects, instances: frames[0].instances, picks: registry.picks.length, distinctPickIds: new Set(registry.picks.map(({ spec }) => spec.id)).size, labels: registry.labels.length, animations: registry.animations.length, frames: frames.length, lodVisible: lodCounts, representationViews: viewCounts, semanticFingerprint };
      report.push(row);
      console.log(`PASS ${topic.id.padEnd(25)} ${String(row.geometries).padStart(4)} geometries | ${String(row.picks).padStart(3)} picks | LOD ${lodCounts.join('/')} | ${row.semanticFingerprint}`);
    } catch (error) {
      failures.push({ id: topic.id, error: error.stack ?? String(error) });
      console.error(`FAIL ${topic.id}: ${error.message}`);
    } finally { dispose(ctx.root, registry); }
  }
} finally { globalThis.fetch = originalFetch; }

const variants = Object.fromEntries([...new Set(topics.map(topic => topic.scene))].map(scene => {
  const rows = report.filter(row => row.scene === scene);
  return [scene, { topics: rows.length, distinctGeometry: new Set(rows.map(row => row.geometryFingerprint)).size, distinctSemantics: new Set(rows.map(row => row.semanticFingerprint)).size }];
}));
await writeFile(path.join(project, '.astro', 'brain-scene-report.json'), JSON.stringify({ scope: 'Structural scene validation; visual and browser checks remain separate.', topics: report, variants, fetched: [...fetched].sort(), fetchFailures, failures }, null, 2) + '\n');
assert.equal(fetchFailures.length, 0, `Local model asset failures:\n${fetchFailures.join('\n')}`);
assert.equal(failures.length, 0, `Scene failures:\n${failures.map(({ id, error }) => `${id}: ${error}`).join('\n')}`);
assert.equal(report.length, topics.length, 'Every curriculum topic must build');
console.log(`Validated ${report.length} scenes, ${report.reduce((sum, row) => sum + row.frames, 0)} animation/LOD frames, ${fetched.size} local assets.`);
console.log(`Distinct variants (geometry/semantics): ${Object.entries(variants).map(([scene, count]) => `${scene} ${count.distinctGeometry}/${count.distinctSemantics}`).join('; ')}`);
