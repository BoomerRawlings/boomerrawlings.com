import * as THREE from 'three';
import type { BrainTopic, SceneContext, PickSpec } from './scene-types';

const C = { pearl: 0xcbdcdd, teal: 0x6cdec6, blue: 0x72a8e0, pink: 0xd889aa, amber: 0xe8b976, violet: 0xa89bd4, dark: 0x38565f, red: 0xcb6e7b };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const ease = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const phase = (t: number, duration = 16) => ((t % duration) + duration) % duration;
const noise = (n: number) => { const a = Math.sin(n * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
const cache = new Map<string, Promise<any>>();
async function asset<T>(name: string): Promise<T> { let promise = cache.get(name); if (!promise) { promise = fetch(`/brain/models/${name}.json`).then(r => { if (!r.ok) throw new Error(`Model ${name} unavailable`); return r.json(); }).catch(e => { cache.delete(name); throw e; }); cache.set(name, promise); } return promise; }
const group = (parent: THREE.Object3D, p = V()) => { const g = new THREE.Group(); g.position.copy(p); parent.add(g); return g; };
const pick = (ctx: SceneContext, object: THREE.Object3D, id: string, label: string, description: string, childTopic?: string, level = 0) => ctx.pick(object, { id, label, description, childTopic, level, kind: 'Structure', priority: 2 });
function caption(ctx: SceneContext, name: string, object: THREE.Object3D, p = V(), level = 0, priority = 2) { ctx.label(name, object, p, { minDetail: level, priority }); }
function narrative(ctx: SceneContext, steps: [number, string, string][], duration = 16) { ctx.narrative({ duration, steps: steps.map(([at, label, description]) => ({ at, label, description })) }); }

/** Tapered organic branch, with a smooth centerline and decreasing radius. */
function branch(ctx: SceneContext, points: THREE.Vector3[], radius: number, color: number, parent = ctx.root, tip = .015) {
  const curve = new THREE.CatmullRomCurve3(points), segments = Math.max(10, Math.min(48, points.length * 7)), sides = 7;
  const frames = curve.computeFrenetFrames(segments, false), positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= segments; i++) { const p = curve.getPointAt(i / segments), r = lerp(radius, tip, i / segments); for (let j = 0; j < sides; j++) { const a = j / sides * Math.PI * 2; const q = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r); positions.push(q.x, q.y, q.z); if (i < segments) { const k = i * sides + j, n = i * sides + (j + 1) % sides; indices.push(k, n, k + sides, n, n + sides, k + sides); } } }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return { mesh: ctx.mesh(geometry, ctx.material(color), parent), curve };
}
function train(ctx: SceneContext, curve: THREE.Curve<THREE.Vector3>, color: number, count = 5, parent = ctx.root, options: { start?: number; end?: number; duration?: number; radius?: number; detail?: number; reverse?: boolean } = {}) {
  const { start = 0, end = 16, duration = 16, radius = .042, detail = 0, reverse = false } = options;
  const g = group(parent); ctx.detail(g, detail);
  const dots = Array.from({ length: count }, () => ctx.ball(V(), radius, color, g));
  ctx.animate(t => { const p = phase(t, duration), active = p >= start && p <= end; dots.forEach((dot, i) => { dot.visible = active; const u = ((p - start) / Math.max(1, end - start) * 1.35 + i / count) % 1; dot.position.copy(curve.getPointAt(reverse ? 1 - Math.max(0, u) : Math.max(0, u))); }); });
  return g;
}
function mitochondrion(ctx: SceneContext, parent: THREE.Object3D, p: THREE.Vector3, size = 1) {
  const g = group(parent, p); g.scale.setScalar(size);
  const outer = ctx.ball(V(), .34, C.red, g, .7); outer.scale.set(1.75, .75, .75);
  for (let i = 0; i < 7; i++) { const x = -.43 + i * .14; ctx.tube([V(x, -.12, .14), V(x + .045, .08, .17), V(x, .15, .12), V(x - .035, -.05, .16)], .022, C.amber, g, 1, 12); }
  pick(ctx, outer, 'mitochondrion', 'Mitochondrion', 'Cristae support oxidative phosphorylation; ATP supplies transport, pumping and other cellular work.', undefined, 2); ctx.detail(g, 2); return g;
}
function nucleus(ctx: SceneContext, parent: THREE.Object3D, p = V(), radius = .35) {
  const shell = ctx.ball(p, radius, C.violet, parent, .78); ctx.ball(p.clone().add(V(radius * .25, .05, radius * .35)), radius * .28, C.amber, parent);
  const chromatin = group(parent, p); for (let i = 0; i < 3; i++) { const pts = Array.from({ length: 26 }, (_, j) => V(Math.cos(j * .7 + i) * radius * .66, Math.sin(j * .4 + i) * radius * .58, Math.sin(j * .7 + i) * radius * .66)); ctx.tube(pts, .009, C.pearl, chromatin, .65, 36); } ctx.detail(chromatin, 3);
  pick(ctx, shell, 'cell-nucleus', 'Nucleus', 'DNA and transcription machinery help maintain the cell and support longer-lasting changes.', undefined, 1); return shell;
}
function lipidSheet(ctx: SceneContext, parent: THREE.Object3D, p: THREE.Vector3, width: number, depth: number, pore = 0) {
  const g = group(parent, p), locations: [number, number, number][] = [];
  const step = .21;
  for (let x = -width / 2; x <= width / 2; x += step) for (let z = -depth / 2; z <= depth / 2; z += step) if (Math.hypot(x, z) > pore) for (const side of [-1, 1]) locations.push([x, side, z]);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(.067, 8, 6), ctx.material(C.teal, .84), locations.length);
  const tails = new THREE.InstancedMesh(new THREE.CylinderGeometry(.012, .012, .16, 5), ctx.material(0x709298, .8), locations.length * 2);
  const transform = new THREE.Object3D();
  locations.forEach(([x, side, z], i) => { transform.position.set(x, side * .24, z); transform.updateMatrix(); heads.setMatrixAt(i, transform.matrix); for (let j = 0; j < 2; j++) { transform.position.set(x + (j ? .025 : -.025), side * .115, z + (j ? .02 : -.02)); transform.updateMatrix(); tails.setMatrixAt(i * 2 + j, transform.matrix); } });
  g.add(heads, tails); ctx.detail(tails, 1);
  pick(ctx, heads, 'phospholipid-bilayer', 'Phospholipid bilayer', 'Hydrophilic heads face water; hydrophobic acyl tails pack inside. Integral proteins control selective passage.', 'resting-potential', 1);
  return g;
}
function helicalProtein(ctx: SceneContext, parent: THREE.Object3D, p: THREE.Vector3, color: number, size = 1, subunits = 4) {
  const g = group(parent, p); g.scale.setScalar(size); const domains: THREE.Group[] = [];
  for (let i = 0; i < subunits; i++) { const a = i * Math.PI * 2 / subunits, domain = group(g, V(Math.cos(a) * .25, 0, Math.sin(a) * .25)); domains.push(domain);
    for (let j = 0; j < 2; j++) { const pts = Array.from({ length: 32 }, (_, k) => V(Math.cos(k * .75) * .032 + (j - .5) * .07, -.38 + k * .025, Math.sin(k * .75) * .032)); ctx.tube(pts, .028, color, domain, 1, 48); }
    const ligandDomain = ctx.ball(V(0, .5, 0), .16, color, domain); ligandDomain.scale.set(1, 1.55, 1);
  }
  return { group: g, domains };
}
function spine(ctx: SceneContext, parent: THREE.Object3D, p: THREE.Vector3, size = 1, color = C.pearl, detail = 0) {
  const g = group(parent, p); g.scale.setScalar(size);
  branch(ctx, [V(), V(.04, .28), V(.02, .55)], .072, color, g, .05);
  const head = ctx.ball(V(.02, .68, 0), .22, color, g); head.scale.set(1.12, .83, .94);
  const psd = ctx.mesh(new THREE.CylinderGeometry(.16, .17, .025, 18), ctx.material(C.amber), g); psd.position.set(.02, .86, 0); ctx.detail(psd, Math.max(1, detail));
  pick(ctx, head, 'dendritic-spine', 'Dendritic spine', 'A small postsynaptic compartment: receptors, a density of scaffold proteins, calcium signaling and actin support plasticity.', 'ltp', Math.max(1, detail));
  ctx.detail(g, detail); return { group: g, head, psd };
}
function smallNeuron(ctx: SceneContext, parent: THREE.Object3D, p: THREE.Vector3, color: number, style = 'pyramidal', size = 1) {
  const g = group(parent, p); g.scale.setScalar(size);
  const soma = style === 'pyramidal' ? ctx.mesh(new THREE.ConeGeometry(.24, .44, 7), ctx.material(color), g) : ctx.ball(V(), .20, color, g);
  soma.rotation.z = style === 'pyramidal' ? 0 : .25;
  const paths: THREE.CatmullRomCurve3[] = [];
  for (let i = 0; i < (style === 'granule' ? 5 : 8); i++) { const angle = style === 'pyramidal' && i === 0 ? Math.PI / 2 : i * Math.PI * 2 / 8; const length = style === 'pyramidal' && i === 0 ? 1.1 : .65; const end = V(Math.cos(angle) * length, Math.sin(angle) * length, Math.sin(i * 2.4) * .16); const b = branch(ctx, [V(), end.clone().multiplyScalar(.5).add(V(0, .08)), end], .036, color, g, .009); paths.push(b.curve); for (const side of [-1, 1]) { const twig = branch(ctx, [end.clone().multiplyScalar(.55), end.clone().multiplyScalar(.8).add(V(side * .1, .05)), end.clone().add(V(side * .22, .13, .08))], .018, color, g, .004); ctx.detail(twig.mesh,1); } }
  pick(ctx, soma, `neuron-${style}`, style === 'pyramidal' ? 'Pyramidal neuron' : style === 'granule' ? 'Granule neuron' : 'Interneuron', 'Original teaching morphology; inspect a cell to move from circuit organization to cellular mechanisms.', 'neuron', 1);
  return { group: g, soma, paths };
}

export const MICRO_VARIANTS = {
  'cortical-circuit': ['six cortical layers', 'pyramidal arbors', 'feedforward inhibition'],
  'basal-ganglia': ['D1/D2 populations', 'direct/indirect/hyperdirect routes', 'dopamine modulation'],
  'hippocampal-circuit': ['dentate granule fan', 'mossy/Schaffer routes', 'CA3 recurrence'],
  'cerebellar-circuit': ['Purkinje fan', 'parallel fibers', 'climbing input'],
  neuron: ['branched pyramidal cell', 'organelles', 'axonal transport'],
  dendrites: ['Allen SWC topology', 'spine contacts', 'branch integration'],
  myelin: ['lamellar cutaway', 'nodes of Ranvier', 'oligodendrocyte processes'],
  astrocytes: ['fine leaflets', 'capillary endfeet', 'glutamate uptake'],
  microglia: ['ramified processes', 'tip surveillance', 'phagolysosome'],
  'resting-potential': ['phospholipids', 'K leak', '3Na/2K pump cycle'],
  'synaptic-release': ['vesicle docking', 'Ca-triggered fusion', 'receptor current'],
  'synaptic-integration': ['three dendritic contacts', 'EPSP/IPSP timing', 'threshold integration'],
  'electrical-synapses': ['paired hexameric connexons', 'narrow gap', 'bidirectional coupling'],
  'transmitter-clearance': ['astrocyte transporter', 'recycling route', 'AChE contrast'],
  'short-term-plasticity': ['residual calcium', 'vesicle depletion', 'paired pulse comparison'],
  glutamate: ['PubChem conformer', 'all atoms', 'record charge'], gaba: ['PubChem conformer', 'all atoms', 'record charge'],
  dopamine: ['PubChem conformer', 'catechol', 'amine'], serotonin: ['PubChem conformer', 'indole', 'amine'],
  acetylcholine: ['PubChem conformer', 'quaternary ammonium', 'ester'], norepinephrine: ['PubChem conformer', 'beta hydroxyl', 'catechol'],
  glycine: ['PubChem conformer', 'amino acid', 'all atoms'], histamine: ['PubChem conformer', 'imidazole', 'amine'],
  neuropeptides: ['Met-enkephalin sequence', 'peptide backbone', 'side chain identities'],
  'sodium-channel': ['six-helix domains', 'activation/inactivation', '6J8J backbone'],
  'potassium-channel': ['tetrameric pore', 'selectivity filter', '2R9R backbone'],
  'calcium-channel': ['four-domain pore', 'divalent entry', '7MIY backbone'],
  ampa: ['ligand clamshell', 'tetramer', '3KG2 backbone'], nmda: ['two agonists', 'Mg block', '4PE5 backbone'], gabaa: ['pentamer', 'chloride pore', '6D6T backbone'],
  ltp: ['NMDA calcium', 'CaMKII hub', 'AMPA delivery'], ltd: ['phosphatase', 'clathrin endocytosis', 'AMPA removal'],
  'spike-timing': ['pre/post order', 'opposite timing windows', 'illustrative weight change'],
  'homeostatic-plasticity': ['multiple synapses', 'global scaling', 'relative weight preservation'],
  'structural-plasticity': ['filopodial growth', 'contact stabilization', 'actin remodeling'],
  'memory-consolidation': ['hippocampal replay', 'cortical association links', 'systems-level redistribution'],
} as const;

