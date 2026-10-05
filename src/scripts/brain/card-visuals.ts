import { topics } from '../../../public/brain/curriculum.js';
import type { BrainViewer, BrainTopic } from './models';
import { chemistryById, elementKey } from './recognition';

// Classification retained in card data; geometry always comes from the actual topic.
export type CardVisual = 'brain' | 'tract' | 'circuit' | 'neuron' | 'synapse' | 'molecule' | 'channel' | 'plasticity';
type CardVisualOptions = { topicId:string; answerVisible:boolean; paused:boolean };
const topicById=new Map(topics.map(topic=>[topic.id,topic]));

/** One reusable renderer: flipping/rating cards never creates a new WebGL context. */
export function createCardVisual(){
  const wrapper=document.createElement('div');wrapper.className='brain-card-visual';
  const stage=document.createElement('div');stage.className='card-model-stage';
  const formula=document.createElement('div');formula.className='card-formula';formula.hidden=true;
  const formulaLink=document.createElement('a');formulaLink.target='_blank';formulaLink.rel='noopener';formulaLink.setAttribute('aria-label','Enlarge structural formula');
  const formulaImage=document.createElement('img');formulaImage.alt='Structural formula with atom symbols, bond orders and stereochemistry';formulaLink.append(formulaImage);formula.append(formulaLink);
  const modes=document.createElement('div');modes.className='card-visual-modes';modes.setAttribute('role','group');modes.setAttribute('aria-label','Molecule representation');
  const modelButton=document.createElement('button');modelButton.type='button';modelButton.textContent='3D conformer';
  const formulaButton=document.createElement('button');formulaButton.type='button';formulaButton.textContent='Structural formula';modes.append(modelButton,formulaButton);
  const key=document.createElement('div');let formulaVisible=false;
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
  wrapper.append(modes,stage,formula,key,loading,readout,controls,evidence);
  let viewer:BrainViewer|null=null,pending:Promise<void>|null=null,disposed=false;
  let current:CardVisualOptions|null=null,loadedTopic='',status='';

  function updateSource(){
    const molecule=current&&chemistryById[current.topicId],showFormula=Boolean(molecule&&formulaVisible);
    source.textContent=showFormula?molecule!.representation:status;
    const unavailable=/^Model could not load|3D unavailable|Molecular coordinates unavailable/.test(status);
    loading.hidden=showFormula||(!/^Loading/.test(status)&&!unavailable);
    loading.textContent=unavailable?'3D model unavailable. The structural formula and written answer remain available.':'Loading topic model…';
  }

  function updatePresentation(){
    if(!current)return;
    wrapper.dataset.answer=String(current.answerVisible);
    const molecule=chemistryById[current.topicId];modes.hidden=!molecule;key.hidden=!molecule;
    formula.hidden=!molecule||!formulaVisible;stage.hidden=Boolean(molecule&&formulaVisible);
    modelButton.setAttribute('aria-pressed',String(!formulaVisible));formulaButton.setAttribute('aria-pressed',String(formulaVisible));
    if(molecule){formulaImage.src=molecule.image;formulaLink.href=molecule.image;if(key.dataset.topic!==current.topicId){key.replaceChildren(elementKey(current.topicId==='neuropeptides'));key.dataset.topic=current.topicId;}}
    evidence.hidden=!current.answerVisible;
    readout.hidden=!current.answerVisible;
    updateSource();
    labels.hidden=!current.answerVisible||Boolean(molecule&&formulaVisible);controls.hidden=Boolean(molecule&&formulaVisible);
    viewer?.setLabels(current.answerVisible&&showLabels);
    viewer?.setPlaying(!current.paused&&!Boolean(molecule&&formulaVisible));
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
        onStatus(text){status=text;updateSource();},
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
  modelButton.addEventListener('click',()=>{formulaVisible=false;updatePresentation();});
  formulaButton.addEventListener('click',()=>{formulaVisible=true;updatePresentation();});
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
