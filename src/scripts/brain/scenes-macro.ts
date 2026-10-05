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
    const lemniscus=info.id.startsWith('medial-lemniscus-');
    const label=lemniscus?`Composite ascending somatosensory estimate · ${info.hemisphere}`:info.name;
    const limitation=lemniscus?' The source ML-labeled reconstruction includes a cortical extension; it is not one uninterrupted medial-lemniscus axon through the thalamic relay.':'';
    ctx.pick(group,{id:info.id,label,description:`${info.streamlineCount} sampled HCP1065 diffusion streamlines; estimated pathways, not counted axons.${limitation}`,topicId,childTopic:all&&topicId!=='white-matter'?topicId:'myelin',level:0,maxLevel:3,kind:'measured tractography',priority:4});
    ctx.label(label,group,center(info.bounds),{minDetail:all?1:0,maxDetail:3,priority:all?1:4});
    ctx.separable(group,V(info.hemisphere==='left'?-.4:info.hemisphere==='right'?.4:0,.12,0));
  });
  const caveat=topic.id==='dorsal-column'?'ML-labeled somatosensory projection includes a cortical extension; no uninterrupted axon through the thalamic relay, spinal dorsal-column or decussation geometry is implied.':'Population tractography estimates pathways; line direction and count do not represent signaling direction or axon number.';
  const status=`HCP1065 · ${chosen.reduce((n,b)=>n+b.streamlineCount,0).toLocaleString()} sampled streamlines · ${caveat}`;
  return status;
}
type RegionalMesh=AtlasMesh&{regionId:string;topicIds:string[];sourceLabelName:string;sourceVoxelCount:number;centroid:number[];atlasStructureIds:number[]};
type RegionalAtlas={metadata:unknown;meshes:RegionalMesh[]};
const regionSelections:Record<string,string[]>={
  'brain-overview':['hippocampal-head','hippocampal-body','hippocampal-tail','thalamus-pulvinar','thalamus-mediodorsal','amygdala-basolateral','hypothalamus-mammillary','red-nucleus','substantia-nigra'],
  'corpus-callosum':['anterior-commissure'],
  'association-fibers':['superior-frontal-gyrus','supramarginal-gyrus','angular-gyrus','superior-temporal-gyrus','parahippocampal-anterior','parahippocampal-posterior'],
};
const regionDescriptions:Record<string,string>={
  'hippocampal-head':'Anterior longitudinal portion of the hippocampus; not a CA or dentate subfield.',
  'hippocampal-body':'Middle longitudinal portion of the hippocampus; not a CA or dentate subfield.',
  'hippocampal-tail':'Posterior longitudinal portion of the hippocampus; not a CA or dentate subfield.',
  'hypothalamus-supraoptic-region':'Source-defined supraoptic region; broader than the supraoptic nucleus.',
  'cerebellar-deep-nuclei':'Combined deep-nuclear parcellation; the source does not separate dentate, interposed and fastigial nuclei.',
  'thalamus-vpl':'Ventral posterior lateral thalamic nucleus, a body somatosensory relay. No spinal portion is fabricated.',
  'thalamus-lgn':'Dorsal lateral geniculate nucleus. The full surrounding thalamus is not mislabeled as LGN.',
  'precentral-gyrus':'Measured precentral gyrus; a gross anatomical gyrus, not an exact functional motor-area border.',
  'postcentral-gyrus':'Measured postcentral gyrus; a gross anatomical gyrus, not a cytoarchitectonic parcel.',
  'cuneus':'Medial occipital gyrus superior to the calcarine sulcus; not identical to all of primary visual cortex.',
  'lingual-gyrus':'Medial occipital gyrus inferior to the calcarine sulcus; not identical to all of primary visual cortex.',
  'optic-radiation-volume':'Atlas-labeled optic-radiation volume, distinct from diffusion streamlines.',
  'medulla-pyramidal':'Measured pyramidal part of medulla; not a separate relay neuron or complete spinal corticospinal route.',
};
/** Anatomical regions keep their measured shape, scale and position. A crossing
 * is a trajectory property, never a made-up spherical relay. Connectivity lives
 * in the dedicated cellular circuit lessons, not inferred from adjacent masks. */