export async function buildMicroScene(topic: BrainTopic, ctx: SceneContext): Promise<void> {
  switch (topic.scene) {
    case 'circuit': buildCircuit(topic, ctx); break;
    case 'neuron': await buildCell(topic, ctx); break;
    case 'synapse': buildSynapse(topic, ctx); break;
    case 'molecule': await buildMolecule(topic, ctx); break;
    case 'channel': await buildChannel(topic, ctx); break;
    case 'plasticity': buildPlasticity(topic, ctx); break;
    default: ctx.status('No microscopic model for this scene.');
  }
}

function buildCircuit(topic: BrainTopic, ctx: SceneContext) {
  type Node = { name: string; p: THREE.Vector3; topic?: string; style?: string; color?: number };
  type Edge = [number, number, 'excite' | 'inhibit' | 'modulate', string, number];
  let nodes: Node[], edges: Edge[];
  if (topic.id === 'basal-ganglia') {
    nodes = [{ name: 'Cortex', p: V(-.3, 2.2), topic: 'cerebral-cortex' }, { name: 'D1 striatal ensemble', p: V(-2, .65), topic: 'dopamine', style: 'spiny' }, { name: 'D2 striatal ensemble', p: V(-2, -.65), topic: 'dopamine', style: 'spiny' }, { name: 'GPe', p: V(-.8, -1.9), color: C.pink }, { name: 'Subthalamic nucleus', p: V(1.15, -1.75), color: C.teal }, { name: 'GPi / SNr', p: V(1.1, .15), color: C.pink }, { name: 'Thalamus', p: V(2.8, 1.25), topic: 'thalamus' }, { name: 'SNc dopamine', p: V(-3.5, -1.7), topic: 'dopamine', color: C.amber }];
    edges = [[0,1,'excite','Corticostriatal input',0],[1,5,'inhibit','Direct route',2],[5,6,'inhibit','Tonic inhibitory output',4],[6,0,'excite','Thalamocortical return',6],[0,2,'excite','Corticostriatal input',8],[2,3,'inhibit','Indirect route',9],[3,4,'inhibit','GPe inhibition of STN',10],[4,5,'excite','Subthalamic excitation',11],[0,4,'excite','Hyperdirect route',12],[7,1,'modulate','Dopamine · D1 modulation',1],[7,2,'modulate','Dopamine · D2 modulation',1]];
    narrative(ctx, [[0,'Direct route','Cortical activity recruits one striatal population; inhibitory steps can disinhibit thalamus.'],[8,'Indirect route','A second striatal route changes GPe–STN–output-nucleus interactions.'],[12,'Hyperdirect route','Cortex can reach STN directly. These parallel loops are more complex than an on/off movement switch.']]);
  } else if (topic.id === 'hippocampal-circuit') {
    nodes = [{ name:'Entorhinal input',p:V(-3,1.3) },{name:'Dentate gyrus',p:V(-1.7,-1),style:'granule'},{name:'CA3',p:V(.25,-1.4)},{name:'CA1',p:V(2.35,.0)},{name:'Subiculum',p:V(1.7,1.85)}];
    edges = [[0,1,'excite','Perforant path',0],[1,2,'excite','Mossy fibers',3],[2,3,'excite','Schaffer collaterals',6],[3,4,'excite','CA1 output',9],[4,0,'excite','Return toward entorhinal cortex',12],[2,2,'excite','CA3 recurrent collaterals',4],[0,3,'excite','Temporoammonic input',10]];
    const scaffold = ctx.tube([V(-2.2,-.5,-.4),V(-1.6,-1.7,-.4),V(.5,-2.1,-.4),V(2.5,-.7,-.4),V(2.3,1,-.4)], .38, C.dark, ctx.root, .16, 70); pick(ctx, scaffold.mesh,'hippocampal-lamella','Hippocampal circuit scaffold','Schematic layout of hippocampal cell populations; not atlas coordinates.','hippocampus');
    narrative(ctx, [[0,'Entorhinal input','Perforant-path input reaches dentate granule cells.'],[3,'Dentate → CA3','Mossy fibers recruit CA3; recurrent connections provide additional processing.'],[6,'CA3 → CA1','Schaffer collateral signals reach CA1 dendritic synapses.'],[9,'Output + parallel routes','CA1 and subiculum transmit output; direct entorhinal inputs mean the circuit is not a single serial chain.']]);
  } else if (topic.id === 'cerebellar-circuit') {
    nodes = [{name:'Mossy-fiber input',p:V(-2.7,-1.7),style:'granule'},{name:'Granule layer',p:V(-1.4,-.65),style:'granule'},{name:'Purkinje cell',p:V(.25,.5),color:C.pearl},{name:'Deep cerebellar nucleus',p:V(2,-1.7),style:'interneuron'},{name:'Inferior olive',p:V(3,.15),color:C.amber}];
    edges = [[0,1,'excite','Mossy → granule',0],[1,2,'excite','Ascending axon → parallel fibers',3],[4,2,'excite','Climbing fiber',7],[2,3,'inhibit','Purkinje inhibitory output',10],[0,3,'excite','Mossy-fiber collateral',2]];
    for(let i=0;i<11;i++){const path=ctx.tube([V(-3.2,1.1+i*.1,-.6+i*.07),V(0,1.15+i*.1,-.6+i*.07),V(3.2,1.1+i*.1,-.6+i*.07)],.009,C.teal,ctx.root,.6,18);ctx.detail(path.mesh,1);}
    const fan=group(ctx.root,V(.25,.8));for(let i=0;i<14;i++){const a=Math.PI*.15+i/13*Math.PI*.7;const tip=V(Math.cos(a)*1.6,Math.sin(a)*1.7,Math.sin(i)*.07);branch(ctx,[V(),tip.clone().multiplyScalar(.45),tip],.032,C.pearl,fan,.006);for(let j=0;j<3;j++)branch(ctx,[tip.clone().multiplyScalar(.45+j*.17),tip.clone().multiplyScalar(.65+j*.14).add(V((j%2?1:-1)*.18,.15)),tip.clone().add(V((j%2?1:-1)*.25,.12))],.014,C.pearl,fan,.003);} pick(ctx,fan,'purkinje-arbor','Purkinje dendritic fan','A flattened dendritic arbor samples many parallel fibers; climbing-fiber input has a distinct origin and influence.','dendrites',1);
    narrative(ctx,[[0,'Mossy-fiber stream','Mossy inputs excite granule cells and send collaterals to deep nuclei.'],[3,'Parallel-fiber integration','Granule axons ascend and bifurcate among Purkinje dendrites.'],[7,'Climbing-fiber input','An inferior-olive axon makes a powerful specialized input.'],[10,'Inhibitory output','Purkinje cells release GABA onto deep cerebellar nuclei.']]);
  } else {
    nodes=[{name:'L2/3 pyramidal',p:V(-1.2,1.1)},{name:'L5 pyramidal',p:V(.9,-.7)},{name:'Basket interneuron',p:V(2.1,.8),style:'interneuron',color:C.pink},{name:'Thalamic input',p:V(-2.5,-1.8),style:'granule',topic:'thalamus'},{name:'Excitatory neighbor',p:V(-2.65,.35)}];
    edges=[[3,0,'excite','Ascending drive',0],[0,1,'excite','Excitatory projection',3],[0,2,'excite','Recruiting inhibition',4],[2,1,'inhibit','Perisomatic inhibition',6],[1,4,'excite','Recurrent excitation',9],[4,0,'excite','Feedback excitation',12]];
    for(let i=0;i<6;i++){const slab=ctx.mesh(new THREE.BoxGeometry(6.8,.68,1.7),ctx.material(i%2?C.dark:0x466269,.07),ctx.root);slab.position.set(0,2-i*.75,-.65);pick(ctx,slab,`cortical-layer-${i+1}`,`Cortical layer ${['I','II','III','IV','V','VI'][i]}`,'Layer thickness and cell placement are schematic. Different areas vary in laminar organization.','cerebral-cortex');caption(ctx,['I','II','III','IV','V','VI'][i],slab,V(-3.2,0,.85),1,1);}
    narrative(ctx,[[0,'Incoming drive','Thalamic and cortical inputs reach different cells and layers.'],[3,'Excitation recruits inhibition','Pyramidal cells can excite both target neurons and local interneurons.'],[6,'Inhibitory control','Perisomatic GABAergic input changes when a target can spike.'],[9,'Recurrent processing','Local recurrent connections carry activity through a distributed circuit.']]);
  }
  const groups=nodes.map((n,i)=>{const cluster=group(ctx.root,n.p);for(let j=0;j<3;j++){const cell=smallNeuron(ctx,cluster,V((j-1)*.17,Math.sin(j*2)*.14,(j-1)*.18),n.color||C.pearl,n.style||'pyramidal',j===1?.62:.37);if(j!==1)ctx.detail(cell.group,1);}pick(ctx,cluster,`population-${i}`,n.name,'A population is represented by a few cells. Positions and pulse timing illustrate circuit organization.',n.topic||'neuron');caption(ctx,n.name,cluster,V(0,.68,.18),0,4);return cluster;});
  edges.forEach(([a,b,sign,name,at],i)=>{const start=nodes[a].p,end=nodes[b].p,mid=start.clone().lerp(end,.5).add(V(a===b?.6:0,a===b?.75:(i%2?.18:-.18),a===b?.8:(i%2?.4:-.35)));const color=sign==='inhibit'?C.pink:sign==='modulate'?C.amber:C.teal;const path=ctx.tube([start,mid,end],sign==='modulate'?.016:.025,color,ctx.root,.72,60);pick(ctx,path.mesh,`projection-${i}`,name,sign==='inhibit'?'GABAergic inhibitory projection; effects depend on the target and circuit.':sign==='modulate'?'Dopaminergic modulation changes excitability and plasticity.':'Glutamatergic excitatory projection.','synaptic-release',1);train(ctx,path.curve,color,3,ctx.root,{start:at,end:Math.min(at+4,16),radius:.055});const marker=ctx.mesh(sign==='inhibit'?new THREE.BoxGeometry(.22,.06,.065):new THREE.ConeGeometry(.08,.2,8),ctx.material(color));marker.position.copy(path.curve.getPointAt(.83));marker.quaternion.setFromUnitVectors(V(0,1,0),path.curve.getTangentAt(.83));ctx.detail(marker,1);});
  ctx.status('Original circuit teaching model · biologically informed connectivity; cells, locations and event timing are schematic.');
}

