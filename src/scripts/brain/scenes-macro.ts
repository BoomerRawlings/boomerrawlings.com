import * as THREE from 'three';
import type { BrainTopic, SceneContext } from './scene-types';

type Region={id:string;name:string;kind:string};
type AtlasMesh={id:string;name:string;kind:string;hemisphere:string;positions:number[];indices:number[];bounds:number[][];faceRegions?:number[];regions?:Region[]};
type Atlas={metadata:{coordinates:{centerSourceRAS:number[]}};meshes:AtlasMesh[]};
type BundleInfo={id:string;name:string;category:string;hemisphere:string;topicIds:string[];bounds:number[][];file:string;streamlineCount:number};
type Manifest={bundles:BundleInfo[];streamlineCount:number};
type Bundle={positions:number[];offsets:number[]};
type ReferencePlane={id:string;sourceAxis:string;sourceLevelMm:number;positions:number[];indices:number[];intensities:number[];bounds:number[][]};
type ReferenceMRI={metadata:{template:string};planes:ReferencePlane[]};
type LandmarkAtlas={meshes:(AtlasMesh&{topicIds:string[];atlasStructureIds:number[]})[]};
const SCALE=.045;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const palette=[0xd9b6ab,0xc1c7ab,0xadafcf,0xa2c4c9,0xd2b19b,0xc2abbf];
const tissueColors:Record<string,number>={hippocampus:0xe5be6b,amygdala:0xe49b90,thalamus:0x9bc6dd,hypothalamus:0xebba7a,caudate:0xa6cbb9,putamen:0xb0c99b,'globus-pallidus':0xc4b998,cerebellum:0xb8cad5,midbrain:0x90b8c0,pons:0xaac3ba,medulla:0xbacdb5,'corpus-callosum':0xefdfa1,fornix:0xc7b9e9,'cerebellar-peduncles':0x8bd3bd,'white-matter-left':0xd6e2db,'white-matter-right':0xd6e2db,ventricles:0x6da9c6};
const tractColors:Record<string,number>={commissural:0xe9cf86,projection:0x98c7ed,sensory:0xceade4,association:0x81d4bf,limbic:0xe5af94,cerebellar:0x98c8b5};
const bundleColors:Record<string,number>={'arcuate':0xe6a093,'uncinate':0x82d4ba,'inferior-longitudinal':0xe1c775,'superior-longitudinal':0x83bcec,'cingulum':0xc5a1df,'cingulum-temporal':0xe3ae81};
// Named related circuits are useful next lessons; generic microscopic models
// are not anatomical children of arbitrary thalamic or brainstem structures.
const childFor:Record<string,string>={hippocampus:'hippocampal-circuit',cerebellum:'cerebellar-circuit','cerebral-cortex':'cortical-circuit'};
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
const rightOblique=V(1,.18,.3).normalize();
function tractDirection(id:string):[number,number,number]{return id==='corticospinal'?[.08,.06,1]:id==='optic-radiation'?[0,1,-.12]:[1,.08,.06];}
function regionDirection(id:string):THREE.Vector3{return ['thalamus','hypothalamus','dorsal-column'].includes(id)?V(.15,.12,1).normalize():id==='cerebellum'?V(.35,.18,-1).normalize():rightOblique;}
/** Rigid display translations only. Native atlas vertices/normals are untouched.
 * Conservative projected bounds keep separated nuclei from remaining stacked.
 * These positions are explicitly illustrative, not new anatomical coordinates. */
