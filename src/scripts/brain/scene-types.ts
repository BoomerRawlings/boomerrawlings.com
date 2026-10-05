import type * as THREE from 'three';

export type BrainTopic = { id:string;title:string;scene:string;modelTarget?:string;category?:string;color?:string };
export type PickSpec = { id:string;label:string;parentLabel?:string;description?:string;topicId?:string;childTopic?:string;level?:number;maxLevel?:number;kind?:string;priority?:number };
export type LabelOptions = { minDetail?:number;maxDetail?:number;priority?:number;normal?:THREE.Vector3 };
export type Narrative = { duration:number;steps:{at:number;label:string;description:string}[] };
export type RepresentationSpec = { id:string;label:string;description:string;status?:string;scale?:string;narrative?:Narrative|null };
export interface SceneContext {
  root:THREE.Group;
  material(color?:number|string,opacity?:number,emissive?:number):THREE.MeshStandardMaterial;
  mesh(geometry:THREE.BufferGeometry,material:THREE.Material,parent?:THREE.Object3D):THREE.Mesh;
  ball(position:THREE.Vector3,radius:number,color:number|string,parent?:THREE.Object3D,opacity?:number):THREE.Mesh;
  tube(points:THREE.Vector3[],radius:number,color:number|string,parent?:THREE.Object3D,opacity?:number,segments?:number):{mesh:THREE.Mesh;curve:THREE.CatmullRomCurve3};
  link(a:THREE.Vector3,b:THREE.Vector3,radius:number,color:number|string,parent?:THREE.Object3D,opacity?:number):THREE.Mesh;
  label(text:string,object:THREE.Object3D,point?:THREE.Vector3,options?:LabelOptions):void;
  pick(object:THREE.Object3D,spec:PickSpec):void;
  detail(object:THREE.Object3D,minLevel:number,maxLevel?:number):void;
  representation(object:THREE.Object3D,spec:RepresentationSpec):void;
  separable(object:THREE.Object3D,offset:THREE.Vector3):void;
  animate(fn:(time:number,dt:number)=>void):void;
  layout(fn:()=>void):void;
  status(text:string):void;
  narrative(value:Narrative):void;
  isCurrent():boolean;
}