async function buildCell(topic: BrainTopic, ctx: SceneContext) {
  if (topic.id === 'myelin') { buildMyelin(ctx); return; }
  if (topic.id === 'resting-potential') { buildMembrane(ctx); return; }
  if (topic.id === 'astrocytes' || topic.id === 'microglia') { buildGlia(topic, ctx); return; }
  if (topic.id === 'dendrites') {
    try {
      const data = await asset<{points:number[][]}>('micro-neuron'); if (!ctx.isCurrent()) return;
      const records = new Map(data.points.map(p=>[p[0],p])), box = new THREE.Box3();data.points.forEach(p=>box.expandByPoint(V(p[2],p[3],p[4])));
      const center=box.getCenter(V()), size=box.getSize(V()), scale=5.8/Math.max(size.x,size.y,size.z), somaRecord=data.points.find(p=>p[1]===1)!;
      const convert=(p:number[])=>V(-p[2],-p[3],p[4]).sub(V(-center.x,-center.y,center.z)).multiplyScalar(scale);
      const positions:number[]=[],indices:number[]=[];
      for(const p of data.points){const parent=records.get(p[6]);if(!parent||p[1]===1)continue;const a=convert(parent),b=convert(p),direction=b.clone().sub(a).normalize(),normal=V(0,0,1).cross(direction).normalize();if(normal.lengthSq()<.1)normal.set(1,0,0);const binormal=direction.clone().cross(normal).normalize(),base=positions.length/3;
        for(const [point,r] of [[a,Math.max(parent[5]*scale*1.7,.010)],[b,Math.max(p[5]*scale*1.7,.008)]] as [THREE.Vector3,number][]){for(let j=0;j<6;j++){const angle=j/6*Math.PI*2,q=point.clone().addScaledVector(normal,Math.cos(angle)*r).addScaledVector(binormal,Math.sin(angle)*r);positions.push(q.x,q.y,q.z);}}
        for(let j=0;j<6;j++){const n=(j+1)%6;indices.push(base+j,base+n,base+6+j,base+n,base+6+n,base+6+j);}
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const arbor=ctx.mesh(geo,ctx.material(C.pearl));pick(ctx,arbor,'measured-dendritic-arbor','Measured dendritic arbor','Allen mouse visual-cortex Cux2 neuron, specimen 485909730. Centerline geometry is reconstructed; thickness is enlarged for readability.','synaptic-integration');
      const soma=ctx.ball(convert(somaRecord),Math.max(somaRecord[5]*scale,.09),C.violet);caption(ctx,'Allen reconstructed dendritic tree',arbor,V(0,2.65,0),0,4);
      const contacts=group(ctx.root);ctx.detail(contacts,1);
      for(let i=35;i<data.points.length;i+=53){const record=data.points[i],p=convert(record),s=spine(ctx,contacts,p,.12,C.teal,1);s.group.rotation.z=noise(i)*Math.PI*2;const input=ctx.ball(p.clone().add(V(.09,.11,.03)),.035,C.pink,contacts);pick(ctx,input,`input-${i}`,'Illustrative synaptic input','Spines and incoming boutons are teaching additions; they are not measured in this SWC reconstruction.','synaptic-release',1);ctx.animate(t=>{const a=Math.max(0,Math.sin(t*1.4+i))**10;(input.material as THREE.MeshStandardMaterial).emissiveIntensity=a*.8;});}
      caption(ctx,'Spine contacts are teaching additions',contacts,V(.6,-2.6,0),1,2);
      ctx.status('Measured Allen mouse dendritic centerlines · compartment thickness enlarged; spines and signals are teaching overlays, not recorded activity.');
      narrative(ctx,[[0,'Many inputs, one arbor','A measured branching tree supplies the geometry. Different branches receive different combinations of synaptic inputs.'],[5,'Local compartments','Spines provide specialized biochemical compartments; the added contacts are illustrative.'],[10,'Dendritic integration','Signals spread and interact through an electrically active, branching structure.']]);return;
    } catch { if(!ctx.isCurrent())return; }
  }
  const soma=group(ctx.root,V(-.6,-.25));const body=ctx.ball(V(),.56,C.pearl,soma,.85);body.scale.set(1,1.15,.8);nucleus(ctx,soma,V(-.07,.02,.19),.29);
  pick(ctx,body,'neuronal-soma','Soma','The cell body contains nucleus, synthetic machinery and much of the metabolic apparatus.','resting-potential');
  caption(ctx,'Soma',soma,V(-.6,-.15,.5),0,4);mitochondrion(ctx,soma,V(.23,-.24,.3),.35);
  const er=group(soma,V(.02,-.03,-.1));for(let i=0;i<5;i++){const pts=Array.from({length:16},(_,j)=>{const a=j/15*Math.PI*1.4;return V(Math.cos(a)*(.32+i*.018),Math.sin(a)*(.32+i*.018),i*.022);});ctx.tube(pts,.018,C.blue,er,.78,25);}ctx.detail(er,2);pick(ctx,er,'rough-er','Endoplasmic reticulum','Membrane and protein processing help support a neuron with an extensive cell surface.',undefined,2);
  const tree=group(ctx.root,V(-.6,-.1));const paths:THREE.CatmullRomCurve3[]=[];
  function grow(start:THREE.Vector3,angle:number,length:number,depth:number,seed:number,plane:number){const end=start.clone().add(V(Math.cos(angle)*length,Math.sin(angle)*length,Math.sin(seed*2.3)*.23+plane));const mid=start.clone().lerp(end,.55).add(V(Math.sin(seed)*.12,.12,0));const b=branch(ctx,[start,mid,end],.09*Math.pow(.62,4-depth),C.pearl,tree,.012);paths.push(b.curve);pick(ctx,b.mesh,`dendrite-${seed}`,'Dendritic branch','Branch geometry helps determine how synaptic inputs interact. Fine spines become visible as you zoom.','dendrites',1);
    if(depth>0){grow(end,angle+.32+noise(seed)*.25,length*.66,depth-1,seed*2+1,plane*.4);grow(end,angle-.34-noise(seed+2)*.19,length*.64,depth-1,seed*2+2,plane*.4);}else{for(let j=1;j<4;j++){const p=b.curve.getPoint(j/4);const s=spine(ctx,tree,p,.18,C.teal,2);s.group.rotation.z=angle-Math.PI/2;}}}
  grow(V(0,.35),Math.PI/2,1.05,3,2,0);grow(V(-.25,.0),Math.PI*.96,.82,3,4,-.08);grow(V(.25,.0),.12,.72,3,7,.08);
  caption(ctx,'Dendritic arbor',tree,V(.15,2.9,0),0,3);
  const axon=branch(ctx,[V(-.45,-.7),V(.2,-1.3,.1),V(1.4,-1.35,.05),V(2.85,-.9,.05)],.11,C.pink,ctx.root,.042);pick(ctx,axon.mesh,'axon','Axon','Action potentials regenerate along the membrane; they are not particles moving down a hollow tube.','myelin');
  const hillock=ctx.mesh(new THREE.ConeGeometry(.19,.6,16),ctx.material(C.amber));hillock.position.set(-.35,-.85,.02);hillock.rotation.z=-.7;pick(ctx,hillock,'axon-initial-segment','Axon initial segment','A specialized channel-rich compartment often initiates action potentials.','sodium-channel',1);
  for(let i=0;i<4;i++){const a=axon.curve.getPointAt(.24+i*.16),b=axon.curve.getPointAt(.34+i*.16);const sheath=ctx.link(a,b,.16,C.teal,ctx.root,.85);pick(ctx,sheath,`myelin-${i}`,'Myelinated internode','Glial membrane wraps insulate this segment; exposed nodes regenerate the spike.','myelin');}
  for(let i=0;i<4;i++){const end=V(3.2,-.95+(i-1.5)*.42,(i-1.5)*.22);branch(ctx,[V(2.8,-.95,.05),V(3,-.95+(i-1.5)*.25),end],.04,C.pink,ctx.root,.02);const terminal=ctx.ball(end,.11,C.pink);pick(ctx,terminal,`terminal-${i}`,'Axon bouton','Vesicles release transmitter at specialized presynaptic active zones.','synaptic-release');}
  train(ctx,axon.curve,C.amber,2,ctx.root,{start:6,end:13,radius:.065});
  const microtubules=group(ctx.root);ctx.detail(microtubules,2);for(let j=0;j<3;j++){const pts=axon.curve.getPoints(35).map(p=>p.add(V(0,(j-1)*.035,.07)));const rail=ctx.tube(pts,.012,C.blue,microtubules,1,40);train(ctx,rail.curve,C.violet,2,microtubules,{start:0,end:16,radius:.033,detail:2});}pick(ctx,microtubules,'axonal-transport','Microtubules + transport cargo','Motor proteins carry organelles and cargo; their movement is distinct from the electrical spike.',undefined,2);
  paths.filter((_,i)=>i%9===0).forEach(p=>train(ctx,p,C.teal,1,tree,{start:0,end:6,reverse:true,radius:.03}));
  ctx.status('Original pyramidal-neuron teaching morphology · organelles, spines, myelin and transport are illustrative and not to scale.');
  narrative(ctx,[[0,'Receive','Synaptic inputs arrive on a branching dendritic tree.'],[5,'Integrate','Membrane currents combine across compartments; the initial segment can reach spike threshold.'],[7,'Regenerate the spike','A moving light marks the electrical event; channel opening regenerates the signal.'],[12,'Transmit','Terminal active zones convert the arriving electrical event into transmitter release.']]);
}

function buildMyelin(ctx:SceneContext){
  const axon=ctx.tube([V(-3.4,0),V(-1.4,.04),V(1.3,-.02),V(3.3,.03)],.14,C.pink,ctx.root,1,72);pick(ctx,axon.mesh,'axon-core','Axon inside myelin','The axoplasm contains cytoskeletal tracks; the electrically active membrane surrounds it.','neuron');
  const nodeXs=[-2.1,-.55,1,2.55];
  for(let i=0;i<4;i++){const g=group(ctx.root,V(-2.8+i*1.55,0,0));for(let layer=0;layer<9;layer++){const r=.19+layer*.026;const shell=ctx.mesh(new THREE.CylinderGeometry(r,r,1.28,40,1,true,0,Math.PI*1.63),ctx.material(layer%2?C.pearl:C.teal,.88),g);shell.rotation.z=Math.PI/2;pick(ctx,shell,`lamella-${i}-${layer}`,'Compact myelin lamella','Repeated wraps of oligodendrocyte membrane form compact myelin. This cutaway exaggerates layer spacing.','myelin',layer>3?1:0);}ctx.separable(g,V(0,i%2?.35:-.35,.2));
    for(const x of [-.65,.65])for(let j=0;j<5;j++){const ring=ctx.mesh(new THREE.TorusGeometry(.2+j*.021,.018,6,28),ctx.material(C.violet),g);ring.rotation.y=Math.PI/2;ring.position.x=x*(1-j*.035);ctx.detail(ring,1);}
  }
  for(const x of nodeXs){const channels=group(ctx.root,V(x,0));for(let i=0;i<9;i++){const a=i/9*Math.PI*2;const protein=helicalProtein(ctx,channels,V(0,Math.cos(a)*.16,Math.sin(a)*.16),C.amber,.16);protein.group.rotation.z=a;pick(ctx,protein.group,`nodal-nav-${x}-${i}`,'Nodal Naᵥ channel cluster','High channel density at nodes supports regenerative inward sodium current.','sodium-channel',1);}ctx.detail(channels,1);caption(ctx,'Node of Ranvier',channels,V(0,.72,.3),1,2);}
  const glia=smallNeuron(ctx,ctx.root,V(.3,1.65,-.3),C.violet,'interneuron',.7);pick(ctx,glia.soma,'oligodendrocyte','Oligodendrocyte','One CNS oligodendrocyte can support several myelinated internodes.','myelin');for(const x of [-2.8,.3,1.85])branch(ctx,[V(.3,1.65,-.3),V((x+.3)/2,.9,-.4),V(x,.38,-.15)],.045,C.violet,ctx.root,.019);caption(ctx,'Oligodendrocyte',glia.group,V(0,.55),0,3);
  for(let j=0;j<4;j++){const rail=ctx.tube([V(-3.4,(j-1.5)*.035,.11),V(0,(j-1.5)*.035,.11),V(3.3,(j-1.5)*.035,.11)],.008,C.blue,ctx.root,1,24);ctx.detail(rail.mesh,2);train(ctx,rail.curve,C.amber,1,ctx.root,{detail:2,radius:.025});}
  const wave=ctx.mesh(new THREE.TorusGeometry(.18,.035,8,32),ctx.material(C.amber,1,.65));wave.rotation.y=Math.PI/2;
  ctx.animate(t=>{const u=phase(t,12)/12;wave.position.set(-3.35+u*6.65,.03,0);wave.scale.setScalar(.9+.15*Math.sin(t*8));});
  caption(ctx,'Concentric membrane wraps · cutaway',ctx.root,V(0,-1.0,.5),0,3);
  ctx.status('Original myelin cutaway · lamella spacing and channel density exaggerated. Light marks electrical propagation, not ion travel along the axon.');
  narrative(ctx,[[0,'Insulated internode','Compact membrane wraps increase resistance and reduce effective capacitance.'],[3,'Nodal regeneration','Voltage-gated sodium channels regenerate the spike at exposed nodes.'],[7,'Local current spreads','Current spreads between nodes while the electrical event advances.'],[10,'Glial support','Paranodal junctions and oligodendrocyte processes organize the axon–myelin interface.']],12);
}

function buildMembrane(ctx:SceneContext){
  lipidSheet(ctx,ctx.root,V(0,0),6.5,2.5,.47);
  const pump=helicalProtein(ctx,ctx.root,V(-1.5,0,0),C.violet,1.3,3);pick(ctx,pump.group,'sodium-potassium-atpase','Na⁺/K⁺ ATPase','Each completed ATP-driven cycle exports three sodium ions and imports two potassium ions. The pump maintains gradients; leak conductances largely set resting voltage.',undefined,0);
  const leak=helicalProtein(ctx,ctx.root,V(1.45,0,0),C.teal,1,4);pick(ctx,leak.group,'potassium-leak','Potassium leak conductance','Selective resting permeability allows ion movement down an electrochemical gradient.','potassium-channel');
  caption(ctx,'Extracellular · Na⁺ rich',ctx.root,V(0,2.2),0,4);caption(ctx,'Cytoplasm · K⁺ rich',ctx.root,V(0,-2.2),0,4);caption(ctx,'ATP-driven pump',pump.group,V(0,.95),1,3);caption(ctx,'K⁺ leak pathway',leak.group,V(0,.95),1,3);
  for(let i=0;i<46;i++){const upper=i<25,x=(noise(i*4)-.5)*6,y=(upper?1:-1)*(.75+noise(i+2)*1.2),z=(noise(i+7)-.5)*2;const ion=ctx.ball(V(x,y,z),.06,upper?C.amber:C.teal);ctx.animate(t=>{ion.position.x=x+Math.sin(t*.6+i)*.055;ion.position.y=y+Math.cos(t*.5+i)*.04;});pick(ctx,ion,`pool-ion-${i}`,upper?'Sodium-rich extracellular pool':'Potassium-rich intracellular pool','Relative counts illustrate unequal concentrations; they are not concentration measurements.',undefined,2);}
  const sodium=Array.from({length:3},(_,i)=>ctx.ball(V(-1.5+(i-1)*.12,-1.1,.12),.095,C.amber));
  const potassium=Array.from({length:2},(_,i)=>ctx.ball(V(-1.5+(i-.5)*.18,1.1,-.13),.11,C.teal));
  ctx.animate(t=>{const p=phase(t,12);sodium.forEach((m,i)=>m.position.set(-1.5+(i-1)*.12,lerp(-1.1,1.05,ease((p-1)/4)),.14));potassium.forEach((m,i)=>m.position.set(-1.5+(i-.5)*.18,lerp(1.1,-1.05,ease((p-6)/4)),-.14));pump.domains.forEach((g,i)=>g.rotation.z=Math.sin(p*Math.PI/6+i)*.09);});
  train(ctx,new THREE.LineCurve3(V(1.45,-1.15,0),V(1.45,1.15,0)),C.teal,3,ctx.root,{start:0,end:12,duration:12,radius:.078});
  const atp=ctx.ball(V(-2.1,-.85,.1),.14,C.amber);caption(ctx,'ATP',atp,V(0,-.25),2);pick(ctx,atp,'ATP','ATP hydrolysis','ATP powers the pump cycle; ions and charge remain distinct concepts.',undefined,2);
  ctx.status('Original membrane mechanism · 3Na⁺/2K⁺ pump stoichiometry shown; concentrations, voltage and time are qualitative.');
  narrative(ctx,[[0,'Unequal ion distributions','Gradients store potential energy on either side of the membrane.'],[1,'Three Na⁺ exported','The pump binds cytoplasmic sodium and changes conformation with ATP-driven phosphorylation.'],[6,'Two K⁺ imported','Extracellular potassium binds and is carried inward during the cycle.'],[10,'Selective permeability','Leak conductances and electrochemical forces help set resting membrane voltage.']],12);
}

function buildGlia(topic:BrainTopic,ctx:SceneContext){
  const astro=topic.id==='astrocytes',color=astro?C.teal:C.violet,soma=group(ctx.root,V(-.4,0));const body=ctx.ball(V(),.43,color,soma,.85);body.scale.set(1.1,.92,.8);nucleus(ctx,soma,V(0,.03,.16),.23);pick(ctx,body,astro?'astrocyte-soma':'microglial-soma',astro?'Astrocyte':'Microglial soma',astro?'A glial cell with local processes that contact synapses and blood vessels.':'An immune cell whose ramified processes survey the surrounding tissue.');
  const tips:THREE.Group[]=[];
  for(let i=0;i<(astro?10:7);i++){const angle=i*Math.PI*2/(astro?10:7),g=group(soma);const end=V(Math.cos(angle)*1.65,Math.sin(angle)*1.65,Math.sin(i*2.6)*.5);branch(ctx,[V(),end.clone().multiplyScalar(.48).add(V(.15,0)),end],astro?.1:.065,color,g,.025);
    for(let j=0;j<4;j++){const a=angle+(j-1.5)*.26,tip=end.clone().add(V(Math.cos(a)*(.48+noise(j+i)*.22),Math.sin(a)*(.48+noise(j+i)*.22),(j-1.5)*.14));branch(ctx,[end.clone().multiplyScalar(.7),end,tip],.035,color,g,.006);const fine=group(g,tip);tips.push(fine);
      if(astro){for(let k=0;k<4;k++){const leaflet=ctx.ball(V((noise(k+i)-.5)*.16,(noise(k+j)-.5)*.16,k*.025),.09,color,fine,.62);leaflet.scale.set(1.7,.25,1.1);ctx.detail(leaflet,1);}}else{for(let k=0;k<3;k++)branch(ctx,[V(),V((k-1)*.12,.17,.02),V((k-1)*.23,.27,.06)],.016,color,fine,.004);}
      pick(ctx,fine,`glial-tip-${i}-${j}`,astro?'Fine astrocytic leaflet':'Surveying microglial process',astro?'Fine processes occupy perisynaptic space and express uptake and ion-handling proteins.':'Fine processes extend and retract during tissue surveillance.',astro?'transmitter-clearance':undefined,1);
    }
    if(!astro)ctx.animate(t=>{g.rotation.z=Math.sin(t*.3+i)*.04;g.rotation.x=Math.sin(t*.45+i)*.06;});
  }
  if(astro){const capillary=group(ctx.root,V(2.7,0,-.1));const vessel=ctx.mesh(new THREE.CylinderGeometry(.38,.38,5,32,1,true),ctx.material(C.red,.38),capillary);pick(ctx,vessel,'capillary','Capillary and glial endfeet','Endothelial cells form the blood–brain barrier; astrocytic endfeet support the neurovascular interface.');
    for(let i=0;i<5;i++){const rbc=ctx.mesh(new THREE.TorusGeometry(.2,.07,8,16),ctx.material(C.red),capillary);rbc.rotation.x=Math.PI/2;ctx.animate(t=>{rbc.position.y=((t*.35+i)%5)-2.5;});}
    for(let i=0;i<3;i++){branch(ctx,[V(.5,.6-i*.7),V(1.7,.85-i*.75,-.1),V(2.4,.85-i*.75,-.1)],.09,C.teal,ctx.root,.1);const foot=ctx.ball(V(2.37,.85-i*.75,-.1),.23,C.teal);foot.scale.set(.4,1.5,1.4);pick(ctx,foot,`endfoot-${i}`,'Astrocyte endfoot','An expanded glial process at the neurovascular interface.',undefined,1);}caption(ctx,'Capillary endfeet',capillary,V(0,2.6),0,4);
    const syn=ctx.ball(V(-2,-1.1,.35),.19,C.pink);pick(ctx,syn,'astrocyte-synapse','Perisynaptic interface','Astrocytic transporters rapidly remove released glutamate.','transmitter-clearance');for(let i=0;i<8;i++){const dot=ctx.ball(V(),.043,C.amber);ctx.animate(t=>{const u=(t*.12+i/8)%1;dot.position.copy(V(-2,-1.1,.35).lerp(V(-1.4,-.7,.1),u));dot.scale.setScalar(1-u*.7);});}caption(ctx,'Uptake at a synaptic interface',syn,V(-.1,-.4),1,3);mitochondrion(ctx,soma,V(.15,-.15,.24),.3);
    ctx.status('Original astrocyte model · fine leaflets, endfeet and transport are biologically informed schematics, not a segmented cell.');
    narrative(ctx,[[0,'Survey the territory','Fine leaflets contact local neural structures.'],[4,'Clear transmitter','Uptake proteins move glutamate out of the extracellular space.'],[9,'Support the environment','Ion handling and neurovascular contacts help maintain conditions for neural signaling.']]);
  }else{const debris=group(ctx.root,V(1.8,.5,.3));for(let i=0;i<8;i++)ctx.ball(V((noise(i)-.5)*.3,(noise(i+8)-.5)*.3,(noise(i+3)-.5)*.2),.075,C.amber,debris);pick(ctx,debris,'cellular-debris','Local debris','Engulfment and lysosomal processing are one microglial function; surveillance does not imply disease.');
    const lysosome=ctx.ball(V(-.45,-.15,.28),.13,C.amber);ctx.detail(lysosome,2);caption(ctx,'Phagolysosomal compartment',lysosome,V(0,-.34),2,3);ctx.animate(t=>{const u=ease((phase(t)-7)/7);debris.position.copy(V(1.8,.5,.3).lerp(V(-.45,-.15,.28),u));debris.scale.setScalar(1-u*.8);});caption(ctx,'Ramified surveillance processes',soma,V(-.4,2.7),0,4);
    ctx.status('Original microglial morphology · process motility and engulfment are illustrative, not recorded microscopy or activation-state classification.');
    narrative(ctx,[[0,'Ramified surveillance','Fine processes continually sample the surrounding tissue.'],[5,'Local contact','A process contacts a small debris fragment.'],[8,'Engulfment','Material is enclosed and moved into an intracellular compartment.'],[13,'Processing','Lysosomal pathways process engulfed material; many other microglial functions are not shown.']]);
  }
}

function vesicle(ctx:SceneContext,parent:THREE.Object3D,p:THREE.Vector3,radius=.32){
  const g=group(parent,p),shell=ctx.ball(V(),radius,C.teal,g,.2);pick(ctx,shell,'synaptic-vesicle','Synaptic vesicle','A lipid compartment containing a quantal transmitter package; membrane proteins load cargo and mediate release.','synaptic-release',1);
  for(let i=0;i<18;i++){const a=i*2.39996,y=1-2*(i+.5)/18,q=V(Math.cos(a)*Math.sqrt(1-y*y),y,Math.sin(a)*Math.sqrt(1-y*y));const protein=ctx.ball(q.clone().multiplyScalar(radius),radius*.115,i%3?C.blue:C.violet,g);ctx.detail(protein,2);}
  const cargo=group(g);for(let i=0;i<9;i++)ctx.ball(V((noise(i+1)-.5)*radius*1.2,(noise(i+12)-.5)*radius*1.2,(noise(i+24)-.5)*radius*1.2),radius*.11,C.amber,cargo);
  return{group:g,shell,cargo};
}
function snare(ctx:SceneContext,parent:THREE.Object3D,p:THREE.Vector3){const g=group(parent,p);for(let i=0;i<4;i++){const points=Array.from({length:24},(_,j)=>{const a=j*.45+i*Math.PI/2;return V(Math.cos(a)*.065,-.2+j*.026,Math.sin(a)*.065);});ctx.tube(points,.024,[C.pink,C.teal,C.blue,C.blue][i],g,1,32);}ctx.detail(g,2);pick(ctx,g,'snare-complex','SNARE bundle','Zippering of vesicle and plasma-membrane SNARE proteins helps drive membrane fusion.',undefined,2);return g;}
function activeSynapse(ctx:SceneContext,parent:THREE.Object3D,p:THREE.Vector3,size=1,variant='release'){
  const g=group(parent,p);g.scale.setScalar(size);const paired=variant==='facilitation'||variant==='depression',cycleLength=paired?8:16;
  const pre=group(g,V(0,1.05)),post=group(g,V(0,-.95));
  const dome=ctx.mesh(new THREE.SphereGeometry(2,38,22,0,Math.PI*2,0,Math.PI/2),ctx.material(C.pearl,.13),pre);dome.scale.set(1,.77,.65);pick(ctx,dome,'presynaptic-bouton','Presynaptic bouton','Vesicles, active-zone proteins and calcium channels organize transmitter release.','synaptic-release');
  const postBody=ctx.ball(V(0,-.25,0),1.2,C.pearl,post,.13);postBody.scale.set(1.6,.5,1);pick(ctx,postBody,'postsynaptic-spine','Postsynaptic compartment','Receptors and intracellular signaling machinery convert transmitter binding into local responses.','ltp');
  lipidSheet(ctx,pre,V(),4.2,2.25,.20);lipidSheet(ctx,post,V(),4.2,2.25);
  ctx.separable(pre,V(0,.75,0));ctx.separable(post,V(0,-.75,0));
  const pool=group(pre);const vesicles=Array.from({length:9},(_,i)=>vesicle(ctx,pool,V((i%3-1)*.95,.65+Math.floor(i/3)*.4,Math.sin(i*1.8)*.48),.25));
  const docked=vesicle(ctx,pre,V(0,.49,.30),.32);snare(ctx,pre,V(-.16,.08,.27));snare(ctx,pre,V(.16,.08,.27));
  const pore=ctx.mesh(new THREE.TorusGeometry(.19,.045,9,36),ctx.material(C.teal),pre);pore.rotation.x=Math.PI/2;pore.position.set(0,0,.3);
  const calcium=helicalProtein(ctx,pre,V(-.82,0,.24),C.violet,.67);pick(ctx,calcium.group,'presynaptic-cav','Presynaptic Caᵥ channel','Depolarization opens voltage-gated calcium channels near release sites.','calcium-channel');
  const sensor=ctx.ball(V(.22,.24,.38),.09,C.pink,pre);pick(ctx,sensor,'synaptotagmin','Calcium-sensitive release machinery','Synaptotagmin and interacting proteins couple local calcium to fast vesicle fusion.',undefined,2);ctx.detail(sensor,2);
  const receptors:ReturnType<typeof helicalProtein>[]=[];
  for(let i=-2;i<=2;i++){const type=i===1?'nmda':'ampa',r=helicalProtein(ctx,post,V(i*.65,0,.16),type==='nmda'?C.violet:C.blue,.58);receptors.push(r);pick(ctx,r.group,`post-${type}-${i}`,type==='nmda'?'NMDA receptor':'AMPA receptor',type==='nmda'?'Glutamate, a co-agonist and voltage-dependent relief of Mg²⁺ block regulate this channel.':'Ligand binding can open a cation-selective pore. Receptor availability is plastic.',type,1);}
  const density=group(post,V(0,-.43));for(let i=-7;i<=7;i++){ctx.link(V(i*.23,0,-.7),V(i*.23+.12,-.14,.7),.025,C.amber,density);if(i<7)ctx.link(V(i*.23,0,-.7),V((i+1)*.23,0,-.7),.025,C.amber,density);}ctx.detail(density,1);pick(ctx,density,'postsynaptic-density','Postsynaptic density','Scaffold proteins organize receptors and signaling complexes beneath the membrane.','ltp',1);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2;branch(ctx,[V(0,-1.55),V(Math.cos(a)*.6,-1.25,Math.sin(a)*.35),V(Math.cos(a)*1.3,-1.05,Math.sin(a)*.65)],.034,C.pink,g,.015);}
  mitochondrion(ctx,pre,V(1.05,1.1,-.35),.62);
  // Presynaptic calcium influx is drawn toward +Y into the upper bouton.
  const caPath=new THREE.CatmullRomCurve3([V(-.82,.38,.24),V(-.82,1.1,.24),V(-.25,1.36,.34)]);train(ctx,caPath,C.violet,5,g,{start:1,end:4,duration:cycleLength,radius:.051});
  const released=group(g),molecules=Array.from({length:32},()=>ctx.ball(V(),.04,C.amber,released));
  ctx.animate(t=>{const cycle=phase(t,cycleLength),fusion=ease((cycle-2)/2),release=ease((cycle-4)/(paired?3:5)),secondPulse=phase(t)>=8,releaseCount=variant==='facilitation'?(secondPulse?30:13):variant==='depression'?(secondPulse?10:28):32;docked.group.position.y=.49-fusion*.38;docked.group.scale.set(1+fusion*.32,1-fusion*.62,1+fusion*.32);docked.cargo.visible=cycle<4||cycle>14;pore.scale.setScalar(.2+Math.sin(clamp((cycle-2)/8,0,1)*Math.PI)*.95);
    molecules.forEach((m,i)=>{const u=clamp(release+(noise(i)-.5)*.27,0,1),spread=(noise(i+17)-.5)*3.2;m.visible=cycle>=4&&cycle<=12&&i<releaseCount;m.position.set(spread*ease(u),lerp(1.1,-.58,u),.3+(noise(i+91)-.5)*1.55*Math.sin(u*Math.PI));});
    receptors.forEach((r,i)=>r.domains.forEach((d,j)=>{const amount=cycle>6&&cycle<11?.09:0;d.position.x=Math.cos(j*Math.PI/2)*(.25+amount);d.position.z=Math.sin(j*Math.PI/2)*(.25+amount);}));
  });
  for(let i=-2;i<=2;i++)train(ctx,new THREE.LineCurve3(V(i*.65,-.65,.16),V(i*.65,-1.8,.16)),C.amber,2,g,{start:paired?6:7,end:paired?8:11,duration:cycleLength,radius:.041});
  caption(ctx,'Presynaptic active zone',pre,V(-1.1,1.85,.3),0,4);caption(ctx,'Postsynaptic density',density,V(0,-.2,.3),1,3);caption(ctx,'Synaptic cleft',g,V(-2.1,.1,.2),0,4);
  return{group:g,pre,post,vesicles,docked,receptors,released};
}

