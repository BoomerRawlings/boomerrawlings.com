export const journeys = [
  { id:'thought', title:'Neural signaling', description:'Cortical circuits, neurons, synapses, neurotransmitters and ion channels.', ids:['brain-overview','cerebral-cortex','cortical-circuit','neuron','synaptic-release','glutamate','ampa','sodium-channel'] },
  { id:'memory', title:'Memory and synaptic plasticity', description:'Hippocampal circuits, synaptic changes and memory consolidation.', ids:['hippocampus','hippocampal-circuit','nmda','ltp','ltd','structural-plasticity','memory-consolidation'] },
  { id:'movement', title:'Motor control', description:'Basal ganglia, cerebellar circuits, descending pathways and axonal conduction.', ids:['basal-ganglia','dopamine','cerebellar-circuit','corticospinal','myelin','sodium-channel','potassium-channel'] },
  { id:'balance', title:'Excitation and inhibition', description:'Membrane potential, synaptic integration, inhibition and homeostatic plasticity.', ids:['resting-potential','synaptic-integration','gaba','gabaa','astrocytes','transmitter-clearance','homeostatic-plasticity'] },
];
export function makeRound(pool, count=10, random=Math.random) {
  const shuffled=[...pool];
  for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  return shuffled.slice(0,Math.min(count,shuffled.length));
}
export function cleanProgress(raw, topicIds) {
  const valid=new Set(topicIds);
  const list=value=>Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&valid.has(id)))]:[];
  return {understood:list(raw?.understood),saved:list(raw?.saved),missed:list(raw?.missed),lastTopic:valid.has(raw?.lastTopic)?raw.lastTopic:topicIds[0],depth:['essentials','mechanism','advanced'].includes(raw?.depth)?raw.depth:'essentials'};
}
