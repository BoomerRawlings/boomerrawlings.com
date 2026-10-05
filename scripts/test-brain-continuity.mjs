import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, transform } from 'esbuild';
import * as THREE from 'three';
import { topics } from '../public/brain/curriculum.js';

// Regression contract: tiny zoom changes must not replace most of the current
// representation, and wheel input must not navigate to another study topic.
// The real builders and actual renderer handlers run without DOM/WebGL setup.
const project = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(project, 'public');
const output = path.join(project, '.astro', 'brain-continuity-check.mjs');
await mkdir(path.dirname(output), { recursive: true });
await build({ stdin: { contents: "export { buildMicroScene } from './src/scripts/brain/scenes-micro.ts'; export { buildMacroScene } from './src/scripts/brain/scenes-macro.ts'; export * from './src/scripts/brain/zoom.ts'; export { compassAxes, compassProjection } from './src/scripts/brain/compass.ts';", resolveDir: project, sourcefile: 'continuity-entry.ts' }, outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent' });
const module = await import(pathToFileURL(output));
const { buildMicroScene, buildMacroScene } = module;
const rendererSource = (await transform(await readFile(path.join(project, 'src/scripts/brain/models.ts'), 'utf8'), { loader: 'ts', target: 'es2022' })).code;

function closingBrace(source, body) {
  let depth = 0, quote = '', escaped = false;
  for (let i = body; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return i;
  }
  throw new Error('Cannot extract instrumented code block');
}
function actualFunction(name) {
  const start = rendererSource.indexOf(`function ${name}(`);
  assert(start >= 0, `Renderer handler ${name} must be available for behavioral instrumentation`);
  const body = rendererSource.indexOf('{', start);
  return rendererSource.slice(start, closingBrace(rendererSource, body) + 1);
}
const createDriver = new Function('THREE', 'registry', 'topic', 'zoomMath', `
  const {zoomDetailLevel,detailOpacity,wheelZoomFactor}=zoomMath;
  const camera={position:new THREE.Vector3(0,0,10)},controls={target:new THREE.Vector3(),minDistance:1.2,maxDistance:16.5,update(){}},baseDistance=10;
  const targetGoal=new THREE.Vector3(),cameraGoal=camera.position.clone(),reduced={matches:false},ready=true;
  const classes=new Set(),container={dataset:{},clientHeight:800,classList:{add(name){classes.add(name);},remove(name){classes.delete(name);}}};
  const details=registry.details,picks=registry.picks,representations=registry.representations||[],current=topic;
  const navigation=[],options={onSelect:id=>navigation.push(id)},performance={now:()=>10000};
  let detailLevel=-1,hover=null,focused=null,pendingEntry,moving=false,dirty=false;
  let representationId='',narrative=null,sceneNarrative=null,sceneStatus='',time=0,lastUi=0,representationTimer,generation=1,disposed=false;
  const timers=new Map();let nextTimer=1;
  function setTimeout(fn){const id=nextTimer++;timers.set(id,fn);return id;}function clearTimeout(id){timers.delete(id);}
  function flushTimers(){const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}
  function fit(){updateDetail(true);}
  function shown(object){for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;}
  function setHover(part){hover=part;} function clearFocus(){focused=null;pendingEntry=undefined;}
  function highlight(){}
  ${actualFunction('available')}
  ${actualFunction('updateDetail')}
  ${actualFunction('activateRepresentation')}
  ${actualFunction('setRepresentation')}
  ${actualFunction('setCamera')}
  ${actualFunction('zoomBy')}
  ${actualFunction('enter')}
  ${actualFunction('onWheel')}
  return {
    representation(id){activateRepresentation(id);updateDetail(true);},
    ratio(value){camera.position.set(0,0,value*baseDistance);moving=false;updateDetail();return detailLevel;},
    state(){return {representationId,navigation:[...navigation]};},
    switchback(first,second){activateRepresentation(first);setRepresentation(second);setRepresentation(first);flushTimers();return {representationId,pending:timers.size,changing:classes.has('model-changing')};},
    switchTo(id){setRepresentation(id);flushTimers();return representationId;},
    staleSwitch(first,second){activateRepresentation(first);setRepresentation(second);generation++;flushTimers();return representationId;},
    wheel(target,deltas,mode=0){
      pendingEntry=target;moving=false;camera.position.set(0,0,baseDistance*.25);controls.target.set(0,0,0);
      const start=camera.position.clone(),distances=[];let prevented=0,stopped=0;
      for(const deltaY of deltas){onWheel({deltaY,deltaMode:mode,preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}});distances.push(cameraGoal.distanceTo(targetGoal));}
      return {navigation:[...navigation],distances,prevented,stopped,immediateJump:camera.position.distanceTo(start)};
    }
  };
`);

// Execute the real representation UI callback with a minimal node identity
// fixture. Replacing focused buttons would lose keyboard focus in the browser.
const appSource = (await transform(await readFile(path.join(project, 'src/scripts/brain/app.ts'), 'utf8'), { loader: 'ts', target: 'es2022' })).code;
const representationCallback = /onRepresentations:\s*\([^)]*\)\s*=>\s*\{/.exec(appSource);
assert(representationCallback, 'Representation UI callback must be instrumentable');
const callbackBody = representationCallback.index + representationCallback[0].length - 1;
const renderRepresentations = new Function('views','active','$','button','viewer','selected',appSource.slice(callbackBody + 1,closingBrace(appSource,callbackBody)));
let activeElement = null;
const group = { hidden:false, children:[], querySelectorAll(){return [...this.children];},replaceChildren(...children){if(activeElement&&!children.includes(activeElement))activeElement=null;this.children=children;} };
const elements = { 'model-representations':group,'model-kind':{},'scale-badge':{},'model-view':{} };
const createButton = label => ({textContent:label,dataset:{},title:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;},focus(){activeElement=this;}});
const renderControls = (views,id) => renderRepresentations(views,id,key=>elements[key],createButton,null,{scale:'Centimeters'});
const views = [{id:'measured',label:'Anatomy',description:'Measured regional anatomy',scale:'Centimeters'},{id:'axon',label:'Axon schematic',description:'Teaching model of an axon',scale:'Schematic'}];
renderControls(views,'measured');
const focusedButton=group.children[1];focusedButton.focus();renderControls(views,'axon');
assert.equal(group.children[1],focusedButton,'Changing representation must retain its button node');
assert.equal(activeElement,focusedButton,'Changing representation must retain keyboard focus');
assert.equal(focusedButton.attributes['aria-pressed'],'true');
assert.equal(elements['scale-badge'].textContent,'Schematic','Representation scale must override topic scale');
const nextTopicViews=views.map(view=>view.id==='measured'?{...view,label:'Tractography',description:'Measured population streamlines'}:view);
renderControls(nextTopicViews,'measured');
assert.equal(group.children[0].textContent,'Tractography','Reused representation controls must refresh labels across topics');
assert.equal(group.children[0].title,'Measured population streamlines','Reused representation controls must refresh descriptions across topics');

// Actual fitting code, projected against real oblique geometry. This catches
// depth-axis clipping that an axis-aligned width/height heuristic misses.
const createFitDriver = new Function('THREE','root','aspect','fixture',`
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),defaultDirection=V(7.4,4,9.4).normalize();
  const config=fixture||{},parts=config.parts||[],current=config.topic||{id:'brain-overview'},details=config.details||[],representations=config.representations||[],representationId=config.representationId||'',camera=new THREE.PerspectiveCamera(37,aspect,.015,500);
  const controls={target:V(),update(){camera.lookAt(this.target);camera.updateMatrixWorld(true);}},home=V(),targetGoal=V(),cameraGoal=V(),reduced={matches:false};
  let baseDistance=12,moving=false,dirty=false,exploded=false;camera.position.set(0,0,12);
  function updateDetail(){}
  ${actualFunction('topicDirection')}
  ${actualFunction('setCamera')}
  ${actualFunction('fit')}
  return {fit(){fit();return camera;},separate(value){exploded=value;fit(false,true);return{camera,goal:cameraGoal.clone(),moving};},settle(){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);controls.update();moving=false;return camera;},preserve(){targetGoal.copy(controls.target).add(V(.2,-.1,.3));cameraGoal.copy(targetGoal).addScaledVector(defaultDirection,baseDistance*.42);moving=true;camera.aspect=.7;camera.updateProjectionMatrix();fit(true);return {ratio:camera.position.distanceTo(controls.target)/baseDistance,target:controls.target.toArray()};}};
`);
let fitCases=0;
for(const aspect of [.4,.7,1,16/9,2.5])for(const dimensions of [[12,.6,8],[.3,7,4],[.18,.25,.2]]){
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(...dimensions),mat=new THREE.MeshBasicMaterial(),box=new THREE.Mesh(geometry,mat);
  box.rotation.set(.61,.43,.28);box.position.set(3,-2,1);root.add(box);
  const hidden=new THREE.Mesh(new THREE.BoxGeometry(100,100,100),mat);hidden.visible=false;root.add(hidden);
  const particleContext=new THREE.Mesh(new THREE.SphereGeometry(20,8,6),mat);particleContext.position.set(0,50,0);particleContext.userData.fitIgnore=true;root.add(particleContext);
  const fitDriver=createFitDriver(THREE,root,aspect),camera=fitDriver.fit();
  const vertices=geometry.attributes.position;for(let i=0;i<vertices.count;i++){const ndc=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(box.matrixWorld).project(camera);assert(Math.abs(ndc.x)<.99&&Math.abs(ndc.y)<.99&&Math.abs(ndc.z)<1,`Oblique ${dimensions.join('×')} object clipped at aspect ${aspect}`);}
  const preserved=fitDriver.preserve();assert(Math.abs(preserved.ratio-.42)<1e-9,'Resize must preserve pending zoom ratio');assert(preserved.target.every((value,i)=>Math.abs(value-[3.2,-2.1,1.3][i])<1e-9),'Resize must preserve pending camera target');
  geometry.dispose();hidden.geometry.dispose();particleContext.geometry.dispose();mat.dispose();fitCases++;
}

// Source axes are anatomical world axes; the compass must project them through
// the inverse camera orientation without changing that orientation.
assert.deepEqual(module.compassAxes.map(axis=>[axis.anatomy,...axis.vector]),[
  ['R',1,0,0],['L',-1,0,0],['S',0,1,0],['I',0,-1,0],['A',0,0,1],['P',0,0,-1],
]);
let compassCases=0;
for(const [position,up,expected] of[
  [[0,0,1],[0,1,0],[[1,0,0],[0,1,0],[0,0,1]]],
  [[1,0,0],[0,1,0],[[0,0,1],[0,1,0],[-1,0,0]]],
  [[-1,0,0],[0,1,0],[[0,0,-1],[0,1,0],[1,0,0]]],
  [[0,1,0],[0,0,-1],[[1,0,0],[0,0,1],[0,-1,0]]],
]){
  const camera=new THREE.PerspectiveCamera();camera.position.fromArray(position);camera.up.fromArray(up);camera.lookAt(0,0,0);
  const orientation=camera.quaternion.clone();
  for(const [index,axis] of [0,2,4].entries()){
    const projected=module.compassProjection(module.compassAxes[axis].vector,camera.quaternion);
    assert(projected.distanceTo(new THREE.Vector3(...expected[index]))<1e-9,`${module.compassAxes[axis].name} compass direction reversed for view ${position}`);
    assert(module.compassProjection(module.compassAxes[axis+1].vector,camera.quaternion).add(projected).length()<1e-9,'Opposite anatomical axes must stay opposite');compassCases++;
  }
  assert(camera.quaternion.equals(orientation),'Compass projection must not mutate camera orientation');
}

function assertVisibleFits(root,camera,label){
  root.updateMatrixWorld(true);let meshes=0;
  root.traverseVisible(object=>{
    if(object.userData.contextOnly||object.userData.fitIgnore)return;
    let bounds;
    if(object.isInstancedMesh){object.computeBoundingBox();bounds=object.boundingBox;}
    else if(object.geometry){object.geometry.computeBoundingBox();bounds=object.geometry.boundingBox;}
    if(!bounds||bounds.isEmpty())return;
    for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){
      const p=new THREE.Vector3(x,y,z).applyMatrix4(object.matrixWorld).project(camera);
      assert(Math.abs(p.x)<.99&&Math.abs(p.y)<.99&&Math.abs(p.z)<1,`${label}: ${object.name||object.type} clips after settled fit`);
    }
    meshes++;
  });
  assert(meshes>0,`${label}: empty geometry cannot validate framing`);
}
let separatedFitCases=0;
function checkSeparatedFit(root,fixture,label){
  for(const aspect of[.4,1,2.5]){
    const driver=createFitDriver(THREE,root,aspect,fixture);driver.fit();
    for(const separated of[true,false]){
      const poses=fixture.parts.map(part=>part.object.position.clone()),before=driver.settle().position.clone();
      const pending=driver.separate(separated);
      assert(pending.camera.position.equals(before),`${label}: Separate must animate camera rather than jump`);
      assert(pending.moving,`${label}: Separate must schedule camera interpolation`);
      fixture.parts.forEach((part,index)=>assert(part.object.position.equals(poses[index]),`${label}: fitting must restore nested part positions before rendering`));
      fixture.parts.forEach(part=>part.object.position.copy(part.base).addScaledVector(part.offset,separated?1:0));
      assertVisibleFits(root,driver.settle(),`${label}/${separated?'separated':'assembled'}/aspect=${aspect}`);separatedFitCases++;
    }
  }
}
// A translated/rotated parent and independently translated children exercise
// local-vs-world offsets, including nested separable registrations.
{
  const root=new THREE.Group(),parent=new THREE.Group(),material=new THREE.MeshBasicMaterial();root.add(parent);parent.position.set(2,-1,3);parent.rotation.set(.3,.8,-.2);
  const a=new THREE.Mesh(new THREE.BoxGeometry(2,.6,4),material),b=new THREE.Mesh(new THREE.BoxGeometry(.5,3,.7),material);a.position.set(-1,0,0);b.position.set(1,0,0);parent.add(a,b);
  const parts=[{object:parent,offset:new THREE.Vector3(3,-2,1)},{object:a,offset:new THREE.Vector3(-6,3,2)},{object:b,offset:new THREE.Vector3(7,-2,-1)}].map(part=>({...part,base:part.object.position.clone()}));
  checkSeparatedFit(root,{parts},'nested transformed parts');a.geometry.dispose();b.geometry.dispose();material.dispose();
}