function buildSynapse(topic:BrainTopic,ctx:SceneContext){
  if(topic.id==='electrical-synapses'){
    const upper=lipidSheet(ctx,ctx.root,V(0,.46),6,3),lower=lipidSheet(ctx,ctx.root,V(0,-.46),6,3);ctx.detail(upper,0,2);ctx.detail(lower,0,2);ctx.separable(upper,V(0,.6));ctx.separable(lower,V(0,-.6));
    for(let n=0;n<7;n++){const x=(n%4-1.5)*1.2,z=Math.floor(n/4)*.95-.45,g=group(ctx.root,V(x,0,z));for(const side of[-1,1]){const hemichannel=group(g,V(0,side*.3));for(let j=0;j<6;j++){const a=j/6*Math.PI*2,d=helicalProtein(ctx,hemichannel,V(Math.cos(a)*.2,0,Math.sin(a)*.2),side>0?C.teal:C.blue,.32,1);d.group.scale.y*=1.4;}pick(ctx,hemichannel,`connexon-${n}-${side}`,'Connexon · six connexins','A hemichannel in one cell docks with its partner across the gap, creating a continuous intercellular pore.',undefined,1);}
      pick(ctx,g,`gap-junction-${n}`,'Gap junction channel','Ions and selected small molecules can pass directly between cytoplasms. Many electrical synapses are bidirectional; some rectify.','electrical-synapses');
      train(ctx,new THREE.LineCurve3(V(x,1.6,z),V(x,-1.6,z)),C.amber,2,ctx.root,{start:0,end:7,radius:.065});train(ctx,new THREE.LineCurve3(V(x,-1.6,z),V(x,1.6,z)),C.pink,2,ctx.root,{start:8,end:15,radius:.065});}
    caption(ctx,'Paired hexameric connexons',ctx.root,V(0,2.15),0,4);caption(ctx,'Cell 1 cytoplasm',ctx.root,V(-2.3,1.1),1,2);caption(ctx,'Cell 2 cytoplasm',ctx.root,V(-2.3,-1.1),1,2);
    ctx.status('Original gap-junction model · paired hexameric connexons; membrane spacing and transport timing are schematic.');narrative(ctx,[[0,'Direct coupling','Current passes through paired channels between two cells.'],[7,'A continuous aqueous route','Unlike chemical synapses, this route requires no vesicle release.'],[8,'Reverse transmission','Many channels allow communication in either direction; rectifying exceptions exist.']]);return;
  }
  if(topic.id==='synaptic-integration'){
    const dendrite=branch(ctx,[V(-3.3,-.2),V(-1.5,-.1),V(.4,-.15),V(1.75,-.1)],.18,C.pearl,ctx.root,.28);const soma=ctx.ball(V(2.35,-.15),.62,C.pearl);nucleus(ctx,ctx.root,V(2.36,-.12,.27),.27);pick(ctx,dendrite.mesh,'integrating-branch','Integrating dendritic branch','Spatial and temporal summation depend on conductances, timing, driving forces and the location of inputs.','dendrites');
    const inputs=[{x:-2.45,y:1.15,color:C.teal,label:'Excitatory input A',topic:'ampa',at:0},{x:-.95,y:1.15,color:C.teal,label:'Excitatory input B',topic:'ampa',at:3},{x:1.35,y:.92,color:C.pink,label:'Perisomatic inhibition',topic:'gabaa',at:7}];
    inputs.forEach((n,i)=>{const contact=spine(ctx,ctx.root,V(n.x,-.1),.8,C.pearl);const bouton=ctx.ball(V(n.x,n.y),.28,n.color);pick(ctx,bouton,`integration-input-${i}`,n.label,'The response depends on receptor conductance and electrochemical driving force.',n.topic);caption(ctx,n.label,bouton,V(0,.52),0,4);const axon=ctx.tube([V(n.x-.4,2.3,-.3),V(n.x,1.6,0),V(n.x,n.y)],.075,n.color);train(ctx,axon.curve,n.color,1,ctx.root,{start:n.at,end:n.at+3,radius:.075});const local=new THREE.CatmullRomCurve3([V(n.x,.45),V(n.x,0),V(2.25,-.15)]);train(ctx,local,n.color,3,ctx.root,{start:n.at+1,end:n.at+6,radius:.04});});
    const output=ctx.tube([V(2.7,-.3),V(3.15,-.8),V(3.45,-1.9)],.09,C.pink);train(ctx,output.curve,C.amber,2,ctx.root,{start:5,end:7,radius:.065});ctx.animate(t=>{const p=phase(t);(soma.material as THREE.MeshStandardMaterial).emissiveIntensity=p>4&&p<7?.45:p>8&&p<12?.05:.1;});caption(ctx,'Inputs sum across space and time',ctx.root,V(0,-1.4),0,3);
    ctx.status('Original integration scene · qualitative conductance effects and timing; not a voltage or spiking simulation.');narrative(ctx,[[0,'First excitatory input','A local synaptic conductance changes the branch voltage.'],[3,'Temporal + spatial summation','A second input arrives while the first response persists.'],[5,'Output threshold can be reached','This illustrative combination recruits an output spike.'],[8,'Inhibition changes the outcome','An appropriately timed inhibitory conductance can reduce or shunt the response.']]);return;
  }
  if(topic.id==='short-term-plasticity'){
    const panels=[activeSynapse(ctx,ctx.root,V(-2.05,.2),.72,'facilitation'),activeSynapse(ctx,ctx.root,V(2.05,.2),.72,'depression')];
    panels.forEach((panel,i)=>{caption(ctx,i?'Depression · limited vesicle availability':'Facilitation · residual Ca²⁺',panel.group,V(0,3.3),0,5);panel.vesicles.forEach((v,j)=>ctx.animate(t=>{const p=phase(t);v.group.visible=i===0||p<5||j<3||p>13;}));const residual=group(panel.pre);for(let j=0;j<12;j++){const ion=ctx.ball(V((noise(j)-.5)*1.3,.25+noise(j+8)*.65,(noise(j+15)-.5)*.8),.043,C.violet,residual);ctx.animate(t=>{ion.visible=i===0&&phase(t)>3&&phase(t)<12;});}});
    ctx.status('Original paired-pulse comparison · facilitation and depression are illustrative possibilities, not universal responses or measured rates.');narrative(ctx,[[0,'First pulse','Both boutons begin with an available release pool.'],[4,'Residual calcium versus depletion','Calcium persists at one bouton while the other has fewer readily releasable vesicles.'],[8,'Second pulse','The illustrative second release is larger with facilitation and smaller with depression.'],[14,'Recovery','Calcium clearance and vesicle replenishment restore baseline conditions.']]);return;
  }
  const main=activeSynapse(ctx,ctx.root,V(),1,topic.id);
  if(topic.id==='transmitter-clearance'){
    const sheath=branch(ctx,[V(2.8,-1.8),V(2.75,-.6),V(2.65,.8),V(2.5,1.9)],.32,C.teal,ctx.root,.19);pick(ctx,sheath.mesh,'astrocytic-sheath','Perisynaptic astrocyte process','Transporters on astrocytes contribute strongly to glutamate clearance.','astrocytes');
    for(let i=0;i<4;i++){const transporter=helicalProtein(ctx,ctx.root,V(2.46,-.75+i*.5,.2),C.teal,.47,3);transporter.group.rotation.z=Math.PI/2;pick(ctx,transporter.group,`EAAT-${i}`,'Glutamate transporter','Coupled transport removes glutamate from extracellular space; transport proteins are distinct from receptors.',undefined,1);const path=new THREE.CatmullRomCurve3([V((i-1.5)*.4,.1,.2),V(1.9,-.75+i*.5,.2),V(2.9,-.75+i*.5,.2)]);train(ctx,path,C.amber,3,ctx.root,{start:9,end:15,radius:.045});}
    caption(ctx,'Transport into astrocyte',ctx.root,V(2.7,2.3),0,4);
    const ache=group(ctx.root,V(-2.75,-1.65,.35));const enzyme=ctx.ball(V(),.28,C.violet,ache);enzyme.scale.set(1.25,1,.8);pick(ctx,enzyme,'acetylcholinesterase','A different route: acetylcholinesterase','Acetylcholine is hydrolyzed by acetylcholinesterase; this is not the glutamate-clearance mechanism.','acetylcholine',1);caption(ctx,'AChE: enzymatic route',ache,V(0,-.4),1,3);ctx.detail(ache,1);
    ctx.status('Original clearance scene · glutamate uptake is the main pathway shown; AChE inset illustrates a separate acetylcholine mechanism.');
    narrative(ctx,[[0,'Release + receptor binding','Transmitter crosses the cleft and can bind receptors.'],[8,'Transporter access','Unbound glutamate reaches uptake proteins on surrounding membranes.'],[11,'Recycling routes','Imported molecules enter cellular metabolic and recycling pathways.'],[14,'Other transmitters, other routes','Acetylcholine also has a dedicated extracellular enzymatic clearance mechanism.']]);
  }else{
    ctx.status('Original chemical-synapse model · molecular components informed by HHMI and PDB-101; geometry, particle counts and timing are schematic.');
    narrative(ctx,[[0,'Spike reaches the bouton','Membrane depolarization recruits nearby calcium channels.'],[2,'Calcium triggers release','Local Ca²⁺ acts on release machinery at a primed vesicle.'],[4,'Fusion and diffusion','Membranes fuse; transmitter enters the cleft and diffuses toward receptors.'],[7,'Postsynaptic conductance','Ligand binding opens some receptors; ions move according to their electrochemical gradients.'],[12,'Reset and recycle','Receptor unbinding, uptake and membrane recycling prepare another cycle.']]);
  }
}