function spreadParts(objects:THREE.Object3D[],ctx:SceneContext,direction:THREE.Vector3,gap=.24):void{
  if(objects.length<2)return;
  const right=V().crossVectors(V(0,1,0),direction).normalize(),up=V().crossVectors(direction,right).normalize();
  const parts=objects.map(object=>{
    object.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(object),c=box.getCenter(V());
    let w=0,h=0;
    for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const p=V(x,y,z).sub(c);w=Math.max(w,Math.abs(p.dot(right)));h=Math.max(h,Math.abs(p.dot(up)));}
    return{object,x:c.dot(right),y:c.dot(up),w,h,px:0,py:0};
  });
  const mx=parts.reduce((sum,p)=>sum+p.x,0)/parts.length,my=parts.reduce((sum,p)=>sum+p.y,0)/parts.length;
  parts.forEach(p=>{p.px=mx+(p.x-mx)*1.65;p.py=my+(p.y-my)*1.65;});
  for(let pass=0;pass<96;pass++){
    let collisions=0;
    for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
      const a=parts[i],b=parts[j],dx=b.px-a.px,dy=b.py-a.py;
      const overlapX=a.w+b.w+gap-Math.abs(dx),overlapY=a.h+b.h+gap-Math.abs(dy);
      if(overlapX<=.001||overlapY<=.001)continue;collisions++;
      if(overlapX<overlapY){const move=(overlapX+.006)/2*Math.sign(dx||j-i);a.px-=move;b.px+=move;}
      else{const move=(overlapY+.006)/2*Math.sign(dy||j-i);a.py-=move;b.py+=move;}
    }
    if(!collisions)break;
  }
  parts.forEach(p=>{const offset=right.clone().multiplyScalar(p.px-p.x).addScaledVector(up,p.py-p.y);p.object.userData.explodedLayout={kind:'illustrative separation',direction:direction.toArray(),offset:offset.toArray()};ctx.separable(p.object,offset);});
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
  const wholeParts:THREE.Object3D[]=[];
  for(const item of atlas.meshes){
    if(item.kind==='shell'){
      if(isolated||topic.id==='optic-radiation')continue;
      const group=new THREE.Group();ctx.root.add(group);
      const opacity=tracts?.055:overview||cortex?1:.075;
      for(const {region,geometry:g}of exteriorRegions(item)){
        const index=(item.regions||[]).findIndex(r=>r.id===region.id),color=palette[index%palette.length];
        const mesh=ctx.mesh(g,ctx.material(opacity<.2?0xaab9bf:color,opacity),group);
        // Source exterior surfaces, not invented solid lobe cross-sections.
        (mesh.material as THREE.MeshStandardMaterial).side=THREE.DoubleSide;
        wholeParts.push(mesh);
        mesh.userData.contextOnly=opacity<.2;
        ctx.pick(mesh,{id:region.id,label:region.name,description:'Allen atlas exterior; lobe boundary assigned from the nearest cortical label.',topicId:'cerebral-cortex',childTopic:overview?'cerebral-cortex':'cortical-circuit',level:0,maxLevel:3,kind:'measured atlas',priority:2});
        if(!tracts&&opacity>=.2&&/^(frontal|parietal|temporal|occipital)-/.test(region.id)){const anchor=exteriorLabelAnchor(g);if(anchor)ctx.label(region.name.replace(' · ',' — '),mesh,anchor.point,{normal:anchor.normal,minDetail:0,maxDetail:3,priority:index===0?3:2});}
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
    mesh.userData.atlasRegion={id:item.id,sourceName:item.name};
    mesh.userData.contextOnly=tracts||!selected;
    const target=item.kind==='brainstem'?'brainstem':topicFor[item.id]||item.id;
    const child=overview?target:childFor[target];
    ctx.pick(mesh,{id:item.id,label:item.name,description:'Measured reference parcellation from Allen Human Reference Atlas 2020.',topicId:target,childTopic:child,level:0,maxLevel:3,kind:'measured atlas',priority:selected?5:1});
    if(isolated&&selected)ctx.label(item.name,mesh,center(item.bounds),{minDetail:0,maxDetail:3,priority:5});
    if(overview||cortex)wholeParts.push(mesh);
    else if(item.kind==='brainstem')ctx.separable(mesh,V(0,item.id==='midbrain'?1.5:item.id==='medulla'?-1.9:0,item.id==='pons'?1.8:0));
    else ctx.separable(mesh,center(item.bounds).normalize().multiplyScalar(1.8));
  }
  // Spread every visible source part together, including deep structures and
  // brainstem context, so neither hemisphere's lobes remain hidden in a stack.
  spreadParts(wholeParts,ctx,rightOblique,.45);
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
  const families=new Map<string,THREE.Group>(),bundles:THREE.Group[]=[];
  chosen.forEach((info,index)=>{
    const family=info.id.replace(/-(left|right)$/,'');
    if(!families.has(family)){const familyGroup=new THREE.Group();familyGroup.userData.tractFamily=family;ctx.root.add(familyGroup);families.set(family,familyGroup);}
    const group=new THREE.Group();families.get(family)!.add(group);bundles.push(group);
    const g=bundleGeometry(payloads[index],bundleColors[family]||tractColors[info.category]||0xc0ded5);
    const line=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:all?.7:.9,depthWrite:false}));group.add(line);
    const topicId=info.topicIds.find(id=>['corpus-callosum','corticospinal','dorsal-column','optic-radiation','association-fibers'].includes(id))||'white-matter';
    const lemniscus=info.id.startsWith('medial-lemniscus-');
    const label=lemniscus?`Composite ascending somatosensory estimate · ${info.hemisphere}`:info.name;
    const limitation=lemniscus?' The source ML-labeled reconstruction includes a cortical extension; it is not one uninterrupted medial-lemniscus axon through the thalamic relay.':'';
    ctx.pick(group,{id:info.id,label,description:`${info.streamlineCount} sampled HCP1065 diffusion streamlines; estimated pathways, not counted axons.${limitation}`,topicId,childTopic:all&&topicId!=='white-matter'?topicId:'myelin',level:0,maxLevel:3,kind:'measured tractography',priority:4});
    ctx.label(label,group,center(info.bounds),{minDetail:0,maxDetail:3,priority:all?1:4});
  });
  // Preserve bilateral relationships inside each family when many pathways are
  // compared. A single bilateral family instead separates its left/right parts.
  const spread=families.size>1?[...families.values()]:bundles;
  const view=V(...tractDirection(topic.id)).normalize();
  spreadParts(spread,ctx,view,.55);
  const caveat=topic.id==='dorsal-column'?'ML-labeled somatosensory projection includes a cortical extension; no uninterrupted axon through the thalamic relay, spinal dorsal-column or decussation geometry is implied.':'Population tractography estimates pathways; line direction and count do not represent signaling direction or axon number.';
  const status=`HCP1065 · ${chosen.reduce((n,b)=>n+b.streamlineCount,0).toLocaleString()} sampled streamlines · ${caveat}`;
  return status;
}

