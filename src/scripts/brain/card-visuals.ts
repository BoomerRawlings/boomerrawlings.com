import { topics } from '../../../public/brain/curriculum.js';
import type { BrainViewer, BrainTopic } from './models';

// Classification retained in card data; geometry always comes from the actual topic.
export type CardVisual = 'brain' | 'tract' | 'circuit' | 'neuron' | 'synapse' | 'molecule' | 'channel' | 'plasticity';
type CardVisualOptions = { topicId:string; answerVisible:boolean; paused:boolean };
const topicById=new Map(topics.map(topic=>[topic.id,topic]));

/** One reusable renderer: flipping/rating cards never creates a new WebGL context. */
export function createCardVisual(){
  const wrapper=document.createElement('div');wrapper.className='brain-card-visual';
  const stage=document.createElement('div');stage.className='card-model-stage';
  const loading=document.createElement('p');loading.className='card-model-loading';loading.textContent='Loading topic model…';
  const readout=document.createElement('p');readout.className='card-model-readout';
  const controls=document.createElement('div');controls.className='card-model-controls';
  const hint=document.createElement('span');hint.textContent='Drag to rotate · Scroll to zoom';
  const labels=document.createElement('button');labels.type='button';labels.textContent='Labels';labels.setAttribute('aria-pressed','false');
  let showLabels=false;
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset view';
  controls.append(hint,labels,reset);
  const evidence=document.createElement('details');evidence.className='card-model-evidence';
  const summary=document.createElement('summary');summary.textContent='Model source & limits';
  const source=document.createElement('p');evidence.append(summary,source);
  wrapper.append(stage,loading,readout,controls,evidence);
  let viewer:BrainViewer|null=null,pending:Promise<void>|null=null,disposed=false;
  let current:CardVisualOptions|null=null,loadedTopic='',status='';

  function updatePresentation(){
    if(!current)return;
    wrapper.dataset.answer=String(current.answerVisible);
    evidence.hidden=!current.answerVisible;
    readout.hidden=!current.answerVisible;
    source.textContent=status;
    labels.hidden=!current.answerVisible;
    viewer?.setLabels(current.answerVisible&&showLabels);
    viewer?.setPlaying(!current.paused);
    const canvas=stage.querySelector('canvas');
    canvas?.setAttribute('aria-label',(current.answerVisible?topicById.get(current.topicId)?.title+' model. ':'')+'Drag or use arrow keys to rotate. Scroll or use plus and minus to zoom. Escape resets focus.');
    if(viewer&&loadedTopic!==current.topicId){
      loadedTopic=current.topicId;stage.dataset.topic=loadedTopic;status='';readout.textContent='';evidence.open=false;
      viewer.setTopic(topicById.get(loadedTopic)! as BrainTopic);
    }
    viewer?.resize();
  }
  async function initialize(){
    if(viewer||pending||disposed||!current)return;
    pending=(async()=>{
      const {createBrainViewer}=await import('./models');
      if(disposed||!current)return;
      const result=await createBrainViewer(stage,{
        initialRepresentation:'experimental',autoRotate:true,
        onStatus(text){status=text;source.textContent=text;loading.hidden=!/^Loading/.test(text);if(/^Loading/.test(text))loading.textContent='Loading topic model…';if(/^Model could not load|3D unavailable|Molecular coordinates unavailable/.test(text)){loading.hidden=false;loading.textContent='3D model unavailable. The written answer and references remain available.';}},
        onHover(part){readout.textContent=current?.answerVisible?part?.label||'':'';},
        onFocus(part){readout.textContent=current?.answerVisible?part?.label||'':'';},
      });
      if(disposed){result?.dispose();return;}
      viewer=result;
      if(!result){loading.hidden=false;loading.textContent='3D model unavailable. The written answer and references remain available.';return;}
      updatePresentation();
    })().catch(()=>{loading.hidden=false;loading.textContent='Could not load the model. The written answer and references remain available.';}).finally(()=>{pending=null;});
    await pending;
  }
  labels.addEventListener('click',()=>{showLabels=!showLabels;labels.setAttribute('aria-pressed',String(showLabels));updatePresentation();});
  reset.addEventListener('click',()=>viewer?.reset());
  const clear=()=>{current=null;viewer?.setPlaying(false);wrapper.remove();};
  const dispose=()=>{if(disposed)return;disposed=true;clear();viewer?.dispose();viewer=null;};
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
  return{
    show(host:HTMLElement,options:CardVisualOptions){
      if(disposed||!topicById.has(options.topicId))return;
      current=options;host.replaceChildren(wrapper);updatePresentation();void initialize();
    },clear,dispose,
  };
}