type MolecularRecord={cid?:number;name:string;sourcePage?:string;atoms:{id:number;element:number;charge:number;position:number[]}[];bonds:number[][]};
function enkephalin():MolecularRecord{
  const atoms:MolecularRecord['atoms']=[],bonds:number[][]=[];const add=(element:number,p:THREE.Vector3)=>{const id=atoms.length+1;atoms.push({id,element,charge:0,position:p.toArray()});return id;};const bond=(a:number,b:number,order=1)=>bonds.push([a,b,order]);let last=0;
  for(let i=0;i<5;i++){const x=(i-2)*1.5,n=add(7,V(x-.48,.1,Math.sin(i)*.18)),alpha=add(6,V(x,.35,0)),carbon=add(6,V(x+.55,-.05,.12)),oxygen=add(8,V(x+.6,-.72,.12));bond(n,alpha);bond(alpha,carbon);bond(carbon,oxygen,2);if(last)bond(last,n);last=carbon;
    if(i===0||i===3){const beta=add(6,V(x,.95,0));bond(alpha,beta);const ring:number[]=[];for(let j=0;j<6;j++){const a=-Math.PI/2+j*Math.PI/3;ring.push(add(6,V(x+Math.cos(a)*.55,2.02+Math.sin(a)*.55,Math.sin(i)*.2)));}bond(beta,ring[0]);for(let j=0;j<6;j++)bond(ring[j],ring[(j+1)%6],j%2?1:2);if(i===0)bond(ring[3],add(8,V(x,3.2,0)));}
    if(i===4){let previous=alpha;for(const [j,e]of[6,6,16,6].entries()){const next=add(e,V(x+.12*(j%2),1+j*.5,(j%2)*.32));bond(previous,next);previous=next;}}
  }
  bond(last,add(8,V(3.95,.22,.1)));return{name:'Met-enkephalin · Tyr–Gly–Gly–Phe–Met',atoms,bonds};
}
async function buildMolecule(topic:BrainTopic,ctx:SceneContext){
  let record:MolecularRecord;const peptide=topic.id==='neuropeptides';
  if(peptide)record=enkephalin();else{
    try{const data=await asset<{molecules:Record<string,MolecularRecord>}>('micro-molecules');if(!ctx.isCurrent())return;record=data.molecules[topic.id];if(!record)throw new Error('Conformer missing');}
    catch{if(ctx.isCurrent())ctx.status('Molecular coordinates unavailable. The written guide and other scenes remain available.');return;}
  }
  const box=new THREE.Box3().setFromPoints(record.atoms.map(a=>V(...a.position as[number,number,number]))),center=box.getCenter(V()),size=box.getSize(V()),scale=5.4/Math.max(size.x,size.y,size.z),molecule=group(ctx.root);molecule.rotation.set(.18,-.3,.08);
  const atoms=new Map<number,{mesh:THREE.Mesh;record:MolecularRecord['atoms'][number]}>(),elementNames:Record<number,string>={1:'Hydrogen',6:'Carbon',7:'Nitrogen',8:'Oxygen',16:'Sulfur'},symbols:Record<number,string>={1:'H',6:'C',7:'N',8:'O',16:'S'},colors:Record<number,number>={1:0xeaf3ef,6:0x8bacae,7:C.blue,8:C.red,16:C.amber};
  for(const a of record.atoms){const p=V(...a.position as[number,number,number]).sub(center).multiplyScalar(scale),hydrogen=a.element===1,r=(hydrogen?.17:a.element===16?.37:.31)*scale;const atom=ctx.ball(p,r,colors[a.element]||C.pearl,molecule);if(hydrogen)ctx.detail(atom,1);atoms.set(a.id,{mesh:atom,record:a});
    pick(ctx,atom,`atom-${a.id}`,`${elementNames[a.element]||'Atom'} ${a.id}${a.charge?` · ${a.charge>0?'+':''}${a.charge}`:''}`,`${peptide?'Teaching-model':'PubChem'} atom. ${a.charge?`Formal charge ${a.charge>0?'+':''}${a.charge}.`:'No formal charge assigned in this record.'} Bond order and 3D coordinates are separate from receptor affinity and physiological protonation.`,undefined,hydrogen?1:0);
    const label=`${symbols[a.element]||a.element}${a.charge===1?'⁺':a.charge===-1?'⁻':a.charge?String(a.charge):''}`;caption(ctx,label,atom,V(0,r*.85,r*.9),a.charge?0:3,a.charge?6:1);
    const envelope=ctx.ball(p,({1:1.2,6:1.7,7:1.55,8:1.52,16:1.8}[a.element as 1|6|7|8|16]||1.6)*scale*.72,colors[a.element]||C.pearl,molecule,.045);ctx.detail(envelope,2);envelope.userData.nonPickable=true;
  }
  for(const [aid,bid,order]of record.bonds){const a=atoms.get(aid)!,b=atoms.get(bid)!,delta=b.mesh.position.clone().sub(a.mesh.position),offset=V(-delta.y,delta.x,0).normalize().multiplyScalar(.055*scale);for(let line=0;line<order;line++){const side=line-(order-1)/2,m=ctx.link(a.mesh.position.clone().addScaledVector(offset,side),b.mesh.position.clone().addScaledVector(offset,side),.066*scale,C.dark,molecule);if(a.record.element===1||b.record.element===1)ctx.detail(m,1);pick(ctx,m,`bond-${aid}-${bid}`,order===2?'Double covalent bond':order===3?'Triple covalent bond':'Single covalent bond','A bond connects the specified atoms. The displayed conformer is one geometrical arrangement, not a unique shape in solution.',undefined,2);}}
  const feature:Record<string,[string,string,string]>={glutamate:['Two carboxyl groups','An amino-acid transmitter','Ionization matters'],gaba:['Four-carbon backbone','Terminal amino group','Receptor context matters'],dopamine:['Catechol ring','Ethylamine side chain','Multiple receptor families'],serotonin:['Fused indole rings','5-hydroxyl + ethylamine','Multiple receptor families'],acetylcholine:['Quaternary ammonium','Ester linkage','Enzymatic hydrolysis'],norepinephrine:['Catechol + β-hydroxyl','Record stereochemistry','Adrenergic receptor families'],glycine:['Small amino acid','Amino + carboxyl groups','Glycine receptor and NMDA co-agonist roles'],histamine:['Imidazole ring','Ethylamine side chain','Histamine receptor families'],neuropeptides:['Peptide backbone','Five amino-acid residues','Side-chain diversity']};
  const features=feature[topic.id]||feature.glutamate;
  const nitrogen=[...atoms.values()].find(a=>a.record.element===7),oxygen=[...atoms.values()].find(a=>a.record.element===8);if(nitrogen)caption(ctx,topic.id==='acetylcholine'?'Permanent quaternary ammonium':'Nitrogen-containing group',nitrogen.mesh,V(0,.45,0),1,4);if(oxygen)caption(ctx,topic.id==='acetylcholine'?'Ester oxygen':'Oxygen-containing group',oxygen.mesh,V(0,-.4,0),1,3);
  ctx.animate(t=>{const p=phase(t,18);molecule.rotation.y=-.3+t*.065;for(const{mesh,record:a}of atoms.values())(mesh.material as THREE.MeshStandardMaterial).emissiveIntensity=(p<6&&a.element===6)||(p>=6&&p<12&&a.element===7)||(p>=12&&a.element===8)?.22:.035;});
  ctx.status(peptide?'Original Met-enkephalin heavy-atom connectivity model · hydrogen atoms omitted; this extended geometry is schematic, not a measured peptide conformation.':`PubChem computed conformer · CID ${record.cid} · ${topic.id==='acetylcholine'?'permanent +1 charge':'neutral reference compound; physiological protonation differs'}. Explicit hydrogens; not a receptor-bound conformation.`);
  narrative(ctx,[[0,features[0],peptide?'Peptide bonds connect Tyr–Gly–Gly–Phe–Met.':'A computed conformer supplies atomic positions and connectivity; rotation does not change its geometry.'],[6,features[1],peptide?'Zoom to inspect peptide connectivity, side chains and heavy-atom readouts. Hydrogens are omitted in this schematic.':'Zoom to reveal hydrogen atoms, bond order and atom-level readouts.'],[12,features[2],'Chemical structure constrains interactions; receptor subtype, state and cellular context determine the response.']],18);
}