/** Labels follow anatomical axes, never screen-left conventions. No arrow is
 * an inferred connection and no orientation marker substitutes for anatomy. */
function orientation(group:THREE.Group,ctx:SceneContext,bounds:THREE.Box3,axes:'sagittal'|'coronal'|'axial'='sagittal'):void{
  const middle=bounds.getCenter(V()),gap=.32;
  const labels: [string,THREE.Vector3][] = axes==='axial'
    ? [['Anterior',V(middle.x,middle.y,bounds.max.z+gap)],['Posterior',V(middle.x,middle.y,bounds.min.z-gap)],['Right',V(bounds.max.x+gap,middle.y,middle.z)]]
    : axes==='coronal'
      ? [['Superior',V(middle.x,bounds.max.y+gap,middle.z)],['Inferior',V(middle.x,bounds.min.y-gap,middle.z)],['Right',V(bounds.max.x+gap,middle.y,middle.z)]]
      : [['Anterior',V(middle.x,middle.y,bounds.max.z+gap)],['Posterior',V(middle.x,middle.y,bounds.min.z-gap)],['Superior',V(middle.x,bounds.max.y+gap,middle.z)]];
  for(const [text,point]of labels)ctx.label(text,group,point,{minDetail:0,maxDetail:3,priority:1});
}

