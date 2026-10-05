import * as THREE from 'three';
import type { BrainTopic, SceneContext } from './scene-types';

type Region={id:string;name:string;kind:string};
type AtlasMesh={id:string;name:string;kind:string;hemisphere:string;positions:number[];indices:number[];bounds:number[][];faceRegions?:number[];regions?:Region[]};
type Atlas={metadata:{coordinates:{centerSourceRAS:number[]}};meshes:AtlasMesh[]};
type BundleInfo={id:string;name:string;category:string;hemisphere:string;topicIds:string[];bounds:number[][];file:string;streamlineCount:number};
type Manifest={bundles:BundleInfo[];streamlineCount:number};
type Bundle={positions:number[];offsets:number[]};
const SCALE=.045;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const palette=[0xd9b6ab,0xc1c7ab,0xadafcf,0xa2c4c9,0xd2b19b,0xc2abbf];
const tissueColors:Record<string,number>={hippocampus:0xe5be6b,amygdala:0xe49b90,thalamus:0x9bc6dd,hypothalamus:0xebba7a,caudate:0xa6cbb9,putamen:0xb0c99b,'globus-pallidus':0xc4b998,cerebellum:0xb8cad5,midbrain:0x90b8c0,pons:0xaac3ba,medulla:0xbacdb5,'corpus-callosum':0xefdfa1,fornix:0xc7b9e9,'cerebellar-peduncles':0x8bd3bd,'white-matter-left':0xd6e2db,'white-matter-right':0xd6e2db,ventricles:0x6da9c6};
const tractColors:Record<string,number>={commissural:0xe9cf86,projection:0x98c7ed,sensory:0xceade4,association:0x81d4bf,limbic:0xe5af94,cerebellar:0x98c8b5};
const childFor:Record<string,string>={hippocampus:'hippocampal-circuit',cerebellum:'cerebellar-circuit','cerebral-cortex':'cortical-circuit',thalamus:'neuron',hypothalamus:'synaptic-release',amygdala:'synaptic-integration',brainstem:'resting-potential'};
const topicFor:Record<string,string>={caudate:'basal-ganglia',putamen:'basal-ganglia','globus-pallidus':'basal-ganglia',fornix:'white-matter','cerebellar-peduncles':'white-matter','white-matter-left':'white-matter','white-matter-right':'white-matter',ventricles:'brain-overview'};
const cache=new Map<string,Promise<unknown>>();
async function load<T>(path:string):Promise<T>{
  if(!cache.has(path))cache.set(path,fetch(path).then(response=>{if(!response.ok)throw new Error(`Model ${response.status}`);return response.json();}).catch(error=>{cache.delete(path);throw error;}));
  return await cache.get(path) as T;
}
function center(bounds:number[][]):THREE.Vector3{return V(...bounds[0] as [number,number,number]).add(V(...bounds[1] as [number,number,number])).multiplyScalar(SCALE/2);}
function geometry(item:AtlasMesh):THREE.BufferGeometry{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(item.positions.map(p=>p*SCALE),3));g.setIndex(item.indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
/** Split only exterior triangles. Shared original normals keep lobe seams smooth. */
function exteriorRegions(item:AtlasMesh):{region:Region;geometry:THREE.BufferGeometry}[]{
  const full=geometry(item),p=full.getAttribute('position'),n=full.getAttribute('normal');
  const result=(item.regions||[]).map((region,index)=>{
    const positions:number[]=[],normals:number[]=[];
    for(let f=0;f<item.indices.length/3;f++)if(item.faceRegions?.[f]===index){
      for(let c=0;c<3;c++){const i=item.indices[f*3+c];positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingSphere();return{region,geometry:g};
  });full.dispose();return result;
}
function relevant(item:AtlasMesh,id:string):boolean{
  return id==='brain-overview'||(id==='cerebral-cortex'&&item.kind==='shell')||(id==='brainstem'&&item.kind==='brainstem')||item.id===id;
}
/** A real exterior face, chosen toward the regional outward direction.
 * Bounding-box centers lie inside the brain and make hidden labels look visible. */
function exteriorLabelAnchor(g:THREE.BufferGeometry):{point:THREE.Vector3;normal:THREE.Vector3}|null{
  const positions=g.getAttribute('position'),normals=g.getAttribute('normal');
  if(positions.count<3)return null;
  g.computeBoundingBox();
  const regionalCenter=g.boundingBox!.getCenter(V()),direction=regionalCenter.clone().normalize();
  const a=V(),b=V(),c=V(),normal=V(),nb=V(),nc=V(),point=V(),radial=V();
  let front=-Infinity;
  for(let i=0;i<positions.count;i+=3){
    a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);
    point.copy(a).add(b).add(c).multiplyScalar(1/3);
    normal.fromBufferAttribute(normals,i).add(nb.fromBufferAttribute(normals,i+1)).add(nc.fromBufferAttribute(normals,i+2)).normalize();
    if(normal.dot(direction)>.45&&normal.dot(radial.copy(point).normalize())>.35)front=Math.max(front,point.dot(direction));
  }
  if(!Number.isFinite(front))return null;
  const tolerance=g.boundingBox!.getSize(V()).length()*.12;
  let best=Infinity,anchor:{point:THREE.Vector3;normal:THREE.Vector3}|null=null;
  for(let i=0;i<positions.count;i+=3){
    a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);
    point.copy(a).add(b).add(c).multiplyScalar(1/3);
    normal.fromBufferAttribute(normals,i).add(nb.fromBufferAttribute(normals,i+1)).add(nc.fromBufferAttribute(normals,i+2)).normalize();
    if(normal.dot(direction)<=.45||normal.dot(radial.copy(point).normalize())<=.35||point.dot(direction)<front-tolerance)continue;
    const score=point.distanceToSquared(regionalCenter);
    if(score<best){best=score;anchor={point:point.clone(),normal:normal.clone()};}
  }
  return anchor;
}
function anatomy(atlas:Atlas,topic:BrainTopic,ctx:SceneContext):void{
  if(topic.id==='optic-radiation')return;
  const overview=topic.id==='brain-overview',cortex=topic.id==='cerebral-cortex',tracts=topic.scene==='tracts';
  const isolated=!overview&&!cortex&&!tracts;
  for(const item of atlas.meshes){
    if(item.kind==='shell'){
      if(isolated||topic.id==='optic-radiation')continue;
      const group=new THREE.Group();ctx.root.add(group);ctx.separable(group,V(item.hemisphere==='left'?-1.4:1.4,0,0));
      const opacity=tracts?.055:overview||cortex?1:.075;
      for(const {region,geometry:g}of exteriorRegions(item)){
        const index=(item.regions||[]).findIndex(r=>r.id===region.id),color=palette[index%palette.length];
        const mesh=ctx.mesh(g,ctx.material(opacity<.2?0xaab9bf:color,opacity),group);
        mesh.userData.contextOnly=opacity<.2;
        ctx.pick(mesh,{id:region.id,label:region.name,description:'Allen atlas exterior; lobe boundary assigned from the nearest cortical label.',topicId:'cerebral-cortex',childTopic:overview?'cerebral-cortex':'cortical-circuit',level:0,maxLevel:3,kind:'measured atlas',priority:2});
        if(!tracts&&opacity>=.2&&/^(frontal|parietal|temporal|occipital)-/.test(region.id)){const anchor=exteriorLabelAnchor(g);if(anchor)ctx.label(region.name.replace(' · ',' — '),mesh,anchor.point,{normal:anchor.normal,minDetail:index===0?0:1,maxDetail:3,priority:index===0?3:1});}
      }
      continue;
    }
    const selected=relevant(item,topic.id),external=item.kind==='cerebellum'||item.kind==='brainstem';
    if(isolated&&!selected)continue;
    if(cortex&&!external)continue;
    if(tracts&&!external&&item.id!=='thalamus'&&item.id!=='hippocampus')continue;
    if(item.kind==='white-matter'&&!selected&&!overview)continue;
    if(item.kind==='ventricle'&&!overview)continue;
    const opacity=tracts?(external?.14:.07):selected?1:overview?(external?1:.7):.13;
    const mesh=ctx.mesh(geometry(item),ctx.material(tissueColors[item.id]||0xb9c9ce,opacity,.035));
    mesh.userData.contextOnly=tracts||!selected;
    const target=item.kind==='brainstem'?'brainstem':topicFor[item.id]||item.id;
    const child=overview?target:childFor[target]||'neuron';
    ctx.pick(mesh,{id:item.id,label:item.name,description:'Measured reference parcellation from Allen Human Reference Atlas 2020.',topicId:target,childTopic:child,level:0,maxLevel:3,kind:'measured atlas',priority:selected?5:1});
    if(isolated&&selected)ctx.label(item.name,mesh,center(item.bounds),{minDetail:0,maxDetail:3,priority:5});
    ctx.separable(mesh,center(item.bounds).normalize().multiplyScalar(.45));
  }
}
function bundleGeometry(bundle:Bundle,color:number,step=1):THREE.BufferGeometry{
  const points:number[]=[],colors:number[]=[],base=new THREE.Color(color);
  for(let s=0;s<bundle.offsets.length-1;s+=step){
    for(let i=bundle.offsets[s];i<bundle.offsets[s+1]-1;i++){
      const j=i*3,k=j+3,dx=bundle.positions[k]-bundle.positions[j],dy=bundle.positions[k+1]-bundle.positions[j+1],dz=bundle.positions[k+2]-bundle.positions[j+2];
      const d=Math.hypot(dx,dy,dz)||1;
      // Direction colors follow RAS convention: red LR, green AP, blue SI.
      const tint=base.clone().lerp(new THREE.Color(Math.abs(dx)/d,Math.abs(dz)/d,Math.abs(dy)/d),.25);
      for(const offset of[j,k]){points.push(bundle.positions[offset]*SCALE,bundle.positions[offset+1]*SCALE,bundle.positions[offset+2]*SCALE);colors.push(tint.r,tint.g,tint.b);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();return g;
}
async function fibers(topic:BrainTopic,ctx:SceneContext):Promise<string>{
  const manifest=await load<Manifest>('/brain/models/tracts/manifest.json');if(!ctx.isCurrent())return '';
  const all=topic.id==='white-matter';
  const chosen=manifest.bundles.filter(bundle=>all||bundle.topicIds.includes(topic.id));
  const payloads=await Promise.all(chosen.map(bundle=>load<Bundle>(bundle.file)));if(!ctx.isCurrent())return '';
  chosen.forEach((info,index)=>{
    const group=new THREE.Group();ctx.root.add(group);const g=bundleGeometry(payloads[index],tractColors[info.category]||0xc0ded5);
    const line=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:all?.7:.9,depthWrite:false}));group.add(line);
    const topicId=info.topicIds.find(id=>['corpus-callosum','corticospinal','dorsal-column','optic-radiation','association-fibers'].includes(id))||'white-matter';
    ctx.pick(group,{id:info.id,label:info.name,description:`${info.streamlineCount} sampled HCP1065 diffusion streamlines; estimated pathways, not counted axons.`,topicId,childTopic:all&&topicId!=='white-matter'?topicId:'myelin',level:0,maxLevel:3,kind:'measured tractography',priority:4});
    ctx.label(info.name,group,center(info.bounds),{minDetail:all?1:0,maxDetail:3,priority:all?1:4});
    ctx.separable(group,V(info.hemisphere==='left'?-.4:info.hemisphere==='right'?.4:0,.12,0));
  });
  const caveat=topic.id==='dorsal-column'?'Measured medial lemniscus covers the brain portion. Spinal dorsal columns and their medullary crossing are shown in Circuit schematic.':'Population tractography estimates pathways; line direction and count do not represent signaling direction or axon number.';
  const status=`HCP1065 · ${chosen.reduce((n,b)=>n+b.streamlineCount,0).toLocaleString()} sampled streamlines · ${caveat}`;
  return status;
}
type Node={id:string;label:string;position:THREE.Vector3;color?:number;child?:string};
/** Functional topology, deliberately separate from the measured millimetre frame. */
function circuitInset(topic:BrainTopic,ctx:SceneContext):THREE.Group{
  const group=new THREE.Group();ctx.root.add(group);
  let nodes:Node[]=[],edges:number[][]=[],caption='Functional circuit schematic · enlarged, positions illustrative';
  const node=(id:string,label:string,x:number,y:number,z=0,child='neuron'):Node=>({id,label,position:V(x,y,z),child});
  switch(topic.id){
    case 'hippocampus':nodes=[node('ec','Entorhinal cortex',-1.2,.65,0,'hippocampal-circuit'),node('dg','Dentate gyrus',-.8,-.3),node('ca3','CA3',.1,-.65),node('ca1','CA1',1,.2),node('subiculum','Subiculum',.7,.9)];edges=[[0,1],[1,2],[2,3],[3,4],[0,3]];break;
    case 'cerebellum':nodes=[node('mossy','Mossy fiber',-1.2,-.75,0,'cerebellar-circuit'),node('granule','Granule cell',-.55,-.3),node('purkinje','Purkinje cell',.2,.6,0,'cerebellar-circuit'),node('deep','Deep nucleus',1,-.6),node('climbing','Climbing fiber',-1,.85)];edges=[[0,1],[1,2],[2,3],[0,3],[4,2],[4,3]];break;
    case 'amygdala':nodes=[node('sensory','Sensory input',-1,.8),node('bla','Basolateral complex',-.4,.1,0,'synaptic-integration'),node('itc','Intercalated cells',.3,.55,0,'gaba'),node('cea','Central amygdala',.8,-.2),node('output','Autonomic / behavioral output',.3,-.85)];edges=[[0,1],[1,3],[1,2],[2,3],[3,4]];break;
    case 'thalamus':nodes=[node('input','Driver input',-1,-.55),node('relay','Thalamic relay',0,.1),node('cortex','Cortex',1,.85,0,'cortical-circuit'),node('trn','Reticular nucleus',.9,-.65,0,'gaba')];edges=[[0,1],[1,2],[2,1],[2,3],[3,1]];break;
    case 'hypothalamus':nodes=[node('input','Homeostatic inputs',-1,.85),node('hypo','Hypothalamic neurons',0,.35,0,'synaptic-release'),node('auto','Autonomic output',-1,-.7),node('pit','Pituitary control',1,-.7,0,'neuropeptides')];edges=[[0,1],[1,2],[1,3]];break;
    case 'brainstem':nodes=[node('midbrain','Midbrain circuits',-.6,.95),node('pons','Pontine circuits',.6,.15),node('medulla','Medullary circuits',-.3,-.65),node('cord','Spinal pathways',.7,-1.1,0,'corticospinal')];edges=[[0,1],[1,2],[2,3]];caption='Brainstem pathway scaffold · schematic, not a measured nucleus map';break;
    case 'dorsal-column':nodes=[node('dorsal','Ipsilateral dorsal column',-.85,-1),node('nuclei','Gracile / cuneate nuclei',-.85,-.2),node('cross','Internal arcuate crossing',0,.15),node('ml','Contralateral medial lemniscus',.85,.45),node('vpl','VPL thalamus',.85,1)];edges=[[0,1],[1,2],[2,3],[3,4]];caption='Dorsal column → medial lemniscus schematic · body pathway crosses in medulla';break;
    case 'corticospinal':nodes=[node('motor','Motor cortex',-.75,1,0,'cortical-circuit'),node('pyramid','Medullary pyramids',-.75,.1),node('cross','Pyramidal decussation',0,-.4),node('lcst','Lateral corticospinal tract',.75,-.8),node('motor-neuron','Spinal motor circuits',1,-1.2)];edges=[[0,1],[1,2],[2,3],[3,4]];caption='Major corticospinal route schematic · most fibers cross in caudal medulla';break;
    case 'optic-radiation':nodes=[node('lgn','Lateral geniculate nucleus',-1,0,0,'thalamus'),node('meyer','Temporal loop',-.3,-.75),node('dorsal-or','Dorsal radiation',-.1,.7),node('v1','Primary visual cortex',1,0,0,'cortical-circuit')];edges=[[0,1],[0,2],[1,3],[2,3]];caption='Geniculocalcarine routing schematic · measured bundle available in Tractography';break;
    case 'corpus-callosum':nodes=[node('left-cortex','Left cortex',-1,.25,0,'cortical-circuit'),node('cc','Callosal axons',0,0,0,'myelin'),node('right-cortex','Right cortex',1,.25,0,'cortical-circuit')];edges=[[0,1],[1,2]];caption='Interhemispheric connection schematic · many heterogeneous axons';break;
    case 'association-fibers':nodes=[node('frontal','Frontal cortex',-1,.75,0,'cortical-circuit'),node('parietal','Parietal cortex',1,.65,0,'cortical-circuit'),node('temporal','Temporal cortex',-.75,-.65,0,'cortical-circuit'),node('occipital','Occipital cortex',1,-.65,0,'cortical-circuit')];edges=[[0,1],[0,2],[2,3]];caption='Association pathways schematic · arcs denote routes, not measured positions';break;
    case 'white-matter':nodes=[node('commissural','Commissural fibers',-1,.8,0,'corpus-callosum'),node('projection','Projection fibers',1,.8,0,'corticospinal'),node('association','Association fibers',-1,-.65,0,'association-fibers'),node('myelin','Myelinated axons',1,-.65,0,'myelin')];edges=[[0,3],[1,3],[2,3]];caption='White-matter organization schematic · pathway classes and microscopic substrate';break;
    default:
      for(let layer=1;layer<=6;layer++)nodes.push(node(`layer-${layer}`,`Cortical layer ${['I','II','III','IV','V','VI'][layer-1]}`,layer%2?.45:-.45,1.1-(layer-1)*.43,0,layer===5?'corticospinal':'cortical-circuit'));
      edges=[[1,2],[3,1],[2,4],[4,5]];caption='Six neocortical layers · schematic column, expanded beyond atlas resolution';
  }
  nodes.forEach((n,i)=>{const ball=ctx.ball(n.position,.16,i===nodes.length-1?0xe6be82:0xa2d9cb,group);ctx.pick(ball,{id:`${topic.id}-${n.id}`,label:n.label,description:'Schematic functional element; position and size are illustrative.',childTopic:n.child,level:0,maxLevel:3,kind:'schematic mechanism',priority:6});ctx.label(n.label,ball,V(),{minDetail:0,maxDetail:3,priority:4});});
  edges.forEach(([a,b])=>ctx.link(nodes[a].position,nodes[b].position,.025,0x8dbcb6,group,.7));
  ctx.label(caption,group,V(0,1.65,0),{minDetail:0,maxDetail:3,priority:7});
  return group;
}
function axonInset(topic:BrainTopic,ctx:SceneContext):THREE.Group{
  const group=new THREE.Group();ctx.root.add(group);
  const axon=ctx.link(V(-1.5,0,0),V(1.5,0,0),.09,0xd6c991,group);
  ctx.pick(axon,{id:`${topic.id}-axon`,label:'Axon membrane',description:'Enlarged schematic axon; no claim of microscopic continuity with a displayed streamline.',childTopic:'neuron',level:0,maxLevel:3,kind:'schematic cell',priority:5});
  for(let i=0;i<5;i++){
    const x=-1.2+i*.6,sleeve=ctx.mesh(new THREE.CylinderGeometry(.24,.24,.46,20,1,true),ctx.material(0x9ecbbd,.85),group);sleeve.rotation.z=Math.PI/2;sleeve.position.x=x;
    ctx.pick(sleeve,{id:`${topic.id}-myelin-${i}`,label:'Myelin internode',description:'Oligodendrocyte wrapping shown schematically; fibers are not individually reconstructed axons.',childTopic:'myelin',level:0,maxLevel:3,kind:'schematic cell',priority:6});
    if(i<4){const node=ctx.ball(V(x+.3,0,0),.115,0xe6ad80,group);ctx.pick(node,{id:`${topic.id}-node-${i}`,label:'Node of Ranvier',childTopic:'sodium-channel',level:0,maxLevel:3,kind:'schematic membrane',priority:7});}
  }
  ctx.label('Myelinated axon · microscopic schematic, not a measured streamline',group,V(0,.7,0),{minDetail:0,maxDetail:3,priority:7});
  const pulse=ctx.ball(V(-1.45,.08,0),.055,0xf7db91,group);
  ctx.animate(time=>{pulse.position.x=-.9+Math.floor((time%2)/.5)*.6;});
  return group;
}
export async function buildMacroScene(topic:BrainTopic,ctx:SceneContext):Promise<void>{
  ctx.status('Loading measured reference anatomy…');
  const atlas=await load<Atlas>('/brain/models/atlas.json');if(!ctx.isCurrent())return;
  anatomy(atlas,topic,ctx);
  let measuredStatus='';
  if(topic.scene==='tracts')measuredStatus=await fibers(topic,ctx);
  else{
    const representation=['brain-overview','cerebral-cortex'].includes(topic.id)?'continuous 0.5 mm-derived cerebral exterior':'isolated measured reference parcellation';
    measuredStatus=`Allen Human Reference Atlas 2020 · ${representation} · ${topic.title}. Cells and circuits are separate teaching schematics.`;
  }
  if(!ctx.isCurrent())return;
  // The three representations are explicit choices; zoom never replaces them.
  // Diagram coordinates remain illustrative rather than claiming one specimen.
  const measured=new THREE.Group();for(const child of [...ctx.root.children])measured.add(child);ctx.root.add(measured);
  ctx.representation(measured,{id:'measured',label:topic.scene==='tracts'?'Tractography':'Anatomy',description:topic.scene==='tracts'?'Estimated white-matter pathways from HCP1065 diffusion MRI. Streamlines are not individual axons.':'Measured reference parcellations from Allen Human Reference Atlas 2020.',status:measuredStatus,narrative:null});
  const circuit=circuitInset(topic,ctx);
  ctx.representation(circuit,{id:'circuit',label:'Circuit schematic',description:'Functional connections drawn as a diagram. Node positions and sizes are illustrative.',status:'Circuit schematic · functional connections; positions and sizes are illustrative.',scale:'Schematic',narrative:null});
  const axon=axonInset(topic,ctx);
  ctx.representation(axon,{id:'axon',label:'Axon schematic',description:'A myelinated axon with internodes and nodes of Ranvier. This is a separate microscopic teaching model.',status:'Axon schematic · myelin and nodes of Ranvier; no measured continuity with an atlas region or streamline.',scale:'Schematic',narrative:null});
}