type ProteinRecord={pdb?:string;title?:string;resolution?:number;chains:{id:string;name?:string;segments?:number[][][];points?:number[][];residues?:number[];residueNumbers?:number[];residueNames?:string[]}[]};
async function buildChannel(topic:BrainTopic,ctx:SceneContext){
  const target=(topic.modelTarget||topic.id).toLowerCase().replace(/[^a-z]/g,''),gaba=target==='gabaa',nmda=target==='nmda',ampa=target==='ampa',sodium=target.includes('sodium'),calcium=target.includes('calcium'),potassium=!gaba&&!nmda&&!ampa&&!sodium&&!calcium;
  const key=gaba?'gabaa':nmda?'nmda':ampa?'ampa':sodium?'sodium':calcium?'calcium':'potassium',count=gaba?5:4;
  const schematic=group(ctx.root);ctx.detail(schematic,0,1);lipidSheet(ctx,schematic,V(0,-.4),6.5,3.8,.85);
  const domains:THREE.Group[]=[],ligandArms:THREE.Group[]=[];const colors=gaba?[C.blue,C.teal,C.blue,C.teal,C.violet]:nmda?[C.teal,C.amber,C.teal,C.amber,C.violet]:[C.teal,C.blue,C.pink,C.amber,C.violet];
  for(let i=0;i<count;i++){const angle=i/count*Math.PI*2,domain=group(schematic,V(Math.cos(angle)*.88,0,Math.sin(angle)*.88));domains.push(domain);
    const helices=sodium||calcium||potassium?6:gaba?4:3;
    for(let j=0;j<helices;j++){const a=j/helices*Math.PI*2,center=V(Math.cos(a)*.21,0,Math.sin(a)*.21),sensor=(sodium||calcium||potassium)&&j===3,points=Array.from({length:50},(_,n)=>V(center.x+Math.cos(n*.69)*.058,-1.28+n*.045,center.z+Math.sin(n*.69)*.058));const helix=ctx.tube(points,.041,sensor?C.pink:colors[i],domain,1,80);pick(ctx,helix.mesh,`domain-${i}-helix-${j}`,sensor?'S4 voltage-sensor helix':`Membrane helix ${j+1}`,sensor?'Positively charged residues help couple membrane voltage to gating.':`${sodium||calcium?'A repeat within one pore-forming α chain.':'A membrane-spanning part of a protein subunit.'} This helix layout is a mechanism schematic.`,undefined,1);
      if(sensor)for(let r=0;r<5;r++){const charge=ctx.ball(V(center.x+.085,-.95+r*.24,center.z),.057,C.amber,domain);pick(ctx,charge,`sensor-charge-${i}-${r}`,'Positive voltage-sensor residue','Arginine and lysine side chains contribute gating charge movement.',undefined,1);}
    }
    const loopPoints=Array.from({length:20},(_,j)=>V(Math.cos(j/19*Math.PI)*.23,.94+Math.sin(j/19*Math.PI)*.32,Math.sin(j/19*Math.PI)*.12));ctx.tube(loopPoints,.035,colors[i],domain,1,28);
    if(nmda||ampa){const loop=ctx.tube([V(-.13,-1.26,.13),V(-.08,-.3,.13),V(.035,.07,.13),V(.13,-.3,.13),V(.17,-1.26,.13)],.035,colors[i],domain,1,32);pick(ctx,loop.mesh,`reentrant-M2-${i}`,'M2 re-entrant pore loop','Ionotropic glutamate receptors contain three membrane-spanning helices plus a re-entrant M2 pore loop; the four parts are not four full transmembrane helices.',undefined,1);}
    if(gaba){
      const ecd=group(domain,V(0,1.4));ecd.rotation.y=-angle;
      for(const side of[-1,1])for(let strand=0;strand<5;strand++){const pts=Array.from({length:9},(_,k)=>V((strand-2)*.085+(k%2?-.016:.016),-.45+k*.115,side*.11+Math.sin(k/8*Math.PI)*.045));const beta=ctx.tube(pts,.028,colors[i],ecd,1,18);pick(ctx,beta.mesh,`gaba-beta-${i}-${side}-${strand}`,'Extracellular β-sandwich','Each GABA-A subunit has a β-rich extracellular domain. GABA binds between adjacent β and α subunits; this fold is an original schematic.','gaba',1);}
      ctx.tube([V(-.2,-.35,.1),V(-.32,-.56,0),V(-.06,-.51,-.1)],.03,C.amber,ecd,1,18);
    }else if(nmda||ampa){const base=group(domain,V(0,1.2));for(const side of[-1,1]){const arm=group(base,V(side*.15,0));const lobe=ctx.ball(V(side*.06,.19,0),.33,colors[i],arm);lobe.scale.set(.75,1.55,1);arm.rotation.z=side*.22;ligandArms.push(arm);pick(ctx,lobe,`ligand-domain-${i}-${side}`,'Extracellular ligand-binding domain','Ligand-dependent clamshell closure couples to the pore. This split-lobe mechanism is schematic.',nmda&&i%2===0?'glycine':'glutamate',1);}}
    pick(ctx,domain,`channel-domain-${i}`,sodium||calcium?`Pore-forming α chain · domain ${['I','II','III','IV'][i]}`:gaba?`GABA-A ${['β2','α1','β2','α1','γ2'][i]} subunit`:nmda?`${i%2===0?'GluN1 · co-agonist':'GluN2 · glutamate'} subunit`:`Protein subunit ${i+1}`,sodium||calcium?'Four homologous membrane domains belong to one long pore-forming chain.':'Several protein subunits assemble around a central aqueous pore.',undefined,0);ctx.separable(domain,V(Math.cos(angle)*.7,0,Math.sin(angle)*.7));
  }
  const filter=group(schematic,V(0,.28));for(let ring=0;ring<4;ring++)for(let i=0;i<count;i++){const a=i/count*Math.PI*2;const oxygen=ctx.ball(V(Math.cos(a)*.26,ring*.13,Math.sin(a)*.26),.047,C.red,filter);pick(ctx,oxygen,`filter-${ring}-${i}`,'Selectivity-filter chemistry',potassium?'Carbonyl oxygen geometry helps stabilize permeating K⁺. The illustrated coordination is schematic.':'Pore chemistry contributes to ion selectivity; atoms shown here illustrate a mechanism, not experimental positions.',undefined,1);}ctx.detail(filter,1);
  const gate=group(schematic,V(0,-.98));for(let i=0;i<count;i++){const a=i/count*Math.PI*2,m=ctx.mesh(new THREE.CapsuleGeometry(.10,.5,5,10),ctx.material(colors[i]),gate);m.rotation.z=Math.PI/2;m.rotation.y=a;m.position.set(Math.cos(a)*.19,0,Math.sin(a)*.19);}
  const block=ctx.ball(V(0,.3),nmda?.18:.10,nmda?C.violet:C.amber,schematic);block.visible=nmda||sodium;pick(ctx,block,nmda?'magnesium-block':'inactivation-gate',nmda?'Voltage-dependent Mg²⁺ block':'Fast inactivation motif',nmda?'Depolarization relieves pore block; glutamate and a co-agonist are also required.':'A fast inactivation mechanism limits a sodium-channel opening episode.',undefined,1);
  if(ampa||nmda||gaba){for(let i=0;i<(gaba?2:4);i++){const coagonist=nmda&&i%2===0,angle=gaba?(i*2+.5)/5*Math.PI*2:i*Math.PI/2,ligand=ctx.ball(V(),.085,gaba?C.pink:coagonist?C.teal:C.amber,schematic);ctx.animate(t=>{const u=ease((phase(t)-1-i*.4)/3);ligand.position.copy(V(-2.4+i*.3,2.4,.2).lerp(V(Math.cos(angle)*1.05,1.5,Math.sin(angle)*1.05),u));});pick(ctx,ligand,`ligand-${i}`,gaba?'GABA · β2/α1 interface':coagonist?'Glycine / D-serine co-agonist':'Glutamate',gaba?'The illustrated α1β2γ2 receptor has two GABA-binding β/α interfaces. Binding geometry and timing are schematic.':nmda?'The illustrated GluN1/GluN2 receptor has two glutamate-binding and two co-agonist-binding subunits. Ligand geometry and timing are schematic.':'Ligand particles illustrate occupancy; binding sites and time are simplified.',gaba?'gaba':coagonist?'glycine':'glutamate',1);}}
  const ions=Array.from({length:14},()=>ctx.ball(V(),.076,gaba?C.pink:potassium?C.teal:calcium?C.violet:C.amber,schematic));
  ctx.animate(t=>{const p=phase(t),open=ease((p-4)/2)*(1-ease((p-(sodium?8:11))/2));domains.forEach((d,i)=>{d.rotation.y=Math.sin(i)*open*.075;d.scale.x=1+open*.06;});ligandArms.forEach((a,i)=>a.rotation.z=(i%2?1:-1)*(.22-.15*open));gate.scale.set(1+open*1.4,1,1+open*1.4);block.position.set(nmda?open*1.5:0,sodium?lerp(-1.7,-.9,ease((p-8)/2)):.3,0);block.visible=nmda||sodium&&p>7;ions.forEach((ion,i)=>{const u=(p*.28+i/14)%1;ion.visible=open>.4;ion.position.set(Math.sin(i*2.4)*.11,(potassium?1:-1)*lerp(-2.3,2.9,u),Math.cos(i*2.4)*.11);});});
  caption(ctx,'Extracellular',schematic,V(-2.35,2.55),0,3);caption(ctx,'Cytoplasmic',schematic,V(-2.35,-1.9),0,3);caption(ctx,potassium?'K⁺ selectivity filter':'Selective aqueous pore',filter,V(1.45,.2,.25),1,3);caption(ctx,'Zoom closer → experimental protein',schematic,V(0,-2.65),0,5);
  narrative(ctx,[[0,gaba||nmda||ampa?'Ligand availability':'Resting gating configuration','Overview is a mechanistic reconstruction. Closer zoom reveals a separate, static experimental protein structure.'],[4,nmda?'Ligand occupancy + relief of Mg²⁺ block':'Gate opening',nmda?'Both chemical and voltage-dependent requirements matter.':'Conformational coupling changes pore accessibility. The motion is illustrative, not a molecular-dynamics calculation.'],[6,'Selective ion permeation','Ion direction follows electrochemical driving force; the example uses typical neuronal conditions.'],[sodium?9:11,sodium?'Fast inactivation':'Closing / deactivation','Channels spend time in distinct functional states. Experimental coordinates are not morphed into these schematic states.'],[13,'Recovery','A new cycle begins after return toward baseline conditions.']]);
  ctx.status('Custom gating mechanism · schematic geometry. Loading experimental Cα backbone for closer inspection…');
  try{
    const data=await asset<ProteinRecord>(gaba?'gaba-a-6d6t':`micro-${key}`);if(!ctx.isCurrent())return;
    const protein=group(ctx.root,V(0,gaba||nmda||ampa?.6:0)),points=data.chains.flatMap(c=>c.segments?.flat()||c.points||[]),box=new THREE.Box3().setFromPoints(points.map(p=>V(...p as[number,number,number]))),center=box.getCenter(V()),size=box.getSize(V()),scale=5.3/Math.max(size.x,size.y,size.z);protein.scale.setScalar(.25);ctx.detail(protein,2);
    data.chains.forEach((chain,i)=>{const chainGroup=group(protein),color=colors[i%colors.length];let sequenceIndex=0;
      for(const segment of chain.segments||[chain.points||[]]){if(segment.length<2){sequenceIndex+=segment.length;continue;}const coords=segment.map(p=>V(...p as[number,number,number]).sub(center).multiplyScalar(scale));const trace=ctx.tube(coords,.028,color,chainGroup,1,Math.min(coords.length*2,1800));pick(ctx,trace.mesh,`experimental-chain-${chain.id}`,chain.name||`Protein chain ${chain.id}`,`Experimental backbone coordinates from PDB ${data.pdb||'6D6T'}. Missing residues remain gaps; this deposited conformation is static.`,undefined,2);
        const ca=new THREE.InstancedMesh(new THREE.SphereGeometry(.047,16,12),ctx.material(color),coords.length),transform=new THREE.Object3D();
        ca.userData.instancePicks=coords.map((p,j):PickSpec=>{transform.position.copy(p);transform.updateMatrix();ca.setMatrixAt(j,transform.matrix);const index=sequenceIndex+j,residue=(chain.residues||chain.residueNumbers)?.[index],name=chain.residueNames?.[index];return{id:`${chain.id}-${residue??`modeled-${index+1}`}`,label:`${name||'Residue'} ${residue??`(modeled position ${index+1})`} · chain ${chain.id}`,description:`Modeled Cα position from PDB ${data.pdb||'6D6T'}. This bead marks the amino-acid alpha carbon only; side-chain atoms and unresolved residues are not shown.`,level:3,kind:'Experimental Cα',priority:4};});
        chainGroup.add(ca);trace.mesh.userData.residueCloud=ca;ctx.detail(ca,3);pick(ctx,ca,`alpha-carbons-${chain.id}`,`Cα positions · chain ${chain.id}`,'Each small bead marks one modeled amino-acid alpha carbon; side-chain atoms are not included in this representation.',undefined,3);sequenceIndex+=coords.length;
      }
      const localBox=new THREE.Box3().setFromObject(chainGroup),centroid=localBox.getCenter(V());ctx.separable(chainGroup,centroid.clone().normalize().multiplyScalar(.65));if(i<5)caption(ctx,chain.name?chain.name.slice(0,52):`Chain ${chain.id}`,chainGroup,centroid,2,1);
    });
    caption(ctx,`${data.pdb||'6D6T'} · experimental Cα backbone`,protein,V(0,3.05),2,6);
    ctx.status(`Overview: custom gating schematic. Close zoom: experimental ${data.pdb||'6D6T'} Cα coordinates${data.resolution?` (${data.resolution} Å)`:''} · fixed deposited conformation; no assumed membrane alignment.`);
  }catch{if(ctx.isCurrent())ctx.status('Custom gating mechanism · teaching geometry and timing. Experimental coordinates could not load; overview remains available.');}
}