// The selected object must remain framed, not only the initial whole model.
const createFocusDriver=new Function('THREE','aspect',`
 const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),camera=new THREE.PerspectiveCamera(37,aspect,.015,500),controls={target:V()},options={};
 const baseDistance=12;let focused=null,pendingEntry,dirty=false;camera.position.set(7.4,4,9.4);camera.lookAt(controls.target);camera.updateMatrixWorld(true);
 function enter(){} function highlight(){} function setCamera(target,distance){const direction=camera.position.clone().sub(controls.target).normalize();camera.position.copy(target).addScaledVector(direction,distance);controls.target.copy(target);camera.lookAt(target);camera.updateMatrixWorld(true);}
 ${actualFunction('focus')}
 return object=>{focus({object,spec:{}});return camera;};
`);
let focusCases=0;
for(const aspect of[.4,.7,1,16/9,2.5])for(const dimensions of[[.44,1.8,.44],[8,.2,3],[.3,.4,.2]]){
 const geometry=new THREE.BoxGeometry(...dimensions),material=new THREE.MeshBasicMaterial(),object=new THREE.Mesh(geometry,material);object.rotation.set(.3,.4,.2);object.position.set(.3,-.2,.1);object.updateMatrixWorld(true);
 const camera=createFocusDriver(THREE,aspect)(object),vertices=geometry.attributes.position;
 for(let i=0;i<vertices.count;i++){const p=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld).project(camera);assert(Math.abs(p.x)<.99&&Math.abs(p.y)<.99,'Selected anatomical structure must fit the camera');}
 geometry.dispose();material.dispose();focusCases++;
}

