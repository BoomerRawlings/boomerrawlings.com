export const journeys = [
  { id:'thought', title:'From a thought to an ion', description:'Cross the scales, from cortical networks to the channels that carry a signal.', ids:['brain-overview','cerebral-cortex','cortical-circuit','neuron','synaptic-release','glutamate','ampa','sodium-channel'] },
  { id:'memory', title:'How a memory takes shape', description:'Trace a route from the hippocampus to a synapse that changes with experience.', ids:['hippocampus','hippocampal-circuit','nmda','ltp','ltd','structural-plasticity','memory-consolidation'] },
  { id:'movement', title:'The making of a movement', description:'Connect action selection, descending pathways, myelin and ion channels.', ids:['basal-ganglia','dopamine','cerebellar-circuit','corticospinal','myelin','sodium-channel','potassium-channel'] },
  { id:'balance', title:'Keeping a network in balance', description:'Explore excitation, inhibition and the mechanisms that stabilize a circuit.', ids:['resting-potential','synaptic-integration','gaba','gabaa','astrocytes','transmitter-clearance','homeostatic-plasticity'] },
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