function kinaseHub(ctx:SceneContext,parent:THREE.Object3D,p:THREE.Vector3,phosphatase=false){
  const g=group(parent,p),core=ctx.ball(V(),.13,phosphatase?C.violet:C.amber,g);if(!phosphatase)for(let i=0;i<12;i++){const a=i/12*Math.PI*2;ctx.link(V(Math.cos(a)*.09,0,Math.sin(a)*.09),V(Math.cos(a)*.36,Math.sin(i)*.045,Math.sin(a)*.36),.021,C.amber,g);const domain=ctx.ball(V(Math.cos(a)*.36,Math.sin(i)*.045,Math.sin(a)*.36),.082,C.amber,g);domain.scale.set(1.2,.7,.9);}else for(let i=0;i<3;i++){const domain=ctx.ball(V(Math.cos(i*2.1)*.17,.05,Math.sin(i*2.1)*.17),.13,C.violet,g);domain.scale.y=.6;}
  ctx.detail(g,1);pick(ctx,g,phosphatase?'phosphatase':'CaMKII',phosphatase?'Phosphatase pathway':'CaMKII signaling hub',phosphatase?'Phosphatase-dependent signaling contributes to some NMDA-dependent LTD mechanisms.':'Calcium/calmodulin activates kinase signaling that can modify receptors and their trafficking.',undefined,1);return{group:g,core};
}
function plasticSynapse(topic:BrainTopic,ctx:SceneContext){
  const ltd=topic.id==='ltd',dendrite=branch(ctx,[V(-3,-2.05),V(0,-2),V(3,-2.05)],.28,C.pearl,ctx.root,.28);pick(ctx,dendrite.mesh,'plastic-dendrite','Parent dendritic branch','Local synapses exchange material and electrical signals with the dendrite.','dendrites');
  branch(ctx,[V(0,-2),V(.08,-1.2),V(0,-.35)],.25,C.pearl,ctx.root,.28);const head=ctx.ball(V(0,0),.94,C.pearl,ctx.root,.33);head.scale.set(1.45,.82,1.18);pick(ctx,head,'plastic-spine','Plastic dendritic spine','Receptors, signaling proteins and actin are organized inside a specialized postsynaptic compartment.','structural-plasticity');
  lipidSheet(ctx,ctx.root,V(0,.76),2.85,1.9);const terminal=group(ctx.root,V(0,2.15));const pre=ctx.ball(V(),.85,C.pink,terminal,.14);pre.scale.set(1.65,.55,1.1);for(let i=0;i<5;i++)vesicle(ctx,terminal,V((i-2)*.4,.1,(i%2-.5)*.6),.18);pick(ctx,pre,'plastic-presynapse','Presynaptic terminal','Repeated synaptic activity can provide an induction signal; plasticity rules differ across circuits.','synaptic-release');
  const nmda=helicalProtein(ctx,ctx.root,V(.6,.76,.15),C.violet,.56);pick(ctx,nmda.group,'induction-NMDA','NMDA receptor','Calcium entry through NMDARs contributes to the illustrated form of plasticity.','nmda');
  const enzyme=kinaseHub(ctx,ctx.root,V(.38,-.35,.3),ltd);caption(ctx,ltd?'Phosphatase-dependent signaling':'Ca²⁺ / CaMKII signaling',enzyme.group,V(0,-.55),1,4);
  const endosome=vesicle(ctx,ctx.root,V(ltd?1.7:-1.7,-1.35,.15),.37);pick(ctx,endosome.group,'recycling-endosome',ltd?'Endocytic / recycling compartment':'Recycling endosome',ltd?'Receptors can be internalized from the synaptic membrane.':'Intracellular receptor pools and lateral diffusion contribute to receptor recruitment.',undefined,1);
  if(ltd){const cage=ctx.mesh(new THREE.IcosahedronGeometry(.43,1),new THREE.MeshBasicMaterial({color:C.amber,wireframe:true}),endosome.group);pick(ctx,cage,'clathrin-coat','Clathrin-associated endocytosis','A schematic coated compartment illustrates receptor internalization; actual endocytosis involves many proteins.',undefined,2);ctx.detail(cage,2);}
  const receptors=Array.from({length:7},(_,i)=>{const r=helicalProtein(ctx,ctx.root,V((i-3)*.32,.76,.4),C.blue,.33);pick(ctx,r.group,`plastic-ampa-${i}`,'AMPA receptor trafficking',ltd?'The displayed receptor moves from the membrane into an intracellular pool.':'The displayed receptor is recruited to the synaptic membrane.','ampa',1);return r;});
  const actin=group(ctx.root);ctx.detail(actin,1);for(let i=0;i<9;i++){const a=i*2.4;ctx.tube([V(Math.cos(a)*.18,-1.5,Math.sin(a)*.18),V(Math.cos(a)*.45,-.45,Math.sin(a)*.45),V(Math.cos(a)*.85,.42,Math.sin(a)*.6)],.015,C.pink,actin,1,28);}pick(ctx,actin,'actin-network','Actin cytoskeleton','Actin remodeling helps change spine structure; biochemical and structural effects need not occur identically at all synapses.','structural-plasticity',1);
  train(ctx,new THREE.CatmullRomCurve3([V(.6,1.5,.15),V(.6,.4,.15),V(.38,-.35,.3)]),C.violet,5,ctx.root,{start:2,end:8,duration:20,radius:.043});
  ctx.animate(t=>{const p=phase(t,20),change=ease((p-7)/7);(enzyme.core.material as THREE.MeshStandardMaterial).emissiveIntensity=p>4&&p<13?.7:.04;head.scale.set(1.45*(1+(ltd?-.13:.15)*change),.82*(1+(ltd?-.15:.22)*change),1.18*(1+(ltd?-.1:.12)*change));receptors.forEach((r,i)=>{const surface=V((i-3)*.32,.76,.4),pool=V(ltd?1.7:-1.7,-1.35,.15);if(i<3){r.group.position.copy(surface);return;}const u=ltd?change:1-change;r.group.position.copy(surface).lerp(pool,u);r.group.position.z+=Math.sin(u*Math.PI)*.5;r.group.scale.setScalar(.33);});actin.scale.x=1+(ltd?-.1:.13)*change;});
  caption(ctx,ltd?'AMPA internalization':'AMPA recruitment',ctx.root,V(-1.65,1.35,.5),0,4);caption(ctx,'Induction → expression',ctx.root,V(0,-2.7),0,3);
  ctx.status(`Original ${ltd?'LTD':'LTP'} mechanism · one NMDA-dependent example. Molecular geometry, time, receptor numbers and spine changes are schematic.`);
  narrative(ctx,[[0,'Baseline synaptic organization','A local postsynaptic compartment contains receptors, scaffolds and intracellular pools.'],[2,'Induction signal','Activity recruits an NMDA-dependent calcium signal in this example.'],[5,ltd?'Phosphatase-dependent signaling':'Kinase-dependent signaling',ltd?'A signaling pathway favors reduced synaptic AMPA availability.':'Calcium-dependent signaling supports changes in receptor function and trafficking.'],[8,ltd?'Receptor internalization':'Receptor recruitment',ltd?'Some receptors leave the synaptic membrane; many other LTD mechanisms also exist.':'Receptors can be recruited or stabilized at the synapse.'],[14,'Changed efficacy','The final state illustrates altered synaptic efficacy. Looping restarts the demonstration, not a biological reversal.']],20);
}
function buildPlasticity(topic:BrainTopic,ctx:SceneContext){
  if(topic.id==='ltp'||topic.id==='ltd'){plasticSynapse(topic,ctx);return;}
  if(topic.id==='spike-timing'){
    const pre=smallNeuron(ctx,ctx.root,V(-2.15,1.2),C.teal,'pyramidal',.8),post=smallNeuron(ctx,ctx.root,V(2.15,1.2),C.blue,'pyramidal',.8);caption(ctx,'Presynaptic',pre.group,V(0,1),0,4);caption(ctx,'Postsynaptic',post.group,V(0,1),0,4);
    const connection=ctx.tube([V(-1.9,1),V(0,.55,.35),V(1.95,1)],.055,C.teal);pick(ctx,connection.mesh,'timing-sensitive-synapse','Timing-sensitive connection','Pre/post spike order can influence plasticity, but the rule depends on the synapse, frequency and state.','ltp');
    const traces:THREE.Group[]=[];for(let row=0;row<2;row++){const g=group(ctx.root,V(0,-.6-row*.9)),baseline=ctx.link(V(-3,0),V(3,0),.009,C.dark,g);const trace=ctx.tube([V(-1.3,0),V(-.18,0),V(-.04,.65),V(.08,-.16),V(.28,0),V(1.3,0)],.027,row?C.blue:C.teal,g,1,55);traces.push(g);caption(ctx,row?'Post spike':'Pre spike',g,V(-2.65,.28),0,3);}
    const timingMarker=ctx.ball(V(0,-2.3),.11,C.amber);pick(ctx,timingMarker,'relative-spike-order','Relative spike order','No physical millisecond scale is assigned to this animation. Canonical pre-before-post and reversed-order examples are contrasted.');
    ctx.animate(t=>{const p=phase(t,20),positive=p<10;traces[0].position.x=positive?-.45:.45;traces[1].position.x=positive?.45:-.45;const mat=connection.mesh.material as THREE.MeshStandardMaterial;mat.color.setHex(positive?C.teal:C.pink);mat.emissiveIntensity=(p%10)>3?.25:.04;const first=positive?pre.soma:post.soma,second=positive?post.soma:pre.soma;(first.material as THREE.MeshStandardMaterial).emissiveIntensity=Math.max(0,1-Math.abs(p%10-2))*.8;(second.material as THREE.MeshStandardMaterial).emissiveIntensity=Math.max(0,1-Math.abs(p%10-3))*.8;});
    ctx.status('Original spike-timing comparison · canonical timing rule, not universal across synapses; traces have qualitative time and voltage axes.');narrative(ctx,[[0,'Pre before post','A presynaptic spike precedes a postsynaptic spike in this canonical example.'],[4,'Potentiation-biased pairing','Repeated causal-order pairing can strengthen some connections.'],[10,'Post before pre','The order is reversed.'],[14,'Depression-biased pairing','At some synapses the opposite order can weaken a connection; other timing rules also occur.']],20);return;
  }
  if(topic.id==='homeostatic-plasticity'){
    branch(ctx,[V(-3.2,-1.2),V(0,-1.1),V(3.2,-1.2)],.21,C.pearl,ctx.root,.21);
    const sets:{spine:ReturnType<typeof spine>;receptors:THREE.Group[];baseline:number}[]=[];
    for(let i=0;i<5;i++){const s=spine(ctx,ctx.root,V((i-2)*1.3,-1.1),1.2,C.pearl),baseline=i%3+2,receptors:THREE.Group[]=[];for(let j=0;j<8;j++){const r=helicalProtein(ctx,s.group,V((j-3.5)*.042,.88,.03),C.blue,.095);receptors.push(r.group);}const bouton=ctx.ball(V((i-2)*1.3,.54,.02),.23,C.pink);pick(ctx,bouton,`scaled-synapse-${i}`,`Synapse ${i+1} · distinct starting strength`,'Global activity regulation can change many synapses together while approximately preserving their relative strengths.','ampa',1);sets.push({spine:s,receptors,baseline});}
    const regulation=group(ctx.root,V(0,2));const hub=nucleus(ctx,regulation,V(),.33);pick(ctx,hub,'homeostatic-regulation','Cell-wide activity regulation','Homeostatic mechanisms oppose prolonged deviations from a cell’s activity range; they differ from input-specific Hebbian rules.');for(let i=0;i<5;i++)ctx.tube([V(0,1.7),V((i-2)*.7,1.4,.25),V((i-2)*1.3,.4)],.013,C.violet,ctx.root,.5,28);
    ctx.animate(t=>{const gain=1+ease((phase(t,20)-6)/8)*.6;sets.forEach(({spine:s,receptors,baseline})=>{s.head.scale.set(1.12*gain,.83*gain,.94*gain);receptors.forEach((r,j)=>r.visible=j<Math.round(baseline*gain));});});caption(ctx,'One activity signal · many synapses',regulation,V(0,.65),0,4);caption(ctx,'Relative starting strengths retained',ctx.root,V(0,-2.1),0,3);
    ctx.status('Original homeostatic-scaling model · receptor counts and shared gain are illustrative; real mechanisms differ by cell and perturbation.');narrative(ctx,[[0,'Different starting strengths','The branch begins with several unequal synapses.'],[4,'Activity deviates for a prolonged period','A cell-wide regulatory process senses the broader activity state.'],[7,'Shared adjustment','Many synapses change together in this scaling example.'],[15,'Stability with structure','The adjustment can preserve relative differences while changing overall excitability.']],20);return;
  }
  if(topic.id==='structural-plasticity'){
    branch(ctx,[V(-3.3,-1.55),V(0,-1.5),V(3.3,-1.55)],.27,C.pearl,ctx.root,.27);
    const growth:{neck:THREE.Group;head:THREE.Mesh;psd:THREE.Mesh;actin:THREE.Group}[]=[];
    for(let i=0;i<3;i++){const x=(i-1)*2.1,neck=group(ctx.root,V(x,-1.5)),b=branch(ctx,[V(),V(.1,.65,.03),V(0,1.4)],.065,C.pearl,neck,.04),head=ctx.ball(V(x,-.1),.15,C.teal),psd=ctx.mesh(new THREE.CylinderGeometry(.15,.15,.03,16),ctx.material(C.amber));psd.position.set(x,.03,0);const actin=group(neck);for(let j=0;j<3;j++)ctx.tube([V((j-1)*.02,0,.02),V((j-1)*.04,.7,.02),V((j-1)*.03,1.4,.02)],.012,C.pink,actin,1,20);ctx.detail(actin,1);growth.push({neck,head,psd,actin});pick(ctx,head,`growing-spine-${i}`,i<2?'Contact-forming protrusion':'Unstabilized protrusion','Actin-supported processes can grow, stabilize, change shape or retract. Individual events differ from this schematic cycle.','dendrites',1);if(i<2){const ax=ctx.tube([V(x-.7,1.4,-.2),V(x,1.1),V(x+.7,1.4,.2)],.09,C.pink);const bouton=ctx.ball(V(x,.9),.23,C.pink);pick(ctx,bouton,`structural-bouton-${i}`,'Potential synaptic partner','Contact and signaling can support stabilization of a spine-like protrusion.','synaptic-release');}}
    ctx.animate(t=>{const p=phase(t,20),extend=ease((p-1)/8);growth.forEach(({neck,head,psd},i)=>{const stable=i<2,gain=stable?lerp(.35,1.55,extend):lerp(.35,1.2,extend)*(1-ease((p-10)/7)*.8);neck.scale.y=gain;head.position.y=-1.5+1.4*gain;head.scale.setScalar(stable?.45+ease((p-8)/7)*1.2:.5);psd.position.y=head.position.y+.14;psd.visible=stable&&p>10;});});caption(ctx,'Growth → contact → stabilization',ctx.root,V(0,2.25),0,4);caption(ctx,'Some protrusions retract',ctx.root,V(2.15,-2.15),0,3);
    ctx.status('Original structural-plasticity sequence · filopodial extension, actin remodeling and contact stabilization; not microscopy or a universal time course.');narrative(ctx,[[0,'A dynamic dendrite','Thin protrusions explore local space.'],[3,'Actin-supported extension','Cytoskeletal remodeling changes shape.'],[9,'Contact changes the trajectory','Some protrusions contact axonal boutons.'],[13,'Stabilize or retract','Illustrative contacts mature while an unstabilized protrusion retracts.']],20);return;
  }
  // Memory consolidation deliberately changes scale: a systems-level process is not a single growing spine.
  const hippocampus=group(ctx.root,V(-2,0)),cortex=group(ctx.root,V(1.7,0));
  const left:THREE.Vector3[]=[],right:THREE.Vector3[]=[];
  for(let i=0;i<5;i++){const a=i/5*Math.PI*1.6-.5,p=V(Math.cos(a)*.9,Math.sin(a)*.9,Math.sin(i)*.2);left.push(p.clone().add(hippocampus.position));smallNeuron(ctx,hippocampus,p,C.teal,'pyramidal',.37);}
  for(let i=0;i<9;i++){const p=V((i%3-1)*.82,(Math.floor(i/3)-1)*.82,Math.sin(i)*.17);right.push(p.clone().add(cortex.position));smallNeuron(ctx,cortex,p,i%3===1?C.blue:C.pearl,'pyramidal',.34);}
  pick(ctx,hippocampus,'hippocampal-ensemble','Hippocampal ensemble','Hippocampal activity can coordinate reactivation of distributed cortical representations.','hippocampal-circuit');pick(ctx,cortex,'cortical-ensemble','Distributed cortical representation','Cortical connections and representations can change with learning, sleep and reactivation.','cortical-circuit');
  for(let i=0;i<5;i++){const route=ctx.tube([left[i],left[i].clone().lerp(right[i+2],.5).add(V(0,.3,.5)),right[i+2]],.019,C.teal,ctx.root,.7,45);train(ctx,route.curve,C.amber,2,ctx.root,{start:3,end:13,duration:20,radius:.045});}
  for(let i=0;i<right.length-1;i++){const route=ctx.tube([right[i],right[i].clone().lerp(right[i+1],.5).add(V(0,.18,.25)),right[i+1]],.026,C.blue,ctx.root,.75,25);ctx.animate(t=>{(route.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity=.04+ease((phase(t,20)-7)/10)*.45;});pick(ctx,route.mesh,`consolidating-link-${i}`,'Changing cortical interaction','Enhanced local coordination is illustrative; this model is not an anatomical engram map.',undefined,1);}
  caption(ctx,'Hippocampal coordination',hippocampus,V(0,1.65),0,4);caption(ctx,'Cortical reorganization',cortex,V(0,1.65),0,4);caption(ctx,'Multiple scales · multiple time courses',ctx.root,V(0,-2.1),0,3);
  ctx.status('Original systems-consolidation schematic · ensemble locations, replay, connectivity and time are illustrative; not a mapped human memory.');
  narrative(ctx,[[0,'Encoding binds distributed activity','A hippocampal ensemble interacts with distributed cortical representations.'],[3,'Reactivation','Patterns can be reactivated during offline states as well as behavior.'],[8,'Connections change','Reactivation and synaptic mechanisms help reorganize network interactions.'],[15,'Longer-term organization','The role of hippocampus and cortex varies with memory type, detail and time; complete hippocampal independence is not implied.']],20);
}