const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href, 'http://continuity.local');
  assert.equal(url.origin, 'http://continuity.local', 'Test must use local model assets');
  const file = path.resolve(publicRoot, `.${decodeURIComponent(url.pathname)}`);
  assert(file.startsWith(publicRoot + path.sep), 'Asset must remain in public/');
  return new Response(await readFile(file), { status: 200 });
};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function context() {
  const root = new THREE.Group(), registry = { details: [], picks: [], representations: [], parts: [], animations: [], layouts: [], materials: new Set() };
  const material = (color = 0xdbe9ed, opacity = 1, emissive = 0) => {
    const mat = new THREE.MeshStandardMaterial({ color, opacity, transparent: opacity < 1, emissive: color, emissiveIntensity: emissive }); registry.materials.add(mat); return mat;
  };
  const mesh = (geometry, mat, parent = root) => { const result = new THREE.Mesh(geometry, mat); parent.add(result); return result; };
  const ctx = { root, material, mesh,
    ball(position, radius, color, parent = root, opacity = 1) { const result = mesh(new THREE.SphereGeometry(radius, 16, 12), material(color, opacity), parent); result.position.copy(position); return result; },
    tube(points, radius, color, parent = root, opacity = 1, segments = 48) { const curve = new THREE.CatmullRomCurve3(points); return { mesh: mesh(new THREE.TubeGeometry(curve, segments, radius, 7, false), material(color, opacity), parent), curve }; },
    link(a, b, radius, color, parent = root, opacity = 1) { const delta = b.clone().sub(a), result = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material(color, opacity), parent); result.position.copy(a).add(b).multiplyScalar(.5); result.quaternion.setFromUnitVectors(V(0, 1), delta.normalize()); return result; },
    detail(object, min, max = 3) { object.visible = min === 0; registry.details.push({ object, min, max }); },
    representation(object, spec) { object.visible = registry.representations.length === 0; registry.representations.push({ object, spec }); },
    pick(object, spec) { registry.picks.push({ object, spec }); },
    animate(fn) { registry.animations.push(fn); }, layout(fn) { registry.layouts.push(fn); },
    separable(object,offset) { registry.parts.push({object,offset,base:object.position.clone()}); },
    label() {}, status() {}, narrative() {}, isCurrent() { return true; },
  };
  return { ctx, registry };
}
function visibleGeometry(root) {
  const result = new Set();
  root.traverseVisible(object => {
    for (let parent = object; parent; parent = parent.parent) if (parent.userData.contextOnly) return;
    if (object.geometry) result.add(object.uuid);
  });
  return result;
}
function dispose(root, registry) {
  const geometries = new Set(), materials = registry.materials;
  root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.isInstancedMesh) object.dispose(); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.clear();
}