const contextNeighbors:Record<string,string[]>={
  thalamus:['hypothalamus','fornix','midbrain','pons','medulla'],
  hypothalamus:['thalamus','fornix','midbrain'],
  hippocampus:['amygdala','fornix','thalamus'],
  amygdala:['hippocampus','fornix'],
  cerebellum:['midbrain','pons','medulla'],
  brainstem:['cerebellum','thalamus'],
  'dorsal-column':['hypothalamus','midbrain','pons','medulla'],
};

/** A conventional right-hemisphere removal, not a translucent whole-brain
 * envelope. The remaining left cortex and every landmark retain source shape
 * and position. This shows where the target sits before isolated inspection. */
function contextualAnatomy(atlas:Atlas,landmarks:LandmarkAtlas,topic:BrainTopic,ctx:SceneContext,regional?:THREE.Group):THREE.Group{
  const before=new Set(ctx.root.children);
  if(!regional)anatomy(atlas,topic,ctx);
  const group=new THREE.Group();ctx.root.add(group);
  if(regional)group.add(regional);
  for(const child of [...ctx.root.children])if(child!==group&&!before.has(child))group.add(child);
  const shell=atlas.meshes.find(item=>item.id==='hemisphere-left')!;
  const cortical=ctx.mesh(geometry(shell),ctx.material(0x56646e,1,.018),group);
  cortical.userData.atlasRegion={id:'context-hemisphere-left',sourceName:shell.name};
  cortical.userData.anatomicalContext={template:'Allen 2020 / ICBM2009b symmetric',sourceId:shell.id};
  ctx.separable(cortical,V(-2.6,1.8,-2.2));
  ctx.pick(cortical,{id:'context-hemisphere-left',label:'Left cerebral hemisphere · cutaway context',description:'Source-derived left cerebral surface at its original location in the assembled view. The right cerebral exterior is removed to expose the highlighted deep anatomy. Separate uses illustrative display translations; this surface is never mirrored.',topicId:'cerebral-cortex',level:0,maxLevel:3,kind:'anatomical landmark',priority:0});
  const neighborIds=contextNeighbors[topic.id]||['thalamus','midbrain','pons','medulla'];
  for(const id of neighborIds){
    const item=atlas.meshes.find(m=>m.id===id);if(!item)continue;
    const color=new THREE.Color(tissueColors[id]||0x9aa8ad).lerp(new THREE.Color(0x64717a),.6);
    const mesh=ctx.mesh(geometry(item),ctx.material(color.getHex(),1,.025),group);
    mesh.userData.atlasRegion={id:`context-${id}`,sourceName:item.name};
    mesh.userData.anatomicalContext={template:'Allen 2020 / ICBM2009b symmetric',sourceId:id};
    const neighborIndex=neighborIds.indexOf(id),angle=(neighborIndex+.5)*Math.PI*2/neighborIds.length;
    ctx.separable(mesh,V(.4,Math.sin(angle)*2.4,Math.cos(angle)*2.4));
    ctx.pick(mesh,{id:`context-${id}`,label:`${item.name} · landmark`,description:'Neighboring measured structure from the same Allen reference atlas. Original size and shape retained. Relative location is anatomical in the assembled view; Separate uses illustrative display translations.',topicId:item.kind==='brainstem'?'brainstem':topicFor[id]||id,level:0,maxLevel:3,kind:'anatomical landmark',priority:2});
    if(neighborIds.indexOf(id)<2)ctx.label(item.name,mesh,center(item.bounds),{minDetail:0,maxDetail:3,priority:2});
  }
  for(const item of landmarks.meshes.filter(item=>item.topicIds.includes(topic.id))){
    const mat=ctx.material(0x6cacc5,.13,.025);mat.depthWrite=false;
    const mesh=ctx.mesh(geometry(item),mat,group);
    mesh.userData.atlasRegion={id:item.id,sourceIds:item.atlasStructureIds,sourceName:item.name};
    mesh.userData.anatomicalContext={template:'Allen 2020 / ICBM2009b symmetric',sourceId:item.id};
    ctx.separable(mesh,V(.7,-1.4,-1.2));
    ctx.pick(mesh,{id:`context-${item.id}`,label:`${item.name} · CSF space`,description:`Atlas-labeled cerebrospinal-fluid space; the blue surface bounds a cavity, not solid neural tissue. Allen label ${item.atlasStructureIds.join(', ')}. Original coordinates retained in the assembled view; Separate uses illustrative display translations.`,level:0,maxLevel:3,kind:'anatomical landmark',priority:3});
    ctx.label(`${item.name} · CSF`,mesh,center(item.bounds),{minDetail:0,maxDetail:3,priority:2});
  }
  group.updateMatrixWorld(true);orientation(group,ctx,new THREE.Box3().setFromObject(group));
  return group;
}

