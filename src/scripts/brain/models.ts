import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildMicroScene } from './scenes-micro';
import { buildMacroScene } from './scenes-macro';
import { cameraBlend, detailOpacity, wheelZoomFactor, zoomDetailLevel } from './zoom';
import type { BrainTopic, LabelOptions, Narrative, PickSpec, RepresentationSpec, SceneContext } from './scene-types';
export type { BrainTopic } from './scene-types';
export type BrainViewer = {
  setTopic(topic:BrainTopic):void; setMode(scene:string,target?:string):void;
  setExploded(value:boolean):void; setLabels(value:boolean):void; setPlaying(value:boolean):void;
  setView(view:'lateral'|'superior'|'anterior'):void; setDetail(level:number):void; setRepresentation(id:string):void;
  focusPart(id:string):void; enter():void; back():void; zoom(direction:number):void;
  seek(fraction:number):void; reset():void; resize():void; dispose():void;
};
type Options = {
  initialRepresentation?:string; autoRotate?:boolean;
  onSelect?:(id:string)=>void; onStatus?:(text:string)=>void;
  onHover?:(part:PickSpec|null)=>void; onFocus?:(part:PickSpec|null)=>void;
  onDetail?:(level:number)=>void; onParts?:(parts:PickSpec[])=>void;
  onRepresentations?:(views:RepresentationSpec[],active:string)=>void;
  onNarrative?:(narrative:Narrative|null)=>void; onTime?:(fraction:number,step:number)=>void;
};
type Label={element:HTMLDivElement;object:THREE.Object3D;point:THREE.Vector3;options:LabelOptions};
type Pick={object:THREE.Object3D;spec:PickSpec;instanceId?:number};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const defaultDirection=V(7.4,4,9.4).normalize();

