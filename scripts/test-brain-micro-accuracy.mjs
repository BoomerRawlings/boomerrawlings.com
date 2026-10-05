import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {transform} from 'esbuild';
import * as THREE from 'three';
import {topics} from '../public/brain/curriculum.js';

// Anatomical assertions exercise production geometry, not labels alone.
// Primary evidence: Sun et al. 2006 https://pmc.ncbi.nlm.nih.gov/articles/PMC6674555/
// Isope & Barbour 2002 https://pmc.ncbi.nlm.nih.gov/articles/PMC6757845/
// Kravitz et al. 2010 https://pmc.ncbi.nlm.nih.gov/articles/PMC3552484/
// Nav IFM structure https://pmc.ncbi.nlm.nih.gov/articles/PMC9114117/
// CaMKII dodecamer https://pmc.ncbi.nlm.nih.gov/articles/PMC3184253/
// ATPase https://www.rcsb.org/structure/2ZXE
// Channel assemblies: RCSB 6J8J, 2R9R, 7MIY, 3KG2, 4PE5, 6D6T.
// EAAT1 https://pmc.ncbi.nlm.nih.gov/articles/PMC5410168/
// Connexin36 https://pmc.ncbi.nlm.nih.gov/articles/PMC10008584/
// Human pyramidal reconstructions (Fig2/6) https://pmc.ncbi.nlm.nih.gov/articles/PMC11094408/
// Dye-filled astrocyte morphology (Fig1/2) https://pmc.ncbi.nlm.nih.gov/articles/PMC6757596/
// Human bouton/spine EM (Fig3/4) https://pmc.ncbi.nlm.nih.gov/articles/PMC12205628/
const rootPath=path.resolve('.');
const source=await fs.readFile(process.env.BRAIN_MICRO_ACCURACY_SOURCE||'src/scripts/brain/scenes-micro.ts','utf8');
const compiled=await transform(source,{loader:'ts',format:'esm',target:'es2022'});
const compiledPath=path.join(rootPath,'.astro',`brain-micro-accuracy-${process.pid}.mjs`);
await fs.mkdir(path.dirname(compiledPath),{recursive:true});await fs.writeFile(compiledPath,compiled.code);
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{assert(String(url).startsWith('/brain/models/'));return{ok:true,json:async()=>JSON.parse(await fs.readFile(path.join(rootPath,'public',String(url).slice(1)),'utf8'))};};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const near=(a,b,message)=>assert(a.distanceTo(b)<1e-5,message);
function instrument(){
  const root=new THREE.Group(),picks=[],animations=[],representations=[],labels=[],details=[];
  const material=(color=0xcbdcdd,opacity=1,emissive=0)=>new THREE.MeshStandardMaterial({color,opacity,transparent:opacity<1,emissive:color,emissiveIntensity:emissive});
  const mesh=(geometry,mat,parent=root)=>{const object=new THREE.Mesh(geometry,mat);parent.add(object);return object;};
  const ctx={root,material,mesh,
    ball(p,r,color,parent=root,opacity=1){const o=mesh(new THREE.SphereGeometry(r,12,8),material(color,opacity),parent);o.position.copy(p);return o;},
    tube(points,r,color,parent=root,opacity=1,segments=48){const curve=new THREE.CatmullRomCurve3(points);return{mesh:mesh(new THREE.TubeGeometry(curve,segments,r,7,false),material(color,opacity),parent),curve};},
    link(a,b,r,color,parent=root,opacity=1){const delta=b.clone().sub(a),o=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material(color,opacity),parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1),delta.normalize());return o;},
    pick(object,spec){picks.push({object,spec});},label(text,object,point,options){labels.push({text,object,point,options});},
    animate(fn){animations.push(fn);},detail(object,min,max=3){details.push({object,min,max});},separable(){},layout(){},status(){},narrative(){},isCurrent(){return true;},
    representation(object,spec){representations.push({object,spec});}
  };
  return{ctx,root,picks,animations,representations,labels,details,
    find(id){const value=picks.find(p=>p.spec.id===id);assert(value,`Missing anatomical structure ${id}`);return value;},
    matching(pattern){return picks.filter(p=>pattern.test(p.spec.id));},
    frame(t){animations.forEach(fn=>fn(t,1/60));root.updateMatrixWorld(true);},
    dispose(){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear();}
  };
}
function inside(object,parent){for(let o=object;o;o=o.parent)if(o===parent)return true;return false;}
function point(pick,u=.5){return pick.object.localToWorld(pick.object.geometry.parameters.path.getPointAt(u));}
function rho(p){return Math.hypot(p.x,p.z);}
function descendants(root,predicate){const list=[];root.traverse(o=>{if(predicate(o))list.push(o);});return list;}
function membraneClearance(s,protein,radius){
  const center=protein.getWorldPosition(V()),scale=protein.parent.getWorldScale(V()).x;
  for(const heads of descendants(s.root,o=>o.userData.lipidHeads))for(let i=0;i<heads.count;i++){const m=new THREE.Matrix4();heads.getMatrixAt(i,m);const p=heads.localToWorld(V().setFromMatrixPosition(m));if(Math.abs(p.y-center.y)<.31*scale)assert(Math.hypot(p.x-center.x,p.z-center.z)>radius*scale,'Integral protein footprint must have a matching lipid cutout');}
}
let checked=0;
try{
  const{buildMicroScene}=await import(pathToFileURL(compiledPath).href);
  for(const topic of topics.filter(t=>!['brain','tracts'].includes(t.scene))){
    const s=instrument();await buildMicroScene(topic,s.ctx);s.frame(0);
    // Conventional silhouettes must survive overview; a named organelle cannot be an empty shell.
    for(const soma of descendants(s.root,o=>o.userData.recognitionFeature==='pyramidal-soma')){
      assert.equal(soma.geometry.type,'LatheGeometry');const p=soma.geometry.parameters.points;
      assert(Math.max(...p.filter(q=>q.y<-.05).map(q=>q.x))>Math.max(...p.filter(q=>q.y>.20).map(q=>q.x))*2,'Pyramidal soma must taper toward the apical pole');
      assert(soma.material.opacity>.9,'A recognizable soma must have a visible surface, with an explicit cutaway rather than a ghost sphere');
    }
    for(const membrane of descendants(s.root,o=>o.userData.membraneRecognitionFace)){
      const position=membrane.geometry.attributes.position,indices=membrane.geometry.index.array;
      const distToSegment=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-u*dx,p[1]-a[1]-u*dz);};
      for(const hole of membrane.userData.membraneRecognitionFace.holes){const center=[hole.x,hole.z];
        for(let i=0;i<indices.length;i+=3){const pts=Array.from(indices.slice(i,i+3),j=>[position.getX(j),position.getZ(j)]),cross=(a,b)=>(b[0]-a[0])*(center[1]-a[1])-(b[1]-a[1])*(center[0]-a[0]),signs=pts.map((a,j)=>cross(a,pts[(j+1)%3]));
          assert(!(signs.every(n=>n>=0)||signs.every(n=>n<=0)),'Continuous synaptic membrane must not close a named protein pore');
          assert(pts.every((a,j)=>distToSegment(center,a,pts[(j+1)%3])>=hole.radius*.994),'Membrane triangles must stay outside the actual protein opening');
        }
      }
    }
    for(const inner of descendants(s.root,o=>o.userData.mitochondrialInnerMembrane)){
      const plates=descendants(inner.parent,o=>o.userData.mitochondrialCrista);assert.equal(plates.length,7,'Mitochondrial cutaway needs lamellar inner-membrane folds');
      assert(plates.every(p=>p.geometry.type==='ExtrudeGeometry'),'Cristae must be membrane plates rather than unattached curly centerlines');
    }
    if(topic.id==='neuron'){
      const trunk=s.find('apical-dendrite').object,body=s.find('neuronal-soma').object,position=trunk.geometry.attributes.position,base=V();for(let i=0;i<7;i++)base.add(V(position.getX(i),position.getY(i),position.getZ(i)));trunk.localToWorld(base.divideScalar(7));
      assert(base.distanceTo(new THREE.Box3().setFromObject(body).clampPoint(base,V()))<.14,'The dominant apical trunk must join the tapered soma');
      assert.equal(descendants(s.root,o=>o.userData.recognitionFeature==='apical-trunk').length,1,'One dominant apical trunk distinguishes a pyramidal cell');
    }
    // Test actual instanced transforms: increasing membrane thickness cannot stretch spherical heads.
    for(const heads of descendants(s.root,o=>o.userData.lipidHeads)){
      const tails=heads.parent.children.find(o=>o.userData.lipidTails);assert(tails&&tails.count===heads.count*2);
      for(let i=0;i<heads.count;i++){const headMatrix=new THREE.Matrix4();heads.getMatrixAt(i,headMatrix);headMatrix.premultiply(heads.matrixWorld);const scale=V().setFromMatrixScale(headMatrix);assert(Math.abs(scale.x-scale.y)<1e-8&&Math.abs(scale.y-scale.z)<1e-8,'Lipid heads must remain round, including thick gating membranes');
        const center=V().setFromMatrixPosition(headMatrix),side=i%2?1:-1;
        for(let j=0;j<2;j++){const matrix=new THREE.Matrix4();tails.getMatrixAt(i*2+j,matrix);matrix.premultiply(tails.matrixWorld);const end=V(0,side*tails.geometry.parameters.height/2,0).applyMatrix4(matrix);assert(end.distanceTo(center)<heads.geometry.parameters.radius*scale.x,'Both lipid tails must attach to their own polar head');}
      }
    }
    for(const protein of descendants(s.root,o=>o.userData.proteinArchitecture)){
      const a=protein.userData.proteinArchitecture,helices=descendants(protein,o=>o.userData.proteinHelix),expected={kir:8,nav:24,cav:24,ampa:12,nmda:12,connexin:4,eaat:24}[a];assert.equal(helices.length,expected,`${a} miniature protein has its real family topology`);
      for(const tm of helices){assert(tm.geometry.type==='TubeGeometry');const path=tm.geometry.parameters.path;assert(path.getPointAt(0).y<0&&path.getPointAt(1).y>0,'Each counted TM helix must actually cross the local membrane');assert(s.details.some(d=>d.object===tm&&d.min===0),'Principal protein backbones must remain visible at their representation overview');}
      const loops=descendants(protein,o=>o.userData.proteinLoop);
      if(a==='ampa'||a==='nmda'){assert.equal(loops.filter(o=>o.userData.proteinLoop==='cytoplasmic-M2-reentry').length,4);for(const l of loops.filter(o=>o.userData.proteinLoop==='cytoplasmic-M2-reentry'))assert(l.geometry.parameters.path.getPointAt(0).y<0&&l.geometry.parameters.path.getPointAt(1).y<0&&l.geometry.parameters.path.getPointAt(.5).y>l.geometry.parameters.path.getPointAt(0).y,'M2 must reenter from the cytoplasmic side');}
      if(a==='eaat'){const inner=loops.filter(o=>o.userData.proteinLoop==='HP1-cytoplasmic-reentry'),outer=loops.filter(o=>o.userData.proteinLoop==='HP2-extracellular-reentry');assert.equal(inner.length,3);assert.equal(outer.length,3);for(const l of inner)assert(l.geometry.parameters.path.getPointAt(0).y<0&&l.geometry.parameters.path.getPointAt(1).y<0);for(const l of outer)assert(l.geometry.parameters.path.getPointAt(0).y>0&&l.geometry.parameters.path.getPointAt(1).y>0);}
    }
    if(topic.id==='cortical-circuit'){
      const layer=s.find('cortical-layer-5').object,half=layer.geometry.parameters.height/2;
      const population=s.find('population-1').object;
      for(const soma of s.matching(/^neuron-pyramidal$/).filter(p=>inside(p.object,population))){const y=soma.object.getWorldPosition(V()).y;assert(Math.abs(y-layer.position.y)<half,'L5 pyramidal somata must lie inside layer V');}
      const thalamic=s.find('population-3').object,layer6=s.find('cortical-layer-6').object;
      assert(new THREE.Box3().setFromObject(thalamic).max.y<layer6.position.y-layer6.geometry.parameters.height/2,'Thalamic relay cells must lie outside cortical layers');
      const edges=s.matching(/^projection-/).map(p=>p.object.userData.circuitEdge);
      assert(edges.some(e=>e?.from==='Thalamic relay input'&&e.to==='L4 spiny stellate'&&e.sign==='excite'),'Thalamus must provide L4 excitation');
      assert(edges.some(e=>e?.from==='L4 basket interneuron'&&e.to==='L4 spiny stellate'&&e.sign==='inhibit'),'Feedforward inhibitory route must have an inhibitory sign');
    }
    if(topic.id==='basal-ganglia'){
      assert.equal(s.matching(/^neuron-spiny$/).length,6,'Both D1 and D2 populations require spiny projection cells');
      const edges=s.matching(/^projection-/).map(p=>p.object.userData.circuitEdge);
      for(const[from,to,sign]of[['D1 striatal ensemble','GPi / SNr','inhibit'],['D2 striatal ensemble','GPe','inhibit'],['GPe','Subthalamic nucleus','inhibit'],['Subthalamic nucleus','GPi / SNr','excite'],['GPi / SNr','Thalamus','inhibit'],['Cortex','Subthalamic nucleus','excite']])assert(edges.some(e=>e?.from===from&&e.to===to&&e.sign===sign),`${from} → ${to} sign must be ${sign}`);
    }
    if(topic.id==='hippocampal-circuit'){
      assert.equal(s.matching(/^neuron-dentate-granule$/).length,3,'Dentate granule morphology must differ from cerebellar granule claws');
      const edges=s.matching(/^projection-/).map(p=>p.object.userData.circuitEdge);
      for(const[from,to]of[['Dentate gyrus','CA3'],['CA3','CA1'],['CA3','CA3'],['Entorhinal input','CA1']])assert(edges.some(e=>e?.from===from&&e.to===to&&e.sign==='excite'),`Missing excitatory ${from} → ${to}`);
    }
    if(topic.id==='cerebellar-circuit'){
      const population=s.find('population-2').object,types=s.picks.filter(p=>p.spec.id.startsWith('neuron-')&&inside(p.object,population));assert.equal(types.length,1);assert.equal(types[0].spec.id,'neuron-purkinje','Purkinje population cannot contain pyramidal somata');
      const fanSize=new THREE.Box3().setFromObject(s.find('purkinje-arbor').object).getSize(V());assert(fanSize.x>2&&fanSize.z<.4,'Purkinje arbor must be broad and approximately planar');
      const fibers=s.matching(/^parallel-fiber-/);assert(fibers.length>=5);
      for(const fiber of fibers){const direction=point(fiber,1).sub(point(fiber,0)).normalize();assert(Math.abs(direction.z)>.99,'Parallel fibers must cross the Purkinje XY dendritic plane orthogonally');}
      near(point(s.find('granule-ascending-axon'),1),point(fibers[0],.5),'Ascending axon must reach a connected T-bifurcation');
      assert(s.details.some(d=>d.object===fibers[0].object&&d.min===0),'Principal T-bifurcated fiber must remain visible in overview');
      const anchor=point(fibers[0],.5);let closest=Infinity;s.find('purkinje-arbor').object.traverse(o=>{const positions=o.geometry?.attributes.position;if(!positions)return;for(let i=0;i<positions.count;i++){const p=o.localToWorld(V().fromBufferAttribute(positions,i));closest=Math.min(closest,Math.hypot(p.x-anchor.x,p.y-anchor.y));}});assert(closest<.06,'Principal parallel fiber must geometrically cross the displayed Purkinje arbor');
      assert(!s.picks.some(p=>p.spec.id.startsWith('neuron-')&&inside(p.object,s.find('population-0').object)),'Mossy-fiber ending cannot be represented as a granule soma');
      assert.equal(s.find('projection-3').object.userData.circuitEdge.sign,'inhibit','Purkinje output must be inhibitory');
    }
    if(topic.id==='myelin'){
      assert(!s.picks.some(p=>p.spec.id==='neuron-interneuron'),'Oligodendrocyte must not reuse an interneuron');
      assert.equal(s.matching(/^oligodendrocyte-process-/).length,3,'One glial cell must contact several internodes');
      const sheaths=s.matching(/^lamella-\d-0$/).map(p=>({x:p.object.getWorldPosition(V()).x,half:p.object.geometry.parameters.height/2}));
      for(const node of s.matching(/^nodal-nav-/)){const x=node.object.getWorldPosition(V()).x;assert(sheaths.every(sheath=>Math.abs(x-sheath.x)>sheath.half),'Nodal channels must occupy exposed gaps, not compact myelin');}
      for(const node of s.matching(/^nodal-nav-/)){const p=node.object.position,radial=V(0,p.y,p.z).normalize(),normal=V(0,1).applyQuaternion(node.object.quaternion);assert(normal.dot(radial)>.999999,'Nodal protein membrane normal must point radially out of the axon');}
    }
    if(topic.id==='astrocytes'||topic.id==='microglia'){
      assert(!s.picks.some(p=>p.spec.id.startsWith('neuron-')),'Glia must have their own processes, not neuron morphology');
      const leaflets=descendants(s.root,o=>o.userData.recognitionFeature==='astrocytic-leaflets');
      if(topic.id==='astrocytes'){
        assert.equal(s.matching(/^endfoot-/).length,3);assert(s.matching(/^glial-tip-/).every(p=>p.spec.label==='Fine astrocytic leaflet'));
        assert(leaflets.reduce((sum,o)=>sum+o.count,0)>=300,'Whole-cell astrocyte fill needs a bushy fine-process territory, not only a GFAP-like skeleton');
        assert(leaflets.every(o=>s.details.some(d=>d.object===o&&d.min===0)),'Fine astrocyte leaflets must shape the overview silhouette');
        const capillary=s.find('capillary').object;for(const foot of s.matching(/^endfoot-/)){assert.equal(foot.object.geometry.type,'CylinderGeometry');assert(foot.object.geometry.parameters.radiusTop>capillary.geometry.parameters.radiusTop,'Broad endfeet must lie outside the capillary wall');assert(Math.abs(foot.object.geometry.parameters.thetaLength-Math.PI)<1e-8,'An endfoot should conform to a curved vessel wall');}
        assert.equal(s.matching(/^erythrocyte-/).length,5);for(const rbc of s.matching(/^erythrocyte-/)){const profile=rbc.object.geometry.parameters.points;assert.equal(rbc.object.geometry.type,'LatheGeometry');assert(profile[0].x===0&&profile.at(-1).x===0,'An erythrocyte has a closed center, not a torus hole');assert(Math.abs(profile[0].y)<Math.max(...profile.map(p=>Math.abs(p.y)))*.5,'The erythrocyte center must be thinner than its biconcave rim');}
      }
      else{assert(s.matching(/^glial-tip-/).every(p=>p.spec.label==='Surveying microglial process'));assert(!s.matching(/^endfoot-/).length);assert.equal(leaflets.length,0,'Ramified microglia must not inherit astrocyte spongiform leaflets');}
    }
    if(['synaptic-release','transmitter-clearance','short-term-plasticity'].includes(topic.id)){
      const boutons=s.matching(/^presynaptic-bouton$/),heads=s.matching(/^postsynaptic-spine$/);assert(boutons.length&&heads.length);
      for(const head of heads){const container=head.object.parent,neck=s.matching(/^postsynaptic-spine-neck$/).find(p=>p.object.parent===container),shaft=s.matching(/^postsynaptic-dendritic-shaft$/).find(p=>p.object.parent===container);assert(neck&&shaft,'A receiving spine must retain its neck and parent shaft');assert(head.object.material.opacity>.9&&head.object.geometry.parameters.phiLength===Math.PI,'The head needs an opaque longitudinal cutaway silhouette');}
      assert.equal(s.matching(/^terminal-axon$/).length,boutons.length,'Every bouton must join an incoming axon');
      const fineLipids=descendants(s.root,o=>o.userData.lipidHeads);assert(fineLipids.every(o=>s.details.some(d=>d.object===o.parent&&d.min===2)),'Fine molecular lipid grains must not replace the default recognizable synaptic compartments');
    }
    if(topic.id==='resting-potential'){
      assert.equal(s.matching(/^pump-alpha-TM-/).length,10,'P-type ATPase α chain has ten transmembrane helices, not a threefold channel');
      assert.equal(s.matching(/^pump-cytoplasmic-/).length,3);s.find('pump-beta');
      const pump=s.find('sodium-potassium-atpase').object;assert(s.matching(/^pump-cytoplasmic-/).every(p=>p.object.getWorldPosition(V()).y<-.4),'Catalytic ATPase domains must be cytoplasmic');
      const ions=s.root.children.filter(o=>o.isMesh&&o.geometry.type==='SphereGeometry'&&o.geometry.parameters.radius>=.095&&o.geometry.parameters.radius<=.11);
      const sodium=ions.filter(o=>o.material.color.getHex()===0xe8b976),potassium=ions.filter(o=>o.material.color.getHex()===0x6cdec6);assert.equal(sodium.length,3);assert.equal(potassium.length,2);
      s.frame(1);const naBefore=sodium.map(o=>o.position.y);s.frame(5);assert(sodium.every((o,i)=>o.position.y>naBefore[i]),'Three pump sodium ions must move outward');s.frame(6);const kBefore=potassium.map(o=>o.position.y);s.frame(10);assert(potassium.every((o,i)=>o.position.y<kBefore[i]),'Two pump potassium ions must move inward');assert.equal(pump.parent,s.root);
    }
    if(topic.id==='synaptic-integration'){
      assert.equal(s.matching(/^dendritic-spine$/).length,2,'Only the two excitatory inputs use spines');
      const contact=s.find('inhibitory-somatic-contact').object.getWorldPosition(V()),soma=s.root.children.find(o=>o.isMesh&&o.geometry.type==='SphereGeometry'&&o.geometry.parameters.radius===.62);assert(contact.distanceTo(soma.position)<.63,'Perisomatic inhibitory density must contact the soma');
    }
    if(topic.id==='homeostatic-plasticity'){
      const axon=s.find('scaled-presynaptic-axon').object,vertices=axon.geometry.attributes.position;assert(vertices.count>20,'Coordinated synapse comparison retains a continuous presynaptic axonal process');
      for(const bouton of s.matching(/^scaled-synapse-/)){const p=bouton.object.getWorldPosition(V());let distance=Infinity;for(let i=0;i<vertices.count;i++)distance=Math.min(distance,p.distanceTo(axon.localToWorld(V(vertices.getX(i),vertices.getY(i),vertices.getZ(i)))));assert(distance<bouton.object.geometry.parameters.radius,'Every terminal swelling must physically join the visible axonal process');}
    }
    if(['synaptic-release','transmitter-clearance','short-term-plasticity'].includes(topic.id)){
      for(const cav of s.matching(/^presynaptic-cav$/)){assert(Math.abs(cav.object.rotation.x-Math.PI)<1e-8,'Presynaptic extracellular channel domain must face the cleft');membraneClearance(s,cav.object,.41);}
      for(const receptor of s.matching(/^post-(ampa|nmda)-/))membraneClearance(s,receptor.object,.30);
    }
    if(topic.id==='transmitter-clearance')for(const eaat of s.matching(/^EAAT-/)){
      const path=eaat.object.userData.transportPath,center=eaat.object.getWorldPosition(V());let closest=null,d=Infinity;for(let i=0;i<=200;i++){const p=path.getPointAt(i/200);if(Math.abs(p.x-center.x)<d){closest=p;d=Math.abs(p.x-center.x);}}assert(closest&&closest.y>center.y+.07,'EAAT substrate must traverse a peripheral protomer, not a shared central pore');assert(V(0,1).applyQuaternion(eaat.object.quaternion).x<-.999,'EAAT extracellular face must point toward the cleft');
    }
    if(topic.id==='electrical-synapses'){
      const connexons=s.matching(/^connexon-/);assert.equal(connexons.length,14);
      for(const c of connexons){const center=c.object.getWorldPosition(V());membraneClearance(s,c.object,.32);
        for(const d of c.object.children){const radial=d.position.clone().normalize(),tm1=descendants(d,o=>o.userData.proteinHelix?.tm===1)[0];const p=point({object:tm1},.5).sub(center);assert(Math.hypot(p.x,p.z)<.20,'Connexin TM1 must face the channel lumen, with protomers arranged around the ring');const n=V(0,1).applyQuaternion(d.quaternion);assert(n.y*Math.sign(center.y)<-.999,'Connexin extracellular face must point toward the shared gap');assert(radial.length()>.99);}
      }
    }
    if(topic.scene==='channel'){
      const heads=s.find('phospholipid-bilayer').object,instance=new THREE.Matrix4();for(let i=0;i<heads.count;i++){heads.getMatrixAt(i,instance);assert(rho(V().setFromMatrixPosition(instance))>.35,'Central channel lumen must be free of lipid heads');}
      const gaba=topic.id==='gabaa',voltage=['sodium-channel','potassium-channel','calcium-channel'].includes(topic.id),count=gaba?5:4,helices=s.matching(/^domain-\d-helix-\d$/);
      assert.equal(helices.length,count*(voltage?6:gaba?4:3),'Correct number of complete transmembrane helices');
      for(let i=0;i<count;i++){
        const outer=s.find(`domain-${i}-helix-${voltage?3:gaba?3:2}`),inner=s.find(`domain-${i}-helix-${voltage?5:1}`);assert(rho(point(outer))>rho(point(inner))+.3,'Peripheral sensor/outer helices must sit outside central pore-lining helices');
        if(voltage){const pore=s.find(`voltage-pore-loop-${i}`);assert(point(pore,0).y>.8&&point(pore,1).y>.8,'S5–S6 pore loop enters from extracellular side');}
        if(topic.id==='ampa'||topic.id==='nmda'){const pore=s.find(`reentrant-M2-${i}`);assert(point(pore,0).y<-1.2&&point(pore,1).y<-1.2,'M2 reentrant loop enters from cytoplasmic side');s.find(`amino-terminal-${i}`);}
        if(gaba){const loop=s.find(`gaba-M3-M4-${i}`);assert(point(loop,.5).y<-1.4,'GABA-A M3–M4 loop must be intracellular');}
      }
      if(topic.id==='potassium-channel')assert.equal(s.matching(/^filter-/).length,20,'Potassium coordination uses successive oxygen planes');else assert.equal(s.matching(/^filter-/).length,0,'Other channel families cannot inherit a potassium carbonyl filter');
      if(topic.id==='sodium-channel'){
        assert.deepEqual(s.matching(/^selectivity-residue-/).map(p=>p.spec.label.split(' · ')[1]),['D','E','K','A']);assert.equal(s.matching(/^alpha-chain-linker-/).length,3);assert.equal(s.matching(/^IFM-(Ile|Phe|Met)$/).length,3);s.find('IFM-tether');
        assert(!s.picks.some(p=>p.spec.id==='inactivation-gate'),'Nav must not use a central ball-and-chain pore plug');for(const motif of s.matching(/^IFM-(Ile|Phe|Met)$/)){const p=motif.object.getWorldPosition(V());assert(rho(p)>.45&&p.y<-1,'IFM latch must remain off-axis on the cytoplasmic side');}
      }
      if(topic.id==='calcium-channel')assert(s.matching(/^selectivity-residue-/).every(p=>p.spec.label==='EEEE filter · glutamate'));
      if(gaba){assert.equal(s.matching(/^anion-pore-lining-/).length,5);assert(!s.picks.some(p=>p.spec.id==='magnesium-block'));}
      const expectedSpecies=gaba?['Cl⁻']:topic.id==='potassium-channel'?['K⁺']:topic.id==='calcium-channel'?['Ca²⁺']:topic.id==='nmda'?['Ca²⁺','K⁺','Na⁺']:topic.id==='ampa'?['K⁺','Na⁺']:['Na⁺'];
      const ions=s.matching(/^permeant-ion-/);assert.deepEqual([...new Set(ions.map(p=>p.spec.label.split(' · ')[0]))].sort(),expectedSpecies.sort());
      s.frame(6);const before=ions.map(p=>p.object.position.y);s.frame(6.1);for(const[p,i]of ions.map((p,i)=>[p,i])){const delta=p.object.position.y-before[i];if(Math.abs(delta)<1)assert(p.spec.label.startsWith('K⁺')?delta>0:delta<0,'Ion direction must match its illustrated electrochemical gradient');}
      const experimental=s.representations.find(r=>r.spec.id==='experimental');assert(experimental,'Experimental assembly remains available');assert.match(experimental.spec.status,/human|rat/i,'Source species/construct must be explicit');assert.equal(experimental.spec.narrative,null);
    }
    if(topic.id==='ltp'){
      const kinases=s.matching(/^CaMKII-kinase-/);assert.equal(kinases.length,12,'CaMKII example must retain twelve kinase subunits');const ys=kinases.map(p=>p.object.position.y);assert.equal(new Set(ys).size,2,'CaMKII subunits form two apposed sixfold rings, not one twelvefold ring');for(const y of new Set(ys))assert.equal(ys.filter(value=>value===y).length,6);
    }
    if(topic.id==='ltp'||topic.id==='ltd'){
      const nmda=s.find('induction-NMDA').object;membraneClearance(s,nmda,.29);
      const nmdas=descendants(nmda,o=>o.userData.proteinHelix);for(const tm of nmdas){const a=tm.localToWorld(tm.geometry.parameters.path.getPointAt(0)),b=tm.localToWorld(tm.geometry.parameters.path.getPointAt(1));assert(a.y<.52&&b.y>1,'Plasticity NMDAR helices must span both actual lipid head rows');}
      // The calcium route crosses at the NMDAR footprint after its relocation away from AMPARs.
      const calcium=descendants(s.root,o=>o.isMesh&&o.geometry?.type==='SphereGeometry'&&o.geometry.parameters.radius===.043&&o.material.color.getHex()===0xa89bd4);assert.equal(calcium.length,5);s.frame(3);for(const ion of calcium)if(Math.abs(ion.getWorldPosition(V()).y-.76)<.36)assert(Math.hypot(ion.getWorldPosition(V()).x-.6,ion.getWorldPosition(V()).z+.3)<.16,'Plasticity calcium must cross the induction receptor rather than lipid context');
      s.frame(topic.id==='ltp'?0:15);const endosome=s.find('recycling-endosome').object.getWorldPosition(V()),pooled=s.matching(/^plastic-ampa-[3-6]$/).map(p=>p.object),centers=pooled.map(p=>p.getWorldPosition(V()));
      for(let i=0;i<pooled.length;i++){const p=pooled[i],radial=centers[i].clone().sub(endosome);assert(Math.abs(radial.length()-.37)<1e-6,'Pooled AMPARs must occupy the endosome membrane rather than its center');assert(V(0,1).applyQuaternion(p.quaternion).dot(radial.normalize())<-.999,'AMPAR extracellular domains must face the endosomal lumen');for(let j=0;j<i;j++)assert(centers[i].distanceTo(centers[j])>.4,'Pooled receptors need distinct membrane positions');
        for(const tm of descendants(p,o=>o.userData.proteinHelix)){const a=point({object:tm},0).distanceTo(endosome),b=point({object:tm},1).distanceTo(endosome);assert(a>.37&&b<.37,'Pooled AMPAR transmembrane helices must actually span the endosomal membrane');}
        const folds=descendants(p,o=>o.userData.proteinExtracellularDomain);assert.equal(folds.length,4);for(const fold of folds){const vertices=fold.geometry.attributes.position;for(let j=0;j<vertices.count;j++)assert(fold.localToWorld(V().fromBufferAttribute(vertices,j)).distanceTo(endosome)<.37,'Complete extracellular AMPAR folds must lie inside the endosomal lumen');}
      }
      s.find('endosome-membrane');assert(!s.picks.some(p=>p.spec.id==='synaptic-vesicle'&&inside(p.object,s.find('recycling-endosome').object)),'Recycling endosome cannot be labeled as a quantal transmitter vesicle');
    }
    if(topic.id==='homeostatic-plasticity'){
      const soma=s.find('homeostatic-regulation').object.getWorldPosition(V());assert(soma.distanceTo(V(3.2,-1.2))<.57,'Regulatory soma must attach to the parent dendrite rather than float separately');
    }
    for(const t of[0,6,12,19.5]){s.frame(t);s.root.traverse(o=>{assert(o.position.toArray().every(Number.isFinite),`${topic.id}: finite motion`);assert(o.scale.toArray().every(Number.isFinite),`${topic.id}: finite scale`);});}
    s.dispose();checked++;
  }
  console.log(`Brain microscopic accuracy passed: ${checked} built scenes; cell morphology, laminar placement, circuit signs, radial myelin channels, pump stoichiometry, round/attached lipids, typed protein topologies, membrane cutouts, gap-junction polarity/docking, peripheral EAAT routes, channel permeants and CaMKII rings.`);
}finally{globalThis.fetch=originalFetch;await fs.unlink(compiledPath);}