function addMRIReference(data:ReferenceMRI,topic:BrainTopic,group:THREE.Group,ctx:SceneContext):'sagittal'|'coronal'|'axial'{
  const axis=topic.id==='corticospinal'?'coronal':topic.id==='optic-radiation'?'axial':'sagittal';
  const plane=data.planes.find(item=>item.id===axis)!;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(plane.positions.map(value=>value*SCALE),3));g.setIndex(plane.indices);
  const colors:number[]=[];
  // Source intensities are display grayscale. Three expects linear vertex
  // colors; applying output conversion twice washes out the anatomical detail.
  for(const intensity of plane.intensities){const value=intensity/255,c=new THREE.Color(value,value,value).convertSRGBToLinear();colors.push(c.r,c.g,c.b);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingBox();g.computeBoundingSphere();
  const mesh=ctx.mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,opacity:.83,depthWrite:false,toneMapped:false}),group);
  mesh.renderOrder=-1;
  mesh.userData.mriReference={template:data.metadata.template,plane:axis,sourceAxis:plane.sourceAxis,sourceLevelMm:plane.sourceLevelMm};
  ctx.pick(mesh,{id:`mri-reference-${axis}`,label:`${axis[0].toUpperCase()+axis.slice(1)} T1 MRI reference`,description:`ICBM 2009a asymmetric reference section at anatomical ${plane.sourceAxis}=${plane.sourceLevelMm} mm, sampled every 2 mm. Same named template as the HCP1065 streamlines; no Allen anatomy is superimposed.`,level:0,maxLevel:3,kind:'MRI reference',priority:0});
  orientation(group,ctx,g.boundingBox!,axis);
  return axis;
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
const regionalGuides:Record<string,{label:string;description:string}>={
  'brain-overview':{label:'Deep structures',description:'Selected measured internal regions, including hippocampal portions, thalamic nuclei and midbrain nuclei. Separate spreads these source shapes for identification; it does not trace a neural circuit.'},
  'cerebral-cortex':{label:'Named gyri',description:'Source-defined gyri rather than the whole lobe exterior. Separate reveals each labeled cortical surface at its own position in the display.'},
  thalamus:{label:'Thalamic nuclei',description:'Ten source-defined thalamic nuclear regions per hemisphere. Separate spreads their measured shapes to reveal boundaries and distinguish anterior, medial, ventral and posterior groups.'},
  hypothalamus:{label:'Hypothalamic regions',description:'Preoptic, supraoptic, tuberal and mammillary source regions. These are gross regional divisions; the source does not resolve every individual hypothalamic nucleus.'},
  hippocampus:{label:'Head, body & tail',description:'Longitudinal hippocampal portions in both hemispheres. Separate reveals the three measured portions; they are not CA1, CA3 or dentate subfields.'},
  amygdala:{label:'Amygdalar nuclei',description:'Named source nuclear regions within each amygdaloid complex. Separate exposes the measured lateral, basal, central, medial and cortical subdivisions.'},
  cerebellum:{label:'Cerebellar regions',description:'Measured vermis, paravermis, lateral hemispheres and grouped deep nuclei. Separate exposes the internal nuclear groups beneath the outer regions.'},
  brainstem:{label:'Brainstem regions',description:'Measured tegmental, peduncular, collicular, nigral, red-nuclear and medullary regions. Separate exposes named source structures rather than switching to a generic cell model.'},
  'white-matter':{label:'Tract volumes',description:'Allen-labeled white-matter volumes and commissures. These volumes describe regional anatomy; the separate HCP view estimates fiber trajectories in a different reference template.'},
  'corpus-callosum':{label:'Commissure anatomy',description:'Measured corpus-callosum and anterior-commissure volumes from the Allen atlas. Separate distinguishes these two commissural structures.'},
  corticospinal:{label:'Anatomical landmarks',description:'Measured precentral gyri, cerebral peduncles and medullary pyramidal regions. These landmarks locate relevant anatomy; their adjacency is not a traced uninterrupted axon.'},
  'optic-radiation':{label:'Visual relay anatomy',description:'Measured LGN, optic-radiation volume, cuneus and lingual gyri. These source regions identify the relay and surrounding occipital anatomy; they do not define all functional visual-area borders.'},
  'association-fibers':{label:'Cortical landmarks',description:'Measured frontal, parietal, temporal and parahippocampal gyri provide regional landmarks. No direct synaptic connection is inferred from the arrangement.'},
};
/** Anatomical regions keep their measured shape, scale and position. A crossing
 * is a trajectory property, never a made-up spherical relay. Connectivity lives
 * in the dedicated cellular circuit lessons, not inferred from adjacent masks. */