/** Camera, semantic selection and animation clock shared by all scientific scene builders. */
export async function createBrainViewer(container:HTMLElement,options:Options={}):Promise<BrainViewer|null>{
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}
  catch{options.onStatus?.('3D unavailable on this device. All study content remains available.');return null;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));renderer.setClearColor(0x08131b,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
  const canvas=renderer.domElement;canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none';
  canvas.tabIndex=0;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','3D model. Arrow keys orbit. Plus and minus zoom. Escape clears focus. Choose a structure below for keyboard exploration.');container.append(canvas);
  const labelLayer=document.createElement('div');labelLayer.className='model-label-layer';labelLayer.setAttribute('aria-hidden','true');container.append(labelLayer);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.015,500),root=new THREE.Group();scene.add(root);
  scene.add(new THREE.HemisphereLight(0xe5f5ff,0x233d43,1.4));
  const lights:[number,number,number[]][]=[[0xf3f7ff,2.4,[-5,7,8]],[0x8cdacf,.95,[6,2,-5]],[0xb6beef,.4,[-5,-2,-3]]];
  for(const[color,intensity,p]of lights){const light=new THREE.DirectionalLight(color,intensity);light.position.set(p[0],p[1],p[2]);scene.add(light);}
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.095;controls.enablePan=true;controls.panSpeed=.5;controls.zoomSpeed=.7;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();raycaster.params.Line={threshold:.06};
  let current:BrainTopic={id:'brain-overview',title:'The whole brain',scene:'brain'};
  let generation=0,disposed=false,ready=false,inViewport=true,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,showLabels=true,exploded=false;
  let dirty=true,time=0,lastTime=0,lastUi=0,frame=0,detailLevel=-1,baseDistance=12,explosion=0,requestedDetail=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let labels:Label[]=[],picks:Pick[]=[],details:{object:THREE.Object3D;min:number;max:number}[]=[],parts:{object:THREE.Object3D;base:THREE.Vector3;offset:THREE.Vector3}[]=[];
  let animations:((time:number,dt:number)=>void)[]=[],layouts:(()=>void)[]=[],narrative:Narrative|null=null;
  let hover:Pick|null=null,focused:Pick|null=null;let pendingEntry:string|undefined;
  let highlighted:{mesh:THREE.Mesh;original:THREE.Material|THREE.Material[];clones:THREE.Material[]}[]=[];
  const instanceSelections=new Map<string,Pick>();let instanceMarker:{mesh:THREE.Mesh;source:THREE.InstancedMesh;index:number}|null=null;
  const home=V(),targetGoal=V(),cameraGoal=V();let moving=false;
  let representations:{object:THREE.Object3D;spec:RepresentationSpec}[]=[],representationId='',sceneNarrative:Narrative|null=null,sceneStatus='';
  let fadeObjects:{object:THREE.Mesh;layers:typeof details}[]=[],detachedMaterials=new Set<THREE.Material>();
  let representationTimer:ReturnType<typeof setTimeout>|undefined;
  let down={x:0,y:0};
  const shown=(object:THREE.Object3D):boolean=>{for(let p:THREE.Object3D|null=object;p;p=p.parent)if(!p.visible)return false;return true;};
  const material:SceneContext['material']=(color=0xdbe9ed,opacity=1,emissive=0)=>new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.04,transparent:opacity<1,opacity,depthWrite:opacity>=.85,emissive:color,emissiveIntensity:emissive});
  const mesh:SceneContext['mesh']=(geometry,mat,parent=root)=>{const m=new THREE.Mesh(geometry,mat);parent.add(m);return m;};
  const ball:SceneContext['ball']=(position,radius,color,parent=root,opacity=1)=>{const m=mesh(new THREE.SphereGeometry(radius,16,12),material(color,opacity,.04),parent);m.position.copy(position);return m;};
  const tube:SceneContext['tube']=(points,radius,color,parent=root,opacity=1,segments=48)=>{const curve=new THREE.CatmullRomCurve3(points);return{mesh:mesh(new THREE.TubeGeometry(curve,segments,radius,7,false),material(color,opacity,.06),parent),curve};};
  const link:SceneContext['link']=(a,b,radius,color,parent=root,opacity=1)=>{const delta=b.clone().sub(a),m=mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),8),material(color,opacity),parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return m;};
  function unhighlight(){dirty=true;if(instanceMarker){scene.remove(instanceMarker.mesh);(instanceMarker.mesh.material as THREE.Material).dispose();instanceMarker=null;}for(const h of highlighted){h.mesh.material=h.original;h.clones.forEach(m=>m.dispose());}highlighted=[];}
  function highlight(part:Pick|null){
    unhighlight();if(!part)return;
    if(part.instanceId!==undefined&&part.object instanceof THREE.InstancedMesh){const marker=new THREE.Mesh(part.object.geometry,new THREE.MeshBasicMaterial({color:0xf7ffbe}));marker.matrixAutoUpdate=false;scene.add(marker);instanceMarker={mesh:marker,source:part.object,index:part.instanceId};dirty=true;return;}
    const selectedObjects=new Set<THREE.Object3D>();part.object.traverse(o=>selectedObjects.add(o));
    if([...selectedObjects].some(o=>o instanceof THREE.Line))root.traverseVisible(o=>{
      if(!(o instanceof THREE.Line)||selectedObjects.has(o))return;
      const original=o.material,materials=Array.isArray(original)?original:[original];
      const clones=materials.map(mat=>{const copy=mat.clone();copy.transparent=true;copy.opacity=.09;return copy;});
      o.material=Array.isArray(original)?clones:clones[0];highlighted.push({mesh:o as unknown as THREE.Mesh,original,clones});
    });
    part.object.traverse(o=>{const m=o as THREE.Mesh;if(!(m.isMesh||o instanceof THREE.Line)||!shown(m))return;const original=m.material,materials=Array.isArray(original)?original:[original];
      const clones=materials.map(mat=>{const copy=mat.clone();if(copy instanceof THREE.MeshStandardMaterial){copy.emissive.set(0x63e8cf);copy.emissiveIntensity=.35;copy.roughness=.4;}else if('color'in copy){(copy as THREE.MeshBasicMaterial).color.set(0x9fffe1);copy.opacity=1;}return copy;});
      m.material=Array.isArray(original)?clones:clones[0];highlighted.push({mesh:m,original,clones});});dirty=true;
  }
  function setHover(part:Pick|null){if(hover===part)return;hover=part;highlight(hover||focused);canvas.style.cursor=part?'pointer':'grab';options.onHover?.(part?.spec||null);}
  function clearFocus(preserveEntry=false){if(!preserveEntry)pendingEntry=undefined;focused=null;options.onFocus?.(null);highlight(hover);}
  function disposeRoot(){unhighlight();instanceSelections.clear();const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>();root.traverse(o=>{const m=o as THREE.Mesh;if(m instanceof THREE.InstancedMesh)m.dispose();if(m.geometry)geos.add(m.geometry);if(m.material)(Array.isArray(m.material)?m.material:[m.material]).forEach(a=>mats.add(a));});geos.forEach(g=>g.dispose());detachedMaterials.forEach(m=>mats.add(m));mats.forEach(m=>m.dispose());detachedMaterials.clear();fadeObjects=[];representations=[];representationId="";root.clear();labels.forEach(l=>l.element.remove());labels=[];picks=[];parts=[];details=[];animations=[];layouts=[];}
  function available(){return picks.filter(p=>!p.object.userData.contextOnly&&shown(p.object)&&(p.spec.level??0)<=detailLevel&&(p.spec.maxLevel??3)>=detailLevel);}
  function prepareFades(){
    const usage=new Map<THREE.Material,number>();
    root.traverse(o=>{const m=o as THREE.Mesh;if(m.material)for(const mat of Array.isArray(m.material)?m.material:[m.material])usage.set(mat,(usage.get(mat)||0)+1);});
    root.traverse(o=>{const m=o as THREE.Mesh;if(!m.material)return;const layers=details.filter(d=>{if(d.min===0&&d.max===3)return false;for(let p:THREE.Object3D|null=o;p;p=p.parent)if(p===d.object)return true;return false;});if(!layers.length)return;
      const materials=Array.isArray(m.material)?m.material:[m.material],owned=materials.map(mat=>{if((usage.get(mat)||0)<2)return mat;detachedMaterials.add(mat);return mat.clone();});m.material=Array.isArray(m.material)?owned:owned[0];fadeObjects.push({object:m,layers});
    });
  }
  function applyFades(){
    const saved=new Map<THREE.Material,{opacity:number;transparent:boolean;depthWrite:boolean}>();
    for(const item of fadeObjects){if(!shown(item.object))continue;const weight=item.layers.reduce((n,d)=>n*(d.object.userData.zoomOpacity??1),1);if(weight>.999)continue;
      for(const mat of Array.isArray(item.object.material)?item.object.material:[item.object.material]){if(saved.has(mat))continue;saved.set(mat,{opacity:mat.opacity,transparent:mat.transparent,depthWrite:mat.depthWrite});mat.opacity*=weight;mat.transparent=true;mat.depthWrite=false;}
    }return()=>{for(const[mat,original]of saved)Object.assign(mat,original);};
  }
  function updateDetail(force=false){
    const ratio=camera.position.distanceTo(controls.target)/baseDistance,level=zoomDetailLevel(ratio);
    for(const d of details){const opacity=detailOpacity(ratio,d.min,d.max);if(Math.abs((d.object.userData.zoomOpacity??-1)-opacity)>.001)dirty=true;d.object.userData.zoomOpacity=opacity;d.object.visible=opacity>.003;}
    if(level===detailLevel&&!force)return;detailLevel=level;
    if(hover&&(!shown(hover.object)||(hover.spec.level??0)>level||(hover.spec.maxLevel??3)<level))setHover(null);
    if(focused&&(!shown(focused.object)||(focused.spec.level??0)>level||(focused.spec.maxLevel??3)<level))clearFocus();
    highlight(hover||focused);options.onDetail?.(level);
    const seen=new Set<string>();options.onParts?.(available().filter(p=>{if(seen.has(p.spec.id))return false;seen.add(p.spec.id);return true;}).map(p=>p.spec));container.dataset.detail=String(level);dirty=true;
  }
  function activateRepresentation(id:string){
    const selected=representations.find(r=>r.spec.id===id);if(!selected)return;
    representationId=id;for(const view of representations)view.object.visible=view===selected;
    narrative=selected.spec.narrative===undefined?sceneNarrative:selected.spec.narrative;options.onNarrative?.(narrative);
    options.onStatus?.(selected.spec.status||selected.spec.description||sceneStatus);options.onRepresentations?.(representations.map(r=>r.spec),id);
    container.dataset.representation=id;time=0;lastUi=0;dirty=true;
  }
  function setRepresentation(id:string){
    if(!ready||!representations.some(r=>r.spec.id===id))return;
    clearTimeout(representationTimer);if(id===representationId){container.classList.remove('model-changing');return;}setHover(null);clearFocus();moving=false;
    const token=generation;container.classList.add('model-changing');
    representationTimer=setTimeout(()=>{if(disposed||token!==generation)return;activateRepresentation(id);fit();container.classList.remove('model-changing');},reduced.matches?0:140);
  }
  function setCamera(target:THREE.Vector3,distance:number,direction=camera.position.clone().sub(controls.target).normalize(),instant=false){
    targetGoal.copy(target);cameraGoal.copy(target).addScaledVector(direction,distance);
    if(instant||reduced.matches){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);moving=false;controls.update();updateDetail();}else moving=true;dirty=true;
  }
  function topicDirection(){return current.id==='electrical-synapses'?V(0,0,1):current.id==='cerebellum'?V(7,3,-9).normalize():defaultDirection;}
  function fit(preserveView=false){
    const viewTarget=preserveView&&moving?targetGoal:controls.target,viewPosition=preserveView&&moving?cameraGoal:camera.position;
    const ratio=viewPosition.distanceTo(viewTarget)/baseDistance,previousTarget=viewTarget.clone(),direction=viewPosition.clone().sub(viewTarget).normalize();
    const visibility=details.map(d=>d.object.visible);for(const d of details)d.object.visible=d.min===0;
    const box=new THREE.Box3();root.updateMatrixWorld(true);
    root.traverseVisible(o=>{const m=o as THREE.Mesh;if(o.userData.contextOnly||o.userData.fitIgnore)return;if(m instanceof THREE.InstancedMesh){m.computeBoundingBox();if(m.boundingBox)box.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld));}else if(m.geometry){if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();if(m.geometry.boundingBox)box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));}});
    details.forEach((d,i)=>d.object.visible=visibility[i]);
    if(box.isEmpty()){home.set(0,0,0);baseDistance=12;}else{
      box.getCenter(home);const forward=preserveView?direction:topicDirection(),right=V().crossVectors(camera.up,forward).normalize(),up=V().crossVectors(forward,right).normalize();
      const tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),tanX=tanY*camera.aspect;let distance=0;
      for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const corner=V(x,y,z).sub(home),near=corner.dot(forward);distance=Math.max(distance,near+Math.abs(corner.dot(right))/tanX,near+Math.abs(corner.dot(up))/tanY);}
      baseDistance=Math.max(distance*1.18,.75);
    }
    controls.minDistance=baseDistance*.12;controls.maxDistance=baseDistance*1.65;
    setCamera(preserveView?previousTarget:home,baseDistance*(preserveView?ratio:1),preserveView?direction:topicDirection(),true);updateDetail(true);
  }
  function focus(part:Pick){
    if(focused===part){enter();return;}focused=part;pendingEntry=part.spec.childTopic||part.spec.topicId;options.onFocus?.(part.spec);
    const box=new THREE.Box3().setFromObject(part.object),center=box.isEmpty()?part.object.getWorldPosition(V()):box.getCenter(V());
    if(part.instanceId!==undefined&&part.object instanceof THREE.InstancedMesh){const matrix=new THREE.Matrix4();part.object.getMatrixAt(part.instanceId,matrix);center.setFromMatrixPosition(matrix.premultiply(part.object.matrixWorld));}
    const size=box.getSize(V()).length();let distance=Math.max(baseDistance*.24,Math.min(camera.position.distanceTo(controls.target)*.7,size*1.3,baseDistance*.72));
    // A focus target must fit even when it is a tall channel or a broad region.
    // Keep individual residue zoom separate from its whole instanced cloud.
    if(part.instanceId===undefined&&!box.isEmpty()){
      const forward=camera.position.clone().sub(controls.target).normalize(),right=V().crossVectors(camera.up,forward).normalize();if(right.lengthSq()<.5)right.setFromMatrixColumn(camera.matrixWorld,0);
      const up=V().crossVectors(forward,right).normalize(),tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),tanX=tanY*camera.aspect;let fitDistance=0;
      for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){const corner=V(x,y,z).sub(center),near=corner.dot(forward);fitDistance=Math.max(fitDistance,near+Math.abs(corner.dot(right))/tanX,near+Math.abs(corner.dot(up))/tanY);}
      distance=Math.max(distance,fitDistance*1.18);
    }
    setCamera(center,distance);highlight(part);dirty=true;
  }
  function enter(){const id=pendingEntry||focused?.spec.childTopic||focused?.spec.topicId;if(id&&id!==current.id){options.onSelect?.(id);}}
  function hit(event:PointerEvent):Pick|null{
    if(!ready)return null;
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const active=new Map(available().map(p=>[p.object,p]));
    const candidates:THREE.Object3D[]=[];root.traverseVisible(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){let p:THREE.Object3D|null=o;while(p){if(active.has(p)){candidates.push(o);break;}p=p.parent;}}});
    for(const hit of raycaster.intersectObjects(candidates,false)){
      if(!shown(hit.object))continue;
      let object=hit.object,instanceId=hit.instanceId;
      const residues=object.userData.residueCloud;
      if(detailLevel>=2&&residues instanceof THREE.InstancedMesh&&shown(residues)){
        const local=residues.worldToLocal(hit.point.clone()),matrix=new THREE.Matrix4(),point=V();let nearest=Infinity;
        for(let i=0;i<residues.count;i++){residues.getMatrixAt(i,matrix);const distance=point.setFromMatrixPosition(matrix).distanceToSquared(local);if(distance<nearest){nearest=distance;instanceId=i;}}
        object=residues;
      }
      let p:THREE.Object3D|null=hit.object;
      while(p&&p!==root.parent){const selected=active.get(p);if(selected){const metadata=object.userData.instancePicks?.[instanceId??-1] as PickSpec|undefined;if(metadata&&instanceId!==undefined){const key=`${object.uuid}:${instanceId}`;if(!instanceSelections.has(key))instanceSelections.set(key,{object,spec:metadata,instanceId});return instanceSelections.get(key)!;}return selected;}p=p.parent;}
    }return null;
  }
  function onMove(event:PointerEvent){if(!event.buttons)setHover(hit(event));}
  function onLeave(){setHover(null);}
  function onDown(event:PointerEvent){down={x:event.clientX,y:event.clientY};moving=false;}
  function onUp(event:PointerEvent){if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>6)return;const part=hit(event);if(part)focus(part);else clearFocus();}
  function zoomBy(factor:number){
    const target=moving?targetGoal:controls.target,position=moving?cameraGoal:camera.position;
    const distance=THREE.MathUtils.clamp(position.distanceTo(target)*factor,controls.minDistance,controls.maxDistance);
    setCamera(target,distance,position.clone().sub(target).normalize());
  }
  function onWheel(event:WheelEvent){
    event.preventDefault();event.stopImmediatePropagation();
    if(ready)zoomBy(wheelZoomFactor(event.deltaY,event.deltaMode,container.clientHeight));
  }
  function zoom(direction:number){zoomBy(direction>0?.86:1/.86);}
  function onKey(event:KeyboardEvent){
    if(['+','=','-','_','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape','Enter'].includes(event.key))event.preventDefault();else return;
    if(event.key==='Escape'){clearFocus();setCamera(home,baseDistance);return;}if(event.key==='Enter'){enter();return;}if(['+','=','-','_'].includes(event.key)){zoom(event.key==='+'||event.key==='='?1:-1);return;}
    const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));if(event.key==='ArrowLeft')spherical.theta-=.12;if(event.key==='ArrowRight')spherical.theta+=.12;if(event.key==='ArrowUp')spherical.phi-=.12;if(event.key==='ArrowDown')spherical.phi+=.12;spherical.makeSafe();setCamera(controls.target,spherical.radius,V().setFromSpherical(spherical).normalize());
  }
  function resize(){if(disposed)return;const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight),oldAspect=camera.aspect;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);if(ready&&Math.abs(oldAspect-camera.aspect)>.01)fit(true);dirty=true;}
  function drawLabels(){
    const rect=container.getBoundingClientRect(),occupied:{x:number;y:number;w:number;h:number}[]=[];
    const regionOccluders:THREE.Object3D[]=[];if(showLabels&&labels.some(l=>l.object.userData.atlasRegion&&shown(l.object)))root.traverseVisible(o=>{if(o instanceof THREE.Mesh&&o.userData.atlasRegion&&!(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.opacity<.85))regionOccluders.push(o);});
    const labelRay=new THREE.Raycaster();
    for(const l of [...labels].sort((a,b)=>(b.options.priority??0)-(a.options.priority??0))){
      let display=showLabels&&shown(l.object)&&detailLevel>=(l.options.minDetail??0)&&detailLevel<=(l.options.maxDetail??3);
      const anchor=l.object.localToWorld(l.point.clone());
      if(l.options.normal){const normal=l.options.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(l.object.matrixWorld));display=display&&normal.dot(camera.position.clone().sub(anchor).normalize())>.08;}
      if(display&&l.object.userData.atlasRegion){labelRay.far=camera.position.distanceTo(anchor)+.001;labelRay.set(camera.position,anchor.clone().sub(camera.position).normalize());const first=labelRay.intersectObjects(regionOccluders,false)[0];if(first&&first.object!==l.object)display=false;}
      const projected=anchor.project(camera);display=display&&projected.z<1&&projected.z>-1;
      let x=(projected.x*.5+.5)*rect.width,y=(-projected.y*.5+.5)*rect.height;const w=l.element.offsetWidth||110,h=l.element.offsetHeight||23;
      display=display&&x>0&&y>35&&x<rect.width&&y<rect.height-55;x=Math.max(8,Math.min(rect.width-w-8,x-w/2));y-=h/2;
      if(display&&occupied.some(b=>x<b.x+b.w+6&&x+w+6>b.x&&y<b.y+b.h+5&&y+h+5>b.y))display=false;
      if(display){occupied.push({x,y,w,h});l.element.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;}l.element.style.opacity=display?'1':'0';
    }
  }
  const viewportObserver=new IntersectionObserver(entries=>{inViewport=entries[0]?.isIntersecting??true;if(inViewport)dirty=true;});viewportObserver.observe(container);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);controls.addEventListener('change',()=>{dirty=true;});controls.addEventListener('start',()=>{moving=false;});
  canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerleave',onLeave);canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('wheel',onWheel,{passive:false,capture:true});canvas.addEventListener('keydown',onKey);
  function tick(now:number){
    if(disposed)return;frame=requestAnimationFrame(tick);const dt=Math.min((now-lastTime)/1000||0,.05);lastTime=now;if(!inViewport||(document.hidden&&!dirty))return;
    if(playing&&ready){time+=dt;dirty=true;}
    if(moving){const a=reduced.matches?1:cameraBlend(dt);camera.position.lerp(cameraGoal,a);controls.target.lerp(targetGoal,a);if(camera.position.distanceTo(cameraGoal)<.002){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);moving=false;}dirty=true;}
    controls.autoRotate=Boolean(options.autoRotate&&playing&&!reduced.matches&&!focused);controls.autoRotateSpeed=.5;controls.update(dt);updateDetail();const desired=exploded?1:0;if(Math.abs(explosion-desired)>.001){explosion=reduced.matches?desired:THREE.MathUtils.lerp(explosion,desired,1-Math.exp(-dt*6));dirty=true;}
    if(!dirty)return;for(const p of parts)p.object.position.copy(p.base).addScaledVector(p.offset,explosion);for(const update of animations)update(time,playing?dt:0);for(const layout of layouts)layout();root.updateMatrixWorld(true);if(instanceMarker){const matrix=new THREE.Matrix4();instanceMarker.source.getMatrixAt(instanceMarker.index,matrix);instanceMarker.mesh.matrix.copy(instanceMarker.source.matrixWorld).multiply(matrix).scale(V(1.65,1.65,1.65));}const restoreFades=applyFades();renderer.render(scene,camera);restoreFades();drawLabels();dirty=false;container.dataset.moving=String(moving);container.dataset.zoom=(camera.position.distanceTo(controls.target)/baseDistance).toFixed(3);
    if(ready)container.dataset.rendered=current.id;
    if(narrative&&now-lastUi>90){const progress=(time%narrative.duration)/narrative.duration;let step=0;for(let i=0;i<narrative.steps.length;i++)if(time%narrative.duration>=narrative.steps[i].at)step=i;options.onTime?.(progress,step);lastUi=now;}
  }
  async function setTopic(topic:BrainTopic){
    const token=++generation;clearTimeout(representationTimer);container.classList.remove('model-changing');ready=false;current=topic;container.dataset.rendered='';container.dataset.topic=topic.id;setHover(null);clearFocus();disposeRoot();time=0;lastUi=0;detailLevel=-1;explosion=0;requestedDetail=0;moving=false;narrative=null;sceneNarrative=null;sceneStatus='';container.dataset.representation='';options.onRepresentations?.([],'');options.onNarrative?.(null);options.onParts?.([]);options.onStatus?.('Loading detailed model…');
    const buildRoot=new THREE.Group();root.add(buildRoot);
    const ctx:SceneContext={root:buildRoot,material,mesh:(geometry,mat,parent=buildRoot)=>mesh(geometry,mat,parent),ball:(position,radius,color,parent=buildRoot,opacity=1)=>ball(position,radius,color,parent,opacity),tube:(points,radius,color,parent=buildRoot,opacity=1,segments=48)=>tube(points,radius,color,parent,opacity,segments),link:(a,b,radius,color,parent=buildRoot,opacity=1)=>link(a,b,radius,color,parent,opacity),
      label(text,object,point=V(),labelOptions={}){if(token!==generation)return;const element=document.createElement('div');element.className='model-label';element.textContent=text;labelLayer.append(element);labels.push({element,object,point,options:labelOptions});},
      pick(object,spec){if(token===generation)picks.push({object,spec});},detail(object,min,max=3){if(token===generation){object.visible=min===0;details.push({object,min,max});}},separable(object,offset){if(token===generation)parts.push({object,base:object.position.clone(),offset});},animate(fn){if(token===generation)animations.push(fn);},layout(fn){if(token===generation)layouts.push(fn);},status(text){if(token===generation){sceneStatus=text;options.onStatus?.(text);}},
      representation(object,spec){if(token===generation){object.visible=representations.length===0;representations.push({object,spec});}},
      narrative(value){if(token===generation){sceneNarrative=value;narrative=value;options.onNarrative?.(value);}},isCurrent(){return token===generation&&!disposed;}
    };
    try{if(topic.scene==='brain'||topic.scene==='tracts')await buildMacroScene(topic,ctx);else await buildMicroScene(topic,ctx);if(!ctx.isCurrent())return;for(const fn of animations)fn(0,0);prepareFades();if(representations.length)activateRepresentation(representations.find(view=>view.spec.id===options.initialRepresentation)?.spec.id||representations[0].spec.id);ready=true;resize();fit();if(requestedDetail)setCamera(controls.target,baseDistance*[1,.73,.52,.32][requestedDetail]);dirty=true;}
    catch(error){if(!ctx.isCurrent())return;options.onStatus?.('Model could not load. Choose another topic or reload; the complete written guide remains available.');console.error('Brain model load failed',error);}
  }
  resize();frame=requestAnimationFrame(tick);
  return{setTopic(topic){void setTopic(topic);},setMode(scene,target){void setTopic({...current,scene,modelTarget:target});},setExploded(value){exploded=value;dirty=true;},setLabels(value){showLabels=value;dirty=true;},setPlaying(value){playing=value;dirty=true;},
    setView(view){clearFocus();setCamera(home,camera.position.distanceTo(controls.target),view==='lateral'?V(1,0,0):view==='superior'?V(.001,1,0):V(0,0,1));},setDetail(level){requestedDetail=Math.max(0,Math.min(3,Math.round(level)));if(ready)setCamera(controls.target,baseDistance*[1,.73,.52,.32][requestedDetail]);},setRepresentation,focusPart(id){const part=available().find(p=>p.spec.id===id);if(part)focus(part);},enter,back(){clearFocus();setCamera(home,baseDistance);},zoom,seek(fraction){if(narrative){time=THREE.MathUtils.clamp(fraction,0,.9999)*narrative.duration;lastUi=0;dirty=true;}},reset(){clearFocus();setCamera(home,baseDistance,topicDirection());},resize,
    dispose(){disposed=true;generation++;clearTimeout(representationTimer);cancelAnimationFrame(frame);resizeObserver.disconnect();viewportObserver.disconnect();controls.dispose();canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerleave',onLeave);canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('wheel',onWheel,true);canvas.removeEventListener('keydown',onKey);disposeRoot();renderer.dispose();renderer.forceContextLoss();canvas.remove();labelLayer.remove();}
  };
}
