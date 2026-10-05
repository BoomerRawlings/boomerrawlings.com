import { Quaternion, Vector3 } from 'three';
import type { Camera } from 'three';

// Allen RAS and HCP data are displayed as X=right, Y=superior, Z=anterior.
// Cellular and molecular teaching scenes have model axes, not patient axes.
export const compassAxes = [
  { vector:[1,0,0], anatomy:'R', name:'Right', model:'+X', color:'#e6a28c' },
  { vector:[-1,0,0], anatomy:'L', name:'Left', model:'−X', color:'#e6a28c' },
  { vector:[0,1,0], anatomy:'S', name:'Superior', model:'+Y', color:'#aadba7' },
  { vector:[0,-1,0], anatomy:'I', name:'Inferior', model:'−Y', color:'#aadba7' },
  { vector:[0,0,1], anatomy:'A', name:'Anterior', model:'+Z', color:'#94c6ef' },
  { vector:[0,0,-1], anatomy:'P', name:'Posterior', model:'−Z', color:'#94c6ef' },
] as const;

export function compassProjection(direction:readonly number[],orientation:Quaternion){
  return new Vector3(...direction).applyQuaternion(orientation.clone().invert());
}

export function createCompass(host:HTMLElement,onView:(direction:Vector3)=>void){
  const element=document.createElement('div');element.className='model-compass';
  element.setAttribute('role','group');
  const title=document.createElement('span');title.className='compass-title';
  const stage=document.createElement('div');stage.className='compass-stage';
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 112 112');svg.setAttribute('aria-hidden','true');stage.append(svg);
  const center=document.createElementNS(ns,'circle');center.setAttribute('cx','56');center.setAttribute('cy','56');center.setAttribute('r','4');center.setAttribute('fill','#d6e8ee');svg.append(center);
  const entries=compassAxes.map(axis=>{
    const line=document.createElementNS(ns,'line');line.setAttribute('x1','56');line.setAttribute('y1','56');line.setAttribute('stroke',axis.color);svg.prepend(line);
    const button=document.createElement('button');button.type='button';button.style.setProperty('--axis-color',axis.color);
    button.addEventListener('click',()=>{const direction=new Vector3(...axis.vector);if(Math.abs(direction.y)===1)direction.z=.001;onView(direction.normalize());});
    stage.append(button);return{axis,line,button};
  });
  element.append(stage,title);host.append(element);let previousMode:boolean|undefined;
  return{
    update(camera:Camera,anatomical:boolean){
      if(previousMode!==anatomical){
        previousMode=anatomical;title.textContent=anatomical?'Anatomical axes':'Model axes';
        element.setAttribute('aria-label',`${title.textContent}. Select an axis to orient the model.`);
        for(const {axis,button}of entries){button.textContent=anatomical?axis.anatomy:axis.model;button.title=anatomical?`${axis.name} view`:`View from ${axis.model}`;button.setAttribute('aria-label',button.title);}
      }
      for(const {axis,line,button}of entries){
        const p=compassProjection(axis.vector,camera.quaternion);
        // Give the rear pole its own target when looking directly along an axis.
        if(p.x*p.x+p.y*p.y<.20&&p.z<0){const length=Math.hypot(p.x,p.y);if(length>.03){p.x*=.72/length;p.y*=.72/length;}else{p.x=.51;p.y=-.51;}}
        const x=56+p.x*38,y=56-p.y*38;
        line.setAttribute('x2',String(x));line.setAttribute('y2',String(y));line.setAttribute('opacity',p.z<0?'.3':'.75');
        button.style.left=`${x/112*100}%`;button.style.top=`${y/112*100}%`;button.style.zIndex=String(Math.round((p.z+1)*10));button.dataset.front=String(p.z>=0);
      }
    },
    dispose(){element.remove();}
  };
}