function regionalAnatomy(details:RegionalAtlas,atlas:Atlas,topic:BrainTopic,ctx:SceneContext):THREE.Group{
  const group=new THREE.Group();ctx.root.add(group);
  const selected=details.meshes.filter(item=>regionSelections[topic.id]?.includes(item.regionId)||(!regionSelections[topic.id]&&item.topicIds.includes(topic.id)));
  const parts:THREE.Object3D[]=[];
  selected.forEach((item,index)=>{
    const mesh=ctx.mesh(geometry(item),ctx.material(palette[Math.floor(index/2)%palette.length],1,.025),group);
    parts.push(mesh);
    mesh.userData.atlasRegion={id:item.id,sourceIds:item.atlasStructureIds,sourceName:item.sourceLabelName};
    const description=regionDescriptions[item.regionId]||'Named source parcellation in its original anatomical position. Shape comes from annotated voxels, not a generic graph node.';
    const child=childFor[item.topicIds[0]];
    ctx.pick(mesh,{id:item.id,label:item.name,description:`${description} Allen 2020 label ${item.atlasStructureIds.join(', ')}.`,topicId:item.topicIds[0],childTopic:child,level:0,maxLevel:3,kind:'measured atlas region',priority:6});
    // Labels have a source-mask centroid; collision/occlusion is handled by the renderer.
    const cerebellarExterior=topic.id==='cerebellum'&&item.regionId==='cerebellar-hemisphere';
    ctx.label(item.name,mesh,V(...item.centroid as [number,number,number]).multiplyScalar(SCALE),{minDetail:index<4||cerebellarExterior?0:1,maxDetail:3,priority:cerebellarExterior?4:3});
  });
  const extra:Record<string,string[]>={
    'corpus-callosum':['corpus-callosum'],
    'white-matter':['corpus-callosum','fornix'],
  };
  for(const id of extra[topic.id]||[]){
    const item=atlas.meshes.find(item=>item.id===id);if(!item)continue;
    const mesh=ctx.mesh(geometry(item),ctx.material(tissueColors[id]||0xc8d6cb),group);
    parts.push(mesh);
    mesh.userData.atlasRegion={id,sourceIds:(item as AtlasMesh&{atlasStructureIds:number[]}).atlasStructureIds};
    ctx.pick(mesh,{id:`regional-${id}`,label:item.name,description:'Atlas-labeled white-matter volume. Volume shape does not measure individual axons.',topicId:topicFor[id]||id,childTopic:'myelin',kind:'measured atlas region',level:0,maxLevel:3,priority:5});
    ctx.label(item.name,mesh,center(item.bounds),{minDetail:0,maxDetail:3,priority:4});
  }
  spreadParts(parts,ctx,regionDirection(topic.id));
  return group;
}
function axonInset(topic:BrainTopic,ctx:SceneContext):THREE.Group{
  const group=new THREE.Group();ctx.root.add(group);
  const axon=ctx.link(V(-1.5,0,0),V(1.5,0,0),.09,0xd6c991,group);
  ctx.pick(axon,{id:`${topic.id}-axon`,label:'Axon membrane',description:'Enlarged schematic axon; no claim of microscopic continuity with a displayed streamline.',childTopic:'neuron',level:0,maxLevel:3,kind:'schematic cell',priority:5});
  for(let i=0;i<5;i++){
    const internode=new THREE.Group();group.add(internode);ctx.separable(internode,V(0,.65+(i%2)*.35,0));
    const x=-1.2+i*.6,profile=[new THREE.Vector2(.093,-.275),new THREE.Vector2(.103,-.25),new THREE.Vector2(.13,-.22),new THREE.Vector2(.13,.22),new THREE.Vector2(.103,.25),new THREE.Vector2(.093,.275)],sleeve=ctx.mesh(new THREE.LatheGeometry(profile,32),ctx.material(0x9ecbbd),internode);sleeve.rotation.z=Math.PI/2;sleeve.position.x=x;sleeve.userData.myelinInternode={length:.55,spacing:.6,axonRadius:.09};
    ctx.pick(sleeve,{id:`${topic.id}-myelin-${i}`,label:'Myelin internode',description:'Oligodendrocyte wrapping shown schematically; fibers are not individually reconstructed axons.',childTopic:'myelin',level:0,maxLevel:3,kind:'schematic cell',priority:6});
    for(const end of [-1,1])for(let layer=0;layer<4;layer++){
      const wrap=ctx.mesh(new THREE.TorusGeometry(.096+layer*.01,.004,5,24),ctx.material(0xadcfc3),internode);
      wrap.rotation.y=Math.PI/2;wrap.position.x=x+end*(.268-layer*.008);ctx.detail(wrap,1);
    }
    if(i<4){
      // A node is the exposed cylindrical axonal membrane between myelin
      // internodes, not a swollen bead or a separate neuronal cell body.
      const node=ctx.mesh(new THREE.CylinderGeometry(.094,.094,.05,24,1,true),ctx.material(0xe6ad80),group);
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
  ctx.label('Myelinated axon · tapered sheaths, short exposed nodes',group,V(0,.45,0),{minDetail:0,maxDetail:3,priority:7});
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
  const rightOblique:[number,number,number]=[1,.18,.3];
  const regionalView:[number,number,number]=['thalamus','hypothalamus','dorsal-column'].includes(topic.id)?[.15,.12,1]:topic.id==='cerebellum'?[.35,.18,-1]:rightOblique;
  const guide=regionalGuides[topic.id];
  const registerRegions=()=>ctx.representation(regions,{id:'regions',label:dorsal?'Relay anatomy':guide.label,description:dorsal?'Measured VPL thalamic nuclei and postcentral gyri locate the thalamic relay and cortical destination. The spinal pathway is not supplied.':guide.description,status:dorsal?'Allen reference anatomy · VPL relay and postcentral gyri · no invented spinal tract, crossing or continuous axon through the relay.':`Allen Human Reference Atlas 2020 · ${guide.label.toLowerCase()} · assembled positions retain source anatomy; Separate uses illustrative spacing to expose each measured part.`,scale:'Reference anatomy · mm',narrative:null,viewDirection:regionalView});
  if(topic.scene==='tracts'&&!dorsal){
    const reference=await load<ReferenceMRI>('/brain/models/tracts/reference-mri.json');if(!ctx.isCurrent())return;
    const context=new THREE.Group();ctx.root.add(context);
    // Build another registration of the same source lines; representations are
    // explicitly switched, never replaced when the user crosses a zoom level.
    const before=new Set(ctx.root.children);await fibers(topic,ctx);if(!ctx.isCurrent())return;
    for(const child of [...ctx.root.children])if(!before.has(child))context.add(child);
    const axis=addMRIReference(reference,topic,context,ctx);
    const viewDirection=tractDirection(topic.id);
    ctx.representation(context,{id:'context',label:'Tracts in MRI',description:`Estimated pathways against a ${axis} T1 reference section from the same ICBM2009a asymmetric template. Rotate to see the native three-dimensional relationships.`,status:`HCP1065 pathways + ICBM2009a asymmetric ${axis} T1 section · assembled source coordinates retained; separated pathways use illustrative translations. MRI sampled at 2 mm. Streamlines remain estimates, not individual axons.`,scale:'Reference anatomy · mm',narrative:null,viewDirection});
  }else if(!['brain-overview','cerebral-cortex'].includes(topic.id)){
    const landmarks=await load<LandmarkAtlas>('/brain/models/atlas-landmarks.json');if(!ctx.isCurrent())return;
    const context=contextualAnatomy(atlas,landmarks,topic,ctx,dorsal?regionalAnatomy(details,atlas,topic,ctx):undefined);
    ctx.representation(context,{id:'context',label:dorsal?'Relay in context':'Anatomical context',description:'Right cerebral exterior removed; measured target and neighboring anatomy shown against the remaining left hemisphere. Assembled structures retain their original atlas locations and relative scale. Separate uses illustrative display translations.',status:'Allen Human Reference Atlas 2020 · source-derived anatomical cutaway · right cerebral exterior removed to reveal the highlighted anatomy; source shape and size retained; positions are anatomical when assembled and illustratively displaced when separated.',scale:'Reference anatomy · mm',narrative:null,viewDirection:rightOblique});
  }else{
    measured.updateMatrixWorld(true);orientation(measured,ctx,new THREE.Box3().setFromObject(measured));
  }
  // The HCP ML entry contains a cortical continuation. Accurate named relay
  // regions are the default; the composite estimate is an explicit alternative.
  if(dorsal)registerRegions();
  ctx.representation(measured,{id:'measured',label:dorsal?'Composite tract estimate':topic.scene==='tracts'?'Tractography':['brain-overview','cerebral-cortex'].includes(topic.id)?'Anatomy':'Isolated anatomy',description:dorsal?'Composite estimated ascending somatosensory streamlines from the HCP ML source label. Includes cortical continuation; not exact medial-lemniscus anatomy or an uninterrupted axon through VPL.':topic.scene==='tracts'?'Estimated white-matter pathways from HCP1065 diffusion MRI. Streamlines are not individual axons.':'Measured reference parcellations from Allen Human Reference Atlas 2020.',status:measuredStatus,narrative:null,viewDirection:topic.scene==='tracts'?tractDirection(topic.id):topic.id==='cerebellum'?[.35,.18,-1]:rightOblique});
  if(!dorsal)registerRegions();
  if(topic.scene==='tracts'){
    const axon=axonInset(topic,ctx);
    ctx.representation(axon,{id:'axon',label:'Axon & myelin',description:'White-matter tracts contain axons. This enlarged teaching model explains myelin internodes and nodes of Ranvier; it is not reconstructed from a displayed streamline.',status:'White-matter microstructure · enlarged schematic axon, myelin and nodes of Ranvier. This is a separate teaching scale, not a traced continuation of an MRI streamline.',scale:'Schematic',narrative:null});
  }
}