function regionalAnatomy(details:RegionalAtlas,atlas:Atlas,topic:BrainTopic,ctx:SceneContext):THREE.Group{
  const group=new THREE.Group();ctx.root.add(group);
  const selected=details.meshes.filter(item=>regionSelections[topic.id]?.includes(item.regionId)||(!regionSelections[topic.id]&&item.topicIds.includes(topic.id)));
  selected.forEach((item,index)=>{
    const mesh=ctx.mesh(geometry(item),ctx.material(palette[Math.floor(index/2)%palette.length],1,.025),group);
    mesh.userData.atlasRegion={id:item.id,sourceIds:item.atlasStructureIds,sourceName:item.sourceLabelName};
    const description=regionDescriptions[item.regionId]||'Named source parcellation in its original anatomical position. Shape comes from annotated voxels, not a generic graph node.';
    const child=item.topicIds[0]==='cerebral-cortex'?'cortical-circuit':childFor[item.topicIds[0]]||'neuron';
    ctx.pick(mesh,{id:item.id,label:item.name,description:`${description} Allen 2020 label ${item.atlasStructureIds.join(', ')}.`,topicId:item.topicIds[0],childTopic:child,level:0,maxLevel:3,kind:'measured atlas region',priority:6});
    // Labels have a source-mask centroid; collision/occlusion is handled by the renderer.
    const cerebellarExterior=topic.id==='cerebellum'&&item.regionId==='cerebellar-hemisphere';
    ctx.label(item.name,mesh,V(...item.centroid as [number,number,number]).multiplyScalar(SCALE),{minDetail:index<4||cerebellarExterior?0:1,maxDetail:3,priority:cerebellarExterior?4:3});
    ctx.separable(mesh,center(item.bounds).normalize().multiplyScalar(.3));
  });
  const extra:Record<string,string[]>={
    'corpus-callosum':['corpus-callosum'],
    'white-matter':['corpus-callosum','fornix'],
  };
  for(const id of extra[topic.id]||[]){
    const item=atlas.meshes.find(item=>item.id===id);if(!item)continue;
    const mesh=ctx.mesh(geometry(item),ctx.material(tissueColors[id]||0xc8d6cb),group);
    mesh.userData.atlasRegion={id,sourceIds:(item as AtlasMesh&{atlasStructureIds:number[]}).atlasStructureIds};
    ctx.pick(mesh,{id:`regional-${id}`,label:item.name,description:'Atlas-labeled white-matter volume. Volume shape does not measure individual axons.',topicId:topicFor[id]||id,childTopic:'myelin',kind:'measured atlas region',level:0,maxLevel:3,priority:5});
    ctx.label(item.name,mesh,center(item.bounds),{minDetail:0,maxDetail:3,priority:4});
  }
  return group;
}
function axonInset(topic:BrainTopic,ctx:SceneContext):THREE.Group{
  const group=new THREE.Group();ctx.root.add(group);
  const axon=ctx.link(V(-1.5,0,0),V(1.5,0,0),.09,0xd6c991,group);
  ctx.pick(axon,{id:`${topic.id}-axon`,label:'Axon membrane',description:'Enlarged schematic axon; no claim of microscopic continuity with a displayed streamline.',childTopic:'neuron',level:0,maxLevel:3,kind:'schematic cell',priority:5});
  for(let i=0;i<5;i++){
    const x=-1.2+i*.6,sleeve=ctx.mesh(new THREE.CylinderGeometry(.13,.13,.46,24,1,true),ctx.material(0x9ecbbd,.85),group);sleeve.rotation.z=Math.PI/2;sleeve.position.x=x;
    ctx.pick(sleeve,{id:`${topic.id}-myelin-${i}`,label:'Myelin internode',description:'Oligodendrocyte wrapping shown schematically; fibers are not individually reconstructed axons.',childTopic:'myelin',level:0,maxLevel:3,kind:'schematic cell',priority:6});
    for(const end of [-1,1])for(let layer=0;layer<4;layer++){
      const wrap=ctx.mesh(new THREE.TorusGeometry(.096+layer*.01,.004,5,24),ctx.material(0xadcfc3),group);
      wrap.rotation.y=Math.PI/2;wrap.position.x=x+end*.23;ctx.detail(wrap,1);
    }
    if(i<4){
      // A node is the exposed cylindrical axonal membrane between myelin
      // internodes, not a swollen bead or a separate neuronal cell body.
      const node=ctx.mesh(new THREE.CylinderGeometry(.094,.094,.14,24,1,true),ctx.material(0xe6ad80),group);
      node.rotation.z=Math.PI/2;node.position.x=x+.3;
      ctx.pick(node,{id:`${topic.id}-node-${i}`,label:'Node of Ranvier',description:'Exposed axonal membrane between myelin internodes; enriched in voltage-gated sodium channels. The axon remains continuous through the gap.',childTopic:'sodium-channel',level:0,maxLevel:3,kind:'schematic membrane',priority:7});
      for(let j=0;j<8;j++){
        const angle=j*Math.PI/4,channel=ctx.mesh(new THREE.TorusGeometry(.013,.004,5,8),ctx.material(0xc7b6df),group);
        channel.position.set(x+.3,.096*Math.cos(angle),.096*Math.sin(angle));
        channel.quaternion.setFromUnitVectors(V(0,0,1),V(0,Math.cos(angle),Math.sin(angle)));
        ctx.detail(channel,2);
      }
    }
  }
  ctx.label('Myelinated axon · microscopic schematic, not a measured streamline',group,V(0,.7,0),{minDetail:0,maxDetail:3,priority:7});
  const pulse=ctx.ball(V(-1.45,.08,0),.055,0xf7db91,group);
  ctx.animate(time=>{pulse.position.x=-.9+Math.floor((time%2)/.5)*.6;});
  return group;
}
export async function buildMacroScene(topic:BrainTopic,ctx:SceneContext):Promise<void>{
  ctx.status('Loading measured reference anatomy…');
  const atlas=await load<Atlas>('/brain/models/atlas.json');if(!ctx.isCurrent())return;
  // HCP2009a and Allen2009b are different templates. Do not visually imply
  // an exact registration by superimposing unrelated anatomy on tractography.
  if(topic.scene!=='tracts')anatomy(atlas,topic,ctx);
  let measuredStatus='';
  if(topic.scene==='tracts')measuredStatus=await fibers(topic,ctx);
  else{
    const representation=['brain-overview','cerebral-cortex'].includes(topic.id)?'continuous 0.5 mm-derived cerebral exterior':'isolated measured reference parcellation';
    measuredStatus=`Allen Human Reference Atlas 2020 · ${representation} · ${topic.title}. Cells and circuits are separate teaching schematics.`;
  }
  if(!ctx.isCurrent())return;
  // Explicit source representations; zoom never replaces anatomy with a diagram.
  const measured=new THREE.Group();for(const child of [...ctx.root.children])measured.add(child);ctx.root.add(measured);
  const details=await load<RegionalAtlas>('/brain/models/atlas-details.json');if(!ctx.isCurrent())return;
  const regions=regionalAnatomy(details,atlas,topic,ctx);
  const dorsal=topic.id==='dorsal-column';
  const registerRegions=()=>ctx.representation(regions,{id:'regions',label:dorsal?'Relay anatomy':'Regional anatomy',description:dorsal?'Measured VPL thalamic nuclei and postcentral gyri. These source regions locate the thalamic relay and cortical destination; the spinal pathway is not supplied.':'Named human atlas regions in their original coordinates. Select each measured shape to identify it.',status:dorsal?'Allen reference anatomy · VPL relay and postcentral gyri · no invented spinal tract, crossing or continuous axon through the relay.':'Allen Human Reference Atlas 2020 · atlas-derived parcellations · surfaces smoothed and simplified; original coordinate frame retained.',scale:'Reference anatomy · mm',narrative:null});
  // The HCP ML entry contains a cortical continuation. Accurate named relay
  // regions are the default; the composite estimate is an explicit alternative.
  if(dorsal)registerRegions();
  ctx.representation(measured,{id:'measured',label:dorsal?'Composite tract estimate':topic.scene==='tracts'?'Tractography':'Anatomy',description:dorsal?'Composite estimated ascending somatosensory streamlines from the HCP ML source label. Includes cortical continuation; not exact medial-lemniscus anatomy or an uninterrupted axon through VPL.':topic.scene==='tracts'?'Estimated white-matter pathways from HCP1065 diffusion MRI. Streamlines are not individual axons.':'Measured reference parcellations from Allen Human Reference Atlas 2020.',status:measuredStatus,narrative:null});
  if(!dorsal)registerRegions();
  const axon=axonInset(topic,ctx);
  ctx.representation(axon,{id:'axon',label:'Axon schematic',description:'A myelinated axon with internodes and nodes of Ranvier. This is a separate microscopic teaching model.',status:'Axon schematic · myelin and nodes of Ranvier; no measured continuity with an atlas region or streamline.',scale:'Schematic',narrative:null});
}