const cases = [], failures = [], wheelCases = [], switchCases = [];
try {
  for (const topic of topics) {
    const { ctx, registry } = context();
    try {
      await (['brain', 'tracts'].includes(topic.scene) ? buildMacroScene : buildMicroScene)(topic, ctx);
      for (const animate of registry.animations) animate(0, 0);
      for (const layout of registry.layouts) layout();
      const driver = createDriver(THREE, registry, topic, module);
      const views = registry.representations.length ? registry.representations.map(r => r.spec.id) : ['default'];
      for (const representation of views) {
        if (representation !== 'default') driver.representation(representation);
        driver.ratio(1);
        if(['brain','tracts'].includes(topic.scene))checkSeparatedFit(ctx.root,{...registry,topic,representationId:representation},`${topic.id}/${representation}`);
        const baseline = visibleGeometry(ctx.root);
        for (const threshold of [.84, .62, .42]) {
          const from = driver.ratio(threshold + .0001), before = visibleGeometry(ctx.root);
          const weightsBefore = registry.details.map(d => d.object.userData.zoomOpacity);
          const to = driver.ratio(threshold - .0001), after = visibleGeometry(ctx.root);
          assert(before.size && after.size, `${topic.id}/${representation}: both sides of zoom boundary must contain geometry`);
          const retained = [...before].filter(id => after.has(id)).length, lost = before.size - retained;
          const row = { topic: topic.id, representation, ratioBefore: threshold + .0001, ratioAfter: threshold - .0001, from, to, before: before.size, after: after.size, retained, lost, lostFraction: lost / before.size };
          cases.push(row);
          if (lost) failures.push(`${topic.id}/${representation}: zoom ${row.ratioBefore.toFixed(4)}→${row.ratioAfter.toFixed(4)} hides ${lost}/${before.size} visible objects; detail must be additive`);
          registry.details.forEach((detail,index) => {
            const weight = detail.object.userData.zoomOpacity;
            assert(Number.isFinite(weight) && weight >= 0 && weight <= 1, `${topic.id}: invalid detail opacity`);
            assert(Math.abs(weight - weightsBefore[index]) < .01, `${topic.id}: opacity jumps at zoom threshold`);
          });
        }
        // Sweeping the entire range also catches a swap moved away from old thresholds.
        let previousGeometry = baseline;
        for (let i = 0; i <= 50; i++) {
          driver.ratio(1 - i * .0176);
          const current = visibleGeometry(ctx.root), missing = [...baseline].filter(id => !current.has(id));
          assert.equal(missing.length, 0, `${topic.id}/${representation}: base geometry lost during zoom sweep`);
          assert([...previousGeometry].every(id => current.has(id)), `${topic.id}/${representation}: additive detail disappears while zooming inward`);
          previousGeometry = current;
          if (representation !== 'default') assert.equal(driver.state().representationId, representation, `${topic.id}: zoom changed representation`);
        }
      }
      if (views.length > 1) {
        const reverted = driver.switchback(views[0],views[1]);
        assert.deepEqual(reverted,{representationId:views[0],pending:0,changing:false},`${topic.id}: rapid switchback must cancel the pending alternate view`);
        assert.equal(driver.switchTo(views[1]),views[1],`${topic.id}: explicit switch must activate the selected view`);
        assert.equal(driver.staleSwitch(views[0],views[1]),views[0],`${topic.id}: stale scene timer must not activate an alternate view`);
        switchCases.push(topic.id);
      }
    } finally { dispose(ctx.root, registry); }
  }
  for (const [label, deltas, mode] of [['wheel inward',[-100,-100,-100],0],['trackpad inward',[-1,-2,-3,-2,-1],0],['wheel outward',[100,100,100],0],['line wheel',[-3,-3,-3],1],['page wheel',[-1,-1,-1],2]]) {
    const driver = createDriver(THREE, { details: [], picks: [] }, topics[0], module);
    const result = driver.wheel('myelin',deltas,mode);wheelCases.push({label,...result});
    if (result.navigation.length) failures.push(`${label} navigated ${topics[0].id}→${result.navigation.join(', ')}; navigation must require an explicit action`);
    assert.equal(result.immediateJump,0,`${label}: wheel must set a smooth destination`);
    assert.equal(result.prevented,deltas.length);assert.equal(result.stopped,deltas.length);
    for(let i=0;i<result.distances.length;i++) {const distance=result.distances[i],previous=i?result.distances[i-1]:2.5;assert(Number.isFinite(distance)&&distance>=1.2&&distance<=16.5,`${label}: invalid wheel destination`);assert(deltas[i]<0?distance<=previous:distance>=previous,`${label}: reversed accumulated zoom`);}
  }
  // The animation blend should approach its destination without overshoot and
  // converge equally over elapsed time on common display refresh rates.
  const positions = [30,60,144].map(fps => {let position=0;for(let i=0;i<fps;i++){const previous=position;position+=(1-position)*module.cameraBlend(1/fps);assert(position>=previous&&position<=1,'Camera interpolation must not reverse or overshoot');}return position;});
  assert(Math.max(...positions)-Math.min(...positions)<.00001,'Camera convergence depends on display refresh rate');
  await writeFile(path.join(project, '.astro', 'brain-continuity-report.json'), JSON.stringify({ cases, wheelCases, switchCases, failures }, null, 2) + '\n');
} finally { globalThis.fetch = originalFetch; }
for (const failure of failures) console.error(`FAIL ${failure}`);
assert.equal(failures.length, 0, `${failures.length} zoom-continuity regressions. Details: .astro/brain-continuity-report.json`);
console.log(`PASS ${cases.length} adjacent-zoom checks plus full-range sweeps across ${topics.length} real scenes; ${wheelCases.length} wheel/trackpad cases; ${switchCases.length} representation timer cases; focused controls retained; ${fitCases} oblique camera fits; ${separatedFitCases} separated/nested camera fits; ${compassCases} anatomical compass projections; ${focusCases} selected-structure fits.`);
